import { test } from 'node:test';
import assert from 'node:assert/strict';
import {toPaise,buildItems,totalPaise,formatINR} from '../amounts.mjs';

test('INR price parsing remains integer paise',()=>{
 assert.equal(toPaise('0'),0);
 assert.equal(toPaise('0.29'),29);
 assert.equal(toPaise('0.01'),1);
 assert.equal(toPaise('4999.99'),499999);
 assert.equal(toPaise('9999999.99'),999999999);
 assert.equal(toPaise('100'),10000);
});
test('bad and excess-precision prices are blocked rather than rounded',()=>{
 for(const input of ['-1','1.999','0.001','10000000','1e3','NaN','Infinity','','1,000','0.000',' 2.500 ']){
  assert.throws(()=>toPaise(input),Error,input);
 }
});
test('line collection trims service and computes fixed-price paise',()=>{
 const items=buildItems([
  {service:' AI Voice Agent ',qty:'2',price:'4999.99'},
  {service:'CRM Support',qty:'1',price:'0.10'},
 ]);
 assert.deepEqual(items,[
  {service:'AI Voice Agent',qty:2,paise:499999},
  {service:'CRM Support',qty:1,paise:10},
 ]);
 assert.equal(totalPaise(items),1000008);
 assert.equal(formatINR(1000008),'₹10,000.08');
});
test('quantity, service length and line count are bounded',()=>{
 const good={service:'Service',qty:'1',price:'10.00'};
 assert.throws(()=>buildItems([]),/between 1 and 50/);
 assert.throws(()=>buildItems(Array(51).fill(good)),/between 1 and 50/);
 assert.throws(()=>buildItems([{...good,service:' '}]),/Service name/);
 assert.throws(()=>buildItems([{...good,service:'x'.repeat(201)}]),/Service name/);
 for(const qty of ['0','-1','1.2','10000','abc','01']){
  assert.throws(()=>buildItems([{...good,qty}]),/Quantity/);
 }
});
test('read-back values must be sane integers and safe totals',()=>{
 assert.throws(()=>totalPaise([{service:'A',qty:1,paise:0.9}]),/invalid line/);
 assert.throws(()=>totalPaise([{service:'A',qty:0,paise:100}]),/invalid line/);
 assert.throws(()=>totalPaise([{service:'A',qty:1,paise:1_000_000_000}]),/invalid line/);
 assert.throws(()=>totalPaise([{service:'A',qty:10000,paise:100}]),/invalid line/);
 const max=Array.from({length:50},()=>({service:'A',qty:9999,paise:999999999}));
 assert.equal(totalPaise(max),50*9999*999999999);
});
