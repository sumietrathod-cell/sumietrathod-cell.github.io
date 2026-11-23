// No microphone, model download, cloud call or real voice data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const original=readFileSync(new URL('../transcriber.js',import.meta.url),'utf8');
const src=original.replace(/^import \{ pipeline, env \} from '[^']+';\s*/, '');
assert.doesNotMatch(src,/^import /m);

function harness({failOnceOn=null,stallFirst=false}={}) {
 const pipelineCalls=[], events=[], inferenceCalls=[];
 let handler;
 let failurePending=Boolean(failOnceOn);
 let releaseFirst;
 const gate=stallFirst?new Promise(resolve=>{releaseFirst=resolve}):null;
 const env={allowLocalModels:true,backends:{onnx:{wasm:{numThreads:9}}}};
 const pipeline=async (kind,id,options)=>{
  pipelineCalls.push({kind,id,options});
  options.progress_callback({status:'initiate'});
  if(failurePending && id===failOnceOn){
   failurePending=false;
   throw Error('Synthetic model load failed');
  }
  return async (samples,request)=>{
   inferenceCalls.push({id,samples,request});
   if(gate && inferenceCalls.length===1)await gate;
   return {text:'  '+id+' result  '};
  };
 };
 const self={
  addEventListener:(name,fn)=>{assert.equal(name,'message');handler=fn;},
  postMessage:(event)=>events.push(event),
 };
 const context=vm.createContext({pipeline,env,self,Promise});
 vm.runInContext(src,context,{filename:'voice-platform/transcriber.js',timeout:1500});
 const send=(payload)=>{handler({data:payload});return vm.runInContext('queued',context)};
 return {send,events,env,pipelineCalls,inferenceCalls,releaseFirst};
}
const message=(model,tag)=>({
 model,
 samples:new Float32Array([1,2,3]),
 task:'translate',language:'gu',
 tag,
});

test('tiny and small are distinct pinned models; repeat same size reuses pipeline',async()=>{
 const h=harness();
 await h.send(message('tiny',1));
 await h.send(message('small',2));
 await h.send(message('small',3));
 await h.send(message('tiny',4));
 assert.deepEqual(h.pipelineCalls.map(x=>x.id),[
  'Xenova/whisper-tiny','Xenova/whisper-small','Xenova/whisper-tiny',
 ]);
 assert.equal(h.pipelineCalls[0].options.revision,'5332fcc35e32a33b86612b9a57a89be7906102b1');
 assert.equal(h.pipelineCalls[1].options.revision,'5cfd31acdccf24bc3731005c0e9cabae434f21c8');
 assert.equal(h.env.allowLocalModels,false);
 assert.equal(h.env.backends.onnx.wasm.numThreads,1);
 assert.equal(h.inferenceCalls.length,4);
 assert.equal(h.events.filter(x=>x.type==='complete').length,4);
 assert.equal(h.events.filter(x=>x.type==='error').length,0);
 assert.deepEqual(h.events.filter(x=>x.type==='complete').map(x=>x.text),[
  'Xenova/whisper-tiny result','Xenova/whisper-small result',
  'Xenova/whisper-small result','Xenova/whisper-tiny result',
 ]);
});
test('unknown model names fail safely to pinned tiny rather than dynamic model IDs',async()=>{
 const h=harness();
 await h.send(message('whatever',1));
 assert.deepEqual(h.pipelineCalls.map(x=>x.id),['Xenova/whisper-tiny']);
});
test('model download error resets cache and permits a second attempt',async()=>{
 const h=harness({failOnceOn:'Xenova/whisper-small'});
 await h.send(message('small',1));
 assert.equal(h.events.at(-1).type,'error');
 await h.send(message('small',2));
 assert.equal(h.events.at(-1).type,'complete');
 assert.equal(h.pipelineCalls.length,2);
});
test('concurrent queued inputs do not replace in-flight pipeline or deliver out of order',async()=>{
 const h=harness({stallFirst:true});
 const a=h.send(message('tiny',1));
 const b=h.send(message('small',2));
 // Awaiting only a microtask turn: the second model must NOT load before
 // first transcription has finished.
 await Promise.resolve();
 await Promise.resolve();
 assert.equal(h.pipelineCalls.length,1);
 h.releaseFirst();
 await Promise.all([a,b]);
 assert.deepEqual(h.pipelineCalls.map(x=>x.id),[
  'Xenova/whisper-tiny','Xenova/whisper-small',
 ]);
 assert.deepEqual(h.events.filter(x=>x.type==='complete').map(x=>x.text),[
  'Xenova/whisper-tiny result','Xenova/whisper-small result',
 ]);
});
test('inference receives language and task unchanged, and text has no outer padding',async()=>{
 const h=harness();
 await h.send(message('small',1));
 assert.equal(h.inferenceCalls[0].request.language,'gu');
 assert.equal(h.inferenceCalls[0].request.task,'translate');
 assert.equal(h.events.at(-1).text,'Xenova/whisper-small result');
});
