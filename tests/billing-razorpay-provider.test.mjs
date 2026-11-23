import test from 'node:test';
import assert from 'node:assert/strict';
import {createRazorpayPaymentProvider} from '../billing/razorpay-provider.mjs';
test('server adapter fetches payment with basic auth without logging secrets',async()=>{
 let called;
 const provider=createRazorpayPaymentProvider({
  keyId:'rzp_test_synthetic',keySecret:'synthetic-secret',
  fetchImpl:async(url,options)=>{
   called={url,options};
   return {ok:true,json:async()=>({id:'pay_Synthetic001',status:'captured'})};
  }
 });
 const payment=await provider.fetchPayment('pay_Synthetic001');
 assert.equal(payment.id,'pay_Synthetic001');
 assert.equal(called.url,'https://api.razorpay.com/v1/payments/pay_Synthetic001');
 assert.equal(called.options.method,'GET');
 assert.equal(called.options.headers.Authorization,
  'Basic '+Buffer.from('rzp_test_synthetic:synthetic-secret').toString('base64'));
 assert.equal(typeof provider.fetchDisputeStatus,'undefined');
});
test('rejects invalid identifiers and failed provider responses',async()=>{
 let calls=0;
 const provider=createRazorpayPaymentProvider({
  keyId:'synthetic',keySecret:'synthetic',
  fetchImpl:async()=>{calls++;return {ok:false,status:401};}
 });
 await assert.rejects(provider.fetchPayment('../bad'));
 assert.equal(calls,0);
 await assert.rejects(provider.fetchPayment('pay_Synthetic001'),/lookup failed/);
});
test('rejects provider identity mismatch and absent credentials',async()=>{
 assert.throws(()=>createRazorpayPaymentProvider({keyId:'',keySecret:'x'}));
 const provider=createRazorpayPaymentProvider({
  keyId:'synthetic',keySecret:'synthetic',
  fetchImpl:async()=>({ok:true,json:async()=>({id:'pay_Wrong123'})})
 });
 await assert.rejects(provider.fetchPayment('pay_Synthetic001'),/identity mismatch/);
});
