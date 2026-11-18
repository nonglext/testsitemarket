import {Router} from 'express';
import {z} from 'zod';
import {db,transaction} from './db.js';
import {current} from './auth.js';
import {notifyOrder} from './realtime.js';

export const demo=Router();
demo.use(current);
const id=z.coerce.number().int().positive().safe();
const key=z.uuid();
const bad=message=>Object.assign(new Error(message),{status:400});

demo.get('/wallet',async(req,res)=>{
  const wallet=await db.query('SELECT available::text FROM demo_wallets WHERE user_id=$1',[req.user.id]);
  const history=await db.query('SELECT id,amount::text,kind,order_id,created_at FROM demo_wallet_entries WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[req.user.id]);
  res.json({balance:wallet.rows[0]?.available||'0.000000',history:history.rows});
});
demo.post('/wallet/topup',async(req,res)=>{
  const data=z.object({amount:z.string().regex(/^\d{1,7}(\.\d{1,6})?$/).refine(v=>Number(v)>0),requestKey:key}).parse(req.body);
  const result=await transaction(async c=>{
    await c.query('INSERT INTO demo_wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING',[req.user.id]);
    await c.query('SELECT user_id FROM demo_wallets WHERE user_id=$1 FOR UPDATE',[req.user.id]);
    const old=await c.query('SELECT amount::text,kind FROM demo_wallet_entries WHERE user_id=$1 AND request_key=$2',[req.user.id,data.requestKey]);
    if(old.rowCount){if(old.rows[0].kind!=='topup'||Number(old.rows[0].amount)!==Number(data.amount))throw bad('Ключ операции уже использован');return {ok:true};}
    await c.query('UPDATE demo_wallets SET available=available+$2::numeric WHERE user_id=$1',[req.user.id,data.amount]);
    await c.query("INSERT INTO demo_wallet_entries(user_id,amount,kind,request_key) VALUES($1,$2,'topup',$3)",[req.user.id,data.amount,data.requestKey]);
    return {ok:true};
  });
  res.json(result);
});
demo.post('/orders',async(req,res)=>{
  const data=z.object({lotId:id,quantity:z.number().int().min(1).max(100000),requestKey:key}).parse(req.body);
  const result=await transaction(async c=>{
    await c.query('INSERT INTO demo_wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING',[req.user.id]);
    await c.query('SELECT user_id FROM demo_wallets WHERE user_id=$1 FOR UPDATE',[req.user.id]);
    const old=await c.query('SELECT id,lot_id,quantity FROM demo_orders WHERE buyer_id=$1 AND request_key=$2',[req.user.id,data.requestKey]);
    if(old.rowCount){if(Number(old.rows[0].lot_id)!==data.lotId||old.rows[0].quantity!==data.quantity)throw bad('Ключ покупки уже использован');return {id:old.rows[0].id};}
    const lot=await c.query("SELECT * FROM lots WHERE id=$1 AND status='active' FOR UPDATE",[data.lotId]);
    if(!lot.rowCount)throw bad('Предложение недоступно');
    const item=lot.rows[0];
    if(item.seller_id===req.user.id)throw bad('Нельзя купить своё предложение');
    if(item.quantity<data.quantity)throw bad('Недостаточно товара в наличии');
    if(item.delivery_mode!=='manual')throw bad('Этот способ выдачи пока недоступен');
    const debit=await c.query('UPDATE demo_wallets SET available=available-($2::numeric*$3) WHERE user_id=$1 AND available >= ($2::numeric*$3) RETURNING available',[req.user.id,item.price,data.quantity]);
    if(!debit.rowCount)throw bad('Недостаточно тестовых средств');
    const order=await c.query("INSERT INTO demo_orders(buyer_id,seller_id,lot_id,lot_title,quantity,unit_price,total,status,request_key) VALUES($1,$2,$3,$4,$5,$6,$6::numeric*$5::integer,'paid',$7) RETURNING id,total",[req.user.id,item.seller_id,item.id,item.title,data.quantity,item.price,data.requestKey]);
    await c.query('UPDATE lots SET quantity=quantity-$2 WHERE id=$1',[item.id,data.quantity]);
    await c.query("INSERT INTO demo_wallet_entries(user_id,amount,kind,order_id) VALUES($1,-$2::numeric,'purchase',$3)",[req.user.id,order.rows[0].total,order.rows[0].id]);
    return {id:order.rows[0].id};
  });
  res.status(201).json(result);
});
demo.get('/orders',async(req,res)=>{
  const role=z.enum(['buyer','seller']).default('buyer').parse(req.query.role);
  const column=role==='buyer'?'buyer_id':'seller_id';
  const result=await db.query(`SELECT o.*,o.total::text,u.nickname AS counterparty FROM demo_orders o JOIN users u ON u.id=o.${role==='buyer'?'seller_id':'buyer_id'} WHERE o.${column}=$1 ORDER BY o.id DESC LIMIT 100`,[req.user.id]);
  res.json(result.rows);
});
demo.get('/orders/:id',async(req,res)=>{
  const result=await db.query("SELECT o.*,o.unit_price::text,o.total::text,b.nickname buyer_name,s.nickname seller_name FROM demo_orders o JOIN users b ON b.id=o.buyer_id JOIN users s ON s.id=o.seller_id WHERE o.id=$1 AND (o.buyer_id=$2 OR o.seller_id=$2)",[id.parse(req.params.id),req.user.id]);
  if(!result.rowCount)return res.status(404).json({error:'Заказ не найден'});
  res.json({...result.rows[0],viewer_id:req.user.id});
});
demo.get('/orders/:id/messages',async(req,res)=>{
  const result=await db.query("SELECT m.id,m.body,m.sender_id,m.created_at,u.nickname FROM demo_order_messages m JOIN demo_orders o ON o.id=m.order_id JOIN users u ON u.id=m.sender_id WHERE o.id=$1 AND (o.buyer_id=$2 OR o.seller_id=$2) ORDER BY m.id",[id.parse(req.params.id),req.user.id]);
  const access=await db.query('SELECT 1 FROM demo_orders WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)',[id.parse(req.params.id),req.user.id]);
  if(!access.rowCount)return res.status(404).json({error:'Заказ не найден'});
  res.json(result.rows);
});
demo.post('/orders/:id/messages',async(req,res)=>{
  const orderId=id.parse(req.params.id);
  const data=z.object({body:z.string().trim().min(1).max(4000),clientKey:key}).parse(req.body);
  const result=await db.query("INSERT INTO demo_order_messages(order_id,sender_id,body,client_key) SELECT id,$2,$3,$4 FROM demo_orders WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2) ON CONFLICT(order_id,sender_id,client_key) DO UPDATE SET client_key=excluded.client_key RETURNING id,body",[orderId,req.user.id,data.body,data.clientKey]);
  if(!result.rowCount)return res.status(404).json({error:'Заказ не найден'});
  if(result.rows[0].body!==data.body)throw bad('Ключ сообщения уже использован');
  await notifyOrder(orderId,'message');
  res.status(201).json({id:result.rows[0].id});
});
demo.post('/orders/:id/deliver',async(req,res)=>{
  const result=await db.query("UPDATE demo_orders SET status='delivered',delivered_at=now() WHERE id=$1 AND seller_id=$2 AND status='paid' RETURNING id",[id.parse(req.params.id),req.user.id]);
  if(!result.rowCount)throw bad('Передача недоступна для этого заказа');
  await notifyOrder(req.params.id,'order');
  res.json({ok:true});
});
demo.post('/orders/:id/confirm',async(req,res)=>{
  await transaction(async c=>{
    const result=await c.query("SELECT * FROM demo_orders WHERE id=$1 AND buyer_id=$2 FOR UPDATE",[id.parse(req.params.id),req.user.id]);
    if(!result.rowCount)throw bad('Заказ не найден');
    const order=result.rows[0];
    if(order.status==='completed')return;
    if(!['paid','delivered'].includes(order.status))throw bad('Этот заказ нельзя подтвердить');
    await c.query('INSERT INTO demo_wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING',[order.seller_id]);
    await c.query('UPDATE demo_wallets SET available=available+$2::numeric WHERE user_id=$1',[order.seller_id,order.total]);
    await c.query("INSERT INTO demo_wallet_entries(user_id,amount,kind,order_id) VALUES($1,$2,'sale',$3)",[order.seller_id,order.total,order.id]);
    await c.query("UPDATE demo_orders SET status='completed',completed_at=now() WHERE id=$1",[order.id]);
  });
  await notifyOrder(req.params.id,'order');
  res.json({ok:true});
});
