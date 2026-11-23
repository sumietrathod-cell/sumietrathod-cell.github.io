// AAROHAN billing — PRE-DEPLOYMENT DRAFT. No live keys or DB changes here.
// One verified captured Razorpay payment per invoice, no partial payments.
// The legacy generic Razorpay payment page is NEVER used for automatic matching.
import {invoiceTotalPaise,requireInvoiceId,requirePaymentId,verifyOrderSnapshot,verifyCapturedPayment} from '../_shared/payment-contract.mjs';

const allowedOrigins=new Set(['https://aarohanaiworld.com','https://www.aarohanaiworld.com']);
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const config=()=>{
 const value={
  url:Deno.env.get('SUPABASE_URL'),
  serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  publicKey:Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
  razorpayKey:Deno.env.get('RAZORPAY_KEY_ID'),
  razorpaySecret:Deno.env.get('RAZORPAY_KEY_SECRET'),
 };
 if(Object.values(value).some(x=>!x))throw new HttpError(503,'Payment verification is not configured.');
 return value;
};
function send(status,body,origin){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(allowedOrigins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 return new Response(JSON.stringify(body),{status,headers});
}
async function supabaseRequest(settings,path,init={}){
 const r=await fetch(settings.url+path,{
  ...init,headers:{'apikey':settings.serviceKey,'Authorization':'Bearer '+settings.serviceKey,
    'Content-Type':'application/json',...init.headers},
 });
 const body=await r.text();
 let data=null;
 try{data=body?JSON.parse(body):null;}catch{throw new HttpError(502,'Unexpected database response.');}
 if(!r.ok){
  if(r.status===409)return {conflict:true};
  throw new HttpError(502,'Database reconciliation was not successful.');
 }
 return data;
}
async function authenticatedAdmin(settings,bearer){
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer||''))throw new HttpError(401,'Sign in as an admin.');
 const r=await fetch(settings.url+'/auth/v1/user',{headers:{'apikey':settings.publicKey,'Authorization':bearer}});
 if(!r.ok)throw new HttpError(401,'Session verification failed.');
 const user=await r.json();
 if(!user?.id||user.app_metadata?.campaign_manager_role!=='admin'){
  throw new HttpError(403,'Admin access required.');
 }
}
const single=(data)=>Array.isArray(data)?data[0]:null;
async function getInvoice(settings,id){
 const result=await supabaseRequest(settings,'/rest/v1/billing_invoices?select=id,quotation_id,billing_quotations(items)&id=eq.'+encodeURIComponent(id)+'&limit=1');
 const row=single(result);
 if(!row||row.id!==id||!row.billing_quotations)throw new HttpError(404,'Invoice not found.');
 let amount;
 try{amount=invoiceTotalPaise(row.billing_quotations.items);}catch{
  throw new HttpError(422,'This invoice cannot be processed by Razorpay.');
 }
 return {id,amount};
}
async function getOrder(settings,id){
 const data=await supabaseRequest(settings,'/rest/v1/billing_payment_orders?select=invoice_id,razorpay_order_id,amount_paise&invoice_id=eq.'+encodeURIComponent(id)+'&limit=1');
 return single(data);
}
function safeOrder(record,amount){
 if(!record)return null;
 if(record.amount_paise!==amount||typeof record.razorpay_order_id!=='string'){
  throw new HttpError(409,'Stored order differs from the invoice; manual review required.');
 }
 return {orderId:record.razorpay_order_id,amountPaise:amount};
}
async function razorpay(settings,path,init={}){
 const response=await fetch('https://api.razorpay.com/v1/'+path,{
  ...init,
  headers:{'Authorization':'Basic '+btoa(settings.razorpayKey+':'+settings.razorpaySecret),
   'Content-Type':'application/json',...init.headers},
 });
 if(!response.ok)throw new HttpError(502,'Razorpay could not validate this request.');
 try{return await response.json();}catch{throw new HttpError(502,'Unexpected payment provider response.');}
}
async function startOrder(settings,invoice){
 const existing=safeOrder(await getOrder(settings,invoice.id),invoice.amount);
 if(existing)return {state:'existing_order',...existing,keyId:settings.razorpayKey,currency:'INR'};
 const provider=await razorpay(settings,'orders',{method:'POST',body:JSON.stringify({
  amount:invoice.amount,currency:'INR',receipt:invoice.id,
  partial_payment:false,notes:{billing_invoice_id:invoice.id,source:'aarohan_billing'}
 })});
 let providerOrderId;
 try{providerOrderId=verifyOrderSnapshot(provider,invoice.amount);}
 catch{throw new HttpError(502,'Razorpay returned a mismatched order.');}
 const inserted=await supabaseRequest(settings,'/rest/v1/billing_payment_orders',{
  method:'POST',headers:{'Prefer':'return=representation'},
  body:JSON.stringify({invoice_id:invoice.id,razorpay_order_id:providerOrderId,amount_paise:invoice.amount})
 });
 if(inserted?.conflict){
  const winner=safeOrder(await getOrder(settings,invoice.id),invoice.amount);
  if(!winner)throw new HttpError(409,'Order setup conflicted. Try again.');
  return {state:'existing_order',...winner,keyId:settings.razorpayKey,currency:'INR'};
 }
 if(!Array.isArray(inserted)||inserted[0]?.razorpay_order_id!==providerOrderId){
  throw new HttpError(502,'Order was not stored successfully.');
 }
 return {state:'new_order',orderId:providerOrderId,amountPaise:invoice.amount,keyId:settings.razorpayKey,currency:'INR'};
}
async function verifyPayment(settings,invoice,paymentId){
 const order=safeOrder(await getOrder(settings,invoice.id),invoice.amount);
 if(!order)throw new HttpError(409,'Create an invoice-specific payment order before verification.');
 const payment=await razorpay(settings,'payments/'+encodeURIComponent(paymentId));
 let verified;
 try{
  verified=verifyCapturedPayment(payment,order.orderId,invoice.amount);
  if(verified.paymentId!==paymentId)throw new Error('Payment ID differs.');
 }catch{throw new HttpError(422,'This payment is not a captured, unrefunded match for the invoice order.');}
 const row={invoice_id:invoice.id,razorpay_order_id:verified.orderId,razorpay_payment_id:verified.paymentId,amount_paise:verified.amountPaise};
 const stored=await supabaseRequest(settings,'/rest/v1/billing_verified_payments',{
  method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(row)
 });
 if(stored?.conflict){
  const old=single(await supabaseRequest(settings,'/rest/v1/billing_verified_payments?select=invoice_id,razorpay_order_id,razorpay_payment_id,amount_paise,verified_at&invoice_id=eq.'+encodeURIComponent(invoice.id)+'&limit=1'));
  if(!old||old.razorpay_payment_id!==paymentId||old.razorpay_order_id!==order.orderId||old.amount_paise!==invoice.amount){
   throw new HttpError(409,'Payment already linked or the invoice has a different verified payment.');
  }
  return {state:'previously_recorded',...old};
 }
 const record=single(stored);
 if(!record||record.razorpay_payment_id!==paymentId||record.invoice_id!==invoice.id){
  throw new HttpError(502,'Verification record was not confirmed.');
 }
 return {state:'verified_snapshot',invoice_id:invoice.id,razorpay_payment_id:paymentId,amount_paise:invoice.amount,verified_at:record.verified_at};
}
Deno.serve(async (req)=>{
  const origin=req.headers.get('origin')||'';
  if(origin&&!allowedOrigins.has(origin))return send(403,{error:'Origin not allowed.'},origin);
  if(req.method==='OPTIONS'){
   if(!origin)return send(405,{error:'Unsupported request.'},origin);
   return new Response(null,{status:204,headers:{
    'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'authorization, apikey, content-type','Vary':'Origin','Access-Control-Max-Age':'300'
   }});
  }
  if(req.method!=='POST')return send(405,{error:'POST required.'},origin);
  try{
   const settings=config();
   await authenticatedAdmin(settings,req.headers.get('authorization'));
   const raw=await req.text();
   if(raw.length>2048)throw new HttpError(413,'Request is too large.');
   let payload;
   try{payload=JSON.parse(raw);}catch{throw new HttpError(400,'Invalid JSON.');}
   if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new HttpError(400,'Invalid request.');
   let invoiceId;
   try{invoiceId=requireInvoiceId(payload.invoice_id);}catch{throw new HttpError(400,'Invalid invoice reference.');}
   if(!['start_order','verify_payment'].includes(payload.action))throw new HttpError(400,'Unknown action.');
   let paymentId;
   if(payload.action==='verify_payment'){
    try{paymentId=requirePaymentId(payload.payment_id);}catch{throw new HttpError(400,'Invalid payment reference.');}
   }
   const invoice=await getInvoice(settings,invoiceId);
   const result=payload.action==='start_order'?await startOrder(settings,invoice):await verifyPayment(settings,invoice,paymentId);
   return send(200,{ok:true,...result},origin);
  }catch(error){
   const code=error instanceof HttpError?error.status:500;
   return send(code,{ok:false,error:error instanceof HttpError?error.message:'Payment operation failed.'},origin);
  }
});
