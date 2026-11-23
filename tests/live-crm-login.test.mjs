import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const html=readFileSync(new URL('../campaign-manager.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,"Existing CRM inline module exists");
const start=script.indexOf("form.addEventListener('submit', async event => {");
const end=script.indexOf("async function searchLeads(",start);
assert.ok(start>=0&&end>start,"Expected live CRM login handler");
const loginSource=script.slice(start,end);
function deferred(){
 let resolve,reject;
 const promise=new Promise((a,b)=>{resolve=a;reject=b});
 return {promise,resolve,reject};
}
function harness(){
 const requests=[], pendingLeads=[], messages=[];
 let onsubmit;
 const submit={disabled:false};
 const password={value:'original-password'};
 const message={textContent:''};
 const hidden=()=>({hidden:true});
 const dashboard=hidden(),form=hidden(),roleHeading={textContent:'',focus(){}};
 const leadTools=hidden(),exportLeadsButton=hidden(),channelHub=hidden(),callHistory=hidden();
 const partnerCard=hidden(),partnerList={};
 const workPanel=hidden(),report=hidden(),signOut=hidden(),recoveryOptions=hidden();
 form.hidden=false;
 form.elements={email:{value:'synthetic@example.invalid'}};
 form.addEventListener=(type,cb)=>{assert.equal(type,'submit');onsubmit=cb};
 const ctx={
  loginRequestId:0,pendingLoginRequestId:null,
  accessToken:undefined,adminSession:false,
  submit,password,message,form,dashboard,roleHeading,leadTools,exportLeadsButton,
  channelHub,callHistory,partnerCard,partnerList,workPanel,report,signOut,recoveryOptions,
  request(path){
   const d=deferred();requests.push({path,...d});return d.promise;
  },
  async loadLeads(){const d=deferred();pendingLeads.push(d);return d.promise},
  renderRows(){},refreshPartnerTotals(){},refreshWork(){},refreshReport(){},
  refreshInbox(){},refreshCalls(){},
  clearSession(){
   ctx.loginRequestId++;
   ctx.accessToken=undefined;
   ctx.adminSession=false;
   dashboard.hidden=true;
  },
  setTimeout(){return 7;},
 };
 const sandbox=vm.createContext(ctx);
 vm.runInContext(loginSource,sandbox,{filename:'actual-live-crm-login.js'});
 return {
  ctx,requests,pendingLeads,submit,password,message,dashboard,form,
  start:()=>{const e={preventDefault(){}};return onsubmit(e)},
  logout:()=>ctx.clearSession(),
  adminSession:(id)=>({access_token:'JWT-'+id,expires_in:3600,
   user:{id,app_metadata:{campaign_manager_role:'admin'}}}),
 };
}
async function microtasks(){await Promise.resolve();await Promise.resolve();}
test('unchanged CRM inline module parses as JavaScript',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','--check'],{
  input:script,encoding:'utf8',
 });
 assert.equal(result.status,0,result.stderr);
});
test('stale Auth reply after explicit signout never restores private dashboard',async()=>{
 const h=harness(),done=h.start();
 assert.equal(h.requests.length,1);
 h.logout();
 h.requests[0].resolve(h.adminSession('OLD'));
 await done;
 assert.equal(h.ctx.accessToken,undefined);
 assert.equal(h.dashboard.hidden,true);
 assert.equal(h.pendingLeads.length,0);
 assert.equal(h.submit.disabled,false);
});
test('login expires while lead data loads: never reveal dashboard',async()=>{
 const h=harness(),done=h.start();
 h.requests[0].resolve(h.adminSession('OLD'));
 await microtasks();
 assert.equal(h.pendingLeads.length,1);
 h.logout();
 h.pendingLeads[0].resolve([]);
 await done;
 assert.equal(h.ctx.accessToken,undefined);
 assert.equal(h.dashboard.hidden,true);
 assert.equal(h.form.hidden,false);
});
test('older login success cannot clear a newer login password or alter session',async()=>{
 const h=harness();
 const old=h.start();
 h.password.value='new-password-in-progress';
 const newer=h.start();
 h.requests[0].resolve(h.adminSession('OLD'));
 await old;
 assert.equal(h.password.value,'new-password-in-progress');
 assert.equal(h.submit.disabled,true,'New login remains pending');
 h.requests[1].resolve(h.adminSession('NEW'));
 await microtasks();
 assert.equal(h.pendingLeads.length,1);
 h.pendingLeads[0].resolve([]);
 await newer;
 assert.equal(h.ctx.accessToken,'JWT-NEW');
 assert.equal(h.dashboard.hidden,false);
 assert.equal(h.ctx.roleHeading.textContent,'Admin dashboard');
});
test('older authentication error cannot dismiss a second login',async()=>{
 const h=harness();
 const old=h.start();
 const current=h.start();
 const err=new Error('Invalid login');
 err.status=401;
 h.requests[0].reject(err);
 await old;
 assert.equal(h.message.textContent,'');
 assert.equal(h.submit.disabled,true);
 h.requests[1].resolve(h.adminSession('NEW'));
 await microtasks();
 h.pendingLeads[0].resolve([]);
 await current;
 assert.equal(h.ctx.accessToken,'JWT-NEW');
 assert.equal(h.dashboard.hidden,false);
});
test('unauthorized login clears the page and shows an actionable sign-in error',async()=>{
 const h=harness(),done=h.start();
 const err=new Error('Bad credentials');err.status=401;
 h.requests[0].reject(err);
 await done;
 assert.equal(h.dashboard.hidden,true);
 assert.equal(h.ctx.accessToken,undefined);
 assert.match(h.message.textContent,/Email or password is incorrect/);
 assert.equal(h.submit.disabled,false);
});
