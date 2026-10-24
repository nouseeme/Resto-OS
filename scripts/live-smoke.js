import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {existsSync} from 'node:fs';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
if(existsSync('.env'))process.loadEnvFile('.env');
const {openCloudStore}=await import('../server/cloud-store.js');
const {supabase}=await import('../server/supabase.js');
const {removeMenuImage}=await import('../server/media.js');
const {MENU_COLUMNS}=await import('../server/menu-import.js');
const base=process.argv[2];
if(!base)throw new Error('Provide the target application URL explicitly.');
const store=openCloudStore();
if(process.argv.includes('--protected')){const {useProtectedFetch}=await import('./protected-fetch.js');useProtectedFetch(base)}
const marker=`qa_${randomBytes(5).toString('hex')}`,password=randomBytes(24).toString('base64url');
const email=`${marker}@example.com`;
let userId;
const jars={},menuIds=new Set(),orderIds=new Set(),tabIds=new Set(),images=new Set();
const check=(label)=>console.log(`PASS ${label}`);
async function call(client,path,body,expected=200){
  const response=await fetch(`${base}/api/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:jars[client]??'',Origin:base},body:body?JSON.stringify(body):undefined});
  for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],name=pair.split('=')[0];jars[client]=[...(jars[client]??'').split('; ').filter(x=>x&&!x.startsWith(name+'=')),pair].join('; ')}
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{throw new Error(`${path}: HTTP ${response.status}, expected JSON`)}
  assert.equal(response.status,expected,`${path}: ${data.error??'unexpected response'}`);return data;
}
try {
  const {data,error}=await supabase().auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:marker}});
  if(error)throw error;
  userId=data.user.id;
  assert.equal((await call('a','health')).database,'supabase');
  await call('a','state');await call('b','state');
  await call('a','setup',{password},403);
  for(const [client,role] of [['m','manager'],['w','waiter'],['k','kitchen']]){
    await call(client,'login',{email,password});assert.equal((await call(client,'state')).actor.role,null);await call(client,'workspace',{role});
  }
  check('server-only setup, login, independent workspace sessions');
  await call('a','action',{action:'pause',paused:true},401);
  await call('k','action',{action:'menuSave',name:'Denied',price:10000},403);
  const picture=await sharp({create:{width:160,height:100,channels:3,background:'#a43c2d'}}).png().toBuffer();
  const image=`data:image/png;base64,${picture.toString('base64')}`;
  await call('m','action',{action:'menuSave',name:marker,price:17000,category:'QA',description:'Temporary verification item',image});
  let menu=(await call('m','state')).menu.find(x=>x.name===marker);menuIds.add(menu.id);images.add(menu.photo);
  const photo=await fetch(menu.photo);assert.equal(photo.status,200);assert.match(photo.headers.get('content-type'),/image\/webp/);
  check('menu image uploaded, processed, publicly readable and persisted');
  await call('m','action',{action:'menuSave',menuId:menu.id,name:marker,price:17000,category:'QA',image:'data:image/png;base64,aGVsbG8='},400);
  const orderBody={name:marker,sessionTabId:null,items:[{menuId:menu.id,qty:2,price:17000}],requestId:randomUUID()};
  const [first,retry]=await Promise.all([call('a','orders',orderBody),call('a','orders',orderBody)]);
  orderIds.add(first.orderId);tabIds.add(first.tabId);assert.equal(first.orderId,retry.orderId);
  assert.equal((await call('b','state')).orders.length,0);
  await call('b','orders',{...orderBody,tabId:first.tabId,requestId:randomUUID()},409);
  assert.equal((await call('m','state?portal=1')).actor,null);
  check('concurrent order retry deduplicated and anonymous ownership isolated');
  await call('k','action',{action:'pause',paused:true});
  await call('b','orders',{...orderBody,name:marker+'b',requestId:randomUUID()},409);
  // No API request during this wait: only database Cron can accept the order.
  await new Promise(resolve=>setTimeout(resolve,17500));
  let order=(await call('k','state')).orders.find(x=>x.id===first.orderId);
  assert.equal(order.status,'accepted');assert.equal(order.acceptedBy,'Otomatis');
  await call('k','action',{action:'pause',paused:false});
  check('15-second auto-accept runs without browser traffic, even while paused');
  await call('m','action',{action:'menuSave',menuId:menu.id,name:marker,price:21000,category:'QA',image});
  menu=(await call('m','state')).menu.find(x=>x.id===menu.id);images.add(menu.photo);
  order=(await call('w','state')).orders.find(x=>x.id===first.orderId);assert.equal(order.units[0].price,17000);
  const unit=order.units[0];
  const pay=async()=>{const response=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Cookie:jars.w,Origin:base},body:JSON.stringify({action:'pay',orderId:order.id,unitIds:[unit.id],method:'Tunai'})});return response.status};
  assert.deepEqual((await Promise.all([pay(),pay()])).sort(),[200,409]);
  await call('k','action',{action:'cancel',orderId:order.id,unitIds:[unit.id],reason:'Paid correction'},409);
  await call('w','action',{action:'pay',orderId:order.id,method:'QRIS'});
  assert.equal((await call('w','state')).tabs.find(t=>t.id===first.tabId).closedAt,null);
  for(const action of ['cook','ready'])await call('k','action',{action,orderId:order.id});
  await call('w','action',{action:'deliver',orderId:order.id});
  const state=await call('m','state');assert.ok(state.tabs.find(t=>t.id===first.tabId).closedAt);
  assert.equal(state.payments.filter(p=>p.orderId===order.id).reduce((sum,p)=>sum+p.amount,0),34000);
  check('concurrent payment protection, price snapshots, cooking, delivery and correct closure');
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Menu');sheet.addRow(MENU_COLUMNS);sheet.addRow([marker,'QA',23000,'Updated by import','Ya']);
  const file=Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
  const preview=await call('m','menu-import/preview',{file});
  await call('m','menu-import/commit',{file,catalogRevision:preview.catalogRevision,requestId:randomUUID()});
  assert.equal((await call('m','state')).menu.find(x=>x.id===menu.id).photo,menu.photo);
  check('Excel preview/commit retains menu photo');
  await call('m','action',{action:'menuSave',menuId:menu.id,name:marker,price:23000,category:'QA',removePhoto:true});
  assert.equal((await call('a','state')).menu.find(x=>x.id===menu.id).photo,'');
  await call('w','workspace',{role:null});assert.equal((await call('w','state')).roleRequired,true);
  await call('w','workspace',{role:'manager'});assert.equal((await call('w','state')).actor.role,'manager');
  await call('w','logout',{});assert.equal((await call('w','state')).actor,null);
  check('photo removal, role switching, logout and subsequent state');
  const fresh=await openCloudStore().read();assert.ok(fresh.tabs.find(t=>t.id===first.tabId).closedAt);
  check('data survives a fresh backend instance');
} finally {
  if(userId){const {error}=await supabase().auth.admin.deleteUser(userId);if(error)throw error;}
  // Only this run's IDs/marker are removed; the real admin/catalog are preserved.
  await store.transaction(s=>{
    s.settings.paused=false;
    for(const m of s.menu.filter(m=>m.name===marker)){menuIds.add(m.id);if(m.photo)images.add(m.photo)}
    for(const t of s.tabs.filter(t=>t.name===marker))tabIds.add(t.id);
    for(const o of s.orders.filter(o=>tabIds.has(o.tabId)))orderIds.add(o.id);
    s.payments=s.payments.filter(p=>!orderIds.has(p.orderId));s.orders=s.orders.filter(o=>!orderIds.has(o.id));s.tabs=s.tabs.filter(t=>!tabIds.has(t.id));
    s.menu=s.menu.filter(m=>!menuIds.has(m.id));s.sessions=s.sessions.filter(x=>x.userId!==userId);s.users=s.users.filter(x=>x.id!==userId);
    s.audit=s.audit.filter(a=>a.actor!==marker && ![...orderIds,...tabIds,...menuIds].some(id=>String(a.detail).includes(id)));
    s.requests=Object.fromEntries(Object.entries(s.requests).filter(([key,v])=>!key.includes(userId)&&!orderIds.has(v.orderId)));
  });
  for(const url of images)await removeMenuImage(url);
  console.log('QA data and temporary images cleaned.');
}
