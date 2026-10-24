import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { supabase } from './supabase.js';
import { assert } from './store.js';

export async function validateImage(dataUrl) {
  assert(typeof dataUrl==='string' && dataUrl.length<=2800000,'Foto maksimal 2 MB.');
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  assert(match,'Pilih foto PNG, JPG, atau WebP yang valid.');
  const buffer=Buffer.from(match[2],'base64');
  assert(buffer.length<=2097152,'Foto maksimal 2 MB.');
  try {
    const image=sharp(buffer,{limitInputPixels:20000000,animated:false});
    const metadata=await image.metadata();
    assert(['png','jpeg','webp'].includes(metadata.format) && (metadata.pages??1)===1,'Gunakan gambar statis PNG, JPG, atau WebP.');
    return await image.rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
  } catch(error) {
    if(error.status)throw error;
    throw Object.assign(new Error('File gambar rusak atau ukurannya terlalu besar untuk diproses.'),{status:400});
  }
}
export async function prepareMenuImage(dataUrl,menuId) {
  const image=await validateImage(dataUrl);
  const key=`${menuId}/${randomUUID()}.webp`;
  const {error}=await supabase().storage.from('menu-images').upload(key,image,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
  if(error)throw Object.assign(new Error('Foto belum berhasil diunggah. Coba lagi.'),{status:503});
  return supabase().storage.from('menu-images').getPublicUrl(key).data.publicUrl;
}
export async function removeMenuImage(url) {
  const prefix=`${process.env.SUPABASE_URL}/storage/v1/object/public/menu-images/`;
  if(!url?.startsWith(prefix))return;
  try {
    const {error}=await supabase().storage.from('menu-images').remove([url.slice(prefix.length)]);
    if(error)console.error('Storage cleanup failed',error.code??error.statusCode);
  } catch { console.error('Storage cleanup failed'); }
}
