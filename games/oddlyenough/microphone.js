// Capture starts only after Speak. Each session owns its stream, callbacks and cancellation.
import { MAX_PITCH_LENGTH } from './tuning.js';
const MAX_RECORDING_BYTES = 24 * 1024 * 1024;
export function createMicrophone({endpoint=null,onState=()=>{},onTranscript=()=>{},onError=()=>{},environment=globalThis,fetchImpl=globalThis.fetch,transcriptionTimeout=125000,nativeStopTimeout=3000}={}) {
  let state='idle',session=null,nativePreferred=false;
  const Native=environment.SpeechRecognition||environment.webkitSpeechRecognition;
  const canRecord=Boolean(endpoint&&environment.navigator?.mediaDevices?.getUserMedia&&environment.MediaRecorder);
  const supported=Boolean(canRecord||Native);
  const set=value=>{if(state!==value){state=value;onState(value);}};
  const current=s=>session===s&&!s.closed;
  const clearTimer=s=>{clearTimeout(s.timer);s.timer=null;};
  const releaseStream=s=>{const captured=s.stream;s.stream=null;captured?.getTracks().forEach(track=>{try{track.stop();}catch{}});};
  const permissionMessage='Microphone access was blocked. Allow microphone access for this site and in your system settings, then tap Speak. If this embedded preview cannot request access, open the same localhost page in Chrome.';
  function finish(s,{text,message,code}={}){
    if(!current(s))return;
    session=null;s.closed=true;clearTimer(s);releaseStream(s);s.controller?.abort();s.rejectTranscription?.(new Error('cancelled'));
    try{s.recognition?.abort();}catch{}
    try{if(s.recorder&&s.recorder.state!=='inactive')s.recorder.stop();}catch{}
    set('idle');
    if(message)onError(message,code||'recording-failed');
    if(text){
      if(text.trim().length>MAX_PITCH_LENGTH)onError('That transcript is too large for one turn. Please split it into separate replies; no partial offer was submitted.','transcript-too-long');
      else onTranscript(text.trim(),true);
    }
  }
  async function transcription(s,chunks,recorder){
    if(!current(s))return;clearTimer(s);releaseStream(s);set('transcribing');
    const deadline=new Promise((_,reject)=>{s.rejectTranscription=reject;s.timer=setTimeout(()=>{s.controller?.abort();reject(new Error('timeout'));},transcriptionTimeout);});
    void deadline.catch(()=>{});
    try{
      const mime=(recorder.mimeType||chunks[0]?.type||'audio/webm').split(';')[0];
      const blob=new environment.Blob(chunks,{type:mime});if(!blob.size)throw new Error('empty');
      const buffer=new Uint8Array(await Promise.race([blob.arrayBuffer(),deadline]));
      if(!current(s))return;
      let binary='';for(let at=0;at<buffer.length;at+=8192)binary+=String.fromCharCode(...buffer.subarray(at,at+8192));
      s.controller=new AbortController();
      const response=await Promise.race([fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:s.controller.signal,body:JSON.stringify({audio:environment.btoa(binary),mediaType:mime})}),deadline]);
      if(!response.ok){let error;try{error=await Promise.race([response.json(),deadline]);}catch{}throw new Error(error?.error==='transcript-too-long'?'transcript-too-long':'unavailable');}
      const result=await Promise.race([response.json(),deadline]);if(!current(s))return;
      if(typeof result?.text!=='string'||!result.text.trim())throw new Error('empty');
      finish(s,{text:result.text});
    }catch(cause){
      if(!current(s))return;
      if(cause?.message==='transcript-too-long'){finish(s,{message:'That transcript is too large for one turn. Please split it into separate replies; no partial offer was submitted.',code:'transcript-too-long'});return;}
      nativePreferred=Boolean(Native);
      finish(s,{message:Native?'Could not transcribe that. Tap Speak to try browser speech recognition.':cause?.message==='timeout'?'Transcription timed out. Tap Speak and try a short reply.':'Could not transcribe that. Tap Speak and try a short reply.',code:cause?.message==='timeout'?'timeout':'transcription-failed'});
    }
  }
  function startNative(s){
    try{
      const recognition=new Native();s.recognition=recognition;
      recognition.lang=environment.navigator?.language||'en-US';recognition.interimResults=true;recognition.continuous=true;
      const previous=s.nativeText||'';let final='',lastDraft='',started=false;
      recognition.onstart=()=>{if(!current(s)||s.recognition!==recognition)return;started=true;if(state!=='transcribing'){clearTimer(s);set('recording');}};
      recognition.onresult=event=>{
        if(!current(s)||s.recognition!==recognition)return;final='';let interim='';
        for(let i=0;i<event.results.length;i++){const result=event.results[i],text=result?.[0]?.transcript;if(typeof text!=='string')continue;if(result.isFinal)final+=text+' ';else interim+=text+' ';}
        const draft=(previous+' '+final+interim).trim();
        if(draft.length>MAX_PITCH_LENGTH){finish(s,{message:'That transcript is too large for one turn. Please split it into separate replies; no partial offer was submitted.',code:'transcript-too-long'});return;}
        if(draft&&draft!==lastDraft){lastDraft=draft;onTranscript(draft,false);}
      };
      recognition.onerror=event=>{
        if(!current(s)||s.recognition!==recognition)return;
        if(event.error==='no-speech'&&state==='recording')return;
        if(['not-allowed','service-not-allowed'].includes(event.error))finish(s,{message:permissionMessage,code:'permission-denied'});
        else if(event.error==='audio-capture')finish(s,{message:'No microphone was available. Connect a microphone and check your system input device, then tap Speak.',code:'microphone-unavailable'});
        else if(event.error==='network'){nativePreferred=false;finish(s,{message:'Browser speech recognition could not connect. Check your connection, then tap Speak to retry.',code:'recognition-unavailable'});}
        else finish(s,{message:'No speech was recognized. Tap Speak and try again.',code:'no-speech'});
      };
      recognition.onend=()=>{
        if(!current(s)||s.recognition!==recognition)return;s.recognition=null;clearTimer(s);
        s.nativeText=(previous+' '+final).trim();
        if(state==='transcribing'){if(s.nativeText)finish(s,{text:s.nativeText});else finish(s,{message:'No speech heard. Tap Speak and try again.',code:'no-speech'});return;}
        // Browsers may end a continuous recognition session themselves. Keep the
        // same explicit recording open, retaining its words until Send or Cancel.
        const now=Date.now();s.nativeEnds=(s.nativeEnds||[]).filter(time=>time>now-2000);s.nativeEnds.push(now);
        if(s.nativeEnds.length>3){finish(s,{message:'Browser speech recognition keeps stopping. Tap Speak to retry or use Chrome with the live microphone connection.',code:'recognition-unavailable'});return;}
        startNative(s);
      };
      recognition.start();
      if(current(s)&&!started)s.timer=setTimeout(()=>finish(s,{message:'Browser speech recognition did not start. Open the same page in Chrome, allow microphone access, and tap Speak.',code:'recognition-unavailable'}),8000);
    }catch(cause){finish(s,{message:cause?.name==='NotAllowedError'?permissionMessage:'Browser speech recognition could not start. Tap Speak to retry.',code:cause?.name==='NotAllowedError'?'permission-denied':'recognition-unavailable'});}
  }
  async function start(){
    if(state!=='idle')return;
    if(environment.isSecureContext===false){onError('Microphone access requires HTTPS or localhost. Open the secure game address, then tap Speak.','insecure-context');return;}
    if(!supported){onError('Microphone input is unavailable in this browser. Open the same game page in Chrome or Safari.','unsupported');return;}
    const s={closed:false,stream:null,recorder:null,recognition:null,timer:null,controller:null,rejectTranscription:null};session=s;set('requesting');
    if(Native&&(nativePreferred||!canRecord)){startNative(s);return;}
    try{
      const captured=await environment.navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(!current(s)){captured.getTracks().forEach(track=>track.stop());return;}
      s.stream=captured;
      const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(type=>environment.MediaRecorder.isTypeSupported?.(type));
      const recorder=new environment.MediaRecorder(captured,{audioBitsPerSecond:32000,...(mimeType?{mimeType}:{})});s.recorder=recorder;
      const chunks=[];let bytes=0;
      recorder.ondataavailable=event=>{if(!current(s))return;if(event.data?.size){bytes+=event.data.size;chunks.push(event.data);if(bytes>MAX_RECORDING_BYTES)finish(s,{message:'This recording exceeds the 24 MiB audio upload limit. Please split it into separate replies; no partial recording was sent.',code:'recording-too-large'});}};
      recorder.onerror=()=>{if(!current(s))return;nativePreferred=Boolean(Native);finish(s,{message:Native?'Recording failed. Tap Speak to try browser speech recognition.':'Could not record. Check microphone access and tap Speak again.',code:'recording-failed'});};
      recorder.onstop=()=>{if(current(s))void transcription(s,chunks,recorder);};
      recorder.start(1000);if(!current(s))return;set('recording');
    }catch(cause){
      if(!current(s))return;
      if(cause?.name==='NotAllowedError'||cause?.name==='SecurityError'){
        let explicitlyDenied=false;
        try{explicitlyDenied=(await environment.navigator?.permissions?.query({name:'microphone'}))?.state==='denied';}catch{}
        if(!current(s))return;
        nativePreferred=Boolean(Native&&!explicitlyDenied);
        finish(s,{message:permissionMessage+(nativePreferred?' Tap Speak again to request browser speech recognition instead.':''),code:'permission-denied'});
      }else if(cause?.name==='NotFoundError'||cause?.name==='DevicesNotFoundError')finish(s,{message:'No microphone was found. Connect one or select a working system input device, then tap Speak.',code:'microphone-unavailable'});
      else if(cause?.name==='NotReadableError'||cause?.name==='TrackStartError')finish(s,{message:'Your microphone could not be opened. Close other apps using it and check system microphone permissions, then tap Speak.',code:'microphone-unavailable'});
      else{nativePreferred=Boolean(Native);finish(s,{message:Native?'Recording is unavailable here. Tap Speak to try browser speech recognition.':'Microphone recording could not start. Check the selected input device and tap Speak again.',code:'recording-failed'});}
    }
  }
  function stop(){
    const s=session;if(!s||state!=='recording')return;clearTimer(s);set('transcribing');
    if(s.recognition){
      try{s.recognition.stop();if(current(s))s.timer=setTimeout(()=>finish(s,{message:'Speech recognition did not finish. Tap Speak to try again.',code:'timeout'}),nativeStopTimeout);}catch{finish(s,{message:'Speech recognition stopped unexpectedly. Tap Speak to try again.',code:'recognition-unavailable'});}
    }else if(s.recorder?.state!=='inactive'){
      s.timer=setTimeout(()=>finish(s,{message:'Recording did not finish. Tap Speak to try again.',code:'timeout'}),nativeStopTimeout);
      try{s.recorder.stop();}catch{finish(s,{message:'Recording stopped unexpectedly. Tap Speak to try again.',code:'recording-failed'});}
    }
  }
  function cancel(message){if(session)finish(session,{message,code:'cancelled'});else if(message)onError(message,'cancelled');}
  return {start,stop,cancel,toggle(){if(state==='recording')stop();else if(state==='idle')void start();else cancel();},get state(){return state;},supported};
}
