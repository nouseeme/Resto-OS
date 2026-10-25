import test from 'node:test';
import assert from 'node:assert/strict';

test('version checks cannot hide login, role selection, switching, logout, or changed financial data',async()=>{
  process.env.RESTO_DB=':memory:';
  const {app}=await import('../server/app.js');
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/api/`;
  const jar=new Map();
  const call=async(route,body)=>{
    const r=await fetch(base+route,{method:body?'POST':'GET',headers:{cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    for(const cookie of r.headers.getSetCookie()){const [key,value]=cookie.split(';')[0].split('=');jar.set(key,value)}
    const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;
  };
  const versioned=v=>'state?view=overview&version='+encodeURIComponent(v);
  try{
    await call('setup',{password:'test-password-12345'});
    const guest=await call('state');assert.equal((await call(versioned(guest.version))).unchanged,true);
    await call('login',{username:'admin',password:'test-password-12345'});
    let s=await call(versioned(guest.version));assert.ok(s.actor);assert.equal(s.roleRequired,true);assert.notEqual(s.unchanged,true);
    await call('workspace',{role:'manager'});s=await call(versioned(s.version));assert.equal(s.actor.role,'manager');
    const before=s.version;
    await call('action',{action:'expense',requestId:crypto.randomUUID(),at:new Date(Date.now()-1000).toISOString(),amount:123,categoryId:'expense-0',methodId:'method-0',party:'Test supplier',note:'Integration test'});
    s=await call(versioned(before));assert.equal(s.expenses[0].amount,123);
    assert.equal((await call(versioned(s.version))).unchanged,true);
    await call('workspace',{role:'kitchen'});s=await call(versioned(s.version));assert.equal(s.actor.role,'kitchen');assert.deepEqual(s.expenses,[]);
    await call('logout',{});s=await call(versioned(s.version));assert.equal(s.actor,null);assert.deepEqual(s.orders,[]);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
