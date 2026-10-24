import test from 'node:test';
import assert from 'node:assert/strict';
import { popularMenu, kitchenDemand } from '../shared/metrics.js';

test('popular menu is ordered portions minus cancellations, regardless of payment',()=>{
  const units=[['m1','waiting',false],['m1','cooking',true],['m1','delivered',true],['m1','cancelled',false],['m2','ready',false]].map(([menuId,status,paid])=>({menuId,status,paid,name:menuId}));
  const result=popularMenu([{id:'m1',photo:'/one.jpg'},{id:'m2'}],[{units}]);
  assert.equal(result[0].quantity,3);assert.equal(result[0].photo,'/one.jpg');assert.equal(result[1].quantity,1);
  units.forEach(u=>u.paid=!u.paid);assert.deepEqual(popularMenu([{id:'m1',photo:'/one.jpg'},{id:'m2'}],[{units}]),result);
});
test('kitchen totals count all pending stages, excluding ready/delivered/cancelled',()=>{
  const units=['waiting','accepted','cooking','cooking','ready','delivered','cancelled'].map(status=>({menuId:'m1',name:'Ayam',status}));
  assert.deepEqual(kitchenDemand([{units}]),[{menuId:'m1',name:'Ayam',waiting:1,accepted:1,cooking:2,total:4}]);
  units[2].status='ready';assert.equal(kitchenDemand([{units}])[0].total,3);
});
