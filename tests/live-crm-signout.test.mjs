import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../campaign-manager.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Existing CRM module must be present');

test('live CRM module remains valid JavaScript', () => {
  assert.doesNotThrow(() => new Function(script));
});
test('UI never initially shows private dashboard before authentication', () => {
  for(const id of ['dashboard','sales-report','channel-hub','aarohi-calls','lead-tools','partner-card']){
    assert.match(html,new RegExp('<(?:section|article) id="'+id+'"[^>]*hidden'));
  }
});

function syntheticSignout(options = {}) {
  const start = script.indexOf("signOut.addEventListener('click', async () => {");
  const end = script.indexOf('async function refreshCalls(',start);
  assert.ok(start>=0 && end>start,'Sign-out handler must precede call-history loader');
  const fragment=script.slice(start,end);
  let listener;
  let resolveRequest;
  let rejectRequest;
  let currentToken='synthetic-old-session';
  let privateRowsVisible=true;
  let focused=false;
  const calls=[];
  const request=(path,reqOptions,bearer)=>{
    calls.push({path,options:reqOptions,token:bearer});
    return new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject});
  };
  const clearSession=()=>{currentToken=undefined;privateRowsVisible=false};
  const signOut={
    disabled:false,addEventListener(name,fn){assert.equal(name,'click');listener=fn},
  };
  const message={textContent:''};
  const form={elements:{email:{focus(){focused=true}}}};
  const context=vm.createContext({signOut,message,form,request,clearSession,
    get accessToken(){return currentToken},
  });
  vm.runInContext(fragment,context,{filename:'campaign-manager.html logout event'});
  return {
    trigger:()=>listener(),
    calls,signOut,message,
    get rowsVisible(){return privateRowsVisible},
    get focused(){return focused},
    get token(){return currentToken},
    resolve:()=>resolveRequest(),
    reject:()=>rejectRequest(new Error('simulated network timeout')),
    loginAnother:()=>{currentToken='synthetic-new-session'},
  };
}
test('click immediately erases private CRM rows before logout network returns',async()=>{
  const f=syntheticSignout();
  const done=f.trigger();
  assert.equal(f.rowsVisible,false,'Private data must disappear synchronously');
  assert.equal(f.token,undefined,'Access token must be cleared synchronously');
  assert.equal(f.focused,true);
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].token,'synthetic-old-session',
    'Remote signout must use old token captured BEFORE locally clearing it');
  assert.equal(f.signOut.disabled,true);
  f.resolve();
  await done;
  assert.equal(f.signOut.disabled,false);
  assert.equal(f.message.textContent,'');
});
test('remote logout failure keeps user signed out and explains server uncertainty',async()=>{
  const f=syntheticSignout();
  const done=f.trigger();
  f.reject();
  await done;
  assert.equal(f.rowsVisible,false);
  assert.equal(f.token,undefined);
  assert.match(f.message.textContent,/Signed out locally/);
  assert.equal(f.signOut.disabled,false);
});
test('old failed logout cannot display its error under a newer signed-in user',async()=>{
  const f=syntheticSignout();
  const done=f.trigger();
  f.loginAnother();
  f.reject();
  await done;
  assert.equal(f.token,'synthetic-new-session');
  assert.equal(f.message.textContent,'');
});
