import React, { useState } from 'react';
import { useCurrency } from './currency.jsx';
import { languageCode } from '../shared/menu-languages.js';

export default function MenuEditor({item,act,disabled,onClose,imagesEnabled,Modal,Field,Button}) {
  const currency=useCurrency();
  const [translations,setTranslations]=useState(()=>({...item?.descriptionTranslations}));
  const [newLanguage,setNewLanguage]=useState('');
  const names=new Intl.DisplayNames('id',{type:'language'});
  function addLanguage(){
    const code=languageCode(newLanguage.trim());
    if(!code || code==='id'){setError('Masukkan kode bahasa tambahan, misalnya en, tr, ar, atau zh-Hant. ID adalah bahasa utama.');return;}
    if(Object.hasOwn(translations,code)){setError('Bahasa ini sudah ditambahkan.');return;}
    setTranslations(current=>({...current,[code]:''}));setNewLanguage('');setError('');
  }
  const [image,setImage]=useState(null),[removePhoto,setRemovePhoto]=useState(false),[error,setError]=useState(''),[reading,setReading]=useState(false),[saving,setSaving]=useState(false);
  const busy=disabled||reading||saving;
  const preview=image??(removePhoto?'':item?.photo);
  async function chooseFile(event) {
    const file=event.target.files?.[0];
    if(!file)return;
    setError('');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2097152){setError('Pilih PNG, JPG, atau WebP dengan ukuran maksimal 2 MB.');event.target.value='';return;}
    setReading(true);
    try {
      const value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Foto tidak dapat dibaca. Pilih ulang file.'));reader.readAsDataURL(file)});
      setImage(value);setRemovePhoto(false);
    } catch(e){setError(e.message)} finally {setReading(false)}
  }
  return <Modal wide title={item?'Edit menu':'Tambah menu'} onClose={()=>{if(!saving)onClose()}}><form aria-busy={saving} onSubmit={async event=>{
    event.preventDefault();if(busy)return;setSaving(true);setError('');
    const fields=Object.fromEntries(new FormData(event.currentTarget));
    try{if(await act({action:'menuSave',menuId:item?.id,...fields,price:Number(fields.price),descriptionTranslations:translations,image,removePhoto}))onClose();else setError('Menu belum tersimpan. Periksa isian atau koneksi, lalu coba lagi.')}finally{setSaving(false)}
  }}>
    <Field label="Nama hidangan"><input name="name" defaultValue={item?.name} required minLength={2} maxLength={100} disabled={saving}/></Field>
    <Field label="Kategori"><input name="category" defaultValue={item?.category??'Hidangan utama'} required maxLength={40} disabled={saving}/></Field>
    <Field label={`Harga final (${currency})`}><input name="price" type="number" min={1} max={10000000} step={1} defaultValue={item?.price} required disabled={saving}/></Field>
    <div className="description-toolbar"><h3>Deskripsi per bahasa</h3><div className="actions"><input aria-label="Kode bahasa baru" placeholder="Kode bahasa, mis. en" value={newLanguage} onChange={e=>setNewLanguage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addLanguage()}}} disabled={busy}/><Button type="button" onClick={addLanguage} disabled={busy}>Tambah bahasa</Button></div></div>
    <div className="menu-table-scroll"><table className="menu-table description-table"><thead><tr><th scope="col">ID <small>Utama</small></th>{Object.keys(translations).map(code=><th scope="col" key={code}><span title={names.of(code)}>{code.toUpperCase()}</span><button type="button" className="text-link" aria-label={'Hapus bahasa '+code.toUpperCase()} disabled={busy} onClick={()=>setTranslations(current=>{const next={...current};delete next[code];return next})}>Hapus</button></th>)}</tr></thead><tbody><tr><td><textarea aria-label="Deskripsi ID" name="description" defaultValue={item?.description} maxLength={300} disabled={saving}/></td>{Object.entries(translations).map(([code,text])=><td key={code}><textarea aria-label={'Deskripsi '+code.toUpperCase()} lang={code} dir="auto" value={text} maxLength={300} disabled={saving} onChange={e=>setTranslations(current=>({...current,[code]:e.target.value}))}/></td>)}</tr></tbody></table></div>
    <p className="fine-print">Maksimal 300 karakter per bahasa. Deskripsi kosong memakai bahasa utama di portal. Menghapus kolom menghapus terjemahan menu ini saat disimpan.</p>
    {imagesEnabled?<>
      <Field label="Foto menu (PNG/JPG/WebP, maksimal 2 MB)"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} disabled={busy}/></Field>
      {preview&&<div className="menu-photo-preview"><img src={preview} alt="Pratinjau foto menu"/><Button type="button" disabled={busy} onClick={()=>{setImage(null);setRemovePhoto(true)}}>Hapus foto</Button></div>}
      <p className="fine-print">Foto disimpan bersama menu. Gambar disesuaikan otomatis agar ringan dibuka.</p>
    </>:<p className="notice">Upload foto belum dikonfigurasi di lingkungan ini.</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <Button kind="primary full" disabled={busy}>{reading?'Membaca foto…':saving?'Menyimpan menu…':'Simpan menu'}</Button>
  </form></Modal>;
}
