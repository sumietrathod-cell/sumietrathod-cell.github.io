import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('billing/payment-history.html','utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
test('Payment history browser code parses as JavaScript',()=>{
 assert.ok(script,'module source missing');
 assert.doesNotThrow(()=>new Function(script));
});
test('payment UI retains secrets server-side and renders provider data as text',()=>{
 assert.doesNotMatch(html,/SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|rzp_live_/);
 assert.doesNotMatch(script,/innerHTML\s*=|localStorage\.|sessionStorage\./);
 assert.match(script,/textContent=proof\.customer/);
 assert.match(script,/action:'acknowledgement_preview'/);
 assert.match(script,/action:'payment_history'/);
 assert.match(script,/if\(!current\(t,e\)/);
});
test('acknowledgement print must reverify provider before calling print',()=>{
 const handler=script.slice(script.indexOf("byId('print').onclick="));
 assert.match(handler,/acknowledgement_preview/);
 assert.match(handler,/await call\(/);
 assert.match(handler,/paymentId!==paymentId/);
 assert.ok(handler.indexOf('await call(')<handler.indexOf('window.print()'));
 assert.match(html,/NOT A GST TAX INVOICE OR TAX RECEIPT/);
 assert.match(html,/refunds\/disputes may occur/i);
});
