import {initialState} from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { placeOrder, operate, tick, due, id, openStore } from '../server/store.js';
const waiter={id:'staff',name:'Garson',role:'waiter'}, kitchen={id:'chef',name:'Dapur',role:'kitchen'}, manager={id:'manager',name:'Manajer',role:'manager'};
const request=(name='Rizki',qty=2)=>({name,requestId:id(),items:[{menuId:'m6',qty,price:12000}]});
const unitAction=(s,action,actor,order=s.orders[0],units=order.units)=>operate(s,{action,orderId:order.id,unitIds:units.map(u=>u.id),method:'Tunai',reason:'Salah pesan'},actor);
test('complete lifecycle: partial pay and readiness, all channels, safe closure and name reuse',()=>{
 const s=initialState();const result=placeOrder(s,request(),null,'token');
 placeOrder(s,{...request(),tabId:result.tabId},waiter,null);
 assert.equal(s.tabs.length,1);assert.equal(s.orders.length,2);
 const first=s.orders[0];unitAction(s,'pay',waiter,first,[first.units[0]]);assert.equal(due(first.units),12000);
 operate(s,{action:'pay',orderId:first.id,method:'QRIS'},waiter);assert.equal(due(first.units),0);assert.equal(s.payments.reduce((n,p)=>n+p.amount,0),24000);assert.equal(s.tabs[0].closedAt,null);
 for(const o of s.orders){unitAction(s,'accept',kitchen,o);unitAction(s,'ready',kitchen,o,[o.units[0]]);assert.equal(o.units[1].status,'cooking');unitAction(s,'deliver',waiter,o,[o.units[0]]);unitAction(s,'ready',kitchen,o,[o.units[1]]);unitAction(s,'deliver',waiter,o,[o.units[1]])}
 assert.equal(s.tabs[0].closedAt,null);unitAction(s,'pay',waiter,s.orders[1]);assert.ok(s.tabs[0].closedAt);
 placeOrder(s,request(),null,'token');assert.equal(s.tabs.length,2);assert.notEqual(s.orders[0].slug,s.orders[2].slug);
});
test('orders retain timestamps without sessions or time-based transaction splitting',()=>{
 for(const gap of [119*60000,120*60000,120*60000+1000,121*60000]){
  const s=initialState(),t=Date.parse('2026-10-23T23:30:00Z');placeOrder(s,request(),null,'token',t);placeOrder(s,request(),null,'token',t+gap);assert.equal(s.tabs.length,1);assert.equal(s.tabs[0].sessions,undefined);assert.equal(s.orders[1].sessionId,undefined);assert.equal(s.orders[1].createdAt,new Date(t+gap).toISOString());
 }
 const s=initialState(),t=Date.now();for(let i=0;i<4;i++)placeOrder(s,request(),null,'token',t+i*24*3600000);assert.equal(s.tabs.length,1);assert.equal(s.orders.length,4);
});
test('name normalization and ownership prevent taking over tabs; rename preserves slugs',()=>{
 const s=initialState();placeOrder(s,request('  Rizki   Dua '),null,'a');assert.throws(()=>placeOrder(s,request('rizki dua'),null,'b'),/dipakai/);assert.equal(s.tabs.length,1);
 const slug=s.orders[0].slug;operate(s,{action:'rename',tabId:s.tabs[0].id,name:'Nama Baru'},waiter);
 placeOrder(s,{...request('Rizki Dua'),tabId:'fake'},null,'a');assert.equal(s.tabs[0].name,'Nama Baru');assert.equal(s.orders[0].slug,slug);assert.equal(s.tabs.length,1);
});
test('idempotent order retry and double payment/delivery do not duplicate obligations',()=>{
 const s=initialState(),r=request();const a=placeOrder(s,r,null,'a'),b=placeOrder(s,r,null,'a');assert.deepEqual(a,b);assert.equal(s.orders.length,1);
 unitAction(s,'pay',waiter);assert.throws(()=>unitAction(s,'pay',waiter),/dibayar/);assert.equal(s.payments.length,1);
 unitAction(s,'accept',kitchen);unitAction(s,'ready',kitchen);unitAction(s,'deliver',waiter);assert.throws(()=>unitAction(s,'deliver',waiter),/Status/);
});
test('server checks roles, prices, availability, pause and refuses paid cancellation',()=>{
 const s=initialState();const r=request();r.items[0].price=1;assert.throws(()=>placeOrder(s,r,null,'a'),/Harga/);assert.equal(s.tabs.length,0);
 s.menu.find(m=>m.id==='m6').available=false;assert.throws(()=>placeOrder(s,request(),null,'a'),/tersedia/);s.menu.find(m=>m.id==='m6').available=true;
 s.settings.paused=true;assert.throws(()=>placeOrder(s,request(),null,'a'),/dijeda/);s.settings.paused=false;placeOrder(s,request(),null,'a');
 assert.throws(()=>unitAction(s,'ready',waiter),/Peran/);assert.throws(()=>unitAction(s,'accept',manager),/Peran/);unitAction(s,'pay',waiter);assert.throws(()=>unitAction(s,'cancel',waiter),/dibayar/);assert.equal(s.tabs[0].closedAt,null);
});
test('15 second auto-accept survives pause and bans; cancellation is terminal',()=>{
 const s=initialState(),t=Date.now();placeOrder(s,request(),null,'a',t);tick(s,t+14999);assert.equal(s.orders[0].status,'waiting');s.settings.paused=true;s.bans.a={until:t+600000};tick(s,t+15000);assert.equal(s.orders[0].status,'accepted');
 assert.ok(s.orders[0].units.every(u=>u.status==='cooking'));
 unitAction(s,'ready',kitchen,s.orders[0]);assert.ok(s.orders[0].units.every(u=>u.status==='ready'));
 s.settings.paused=false;placeOrder(s,request('Dua'),null,'b',t);unitAction(s,'cancel',waiter,s.orders[1]);tick(s,t+60000);assert.equal(s.orders[1].status,'cancelled');
});

test('confirmation goes straight to preparation; legacy accepted portions can finish directly',()=>{
 const s=initialState();placeOrder(s,request(),waiter,null);
 assert.throws(()=>unitAction(s,'ready',kitchen),/Status/);
 unitAction(s,'accept',kitchen);assert.ok(s.orders[0].units.every(u=>u.status==='cooking'));
 s.orders[0].units[0].status='accepted';
 unitAction(s,'ready',kitchen);assert.ok(s.orders[0].units.every(u=>u.status==='ready'));
 assert.throws(()=>unitAction(s,'cook',kitchen),/Peran/);
});
test('progressive ban commits and unban retains strikes, old orders continue',()=>{
 const s=initialState(),t=Date.now();for(let i=0;i<4;i++)placeOrder(s,request(),null,'a',t+i);const result=placeOrder(s,request(),null,'a',t+5);assert.equal(result.status,429);assert.equal(s.orders.length,4);assert.equal(s.bans.a.until,t+5+900000);
 operate(s,{action:'unban',tabId:s.tabs[0].id},waiter);assert.equal(s.bans.a.strikes,1);
 for(let i=0;i<4;i++)assert.ok(placeOrder(s,request(),null,'a',t+6+i).orderId);
 const again=placeOrder(s,request(),null,'a',t+10);assert.equal(again.status,429);assert.equal(s.bans.a.until,t+10+1800000);
});
test('price snapshots do not change; SQLite transaction rolls back partial mutation',()=>{
 const s=initialState();placeOrder(s,request(),null,'a');operate(s,{action:'menuSave',menuId:'m6',name:'Teh baru',category:'Minuman',price:18000},manager);assert.equal(s.orders[0].units[0].price,12000);
 const store=openStore(':memory:');assert.throws(()=>store.transaction(s=>{s.tabs.push({id:'orphan'});throw new Error('fail')}));assert.equal(store.read().tabs.length,0);store.close();
});
