import { languageCode, menuLanguages } from '../shared/menu-languages.js';
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
  const translationColumns=[],languages=new Set();
  for(let col=MENU_COLUMNS.length+1;col<=header.cellCount;col++) {
    const label=normalize(header.getCell(col).value);
    assert(label, 'Kolom tambahan harus bernama Deskripsi [kode bahasa].');
    const match=/^Deskripsi \[([^\]]+)\]$/i.exec(label);
    const language=match && languageCode(match[1]);
    assert(language, 'Header “'+label+'” tidak valid. Gunakan Deskripsi [en], Deskripsi [tr], atau kode bahasa lainnya.');
    assert(!languages.has(language), 'Kolom bahasa '+language+' ganda.');
    languages.add(language);translationColumns.push({col,language});
  }
  const rows=[],errors=[],seen=new Set();
  for(let n=2;n<=sheet.rowCount;n++){
    const values=MENU_COLUMNS.map((_,i)=>sheet.getRow(n).getCell(i+1).value);
    const translations=translationColumns.map(({col})=>sheet.getRow(n).getCell(col).value);
    if([...values,...translations].every(v=>v===null||v===''))continue;
    if([...values,...translations].some(v=>v!==null&&typeof v==='object')){errors.push({row:n,message:'Gunakan teks/angka biasa, bukan formula, tautan, atau objek Excel.'});continue}
    const [rawName,rawCategory,rawPrice,rawDescription,rawAvailable]=values;
    const name=normalize(rawName),category=normalize(rawCategory),price=rawPrice,description=String(rawDescription??'').trim(),availability=key(rawAvailable);
    const rowErrors=[],descriptionTranslations={};
    let defaultDescription=description;
    translationColumns.forEach(({language},i)=>{
      const value=translations[i];
      if(value===null || value===undefined || value==='')return;
      if(typeof value!=='string'){rowErrors.push('Deskripsi ['+language+'] harus teks.');return;}
      const text=value.trim();if(!text)return;
      if(text.length>300){rowErrors.push('Deskripsi ['+language+'] maksimal 300 karakter.');return;}
      if(language==='id'){
        if(description && description!==text)rowErrors.push('Deskripsi dan Deskripsi [id] berbeda. Gunakan satu deskripsi Indonesia yang sama.');
        else defaultDescription=text;
      }else descriptionTranslations[language]=text;
    });
    if(name.length<2||name.length>100)rowErrors.push('Nama menu harus 2–100 karakter.');
    if(!category||category.length>40)rowErrors.push('Kategori harus 1–40 karakter.');
    if(!Number.isSafeInteger(price)||price<=0||price>10000000)rowErrors.push('Harga harus angka bulat 1–10.000.000 dalam mata uang dasar, tanpa simbol mata uang atau pemisah ribuan.');
    if(description.length>300)rowErrors.push('Deskripsi maksimal 300 karakter.');
    if(!['ya','tidak'].includes(availability))rowErrors.push('Tersedia harus “Ya” atau “Tidak”.');
    if(seen.has(key(name)))rowErrors.push('Nama menu ganda dalam file.');seen.add(key(name));
    rowErrors.forEach(message=>errors.push({row:n,message}));
    if(!rowErrors.length)rows.push({row:n,name,category,price,description:defaultDescription,descriptionTranslations,available:availability==='ya'});
  }
  assert(rows.length||errors.length,'File belum berisi menu. Isi sheet Menu mulai baris kedua.');
  return {rows,errors,languages:[...languages]};
}
export function previewMenuImport(menu,parsed) {
  const errors=[...parsed.errors];
  const rows=parsed.rows.map(row=>{
    const matches=menu.filter(m=>key(m.name)===key(row.name));
    if(matches.length>1)errors.push({row:row.row,message:'Nama cocok dengan lebih dari satu menu lama. Ubah nama sebelum mengimpor.'});
    return {...row,descriptionTranslations:{...matches[0]?.descriptionTranslations,...row.descriptionTranslations},action:matches.length?'update':'create',menuId:matches[0]?.id};
  });
  return {rows,errors,languages:parsed.languages ?? [],catalogRevision:catalogRevision(menu),creates:rows.filter(r=>r.action==='create').length,updates:rows.filter(r=>r.action==='update').length};
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
    const fields={name:row.name,category:row.category,price:row.price,description:row.description,descriptionTranslations:row.descriptionTranslations,available:row.available};
    if(existing)Object.assign(existing,fields);else s.menu.push({id:id(),photo:'',...fields});
  }
  const result={ok:true,creates:preview.creates,updates:preview.updates};
  s.requests[requestKey]=result;audit(s,actor,'menu_imported',JSON.stringify(result));return result;
}

export async function menuTemplate(menu=[]) {
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Menu');
  const languages=[...new Set(['en','tr',...menuLanguages(menu).filter(code=>code!=='id')])];
  sheet.addRow([...MENU_COLUMNS,...languages.map(code=>'Deskripsi ['+code+']')]);
  sheet.views=[{state:'frozen',ySplit:1}];
  sheet.getRow(1).font={bold:true};
  sheet.columns.forEach((col,index)=>{col.width=index===3||index>=5?45:22});
  for(let n=2;n<=1001;n++)sheet.getCell('E'+n).dataValidation={type:'list',allowBlank:true,formulae:['"Ya,Tidak"']};
  const guide=book.addWorksheet('Panduan');
  [
    ['Petunjuk impor menu'],
    ['Isi satu menu per baris. Nama yang sama memperbarui menu; nama baru menambah menu.'],
    ['Deskripsi adalah bahasa default Indonesia (id).'],
    ['Tambahkan kolom Deskripsi [kode bahasa], misalnya Deskripsi [en], Deskripsi [tr], Deskripsi [ar].'],
    ['Bahasa tambahan hanya untuk deskripsi. Nama, kategori dan harga tetap.'],
    ['Sel terjemahan kosong atau kolom tidak disertakan: terjemahan lama dipertahankan.'],
    ['Jika terjemahan belum ada, pelanggan melihat deskripsi default. Menu tetap tampil.'],
    ['Deskripsi [id] juga diterima, tetapi harus sama dengan Deskripsi jika keduanya diisi.'],
    ['Maksimal 300 karakter per deskripsi; gunakan teks biasa tanpa formula.'],
    ['Harga berupa angka bulat dalam mata uang dasar; Tersedia diisi Ya atau Tidak.'],
    ['Maksimal 1.000 menu dan file 500 KB. Jumlah bahasa mengikuti batas ukuran file dan kolom Excel.']
  ].forEach(row=>guide.addRow(row));
  guide.getColumn(1).width=120;
  return Buffer.from(await book.xlsx.writeBuffer());
}
