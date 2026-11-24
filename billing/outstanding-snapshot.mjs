// Server-side outstanding balance snapshot. Never infer paid status from a draft,
// payment-page visit, or unverified webhook. All amounts are integer paise.
// This helper does not query a database or assert settlement is final.
export function calculateOutstanding(invoice,verifiedPayments) {
 if (!invoice || typeof invoice.id!=='string' || !invoice.id.trim() ||
     !Number.isSafeInteger(invoice.amountPaise) || invoice.amountPaise<0)
  return {available:false,reason:'Invalid invoice'};
 if (!Array.isArray(verifiedPayments))
  return {available:false,reason:'Verified payment records unavailable'};
 let paid=0;
 const seen=new Set();
 for (const payment of verifiedPayments) {
  if (!payment || payment.invoiceId!==invoice.id ||
      typeof payment.paymentId!=='string' ||
      !/^pay_[A-Za-z0-9]+$/.test(payment.paymentId) ||
      seen.has(payment.paymentId) ||
      payment.source!=='server-verified-razorpay' ||
      payment.signatureValid!==true ||
      payment.disputeChecked!==true ||
      payment.disputed!==false || payment.refunded!==false ||
      payment.currency!=='INR' ||
      !Number.isSafeInteger(payment.amountPaise) || payment.amountPaise<=0 ||
      !Number.isSafeInteger(paid+payment.amountPaise))
   return {available:false,reason:'Payment verification incomplete or inconsistent'};
  seen.add(payment.paymentId);
  paid+=payment.amountPaise;
 }
 if (paid>invoice.amountPaise)
  return {available:false,reason:'Verified payments exceed invoice amount'};
 return {available:true,invoiceId:invoice.id,invoiceAmountPaise:invoice.amountPaise,
         verifiedPaidPaise:paid,outstandingPaise:invoice.amountPaise-paid,
         status:paid===0?'unpaid':paid===invoice.amountPaise?'paid':'partially-paid',
         asOf:'snapshot-only'};
}
