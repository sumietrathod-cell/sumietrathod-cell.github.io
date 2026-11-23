// Shared, dependency-free validation used by the private billing payment Edge Function.
// INR amounts are always integer paise; this does NOT verify payment by itself.
export const MAX_RAZORPAY_PAISE = 10000000000;
const invoiceIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const razorpayOrderPattern=/^order_[A-Za-z0-9]{6,48}$/;
const razorpayPaymentPattern=/^pay_[A-Za-z0-9]{6,48}$/;

export function requireInvoiceId(value){
 if(typeof value!=='string'||!invoiceIdPattern.test(value)) throw new Error('Invalid invoice reference.');
 return value.toLowerCase();
}
export function requirePaymentId(value){
 if(typeof value!=='string'||!razorpayPaymentPattern.test(value)) throw new Error('Invalid Razorpay payment reference.');
 return value;
}
export function invoiceTotalPaise(items){
 if(!Array.isArray(items)||items.length<1||items.length>50) throw new Error('Invalid invoice items.');
 let total=0;
 for(const item of items){
  if(!item||typeof item.service!=='string'||!item.service.trim()||item.service.length>200||
     !Number.isSafeInteger(item.qty)||item.qty<1||item.qty>9999||
     !Number.isSafeInteger(item.paise)||item.paise<0||item.paise>999999999){
   throw new Error('Invalid invoice item amount.');
  }
  const extended=item.qty*item.paise;
  if(!Number.isSafeInteger(extended)||!Number.isSafeInteger(total+extended)) throw new Error('Invoice total exceeds safe precision.');
  total+=extended;
 }
 if(total<100||total>MAX_RAZORPAY_PAISE) throw new Error('Razorpay order requires a supported total of at least INR 1.');
 return total;
}
export function verifyOrderSnapshot(order, expectedAmount){
 if(!order||typeof order!=='object'||!razorpayOrderPattern.test(order.id)||order.currency!=='INR'||
   order.amount!==expectedAmount||order.amount_paid!==0||order.status!=='created'){
  throw new Error('Razorpay order does not match the invoice request.');
 }
 return order.id;
}
export function verifyCapturedPayment(payment,expectedOrderId,expectedAmount){
 if(!razorpayOrderPattern.test(expectedOrderId)||!Number.isSafeInteger(expectedAmount)||expectedAmount<100||
   expectedAmount>MAX_RAZORPAY_PAISE){
  throw new Error('Invalid stored payment order.');
 }
 if(!payment||typeof payment!=='object'||!razorpayPaymentPattern.test(payment.id)||
    payment.order_id!==expectedOrderId||payment.status!=='captured'||payment.captured!==true||
    payment.currency!=='INR'||payment.amount!==expectedAmount||
    payment.amount_refunded!==0){
  throw new Error('Payment is not an exact, unrefunded captured match for this invoice order.');
 }
 return {paymentId:payment.id,orderId:expectedOrderId,amountPaise:expectedAmount};
}
