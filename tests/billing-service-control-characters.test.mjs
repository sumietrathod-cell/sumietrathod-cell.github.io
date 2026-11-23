import test from 'node:test';
import assert from 'node:assert/strict';
import {buildItems,totalPaise} from '../billing/amounts.mjs';

const item = service => ({service,qty:'1',price:'25.00'});
test('rejects newline injection in service description',()=>assert.throws(()=>buildItems([item('Service\\nPAID')]),/Service name/));
test('rejects terminal escape sequences in service description',()=>assert.throws(()=>buildItems([item('Service\\x1b[2J')]),/Service name/));
test('rejects DEL and C1 control characters',()=>{
  for(const control of ['\\x7f','\\u0085']) assert.throws(()=>buildItems([item('Service'+control)]),/Service name/);
});
test('rejects unsafe service description returned by database',()=>assert.throws(()=>totalPaise([{service:'Safe\\rOverwritten',qty:1,paise:2500}]),/invalid line items/));
test('allows printable multilingual service descriptions',()=>{
  const entries=buildItems([item('ગુજરાતી સેવા / English')]);
  assert.equal(totalPaise(entries),2500);
});
