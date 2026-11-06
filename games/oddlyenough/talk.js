// Free-form fallback: grounded detail recognition, questions, honesty and diminishing returns.
import {AI_TIMEOUT_MS,MAX_HISTORY} from './tuning.js';
const words = s => new Set(s.toLowerCase().match(/[a-z]{4,}/g)||[]);
const generic = new Set(['this','that','with','from','have','your','they','what','when','only','about','been','into','there','would','could','which','same']);
const defects = [/\bcrack(?:ed|s)?\b/i,/\bbroken\b/i,/\bmissing\b/i,/\bworn\b/i,/\bscratch(?:ed|es)?\b/i,/\bdamag(?:e|ed)\b/i,/\b(?:stuck|fused|sticks)\b/i,/\bchip(?:ped|s)?\b/i,/\bloose\b/i,/\bslip(?:s|ped)?\b/i,/\bcrooked\b/i,/\bburn(?:t|ed)?\b/i];
// Scope negation to the words immediately before a claim, not the entire pitch.
const asserted = (text,pattern) => {
  return [...text.matchAll(new RegExp(pattern.source,pattern.flags.replace('g','')+'g'))].some(match=>{
    const prefix=text.slice(0,match.index).split(/[.!?;,]|\b(?:but|however)\b/i).at(-1).split(/\s+/).slice(-5).join(' ');
    return !/\b(?:not|never|no|isn't|isnt|isn’t|without)\b/i.test(prefix);
  });
};
const questionTopic = text => /\b(?:condition|crack|broken|damage|defect|missing)\b/i.test(text)?'condition':/\b(?:work|works|does|function|use|operat)/i.test(text)?'function':/\b(?:worth|price|value|cost|pay)\b/i.test(text)?'value':/\b(?:rare|rarity|unique|many)\b/i.test(text)?'rarity':/\b(?:history|from|where|story|made|age|old|prove|provenance)\b/i.test(text)?'history':'general';
export function readPitch(text, customer, item, used = new Set()) {
  const tokens=words(text), matched=[];
  const detailWords=item.details.map(detail=>new Set([...words(detail.label+' '+detail.text)].filter(w=>!generic.has(w))));
  for (const detail of item.details) {
    const hits=[...detailWords[item.details.indexOf(detail)]].filter(w=>tokens.has(w));
    const distinctive=hits.filter(w=>detailWords.filter(set=>set.has(w)).length===1);
    if (hits.length>=2&&(distinctive.length>=2||hits.length>=4)) matched.push(detail);
  }
  const fresh=matched.filter(d=>!used.has(d.id));
  const relevant=fresh.filter(d=>d.tags.some(t=>customer.interests.includes(t)));
  const bluff=asserted(text,/\b(?:guaranteed|priceless|flawless|perfect|million|trust me|100\s*%)/i);
  const question=/\?|\b(why|how|what|where|tell me|does it)\b/i.test(text);
  const condition=item.condition+' '+item.details.map(d=>d.text).join(' ');
  const groundedDefects=defects.filter(pattern=>pattern.test(condition));
  const deniesCondition=groundedDefects.some(pattern=>pattern.test(text)&&!asserted(text,pattern));
  const honest=groundedDefects.some(pattern=>asserted(text,pattern)) || /\b(?:unverified|can't prove|cannot prove|can’t prove)\b/i.test(text);
  return {matched,fresh,relevant,bluff,question,questionTopic:questionTopic(text),honest,deniesCondition,repeated:matched.length>0&&!fresh.length};
}
// Semantic judgments are advisory; only known evidence IDs and booleans cross this boundary.
export function readEvaluation(value,item) {
  if(!value||!Array.isArray(value.relevantDetailIds)||value.relevantDetailIds.length>item.details.length||!['acknowledgesCondition','overclaim','question'].every(k=>typeof value[k]==='boolean'))return null;
  if(value.relevantDetailIds.some(id=>typeof id!=='string'||!item.details.some(d=>d.id===id)))return null;
  return {relevantDetailIds:[...new Set(value.relevantDetailIds)],acknowledgesCondition:value.acknowledgesCondition,overclaim:value.overclaim,question:value.question};
}
export function fallbackReply({text,customer,item,reading,turn}) {
  if (reading.bluff) return {line:`${customer.name.split(' ')[0]} raises an eyebrow. “${customer.objection || 'Can you actually back that up?'} No guarantees without evidence.”`,expression:'doubt'};
  if (reading.honest && !reading.repeated) return {line:customer.role==='seller' ? `“Fair. ${item.condition} I can move on the price, but it still has a story.”` : `“Thanks for saying so. ${item.condition} I'll have to allow for that.”`,expression:'interested'};
  if (reading.repeated) return {line:'“You already told me that part. What else should I know?”',expression:'doubt'};
  if (reading.question) {
    const tag=/\b(work|does|function|use)\b/i.test(text)?'function':/\b(worth|price|value)\b/i.test(text)?'value':'history';
    const detail=item.details.find(d=>d.tags.includes(tag))||item.details[turn%item.details.length];
    return {line:customer.role==='seller' ? `“${detail.text} ${turn%2 ? 'That is what I can show you.' : "The rest is just the story I was told."}”` : `“${customer.objection || 'What can you show me that makes it worth the asking price?'}”`,expression:'curious'};
  }
  if (reading.relevant.length) return {line:`“${customer.reaction || 'Now that is interesting.'} That is a detail I care about. Let's talk price.”`,expression:'pleased'};
  if (reading.fresh.length) return {line:`“I see it. But ${customer.objection || "what would I actually do with it?"}”`,expression:'curious'};
  const lines=[`“${customer.objection || 'What makes this piece special?'}”`,`“Show me something on the object. I need more than a good sales voice.”`,`“I have a little time. Give me a reason this belongs in my life.”`];
  return {line:lines[turn%lines.length],expression:'neutral'};
}
// Optional same-origin server integration. No endpoint or credential is assumed on static hosting.
export function createTalkClient({endpoint=null,fetchImpl=globalThis.fetch,timeout=AI_TIMEOUT_MS}={}) {
  const talk=async (context,{signal}={})=>{
    const fallback=()=>context.event&&context.event!=='reply'?{line:context.customer.greeting||'Let me take a look.',expression:'neutral',source:'authored'}:({...fallbackReply(context),source:'authored'});
    if (!endpoint || signal?.aborted) return fallback();
    const controller=new AbortController();let rejectCancelled;
    const cancelled=new Promise((_,reject)=>{rejectCancelled=reject;});
    const abort=()=>{controller.abort();rejectCancelled(new Error('Dialogue cancelled'));};
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,timeout);
    try {
      const response=await Promise.race([fetchImpl(endpoint,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({text:context.text,customer:context.customer.id,personalityId:context.customer.personalityId,event:context.event||'reply',prototype:context.prototype===true,item:context.item.id,history:context.history?.slice(-MAX_HISTORY),state:context.state})}),cancelled]);
      if (!response.ok) return fallback();
      const data=await Promise.race([response.json(),cancelled]);
      if (typeof data.line!=='string'||!data.line.trim()||data.line.length>500||!['neutral','curious','pleased','doubt','interested'].includes(data.expression)) return fallback();
      // Dialogue only. Price, intent, money and inventory fields from a model are ignored.
      const evaluation=readEvaluation(data.evaluation,context.item);
      return {line:data.line,expression:data.expression,source:'live',...(evaluation?{evaluation}:{})};
    } catch {return fallback();} finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  };
  Object.defineProperty(talk,'live',{get:()=>Boolean(endpoint)});
  return talk;
}
