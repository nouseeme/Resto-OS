import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLegacyImport } from '../server/legacy-import.js';
import { initialState,openStore,operate,tabDue } from '../server/store.js';
import { ensureFinance,financeSummary } from '../shared/finance.js';

const config={menuAliases:{'Old noodle':'Noodle'},customerAliases:{}};
function scenario(){
  const state=ensureFinance(initialState());state.settings.currency='TRY';
  state.menu=[{id:'menu',name:'Noodle',category:'Food',price:130}];
  state.tabs=[{id:'live-tab',name:'Existing',token:'guest',createdAt:'2026-10-24T10:00:00Z',closedAt:null}];
  state.orders=[{id:'live-order',tabId:'live-tab',status:'accepted',createdAt:'2026-10-24T10:00:00Z',units:[{id:'live-unit',menuId:'menu',name:'Noodle',price:130,paid:false,status:'accepted'}]}];
  const base={row:2,ref:1,rawName:'Historical',name:'Historical',at:'2026-10-23T21:00:00.000Z',day:'2026-10-24',units:[{name:'Old noodle',price:125},{name:'Old noodle',price:125},{name:'Old noodle',price:125}],total:375,paidCount:2,method:'Tunai',sourceNote:'Original note',correction:{paidPortions:2,method:'Tunai'}};
  const parsed={batchId:'test-legacy-batch',fileHash:'abc',sourceName:'source.xlsx',timezone:'Europe/Istanbul',orders:[base,{...base,row:3,ref:2,rawName:'Existing',name:'Existing',units:[{name:'Old noodle',price:125}],total:125,paidCount:1,method:'Transfer'}],spending:[{ref:1,row:2,day:'2026-10-23',at:'2026-10-22T21:00:00Z',category:'Bahan Baku',party:'Supplier',note:'Original expense',amount:50,method:'Transfer'}],summary:{orders:2,portions:4,sales:500,payments:375,debt:125,expenses:1,expenseAmount:50,excludedDebt:390}};
  return {state,parsed};
}
test('import only appends; preserves prices, delivered status, partial cash payment and existing order',()=>{
  const {state,parsed}=scenario(),oldOrder=structuredClone(state.orders[0]),oldTab=structuredClone(state.tabs[0]);
  const result=applyLegacyImport(state,parsed,config,'2026-10-24T12:00:00Z');
  assert.deepEqual(state.orders[0],oldOrder);assert.deepEqual(state.tabs[0],oldTab);
  assert.equal(state.orders.length,3);assert.equal(state.payments.length,2);assert.equal(state.payments[0].amount,250);assert.equal(state.payments[0].method,'Tunai');
  assert.ok(state.orders.slice(1).flatMap(o=>o.units).every(u=>u.status==='delivered'&&u.price===125));
  assert.equal(tabDue(state,state.tabs[0]),130);assert.ok(state.tabs.find(t=>t.name==='Existing'&&t.id!=='live-tab').closedAt);
  assert.ok(state.orders.slice(1).every(o=>o.tabId!=='live-tab'));assert.ok(state.payments.every(p=>p.tabId!=='live-tab'));
  assert.equal(state.menu[0].price,130);assert.equal(result.addedTabs,2);
  assert.equal(state.expenses[0].category,'Bahan baku');assert.equal(state.expenses[0].amount,50);
  assert.ok(!state.orders.some(o=>o.units.some(u=>u.price===390)));
  assert.ok(!JSON.stringify(state).includes('HPP'));
  const s=financeSummary(state);assert.equal(s.incoming,375);assert.equal(s.outgoing,50);
});
test('the same batch is idempotent, and a modified source for that batch is rejected',()=>{
  const {state,parsed}=scenario();applyLegacyImport(state,parsed,config);const before=structuredClone(state);
  assert.equal(applyLegacyImport(state,parsed,config).alreadyImported,true);assert.deepEqual(state,before);
  assert.throws(()=>applyLegacyImport(state,{...parsed,fileHash:'changed'},config));
});
test('waiter can settle imported delivered units while the live order stays unpaid and in the kitchen',()=>{
  const {state,parsed}=scenario();applyLegacyImport(state,parsed,config);
  const imported=state.orders[1],unpaid=imported.units.filter(u=>!u.paid);
  operate(state,{action:'pay',orderId:imported.id,unitIds:unpaid.map(u=>u.id),methodId:'method-1'},{id:'staff',name:'Staff',role:'waiter'});
  assert.ok(imported.units.every(u=>u.paid));assert.equal(state.tabs[0].closedAt,null);
  assert.equal(state.orders[0].units[0].paid,false);assert.equal(state.orders[0].units[0].status,'accepted');
});
test('validation failure rolls the entire import back inside the store transaction',()=>{
  const {state,parsed}=scenario(),store=openStore(':memory:');store.transaction(s=>Object.assign(s,state));
  const before=store.read();parsed.spending[0].category='Missing category';
  assert.throws(()=>store.transaction(s=>applyLegacyImport(s,parsed,config)));
  assert.deepEqual(store.read(),before);store.close();
});
test('unpaid historical transactions cannot merge into an existing live transaction',()=>{
  const {state,parsed}=scenario();parsed.orders[0].name='Existing';
  assert.throws(()=>applyLegacyImport(state,parsed,config),{status:409});
});
