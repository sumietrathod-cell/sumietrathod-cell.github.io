'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'campaign-manager.html'), 'utf8');
const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0]?.[1];
const queueSource = script?.match(/async function refreshFollowupQueue\(more = false\) \{[\s\S]*?\n\}\nfollowupRefresh\.addEventListener/)?.[0]
  .replace(/\nfollowupRefresh\.addEventListener$/, '');

test('CRM JavaScript parses and follow-up work list is Admin-only', () => {
  assert.ok(script);
  new vm.Script(script);
  assert.ok(queueSource);
  assert.match(html, /<article id="sales-report" hidden>[\s\S]*?id="followup-view"/);
  assert.match(html, /report\.hidden = !admin/);
  assert.match(html, /if \(!accessToken \|\| !adminSession\) return;/);
  assert.match(html, /resetFollowupQueue\(\);/);
  assert.match(html, /refreshFollowupQueue\(\);/);
  assert.match(html, /manual reminder list; no messages sent/);
});

function harness({admin = true, rows = [], token = 'test-token'} = {}) {
  const calls = [];
  const renders = [];
  const opened = [];
  const controls = {
    view: {value: 'unscheduled'},
    feedback: {textContent: ''},
    list: {replaceChildren: () => {}},
    refresh: {disabled: false},
    more: {disabled: false, hidden: true},
  };
  const request = async (...args) => {
    calls.push(args);
    const offset = JSON.parse(args[1].body).p_offset;
    return rows.slice(offset, offset + 26);
  };
  const builder = new Function('deps', `
    let accessToken = deps.token, adminSession = deps.admin;
    let followupRequest = 0, followupOffset = 0;
    const followupView = deps.controls.view, followupFeedback = deps.controls.feedback;
    const followupList = deps.controls.list, followupRefresh = deps.controls.refresh;
    const followupMore = deps.controls.more, followupPageSize = 25;
    const request = deps.request;
    const renderRows = deps.renderRows;
    const openLead = deps.openLead;
    ${queueSource}
    return {run: refreshFollowupQueue, offset: () => followupOffset};
  `);
  const api = builder({
    admin, token, controls, request,
    renderRows: (_list, items, _empty, more) => renders.push({items, more}),
    openLead: id => opened.push(id),
  });
  return {api, calls, renders, opened, controls};
}

test('without Admin session it cannot fetch the private queue', async () => {
  const h = harness({admin:false});
  await h.api.run();
  assert.equal(h.calls.length, 0);
  assert.equal(h.renders.length, 0);
});

test('fetches only the existing read-only RPC and paginates 25 rows', async () => {
  const rows = Array.from({length: 27}, (_, index) => ({
    id: String(index), name: 'Test lead ' + index,
    company: 'Example', country:'India', status:'New', follow_up_on: null,
  }));
  const h = harness({rows});
  await h.api.run();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], '/rest/v1/rpc/crm_followup_queue');
  assert.equal(h.calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(h.calls[0][1].body), {p_view:'unscheduled', p_offset:0});
  assert.equal(h.calls[0][2], 'test-token');
  assert.equal(h.renders[0].items.length, 25);
  assert.equal(h.api.offset(), 25);
  assert.equal(h.controls.more.hidden, false);
  h.renders[0].items[0].onOpen();
  assert.deepEqual(h.opened, ['0']);
  await h.api.run(true);
  assert.equal(h.calls.length, 2);
  assert.equal(JSON.parse(h.calls[1][1].body).p_offset, 25);
  assert.equal(h.renders[1].items.length, 2);
  assert.equal(h.api.offset(), 27);
  assert.equal(h.controls.more.hidden, true);
  assert.match(h.controls.feedback.textContent, /no messages sent/i);
});

test('invalid follow-up view cannot call database', async () => {
  const h = harness();
  h.controls.view.value = 'all_private_data';
  await h.api.run();
  assert.equal(h.calls.length, 0);
});
