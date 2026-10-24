import React from 'react';
import { ArrowUpRight, BookOpen, ChevronRight } from 'lucide-react';
import { popularMenu } from '../shared/metrics.js';
import { FinanceBreakdown } from './Finance.jsx';

export const OVERVIEW_PERIODS = {
  today: {label:'Hari ini',context:'hari ini'},
  week: {label:'7 hari terakhir',context:'dalam 7 hari terakhir'},
  all: {label:'Semua waktu',context:'sepanjang waktu'},
};

export default function ManagementOverview({data,go,select,money,time,due,SectionHead,Empty,Photo,period='today',onPeriodChange}) {
  const {context}=OVERVIEW_PERIODS[period];
  const start=new Date();
  if(period==='today')start.setHours(0,0,0,0);
  else if(period==='week'){start.setDate(start.getDate()-6);start.setHours(0,0,0,0)}else start.setTime(0);
  const orders=data.orders.filter(o=>new Date(o.createdAt)>=start),units=orders.flatMap(o=>o.units);
  const periodTabIds=new Set(orders.map(o=>o.tabId));
  const allActive=data.tabs.filter(t=>!t.closedAt);
  const allActiveIds=new Set(allActive.map(t=>t.id));
  const active=allActive.filter(t=>periodTabIds.has(t.id));
  const net=units.filter(u=>u.status!=='cancelled').reduce((n,u)=>n+u.price,0);
  const paid=data.payments.filter(p=>new Date(p.at)>=start).reduce((n,p)=>n+p.amount,0);
  const owed=data.orders.filter(o=>allActiveIds.has(o.tabId)).reduce((n,o)=>n+due(o.units),0);
  const counts={waiting:0,accepted:0,cooking:0,ready:0};
  for(const o of orders)for(const u of o.units)if(u.status in counts)counts[u.status==='accepted'?'cooking':u.status]++;
  const popular=popularMenu(data.menu,orders).slice(0,4);
  return <><div className="overview-toolbar"><span><span className="live-dot"/>{active.length} transaksi aktif {context}</span><select aria-label="Periode laporan" value={period} onChange={e=>onPeriodChange(e.target.value)}>{Object.entries(OVERVIEW_PERIODS).map(([value,p])=><option key={value} value={value}>{p.label}</option>)}</select></div><div className="metrics">{[
    ['Nilai pesanan bersih',money(net),`${orders.length} pesanan masuk ${context}`],
    ['Pembayaran tercatat',money(paid),`Pembayaran diterima ${context}`],
    ['Sisa piutang aktif',money(owed),'Semua waktu · sisa tagihan aktif saat ini'],
    ['Transaksi belum selesai',allActive.length,'Semua waktu · belum lunas atau belum selesai dilayani'],
  ].map(([label,value,sub])=><div className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>)}</div>
  <div className="overview-grid"><section className="ledger-section"><SectionHead title="Transaksi aktif" extra={<button className="text-link" onClick={()=>go('history')}>Lihat semua<ArrowUpRight size={15}/></button>}/>{active.length?<><div className="table-head"><span>Pelanggan</span><span>Pesanan</span><span>Sisa tagihan</span><span/></div>{active.slice(0,5).map(t=>{const os=orders.filter(o=>o.tabId===t.id);return <button className="customer-row" key={t.id} onClick={()=>select(t)}><div className="customer-name"><span className="customer-initial">{t.name[0]}</span><div><strong>{t.name}</strong><small>Sejak {time(t.createdAt)}</small></div></div><span>{os.length}</span><strong className="amount">{money(os.reduce((n,o)=>n+due(o.units),0))}</strong><ChevronRight size={16}/></button>})}</>:<Empty title="Belum ada transaksi aktif" text={`Tidak ada transaksi yang belum selesai untuk pesanan ${context}.`}/>}</section>
  <section className="service-flow"><SectionHead title="Dari dapur ke pelanggan"/>{[['waiting','Menunggu diterima'],['cooking','Sedang dimasak'],['ready','Siap diantar']].map(([k,label])=><div className="flow-row" key={k}><span className={`status ${k}`}><span/>{label}</span><strong>{counts[k]}<small>porsi</small></strong></div>)}<button className="text-link" onClick={()=>go('history')}>Telusuri transaksi <ArrowUpRight size={16}/></button></section>
  <section className="ledger-section"><SectionHead title="Pilihan pelanggan" extra={<span className="muted">Jumlah pesanan per menu {context}</span>}/>{popular.length?popular.map((m,i)=><div className="popular-row" key={m.id}><span className="rank">{String(i+1).padStart(2,'0')}</span><Photo item={m}/><div><h3>{m.name}</h3><span>{m.category}</span></div><strong>{m.quantity}<small>porsi</small></strong></div>):<Empty title="Belum ada menu terpesan" text="Jumlah dihitung dari porsi yang tidak dibatalkan, baik lunas maupun belum dibayar." icon={BookOpen}/>}</section>
  <section className="ledger-section"><SectionHead title="Catatan transaksi"/><div className="summary-line"><span>Item dibatalkan</span><strong>{units.filter(u=>u.status==='cancelled').length} porsi</strong></div><div className="summary-line"><span>Nilai pembatalan</span><strong>{money(units.filter(u=>u.status==='cancelled').reduce((n,u)=>n+u.price,0))}</strong></div><div className="summary-line"><span>Rata-rata pesanan bersih</span><strong>{money(orders.filter(o=>o.units.some(u=>u.status!=='cancelled')).length?Math.round(net/orders.filter(o=>o.units.some(u=>u.status!=='cancelled')).length):0)}</strong></div><p className="fine-print">Ringkasan ini mencakup pesanan yang masuk dan pembayaran yang diterima {context}. Piutang aktif dan transaksi belum selesai mencakup semua waktu. Daftar transaksi dan status layanan mengikuti periode terpilih.</p></section><FinanceBreakdown data={data} start={start} money={money} SectionHead={SectionHead}/></div></>;
}
