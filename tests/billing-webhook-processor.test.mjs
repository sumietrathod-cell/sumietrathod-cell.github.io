import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {processCapturedWebhook} from '../billing/razorpay-webhook-processor.mjs';
const secret='synthetic-backend-test-secret';
const event={event:'payment.captured',payload:{payment:{entity:{id:'pay_Synthetic001',order_id:'order_Synthetic001',status:'captured',currency:'INR',amount:12500}}}};
const eventId='evt_Synthetic001';
const rawBody=JSON.stringify(event);
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

test('rejects provider order mismatch against signed webhook',async()=>{
 const a=adapters();
 a.provider.fetchPayment=async()=>({...payment,order_id:'order_Other123'});
 const result=await processCapturedWebhook({rawBody,signature,eventId,secret,...a});
 assert.equal(result.status,'blocked');
 assert.equal(a.writes.length,0);
});
test('rejects invalid event ID before any provider or persistence calls',async()=>{
 const a=adapters();
 const result=await processCapturedWebhook({rawBody,signature,eventId:'invalid id',secret,...a});
 assert.equal(result.status,'ignored');
 assert.equal(a.writes.length,0);
});

test('provider outage is retryable and never records a payment',async()=>{
 const a=adapters();
 a.provider.fetchPayment=async()=>{throw new Error('synthetic provider outage');};
 const result=await processCapturedWebhook({rawBody,signature,eventId,secret,...a});
 assert.deepEqual(result,{status:'retryable',reason:'Payment provider lookup failed'});
 assert.equal(a.writes.length,0);
});
test('invoice lookup outage is retryable without persistence',async()=>{
 const a=adapters();
 a.store.findInvoiceByOrderId=async()=>{throw new Error('synthetic database outage');};
 const result=await processCapturedWebhook({rawBody,signature,eventId,secret,...a});
 assert.deepEqual(result,{status:'retryable',reason:'Invoice lookup failed'});
 assert.equal(a.writes.length,0);
});
test('dispute lookup outage is retryable without persistence',async()=>{
 const a=adapters();
 a.provider.fetchDisputeStatus=async()=>{throw new Error('synthetic dispute outage');};
 const result=await processCapturedWebhook({rawBody,signature,eventId,secret,...a});
 assert.deepEqual(result,{status:'retryable',reason:'Dispute lookup failed'});
 assert.equal(a.writes.length,0);
});
test('transaction failure is retryable and cannot report verified',async()=>{
 const a=adapters();
 a.store.recordVerifiedPayment=async()=>{throw new Error('synthetic transaction rollback');};
 const result=await processCapturedWebhook({rawBody,signature,eventId,secret,...a});
 assert.deepEqual(result,{status:'retryable',reason:'Payment persistence failed'});
 assert.equal(a.writes.length,0);
});

test('oversized signed webhook is rejected before provider and storage',async()=>{
 const a=adapters();
 const hugeBody=JSON.stringify({...event,padding:'x'.repeat(256*1024)});
 const hugeSignature=createHmac('sha256',secret).update(hugeBody).digest('hex');
 const result=await processCapturedWebhook({rawBody:hugeBody,signature:hugeSignature,eventId,secret,...a});
 assert.equal(result.status,'rejected');
 assert.equal(a.writes.length,0);
});
test('webhook byte limit measures UTF-8 bytes rather than characters',async()=>{
 const a=adapters();
 const hugeBody=JSON.stringify({...event,padding:'é'.repeat(140000)});
 const hugeSignature=createHmac('sha256',secret).update(hugeBody).digest('hex');
 const result=await processCapturedWebhook({rawBody:hugeBody,signature:hugeSignature,eventId,secret,...a});
 assert.equal(result.status,'rejected');
 assert.equal(a.writes.length,0);
});

test('signed webhook amount disagreement with provider blocks payment recording',async()=>{
 const a=adapters();
 const mismatchedBody=JSON.stringify({...event,payload:{payment:{entity:{...event.payload.payment.entity,amount:12499}}}});
 const mismatchedSignature=createHmac('sha256',secret).update(mismatchedBody).digest('hex');
 const result=await processCapturedWebhook({rawBody:mismatchedBody,signature:mismatchedSignature,eventId,secret,...a});
 assert.equal(result.status,'blocked');
 assert.equal(a.writes.length,0);
});
test('signed webhook currency disagreement with provider blocks payment recording',async()=>{
 const a=adapters();
 a.provider.fetchPayment=async()=>({...payment,currency:'USD'});
 const result=await processCapturedWebhook({rawBody,signature,eventId,secret,...a});
 assert.equal(result.status,'blocked');
 assert.equal(a.writes.length,0);
});

test('recorded audit metadata contains event type and exact signed raw-body SHA-256',async()=>{
 const a=adapters();
 const result=await processCapturedWebhook({rawBody,signature,eventId,secret,...a});
 assert.equal(result.status,'verified');
 assert.equal(a.writes.length,1);
 assert.equal(a.writes[0].eventId,eventId);
 assert.equal(a.writes[0].eventType,'payment.captured');
 assert.equal(a.writes[0].payloadSha256,createHash('sha256').update(rawBody).digest('hex'));
});
test('tampered raw body cannot create an audit record',async()=>{
 const a=adapters();
 const result=await processCapturedWebhook({rawBody:rawBody+'\\n',signature,eventId,secret,...a});
 assert.equal(result.status,'rejected');
 assert.equal(a.writes.length,0);
});

test('signed capture with refunded amount fails closed before provider lookup',async()=>{
 const a=adapters();
 let providerCalls=0;
 a.provider.fetchPayment=async()=>{providerCalls++;return payment;};
 const body=JSON.stringify({...event,payload:{payment:{entity:{...event.payload.payment.entity,amount_refunded:100}}}});
 const sig=createHmac('sha256',secret).update(body).digest('hex');
 const result=await processCapturedWebhook({rawBody:body,signature:sig,eventId,secret,...a});
 assert.equal(result.status,'blocked');
 assert.equal(providerCalls,0);
 assert.equal(a.writes.length,0);
});
test('signed capture with refund status fails closed before database writes',async()=>{
 const a=adapters();
 const body=JSON.stringify({...event,payload:{payment:{entity:{...event.payload.payment.entity,refund_status:'partial'}}}});
 const sig=createHmac('sha256',secret).update(body).digest('hex');
 const result=await processCapturedWebhook({rawBody:body,signature:sig,eventId,secret,...a});
 assert.equal(result.status,'blocked');
 assert.equal(a.writes.length,0);
});
test('signed capture with explicit clear refund fields still requires independent checks',async()=>{
 const a=adapters();
 const body=JSON.stringify({...event,payload:{payment:{entity:{...event.payload.payment.entity,amount_refunded:0,refund_status:null}}}});
 const sig=createHmac('sha256',secret).update(body).digest('hex');
 const result=await processCapturedWebhook({rawBody:body,signature:sig,eventId,secret,...a});
 assert.equal(result.status,'verified');
 assert.equal(a.writes.length,1);
 assert.equal(result.receiptIssued,false);
});
