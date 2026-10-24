// Isolated QA fixture. Never changes the default application database.
import {openStore,id,passwordHash,placeOrder,operate} from '../server/store.js';
const store=openStore('data/qa.sqlite');
store.transaction(s=>{
 if(s.users.length)return;
 for(const [username,name,role] of [['qa_manager','Manajer Uji','manager'],['qa_waiter','Garson Uji','waiter'],['qa_kitchen','Dapur Uji','kitchen']])s.users.push({id:id(),username,name,role,password:passwordHash('resto-test-only')});
 const chef=s.users.find(u=>u.role==='kitchen'),waiter=s.users.find(u=>u.role==='waiter');
 for(const [name,menuId,qty,minutes] of [['Nadia','m1',2,23],['Bima & keluarga','m2',3,14],['Putri','m6',2,7]]){
  placeOrder(s,{name,requestId:id(),items:[{menuId,qty,price:s.menu.find(m=>m.id===menuId).price}]},waiter,null,Date.now()-minutes*60000);
  const o=s.orders.at(-1);operate(s,{action:'accept',orderId:o.id},chef);operate(s,{action:'cook',orderId:o.id},chef);
  if(name==='Nadia')operate(s,{action:'ready',orderId:o.id,unitIds:[o.units[0].id]},chef);
 }
});store.close();console.log('QA fixture ready: data/qa.sqlite (separate from application data)');
