const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const lead={id:'00000000-0000-4000-8000-000000000001',name:'QA mobile',status:'New'};
 const campaigns=[],appointments=[],errors=[];
 let enrolled=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname;
 let result=[];
 if(path==='/auth/v1/token')result={access_token:'qa',expires_in:3600,user:{app_metadata:{campaign_manager_role:'admin'}}};
 if(path==='/rest/v1/leads')result=[lead];
 if(path==='/rest/v1/campaigns'){if(req.method()==='POST')campaigns.push(req.postDataJSON());else result=campaigns;}
 if(path.endsWith('/campaign_enroll_for_follow_up')){const p=req.postDataJSON();assert.equal(p.p_campaign,campaigns[0].id);assert.equal(p.p_lead,lead.id);enrolled=true;lead.follow_up_on='2030-01-01';}
 if(path.endsWith('/activities')){if(req.method()==='POST')appointments.push({...req.postDataJSON(),leads:{name:lead.name}});else result=appointments;}
 await route.fulfill({json:result});
 });
 await page.goto('https://aarohanaiworld.com/campaign-manager.html');
 await page.locator('#email').fill('qa@example.invalid');await page.locator('#password').fill('synthetic-only');await page.locator('#sign-in button').first().click();
 await page.locator('[name=campaignName]').fill('QA campaign');await page.getByRole('button',{name:'Start manual campaign'}).click();
 await page.getByRole('button',{name:lead.name,exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#campaign-enrol select').options.length===1);
 await page.getByRole('button',{name:'Enrol lead'}).click();
 await page.getByText('Lead enrolled. Check its follow-up date above.').waitFor();
 assert(enrolled);
 await page.locator('[name=when]').fill('2032-01-01T13:30');await page.locator('[name=purpose]').fill('QA demo');await page.getByRole('button',{name:'Book appointment'}).click();
 await page.locator('#appointment-list').getByText(/QA demo/).waitFor();
 assert.equal(appointments[0].activity_date,'2032-01-01T08:00:00.000Z');
 await page.getByRole('button',{name:'Sign out'}).click();
 await page.locator('#sign-in').waitFor();assert(await page.locator('#campaign-work').isHidden());assert.deepEqual(errors,[]);
 console.log('PASS mobile admin sign-in, campaign, enrolment, appointment IST, sign-out using synthetic services');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});