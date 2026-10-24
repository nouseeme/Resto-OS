export const OLD_DEBT_MS = 5 * 60 * 60 * 1000;
export const outstanding = order => order.units.reduce((sum, unit) => sum + (!unit.paid && unit.status !== 'cancelled' ? unit.price : 0), 0);
export const isOldDebt = (order, at = Date.now()) => outstanding(order) > 0 && at - Date.parse(order.createdAt) > OLD_DEBT_MS;
export const needsService = order => order.units.some(unit => !['delivered', 'cancelled'].includes(unit.status));

// Ownership stays on the original transaction. Only staff can create a redirect.
export function canonicalTab(tabs, tab) {
  const seen = new Set();
  while (tab?.mergedInto) {
    if (seen.has(tab.id)) return null;
    seen.add(tab.id);
    tab = tabs.find(candidate => candidate.id === tab.mergedInto);
  }
  return tab ?? null;
}

export function guestSession(tabs, token) {
  const own = tabs.filter(tab => tab.token === token).map(source => ({ key: source.id, tab: canonicalTab(tabs, source) })).filter(session => session.tab);
  const session = own.find(session => !session.tab.closedAt) ?? own.at(-1);
  return session ? { ...session, status: session.tab.closedAt ? 'closed' : 'active' } : null;
}

export const guestTab = (tabs, token) => guestSession(tabs, token)?.tab ?? null;

export function serviceCustomers(data, at = Date.now()) {
  return data.tabs.filter(tab => !tab.closedAt && !tab.mergedInto).map(tab => {
    const orders = data.orders.filter(order => order.tabId === tab.id);
    const old = orders.filter(order => isOldDebt(order, at));
    const active = orders.filter(order => !isOldDebt(order, at) && (outstanding(order) > 0 || needsService(order)));
    const hasRecent = orders.some(order => at - Date.parse(order.createdAt) <= OLD_DEBT_MS && order.units.some(unit => unit.status !== 'cancelled'));
    const oldDue = old.reduce((sum, order) => sum + outstanding(order), 0);
    return { tab, orders, old, active, oldDue, totalDue: orders.reduce((sum, order) => sum + outstanding(order), 0), group: !hasRecent && oldDue > 0 ? 'old' : 'active', latest: Math.max(...orders.map(order => Date.parse(order.createdAt)), Date.parse(tab.createdAt)) };
  });
}
