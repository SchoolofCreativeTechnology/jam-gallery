// Deterministic bargaining authority. Dialogue may describe these results but cannot set them.
import { BARGAIN_TUNING } from './tuning.js';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const price=n=>Number.isSafeInteger(n)&&n>=1&&n<=500;
const unit={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const numberWord=Object.keys(unit).concat(['hundred','thousand','million']).join('|');
const wordAmount=`(?:(?:a\\s+hundred|${numberWord})(?:[\\s-]+(?:and[\\s-]+)?(?:${numberWord}))*)`;
const amounts=new RegExp(`(?<![a-z0-9])(?:(?:minus|negative)\\s+)?(?:[$£€]\\s*)?[+-]?\\d+(?:,\\d{3})*(?:\\.\\d+)?(?:\\s*(?:dollars?|bucks?|cents?))?|\\b(?:(?:minus|negative)\\s+)?${wordAmount}(?:\\s*(?:dollars?|bucks?|cents?))?\\b`,'g');
function wordsToNumber(value){
  const tokens=value.replace(/\b(?:dollars?|bucks?|cents?)\b/g,'').trim().split(/[\s-]+/).filter(w=>w!=='and');
  if(tokens.includes('minus')||tokens.includes('negative'))return -1;
  if(tokens.includes('thousand')||tokens.includes('million'))return 1000;
  const small=parts=>parts.length===1&&Object.hasOwn(unit,parts[0])?unit[parts[0]]:parts.length===2&&unit[parts[0]]>=20&&unit[parts[0]]%10===0&&unit[parts[1]]>=1&&unit[parts[1]]<=9?unit[parts[0]]+unit[parts[1]]:NaN;
  const at=tokens.indexOf('hundred');
  if(at<0)return small(tokens);
  if(at>1||tokens.lastIndexOf('hundred')!==at)return NaN;
  const hundreds=at===0||tokens[0]==='a'?1:unit[tokens[0]];
  if(!(hundreds>=1&&hundreds<=9))return NaN;
  const rest=tokens.slice(at+1);return hundreds*100+(rest.length?small(rest):0);
}
// Only a price next to an affirmative negotiation phrase can become an offer.
const pricePrefix=/^(?:(?:i|we)\s+(?:(?:will|can|could|would|am willing to|want to|am|are)\s+)?(?:offer(?:ing)?|pay|give|do|take|accept|ask(?:ing)?)\b(?:\s+(?:you|me|it|this|that|for|at|just|only|exactly|cash))*|(?:i|we)\s+(?:(?:will|can|could|would|want to)\s+)?(?:buy|sell)\b(?:\s+[a-z']+){0,7}\s+(?:for|at)|(?:my|our)\s+(?:(?:asking|selling)\s+)?(?:offer|price|bid)(?:\s+is)?|(?:would|will|can|could)\s+you\s+(?:take|accept|do|sell|pay)\b(?:\s+(?:it|this|that|for|at|just|only))*|(?:how|what)\s+about|(?:can|could|would)\s+we\s+(?:do|make it|settle on)|let us (?:do|settle on)|let's (?:do|settle on)|make it|i was thinking|(?:my|our) best(?: offer)?(?: is)?|asking for|i\s+(?:would\s+)?want|i am looking for|i\s+(?:(?:will|can|would)\s+)?let\s+(?:it|this|that)\s+go\s+for|you\s+can\s+have\s+(?:it|this|that)\s+for)$/;
const rejectedOffer=/\b(?:won't|wouldn't|can't|cannot|don't|do not|will not|would not|not going to|never|not)\s+(?:\w+\s+){0,2}(?:pay|give|offer|accept|take|sell|buy|do|ask|asking|want|looking|let|have)\b|\b(?:price|offer|bid)\s+(?:isn't|wasn't|(?:is|was)\s+(?:not|no longer))\b|\bnot\s+(?:[$]?\d|zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)/;
const correction=/\b(?:actually|sorry|i mean|make that|correction|rather|instead)\b|,\s*no\s*,/g;
function clauses(text){
  const result=[];let start=0;
  for(let at=0;at<text.length;at++)if(/[.!?;\n]/.test(text[at])&&!(text[at]==='.'&&/\d/.test(text[at-1]||'')&&/\d/.test(text[at+1]||''))){
    if(text.slice(start,at).trim())result.push({text:text.slice(start,at).trim(),question:text[at]==='?'});start=at+1;
  }
  if(text.slice(start).trim())result.push({text:text.slice(start).trim(),question:false});return result;
}
function parseClause({text,question,allowBareCorrection=false}){
  const matches=[...text.matchAll(amounts)];if(!matches.length)return {kind:'none'};
  const remainder=text.replace(amounts,'').replace(/[\s$,.!?]+/g,' ').trim();
  const plain=/^(?:please|cash|please cash|cash please|deal|for (?:it|this|that|the item)(?: (?:please|cash|deal))?)?$/.test(remainder)||!remainder.replace(/\b(?:between|from|to|and|or|through)\b|[-–—]/g,'').trim();
  const prefix=text.slice(0,matches[0].index).trim().replace(/^[,\s]+/,'').replace(/^(?:(?:you know what|you know|i think|i reckon|i guess|i would say|all right|alright|yeah|yep|hey|uh|um|hmm|listen|no|well|okay|ok|so|then|fine|please|look|honestly|yes)(?:[,\s]+|$))+/,'').replace(/^i would say[,\s]+/,'').trim();
  const bindingPrefix=prefix.replace(/\s+(?:between|under|over|below|above|up to|at most|at least|more than|less than)$/,'');
  const afterAmount=text.slice(matches[0].index+matches[0][0].length).trim();
  const fairProposal=!prefix&&/^(?:(?:sounds?|seems?|feels?)\s+(?:fair|reasonable|good|right)(?:\s+(?:to|for)\s+me)?|(?:works?|would work)\s+for\s+me|(?:is\s+)?(?:my|our)\s+(?:offer|price|best))(?:[, ]+(?:what do you think|how does that sound))?$/.test(afterAmount);
  const isBound=fairProposal||pricePrefix.test(bindingPrefix)&&(!/^i\s+(?:would\s+)?want$/.test(bindingPrefix)||/\bfor (?:it|this|that)\b/.test(text.slice(matches[0].index+matches[0][0].length)));
  if(!isBound&&!plain)return {kind:'none'};
  if(rejectedOffer.test(text))return {kind:'none'};
  // Hypothetical, reported and elsewhere prices are discussion, even when they
  // contain an offer-shaped fragment. The model can ask a follow-up about them.
  if(/"|\b(?:if|as (?:an? )?(?:example|hypothetical)|somewhere else|elsewhere|(?:which )?is what (?:you|they|he|she) said|used to|yesterday|last (?:year|month|week)|back then)\b/.test(text))return {kind:'none'};
  if(matches.some(m=>/^\s*(?:years?|months?|days?|hours?|minutes?|seconds?|percent|cracks?|scratches?|pieces?|copies|degrees|inches)\b|^\s*%/.test(text.slice(m.index+m[0].length))))return {kind:'none'};
  const explicit=isBound;
  if(question&&!fairProposal&&!/^(?:(?:how|what) about|(?:would|will|can|could) (?:you|we))\b/.test(prefix)&&!/(?:^| )deal$/.test(remainder))return {kind:'ambiguous',message:'Is that your proposed price, or a question about the current one?',explicit};
  if(/\b(?:between|under|over|below|above|up to|at most|at least|more than|less than)\b/.test(text))return {kind:'ambiguous',message:'Name one exact dollar amount, not a range or limit.',explicit};
  if(/\bcents?|\bpoint\b|[£€]/.test(text)||matches.some(m=>/\.\d/.test(m[0])))return {kind:'invalid',message:'Use a whole-dollar offer from $1 to $500.',explicit};
  if(matches.length!==1)return {kind:'ambiguous',message:'Which single price would you like to propose?',explicit};
  const raw=matches[0][0],amount=/\b(?:minus|negative)\b/.test(raw)?-1:/\d/.test(raw)?Number(raw.replace(/[$,]|\b(?:dollars?|bucks?)\b/g,'').trim()):wordsToNumber(raw);
  if(!price(amount))return {kind:'invalid',message:'Use a whole-dollar offer from $1 to $500.',explicit};
  if(!isBound&&!allowBareCorrection&&!/\b(?:for|deal)\b/.test(remainder))return {kind:'ambiguous',message:'Is that the price you would like to propose?',explicit};
  return {kind:'offer',amount,explicit};
}
export function parseSpokenOffer(input){
  if(typeof input!=='string'||!input.trim())return {kind:'none'};
  let text=input.toLowerCase().replace(/[’‘]/g,"'").replace(/−/g,'-').replace(/\bi'll\b/g,'i will').replace(/\bi'd\b/g,'i would').replace(/\bi'm\b/g,'i am').trim();
  if(/^(?:(?:yes|okay|ok),?\s+)?(?:deal|agreed|we have a deal|i accept(?: (?:your|that|the) (?:offer|price))?|i will take it)(?:,? (?:please|thanks|thank you))?[.!]*$/.test(text))return {kind:'accept'};
  // A withdrawal cancels earlier proposals; a later fresh proposal is allowed.
  const withdrawn=[...text.matchAll(/\b(?:never mind|nevermind|forget it|(?:actually|but)[,\s]+no\b|not really|just (?:kidding|joking)|i take (?:it|that) back|(?:i|we)\s+(?:will not|won't|cannot|can't|would not|wouldn't|do not|don't)\s+(?:pay|buy|take|accept|offer|afford)\s+(?:it|that|this|anything)|(?:that|this|it)\s+(?:is|was)\s+not\s+(?:an?|my|our)\s+(?:offer|proposal))\b/g)].at(-1);
  const numericWithdrawal=[...text.matchAll(/\b(?:i|we)\s+(?:will not|won't|cannot|can't|would not|wouldn't|do not|don't)\s+(?:pay|buy|take|accept|offer|afford)\s+/g)]
    .map(match=>{const value=[...text.slice(match.index+match[0].length).matchAll(amounts)][0];return value?.index===0?{index:match.index,0:match[0]+value[0]}:null;}).filter(Boolean).at(-1);
  const latestWithdrawal=[withdrawn,numericWithdrawal].filter(Boolean).sort((a,b)=>a.index-b.index).at(-1);
  if(latestWithdrawal)text=text.slice(latestWithdrawal.index+latestWithdrawal[0].length).replace(/^[,\s.!]+/,'').replace(/^(?:but|however|though)[,\s]+/,'');
  // Explicit corrections replace old amounts. Otherwise inspect each clause independently.
  const corrections=[...text.matchAll(correction)];let allowBareCorrection=false;
  if(corrections.length){
    const last=corrections.at(-1),tail=text.slice(last.index+last[0].length).replace(/^[,\s]+/,'');
    if([...tail.matchAll(amounts)].length){allowBareCorrection=clauses(text.slice(0,last.index)).some(clause=>parseClause(clause).kind==='offer');text=tail;}
  }
  const results=clauses(text).flatMap(clause=>clause.text.split(/\s+but\s+/).map(part=>parseClause({...clause,text:part,allowBareCorrection}))).filter(result=>result.kind!=='none');
  const offers=results.filter(result=>result.kind==='offer');
  if(offers.length>1)return {kind:'ambiguous',message:'I heard more than one price. Which is your final proposal?'};
  const conflict=results.find(result=>result.kind!=='offer'&&result.explicit);
  const chosen=conflict||offers[0]||results[0];
  if(!chosen)return {kind:'none'};
  const {explicit,...result}=chosen;return result;
}
function groundedSemanticProposal(text,intent){
  // The model decides conversational intent. This guard checks grounded money and
  // known non-proposal contexts; it does not demand a second command-language match.
  if(intent.confidence<.8)return false;
  const lower=text.toLowerCase().replace(/[’‘]/g,"'").replace(/−/g,'-');
  const evidence=intent.evidence.toLowerCase().replace(/[’‘]/g,"'").replace(/−/g,'-');
  const start=lower.indexOf(evidence),end=start+evidence.length;
  const mentioned=[...lower.matchAll(amounts)].filter(match=>match.index>=start&&match.index+match[0].length<=end);
  if(start<0||mentioned.length!==1)return false;
  const mention=mentioned[0],raw=mention[0];
  const value=/\b(?:minus|negative)\b/.test(raw)?-1:/\d/.test(raw)?Number(raw.replace(/[$,]|\b(?:dollars?|bucks?)\b/g,'').trim()):wordsToNumber(raw);
  if(value!==intent.amount)return false;
  const remainder=evidence.replace(amounts,'').replace(/[\s$,.!?;:—-]/g,'');
  if(!remainder||/^(?:dollars?|bucks?|forit|forthis|forthat)$/.test(remainder))return false;
  const before=lower.slice(0,mention.index).split(/[.!?;\n]/).at(-1);
  const following=lower.slice(mention.index+raw.length);
  if(/[.!?;\n]/.exec(following)?.[0]==='?')return false;
  const after=following.split(/[.!?;\n]/)[0];
  // A contrast can introduce a new proposal after rejecting an earlier price.
  const localBefore=before.split(/\b(?:but|so|however|instead)\b/).at(-1).trim();
  const clause=`${localBefore} ${raw}${after}`;
  if(/^(?:no[,\s]+)?i mean\b/.test(localBefore))return false;
  if([...clause.matchAll(amounts)].length!==1)return false;
  if(/["“”]/.test(clause)||/\b(?:if|unless|hypothetical|as (?:an? )?example|suppose|somewhere else|elsewhere|yesterday|last (?:year|month|week)|back then)\b/.test(clause))return false;
  if(/\b(?:not|never|won't|wouldn't|can't|cannot|don't|isn't|wasn't|aren't|weren't|didn't|no longer)\b/.test(clause))return false;
  if(/\b(?:too (?:much|high|low|expensive|cheap)|ridiculous|overpriced|underpriced|outrageous|unfair)\b/.test(clause))return false;
  if(/\b(?:i|you|they|he|she|someone)\s+(?:said|asked|offered|paid|charged|quoted|heard|remember)\b|\bused to\b/.test(clause))return false;
  if(/\b(?:your|their|his|her|the)\s+(?:asking\s+)?(?:price|offer|quote)\b|\b(?:costs?|worth|value|priced at|listed at)\s*$/.test(localBefore))return false;
  if(/^(?:why|what|who|where|when|how|is|are|was|were|does|did|do)\b/.test(localBefore)||after.includes('?'))return false;
  if(/^\s*(?:years?|months?|days?|hours?|minutes?|seconds?|percent|cracks?|scratches?|pieces?|copies|degrees|inches)\b|^\s*%/.test(after))return false;
  const later=lower.slice(mention.index+raw.length);
  if(/\b(?:never mind|nevermind|forget it|just (?:kidding|joking)|i take (?:it|that) back|(?:actually|but)[,\s]+no\b|not (?:an?|my|our) (?:offer|proposal))\b/.test(later))return false;
  if(/\b(?:i|we)\s+(?:will not|won't|cannot|can't|would not|wouldn't|do not|don't)\s+(?:pay|buy|take|accept|offer|afford)\b/.test(later))return false;
  return true;
}

// A model interpretation can explain intent, but cannot invent a price or promote a quoted price.
export function validateInterpretedOffer(text,intent,negotiation){
  if(typeof text!=='string'||!intent||!['offer','accept'].includes(intent.kind)||typeof intent.evidence!=='string'||!intent.evidence.trim()||!text.includes(intent.evidence)||!Number.isFinite(intent.confidence)||intent.confidence<0||intent.confidence>1)return false;
  const whole=parseSpokenOffer(text),evidence=parseSpokenOffer(intent.evidence);
  if(intent.kind==='accept')return intent.amount===null&&whole.kind==='accept'&&evidence.kind==='accept';
  if(!price(intent.amount))return false;
  if(whole.kind==='offer'&&whole.amount===intent.amount&&evidence.kind==='offer'&&evidence.amount===intent.amount)return true;
  if(whole.kind!=='invalid'&&groundedSemanticProposal(text,intent))return true;
  // A brief correction can refer to an existing player offer, but its evidence
  // must include the complete corrective phrase and nothing except one price.
  if(!price(negotiation?.playerOffer)||intent.evidence.trim()!==text.trim())return false;
  const correction=text.toLowerCase().trim().match(/^(?:no[,\s]+)?i mean[,\s]+(.+?)[.!]?$/);
  if(!correction)return false;
  const tail=correction[1].trim(),matches=[...tail.matchAll(amounts)];
  if(matches.length!==1||matches[0].index!==0||matches[0][0].length!==tail.length)return false;
  const corrected=parseSpokenOffer(`I offer ${tail}`);
  return corrected.kind==='offer'&&corrected.amount===intent.amount;
}
const difficultyBias={easygoing:-.2,enthusiastic:-.15,nostalgic:-.05,guarded:.16,analytical:.12,contrarian:.2,brisk:.04,theatrical:0};
export function createBargain(customer,item){
  const resistance=clamp((Number.isFinite(customer.skepticism)?customer.skepticism:.35)+(difficultyBias[customer.personalityId]||0),0,1);
  const difficulty=resistance<=.28?'easy':resistance>=.52?'hard':'balanced';
  const factor={easy:0,balanced:1,hard:2}[difficulty];
  const base=Number(item.baseValue??item.value??(Number(item.cost)*2));
  const value=clamp(Number.isFinite(base)&&base>0?Math.round(base):80,2,500);
  const role=customer.role==='seller'?'seller':'buyer';
  const opening=clamp(Math.round(value*(.85+factor*.06)),1,500);
  const floor=clamp(Math.round(value*(.38+factor*.075)),1,opening);
  const ceiling=clamp(Math.round(value*(1.12-factor*.1)),1,500);
  const bargain={receptiveness:BARGAIN_TUNING.receptivenessStart[factor],difficulty,difficultyLabel:{easy:'Easygoing',balanced:'Measured',hard:'Hard to convince'}[difficulty],playerOffer:null,customerOffer:role==='seller'?opening:null,agreedPrice:null,status:'negotiating',lastAction:'opening',feedback:role==='seller'?`The seller opens at $${opening}.`:'The buyer is waiting for your price.',usedDetailIds:new Set()};
  Object.defineProperty(bargain,'_rules',{value:{role,customer,item,factor,opening,floor,ceiling,seen:new Set(),unfairOffers:new Set(),fairOfferScore:0,honestyUsed:false,gullibilityUsed:false},enumerable:false});
  return bargain;
}
function threshold(bargain){
  const r=bargain._rules,interest=bargain.receptiveness/100;
  return r.role==='seller'?Math.max(r.floor,Math.round(r.opening-(r.opening-r.floor)*interest)):Math.min(r.ceiling,Math.max(1,Math.round(r.ceiling*(.5+.5*interest))));
}
export function applyBargainTurn(bargain,{text='',reading={},amount,accept=false,discussionOnly=false}={}){
  if(!bargain?._rules)throw new TypeError('Create the bargain with createBargain first.');
  if(bargain.status==='complete'||bargain.status==='completed')return bargain;
  const parsed=discussionOnly?{kind:'none'}:amount!==undefined?price(amount)?{kind:'offer',amount}:{kind:'invalid',message:'Use a whole-dollar offer from $1 to $500.'}:accept?{kind:'accept'}:parseSpokenOffer(text);
  if(bargain.status==='agreed'){
    if(parsed.kind!=='offer'||parsed.amount===bargain.agreedPrice)return bargain;
    bargain.status='negotiating';bargain.agreedPrice=null;
  }
  if(accept&&amount!==undefined){bargain.lastAction='clarify';bargain.feedback='Accept the quoted price or name a different offer, not both.';return bargain;}
  if(parsed.kind==='invalid'||parsed.kind==='ambiguous'){bargain.lastAction=parsed.kind==='invalid'?'invalid':'clarify';bargain.feedback=parsed.message;return bargain;}
  const r=bargain._rules;
  if(parsed.kind==='accept'){
    if(bargain.customerOffer===null){bargain.lastAction='clarify';bargain.feedback='The buyer has not quoted a price yet. Make an offer first.';return bargain;}
    bargain.agreedPrice=bargain.customerOffer;bargain.status='agreed';bargain.lastAction='accepted';bargain.receptiveness=Math.max(75,bargain.receptiveness);bargain.feedback=`Agreement reached at $${bargain.agreedPrice}.`;return bargain;
  }
  if(parsed.kind==='offer'){
    bargain.playerOffer=parsed.amount;
    const reference=bargain.customerOffer??(r.role==='seller'?r.opening:r.ceiling);
    const isUnfairPrice=r.role==='seller'?parsed.amount<reference/2:parsed.amount>reference*2;
    const firstPenalty=isUnfairPrice&&!r.unfairOffers.has(parsed.amount);
    if(firstPenalty){r.unfairOffers.add(parsed.amount);bargain.receptiveness=clamp(bargain.receptiveness-[8,12,16][r.factor],0,100);}
    // A closer price earns bounded progress. Repeating prices or inching through
    // endless one-dollar variants cannot accumulate unbounded trust.
    const fairRatio=r.role==='seller'?parsed.amount/r.opening:r.ceiling/parsed.amount;
    const fairScore=fairRatio<.65?0:Math.min(10,Math.floor((fairRatio-.6)*25));
    if(!isUnfairPrice&&fairScore>r.fairOfferScore){bargain.receptiveness=clamp(bargain.receptiveness+fairScore-r.fairOfferScore,0,100);r.fairOfferScore=fairScore;}
    const edge=threshold(bargain);
    // A customer's existing quote remains available even if later persuasion gets worse.
    // An unreasonable proposal never earns a concession, even when its penalty
    // was already applied on a previous turn.
    const limit=bargain.customerOffer===null?edge:isUnfairPrice?bargain.customerOffer:r.role==='seller'?Math.min(edge,bargain.customerOffer):Math.max(edge,bargain.customerOffer);
    if(r.role==='seller'?parsed.amount>=limit:parsed.amount<=limit){bargain.agreedPrice=parsed.amount;bargain.customerOffer=parsed.amount;bargain.status='agreed';bargain.lastAction='accepted';bargain.receptiveness=Math.max(75,bargain.receptiveness);bargain.feedback=`The ${r.role} agrees to $${parsed.amount}.`;}
    else{bargain.customerOffer=limit;bargain.lastAction='counter';bargain.feedback=(isUnfairPrice?'That offer feels unreasonable. ':'')+(r.role==='seller'?`The seller asks for $${limit}. Explain why they should come down.`:`The buyer offers $${limit}. Show why the item is worth more.`);}
    return bargain;
  }
  const normalized=String(text).toLowerCase().replace(/[^a-z0-9]/g,'');
  const repeated=r.seen.has(normalized)||reading.repeated===true;
  const insulting=reading.insult===true||/\b(?:you(?:'re| are)?\s+(?:a\s+|an\s+)?(?:idiot|moron|fool|liar|stupid|pathetic)|shut up)\b/i.test(text);
  if(normalized&&!reading.question&&!reading.bluff&&!reading.deniesCondition&&!insulting)r.seen.add(normalized);
  const supplied=new Set((reading.relevant||[]).map(d=>typeof d==='string'?d:d?.id));
  for(const id of reading.relevantDetailIds||[])supplied.add(id);
  const matching=(r.item.details||[]).filter(d=>supplied.has(d.id)&&d.tags.some(tag=>(r.customer.interests||[]).includes(tag)));
  const fresh=matching.filter(d=>!bargain.usedDetailIds.has(d.id));
  const unsupported=reading.bluff||(!matching.length&&!reading.honest);
  let change=0,feedback='They are listening. Give them a concrete reason to change their price.';
  if(insulting){change=-[12,16,20][r.factor];feedback='Insulting them makes them less willing to bargain.';}
  else if(reading.question){feedback='A question helps you learn about the object. Use the answer to make your case.';}
  else if(reading.deniesCondition){change=reading.bluff?-BARGAIN_TUNING.bluffPenalty[r.factor]:0;feedback='Denying the known condition does not earn their trust.';}
  else if(unsupported&&normalized&&!repeated&&!r.gullibilityUsed){r.gullibilityUsed=true;change=BARGAIN_TUNING.benefitOfDoubtGain[r.factor];feedback='They give you the benefit of the doubt for now. The claim is still unproven.';}
  else if(reading.bluff){change=-BARGAIN_TUNING.bluffPenalty[r.factor];feedback='That unsupported claim makes them more skeptical.';}
  else if(repeated){change=-2;feedback='Repeating the same point does not persuade them.';}
  else if(fresh.length){for(const detail of fresh)bargain.usedDetailIds.add(detail.id);change=BARGAIN_TUNING.evidenceGain[r.factor]*Math.min(2,fresh.length);feedback='That evidence matches their interests. They are more receptive.';}
  else if(reading.honest&&!r.honestyUsed){change=BARGAIN_TUNING.honestyGain[r.factor];r.honestyUsed=true;feedback='Acknowledging the condition earns some trust.';}
  else if(reading.honest){feedback='They already appreciated your honesty. Show them another useful detail.';}
  bargain.receptiveness=clamp(bargain.receptiveness+change,0,100);
  if(change>0&&bargain.customerOffer!==null){const edge=threshold(bargain);bargain.customerOffer=r.role==='seller'?Math.min(bargain.customerOffer,edge):Math.max(bargain.customerOffer,edge);}
  bargain.lastAction='pitch';bargain.feedback=feedback;return bargain;
}
