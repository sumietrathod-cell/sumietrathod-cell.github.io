import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyRazorpayWebhook} from '../billing/razorpay-webhook-verification.mjs';
const secret='synthetic-test-secret-not-for-production';
const raw='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_Synthetic123"}}}}';
const sign=value=>createHmac('sha256',secret).update(value).digest('hex');
test('accepts only the exact raw payload with correct HMAC',()=>{
 assert.equal(verifyRazorpayWebhook(raw,sign(raw),secret),true);
 assert.equal(verifyRazorpayWebhook(Buffer.from(raw),sign(raw),secret),true);
 assert.equal(verifyRazorpayWebhook(raw+' ',sign(raw),secret),false);
 assert.equal(verifyRazorpayWebhook(raw,sign(raw),'another-synthetic-test-secret'),false);
});
test('rejects malformed signature, missing secret and parsed body',()=>{
 for(const sig of ['', 'xyz', '0'.repeat(63), '0'.repeat(65)])
  assert.equal(verifyRazorpayWebhook(raw,sig,secret),false);
 assert.equal(verifyRazorpayWebhook(JSON.parse(raw),sign(raw),secret),false);
 assert.equal(verifyRazorpayWebhook(raw,sign(raw),'short'),false);
});
