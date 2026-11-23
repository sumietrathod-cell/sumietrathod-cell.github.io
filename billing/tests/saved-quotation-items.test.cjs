// Synthetic-only regression tests; run: node --test billing/tests/saved-quotation-items.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../quotations.html'),'utf8');
const match=html.match(/function sameQuotationItems\(saved,submitted\)\{[\s\S]*?\n\}/);
assert.ok(match,'saved quotation validation function must exist');
const same=vm.runInNewContext('('+match[0]+')');
const item={service:'Synthetic service',qty:2,paise:12500};
test('accepts exact persisted synthetic quotation items',()=>assert.equal(same([item],[{...item}]),true));
test('rejects empty and mismatched arrays',()=>{assert.equal(same([],[]),false);assert.equal(same([item],[]),false)});
test('rejects null, arrays and malformed saved rows',()=>{for(const bad of [null,[],{}, {service:'Synthetic service',qty:'2',paise:12500},{service:'Synthetic service',qty:2,paise:'12500'}])assert.equal(same([bad],[item]),false)});
test('rejects negative, fractional and unsafe persisted amounts',()=>{for(const paise of [-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.equal(same([{...item,paise}],[{...item,paise}]),false)});
test('rejects changed service, quantity and amount',()=>{for(const bad of [{...item,service:'Changed'},{...item,qty:3},{...item,paise:12501}])assert.equal(same([bad],[item]),false)});
