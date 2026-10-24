import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';
import { initialState, openStore, operate, placeOrder } from '../server/store.js';
import { financeAction } from '../server/finance.js';
import { ensureFinance, financeSummary, methodName } from '../shared/finance.js';
import { reportWorkbook, reportPeriod } from '../server/reports.js';
import { encodeState,decodeState,stateChanges } from '../server/cloud-store.js';

const manager={id:'manager',name:'Manajer',role:'manager'},waiter={id:'staff',name:'Garson',role:'waiter'};
const expense=()=>({action:'expense',requestId:crypto.randomUUID(),at:'2026-10-01T09:00:00Z',amount:50,categoryId:'expense-0',methodId:'method-1',party:'Supplier',note:'Sayuran segar',reference:'INV-1'});
export function fixture(){
  const s=ensureFinance(initialState());
  s.tabs=[{id:'t1',name:'Nama sama',createdAt:'2026-09-01T00:00:00Z'},{id:'t2',name:'Nama sama',createdAt:'2026-10-01T00:00:00Z'}];
  s.orders=[{id:'o1',tabId:'t1',createdAt:'2026-09-01T00:00:00Z',units:[{id:'u1',menuId:'m1',name:'Nasi',category:'Makanan',price:100,status:'delivered',paid:true}]},{id:'o2',tabId:'t2',createdAt:'2026-10-01T00:00:00Z',units:[{id:'u2',menuId:'m1',name:'Nasi',category:'Makanan',price:100,status:'cancelled',cancelledAt:'2026-11-01T00:00:00Z',paid:false},{id:'u3',menuId:'m2',name:'Teh',category:'Minuman',price:30,status:'delivered',paid:true},{id:'u4',menuId:'m3',name:'Kopi',category:'Minuman',price:20,status:'cancelled',cancelledAt:'2026-10-02T00:00:00Z',paid:false}]}];
  s.payments=[{id:'p0',tabId:'t1',orderId:'o1',at:'2026-09-15T00:00:00Z',method:'Tunai',methodId:'method-0',amount:40,actor:'A'},{id:'p1',tabId:'t1',orderId:'o1',at:'2026-10-03T00:00:00Z',method:'Transfer',methodId:'method-1',amount:60,actor:'A'},{id:'p2',tabId:'t2',orderId:'o2',at:'2026-10-03T00:00:00Z',method:'QRIS',amount:30,actor:'A'}];
  financeAction(s,expense(),manager);return s;
}
test('defaults, authorization, duplicate requests, validation and archive preservation',()=>{
  const s=ensureFinance(initialState()),body=expense();
  assert.deepEqual(s.settings.paymentMethods.map(m=>m.name),['Tunai','Transfer']);
  assert.throws(()=>financeAction(s,body,waiter),{status:403});
  financeAction(s,body,manager);financeAction(s,body,manager);assert.equal(s.expenses.length,1);
  assert.throws(()=>financeAction(s,{...body,amount:100},manager),{status:409});
  assert.throws(()=>financeAction(s,{...expense(),amount:-1},manager));
  assert.throws(()=>financeAction(s,{...expense(),at:'2099-01-01'},manager));
  financeAction(s,{action:'financeOption',list:'expenseCategories',id:'expense-0',name:'Bahan segar',active:false},manager);
  assert.equal(s.expenses[0].category,'Bahan baku');assert.equal(financeSummary(s).rows[0].category,'Bahan segar');
  assert.throws(()=>financeAction(s,expense(),manager),{status:409});
  financeAction(s,{action:'financeOption',list:'paymentMethods',id:'method-0',name:'Tunai',active:false},manager);
  assert.throws(()=>financeAction(s,{action:'financeOption',list:'paymentMethods',id:'method-1',name:'Transfer',active:false},manager));
  assert.throws(()=>financeAction(s,{action:'financeOption',list:'paymentMethods',name:'TRANSFER'},manager),{status:409});
});
test('SQLite and cloud adapters preserve expenses and default settings',()=>{
  const store=openStore(':memory:');store.transaction(s=>financeAction(s,expense(),manager));assert.equal(store.read().expenses.length,1);store.close();
  const s=fixture(),rows=encodeState(s),round=decodeState(rows);assert.deepEqual(round.expenses,s.expenses);assert.equal(round.settings.paymentMethods.length,2);
  const before=structuredClone(rows);round.expenses.push({...round.expenses[0],id:'new'});assert.equal(stateChanges(before,encodeState(round)).expenses.upsert.length,1);
});
test('new orders snapshot menu category; payment uses active editable methods',()=>{
  const s=ensureFinance(initialState());s.menu=[{id:'m',name:'Nasi',category:'Makanan',price:100,available:true}];
  const result=placeOrder(s,{requestId:crypto.randomUUID(),name:'Pelanggan',items:[{menuId:'m',qty:1,price:100}]},waiter,null);
  assert.equal(s.orders[0].units[0].category,'Makanan');
  assert.throws(()=>operate(s,{action:'pay',orderId:result.orderId,method:'QRIS'},waiter));
  operate(s,{action:'pay',orderId:result.orderId,methodId:'method-1'},waiter);assert.equal(s.payments[0].method,'Transfer');
});
test('legacy payments retain their original label and follow method renaming',()=>{
  const store=openStore(':memory:');
  store.transaction(s=>s.payments.push({id:'legacy',method:'Tunai',amount:100}));
  store.transaction(s=>financeAction(s,{action:'financeOption',list:'paymentMethods',id:'method-0',name:'Kas tunai',active:true},manager));
  const s=store.read();assert.equal(s.payments[0].method,'Tunai');assert.equal(methodName(s,s.payments[0]),'Kas tunai');store.close();
});
test('integrated workbook reconciles period receipts, sales, opening balance and debt',async()=>{
  const s=fixture(),period={start:new Date('2026-10-01Z'),end:new Date('2026-11-01Z'),snapshot:new Date('2026-12-01Z')};
  const w=new ExcelJS.Workbook();await w.xlsx.load(await reportWorkbook(s,period));
  const v=(sheet,cell)=>w.getWorksheet(sheet).getCell(cell).value.result??0;
  if(process.env.FINANCE_SAMPLE)writeFileSync(process.env.FINANCE_SAMPLE,await w.xlsx.writeBuffer());
  assert.equal(v('Ringkasan','B2'),130);assert.equal(v('Ringkasan','B3'),90);assert.equal(v('Ringkasan','B4'),50);assert.equal(v('Ringkasan','B5'),40);assert.equal(v('Ringkasan','B6'),40);assert.equal(v('Ringkasan','B7'),80);assert.equal(v('Ringkasan','B8'),100);
  assert.equal(v('Laporan Transaksi','E2'),0);assert.equal(v('Laporan Transaksi','E3'),100);
  assert.match(w.getWorksheet('Ringkasan').getCell('B2').formula,/'Data Item Pesanan'/);
  assert.match(w.getWorksheet('Ledger').getCell('I2').formula,/'Data Pembayaran'/);
  assert.ok(w.getWorksheet('Data Pembayaran').getCell('D2').value instanceof Date);
  assert.equal(w.getWorksheet('Data Pembayaran').getCell('E4').value,'QRIS');
  assert.throws(()=>reportPeriod({start:'garbage'}));assert.throws(()=>reportPeriod({start:'2026-11-01T00:00Z',end:'2026-10-01T00:00Z'}));
});
test('empty workbook has valid zero totals',async()=>{
  const w=new ExcelJS.Workbook();await w.xlsx.load(await reportWorkbook(ensureFinance(initialState())));for(let i=2;i<=8;i++)assert.equal(w.getWorksheet('Ringkasan').getCell(`B${i}`).value.result??0,0);
});
