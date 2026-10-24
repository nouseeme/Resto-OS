import {initialState} from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { operate, placeOrder, id } from '../server/store.js';
import { formatMoney, isCurrency } from '../shared/currency.js';
const manager={id:'manager',name:'Manager',role:'manager'};
const settings=s=>({action:'settings',...s.settings});
test('base currency saves without converting menu or historical amounts and validates atomically',()=>{
 const s=initialState();
 placeOrder(s,{name:'Rizki',requestId:id(),items:[{menuId:'m6',qty:1,price:12000}]},null,'guest');
 const before=structuredClone({menu:s.menu,orders:s.orders});
 operate(s,{...settings(s),currency:'TRY'},manager);
 assert.equal(s.settings.currency,'TRY');assert.deepEqual({menu:s.menu,orders:s.orders},before);
 const saved=structuredClone(s.settings);
 assert.throws(()=>operate(s,{...settings(s),name:'Changed',currency:'INVALID'},manager),/mata uang/);
 assert.deepEqual(s.settings,saved);
 operate(s,(({currency,...body})=>body)(settings(s)),manager);assert.equal(s.settings.currency,'TRY');
 assert.throws(()=>operate(s,{...settings(s),currency:'USD'},{...manager,role:'waiter'}));
 assert.equal(s.settings.currency,'TRY');
});
test('currency formatting follows selected code and price-change errors use it',()=>{
 assert.equal(isCurrency('TRY'),true);assert.equal(isCurrency('usd'),false);
 for(const currency of ['IDR','TRY','USD','EUR','JPY'])assert.equal(formatMoney(12000,currency),new Intl.NumberFormat('id-ID',{style:'currency',currency,maximumFractionDigits:0}).format(12000));
 const s=initialState();s.settings.currency='TRY';
 assert.throws(()=>placeOrder(s,{name:'Rizki',requestId:id(),items:[{menuId:'m6',qty:1,price:1}]},null,'guest'),e=>e.message.includes(formatMoney(12000,'TRY')));
});
