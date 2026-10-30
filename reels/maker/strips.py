import asyncio
from playwright.async_api import async_playwright
STRIPS={'hero':(0,1150),'demo':(1480,2900),'agents':(7520,13200),'dash':(6080,7150),'price':(55060,56400)}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':432,'height':768},device_scale_factor=2.5)
        await pg.goto('https://sumietrathod-cell.github.io/',wait_until='networkidle')
        await pg.add_style_tag(content='.reveal{opacity:1!important;transform:none!important}')
        await pg.screenshot(path='hdr.jpg',type='jpeg',quality=92,clip={'x':0,'y':0,'width':432,'height':100})
        # make sticky/fixed header static so it doesn't repeat
        await pg.evaluate('''()=>{for(const e of document.querySelectorAll('*')){const s=getComputedStyle(e).position;if(s=='fixed'||s=='sticky')e.style.position='static'}}''')
        await pg.wait_for_timeout(500)
        for k,(a,z) in STRIPS.items():
            await pg.screenshot(path=f'st_{k}.jpg',type='jpeg',quality=92,full_page=True,clip={'x':0,'y':a,'width':432,'height':z-a})
        await b.close()
asyncio.run(main())
