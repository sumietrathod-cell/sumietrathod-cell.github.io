// Server-side only: verify Razorpay webhook signature over the EXACT raw request
// body, before parsing JSON. Never bundle this Node module into browser pages.
// This is one prerequisite, not proof of capture, invoice match or a receipt.
// The backend must also enforce replay protection, reconciliation and idempotency.
import {createHmac,timingSafeEqual} from 'node:crypto';

// Defense-in-depth: reject oversized webhook bodies before HMAC allocation.
// The HTTP ingress must independently enforce this same or a lower byte limit.
export const MAX_WEBHOOK_BODY_BYTES=256*1024;
export function verifyRazorpayWebhook(rawBody,signature,webhookSecret) {
 if (!Buffer.isBuffer(rawBody) && typeof rawBody!=='string') return false;
 if (Buffer.byteLength(rawBody)>MAX_WEBHOOK_BODY_BYTES) return false;
 if (typeof signature!=='string' || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
 if (typeof webhookSecret!=='string' || webhookSecret.length<16) return false;
 const actual=Buffer.from(signature,'hex');
 const expected=createHmac('sha256',webhookSecret).update(rawBody).digest();
 return actual.length===expected.length && timingSafeEqual(actual,expected);
}
