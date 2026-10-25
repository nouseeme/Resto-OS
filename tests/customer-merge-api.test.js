import test from 'node:test';
import assert from 'node:assert/strict';

test('HTTP: merging removes duplicates and synchronizes both portals without exposing other customers', async () => {
  process.env.RESTO_DB = ':memory:';
  const { app } = await import('../server/app.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const client = () => {
    const cookies = new Map();
    return async (route, body) => {
      const res = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      for (const cookie of res.headers.getSetCookie()) { const [key, value] = cookie.split(';')[0].split('='); cookies.set(key, value); }
      return { status: res.status, data: await res.json() };
    };
  };
  const staff = client(), first = client(), second = client(), stranger = client();
  try {
    await staff('setup', { password: 'test-password-12345' });
    await staff('login', { username: 'admin', password: 'test-password-12345' });
    await staff('workspace', { role: 'manager' });
    assert.equal((await staff('action', { action: 'menuSave', menuId: 'menu-test', name: 'Nasi', price: 100, available: true })).status, 200);
    const order = (name, sessionTabId = null) => ({ name, sessionTabId, requestId: crypto.randomUUID(), items: [{ menuId: 'menu-test', price: 100, qty: 1 }] });
    const originalRequest = order('Rizka lama');
    const a = await first('orders', originalRequest);
    assert.equal((await first('orders', originalRequest)).data.orderId, a.data.orderId);
    const b = await second('orders', order('Rizka portal'));
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    const body = { action: 'merge', tabIds: [a.data.tabId, b.data.tabId], targetTabId: b.data.tabId };
    assert.equal((await stranger('action', body)).status, 401);
    assert.equal((await staff('action', body)).status, 403);
    await staff('workspace', { role: 'waiter' });
    assert.equal((await staff('action', body)).status, 200);
    let state = (await staff('state')).data;
    assert.equal(state.tabs.length, 1); assert.equal(state.orders.length, 2);
    for (const guest of [first, second]) {
      state = (await guest('state')).data;
      assert.equal(state.tabs.length, 0); assert.equal(state.portalSession.tabId, b.data.tabId);
      assert.equal(state.portalSession.key, guest === first ? a.data.tabId : b.data.tabId);
      assert.equal(state.portalSession.name, 'Rizka portal');
      assert.equal(state.orders.length, 0);
    }
    state = (await stranger('state')).data; assert.equal(state.orders.length, 0); assert.equal(state.tabs.length, 0);
    const next = await first('orders', order('Ignored old name', a.data.tabId)); assert.equal(next.data.tabId, b.data.tabId);
    await staff('action', { action: 'rename', tabId: b.data.tabId, name: 'Rizka' });
    state = (await second('state')).data; assert.equal(state.portalSession.name, 'Rizka'); assert.equal(state.orders.length, 0); state = (await staff('state')).data; assert.equal(state.orders.length,3);
    const beforeDue = state.orders.flatMap(order => order.units).reduce((sum, unit) => sum + (!unit.paid ? unit.price : 0), 0);
    assert.equal(beforeDue, 300);
    assert.equal((await staff('action', { action: 'pay', orderId: a.data.orderId, methodId: 'method-0' })).status, 200);
    state = (await staff('state')).data;
    assert.equal(state.orders.flatMap(order => order.units).filter(unit => !unit.paid).length, 2);
    // Paying in full does not end a session while delivery is unfinished.
    const orderIds = state.orders.map(order => order.id);
    for (const orderId of orderIds.slice(1)) assert.equal((await staff('action', { action: 'pay', orderId, methodId: 'method-0' })).status, 200);
    assert.equal((await first('state')).data.portalSession.status, 'active');
    await staff('workspace', { role: 'kitchen' });
    for (const orderId of orderIds) {
      assert.equal((await staff('action', { action: 'ready', orderId })).status, 200);
    }
    await staff('workspace', { role: 'waiter' });
    for (const orderId of orderIds.slice(0, -1)) await staff('action', { action: 'deliver', orderId });
    assert.equal((await second('state')).data.portalSession.status, 'active');
    await staff('action', { action: 'deliver', orderId: orderIds.at(-1) });
    for (const guest of [first, second]) {
      state = (await guest('state')).data;
      assert.equal(state.portalSession.status, 'closed');
      assert.equal(state.portalSession.tabId, null);
      assert.equal(state.tabs.length, 0); assert.equal(state.orders.length, 0);
      assert.equal((await guest('orders', order('Stale client', b.data.tabId))).status, 409);
    }
    const fresh = await first('orders', order('New session'));
    assert.equal(fresh.status, 200); assert.notEqual(fresh.data.tabId, b.data.tabId);
    assert.equal((await first('orders', originalRequest)).status, 409);
    assert.equal((await first('orders', order('Old tab', b.data.tabId))).status, 409);
    state = (await first('state')).data;
    assert.equal(state.tabs.length, 0); assert.equal(state.orders.length, 0);
    assert.equal(state.portalSession.name, 'New session');
    assert.equal((await second('state')).data.portalSession.status, 'closed');
    // The other ordering works too: delivered first, final payment closes it.
    await staff('workspace', { role: 'kitchen' });
    await staff('action', { action: 'ready', orderId: fresh.data.orderId });
    await staff('workspace', { role: 'waiter' });
    await staff('action', { action: 'deliver', orderId: fresh.data.orderId });
    assert.equal((await first('state')).data.portalSession.status, 'active');
    await staff('action', { action: 'pay', orderId: fresh.data.orderId, methodId: 'method-0' });
    assert.equal((await first('state')).data.portalSession.status, 'closed');
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
