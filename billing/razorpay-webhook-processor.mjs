// Node backend orchestration only. No HTTP endpoint is deployed by this module.
// Dependencies MUST be trusted server adapters: provider.fetchPayment must use
// Razorpay server credentials; store must implement atomic dedup/reconciliation.
// Never pass request-controlled invoice, provider data, or a client-side store.
import {verifyRazorpayWebhook} from './razorpay-webhook-verification.mjs';
import {webhookAdmission} from './webhook-admission.mjs';
import {reconcileCapturedPayment} from './payment-reconciliation.mjs';

export async function processCapturedWebhook({rawBody,signature,eventId,secret,provider,store}) {
 if (!verifyRazorpayWebhook(rawBody,signature,secret))
  return {status:'rejected',reason:'Invalid webhook signature'};
 let event;
 try {event=JSON.parse(Buffer.isBuffer(rawBody)?rawBody.toString('utf8'):rawBody);}
 catch {return {status:'rejected',reason:'Malformed webhook JSON'};}
 // Set is a structural placeholder only; actual replay protection must use
 // an atomic database unique constraint inside store.recordVerifiedPayment.
 // Razorpay event ID is supplied in the x-razorpay-event-id HTTP header.
 // The server adapter must read that header from the authenticated request.
 const admission=webhookAdmission({...event,id:eventId},new Set());
 if (!admission.accepted)return {status:'ignored',reason:admission.reason};
 if (!provider || typeof provider.fetchPayment!=='function' ||
     !provider.fetchDisputeStatus || typeof provider.fetchDisputeStatus!=='function' ||
     !store || typeof store.findInvoiceByOrderId!=='function' ||
     typeof store.recordVerifiedPayment!=='function')
  return {status:'blocked',reason:'Trusted backend adapters unavailable'};
 const entity=event.payload.payment.entity;
 if (typeof entity.order_id!=='string' || !/^order_[A-Za-z0-9]+$/.test(entity.order_id))
  return {status:'blocked',reason:'Missing payment order'};
 // The provider API lookup is authoritative, not the webhook's payment object.
 const payment=await provider.fetchPayment(admission.paymentId);
 if (!payment || payment.id!==admission.paymentId || payment.order_id!==entity.order_id)
  return {status:'blocked',reason:'Provider payment identity mismatch'};
 const invoice=await store.findInvoiceByOrderId(payment.order_id);
 const matched=reconcileCapturedPayment(invoice,payment);
 if (!matched.matched)return {status:'blocked',reason:matched.reason};
 const dispute=await provider.fetchDisputeStatus(payment.id);
 if (dispute!==false)return {status:'blocked',reason:'Dispute status not confirmed clear'};
 // Must atomically enforce event_id and payment_id uniqueness, invoice lock,
 // exact amount/currency, and all server-side invariants. Do not issue receipt.
 const recorded=await store.recordVerifiedPayment({
  eventId:admission.eventId,paymentId:payment.id,invoiceId:matched.invoiceId,
  amountPaise:matched.amountPaise,currency:'INR',refunded:false,disputed:false
 });
 if (recorded==='duplicate')return {status:'duplicate'};
 if (recorded!=='recorded')return {status:'blocked',reason:'Persistence not confirmed'};
 return {status:'verified',paymentId:payment.id,receiptIssued:false};
}
