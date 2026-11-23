import test from 'node:test';
import assert from 'node:assert/strict';
import {webhookAdmission} from '../billing/webhook-admission.mjs';
const sample={id:'evt_Synthetic123',event:'payment.captured',payload:{payment:{entity:{id:'pay_Synthetic123',status:'captured',currency:'INR',amount:12500}}}};
test('accepts a structurally valid synthetic captured-payment event for later reconciliation',()=>{
 assert.deepEqual(webhookAdmission(sample,new Set()),{accepted:true,eventId:sample.id,paymentId:'pay_Synthetic123',amountPaise:12500});
});
test('rejects replay and unsupported events',()=>{
 assert.equal(webhookAdmission(sample,new Set([sample.id])).accepted,false);
 assert.equal(webhookAdmission({...sample,event:'payment.authorized'},new Set()).accepted,false);
 assert.equal(webhookAdmission({...sample,id:''},new Set()).accepted,false);
 assert.equal(webhookAdmission(sample,[]).accepted,false);
});
test('rejects invalid or ambiguous payment payload',()=>{
 for(const entity of [{amount:0},{amount:12.5},{amount:-1},{currency:'USD'},{status:'authorized'},{id:'wrong'}]){
  const changed={...sample,payload:{payment:{entity:{...sample.payload.payment.entity,...entity}}}};
  assert.equal(webhookAdmission(changed,new Set()).accepted,false);
 }
});
test('does not mutate deduplication set or issue receipt',()=>{
 const seen=new Set();
 const result=webhookAdmission(sample,seen);
 assert.equal(seen.size,0);
 assert.equal(Object.hasOwn(result,'receiptNumber'),false);
});
