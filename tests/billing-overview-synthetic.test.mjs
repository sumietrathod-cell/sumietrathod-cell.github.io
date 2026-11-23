import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRecentBilling} from '../billing/overview.mjs';

const item=(paise,qty=1)=>({service:'Synthetic demo service',qty,paise});
test('overview reports document face values, not verified payments',()=>{
 const result=summarizeRecentBilling([{items:[item(12500,2)]}],[{billing_quotations:{items:[item(5000)]}}]);
 assert.equal(result.quotationCount,1);
 assert.equal(result.invoiceDraftCount,1);
 assert.match(result.quotationFaceValue,/250\.00/);
 assert.match(result.invoiceDraftFaceValue,/50\.00/);
 assert.match(result.paymentStatus,/Not connected/);
 assert.match(result.receiptStatus,/Not available/);
});
test('invalid database rows do not become misleading financial totals',()=>{
 const result=summarizeRecentBilling([{items:[item(-1)]}],[{billing_quotations:null}]);
 assert.equal(result.quotationFaceValue,null);
 assert.equal(result.invoiceDraftFaceValue,null);
 assert.equal(result.incompleteValues,2);
});
test('exactly 100 loaded records are flagged as incomplete history',()=>{
 const rows=Array.from({length:100},()=>({items:[item(100)]}));
 const result=summarizeRecentBilling(rows,[]);
 assert.equal(result.quotationListLimitReached,true);
 assert.equal(result.invoiceListLimitReached,false);
});
test('rejects non-array inputs',()=>{
 assert.throws(()=>summarizeRecentBilling(null,[]),TypeError);
});
