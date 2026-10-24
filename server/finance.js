import { assert, id, now, normalize, key, audit } from './store.js';
import { ensureFinance } from '../shared/finance.js';

export function financeAction(s,body,actor) {
  assert(actor?.role==='manager','Keuangan hanya dapat diubah dari Manajemen.',403);
  ensureFinance(s);
  if(body.action==='financeOption') {
    assert(['expenseCategories','paymentMethods'].includes(body.list),'Daftar tidak valid.');
    const list=s.settings[body.list];
    const item=body.id?list.find(x=>x.id===body.id):{id:id(),active:true};
    assert(item,'Pilihan tidak ditemukan.',404);
    const name=normalize(body.name);
    assert(name.length>=2&&name.length<=40,'Nama harus 2–40 karakter.');
    assert(!list.some(x=>x.id!==item.id&&key(x.name)===key(name)),'Nama sudah digunakan.',409);
    const active=body.active!==false;
    assert(active||list.some(x=>x.id!==item.id&&x.active),'Sisakan setidaknya satu pilihan aktif.');
    assert(body.id||list.length<100,'Maksimal 100 pilihan per daftar.');
    Object.assign(item,{name,active});
    if(!body.id)list.push(item);
  } else if(body.action==='expense') {
    assert(typeof body.requestId==='string'&&body.requestId.length>=16&&body.requestId.length<=100,'Identitas kiriman tidak valid.');
    const previous=s.expenses.find(e=>e.requestId===body.requestId);
    if(previous){
      assert(previous.amount===body.amount&&Date.parse(previous.at)===Date.parse(body.at)&&previous.categoryId===body.categoryId&&previous.methodId===body.methodId&&previous.party===normalize(body.party)&&previous.note===normalize(body.note)&&previous.reference===normalize(body.reference),'Kiriman ini sudah tersimpan dengan isi berbeda. Tutup formulir dan periksa ledger.',409);
      return {ok:true};
    }
    const category=s.settings.expenseCategories.find(x=>x.id===body.categoryId&&x.active);
    const method=s.settings.paymentMethods.find(x=>x.id===body.methodId&&x.active);
    assert(category&&method,'Pilih kategori dan metode yang masih aktif.',409);
    assert(Number.isSafeInteger(body.amount)&&body.amount>0&&body.amount<=1000000000000,'Nominal harus bilangan bulat positif, maksimal 1 triliun.');
    assert(typeof body.at==='string','Tanggal pengeluaran tidak valid.');
    const at=new Date(body.at);
    assert(Number.isFinite(at.getTime())&&at.getTime()<=Date.now()&&at.getTime()>=0,'Tanggal pengeluaran tidak valid atau berada di masa depan.');
    const party=normalize(body.party),note=normalize(body.note),reference=normalize(body.reference);
    assert(party.length>=2&&party.length<=120,'Penerima harus 2–120 karakter.');
    assert(note.length>=3&&note.length<=300,'Keterangan harus 3–300 karakter.');
    assert(reference.length<=100,'Referensi maksimal 100 karakter.');
    s.expenses.push({id:id(),requestId:body.requestId,at:at.toISOString(),amount:body.amount,categoryId:category.id,category:category.name,methodId:method.id,method:method.name,party,note,reference,actor:actor.name,createdAt:now()});
  } else assert(false,'Tindakan keuangan tidak valid.');
  audit(s,actor,body.action,JSON.stringify(body));
  return {ok:true};
}
