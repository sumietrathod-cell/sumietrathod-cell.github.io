import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {processCapturedWebhook} from '../billing/razorpay-webhook-processor.mjs';
const secret='synthetic-backend-test-secret';
const event={event:'payment.captured',payload:{payment:{entity:{id:'pay_Synthetic001',order_id:'order_Synthetic001',status:'captured',currency:'INR',amount:12500}}}};
const eventId='evt_Synthetic001';\nconst rawBody=JSON.stringify(event);
const signature=createHmac('sha256',secret).update(rawBody).digest('hex');
const payment={id:'pay_Synthetic001',order_id:'order_Synthetic001',status:'captured',captured:true,currency:'INR',amount:12500,amount_refunded:0,refund_status:null};
function adapters(){
 const writes=[];
 return {writes,provider:{fetchPayment:async()=>payment,fetchDisputeStatus:async()=>false},
 store:{findInvoiceByOrderId:async()=>({id:'synthetic-invoice',orderId:'order_Synthetic001',amountPaise:12500}),
 recordVerifiedPayment:async value=>{writes.push(value);return 'recorded';}}};
}
test('valid webhook is reconciled through provider and recorded without receipt',async()=>{
 const a=adapters();
 const result=await processCapturedWebhook({rawBody,signature,eventId,secret,...a});
 assert.equal(result.status,'verified');
 assert.equal(result.receiptIssued,false);
 assert.equal(a.writes.length,1);
 assert.equal(a.writes[0].amountPaise,12500);
});
test('tampered payload is rejected before any provider or database calls',async()=>{
 const a=adapters();
 const result=await processCapturedWebhook({rawBody:rawBody+' ',signature,eventId,secret,...a});
 assert.equal(result.status,'rejected');
 assert.equal(a.writes.length,0);
});
test('refund, dispute, mismatch and untrusted adapters prevent persistence',async()=>{
 const a=adapters();
 a.provider.fetchDisputeStatus=async()=>true;
 assert.equal((await processCapturedWebhook({rawBody,signature,eventId,secret,...a})).status,'blocked');
 a.provider.fetchDisputeStatus=async()=>false;
 a.provider.fetchPayment=async()=>({...payment,amount:12400});
 assert.equal((await processCapturedWebhook({rawBody,signature,eventId,secret,...a})).status,'blocked');
 assert.equal(a.writes.length,0);
 assert.equal((await processCapturedWebhook({rawBody,signature,eventId,secret})).status,'blocked');
});
test('backend duplicate outcome never creates a receipt',async()=>{
 const a=adapters();
 a.store.recordVerifiedPayment=async()=> 'duplicate';
 assert.deepEqual(await processCapturedWebhook({rawBody,signature,eventId,secret,...a}),{status:'duplicate'});
});

test('missing provider event ID header fails closed',async()=>{
 const a=adapters();
 const result=await processCapturedWebhook({rawBody,signature,secret,...a});
 assert.equal(result.status,'ignored');
 assert.equal(a.writes.length,0);
});
