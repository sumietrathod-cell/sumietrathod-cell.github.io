(function(){
/* Aarohan QA Analytics: 7-day free demo + signed license keys.
   Only the PUBLIC key is here. License keys can be created only with Sumit's private Master Key,
   which is never stored on this website. */
var KEY='aarohan_trial_v1',LIC='aarohan_license_v1',DAYS=7,EP='https://formspree.io/f/xrpervae',WA='916357115513';
var PUB={kty:'EC',crv:'P-256',x:'Ji_1Rd4Fw-9d-o-E2kazdMl-HQ0O-QXoEyNxiu6sVgk',y:'h2m8EkJ_cU9szuu6WkpufPA39YjEcg9Qj6amfhMJkG4',ext:true};
var agent=(document.title||'Agent').split('|')[0].trim();
var PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
var GROUPS={pharma:'apqr-agent audit-agent batchrecord-agent calibration-agent change-agent coldchain-agent complaint-agent cpk-agent doccontrol-agent equipment-agent oos-agent qa-agent rca-agent release-agent sop-agent stability-agent training-agent vendor-agent water-agent deviation-dashboard-agent fmea-agent em-agent',
 business:'booking-agent cleaner-agent crm-agent emi-agent expense-agent expense-agent-tracker fee-agent feedback-agent festival-agent inventory-agent invoice-agent invoice-followup-agent khata-agent lead-tracker-agent linkedin-agent patient-agent proposal-agent quote-agent resume-agent sales-agent',
 studio:'ai-agent-studio ask-aarohan salary-slip-agent budget-agent split-agent sip-agent'};
var GNAME={pharma:'Pharma QA bundle',business:'Business bundle',studio:'AI Agent Studio',all:'All agents'};
function groupOf(p){if(/^prompt-/.test(p))return 'studio';for(var g in GROUPS){if((' '+GROUPS[g]+' ').indexOf(' '+p+' ')>=0)return g}return 'all'}
var GROUP=groupOf(PAGE);
function covers(info){var s=info.s;if(!s||!s.length)return true;return s.indexOf('all')>=0||s.indexOf(GROUP)>=0||s.indexOf(PAGE)>=0}
function scopeText(info){var s=info.s;if(!s||!s.length)return GNAME.all;return s.map(function(x){return GNAME[x]||x.replace(/-agent$/,'').replace(/-/g,' ')+' agent'}).join(', ')}
function get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}}
function set(k,o){try{localStorage.setItem(k,JSON.stringify(o))}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function wa(t){return 'https://wa.me/'+WA+'?text='+encodeURIComponent(t)}
var css=document.createElement('style');css.textContent='.at-o{position:fixed;inset:0;background:#081a32ee;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,Segoe UI,Arial,sans-serif}.at-b{background:#fff;color:#17273c;border-radius:16px;max-width:420px;width:100%;padding:24px;max-height:100%;overflow:auto}.at-b h2{margin:0 0 6px;font-size:21px}.at-b p{margin:0 0 14px;color:#62718a;font-size:14px;line-height:1.5}.at-b input,.at-b textarea{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cdd6e3;border-radius:10px;font-size:15px;margin-bottom:10px;font-family:inherit}.at-b textarea{font-family:ui-monospace,Menlo,monospace;font-size:12px;min-height:84px;resize:vertical}.at-b button,.at-b a.at-w{display:block;width:100%;box-sizing:border-box;text-align:center;background:#081a32;color:#fff;border:0;border-radius:99px;padding:13px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;margin-top:8px}.at-b a.at-w{background:#16a34a}.at-b .at-l{background:none;color:#0e6f74;padding:8px;font-weight:600;font-size:14px;text-decoration:underline}.at-m{font-size:13px;color:#b91c1c;min-height:18px;margin:6px 0}.at-bar{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);background:#081a32;color:#d5b46d;font:13px system-ui,Segoe UI,Arial,sans-serif;padding:7px 16px;border-radius:99px;z-index:9999;box-shadow:0 4px 14px #0004;white-space:nowrap;max-width:calc(100% - 20px);overflow:hidden;text-overflow:ellipsis}.at-bar a{color:#fff;margin-left:8px;text-decoration:underline;cursor:pointer}.at-bk{position:fixed;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(52px + env(safe-area-inset-bottom,0px));z-index:9999;background:#fff;color:#081a32;border:1.5px solid #081a32;border-radius:99px;padding:8px 14px;font:600 13px system-ui,Segoe UI,Arial,sans-serif;cursor:pointer;box-shadow:0 3px 10px #0002}.at-bk:hover{background:#081a32;color:#fff}@media print{.at-bk,.at-bar,.at-lic{display:none!important}}.at-lic{position:fixed;bottom:8px;right:10px;background:#081a32cc;color:#d5b46d;font:11px system-ui,Segoe UI,Arial,sans-serif;padding:4px 10px;border-radius:99px;z-index:9999;pointer-events:none;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';document.head.appendChild(css);
function overlay(html){var o=document.createElement('div');o.className='at-o';o.innerHTML='<div class="at-b">'+html+'</div>';document.body.appendChild(o);return o}
function clearUI(){var n=document.querySelectorAll('.at-o,.at-bar');for(var i=0;i<n.length;i++)n[i].remove()}

/* ---------- license key check ---------- */
function b64d(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function today(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function verify(key){
  return new Promise(function(ok){
    try{
      key=String(key||'').replace(/\s+/g,'');
      var m=/^AQA1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key);
      if(!m||!window.crypto||!crypto.subtle){ok({ok:false,why:'invalid'});return}
      var data=new TextEncoder().encode(m[1]),sig=b64d(m[2]),info=JSON.parse(new TextDecoder().decode(b64d(m[1])));
      crypto.subtle.importKey('jwk',PUB,{name:'ECDSA',namedCurve:'P-256'},false,['verify'])
      .then(function(k){return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k,sig,data)})
      .then(function(good){
        if(!good){ok({ok:false,why:'invalid'});return}
        if(info.e&&today()>info.e){ok({ok:false,why:'expired',info:info});return}
        ok({ok:true,info:info,key:key});
      },function(){ok({ok:false,why:'invalid'})});
    }catch(e){ok({ok:false,why:'invalid'})}
  });
}
function licensed(info){
  clearUI();
  var w=document.createElement('div');w.className='at-lic';
  w.textContent='Licensed to '+info.n+(info.e?' · till '+info.e:'');
  w.title='Aarohan QA Analytics license';
  document.body.appendChild(w);
  WHO=info.n;backupBtn();
}
function keyBox(msg){
  var o=overlay('<h2>Enter your license key</h2><p>'+(msg||'Paste the license key you received from Aarohan QA Analytics. It unlocks all agents on this device.')+'</p><textarea id="at-k" placeholder="AQA1-..." spellcheck="false" autocapitalize="off"></textarea><div class="at-m" id="at-e"></div><button id="at-ok">Activate</button><a class="at-w" target="_blank" rel="noopener" href="'+wa('Hello Sumit, I want to buy a license key for the Aarohan agents ('+agent+').')+'">Buy a license on WhatsApp</a><p style="font-size:12px;margin:10px 0 0">By activating you accept the <a href="license.html" target="_blank" rel="noopener">License Agreement</a>.</p><button class="at-l" id="at-x">Back</button>');
  o.querySelector('#at-x').onclick=function(){o.remove();init(true)};
  o.querySelector('#at-ok').onclick=function(){
    var b=this,e=o.querySelector('#at-e');b.disabled=true;b.textContent='Checking...';
    verify(o.querySelector('#at-k').value).then(function(r){
      b.disabled=false;b.textContent='Activate';
      if(r.ok){addKey(r.key);if(covers(r.info)){licensed(r.info);return}e.textContent='Saved. This key covers '+scopeText(r.info)+', not this agent ('+GNAME[GROUP]+').';return}
      e.textContent=r.why==='expired'?'This key expired on '+r.info.e+'. Please renew on WhatsApp.':'This key is not valid. Please check and paste it again.';
    });
  };
}

/* ---------- Excel backup (customer keeps own data) ---------- */
var WHO='';
function cleanTxt(t){return String(t==null?'':t).replace(/\s+/g,' ').trim()}
function inUI(el){return el.closest&&el.closest('.at-o,.at-bar,.at-lic,.at-bk')}
function labelOf(el){
  var t='';
  if(el.labels&&el.labels.length)t=el.labels[0].innerText;
  if(!t&&el.closest('label'))t=el.closest('label').innerText;
  if(!t&&el.getAttribute('aria-label'))t=el.getAttribute('aria-label');
  if(!t&&el.placeholder)t=el.placeholder;
  if(t&&el.tagName==='SELECT'){[].slice.call(el.options).forEach(function(o){t=t.split(o.text).join(' ')})}
  if(t&&/^(INPUT|TEXTAREA)$/.test(el.tagName)&&el.value&&el.tagName==='TEXTAREA')t=t.split(el.value).join(' ');
  t=cleanTxt(t);
  if(!t)t=el.name||el.id||el.tagName.toLowerCase();
  return cleanTxt(t);
}
function csvCell(v){v=String(v==null?'':v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function buildBackup(){
  var rows=[],d=new Date();
  rows.push(['Aarohan QA Analytics - data backup']);
  rows.push(['Agent',agent]);
  rows.push(['Exported on',d.toLocaleString()]);
  if(WHO)rows.push(['Licensed to',WHO]);
  rows.push(['Page',location.origin+location.pathname]);
  rows.push([]);
  var inputs=[].slice.call(document.querySelectorAll('input,select,textarea')).filter(function(el){
    if(inUI(el))return false;var ty=(el.type||'').toLowerCase();
    return ['file','button','submit','reset','hidden','password','image'].indexOf(ty)<0;
  });
  if(inputs.length){
    rows.push(['ENTRIES']);rows.push(['Field','Value']);
    inputs.forEach(function(el){
      var ty=(el.type||'').toLowerCase(),v;
      if(ty==='checkbox')v=el.checked?'Yes':'No';
      else if(ty==='radio'){if(!el.checked)return;v=el.value}
      else if(el.tagName==='SELECT')v=el.options[el.selectedIndex]?el.options[el.selectedIndex].text:'';
      else v=el.value;
      rows.push([labelOf(el),v]);
    });
    rows.push([]);
  }
  [].slice.call(document.querySelectorAll('table')).forEach(function(tb,i){
    if(inUI(tb))return;
    rows.push(['TABLE '+(i+1)]);
    [].slice.call(tb.rows).forEach(function(tr){rows.push([].slice.call(tr.cells).map(function(c){return cleanTxt(c.innerText)}))});
    rows.push([]);
  });
  var outs=[].slice.call(document.querySelectorAll('pre,output,[id="o"],[id="out"],[id="result"]')).filter(function(el){return !inUI(el)&&cleanTxt(el.innerText)&&!el.querySelector('table')});
  if(outs.length){rows.push(['RESULT']);outs.forEach(function(el){el.innerText.split(/\n+/).forEach(function(l){l=cleanTxt(l);if(l)rows.push([l])})});}
  return '﻿'+rows.map(function(r){return r.map(csvCell).join(',')}).join('\r\n');
}
function downloadBackup(){
  try{
    var blob=new Blob([buildBackup()],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a'),d=new Date();
    a.href=URL.createObjectURL(blob);
    a.download=agent.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')+'_backup_'+d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)+'.csv';
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);
  }catch(e){alert('Backup could not be created on this browser.')}
}
function backupBtn(){
  if(document.querySelector('.at-bk'))return;
  var b=document.createElement('button');b.className='at-bk';b.type='button';
  b.textContent='Download Excel backup';b.title='Save your entries and results as an Excel (CSV) file on this device';
  b.onclick=downloadBackup;document.body.appendChild(b);
}
window.aarohanBackup=downloadBackup;
window.aarohanEnterKey=keyBox;
function savedKeys(){var o=get(LIC);if(!o)return[];if(o.key)return[o.key];return o.keys||[]}
function addKey(k){var a=savedKeys().filter(function(x){return x!==k});a.unshift(k);set(LIC,{keys:a.slice(0,10)})}
function dropKey(k){set(LIC,{keys:savedKeys().filter(function(x){return x!==k})})}
function notCovered(info){var o=overlay('<h2>This agent is not in your license</h2><p>Your license for '+esc(info.n)+' covers: <b>'+esc(scopeText(info))+'</b>. '+esc(agent)+' is part of the '+esc(GNAME[GROUP])+'.</p><a class="at-w" target="_blank" rel="noopener" href="'+wa('Hello Sumit, I have a license ('+scopeText(info)+') and want to add the '+agent+'.')+'">Upgrade on WhatsApp</a><button id="at-have">Enter another key</button>');o.querySelector('#at-have').onclick=function(){o.remove();keyBox()}}

/* ---------- 7-day demo ---------- */
function bar(left){var b=document.createElement('div');b.className='at-bar';b.innerHTML='Free demo: '+left+' day'+(left===1?'':'s')+' left <a id="at-key">Enter key</a><a target="_blank" rel="noopener" href="'+wa('Hello Sumit, I tried the '+agent+' demo and want a license.')+'">Buy license</a>';document.body.appendChild(b);b.querySelector('#at-key').onclick=function(){keyBox()};backupBtn()}
function expired(){var o=overlay('<h2>Your 7-day free demo has ended</h2><p>Thank you for trying the Aarohan agents. To keep using them, buy a license key on WhatsApp, then enter it here.</p><a class="at-w" target="_blank" rel="noopener" href="'+wa('Hello Sumit, my free demo ended. I want a license key for the '+agent+'.')+'">Buy license on WhatsApp</a><button id="at-have">I have a license key</button>');o.querySelector('#at-have').onclick=function(){o.remove();keyBox()}}
function ask(){var o=overlay('<h2>Try this agent free for 7 days</h2><p>Enter your details to open the demo. One signup unlocks all agents on this site for 7 days.</p><input id="at-n" placeholder="Your name" autocomplete="name"><input id="at-c" placeholder="Email or WhatsApp number" autocomplete="email"><div class="at-m" id="at-e"></div><button id="at-go">Start free demo</button><button class="at-l" id="at-have">I already have a license key</button>');
o.querySelector('#at-have').onclick=function(){o.remove();keyBox()};
o.querySelector('#at-go').onclick=function(){var n=o.querySelector('#at-n').value.trim(),c=o.querySelector('#at-c').value.trim(),e=o.querySelector('#at-e');if(n.length<2||c.length<5){e.textContent='Please enter your name and an email or phone number.';return}
var b=this;b.disabled=true;b.textContent='Please wait...';var d=new FormData();d.append('name',n);d.append('contact',c);d.append('first_agent',agent);d.append('page',location.href);d.append('_subject','Demo trial started: '+agent+' ('+n+')');
var done=function(){set(KEY,{start:Date.now(),name:n});o.remove();bar(DAYS)};
fetch(EP,{method:'POST',body:d,headers:{'Accept':'application/json'}}).then(done,done)}}
function trial(){var t=get(KEY);if(!t){ask();return}var used=(Date.now()-t.start)/864e5;if(used>=DAYS){expired();return}bar(Math.max(1,Math.ceil(DAYS-used)))}

/* ---------- start ---------- */
function init(skipLicense){
  if(skipLicense){trial();return}
  var fromUrl=null;try{fromUrl=new URLSearchParams(location.search).get('key')}catch(e){}
  if(fromUrl){try{var u=new URL(location.href);u.searchParams.delete('key');history.replaceState(null,'',u.toString())}catch(e){}}
  var keys=savedKeys();if(fromUrl)keys=[fromUrl].concat(keys.filter(function(x){return x!==fromUrl}));
  if(!keys.length){trial();return}
  Promise.all(keys.map(verify)).then(function(rs){
    var hit=null,other=null,exp=null;
    rs.forEach(function(r,i){
      if(r.ok){if(!hit&&covers(r.info))hit=r;else if(!other)other=r}
      else{if(r.why==='expired'&&!exp)exp=r;if(!(fromUrl&&keys[i]===fromUrl))dropKey(keys[i])}
    });
    if(fromUrl&&rs[0].ok)addKey(fromUrl);
    if(hit){licensed(hit.info);return}
    if(other){notCovered(other.info);return}
    if(exp){keyBox('Your license expired on '+esc(exp.info.e)+'. Please renew on WhatsApp and paste the new key.');return}
    trial();
  });
}
if(document.body)init();else document.addEventListener('DOMContentLoaded',function(){init()})})();
