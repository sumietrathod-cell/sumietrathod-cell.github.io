import test from 'node:test';
import assert from 'node:assert/strict';
import {
 MAX_RAZORPAY_PAISE,requireInvoiceId,requirePaymentId,invoiceTotalPaise,
 verifyOrderSnapshot,verifyCapturedPayment
} from '../../supabase/functions/_shared/payment-contract.mjs';

const invoiceId='11111111-2222-4333-8444-555555555555';
const orderId='order_ABC123456';
const paymentId='pay_ABC123456';
const captured={
 id:paymentId,order_id:orderId,captured:true,status:'captured',currency:'INR',
 amount:250000,amount_refunded:0
};
test('only well-formed invoice and payment identifiers accepted',()=>{
 assert.equal(requireInvoiceId(invoiceId),invoiceId);
 assert.equal(requirePaymentId(paymentId),paymentId);
 for(const bad of ['','../../etc/passwd','pay_bad',null,42]){
  assert.throws(()=>requirePaymentId(bad));
 }
 assert.throws(()=>requireInvoiceId('invalid'));
});
test('invoice sum uses exact integer paise and rejects invalid lines',()=>{
 assert.equal(invoiceTotalPaise([
  {service:'AI setup',qty:2,paise:100100},
  {service:'Support',qty:1,paise:49800}
 ]),250000);
 for(const items of [[],[{service:'x',qty:1,paise:99}],
  [{service:'x',qty:1,paise:0}],
  [{service:'x',qty:0,paise:100}],
  [{service:'x',qty:1,paise:10.5}],
  [{service:'x',qty:1,paise:-10}],
  [{service:'x',qty:1,paise:MAX_RAZORPAY_PAISE+1}],
  [{service:'x',qty:9999,paise:999999999}]]) assert.throws(()=>invoiceTotalPaise(items));
});
test('only a newly created INR order for exact invoice amount is stored',()=>{
 assert.equal(verifyOrderSnapshot({id:orderId,amount:250000,amount_paid:0,currency:'INR',status:'created'},250000),orderId);
 assert.throws(()=>verifyOrderSnapshot({id:orderId,amount:250001,amount_paid:0,currency:'INR',status:'created'},250000));
 assert.throws(()=>verifyOrderSnapshot({id:orderId,amount:250000,amount_paid:0,currency:'USD',status:'created'},250000));
 assert.throws(()=>verifyOrderSnapshot({id:orderId,amount:250000,amount_paid:250000,currency:'INR',status:'paid'},250000));
});
test('captured payment must match stored order, exact INR total and zero refunds',()=>{
 assert.deepEqual(verifyCapturedPayment(captured,orderId,250000),{
  paymentId,orderId,amountPaise:250000
 });
 const cases=[
  {order_id:'order_DIFFERENT1'},{amount:249999},{amount:250001},{currency:'USD'},
  {status:'authorized'},{captured:false},{amount_refunded:1},{amount_refunded:250000},
  {id:'pay_other'},{order_id:null}
 ];
 for(const change of cases){
  assert.throws(()=>verifyCapturedPayment({...captured,...change},orderId,250000));
 }
});
test('reject malformed trusted order ID and unsafe amounts',()=>{
 assert.throws(()=>verifyCapturedPayment(captured,'order_bad',250000));
 assert.throws(()=>verifyCapturedPayment(captured,orderId,0));
 assert.throws(()=>verifyCapturedPayment(captured,orderId,MAX_RAZORPAY_PAISE+1));
 assert.throws(()=>verifyCapturedPayment(captured,orderId,250000.01));
});
