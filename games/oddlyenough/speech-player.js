// Browser audio stays separate from dialogue and never receives the gateway key.
export function createSpeechPlayer({endpoint=null,environment=globalThis,fetchImpl=globalThis.fetch,onState=()=>{},onError=()=>{},apiTimeoutMs=16000,playbackTimeoutMs=30000}={}) {
  let context=null,active=null,epoch=0,unlocked=false;
  const safely=action=>{try{return action();}catch{return undefined;}};
  const current=task=>active===task&&task.epoch===epoch&&!task.signal?.aborted;
  function unlock(){
    unlocked=true;
    const AudioContext=environment.AudioContext||environment.webkitAudioContext;
    if(!context&&AudioContext)context=safely(()=>new AudioContext())||null;
    if(context?.state==='suspended')void Promise.resolve(safely(()=>context.resume())).catch(()=>{});
    safely(()=>environment.speechSynthesis?.resume?.());
  }
  function cancel(){
    epoch++;
    const task=active;active=null;
    if(task){task.controller.abort();task.rejectCancelled(Error('Speech cancelled'));safely(()=>task.source?.stop?.());task.finish?.();clearTimeout(task.apiTimer);}
    safely(()=>environment.speechSynthesis?.cancel?.());
    onState('idle');
  }
  function playback(task,play){
    let timer,detach=()=>{};
    const completed=new Promise((resolve,reject)=>{
      let settled=false;
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);detach();if(error)reject(error);else resolve();};
      task.finish=()=>finish();
      timer=setTimeout(()=>{
        if(current(task)){safely(()=>task.source?.stop?.());safely(()=>environment.speechSynthesis?.cancel?.());}
        finish();
      },playbackTimeoutMs);
      try{detach=play(()=>finish())||detach;if(settled)detach();}catch(error){safely(()=>task.source?.stop?.());safely(()=>task.source?.disconnect?.());finish(error);}
    });
    return Promise.race([completed,task.cancelled]);
  }
  async function speak(text,customer={},signal){
    cancel();
    // Only an explicit user gesture through unlock() enables either playback path.
    if(!unlocked||signal?.aborted||typeof text!=='string'||!text.trim())return;
    text=text.trim().slice(0,500);
    const controller=new AbortController();let rejectCancelled;
    const cancelled=new Promise((_,reject)=>{rejectCancelled=reject;});
    // Cancellation can arrive between awaited operations; always observe its rejection.
    void cancelled.catch(()=>{});
    const task={controller,source:null,finish:null,epoch,signal,cancelled,rejectCancelled,apiTimer:null};active=task;
    const aborted=()=>{if(active===task)cancel();};signal?.addEventListener('abort',aborted,{once:true});
    try{
      onState('loading');
      let buffer=null,played=false;
      if(endpoint&&context?.state==='running'){
        const deadline=new Promise((_,reject)=>{task.apiTimer=setTimeout(()=>{controller.abort();reject(Error('Speech request timed out'));},apiTimeoutMs);});
        try{
          const request=(async()=>{
            const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,personalityId:customer.personalityId}),signal:controller.signal});
            if(!response.ok||controller.signal.aborted)throw Error('Speech unavailable');
            const data=await response.json();
            if(controller.signal.aborted||typeof data.audio!=='string'||!data.audio.length||data.audio.length>1400000||data.mimeType!=='audio/mpeg')throw Error('Invalid speech');
            const bytes=Uint8Array.from(environment.atob(data.audio),c=>c.charCodeAt(0));
            return context.decodeAudioData(bytes.buffer);
          })();
          buffer=await Promise.race([request,deadline,cancelled]);
        }catch{if(!current(task))return;}finally{clearTimeout(task.apiTimer);}
      }
      if(!current(task))return;
      if(buffer){
        try{
          await playback(task,done=>{
            const source=context.createBufferSource();task.source=source;source.buffer=buffer;source.connect(context.destination);source.onended=done;
            onState('speaking');source.start();
            return ()=>{source.onended=null;safely(()=>source.disconnect?.());};
          });played=true;
        }catch{if(!current(task))return;}
      }
      if(!current(task))return;
      if(!played&&environment.speechSynthesis&&environment.SpeechSynthesisUtterance){
        await playback(task,done=>{
          const utterance=new environment.SpeechSynthesisUtterance(text);
          const voices=(safely(()=>environment.speechSynthesis.getVoices())||[]).filter(v=>v.lang?.startsWith('en'));
          const hash=[...(customer.personalityId||'')].reduce((n,c)=>n+c.charCodeAt(0),0);
          if(voices.length)utterance.voice=voices[hash%voices.length];
          utterance.rate=customer.personalityId==='brisk'?1.08:.98;
          utterance.onend=done;utterance.onerror=()=>{if(current(task))onError('Sound is blocked. Enable sound for this page and try again.');done();};
          onState('speaking');environment.speechSynthesis.speak(utterance);
          return ()=>{utterance.onend=null;utterance.onerror=null;};
        });played=true;
      }
      if(!played&&current(task))onError('Enable sound in your browser to hear the customer.');
    }catch{if(current(task))onError('Sound is blocked. Enable sound for this page and try again.');}
    finally{
      clearTimeout(task.apiTimer);task.finish?.();signal?.removeEventListener('abort',aborted);
      if(active===task){active=null;onState('idle');}
    }
  }
  return {unlock,speak,cancel};
}
