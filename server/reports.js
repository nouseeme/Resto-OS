import ExcelJS from 'exceljs';
import { assert } from './store.js';
import { ledger, methodName, categoryName, inPeriod } from '../shared/finance.js';

export function reportPeriod(query, snapshot=new Date()) {
  const parse=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
  assert(!query.start||parse(query.start),'Awal periode tidak valid.');
  assert(!query.end||parse(query.end),'Akhir periode tidak valid.');
  const start=query.start?new Date(query.start):new Date(0);
  const end=query.end?new Date(query.end):snapshot;
  assert(+start<+end&&+end<=+snapshot+86400000,'Rentang laporan tidak valid.');
  return {start,end,snapshot};
}
const serial=d=>+new Date(d)/86400000+25569;
const sum=rows=>rows.reduce((n,r)=>n+r,0);
const alive=(u,end)=>u.status!=='cancelled'||(u.cancelledAt&&Date.parse(u.cancelledAt)>=+end);
export async function reportWorkbook(s,{start=new Date(0),end=new Date(),snapshot=new Date()}={}) {
  // Merged source rows only retain portal ownership; they are not extra transactions.
  s = { ...s, tabs: s.tabs.filter(tab => !tab.mergedInto) };
  const w=new ExcelJS.Workbook();
  w.creator='restoOS';w.created=snapshot;w.calcProperties.fullCalcOnLoad=true;
  function sheet(name,headers,rows) {
    const ws=w.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
    ws.columns=headers.map((header,i)=>({header,key:String(i),width:i===0?40:25}));
    for(const row of rows)ws.addRow(row);
    ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:headers.length}};
    ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF405644'}};
    ws.getRow(1).height=32;
    ws.eachRow((r,i)=>{if(i>1){r.font={name:'Calibri',size:11};r.eachCell(c=>{if(c.value instanceof Date)c.numFmt='dd mmm yyyy hh:mm';else if(typeof c.value==='number'||c.value?.formula)c.numFmt='#,##0;[Red](#,##0);–';});}r.alignment={vertical:'middle',wrapText:true};});
    return ws;
  }
  const f=(formula,result)=>({formula,result});
  const exact=cell=>`"="&SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${cell},"~","~~"),"*","~*"),"?","~?")`;
  const summary=sheet('Ringkasan',['Indikator','Nilai'],[]);
  const guide=sheet('Panduan',['Parameter','Nilai'],[
    ['Mulai (inklusif)',start],['Sampai (eksklusif)',end],['Waktu ekspor',snapshot],['Mata uang',s.settings.currency??'IDR'],
    ['Sumber',s.settings.name],['Perhitungan','Laporan mengambil formula dari data mentah. Aktifkan kalkulasi otomatis di Excel. Edit nilai pada baris sumber yang sudah ada untuk menghitung ulang.'],
    ['Batas data','Snapshot seluruh riwayat saat ekspor, termasuk data sebelum periode sebagai pendukung saldo awal dan piutang. Tanggal disimpan sebagai waktu UTC.'],
    ['Saldo','Saldo merupakan akumulasi pembayaran dikurangi pengeluaran tercatat sejak awal pemakaian; bukan saldo bank atau modal awal.'],
    ['Kategori lama','Kategori menu lama yang belum memiliki snapshot memakai katalog saat ekspor, atau Tidak diketahui (riwayat).'],
    ['Pembatalan','Pembatalan mengurangi penjualan periode pesanan. Piutang memakai pembatalan yang sudah terjadi sebelum akhir periode.'],
    ['Riwayat metode','Label mengikuti nama kategori/metode saat ekspor. Nama saat pencatatan juga disertakan.']
  ]);
  guide.getColumn(2).width=100;
  const items=s.orders.flatMap(o=>o.units.map(u=>({o,u})));
  const payments=s.payments,expenses=s.expenses??[];
  const rawTabs=sheet('Data Transaksi',['ID transaksi','Pelanggan','Dibuka UTC','Ditutup UTC'],s.tabs.map(t=>[t.id,t.name,new Date(t.createdAt),t.closedAt?new Date(t.closedAt):null]));
  const rawItems=sheet('Data Item Pesanan',['ID unit','ID pesanan','ID transaksi','Tanggal pesanan UTC','ID menu','Menu','Kategori','Harga','Status saat ekspor','Dibatalkan UTC','Nilai sampai akhir periode','Nilai penjualan periode'],[]);
  items.forEach(({o,u},i)=>{
    const r=i+2,net=alive(u,end)?u.price:0;
    rawItems.addRow([u.id,o.id,o.tabId,new Date(o.createdAt),u.menuId,u.name,u.category??s.menu.find(m=>m.id===u.menuId)?.category??'Tidak diketahui (riwayat)',u.price,u.status,u.cancelledAt?new Date(u.cancelledAt):null,
      f(`IF(D${r}>=Panduan!$B$3,0,IF(AND(I${r}="cancelled",OR(J${r}="",J${r}<Panduan!$B$3)),0,H${r}))`,Date.parse(o.createdAt)<+end?net:0),
      f(`IF(AND(D${r}>=Panduan!$B$2,D${r}<Panduan!$B$3),K${r},0)`,inPeriod(o.createdAt,start,end)?net:0)]);
  });
  const rawPay=sheet('Data Pembayaran',['ID pembayaran','ID transaksi','ID pesanan','Tanggal UTC','Metode','Nominal','Staf','Metode saat dicatat'],payments.map(p=>[p.id,p.tabId,p.orderId,new Date(p.at),methodName(s,p),p.amount,p.actor,p.method]));
  const rawExp=sheet('Data Pengeluaran',['ID pengeluaran','Tanggal UTC','Kategori','Metode','Nominal','Penerima','Keterangan','Referensi','Staf','Kategori saat dicatat','Metode saat dicatat'],expenses.map(e=>[e.id,new Date(e.at),categoryName(s,e),methodName(s,e),e.amount,e.party,e.note,e.reference,e.actor,e.category,e.method]));
  // Fixed ranges deliberately cover exactly the exported raw records. Blank data still has a valid range.
  const range=(ws,col)=>`'${ws.name}'!$${col}$2:$${col}$${Math.max(2,ws.rowCount)}`;
  const pi=range(rawItems,'L'), ni=range(rawItems,'K'), it=range(rawItems,'C');
  const pa=range(rawPay,'F'),pt=range(rawPay,'B'),pd=range(rawPay,'D');
  const ea=range(rawExp,'E'),ed=range(rawExp,'B');
  const periodSum=(amount,date)=>`SUMIFS(${amount},${date},">="&Panduan!$B$2,${date},"<"&Panduan!$B$3)`;
  const netSales=sum(items.filter(({o})=>inPeriod(o.createdAt,start,end)).map(({u})=>alive(u,end)?u.price:0));
  const received=sum(payments.filter(p=>inPeriod(p.at,start,end)).map(p=>p.amount));
  const spent=sum(expenses.filter(e=>inPeriod(e.at,start,end)).map(e=>e.amount));
  const opening=sum(payments.filter(p=>Date.parse(p.at)<+start).map(p=>p.amount))-sum(expenses.filter(e=>Date.parse(e.at)<+start).map(e=>e.amount));
  const tx=sheet('Laporan Transaksi',['ID transaksi','Pelanggan','Tagihan sampai akhir periode','Terbayar sampai akhir periode','Sisa utang','Status pembayaran','Tanggal lunas UTC'],[]);
  let debt=0;
  s.tabs.filter(t=>Date.parse(t.createdAt)<+end).forEach((t,i)=>{
    const row=i+2,source=s.tabs.indexOf(t)+2;
    const total=sum(items.filter(({o})=>o.tabId===t.id&&Date.parse(o.createdAt)<+end).map(({u})=>alive(u,end)?u.price:0));
    const pp=payments.filter(p=>p.tabId===t.id&&Date.parse(p.at)<+end),paid=sum(pp.map(p=>p.amount)),due=Math.max(0,total-paid);debt+=due;
    const last=pp.length?Math.max(...pp.map(p=>Date.parse(p.at))):0;
    tx.addRow([f(`'Data Transaksi'!A${source}`,t.id),f(`'Data Transaksi'!B${source}`,t.name),
      f(`SUMIF(${it},A${row},${ni})`,total),f(`SUMIFS(${pa},${pt},A${row},${pd},"<"&Panduan!$B$3)`,paid),
      f(`MAX(0,C${row}-D${row})`,due),f(`IF(E${row}>0,"Belum lunas",IF(C${row}=0,"Tanpa tagihan","Lunas"))`,due?'Belum lunas':total?'Lunas':'Tanpa tagihan'),
      f(`IF(AND(C${row}>0,E${row}=0),_xlfn.MAXIFS(${pd},${pt},A${row},${pd},"<"&Panduan!$B$3),"")`,total>0&&!due&&last?serial(last):'')]);
    tx.getCell(`G${row}`).numFmt='dd mmm yyyy hh:mm';
  });
  const cash=sheet('Ledger',['ID pencatatan','Tanggal UTC','Jenis','Kategori','Metode','Pihak','Referensi','Keterangan','Masuk','Keluar','Saldo tercatat','Dalam periode'],[]);
  const entries=ledger(s);let balance=0;
  entries.forEach((e,i)=>{
    const r=i+2,p=payments.findIndex(x=>x.id===e.id),x=p>=0?p+2:expenses.findIndex(x=>x.id===e.id)+2;
    const source=p>=0?'Data Pembayaran':'Data Pengeluaran';
    const ref=col=>`'${source}'!${col}${x}`;
    balance+=e.amount;
    cash.addRow([f(ref('A'),e.id),f(ref(p>=0?'D':'B'),serial(e.at)),e.kind,p>=0?'Penjualan':f(ref('C'),e.category),f(ref(p>=0?'E':'D'),e.method),p>=0?f(`IFERROR(INDEX(${range(rawTabs,'B')},MATCH(${ref('B')},${range(rawTabs,'A')},0)),"")`,e.party):f(ref('F'),e.party),f(ref(p>=0?'B':'H'),e.reference),p>=0?'Pembayaran pelanggan':f(ref('G'),e.note),p>=0?f(ref('F'),e.amount):0,p<0?f(ref('E'),-e.amount):0,f(`SUM(I$2:I${r})-SUM(J$2:J${r})`,balance),f(`IF(AND(B${r}>=Panduan!$B$2,B${r}<Panduan!$B$3),1,0)`,inPeriod(e.at,start,end)?1:0)]);
    cash.getCell(`B${r}`).numFmt='dd mmm yyyy hh:mm';
  });
  const methods=[...new Set([...(s.settings.paymentMethods??[]).map(m=>m.name),...payments.map(p=>methodName(s,p)),...expenses.map(e=>methodName(s,e))])];
  const cats=[...new Set([...(s.settings.expenseCategories??[]).map(c=>c.name),...expenses.map(e=>categoryName(s,e))])];
  const finances=sheet('Laporan Keuangan',['Kelompok','Kategori / metode','Pemasukan','Pengeluaran','Jumlah pembayaran'],[]);
  methods.forEach(name=>{
    const r=finances.rowCount+1,pp=payments.filter(p=>methodName(s,p)===name&&inPeriod(p.at,start,end)),ee=expenses.filter(e=>methodName(s,e)===name&&inPeriod(e.at,start,end));
    finances.addRow(['Metode',name,f(`SUMIFS(${pa},${range(rawPay,'E')},${exact(`B${r}`)},${pd},">="&Panduan!$B$2,${pd},"<"&Panduan!$B$3)`,sum(pp.map(p=>p.amount))),f(`SUMIFS(${ea},${range(rawExp,'D')},${exact(`B${r}`)},${ed},">="&Panduan!$B$2,${ed},"<"&Panduan!$B$3)`,sum(ee.map(e=>e.amount))),f(`COUNTIFS(${range(rawPay,'E')},${exact(`B${r}`)},${pd},">="&Panduan!$B$2,${pd},"<"&Panduan!$B$3)`,pp.length)]);
  });
  cats.forEach(name=>{
    const r=finances.rowCount+1;
    finances.addRow(['Kategori pengeluaran',name,0,f(`SUMIFS(${ea},${range(rawExp,'C')},${exact(`B${r}`)},${ed},">="&Panduan!$B$2,${ed},"<"&Panduan!$B$3)`,sum(expenses.filter(e=>categoryName(s,e)===name&&inPeriod(e.at,start,end)).map(e=>e.amount))),null]);
  });
  const menus=sheet('Laporan Menu',['ID menu','Menu','Kategori','Porsi dipesan','Porsi dibatalkan sampai akhir','Porsi bersih','Nilai penjualan periode'],[]);
  const menuKeys=[...new Map(items.map(({u},i)=>[`${u.menuId}\0${u.name}\0${rawItems.getCell(`G${i+2}`).value}`,{id:u.menuId,name:u.name,category:rawItems.getCell(`G${i+2}`).value}])).values()];
  menuKeys.forEach(m=>{
    const r=menus.rowCount+1,group=items.filter(({o,u},i)=>u.menuId===m.id&&u.name===m.name&&rawItems.getCell(`G${i+2}`).value===m.category&&inPeriod(o.createdAt,start,end));
    const criteria=`${range(rawItems,'E')},${exact(`A${r}`)},${range(rawItems,'F')},${exact(`B${r}`)},${range(rawItems,'G')},${exact(`C${r}`)},${range(rawItems,'D')},">="&Panduan!$B$2,${range(rawItems,'D')},"<"&Panduan!$B$3`;
    const cancelled=group.filter(({u})=>!alive(u,end)).length;
    menus.addRow([m.id,m.name,m.category,f(`COUNTIFS(${criteria})`,group.length),f(`COUNTIFS(${criteria},${range(rawItems,'I')},"cancelled",${range(rawItems,'J')},"<"&Panduan!$B$3)`,cancelled),f(`D${r}-E${r}`,group.length-cancelled),f(`SUMIFS(${pi},${criteria})`,sum(group.map(({u})=>alive(u,end)?u.price:0)))]);
  });
  const sales=sheet('Penjualan per Kategori',['Kategori menu','Nilai penjualan'],[]);
  [...new Set(items.map((_,i)=>rawItems.getCell(`G${i+2}`).value))].forEach(name=>{
    const r=sales.rowCount+1;
    sales.addRow([name,f(`SUMIF(${range(rawItems,'G')},${exact(`A${r}`)},${pi})`,sum(items.filter(({o},i)=>rawItems.getCell(`G${i+2}`).value===name&&inPeriod(o.createdAt,start,end)).map(({u})=>alive(u,end)?u.price:0)))]);
  });
  [
    ['Penjualan bersih',f(`SUM(${pi})`,netSales)],['Pembayaran diterima',f(periodSum(pa,pd),received)],['Pengeluaran',f(periodSum(ea,ed),spent)],
    ['Arus kas bersih',f('B3-B4',received-spent)],['Saldo tercatat awal periode',f(`SUMIF(${pd},"<"&Panduan!$B$2,${pa})-SUMIF(${ed},"<"&Panduan!$B$2,${ea})`,opening)],
    ['Saldo tercatat akhir periode',f('B6+B5',opening+received-spent)],['Piutang sampai akhir periode',f(`SUM(${range(tx,'E')})`,debt)],
  ].forEach(row=>summary.addRow(row));
  for(const ws of [rawTabs,rawItems,rawPay,rawExp,tx,cash,finances,menus,sales,summary])ws.eachRow((row,i)=>{if(i>1)row.eachCell(c=>{c.font={name:'Calibri',size:11,color:{argb:c.value?.formula?'FF405644':'FF29251F'}};if(c.value instanceof Date)c.numFmt='dd mmm yyyy hh:mm';else if(typeof c.value==='number'||c.value?.formula&&typeof c.value.result==='number')c.numFmt=c.numFmt==='dd mmm yyyy hh:mm'?c.numFmt:'#,##0;[Red](#,##0);–';});});
  for(const ws of w.worksheets){
    ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:ws.columnCount}};
    ws.eachRow((row,i)=>{if(i>1){let lines=1;row.eachCell((cell,col)=>{const value=cell.value?.formula?cell.value.result:cell.value;const text=value instanceof Date?'24 Oct 2026 23:59':String(value??'');lines=Math.max(lines,Math.ceil(text.length/Math.max(8,(ws.getColumn(col).width??25)-3)));});row.height=Math.max(30,lines*16+8);}});
  }
  return w.xlsx.writeBuffer();
}
