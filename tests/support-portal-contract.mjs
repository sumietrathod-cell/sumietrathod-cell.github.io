// Dependency-free static smoke checks for the support portal.
// Run: node tests/support-portal-contract.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = readFileSync('support-portal.html', 'utf8');
const sql = readFileSync('supabase/migrations/20261118_support_centre.sql', 'utf8');
const hardening = readFileSync('supabase/migrations/20261118_support_post_staging_hardening.sql', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1, 'Expected one inline module');
const js = scripts[0][1];
execFileSync(process.execPath, ['--check', '--input-type=module'], { input: js });
for (const id of [
  'loginForm', 'loginCard', 'workspace', 'identity', 'role', 'signout',
  'createForm', 'ticketList', 'ticketDetail', 'ticketSearch',
  'ticketStatusFilter', 'ticketSummary', 'loadMore', 'refresh', 'message',
]) {
  assert.match(html, new RegExp('id="' + id + '"'), 'Missing element: ' + id);
}
for (const fn of [
  'aarohan_support_is_admin',
  'aarohan_support_customer_reply',
  'aarohan_support_update_ticket',
]) {
  assert.ok(js.includes(fn), 'Missing RPC call: ' + fn);
  assert.ok(sql.includes(fn), 'Missing SQL RPC: ' + fn);
}
assert.match(html, /ticketPageSize=100/, 'Expected paginated ticket list');
assert.match(js, /\.range\(start,start\+ticketPageSize-1\)/);
assert.match(js,/ticketPageOffset=0/,'Server pagination cursor must reset on account switch');
assert.match(js,/const start=reset\?0:ticketPageOffset/,'Load-more must use server cursor, not deduplicated rows');
assert.match(js,/ticketPageOffset=start\+page.length/,'Every successful page consumes its raw server offset');
assert.doesNotMatch(js,/const start=reset\?0:loadedTickets.length/,'Deduplicated count can get stuck under concurrent inserts');

assert.match(js, /listRequest\+\+/, 'Missing stale list invalidation');
assert.match(js, /detailRequest\+\+/, 'Missing stale detail invalidation');
const actorSnapshots=[...js.matchAll(/const actorId=user\.id,actorSession=sessionRequest/g)];
assert.equal(actorSnapshots.length,3,'Every async mutation requires an authenticated actor/session snapshot');
const actorGuards=[...js.matchAll(/if\(!active\(\)\)return;/g)];
assert.equal(actorGuards.length,7,'Pending create, owner update, customer reply, and ticket detail/history/error completions must discard stale responses');
const guardedErrors=[...js.matchAll(/catch\(err\)\{if\(active\(\)\)displayError\(err\)\}/g)];
assert.equal(guardedErrors.length,4,'No stale mutation error may leak into another signed-in account');

// Account-switch regression: an old ticket detail or history response must not
// render under a newly authenticated session, including the error path.
const detailSource=js.slice(js.indexOf('async function openTicket(id)'),js.indexOf('client.auth.onAuthStateChange('));
assert.ok(detailSource.startsWith('async function openTicket(id)'), 'Missing ticket detail handler');
assert.match(detailSource,/const request=\+\+detailRequest,actorId=user\.id,actorSession=sessionRequest;/,'Detail must snapshot actor and session');
assert.match(detailSource,/const active=\(\)=>request===detailRequest&&user\?\.id===actorId&&sessionRequest===actorSession;/,'Detail guard must check request, actor and session');
assert.equal((detailSource.match(/if\(!active\(\)\)return;/g)||[]).length,5,'Guard ticket, history, error and both nested mutation completions');
assert.doesNotMatch(detailSource,/if\(request!==detailRequest\)return;/,'Request ID alone cannot protect account switching');

assert.match(js, /\.textContent/, 'User-controlled content should render as text');
assert.doesNotMatch(js, /\.innerHTML\s*=/, 'Do not inject user content as HTML');
assert.match(sql, /enable row level security/);
assert.match(sql, /support_customer_select/);
assert.match(sql, /support_customer_create/);
assert.match(sql, /revoke all on public\.aarohan_support_events from (?:anon,\s*)?authenticated/);
assert.match(hardening, /aarohan_support_limit_ticket_creation/);
assert.match(hardening, /aarohan_support_limit_customer_replies/);
console.log('Support portal static contract checks passed. Browser and RLS integration tests still required.');

 // Ticket list security regression: token refresh can change the authenticated
 // session while preserving the same user ID. Old list data/errors must be
 // discarded even when the account ID is unchanged.
const listSource=js.slice(js.indexOf('async function loadTicketsPage(reset)'),js.indexOf('async function openTicket(id)'));
assert.match(listSource,/const accountId=user\.id,accountSession=sessionRequest;/,
  'List request must snapshot both actor and session generation');
assert.match(listSource,/const active=\(\)=>request===listRequest&&user\?\.id===accountId&&sessionRequest===accountSession;/,
  'List guard must include request, user and session generation');
assert.match(listSource,/if\(!active\(\)\)return;/,
  'Stale ticket list must be discarded before updating DOM or cached rows');
assert.match(listSource,/catch\(err\)\{if\(active\(\)\)displayError\(err\)\}/,
  'Stale ticket list errors must not appear in the new session');
assert.match(listSource,/finally\{if\(active\(\)\)button\.disabled=false\}/,
  'Stale request must not alter new session button state');
assert.doesNotMatch(listSource,/request!==listRequest\|\|user\?\.id!==accountId/,
  'Actor-only list guard is insufficient after a same-user session refresh');

// Mutation account-switch regression: stale completion must not re-enable a
// control belonging to the newly authenticated session (even same user ID).
const createSource=js.slice(js.indexOf("$('createForm').addEventListener('submit'"),js.indexOf('function renderTickets()'));
assert.match(createSource,/finally\{if\(active\(\)\)button\.disabled=false\}/,'Create submit must guard stale finally completion');
const ownerSource=js.slice(js.indexOf("form.addEventListener('submit',async e=>"),js.indexOf('box.append(form)'));
assert.match(ownerSource,/finally\{if\(active\(\)\)save\.disabled=false\}/,'Owner update must guard stale finally completion');
const replySource=js.slice(js.indexOf("replyForm.addEventListener('submit',async e=>"),js.indexOf('box.append(replyForm)'));
assert.match(replySource,/finally\{if\(active\(\)\)replyButton\.disabled=false\}/,'Customer reply must guard stale finally completion');

// A second submit event while an RPC is pending must not create duplicate
// tickets, owner updates, or customer replies (including keyboard submits).
assert.match(createSource,/const button=e\.target\.querySelector\('button'\);if\(button\.disabled\)return;button\.disabled=true;/,
  'Create form must reject a second submission while the first is pending');
assert.match(ownerSource,/selectedId!==id\|\|save\.disabled\)return;/,
  'Owner status update must reject duplicate submissions');
assert.match(replySource,/\|\|replyButton\.disabled\)return;/,
  'Customer reply must reject duplicate submissions');
