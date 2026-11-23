// Pure validation for a BACKEND-created reconciliation record. Never expose this
// as an authorization decision to browser input: source/signatureValid are
// forgeable fields unless verified and persisted by a trusted server.
// No provider calls, secrets, receipt numbers or receipts are created here.
export function receiptEligibility(invoice,verification) {
 if (!invoice || typeof invoice!=='object' || typeof invoice.id!=='string' || !invoice.id.trim() ||
     !Number.isSafeInteger(invoice.amountPaise) || invoice.amountPaise<=0)
  return {allowed:false,reason:'Invalid invoice or amount'};
 if (!verification || verification.source!=='server-verified-razorpay' || verification.signatureValid!==true)
  return {allowed:false,reason:'Trusted server-side payment verification missing'};
 if (verification.invoiceId!==invoice.id || verification.currency!=='INR' || verification.amountPaise!==invoice.amountPaise)
  return {allowed:false,reason:'Verified payment does not match invoice'};
 if (verification.status!=='captured' || typeof verification.paymentId!=='string' ||
     !/^pay_[A-Za-z0-9]+$/.test(verification.paymentId))
  return {allowed:false,reason:'Payment capture not verified'};
 // Fail closed: unknown refund/dispute/receipt state is NOT equivalent to false.
 if (verification.refunded!==false || verification.disputed!==false || verification.receiptIssued!==false)
  return {allowed:false,reason:'Refund, dispute or receipt status not explicitly cleared'};
 return {allowed:true,reason:'Eligible for atomic backend reconciliation only'};
}
