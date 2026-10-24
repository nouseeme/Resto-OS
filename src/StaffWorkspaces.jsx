import React, { useState } from 'react';
import { ArrowUpRight, ArrowLeftRight, LogOut, CookingPot, UsersRound, ChartNoAxesCombined, LayoutDashboard, ReceiptText, BookOpen, Settings, UtensilsCrossed, Menu, ChevronRight } from 'lucide-react';
import { WORKSPACE_PAGES } from '../shared/workspaces.js';

const names = { kitchen:'Dapur', waiter:'Garson', manager:'Manajemen' };
const modules = {
  overview: ['Ringkasan bisnis', LayoutDashboard], history: ['Arsip transaksi', ReceiptText], finance: ['Keuangan', ReceiptText],
  menu: ['Katalog menu', BookOpen], settings: ['Pengaturan', Settings],
  kitchen: ['Antrean dapur', CookingPot], availability: ['Ketersediaan', BookOpen],
  customers: ['Pelanggan & Order', UsersRound], delivery: ['Siap Diantar', UtensilsCrossed],
};
const destinations = WORKSPACE_PAGES;

function Account({data,onSwitch,onLogout}) {
  return <div className="workspace-account"><div className="workspace-person"><strong>{data.actor.name}</strong><small>{names[data.actor.role]}</small></div><div className="session-actions"><button className="icon-button" aria-label="Pindah role" title="Pindah role" onClick={onSwitch}><ArrowLeftRight size={18}/></button><button className="icon-button" aria-label="Keluar" title="Keluar" onClick={onLogout}><LogOut size={18}/></button></div></div>;
}
function Tabs({role,current,onNavigate,ready}) {
  return <nav className="workspace-tabs" aria-label={`Modul ${names[role]}`}>{destinations[role].map(key=>{const [name,Icon]=modules[key];return <button key={key} className={current===key?'selected':''} onClick={()=>onNavigate(key)}><Icon size={18}/><span>{name}</span>{key==='delivery'&&ready>0&&<b>{ready}</b>}</button>})}</nav>;
}
export function RoleChooser({data,onChoose,onLogout,busy,error,Mark}) {
  const options = [
    ['kitchen','Dapur','Terima order, masak, dan siapkan sajian.','Antrean produksi · Catatan masakan · Ketersediaan',CookingPot],
    ['waiter','Garson','Layani pelanggan sampai tagihan selesai.','Pelanggan & Order · Pengantaran · Pembayaran',UsersRound],
    ['manager','Manajemen','Lihat kinerja dan kelola restoran.','Laporan · Arsip transaksi · Katalog · Pengaturan',ChartNoAxesCombined],
  ];
  return <div className="role-choice"><header><a href="/ruang-staf" className="wordmark"><Mark/><span>restoOS</span></a><div className="choice-account"><span>{data.actor.name}</span><button className="icon-button" onClick={onLogout} aria-label="Keluar" title="Keluar"><LogOut size={18}/></button></div></header><main><div className="choice-heading"><h1>Anda bertugas di mana?</h1><p>Pilih ruang kerja untuk sesi ini. Anda bisa pindah role kapan saja.</p></div><div className="role-options">{options.map(([key,name,description,detail,Icon])=><button key={key} className={`role-option choice-${key}`} disabled={busy||!!error} onClick={()=>onChoose(key)} aria-label={`Masuk ${name}`}><Icon size={34} strokeWidth={1.3}/><h2>{name}</h2><p>{description}</p><small>{detail}</small><span>Masuk {name}<ArrowUpRight size={20}/></span></button>)}</div>{error&&<p className="form-error" role="alert">{error}</p>}<p className="choice-note">{data.settings.name} · Satu tim, tiga ruang kerja.</p></main></div>;
}

export function StaffWorkspace({data,current,onNavigate,onSwitch,onLogout,Mark,children}) {
  const role=data.actor.role;
  const [drawer,setDrawer]=useState(false);
  const navigate=v=>{onNavigate(v);setDrawer(false)};
  const ready=data.orders.flatMap(o=>o.units).filter(u=>u.status==='ready').length;
  if(role==='kitchen') return <div className="kitchen-workspace"><header className="kitchen-workspace-header"><div className="kitchen-identity"><CookingPot size={28} strokeWidth={1.4}/><div><strong>Dapur</strong><small>{data.settings.name}</small></div></div><Account data={data} onSwitch={onSwitch} onLogout={onLogout}/></header><div className="kitchen-toolbar"><Tabs role={role} current={current} onNavigate={navigate} ready={ready}/><span className="kitchen-station">Satu dapur · Dine in</span></div><main className="kitchen-canvas">{children}</main></div>;
  if(role==='waiter') {
    const active=data.tabs.filter(t=>!t.closedAt);
    return <div className="waiter-workspace"><header className="waiter-header"><div className="waiter-brand"><Mark/><div><strong>Ruang garson</strong><small>{data.settings.name}</small></div></div><Account data={data} onSwitch={onSwitch} onLogout={onLogout}/></header><div className="waiter-navigation"><Tabs role={role} current={current} onNavigate={navigate} ready={ready}/><span className="waiter-service-state"><span className={`live-dot ${data.settings.paused?'paused':''}`}/>{data.settings.paused?'Order baru dijeda':'Pesanan dibuka'}</span></div><div className="waiter-pulse"><span><strong>{active.length}</strong>Transaksi aktif</span><span><strong>{ready}</strong>Porsi siap diantar</span><span><strong>{data.orders.filter(o=>active.some(t=>t.id===o.tabId)).length}</strong>Pesanan berjalan</span></div><main className="waiter-canvas">{children}</main></div>;
  }
  return <div className="app-shell management-workspace"><aside className={`sidebar ${drawer?'open':''}`}><a href="#overview" className="wordmark"><Mark/><span>restoOS<small>MANAJEMEN</small></span></a><div className="restaurant-mini"><span className="monogram">{data.settings.name[0]}</span><div><strong>{data.settings.name}</strong><span>Laporan & pengelolaan</span></div></div><nav aria-label="Modul Manajemen">{destinations.manager.map(key=>{const [name,Icon]=modules[key];return <button key={key} className={current===key?'active':''} onClick={()=>navigate(key)}><Icon size={19}/>{name}</button>})}</nav><div className="sidebar-bottom"><a href="/portal" target="_blank" rel="noreferrer" className="portal-link"><ArrowUpRight size={17}/>Buka portal pelanggan</a><Account data={data} onSwitch={onSwitch} onLogout={onLogout}/></div></aside>{drawer&&<div className="nav-shade" onClick={()=>setDrawer(false)}/>}<main className="workspace"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={()=>setDrawer(!drawer)} aria-label="Buka navigasi"><Menu size={22}/></button><span>Manajemen</span><ChevronRight size={14}/><strong>{modules[current]?.[0]}</strong></div><span className="local-date">{new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</span></header><div className="content">{children}</div></main></div>;
}
