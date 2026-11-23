// Pure receipt eligibility guard. No provider calls, no credentials, no receipts issued.
// Only a trusted server-side Razorpay verification record may authorize a receipt.
export function receiptEligibility(invoice,verification) {
 if (!invoice || typeof invoice!=='object' || !invoice.id || !Number.isSafeInteger(invoice.amountPaise) || invoice.amountPaise<=0)
  return {allowed:false,reason:'Invalid invoice or amount'};
 if (!verification || verification.source!=='server-verified-razorpay' || verification.signatureValid!==true)
  return {allowed:false,reason:'Trusted server-side payment verification missing'};
 if (verification.invoiceId!==invoice.id || verification.currency!=='INR' || verification.amountPaise!==invoice.amountPaise)
  return {allowed:false,reason:'Verified payment does not match invoice'};
 if (verification.status!=='captured' || typeof verification.paymentId!=='string' || !/^pay_[A-Za-z0-9]+$/.test(verification.paymentId))
  return {allowed:false,reason:'Payment capture not verified'};
 if (verification.refunded===true || verification.disputed===true)
  return {allowed:false,reason:'Payment refunded or disputed'};
 if (verification.receiptIssued===true)
  return {allowed:false,reason:'Receipt already issued'};
 return {allowed:true,reason:'Eligible after backend reconciliation and audit recording'};
}
