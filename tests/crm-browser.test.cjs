'use strict';
// Browser-level, mocked Supabase smoke tests: no real customer accounts are contacted.
// CI: npm install --no-save playwright@1.56.1 && npx playwright install chromium
// CI: node --test tests/crm-browser.test.cjs
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFileSync, promises: fs } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const html = readFileSync(path.join(__dirname, '..', 'campaign-manager.html'));
let server, origin, browser;

before(async () => {
  server = createServer((req, res) => {
    if (req.url !== '/campaign-manager.html') {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port + '/campaign-manager.html';
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function start(mode, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const messages = [];
  page.on('pageerror', e => messages.push(String(e.message)));
  await page.addInitScript(({role}) => {
    // The real app code runs unchanged; only the Supabase fetch backend is a local fake.
    // This avoids touching production data, credentials or outbound providers.
    const lead = {
      id: '00000000-0000-4000-8000-000000000041',
      name: role === 'admin' ? '=2+2' : 'Partner Example Lead',
      company: 'Fictional Company', country: 'India', status: 'New',
      email: 'nobody@example.invalid', phone: null, service_interest: 'CRM',
      source: 'Synthetic browser test', follow_up_on: null, created_at: '2026-11-22T08:00:00Z',
    };
    const respond = data => Promise.resolve(new Response(JSON.stringify(data), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    window.fetch = async url => {
      const parsed = new URL(String(url));
      const pathname = parsed.pathname;
      if (pathname === '/auth/v1/token')
        return respond({ access_token: 'fake-browser-token', expires_in: 3600,
          user: { app_metadata: role === 'admin' ? { campaign_manager_role: 'admin' } : {} } });
      if (pathname === '/auth/v1/logout') return respond({});
      if (pathname === '/rest/v1/partners') return respond(
        role === 'admin' ? [] : [{ name: 'Fictional Partner', commission_rate: 8 }]
      );
      if (pathname === '/rest/v1/leads') return respond([lead]);
      if (pathname === '/rest/v1/rpc/campaign_partner_sales_summary') return respond([]);
      if (pathname === '/rest/v1/rpc/campaign_admin_report') return respond({
        today: '2026-11-22', followups: [], pipeline: { New: 1 },
        sales: { count: 0, amount: 0, commission: 0 }, partners: [],
      });
      if (pathname === '/rest/v1/rpc/crm_followup_queue') return respond([{
        id: lead.id, name: lead.name, company: lead.company, country: lead.country,
        status: lead.status, follow_up_on: null,
      }]);
      if (pathname === '/rest/v1/campaigns' || pathname === '/rest/v1/activities'
          || pathname === '/rest/v1/campaign_inbox' || pathname === '/rest/v1/aarohi_calls')
        return respond([]);
      // Fail closed if the browser unexpectedly requests another endpoint.
      return new Response(JSON.stringify({error: 'Unexpected mock path: '+pathname}), {
        status: 404, headers:{'Content-Type':'application/json'},
      });
    };
  }, { role: mode });
  await page.goto(origin, { waitUntil: 'load' });
  await page.locator('#email').fill('synthetic-user@example.invalid');
  await page.locator('#password').fill('fictional-password-for-test');
  await page.locator('#submit').click();
  await page.locator('#dashboard:not([hidden])').waitFor();
  return { context, page, messages };
}

test('Admin mobile CRM: manual follow-up, CSV formula-safe download, logout', async () => {
  const {context, page, messages} = await start('admin');
  try {
    assert.equal(await page.locator('#role-heading').innerText(), 'Admin dashboard');
    assert.equal(await page.locator('#lead-tools').isVisible(), true);
    assert.equal(await page.locator('#sales-report').isVisible(), true);
    await page.locator('#followup-view').selectOption('unscheduled');
    await page.locator('#followup-list .lead-open').first().waitFor();
    assert.match(await page.locator('#followup-feedback').innerText(), /no messages sent/i);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-leads').click(),
    ]);
    assert.match(download.suggestedFilename(), /^aarohan-crm-leads-\d{4}-\d{2}-\d{2}\.csv$/);
    const contents = await fs.readFile(await download.path(), 'utf8');
    assert.ok(contents.includes("'=2+2"), 'Excel formula was not neutralized');
    assert.ok(contents.includes('Fictional Company'));
    assert.ok(!contents.includes('service_role'));
    assert.equal(await page.locator('#dashboard').isVisible(), true);
    await page.locator('#sign-out').click();
    await page.locator('#dashboard[hidden]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#dashboard').isVisible(), false);
    assert.equal(await page.locator('#sign-in').isVisible(), true);
    assert.equal(messages.length, 0, 'Browser errors: ' + messages.join('; '));
  } finally { await context.close(); }
});

test('Partner mobile CRM: assigned leads only, Admin actions inaccessible in UI', async () => {
  const {context,page,messages} = await start('partner', {width: 360, height: 780});
  try {
    assert.equal(await page.locator('#role-heading').innerText(), 'Partner dashboard');
    assert.equal(await page.locator('#partner-card').isVisible(), true);
    assert.equal(await page.locator('#lead-tools').isVisible(), false);
    assert.equal(await page.locator('#sales-report').isVisible(), false);
    assert.equal(await page.locator('#channel-hub').isVisible(), false);
    assert.equal(await page.locator('#lead-list').innerText().then(s => s.includes('Partner Example Lead')), true);
    assert.equal(await page.locator('#export-leads').isVisible(), false);
    assert.equal(messages.length, 0, 'Browser errors: ' + messages.join('; '));
  } finally { await context.close(); }
});
