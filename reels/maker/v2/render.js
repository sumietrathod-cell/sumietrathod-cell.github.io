// Usage: node render.js <workdir> <out.mp4>
// workdir must contain template.html, config.js and the screenshots named in config.js.
// Renders 30 fps frames with Playwright, encodes H.264, then adds music from ../music.py.
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const path=require('path'),fs=require('fs');
const dir=path.resolve(process.argv[2]),outp=path.resolve(process.argv[3]);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+dir+'/template.html');await p.waitForLoadState('networkidle');await p.evaluate(()=>document.fonts.ready);
const total=await p.evaluate(()=>window.TOTAL);const N=Math.round(total*30);const tmp=outp.replace(/\.mp4$/,'')+'.video.tmp.mp4';
const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-r','30',tmp]);
for(let i=0;i<N;i++){await p.evaluate(t=>setT(t),(i+0.01)/30);const buf=await p.screenshot({type:'jpeg',quality:92});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
ff.stdin.end();const code=await new Promise(r=>ff.on('close',r));await b.close();if(code)process.exit(code);
execFileSync('python3',[path.join(__dirname,'..','music.py'),String(total+0.5)],{cwd:dir});
const fin=outp.replace(/\.mp4$/,'')+'.tmp.mp4';
execFileSync('ffmpeg',['-y','-v','error','-i',tmp,'-i',path.join(dir,'music.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',fin]);
fs.renameSync(fin,outp);fs.unlinkSync(tmp);console.log(outp,total.toFixed(1)+'s');})();
