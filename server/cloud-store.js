import { supabase } from './supabase.js';

const arrays = ['menu','tabs','payments','users','audit'];
export function encodeState(s) {
  const rows = { settings: [{ ...s.settings, id: 'restaurant' }] };
  for (const name of arrays) rows[name] = s[name];
  rows.orders = s.orders.map(({ units, ...o }) => o);
  rows.portions = s.orders.flatMap(o => o.units.map(u => ({ ...u, orderId: o.id })));
  rows.sessions = s.sessions.map(x => ({ ...x, id: x.token }));
  for (const [table, source] of [['bans','bans'],['requests','requests'],['login_attempts','loginAttempts']]) {
    rows[table] = Object.entries(s[source] ?? {}).map(([id, value]) => ({ id, value }));
  }
  return rows;
}
export function decodeState(rows) {
  const s = { settings: rows.settings[0] ? { ...rows.settings[0] } : null };
  if (s.settings) delete s.settings.id;
  for (const name of arrays) s[name] = rows[name];
  s.orders = rows.orders.map(o => ({ ...o, units: rows.portions.filter(u => u.orderId === o.id).map(({ orderId, ...u }) => u) }));
  s.sessions = rows.sessions.map(({ id, ...x }) => x);
  for (const [table, target] of [['bans','bans'],['requests','requests'],['login_attempts','loginAttempts']]) s[target] = Object.fromEntries(rows[table].map(x => [x.id,x.value]));
  return s;
}
export function stateChanges(before, after) {
  const changes = {};
  for (const [table, rows] of Object.entries(after)) {
    const old = new Map((before[table] ?? []).map((body, position) => [body.id, { position, body }]));
    const upsert = [];
    rows.forEach((body, position) => {
      const previous = old.get(body.id);
      if (!previous || previous.position !== position || JSON.stringify(previous.body) !== JSON.stringify(body)) upsert.push({ key: body.id, position, body });
      old.delete(body.id);
    });
    if (upsert.length || old.size) changes[table] = { upsert, delete: [...old.keys()] };
  }
  return changes;
}
export function openCloudStore(client = supabase()) {
  async function snapshot() {
    const { data, error } = await client.rpc('resto_snapshot');
    if (error) throw error;
    return data;
  }
  return {
    async read() { return decodeState((await snapshot()).rows); },
    async transaction(fn) {
      // Retry the domain operation against fresh state, never replay stale writes.
      for (let attempt = 0; attempt < 6; attempt++) {
        const snap = await snapshot();
        const s = decodeState(snap.rows);
        const before = structuredClone(encodeState(s));
        const result = fn(s);
        if (result instanceof Promise) throw new Error('Transaction callbacks must be synchronous.');
        const changes = stateChanges(before, encodeState(s));
        if (!Object.keys(changes).length) return result;
        const { data, error } = await client.rpc('resto_commit', { expected_version: snap.version, changes });
        if (error) {
          if (error.code === '23505') throw Object.assign(new Error('Data sudah berubah atau nama sudah digunakan. Muat ulang dan coba lagi.'), {status:409});
          throw error;
        }
        if (data) return result;
      }
      throw Object.assign(new Error('Ada perubahan bersamaan. Silakan coba lagi.'), {status:409});
    },
    close() {}
  };
}
