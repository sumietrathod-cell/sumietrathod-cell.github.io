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
function harness(requestedRole=null){
 const requests=[], pendingLeads=[], messages=[];
 let onsubmit;
 const submit={disabled:false};
 const password={value:'original-password'};
 const message={textContent:''};
 const hidden=()=>({hidden:true});
 const dashboard=hidden(),form=hidden(),roleHeading={textContent:'',focus(){}};
 const leadTools=hidden(),exportLeadsButton=hidden(),channelHub=hidden(),callHistory=hidden();
 const partnerCard=hidden(),partnerList={};
 const workPanel=hidden(),report=hidden(),signOut=hidden(),recoveryOptions=hidden(),partnerAdmin=hidden();
 form.hidden=false;
 form.elements={email:{value:'synthetic@example.invalid'}};
 form.addEventListener=(type,cb)=>{assert.equal(type,'submit');onsubmit=cb};
 const ctx={
  requestedRole,loginRequestId:0,pendingLoginRequestId:null,
  accessToken:undefined,adminSession:false,
  submit,password,message,form,dashboard,roleHeading,leadTools,exportLeadsButton,
  channelHub,callHistory,partnerCard,partnerList,workPanel,report,signOut,recoveryOptions,partnerAdmin,
  request(path,options,token){
   const d=deferred();requests.push({path,options,token,...d});return d.promise;
  },
  async loadLeads(){const d=deferred();pendingLeads.push(d);return d.promise},
  renderRows(){},refreshPartnerTotals(){},refreshWork(){},refreshReport(){},
  refreshInbox(){},refreshCalls(){},refreshPartnerAdmin(){},
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
 assert.equal(h.ctx.partnerAdmin.hidden,false);
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

test('selected login rejects opposite authenticated role before loading leads',async()=>{
 for(const [role,actual] of [['admin','partner'],['partner','admin']]){
  const h=harness(role),done=h.start();
  h.requests[0].resolve({access_token:'JWT-wrong',expires_in:3600,user:{id:'synthetic',app_metadata:{campaign_manager_role:actual}}});
  await microtasks();
  assert.equal(h.requests[1].path,'/auth/v1/logout');
  assert.equal(h.requests[1].token,'JWT-wrong');
  h.requests[1].resolve(null);
  await done;
  assert.equal(h.dashboard.hidden,true);
  assert.equal(h.ctx.accessToken,undefined);
  assert.equal(h.pendingLeads.length,0);
  assert.match(h.message.textContent,/not authorized for the selected login/);
 }
});
test('selected admin login accepts admin account',async()=>{
 const h=harness('admin'),done=h.start();
 h.requests[0].resolve(h.adminSession('ADMIN'));
 await microtasks();
 h.pendingLeads[0].resolve([]);
 await done;
 assert.equal(h.dashboard.hidden,false);
 assert.equal(h.ctx.roleHeading.textContent,'Admin dashboard');
});
test('selected partner login accepts only an account with a visible partner profile',async()=>{
 const h=harness('partner'),done=h.start();
 h.requests[0].resolve({access_token:'JWT-partner',expires_in:3600,user:{id:'synthetic',app_metadata:{}}});
 await microtasks();
 assert.match(h.requests[1].path,/\/rest\/v1\/partners/);
 h.requests[1].resolve([{name:'Synthetic partner',commission_rate:10}]);
 await microtasks();
 h.pendingLeads[0].resolve([]);
 await done;
 assert.equal(h.dashboard.hidden,false);
 assert.equal(h.ctx.roleHeading.textContent,'Partner dashboard');
 assert.equal(h.ctx.partnerAdmin.hidden,true);
 assert.equal(h.ctx.leadTools.hidden,true);
 assert.equal(h.ctx.channelHub.hidden,true);
});
test('selected partner login rejects an account without partner profile',async()=>{
 const h=harness('partner'),done=h.start();
 h.requests[0].resolve({access_token:'JWT-no-profile',expires_in:3600,user:{id:'synthetic',app_metadata:{}}});
 await microtasks();
 h.requests[1].resolve([]);
 await microtasks();
 assert.equal(h.requests[2].path,'/auth/v1/logout');
 h.requests[2].resolve(null);
 await done;
 assert.equal(h.dashboard.hidden,true);
 assert.equal(h.ctx.accessToken,undefined);
 assert.equal(h.pendingLeads.length,0);
});


/* Campaign intake regression: synthetic requests only; never contact a provider or database. */
import {createHmac,webcrypto} from 'node:crypto';
const intakeSource=readFileSync(new URL('../supabase/functions/campaign-intake/index.ts',import.meta.url),'utf8');
const syntheticSecret='synthetic-test-secret';
const intakeUrl='https://example.invalid/campaign-intake';
function intakeHarness(configured=true,dbStatus=201){
 const calls=[];
 let handler;
 const env={SUPABASE_URL:'https://database.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-key',
 WHATSAPP_APP_SECRET:configured?syntheticSecret:undefined,WHATSAPP_VERIFY_TOKEN:'synthetic-verify',WHATSAPP_PHONE_NUMBER_ID:'test-number'};
 vm.runInNewContext(intakeSource,{Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn}},
  URL,Headers,Request,Response,TextEncoder,TextDecoder,Uint8Array,AbortSignal,crypto:webcrypto,
  fetch:async(url,options)=>{calls.push({url,method:options.method,prefer:options.headers.Prefer,body:JSON.parse(options.body)});
   return new Response(dbStatus===201?'true':'false',{status:dbStatus});}
 },{filename:'campaign-intake/index.ts'});
 assert.equal(typeof handler,'function');
 return {handler,calls};
}
function webhookRequest(payload,signature=true){
 const body=JSON.stringify(payload);
 const headers={'content-type':'application/json'};
 if(signature!==null)headers['x-hub-signature-256']='sha256='+createHmac('sha256',signature?syntheticSecret:'wrong-secret').update(body).digest('hex');
 return new Request(intakeUrl+'/whatsapp',{method:'POST',headers,body});
}
function syntheticWebhook(){
 const text={id:'wamid.synthetic1',from:'15550100000',type:'text',text:{body:'Synthetic demo request'}};
 return {object:'whatsapp_business_account',entry:[{changes:[
 {field:'messages',value:{metadata:{phone_number_id:'test-number'},messages:[text,text,{...text,id:'wamid.media',type:'image'},{...text,id:'invalid'}]}},
 {field:'messages',value:{metadata:{phone_number_id:'different-number'},messages:[{...text,id:'wamid.other'}]}}
 ]}]};
}
test('intake webhook verification accepts correct challenge and rejects wrong token',async()=>{
 const h=intakeHarness();
 const q='?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=';
 const good=await h.handler(new Request(intakeUrl+'/whatsapp'+q+'synthetic-verify'));
 assert.equal(good.status,200);assert.equal(await good.text(),'12345');
 const bad=await h.handler(new Request(intakeUrl+'/whatsapp'+q+'incorrect'));
 assert.equal(bad.status,403);assert.equal(h.calls.length,0);
});
test('intake rejects missing or invalid HMAC without touching database',async()=>{
 const h=intakeHarness();
 for(const sig of [null,false]){
  assert.equal((await h.handler(webhookRequest(syntheticWebhook(),sig))).status,401);
 }
 assert.equal(h.calls.length,0);
});
test('intake stores only valid matching text and deduplicates message IDs',async()=>{
 const h=intakeHarness();
 const res=await h.handler(webhookRequest(syntheticWebhook()));
 assert.equal(res.status,200);assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].body.length,1);
 assert.equal(h.calls[0].body[0].external_id,'wamid.synthetic1');
 assert.equal(h.calls[0].body[0].message,'Synthetic demo request');
 assert.match(h.calls[0].url,/on_conflict=external_id/);
 assert.match(h.calls[0].prefer,/ignore-duplicates/);
});
test('intake reports unavailable provider configuration and storage errors',async()=>{
 const disabled=intakeHarness(false);
 assert.equal((await disabled.handler(webhookRequest(syntheticWebhook()))).status,503);
 assert.equal(disabled.calls.length,0);
 const failed=intakeHarness(true,500);
 assert.equal((await failed.handler(webhookRequest(syntheticWebhook()))).status,503);
 assert.equal(failed.calls.length,1);
});
test('intake website rejects missing consent and foreign origin; accepts synthetic consented enquiry',async()=>{
 const h=intakeHarness();
 const data={channel:'chatbot',name:'Synthetic demo',email:'demo@example.invalid',message:'Demo only',consent:true};
 const make=(body,origin)=>new Request(intakeUrl,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await h.handler(make({...data,consent:false},'https://aarohanaiworld.com'))).status,400);
 assert.equal((await h.handler(make(data,'https://example.invalid'))).status,403);
 assert.equal(h.calls.length,0);
 const res=await h.handler(make(data,'https://aarohanaiworld.com'));
 assert.equal(res.status,201);assert.equal((await res.json()).received,true);
 assert.equal(h.calls.length,1);assert.match(h.calls[0].url,/campaign_web_enquiry/);
});
