import * as T from './tuning.js';
import {createState,buy,sell,payRent,inventoryValue,score,validPrice} from './state.js';
import {ITEMS,getItem} from './items.js';
import {CUSTOMERS} from './customers.js';
import {withPersonality} from './personalities.js';
import {readPitch,createTalkClient,fallbackReply,readEvaluation} from './talk.js';
const clamp=n=>Math.max(0,Math.min(1,n));
const money=n=>`$${n}`;
const validReply=reply=>reply&&typeof reply.line==='string'&&Boolean(reply.line.trim())&&reply.line.length<=500&&['neutral','curious','pleased','doubt','interested'].includes(reply.expression);
export class Game {
  constructor({onChange=()=>{},talk=createTalkClient(),schedule=(fn,ms)=>globalThis.setTimeout(fn,ms),cancel=id=>globalThis.clearTimeout(id)}={}) {
    Object.assign(this,{onChange,talk,schedule,cancel}); this.epoch=0; this.timer=null; this.abort=null; this.state=createState(); this.phase='title'; this.encounter=null; this.lines=[]; this.result=null;
  }
  emit(){this.onChange(this);}
  line(speaker,text){this.lines.push({speaker,text});if(this.lines.length>80)this.lines.shift();}
  invalidate(){this.epoch++;if(this.timer!==null)this.cancel(this.timer);this.timer=null;this.abort?.abort();this.abort=null;}
  start(){this.invalidate();this.state=createState();this.lines=[];this.result=null;this.phase='play';this.next();}
  continueDay(){if(this.phase!=='results')return;this.invalidate();this.state.day++;this.state.customerIndex=0;this.result=null;this.phase='play';this.next();}
  next(){
    if(this.phase!=='play')return;
    this.invalidate();
    if(this.state.customerIndex>=T.CUSTOMERS_PER_DAY)return this.close();
    const s=this.state,index=s.customerIndex;
    const role=s.inventory.length && (index%2===1||s.cash<30||s.inventory.length>=3)?'buyer':'seller';
    const pool=CUSTOMERS.filter(c=>!c.role||c.role===role);
    const pair=Math.floor(index/2);
    const customerSlot=pair+(s.day-1)*2+(role==='buyer'&&pair>0?2:0);
    const base=pool[customerSlot%pool.length]||CUSTOMERS[0];
    const available=Object.values(ITEMS).filter(x=>!s.inventory.some(o=>o.id===x.id));
    const item=role==='buyer'?s.inventory[0]:(available[(Math.floor(index/2)+(s.day-1))%available.length]||Object.values(ITEMS)[0]);
    const ask=Math.round(item.cost*1.7), floor=Math.max(5,Math.round(item.cost*.72));
    const customer={...withPersonality(base,s.personalitySeed),role,minimum:floor,budget:role==='seller'?ask:Math.round(item.cost*(2.1+((index+s.day)%3)*.3)),asking:ask};
    this.encounter={id:`${this.epoch}:${s.day}:${index}`,number:index+1,customer,item,status:'active',interest:T.INTEREST_START,skepticism:customer.skepticism,patience:customer.patience,used:new Set(),inspected:new Set(),turn:0,offer:role==='seller'?ask:Math.round(item.cost*2),agreement:null,counter:null,expression:'neutral',source:'authored',history:[],pitches:new Set(),questions:new Set(),itemProgress:{},honestyUsed:false,finalOffer:false,pendingEvent:null,greeted:false};
    this.lines=[];
    const remembered=s.memory[customer.id];
    if(remembered){
      const previous=getItem(remembered.lastItemId);
      this.line('system',`${customer.name} remembers ${remembered.deals} earlier ${remembered.deals===1?'deal':'deals'} with you.${previous?` Last time, they ${remembered.lastRole==='seller'?'sold you':'bought'} ${previous.name} for ${money(remembered.lastPrice)}.`:''}`);
    }
    const claim=(item.claim||'It has been in the family for years.').replace(/^Seller (?:claims|says) /i, 'I was told ').replace(/, unverified\.?$/i, '. I cannot prove that part.');
    this.line('customer',role==='seller'?`“I've brought ${item.name.toLowerCase()}. ${claim} I was hoping for ${money(ask)}.”`:`“${customer.greeting}”`);
    this.line('system',role==='seller'?'You are buying. Inspect the object, ask questions, then negotiate what you will pay.':'You are selling. Choose stock and explain why it fits this customer.');
    this.emit();
    if(this.talk.live===true)void this.greet();
  }
  selectItem(id){
    const e=this.encounter;
    const interruptedGreeting=e?.status==='thinking'&&['greeting','item-selected'].includes(e.pendingEvent);
    if(this.phase!=='play'||(!interruptedGreeting&&e?.status!=='active')||e.customer.role!=='buyer'||e.finalOffer)return;
    const item=this.state.inventory.find(x=>x.id===id);if(!item||id===e.item.id)return;
    if(interruptedGreeting){this.invalidate();e.status='active';e.pendingEvent=null;}
    // Switching the stock does not reset the customer's patience or inflate their wallet.
    e.itemProgress[e.item.id]={interest:e.interest,used:[...e.used],inspected:[...e.inspected]};
    const progress=e.itemProgress[item.id];
    e.item=item;e.used=new Set(progress?.used);e.inspected=new Set(progress?.inspected);e.interest=progress?.interest??T.INTEREST_START;e.agreement=null;e.counter=null;e.offer=Math.round(item.cost*2);
    this.line('system',`You put ${item.name} on the counter.`);this.emit();
    if(this.talk.live===true)void this.greet('item-selected');
  }
  inspect(id){const e=this.encounter;if(!e||this.phase!=='play')return;const d=e.item.details.find(d=>d.id===id);if(d)e.inspected.add(d.id);this.emit();}
  async greet(event='greeting'){
    const e=this.encounter;
    if(this.phase!=='play'||e?.status!=='active'||this.talk.live!==true||!['greeting','item-selected'].includes(event))return;
    if(event==='greeting'&&(e.greeted||e.turn!==0||e.agreement!==null))return;
    if(event==='item-selected'&&(e.customer.role!=='buyer'||e.finalOffer))return;
    const token=this.epoch,id=e.id,itemId=e.item.id,intro=this.lines.find(line=>line.speaker==='customer');
    if(event==='greeting')e.greeted=true;
    e.status='thinking';e.pendingEvent=event;this.abort=new AbortController();
    const context={event,text:event==='greeting'?'The customer has just arrived at the counter.':'The shopkeeper has put a different object on the counter.',customer:e.customer,item:e.item,turn:e.turn,history:e.history,state:{role:e.customer.role,patience:e.patience,interest:e.interest,skepticism:e.skepticism,turn:e.turn,usedDetailIds:[...e.used],inspectedDetailIds:[...e.inspected],offer:e.offer,asking:e.customer.asking,counter:e.counter,agreement:e.agreement}};
    this.emit();let reply;
    try{reply=await this.talk(context,{signal:this.abort.signal});}catch{}
    if(this.epoch!==token||this.encounter?.id!==id||this.encounter?.item.id!==itemId||this.phase!=='play')return;
    this.abort=null;e.status='active';e.pendingEvent=null;
    if(validReply(reply)&&reply.source==='live'){
      e.expression=reply.expression;e.source='live';
      if(event==='greeting'&&intro&&this.lines.includes(intro))intro.text=reply.line;
      else this.line('customer',reply.line);
      e.history.push({role:'user',content:context.text},{role:'assistant',content:reply.line});e.history=e.history.slice(-T.MAX_HISTORY);
    }
    this.emit();
  }
  async say(text){
    const e=this.encounter;
    if(this.phase!=='play'||e?.status!=='active'||typeof text!=='string'||!text.trim())return;
    if(e.finalOffer){this.line('system','They are ready to leave. Make your final offer or decline.');this.emit();return;}
    text=text.trim().slice(0,T.MAX_PITCH_LENGTH);
    const token=this.epoch,id=e.id,lastCounter=e.counter;e.status='thinking';e.pendingEvent='reply';e.agreement=null;e.counter=null;this.line('player',text);
    const reading=readPitch(text,e.customer,e.item,e.used);
    const normalized=text.toLowerCase().replace(/[^a-z0-9]/g,'');
    const repeatedText=e.pitches.has(normalized),topic=`${e.item.id}:${reading.questionTopic}`;
    const suppressRepeats=r=>{
      if(repeatedText||r.repeated){r.repeated=true;r.relevant=[];r.question=false;r.honest=false;}
      if(r.question&&e.questions.has(topic)){r.question=false;if(!r.fresh.length&&!r.honest)r.repeated=true;}
      if(r.honest&&e.honestyUsed)r.honest=false;
    };
    suppressRepeats(reading);
    e.patience--;e.turn++;this.abort=new AbortController();this.emit();
    let reply;
    const context={event:'reply',text,customer:e.customer,item:e.item,reading,turn:e.turn,history:e.history,state:{role:e.customer.role,patience:e.patience,interest:e.interest,skepticism:e.skepticism,turn:e.turn,usedDetailIds:[...e.used],inspectedDetailIds:[...e.inspected],offer:e.offer,asking:e.customer.asking,counter:lastCounter,agreement:e.agreement}};
    try {reply=await this.talk(context,{signal:this.abort.signal});} catch {}
    if(this.epoch!==token||this.encounter?.id!==id||this.phase!=='play')return;
    this.abort=null;e.pendingEvent=null;
    if(!validReply(reply))reply={...fallbackReply(context),source:'authored'};
    const evaluation=readEvaluation(reply.evaluation,e.item);
    if(evaluation){
      const semantic=e.item.details.filter(d=>evaluation.relevantDetailIds.includes(d.id));
      reading.matched=[...new Map([...reading.matched,...semantic].map(d=>[d.id,d])).values()];
      reading.fresh=reading.matched.filter(d=>!e.used.has(d.id));
      reading.relevant=reading.fresh.filter(d=>d.tags.some(t=>e.customer.interests.includes(t)));
      reading.bluff=reading.bluff||evaluation.overclaim;
      reading.honest=reading.honest||(evaluation.acknowledgesCondition&&!reading.deniesCondition);
      reading.question=reading.question||evaluation.question;
      reading.repeated=reading.matched.length>0&&!reading.fresh.length;
      suppressRepeats(reading);
    }
    e.pitches.add(normalized);
    if(reading.question)e.questions.add(topic);
    if(reading.honest&&!reading.bluff)e.honestyUsed=true;
    for(const d of reading.fresh)e.used.add(d.id);
    e.interest=clamp(e.interest+(!reading.bluff&&reading.relevant.length?T.INTEREST_PER_GOOD_PITCH*Math.min(2,reading.relevant.length):!reading.bluff&&reading.honest?0.08:!reading.bluff&&reading.question?0.06:T.INTEREST_PER_BAD_PITCH));
    e.skepticism=clamp(e.skepticism+(reading.bluff?T.SKEPTICISM_PER_BLUFF:reading.honest?-0.12:reading.relevant.length?-0.045:0));
    e.status='active';e.expression=reply.expression;e.source=reply.source==='live'?'live':'authored';e.history.push({role:'user',content:text},{role:'assistant',content:reply.line});e.history=e.history.slice(-T.MAX_HISTORY);
    this.line('customer',reply.line);
    if(e.patience<=0){e.finalOffer=true;this.line('system','They have time for one final offer. Agree on a price or let them go.');}this.emit();
  }
  boundary(){
    const e=this.encounter,c=e.customer;
    if(c.role==='seller')return Math.max(c.minimum,Math.round(c.asking-(c.asking-c.minimum)*e.interest*(1-e.skepticism*.35)));
    const fit=e.item.details.some(d=>d.tags.some(t=>c.interests.includes(t)));
    return Math.min(c.budget,Math.round(e.item.cost*(fit?1.45:1.1)*(0.7+e.interest*.8)*(1-e.skepticism*.18)));
  }
  offer(price){
    const e=this.encounter;if(this.phase!=='play'||e?.status!=='active')return;
    e.agreement=null;
    if(!validPrice(price)){this.line('system',`Use a whole-dollar offer from $${T.MIN_OFFER} to $${T.MAX_OFFER}.`);this.emit();return;}
    e.agreement=null;e.counter=null;e.offer=price;
    if(e.customer.role==='seller'&&price>this.state.cash){this.line('system',`You have ${money(this.state.cash)} in the till. Offer less or let this one go.`);this.emit();return;}
    this.line('player',`${e.customer.role==='seller'?"I'll pay":"I'm asking"} ${money(price)}.`);
    const edge=this.boundary(),acceptable=e.customer.role==='seller'?price>=edge:price<=edge;
    if(acceptable){e.agreement=price;e.expression='pleased';this.line('customer',`“${money(price)} works for me. Shall we shake on it?”`);}
    else {
      if(e.finalOffer)return this.leave(true);
      e.patience--;e.counter=edge;e.expression='doubt';
      if(e.patience<=0)e.finalOffer=true;
      this.line('customer',`“${e.customer.role==='seller'?'I need':'I can do'} ${money(edge)}. ${e.finalOffer?'Take it or leave it.':e.patience<=2?'That is my last word.':'Give me a reason to move.'}”`);
    }
    this.emit();
  }
  confirm(){
    const e=this.encounter;if(this.phase!=='play'||e?.status!=='active'||e.agreement===null)return;
    const price=e.agreement,result=(e.customer.role==='seller'?buy:sell)(this.state,e.item.id,price,e.id);
    if(!result.ok){e.agreement=null;this.line('system',`Deal could not close: ${result.reason}.`);this.emit();return;}
    e.status='leaving';e.agreement=null;e.expression='pleased';
    const memory=this.state.memory[e.customer.id]||{deals:0};memory.deals++;memory.lastItemId=e.item.id;memory.lastPrice=price;memory.lastRole=e.customer.role;this.state.memory[e.customer.id]=memory;
    this.line('system',`${e.customer.role==='seller'?'Bought':'Sold'} ${e.item.name} for ${money(price)}. ${e.customer.role==='seller'?'Now on your shelf.':`Trade profit: ${money(this.state.log.at(-1).profit)}.`}`);
    this.advance();
  }
  leave(walked=false){
    const e=this.encounter;if(this.phase!=='play'||!e||!['active','thinking'].includes(e.status))return;
    this.invalidate();e.status='leaving';e.pendingEvent=null;e.agreement=null;e.expression='doubt';
    this.line('customer',walked?`“${e.customer.farewell||'That is enough for today. Good luck.'}”`:'“All right. Perhaps another time.”');
    this.line('system',`${walked?'Customer left':'Deal declined'}. Your cash and stock are unchanged.`);this.advance();
  }
  advance(){
    this.state.customerIndex++;const token=this.epoch;
    this.timer=this.schedule(()=>{this.timer=null;if(token!==this.epoch)return;this.next();},T.TRANSITION_MS);this.emit();
  }
  close(){
    if(this.phase!=='play')return;this.invalidate();this.encounter=null;
    const dayLog=this.state.log.filter(x=>x.day===this.state.day),rent=payRent(this.state);
    this.result={rentPaid:rent.ok,short:rent.short,bought:dayLog.filter(x=>x.kind==='buy').length,sold:dayLog.filter(x=>x.kind==='sell').length,profit:dayLog.reduce((n,x)=>n+(x.profit||0),0),stock:inventoryValue(this.state),score:score(this.state)};
    this.phase=rent.ok?'results':'gameover';this.emit();
  }
}
