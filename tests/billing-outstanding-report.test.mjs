import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeOutstanding} from '../billing/outstanding-report.mjs';
const invoices=[{id:'synthetic-A',amountPaise:25000},{id:'synthetic-B',amountPaise:5000}];
const complete={completeSnapshot:true,independentRefundDisputeCheck:true};
const p={invoiceId:'synthetic-A',paymentId:'pay_Synthetic123',source:'server-verified-razorpay',
 signatureValid:true,status:'captured',disputeChecked:true,disputed:false,refunded:false,currency:'INR',amountPaise:10000};
test('summarizes unpaid and partially paid invoices without claiming settlement',()=>{
 const result=summarizeOutstanding(invoices,[p],complete);
 assert.equal(result.available,true);
 assert.equal(result.invoiceTotalPaise,30000);
 assert.equal(result.verifiedPaidPaise,10000);
 assert.equal(result.outstandingPaise,20000);
 assert.deepEqual(result.rows.map(r=>r.status),['partially-paid','unpaid']);
 assert.equal(result.asOf,'snapshot-only');
});
test('rejects orphan, duplicate and unverified payments',()=>{
 for(const payments of [[{...p,invoiceId:'unknown'}],[p,p],[{...p,disputed:true}]])
  assert.equal(summarizeOutstanding(invoices,payments,complete).available,false);
});
test('rejects duplicate invoices and missing records',()=>{
 assert.equal(summarizeOutstanding([invoices[0],invoices[0]],[],complete).available,false);
 assert.equal(summarizeOutstanding(invoices,null,complete).available,false);
});

test('rejects incomplete, paginated or unchecked snapshots even when amounts appear valid',()=>{
 assert.equal(summarizeOutstanding(invoices,[p]).available,false);
 assert.equal(summarizeOutstanding(invoices,[p],{completeSnapshot:true}).available,false);
 assert.equal(summarizeOutstanding(invoices,[p],{...complete,completeSnapshot:false}).available,false);
});
