export const defaultFinance = () => ({
  expenseCategories: ['Bahan baku','Peralatan','Gaji','Kemasan','Lain-lain'].map((name,i)=>({id:`expense-${i}`,name,active:true})),
  paymentMethods: ['Tunai','Transfer'].map((name,i)=>({id:`method-${i}`,name,active:true})),
});

export function ensureFinance(s) {
  const defaults=defaultFinance();
  s.settings.expenseCategories ??= defaults.expenseCategories;
  s.settings.paymentMethods ??= defaults.paymentMethods;
  s.expenses ??= [];
  for(const payment of s.payments??[])if(!payment.methodId){
    const method=s.settings.paymentMethods.find(m=>m.name===payment.method);
    if(method)payment.methodId=method.id;
  }
  return s;
}
export const methodName = (s,p) => s.settings.paymentMethods?.find(m=>m.id===p.methodId)?.name ?? p.method;
export const categoryName = (s,e) => s.settings.expenseCategories?.find(c=>c.id===e.categoryId)?.name ?? e.category;
export const inPeriod = (at,start=0,end=Infinity) => Date.parse(at)>=+start && Date.parse(at)<+end;
export function ledger(s) {
  return [
    ...s.payments.map(p=>({id:p.id,at:p.at,kind:'Pemasukan',category:'Penjualan',method:methodName(s,p),amount:p.amount,party:s.tabs.find(t=>t.id===p.tabId)?.name??'',reference:p.tabId,note:'Pembayaran pelanggan',actor:p.actor})),
    ...(s.expenses??[]).map(e=>({...e,kind:'Pengeluaran',category:categoryName(s,e),method:methodName(s,e),amount:-e.amount})),
  ].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
}
export function financeSummary(s,start=0,end=Infinity) {
  const rows=ledger(s).filter(r=>inPeriod(r.at,start,end));
  const incoming=rows.filter(r=>r.amount>0).reduce((n,r)=>n+r.amount,0);
  const outgoing=-rows.filter(r=>r.amount<0).reduce((n,r)=>n+r.amount,0);
  const methods=[...new Set(rows.filter(r=>r.amount>0).map(r=>r.method))].map(name=>{
    const entries=rows.filter(r=>r.amount>0&&r.method===name);
    return {name,amount:entries.reduce((n,r)=>n+r.amount,0),count:entries.length};
  });
  const sales=new Map();
  for(const o of s.orders.filter(o=>inPeriod(o.createdAt,start,end)))for(const u of o.units.filter(u=>u.status!=='cancelled')){
    const name=u.category??s.menu.find(m=>m.id===u.menuId)?.category??'Tidak diketahui (riwayat)';
    sales.set(name,(sales.get(name)??0)+u.price);
  }
  return {rows,incoming,outgoing,net:incoming-outgoing,methods,sales:[...sales].map(([name,amount])=>({name,amount}))};
}
