import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, placeOrder, operate, tabDue } from '../server/store.js';
import { selectReadState, presentState } from '../server/read-model.js';
import { openCloudStore, encodeState } from '../server/cloud-store.js';
import { financeSummary } from '../shared/finance.js';
import { createRefreshQueue } from '../shared/refresh-queue.js';

const waiter={id:'staff',name:'Garson',role:'waiter'};
function fixture(){
  const s=initialState();
  s.menu=[{id:'rice',name:'Nasi',category:'Utama',price:100,available:true}];
  s.users=[waiter];s.sessions=[{token:'private-session-token',userId:'staff'}];
  const create=(name,token,time)=>placeOrder(s,{name,sessionTabId:null,requestId:crypto.randomUUID(),items:[{menuId:'rice',price:100,qty:2}]},null,token,time);
  const old=create('Old debt','guest-old',Date.now()-10*86400000);
  const today=create('Today','guest-today',Date.now());
  return {s,old,today};
}
function view(s,scope,guest='guest-today',start=null){
  const selection=selectReadState(s,{scope,guest,start});
  const actor=scope==='portal'?null:{...waiter,role:scope==='kitchen'?'kitchen':scope==='waiter'?'waiter':'manager'};
  return presentState(selection.state,{actor,staff:actor,portalSession:selection.portalSession,imagesEnabled:false,cloud:false});
}

test('orders are accepted inside creation; ready, delivery and payment still close only together',()=>{
  const {s,today}=fixture(),o=s.orders.find(o=>o.id===today.orderId);
  assert.equal(o.status,'accepted');assert.ok(o.units.every(u=>u.status==='accepted'));assert.equal(o.autoAcceptAt,undefined);
  operate(s,{action:'pay',orderId:o.id,methodId:'method-0'},waiter);
  assert.equal(s.tabs.find(t=>t.id===o.tabId).closedAt,null);
  assert.throws(()=>operate(s,{action:'deliver',orderId:o.id},waiter),{status:409});
  operate(s,{action:'ready',orderId:o.id},{...waiter,role:'kitchen'});
  operate(s,{action:'deliver',orderId:o.id},waiter);
  assert.ok(s.tabs.find(t=>t.id===o.tabId).closedAt);
  assert.equal(s.payments.length,1);assert.equal(s.payments[0].amount,200);
  assert.throws(()=>operate(s,{action:'pay',orderId:o.id,methodId:'method-0'},waiter),{status:409});
});
test('public gateway exposes catalog and minimal ownership metadata, never orders or finance',()=>{
  const {s,today}=fixture();
  const v=view(s,'portal');
  assert.equal(v.portalSession.tabId,today.tabId);assert.equal(v.portalSession.name,'Today');
  assert.deepEqual(v.orders,[]);assert.deepEqual(v.tabs,[]);assert.deepEqual(v.payments,[]);
  assert.equal(v.expenses,undefined);assert.equal(v.settings.paymentMethods,undefined);
  assert.ok(!JSON.stringify(v).includes('private-session-token'));
  assert.ok(!JSON.stringify(v).includes('Old debt'));
});
test('kitchen receives service work without payment values or unrelated internal records',()=>{
  const {s,today}=fixture();
  s.orders[0].units.forEach(u=>{u.status='delivered';u.paid=true});
  const v=view(s,'kitchen');
  assert.deepEqual(v.orders.map(o=>o.id),[today.orderId]);
  assert.equal(v.orders[0].units[0].price,undefined);assert.equal(v.orders[0].units[0].paid,undefined);
  assert.deepEqual(v.payments,[]);assert.deepEqual(v.audit,[]);assert.deepEqual(v.expenses,[]);
  assert.equal(v.settings.paymentMethods,undefined);
});
test('waiter retains old debt and paid-but-undelivered work but excludes closed history',()=>{
  const {s,today}=fixture();
  operate(s,{action:'pay',orderId:today.orderId,methodId:'method-0'},waiter);
  let v=view(s,'waiter');assert.equal(v.orders.length,2);
  assert.equal(tabDue(v,v.tabs.find(t=>t.name==='Old debt')),200);
  operate(s,{action:'ready',orderId:today.orderId},{...waiter,role:'kitchen'});
  operate(s,{action:'deliver',orderId:today.orderId},waiter);
  v=view(s,'waiter');assert.equal(v.orders.length,1);assert.equal(v.tabs[0].name,'Old debt');
});
test('overview keeps all-time active debt while sales use order dates and receipts use payment dates',()=>{
  const {s,old}=fixture();
  operate(s,{action:'pay',orderId:old.orderId,unitIds:[s.orders[0].units[0].id],methodId:'method-0'},waiter);
  const start=new Date();start.setHours(0,0,0,0);
  const projected=selectReadState(s,{scope:'manager-overview',guest:null,start:start.toISOString()}).state;
  assert.deepEqual(financeSummary(projected,+start),financeSummary(s,+start));
  assert.equal(projected.tabs.filter(t=>!t.closedAt).length,s.tabs.filter(t=>!t.closedAt).length);
  assert.equal(projected.tabs.reduce((n,t)=>n+tabDue(projected,t),0),s.tabs.reduce((n,t)=>n+tabDue(s,t),0));
  assert.equal(projected.payments[0].amount,100);
});
test('read paths never call full snapshot and unchanged reads do not decode full state',async()=>{
  const calls=[];
  const adapter=openCloudStore({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='resto_context'?{}:{unchanged:true,version:'v1'}}}});
  await adapter.context('hash');const result=await adapter.view({scope:'kitchen',guest:'guest',knownVersion:'v1'});
  assert.equal(result.unchanged,true);assert.equal(result.state,undefined);
  assert.deepEqual(calls.map(c=>c.name),['resto_context','resto_view']);
});
test('optimistic write retries re-run against fresh state without losing another payment',async()=>{
  const {s}=fixture();let reads=0,commits=0;
  const adapter=openCloudStore({rpc:async(name)=>{
    if(name==='resto_snapshot'){reads++;return {data:{version:reads,rows:encodeState(s)}}}
    assert.equal(name,'resto_commit');commits++;
    if(commits===1){s.payments.push({id:'concurrent',amount:100});return {data:false}}
    return {data:true};
  }});
  const count=await adapter.transaction(state=>{state.settings.tagline='Changed';return state.payments.length});
  assert.equal(count,1);assert.equal(reads,2);assert.equal(commits,2);
});
test('refresh event arriving during a fetch is reconciled, without parallel requests',async()=>{
  let release,reads=0,inFlight=0,max=0;
  const request=createRefreshQueue(async()=>{reads++;inFlight++;max=Math.max(max,inFlight);if(reads===1)await new Promise(r=>release=r);inFlight--;return reads});
  const first=request();request();request();release();
  assert.equal(await first,2);assert.equal(reads,2);assert.equal(max,1);
});

test('archive detail retains receipt methods, amounts and dates for closed transactions',()=>{
  const {s,today}=fixture();
  operate(s,{action:'pay',orderId:today.orderId,methodId:'method-0'},waiter);
  operate(s,{action:'ready',orderId:today.orderId},{...waiter,role:'kitchen'});
  operate(s,{action:'deliver',orderId:today.orderId},waiter);
  const archive=view(s,'manager-history');
  assert.deepEqual(archive.payments,s.payments);
  assert.equal(archive.payments[0].amount,200);
  assert.equal(archive.payments[0].method,'Tunai');
  assert.ok(archive.tabs.find(t=>t.id===today.tabId).closedAt);
});
