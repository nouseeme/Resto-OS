import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { initialState, id, openStore } from '../server/store.js';
import { parseMenuFile, previewMenuImport, commitMenuImport, MENU_COLUMNS, menuTemplate } from '../server/menu-import.js';
import { menuDescription, menuLanguages } from '../shared/menu-languages.js';
const manager={id:'manager',name:'Manager',role:'manager'};
async function file(rows,headers=MENU_COLUMNS){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Menu');sheet.addRow(headers);rows.forEach(row=>sheet.addRow(row));return Buffer.from(await book.xlsx.writeBuffer()).toString('base64')}
async function importRows(s,rows,headers){const parsed=await parseMenuFile(await file(rows,headers));return {parsed,save:()=>commitMenuImport(s,parsed,{requestId:id(),catalogRevision:previewMenuImport(s.menu,parsed).catalogRevision},manager)}}
test('ABC id/en and DEF id/tr coexist with per-item fallback and persistence',async()=>{
 const store=openStore(':memory:');
 try{
 let s=store.read();
 const abc=await importRows(s,[['ABC','Utama',100,'Deskripsi ABC','Ya','ABC English']],[...MENU_COLUMNS,'Deskripsi [en]']);abc.save();
 const def=await importRows(s,[['DEF','Utama',200,'Deskripsi DEF','Ya','DEF Türkçe']],[...MENU_COLUMNS,'Deskripsi [tr]']);def.save();
 store.transaction(state=>{state.menu=s.menu});s=store.read();
 assert.deepEqual(menuLanguages(s.menu),['id','en','tr']);
 const selected=s.menu.filter(m=>['ABC','DEF'].includes(m.name));
 assert.equal(selected.length,2);
 assert.deepEqual(selected.map(m=>menuDescription(m,'en')),['ABC English','Deskripsi DEF']);
 assert.deepEqual(selected.map(m=>menuDescription(m,'tr')),['Deskripsi ABC','DEF Türkçe']);
 assert.deepEqual(selected.map(m=>menuDescription(m,'id')),['Deskripsi ABC','Deskripsi DEF']);
 const update=await importRows(s,[['ABC','Utama',100,'ABC diperbarui','Ya','','ABC Türkçe']],[...MENU_COLUMNS,'Deskripsi [en]','Deskripsi [tr]']);update.save();
 let item=s.menu.find(m=>m.name==='ABC');assert.equal(menuDescription(item,'en'),'ABC English');assert.equal(menuDescription(item,'tr'),'ABC Türkçe');
 const legacy=await importRows(s,[['ABC','Utama',100,'ABC default baru','Ya']]);legacy.save();
 item=s.menu.find(m=>m.name==='ABC');assert.equal(menuDescription(item,'en'),'ABC English');assert.equal(menuDescription(item,'de'),'ABC default baru');
 }finally{store.close()}
});
test('language headers are flexible, canonical and validated before any mutation',async()=>{
 const s=initialState();
 const languages=['en','tr','ar','de','fr','es','it','ja','ko','zh-Hant','pt-BR'];
 const parsed=await parseMenuFile(await file([['Multibahasa','Utama',100,'Default','Ya',...languages.map(l=>'Teks '+l)]],[...MENU_COLUMNS,...languages.map(l=>'Deskripsi ['+l+']')]));
 assert.equal(parsed.errors.length,0);assert.equal(Object.keys(parsed.rows[0].descriptionTranslations).length,languages.length);
 await assert.rejects(async()=>parseMenuFile(await file([], [...MENU_COLUMNS,'Deskripsi [en]','Deskripsi [EN]'])),/ganda/);
 await assert.rejects(async()=>parseMenuFile(await file([], [...MENU_COLUMNS,'Nama [en]'])),/Header/);
 await assert.rejects(async()=>parseMenuFile(await file([], [...MENU_COLUMNS,'Deskripsi [bad code]'])),/Header/);
 for(const text of [{formula:'1+1',result:2},'x'.repeat(301),42]){
  const bad=await importRows(s,[['Invalid','Utama',100,'Default','Ya',text]],[...MENU_COLUMNS,'Deskripsi [en]']);
  assert.ok(bad.parsed.errors.length);const before=structuredClone(s);assert.throws(bad.save,/bermasalah/);assert.deepEqual(s,before);
 }
 assert.equal(menuDescription({description:'Fallback',descriptionTranslations:{en:'  '}},'en'),'Fallback');
});
test('default id column and downloadable multilingual template round-trip',async()=>{
 const parsed=await parseMenuFile(await file([['Menu','Utama',100,'','Ya','Bahasa Indonesia']],[...MENU_COLUMNS,'Deskripsi [id]']));
 assert.equal(parsed.rows[0].description,'Bahasa Indonesia');
 const conflict=await parseMenuFile(await file([['Menu','Utama',100,'Satu','Ya','Dua']],[...MENU_COLUMNS,'Deskripsi [id]']));assert.ok(conflict.errors.length);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await menuTemplate([{descriptionTranslations:{ar:'Arabic'}}]));
 const sheet=book.getWorksheet('Menu');assert.deepEqual(sheet.getRow(1).values.slice(1),[...MENU_COLUMNS,'Deskripsi [en]','Deskripsi [tr]','Deskripsi [ar]']);assert.ok(book.getWorksheet('Panduan'));
 sheet.getRow(2).values=['Menu','Utama',100,'Default','Ya','English','','Arabic'];
 const result=await parseMenuFile(Buffer.from(await book.xlsx.writeBuffer()).toString('base64'));assert.equal(result.errors.length,0);assert.deepEqual(result.rows[0].descriptionTranslations,{en:'English',ar:'Arabic'});
});
