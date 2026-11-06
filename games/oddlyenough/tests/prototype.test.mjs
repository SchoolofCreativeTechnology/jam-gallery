import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Prototype} from '../prototype.js';
import {personalityFor} from '../personalities.js';
import {CUSTOMERS} from '../customers.js';
import {ITEMS} from '../items.js';
import {createProgressStore,createShop,unlockedItems} from '../progress.js';
import {createBargain} from '../bargaining.js';
import {buy,sell} from '../state.js';
import {MAX_PITCH_LENGTH} from '../tuning.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const liveIntent=(kind,text,amount=null)=>({kind,amount,evidence:text,confidence:.99,source:'live'});
const ledger=game=>JSON.stringify({cash:game.state.cash,inventory:game.state.inventory.map(({id,acquisitionPrice})=>({id,acquisitionPrice})),log:game.state.log,closed:[...game.state.closedDeals]});

test('AI-recognized sales hype can tempt a tough customer once without inventing facts or trading',async()=>{
  for(const role of ['buyer','seller']){
    const f=setup({firstRole:role});await f.game.start();
    f.game.customer={...f.game.customer,skepticism:1,personalityId:'guarded'};
    f.game.bargain=createBargain(f.game.customer,f.game.item);
    if(role==='buyer')await f.game.offer(500);
    const before=ledger(f.game),facts=JSON.stringify(f.game.item),quote=f.game.bargain.customerOffer,gauge=f.game.bargain.receptiveness;
    f.game.talk=async()=>({line:'You make it sound awfully tempting. I might just believe you.',expression:'curious',source:'live',evaluation:{relevantDetailIds:[],acknowledgesCondition:false,overclaim:true,question:false}});
    await f.game.say('This could be the envy of every collector in town.');
    assert.ok(f.game.bargain.receptiveness>gauge);assert.equal(f.game.bargain.difficulty,'hard');
    assert.ok(role==='buyer'?f.game.bargain.customerOffer>quote:f.game.bargain.customerOffer<quote);
    assert.equal(f.game.bargain.status,'negotiating');assert.equal(ledger(f.game),before);assert.equal(JSON.stringify(f.game.item),facts);
    const tempted=f.game.bargain.receptiveness;
    await f.game.say('This could be the envy of every collector in town.');
    assert.ok(f.game.bargain.receptiveness<=tempted);assert.equal(ledger(f.game),before);
  }
});
function setup(options={}){
  const events=[],contexts=[],phases=[];
  const scene={startVisit:async visit=>{events.push(['arrive',visit]);return {cancelled:false};},endVisit:async options=>{events.push(['leave',options]);return {cancelled:false};},cancelVisit:()=>events.push(['cancel'])};
  const talk=async context=>{contexts.push(context);events.push(['talk',context.event]);return {line:context.event==='greeting'?'Hello from the counter.':'I heard you.',expression:'curious',source:'live'};};
  const game=new Prototype({scene,talk,seed:123456,onChange:p=>phases.push(p.phase),...options});
  return {game,scene,events,contexts,phases};
}
function stockedShop(ids,{seed=0,unlock=false}={}){
  const state=createShop(seed),first=state.inventory[0].id;
  if(unlock)for(let i=0;i<5;i++){
    assert.equal(sell(state,first,500,`fixture-sale-${i}`).ok,true);
    assert.equal(buy(state,first,1,`fixture-buy-${i}`).ok,true);
  }
  for(const item of [...state.inventory])if(!ids.includes(item.id))assert.equal(sell(state,item.id,item.acquisitionPrice,`fixture-remove-${item.id}`).ok,true);
  for(const id of ids)if(!state.inventory.some(item=>item.id===id)){
    assert.ok(unlockedItems(state).some(item=>item.id===id));
    assert.equal(buy(state,id,1,`fixture-stock-${id}`).ok,true);
  }
  return state;
}

test('arrival completes before API greeting and publishes usable conversation phases',async()=>{
  const arrival=deferred(),f=setup();f.scene.startVisit=visit=>{f.events.push(['arrive',visit]);return arrival.promise;};
  const pending=f.game.start();assert.equal(f.game.phase,'arriving');await Promise.resolve();
  assert.equal(f.contexts.length,0);assert.equal(f.events.at(-1)[0],'arrive');
  arrival.resolve({cancelled:false});assert.equal(await pending,true);
  assert.deepEqual(f.phases,['arriving','thinking','listening']);assert.equal(f.game.phase,'listening');
  assert.equal(f.contexts[0].event,'greeting');assert.equal(f.contexts[0].prototype,true);
  assert.equal(f.contexts[0].state.role,'buyer');assert.equal(f.contexts[0].state.turn,0);assert.equal(f.contexts[0].state.negotiation.status,'negotiating');assert.equal(f.game.lines[0].speaker,'customer');
  assert.ok(f.contexts[0].reading);assert.equal(f.game.source,'live');
});

test('featured first customer introduces Marlowe as an easy buyer without changing his formal personality',async()=>{
  const f=setup({firstRole:'seller',featuredFirstCustomer:'c6'});await f.game.start();
  assert.equal(f.game.customer.id,'c6');assert.equal(f.game.customer.name,'Mr. Marlowe');
  assert.equal(f.game.role,'buyer');assert.equal(f.game.bargain.difficulty,'easy');
  assert.equal(f.game.customer.personalityId,'analytical');assert.equal(f.game.customer.model,'08-fish-man');
  assert.match(f.game.customer.voice,/water phrase/);assert.ok(f.game.state.inventory.some(item=>item.id===f.game.item.id));
  assert.equal(f.contexts[0].customer.id,'c6');assert.equal(f.contexts[0].state.role,'buyer');
  assert.equal(f.game.state.log.length,0);assert.equal(f.game.state.cash,120);
  const visit=f.game.visitNumber;await f.game.next();assert.ok(f.game.visitNumber>visit);assert.notEqual(f.game.customer.id,'c6');
  const ordinary=setup({firstRole:'seller'});await ordinary.game.start();assert.equal(ordinary.game.role,'seller');
});

test('the player character can be excluded from visitors while featured Marlowe still opens the shop',async()=>{
  const f=setup({featuredFirstCustomer:'c6',excludedCustomerIds:['ines']});await f.game.start();
  assert.equal(f.game.customer.id,'c6');
  const sellers=new Set();for(let i=0;i<24;i++){
    assert.notEqual(f.game.customer.id,'ines');if(f.game.role==='seller')sellers.add(f.game.customer.id);
    if(i<23)await f.game.next();
  }
  assert.ok(sellers.size>=2);assert.ok(!f.contexts.some(context=>context.customer.id==='ines'));
});

test('item rotation visits every eligible distinct piece before reusing the finite catalog',async()=>{
  for(const role of ['buyer','seller']){
    const seed=0,state=stockedShop(role==='buyer'?Object.keys(ITEMS):[],{seed,unlock:true});
    const f=setup({seed,firstRole:role,store:{load:()=>state,save:()=>true}});await f.game.start();
    const seen=new Set(),before=ledger(f.game);
    for(let i=0;i<Object.keys(ITEMS).length;i++){
      assert.equal(f.game.role,role);assert.ok(!seen.has(f.game.item.id),`${role} repeated ${f.game.item.id} while unseen stock remained`);
      seen.add(f.game.item.id);assert.equal(ledger(f.game),before);
      if(i<Object.keys(ITEMS).length-1)await f.game.next();
    }
    assert.equal(seen.size,Object.keys(ITEMS).length);const previous=f.game.item.id;
    await f.game.next();assert.notEqual(f.game.item.id,previous);assert.equal(f.game.phase,'listening');assert.equal(ledger(f.game),before);
  }
});

test('a just-sold unique piece is not immediately brought back by the next seller',async()=>{
  const f=setup();await f.game.start();const sold=f.game.item.id;
  await f.game.offer(1);await f.game.confirm();assert.ok(!f.game.state.inventory.some(item=>item.id===sold));
  const before=ledger(f.game);await f.game.next();
  assert.equal(f.game.role,'seller');assert.notEqual(f.game.item.id,sold);assert.equal(ledger(f.game),before);
});

test('when only the just-sold object is unowned, another buyer arrives without trapping an empty shop',async()=>{
  const seed=0,state=stockedShop(['tomorrowquack-duck','amber-radio','minute-eater-clock','hollow-room-camera'],{seed});
  const f=setup({seed,store:{load:()=>state,save:()=>true}});await f.game.start();const sold=f.game.item.id;
  await f.game.offer(1);await f.game.confirm();await f.game.next();
  assert.equal(f.game.role,'buyer');assert.notEqual(f.game.item.id,sold);
  let steps=0;
  while(f.game.state.inventory.length&&steps++<10){
    if(f.game.role==='buyer'){await f.game.offer(1);await f.game.confirm();}
    await f.game.next();
  }
  assert.equal(f.game.state.inventory.length,0);assert.equal(f.game.role,'seller');assert.ok(ITEMS[f.game.item.id]);assert.equal(f.game.phase,'listening');
});

test('buyers and sellers alternate with distinct items and canonical seeded personalities',async()=>{
  const f=setup();await f.game.start();let previousItem=null,previousCustomer=null;
  for(let i=0;i<8;i++){
    assert.equal(f.game.role,i%2===0?'buyer':'seller');assert.notEqual(f.game.item.id,previousItem);assert.notEqual(f.game.customer.id,previousCustomer);
    assert.equal(f.game.item,ITEMS[f.game.item.id]);assert.ok(CUSTOMERS.some(c=>c.id===f.game.customer.id));
    assert.equal(f.game.customer.personalityId,personalityFor(f.game.customer.id,123456).id);
    assert.equal(f.game.turn,0);previousItem=f.game.item.id;previousCustomer=f.game.customer.id;
    if(i<7)await f.game.next();
  }
  assert.equal(f.events.filter(x=>x[0]==='leave').length,7);assert.equal(f.contexts.length,8);
});

test('Visitor is excluded whenever the shop owns only unrelated stock',async()=>{
  const seen=new Set();
  for(let i=0;i<12;i++){
    const seed=i*256,state=stockedShop(['amber-radio','minute-eater-clock'],{seed});
    const f=setup({seed,store:{load:()=>state,save:()=>true}});
    await f.game.start();seen.add(f.game.customer.id);
    assert.equal(f.game.role,'buyer');assert.notEqual(f.game.customer.id,'visitor');
    assert.ok(state.inventory.some(item=>item.id===f.game.item.id));
    assert.notEqual(f.contexts.at(-1).customer.id,'visitor');
  }
  assert.deepEqual([...seen].sort(),['c3','c4','c6','hollis']);
});

test('Visitor becomes eligible with the alien egg and selects only the egg among other owned items',async()=>{
  const seed=1024,state=stockedShop(Object.keys(ITEMS),{seed,unlock:true});
  const f=setup({seed,store:{load:()=>state,save:()=>true}});await f.game.start();
  assert.equal(f.game.customer.id,'visitor');const before=ledger(f.game);let visits=0;
  for(let i=0;i<16;i++){
    assert.equal(f.game.role,'buyer');
    if(f.game.customer.id==='visitor'){
      visits++;assert.equal(f.game.item.id,'alien-egg');
      assert.equal(f.contexts.at(-1).item.id,'alien-egg');
      assert.equal(f.events.filter(([kind])=>kind==='arrive').at(-1)[1].item.id,'alien-egg');
    }
    assert.equal(ledger(f.game),before);
    if(i<15)await f.game.next();
  }
  assert.ok(visits>=2,'Visitor remains eligible on later visits');
  assert.equal(sell(state,'alien-egg',110,'fixture-egg-removed').ok,true);
  for(let i=0;i<12;i++){await f.game.next();assert.notEqual(f.game.customer.id,'visitor');}
});

test('buyers and sellers choose a preferred matching object when their eligible stock contains one',async()=>{
  const roles={buyer:['hollis','c3','c4','c6','visitor'],seller:['ines','c1','c2','c5','farmer']};
  for(const [role,customers] of Object.entries(roles))for(const [slot,id] of customers.entries()){
    const seed=slot*256,state=stockedShop(role==='buyer'?Object.keys(ITEMS):[],{seed,unlock:true});
    const f=setup({seed,firstRole:role,store:{load:()=>state,save:()=>true}});await f.game.start();
    assert.equal(f.game.customer.id,id);assert.equal(f.game.role,role);
    assert.ok(f.game.customer.preferredItemIds.includes(f.game.item.id),`${id} should select their preferred object`);
    assert.equal(state.inventory.some(item=>item.id===f.game.item.id),role==='buyer');
    assert.equal(f.game.phase,'listening');
  }
});

test('unavailable preferences fall back to valid owned or unlocked unowned stock',async()=>{
  for(const {seed,role,id,stock} of [
    {seed:0,role:'buyer',id:'hollis',stock:['amber-radio']},
    {seed:256,role:'buyer',id:'c3',stock:['minute-eater-clock']},
    {seed:512,role:'buyer',id:'c4',stock:['amber-radio']},
    {seed:768,role:'buyer',id:'c6',stock:['amber-radio']},
    {seed:1024,role:'seller',id:'farmer',stock:['tomorrowquack-duck','amber-radio','minute-eater-clock']},
  ]){
    const state=stockedShop(stock,{seed}),f=setup({seed,firstRole:role,store:{load:()=>state,save:()=>true}});
    await f.game.start();assert.equal(f.game.customer.id,id);assert.equal(f.game.role,role);
    assert.ok(!f.game.customer.preferredItemIds.includes(f.game.item.id));
    assert.equal(f.game.item,ITEMS[f.game.item.id]);assert.equal(f.game.phase,'listening');
    assert.equal(state.inventory.some(item=>item.id===f.game.item.id),role==='buyer');
    if(role==='seller')assert.ok(unlockedItems(state).some(item=>item.id===f.game.item.id));
  }
});

test('pitch calls serialize and send bounded dialogue history with public negotiation state',async()=>{
  const response=deferred(),f=setup();await f.game.start();
  f.game.talk=async context=>{f.contexts.push(context);return response.promise;};
  const pending=f.game.say('  Can you tell me about this?  ');assert.equal(f.game.phase,'thinking');
  assert.equal(await f.game.say('A second simultaneous pitch'),false);await Promise.resolve();
  assert.equal(f.game.turn,1);assert.equal(f.contexts.at(-1).text,'Can you tell me about this?');
  assert.equal(f.contexts.at(-1).state.role,'buyer');assert.equal(f.contexts.at(-1).state.turn,1);assert.equal(f.contexts.at(-1).state.negotiation.status,'negotiating');assert.equal(f.contexts.at(-1).state.negotiation._rules,undefined);assert.equal(f.contexts.at(-1).history.length,2);
  response.resolve({line:'Here is my answer.',expression:'interested',source:'live'});assert.equal(await pending,true);
  assert.equal(f.game.phase,'listening');assert.equal(f.game.lines.filter(x=>x.speaker==='player').length,1);assert.equal(f.game.lines.at(-1).text,'Here is my answer.');
});

test('unavailable or malformed API uses personality-specific authored openings and keeps dialogue working',async()=>{
  for(const talk of [async()=>{throw Error('offline');},async()=>null,async()=>({line:5,expression:'neutral'}),async()=>({line:'unpersonalized fallback',expression:'neutral',source:'authored'})]){
    const f=setup({talk});assert.equal(await f.game.start(),true);assert.equal(f.game.phase,'listening');assert.equal(f.game.source,'authored');
    assert.match(f.game.lines[0].text,new RegExp(f.game.item.name));assert.notEqual(f.game.lines[0].text,'unpersonalized fallback');
    const opening=f.game.lines[0].text;await f.game.say('What condition is it in?');assert.equal(f.game.phase,'listening');assert.ok(f.game.lines.at(-1).text);assert.notEqual(f.game.lines.at(-1).text,opening);
  }
});

test('spoken goodbye receives NPC response before walking out and starting the next customer',async()=>{
  const exit=deferred(),f=setup();await f.game.start();f.scene.endVisit=()=>{f.events.push(['leave']);return exit.promise;};
  const pending=f.game.say('Thanks, goodbye!');
  for(let i=0;i<8&&f.game.phase!=='leaving';i++)await Promise.resolve();
  assert.equal(f.game.phase,'leaving');assert.equal(f.game.lines.at(-1).text,'I heard you.');
  await Promise.resolve();
  assert.equal(f.events.at(-1)[0],'leave');assert.equal(f.game.role,'buyer');
  exit.resolve({cancelled:false});assert.equal(await pending,true);assert.equal(f.game.role,'seller');assert.equal(f.game.phase,'listening');
});

test('explicit next-customer command skips directly and duplicate exits do not start two visits',async()=>{
  const exit=deferred(),f=setup();await f.game.start();const before=f.contexts.length;
  f.scene.endVisit=()=>{f.events.push(['leave']);return exit.promise;};
  const pending=f.game.say('Next customer.');assert.equal(f.game.phase,'leaving');assert.equal(await f.game.leave(),false);
  assert.equal(f.contexts.length,before);exit.resolve({cancelled:false});await pending;
  assert.equal(f.game.visitNumber,2);assert.equal(f.game.role,'seller');assert.equal(f.events.filter(x=>x[0]==='leave').length,1);
});

test('ordinary language about an object leaving marks never dismisses the customer',async()=>{
  const f=setup();await f.game.start();await f.game.say('Does it leave a mark on the table?');
  await f.game.say("I don't want to say goodbye yet.");
  assert.equal(f.game.visitNumber,1);assert.equal(f.events.filter(x=>x[0]==='leave').length,0);assert.equal(f.game.phase,'listening');
});

test('restart aborts a pending response and rejects its late mutation',async()=>{
  const response=deferred(),f=setup();await f.game.start();let signal;
  f.game.talk=async(_context,options)=>{signal=options.signal;return response.promise;};
  const pending=f.game.say('Tell me more.');await Promise.resolve();
  f.game.talk=async()=>({line:'New run greeting.',expression:'neutral',source:'live'});
  const restarted=f.game.start();assert.equal(signal.aborted,true);assert.equal(await pending,false);await restarted;
  const before=JSON.stringify(f.game.lines);response.resolve({line:'STALE',expression:'pleased',source:'live'});await Promise.resolve();
  assert.equal(JSON.stringify(f.game.lines),before);assert.equal(f.game.lines.at(-1).text,'New run greeting.');assert.equal(f.game.role,'buyer');
});

test('stop cancels arrival even when a scene ignores cancellation, and never starts late API work',async()=>{
  const arrival=deferred(),f=setup();f.scene.startVisit=()=>arrival.promise;
  const pending=f.game.start();await Promise.resolve();f.game.stop();
  assert.equal(await pending,false);assert.equal(f.game.phase,'idle');assert.equal(f.game.customer,null);
  arrival.resolve({cancelled:false});await Promise.resolve();assert.equal(f.contexts.length,0);assert.equal(f.game.phase,'idle');
});

test('immediate stop prevents deferred scene startup and next restarts a fresh buyer',async()=>{
  const f=setup();const pending=f.game.start();f.game.stop();assert.equal(await pending,false);
  assert.equal(f.events.filter(x=>x[0]==='arrive').length,0);await f.game.next();assert.equal(f.game.role,'buyer');assert.equal(f.game.phase,'listening');
});

test('next customer cancels a hanging API response without waiting for it',async()=>{
  const f=setup();await f.game.start();const hanging=deferred();
  f.game.talk=()=>hanging.promise;const old=f.game.say('A question');await Promise.resolve();
  f.game.talk=async()=>({line:'Next visitor here.',expression:'neutral',source:'live'});
  await f.game.say('Next customer');assert.equal(await old,false);assert.equal(f.game.role,'seller');assert.equal(f.game.phase,'listening');
});

test('failed arrival never calls the API and the voice command can recover',async()=>{
  const f=setup();f.scene.startVisit=async()=>{throw Error('route failed');};
  assert.equal(await f.game.start(),false);assert.equal(f.contexts.length,0);assert.equal(f.game.phase,'listening');assert.equal(f.game.lines.at(-1).speaker,'system');
  f.scene.startVisit=async()=>({cancelled:false});await f.game.say('next customer');assert.equal(f.game.phase,'listening');assert.equal(f.contexts.length,1);
});

test('empty inputs are ignored and overlong speech is rejected explicitly without silently changing its intent',async()=>{
  const f=setup();await f.game.start();for(const input of ['', '   ',null,42])assert.equal(await f.game.say(input),false);
  const before=ledger(f.game),calls=f.contexts.length;
  assert.equal(await f.game.say('a'.repeat(MAX_PITCH_LENGTH+1)),false);
  assert.equal(f.contexts.length,calls);assert.equal(f.game.turn,0);assert.equal(ledger(f.game),before);
  assert.match(f.game.lines.at(-1).text,/nothing has been submitted/);
});

test('the exact conversational offer screenshot submits fifty without requiring a magic phrase or leaving',async()=>{
  const text="yeah so I'm offering 50 for it that's how much I'll buy otherwise just get out of here hit the road";
  const f=setup({firstRole:'seller',interpret:async()=>liveIntent('offer',"I'm offering 50 for it",50)});await f.game.start();
  const before=ledger(f.game),visit=f.game.visitNumber;
  await f.game.say(text);assert.equal(f.game.bargain.playerOffer,50);assert.notEqual(f.game.bargain.lastAction,'clarify');
  assert.equal(ledger(f.game),before);assert.equal(f.game.visitNumber,visit);assert.equal(f.game.phase,'listening');
  assert.notEqual(f.game.bargain.status,'complete');assert.doesNotMatch(f.game.bargain.feedback,/say.*I offer/i);
  f.game.interpret=async context=>liveIntent('offer',context.text,50);
  await f.game.say("I'm offering fifty, otherwise goodbye.");assert.equal(f.game.visitNumber,visit);assert.equal(ledger(f.game),before);
});

test('the exact gold-allergy screenshot is a grounded forty-five-dollar proposal without an automatic trade',async()=>{
  const text='Yeah, so I am actually allergic to gold, so I think $45 would be way more reasonable.';
  const f=setup({firstRole:'seller',interpret:async()=>liveIntent('offer','$45 would be way more reasonable',45)});await f.game.start();
  const before=ledger(f.game);await f.game.say(text);
  assert.equal(f.game.bargain.playerOffer,45);assert.notEqual(f.game.bargain.lastAction,'clarify');
  assert.notEqual(f.game.bargain.status,'complete');assert.equal(ledger(f.game),before);
  f.game.interpret=async()=>({...liveIntent('offer','$45 would be way more reasonable',45),source:'fallback'});
  await f.game.say(text);assert.equal(ledger(f.game),before);
});

test('long speech reaches interpretation intact including a natural offer after the old five-hundred-character cutoff',async()=>{
  let interpreted;
  const phrase='fifty sounds fair',text=`${'I am considering the condition. '.repeat(35)}${phrase}`;
  assert.ok(text.length>500&&text.length<=MAX_PITCH_LENGTH);
  const f=setup({firstRole:'seller',interpret:async context=>{interpreted=context;return liveIntent('offer',phrase,50);}});await f.game.start();const before=ledger(f.game);
  await f.game.say(text);assert.equal(interpreted.text,text);assert.equal(f.contexts.at(-1).text,text);
  assert.equal(f.game.history.at(-2).content,text);assert.equal(f.game.bargain.playerOffer,50);assert.equal(ledger(f.game),before);
});

test('response is emitted before presentation and new pitches wait for speech/typewriter completion',async()=>{
  const entered=deferred(),finished=deferred();let presentation;
  const f=setup({presentReply:details=>{presentation=details;entered.resolve();return finished.promise;}});
  const started=f.game.start();await entered.promise;
  assert.equal(f.game.phase,'thinking');assert.equal(f.game.lines.at(-1).text,presentation.line);assert.equal(presentation.customer.id,f.game.customer.id);
  assert.equal(presentation.signal.aborted,false);assert.equal(await f.game.say('Interrupting pitch'),false);assert.equal(f.game.turn,0);
  assert.deepEqual(f.phases,['arriving','thinking','thinking']);
  finished.resolve();assert.equal(await started,true);assert.equal(f.game.phase,'listening');
});

test('stop aborts presentation immediately even when the presentation ignores its signal',async()=>{
  const entered=deferred(),finished=deferred();let signal;
  const f=setup({presentReply:details=>{signal=details.signal;entered.resolve();return finished.promise;}});
  const started=f.game.start();await entered.promise;f.game.stop();
  assert.equal(signal.aborted,true);assert.equal(await started,false);assert.equal(f.game.phase,'idle');
  finished.resolve();await Promise.resolve();assert.equal(f.game.phase,'idle');assert.deepEqual(f.game.lines,[]);
});

test('goodbye finishes its spoken presentation before the customer starts walking out',async()=>{
  const entered=deferred(),finished=deferred();let count=0;
  const f=setup({presentReply:()=>{count++;if(count===2){entered.resolve();return finished.promise;}}});
  await f.game.start();const pending=f.game.say('Goodbye.');await entered.promise;
  assert.equal(f.game.phase,'thinking');assert.equal(f.events.filter(x=>x[0]==='leave').length,0);assert.equal(f.game.role,'buyer');
  finished.resolve();assert.equal(await pending,true);assert.equal(f.events.filter(x=>x[0]==='leave').length,1);assert.equal(f.game.role,'seller');assert.equal(f.game.phase,'listening');
});

test('next-customer command cancels a presentation and its late completion cannot unlock a new visit',async()=>{
  const entered=deferred(),finished=deferred();let signal,count=0;
  const f=setup({presentReply:details=>{if(++count===1){signal=details.signal;entered.resolve();return finished.promise;}}});
  const started=f.game.start();await entered.promise;await f.game.say('Next customer');
  assert.equal(signal.aborted,true);assert.equal(await started,false);assert.equal(f.game.role,'seller');assert.equal(f.game.phase,'listening');
  const before=JSON.stringify(f.game.lines);finished.resolve();await Promise.resolve();assert.equal(JSON.stringify(f.game.lines),before);assert.equal(f.game.visitNumber,2);
});

test('presentation failure leaves the written reply visible and releases the next microphone turn',async()=>{
  const f=setup({presentReply:async()=>{throw Error('Speech unavailable');}});
  assert.equal(await f.game.start(),true);assert.equal(f.game.phase,'listening');assert.equal(f.game.lines.at(-1).text,'Hello from the counter.');
  assert.equal(await f.game.say('Tell me more'),true);assert.equal(f.game.phase,'listening');assert.equal(f.game.turn,1);
});

test('voiced buyer proposals counter without settling, then acceptance sells owned stock exactly once',async()=>{
  const f=setup();await f.game.start();const item=f.game.item,cash=f.game.state.cash,acquisition=f.game.state.inventory.find(x=>x.id===item.id).acquisitionPrice;
  await f.game.say('My asking price is $500.');
  assert.equal(f.game.bargain.playerOffer,500);assert.equal(f.game.bargain.status,'negotiating');assert.equal(f.game.state.log.length,0);assert.equal(f.game.state.cash,cash);
  const firstQuote=f.game.bargain.customerOffer;assert.ok(firstQuote>0&&firstQuote<500);
  assert.equal(f.contexts.at(-1).state.negotiation.playerOffer,500);assert.equal(f.contexts.at(-1).state.negotiation.customerOffer,firstQuote);
  await f.game.say(`My price is $100. I mean $${firstQuote+10}.`);
  assert.equal(f.game.bargain.playerOffer,firstQuote+10);assert.equal(f.contexts.at(-1).state.negotiation.playerOffer,firstQuote+10);assert.equal(f.game.state.log.length,0);
  const agreed=f.game.bargain.customerOffer;await f.game.say('I accept your offer.');
  assert.equal(f.game.bargain.status,'complete');assert.equal(f.game.bargain.agreedPrice,agreed);assert.equal(f.game.state.cash,cash+agreed);
  assert.ok(!f.game.state.inventory.some(x=>x.id===item.id));assert.equal(f.game.state.log.length,1);assert.equal(f.game.state.log[0].kind,'sell');assert.equal(f.game.progress.profit,agreed-acquisition);
  assert.equal(f.contexts.at(-1).state.negotiation.status,'complete');assert.match(f.game.lines.at(-1).text,new RegExp(`pay \\$${agreed}`));
  await f.game.say('Deal.');await f.game.offer(1);assert.equal(f.game.state.cash,cash+agreed);assert.equal(f.game.state.log.length,1);assert.equal(f.game.state.closedDeals.size,1);
  await f.game.next();assert.deepEqual(f.events.find(x=>x[0]==='leave')[1],{takeItem:true});
});

test('voiced seller proposal and acceptance purchase an unowned item at the actual counterprice',async()=>{
  const f=setup({firstRole:'seller'});await f.game.start();const item=f.game.item,cash=f.game.state.cash,opening=f.game.bargain.customerOffer;
  assert.ok(!f.game.state.inventory.some(x=>x.id===item.id));assert.match(f.game.lines.at(-1).text,new RegExp(`asking \\$${opening}`));
  await f.game.say('I can pay one dollar.');const counter=f.game.bargain.customerOffer;
  assert.equal(f.game.bargain.playerOffer,1);assert.ok(counter>1&&counter<=opening);assert.equal(f.game.state.log.length,0);assert.equal(f.game.state.cash,cash);
  assert.equal(f.contexts.at(-1).state.negotiation.playerOffer,1);assert.equal(f.contexts.at(-1).state.negotiation.customerOffer,counter);
  await f.game.say('Deal.');assert.equal(f.game.bargain.status,'complete');assert.equal(f.game.state.cash,cash-counter);assert.equal(f.game.state.inventory.find(x=>x.id===item.id).acquisitionPrice,counter);
  assert.equal(f.game.progress.profit,0);assert.equal(f.game.state.log[0].kind,'buy');assert.equal(f.game.progress.deals,1);
  await f.game.next();assert.deepEqual(f.events.find(x=>x[0]==='leave')[1],{takeItem:false});
});

test('accepted numeric proposal waits for confirmation and duplicate confirmation transfers only once',async()=>{
  const f=setup({firstRole:'seller'});await f.game.start();const pendingReply=deferred();f.game.talk=()=>pendingReply.promise;
  const cash=f.game.state.cash,price=f.game.bargain.customerOffer;
  const first=f.game.offer(price);assert.equal(f.game.phase,'thinking');assert.equal(f.game.state.cash,cash);assert.equal(f.game.state.log.length,0);
  assert.equal(await f.game.offer(price),false);assert.equal(await f.game.say('Deal'),false);assert.equal(f.game.state.log.length,0);
  pendingReply.resolve({line:'Thank you.',expression:'pleased',source:'live'});await first;
  assert.equal(f.game.bargain.status,'agreed');assert.equal(f.game.bargain.agreedPrice,price);assert.equal(f.game.state.cash,cash);
  await Promise.all([f.game.confirm(),f.game.confirm()]);
  assert.equal(f.game.bargain.status,'complete');assert.equal(f.game.state.log.length,1);assert.equal(f.game.state.cash,cash-price);
  await f.game.confirm();await f.game.offer(price);assert.equal(f.game.state.log.length,1);assert.equal(f.game.state.closedDeals.size,1);
});

test('unaffordable proposals and accepting an unaffordable quote never alter cash or stock',async()=>{
  const f=setup({firstRole:'seller'});await f.game.start();const before=f.game.state.inventory.length;
  await f.game.say('I offer $500.');assert.equal(f.game.bargain.lastAction,'funds');assert.equal(f.game.state.cash,120);assert.equal(f.game.state.inventory.length,before);assert.equal(f.game.state.log.length,0);
  assert.equal(f.contexts.at(-1).state.negotiation.playerOffer,500);assert.equal(f.contexts.at(-1).state.negotiation.lastAction,'funds');
  // Reach a low-cash shop through actual trades, preserving a valid ledger.
  await f.game.offer(120);await f.game.confirm();assert.equal(f.game.state.cash,0);await f.game.next();assert.equal(f.game.role,'buyer');await f.game.offer(1);await f.game.confirm();assert.equal(f.game.state.cash,1);
  // Another buyer arrives instead of immediately returning the unique just-sold item.
  await f.game.next();assert.equal(f.game.role,'buyer');await f.game.offer(1);await f.game.confirm();
  await f.game.next();await f.game.next();assert.equal(f.game.role,'seller');const stock=f.game.state.inventory.map(x=>x.id);assert.ok(f.game.bargain.customerOffer>2);
  await f.game.say('I accept your offer.');assert.equal(f.game.bargain.status,'negotiating');assert.equal(f.game.bargain.agreedPrice,null);assert.equal(f.game.bargain.lastAction,'funds');
  assert.equal(f.game.state.cash,2);assert.deepEqual(f.game.state.inventory.map(x=>x.id),stock);assert.equal(f.game.state.log.length,3);
});

test('unquoted acceptance and invalid or ambiguous offers cannot create a transaction',async()=>{
  const f=setup();await f.game.start();const cash=f.game.state.cash;
  await f.game.say('Deal.');assert.equal(f.game.bargain.lastAction,'clarify');assert.equal(f.game.bargain.customerOffer,null);
  for(const text of ['My offer is $0.','My offer is $501.','I offer $30.50.','I offer $40 or $50.']){
    await f.game.say(text);assert.ok(['invalid','clarify'].includes(f.game.bargain.lastAction));assert.equal(f.game.state.cash,cash);assert.equal(f.game.state.log.length,0);
  }
});

test('voice-negotiated profits unlock more stock and saved progress restores exactly once',async()=>{
  const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},store=createProgressStore({storage});
  const f=setup({store});await f.game.start();assert.equal(unlockedItems(f.game.state).length,4);
  let visits=0;
  while(f.game.progress.level<3&&visits++<40){
    for(const detail of f.game.item.details.filter(d=>d.tags.some(tag=>f.game.customer.interests.includes(tag))))await f.game.say(detail.text);
    await f.game.say(`The condition is important: ${f.game.item.condition}`);
    await f.game.offer(f.game.role==='buyer'?500:1);
    await f.game.say('I accept your offer.');
    assert.equal(f.game.bargain.status,'complete');
    if(f.game.progress.level<3)await f.game.next();
  }
  assert.ok(visits<=40);assert.ok(f.game.progress.profit>=200);assert.ok(f.game.progress.level>=3);assert.equal(unlockedItems(f.game.state).length,6);
  const cash=f.game.state.cash,profit=f.game.progress.profit,logLength=f.game.state.log.length,owned=f.game.state.inventory.map(x=>[x.id,x.acquisitionPrice]);
  f.game.stop();await f.game.start();assert.equal(f.game.state.cash,cash);assert.equal(f.game.progress.profit,profit);assert.equal(f.game.state.log.length,logLength);assert.deepEqual(f.game.state.inventory.map(x=>[x.id,x.acquisitionPrice]),owned);
});

test('semantic evidence changes receptiveness and speaks the same counteroffer shown in the bargain',async()=>{
  const f=setup();await f.game.start();await f.game.offer(500);
  const quote=f.game.bargain.customerOffer,receptiveness=f.game.bargain.receptiveness;
  const detail=f.game.item.details.find(d=>d.tags.some(tag=>f.game.customer.interests.includes(tag)));assert.ok(detail);
  f.game.talk=async()=>({line:'That makes it more interesting to me.',expression:'interested',source:'live',evaluation:{relevantDetailIds:[detail.id],acknowledgesCondition:false,overclaim:false,question:false}});
  await f.game.say('That unusual detail makes it a good match for your collection.');
  assert.ok(f.game.bargain.receptiveness>receptiveness);assert.ok(f.game.bargain.customerOffer>quote);assert.equal(f.game.state.log.length,0);
  assert.match(f.game.lines.at(-1).text,new RegExp(`offer you \\$${f.game.bargain.customerOffer}`));
});

test('model money and ownership claims cannot override a counteroffer or settle the ledger',async()=>{
  const f=setup();await f.game.start();f.game.talk=async()=>({line:"Deal. I'll pay $500. You have a nice shop.",expression:'pleased',source:'live',cash:999999,inventory:[],agreedPrice:500});
  const cash=f.game.state.cash,stock=f.game.state.inventory.length;await f.game.offer(500);
  assert.equal(f.game.bargain.status,'negotiating');assert.equal(f.game.state.cash,cash);assert.equal(f.game.state.inventory.length,stock);assert.equal(f.game.state.log.length,0);
  assert.ok(!f.game.lines.at(-1).text.includes('$500'));assert.match(f.game.lines.at(-1).text,new RegExp(`offer you \\$${f.game.bargain.customerOffer}`));
});

test('counter greetings do not ask the player to repeat the completed item placement',async()=>{
  const f=setup({talk:async()=>({line:'Set it down where I can see it. I would like to know whether it works.',expression:'curious',source:'live'})});
  await f.game.start();assert.equal(f.game.lines.at(-1).text,'I would like to know whether it works.');
});

test('live interpretation happens before any bargain mutation and a safe offer remains pending',async()=>{
  const entered=deferred(),intent=deferred();let received;
  const f=setup({firstRole:'seller',interpret:async context=>{received=context;entered.resolve();return intent.promise;}});
  await f.game.start();const before=ledger(f.game),price=f.game.bargain.customerOffer,text=`I offer $${price}.`;
  const pending=f.game.say(text);await entered.promise;
  assert.equal(f.game.phase,'thinking');assert.equal(ledger(f.game),before);assert.equal(f.game.bargain.playerOffer,null);
  assert.equal(received.text,text);assert.equal(received.state.negotiation.customerOffer,price);
  intent.resolve(liveIntent('offer',text,price));await pending;
  assert.equal(f.game.bargain.status,'agreed');assert.equal(f.game.bargain.playerOffer,price);assert.equal(ledger(f.game),before);
  await f.game.confirm();assert.equal(f.game.state.log.length,1);assert.equal(f.game.state.cash,120-price);
});

test('price complaints and rhetorical screenshot regressions never become offers or purchases',async()=>{
  const cases=[
    ['Why are you asking $107?','question'],
    ["You said $107, that's ridiculous.",'discussion'],
    ['I cannot pay $107.','discussion'],
    ['I asked for $107, not $80.','discussion'],
    ['Why did you accept $107? I never offered that.','question'],
    ['I said I wanted to buy it, not that I would pay $107.','discussion'],
  ];
  const f=setup({firstRole:'seller',interpret:async context=>liveIntent(cases.find(([text])=>text===context.text)?.[1]||'discussion',context.text)});
  await f.game.start();const before=ledger(f.game);
  for(const [text] of cases){await f.game.say(text);assert.equal(ledger(f.game),before,text);assert.equal(f.game.bargain.playerOffer,null,text);assert.equal(f.game.bargain.agreedPrice,null,text);}
});

test('deterministic evidence gate vetoes a confident but false AI monetary interpretation',async()=>{
  const f=setup({firstRole:'seller',interpret:async context=>liveIntent('offer',context.text,107)});await f.game.start();const before=ledger(f.game);
  for(const text of ['Why are you asking $107?','You said $107. I never offered that.','I cannot pay $107.']){
    await f.game.say(text);assert.equal(ledger(f.game),before);assert.equal(f.game.bargain.playerOffer,null);assert.equal(f.game.bargain.agreedPrice,null);
  }
  f.game.interpret=async context=>liveIntent('accept',context.text);
  await f.game.say('Yes, the dial is broken.');assert.equal(ledger(f.game),before);assert.equal(f.game.bargain.status,'negotiating');
});

test('injected interpretation failure never falls back to executing a locally parsed money offer',async()=>{
  for(const interpret of [async()=>{throw Error('offline');},async()=>null,async context=>({...liveIntent('ambiguous',context.text),source:'fallback'}),async context=>({...liveIntent('offer',context.text,80),confidence:.2})]){
    const f=setup({firstRole:'seller',interpret});await f.game.start();const before=ledger(f.game);
    await f.game.say('I offer $80.');assert.equal(ledger(f.game),before);assert.equal(f.game.bargain.playerOffer,null);assert.equal(f.game.bargain.agreedPrice,null);
  }
});

test('explicit offer controls bypass failed interpretation but still wait for confirmation',async()=>{
  let calls=0;const f=setup({firstRole:'seller',interpret:async()=>{calls++;throw Error('offline');}});await f.game.start();
  const price=f.game.bargain.customerOffer;await f.game.offer(price);
  assert.equal(calls,0);assert.equal(f.game.bargain.status,'agreed');assert.equal(f.game.state.log.length,0);
  await f.game.confirm();assert.equal(f.game.state.log.length,1);
});

test('a corrected offer reopens a pending agreement without moving any money',async()=>{
  const f=setup({firstRole:'seller',interpret:async context=>liveIntent('offer',context.text,80)});await f.game.start();
  await f.game.offer(107);assert.equal(f.game.bargain.status,'agreed');assert.equal(f.game.state.log.length,0);
  await f.game.say('No, I mean $80.');
  assert.equal(f.game.bargain.playerOffer,80);assert.notEqual(f.game.bargain.status,'complete');assert.notEqual(f.game.bargain.agreedPrice,107);
  assert.equal(f.game.state.cash,120);assert.equal(f.game.state.log.length,0);
});

test('exact live screenshot complaint and confidence .82 correction preserve the till until confirmation',async()=>{
  const complaint="$107 is a little much. I am not even a photographer and I don't think anybody would buy this. Why should I buy this camera?";
  const correction="No, I don't wanna. No, a hundred and seven isn't how much I'm wanting. That's way too much. I'd say I'd buy it for 80 bucks.";
  const f=setup({firstRole:'seller',interpret:async context=>context.text===complaint?
    {...liveIntent('discussion',complaint),confidence:.9}:
    {...liveIntent('offer',"I'd buy it for 80 bucks",80),confidence:.82}});
  await f.game.start();const before=ledger(f.game);
  await f.game.say(complaint);assert.equal(ledger(f.game),before);assert.equal(f.game.bargain.playerOffer,null);assert.equal(f.game.bargain.agreedPrice,null);
  await f.game.offer(107);assert.equal(f.game.bargain.status,'agreed');assert.equal(ledger(f.game),before);
  await f.game.say(correction);
  assert.equal(f.game.bargain.playerOffer,80);assert.notEqual(f.game.bargain.agreedPrice,107);assert.notEqual(f.game.bargain.status,'complete');assert.equal(ledger(f.game),before);
});

test('a subsequent explicit spoken Deal confirms a pending AI-interpreted proposal once',async()=>{
  const f=setup({firstRole:'seller',interpret:async context=>liveIntent('accept',context.text)});await f.game.start();const price=f.game.bargain.customerOffer;
  await f.game.offer(price);assert.equal(f.game.bargain.status,'agreed');assert.equal(f.game.state.log.length,0);
  await f.game.say('Deal.');assert.equal(f.game.bargain.status,'complete');assert.equal(f.game.state.log.length,1);
  await f.game.say('Deal.');assert.equal(f.game.state.log.length,1);assert.equal(f.game.state.cash,120-price);
});

test('next customer aborts stale interpretation and late high-confidence offers cannot mutate either visit',async()=>{
  const entered=deferred(),intent=deferred();let signal;
  const f=setup({firstRole:'seller',interpret:async(_context,options)=>{signal=options.signal;entered.resolve();return intent.promise;}});await f.game.start();const before=ledger(f.game);
  const pending=f.game.say('I offer $80.');await entered.promise;
  await f.game.next();assert.equal(signal.aborted,true);assert.equal(await pending,false);assert.equal(ledger(f.game),before);
  const visit=f.game.visitNumber;intent.resolve(liveIntent('offer','I offer $80.',80));await Promise.resolve();
  assert.equal(f.game.visitNumber,visit);assert.equal(f.game.bargain.playerOffer,null);assert.equal(ledger(f.game),before);assert.equal(f.game.phase,'listening');
});

test('undoing the latest purchase or sale restores the earlier ledger and starts a fresh visitor',async()=>{
  for(const firstRole of ['seller','buyer']){
    const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},store=createProgressStore({storage});
    const f=setup({firstRole,store});await f.game.start();
    const before=ledger(f.game),price=firstRole==='seller'?f.game.bargain.customerOffer:1,itemName=f.game.item.name;
    await f.game.offer(price);await f.game.confirm();assert.equal(f.game.state.log.length,1);
    assert.deepEqual(f.game.undoDeal,{itemName,price,kind:firstRole==='seller'?'buy':'sell'});
    const visit=f.game.visitNumber;await f.game.undoLastDeal();
    assert.equal(ledger(f.game),before);assert.ok(f.game.visitNumber>visit);assert.equal(f.game.phase,'listening');assert.equal(f.game.undoDeal,null);
    assert.equal(store.load().log.length,0);await f.game.confirm();assert.equal(f.game.state.log.length,0);
  }
});
