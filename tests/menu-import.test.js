import {initialState} from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseMenuFile,previewMenuImport,commitMenuImport,MENU_COLUMNS,normalizeSpreadsheetArchive} from '../server/menu-import.js';
import {readFile} from 'node:fs/promises';
import {placeOrder,id,openStore} from '../server/store.js';

const manager={id:'manager',name:'Manager',role:'manager'};
export async function workbookFile(rows,headers=MENU_COLUMNS) {
  const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Menu');sheet.addRow(headers);rows.forEach(row=>sheet.addRow(row));return Buffer.from(await book.xlsx.writeBuffer()).toString('base64');
}
test('downloadable template has the exact import headers, data entry validation and guide',async()=>{
  const book=new ExcelJS.Workbook();await book.xlsx.load(await normalizeSpreadsheetArchive(await readFile('public/templates/template-menu-restoOS.xlsx')));
  assert.deepEqual(book.getWorksheet('Menu').getRow(1).values.slice(1),MENU_COLUMNS);
  assert.ok(book.getWorksheet('Panduan'));assert.equal(book.getWorksheet('Menu').getCell('E2').dataValidation.type,'list');
  assert.equal(book.getWorksheet('Menu').getCell('E1001').dataValidation.type,'list');
  assert.equal(book.getWorksheet('Menu').getCell('A2').value,null);
  assert.equal(book.getWorksheet('Panduan').getCell('A16').value,null);
  book.getWorksheet('Menu').getRow(2).values=['Menu uji','Minuman',16000,'Contoh','Ya'];
  const parsed=await parseMenuFile(Buffer.from(await book.xlsx.writeBuffer()).toString('base64'));
  assert.equal(parsed.errors.length,0);assert.equal(parsed.rows[0].price,16000);
});
test('import previews additions and updates; commit is atomic and retry-safe; prices remain snapshots',async()=>{
  const s=initialState();placeOrder(s,{name:'Pelanggan',items:[{menuId:'m6',qty:1,price:12000}],requestId:id()},null,'owner');
  const parsed=await parseMenuFile(await workbookFile([['Es teh melati','Minuman',18000,'Baru','Tidak'],['Menu baru','Pendamping',22000,'','Ya']]));
  const preview=previewMenuImport(s.menu,parsed);assert.equal(preview.creates,1);assert.equal(preview.updates,1);assert.equal(s.menu.length,8);
  const body={requestId:id(),catalogRevision:preview.catalogRevision};
  const result=commitMenuImport(s,parsed,body,manager);assert.equal(s.menu.length,9);assert.equal(s.menu.find(m=>m.id==='m6').price,18000);assert.equal(s.menu.find(m=>m.id==='m6').available,false);
  assert.equal(s.orders[0].units[0].price,12000);assert.ok(s.menu.find(m=>m.id==='m6').photo);
  assert.deepEqual(commitMenuImport(s,parsed,body,manager),result);assert.equal(s.menu.length,9);
});
test('invalid rows, formula values and duplicate names cannot partially import',async()=>{
  const parsed=await parseMenuFile(await workbookFile([['Valid','Minuman',10000,'','Ya'],[' Valid ','Minuman',15000,'','Ya'],['Bad','Minuman','Rp 20000','','Yes'],['Formula','Minuman',{formula:'100+100',result:200},'','Ya']]));
  assert.ok(parsed.errors.some(e=>/ganda/.test(e.message)));assert.ok(parsed.errors.some(e=>/Harga/.test(e.message)));assert.ok(parsed.errors.some(e=>/formula/.test(e.message)));
  const store=openStore(':memory:');const before=store.read();
  assert.throws(()=>store.transaction(s=>commitMenuImport(s,parsed,{requestId:id(),catalogRevision:previewMenuImport(s.menu,parsed).catalogRevision},manager)),/bermasalah/);
  assert.deepEqual(store.read(),before);store.close();
});
test('changed catalog rejects stale preview and malformed workbook fails clearly',async()=>{
  const s=initialState(),parsed=await parseMenuFile(await workbookFile([['Nama','Minuman',10000,'','Ya']]));
  const preview=previewMenuImport(s.menu,parsed);s.menu[0].available=false;
  assert.throws(()=>commitMenuImport(s,parsed,{requestId:id(),catalogRevision:preview.catalogRevision},manager),/Katalog berubah/);
  await assert.rejects(()=>parseMenuFile('not-an-xlsx'),/Unggah/);
  await assert.rejects(()=>parseMenuFile(awaitableInvalid),/xlsx/);
});
const awaitableInvalid='YWJjZA==';
