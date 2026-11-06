import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechPlayer } from '../speech-player.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const goodResponse=()=>({ok:true,json:async()=>({audio:'YQ==',mimeType:'audio/mpeg'})});
function setup({webAudio=true,autoEnd=true,nativeEnd=true,decode=async()=>({duration:1}),stopThrows=false,fetchImpl=async()=>goodResponse(),...options}={}){
  const calls={fetch:0,start:0,stop:0,disconnect:0,synth:[],cancel:0,states:[],errors:[]};
  const environment={atob:value=>Buffer.from(value,'base64').toString('binary'),SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{resume(){},cancel(){calls.cancel++;},getVoices(){return [{lang:'en-US',name:'English'}];},speak(value){calls.synth.push(value);if(nativeEnd)queueMicrotask(()=>value.onend?.());}}};
  if(webAudio)environment.AudioContext=class{
    state='running';destination={};
    decodeAudioData=decode;
    createBufferSource(){return {connect(){},start(){calls.start++;if(autoEnd)queueMicrotask(()=>this.onended?.());},stop(){calls.stop++;if(stopThrows)throw Error('already stopped');this.onended?.();},disconnect(){calls.disconnect++;}};}
  };
  const player=createSpeechPlayer({endpoint:'/api/speak',environment,fetchImpl:(...args)=>{calls.fetch++;return fetchImpl(...args);},onState:value=>calls.states.push(value),onError:value=>calls.errors.push(value),apiTimeoutMs:15,playbackTimeoutMs:25,...options});
  return {player,calls,environment};
}

test('speech never fetches or autoplays before an explicit unlock',async()=>{
  const {player,calls}=setup();
  await player.speak('Hello.');
  assert.equal(calls.fetch,0);assert.equal(calls.start,0);assert.equal(calls.synth.length,0);
  player.unlock();await player.speak('Hello.');
  assert.equal(calls.fetch,1);assert.equal(calls.start,1);assert.equal(calls.synth.length,0);
  assert.equal(calls.states.at(-1),'idle');assert.equal(calls.disconnect,1);
});

test('API failure and invalid audio fall back to native speech after unlock',async()=>{
  for(const fetchImpl of [async()=>({ok:false}),async()=>({ok:true,json:async()=>({audio:'YQ==',mimeType:'text/html'})})]){
    const {player,calls}=setup({fetchImpl});player.unlock();await player.speak('Fallback line.',{personalityId:'brisk'});
    assert.equal(calls.synth.length,1);assert.equal(calls.synth[0].text,'Fallback line.');assert.equal(calls.synth[0].rate,1.08);
    assert.equal(calls.start,0);assert.equal(calls.states.at(-1),'idle');
  }
});

test('fetch, response JSON and decoding deadlines cannot hang even if abort is ignored',{timeout:500},async()=>{
  const never=()=>new Promise(()=>{});
  for(const options of [{fetchImpl:never},{fetchImpl:async()=>({ok:true,json:never})},{decode:never}]){
    const {player,calls}=setup(options);player.unlock();await player.speak('Bounded line.');
    assert.equal(calls.synth.length,1);assert.equal(calls.states.at(-1),'idle');
  }
});

test('cancel aborts pending fetch immediately without speaking a fallback',{timeout:500},async()=>{
  let signal;
  const {player,calls}=setup({fetchImpl:async(_,options)=>{signal=options.signal;return new Promise(()=>{});},apiTimeoutMs:10000});
  player.unlock();const speaking=player.speak('Cancel this.');await tick();player.cancel();await speaking;
  assert.equal(signal.aborted,true);assert.equal(calls.start,0);assert.equal(calls.synth.length,0);assert.equal(calls.states.at(-1),'idle');
});

test('external cancellation stops active playback safely even when stop throws',{timeout:500},async()=>{
  const {player,calls}=setup({autoEnd:false,stopThrows:true,playbackTimeoutMs:10000});
  const controller=new AbortController();player.unlock();const speaking=player.speak('Cancel this.',{},controller.signal);
  await tick();assert.equal(calls.start,1);controller.abort();await speaking;
  assert.equal(calls.stop,1);assert.equal(calls.synth.length,0);assert.equal(calls.states.at(-1),'idle');
});

test('a newer speech request cancels stale work without stopping the new playback',{timeout:500},async()=>{
  let count=0;
  const {player,calls}=setup({fetchImpl:async()=>++count===1?new Promise(()=>{}):goodResponse(),apiTimeoutMs:10000});
  player.unlock();const old=player.speak('Old line.');await tick();const newer=player.speak('New line.');await Promise.all([old,newer]);
  assert.equal(calls.start,1);assert.equal(calls.synth.length,0);assert.equal(calls.errors.length,0);assert.equal(calls.states.at(-1),'idle');
});

test('WebAudio and native playback deadlines release a stalled turn',{timeout:500},async()=>{
  for(const options of [{autoEnd:false},{webAudio:false,nativeEnd:false}]){
    const {player,calls}=setup(options);player.unlock();await player.speak('Finish eventually.');
    assert.equal(calls.states.at(-1),'idle');
  }
});

test('native cancellation detaches stale callbacks and no capability reports a useful error',async()=>{
  const {player,calls}=setup({webAudio:false,nativeEnd:false});player.unlock();const speaking=player.speak('Native line.');await tick();
  player.cancel();await speaking;assert.equal(calls.synth[0].onend,null);assert.equal(calls.synth[0].onerror,null);
  const missing=setup({environment:{}});missing.player.unlock();await missing.player.speak('No audio.');assert.equal(missing.calls.errors.length,1);
});
