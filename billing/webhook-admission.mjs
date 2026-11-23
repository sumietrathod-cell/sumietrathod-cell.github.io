// Pure backend webhook admission decision. This is NOT a database lock or receipt
// issuer. Call only after authenticating the raw-body signature on a trusted server.
// Production must atomically insert event IDs (unique constraint), reconcile
// Razorpay payment/order with invoice, and commit receipts in a transaction.
export function webhookAdmission(event, existingEventIds) {
 if (!event || typeof event!=='object' || Array.isArray(event))
  return {accepted:false,reason:'Invalid event'};
 if (typeof event.id!=='string' || !/^[A-Za-z0-9_-]{8,128}$/.test(event.id))
  return {accepted:false,reason:'Missing or invalid provider event ID'};
 if (!(existingEventIds instanceof Set))
  return {accepted:false,reason:'Persistent deduplication state required'};
 if (existingEventIds.has(event.id))
  return {accepted:false,reason:'Duplicate webhook event'};
 if (event.event!=='payment.captured')
  return {accepted:false,reason:'Not a captured-payment event'};
 const payment=event.payload?.payment?.entity;
 if (!payment || typeof payment.id!=='string' || !/^pay_[A-Za-z0-9]+$/.test(payment.id) ||
     payment.status!=='captured' || payment.currency!=='INR' ||
     !Number.isSafeInteger(payment.amount) || payment.amount<=0)
  return {accepted:false,reason:'Invalid captured-payment payload'};
 return {accepted:true,eventId:event.id,paymentId:payment.id,amountPaise:payment.amount};
}
