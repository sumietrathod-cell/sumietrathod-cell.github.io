import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const page=readFileSync(new URL('../quotations.html', import.meta.url),'utf8');
const js=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'Expected exactly one billing module');

test('the client script is valid module JavaScript',()=>{
 const check=spawnSync(process.execPath,['--check','--input-type=module'],{
  input:js,encoding:'utf8'
 });
 assert.equal(check.status,0,check.stderr);
});
test('sign-out invalidates pending invoice/list writes before a remote network await',()=>{
 assert.match(js,/function reset\(\)\{sessionEpoch\+\+;loginRequest\+\+;token='';/);
 assert.match(js,/\$\('logout'\)\.onclick=async\(\)=>\{\s*const previousToken=token;\s*reset\(\);/);
 assert.match(js,/await api\('\/auth\/v1\/logout\?scope=local',\{method:'POST'\},previousToken\)/);
});
test('list rendering requires same account token and epoch after both HTTP responses',()=>{
 const refresh=js.slice(js.indexOf('async function refresh('),js.indexOf('function reset()',js.indexOf('async function refresh(')));
 assert.match(refresh,/const newHistory=await api\(/);
 assert.match(refresh,/const newInvoices=await api\(/);
 assert.equal((refresh.match(/if\(!current\(expectedToken,expectedEpoch\)\)return;/g)||[]).length,3);
 assert.match(refresh,/historyRows=newHistory;/);
 assert.match(refresh,/invoiceRows=newInvoices;/);
 const listUpdatePos=refresh.indexOf('historyRows=newHistory;');
 assert.ok(listUpdatePos>refresh.lastIndexOf('if(!current(expectedToken,expectedEpoch))return;'));
});
test('login supports stale session rejection and resets after failed authorized refresh',()=>{
 assert.match(js,/let authenticatedEpoch=null, authenticatedToken='';/);
 assert.match(js,/const expectedEpoch=sessionEpoch, request=\+\+loginRequest/);
 assert.match(js,/await refresh\(authenticatedToken,authenticatedEpoch\)/);
 assert.match(js,/if\(authenticatedEpoch===null \? expectedEpoch!==sessionEpoch :\s*!current\(authenticatedToken,authenticatedEpoch\)\)return;/);
 assert.match(js,/reset\(\);\$\('msg'\)\.textContent=err\.message/);
});
test('invoice issue and creation protect active account and return shape',()=>{
 assert.match(js,/const expectedToken=token,expectedEpoch=sessionEpoch;/);
 assert.match(js,/if\(!current\(expectedToken,expectedEpoch\)\|\|!issue\.isConnected\)return;/);
 assert.match(js,/saved\.quotation_id!==r\.id/);
 assert.match(js,/if\(!current\(expectedToken,expectedEpoch\)\)return;/);
 assert.match(js,/saved\.id!==chosenId/);
 assert.match(js,/saved\.customer!==customer/);
 assert.match(js,/!sameQuotationItems\(saved\.items,items\)/);
});
test('JSONB server canonical key ordering cannot falsely fail a matching request',()=>{
 assert.match(js,/function sameQuotationItems\(saved,submitted\)/);
 assert.match(js,/line\.service===submitted\[i\]\.service/);
 assert.match(js,/line\.qty===submitted\[i\]\.qty/);
 assert.match(js,/line\.paise===submitted\[i\]\.paise/);
 assert.doesNotMatch(js,/JSON\.stringify\(saved\.items\)!==JSON\.stringify\(items\)/);
});
test('draft invoice and tax disclaimers remain visible after billing changes',()=>{
 assert.match(page,/Not a verified tax invoice/);
 assert.match(page,/does not verify GST registration/);
 assert.match(js,/Invoice draft ready/);
});
