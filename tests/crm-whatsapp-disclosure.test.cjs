// Run: node --test tests/crm-whatsapp-disclosure.test.cjs
// Static regression guard only; does not prove Meta integration or production readiness.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const page = readFileSync(join(__dirname, '..', 'campaign-manager.html'), 'utf8');

test('CRM clearly labels unverified WhatsApp integration', () => {
  assert.match(page, /WhatsApp Cloud API integration is not yet verified for production/);
  assert.match(page, /signed webhook, opt-in\/opt-out handling and delivery receipts/);
  assert.match(page, /enquiries here are manually logged only/);
});

test('CRM does not imply that connecting a webhook alone completes WhatsApp integration', () => {
  assert.doesNotMatch(page, /WhatsApp messages are received automatically after its Cloud API webhook is connected/);
});
