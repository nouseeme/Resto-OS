import React, { useState } from 'react';
import { useCurrency } from './currency.jsx';

export default function MenuEditor({item,act,disabled,onClose,imagesEnabled,Modal,Field,Button}) {
  const currency=useCurrency();
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
  return <Modal title={item?'Edit menu':'Tambah menu'} onClose={()=>{if(!saving)onClose()}}><form aria-busy={saving} onSubmit={async event=>{
    event.preventDefault();if(busy)return;setSaving(true);setError('');
    const fields=Object.fromEntries(new FormData(event.currentTarget));
    try{if(await act({action:'menuSave',menuId:item?.id,...fields,price:Number(fields.price),image,removePhoto}))onClose();else setError('Menu belum tersimpan. Periksa isian atau koneksi, lalu coba lagi.')}finally{setSaving(false)}
  }}>
    <Field label="Nama hidangan"><input name="name" defaultValue={item?.name} required minLength={2} maxLength={100} disabled={saving}/></Field>
    <Field label="Kategori"><input name="category" defaultValue={item?.category??'Hidangan utama'} required maxLength={40} disabled={saving}/></Field>
    <Field label={`Harga final (${currency})`}><input name="price" type="number" min={1} max={10000000} step={1} defaultValue={item?.price} required disabled={saving}/></Field>
    <Field label="Deskripsi"><textarea name="description" defaultValue={item?.description} maxLength={300} disabled={saving}/></Field>
    {imagesEnabled?<>
      <Field label="Foto menu (PNG/JPG/WebP, maksimal 2 MB)"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} disabled={busy}/></Field>
      {preview&&<div className="menu-photo-preview"><img src={preview} alt="Pratinjau foto menu"/><Button type="button" disabled={busy} onClick={()=>{setImage(null);setRemovePhoto(true)}}>Hapus foto</Button></div>}
      <p className="fine-print">Foto disimpan bersama menu. Gambar disesuaikan otomatis agar ringan dibuka.</p>
    </>:<p className="notice">Upload foto belum dikonfigurasi di lingkungan ini.</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <Button kind="primary full" disabled={busy}>{reading?'Membaca foto…':saving?'Menyimpan menu…':'Simpan menu'}</Button>
  </form></Modal>;
}
