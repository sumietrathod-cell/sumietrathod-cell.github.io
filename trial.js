(function(){
/* Aarohan QA Analytics: 7-day free demo + signed license keys.
   Only the PUBLIC key is here. License keys can be created only with Sumit's private Master Key,
   which is never stored on this website. */
/* License server (Cloudflare Worker). Empty = signature check only. */
var LICSERVER='';
var KEY='aarohan_trial_v1',LIC='aarohan_license_v1',DAYS=7,EP='https://formspree.io/f/xrpervae',WA='916357115513';
var PUB={kty:'EC',crv:'P-256',x:'Ji_1Rd4Fw-9d-o-E2kazdMl-HQ0O-QXoEyNxiu6sVgk',y:'h2m8EkJ_cU9szuu6WkpufPA39YjEcg9Qj6amfhMJkG4',ext:true};
var agent=(document.title||'Agent').split('|')[0].trim();
var PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
var GROUPS={pharma:'apqr-agent audit-agent batchrecord-agent calibration-agent change-agent coldchain-agent complaint-agent cpk-agent doccontrol-agent equipment-agent oos-agent qa-agent rca-agent release-agent sop-agent stability-agent training-agent vendor-agent water-agent deviation-dashboard-agent fmea-agent em-agent schedule-m-agent scorecard-agent',
 business:'booking-agent cleaner-agent crm-agent emi-agent expense-agent expense-agent-tracker fee-agent feedback-agent festival-agent inventory-agent invoice-agent invoice-followup-agent khata-agent lead-tracker-agent linkedin-agent patient-agent proposal-agent quote-agent resume-agent sales-agent',
 premium:'apqr-pro-agent',
 studio:'ai-agent-studio ask-aarohan salary-slip-agent budget-agent split-agent sip-agent'};
var GNAME={premium:'APQR Pro',pharma:'Pharma QA bundle',business:'Business bundle',studio:'AI Agent Studio',all:'All agents'};
function groupOf(p){if(/^prompt-/.test(p))return 'studio';for(var g in GROUPS){if((' '+GROUPS[g]+' ').indexOf(' '+p+' ')>=0)return g}return 'all'}
var GROUP=groupOf(PAGE);
function covers(info){var s=info.s;if(GROUP==='premium')return !!(s&&(s.indexOf('premium')>=0||s.indexOf(PAGE)>=0));if(!s||!s.length)return true;return s.indexOf('all')>=0||s.indexOf(GROUP)>=0||s.indexOf(PAGE)>=0}
function scopeText(info){var s=info.s;if(!s||!s.length)return GNAME.all;return s.map(function(x){return GNAME[x]||x.replace(/-agent$/,'').replace(/-/g,' ')+' agent'}).join(', ')}
function get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}}
function set(k,o){try{localStorage.setItem(k,JSON.stringify(o))}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function wa(t){return 'https://wa.me/'+WA+'?text='+encodeURIComponent(t)}
var css=document.createElement('style');css.textContent='.at-o{position:fixed;inset:0;background:#081a32ee;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,Segoe UI,Arial,sans-serif}.at-b{background:#fff;color:#17273c;border-radius:16px;max-width:420px;width:100%;padding:24px;max-height:100%;overflow:auto}.at-b h2{margin:0 0 6px;font-size:21px}.at-b p{margin:0 0 14px;color:#62718a;font-size:14px;line-height:1.5}.at-b input,.at-b textarea{width:100%;box-sizing:border-box;padding:12px;border:1px solid #cdd6e3;border-radius:10px;font-size:15px;margin-bottom:10px;font-family:inherit}.at-b textarea{font-family:ui-monospace,Menlo,monospace;font-size:12px;min-height:84px;resize:vertical}.at-b button,.at-b a.at-w{display:block;width:100%;box-sizing:border-box;text-align:center;background:#081a32;color:#fff;border:0;border-radius:99px;padding:13px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;margin-top:8px}.at-b a.at-w{background:#16a34a}.at-b .at-l{background:none;color:#0e6f74;padding:8px;font-weight:600;font-size:14px;text-decoration:underline}.at-m{font-size:13px;color:#b91c1c;min-height:18px;margin:6px 0}.at-bar{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);background:#081a32;color:#d5b46d;font:13px system-ui,Segoe UI,Arial,sans-serif;padding:7px 16px;border-radius:99px;z-index:9999;box-shadow:0 4px 14px #0004;white-space:nowrap;max-width:calc(100% - 20px);overflow:hidden;text-overflow:ellipsis}.at-bar a{color:#fff;margin-left:8px;text-decoration:underline;cursor:pointer}.at-bp{display:none;align-items:center;gap:14px;padding:10px 0 14px;margin-bottom:10px;border-bottom:2px solid #081a32;font:13px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#17273c}.at-bp img{height:56px;max-width:160px;object-fit:contain}.at-bp b{display:block;font-size:17px}.at-bp span{display:block;color:#4f5d75}@media print{.at-bp{display:flex!important}}.at-tools{position:fixed;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(52px + env(safe-area-inset-bottom,0px));z-index:9999;display:flex;flex-direction:column;gap:6px;align-items:flex-start}.at-xn{font-size:12px;color:#62718a;margin:4px 0}.at-bk{background:#fff;color:#081a32;border:1.5px solid #081a32;border-radius:99px;padding:8px 14px;font:600 13px system-ui,Segoe UI,Arial,sans-serif;cursor:pointer;box-shadow:0 3px 10px #0002}.at-bk:hover{background:#081a32;color:#fff}@media print{.at-tools,.at-bk,.at-bar,.at-lic{display:none!important}}.at-lic{position:fixed;bottom:8px;right:10px;background:#081a32cc;color:#d5b46d;font:11px system-ui,Segoe UI,Arial,sans-serif;padding:4px 10px;border-radius:99px;z-index:9999;pointer-events:none;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';document.head.appendChild(css);
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
      if(r.ok){addKey(r.key);if(covers(r.info)){gate(r,function(){licensed(r.info)});return}e.textContent='Saved. This key covers '+scopeText(r.info)+', not this agent ('+GNAME[GROUP]+').';return}
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
  if(el.labels&&el.labels.length)t=el.labels[0].textContent;
  if(!t&&el.closest('label'))t=el.closest('label').textContent;
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
  if(document.querySelector('.at-tools'))return;
  var w=document.createElement('div');w.className='at-tools';
  var mk=function(t,ti,fn,id){var x=document.createElement('button');x.className='at-bk';x.type='button';x.textContent=t;x.title=ti;x.onclick=fn;if(id)x.id=id;w.appendChild(x);return x};
  var fileInp=document.querySelector('input[type=file]:not(.at-x)');
  MODE=fileInp?'file':(fields().length?'form':'');
  mk('How to use','Step-by-step help for this agent',helpMenu,'at-help');
  mk('My company','Add your logo, company name and address to this agent and its reports',brandMenu,'at-brand');
  if(MODE)mk('Live data','Keep this dashboard updated from your Google Sheet or last Excel file',liveMenu,'at-live');
  if(MODE==='form')mk('Fill from Excel','Upload an Excel file to fill this form',fillMenu);
  mk('Download Excel backup','Save your entries and results as an Excel (CSV) file on this device',downloadBackup);
  document.body.appendChild(w);
  if(MODE==='file')excelForCsv();
  applyBrand(true);
  if(MODE)setTimeout(autoLoad,60);
}
/* ---------- Excel upload for every agent ---------- */
var XL=null;
function needXLSX(cb){if(window.XLSX)return cb();if(XL){XL.push(cb);return}XL=[cb];var sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';sc.onload=function(){var q=XL;XL=[];q.forEach(function(f){f()})};sc.onerror=function(){alert('Excel support needs an internet connection. Please try again.');XL=null};document.head.appendChild(sc)}
function fields(){var seen={},out=[];[].slice.call(document.querySelectorAll('input,select,textarea')).forEach(function(el){
  if(inUI(el))return;var ty=(el.type||'').toLowerCase();if(['file','button','submit','reset','hidden','password','image'].indexOf(ty)>=0)return;
  if(ty==='radio'){var g=el.closest('[role=radiogroup]'),n=el.name;if(!n||seen['r:'+n])return;seen['r:'+n]=1;out.push({k:'radio',name:n,label:cleanTxt(g&&g.getAttribute('aria-label')||n)});return}
  out.push({k:'el',el:el,label:labelOf(el)})});
 var cnt={};out.forEach(function(f){cnt[f.label]=(cnt[f.label]||0)+1});var idx={};out.forEach(function(f){if(cnt[f.label]>1){idx[f.label]=(idx[f.label]||0)+1;f.label=f.label+' ('+idx[f.label]+')'}});return out}
function curVal(f){if(f.k==='radio'){var c=document.querySelector('input[name="'+f.name+'"]:checked');return c?(c.closest('label')?cleanTxt(c.closest('label').textContent):c.value):''}var el=f.el,ty=(el.type||'').toLowerCase();if(ty==='checkbox')return el.checked?'Yes':'No';if(el.tagName==='SELECT')return el.options[el.selectedIndex]?el.options[el.selectedIndex].text:'';return el.value}
function norm(t){return String(t||'').toLowerCase().replace(/[^a-z0-9]+/g,'')}
function setVal(f,v){v=v==null?'':String(v).trim();if(f.k==='radio'){var rs=document.querySelectorAll('input[name="'+f.name+'"]');[].slice.call(rs).forEach(function(r){var t=r.closest('label')?cleanTxt(r.closest('label').textContent):r.value;if(norm(t)===norm(v)||norm(r.value)===norm(v)){r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}))}});return}
 var el=f.el,ty=(el.type||'').toLowerCase();if(ty==='checkbox'){el.checked=/^(y|yes|true|1|done|ready|ok)$/i.test(v)}
 else if(el.tagName==='SELECT'){var o=[].slice.call(el.options).filter(function(o){return norm(o.text)===norm(v)||norm(o.value)===norm(v)})[0];if(o)el.value=o.value}
 else if(ty==='date'&&v&&!/^\d{4}-\d{2}-\d{2}$/.test(v)){var d=new Date(v);if(!isNaN(d))el.value=d.toISOString().slice(0,10)}
 else el.value=v;
 el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function template(){needXLSX(function(){var F=fields(),wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([F.map(function(f){return f.label}),F.map(curVal)]),'Data');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['How to fill'],['Row 1 holds the field names: keep them as they are.'],['Add one row per record. Row 2 shows the example values on the page.'],['Upload the file with "Fill from Excel" on the '+agent+' page and pick the row to use.']]),'Read me');
 XLSX.writeFile(wb,agent.replace(/[^A-Za-z0-9]+/g,'_')+'_template.xlsx')})}
/* ---------- form agents: rows from Excel or Sheet ---------- */
function matchMap(rows){var F=fields(),keys=Object.keys(rows[0]||{});return {F:F,keys:keys,map:F.map(function(f){return keys.filter(function(k){return norm(k)===norm(f.label)})[0]||keys.filter(function(k){return norm(k)&&(norm(f.label).indexOf(norm(k))===0||norm(k).indexOf(norm(f.label))===0)})[0]})}}
function goRun(){var go=window.run||window.calc||window.go;if(typeof go==='function'){try{go()}catch(x){}}else{var bt=[].slice.call(document.querySelectorAll('main button,button')).filter(function(b){return !inUI(b)&&!b.classList.contains('g2')})[0];if(bt)bt.click()}}
function applyRow(rows,r){var M=matchMap(rows);M.F.forEach(function(f,i){if(M.map[i]!==undefined&&rows[r][M.map[i]]!==undefined)setVal(f,rows[r][M.map[i]])});goRun()}
function readRows(buf,cb,err){needXLSX(function(){try{var wb=XLSX.read(buf,{type:typeof buf==='string'?'string':'array',cellDates:true});cb(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{raw:false,defval:'',dateNF:'yyyy-mm-dd'}))}catch(x){err&&err()}})}
function fillMenu(){var o=overlay('<h2>Fill from Excel</h2><p>Upload an Excel or CSV file with the field names in the first row. Not sure of the format? Download the template for this agent first.</p><input type="file" class="at-x" id="at-xf" accept=".xlsx,.xls,.csv"><div class="at-m" id="at-xm"></div><div id="at-xr"></div><button id="at-xt">Download Excel template</button><button class="at-l" id="at-xc">Close</button>');
 o.querySelector('#at-xc').onclick=function(){o.remove()};o.querySelector('#at-xt').onclick=template;
 o.querySelector('#at-xf').onchange=function(){var file=this.files[0];if(!file)return;var m=o.querySelector('#at-xm');m.style.color='#62718a';m.textContent='Reading '+file.name+'...';
  var rd=new FileReader();rd.onload=function(e){readRows(new Uint8Array(e.target.result),function(rows){
   if(!rows.length){m.style.color='#b91c1c';m.textContent='This file has no data rows.';return}
   var M=matchMap(rows),hit=M.map.filter(Boolean).length;if(!hit){m.style.color='#b91c1c';m.textContent='None of the column names match this form. Download the template and copy your data into it.';return}
   var pick=function(r){saveSrc({kind:'rows',name:file.name,rows:rows,idx:r,last:r===rows.length-1});o.remove();applyRow(rows,r);liveBadge()};
   if(rows.length===1){pick(0);return}
   m.style.color='#166534';m.textContent=rows.length+' rows found, '+hit+' of '+M.F.length+' fields matched. Choose the row to fill:';
   var first=M.keys[0],box=o.querySelector('#at-xr');box.innerHTML='<div style="max-height:240px;overflow:auto;border:1px solid #cdd6e3;border-radius:10px;margin-bottom:8px">'+rows.map(function(r,i){return '<button type="button" data-i="'+i+'" style="display:block;width:100%;text-align:left;background:#fff;color:#17273c;border:0;border-bottom:1px solid #eef1f6;border-radius:0;padding:10px 12px;margin:0;font-weight:500">'+(i+1)+'. '+esc(cleanTxt(r[first]))+(M.keys[1]?' · '+esc(cleanTxt(r[M.keys[1]])):'')+'</button>'}).join('')+'</div>';
   [].slice.call(box.querySelectorAll('button')).forEach(function(b){b.onclick=function(){pick(+b.getAttribute('data-i'))}})
  },function(){m.style.color='#b91c1c';m.textContent='Could not read this file. Use the template for this agent.'})};rd.readAsArrayBuffer(file)}}
/* ---------- file agents: remember and replay ---------- */
function mainFile(){return document.querySelector('input[type=file]:not(.at-x)')}
function b64e(buf){var u=new Uint8Array(buf),s='';for(var i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}
function b64d2(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function feedFile(inp,file){var dt=new DataTransfer();dt.items.add(file);inp.files=dt.files;inp._replay=1;inp.dispatchEvent(new Event('change',{bubbles:true}));inp._replay=0}
function excelForCsv(){[].slice.call(document.querySelectorAll('input[type=file]:not(.at-x)')).forEach(function(inp){var a=inp.getAttribute('accept')||'';if(/csv/i.test(a)&&!/xlsx/i.test(a)){inp.setAttribute('accept',a+',.xlsx,.xls');inp.setAttribute('data-x','1');var n=document.createElement('div');n.className='at-xn';n.textContent='Excel files (.xlsx) work too.';(inp.closest('label')||inp).insertAdjacentElement('afterend',n)}});
 document.addEventListener('change',function(e){var inp=e.target;if(!inp||inp.type!=='file'||inp.classList.contains('at-x')||inp._xl)return;var f=inp.files&&inp.files[0];if(!f)return;
  if(!inp._replay&&f.size<1500000){var rd0=new FileReader();rd0.onload=function(ev){saveSrc({kind:'file',name:f.name,type:f.type,data:b64e(ev.target.result)});liveBadge()};rd0.readAsArrayBuffer(f)}
  if(!inp.getAttribute('data-x')||!/\.xlsx?$/i.test(f.name))return;e.stopImmediatePropagation();
  needXLSX(function(){var rd=new FileReader();rd.onload=function(ev){try{var wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array',cellDates:true}),csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]],{dateNF:'yyyy-mm-dd'});
   var dt=new DataTransfer();dt.items.add(new File([csv],f.name.replace(/\.xlsx?$/i,'.csv'),{type:'text/csv'}));inp.files=dt.files;inp._xl=1;inp.dispatchEvent(new Event('change',{bubbles:true}));inp._xl=0}catch(x){alert('Could not read this Excel file.')}};rd.readAsArrayBuffer(f)})},true)}


/* ---------- in-agent help ---------- */
function helpMenu(){var hasF=MODE==='file',hasForm=MODE==='form';
 var steps=['<b>See the sample:</b> the agent opens with example data so you can see a full result first.',
  hasF?'<b>Load your data:</b> use the upload box on this page. Excel (.xlsx) and CSV both work. Keep the column names shown in the sample.':'<b>Enter your data:</b> replace the sample values with yours, then tap the main button on the page.',
  hasForm?'<b>Fill from Excel:</b> tap Fill from Excel, download the template, add one row per record, upload it and pick the row.':'',
  MODE?'<b>Live data:</b> keep your data in your own Google Sheet, publish it as CSV (File, Share, Publish to web) and paste the link under Live data. The agent updates every time you open it.':'',
  '<b>My company:</b> add your logo, name, address and GST once; they show on every agent and on printed reports.',
  '<b>Results:</b> green = OK, amber = watch, red = action. Use Copy or Print / save PDF to share.',
  '<b>Backup:</b> tap Download Excel backup at the end of each session. Your data stays in this browser and is not sent to us.'].filter(Boolean);
 var o=overlay('<h2>How to use: '+esc(agent)+'</h2><ol style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.55;color:#17273c">'+steps.map(function(x){return '<li style="margin:6px 0">'+x+'</li>'}).join('')+'</ol>'+
  '<p style="font-size:13px">Outputs are drafts for review under your SOP.</p><a class="at-w" style="background:#081a32" href="guide.html" target="_blank" rel="noopener">Open the full customer guide</a><a class="at-w" target="_blank" rel="noopener" href="'+wa('Hello Sumit, I need help with the '+agent+'.')+'" style="margin-top:8px">Ask on WhatsApp</a><button class="at-l" id="at-hc">Close</button>');
 o.querySelector('#at-hc').onclick=function(){o.remove()}}
/* ---------- customer branding: logo, name, address ---------- */
var BK='aarohan_brand_v1',HDR0=null;
function getBrand(){return get(BK)||{}}
var BF=[['name','Company name',/^(business|company|organi[sz]ation|firm|shop|clinic|hospital|school|institute|site)( name)?$|business name|company name|organi[sz]ation name|shop name|clinic name|your business$/i],['addr','Address',/address/i],['phone','Phone / WhatsApp',/phone|whatsapp|mobile|contact no/i],['email','Email',/e-?mail/i],['gst','GST / licence no.',/gst|gstin|licen[cs]e no|drug licen/i]];
function applyBrand(prefill){var b=getBrand(),h=document.querySelector('header');
 if(h){var box=h.firstElementChild;if(HDR0===null&&box)HDR0=box.innerHTML;
  if(box){if(b.name||b.logo){box.innerHTML=(b.logo?'<img src="'+b.logo+'" alt="" style="height:30px;max-width:120px;object-fit:contain;vertical-align:middle;margin-right:10px;background:#fff;border-radius:6px;padding:2px">':'')+'<span style="font-weight:800;letter-spacing:.04em;vertical-align:middle">'+esc(b.name||'')+'</span><span style="display:block;font-size:10px;letter-spacing:.08em;opacity:.7;margin-top:2px">POWERED BY AAROHAN QA ANALYTICS</span>'}else if(HDR0!==null)box.innerHTML=HDR0}}
 var pr=document.getElementById('at-bp');if(pr)pr.remove();
 if(b.name||b.logo){pr=document.createElement('div');pr.id='at-bp';pr.className='at-bp';pr.innerHTML=(b.logo?'<img src="'+b.logo+'" alt="">':'')+'<div><b>'+esc(b.name||'')+'</b>'+[b.addr,[b.phone,b.email].filter(Boolean).join(' · '),b.gst?'GST / Licence: '+b.gst:''].filter(Boolean).map(function(x){return '<span>'+esc(x)+'</span>'}).join('')+'</div>';
  var m=document.querySelector('main')||document.body;m.insertBefore(pr,m.firstChild)}
 window.aarohanBrand=b;
 if(prefill){var changed=false;fields().forEach(function(f){if(f.k!=='el')return;var el=f.el,ty=(el.type||'').toLowerCase();if(el.tagName==='SELECT'||ty==='checkbox'||ty==='radio'||ty==='number'||ty==='date')return;
  for(var i=0;i<BF.length;i++){var v=b[BF[i][0]];if(v&&BF[i][2].test(f.label)&&(el.value===el.defaultValue||el.value===''||el.value===el._ab)){if(el.value!==v){el.value=v;el._ab=v;el.dispatchEvent(new Event('input',{bubbles:true}));changed=true}break}}});
  if(changed&&!get(SRCK))goRun()}}
function brandMenu(){var b=getBrand();var o=overlay('<h2>My company</h2><p>Your logo and details appear at the top of every agent and on printed or PDF reports. Saved only in this browser.</p>'+
 '<label style="font-size:13px;font-weight:600">Logo (PNG or JPG)</label><div style="display:flex;gap:10px;align-items:center;margin:4px 0 10px"><img id="at-bl" alt="" style="height:44px;max-width:140px;object-fit:contain;border:1px solid #cdd6e3;border-radius:8px;padding:2px;'+(b.logo?'':'display:none')+'" src="'+(b.logo||'')+'"><input type="file" class="at-x" id="at-bf" accept="image/png,image/jpeg,image/webp" style="margin:0"></div>'+
 BF.map(function(f){return '<input id="at-b'+f[0]+'" placeholder="'+f[1]+'" value="'+esc(b[f[0]]||'')+'" aria-label="'+f[1]+'">'}).join('')+
 '<div class="at-m" id="at-bm"></div><button id="at-bs">Save</button>'+(b.name||b.logo?'<button class="at-l" id="at-bx">Remove my company details</button>':'')+'<button class="at-l" id="at-bc">Close</button>');
 var logo=b.logo||'';o.querySelector('#at-bc').onclick=function(){o.remove()};
 o.querySelector('#at-bf').onchange=function(){var f=this.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(e){var im=new Image();im.onload=function(){var sc=Math.min(1,360/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);c.getContext('2d').drawImage(im,0,0,c.width,c.height);logo=c.toDataURL(/png|webp/.test(f.type)?'image/png':'image/jpeg',0.9);var p=o.querySelector('#at-bl');p.src=logo;p.style.display=''};im.onerror=function(){o.querySelector('#at-bm').textContent='This image could not be read. Use a PNG or JPG file.'};im.src=e.target.result};rd.readAsDataURL(f)};
 o.querySelector('#at-bs').onclick=function(){var nb={logo:logo};BF.forEach(function(f){nb[f[0]]=o.querySelector('#at-b'+f[0]).value.trim()});if(!nb.name&&!nb.logo){o.querySelector('#at-bm').textContent='Add at least a company name or a logo.';return}
  try{localStorage.setItem(BK,JSON.stringify(nb))}catch(e){o.querySelector('#at-bm').textContent='Could not save. The logo may be too large; try a smaller image.';return}o.remove();applyBrand(true);toast('Saved. Your company details now show in every agent on this browser.')};
 var x=o.querySelector('#at-bx');if(x)x.onclick=function(){try{localStorage.removeItem(BK)}catch(e){}o.remove();applyBrand(false);toast('Company details removed.')}}
window.aarohanBrandHtml=function(){var e=document.getElementById('at-bp');return e?e.outerHTML:''};
/* ---------- live data: Google Sheet link or last file ---------- */
var MODE='',SRCK='aarohan_src_'+(PAGE||'page');
function getSrc(){return get(SRCK)||{}}
function saveSrc(o){var s=getSrc();if(o.kind!=='url'&&s.url)o.url=s.url;o.at=Date.now();try{localStorage.setItem(SRCK,JSON.stringify(o))}catch(e){try{delete o.data;delete o.rows;localStorage.setItem(SRCK,JSON.stringify(o))}catch(x){}}}
function sheetCsvUrl(u){u=String(u||'').trim();var m=u.match(/docs\.google\.com\/spreadsheets\/d\/(e\/)?([A-Za-z0-9_-]+)/);if(!m)return u;if(m[1])return 'https://docs.google.com/spreadsheets/d/e/'+m[2]+'/pub?output=csv'+((u.match(/[?&#]gid=(\d+)/)||[])[1]?'&gid='+u.match(/[?&#]gid=(\d+)/)[1]:'');var g=(u.match(/[?&#]gid=(\d+)/)||[])[1];return 'https://docs.google.com/spreadsheets/d/'+m[2]+'/export?format=csv'+(g?'&gid='+g:'')}
function ago(t){var m=Math.round((Date.now()-t)/60000);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' days ago'}
function liveBadge(msg){var b=document.getElementById('at-live');if(!b)return;var s=getSrc();b.textContent=s.url?'Live: Google Sheet':(s.kind?'Last file: '+(s.name||'Excel'):'Live data');if(msg)b.title=msg;b.style.borderColor=s.url?'#16a34a':'';b.style.color=s.url?'#166534':''}
function loadUrl(u,done,fail){fetch(sheetCsvUrl(u),{cache:'no-store'}).then(function(r){if(!r.ok)throw r.status;return r.text()}).then(function(t){if(/^\s*<(!doctype|html)/i.test(t))throw 'html';
  if(MODE==='file'){var inp=mainFile();feedFile(inp,new File([t],'google-sheet.csv',{type:'text/csv'}));done&&done(t.split(/\n/).length-1)}
  else readRows(t,function(rows){if(!rows.length)return fail&&fail('empty');var s=getSrc(),i=s.last===false&&s.idx<rows.length?s.idx:rows.length-1;applyRow(rows,i);done&&done(rows.length)},function(){fail&&fail('parse')})
 }).catch(function(x){fail&&fail(x)})}
function autoLoad(){var s=getSrc();if(!s.kind&&!s.url)return;
 var fromFile=function(){if(s.kind==='file'&&s.data&&MODE==='file'){var inp=mainFile();if(inp)feedFile(inp,new File([b64d2(s.data)],s.name||'data.csv',{type:s.type||''}))}else if(s.kind==='rows'&&s.rows&&MODE==='form'){applyRow(s.rows,Math.min(s.idx||0,s.rows.length-1))}liveBadge('Loaded '+(s.name||'your last file')+' saved '+ago(s.at))};
 if(s.url)loadUrl(s.url,function(n){s.at=Date.now();try{localStorage.setItem(SRCK,JSON.stringify(s))}catch(e){}liveBadge('Updated from Google Sheet just now ('+n+' rows)')},function(){fromFile();toast('Could not reach your Google Sheet. Showing your last saved data.')});
 else fromFile()}
function toast(t){var d=document.createElement('div');d.className='at-bar';d.style.bottom='calc(10px + env(safe-area-inset-bottom,0px))';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},5000)}
function liveMenu(){var s=getSrc();var o=overlay('<h2>Live data</h2><p>Keep your data in a Google Sheet and this '+(MODE==='file'?'dashboard':'agent')+' updates itself every time you open it. You only maintain the Sheet.</p>'+
 '<ol style="margin:0 0 12px;padding-left:18px;color:#62718a;font-size:13px;line-height:1.6"><li>Put your data in Google Sheets with the same columns as the Excel template.</li><li>In Google Sheets: File &gt; Share &gt; Publish to web &gt; choose the sheet &gt; CSV &gt; Publish.</li><li>Copy the link and paste it here.</li></ol>'+
 '<input id="at-lu" placeholder="https://docs.google.com/spreadsheets/..." value="'+esc(s.url||'')+'"><div class="at-m" id="at-lm">'+(s.url?'Connected. Last update '+ago(s.at)+'.':(s.kind?'Without a link, this page reopens with your last file: '+esc(s.name||'')+' ('+ago(s.at)+').':''))+'</div>'+
 '<button id="at-ls">Connect and load now</button>'+(s.url?'<button id="at-lr" style="background:#fff;color:#081a32;border:1.5px solid #081a32">Refresh now</button>':'')+(s.kind||s.url?'<button class="at-l" id="at-ld">Disconnect and forget saved data</button>':'')+'<button class="at-l" id="at-lc">Close</button>');
 var m=o.querySelector('#at-lm');o.querySelector('#at-lc').onclick=function(){o.remove()};
 var go=function(u){m.style.color='#62718a';m.textContent='Loading your Google Sheet...';loadUrl(u,function(n){var x=getSrc();x.url=u;x.at=Date.now();if(!x.kind)x.kind='url';try{localStorage.setItem(SRCK,JSON.stringify(x))}catch(e){}liveBadge();o.remove();toast('Loaded '+n+' rows from your Google Sheet. It will update every time you open this page.')},function(err){m.style.color='#b91c1c';m.textContent=err==='html'||err===401||err===403||err===404?'The Sheet is not published. In Google Sheets use File > Share > Publish to web > CSV, then paste that link.':'Could not load this link. Check it is published to the web as CSV and your internet is on.'})};
 o.querySelector('#at-ls').onclick=function(){var u=o.querySelector('#at-lu').value.trim();if(!/^https:\/\//.test(u)){m.style.color='#b91c1c';m.textContent='Paste the full link that starts with https://';return}go(u)};
 var r=o.querySelector('#at-lr');if(r)r.onclick=function(){go(s.url)};
 var d=o.querySelector('#at-ld');if(d)d.onclick=function(){try{localStorage.removeItem(SRCK)}catch(e){}liveBadge();o.remove();toast('Disconnected. Saved data removed from this browser.')}}
window.aarohanBackup=downloadBackup;
window.aarohanEnterKey=keyBox;
function savedKeys(){var o=get(LIC);if(!o)return[];if(o.key)return[o.key];return o.keys||[]}
function addKey(k){var a=savedKeys().filter(function(x){return x!==k});a.unshift(k);set(LIC,{keys:a.slice(0,10)})}
function dropKey(k){set(LIC,{keys:savedKeys().filter(function(x){return x!==k})})}
function notCovered(info){var o=overlay('<h2>This agent is not in your license</h2><p>Your license for '+esc(info.n)+' covers: <b>'+esc(scopeText(info))+'</b>. '+esc(agent)+' is part of the '+esc(GNAME[GROUP])+'.</p><a class="at-w" target="_blank" rel="noopener" href="'+wa('Hello Sumit, I have a license ('+scopeText(info)+') and want to add the '+agent+'.')+'">Upgrade on WhatsApp</a><button id="at-have">Enter another key</button>');o.querySelector('#at-have').onclick=function(){o.remove();keyBox()}}


/* ---------- online check: device limit and switch-off ---------- */
function deviceId(){var d=null;try{d=localStorage.getItem('aarohan_device')}catch(e){}if(!d){d=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);try{localStorage.setItem('aarohan_device',d)}catch(e){}}return d}
function gate(r,ok){if(!LICSERVER)return ok();
 var ck='aarohan_lic_ok',c=get(ck)||{},k=r.key||'';
 if(c.k===k&&Date.now()-c.at<864e5)return ok();
 var done=false,t=setTimeout(function(){if(!done){done=true;ok()}},6000);
 fetch(LICSERVER.replace(/\/$/,'')+'/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,device:deviceId()})})
 .then(function(x){return x.json()}).then(function(res){if(done)return;done=true;clearTimeout(t);
  if(res.ok){set(ck,{k:k,at:Date.now()});ok();return}
  if(res.why==='limit'||res.why==='revoked'){try{localStorage.removeItem(ck)}catch(e){}clearUI();
   var msg=res.why==='limit'?'This license key is already active on '+res.limit+' device'+(res.limit>1?'s':'')+', the maximum for this plan. Ask the license owner to free a device, or buy an extra device.':'This license has been switched off. Please contact Aarohan QA Analytics to renew or restore it.';
   var o=overlay('<h2>'+(res.why==='limit'?'Device limit reached':'License switched off')+'</h2><p>'+msg+'</p><a class="at-w" target="_blank" rel="noopener" href="'+wa('Hello Sumit, my '+agent+' license shows: '+(res.why==='limit'?'device limit reached':'license switched off')+'.')+'">Contact on WhatsApp</a><button id="at-have">Enter another key</button>');o.querySelector('#at-have').onclick=function(){o.remove();keyBox()};return}
  ok()})
 .catch(function(){if(done)return;done=true;clearTimeout(t);ok()})}
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
    if(hit){gate(hit,function(){licensed(hit.info)});return}
    if(other){notCovered(other.info);return}
    if(exp){keyBox('Your license expired on '+esc(exp.info.e)+'. Please renew on WhatsApp and paste the new key.');return}
    trial();
  });
}
if(document.body)init();else document.addEventListener('DOMContentLoaded',function(){init()})})();
