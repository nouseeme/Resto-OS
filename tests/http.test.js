import {initialState as fixtureState} from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import ExcelJS from 'exceljs';
import {MENU_COLUMNS} from '../server/menu-import.js';

test('HTTP access and transaction boundaries across anonymous browsers and staff roles',async()=>{
 const port=3457,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server/index.js','--production'],{env:{...process.env,RESTO_DB:':memory:',PORT:String(port)},stdio:'pipe'});
 try {
  await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('restoOS siap'))resolve()});child.on('error',reject);child.on('exit',code=>reject(new Error(`Server exited ${code}`)))});
  for(const path of ['/', '/index.html']) {
    const root=await fetch(base+path,{redirect:'manual'});
    assert.equal(root.status,302);assert.equal(root.headers.get('location'),'/portal');
  }
  const staffPage=await fetch(base+'/ruang-staf');
  assert.equal(staffPage.status,200);assert.equal(staffPage.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
  assert.equal((await fetch(base+'/login')).status,404);
  assert.equal((await fetch(base+'/unknown')).status,404);
  const jar={};
  async function call(client,path,body){const res=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:jar[client]??'',Origin:base},body:body?JSON.stringify(body):undefined});const cookies=res.headers.getSetCookie();for(const raw of cookies){const pair=raw.split(';')[0],name=pair.split('=')[0];jar[client]=[...(jar[client]??'').split('; ').filter(x=>x&&!x.startsWith(name+'=')),pair].join('; ')}return {status:res.status,data:await res.json()}}
  await call('a','state');await call('b','state');
  assert.equal((await call('m','setup',{password:'manager-test-only'})).status,200);
  assert.equal((await call('m','login',{username:'admin',password:'manager-test-only'})).status,200);
  const signedIn=(await call('m','state')).data;
  assert.equal(signedIn.actor.role,null);assert.equal(signedIn.roleRequired,true);assert.equal(signedIn.orders.length,0);assert.equal(signedIn.users.length,0);
  assert.equal((await call('m','users',{username:'blocked',name:'Blocked',password:'staff-test-only'})).status,403);
  assert.equal((await call('m','workspace',{role:'invalid'})).status,400);
  assert.equal((await call('a','workspace',{role:'manager'})).status,401);
  assert.equal((await call('m','workspace',{role:'manager'})).status,200);
  assert.equal((await call('m','state')).data.menu.length,0);
  for(const {photo,...item} of fixtureState().menu) assert.equal((await call('m','action',{action:'menuSave',...item})).status,200);
  const teaId=(await call('m','state')).data.menu.find(m=>m.name==='Es teh melati').id;
  for(const [username,role] of [['waiter','waiter'],['chef','kitchen']]){assert.equal((await call('m','users',{username,name:username,password:'staff-test-only'})).status,200);assert.equal((await call(username,'login',{username,password:'staff-test-only'})).status,200);assert.equal((await call(username,'state')).data.actor.role,null);assert.equal((await call(username,'workspace',{role})).status,200)}
  const body={name:'Rizki',items:[{menuId:teaId,qty:2,price:12000}],requestId:randomUUID()};
  const order=await call('a','orders',body);assert.equal(order.status,200);assert.equal((await call('a','orders',body)).data.orderId,order.data.orderId);
  assert.equal((await call('b','orders',{...body,requestId:randomUUID(),tabId:order.data.tabId})).status,409);
  assert.equal((await call('b','state')).data.orders.length,0);
  assert.equal((await call('a','action',{action:'pay',orderId:order.data.orderId,method:'Tunai'})).status,401);
  assert.equal((await call('chef','action',{action:'pay',orderId:order.data.orderId,method:'Tunai'})).status,403);
  assert.equal((await call('m','action',{action:'accept',orderId:order.data.orderId})).status,403);
  assert.equal((await call('waiter','action',{action:'rename',tabId:order.data.tabId,name:'Nama Baru'})).status,200);
  assert.equal((await call('a','state')).data.tabs[0].name,'Nama Baru');
  const staffState=(await call('waiter','state')).data;const o=staffState.orders[0];
  assert.equal((await call('waiter','action',{action:'pay',orderId:o.id,unitIds:[o.units[0].id],method:'QRIS'})).status,200);
  assert.equal((await call('waiter','action',{action:'pay',orderId:o.id,unitIds:[o.units[0].id],method:'QRIS'})).status,409);
  assert.equal((await call('waiter','action',{action:'pay',orderId:o.id,method:'Tunai'})).status,200);
  assert.equal((await call('waiter','state')).data.payments.reduce((n,p)=>n+p.amount,0),24000);
  assert.equal((await call('waiter','state')).data.tabs[0].closedAt,null);
  for(const action of ['accept','cook','ready'])assert.equal((await call('chef','action',{action,orderId:o.id})).status,200);
  assert.equal((await call('waiter','action',{action:'deliver',orderId:o.id})).status,200);
  assert.ok((await call('waiter','state')).data.tabs[0].closedAt);
  assert.equal((await call('a','state')).data.orders[0].units[0].status,undefined);
  assert.equal((await call('m','state?portal=1')).data.actor,null);
  assert.equal((await call('m','state?portal=1')).data.orders.length,0);
  const next=await call('a','orders',{...body,requestId:randomUUID()});assert.notEqual(next.data.tabId,order.data.tabId);
  // A workspace belongs to the authenticated session, rather than the account.
  assert.equal((await call('waiter','workspace',{role:null})).status,200);
  const choosing=(await call('waiter','state')).data;
  assert.equal(choosing.actor.role,null);assert.equal(choosing.orders.length,0);assert.equal(choosing.payments.length,0);
  assert.equal((await call('waiter','action',{action:'pay',orderId:o.id,method:'Tunai'})).status,403);
  assert.equal((await call('waiter','orders',{...body,name:'Blocked',requestId:randomUUID()})).status,403);
  assert.equal((await call('waiter','workspace',{role:'kitchen'})).status,200);
  const switched=(await call('waiter','state')).data;
  assert.equal(switched.actor.role,'kitchen');assert.equal(switched.actor.username,'waiter');assert.equal(switched.payments.length,0);
  assert.equal((await call('waiter','action',{action:'pay',orderId:next.data.orderId,method:'Tunai'})).status,403);
  assert.equal((await call('waiter','workspace',{role:'manager'})).status,200);
  assert.equal((await call('waiter','orders',{...body,name:'Blocked',requestId:randomUUID()})).status,403);
  assert.equal((await call('waiter','action',{action:'pay',orderId:next.data.orderId,method:'Tunai'})).status,403);
  const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Menu');sheet.addRow(MENU_COLUMNS);sheet.addRow(['Es teh melati','Minuman',19000,'Baru','Ya']);sheet.addRow(['Menu HTTP','Minuman',21000,'','Ya']);
  const file=Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
  assert.equal((await call('a','menu-import/preview',{file})).status,403);
  assert.equal((await call('chef','menu-import/preview',{file})).status,403);
  const preview=await call('waiter','menu-import/preview',{file});assert.equal(preview.status,200);assert.equal(preview.data.creates,1);assert.equal(preview.data.updates,1);
  const commitBody={file,catalogRevision:preview.data.catalogRevision,requestId:randomUUID()};
  assert.equal((await call('waiter','menu-import/commit',commitBody)).status,200);
  assert.equal((await call('waiter','menu-import/commit',commitBody)).status,200);
  const imported=(await call('waiter','state')).data;
  assert.equal(imported.menu.length,9);assert.equal(imported.menu.find(m=>m.id===teaId).price,19000);assert.equal(imported.orders[0].units[0].price,12000);
  await call('m','logout',{});
  assert.equal((await call('m','login',{username:'admin',password:'manager-test-only'})).status,200);
  assert.equal((await call('m','state')).data.actor.role,null);
 }finally{child.kill()}
});
