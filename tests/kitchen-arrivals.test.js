import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenArrivals } from '../shared/kitchen-alerts.js';

test('instant acceptance still alerts the kitchen, while status changes and finished history do not',()=>{
  const queued={id:'new',status:'accepted',units:[{status:'accepted'}]};
  const finished={id:'old',status:'accepted',units:[{status:'delivered'}]};
  assert.deepEqual(kitchenArrivals([queued,finished],null),['new']);
  assert.deepEqual(kitchenArrivals([queued],new Set()),['new']);
  assert.deepEqual(kitchenArrivals([{...queued,units:[{status:'cooking'}]}],new Set(['new'])),[]);
  assert.deepEqual(kitchenArrivals([finished],new Set()),[]);
});
