# Aarohan daily Reel maker

## USE v2 (since 2026-11-02) — Sumit asked: AI doll in every video + AAROHAN name big and bold
Folder `v2/`: `template.html` (big gold AAROHAN + "AI WORLD" header, Aarohi AI doll that waves/talks/blinks in every scene, speech bubbles on hook, "AI agent" and CTA scenes), `render.js`, `config.example.js`.
1. Copy `v2/template.html` to an empty work folder. Write `config.js` there (copy `config.example.js`): agentName, hook {title, chips, pain}, 3-4 phoneScenes {img, y0, y1, cap, sub} (y in px of a 780-px-wide screenshot), optional bubbleHook/bubbleAgent/bubbleCta.
2. Screenshots: Playwright viewport 390x577, deviceScaleFactor 2, full-page JPEG q92 of the agent page. Remove the free-demo popup first: `let e=document.getElementById('at-n');while(e&&getComputedStyle(e).position!=='fixed')e=e.parentElement;if(e)e.remove();` Fill the form with realistic fictitious example data, blur the focused field, screenshot; click "Create my prompt" and screenshot the result (expand the prompt box: max-height none). Dashboards: click "Load sample data".
3. Check frames: render a few with `setT(t)` before the full render.
4. `node v2/render.js <work folder> <out.mp4>` (~1 min; makes music with music.py, ~23 s total).
Keep the doll and the big AAROHAN header in every reel. The old v1 scripts below are kept only for reference.

## v1 (old)

Original intro reel: ../2026-10-30-aarohan-intro.mp4 (25 s, 1080x1920, 30 fps).

Pipeline (paths in scripts assume /home/claude/vid for screenshots and /home/claude/build for layers):
1. `strips.py` – Playwright screenshots of the live site at 432 px wide, dsf 2.5: header `hdr.jpg` + tall strips `st_<name>.jpg` (CSS y ranges in STRIPS; sticky header made static, so y is shifted ~+100 vs normal).
2. `layers.py` – renders bg.png, frame.png (phone bezel, screen at 168,218 size 744x1204), hook/cta full-screen PNGs and caption PNGs (purple headline + yellow sub-line, Inter font).
3. `music.py` – synthesized royalty-free beat.
4. `render.sh` – one mp4 per scene (still or phone-scroll with eased crop), concat with -c copy, add music.

Style: navy/purple gradient, brand "AAROHAN AI WORLD", yellow #f5c84b highlights, purple #6d28d9 caption band. English captions. Hook (2 frames) → 4-5 phone scenes → CTA (free 7-day demo, site URL, WhatsApp +91 63571 15513, Comment "AI").
Do not show a ₹ price in videos until the site's hero (₹999) and pricing (₹1,499) agree.

## 30-day topic rotation (day = days since 2026-10-31, mod 30)
0 Deviation Investigation Writer · 1 CAPA Plan & Effectiveness Check · 2 OOS Investigation Agent · 3 Change Control Impact Agent · 4 APQR Draft Agent · 5 Audit Readiness Agent · 6 SOP Review Due Agent · 7 Training Matrix Agent · 8 FMEA Risk Assessment · 9 Schedule M Gap Checker · 10 Cleanroom EM Trend Agent · 11 Water System Trend Agent · 12 Stability Shelf-Life Agent · 13 Cold Chain Excursion Agent · 14 Calibration Due Agent · 15 Batch Release Readiness Agent · 16 Vendor Audit Agent · 17 Complaint Triage Agent · 18 Process Capability (Cpk) Agent · 19 Pharma QA Intelligence Dashboard · 20 Excel Data Cleaner Agent · 21 GST Invoice Agent · 22 Daily Sales Summary Agent · 23 Udhaar Khata Agent · 24 Lead Tracker + Auto Dashboard · 25 Power BI DAX Helper · 26 Aarohi Voice AI Receptionist · 27 Resume and Cover Letter Agent · 28 LinkedIn Post Writer Agent · 29 Whole-site intro (75 agents, free 7-day demo)
