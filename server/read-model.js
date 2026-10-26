import { guestSession } from '../shared/customer-service.js';

export function readScope(actor, page) {
  if (!actor) return 'portal';
  if (actor.role !== 'manager') return actor.role;
  return ['overview','history','finance','menu','settings'].includes(page) ? `manager-${page}` : 'manager';
}

// The local adapter follows the same selection rules as the server-only SQL view.
export function selectReadState(state, { scope, guest, start = null }) {
  const s = structuredClone(state);
  s.setupRequired = !state.users.length;
  const manager = scope.startsWith('manager');
  const all = scope === 'manager';
  const session = guestSession(s.tabs, guest);
  const portalSession = session ? { status: session.status, key: session.key, tabId: session.status === 'active' ? session.tab.id : null, name: session.status === 'active' ? session.tab.name : null } : { status: 'new', key: null, tabId: null, name: null };
  const activeIds = new Set(s.tabs.filter(t => !t.closedAt && !t.mergedInto).map(t => t.id));
  if (scope === 'portal') s.orders = [];
  else if (scope === 'kitchen') s.orders = s.orders.filter(o => o.units.some(u => ['waiting','accepted','cooking','ready'].includes(u.status)));
  else if (scope === 'waiter') s.orders = s.orders.filter(o => activeIds.has(o.tabId));
  else if (scope === 'manager-overview') s.orders = s.orders.filter(o => !start || Date.parse(o.createdAt) >= Date.parse(start) || activeIds.has(o.tabId));
  else if (!all && scope !== 'manager-history') s.orders = [];
  const orderTabs = new Set(s.orders.map(o => o.tabId));
  s.tabs = scope === 'portal' ? [] : s.tabs.filter(t => !t.mergedInto && (all || scope === 'manager-history' || scope === 'manager-finance' || orderTabs.has(t.id) || (scope === 'manager-overview' && activeIds.has(t.id)) || (scope === 'waiter' && activeIds.has(t.id))));
  s.payments = scope === 'waiter' ? s.payments.filter(p => activeIds.has(p.tabId)) : manager && (all || ['manager-overview','manager-finance','manager-history'].includes(scope)) ? s.payments.filter(p => scope !== 'manager-overview' || !start || Date.parse(p.at) >= Date.parse(start)) : [];
  s.expenses = manager && (all || ['manager-overview','manager-finance'].includes(scope)) ? s.expenses.filter(e => scope !== 'manager-overview' || !start || Date.parse(e.at) >= Date.parse(start)) : [];
  s.audit = all || scope === 'manager-settings' ? s.audit.slice().sort((a,b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).slice(-200) : [];
  s.users = all || scope === 'manager-settings' ? s.users : [];
  s.bans = scope === 'waiter' || all ? s.bans : {};
  s.sessions = []; s.requests = {}; s.loginAttempts = {};
  return { state: s, portalSession };
}

export function presentState(s, { actor, staff, portalSession, imagesEnabled, cloud }) {
  const { expenseCategories, paymentMethods, ...publicSettings } = s.settings;
  const features = { menuImageUpload: imagesEnabled, staffAuth: cloud ? 'supabase' : 'local' };
  const common = { features, setupRequired: !cloud && !staff && (s.setupRequired ?? !s.users.length), serverTime: new Date().toISOString() };
  if (staff && !actor) return { ...common, settings: publicSettings, actor: { id: staff.id, name: staff.name, username: staff.username, role: null }, roleRequired: true, menu: [], tabs: [], orders: [], payments: [], audit: [], users: [] };
  if (!actor) return { ...common, settings: publicSettings, menu: s.menu, actor: null, portalSession, tabs: [], orders: [], payments: [] };
  const { password, ...safeActor } = actor;
  const role = actor.role;
  return { ...common, setupRequired: false, settings: role === 'manager' ? s.settings : role === 'waiter' ? { ...publicSettings, paymentMethods } : publicSettings, menu: s.menu, actor: safeActor,
    tabs: s.tabs.filter(t => !t.mergedInto).map(({ token, ...t }) => role === 'waiter' ? { ...t, ban: s.bans[token] ?? null } : t),
    orders: s.orders.map(({ token, ...o }) => role === 'kitchen' ? { ...o, units: o.units.map(({ paid, paymentId, price, ...u }) => u) } : o),
    payments: role === 'kitchen' ? [] : s.payments, expenses: role === 'manager' ? s.expenses : [], audit: role === 'manager' ? s.audit.slice().reverse() : [], users: role === 'manager' ? s.users.map(({ password, ...u }) => u) : [] };
}
