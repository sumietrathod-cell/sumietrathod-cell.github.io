import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync(new URL('../quotations.html', import.meta.url),'utf8');
const quotations=readFileSync(new URL('../quotations.sql', import.meta.url),'utf8');
const invoices=readFileSync(new URL('../invoices.sql', import.meta.url),'utf8');
test('the billing page always uses the tested exact paise parser',()=>{
 assert.match(page,/type="module"/);
 assert.match(page,/import \{buildItems,totalPaise,formatINR\} from '\.\/amounts\.mjs'/);
 assert.match(page,/items=buildItems\(/);
 assert.doesNotMatch(page,/Math\.round\(Number\(el\.querySelector/);
 assert.match(page,/const total=totalPaise\(r\.items\)/);
});
test('the draft page must never falsely claim tax, legal or payment validation',()=>{
 assert.match(page,/Draft billing workspace/);
 assert.match(page,/Not a verified tax invoice/);
 assert.match(page,/GST registration/);
 assert.match(page,/payment status/i);
});
test('only authenticated admin roles can create quotations or issue invoices',()=>{
 assert.match(quotations,/enable row level security/i);
 assert.match(quotations,/billing_admin_create/);
 assert.match(quotations,/campaign_manager_role'\)='admin'/);
 assert.match(invoices,/billing_issue_invoice/);
 assert.match(invoices,/REVOKE ALL ON FUNCTION public\.billing_issue_invoice\(uuid\) FROM public,anon;/i);
 assert.match(invoices,/quotation_id uuid NOT NULL UNIQUE/);
});
