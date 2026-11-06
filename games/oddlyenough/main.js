import {createScene} from './blockout.js';
import {Prototype} from './prototype.js';
import {createPrototypeUI} from './prototype-ui.js';
import {createMicrophone} from './microphone.js';
import {createTalkClient} from './talk.js';
import {createSpeechPlayer} from './speech-player.js';
import {createProgressStore} from './progress.js';
import {createIntentClient} from './intent.js';

const scene=createScene(document.getElementById('game'));
let mic=null,speech=null;
const ui=createPrototypeUI({onStart:()=>{speech?.unlock();void game.start();},onSpeak:()=>{speech?.cancel();speech?.unlock();mic?.toggle();},onOffer:amount=>{mic?.cancel();speech?.unlock();return game.offer(amount);},onConfirm:()=>{mic?.cancel();speech?.unlock();return game.confirm();},onUndo:()=>{mic?.cancel();speech?.cancel();return game.undoLastDeal();},onNext:()=>{mic?.cancel();speech?.cancel();return game.next();}});
const game=new Prototype({scene,talk:createTalkClient(),store:createProgressStore(),featuredFirstCustomer:'c6',excludedCustomerIds:['ines'],firstRole:new URL(location.href).searchParams.get('visit'),presentReply:async({line,customer,signal})=>{
  await Promise.all([ui.typingDone,speech?.speak(line,customer,signal)]);
},onChange:g=>{
  ui.update(g);
  scene.setInventory(g.state?.inventory||[]);
  scene.setActive(['thinking','listening'].includes(g.phase));
  if(['thinking','listening'].includes(g.phase))scene.setReaction(g.expression,g.phase);
  if(!['listening','thinking'].includes(g.phase)&&mic?.state!=='idle')mic?.cancel();
}});
scene.renderer.setAnimationLoop(()=>scene.render());
addEventListener('resize',()=>scene.resize());
let status=null;
if(document.querySelector('meta[name="oddly-api"]')){
  try{const response=await fetch('./api/status',{signal:AbortSignal.timeout(3000)});if(response.ok)status=await response.json();}catch{}
}
if(status?.available)game.talk=createTalkClient({endpoint:'./api/talk'});
if(status?.interpretation)game.interpret=createIntentClient({endpoint:'./api/interpret'});
speech=createSpeechPlayer({endpoint:status?.speech?'./api/speak':null,onState:value=>{ui.setSpeechState(value);if(value==='speaking')scene.setReaction(game.expression,'speaking');},onError:message=>ui.setError(message)});
mic=createMicrophone({endpoint:status?.transcription?'./api/transcribe':null,
  onState:value=>ui.setMicState(value),onError:message=>ui.setError(message),
  onTranscript:(text,final)=>{ui.setTranscript(text);if(final){ui.clearTranscript();void game.say(text);}},
});
addEventListener('pagehide',()=>{mic.cancel();speech.cancel();game.stop();ui.destroy();});
ui.update(game);
