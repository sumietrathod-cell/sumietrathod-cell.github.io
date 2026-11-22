'use strict';
// Run: node --test tests/crm-export.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'campaign-manager.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const csvFunction = html.match(/function csvCell\(value\) \{[\s\S]*?\n\}/)?.[0];

test('inline dashboard JavaScript compiles', () => {
  assert.equal(scripts.length, 1);
  new vm.Script(scripts[0], { filename: 'campaign-manager.html' });
});

test('lead export stays inside hidden admin-only tools', () => {
  assert.match(html, /<article id="lead-tools" hidden>[\s\S]*?<button id="export-leads"/);
  assert.match(html, /leadTools\.hidden = !admin/);
  assert.match(html, /if \(!adminSession \|\| !accessToken\) return/);
});

test('CSV cell escaping and spreadsheet formula injection protection', () => {
  assert.ok(csvFunction);
  const csvCell = new Function(csvFunction + '\nreturn csvCell;')();
  const cases = [
    ['a,b', '"a,b"'],
    ['A"B', '"A""B"'],
    ['line\nnext', '"line\nnext"'],
    ['=1+2', '"\'=1+2"'],
    ['  -1', '"\'  -1"'],
    ['@SUM(A1)', '"\'@SUM(A1)"'],
    ['\t+5', '"\'\t+5"'],
    [null, '""'],
    [undefined, '""'],
    [0, '"0"'],
  ];
  for (const [value, expected] of cases) assert.equal(csvCell(value), expected);
});

test('CSV export paginates authenticated data without a service key', () => {
  assert.match(html, /const token = accessToken;/);
  assert.match(html, /&order=created_at\.asc\.nullslast,id\.asc&limit=/);
  assert.match(html, /page === 20 \? 1 : 500/);
  assert.match(html, /if \(accessToken !== token \|\| !adminSession\) return/);
  assert.doesNotMatch(html, /sb_secret_|service_role/);
});
