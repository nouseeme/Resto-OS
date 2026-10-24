import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { openStore, assert, id, now, tick, placeOrder, operate, passwordHash, passwordMatches } from './store.js';
import { PORTAL_PATH, STAFF_PATH } from '../shared/routes.js';
import { WORKSPACE_ROLES } from '../shared/workspaces.js';
import { parseMenuFile, previewMenuImport, commitMenuImport } from './menu-import.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = openStore(process.env.RESTO_DB ?? path.join(root, 'data', 'resto.sqlite'));
const app = express();
app.disable('x-powered-by');
app.get(['/', '/index.html'], (req,res)=>res.redirect(302, PORTAL_PATH));
app.get(STAFF_PATH, (req,res,next)=>{res.set('X-Robots-Tag','noindex, nofollow, noarchive');next();});
app.use(express.json({ limit: '850kb' }));
const cookies = req => Object.fromEntries((req.headers.cookie ?? '').split(';').filter(x=>x.includes('=')).map(x=>{const p=x.trim().indexOf('=');return [x.trim().slice(0,p),x.trim().slice(p+1)]}));
const hash = value => createHash('sha256').update(value).digest('hex');
const secure = process.env.RESTO_SECURE_COOKIE === '1';
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure, path: '/' };
app.use('/api', (req, res, next) => {
  res.set('Cache-Control','no-store'); res.set('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    if (origin && origin !== `${req.protocol}://${req.headers.host}`) return res.status(403).json({ error: 'Asal permintaan tidak diizinkan.' });
    if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Permintaan lintas situs ditolak.' });
  }
  let token = cookies(req).resto_guest;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) { token = randomBytes(32).toString('hex'); res.cookie('resto_guest', token, { ...cookieOptions, maxAge: 365*86400000 }); }
  req.guest = hash(token);
  const session = cookies(req).resto_staff;
  const s = store.read();
  const found = session && s.sessions.find(x => x.token === hash(session) && Date.parse(x.expiresAt)>Date.now());
  req.staff = found ? s.users.find(u => u.id === found.userId) : null;
  req.staffSession = found;
  req.actor = req.staff && WORKSPACE_ROLES.includes(found.activeRole) ? { ...req.staff, role: found.activeRole } : null;
  if (req.query.portal === '1') { req.actor = null; req.staff = null; req.staffSession = null; }
  next();
});
app.get('/api/state', (req,res) => {
  const s = store.read();
  const publicSettings = s.settings;
  const ownTabs = s.tabs.filter(t=>t.token === req.guest);
  const tab = ownTabs.find(t=>!t.closedAt) ?? ownTabs.at(-1);
  if (req.staff && !req.actor) return res.json({ settings: s.settings, menu: [], setupRequired: false, actor: {id:req.staff.id,name:req.staff.name,username:req.staff.username,role:null}, roleRequired: true, tabs: [], orders: [], payments: [], audit: [], users: [], serverTime: now() });
  if (!req.actor) return res.json({ settings: publicSettings, menu: s.menu, setupRequired: !s.users.length, actor: null, tabs: tab ? [{...tab,token:undefined}] : [], orders: tab ? s.orders.filter(o=>o.tabId===tab.id).map(({token,...o})=>({...o, status:undefined,acceptedAt:undefined,acceptedBy:undefined,autoAcceptAt:undefined, units:o.units.map(({status,readyAt,cookingAt,deliveredAt,...u})=>({...u,cancelled:status==='cancelled'}))})) : [], payments: [], ban: s.bans[req.guest] ?? null, serverTime: now() });
  const { password, ...actor } = req.actor;
  const role = actor.role;
  res.json({ settings: s.settings, menu: s.menu, actor, setupRequired: false, tabs: s.tabs.map(({token,...t})=>({...t, ban: s.bans[token] ?? null})), orders: s.orders.map(({token,...o})=>role==='kitchen' ? {...o,units:o.units.map(({paid,paymentId,price,...u})=>u)} : o), payments: role === 'kitchen' ? [] : s.payments, audit: role === 'manager' ? s.audit.slice(-200).reverse() : [], users: role==='manager' ? s.users.map(({password,...u})=>u) : [], serverTime: now() });
});
const loginAttempts = new Map();
app.post('/api/login', (req,res) => {
  const address = req.socket.remoteAddress; const attempts = loginAttempts.get(address) ?? [];
  const recent = attempts.filter(t=>Date.now()-t<60000); assert(recent.length<8, 'Terlalu banyak percobaan. Coba lagi dalam satu menit.',429);
  recent.push(Date.now()); loginAttempts.set(address,recent);
  const user = store.read().users.find(u=>u.username === String(req.body.username).toLowerCase());
  assert(user && typeof req.body.password==='string' && req.body.password.length<=200 && passwordMatches(req.body.password,user.password), 'Nama pengguna atau kata sandi salah.',401);
  const token = randomBytes(32).toString('hex');
  store.transaction(s=>{s.sessions = s.sessions.filter(x=>Date.parse(x.expiresAt)>Date.now()); s.sessions.push({token:hash(token), userId:user.id,activeRole:null,expiresAt:new Date(Date.now()+12*3600000).toISOString()});});
  res.cookie('resto_staff',token,{...cookieOptions,maxAge:12*3600000}).json({ok:true});
});
app.post('/api/workspace',(req,res)=>{
  assert(req.staff, 'Silakan masuk sebagai staf.',401);
  const role=req.body.role;
  assert(role===null || WORKSPACE_ROLES.includes(role), 'Pilih Dapur, Garson, atau Manajemen.');
  store.transaction(s=>{
    const session=s.sessions.find(x=>x.token===req.staffSession.token);
    assert(session && Date.parse(session.expiresAt)>Date.now(),'Sesi berakhir. Silakan masuk kembali.',401);
    session.activeRole=role;
    s.audit.push({id:id(),at:now(),actor:req.staff.name,action:'workspace_changed',detail:role??'Memilih ruang kerja'});
  });
  res.json({ok:true,role});
});
app.post('/api/setup', (req,res)=>{
  store.transaction(s=>{
    assert(!s.users.length,'Pengaturan awal sudah selesai.',409);
    assert(req.socket.remoteAddress==='127.0.0.1' || req.socket.remoteAddress==='::1' || req.socket.remoteAddress==='::ffff:127.0.0.1','Pengaturan awal hanya tersedia di komputer server.',403);
    assert(typeof req.body.password==='string' && req.body.password.length>=10 && req.body.password.length<=200,'Kata sandi minimal 10 karakter.');
    s.users.push({id:id(),name:'Manajer',username:'admin',role:'manager',password:passwordHash(req.body.password)});
  }); res.json({ok:true});
});
app.post('/api/logout',(req,res)=>{const token=cookies(req).resto_staff;store.transaction(s=>s.sessions=s.sessions.filter(x=>x.token!==hash(token??'')));res.clearCookie('resto_staff',cookieOptions).json({ok:true});});
app.post('/api/users',(req,res)=>{
  assert(req.actor?.role==='manager','Hanya manajemen yang dapat menambah staf.',403);
  store.transaction(s=>{
    const {name,username,password}=req.body;
    assert(typeof name==='string' && name.trim().length>=2 && name.length<=60,'Nama staf harus 2–60 karakter.');
    assert(/^[a-z0-9_-]{3,30}$/.test(username),'Nama pengguna 3–30 huruf kecil, angka, _ atau -.');
    assert(typeof password==='string' && password.length>=10 && password.length<=200,'Kata sandi minimal 10 karakter.');
    assert(!s.users.some(u=>u.username===username),'Nama pengguna sudah dipakai.',409);
    s.users.push({id:id(),name:name.trim(),username,password:passwordHash(password)});
  });res.json({ok:true});
});
app.post('/api/orders',(req,res)=>{
  assert(!req.staff || req.actor, 'Pilih ruang kerja sebelum mulai bekerja.',403);
  if(req.actor) assert(req.actor.role==='waiter','Pindah ke ruang Garson untuk membuat order.',403);
  const result = store.transaction(s=>placeOrder(s,req.body,req.actor,req.guest));
  if(result.error) return res.status(result.status).json(result);
  res.json(result);
});
app.post('/api/action',(req,res)=>{assert(req.actor,req.staff?'Pilih ruang kerja sebelum mulai bekerja.':'Silakan masuk sebagai staf.',req.staff?403:401);res.json(store.transaction(s=>operate(s,req.body,req.actor)));});
app.post('/api/menu-import/:step',async(req,res)=>{
  assert(req.actor?.role==='manager','Impor katalog hanya tersedia di ruang Manajemen.',403);
  assert(['preview','commit'].includes(req.params.step),'Tindakan impor tidak valid.');
  const parsed=await parseMenuFile(req.body.file);
  if(req.params.step==='preview')return res.json(previewMenuImport(store.read().menu,parsed));
  const result=store.transaction(s=>{
    const session=s.sessions.find(x=>x.token===req.staffSession.token);
    assert(session?.activeRole==='manager','Ruang kerja berubah. Kembali ke Manajemen untuk menyimpan impor.',403);
    return commitMenuImport(s,parsed,req.body,req.actor);
  });
  res.json(result);
});
app.use('/api',(req,res)=>res.status(404).json({error:'Layanan tidak ditemukan.'}));
app.use((err,req,res,next)=>{if(!err.status) console.error(err);res.status(err.status??500).json({error:err.status?err.message:'Ada kendala pada server. Coba lagi.'});});
setInterval(()=>{try{if(store.read().orders.some(o=>o.status==='waiting'&&Date.now()>=Date.parse(o.autoAcceptAt)))store.transaction(s=>tick(s))}catch(e){console.error('Auto-accept gagal',e)}},500).unref();
if(process.argv.includes('--production')) {
  app.use(express.static(path.join(root,'dist'), { index: false }));
  app.get([PORTAL_PATH, STAFF_PATH],(req,res)=>res.sendFile(path.join(root,'dist','index.html')));
  app.use((req,res)=>res.status(404).type('text').send('Halaman tidak ditemukan.'));
}
else { const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true,hmr:{port:Number(process.env.PORT??3000)+20000}},appType:'spa'});app.use(vite.middlewares); }
const port=Number(process.env.PORT??3000);
app.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`restoOS siap di http://localhost:${port}`));
