import test from 'node:test';
import assert from 'node:assert/strict';
process.env.APP_DEMO_MODE='true';
const { createDemoState } = await import('../server/demo-seed.js');
const { tabDue } = await import('../server/store.js');
import { financeSummary } from '../shared/finance.js';
test('demo dataset has exact active queues, receivables and reconciled receipts',()=>{
 const s=createDemoState();
 assert.equal(s.menu.length,8);assert.equal(new Set(s.menu.map(m=>m.category)).size,3);
 assert.equal(s.orders.filter(o=>o.units.some(u=>u.status==='cooking')).length,3);
 assert.equal(s.orders.filter(o=>o.units.some(u=>u.status==='ready')).length,4);
 const debts=s.tabs.filter(t=>!t.closedAt&&s.orders.filter(o=>o.tabId===t.id).every(o=>o.units.every(u=>u.status==='delivered')));
 assert.equal(debts.length,5);assert.equal(debts.filter(t=>s.payments.some(p=>p.tabId===t.id)).length,3);assert.ok(debts.every(t=>tabDue(s,t)>0));
 for(const p of s.payments){const units=s.orders.find(o=>o.id===p.orderId).units.filter(u=>u.paymentId===p.id);assert.equal(p.amount,units.reduce((n,u)=>n+u.price,0));assert.deepEqual(p.unitIds,units.map(u=>u.id))}
 assert.ok(financeSummary(s).incoming>0);assert.ok(financeSummary(s).outgoing>0);assert.equal(s.expenses.length,6);
});
test('demo API remains isolated with production credentials configured',async()=>{
 process.env.APP_DEMO_MODE='true';process.env.VERCEL='1';process.env.SUPABASE_URL='https://invalid.example';process.env.SUPABASE_SECRET_KEY='must-never-be-used';
 const {app,cloud}=await import('../server/app.js');assert.equal(cloud,false);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;let state,cookie='';
 const call=async(path,body)=>{const r=await fetch(base+'/api/demo',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify({state,path,method:body?'POST':'GET',body})});const cookies=r.headers.getSetCookie();if(cookies.length){const jar=Object.fromEntries(cookie.split('; ').filter(Boolean).map(c=>c.split('=')));for(const c of cookies){const [k,v]=c.split(';')[0].split('=');jar[k]=v}cookie=Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ');}const result=await r.json();state=result.state;return {status:r.status,value:result.value}};
 try{
 assert.equal((await fetch(base+'/api/demo-config').then(r=>r.json())).demo,true);
 let r=await call('/state?portal=1');assert.equal(r.value.menu.length,8);assert.equal(r.value.features.menuImageUpload,false);assert.equal(r.value.actor,null);
 r=await call('/state');assert.equal(r.value.roleRequired,true);assert.equal(r.value.actor.id,'demo-staff');
 r=await call('/live-config');assert.equal(r.value.mode,'demo');assert.equal(r.value.url,undefined);
 r=await call('/workspace',{role:'kitchen'});assert.equal(r.status,200);
 r=await call('/state');const before=r.value.version;assert.ok(before);
 r=await call('/state?version='+encodeURIComponent(before));assert.equal(r.value.unchanged,true);
 r=await call('/action',{action:'ready',orderId:'demo-order-0'});assert.equal(r.status,200);
 assert.ok(state.orders[0].units.every(u=>u.status==='ready'));
 r=await call('/state?version='+encodeURIComponent(before));assert.notEqual(r.value.unchanged,true);assert.notEqual(r.value.version,before);
 r=await call('/workspace',{role:'waiter'});assert.equal(r.status,200);
 r=await call('/action',{action:'deliver',orderId:'demo-order-0'});assert.equal(r.status,200);
 r=await call('/action',{action:'pay',orderId:'demo-order-0',methodId:'method-0'});assert.equal(r.status,200);assert.ok(state.tabs[0].closedAt);
 const independent=await fetch(base+'/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/state',method:'GET'})}).then(r=>r.json());assert.equal(independent.state.orders[0].units[0].status,'cooking');
 assert.equal((await fetch(base+'/api/state')).status,400);
 const {liveConfig}=await import('../server/live-config.js');await assert.rejects(()=>liveConfig({},{}),/disabled in demo/);
 const {supabase}=await import('../server/supabase.js');assert.throws(supabase,/disabled in demo/);
 const {openStore}=await import('../server/store.js');assert.throws(()=>openStore('data/should-not-open.sqlite'),/disabled in demo/);
 const {openCloudStore}=await import('../server/cloud-store.js');assert.throws(()=>openCloudStore({}),/disabled in demo/);
 const {authenticateStaff,staffStillAllowed,createStaff}=await import('../server/staff-auth.js');
 await assert.rejects(()=>authenticateStaff('real@example.com','secret',{}),/disabled in demo/);
 await assert.rejects(()=>staffStillAllowed('real-user',{}),/disabled in demo/);
 await assert.rejects(()=>createStaff({},()=>{},{}),/disabled in demo/);
 delete process.env.APP_DEMO_MODE;assert.throws(supabase,/disabled in demo/);
 }finally{await new Promise(r=>server.close(r))}
});
