import React, { useState } from 'react';
import { ArrowUpRight, BookOpen, ChevronRight } from 'lucide-react';
import { popularMenu } from '../shared/metrics.js';

export default function ManagementOverview({data,go,select,money,time,due,SectionHead,Empty,Photo}) {
  const [period,setPeriod]=useState('today');
  const start=new Date();
  if(period==='today')start.setHours(0,0,0,0);
  else if(period==='week'){start.setDate(start.getDate()-6);start.setHours(0,0,0,0)}else start.setTime(0);
  const orders=data.orders.filter(o=>new Date(o.createdAt)>=start),units=orders.flatMap(o=>o.units),active=data.tabs.filter(t=>!t.closedAt);
  const net=units.filter(u=>u.status!=='cancelled').reduce((n,u)=>n+u.price,0);
  const paid=data.payments.filter(p=>new Date(p.at)>=start).reduce((n,p)=>n+p.amount,0);
  const owed=data.orders.filter(o=>active.some(t=>t.id===o.tabId)).reduce((n,o)=>n+due(o.units),0);
  const counts={waiting:0,accepted:0,cooking:0,ready:0};
  for(const o of data.orders)for(const u of o.units)if(u.status in counts)counts[u.status==='accepted'?'cooking':u.status]++;
  const popular=popularMenu(data.menu,orders).slice(0,4);
  return <><div className="overview-toolbar"><span><span className="live-dot"/>{active.length} transaksi aktif saat ini</span><select aria-label="Periode laporan" value={period} onChange={e=>setPeriod(e.target.value)}><option value="today">Hari ini</option><option value="week">7 hari terakhir</option><option value="all">Semua waktu</option></select></div><div className="metrics">{[
    ['Nilai pesanan bersih',money(net),`${orders.length} pesanan masuk`],
    ['Pembayaran tercatat',money(paid),'Pembayaran manual diterima'],
    ['Sisa tagihan aktif',money(owed),'Total utang transaksi aktif saat ini'],
    ['Transaksi belum selesai',active.length,'Termasuk lunas tetapi belum diantar'],
  ].map(([label,value,sub])=><div className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>)}</div>
  <div className="overview-grid"><section className="ledger-section"><SectionHead title="Transaksi aktif" extra={<button className="text-link" onClick={()=>go('history')}>Lihat semua<ArrowUpRight size={15}/></button>}/>{active.length?<><div className="table-head"><span>Pelanggan</span><span>Pesanan</span><span>Sisa tagihan</span><span/></div>{active.slice(0,5).map(t=>{const os=data.orders.filter(o=>o.tabId===t.id);return <button className="customer-row" key={t.id} onClick={()=>select(t)}><div className="customer-name"><span className="customer-initial">{t.name[0]}</span><div><strong>{t.name}</strong><small>Sejak {time(t.createdAt)}</small></div></div><span>{os.length}</span><strong className="amount">{money(os.reduce((n,o)=>n+due(o.units),0))}</strong><ChevronRight size={16}/></button>})}</>:<Empty title="Belum ada transaksi aktif" text="Transaksi akan tercatat saat pesanan pertama berhasil dibuat."/>}</section>
  <section className="service-flow"><SectionHead title="Dari dapur ke pelanggan"/>{[['waiting','Menunggu diterima'],['cooking','Sedang dimasak'],['ready','Siap diantar']].map(([k,label])=><div className="flow-row" key={k}><span className={`status ${k}`}><span/>{label}</span><strong>{counts[k]}<small>porsi</small></strong></div>)}<button className="text-link" onClick={()=>go('history')}>Telusuri transaksi <ArrowUpRight size={16}/></button></section>
  <section className="ledger-section"><SectionHead title="Pilihan pelanggan" extra={<span className="muted">Dipesan − dibatalkan · semua status pembayaran</span>}/>{popular.length?popular.map((m,i)=><div className="popular-row" key={m.id}><span className="rank">{String(i+1).padStart(2,'0')}</span><Photo item={m}/><div><h3>{m.name}</h3><span>{m.category}</span></div><strong>{m.quantity}<small>porsi</small></strong></div>):<Empty title="Belum ada menu terpesan" text="Jumlah dihitung dari porsi yang tidak dibatalkan, baik lunas maupun belum dibayar." icon={BookOpen}/>}</section>
  <section className="ledger-section"><SectionHead title="Catatan transaksi"/><div className="summary-line"><span>Item dibatalkan</span><strong>{units.filter(u=>u.status==='cancelled').length} porsi</strong></div><div className="summary-line"><span>Nilai pembatalan</span><strong>{money(units.filter(u=>u.status==='cancelled').reduce((n,u)=>n+u.price,0))}</strong></div><div className="summary-line"><span>Rata-rata pesanan bersih</span><strong>{money(orders.filter(o=>o.units.some(u=>u.status!=='cancelled')).length?Math.round(net/orders.filter(o=>o.units.some(u=>u.status!=='cancelled')).length):0)}</strong></div><p className="fine-print">Nilai pesanan dan pembayaran mengikuti periode kejadian. Transaksi belum selesai dan sisa tagihan aktif menunjukkan keadaan saat ini.</p></section></div></>;
}
