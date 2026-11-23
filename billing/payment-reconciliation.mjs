// Server-only pure comparison. Provider payment MUST be fetched independently
// with server credentials; never trust browser, webhook payload alone, or payment
// page redirects. This does not write a payment or issue a receipt.
export function reconcileCapturedPayment(invoice,providerPayment) {
 if (!invoice || typeof invoice.id!=='string' || !invoice.id.trim() ||
     typeof invoice.orderId!=='string' || !/^order_[A-Za-z0-9]+$/.test(invoice.orderId) ||
     !Number.isSafeInteger(invoice.amountPaise) || invoice.amountPaise<=0)
  return {matched:false,reason:'Invalid server-side invoice'};
 if (!providerPayment || typeof providerPayment.id!=='string' ||
     !/^pay_[A-Za-z0-9]+$/.test(providerPayment.id) ||
     providerPayment.status!=='captured' || providerPayment.captured!==true)
  return {matched:false,reason:'Provider has not confirmed capture'};
 if (providerPayment.order_id!==invoice.orderId ||
     providerPayment.currency!=='INR' ||
     !Number.isSafeInteger(providerPayment.amount) ||
     providerPayment.amount!==invoice.amountPaise)
  return {matched:false,reason:'Order, currency or amount mismatch'};
 if (!Number.isSafeInteger(providerPayment.amount_refunded) ||
     providerPayment.amount_refunded!==0 ||
     providerPayment.refund_status!==null)
  return {matched:false,reason:'Refund state is not explicitly clear'};
 // Disputes must be independently checked with provider/backend state before
 // storing an eligible reconciliation record.
 return {matched:true,paymentId:providerPayment.id,invoiceId:invoice.id,
         amountPaise:invoice.amountPaise,currency:'INR',
         requiresIndependentDisputeCheck:true};
}
