import asyncio
from playwright.async_api import async_playwright
BASE='''<html><head><style>
*{margin:0;box-sizing:border-box}body{width:1080px;height:1920px;font-family:Inter;overflow:hidden;%s}
.bg{position:absolute;inset:0;background:radial-gradient(900px 700px at 80%% 10%%,#4b2a9a 0%%,transparent 60%%),radial-gradient(800px 800px at 10%% 90%%,#c2410c55 0%%,transparent 60%%),linear-gradient(160deg,#0b1a44,#160d3d 60%%,#0b1230)}
.brand{position:absolute;top:70px;left:0;right:0;text-align:center;font:800 34px Inter;letter-spacing:6px;color:#fff}
.brand b{color:#f5c84b}.tag{display:block;font:600 20px Inter;letter-spacing:8px;color:#9fb0e0;margin-top:8px}
.y{color:#f5c84b}
</style></head><body>%s</body></html>'''
BRAND='<div class="brand">AAROHAN <b>QA</b> ANALYTICS<span class="tag">QUALITY · DATA · INTELLIGENCE</span></div>'
# phone geometry
PX,PY,PW,PH=150,200,780,1240; SX,SY,SW,SH=168,218,744,1204
def bg():
    return BASE%('', '<div class="bg"></div>'+BRAND+f'<div style="position:absolute;left:{PX-40}px;top:{PY+40}px;width:{PW+80}px;height:{PH}px;border-radius:90px;background:#000;filter:blur(50px);opacity:.6"></div>')
def frame():
    return BASE%('background:transparent', f'<div style="position:absolute;left:{PX}px;top:{PY}px;width:{PW}px;height:{PH}px;border-radius:64px;border:18px solid #0c0c12;box-shadow:0 0 0 3px #3a3a4a,0 0 0 60px #00000000"></div>'
      f'<div style="position:absolute;left:{SX}px;top:{SY}px;width:{SW}px;height:{SH}px;border-radius:48px;box-shadow:0 0 0 30px #0c0c12"></div>')
def cap(h,s):
    return BASE%('background:transparent', f'''<div style="position:absolute;left:40px;right:40px;top:1470px;text-align:center">
<div style="display:inline-block;background:#6d28d9;padding:14px 34px;border-radius:22px;font:900 74px/1.08 Inter;color:#fff;box-shadow:0 12px 40px #0008">{h}</div>
<div style="margin-top:22px;display:inline-block;background:#f5c84b;color:#111;padding:12px 28px;border-radius:16px;font:800 38px/1.25 Inter">{s}</div></div>''')
PILL='display:inline-block;margin:10px;padding:16px 30px;border-radius:999px;font:800 40px Inter;color:#fff;border:3px solid #ffffff40;background:#ffffff14'
def hook1():
    pills=''.join(f'<span style="{PILL}">{t}</span>' for t in ['Deviation','CAPA','OOS','Change Control','APQR'])
    return BASE%('', '<div class="bg"></div>'+BRAND+f'''<div style="position:absolute;top:470px;left:60px;right:60px;text-align:center;color:#fff">
<div style="font:900 120px/1.05 Inter">Still tracking<br><span class="y">Pharma QA</span><br>in messy Excel?</div>
<div style="margin-top:80px">{pills}</div>
<div style="margin-top:90px;font:700 46px Inter;color:#ff8a8a">Late CAPAs. Missed reviews. Audit panic.</div></div>''')
def hook2():
    return BASE%('', '<div class="bg"></div>'+BRAND+'''<div style="position:absolute;top:620px;left:60px;right:60px;text-align:center;color:#fff">
<div style="font:900 128px/1.05 Inter">There's an<br><span class="y">AI agent</span><br>for that.</div>
<div style="margin-top:70px;font:700 48px/1.35 Inter;color:#c9d3f5">Built by a pharma QA professional<br>with 13 years on the shop floor</div></div>''')
def cta():
    box='background:#ffffff12;border:3px solid #ffffff30;border-radius:36px;padding:34px 30px;margin:0 auto 36px;width:920px'
    return BASE%('', '<div class="bg"></div>'+BRAND+f'''<div style="position:absolute;top:330px;left:0;right:0;text-align:center;color:#fff">
<div style="font:900 104px/1.05 Inter;margin-bottom:60px">Try any agent<br><span class="y">FREE for 7 days</span></div>
<div style="{box}"><div style="font:700 32px Inter;color:#9fb0e0;letter-spacing:4px">VISIT</div><div style="font:800 52px Inter;margin-top:10px">sumietrathod-cell.github.io</div></div>
<div style="{box}"><div style="font:700 32px Inter;color:#9fb0e0;letter-spacing:4px">WHATSAPP</div><div style="font:800 60px Inter;margin-top:10px;color:#4ade80">+91 63571 15513</div></div>
<div style="font:700 40px Inter;color:#c9d3f5;margin-top:30px">Working with QA teams in<br>India · US · UK · Canada · Europe</div>
<div style="margin-top:70px;display:inline-block;background:#f5c84b;color:#111;border-radius:28px;padding:22px 50px;font:900 64px Inter;box-shadow:0 14px 50px #f5c84b55">Comment “AI” for the link</div></div>''')
CAPS={'hero':('Meet Aarohan<br>QA Analytics','75 AI agents for pharma QA &amp; business'),
 'demo':('Rough notes →<br>ready report','Deviation · CAPA · FMEA drafts in ~1 minute'),
 'agents':('<span style="color:#f5c84b">75</span> ready-made<br>AI agents','SOP · Training · Vendor audit · Water trend …'),
 'dash':('Auto dashboards<br>in Power BI &amp; Excel','Deviation · CAPA · OOS · APQR'),
 'price':('Simple yearly plans','Prices in ₹ and US$ · Buy on WhatsApp')}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1920})
        async def r(html,name,tr=False):
            await pg.set_content(html); await pg.wait_for_timeout(150)
            await pg.screenshot(path=name,omit_background=tr)
        await r(bg(),'bg.png'); await r(frame(),'frame.png',True)
        await r(hook1(),'hook1.png'); await r(hook2(),'hook2.png'); await r(cta(),'cta.png')
        for k,(h,s) in CAPS.items(): await r(cap(h,s),f'cap_{k}.png',True)
        await b.close()
asyncio.run(main())
