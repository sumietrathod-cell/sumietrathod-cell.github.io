import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {summarizeRecentBilling} from '../overview.mjs';

const page=readFileSync(new URL('../quotations.html',import.meta.url),'utf8');
const js=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
const q=(id,amount=10000)=>({id,customer:'SYNTHETIC CUSTOMER',
 created_at:'2026-11-23T09:00:00Z',items:[{service:'Demo',qty:1,paise:amount}]});
const inv=(id,amount=10000)=>({id,issued_at:'2026-11-23T09:00:00Z',billing_quotations:q('test-quote-'+id,amount)});

test('empty billing overview is explicitly not sales revenue',()=>{
 const x=summarizeRecentBilling([],[]);
 assert.deepEqual([x.quotationCount,x.invoiceDraftCount],[0,0]);
 assert.equal(x.quotationFaceValue,'₹0.00');
 assert.equal(x.invoiceDraftFaceValue,'₹0.00');
 assert.match(x.paymentStatus,/Not connected/);
 assert.match(x.receiptStatus,/Not available/);
});
test('recent quoted face value and draft invoice face value are separate',()=>{
 const x=summarizeRecentBilling([q('quote1',10000),q('quote2',3500)],[inv('draft1',3500)]);
 assert.equal(x.quotationCount,2);
 assert.equal(x.invoiceDraftCount,1);
 assert.equal(x.quotationFaceValue,'₹135.00');
 assert.equal(x.invoiceDraftFaceValue,'₹35.00');
 assert.equal(x.incompleteValues,0);
});
test('malformed or unsafe saved rows must not create fictitious financial totals',()=>{
 const x=summarizeRecentBilling([q('ok'),{id:'broken',items:[{service:'Bad',qty:-1,paise:10000}]}],
 [{id:'broken-invoice',billing_quotations:null}]);
 assert.equal(x.quotationCount,2);
 assert.equal(x.invoiceDraftCount,1);
 assert.equal(x.quotationFaceValue,null);
 assert.equal(x.invoiceDraftFaceValue,null);
 assert.equal(x.incompleteValues,2);
});
test('overview warns when list reached the 100-record limit',()=>{
 const x=summarizeRecentBilling(Array.from({length:100},(_,i)=>q('q'+i,100)),[]);
 assert.equal(x.quotationListLimitReached,true);
 assert.equal(x.invoiceListLimitReached,false);
 assert.equal(x.quotationFaceValue,'₹100.00');
});
test('summary rejects unexpected API result shapes instead of treating them as 0',()=>{
 assert.throws(()=>summarizeRecentBilling(null,[]),TypeError);
 assert.throws(()=>summarizeRecentBilling([],{}),TypeError);
});
test('payment and receipts are NEVER inferred from created invoices',()=>{
 const x=summarizeRecentBilling([q('q')],[inv('i')]);
 assert.match(x.paymentStatus,/verify directly in Razorpay/);
 assert.match(x.receiptStatus,/require payment verification/);
 assert.doesNotMatch(JSON.stringify(x),/paid.*true|paymentVerified|receiptIssued/i);
});
test('admin-only Billing Overview cannot be viewed before login or left after logout',()=>{
 assert.match(page,/<main hidden id="desk">/);
 assert.match(page,/<section id="overview"/);
 assert.match(page,/id="recent-quote-count"/);
 assert.match(page,/id="recent-invoice-count"/);
 assert.match(page,/document values, not revenue or received payments/);
 assert.match(page,/Payment verification is not connected/);
 assert.match(js,/import \{summarizeRecentBilling\} from '\.\/overview\.mjs'/);
 assert.match(js,/function renderOverview\(\)/);
 assert.match(js,/historyRows=newHistory;\s*invoiceRows=newInvoices;\s*renderOverview\(\)/);
 assert.match(js,/token='';historyRows=\[\];invoiceRows=\[\];renderOverview\(\)/);
 assert.match(js,/if\(!current\(expectedToken,expectedEpoch\)\)return;\s*historyRows=newHistory;/);
 assert.match(js,/if\(current\(expectedToken,expectedEpoch\)\)\$\('msg'\)\.textContent='Billing overview refreshed.'/);
});
test('new billing module compiles on current JavaScript engine',()=>{
 const valid=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
 assert.equal(valid.status,0,valid.stderr);
});
