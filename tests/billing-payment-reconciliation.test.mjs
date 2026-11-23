import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileCapturedPayment} from '../billing/payment-reconciliation.mjs';
const invoice={id:'synthetic-invoice',orderId:'order_Synthetic123',amountPaise:12500};
const payment={id:'pay_Synthetic123',order_id:invoice.orderId,status:'captured',captured:true,currency:'INR',amount:12500,amount_refunded:0,refund_status:null};
test('matches independently fetched synthetic captured payment, but requires dispute check',()=>{
 const r=reconcileCapturedPayment(invoice,payment);
 assert.equal(r.matched,true);
 assert.equal(r.requiresIndependentDisputeCheck,true);
 assert.equal(Object.hasOwn(r,'receiptNumber'),false);
});
test('rejects mismatched amount, order, currency and capture state',()=>{
 for(const changes of [{amount:12000},{order_id:'order_Other123'},{currency:'USD'},{status:'authorized'},{captured:false},{amount_refunded:100},{refund_status:'partial'},{refund_status:undefined},{amount_refunded:undefined}])
  assert.equal(reconcileCapturedPayment(invoice,{...payment,...changes}).matched,false);
});
test('rejects untrusted or incomplete invoice/payment objects',()=>{
 assert.equal(reconcileCapturedPayment(null,payment).matched,false);
 assert.equal(reconcileCapturedPayment({...invoice,orderId:''},payment).matched,false);
 assert.equal(reconcileCapturedPayment(invoice,null).matched,false);
});
