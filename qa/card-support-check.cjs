const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try {
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const base='https://aarohanaiworld.com';
 await p.addInitScript(()=>Object.defineProperty(navigator,'share',{value:async data=>{window.shared=data.url}}));
 await p.goto(base+'/business-card/');
 const download=p.waitForEvent('download');await p.getByText('Save contact').click();
 const file=await download;assert.equal(file.suggestedFilename(),'aarohan-ai-world.vcf');
 const card=await fs.readFile(await file.path(),'utf8');assert(card.includes('TEL;TYPE=WORK,VOICE:+916357115513'));assert(card.includes('EMAIL;TYPE=WORK:aarohananalytics951@gmail.com'));assert(card.includes('END:VCARD'));
 await p.getByText('Share card').click();assert.equal(await p.evaluate(()=>window.shared),base+'/business-card/');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert((await (await p.request.get(base+'/?cardtest=1')).text()).includes('href="/business-card/"'));
 const id='00000000-0000-4000-8000-000000000001';
 await p.route('https://*.supabase.co/**',r=>{const u=new URL(r.request().url());const data=u.pathname.includes('/token')?{access_token:'qa',expires_in:3600,user:{id:'customer',app_metadata:{}}}:u.pathname.endsWith('voice_deployments')?[{id,name:'Shop',operator_user_id:'customer',enabled:true}]:u.pathname.endsWith('agent_support_cases')?[{id,issue:'Website · Microphone',customer_id:'customer',deployment_id:id,status:'Open'}]:[];return r.fulfill({json:data})});
 await p.goto(base+'/voice-platform/support.html');await p.locator('[name=email]').fill('qa@example.invalid');await p.locator('[name=password]').fill('demo-only');await p.getByText('Sign in',{exact:true}).click();await p.locator('#ticket-id').waitFor();assert.equal(await p.locator('#ticket-id').innerText(),id);
 await p.locator('#reply textarea').fill('Unsent test reply');await p.getByText('Refresh',{exact:true}).click();await p.locator('#detail').waitFor();assert.equal(await p.locator('#reply textarea').inputValue(),'Unsent test reply');
 console.log('PASS mobile business card, contact download, share payload, homepage link, ticket ID, refresh draft.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});