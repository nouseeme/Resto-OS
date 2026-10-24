import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';

export default function MenuImport({api,refresh,onClose,Modal,Button,money,offline}) {
  const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef(crypto.randomUUID());
  async function load(event){
    const selected=event.target.files[0];setPreview(null);setError('');setFile(null);request.current=crypto.randomUUID();
    if(!selected)return;
    if(!/\.xlsx$/i.test(selected.name)||selected.size>500000){setError('Pilih file .xlsx, maksimal 500 KB.');return}
    setBusy(true);
    try{
      const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(selected)});
      setFile({name:selected.name,encoded});setPreview(await api('menu-import/preview',{file:encoded}));
    }catch(e){setError(e.message??'File tidak dapat dibaca. Coba lagi.')}finally{setBusy(false)}
  }
  async function save(){
    setBusy(true);setError('');
    try{const result=await api('menu-import/commit',{file:file.encoded,catalogRevision:preview.catalogRevision,requestId:request.current});await refresh();onClose(result)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <Modal title="Impor menu dari Excel" onClose={()=>!busy&&onClose()} wide><p className="import-instruction">Isi sheet Menu mulai baris kedua. Nama yang sama memperbarui katalog; nama baru menambah menu. Harga mengikuti mata uang dasar restoran; masukkan angka bulat tanpa simbol mata uang. Harga pesanan terdahulu tetap.</p><a className="button" href="/templates/template-menu-restoOS.xlsx" download><Download size={17}/>Unduh template Excel</a><label className="field import-file"><span>File katalog (.xlsx, maksimal 500 KB, 1.000 menu)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={load} disabled={busy||offline}/></label>{busy&&<p className="import-progress" role="status"><Loader2 size={17} className="spin"/>Memproses workbook…</p>}{preview&&<><div className="import-summary"><FileSpreadsheet size={20}/><div><strong>{file.name}</strong><p>{preview.creates} menu baru · {preview.updates} diperbarui · {preview.errors.length} masalah</p></div></div>{preview.errors.length>0&&<div className="form-error" role="alert"><strong>Belum ada perubahan yang disimpan.</strong><ul>{preview.errors.map((e,i)=><li key={i}>Baris {e.row}: {e.message}</li>)}</ul></div>}<div className="import-preview"><table><thead><tr><th>Baris</th><th>Nama menu</th><th>Harga</th><th>Tersedia</th><th>Perubahan</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.row}><td>{r.row}</td><td>{r.name}</td><td>{money(r.price)}</td><td>{r.available?'Ya':'Tidak'}</td><td>{r.action==='create'?'Tambah':'Perbarui'}</td></tr>)}</tbody></table></div></>}{error&&<p className="form-error" role="alert">{error}</p>}<p className="fine-print">Foto tidak diimpor dari Excel. Upload foto menu akan diaktifkan setelah Supabase Storage terhubung.</p><Button kind="primary full" disabled={busy||offline||!preview||preview.errors.length>0} onClick={save}><Upload size={17}/>Simpan impor</Button></Modal>;
}
