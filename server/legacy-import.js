import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { assert, key, normalize } from './store.js';
import { ensureFinance } from '../shared/finance.js';
import { normalizeSpreadsheetArchive } from './menu-import.js';

// Historical imports never call placeOrder/operate: doing so would reprice the
// source, enqueue food, use today's event time, or close unrelated live tabs.
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const uuid=seed=>{
  const b=createHash('sha256').update(seed).digest().subarray(0,16);
  b[6]=(b[6]&15)|0x80;b[8]=(b[8]&63)|0x80;
  const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
const value=cell=>cell.value&&typeof cell.value==='object'&&'result' in cell.value?cell.value.result:cell.value;
const sum=list=>list.reduce((a,b)=>a+b,0);
const integer=(n,label)=>{assert(Number.isSafeInteger(n)&&n>0,`${label}: nilai harus bilangan bulat positif.`);return n;};
function dateOnly(v,offset){
  assert(v instanceof Date&&Number.isFinite(+v),'Tanggal sumber tidak valid.');
  assert(v.getUTCHours()===0&&v.getUTCMinutes()===0&&v.getUTCSeconds()===0,'Sumber memuat jam; tinjau aturan waktu impor.');
  const day=v.toISOString().slice(0,10);
  // A local-midnight anchor encodes a known calendar date, not a known event time.
  return {day,at:new Date(`${day}T00:00:00${offset}`).toISOString()};
}
export async function parseLegacyWorkbook(buffer,config){
  const fileHash=digest(buffer);
  assert(fileHash===config.sha256,'Isi file berubah sejak rekonsiliasi; analisis ulang sebelum impor.');
  assert(config.batchId&&config.timezone==='Europe/Istanbul'&&config.utcOffset==='+03:00','Konteks impor historis belum lengkap.');
  const book=new ExcelJS.Workbook();await book.xlsx.load(await normalizeSpreadsheetArchive(buffer));
  const sheet=name=>{const ws=book.getWorksheet(name);assert(ws,`Sheet ${name} tidak ditemukan.`);return ws;};
  const sales=sheet('Transaksi Penjualan'),debtSheet=sheet('Catatan Utang'),expenses=sheet('Pengeluaran');
  assert(value(sales.getCell('A1'))==='No'&&value(sales.getCell('M1'))==='Total Tagihan','Format penjualan tidak cocok.');
  const debts=new Map(),excluded=[];
  for(let row=8;row<=debtSheet.rowCount;row++){
    const name=normalize(value(debtSheet.getCell(row,4)));if(!name)continue;
    const ref=value(debtSheet.getCell(row,5)),amount=integer(value(debtSheet.getCell(row,7)),`Utang baris ${row}`);
    if(config.excludeDebtRows.includes(row)){excluded.push({row,name,amount});continue;}
    assert(Number.isSafeInteger(ref),`Utang baris ${row} tidak memiliki referensi transaksi.`);
    assert(!debts.has(ref),`Referensi utang ganda #${ref}.`);
    debts.set(ref,{row,name,amount,status:normalize(value(debtSheet.getCell(row,10))),paid:value(debtSheet.getCell(row,8))??0});
  }
  const orders=[],seen=new Set();
  for(let row=2;row<=sales.rowCount;row++){
    const ref=value(sales.getCell(row,1)),rawName=normalize(value(sales.getCell(row,3)));
    if(!ref&&!rawName)continue;
    integer(ref,`Referensi baris ${row}`);assert(!seen.has(ref),`Referensi transaksi #${ref} ganda.`);seen.add(ref);
    assert(rawName.length>=2,`Nama baris ${row} tidak valid.`);
    const units=[];
    for(const col of [4,7,10]){
      const name=normalize(value(sales.getCell(row,col)));if(!name)continue;
      const price=integer(value(sales.getCell(row,col+1)),`Harga #${ref}`),qty=integer(value(sales.getCell(row,col+2)),`Jumlah #${ref}`);
      assert(price<=10000000&&qty<=100,`Harga atau jumlah #${ref} di luar batas.`);
      for(let i=0;i<qty;i++)units.push({name,price});
    }
    const total=sum(units.map(u=>u.price));assert(units.length&&total===value(sales.getCell(row,13)),`Total transaksi #${ref} tidak cocok.`);
    const debt=debts.get(ref);assert(!debt||debt.amount===total,`Total utang #${ref} berbeda dari tagihan.`);
    const correction=config.paymentOverrides[String(ref)],method=correction?.method??normalize(value(sales.getCell(row,14)));
    let paidCount;
    if(correction){paidCount=correction.paidPortions;assert(Number.isSafeInteger(paidCount)&&paidCount>=0&&paidCount<=units.length,`Koreksi pembayaran #${ref} tidak valid.`);assert(new Set(units.map(u=>u.price)).size===1,'Koreksi per porsi memerlukan harga seragam.');}
    else if(debt?.status==='Lunas')paidCount=units.length;
    else if(debt){assert(debt.status==='Belum Lunas'&&debt.paid===0,`Pembayaran sebagian #${ref} perlu rekonsiliasi.`);paidCount=0;}
    else{assert(['Tunai','Transfer'].includes(method),`Metode transaksi #${ref} tidak dapat direkonsiliasi.`);paidCount=units.length;}
    assert(!paidCount||['Tunai','Transfer'].includes(method),`Pembayaran #${ref} belum memiliki media.`);
    const name=config.customerAliases[rawName]??rawName;
    orders.push({row,ref,rawName,name,...dateOnly(value(sales.getCell(row,2)),config.utcOffset),units,total,paidCount,method,sourceNote:normalize(value(sales.getCell(row,15))),correction:correction??null});
  }
  assert([...debts.keys()].every(ref=>seen.has(ref)),'Ada referensi utang tanpa transaksi penjualan.');
  const spending=[];
  for(let row=2;row<=expenses.rowCount;row++){
    const cells=Array.from({length:7},(_,i)=>value(expenses.getCell(row,i+1)));
    if(cells.every((v,i)=>i===4?v===null||v===undefined||v===0:v===null||v===undefined||v===''))continue;
    const [ref,date,category,party,amount,method,note]=cells;
    integer(ref,`Referensi pengeluaran baris ${row}`);integer(amount,`Pengeluaran #${ref}`);
    assert(normalize(party).length>=2&&normalize(note).length>=3,`Penerima/keterangan pengeluaran #${ref} belum lengkap.`);
    spending.push({row,ref,...dateOnly(date,config.utcOffset),category:normalize(category),party:normalize(party),amount,method:normalize(method),note:normalize(note)});
  }
  const summary={orders:orders.length,portions:sum(orders.map(o=>o.units.length)),sales:sum(orders.map(o=>o.total)),payments:sum(orders.map(o=>sum(o.units.slice(0,o.paidCount).map(u=>u.price)))),debt:sum(orders.map(o=>sum(o.units.slice(o.paidCount).map(u=>u.price)))),expenses:spending.length,expenseAmount:sum(spending.map(e=>e.amount)),excludedDebt:sum(excluded.map(d=>d.amount))};
  for(const [field,expected] of Object.entries(config.expected))assert(summary[field]===expected,`Kontrol ${field} berubah: ${summary[field]}, seharusnya ${expected}.`);
  return {batchId:config.batchId,fileHash,sourceName:config.sourceName,timezone:config.timezone,orders,spending,summary};
}

export function applyLegacyImport(s,parsed,config,stamp=new Date().toISOString()){
  ensureFinance(s);assert(s.settings.currency==='TRY','Impor ini menggunakan TRY tanpa konversi.');
  const auditId=uuid(`${parsed.batchId}:audit`);
  if(s.audit.some(a=>a.id===auditId)){
    const marker=s.audit.find(a=>a.id===auditId);assert(JSON.parse(marker.detail).fileHash===parsed.fileHash,'Batch sudah diimpor dari file berbeda.');
    return {...parsed.summary,alreadyImported:true};
  }
  assert(!s.orders.some(o=>o.import?.batchId===parsed.batchId)&&!s.expenses.some(e=>e.import?.batchId===parsed.batchId),'Batch parsial terdeteksi; jangan menambahkan data lagi.');
  const actor='Impor Excel (rekonsiliasi pengguna)';
  const meta=(sheet,row,sourceRef,day)=>({batchId:parsed.batchId,fileHash:parsed.fileHash,sourceFile:parsed.sourceName,sheet,row,sourceRef,sourceDate:day,timezone:parsed.timezone,timePrecision:'date',importedAt:stamp});
  const menuMap=new Map(s.menu.map(m=>[key(m.name),m]));
  const method=name=>{const m=s.settings.paymentMethods.find(m=>key(m.name)===key(name));assert(m,`Metode ${name} tidak ditemukan.`);return m;};
  const groups=new Map();
  for(const source of parsed.orders){const k=key(source.name);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(source);}
  let addedTabs=0,addedPayments=0;
  for(const [nameKey,orders] of groups){
    const existing=s.tabs.filter(t=>!t.closedAt&&key(t.name)===nameKey);
    assert(existing.length<=1,'Nama aktif ganda di database.');
    const fullyPaid=orders.every(o=>o.paidCount===o.units.length);
    assert(fullyPaid||!existing.length,`Nama ${orders[0].name} sudah memiliki transaksi aktif. Impor tidak boleh menambahkan riwayat ke transaksi aktif.`,409);
    // Every imported order belongs exclusively to a NEW historical transaction.
    // A fully paid historical transaction may share a name with a live one;
    // neither the live transaction nor its list of orders receives additions.
    const tab={id:uuid(`${parsed.batchId}:tab:${nameKey}`),name:orders[0].name,token:null,createdAt:orders[0].at,closedAt:fullyPaid?stamp:null,import:meta('Transaksi Penjualan',orders[0].row,orders[0].ref,orders[0].day)};
    s.tabs.push(tab);addedTabs++;
    for(const source of orders){
      const orderId=uuid(`${parsed.batchId}:order:${source.ref}`),paymentId=uuid(`${parsed.batchId}:payment:${source.ref}`);
      const metadata={...meta('Transaksi Penjualan',source.row,source.ref,source.day),originalCustomerName:source.rawName,originalNote:source.sourceNote,correction:source.correction};
      const units=source.units.map((u,i)=>{
        const alias=config.menuAliases[u.name]??u.name,m=menuMap.get(key(alias));assert(m,`Menu ${u.name} belum dipetakan.`);
        return {id:uuid(`${parsed.batchId}:portion:${source.ref}:${i}`),menuId:m.id,name:u.name,category:m.category,price:u.price,note:'',status:'delivered',paid:i<source.paidCount,...(i<source.paidCount?{paymentId}:{}),import:{batchId:parsed.batchId,sourceDate:source.day,servedConfirmed:true}};
      });
      s.orders.push({id:orderId,tabId:tab.id,slug:`impor-${source.day}-${source.ref}`,createdAt:source.at,token:null,source:'Impor Excel',status:'accepted',units,import:metadata});
      if(source.paidCount){const m=method(source.method),selected=units.filter(u=>u.paid);s.payments.push({id:paymentId,tabId:tab.id,orderId,unitIds:selected.map(u=>u.id),amount:sum(selected.map(u=>u.price)),methodId:m.id,method:m.name,actor,at:source.at,import:{...metadata,paymentDateBasis:'transaction-date; actual settlement time not recorded',settlementConfirmed:true}});addedPayments++;}
    }
  }
  for(const e of parsed.spending){
    const category=s.settings.expenseCategories.find(c=>key(c.name)===key(e.category));assert(category,`Kategori ${e.category} tidak ditemukan.`);const m=method(e.method);
    s.expenses.push({id:uuid(`${parsed.batchId}:expense:${e.ref}`),requestId:`${parsed.batchId}:expense:${e.ref}`,at:e.at,createdAt:stamp,amount:e.amount,categoryId:category.id,category:category.name,methodId:m.id,method:m.name,party:e.party,note:e.note,reference:`Excel pengeluaran #${e.ref}`,actor,import:meta('Pengeluaran',e.row,e.ref,e.day)});
  }
  const summary={...parsed.summary,addedTabs,addedPayments,fileHash:parsed.fileHash,batchId:parsed.batchId};
  s.audit.push({id:auditId,at:stamp,actor,action:'legacy_import',detail:JSON.stringify(summary)});
  return summary;
}
