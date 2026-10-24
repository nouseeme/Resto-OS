import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

let server,Overview;
before(async()=>{server=await createServer({server:{middlewareMode:true},appType:'custom'});Overview=(await server.ssrLoadModule('/src/ManagementOverview.jsx')).default;});
after(async()=>{await server?.close();});
const day=ago=>{const d=new Date();d.setDate(d.getDate()-ago);d.setHours(0,0,0,0);return d.toISOString();};
function fixture(){
  const unit=(id,price,status='accepted',paid=false)=>({id,menuId:'menu',name:'Meal',price,status,paid});
  return {
    settings:{paymentMethods:[]},menu:[],expenses:[],
    tabs:[['today','Today customer'],['mixed','Mixed customer'],['yesterday','Yesterday customer'],['older','Older customer'],['closed','Closed customer'],['paid','Paid awaiting delivery']].map(([id,name])=>({id,name,createdAt:day(10),closedAt:id==='closed'?day(0):null})),
    orders:[
      {id:'today',tabId:'today',createdAt:day(0),units:[unit('u1',50)]},
      {id:'mixed-new',tabId:'mixed',createdAt:day(0),units:[unit('u2',75)]},
      {id:'mixed-old',tabId:'mixed',createdAt:day(8),units:[unit('u3',200,'cooking')]},
      {id:'yesterday',tabId:'yesterday',createdAt:day(1),units:[unit('u4',125,'delivered')]},
      {id:'older',tabId:'older',createdAt:day(8),units:[unit('u5',300,'ready')]},
      {id:'closed',tabId:'closed',createdAt:day(8),units:[unit('u6',100,'delivered',true),unit('u7',20,'delivered',true)]},
      {id:'paid',tabId:'paid',createdAt:day(0),units:[unit('u8',80,'ready',true)]},
    ],
    payments:[{id:'p1',tabId:'closed',orderId:'closed',amount:100,method:'Tunai',at:day(0)},{id:'p2',tabId:'closed',orderId:'closed',amount:20,method:'Tunai',at:day(1)},{id:'p3',tabId:'paid',orderId:'paid',amount:80,method:'Tunai',at:day(0)}],
  };
}
function render(period){return renderToStaticMarkup(React.createElement(Overview,{data:fixture(),period,onPeriodChange:()=>{},money:String,time:()=>'',due:units=>units.filter(u=>!u.paid&&u.status!=='cancelled').reduce((n,u)=>n+u.price,0),go:()=>{},select:()=>{},SectionHead:({title,extra})=>React.createElement('header',null,title,extra),Empty:({title})=>React.createElement('p',null,title),Photo:()=>null}));}
function metric(html,label,amount){assert.ok(html.includes(`<span>${label}</span><strong>${amount}</strong>`),`${label} should be ${amount}`);}
test('today: debt and unfinished cards cover all time while cash and the transaction list follow the filter',()=>{
  const html=render('today');metric(html,'Sisa piutang aktif',750);metric(html,'Transaksi belum selesai',5);metric(html,'Pembayaran tercatat',180);
  assert.ok(!html.includes('Yesterday customer'));assert.ok(!html.includes('Older customer'));
  assert.ok(html.includes('Paid awaiting delivery')); // Fully paid but still waiting for delivery.
});
test('week: debt and unfinished cards still include transactions outside the selected period',()=>{
  const html=render('week');metric(html,'Sisa piutang aktif',750);metric(html,'Transaksi belum selesai',5);metric(html,'Pembayaran tercatat',200);
  assert.ok(html.includes('Yesterday customer'));assert.ok(!html.includes('Older customer'));
});
test('all time retains all outstanding debt and excludes closed transactions',()=>{
  const html=render('all');metric(html,'Sisa piutang aktif',750);metric(html,'Transaksi belum selesai',5);metric(html,'Pembayaran tercatat',200);
  assert.ok(!html.includes('Closed customer'));
});
