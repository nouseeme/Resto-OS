import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { assert, normalize, key, id, audit } from './store.js';

export const MENU_COLUMNS=['Nama menu','Kategori','Harga','Deskripsi','Tersedia'];
export const catalogRevision=menu=>createHash('sha256').update(JSON.stringify(menu)).digest('hex');

function guardArchive(buffer) {
  assert(buffer.length>20,'File harus berupa workbook .xlsx yang valid.');
  assert(buffer.length<=500000,'File Excel maksimal 500 KB.');
  let end=-1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break}
  assert(end>=0,'File harus berupa workbook .xlsx yang valid.');
  const count=buffer.readUInt16LE(end+10),offset=buffer.readUInt32LE(end+16);
  assert(count>0&&count<=2000&&offset<buffer.length,'Struktur workbook tidak didukung.');
  let position=offset,total=0;
  for(let i=0;i<count;i++){
    assert(position+46<=buffer.length&&buffer.readUInt32LE(position)===0x02014b50,'Arsip Excel tidak valid.');
    const size=buffer.readUInt32LE(position+24);total+=size;
    assert(size<=8000000&&total<=16000000,'Isi workbook terlalu besar. Gunakan template dengan maksimal 1.000 menu.');
    position+=46+buffer.readUInt16LE(position+28)+buffer.readUInt16LE(position+30)+buffer.readUInt16LE(position+32);
  }
}
export async function normalizeSpreadsheetArchive(buffer) {
  guardArchive(buffer);
  const zip=await JSZip.loadAsync(buffer);
  let changed=false;
  for(const entry of Object.values(zip.files)) {
    if(entry.dir||!entry.name.startsWith('xl/')||!entry.name.endsWith('.xml'))continue;
    let xml=await entry.async('string');
    // ExcelJS expects unprefixed SpreadsheetML tags. XML prefixes are optional,
    // so normalize valid prefixed exports without changing workbook contents.
    const matches=[...xml.matchAll(/xmlns:([A-Za-z][\w.-]*)="http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main"/g)];
    for(const [,prefix] of matches){
      xml=xml.replace(`xmlns:${prefix}=`, 'xmlns=').replaceAll(`<${prefix}:`,'<').replaceAll(`</${prefix}:`,'</');changed=true;
    }
    if(matches.length)zip.file(entry.name,xml);
  }
  return changed?Buffer.from(await zip.generateAsync({type:'nodebuffer'})):buffer;
}
export async function parseMenuFile(file) {
  assert(typeof file==='string'&&file.length<=667000&&/^[A-Za-z0-9+/=]+$/.test(file),'Unggah file .xlsx, maksimal 500 KB.');
  const buffer=Buffer.from(file,'base64');guardArchive(buffer);
  const book=new ExcelJS.Workbook();
  try{await book.xlsx.load(await normalizeSpreadsheetArchive(buffer))}catch{assert(false,'Workbook tidak dapat dibaca. Gunakan template .xlsx yang disediakan.')}
  const sheet=book.getWorksheet('Menu');assert(sheet,'Sheet “Menu” tidak ditemukan. Gunakan template yang disediakan.');
  assert(sheet.rowCount<=1001,'Maksimal 1.000 baris menu per impor.');
  const header=sheet.getRow(1);
  assert(MENU_COLUMNS.every((name,i)=>(normalize(header.getCell(i+1).value)===name || (i===2 && normalize(header.getCell(i+1).value)==='Harga (IDR)'))),'Header harus: '+MENU_COLUMNS.join(', ')+'.');
  const rows=[],errors=[],seen=new Set();
  for(let n=2;n<=sheet.rowCount;n++){
    const values=MENU_COLUMNS.map((_,i)=>sheet.getRow(n).getCell(i+1).value);
    if(values.every(v=>v===null||v===''))continue;
    if(values.some(v=>v!==null&&typeof v==='object')){errors.push({row:n,message:'Gunakan teks/angka biasa, bukan formula, tautan, atau objek Excel.'});continue}
    const [rawName,rawCategory,rawPrice,rawDescription,rawAvailable]=values;
    const name=normalize(rawName),category=normalize(rawCategory),price=rawPrice,description=String(rawDescription??'').trim(),availability=key(rawAvailable);
    const rowErrors=[];
    if(name.length<2||name.length>100)rowErrors.push('Nama menu harus 2–100 karakter.');
    if(!category||category.length>40)rowErrors.push('Kategori harus 1–40 karakter.');
    if(!Number.isSafeInteger(price)||price<=0||price>10000000)rowErrors.push('Harga harus angka bulat 1–10.000.000 dalam mata uang dasar, tanpa simbol mata uang atau pemisah ribuan.');
    if(description.length>300)rowErrors.push('Deskripsi maksimal 300 karakter.');
    if(!['ya','tidak'].includes(availability))rowErrors.push('Tersedia harus “Ya” atau “Tidak”.');
    if(seen.has(key(name)))rowErrors.push('Nama menu ganda dalam file.');seen.add(key(name));
    rowErrors.forEach(message=>errors.push({row:n,message}));
    if(!rowErrors.length)rows.push({row:n,name,category,price,description,available:availability==='ya'});
  }
  assert(rows.length||errors.length,'File belum berisi menu. Isi sheet Menu mulai baris kedua.');
  return {rows,errors};
}
export function previewMenuImport(menu,parsed) {
  const errors=[...parsed.errors];
  const rows=parsed.rows.map(row=>{
    const matches=menu.filter(m=>key(m.name)===key(row.name));
    if(matches.length>1)errors.push({row:row.row,message:'Nama cocok dengan lebih dari satu menu lama. Ubah nama sebelum mengimpor.'});
    return {...row,action:matches.length?'update':'create',menuId:matches[0]?.id};
  });
  return {rows,errors,catalogRevision:catalogRevision(menu),creates:rows.filter(r=>r.action==='create').length,updates:rows.filter(r=>r.action==='update').length};
}
export function commitMenuImport(s,parsed,body,actor) {
  assert(typeof body.requestId==='string'&&body.requestId.length>=16&&body.requestId.length<=100,'Identitas impor tidak valid.');
  const requestKey=`menu-import:${actor.id}:${body.requestId}`;
  if(s.requests[requestKey])return s.requests[requestKey];
  assert(body.catalogRevision===catalogRevision(s.menu),'Katalog berubah sejak pratinjau. Tinjau file sekali lagi sebelum menyimpan.',409);
  const preview=previewMenuImport(s.menu,parsed);
  assert(!preview.errors.length,'File memiliki baris bermasalah. Perbaiki semuanya sebelum mengimpor.');
  for(const row of preview.rows){
    const existing=s.menu.find(m=>m.id===row.menuId);
    const fields={name:row.name,category:row.category,price:row.price,description:row.description,available:row.available};
    if(existing)Object.assign(existing,fields);else s.menu.push({id:id(),photo:'',...fields});
  }
  const result={ok:true,creates:preview.creates,updates:preview.updates};
  s.requests[requestKey]=result;audit(s,actor,'menu_imported',JSON.stringify(result));return result;
}
