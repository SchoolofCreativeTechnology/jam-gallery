import test from 'node:test';
import assert from 'node:assert/strict';
import {createMicrophone} from '../microphone.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({getUserMedia,fetchImpl,environmentOverrides={},transcriptionTimeout,nativeStopTimeout}={}){
 let stopped=0,captures=0,transcripts=[],errors=[],errorCodes=[],states=[],recorder;
 const stream={getTracks:()=>[{stop(){stopped++;}}]};
 class Recorder {
  static isTypeSupported(type){return type==='audio/webm';}
  constructor(stream,options){recorder=this;this.state='inactive';this.mimeType='audio/webm';this.options=options;}
  start(timeslice){this.state='recording';this.timeslice=timeslice;}
  stop(){if(this.state==='inactive')return;this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['recorded speech'])});this.onstop?.();});}
 }
 const environment={navigator:{mediaDevices:{getUserMedia:getUserMedia||(async()=>{captures++;return stream;})}},MediaRecorder:Recorder,Blob,btoa,...environmentOverrides};
 const mic=createMicrophone({environment,endpoint:'/api/transcribe',transcriptionTimeout,nativeStopTimeout,fetchImpl:fetchImpl||(async()=>new Response(JSON.stringify({text:'Tell me about this radio.'}))),onTranscript:(text,final)=>transcripts.push({text,final}),onError:(text,code)=>{errors.push(text);errorCodes.push(code);},onState:state=>states.push(state)});
 return {mic,stream,transcripts,errors,errorCodes,states,get stopped(){return stopped;},get captures(){return captures;},get recorder(){return recorder;}};
}
test('microphone waits for explicit start, releases tracks, and submits one final transcript',async()=>{
 const p=setup();assert.equal(p.captures,0);await p.mic.start();assert.equal(p.captures,1);assert.equal(p.mic.state,'recording');await p.mic.start();assert.equal(p.captures,1);p.mic.stop();await tick();await tick();assert.equal(p.stopped,1);assert.deepEqual(p.transcripts,[{text:'Tell me about this radio.',final:true}]);assert.equal(p.mic.state,'idle');
});
test('cancel during permission prompt stops a late stream without recording',async()=>{
 let resolve;const p=setup({getUserMedia:()=>new Promise(r=>resolve=r)});const pending=p.mic.start();p.mic.cancel();resolve(p.stream);await pending;assert.equal(p.stopped,1);assert.equal(p.recorder,undefined);assert.equal(p.mic.state,'idle');
});
test('cancel during transcription prevents late text entering another conversation',async()=>{
 let resolve;const p=setup({fetchImpl:()=>new Promise(r=>resolve=r)});await p.mic.start();p.mic.stop();await tick();assert.equal(p.mic.state,'transcribing');p.mic.cancel();resolve(new Response(JSON.stringify({text:'stale words'})));await tick();assert.deepEqual(p.transcripts,[]);assert.equal(p.mic.state,'idle');
});
test('permission denial gives retry guidance and does not send audio',async()=>{
 const p=setup({getUserMedia:async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});},fetchImpl:()=>{throw Error('must not send');}});await p.mic.start();assert.equal(p.mic.state,'idle');assert.match(p.errors[0],/Allow microphone/);assert.deepEqual(p.transcripts,[]);
});
test('provider failure never pretends to have heard speech',async()=>{
 const p=setup({fetchImpl:async()=>new Response('{}',{status:503})});await p.mic.start();p.mic.stop();await tick();await tick();assert.deepEqual(p.transcripts,[]);assert.match(p.errors[0],/Could not transcribe/);assert.equal(p.mic.state,'idle');
});
test('recording has no timed cutoff and only explicit Send submits the full recording',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const p=setup();await p.mic.start();t.mock.timers.tick(10*60*1000);assert.equal(p.stopped,0);assert.equal(p.transcripts.length,0);assert.equal(p.mic.state,'recording');
 assert.equal(p.recorder.options.audioBitsPerSecond,32000);assert.equal(p.recorder.timeslice,1000);
 p.mic.stop();await tick();await tick();assert.equal(p.stopped,1);assert.equal(p.transcripts.length,1);assert.equal(p.mic.state,'idle');
});
test('late callbacks from a cancelled recorder cannot stop or cancel a new recording',async()=>{
 const p=setup();await p.mic.start();const old=p.recorder;p.mic.cancel();await p.mic.start();const current=p.recorder;old.ondataavailable({data:{size:3000000}});await old.onstop();old.onerror();assert.equal(p.mic.state,'recording');assert.equal(p.recorder,current);assert.equal(p.stopped,1);assert.deepEqual(p.errors,[]);p.mic.cancel();assert.equal(p.stopped,2);
});
test('transcription has a deadline even when fetch or JSON ignores abort',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){const p=setup({fetchImpl,transcriptionTimeout:5});await p.mic.start();p.mic.stop();await new Promise(r=>setTimeout(r,20));assert.equal(p.mic.state,'idle');assert.equal(p.errorCodes[0],'timeout');assert.equal(p.stopped,1);assert.deepEqual(p.transcripts,[]);}
});
function nativeFixture({endOnStop=true}={}){
 const instances=[];
 class Recognition {
  constructor(){instances.push(this);this.stops=0;this.aborts=0;}
  start(){queueMicrotask(()=>this.onstart?.());}
  stop(){this.stops++;if(endOnStop)queueMicrotask(()=>this.onend?.());}
  abort(){this.aborts++;}
 }
 return {Recognition,instances};
}
test('blocked recording offers native recognition only on the next explicit Speak',async()=>{
 const n=nativeFixture();const p=setup({getUserMedia:async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});},environmentOverrides:{SpeechRecognition:n.Recognition}});await p.mic.start();assert.equal(n.instances.length,0);assert.equal(p.errorCodes[0],'permission-denied');assert.match(p.errors[0],/Chrome/);assert.match(p.errors[0],/Tap Speak again/);await p.mic.start();await tick();assert.equal(n.instances.length,1);assert.equal(p.mic.state,'recording');p.mic.cancel();
});
test('an explicitly denied microphone permission is not retried through another API',async()=>{
 const n=nativeFixture();let captures=0;const navigator={mediaDevices:{getUserMedia:async()=>{captures++;throw Object.assign(new Error(),{name:'NotAllowedError'});}},permissions:{query:async()=>({state:'denied'})}};
 const p=setup({environmentOverrides:{SpeechRecognition:n.Recognition,navigator}});await p.mic.start();await p.mic.start();assert.equal(captures,2);assert.equal(n.instances.length,0);assert.ok(p.errorCodes.every(code=>code==='permission-denied'));assert.ok(p.errors.every(message=>!message.includes('instead')));
});
test('native final results are not duplicated, and a new capture gets a new recognizer',async()=>{
 const n=nativeFixture();const p=setup({environmentOverrides:{MediaRecorder:undefined,SpeechRecognition:n.Recognition}});await p.mic.start();await tick();const result=Object.assign([{transcript:'Where did it come from?'}],{isFinal:true});n.instances[0].onresult({resultIndex:0,results:[result]});n.instances[0].onresult({resultIndex:0,results:[result]});p.mic.stop();await tick();assert.deepEqual(p.transcripts,[{text:'Where did it come from?',final:false},{text:'Where did it come from?',final:true}]);assert.equal(p.mic.state,'idle');await p.mic.start();await tick();assert.equal(n.instances.length,2);p.mic.stop();assert.equal(n.instances[1].stops,1);p.mic.cancel();
});
test('native recognition cannot remain stuck transcribing after stop',async()=>{
 const n=nativeFixture({endOnStop:false});const p=setup({nativeStopTimeout:5,environmentOverrides:{MediaRecorder:undefined,SpeechRecognition:n.Recognition}});await p.mic.start();await tick();p.mic.stop();await new Promise(r=>setTimeout(r,15));assert.equal(p.mic.state,'idle');assert.equal(p.errorCodes[0],'timeout');assert.equal(n.instances[0].aborts,1);
});
test('native permission errors finish once and ignore delayed results and onend',async()=>{
 const n=nativeFixture();const p=setup({environmentOverrides:{MediaRecorder:undefined,SpeechRecognition:n.Recognition}});await p.mic.start();await tick();const recognition=n.instances[0];recognition.onerror({error:'not-allowed'});recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'stale'}],{isFinal:true})]});recognition.onend();assert.equal(p.errors.length,1);assert.equal(p.errorCodes[0],'permission-denied');assert.equal(p.mic.state,'idle');assert.deepEqual(p.transcripts,[]);
});
test('insecure pages and unsupported browsers give distinct actionable errors without capturing',async()=>{
 const insecure=setup({environmentOverrides:{isSecureContext:false}});await insecure.mic.start();assert.equal(insecure.captures,0);assert.equal(insecure.errorCodes[0],'insecure-context');assert.match(insecure.errors[0],/HTTPS or localhost/);
 const unsupported=setup({environmentOverrides:{MediaRecorder:undefined}});await unsupported.mic.start();assert.equal(unsupported.captures,0);assert.equal(unsupported.errorCodes[0],'unsupported');
});
test('a recorder that never fires onstop releases its microphone after the stop deadline',async()=>{
 const p=setup({nativeStopTimeout:5});await p.mic.start();p.recorder.stop=function(){this.state='inactive';};p.mic.stop();await new Promise(r=>setTimeout(r,15));assert.equal(p.mic.state,'idle');assert.equal(p.errorCodes[0],'timeout');assert.equal(p.stopped,1);
});
test('empty recordings recover without an unhandled rejection or false transcript',async()=>{
 const p=setup();await p.mic.start();p.recorder.stop=function(){this.state='inactive';queueMicrotask(()=>this.onstop?.());};p.mic.stop();await tick();await tick();assert.equal(p.mic.state,'idle');assert.equal(p.errorCodes[0],'transcription-failed');assert.deepEqual(p.transcripts,[]);
});
test('long transcripts retain their final sentence instead of stopping at 500 characters',async()=>{
 const text='Here is a long story about the object. '.repeat(30)+'I offer $80.';
 const p=setup({fetchImpl:async()=>new Response(JSON.stringify({text}))});await p.mic.start();p.mic.stop();await tick();await tick();assert.deepEqual(p.transcripts,[{text,final:true}]);
});
test('oversized audio reports a size error, releases hardware, and sends no partial audio',async()=>{
 let calls=0;const p=setup({fetchImpl:async()=>{calls++;return new Response('{}');}});await p.mic.start();p.recorder.ondataavailable({data:{size:24*1024*1024+1}});await tick();assert.equal(p.mic.state,'idle');assert.equal(p.stopped,1);assert.equal(calls,0);assert.equal(p.errorCodes[0],'recording-too-large');assert.match(p.errors[0],/24 MiB/);
});
test('oversized transcripts fail clearly without silently submitting their first 500 characters',async()=>{
 for(const fetchImpl of [async()=>new Response(JSON.stringify({text:'word '.repeat(2500)})),async()=>new Response(JSON.stringify({error:'transcript-too-long'}),{status:413})]){
  const p=setup({fetchImpl});await p.mic.start();p.mic.stop();await tick();await tick();assert.deepEqual(p.transcripts,[]);assert.equal(p.errorCodes[0],'transcript-too-long');assert.equal(p.stopped,1);
 }
});
test('native recognition continues across browser-ended sessions until explicit Send',async()=>{
 const n=nativeFixture();const p=setup({environmentOverrides:{MediaRecorder:undefined,SpeechRecognition:n.Recognition}});await p.mic.start();await tick();
 const result=text=>Object.assign([{transcript:text}],{isFinal:true});
 assert.equal(n.instances[0].continuous,true);n.instances[0].onresult({results:[result('The first part.')]});n.instances[0].onend();await tick();
 assert.equal(n.instances.length,2);assert.equal(p.mic.state,'recording');assert.equal(p.transcripts.filter(x=>x.final).length,0);
 n.instances[1].onresult({results:[result('I offer eighty dollars.')]});p.mic.stop();await tick();assert.equal(p.transcripts.at(-1).text,'The first part. I offer eighty dollars.');assert.equal(p.transcripts.filter(x=>x.final).length,1);
});
test('native recognition that repeatedly ends immediately fails instead of an infinite restart loop',async()=>{
 const n=nativeFixture();const p=setup({environmentOverrides:{MediaRecorder:undefined,SpeechRecognition:n.Recognition}});await p.mic.start();await tick();
 for(let i=0;i<4;i++){n.instances[i].onend();await tick();}
 assert.equal(n.instances.length,4);assert.equal(p.mic.state,'idle');assert.equal(p.errorCodes[0],'recognition-unavailable');
});
test('Send during a browser recognition restart cannot be undone by a delayed onstart',async()=>{
 const n=nativeFixture();const p=setup({environmentOverrides:{MediaRecorder:undefined,SpeechRecognition:n.Recognition}});await p.mic.start();await tick();
 n.instances[0].onresult({results:[Object.assign([{transcript:'I offer eighty dollars.'}],{isFinal:true})]});n.instances[0].onend();p.mic.stop();
 assert.equal(p.mic.state,'transcribing');await tick();assert.equal(p.mic.state,'idle');assert.equal(n.instances.length,2);assert.deepEqual(p.transcripts.filter(x=>x.final),[{text:'I offer eighty dollars.',final:true}]);
});
