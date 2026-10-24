import { queueImageCleanup, createImageCleanup } from './image-cleanup.js';
import express from 'express';
import { authenticateStaff, staffStillAllowed, createStaff } from './staff-auth.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { openCloudStore } from './cloud-store.js';
import { prepareMenuImage, removeMenuImage } from './media.js';
import { openStore, assert, id, now, tick, placeOrder, operate, passwordHash, passwordMatches } from './store.js';
import { PORTAL_PATH, STAFF_PATH } from '../shared/routes.js';
import { WORKSPACE_ROLES } from '../shared/workspaces.js';
import { parseMenuFile, previewMenuImport, commitMenuImport, menuTemplate } from './menu-import.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const cloud = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && !process.env.RESTO_DB);
const imagesEnabled = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const store = cloud ? openCloudStore() : openStore(process.env.RESTO_DB ?? path.join(root, 'data', 'resto.sqlite'));
const cleanupMenuImages=createImageCleanup(store,removeMenuImage);
if (process.env.VERCEL && !cloud) throw new Error('Supabase configuration is required on Vercel.');
export const app = express();
if (process.env.VERCEL) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.get(['/', '/index.html'], async(req,res)=>res.redirect(302, PORTAL_PATH));
app.get(STAFF_PATH, (req,res,next)=>{res.set('X-Robots-Tag','noindex, nofollow, noarchive');next();});
app.use(express.json({ limit: '3mb' }));
const cookies = req => Object.fromEntries((req.headers.cookie ?? '').split(';').filter(x=>x.includes('=')).map(x=>{const p=x.trim().indexOf('=');return [x.trim().slice(0,p),x.trim().slice(p+1)]}));
const hash = value => createHash('sha256').update(value).digest('hex');
const secure = process.env.RESTO_SECURE_COOKIE === '1' || Boolean(process.env.VERCEL);
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure, path: '/' };
app.get('/api/health', async(req,res) => { await store.read(); res.set('Cache-Control','no-store').json({ok:true,database:cloud?'supabase':'sqlite'}); });
app.use('/api', async (req, res, next) => {
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
  const s = await store.read();
  req.state = s;
  let found = session && s.sessions.find(x => x.token === hash(session) && Date.parse(x.expiresAt)>Date.now());
  if (cloud && found && (!found.authUserId || !await staffStillAllowed(found.authUserId))) found = null;
  req.staff = found ? s.users.find(u => u.id === found.userId) : null;
  req.staffSession = found;
  req.actor = req.staff && WORKSPACE_ROLES.includes(found.activeRole) ? { ...req.staff, role: found.activeRole } : null;
  if (req.query.portal === '1') { req.actor = null; req.staff = null; req.staffSession = null; }
  next();
});
app.get('/api/state', async(req,res) => {
  const s = req.state;
  if(req.actor?.role==='manager')await cleanupMenuImages();
  res.set('X-Resto-Images', cloud ? 'enabled' : 'disabled');
  const publicSettings = s.settings; const features={menuImageUpload:imagesEnabled,staffAuth:cloud?'supabase':'local'};
  const ownTabs = s.tabs.filter(t=>t.token === req.guest);
  const tab = ownTabs.find(t=>!t.closedAt) ?? ownTabs.at(-1);
  if (req.staff && !req.actor) return res.json({ settings: s.settings, features, menu: [], setupRequired: false, actor: {id:req.staff.id,name:req.staff.name,username:req.staff.username,role:null}, roleRequired: true, tabs: [], orders: [], payments: [], audit: [], users: [], serverTime: now() });
  if (!req.actor) return res.json({ settings: publicSettings, features, menu: s.menu, setupRequired: !cloud && !s.users.length, actor: null, tabs: tab ? [{...tab,token:undefined}] : [], orders: tab ? s.orders.filter(o=>o.tabId===tab.id).map(({token,...o})=>({...o, status:undefined,acceptedAt:undefined,acceptedBy:undefined,autoAcceptAt:undefined, units:o.units.map(({status,readyAt,cookingAt,deliveredAt,...u})=>({...u,cancelled:status==='cancelled'}))})) : [], payments: [], ban: s.bans[req.guest] ?? null, serverTime: now() });
  const { password, ...actor } = req.actor;
  const role = actor.role;
  res.json({ settings: s.settings, features, menu: s.menu, actor, setupRequired: false, tabs: s.tabs.map(({token,...t})=>({...t, ban: s.bans[token] ?? null})), orders: s.orders.map(({token,...o})=>role==='kitchen' ? {...o,units:o.units.map(({paid,paymentId,price,...u})=>u)} : o), payments: role === 'kitchen' ? [] : s.payments, audit: role === 'manager' ? s.audit.slice(-200).reverse() : [], users: role==='manager' ? s.users.map(({password,...u})=>u) : [], serverTime: now() });
});
app.post('/api/login', async(req,res) => {
  const address = hash(req.ip ?? req.socket.remoteAddress ?? 'unknown');
  let user = await store.transaction(s => {
    s.loginAttempts ??= {};
    s.loginAttempts = Object.fromEntries(Object.entries(s.loginAttempts).map(([k,v]) => [k,v.filter(t => Date.now()-t<60000)]).filter(([,v])=>v.length));
    const attempts = s.loginAttempts[address] ?? [];
    if (attempts.length >= 8) return {limited:true};
    s.loginAttempts[address] = [...attempts, Date.now()];
    return s.users.find(u=>u.username === String(req.body.username).toLowerCase()) ?? null;
  });
  assert(!user?.limited,'Terlalu banyak percobaan. Coba lagi dalam satu menit.',429);
  if (cloud) user = await authenticateStaff(req.body.email, req.body.password);
  else assert(user && typeof req.body.password==='string' && req.body.password.length<=200 && passwordMatches(req.body.password,user.password), 'Nama pengguna atau kata sandi salah.',401);
  const token=randomBytes(32).toString('hex');
  await store.transaction(s=>{if(cloud){const existing=s.users.find(u=>u.id===user.id);if(existing)Object.assign(existing,user);else s.users.push(user);}s.sessions=s.sessions.filter(x=>Date.parse(x.expiresAt)>Date.now());s.sessions.push({token:hash(token),userId:user.id,...(cloud?{authUserId:user.id}:{}),activeRole:null,expiresAt:new Date(Date.now()+12*3600000).toISOString()});});
  res.cookie('resto_staff',token,{...cookieOptions,maxAge:12*3600000}).json({ok:true});
});
// Resolve session/workspace again inside every retried transaction.
async function mutate(req,fn) {
  return store.transaction(s=>{
    if (req.staffSession) {
      const session=s.sessions.find(x=>x.token===req.staffSession.token && Date.parse(x.expiresAt)>Date.now());
      const staff=session && s.users.find(x=>x.id===session.userId);
      assert(staff,'Sesi berakhir. Silakan masuk kembali.',401);
      assert(session.activeRole===req.staffSession.activeRole,'Ruang kerja sudah berubah. Muat ulang sebelum melanjutkan.',409);
      req.staff=staff;req.actor=WORKSPACE_ROLES.includes(session.activeRole)?{...staff,role:session.activeRole}:null;
    }
    return fn(s);
  });
}
app.post('/api/workspace',async(req,res)=>{
  assert(req.staff, 'Silakan masuk sebagai staf.',401);
  const role=req.body.role;
  assert(role===null || WORKSPACE_ROLES.includes(role), 'Pilih Dapur, Garson, atau Manajemen.');
  await mutate(req,s=>{
    const session=s.sessions.find(x=>x.token===req.staffSession.token);
    assert(session && Date.parse(session.expiresAt)>Date.now(),'Sesi berakhir. Silakan masuk kembali.',401);
    session.activeRole=role;
    s.audit.push({id:id(),at:now(),actor:req.staff.name,action:'workspace_changed',detail:role??'Memilih ruang kerja'});
  });
  res.json({ok:true,role});
});
app.post('/api/setup', async(req,res)=>{
  assert(!cloud,'Pengaturan awal produksi hanya dilakukan melalui alat administrasi lokal.',403);
  await mutate(req,s=>{
    assert(!s.users.length,'Pengaturan awal sudah selesai.',409);
    assert(req.socket.remoteAddress==='127.0.0.1' || req.socket.remoteAddress==='::1' || req.socket.remoteAddress==='::ffff:127.0.0.1','Pengaturan awal hanya tersedia di komputer server.',403);
    assert(typeof req.body.password==='string' && req.body.password.length>=10 && req.body.password.length<=200,'Kata sandi minimal 10 karakter.');
    s.users.push({id:id(),name:'Manajer',username:'admin',role:'manager',password:passwordHash(req.body.password)});
  }); res.json({ok:true});
});
app.post('/api/logout',async(req,res)=>{const token=cookies(req).resto_staff;await store.transaction(s=>s.sessions=s.sessions.filter(x=>x.token!==hash(token??'')));res.clearCookie('resto_staff',cookieOptions).json({ok:true});});
app.post('/api/users',async(req,res)=>{
  assert(req.actor?.role==='manager','Hanya manajemen yang dapat menambah staf.',403);
  if(cloud){
    const checkManager=()=>assert(req.actor?.role==='manager','Hanya manajemen yang dapat menambah staf.',403);
    await mutate(req,checkManager);
    await createStaff(req.body, user=>mutate(req,s=>{checkManager();s.users.push(user);}));
    return res.json({ok:true});
  }
  await mutate(req,s=>{
    const {name,username,password}=req.body;
    assert(typeof name==='string' && name.trim().length>=2 && name.length<=60,'Nama staf harus 2–60 karakter.');
    assert(/^[a-z0-9_-]{3,30}$/.test(username),'Nama pengguna 3–30 huruf kecil, angka, _ atau -.');
    assert(typeof password==='string' && password.length>=10 && password.length<=200,'Kata sandi minimal 10 karakter.');
    assert(!s.users.some(u=>u.username===username),'Nama pengguna sudah dipakai.',409);
    s.users.push({id:id(),name:name.trim(),username,password:passwordHash(password)});
  });res.json({ok:true});
});
app.post('/api/orders',async(req,res)=>{
  assert(!req.staff || req.actor, 'Pilih ruang kerja sebelum mulai bekerja.',403);
  if(req.actor) assert(req.actor.role==='waiter','Pindah ke ruang Garson untuk membuat order.',403);
  const result = await mutate(req,s=>placeOrder(s,req.body,req.actor,req.guest));
  if(result.error) return res.status(result.status).json(result);
  res.json(result);
});
app.post('/api/action',async(req,res)=>{
  assert(req.actor,req.staff?'Pilih ruang kerja sebelum mulai bekerja.':'Silakan masuk sebagai staf.',req.staff?403:401);
  assert(!Object.hasOwn(req.body,'photo'),'Foto harus diunggah melalui formulir menu.');
  const body={...req.body};
  let oldPhoto;
  let uploaded;
  if (body.action==='menuSave') {
    assert(req.actor.role==='manager','Foto menu hanya dapat diubah dari Manajemen.',403);
    body.menuId ??= id();
    if (body.image) {
      assert(imagesEnabled,'Upload foto memerlukan Supabase Storage.',503);
      uploaded=await prepareMenuImage(body.image,body.menuId);body.photo=uploaded;
    } else if(body.removePhoto) body.photo='';
  } else assert(!body.image && !body.removePhoto,'Tindakan foto tidak valid.');
  delete body.image;delete body.removePhoto;
  try {
    const result=await mutate(req,s=>{
      oldPhoto=s.menu.find(m=>m.id===body.menuId)?.photo;
      const result=operate(s,body,req.actor);
      if(['menuSave','menuDelete'].includes(body.action) && oldPhoto && !s.menu.some(item=>item.photo===oldPhoto))queueImageCleanup(s,oldPhoto);
      return result;
    });
    if(['menuSave','menuDelete'].includes(body.action)){
      const pending=await cleanupMenuImages();
      if(pending)result.warning='Menu tersimpan. Penghapusan gambar dari Storage belum selesai dan akan dicoba lagi otomatis saat Management aktif.';
    }
    res.json(result);
  } catch(error) {
    // A lost RPC response can occur after commit. Never delete a photo that
    // might already be referenced by the persisted catalog.
    if(uploaded) {
      try { await store.transaction(s=>{if(!s.menu.some(m=>m.photo===uploaded))queueImageCleanup(s,uploaded)});await cleanupMenuImages(); }
      catch { console.error('Photo cleanup deferred because database state could not be verified.'); }
    }
    throw error;
  }
});
app.get('/api/menu-template',async(req,res)=>{
  assert(req.actor?.role==='manager','Template katalog hanya tersedia di ruang Manajemen.',403);
  const file=await menuTemplate(req.state.menu);
  res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition','attachment; filename="template-menu-restoOS.xlsx"');
  res.send(file);
});
app.post('/api/menu-import/:step',async(req,res)=>{
  assert(req.actor?.role==='manager','Impor katalog hanya tersedia di ruang Manajemen.',403);
  assert(['preview','commit'].includes(req.params.step),'Tindakan impor tidak valid.');
  const parsed=await parseMenuFile(req.body.file);
  if(req.params.step==='preview')return res.json(previewMenuImport(req.state.menu,parsed));
  const result=await mutate(req,s=>{
    const session=s.sessions.find(x=>x.token===req.staffSession.token);
    assert(session?.activeRole==='manager','Ruang kerja berubah. Kembali ke Manajemen untuk menyimpan impor.',403);
    return commitMenuImport(s,parsed,req.body,req.actor);
  });
  res.json(result);
});
app.use('/api',async(req,res)=>res.status(404).json({error:'Layanan tidak ditemukan.'}));
app.use((err,req,res,next)=>{if(!err.status) console.error(err);res.status(err.status??500).json({error:err.status?err.message:'Ada kendala pada server. Coba lagi.'});});
if (!cloud) setInterval(()=>{try{if(store.read().orders.some(o=>o.status==='waiting'&&Date.now()>=Date.parse(o.autoAcceptAt)))store.transaction(s=>tick(s))}catch(e){console.error('Auto-accept gagal',e)}},500).unref();

export default app;
