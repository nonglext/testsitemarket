import {Router} from 'express';
import {z} from 'zod';
import {db,transaction} from './db.js';
import {current} from './auth.js';
export const catalog=Router();
const id=z.coerce.number().int().positive();
const admin=(req,res,next)=>req.user.roles.includes('admin')?next():res.sendStatus(403);
catalog.get('/me/lots',current,async(req,res)=>{
  const result=await db.query("SELECT l.id,l.title,l.description,l.price::text,l.quantity,l.status,l.version,c.name category FROM lots l JOIN categories c ON c.id=l.category_id WHERE l.seller_id=$1 AND l.status IN ('active','hidden') ORDER BY l.id DESC",[req.user.id]);
  res.json(result.rows);
});
catalog.patch('/me/lots/:id',current,async(req,res)=>{
  const data=z.object({
    title:z.string().trim().min(5).max(160),
    description:z.string().trim().min(10).max(10000),
    price:z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).refine(value=>Number(value)>0),
    quantity:z.number().int().min(0).max(100000),
    status:z.enum(['active','hidden']),
    version:z.number().int().nonnegative().optional()
  }).strict().parse(req.body);
  const lotId=id.parse(req.params.id);
  const result=await db.query("UPDATE lots SET title=$3,description=$4,price=$5,quantity=$6,status=$7,version=version+1 WHERE id=$1 AND seller_id=$2 AND status IN ('active','hidden') AND ($8::integer IS NULL OR version=$8) RETURNING id",[lotId,req.user.id,data.title,data.description,data.price,data.quantity,data.status,data.version??null]);
  if(!result.rowCount){
    const existing=await db.query("SELECT 1 FROM lots WHERE id=$1 AND seller_id=$2 AND status IN ('active','hidden')",[lotId,req.user.id]);
    if(existing.rowCount)return res.status(409).json({error:'Предложение изменилось. Обновите страницу и повторите.'});
    return res.status(404).json({error:'Предложение не найдено'});
  }
  res.json(result.rows[0]);
});
catalog.delete('/me/lots/:id',current,async(req,res)=>{
  const result=await db.query("UPDATE lots SET status='deleted',version=version+1 WHERE id=$1 AND seller_id=$2 AND status IN ('active','hidden') RETURNING id",[id.parse(req.params.id),req.user.id]);
  if(!result.rowCount)return res.status(404).json({error:'Предложение не найдено'});
  res.json({ok:true});
});
catalog.get('/categories',async(req,res)=>res.json((await db.query("SELECT id,parent_id,name,slug,icon FROM categories WHERE status='active' ORDER BY position,id")).rows));
catalog.get('/categories/:slug',async(req,res)=>{const r=await db.query("SELECT c.*,p.settings,p.fee_bps FROM categories c LEFT JOIN LATERAL(SELECT settings,fee_bps FROM category_policies WHERE category_id=c.id ORDER BY version DESC LIMIT 1)p ON true WHERE c.slug=$1 AND c.status='active'",[req.params.slug]);if(!r.rowCount)return res.sendStatus(404);const fields=await db.query('SELECT id,key,type,label,hint,required,filterable FROM category_fields WHERE category_id=$1 AND archived_at IS NULL ORDER BY position,id',[r.rows[0].id]);res.json({...r.rows[0],fields:fields.rows});});
catalog.get('/categories/:slug/lots',async(req,res)=>{
  const sort=z.enum(['recent','price_asc','price_desc','quantity']).default('recent').parse(req.query.sort);
  const query=z.string().trim().max(120).optional().parse(req.query.q);
  const ordering={recent:'l.bumped_at DESC NULLS LAST,l.id DESC',price_asc:'l.price ASC,l.id DESC',price_desc:'l.price DESC,l.id DESC',quantity:'l.quantity DESC,l.id DESC'}[sort];
  const result=await db.query(`SELECT l.id,l.title,l.description,l.price::text,l.quantity,l.delivery_mode,u.id seller_id,u.nickname,COALESCE(round(avg(rv.rating)::numeric,2),0) rating FROM lots l JOIN categories c ON c.id=l.category_id JOIN users u ON u.id=l.seller_id LEFT JOIN reviews rv ON rv.order_id IN (SELECT id FROM orders WHERE seller_id=u.id) WHERE c.slug=$1 AND c.status='active' AND l.status='active' AND ($2::text IS NULL OR l.title ILIKE '%'||$2||'%') GROUP BY l.id,u.id ORDER BY ${ordering} LIMIT 100`,[req.params.slug,query||null]);
  res.json(result.rows);
});
catalog.get('/lots/:id',async(req,res)=>{const r=await db.query("SELECT l.*,l.price::text,c.slug category_slug,u.nickname seller_name FROM lots l JOIN categories c ON c.id=l.category_id JOIN users u ON u.id=l.seller_id WHERE l.id=$1 AND l.status='active'",[id.parse(req.params.id)]);if(!r.rowCount)return res.sendStatus(404);res.json(r.rows[0]);});
catalog.get('/users/:id',async(req,res)=>{const r=await db.query("SELECT u.id,u.nickname,u.created_at,u.last_seen_at,u.seller_since,p.theme,COALESCE(round(avg(rv.rating)::numeric,2),0) rating,count(rv.id) reviews FROM users u JOIN profiles p ON p.user_id=u.id LEFT JOIN orders o ON o.seller_id=u.id LEFT JOIN reviews rv ON rv.order_id=o.id WHERE u.id=$1 GROUP BY u.id,p.theme",[id.parse(req.params.id)]);if(!r.rowCount)return res.sendStatus(404);res.json(r.rows[0]);});
catalog.get('/users/:id/lots',async(req,res)=>res.json((await db.query("SELECT l.id,l.title,l.price::text,l.quantity,c.name category,c.slug FROM lots l JOIN categories c ON c.id=l.category_id WHERE l.seller_id=$1 AND l.status='active' ORDER BY c.position,l.id DESC",[id.parse(req.params.id)])).rows));
catalog.post('/lots',current,async(req,res,next)=>{try{const data=z.object({categoryId:id,title:z.string().trim().min(5).max(160),description:z.string().min(10).max(10000),price:z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).refine(value=>Number(value)>0),quantity:z.number().int().min(1).max(100000),deliveryMode:z.literal('manual').default('manual'),fields:z.record(z.string(),z.unknown()).default({})}).parse(req.body);const result=await transaction(async c=>{const category=await c.query("SELECT id FROM categories WHERE id=$1 AND parent_id IS NOT NULL AND status='active'",[data.categoryId]);if(!category.rowCount)throw Object.assign(Error('Категория не найдена'),{status:400});const definitions=await c.query('SELECT id,key,required FROM category_fields WHERE category_id=$1 AND archived_at IS NULL',[data.categoryId]);for(const f of definitions.rows)if(f.required&&!data.fields[f.key])throw Object.assign(Error('Заполните '+f.key),{status:400});const lot=await c.query("INSERT INTO lots(seller_id,category_id,title,description,price,quantity,delivery_mode,status) VALUES($1,$2,$3,$4,$5,$6,$7,'active') RETURNING id",[req.user.id,data.categoryId,data.title,data.description,data.price,data.quantity,data.deliveryMode]);for(const f of definitions.rows)if(data.fields[f.key]!==undefined)await c.query('INSERT INTO lot_field_values(lot_id,field_id,value) VALUES($1,$2,$3)',[lot.rows[0].id,f.id,JSON.stringify(data.fields[f.key])]);await c.query('UPDATE users SET seller_since=COALESCE(seller_since,now()) WHERE id=$1',[req.user.id]);return lot.rows[0];});res.status(201).json(result);}catch(error){next(error);}});
catalog.get('/admin/categories',current,admin,async(req,res)=>res.json((await db.query('SELECT * FROM categories ORDER BY parent_id NULLS FIRST,position,id')).rows));
catalog.post('/admin/categories',current,admin,async(req,res,next)=>{try{const d=z.object({parentId:id.nullable().default(null),name:z.string().min(2).max(80),slug:z.string().regex(/^[a-z0-9-]+$/),icon:z.string().default(''),position:z.number().int().default(0)}).parse(req.body);const existing=await db.query('SELECT id FROM categories WHERE slug=$1',[d.slug]);if(existing.rowCount)throw Object.assign(Error('Этот адрес категории уже занят'),{status:409});if(d.parentId){const parent=await db.query('SELECT id FROM categories WHERE id=$1 AND parent_id IS NULL',[d.parentId]);if(!parent.rowCount)throw Object.assign(Error('Выберите существующий раздел'),{status:400});}const r=await db.query('INSERT INTO categories(parent_id,name,slug,icon,position) VALUES($1,$2,$3,$4,$5) RETURNING *',[d.parentId,d.name,d.slug,d.icon,d.position]);res.status(201).json(r.rows[0]);}catch(e){next(e);}});
catalog.post('/admin/categories/:id/fields',current,admin,async(req,res,next)=>{try{const d=z.object({key:z.string().regex(/^[a-z_]+$/),type:z.enum(['text','number','select','checkbox','file']),label:z.string().min(1),required:z.boolean().default(false),filterable:z.boolean().default(false)}).parse(req.body);const r=await db.query('INSERT INTO category_fields(category_id,key,type,label,required,filterable) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[id.parse(req.params.id),d.key,d.type,d.label,d.required,d.filterable]);res.status(201).json(r.rows[0]);}catch(e){next(e);}});
