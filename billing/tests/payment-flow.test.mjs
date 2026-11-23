import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 invoiceTotalPaise,requireInvoiceId,requirePaymentId,verifyOrderSnapshot,verifyCapturedPayment
} from '../../supabase/functions/_shared/payment-contract.mjs';

const invoiceId='11111111-2222-4333-8444-555555555555';
const orderId='order_ABC123456';
const paymentId='pay_ABC123456';
const validOrigin='https://aarohanaiworld.com';
const credentials={
 SUPABASE_URL:'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'local_fake_secret',
 SUPABASE_ANON_KEY:'local_public_key', RAZORPAY_KEY_ID:'rzp_test_placeholder',
 RAZORPAY_KEY_SECRET:'fake_razorpay_secret'
};
const invoice={id:invoiceId,quotation_id:invoiceId,billing_quotations:{customer:'Demo customer',items:[
 {service:'Installation',qty:2,paise:100000},{service:'Service',qty:1,paise:50000}
]}};
function json(value,status=200){return Response.json(value,{status});}
function createHarness(options={}){
 let order=null,payment=null;
 const provider={...options};
 const calls=[];
 const mocks=async (url,init={})=>{
  url=String(url);calls.push({url,method:init.method||'GET'});
  if(url.includes('/auth/v1/user'))return json({id:'user_123',app_metadata:{campaign_manager_role:options.role||'admin'}});
  if(url.includes('/rest/v1/billing_invoices?'))return json([invoice]);
  if(url.includes('/rest/v1/billing_verified_payments?'))return json(payment?[payment]:[]);
  if(url.includes('/rest/v1/billing_payment_orders?'))return json(order?[order]:[]);
  if(url.endsWith('/rest/v1/billing_payment_orders')&&init.method==='POST'){
   order=JSON.parse(init.body);return json([order],201);
  }
  if(url.endsWith('/v1/orders'))return json({id:orderId,amount:250000,amount_paid:0,currency:'INR',status:'created'});
  if(url.includes('/v1/payments/'+paymentId))return json({
   id:paymentId,order_id:provider.mismatchOrder?'order_DIFFERENT1':orderId,
   status:provider.notCaptured?'authorized':'captured',captured:!provider.notCaptured,
   amount:250000,currency:'INR',amount_refunded:provider.refunded?250000:0
  });
  if(url.endsWith('/rest/v1/billing_verified_payments')&&init.method==='POST'){
   payment={...JSON.parse(init.body),verified_at:'2026-11-23T12:00:00Z'};
   return json([payment],201);
  }
  throw new Error('Unexpected mocked URL: '+url);
 };
 let source=readFileSync('supabase/functions/billing-payment/index.ts','utf8');
 source=source.replace(/^import .*payment-contract\.mjs';\s*$/m,'')
  .replace('Deno.serve(async (req)=>{','return async (req)=>{')
  .replace(/\}\);\s*$/,'};');
 assert.match(source,/return async \(req\)=>\{/);
 const make=new Function('Deno','fetch','btoa','invoiceTotalPaise','requireInvoiceId','requirePaymentId',
  'verifyOrderSnapshot','verifyCapturedPayment',source);
 const handler=make({env:{get:(name)=>options.noSecrets?undefined:credentials[name]}},
  mocks,btoa,invoiceTotalPaise,requireInvoiceId,requirePaymentId,verifyOrderSnapshot,verifyCapturedPayment);
 async function invoke(action,extra={},override={}){
  const headers={origin:override.origin||validOrigin};
  if(!override.noAuth)headers.authorization='Bearer fake_local_admin_token';
  const req=new Request('https://fake.supabase.co/functions/v1/billing-payment',{
   method:'POST',headers,body:JSON.stringify({action,invoice_id:invoiceId,...extra})
  });
  const result=await handler(req);
  return {status:result.status,body:await result.json()};
 }
 return {invoke,handler,calls,setProvider:(updates)=>Object.assign(provider,updates),stored:()=>({order,payment})};
}
test('no auth denies before database/provider access',async()=>{
 const h=createHarness();
 assert.equal((await h.invoke('start_order',{}, {noAuth:true})).status,401);
 assert.equal(h.calls.length,0);
});
test('signed-in non-admin denied',async()=>{
 const h=createHarness({role:'sales'});
 assert.equal((await h.invoke('start_order')).status,403);
 assert.equal(h.calls.some(x=>x.url.endsWith('/v1/orders')),false);
});
test('unknown website origin denied',async()=>{
 const h=createHarness();
 assert.equal((await h.invoke('start_order',{}, {origin:'https://attacker.test'})).status,403);
 assert.equal(h.calls.length,0);
});
test('missing backend credentials fail closed',async()=>{
 const h=createHarness({noSecrets:true});
 assert.equal((await h.invoke('start_order')).status,503);
 assert.equal(h.calls.length,0);
});
test('invoice-specific order idempotent, exact captured payment recorded',async()=>{
 const h=createHarness();
 const a=await h.invoke('start_order');
 assert.equal(a.status,200);
 assert.equal(a.body.orderId,orderId);
 assert.equal(a.body.amountPaise,250000);
 assert.equal((await h.invoke('start_order')).body.state,'existing_order');
 assert.equal(h.calls.filter(x=>x.url.endsWith('/v1/orders')).length,1);
 const b=await h.invoke('verify_payment',{payment_id:paymentId});
 assert.equal(b.status,200);
 assert.equal(b.body.state,'verified_snapshot');
 assert.equal(h.stored().payment.razorpay_payment_id,paymentId);
 assert.equal(h.stored().payment.amount_paise,250000);
 assert.equal(JSON.stringify(b.body).includes('fake_razorpay_secret'),false);
});
test('payment cannot be verified without invoice order',async()=>{
 const h=createHarness();
 assert.equal((await h.invoke('verify_payment',{payment_id:paymentId})).status,409);
 assert.equal(h.stored().payment,null);
});
test('mismatched order, refund or unauthorized payment never records paid status',async()=>{
 for(const opts of [{mismatchOrder:true},{refunded:true},{notCaptured:true}]){
  const h=createHarness(opts);
  assert.equal((await h.invoke('start_order')).status,200);
  const res=await h.invoke('verify_payment',{payment_id:paymentId});
  assert.equal(res.status,422);
  assert.equal(h.stored().payment,null);
 }
});
test('bad invoice ID and payment ID fail before provider call',async()=>{
 const h=createHarness();
 assert.equal((await h.invoke('start_order',{invoice_id:'../../etc'})).status,400);
 assert.equal((await h.invoke('verify_payment',{payment_id:'evil'})).status,400);
 assert.equal(h.calls.some(x=>x.url.endsWith('/v1/orders')),false);
});

test('history lists customer and historical verification without claiming current Paid',async()=>{
 const h=createHarness();
 let empty=await h.invoke('payment_history',{invoice_id:null});
 assert.equal(empty.status,200);
 assert.equal(empty.body.records.length,0);
 await h.invoke('start_order');
 await h.invoke('verify_payment',{payment_id:paymentId});
 const res=await h.invoke('payment_history',{invoice_id:null});
 assert.equal(res.status,200);
 assert.equal(res.body.state,'history_not_current_payment_status');
 assert.equal(res.body.records.length,1);
 assert.equal(res.body.records[0].customer,'Demo customer');
 assert.equal(res.body.records[0].amountPaise,250000);
 assert.equal(JSON.stringify(res.body).includes('"paid"'),false);
});
test('acknowledgement requires ledger and current unrefunded provider match',async()=>{
 const h=createHarness();
 assert.equal((await h.invoke('acknowledgement_preview')).status,404);
 await h.invoke('start_order');
 await h.invoke('verify_payment',{payment_id:paymentId});
 const result=await h.invoke('acknowledgement_preview');
 assert.equal(result.status,200);
 assert.equal(result.body.kind,'non_gst_payment_acknowledgement_preview');
 assert.equal(result.body.state,'provider_checked_now');
 assert.equal(result.body.customer,'Demo customer');
 assert.equal(result.body.paymentId,paymentId);
 assert.match(result.body.warning,/Not a GST tax invoice/);
 assert.equal(h.calls.filter(x=>x.url.includes('/v1/payments/')).length,2);
});
test('fresh refund update blocks acknowledgement despite previously verified ledger',async()=>{
 const h=createHarness();
 await h.invoke('start_order');
 await h.invoke('verify_payment',{payment_id:paymentId});
 assert.equal((await h.invoke('acknowledgement_preview')).status,200);
 h.setProvider({refunded:true});
 const rejected=await h.invoke('acknowledgement_preview');
 assert.equal(rejected.status,409);
 assert.equal(JSON.stringify(rejected.body).includes('provider_checked_now'),false);
 const history=await h.invoke('payment_history',{invoice_id:null});
 assert.equal(history.status,200);
 assert.equal(history.body.state,'history_not_current_payment_status');
});
test('historical payment with changed order or authorization is not previewable',async()=>{
 for(const change of [{mismatchOrder:true},{notCaptured:true}]){
  const h=createHarness();
  await h.invoke('start_order');
  await h.invoke('verify_payment',{payment_id:paymentId});
  h.setProvider(change);
  assert.equal((await h.invoke('acknowledgement_preview')).status,409);
 }
});
