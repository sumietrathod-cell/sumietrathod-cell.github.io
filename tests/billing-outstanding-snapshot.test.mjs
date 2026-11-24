import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateOutstanding} from '../billing/outstanding-snapshot.mjs';
const invoice={id:'synthetic-invoice',amountPaise:25000};
const payment={invoiceId:invoice.id,paymentId:'pay_Synthetic123',source:'server-verified-razorpay',
 signatureValid:true,status:'captured',disputeChecked:true,disputed:false,refunded:false,currency:'INR',amountPaise:10000};
test('unpaid, partial and fully paid synthetic snapshots',()=>{
 assert.equal(calculateOutstanding(invoice,[]).outstandingPaise,25000);
 assert.deepEqual([calculateOutstanding(invoice,[payment]).status,
 calculateOutstanding(invoice,[payment,{...payment,paymentId:'pay_Synthetic456',amountPaise:15000}]).status],
 ['partially-paid','paid']);
});
test('fail closed on missing records and unverified or disputed payment',()=>{
 assert.equal(calculateOutstanding(invoice,null).available,false);
 for(const change of [{status:'authorized'},{status:undefined},{signatureValid:false},{disputeChecked:false},{disputed:true},
 {refunded:true},{source:'browser'},{currency:'USD'},{amountPaise:30000},
 {invoiceId:'another-invoice'}])
  assert.equal(calculateOutstanding(invoice,[{...payment,...change}]).available,false);
});
test('reject duplicate payment, unsafe amounts and overpayment',()=>{
 assert.equal(calculateOutstanding(invoice,[payment,payment]).available,false);
 assert.equal(calculateOutstanding({...invoice,amountPaise:Number.MAX_SAFE_INTEGER+1},[]).available,false);
 assert.equal(calculateOutstanding(invoice,[{...payment,amountPaise:25001}]).available,false);
});
