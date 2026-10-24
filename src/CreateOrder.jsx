import React, { useRef, useState } from 'react';
import { Plus, Search, ArrowUpRight, Loader2 } from 'lucide-react';
import { CustomerPicker } from './TransactionPanels.jsx';

export default function CreateOrder({data,tabId,onClose,refresh,offline,api,toast,Modal,Button,CartItems,money}) {
  const initial=data.tabs.find(t=>t.id===tabId&&!t.closedAt);
  const [choice,setChoice]=useState(initial?{tabId:initial.id,name:initial.name}:null),[cart,setCart]=useState([]),[query,setQuery]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef(crypto.randomUUID());
  const updateCart=fn=>{request.current=crypto.randomUUID();setCart(fn)};
  const add=m=>updateCart(c=>c.some(i=>i.menuId===m.id)?c.map(i=>i.menuId===m.id?{...i,qty:Math.min(30,i.qty+1)}:i):[...c,{menuId:m.id,name:m.name,price:m.price,qty:1,note:''}]);
  async function submit(event){
    event.preventDefault();if(!choice)return;setError('');setBusy(true);
    try{await api('orders',{tabId:choice.tabId||undefined,name:choice.name,items:cart,requestId:request.current});await refresh();toast.success('Pesanan terkirim ke dapur.');onClose()}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <Modal title={tabId?'Tambah pesanan':'Buat order'} onClose={onClose} wide><form onSubmit={submit}><CustomerPicker data={data} tabId={tabId} onChange={value=>{setChoice(value);request.current=crypto.randomUUID()}} money={money}/>{choice&&<>{data.settings.paused&&<div className="notice">Pemesanan sedang dijeda dapur. Keranjang tetap tersimpan.</div>}<label className="search"><Search size={17}/><input placeholder="Cari hidangan…" aria-label="Cari hidangan" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="menu-picker">{data.menu.filter(m=>m.name.toLowerCase().includes(query.toLowerCase())).map(m=><div className="picker-row" key={m.id}><div><strong>{m.name}</strong><small>{money(m.price)}{m.available?'':' · Habis'}</small></div><button type="button" className="icon-button bordered" disabled={!m.available} aria-label={`Tambah ${m.name}`} onClick={()=>add(m)}><Plus size={18}/></button></div>)}</div><CartItems cart={cart} change={(id,n)=>updateCart(c=>c.map(i=>i.menuId===id?{...i,qty:Math.min(30,i.qty+n)}:i).filter(i=>i.qty>0))} note={(id,note)=>updateCart(c=>c.map(i=>i.menuId===id?{...i,note}:i))}/></>}{error&&<p className="form-error" role="alert">{error}</p>}<div className="checkout-line"><span>Total<strong>{money(cart.reduce((n,i)=>n+i.qty*i.price,0))}</strong></span><Button kind="primary" disabled={busy||offline||!choice||!cart.length||data.settings.paused}>{busy?<Loader2 size={17} className="spin"/>:<ArrowUpRight size={17}/>}Kirim ke dapur</Button></div></form></Modal>;
}
