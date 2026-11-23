import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const html=readFileSync(new URL('../quotations.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Billing app script is present');
const start=script.indexOf('function view(r,invoice=null){');
const end=script.indexOf("$('openInvoice').onclick=",start);
assert.ok(start>=0&&end>start,'Quotation renderer found');
const renderer=script.slice(start,end);

class Element {
 constructor(tag='div'){
  this.tag=tag;this.children=[];this.textContent='';this.hidden=false;
  this.className='';this.src='';this.href='';this.alt='';this.target='';this.rel='';
  this.onclick=null;this.isConnected=true;this.disabled=false;
 }
 append(...children){this.children.push(...children)}
 scrollIntoView(){}
}
function rendered(invoice=false){
 const doc=new Element('article');
 const ctx={
  document:{createElement:tag=>new Element(tag)},
  $:id=>{if(id!=='doc')throw new Error('Unexpected DOM ID '+id);return doc},
  replaceContents:(el,...children)=>{el.textContent='';el.children=[];el.append(...children)},
  totalPaise:items=>items.reduce((v,i)=>v+i.qty*i.paise,0),
  formatINR:v=>'₹'+(v/100).toFixed(2),
  window:{print:()=>{}},
  token:'synthetic-auth',sessionEpoch:0,current:()=>true,
  api:async()=>({}),refresh:async()=>undefined
 };
 vm.runInNewContext(renderer+'\n;globalThis.renderPreview=view;',ctx);
 const quote={id:'synthetic-quote-ref',created_at:'2026-11-23T08:00:00Z',
  customer:'AAROHAN SYNTHETIC TEST',items:[{service:'AI Chatbot Demo',qty:1,paise:10000}]};
 ctx.renderPreview(quote,invoice?{id:'synthetic-invoice-ref',issued_at:'2026-11-23T08:01:00Z'}:null);
 const flatten=el=>[el,...el.children.filter(v=>v instanceof Element).flatMap(flatten)];
 const nodes=flatten(doc);
 return {doc,nodes,text:nodes.map(n=>n.textContent).join(' ')};
}
test('existing AAROHAN logo, legal-reference text and Udyam number stay in the letterhead',()=>{
 const {nodes,text}=rendered(true);
 const logo=nodes.find(n=>n.tag==='img');
 assert.ok(logo,'Letterhead logo should render');
 assert.equal(logo.src,'../aarohan_logo.svg');
 assert.equal(logo.alt,'AAROHAN AI WORLD logo');
 assert.ok(nodes.some(n=>n.className==='letterhead-brand'&&n.textContent==='AAROHAN AI WORLD'));
 assert.match(text,/UDYAM-GJ-01-0013783/);
 assert.match(text,/Udyam registration number supplied by business owner; not independently verified/);
 assert.doesNotMatch(text,/GSTIN:/);
});
test('invoice draft displays synthetic customer, service, references, total and non-GST warning',()=>{
 const {text,nodes}=rendered(true);
 for(const value of ['Commercial invoice draft','AAROHAN SYNTHETIC TEST','AI Chatbot Demo',
  '₹100.00','synthetic-invoice-ref','synthetic-quote-ref',
  'GST: Not charged or collected','This document is not a GST tax invoice',
  'Payment status: Not verified']){
  assert.ok(text.includes(value),'Invoice should include '+value);
 }
 assert.ok(nodes.some(n=>n.tag==='table'&&n.className==='invoice-table'));
 assert.ok(!nodes.some(n=>n.tag==='button'&&n.textContent==='Issue or open invoice'));
});
test('quotation uses identical letterhead and permits admin to issue a draft later',()=>{
 const {text,nodes}=rendered(false);
 assert.match(text,/QUOTATION · NON-GST/);
 assert.match(text,/UDYAM-GJ-01-0013783/);
 assert.ok(nodes.some(n=>n.tag==='button'&&n.textContent==='Issue or open invoice'));
});
test('Razorpay link cannot falsely imply a paid invoice',()=>{
 const {nodes,text}=rendered(true);
 const payment=nodes.find(n=>n.tag==='a');
 assert.ok(payment);
 assert.equal(payment.href,'https://razorpay.me/@aarohanaiworld');
 assert.equal(payment.rel,'noopener noreferrer');
 assert.match(text,/Not verified/);
 assert.match(text,/Payment-link access does not confirm payment/);
});
test('A4 print hides controls and preserves colored header and table rows',()=>{
 assert.match(html,/@page\{size:A4;margin:12mm\}/);
 assert.match(html,/#doc \.letterhead\{break-inside:avoid;/);
 assert.match(html,/#doc \.doc-actions,#doc button,#doc a\{display:none!important\}/);
 assert.match(html,/#doc thead\{display:table-header-group\}/);
 assert.match(html,/#doc tr\{break-inside:avoid;page-break-inside:avoid\}/);
});
test('bill labels remain non-GST and UI script parses on current Node',()=>{
 assert.match(html,/Non-GST Quotations &amp; Invoices/);
 assert.match(html,/Udyam is not a GSTIN/);
 const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:script,encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});
