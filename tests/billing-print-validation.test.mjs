import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {totalPaise} from '../billing/amounts.mjs';
const html=readFileSync(new URL('../billing/quotations.html',import.meta.url),'utf8');
test('stored malformed monetary data is rejected',()=>{
 for(const items of [null,[],[{service:'Synthetic',qty:1,paise:-1}],[{service:'Synthetic',qty:1.5,paise:100}]])
  assert.throws(()=>totalPaise(items));
 assert.equal(totalPaise([{service:'Synthetic',qty:2,paise:125}]),250);
});
test('print view clears and hides old document before validating stored items',()=>{
 const view=html.slice(html.indexOf('function view(r,invoice=null)'));
 assert.match(view,/d\.hidden=true;replaceContents\(d\);[\s\S]*?try \{ totalPaise\(r\.items\); \} catch \{[^}]*return; \}/);
 assert.ok(view.indexOf('totalPaise(r.items)')<view.indexOf("append('button','Print / Save PDF'"));
});
