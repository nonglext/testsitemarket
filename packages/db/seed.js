import pg from 'pg';
import argon2 from 'argon2';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
  await db.query('BEGIN');
  const parent=await db.query("INSERT INTO categories(name,slug,position) VALUES('Discord','discord',1) ON CONFLICT DO NOTHING RETURNING id");
  const parentId=parent.rows[0]?.id||(await db.query("SELECT id FROM categories WHERE slug='discord' AND parent_id IS NULL")).rows[0].id;
  const child=await db.query("INSERT INTO categories(parent_id,name,slug,position) VALUES($1,'Аккаунты','discord-accounts',1) ON CONFLICT DO NOTHING RETURNING id",[parentId]);
  const childId=child.rows[0]?.id||(await db.query("SELECT id FROM categories WHERE slug='discord-accounts'")).rows[0].id;
  await db.query("INSERT INTO category_policies(category_id,version,fee_bps,settings) VALUES($1,1,400,$2) ON CONFLICT DO NOTHING",[childId,JSON.stringify({guaranteeDays:5,disclaimer:'Продажа аккаунтов может нарушать правила сервиса. Запрещены украденные и взломанные аккаунты.'})]);
  for(const [key,label,type] of [['service','Сервис','text'],['registered','Дата регистрации','text'],['bindings','Привязки','text'],['features','Особенности','text'],['transfer','Способ передачи','text'],['lawful','Аккаунт получен законно','checkbox']])await db.query('INSERT INTO category_fields(category_id,key,type,label,required,filterable) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[childId,key,type,label,key==='lawful',key==='service']);
  if(process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD){
    const email=process.env.SEED_ADMIN_EMAIL.trim().toLowerCase();
    await db.query('SELECT pg_advisory_xact_lock(7472392)');
    const existing=await db.query('SELECT id FROM users WHERE lower(email)=$1',[email]);
    if(existing.rowCount){
      const role=await db.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role='admin'",[existing.rows[0].id]);
      if(!role.rowCount)throw new Error('SEED_ADMIN_EMAIL belongs to an existing non-admin account');
    }else{
      const administrators=await db.query("SELECT 1 FROM user_roles WHERE role='admin' LIMIT 1");
      if(administrators.rowCount)throw new Error('An administrator already exists; seed cannot create another');
      const user=await db.query('INSERT INTO users(nickname,email,password_hash,email_verified_at) VALUES($1,$2,$3,now()) RETURNING id',['admin',email,await argon2.hash(process.env.SEED_ADMIN_PASSWORD)]);
      await db.query('INSERT INTO profiles(user_id) VALUES($1)',[user.rows[0].id]);
      await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",[user.rows[0].id]);
    }
  }
  await db.query('COMMIT');
}catch(error){await db.query('ROLLBACK');throw error}finally{await db.end()}
