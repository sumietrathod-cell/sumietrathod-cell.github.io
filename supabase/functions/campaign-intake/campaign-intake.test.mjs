// Security regression tests for the ACTUAL Deno Edge Function source.
// Runs under Node 22 using a sandboxed Deno.serve adapter, fake secrets,
// synthetic request payloads and a no-network fake database. Does not deploy
// to Supabase or send Meta WhatsApp messages.
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const endpoint = "https://local.invalid/functions/v1/campaign-intake";
const origin = "https://aarohanaiworld.com";
const whatsappSecret = "ci-only-fake-meta-secret";
const fakeConfig = Object.freeze({
  SUPABASE_URL: "https://ci-backend.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "CI_TEST_ONLY_NOT_REAL",
  WHATSAPP_APP_SECRET: whatsappSecret,
  WHATSAPP_VERIFY_TOKEN: "ci-only-verify",
  WHATSAPP_PHONE_NUMBER_ID: "987654321",
});
function fixture(options={}) {
  const data = {...fakeConfig,...options.config};
  const writes=[];
  let handle;
  vm.runInNewContext(source, {
    Deno: {
      env: {get: (key) => data[key]},
      serve: (callback) => { handle=callback; },
    },
    fetch: async (url, settings) => {
      writes.push({url,method:settings.method,body:JSON.parse(settings.body),headers:settings.headers});
      return {ok: options.dbOk !== false,json:async()=>true};
    },
    Headers, Response, Request, URL, TextEncoder, TextDecoder, Uint8Array,
    AbortSignal, crypto: webcrypto,
  }, {filename:"campaign-intake/index.ts",timeout:5000});
  assert.equal(typeof handle,"function","Deno.serve should register one handler");
  return {handle,writes};
}
async function call(handle,path,method="POST",data,headers={}) {
  return handle(new Request(endpoint+path,{
    method,
    headers,
    ...(data!==undefined ? {body:typeof data==="string"?data:JSON.stringify(data)} : {}),
  }));
}
const goodEnquiry={
  channel:"chatbot",name:" Example Contact ",email:"example@example.com",
  company:"Demo Only",message:"Please explain the service.",consent:true,
};
const postedHeaders={"origin":origin,"content-type":"application/json"};
function webhookPayload(numberId="987654321") {
  return {
    object:"whatsapp_business_account",
    entry:[{changes:[{field:"messages",value:{
      metadata:{phone_number_id:numberId},
      contacts:[{wa_id:"14155550123",profile:{name:"Synthetic Demo"}}],
      messages:[
        {from:"14155550123",id:"wamid.CI_TEST_1",type:"text",text:{body:"Demo support inquiry"}},
        {from:"14155550123",id:"wamid.CI_TEST_1",type:"text",text:{body:"Duplicate demo"}},
      ],
    }}]}],
  };
}
function signedHeaders(raw,secret=whatsappSecret) {
  const digest=createHmac("sha256",secret).update(raw).digest("hex");
  return {"x-hub-signature-256":"sha256="+digest};
}

test("exact route; unrecognized URL never routes to website enquiry",async()=>{
  const f=fixture();
  for(const path of ["/unknown","/webhook","/whatsapp/extra","/whatsappXYZ"]){
    const response=await call(f.handle,path,"POST",goodEnquiry,postedHeaders);
    assert.equal(response.status,404,path);
  }
  assert.equal(f.writes.length,0,"unknown paths must not write with service credentials");
});
test("invalid or absent web Origin denied; CORS preflight is restricted",async()=>{
  const f=fixture();
  for(const bad of [{...postedHeaders,origin:"https://attacker.invalid"},{"content-type":"application/json"}]){
    const response=await call(f.handle,"","POST",goodEnquiry,bad);
    assert.equal(response.status,403);
  }
  const valid=await call(f.handle,"","OPTIONS",undefined,{"origin":origin});
  assert.equal(valid.status,204);
  assert.equal(valid.headers.get("access-control-allow-origin"),origin);
  const invalid=await call(f.handle,"","OPTIONS",undefined,{"origin":"https://attacker.invalid"});
  assert.equal(invalid.status,403);
  assert.equal(f.writes.length,0);
});
test("website consent, JSON, email and allowed channels are checked before any write",async()=>{
  const f=fixture();
  for(const input of [
    {...goodEnquiry,consent:false},
    {...goodEnquiry,email:"invalid"},
    {...goodEnquiry,channel:"all"},
    {...goodEnquiry,message:""},
    {...goodEnquiry,name:""},
  ]){
    const response=await call(f.handle,"","POST",input,postedHeaders);
    assert.equal(response.status,400,JSON.stringify(input));
  }
  const wrongType=await call(f.handle,"","POST",goodEnquiry,{"origin":origin,"content-type":"text/plain"});
  assert.equal(wrongType.status,415);
  assert.equal(f.writes.length,0);
});
test("website request enforces configured 16-KiB size maximum",async()=>{
  const f=fixture();
  const response=await call(f.handle,"","POST","x",{
    ...postedHeaders,"content-length":"16385",
  });
  assert.equal(response.status,413);
  assert.equal(f.writes.length,0);
});
test("valid synthetic web inquiry calls only the intended intake RPC",async()=>{
  const f=fixture();
  const response=await call(f.handle,"","POST",goodEnquiry,postedHeaders);
  assert.equal(response.status,201);
  assert.equal(f.writes.length,1);
  assert.ok(f.writes[0].url.endsWith("/rest/v1/rpc/campaign_web_enquiry"));
  assert.equal(f.writes[0].body.contact_name,"Example Contact");
  assert.equal(f.writes[0].body.contact_email,"example@example.com");
  assert.equal(f.writes[0].body.channel_name,"chatbot");
});
test("database outage returns unavailable, not an invented successful receipt",async()=>{
  const f=fixture({dbOk:false});
  const response=await call(f.handle,"","POST",goodEnquiry,postedHeaders);
  assert.equal(response.status,503);
});
test("webhook missing configuration rejects verification and inbound messages",async()=>{
  const f=fixture({config:{WHATSAPP_APP_SECRET:undefined}});
  const response=await call(f.handle,"/whatsapp","GET");
  assert.equal(response.status,503);
  assert.equal(f.writes.length,0);
});
test("webhook challenge is accepted only with exact configured token and digits",async()=>{
  const f=fixture();
  const url="?hub.mode=subscribe&hub.verify_token=ci-only-verify&hub.challenge=123456";
  const valid=await call(f.handle,"/whatsapp"+url,"GET");
  assert.equal(valid.status,200);
  assert.equal(await valid.text(),"123456");
  for(const suffix of [
    "?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456",
    "?hub.mode=bad&hub.verify_token=ci-only-verify&hub.challenge=123456",
    "?hub.mode=subscribe&hub.verify_token=ci-only-verify&hub.challenge=bad",
  ]){
    const r=await call(f.handle,"/whatsapp"+suffix,"GET");
    assert.equal(r.status,403,suffix);
  }
  assert.equal(f.writes.length,0);
});
test("webhook rejects missing/incorrect HMAC before any database write",async()=>{
  const f=fixture();
  const raw=JSON.stringify(webhookPayload());
  for(const headers of [{},signedHeaders(raw,"incorrect-key"),{"x-hub-signature-256":"sha256=bad"}]){
    const response=await call(f.handle,"/whatsapp","POST",raw,headers);
    assert.equal(response.status,401);
  }
  assert.equal(f.writes.length,0);
});
test("signed webhook deduplicates same Meta message ID and inserts only synthetic inbox data",async()=>{
  const f=fixture();
  const raw=JSON.stringify(webhookPayload());
  const response=await call(f.handle,"/whatsapp","POST",raw,signedHeaders(raw));
  assert.equal(response.status,200);
  assert.equal(f.writes.length,1);
  assert.ok(f.writes[0].url.endsWith("/rest/v1/campaign_inbox?on_conflict=external_id"));
  assert.equal(f.writes[0].body.length,1);
  assert.equal(f.writes[0].body[0].external_id,"wamid.CI_TEST_1");
  assert.equal(f.writes[0].body[0].phone,"+14155550123");
  assert.equal(f.writes[0].body[0].intake,"provider");
});
test("signed callback for an unrelated WhatsApp number is ignored",async()=>{
  const f=fixture();
  const raw=JSON.stringify(webhookPayload("NOT_OUR_NUMBER"));
  const response=await call(f.handle,"/whatsapp","POST",raw,signedHeaders(raw));
  assert.equal(response.status,200);
  assert.equal(f.writes.length,0);
});
test("signed webhook with an invalid JSON body fails closed",async()=>{
  const f=fixture();
  const raw="{bad-json";
  const response=await call(f.handle,"/whatsapp","POST",raw,signedHeaders(raw));
  assert.equal(response.status,400);
  assert.equal(f.writes.length,0);
});
