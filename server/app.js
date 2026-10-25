import { queueImageCleanup, createImageCleanup } from './image-cleanup.js';
import express from 'express';
import { authenticateStaff, createStaff } from './staff-auth.js';
import { readScope, selectReadState, presentState } from './read-model.js';
import { liveConfig } from './live-config.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { openCloudStore } from './cloud-store.js';
import { prepareMenuImage, removeMenuImage } from './media.js';
import { openStore, assert, id, now, placeOrder, operate, passwordHash, passwordMatches } from './store.js';
import { PORTAL_PATH, STAFF_PATH } from '../shared/routes.js';
import { WORKSPACE_ROLES } from '../shared/workspaces.js';
import { parseMenuFile, previewMenuImport, commitMenuImport, menuTemplate } from './menu-import.js';
import { financeAction } from './finance.js';
import { reportWorkbook, reportPeriod } from './reports.js';

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
app.get('/api/health', async(req,res) => { if(cloud)await store.health(); res.set('Cache-Control','no-store').json({ok:true,database:cloud?'supabase':'sqlite'}); });
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
  const session = req.query.portal === '1' ? null : cookies(req).resto_staff;
  const local = cloud ? null : store.read();
  const context = cloud ? await store.context(session ? hash(session) : null) : null;
  const found = cloud ? context.session : session && local.sessions.find(x => x.token === hash(session) && Date.parse(x.expiresAt)>Date.now());
  req.staff = cloud ? context.staff : found ? local.users.find(u => u.id === found.userId) : null;
  req.staffSession = found;
  req.actor = req.staff && WORKSPACE_ROLES.includes(found.activeRole) ? { ...req.staff, role: found.activeRole } : null;
  if (req.query.portal === '1') { req.actor = null; req.staff = null; req.staffSession = null; }
  next();
});
app.get('/api/state', async(req,res) => {
  const scope = readScope(req.actor,req.query.view);
  const start = scope === 'manager-overview' && req.query.start ? new Date(String(req.query.start)) : null;
  assert(!start || Number.isFinite(+start),'Periode laporan tidak valid.');
  const knownVersion = typeof req.query.version === 'string' ? req.query.version : null;
  const identity = req.staff ? `${req.staff.id}:${req.actor?.role??'choose'}` : 'guest';
  const suffix = `|${identity}`;
  const databaseVersion = knownVersion?.endsWith(suffix) ? knownVersion.slice(0,-suffix.length) : null;
  const selected = cloud ? await store.view({scope,guest:req.guest,knownVersion:databaseVersion,start:start?.toISOString()??null}) : {version:`${store.version}:${scope}:${start?.toISOString()??''}`, ...selectReadState(store.read(),{scope,guest:req.guest,start:start?.toISOString()??null})};
  const version=selected.version+suffix;
  res.set('X-Resto-Images', cloud ? 'enabled' : 'disabled');
  if(selected.unchanged || (knownVersion && version===knownVersion))return res.json({unchanged:true,version,serverTime:now()});
  res.json({...presentState(selected.state,{actor:req.actor,staff:req.staff,portalSession:selected.portalSession,imagesEnabled,cloud}),version});
});
app.get('/api/live-config',async(req,res)=>res.json(cloud?await liveConfig(req,store):{mode:'local'}));
app.get('/api/changes',(req,res)=>{
  if(cloud)return res.status(404).end();
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache'});res.flushHeaders();
  res.write('event: ready\ndata: {}\n\n');
  const stop=store.subscribe(()=>res.write('event: changed\ndata: {}\n\n'));
  req.on('close',stop);
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
  const {realtime,...profile}=user;
  await store.transaction(s=>{if(cloud){const existing=s.users.find(u=>u.id===profile.id);if(existing)Object.assign(existing,profile);else s.users.push(profile);}s.sessions=s.sessions.filter(x=>Date.parse(x.expiresAt)>Date.now());s.sessions.push({token:hash(token),userId:profile.id,...(cloud?{authUserId:profile.id,realtime}:{}),activeRole:null,expiresAt:new Date(Date.now()+12*3600000).toISOString()});});
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
  if(body.action==='settings' && body.logo?.startsWith('data:') && imagesEnabled){
    assert(req.actor.role==='manager','Logo hanya dapat diubah dari Manajemen.',403);
    uploaded=await prepareMenuImage(body.logo,'branding');body.logo=uploaded;
  }
  delete body.image;delete body.removePhoto;
  try {
    const result=await mutate(req,s=>{
      oldPhoto=body.action==='settings'?s.settings.logo:s.menu.find(m=>m.id===body.menuId)?.photo;
      const result=['financeOption','expense'].includes(body.action)?financeAction(s,body,req.actor):operate(s,body,req.actor);
      if(['menuSave','menuDelete'].includes(body.action) && oldPhoto && !s.menu.some(item=>item.photo===oldPhoto))queueImageCleanup(s,oldPhoto);
      if(body.action==='settings' && oldPhoto && oldPhoto!==s.settings.logo)queueImageCleanup(s,oldPhoto);
      return result;
    });
    if(['menuSave','menuDelete','settings'].includes(body.action)){
      const pending=await cleanupMenuImages();
      if(pending)result.warning='Perubahan tersimpan. Penghapusan gambar lama akan dicoba lagi saat katalog atau identitas diperbarui.';
    }
    res.json(result);
  } catch(error) {
    // A lost RPC response can occur after commit. Never delete a photo that
    // might already be referenced by the persisted catalog.
    if(uploaded) {
      try { await store.transaction(s=>{if(s.settings.logo!==uploaded&&!s.menu.some(m=>m.photo===uploaded))queueImageCleanup(s,uploaded)});await cleanupMenuImages(); }
      catch { console.error('Photo cleanup deferred because database state could not be verified.'); }
    }
    throw error;
  }
});
app.get('/api/menu-template',async(req,res)=>{
  assert(req.actor?.role==='manager','Template katalog hanya tersedia di ruang Manajemen.',403);
  const file=await menuTemplate(cloud?(await store.view({scope:'manager-menu',guest:req.guest})).state.menu:store.read().menu);
  res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition','attachment; filename="template-menu-restoOS.xlsx"');
  res.send(file);
});
app.get('/api/reports',async(req,res)=>{
  assert(req.actor?.role==='manager','Laporan hanya tersedia di Manajemen.',403);
  const period=reportPeriod(req.query);
  const file=await reportWorkbook(await store.read(),period);
  res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition','attachment; filename="laporan-restoOS.xlsx"');
  res.send(file);
});
app.post('/api/menu-import/:step',async(req,res)=>{
  assert(req.actor?.role==='manager','Impor katalog hanya tersedia di ruang Manajemen.',403);
  assert(['preview','commit'].includes(req.params.step),'Tindakan impor tidak valid.');
  const parsed=await parseMenuFile(req.body.file);
  if(req.params.step==='preview')return res.json(previewMenuImport(cloud?(await store.view({scope:'manager-menu',guest:req.guest})).state.menu:store.read().menu,parsed));
  const result=await mutate(req,s=>{
    const session=s.sessions.find(x=>x.token===req.staffSession.token);
    assert(session?.activeRole==='manager','Ruang kerja berubah. Kembali ke Manajemen untuk menyimpan impor.',403);
    return commitMenuImport(s,parsed,req.body,req.actor);
  });
  res.json(result);
});
app.use('/api',async(req,res)=>res.status(404).json({error:'Layanan tidak ditemukan.'}));
app.use((err,req,res,next)=>{if(!err.status) console.error(err);res.status(err.status??500).json({error:err.status?err.message:'Ada kendala pada server. Coba lagi.'});});

export default app;
