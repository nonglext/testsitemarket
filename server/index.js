import express from 'express';
import cookieParser from 'cookie-parser';
import {rateLimit} from 'express-rate-limit';
import {createServer} from 'node:http';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {db} from './db.js';
import {auth,current} from './auth.js';
import {catalog} from './catalog.js';
import {demo} from './demo.js';
import {setupRealtime} from './realtime.js';
const app=express();
if (process.env.RENDER === 'true') app.set('trust proxy', 1);
const root=join(dirname(fileURLToPath(import.meta.url)),'..','public');
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin=req.get('origin');
  if (origin) {
    let expected;
    try { expected=process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).origin : `${req.protocol}://${req.get('host')}`; }
    catch { return res.status(500).json({error:'Ошибка настройки сервера'}); }
    if (origin!==expected) return res.status(403).json({error:'Запрос отклонён'});
  } else if (req.get('sec-fetch-site')==='cross-site') {
    return res.status(403).json({error:'Запрос отклонён'});
  }
  next();
});
app.use(express.json({limit:'100kb'}),cookieParser());
app.use('/api/auth',rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}),auth);
app.use('/api',catalog);
app.use('/api/demo',demo);
app.get('/api/me',current,(req,res)=>res.json(req.user));
app.patch('/api/me/theme',current,async(req,res)=>{if(!['light','gray','black'].includes(req.body.theme))return res.sendStatus(400);await db.query('UPDATE profiles SET theme=$1 WHERE user_id=$2',[req.body.theme,req.user.id]);res.json({theme:req.body.theme});});
app.get('/health',async(req,res)=>{try{await db.query('SELECT 1');res.json({ok:true});}catch{res.status(503).json({ok:false});}});
app.get('/fonts/inter.woff2',(req,res)=>res.sendFile(join(process.cwd(),'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2')));
app.use(express.static(root));
for(const [route,page] of [['/users/:id','user'],['/category/:slug','category'],['/lots/:id','lot'],['/admin','admin'],['/sell','sales'],['/my-lots','sales'],['/orders','purchases'],['/orders/:id','purchases'],['/sales','purchases'],['/messages','messages'],['/wallet','finance']]) app.get(route,(req,res)=>res.sendFile(join(root,page+'.html')));
app.use('/api',(req,res)=>res.status(404).json({error:'Маршрут не найден'}));
app.use((error,req,res,next)=>{console.error(error);res.status(error.status|| (error.code==='23505'?409:error.name==='ZodError'?400:500)).json({error:error.code==='23505'?'Уже существует':error.name==='ZodError'?'Проверьте поля':error.status && error.status<500?error.message:'Ошибка сервера'});});
const server=createServer(app);
setupRealtime(server);
server.listen(process.env.PORT||3000,()=>console.log('Listening on '+(process.env.PORT||3000)));
