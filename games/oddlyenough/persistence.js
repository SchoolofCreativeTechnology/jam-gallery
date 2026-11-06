// Versioned local saves contain gameplay data only: never transport settings or credentials.
import * as T from './tuning.js';
import {createState,buy,sell,payRent,inventoryValue,score,validPrice} from './state.js';
import {ITEMS,getItem} from './items.js';
import {CUSTOMERS} from './customers.js';
import {withPersonality} from './personalities.js';

export const SAVE_VERSION=1;
export const SAVE_KEY='oddly-enough.save.v1';
export const MAX_SAVE_BYTES=1000000;
const MAX_DAYS=1000;
const MAX_LOG=MAX_DAYS*(T.CUSTOMERS_PER_DAY+1);
const MAX_CASH=T.CASH_START+MAX_LOG*T.MAX_OFFER;
const phases=new Set(['play','results','gameover']);
const expressions=new Set(['neutral','curious','pleased','doubt','interested']);
const questionTopics=new Set(['function','value','history','condition','rarity','general']);
const pendingEvents=new Set(['reply','greeting','item-selected']);
const fail=()=>{throw new Error('Invalid saved game');};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const unit=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const text=(x,max=2000)=>typeof x==='string'&&x.length<=max;
const id=x=>text(x,120)&&x.trim().length>0&&!/[\u0000-\u001f\u007f]/.test(x);
const itemFor=id=>typeof id==='string'&&Object.hasOwn(ITEMS,id)?getItem(id):null;
const array=(x,max)=>Array.isArray(x)&&x.length<=max;
function unique(values,max,valid){
  if(!array(values,max)||values.some(x=>!valid(x))||new Set(values).size!==values.length)fail();
  return new Set(values);
}
function detailSet(values,item){return unique(values,item.details.length,id=>item.details.some(d=>d.id===id));}
function sameSet(a,b){return a.size===b.size&&[...a].every(x=>b.has(x));}
function capture(game){
  const s=game.state,e=game.encounter;
  return {version:SAVE_VERSION,phase:game.phase,state:{cash:s.cash,day:s.day,customerIndex:s.customerIndex,
    personalitySeed:Object.hasOwn(s,'personalitySeed')?s.personalitySeed:0,
    inventory:s.inventory.map(x=>({id:x.id,acquisitionPrice:x.acquisitionPrice})),
    closedDeals:[...s.closedDeals],paidDays:[...s.paidDays],log:s.log,memory:s.memory},
    encounter:e?{id:e.id,number:e.number,customer:{id:e.customer.id,role:e.customer.role,minimum:e.customer.minimum,budget:e.customer.budget,asking:e.customer.asking},
      itemId:e.item.id,status:e.status,pendingEvent:Object.hasOwn(e,'pendingEvent')?e.pendingEvent:e.status==='thinking'?'reply':null,
      greeted:Object.hasOwn(e,'greeted')?e.greeted:true,interest:e.interest,skepticism:e.skepticism,patience:e.patience,
      used:[...e.used],inspected:[...e.inspected],turn:e.turn,offer:e.offer,agreement:e.agreement,counter:e.counter,
      expression:e.expression,source:e.source,history:e.history,pitches:[...e.pitches],honestyUsed:e.honestyUsed,
      finalOffer:e.finalOffer??false,questions:[...(e.questions??[])],itemProgress:e.itemProgress??{}}:null,
    lines:game.lines,result:game.result};
}
function decode(input){
  // Re-parse objects as well as strings, so the result never keeps references to callers.
  const raw=typeof input==='string'?input:JSON.stringify(input,(_key,value)=>{
    if(typeof value==='number'&&!Number.isFinite(value))fail();
    return value;
  });
  if(typeof raw!=='string'||raw.length>MAX_SAVE_BYTES||new TextEncoder().encode(raw).length>MAX_SAVE_BYTES)fail();
  const saved=JSON.parse(raw);
  if(!record(saved)||saved.version!==SAVE_VERSION||!phases.has(saved.phase)||!record(saved.state))fail();
  const s=saved.state;
  if(!int(s.day,1,MAX_DAYS)||!int(s.customerIndex,0,T.CUSTOMERS_PER_DAY)||!int(s.cash,0,MAX_CASH)||!array(s.log,MAX_LOG)||!array(s.inventory,Object.keys(ITEMS).length)||!record(s.memory))fail();
  const personalitySeed=Object.hasOwn(s,'personalitySeed')?s.personalitySeed:0;
  if(!int(personalitySeed,0,0xffffffff))fail();
  const closed=unique(s.closedDeals,MAX_LOG,id),paid=unique(s.paidDays,MAX_DAYS,d=>int(d,1,s.day));
  const state=createState({personalitySeed});
  let lastDay=1,visits=0;
  // Replay the authoritative ledger. Reject inconsistent cash, duplicate settlement,
  // impossible ownership, forged acquisition costs, or rent charged twice.
  for(const entry of s.log){
    if(!record(entry)||!int(entry.day,1,s.day)||entry.day<lastDay)fail();
    if(entry.day!==lastDay){
      if(!state.paidDays.has(lastDay)||entry.day!==lastDay+1)fail();
      visits=0;
    }
    state.day=entry.day;lastDay=entry.day;
    if(entry.kind==='rent'){
      if(entry.price!==T.RENT||state.paidDays.has(entry.day)||!payRent(state).ok)fail();
    }else{
      if(!['buy','sell'].includes(entry.kind)||!itemFor(entry.itemId)||!id(entry.dealId)||state.paidDays.has(entry.day)||++visits>T.CUSTOMERS_PER_DAY)fail();
      const settled=(entry.kind==='buy'?buy:sell)(state,entry.itemId,entry.price,entry.dealId);
      if(!settled.ok||(entry.kind==='sell'&&state.log.at(-1).profit!==entry.profit))fail();
    }
  }
  if(state.cash!==s.cash||!sameSet(state.closedDeals,closed)||!sameSet(state.paidDays,paid))fail();
  for(let day=1;day<s.day;day++)if(!state.paidDays.has(day))fail();
  if(s.inventory.some(x=>!record(x)||!itemFor(x.id)||!validPrice(x.acquisitionPrice)))fail();
  if(new Set(s.inventory.map(x=>x.id)).size!==s.inventory.length||state.inventory.length!==s.inventory.length)fail();
  const owned=new Map(state.inventory.map(x=>[x.id,x.acquisitionPrice]));
  if(s.inventory.some(x=>owned.get(x.id)!==x.acquisitionPrice))fail();
  state.inventory=s.inventory.map(x=>({...itemFor(x.id),acquisitionPrice:x.acquisitionPrice}));
  state.day=s.day;state.customerIndex=s.customerIndex;state.memory={};
  if(Object.keys(s.memory).length>CUSTOMERS.length)fail();
  let memories=0;
  for(const [customerId,memory] of Object.entries(s.memory)){
    const customer=CUSTOMERS.find(c=>c.id===customerId);
    if(!customer||!record(memory)||!int(memory.deals,1,MAX_LOG))fail();
    const restored={deals:memory.deals};
    if(['lastItemId','lastPrice','lastRole'].some(key=>Object.hasOwn(memory,key))){
      if(!itemFor(memory.lastItemId)||!validPrice(memory.lastPrice)||!['buyer','seller'].includes(memory.lastRole)||(customer.role&&customer.role!==memory.lastRole))fail();
      Object.assign(restored,{lastItemId:memory.lastItemId,lastPrice:memory.lastPrice,lastRole:memory.lastRole});
    }
    state.memory[customerId]=restored;memories+=memory.deals;
  }
  if(memories!==state.closedDeals.size)fail();
  const dayLog=state.log.filter(x=>x.day===state.day);
  if(dayLog.filter(x=>x.kind!=='rent').length>state.customerIndex)fail();
  let encounter=null,result=null;
  if(saved.phase==='play'){
    if(state.paidDays.has(state.day)||!record(saved.encounter))fail();
    const e=saved.encounter,c=e.customer,item=itemFor(e.itemId);
    if(!record(c)||!item||!id(e.id)||!int(e.number,1,T.CUSTOMERS_PER_DAY)||!['active','thinking','leaving'].includes(e.status))fail();
    const pendingEvent=Object.hasOwn(e,'pendingEvent')?e.pendingEvent:e.status==='thinking'?'reply':null;
    const greeted=Object.hasOwn(e,'greeted')?e.greeted:true;
    if(typeof greeted!=='boolean'||(e.status==='thinking'?!pendingEvents.has(pendingEvent):pendingEvent!==null))fail();
    const base=CUSTOMERS.find(x=>x.id===c.id);
    if(!base||!['buyer','seller'].includes(c.role)||(base.role&&base.role!==c.role)||![c.minimum,c.budget,c.asking].every(validPrice)||c.minimum>c.asking)fail();
    if(!unit(e.interest)||!unit(e.skepticism)||!int(e.patience,0,base.patience)||!int(e.turn,0,100)||!validPrice(e.offer)||!(e.agreement===null||validPrice(e.agreement))||!(e.counter===null||validPrice(e.counter)))fail();
    if(!expressions.has(e.expression)||!['authored','live'].includes(e.source)||typeof e.honestyUsed!=='boolean'||typeof e.finalOffer!=='boolean')fail();
    const leaving=e.status==='leaving',settled=state.closedDeals.has(e.id);
    if(state.customerIndex!==(leaving?e.number:e.number-1)||(!leaving&&settled)||(leaving&&e.agreement!==null))fail();
    const hasItem=owned.has(item.id);
    if(hasItem!==(c.role==='buyer'?!settled:settled))fail();
    if(settled){const deal=state.log.find(x=>x.dealId===e.id);if(deal.day!==s.day||deal.itemId!==item.id||deal.kind!==(c.role==='seller'?'buy':'sell'))fail();}
    if(e.agreement!==null&&c.role==='seller'&&e.agreement>state.cash)fail();
    if(!array(e.history,T.MAX_HISTORY)||e.history.some(x=>!record(x)||!['user','assistant'].includes(x.role)||!text(x.content)))fail();
    const used=detailSet(e.used,item),inspected=detailSet(e.inspected,item);
    const pitches=unique(e.pitches,100,x=>text(x,T.MAX_PITCH_LENGTH));
    const questions=unique(e.questions,Object.keys(ITEMS).length*questionTopics.size,value=>{
      if(!text(value,120))return false;
      const split=value.lastIndexOf(':');return !!itemFor(value.slice(0,split))&&questionTopics.has(value.slice(split+1));
    });
    if(!record(e.itemProgress)||Object.keys(e.itemProgress).length>Object.keys(ITEMS).length)fail();
    const itemProgress={};
    for(const [itemId,progress] of Object.entries(e.itemProgress)){
      const previous=itemFor(itemId);
      if(!previous||!record(progress)||!unit(progress.interest)||(c.role==='buyer'&&!owned.has(itemId)&&!(settled&&itemId===item.id)))fail();
      itemProgress[itemId]={interest:progress.interest,used:[...detailSet(progress.used,previous)],inspected:[...detailSet(progress.inspected,previous)]};
    }
    encounter={id:e.id,number:e.number,customer:{...withPersonality(base,personalitySeed),role:c.role,minimum:c.minimum,budget:c.budget,asking:c.asking},
      item:state.inventory.find(x=>x.id===item.id)??item,status:e.status,pendingEvent,greeted,interest:e.interest,skepticism:e.skepticism,patience:e.patience,
      used,inspected,turn:e.turn,offer:e.offer,agreement:e.agreement,counter:e.counter,expression:e.expression,source:e.source,
      history:e.history.map(x=>({role:x.role,content:x.content})),pitches,honestyUsed:e.honestyUsed,questions,itemProgress,finalOffer:e.finalOffer};
  }else{
    if(saved.encounter!==null||state.customerIndex!==T.CUSTOMERS_PER_DAY)fail();
    const rentPaid=state.paidDays.has(state.day);
    if(saved.phase!==(rentPaid?'results':'gameover')||(!rentPaid&&state.cash>=T.RENT))fail();
    result={rentPaid,short:rentPaid?0:T.RENT-state.cash,bought:dayLog.filter(x=>x.kind==='buy').length,sold:dayLog.filter(x=>x.kind==='sell').length,
      profit:dayLog.reduce((n,x)=>n+(x.profit||0),0),stock:inventoryValue(state),score:score(state)};
  }
  if(!array(saved.lines,80)||saved.lines.some(x=>!record(x)||!['system','player','customer'].includes(x.speaker)||!text(x.text)))fail();
  return {phase:saved.phase,state,encounter,result,lines:saved.lines.map(x=>({speaker:x.speaker,text:x.text}))};
}

// Null means that there is no resumable session, or it exceeds the safe schema.
export function snapshotGame(game){
  try{return capture(decode(capture(game)));}catch{return null;}
}
export function restoreGame(game,snapshot){
  let restored;
  try{restored=decode(snapshot);}catch{return false;}
  game.invalidate();
  Object.assign(game,restored);
  if(game.encounter?.status==='thinking'){
    // A reply spent its turn before the request; greetings/item comments never do.
    // None of these interrupted requests is sent again on reload.
    const wasReply=game.encounter.pendingEvent==='reply';
    if(game.encounter.pendingEvent==='greeting')game.encounter.greeted=true;
    game.encounter.status='active';game.encounter.agreement=null;game.encounter.pendingEvent=null;
    if(wasReply&&game.encounter.patience===0)game.encounter.finalOffer=true;
    game.line('system',wasReply?'The conversation was interrupted. Your turn is saved; you can continue negotiating.':'The conversation was interrupted. You can continue negotiating.');
  }
  // advance() already moved the cursor and settled money before saving this status.
  // Only create the next encounter: never call confirm(), leave(), or advance() again.
  if(game.encounter?.status==='leaving')game.next();else game.emit();
  return true;
}
function storageOrDefault(storage){return storage===undefined?globalThis.localStorage:storage;}
export function saveGame(game,storage){
  try{const saved=snapshotGame(game);if(!saved)return false;storageOrDefault(storage).setItem(SAVE_KEY,JSON.stringify(saved));return true;}catch{return false;}
}
export function loadGame(storage){
  try{const raw=storageOrDefault(storage).getItem(SAVE_KEY);return raw===null?null:capture(decode(raw));}catch{return null;}
}
export function clearSavedGame(storage){
  try{storageOrDefault(storage).removeItem(SAVE_KEY);return true;}catch{return false;}
}
