import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../quotations.html',import.meta.url),'utf8');
const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'Expected billing module');
const between=(from,to)=>{
 const a=js.indexOf(from),b=js.indexOf(to,a+from.length);
 assert.ok(a>=0&&b>a,'Could not extract: '+from);
 return js.slice(a,b);
};
const eventSource=between("$('login').onsubmit=async e=>{","$('logout').onclick=async()=>{");
const apiSource=between("async function api(path, options={}, bearer=token){","const table='/rest/v1/billing_quotations';");
const resetSource=between('function reset(){',"$('login').onsubmit=async e=>{");
function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 return {promise,resolve,reject};
}
function fakeAuth(id='synthetic-admin',expires_in=60){
 return {access_token:'synthetic-token-'+id,expires_in,
  user:{app_metadata:{campaign_manager_role:'admin'}}};
}
function harness(){
 const loginButton={disabled:false},pwd={value:'old-password'};
 const login={hidden:false,onsubmit:null,querySelector:selector=>{
  if(selector==='button')return loginButton;
  if(selector==='[name=password]')return pwd;
  throw Error('Unexpected selector '+selector);
 }};
 const desk={hidden:true},msg={textContent:''};
 const dom={login,desk,msg};
 const requests=[],timers=[];
 const ctx={
  sessionEpoch:0,loginRequest:0,pendingLoginRequest:null,expires:null,token:'',
  $:name=>dom[name],
  FormData:class{
   *[Symbol.iterator](){
    yield ['email','synthetic@example.invalid'];
    yield ['password',pwd.value];
   }
  },
  api:()=>{
   const d=deferred();
   requests.push(d);
   return d.promise;
  },
  refresh:async()=>undefined,
  current:(expectedToken,expectedEpoch)=>Boolean(expectedToken)&&ctx.token===expectedToken&&ctx.sessionEpoch===expectedEpoch,
  setTimeout:(fn,ms)=>{
   const t={fn,ms,cleared:false};timers.push(t);return t;
  },
  clearTimeout:timer=>{if(timer)timer.cleared=true},
  reset(){
   ctx.sessionEpoch++;ctx.loginRequest++;ctx.pendingLoginRequest=null;
   ctx.clearTimeout(ctx.expires);ctx.expires=null;
   ctx.token='';desk.hidden=true;login.hidden=false;
   loginButton.disabled=false;pwd.value='';
  },
 };
 vm.runInNewContext(eventSource,ctx,{filename:'billing/quotations.html login'});
 const run=()=>login.onsubmit({preventDefault(){},target:login});
 return {ctx,run,requests,timers,loginButton,pwd,login,desk,msg};
}
test('billing reset must clear live private invoices, expiry clock, and login inputs',()=>{
 for(const term of [
  /clearTimeout\(expires\)/,
  /pendingLoginRequest=null/,
  /replaceContents\(\$\('invoices'\)\)/,
  /replaceContents\(\$\('doc'\)\)/,
  /\$\('doc'\)\.hidden=true/,
  /\$\('desk'\)\.hidden=true/,
  /\$\('login'\)\.querySelector\('button'\)\.disabled=false/,
  /\$\('login'\)\.querySelector\('\[name=password\]'\)\.value=''/
 ])assert.match(resetSource,term);
});
test('successful login uses server-issued JWT lifetime and protected timer',()=>{
 assert.match(eventSource,/const expiresIn=Number\(auth\.expires_in\)/);
 assert.match(eventSource,/Number\.isFinite\(expiresIn\)/);
 assert.match(eventSource,/expires=setTimeout\(\(\)=>\{/);
 assert.match(eventSource,/if\(!current\(authenticatedToken,authenticatedEpoch\)\)return;/);
 assert.match(eventSource,/Math\.min\(expiresIn\*1000,2147483647\)/);
 const h=harness(),done=h.run();
 assert.equal(h.requests.length,1,'Auth request was not reached: '+h.msg.textContent);
 h.requests[0].resolve(fakeAuth('one',2));
 return done.then(()=>{
  assert.equal(h.desk.hidden,false);
  assert.equal(h.timers.length,1);
  assert.equal(h.timers[0].ms,2000);
  h.timers[0].fn();
  assert.equal(h.desk.hidden,true);
  assert.equal(h.ctx.token,'');
  assert.match(h.msg.textContent,/session expired/i);
 });
});
test('expired old timer cannot close a newer account',async()=>{
 const h=harness(),first=h.run();h.requests[0].resolve(fakeAuth('old'));
 await first;
 const oldTimer=h.timers[0];
 h.ctx.reset();
 const second=h.run();h.requests[1].resolve(fakeAuth('new'));
 await second;
 oldTimer.fn();
 assert.equal(h.desk.hidden,false);
 assert.equal(h.ctx.token,'synthetic-token-new');
 assert.equal(h.timers[1].cleared,false);
});
test('late old login cannot erase the active new login password',async()=>{
 const h=harness(),old=h.run();
 h.pwd.value='new-password-in-progress';
 const current=h.run();
 h.requests[0].resolve(fakeAuth('old'));
 await old;
 assert.equal(h.pwd.value,'new-password-in-progress');
 assert.equal(h.loginButton.disabled,true);
 h.requests[1].resolve(fakeAuth('new'));
 await current;
 assert.equal(h.ctx.token,'synthetic-token-new');
 assert.equal(h.loginButton.disabled,false);
 assert.equal(h.pwd.value,'');
});
test('failed stale login cannot disrupt the new account',async()=>{
 const h=harness(),old=h.run();
 const newer=h.run();
 h.requests[0].reject(new Error('invalid old password'));
 await old;
 assert.equal(h.loginButton.disabled,true);
 h.requests[1].resolve(fakeAuth('new'));
 await newer;
 assert.equal(h.ctx.token,'synthetic-token-new');
 assert.equal(h.desk.hidden,false);
});
test('current HTTP 401 removes private billing data; stale 401 cannot remove new account',async()=>{
 assert.match(apiSource,/res\.status===401&&bearer&&bearer===token/);
 let token='synthetic-old',resets=0;
 const msg={textContent:''};
 const ctx=vm.createContext({
  base:'https://example.invalid',key:'synthetic-publishable',
  get token(){return token},
  reset(){resets++;token=''},
  $:()=>msg,
  fetch:async()=>({ok:false,status:401}),
 });
 vm.runInContext(apiSource,ctx);
 await assert.rejects(ctx.api('/rest/v1/example',{},'synthetic-old'),/401/);
 assert.equal(resets,1);
 token='synthetic-new';
 await assert.rejects(ctx.api('/rest/v1/example',{},'synthetic-old'),/401/);
 assert.equal(resets,1);
 assert.equal(token,'synthetic-new');
});
