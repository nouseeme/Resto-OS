import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenArrivals } from '../shared/kitchen-alerts.js';

test('kitchen alerts on incoming portal and waiter orders, never acceptance transitions', () => {
  const order = (id, status = 'waiting', source = 'Portal') => ({ id, status, source, units: [{ status }] });
  const portal = order('portal');
  assert.deepEqual(kitchenArrivals([portal], null), ['portal']);
  const seen = new Set(['portal']);
  portal.status = 'accepted'; portal.units[0].status = 'cooking';
  assert.deepEqual(kitchenArrivals([portal], seen), []);
  assert.deepEqual(kitchenArrivals([portal, order('waiter', 'waiting', 'Garson')], seen), ['waiter']);
  assert.deepEqual(kitchenArrivals([portal, order('fast', 'cooking')], seen), ['fast']);
  assert.deepEqual(kitchenArrivals([portal, order('cancelled', 'cancelled')], seen), []);
  assert.deepEqual(kitchenArrivals([portal], null), []);
});
