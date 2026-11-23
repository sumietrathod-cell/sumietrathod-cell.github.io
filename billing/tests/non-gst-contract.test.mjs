import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const html=readFileSync(new URL('../quotations.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Live billing JavaScript module is present');

test('non-GST billing is clearly identified before sign-in',()=>{
  assert.match(html,/Non-GST Quotations &amp; Invoices/);
  assert.match(html,/GST is not charged or collected/);
  assert.match(html,/commercial invoice drafts are NOT GST tax invoices/);
  assert.match(html,/review business details and documents/);
});
test('printed quote and invoice documents cannot imply GST collection',()=>{
  assert.match(script,/GST: Not charged or collected\. This document is not a GST tax invoice\./);
  assert.match(script,/Commercial invoice draft/);
  assert.match(script,/Not a verified tax invoice/);
  assert.doesNotMatch(html,/<input\b[^>]*name="gst(?:in|_rate|_amount)"[^>]*>/i);
});
test('AAROHAN service list suggests services but leaves amount and customer editable',()=>{
  assert.match(html,/<datalist id="service-catalog">/);
  assert.equal((html.match(/<option value="/g)||[]).length,12);
  for(const service of ['CRM &amp; Lead Management','WhatsApp Business Automation',
    'SEO &amp; Digital Marketing','Pharma QA Data Analytics',
    'Quotation &amp; Invoice Software Setup']){
    assert.ok(html.includes(service),service+' is present');
  }
  assert.match(script,/input list="service-catalog" name="service"/);
  assert.match(script,/Unit price \(INR\)/);
  assert.match(html,/name="customer" required maxlength="160"/);
});
test('Razorpay payment link is explicitly unverified, never a receipt',()=>{
  assert.match(script,/https:\/\/razorpay\.me\/@aarohanaiworld/);
  assert.match(script,/payment\.target='_blank';payment\.rel='noopener noreferrer'/);
  assert.match(script,/Payment status: Not verified/);
  assert.match(script,/Payment-link access does not confirm payment/);
  assert.doesNotMatch(script, /Payment verified|Receipt issued|Mark as paid/i);
});
test('billing module remains valid JavaScript',()=>{
  const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
});
