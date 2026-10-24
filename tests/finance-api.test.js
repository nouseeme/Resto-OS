import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

test('HTTP flow: manager records expenses, staff gets configured methods, export stays private',async()=>{
  process.env.RESTO_DB=':memory:';
  const {app}=await import('../server/app.js');
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/api/`;
  let cookie='';
  const call=async(path,body)=>{
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),cookie},body:body?JSON.stringify(body):undefined});
    const staffCookie=response.headers.getSetCookie().find(c=>c.startsWith('resto_staff='));if(staffCookie)cookie=staffCookie.split(';')[0];
    return response;
  };
  try{
    assert.equal((await call('reports')).status,403);
    assert.equal((await call('setup',{password:'test-password-12345'})).status,200);
    assert.equal((await call('login',{username:'admin',password:'test-password-12345'})).status,200);
    assert.equal((await call('workspace',{role:'manager'})).status,200);
    const expense={action:'expense',requestId:crypto.randomUUID(),at:new Date(Date.now()-60000).toISOString(),amount:25000,categoryId:'expense-0',methodId:'method-0',party:'Supplier test',note:'Bahan untuk tes'};
    assert.equal((await call('action',expense)).status,200);assert.equal((await call('action',expense)).status,200);
    let state=await(await call('state')).json();assert.equal(state.expenses.length,1);
    assert.equal((await call('action',{action:'financeOption',list:'paymentMethods',name:'Kartu'})).status,200);
    const report=await call('reports');assert.equal(report.status,200);assert.match(report.headers.get('content-disposition'),/attachment/);
    const w=new ExcelJS.Workbook();await w.xlsx.load(Buffer.from(await report.arrayBuffer()));assert.equal(w.getWorksheet('Data Pengeluaran').getCell('E2').value,25000);
    assert.equal((await call('workspace',{role:'waiter'})).status,200);
    state=await(await call('state')).json();assert.equal(state.expenses.length,0);assert.ok(state.settings.paymentMethods.some(m=>m.name==='Kartu'));
    assert.equal((await call('reports')).status,403);assert.equal((await call('action',{...expense,requestId:crypto.randomUUID()})).status,403);
    cookie='';state=await(await call('state')).json();assert.equal(state.settings.expenseCategories,undefined);assert.equal(state.settings.paymentMethods,undefined);assert.equal(state.expenses,undefined);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
