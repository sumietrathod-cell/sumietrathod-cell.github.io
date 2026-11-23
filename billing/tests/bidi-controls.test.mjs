import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildItems,totalPaise,validateCustomer} from '../amounts.mjs';

test('customer names reject bidi overrides and isolates used to spoof printed identities',()=>{
 for(const mark of ['\u202a','\u202b','\u202d','\u202e','\u202c','\u2066','\u2067','\u2068','\u2069','\u200e','\u200f','\u061c']){
  assert.throws(()=>validateCustomer('Client'+mark+'Ltd'),/Customer name/,mark.codePointAt(0).toString(16));
 }
 assert.equal(validateCustomer(' ગુજરાતી Client '),'ગુજરાતી Client');
});
test('service names reject bidi controls at creation and on readback',()=>{
 for(const mark of ['\u202e','\u2067','\u200f','\u061c']){
  assert.throws(()=>buildItems([{service:'Service'+mark+'Fee',qty:'1',price:'100.00'}]),/Service name/);
  assert.throws(()=>totalPaise([{service:'Service'+mark+'Fee',qty:1,paise:10000}]),/invalid line/);
 }
 assert.equal(buildItems([{service:'ગુજરાતી સેવા',qty:'1',price:'100.00'}])[0].service,'ગુજરાતી સેવા');
});
