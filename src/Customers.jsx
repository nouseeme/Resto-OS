import React, { useEffect, useState } from 'react';
import { Search, ChevronRight, Merge, X } from 'lucide-react';
import { serviceCustomers, needsService } from '../shared/customer-service.js';
import { useMoney } from './currency.jsx';

const stamp = value => new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Customers({ data, select, act, disabled, Button, Empty }) {
  const money = useMoney();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState('');
  const [review, setReview] = useState(false);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const customers = serviceCustomers(data, clock);
  const chosen = customers.filter(row => selected.includes(row.tab.id));
  const chosenIds = chosen.map(row => row.tab.id);
  const targetId = chosenIds.includes(target) ? target : chosenIds[0] ?? '';
  const rows = customers.filter(row => row.tab.name.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')));
  const groups = [
    { id: 'active', title: 'Order aktif', rows: rows.filter(row => row.group === 'active').sort((a, b) => b.latest - a.latest) },
    { id: 'old', title: 'Piutang lama', rows: rows.filter(row => row.group === 'old').sort((a, b) => Math.min(...a.old.map(order => Date.parse(order.createdAt))) - Math.min(...b.old.map(order => Date.parse(order.createdAt)))) },
  ];
  const toggle = id => { setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]); setReview(false); };
  const clear = () => { setSelected([]); setTarget(''); setReview(false); };
  const allChecked = rows.length > 0 && rows.every(row => chosenIds.includes(row.tab.id));
  const merge = async () => {
    if (await act({ action: 'merge', tabIds: chosenIds, targetTabId: targetId })) clear();
  };
  return <section className="customer-list">
    <div className="list-toolbar customer-toolbar">
      <span className="muted">{customers.length} pelanggan · {rows.length} ditampilkan</span>
      <label className="search"><Search size={17}/><input aria-label="Cari pelanggan" placeholder="Cari nama pelanggan…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    </div>
    <p className="fine-print customer-scope-note">Order aktif di atas, piutang lebih dari 5 jam tanpa order baru di bawah. Setiap pelanggan menampilkan seluruh sisa tagihannya.</p>
    {chosen.length > 0 && <div className="customer-selection" aria-label="Pelanggan terpilih">
      <div className="customer-selection-head"><strong>{chosen.length} pelanggan dipilih</strong><button className="text-link" onClick={clear} disabled={disabled}><X size={14}/>Batal pilih</button></div>
      <p>{chosen.map(row => row.tab.name).join(' · ')}</p>
      {!review ? <Button disabled={disabled || chosen.length < 2 || chosen.length > 50} onClick={() => { setTarget(targetId); setReview(true); }}><Merge size={16}/>Gabungkan pelanggan</Button> : <>
        <fieldset disabled={disabled} className="customer-merge-target"><legend>Pilih nama pelanggan utama</legend>{chosen.map(row => <label key={row.tab.id}><input type="radio" name="merge-target" value={row.tab.id} checked={targetId === row.tab.id} onChange={() => setTarget(row.tab.id)}/><span><strong>{row.tab.name}</strong><small>{row.orders.length} order · Sisa {money(row.totalDue)}</small></span></label>)}</fieldset>
        <p>Seluruh order, pembayaran, dan sisa tagihan digabung ke <strong>{chosen.find(row => row.tab.id === targetId)?.tab.name}</strong>. Tiap order tetap terpisah. Semua portal terkait mengikuti nama dan tagihan gabungan saat data diperbarui.</p>
        <p className="fine-print">Pastikan pilihan ini milik orang yang sama. Penggabungan membuka seluruh tagihan gabungan di setiap portal terkait dan belum dapat dibatalkan.</p>
        <div className="actions"><Button kind="primary" disabled={disabled || chosen.length < 2} onClick={merge}>Gabungkan {chosen.length} pelanggan</Button><Button disabled={disabled} onClick={() => setReview(false)}>Kembali</Button></div>
      </>}
    </div>}
    {rows.length ? <>
      <div className="customer-table-head"><label className="customer-select"><input type="checkbox" aria-label="Pilih semua pelanggan yang ditampilkan" checked={allChecked} disabled={disabled} onChange={() => { setSelected(ids => allChecked ? ids.filter(id => !rows.some(row => row.tab.id === id)) : [...new Set([...ids, ...rows.map(row => row.tab.id)])]); setReview(false); }}/></label><span>Pelanggan / order</span><span>Total sisa tagihan</span></div>
      {groups.map(group => <section className="customer-group" key={group.id} aria-labelledby={`customer-group-${group.id}`}>
        <div className="customer-group-heading"><h3 id={`customer-group-${group.id}`}>{group.title} <span>{group.rows.length}</span></h3>{group.id === 'old' && <small>Lebih dari 5 jam · piutang tertua lebih dulu</small>}</div>
        {group.rows.length ? group.rows.map(row => {
        const orders = row.orders;
        const ready = row.orders.some(order => order.units.some(unit => unit.status === 'ready'));
        const pending = orders.some(needsService);
        return <div className="customer-selectable-row" key={row.tab.id} data-selected={chosenIds.includes(row.tab.id)}>
          <label className="customer-select"><input type="checkbox" aria-label={`Pilih ${row.tab.name}`} checked={chosenIds.includes(row.tab.id)} disabled={disabled} onChange={() => toggle(row.tab.id)}/></label>
          <button className="customer-service-row" onClick={() => select(row.tab)}>
            <div className="customer-name"><span className="customer-initial" aria-hidden="true">{row.tab.name[0]}</span><div><strong>{row.tab.name}</strong><small>{orders.length} order · {group.id === 'old' ? 'Piutang tertua ' + stamp(row.old.reduce((oldest, order) => Date.parse(order.createdAt) < Date.parse(oldest.createdAt) ? order : oldest).createdAt) : 'Terbaru ' + stamp(new Date(row.latest).toISOString())}</small>{(ready || pending) && <small className={ready ? 'green' : ''}>{ready ? 'Ada makanan siap diantar' : 'Layanan masih berjalan'}</small>}</div></div>
            <div className="customer-balance"><strong>{money(row.totalDue)}</strong></div><ChevronRight size={16}/>
          </button>
        </div>;
        }) : <p className="customer-group-empty">{group.id === 'active' ? 'Tidak ada order aktif.' : 'Tidak ada piutang lama.'}</p>}
      </section>)}
    </> : <Empty title={query ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan aktif'} text={query ? 'Coba nama pelanggan lain.' : 'Gunakan Buat order untuk mencari pelanggan atau membuka transaksi baru.'}/>}
    <p className="fine-print">Satu pelanggan hanya muncul di satu kelompok. Order baru memindahkan pelanggan ke Order aktif, dengan seluruh sisa tagihan tetap disatukan.</p>
  </section>;
}
