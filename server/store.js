import { languageCode } from '../shared/menu-languages.js';
import { isCurrency, formatMoney } from '../shared/currency.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const normalize = n => String(n ?? '').trim().replace(/\s+/g, ' ');
export const key = n => normalize(n).toLocaleLowerCase('id');
const luminance = hex => {
  const values = hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return values[0]*.2126+values[1]*.7152+values[2]*.0722;
};
const readableBrand = hex => (luminance('#ece7dc')+.05)/(luminance(hex)+.05)>=4.5;
export function fail(message, code = 400) { throw Object.assign(new Error(message), { status: code }); }
export const assert = (condition, message, code) => { if (!condition) fail(message, code); };

export function initialState() {
  return {
    settings: { name: 'Restoran Anda', tagline: '', primary: '#a43c2d', accent: '#405644', logo: '', paused: false, autoAcceptSeconds: 15, currency: 'IDR' },
    menu: [],
    tabs: [], orders: [], payments: [], audit: [], bans: {}, requests: {}, users: [], sessions: []
  };
}

export const orderUnits = (s, orderId) => s.orders.find(o => o.id === orderId)?.units ?? [];
export const tabOrders = (s, tabId) => s.orders.filter(o => o.tabId === tabId);
export const due = units => units.reduce((n, u) => n + (!u.paid && u.status !== 'cancelled' ? u.price : 0), 0);
export const tabDue = (s, t) => due(tabOrders(s, t.id).flatMap(o => o.units));
export function audit(s, actor, action, detail) { s.audit.push({ id: id(), at: now(), actor: actor?.name ?? 'Pelanggan', action, detail }); }
export function closeTabs(s) {
  for (const t of s.tabs.filter(t => !t.closedAt)) {
    const units = tabOrders(s, t.id).flatMap(o => o.units);
    if (units.length && units.every(u => u.status === 'cancelled' || (u.paid && u.status === 'delivered'))) {
      t.closedAt = now(); audit(s, { name: 'Sistem' }, 'tab_closed', t.id);
    }
  }
}
export function tick(s, time = Date.now()) {
  for (const o of s.orders) if (o.status === 'waiting' && time >= Date.parse(o.autoAcceptAt)) {
    o.status = 'accepted'; o.acceptedAt = new Date(time).toISOString(); o.acceptedBy = 'Otomatis';
    o.units.filter(u => u.status === 'waiting').forEach(u => u.status = 'cooking');
    audit(s, { name: 'Sistem' }, 'auto_accept', o.id);
  }
}
export function placeOrder(s, body, actor, token, time = Date.now()) {
  const requestKey = `${actor ? actor.id : token}:${body.requestId}`;
  assert(typeof body.requestId === 'string' && body.requestId.length >= 16 && body.requestId.length <= 100, 'Identitas kiriman tidak valid.');
  if (s.requests[requestKey]) return s.requests[requestKey];
  assert(!s.settings.paused, 'Pemesanan sedang dijeda dapur. Keranjang tetap tersimpan.', 409);
  if (!actor) {
    const ban = s.bans[token];
    assert(!ban || ban.until <= time, 'Pemesanan Anda dibatasi sementara. Silakan minta bantuan garson.', 429);
    const recent = s.orders.filter(o => o.token === token && !ban?.resetOrderIds?.includes(o.id) && time - Date.parse(o.createdAt) < 60000);
    if (recent.length >= 4) {
      const strikes = (ban?.strikes ?? 0) + 1;
      s.bans[token] = { strikes, until: time + Math.min(60, 15 * 2 ** (strikes - 1)) * 60000, resetOrderIds: ban?.resetOrderIds ?? [] };
      audit(s, null, 'ban', token);
      return { error: 'Terlalu banyak order. Pemesanan dibatasi 15–60 menit. Minta bantuan garson.', status: 429 };
    }
  }
  assert(Array.isArray(body.items) && body.items.length > 0 && body.items.length <= 30, 'Pilih setidaknya satu menu.');
  let totalUnits = 0;
  const units = body.items.flatMap(i => {
    const m = s.menu.find(m => m.id === i.menuId);
    assert(m?.available, `${m?.name ?? 'Menu'} sedang tidak tersedia. Tinjau keranjang Anda.`, 409);
    assert(i.price === m.price, `Harga ${m.name} berubah menjadi ${formatMoney(m.price, s.settings.currency)}. Tinjau keranjang.`, 409);
    assert(Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 30, 'Jumlah menu harus 1–30.');
    totalUnits += i.qty;
    assert(totalUnits <= 100, 'Maksimal 100 porsi per kiriman.');
    return Array.from({ length: i.qty }, () => ({ id: id(), menuId: m.id, name: m.name, price: m.price, note: String(i.note ?? '').slice(0, 200), status: 'waiting', paid: false }));
  });
  let tab = actor && body.tabId ? s.tabs.find(t => t.id === body.tabId && !t.closedAt) : !actor ? s.tabs.find(t => t.token === token && !t.closedAt) : null;
  if (actor && body.tabId) assert(tab, 'Transaksi sudah selesai. Cari pelanggan atau buat transaksi baru.', 409);
  if (!tab) {
    const name = normalize(body.name);
    assert(name.length >= 2 && name.length <= 60, 'Nama harus 2–60 karakter.');
    assert(!s.tabs.some(t => !t.closedAt && key(t.name) === key(name)), 'Nama ini sedang dipakai. Tambahkan pembeda, misalnya “Rizki 2”.', 409);
    tab = { id: id(), name, token: actor ? null : token, createdAt: new Date(time).toISOString(), closedAt: null };
    s.tabs.push(tab);
  }
  const slugName = tab.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-');
  const order = { id: id(), tabId: tab.id, slug: `${slugName}-${tab.id.slice(0, 8)}-${tabOrders(s, tab.id).length + 1}`, createdAt: new Date(time).toISOString(), autoAcceptAt: new Date(time + s.settings.autoAcceptSeconds * 1000).toISOString(), token: actor ? null : token, source: actor ? 'Garson' : 'Portal', status: 'waiting', units };
  s.orders.push(order);
  const result = { orderId: order.id, tabId: tab.id };
  s.requests[requestKey] = result; audit(s, actor, 'order_created', order.slug);
  return result;
}

export function operate(s, body, actor) {
  const { action } = body;
  const allowed = { rename: ['waiter'], pay: ['waiter'], deliver: ['waiter'], accept: ['kitchen'], ready: ['kitchen'], cancel: ['kitchen','waiter'], unban: ['waiter'], pause: ['kitchen','manager'], menuToggle: ['waiter','kitchen','manager'], menuSave: ['manager'], menuDelete: ['manager'], settings: ['manager'] };
  assert(allowed[action]?.includes(actor.role), 'Peran Anda tidak dapat melakukan tindakan ini.', 403);
  if (action === 'rename') {
    const t = s.tabs.find(t => t.id === body.tabId && !t.closedAt); assert(t, 'Transaksi tidak aktif.', 409);
    const name = normalize(body.name); assert(name.length >= 2 && name.length <= 60, 'Nama harus 2–60 karakter.');
    assert(!s.tabs.some(x => x.id !== t.id && !x.closedAt && key(x.name) === key(name)), 'Nama sedang dipakai transaksi aktif lain.', 409);
    t.name = name;
  } else if (action === 'unban') {
    const t = s.tabs.find(t => t.id === body.tabId); const token = t?.token ?? body.token;
    assert(token && s.bans[token], 'Blokir tidak ditemukan.'); s.bans[token].until = 0;
    s.bans[token].resetOrderIds = s.orders.filter(o=>o.token===token&&Date.now()-Date.parse(o.createdAt)<60000).map(o=>o.id);
  } else if (action === 'pause') s.settings.paused = Boolean(body.paused);
  else if (action === 'menuToggle') {
    const m = s.menu.find(m => m.id === body.menuId); assert(m, 'Menu tidak ditemukan.'); m.available = Boolean(body.available);
  } else if (action === 'menuDelete') {
    const index=s.menu.findIndex(m=>m.id===body.menuId);
    assert(index>=0, 'Menu tidak ditemukan.',404);
    s.menu.splice(index,1);
  } else if (action === 'menuSave') {
    const m = s.menu.find(m => m.id === body.menuId) ?? { id: body.menuId ?? id(), available: true, photo: '' };
    assert(normalize(body.name).length >= 2 && normalize(body.name).length <= 100, 'Nama menu harus 2–100 karakter.');
    assert(Number.isSafeInteger(body.price) && body.price > 0 && body.price <= 10000000, 'Harga harus angka bulat positif, maksimal 10.000.000 dalam mata uang dasar.');
    let translations=m.descriptionTranslations ?? {};
    if(Object.hasOwn(body,'descriptionTranslations')){
      assert(body.descriptionTranslations && typeof body.descriptionTranslations==='object' && !Array.isArray(body.descriptionTranslations),'Deskripsi bahasa tidak valid.');
      translations={};
      for(const [raw,text] of Object.entries(body.descriptionTranslations)){
        const code=languageCode(raw);
        assert(code && code!=='id','Kode bahasa tidak valid. Gunakan Deskripsi utama untuk ID.');
        assert(!Object.hasOwn(translations,code),'Kode bahasa ganda.');
        assert(typeof text==='string' && text.length<=300,'Deskripsi bahasa maksimal 300 karakter.');
        translations[code]=text.trim();
      }
    }
    Object.assign(m, { descriptionTranslations:translations, name: normalize(body.name), price: body.price, category: normalize(body.category).slice(0, 40) || 'Lainnya', description: String(body.description ?? '').slice(0, 300) });
    if (Object.hasOwn(body,'available')) m.available=Boolean(body.available);
    if (Object.hasOwn(body,'photo')) m.photo=body.photo;
    if (!s.menu.some(x => x.id === m.id)) s.menu.push(m);
  } else if (action === 'settings') {
    const currency = body.currency ?? s.settings.currency ?? 'IDR';
    assert(isCurrency(currency), 'Pilih mata uang dasar yang valid.');
    assert(normalize(body.name).length >= 2 && normalize(body.name).length <= 60, 'Nama restoran harus 2–60 karakter.');
    assert(/^#[0-9a-f]{6}$/i.test(body.primary) && /^#[0-9a-f]{6}$/i.test(body.accent), 'Warna tidak valid.');
    assert(readableBrand(body.primary) && readableBrand(body.accent), 'Pilih warna utama dan aksen yang lebih gelap agar teks tetap terbaca (kontras minimal 4,5:1).');
    const validLogo = !body.logo || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(body.logo);
    assert(validLogo && (body.logo?.length ?? 0) < 700000, 'Logo harus PNG, JPG, atau WebP di bawah 500 KB.');
    Object.assign(s.settings, { currency, name: normalize(body.name), tagline: String(body.tagline ?? '').slice(0, 120), primary: body.primary, accent: body.accent, logo: body.logo ?? '' });
  } else {
    const o = s.orders.find(o => o.id === body.orderId); assert(o, 'Order tidak ditemukan.', 404);
    const units = body.unitIds ? o.units.filter(u => body.unitIds.includes(u.id)) : o.units;
    assert(units.length && (!body.unitIds || units.length === new Set(body.unitIds).size), 'Pilih unit yang valid.');
    if (action === 'accept') {
      assert(o.status === 'waiting', 'Order sudah diterima atau dibatalkan.', 409);
      o.status = 'accepted'; o.acceptedAt = now(); o.acceptedBy = actor.name;
      o.units.filter(u => u.status === 'waiting').forEach(u => u.status = 'cooking');
    } else if (action === 'pay') {
      assert(['Tunai','QRIS','Transfer','Kartu'].includes(body.method), 'Pilih metode pembayaran.');
      const selected = units.filter(u => !u.paid && u.status !== 'cancelled');
      assert(selected.length && (!body.unitIds || selected.length === units.length), 'Unit sudah dibayar atau dibatalkan. Muat data terbaru.', 409);
      const payment = { id: id(), orderId: o.id, tabId: o.tabId, unitIds: selected.map(u => u.id), amount: selected.reduce((n,u) => n+u.price,0), method: body.method, at: now(), actor: actor.name };
      s.payments.push(payment); selected.forEach(u => { u.paid = true; u.paymentId = payment.id; });
    } else {
      const from = { ready: ['accepted','cooking'], deliver: ['ready'], cancel: ['waiting','accepted','cooking','ready'] }[action];
      assert(units.every(u => from.includes(u.status)), 'Status sudah berubah. Muat data terbaru sebelum melanjutkan.', 409);
      if (action === 'cancel') {
        assert(normalize(body.reason).length >= 3, 'Tuliskan alasan pembatalan (minimal 3 karakter).');
        assert(units.every(u => !u.paid), 'Unit sudah dibayar. Pembatalan ditahan sampai kebijakan koreksi/refund tersedia.', 409);
      }
      units.forEach(u => { u.status = { cook: 'cooking', ready: 'ready', deliver: 'delivered', cancel: 'cancelled' }[action]; u[`${u.status}At`] = now(); if(action === 'cancel') u.reason = normalize(body.reason).slice(0,200); });
      if (o.units.every(u => u.status === 'cancelled')) o.status = 'cancelled';
    }
  }
  audit(s, actor, action, JSON.stringify({ ...body, logo: undefined })); closeTabs(s);
  return { ok: true };
}

export function openStore(filename) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS app (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');
  if (!db.prepare('SELECT id FROM app').get()) db.prepare('INSERT INTO app VALUES (1,?)').run(JSON.stringify(initialState()));
  return {
    read: () => JSON.parse(db.prepare('SELECT body FROM app WHERE id=1').get().body),
    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const s = this.read(); const result = fn(s); db.prepare('UPDATE app SET body=? WHERE id=1').run(JSON.stringify(s)); db.exec('COMMIT'); return result; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    }, close: () => db.close()
  };
}
export function passwordHash(password, salt = randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function passwordMatches(password, hash) { const [salt] = hash.split(':'); return timingSafeEqual(Buffer.from(passwordHash(password, salt)), Buffer.from(hash)); }
