// Voice visits with deterministic bargaining; the ledger alone transfers cash and items.
import {CUSTOMERS} from './customers.js';
import {ITEMS} from './items.js';
import {withPersonality} from './personalities.js';
import {createState,buy,sell,canAfford} from './state.js';
import {createTalkClient,readPitch,readEvaluation} from './talk.js';
import {createBargain,parseSpokenOffer,validateInterpretedOffer,applyBargainTurn} from './bargaining.js';
import {createShop,shopProgress,unlockedItems,undoLastTransaction} from './progress.js';
import {MAX_HISTORY,MAX_PITCH_LENGTH} from './tuning.js';

const cancelled=Symbol('cancelled');
const expressions=new Set(['neutral','curious','pleased','doubt','interested']);
const clean=text=>text.trim().replace(/\s+/g,' ');
const validReply=reply=>reply&&typeof reply.line==='string'&&reply.line.trim()&&reply.line.length<=500&&expressions.has(reply.expression);
const nextCommand=text=>/^(?:(?:okay|ok|please)[, ]+)*(?:next (?:customer|visitor|person)|skip (?:this )?(?:customer|visitor))(?: please)?[.!?]*$/i.test(text);
function farewell(text){
  if(/\b(?:otherwise|or else)\b/i.test(text)&&parseSpokenOffer(text).kind==='offer')return false;
  if(/\b(?:don['’]?t|do not|not ready to|not saying)\b.*\b(?:goodbye|bye|see you|leave)\b/i.test(text))return false;
  return /\b(?:goodbye|bye(?:[ -]bye)?|see you(?: later| soon)?|have a (?:good|nice|great) day|that['’]?s all(?: for (?:today|now))?|no[,]? thanks)\b/i.test(text)
    ||/^(?:please )?(?:leave(?: the shop)?|you can (?:go|leave)|go now)(?: please)?[.!?]*$/i.test(text);
}
const openings={
  guarded:['I found this {item}. Before I get carried away, what can you actually tell me about it?','I brought {item}. Could you take a careful look? I would rather know the facts.'],
  enthusiastic:['Look at this {item}! I found it on the shelf. What is its story?','I brought {item}, and I have been looking forward to showing someone. Will you take a look?'],
  nostalgic:['This {item} caught my eye. Some things just make you slow down. What can you tell me about it?','I brought {item}. I have been taking my time deciding what to do with it. Could you have a look?'],
  analytical:['I selected {item}. What does it do, and what condition is it in?','I brought {item} for you to examine. I would like an honest assessment.'],
  theatrical:['This {item} was practically calling from the shelf. What sort of story have I stumbled into?','Allow me to introduce {item}. The counter is yours; tell me what you make of it.'],
  easygoing:['Hey, this {item} caught my eye. Mind telling me a little about it?','Hey, I brought {item}. No rush. Would you take a look?'],
  brisk:['I picked out {item}. Give me the useful details.','I brought {item}. Can you take a look and tell me what you think?'],
  contrarian:['I picked up {item}. There must be a catch. What am I overlooking?','Here is {item}. I suspect you will notice something I have missed. What do you think?'],
};
const replyLeads={guarded:'All right.',enthusiastic:'Oh, now that is interesting!',nostalgic:'I see what you mean.',analytical:'Let us be precise.',theatrical:'There is the interesting part.',easygoing:'Fair enough.',brisk:'Understood.',contrarian:'Well, that changes the question.'};
function authored({event,text,customer,item,turn}){
  let line;
  if(event==='greeting')line=(openings[customer.personalityId]||openings.easygoing)[customer.role==='buyer'?0:1].replace('{item}',item.name);
  else if(farewell(text))line=customer.farewell||'Thanks for your time. See you around.';
  else if(/\b(?:condition|damage|broken|crack|scratch|work|does|do|from|history|story|made)\b/i.test(text)){
    const condition=/\b(?:condition|damage|broken|crack|scratch)\b/i.test(text);
    const tag=/\b(?:work|does|do)\b/i.test(text)?'function':'history';
    const detail=item.details.find(d=>d.tags.includes(tag))||item.details[turn%item.details.length];
    line=customer.role==='seller'?`${replyLeads[customer.personalityId]||'All right.'} ${condition?item.condition:detail.text}`
      :`${replyLeads[customer.personalityId]||'All right.'} ${condition?'I would like to understand the wear before deciding.':tag==='function'?'What would you show me to explain how it works?':'What can you show me about its history?'} What have you noticed?`;
  }else line=`${replyLeads[customer.personalityId]||'All right.'} ${customer.role==='buyer'?'What do you think is the most interesting thing about this piece?':'Have a look at the object. What stands out to you?'}`;
  return {line:line.slice(0,500),expression:event==='greeting'?'curious':'neutral',source:'authored'};
}
async function abortable(operation,signal){
  if(signal.aborted)return cancelled;
  let abort;
  const cancellation=new Promise(resolve=>{abort=()=>resolve(cancelled);signal.addEventListener('abort',abort,{once:true});});
  try{return await Promise.race([Promise.resolve().then(()=>signal.aborted?cancelled:operation()),cancellation]);}
  finally{signal.removeEventListener('abort',abort);}
}

export class Prototype {
  constructor({scene,talk=createTalkClient(),interpret=null,onChange=()=>{},presentReply=null,seed,firstRole='buyer',featuredFirstCustomer=null,excludedCustomerIds=[],store=null}={}){
    if(!scene||typeof scene.startVisit!=='function'||typeof scene.endVisit!=='function'||typeof scene.cancelVisit!=='function')throw new TypeError('Prototype needs a visit scene.');
    this.scene=scene;this.talk=talk;this.interpret=interpret;this.onChange=onChange;
    this.presentReply=typeof presentReply==='function'?presentReply:null;
    this.firstRole=firstRole==='seller'?'seller':'buyer';
    this.featuredFirstCustomer=typeof featuredFirstCustomer==='string'?featuredFirstCustomer:null;
    this.excludedCustomerIds=new Set(Array.isArray(excludedCustomerIds)?excludedCustomerIds.filter(id=>typeof id==='string'):[]);
    this.store=store;this.state=null;this.bargain=null;this.progress=null;
    this.fixedSeed=Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff?seed:null;
    this.seed=0;this.phase='idle';this.customer=null;this.item=null;this.role=null;this.lines=[];this.history=[];
    this.turn=0;this.source='authored';this.expression='neutral';this.visitNumber=0;
    this.seenItemIds=new Set();this.recentSale=null;
    this.epoch=0;this.abort=null;this.running=false;
  }
  emit(){this.onChange(this);}
  get undoDeal(){
    const tx=this.state?.log.at(-1);
    return tx?{itemName:ITEMS[tx.itemId]?.name||tx.itemId,price:tx.price,kind:tx.kind}:null;
  }
  line(speaker,text){this.lines.push({speaker,text});if(this.lines.length>80)this.lines.shift();}
  invalidate(){this.epoch++;this.abort?.abort();this.abort=null;}
  current(token){return this.running&&this.epoch===token;}
  start(){
    this.invalidate();this.scene.cancelVisit();this.running=true;
    this.state=this.store?.load()||createShop(this.fixedSeed??createState().personalitySeed);
    this.seed=this.state.personalitySeed;this.progress=shopProgress(this.state);this.store?.save(this.state);
    this.visitNumber=0;this.customer=null;this.item=null;this.role=null;this.lines=[];this.history=[];
    this.seenItemIds.clear();this.recentSale=null;
    return this.arrive();
  }
  next(){return this.running&&this.phase!=='idle'?this.leave():this.start();}
  async arrive(){
    if(!this.running)return false;
    this.invalidate();const token=this.epoch,controller=new AbortController();this.abort=controller;
    const index=this.visitNumber++;
    const unowned=unlockedItems(this.state).filter(item=>!this.state.inventory.some(owned=>owned.id===item.id));
    const lastItemId=this.item?.id,lastTrade=this.state.log.at(-1);
    if(lastTrade?.kind==='sell'&&this.recentSale?.dealId!==lastTrade.dealId)this.recentSale={dealId:lastTrade.dealId,itemId:lastTrade.itemId,visit:index};
    const justSoldId=this.recentSale&&index-this.recentSale.visit<2?this.recentSale.itemId:null;
    const differentUnowned=unowned.filter(item=>item.id!==lastItemId&&item.id!==justSoldId);
    const featured=index===0?CUSTOMERS.find(customer=>customer.id===this.featuredFirstCustomer&&customer.role==='buyer'&&!this.excludedCustomerIds.has(customer.id)):null;
    let role=featured&&this.state.inventory.length?'buyer':(index+(this.firstRole==='seller'?1:0))%2===0?'buyer':'seller';
    if(!this.state.inventory.length)role='seller';else if(!unowned.length)role='buyer';
    // When the only seller object is the piece that just left, serve owned stock
    // instead. With empty stock, permit reuse so the finite catalog cannot deadlock.
    if(role==='seller'&&this.state.inventory.length&&unowned.length&&!differentUnowned.length)role='buyer';
    let items=role==='buyer'?this.state.inventory.map(owned=>ITEMS[owned.id]):differentUnowned.length?differentUnowned:unowned;
    const different=items.filter(item=>item.id!==lastItemId);
    if(different.length)items=different;
    const unseen=items.filter(item=>!this.seenItemIds.has(item.id));
    if(unseen.length)items=unseen;
    // A character with one story-critical object must never discuss unrelated stock.
    const pool=CUSTOMERS.filter(c=>!this.excludedCustomerIds.has(c.id)&&(!c.role||c.role===role)&&(!c.exclusiveItemIds||items.some(item=>c.exclusiveItemIds.includes(item.id))));
    if(!pool.length){this.phase='idle';this.line('system','No visitors are available for the current stock.');this.emit();return false;}
    const slot=(Math.floor(index/2)+(this.seed>>>8))%pool.length;
    const base=featured&&pool.includes(featured)?featured:pool[slot].id===this.customer?.id?pool[(slot+1)%pool.length]:pool[slot];
    const suitable=base.exclusiveItemIds?items.filter(item=>base.exclusiveItemIds.includes(item.id)):items;
    const preferred=suitable.filter(item=>base.preferredItemIds?.includes(item.id));
    const selection=preferred.length?preferred:suitable;
    const item=selection[(this.seed%selection.length+index)%selection.length];
    this.seenItemIds.add(item.id);
    this.customer={...withPersonality(base,this.seed),role};this.item=item;this.role=role;
    this.bargain=createBargain(this.customer,item);
    this.lines=[];this.history=[];this.turn=0;this.source='authored';this.expression='neutral';this.phase='arriving';this.emit();
    const customer=this.customer;let arrived;
    try{arrived=await abortable(()=>this.scene.startVisit({customer,item,role}),controller.signal);}
    catch{
      if(!this.current(token))return false;
      this.line('system','The customer could not reach the counter. Say “next customer” to try another visit.');
      this.phase='listening';this.emit();return false;
    }
    if(!this.current(token)||arrived===cancelled||arrived?.cancelled)return false;
    return this.respond('greeting','The customer has arrived at the counter.',token,controller);
  }
  publicBargain(){
    const b=this.bargain;
    return {difficulty:b.difficulty,receptiveness:b.receptiveness,playerOffer:b.playerOffer,customerOffer:b.customerOffer,agreedPrice:b.agreedPrice,status:b.status,lastAction:b.lastAction,feedback:(b.feedback||'').slice(0,220)};
  }
  settle(confirmed=false){
    const b=this.bargain;if(!confirmed||b.status!=='agreed')return false;
    const id=`voice:${this.seed}:${this.state.log.length}:${this.visitNumber}`;
    const result=(this.role==='seller'?buy:sell)(this.state,this.item.id,b.agreedPrice,id);
    if(result.ok){b.status='complete';b.lastAction='completed';b.feedback=this.role==='seller'?`Bought for $${b.agreedPrice}. It is now in your stock.`:`Sold for $${b.agreedPrice}. Profit: $${this.state.log.at(-1).profit}.`;this.progress=shopProgress(this.state);this.store?.save(this.state);}
    else{b.status='negotiating';b.agreedPrice=null;b.lastAction='funds';b.feedback=result.reason==='funds'?`You have $${this.state.cash} in the till. Offer an amount you can afford.`:'That item cannot be traded again.';}
    return result.ok;
  }
  priceLine(event){
    const b=this.bargain;
    if(b.status==='complete')return this.role==='seller'?`Deal. I'll take $${b.agreedPrice}. The item is yours.`:`Deal. I'll pay $${b.agreedPrice} for it.`;
    if(b.status==='agreed')return `I can agree to $${b.agreedPrice}. Do we have a deal?`;
    if(b.lastAction==='funds')return "Let's keep the offer within what you can actually pay.";
    if(['invalid','clarify'].includes(b.lastAction))return 'What price did you have in mind? I want to be sure I understood you.';
    if(event==='greeting'&&this.role==='seller')return `I'm asking $${b.customerOffer} for it.`;
    if(['offer','counter','accepted'].includes(b.lastAction)&&b.customerOffer!==null)return this.role==='seller'?`My asking price is $${b.customerOffer}.`:`I can offer you $${b.customerOffer}.`;
    return '';
  }
  async respond(event,text,token,controller,{scorePitch=false,reading=null}={}){
    if(!this.current(token))return false;
    this.phase='thinking';this.emit();
    reading=reading||readPitch(text,this.customer,this.item,this.bargain.usedDetailIds);
    const context={prototype:true,event,text,customer:this.customer,item:this.item,turn:this.turn,
      history:this.history.map(x=>({...x})),reading,state:{role:this.role,turn:this.turn,negotiation:this.publicBargain()}};
    let reply;
    try{reply=await abortable(()=>this.talk(context,{signal:controller.signal}),controller.signal);}catch{}
    if(!this.current(token)||reply===cancelled)return false;
    if(!validReply(reply)||reply.source!=='live')reply=authored(context);
    if(event==='greeting'){
      const grounded=reply.line.split(/(?<=[.!?])\s+/).filter(sentence=>!/^(?:please[, ]+)?(?:set|put|place|bring|hand)\s+(?:it|this|that|the (?:item|object|piece))\s+(?:down|on|over|here|to)\b/i.test(sentence.trim())).join(' ');
      reply={...reply,line:grounded||authored(context).line};
    }
    if(scorePitch&&this.bargain.status==='negotiating'){
      const evaluation=readEvaluation(reply.evaluation,this.item);
      if(evaluation){
        const semantic=this.item.details.filter(detail=>evaluation.relevantDetailIds.includes(detail.id));
        reading.relevant=[...new Map([...reading.relevant,...semantic.filter(detail=>detail.tags.some(tag=>this.customer.interests.includes(tag)))].map(detail=>[detail.id,detail])).values()];
        reading.honest=reading.honest||(evaluation.acknowledgesCondition&&!reading.deniesCondition);
        reading.bluff=reading.bluff||evaluation.overclaim;reading.question=reading.question||evaluation.question;
      }
      const previousQuote=this.bargain.customerOffer;
      applyBargainTurn(this.bargain,{text,reading,discussionOnly:true});
      if(this.bargain.customerOffer!==previousQuote)this.bargain.lastAction='counter';
    }
    const priceLine=event==='reply'&&farewell(text)?'':this.priceLine(event);
    if(priceLine){
      // Money and completion language is owned by the deterministic bargain, never the model.
      const flavor=reply.line.split(/(?<=[.!?])\s+/).filter(sentence=>!/[$€£]|\b(?:dollars?|bucks?|offer|ask(?:ing)? price|deal|accept|sold|buy it|take it|yours)\b/i.test(sentence)).join(' ').slice(0,Math.max(0,499-priceLine.length));
      reply={...reply,line:[flavor,priceLine].filter(Boolean).join(' ')};
    }
    this.source=reply.source;this.expression=reply.expression;this.line('customer',reply.line.trim());
    this.history.push({role:'user',content:text},{role:'assistant',content:reply.line});this.history=this.history.slice(-MAX_HISTORY);
    if(this.presentReply){
      // Keep the customer at the counter until their speech/typewriter finishes.
      // Normal microphone turns are serialized; explicit exit commands can interrupt.
      const presentReply=this.presentReply;this.emit();let presented;
      try{presented=await abortable(()=>presentReply({line:reply.line.trim(),customer:context.customer,signal:controller.signal}),controller.signal);}catch{}
      if(!this.current(token)||presented===cancelled)return false;
    }
    this.phase='listening';this.emit();return true;
  }
  async say(input,{explicitIntent=null}={}){
    if(typeof input!=='string'||!input.trim())return false;
    const text=clean(input);
    if(text.length>MAX_PITCH_LENGTH){this.line('system','That message is longer than one conversation turn can hold. Please send it in two parts; nothing has been submitted.');this.emit();return false;}
    if(nextCommand(text)){if(!this.running)return this.start();return this.leave();}
    if(!this.running||this.phase!=='listening')return false;
    const token=this.epoch,controller=this.abort;
    this.turn++;this.line('player',text);
    // Reserve this turn before awaiting the classifier: simultaneous transcripts cannot spend twice.
    this.phase='thinking';this.emit();
    let parsed=explicitIntent||parseSpokenOffer(text);
    const reading=readPitch(text,this.customer,this.item,this.bargain.usedDetailIds);
    if(!explicitIntent&&this.interpret&&this.bargain.status!=='complete'&&!farewell(text)){
      let intent;
      const context={prototype:true,event:'reply',text,customer:this.customer,item:this.item,turn:this.turn,
        history:this.history.map(x=>({...x})),state:{role:this.role,turn:this.turn,negotiation:this.publicBargain()}};
      try{intent=await abortable(()=>this.interpret(context,{signal:controller.signal}),controller.signal);}catch{}
      if(!this.current(token)||intent===cancelled)return false;
      const action=['offer','accept'].includes(intent?.kind);
      parsed=intent?.source==='live'&&(!action||(intent.confidence>=(intent.kind==='accept'?.9:.8)&&validateInterpretedOffer(text,intent,this.publicBargain())))?intent:
        {kind:'ambiguous',message:'I could not make out your proposal. Could you clarify the price you have in mind?'};
    }
    let scorePitch=false;
    if(this.bargain.status!=='complete'&&!farewell(text)){
      if(parsed.kind==='offer'){
        if(this.bargain.status==='agreed'&&parsed.amount!==this.bargain.agreedPrice){this.bargain.status='negotiating';this.bargain.agreedPrice=null;}
        this.bargain.playerOffer=parsed.amount;
        if(this.role==='seller'&&!canAfford(this.state,parsed.amount)){this.bargain.lastAction='funds';this.bargain.feedback=`You have $${this.state.cash} in the till. Try an offer you can afford.`;}
        else applyBargainTurn(this.bargain,{text,reading,amount:parsed.amount});
      }else if(parsed.kind==='accept'){
        applyBargainTurn(this.bargain,{text,reading,accept:true});
        this.settle(true);
      }else if(parsed.kind==='decline'){
        this.bargain.status='negotiating';this.bargain.agreedPrice=null;this.bargain.lastAction='walkaway';this.bargain.feedback='No deal. No money or items have changed hands.';
      }else if(['invalid','ambiguous'].includes(parsed.kind)){this.bargain.lastAction=parsed.kind==='invalid'?'invalid':'clarify';this.bargain.feedback=parsed.message||'I am not sure whether that was your price or a comment on mine. What did you have in mind?';}
      else{this.bargain.lastAction='pitch';scorePitch=true;}
      if(this.bargain.status==='agreed')this.bargain.feedback=`They agree to $${this.bargain.agreedPrice}. Say “deal” or confirm to complete. You can still change your offer.`;
    }
    const replied=await this.respond('reply',text,token,controller,{scorePitch,reading});
    if(replied&&this.current(token)&&(farewell(text)||parsed.kind==='decline'))return this.leave();
    return replied;
  }
  offer(amount){
    if(!Number.isSafeInteger(amount)||amount<1||amount>500)return Promise.resolve(false);
    return this.say(`My offer is $${amount}.`,{explicitIntent:{kind:'offer',amount}});
  }
  confirm(){
    if(this.bargain?.status!=='agreed')return Promise.resolve(false);
    return this.say('Deal.',{explicitIntent:{kind:'accept',amount:null}});
  }
  async undoLastDeal(){
    if(!['idle','listening'].includes(this.phase))return false;
    const restored=undoLastTransaction(this.state);if(!restored)return false;
    this.invalidate();this.scene.cancelVisit();this.state=restored;this.progress=shopProgress(restored);
    this.store?.save(restored);
    if(this.running)return this.arrive();
    this.emit();return true;
  }
  async leave(){
    if(!this.running||this.phase==='idle'||this.phase==='leaving')return false;
    this.invalidate();const token=this.epoch,controller=new AbortController();this.abort=controller;
    this.phase='leaving';this.emit();
    let departed;
    const takeItem=this.role==='buyer'?this.bargain.status==='complete':this.bargain.status!=='complete';
    try{departed=await abortable(()=>this.scene.endVisit({takeItem}),controller.signal);}catch{}
    if(!this.current(token)||departed===cancelled||departed?.cancelled)return false;
    return this.arrive();
  }
  stop(){
    this.running=false;this.invalidate();this.scene.cancelVisit();this.phase='idle';
    this.customer=null;this.item=null;this.role=null;this.lines=[];this.history=[];this.turn=0;this.emit();
  }
}
