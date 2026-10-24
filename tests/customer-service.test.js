import test from 'node:test';
import ExcelJS from 'exceljs';
import assert from 'node:assert/strict';
import { initialState, operate, placeOrder, openStore } from '../server/store.js';
import { guestTab, serviceCustomers, OLD_DEBT_MS } from '../shared/customer-service.js';
import { encodeState, decodeState } from '../server/cloud-store.js';
import { reportWorkbook } from '../server/reports.js';

const at = Date.parse('2026-10-24T12:00:00Z');
const actor = { id: 'staff', role: 'waiter', name: 'Garson' };
function fixture() {
  const s = initialState();
  s.menu.push({ id: 'menu', name: 'Nasi', category: 'Utama', available: true, price: 100 });
  const order = (name, token, time) => placeOrder(s, { name, sessionTabId: null, requestId: crypto.randomUUID(), items: [{ menuId: 'menu', price: 100, qty: 2 }] }, null, token, time);
  const old = order('Rizka lama', 'browser-old', at - OLD_DEBT_MS - 1);
  const recent = order('Rizka portal', 'browser-new', at);
  const other = order('Pelanggan lain', 'browser-other', at);
  return { s, old: structuredClone(old), recent: structuredClone(recent), other: structuredClone(other) };
}

test('five-hour grouping is per order, strict, independent of kitchen status, with partial payments', () => {
  const { s, old, recent } = fixture();
  const oldOrder = s.orders.find(o => o.id === old.orderId);
  assert.equal(serviceCustomers(s, at).find(row => row.tab.id === old.tabId).group, 'old');
  oldOrder.units[0].paid = true;
  s.orders.find(o => o.id === recent.orderId).tabId = old.tabId;
  let row = serviceCustomers(s, at).find(row => row.tab.id === old.tabId);
  assert.equal(row.old.length, 1); assert.equal(row.active.length, 1);
  assert.equal(row.oldDue, 100); assert.equal(row.totalDue, 300); assert.equal(row.group, 'active');
  row = serviceCustomers(s, at - 1).find(row => row.tab.id === old.tabId);
  assert.equal(row.old.length, 0); assert.equal(row.active.length, 2);
  oldOrder.units.forEach(u => { u.paid = true; });
  row = serviceCustomers(s, at).find(row => row.tab.id === old.tabId);
  assert.equal(row.old.length, 0); assert.equal(row.active.length, 2);
  oldOrder.units.forEach(u => { u.status = 'delivered'; });
  row = serviceCustomers(s, at).find(row => row.tab.id === old.tabId);
  assert.equal(row.active.length, 1);
});

test('merge preserves orders, payments, both portal owners, redirects, retries, and future submissions', () => {
  const { s, old, recent, other } = fixture();
  const oldOrder = s.orders.find(o => o.id === old.orderId);
  const original = structuredClone(oldOrder);
  s.payments.push({ id: 'payment', tabId: old.tabId, orderId: old.orderId, amount: 100 });
  const body = { action: 'merge', tabIds: [old.tabId, recent.tabId], targetTabId: recent.tabId };
  operate(s, body, actor); operate(s, body, actor);
  assert.deepEqual(oldOrder, { ...original, tabId: recent.tabId });
  assert.equal(s.payments[0].tabId, recent.tabId);
  assert.equal(guestTab(s.tabs, 'browser-old').id, recent.tabId);
  assert.equal(guestTab(s.tabs, 'browser-new').id, recent.tabId);
  assert.equal(guestTab(s.tabs, 'browser-other').id, other.tabId);
  assert.equal(serviceCustomers(s, at).length, 2);
  assert.equal(serviceCustomers(s, at).find(row => row.tab.id === recent.tabId).totalDue, 400);
  assert.equal(serviceCustomers(s, at).find(row => row.tab.id === recent.tabId).group, 'active');
  assert.ok(Object.values(s.requests).every(request => request.tabId !== old.tabId));
  const submitted = placeOrder(s, { sessionTabId: recent.tabId, requestId: crypto.randomUUID(), items: [{ menuId: 'menu', price: 100, qty: 1 }] }, null, 'browser-old', at + 1000);
  assert.equal(submitted.tabId, recent.tabId);
  operate(s, { action: 'rename', tabId: recent.tabId, name: 'Rizka' }, actor);
  assert.equal(guestTab(s.tabs, 'browser-old').name, 'Rizka');
  // A second merge may form a chain; both original portal cookies follow it.
  operate(s, { action: 'merge', tabIds: [recent.tabId, other.tabId], targetTabId: other.tabId }, actor);
  assert.equal(guestTab(s.tabs, 'browser-old').id, other.tabId);
  assert.equal(guestTab(s.tabs, 'browser-new').id, other.tabId);
  for (const state of [decodeState(encodeState(s)), s]) assert.equal(guestTab(state.tabs, 'browser-old').id, other.tabId);
  const store = openStore(':memory:');
  try { store.transaction(state => Object.assign(state, s)); assert.equal(guestTab(store.read().tabs, 'browser-new').id, other.tabId); } finally { store.close(); }
});

test('merge rejects unauthorized, stale and invalid selections without mutation', () => {
  const { s, old, recent } = fixture();
  const body = { action: 'merge', tabIds: [old.tabId, recent.tabId], targetTabId: recent.tabId };
  const before = structuredClone(s);
  for (const role of ['manager', 'kitchen']) assert.throws(() => operate(s, body, { ...actor, role }), { status: 403 });
  for (const change of [{ targetTabId: 'missing' }, { tabIds: [old.tabId, old.tabId] }, { tabIds: [old.tabId, 'missing'] }]) assert.throws(() => operate(s, { ...body, ...change }, actor));
  assert.deepEqual(s, before);
  s.tabs.find(t => t.id === old.tabId).closedAt = new Date(at).toISOString();
  assert.throws(() => operate(s, body, actor), { status: 409 });
});

test('settled merged transactions close normally and each portal can start a new transaction', () => {
  const { s, old, recent } = fixture();
  operate(s, { action: 'merge', tabIds: [old.tabId, recent.tabId], targetTabId: recent.tabId }, actor);
  for (const order of s.orders.filter(o => o.tabId === recent.tabId)) {
    order.units.forEach(u => { u.status = 'delivered'; });
    operate(s, { action: 'pay', orderId: order.id, methodId: 'method-0' }, actor);
  }
  assert.ok(guestTab(s.tabs, 'browser-old').closedAt);
  const next = placeOrder(s, { name: 'Rizka', sessionTabId: null, requestId: crypto.randomUUID(), items: [{ menuId: 'menu', price: 100, qty: 1 }] }, null, 'browser-old', at + 2000);
  assert.notEqual(next.tabId, recent.tabId);
  assert.equal(guestTab(s.tabs, 'browser-old').id, next.tabId);
  assert.equal(guestTab(s.tabs, 'browser-new').id, recent.tabId);
});

test('reports omit merged ownership aliases and retain the earliest opening timestamp', async () => {
  const { s, old, recent } = fixture();
  const earliest = s.tabs.find(t => t.id === old.tabId).createdAt;
  operate(s, { action: 'merge', tabIds: [old.tabId, recent.tabId], targetTabId: recent.tabId }, actor);
  assert.equal(s.tabs.find(t => t.id === recent.tabId).createdAt, earliest);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await reportWorkbook(s, { end: new Date(at + 1000), snapshot: new Date(at + 1000) }));
  assert.equal(book.getWorksheet('Data Transaksi').rowCount, 3);
  assert.ok(!book.getWorksheet('Data Transaksi').getColumn(1).values.includes(old.tabId));
});
