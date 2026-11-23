// Server-side Razorpay payment fetch adapter. Never import into browser code.
// Credentials and fetch implementation must be injected by a trusted server.
// The Razorpay payment API is queried independently of webhook body fields.
export function createRazorpayPaymentProvider({keyId,keySecret,fetchImpl=fetch}) {
 if (typeof keyId!=='string' || !keyId.trim() ||
     typeof keySecret!=='string' || !keySecret.trim() ||
     typeof fetchImpl!=='function')
  throw new Error('Razorpay server credentials and fetch required');
 const authorization='Basic '+Buffer.from(keyId+':'+keySecret).toString('base64');
 return Object.freeze({
  async fetchPayment(paymentId) {
   if (typeof paymentId!=='string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId))
    throw new Error('Invalid payment ID');
   const response=await fetchImpl(
    'https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId),
    {method:'GET',headers:{Authorization:authorization,Accept:'application/json'},
     redirect:'error',signal:AbortSignal.timeout(10000)}
   );
   if (!response.ok)throw new Error('Razorpay payment lookup failed');
   const payment=await response.json();
   if (!payment || payment.id!==paymentId)throw new Error('Provider identity mismatch');
   return payment;
  }
 });
}
// NOTE: Dispute checks must use a separate authenticated backend adapter.
// This provider deliberately does NOT return a fabricated dispute-clear state.
