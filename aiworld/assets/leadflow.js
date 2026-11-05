(()=>{'use strict';
const KEY='aarohan-leadflow-demo-v1', STAGES=['New','Contacted','Proposal','Won','Lost'];
const $=id=>document.getElementById(id);
const shift=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const today=shift(0);
function sample(){return [
{id:'sample-a',contact:'Alex Morgan',company:'Northstar Digital (sample)',email:'',service:'AI automation',stage:'New',value:450,followup:shift(0),source:'Website',notes:'Sample: lead intake automation.'},
{id:'sample-b',contact:'Samira Khan',company:'ClearData Ops (sample)',email:'',service:'Power BI dashboard',stage:'Proposal',value:800,followup:shift(2),source:'LinkedIn',notes:'Sample: reporting improvement.'},
{id:'sample-c',contact:'Chris Taylor',company:'QA Works (sample)',email:'',service:'Pharma QA analytics',stage:'Contacted',value:650,followup:shift(-1),source:'Referral',notes:'Sample: QA KPI dashboard.'},
{id:'sample-d',contact:'Jamie Lee',company:'Demo Distribution (sample)',email:'',service:'Excel reporting',stage:'Won',value:300,followup:'',source:'Upwork',notes:'Sample: weekly reporting.'}
]}
function clean(v,max){return String(v??'').trim().slice(0,max)}
function valid(r){return r&&typeof r==='object'&&r.contact&&r.company&&STAGES.includes(r.stage)}
function load(){try{const raw=localStorage.getItem(KEY);if(raw===null)return sample();const obj=JSON.parse(raw);return Array.isArray(obj)?obj.filter(valid).slice(0,2000):sample()}catch{return sample()}}
let rows=load();function save(){try{localStorage.setItem(KEY,JSON.stringify(rows));return true}catch{$('table-status').textContent='Unable to save in this browser (storage may be disabled).';return false}}
function money(v){return '$'+Number(v||0).toLocaleString('en-US',{maximumFractionDigits:0})}
function el(tag,txt,cl){const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cl)n.className=cl;return n}
function due(r){return !!r.followup&&r.followup<=today&&!['Won','Lost'].includes(r.stage)}
function render(){const open=rows.filter(x=>!['Won','Lost'].includes(x.stage));$('metric-count').textContent=rows.length;$('metric-value').textContent=money(open.reduce((n,r)=>n+Number(r.value||0),0));$('metric-due').textContent=open.filter(due).length;$('metric-won').textContent=money(rows.filter(x=>x.stage==='Won').reduce((n,r)=>n+Number(r.value||0),0));
 const search=$('search').value.trim().toLowerCase(),stage=$('filter').value;const found=rows.filter(r=>(stage==='All'||r.stage===stage)&&(!search||[r.contact,r.company,r.service].some(v=>String(v||'').toLowerCase().includes(search))));const tbody=$('lead-rows');tbody.replaceChildren();
 if(!found.length){const tr=el('tr'),td=el('td','No leads match the current filter.');td.colSpan=6;td.className='empty';tr.append(td);tbody.append(tr)}
 for(const r of found){const tr=el('tr');const person=el('td');person.append(el('strong',r.contact),el('br'),el('span',r.company,'fine'));if(r.email)person.append(el('br'),el('span',r.email,'fine'));tr.append(person,el('td',r.service),el('td',money(r.value)));const f=el('td',r.followup||'Not set');if(due(r))f.append(el('span',' · due','danger'));tr.append(f);const td=el('td'),select=el('select');select.className='table-select';select.setAttribute('aria-label','Stage for '+r.contact);for(const s of STAGES){const option=el('option',s);option.value=s;select.append(option)}select.value=r.stage;select.addEventListener('change',()=>{r.stage=select.value;save();render()});td.append(select);tr.append(td);
 const deleteTd=el('td'),btn=el('button','Delete','table-btn');btn.type='button';btn.setAttribute('aria-label','Delete lead '+r.contact);btn.addEventListener('click',()=>{if(confirm('Delete lead for '+r.contact+'?')){rows=rows.filter(x=>x.id!==r.id);save();render()}});deleteTd.append(btn);tr.append(deleteTd);tbody.append(tr)}
 $('table-status').textContent=found.length+' of '+rows.length+' lead(s) shown. Changes are stored only in this browser.'}
$('lead-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const d=new FormData(f);const r={id:(globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random()),contact:clean(d.get('contact'),70),company:clean(d.get('company'),90),email:clean(d.get('email'),120),service:clean(d.get('service'),70),stage:clean(d.get('stage'),30),value:Math.min(100000000,Math.max(0,Number(d.get('value'))||0)),followup:clean(d.get('followup'),20),source:clean(d.get('source'),70),notes:clean(d.get('notes'),400)};if(!r.contact||!r.company)return;rows.unshift(r);save();f.reset();$('form-status').textContent='Lead added in this browser (no message sent).';render()});
$('search').addEventListener('input',render);$('filter').addEventListener('change',render);
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
$('export').addEventListener('click',()=>{const keys=['contact','company','email','service','stage','value','followup','source','notes'];const data=[keys.map(csvCell).join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='aarohan-leadflow-demo-leads.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)});
$('restore').addEventListener('click',()=>{if(!confirm('Replace all current leads with four fictional sample leads?'))return;rows=sample();save();render()});
$('clear').addEventListener('click',()=>{if(!confirm('Permanently clear all leads saved in this browser?'))return;rows=[];save();render()});
save();render();
})();

