import {Router} from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {db,transaction} from './db.js';
export const auth=Router();
const hash=value=>createHash('sha256').update(value).digest('hex');
const random=()=>randomBytes(32).toString('hex');
const credentials=z.object({email:z.email().transform(v=>v.toLowerCase()),password:z.string().min(10)});
const cookie={httpOnly:true,sameSite:'lax',secure:process.env.PUBLIC_ORIGIN?.startsWith('https://'),path:'/'};
export async function current(req,res,next){
  try{
    const claims=jwt.verify(req.cookies.access,process.env.JWT_SECRET);
    const result=await db.query("SELECT u.id,u.nickname,u.email,p.theme,array_remove(array_agg(r.role),null) roles FROM sessions s JOIN users u ON u.id=s.user_id JOIN profiles p ON p.user_id=u.id LEFT JOIN user_roles r ON r.user_id=u.id WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active' GROUP BY u.id,p.theme",[claims.sid]);
    if(!result.rowCount)return res.status(401).json({error:'Войдите в аккаунт'});
    req.user=result.rows[0];next();
  }catch{res.status(401).json({error:'Войдите в аккаунт'});}
}
auth.post('/register',async(req,res,next)=>{try{
  const data=credentials.extend({nickname:z.string().trim().min(3).max(32).regex(/^[\p{L}\p{N}_-]+$/u)}).parse(req.body);
  await transaction(async c=>{
    const result=await c.query('INSERT INTO users(nickname,email,password_hash) VALUES($1,$2,$3) RETURNING id',[data.nickname,data.email,await argon2.hash(data.password)]);
    await c.query('INSERT INTO profiles(user_id) VALUES($1)',[result.rows[0].id]);
  });
  res.status(201).json({registered:true});
}catch(error){next(error);}});
auth.post('/verify',async(req,res,next)=>{try{
  const token=z.string().length(64).parse(req.body.token);
  const found=await transaction(async c=>{const r=await c.query("DELETE FROM auth_challenges WHERE token_hash=$1 AND purpose='verify' AND expires_at>now() RETURNING user_id",[hash(token)]);if(r.rowCount)await c.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[r.rows[0].user_id]);return r.rowCount;});
  res.status(found?200:400).json({verified:!!found});
}catch(error){next(error);}});
auth.post('/login',async(req,res,next)=>{try{
  const data=credentials.parse(req.body);
  const result=await db.query("SELECT * FROM users WHERE email=$1 AND status='active'",[data.email]);
  const user=result.rows[0];
  if(!user||!await argon2.verify(user.password_hash,data.password))return res.status(401).json({error:'Неверные данные'});
  const refresh=random();
  const session=await db.query("INSERT INTO sessions(user_id,refresh_hash,device,expires_at) VALUES($1,$2,$3,now()+interval '30 days') RETURNING id",[user.id,hash(refresh),req.get('user-agent')?.slice(0,255)]);
  res.cookie('access',jwt.sign({sid:session.rows[0].id},process.env.JWT_SECRET,{expiresIn:'15m'}),{...cookie,maxAge:900000});
  res.cookie('refresh',refresh,{...cookie,maxAge:2592000000});res.json({id:user.id});
}catch(error){next(error);}});
auth.post('/refresh',async(req,res)=>{const refresh=random();const result=await db.query("UPDATE sessions SET refresh_hash=$2 WHERE refresh_hash=$1 AND revoked_at IS NULL AND expires_at>now() RETURNING id",[hash(req.cookies.refresh||''),hash(refresh)]);if(!result.rowCount)return res.sendStatus(401);res.cookie('access',jwt.sign({sid:result.rows[0].id},process.env.JWT_SECRET,{expiresIn:'15m'}),{...cookie,maxAge:900000});res.cookie('refresh',refresh,{...cookie,maxAge:2592000000});res.json({ok:true});});
auth.post('/logout',async(req,res)=>{await db.query('UPDATE sessions SET revoked_at=now() WHERE refresh_hash=$1',[hash(req.cookies.refresh||'')]);res.clearCookie('access');res.clearCookie('refresh');res.json({ok:true});});
