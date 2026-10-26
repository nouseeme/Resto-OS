import { initialState, passwordHash } from './store.js';
import { ensureFinance } from '../shared/finance.js';
const photo=id=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;
const catalog=[
 ['Burger Sapi', 'Hidangan utama',65000,'Patty sapi, keju, selada, dan saus rumah.','photo-1568901346375-23c9450c58cd'],
 ['Pizza Margherita','Hidangan utama',75000,'Tomat, mozzarella, dan basil segar.','photo-1579751626657-72bc17010498'],
 ['Pasta Tomat','Hidangan utama',55000,'Pasta dengan saus tomat dan herba.','photo-1473093295043-cdd812d0e601'],
 ['Salad Segar','Hidangan utama',35000,'Sayuran renyah dengan dressing lemon.','photo-1512621776951-a57141f2eefd'],
 ['Pancake Madu','Pencuci mulut',32000,'Pancake hangat dengan madu dan buah.','photo-1528207776546-365bb710ee93'],
 ['Es Krim','Pencuci mulut',25000,'Es krim lembut untuk menutup santapan.','photo-1563805042-7684c019e1cb'],
 ['Kopi Latte','Minuman',28000,'Espresso dengan susu hangat.','photo-1541167760496-1628856ab772'],
 ['Es Lemon','Minuman',22000,'Minuman lemon segar dengan es.','photo-1544145945-f90425340c7e'],
];
// Dates are relative to the first visit; saved sessions keep their original dates.
export function createDemoState(time=Date.now()) {
 const s=ensureFinance(initialState());
 const at=minutes=>new Date(time-minutes*60000).toISOString();
 Object.assign(s.settings,{name:'Dapur Senja',tagline:'Santapan hangat, cerita yang dekat.'});
 s.users=[{id:'demo-staff',name:'Staf Demo',username:'demo',password:passwordHash('demo-resto-2026')}];
 s.menu=catalog.map(([name,category,price,description,image],i)=>({id:`demo-menu-${i}`,name,category,price,description,photo:photo(image),available:true,descriptionTranslations:{}}));
 const add=(name,index,status,minutes,paidCount=0,closed=false)=>{
  const tabId=`demo-tab-${index}`,orderId=`demo-order-${index}`,createdAt=at(minutes);
  s.tabs.push({id:tabId,name,token:`demo-guest-${index}`,createdAt,...(closed?{closedAt:at(minutes-10)}:{})});
  const items=[s.menu[index%8],s.menu[6],s.menu[7]];
  const units=items.map((m,j)=>({id:`demo-unit-${index}-${j}`,menuId:m.id,name:m.name,category:m.category,price:m.price,note:'',status,paid:j<paidCount,...(status==='cooking'?{cookingAt:createdAt}:{}),...(['ready','delivered'].includes(status)?{readyAt:at(minutes-2)}:{}),...(status==='delivered'?{deliveredAt:at(minutes-4)}:{})}));
  s.orders.push({id:orderId,tabId,token:`demo-guest-${index}`,slug:`DEMO-${String(index+1).padStart(3,'0')}`,createdAt,status:'accepted',acceptedAt:createdAt,acceptedBy:'Staf Demo',autoAcceptAt:createdAt,units});
  if(paidCount){const paymentId=`demo-payment-${index}`,method=s.settings.paymentMethods[index%2];units.filter(u=>u.paid).forEach(u=>u.paymentId=paymentId);s.payments.push({id:paymentId,orderId,tabId,unitIds:units.filter(u=>u.paid).map(u=>u.id),amount:units.filter(u=>u.paid).reduce((n,u)=>n+u.price,0),method:method.name,methodId:method.id,at:at(closed?minutes-10:30+index),actor:'Staf Demo'});}
 };
 ['Alya · Meja 1','Bima · Meja 2','Citra · Meja 3','Danu · Meja 4','Elin · Meja 5','Fajar · Meja 6','Gita · Meja 7'].forEach((name,i)=>add(name,i,i<3?'cooking':'ready',10+i*2));
 ['Hana','Ilham','Jihan','Karin','Luthfi'].forEach((name,i)=>add(name,7+i,'delivered',(i+2)*1440,i<3?1:0));
 ['Maya','Nanda','Oki','Putri','Rafi','Salsa'].forEach((name,i)=>add(name,12+i,'delivered',i<3?60+i*20:1440*(i-1),3,true));
 const expenses=[['Bahan baku',185000,'Pasar Pagi Demo','Sayuran dan bahan segar',90],['Kemasan',45000,'Kemasan Demo','Kotak dan kantong pesanan',120],['Lain-lain',60000,'Utilitas Demo','Biaya air dan listrik',180],['Bahan baku',240000,'Supplier Demo','Stok daging dan susu',1500],['Peralatan',125000,'Toko Demo','Penggantian spatula dapur',2880],['Gaji',350000,'Tim Demo','Upah shift harian',4320]];
 s.expenses=expenses.map(([category,amount,party,note,minutes],i)=>({id:`demo-expense-${i}`,requestId:`demo-expense-request-${i}`,at:at(minutes),createdAt:at(minutes),amount,category,categoryId:s.settings.expenseCategories.find(c=>c.name===category).id,method:s.settings.paymentMethods[i%2].name,methodId:s.settings.paymentMethods[i%2].id,party,note,reference:`DEMO-EXP-${i+1}`,actor:'Staf Demo'}));
 return s;
}

