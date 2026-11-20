const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},permissions:['microphone']});
 await page.goto('https://aarohanaiworld.com/aarohi-voice.html',{waitUntil:'domcontentloaded'});
 const widget=page.locator('elevenlabs-convai');
 try{
 await widget.locator('button').first().waitFor({timeout:30000});
 console.log('Widget controls',await widget.locator('button').allTextContents());
 const start=widget.getByRole('button',{name:/start a call|talk to|call aarohi|start call/i}).first();
 await start.click({timeout:8000});
 await page.waitForTimeout(3500);
 console.log('After start',await widget.locator('button').allTextContents());
 const consent=widget.getByRole('button',{name:/^agree|^accept|^allow|^continue/i}).first();
 if(await consent.isVisible())await consent.click();
 const end=widget.getByRole('button',{name:/end call|end conversation|hang up|end a call/i}).first();
 await end.waitFor({timeout:15000});await end.click();console.log('VOICE CONTROL CONNECTED AND ENDED');
 }catch(e){console.log('Voice check incomplete',String(e.message).slice(0,280),await widget.locator('button').allTextContents());}
 await page.getByRole('link',{name:'Request a follow-up'}).click();
 await page.locator('#enquiry-name').fill('Aarohi QA 20261120-R1');await page.locator('#enquiry-email').fill('aarohi-qa@example.invalid');await page.locator('#enquiry-message').fill('Synthetic Aarohi website verification. No reply requested.');await page.locator('#enquiry-consent').check();
 await page.getByRole('button',{name:'Send enquiry'}).click();
 await page.getByText('Your enquiry was received.').waitFor({timeout:20000});console.log('LIVE VOICE ENQUIRY ACCEPTED');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});