import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptEligibility} from '../billing/receipt-eligibility.mjs';
const invoice={id:'synthetic-invoice-1',amountPaise:12500};
const verified={source:'server-verified-razorpay',signatureValid:true,invoiceId:invoice.id,currency:'INR',amountPaise:12500,status:'captured',paymentId:'pay_Synthetic123',refunded:false,disputed:false,receiptIssued:false};
test('client-only or missing payment data cannot authorize a receipt',()=>{
 assert.equal(receiptEligibility(invoice,null).allowed,false);
 assert.equal(receiptEligibility(invoice,{...verified,source:'browser'}).allowed,false);
 assert.equal(receiptEligibility(invoice,{...verified,signatureValid:false}).allowed,false);
});
test('mismatched, pending, refunded, disputed or duplicate payments are blocked',()=>{
 for(const change of [{amountPaise:12000},{invoiceId:'other'},{currency:'USD'},{status:'authorized'},{refunded:true},{disputed:true},{receiptIssued:true},{paymentId:'fake'}])
  assert.equal(receiptEligibility(invoice,{...verified,...change}).allowed,false);
});
test('unknown refund, dispute or prior receipt status fails closed',()=>{
 for(const field of ['refunded','disputed','receiptIssued']){
  const missing={...verified};delete missing[field];
  assert.equal(receiptEligibility(invoice,missing).allowed,false);
  assert.equal(receiptEligibility(invoice,{...verified,[field]:null}).allowed,false);
 }
});
test('only explicit backend reconciliation eligibility passes, without issuing a receipt',()=>{
 assert.equal(receiptEligibility(invoice,verified).allowed,true);
 assert.equal(Object.hasOwn(verified,'receiptNumber'),false);
});
