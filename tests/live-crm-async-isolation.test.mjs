import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const page=readFileSync(new URL('../campaign-manager.html',import.meta.url),'utf8');
const js=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'CRM script must be embedded in live page');
const between=(from,to)=>{
  const first=js.indexOf(from),last=js.indexOf(to,first+from.length);
  assert.ok(first>=0&&last>first,'Could not locate '+from);
  return js.slice(first,last);
};
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
  return {promise,resolve,reject};
}
function error(status){return Object.assign(new Error('synthetic network error'),{status})}
function moreHarness(){
  let token='synthetic-old-account',listener,cleared=0;
  const promise=deferred(),message={textContent:''};
  const more={disabled:false,addEventListener(kind,fn){
    assert.equal(kind,'click');listener=fn;
  }};
  const ctx=vm.createContext({
    more,message,
    get accessToken(){return token},
    loadLeads:()=>promise.promise,
    clearSession(){cleared++;token=undefined;more.disabled=false},
  });
  vm.runInContext(between("more.addEventListener('click', async () => {",
    "signOut.addEventListener('click', async () => {"),ctx);
  return {more,message,promise,run:()=>listener(),setToken:t=>token=t,
    get token(){return token},get cleared(){return cleared}};
}
function importHarness(){
  let token='synthetic-old-account';
  const requests=[],message={textContent:''},leadFeedback={textContent:''};
  const manualSubmit={disabled:false},importSubmit={disabled:false},
    leadFile={disabled:false},retryForm={resetCalls:0,reset(){this.resetCalls++}};
  const addLead={querySelector:()=>manualSubmit};
  const ctx=vm.createContext({
    get accessToken(){return token},
    savingLeads:false,leadImportRequest:0,
    addLead,manualSubmit,importSubmit,leadFile,leadFeedback,message,
    importLeads:{},pendingLeads:[{name:'Synthetic'}],offset:0,
    request(path,opts,bearer){
      const d=deferred();
      requests.push({path,opts,bearer,...d});
      return d.promise;
    },
    loadLeads:async()=>[],
    refreshReport:async()=>undefined,
    resetImport(){},
    clearSession(){
      ctx.leadImportRequest++;
      ctx.savingLeads=false;
      token=undefined;
      leadFile.disabled=false;
      manualSubmit.disabled=false;
      importSubmit.disabled=true;
    },
  });
  vm.runInContext(between('async function saveLeadBatch(entries, retryForm) {',
    "addLead.addEventListener('submit', async event => {"),ctx);
  return {
    requests,ctx,message,leadFeedback,manualSubmit,importSubmit,leadFile,retryForm,
    run:()=>ctx.saveLeadBatch([{name:'synthetic-only'}],retryForm),
    logout:()=>ctx.clearSession(),
    login:t=>token=t,
    get token(){return token}
  };
}
test('live embedded CRM remains valid JavaScript',()=>{
  const r=spawnSync(process.execPath,['--input-type=module','--check'],{
    input:js,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
});
test('load-more stale 401 must NOT logout a new user',async()=>{
  const h=moreHarness();
  const pending=h.run();
  assert.equal(h.more.disabled,true);
  h.setToken('synthetic-new-account');
  h.promise.reject(error(401));
  await pending;
  assert.equal(h.cleared,0,'old 401 must not clear the new session');
  assert.equal(h.token,'synthetic-new-account');
  assert.equal(h.message.textContent,'');
});
test('load-more current 401 safely expires the session and resets the button',async()=>{
  const h=moreHarness();
  const pending=h.run();
  h.promise.reject(error(401));
  await pending;
  assert.equal(h.cleared,1);
  assert.equal(h.token,undefined);
  assert.equal(h.more.disabled,false);
  assert.match(h.message.textContent,/session expired/i);
});
test('load-more transient current error unlocks controls without signing out',async()=>{
  const h=moreHarness();
  const pending=h.run();
  h.promise.reject(error(503));
  await pending;
  assert.equal(h.cleared,0);
  assert.equal(h.more.disabled,false);
  assert.match(h.message.textContent,/Could not load more leads/);
});
test('older lead import completing after login change cannot unlock newer import',async()=>{
  const h=importHarness();
  const first=h.run();
  assert.equal(h.requests.length,1);
  h.logout();
  h.login('synthetic-new-account');
  const second=h.run();
  assert.equal(h.requests.length,2,'new account can import without old request finishing');
  assert.equal(h.ctx.savingLeads,true);
  h.requests[0].resolve({inserted:1,duplicates:0});
  await first;
  assert.equal(h.ctx.savingLeads,true,'old finally must not unlock a new import');
  assert.equal(h.manualSubmit.disabled,true);
  assert.equal(h.leadFile.disabled,true);
  assert.equal(h.retryForm.resetCalls,0,'old result must never reset new account form');
  h.requests[1].resolve({inserted:1,duplicates:0});
  await second;
  assert.equal(h.ctx.savingLeads,false);
  assert.equal(h.manualSubmit.disabled,false);
  assert.equal(h.leadFile.disabled,false);
  assert.equal(h.retryForm.resetCalls,1);
  assert.match(h.leadFeedback.textContent,/1 saved/);
});
test('stale import 401 cannot sign out the new user',async()=>{
  const h=importHarness();
  const old=h.run();
  h.logout();
  h.login('synthetic-new-account');
  const current=h.run();
  h.requests[0].reject(error(401));
  await old;
  assert.equal(h.token,'synthetic-new-account');
  assert.equal(h.ctx.savingLeads,true);
  h.requests[1].resolve({inserted:0,duplicates:1});
  await current;
  assert.equal(h.ctx.savingLeads,false);
});
test('an actual current import 401 still signs out and unlocks controls',async()=>{
  const h=importHarness();
  const pending=h.run();
  h.requests[0].reject(error(401));
  await pending;
  assert.equal(h.token,undefined);
  assert.equal(h.ctx.savingLeads,false);
  assert.equal(h.manualSubmit.disabled,false);
  assert.equal(h.leadFile.disabled,false);
  assert.match(h.message.textContent,/session expired/i);
});
test('session reset explicitly invalidates pending import work',()=>{
  const reset=between('function clearSession() {',
    "form.addEventListener('submit', async event => {");
  assert.match(reset,/leadImportRequest\+\+/);
  assert.match(reset,/savingLeads\s*=\s*false/);
  assert.match(reset,/leadFile\.disabled\s*=\s*false/);
  assert.match(reset,/importSubmit\.disabled\s*=\s*true/);
  assert.match(reset,/more\.disabled\s*=\s*false/);
});
