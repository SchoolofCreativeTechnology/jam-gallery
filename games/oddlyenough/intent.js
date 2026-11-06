// Interpretation proposes an action; only the game may apply it to the ledger.
import {MAX_HISTORY,MAX_PITCH_LENGTH} from './tuning.js';

const kinds=new Set(['offer','accept','decline','question','discussion','ambiguous']);
const fields=new Set(['kind','amount','evidence','confidence']);
const fallback=()=>({kind:'ambiguous',amount:null,evidence:'',confidence:0,source:'fallback'});
function validated(data,text){
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==4||Object.keys(data).some(key=>!fields.has(key)))return null;
  if(!kinds.has(data.kind)||typeof data.confidence!=='number'||!Number.isFinite(data.confidence)||data.confidence<0||data.confidence>1)return null;
  if(typeof data.evidence!=='string'||!data.evidence.trim()||data.evidence.length>220||!text.includes(data.evidence))return null;
  if(data.kind==='offer'?!Number.isSafeInteger(data.amount)||data.amount<1||data.amount>500:data.amount!==null)return null;
  const threshold=data.kind==='offer'?0.8:data.kind==='accept'?0.9:0;
  const kind=data.confidence<threshold?'ambiguous':data.kind;
  return {kind,amount:kind==='offer'?data.amount:null,evidence:data.evidence,confidence:data.confidence,source:'live'};
}
function publicState(context){
  const state=context.state||{},negotiation=state.negotiation;
  const result={role:state.role??context.customer?.role,turn:state.turn??context.turn};
  if(negotiation&&typeof negotiation==='object'){
    result.negotiation={};
    for(const field of ['difficulty','receptiveness','playerOffer','customerOffer','agreedPrice','status','lastAction','feedback']){
      if(Object.hasOwn(negotiation,field))result.negotiation[field]=negotiation[field];
    }
  }
  return result;
}

export function createIntentClient({endpoint=null,fetchImpl=globalThis.fetch,timeout=9000}={}){
  const wait=Number.isFinite(timeout)&&timeout>0?Math.min(timeout,60000):9000;
  return async function interpret(context,{signal}={}){
    const text=context?.text;
    if(!endpoint||typeof fetchImpl!=='function'||signal?.aborted||typeof text!=='string'||!text.trim()||text.length>MAX_PITCH_LENGTH)return fallback();
    const controller=new AbortController();let rejectCancelled;
    const cancelled=new Promise((_,reject)=>{rejectCancelled=reject;});
    const abort=()=>{controller.abort();rejectCancelled(new Error('Interpretation cancelled'));};
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,wait);
    try{
      const history=(Array.isArray(context.history)?context.history:[]).slice(-MAX_HISTORY)
        .filter(entry=>entry&&['user','assistant'].includes(entry.role)&&typeof entry.content==='string')
        .map(({role,content})=>({role,content:content.slice(0,MAX_PITCH_LENGTH)}));
      const body=JSON.stringify({prototype:true,event:'reply',text,customer:context.customer?.id,item:context.item?.id,
        personalityId:context.customer?.personalityId,history,state:publicState(context)});
      const response=await Promise.race([Promise.resolve().then(()=>{
        if(controller.signal.aborted)throw new Error('Interpretation cancelled');
        return fetchImpl(endpoint,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body});
      }),cancelled]);
      if(!response?.ok||controller.signal.aborted)return fallback();
      const data=await Promise.race([response.json(),cancelled]);
      if(controller.signal.aborted)return fallback();
      return validated(data,text)||fallback();
    }catch{return fallback();}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  };
}
