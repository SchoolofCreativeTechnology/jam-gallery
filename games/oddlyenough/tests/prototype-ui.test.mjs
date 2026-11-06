import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeUI} from '../prototype-ui.js';

class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.textContent='';this.hidden=false;this.scrollTop=0;this.scrollHeight=100;}
  setAttribute(key,value){this.attributes[key]=value;}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
}
async function withUI(run,{reduced=false,...callbacks}={}){
  const keys=['document','matchMedia','setInterval','clearInterval'],previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const timers=new Map();let sequence=0;
  const body=new Element('body');
  Object.assign(globalThis,{document:{body,createElement:tag=>new Element(tag)},matchMedia:()=>({matches:reduced}),
    setInterval:fn=>{timers.set(++sequence,fn);return sequence;},clearInterval:id=>timers.delete(id)});
  const ui=createPrototypeUI({onSpeak(){},onStart(){},...callbacks});
  const find=(className,node=body)=>node.className===className?node:node.children.map(child=>find(className,child)).find(Boolean);
  const panel=find('voice-chat');
  const line=find('spoken-line'),mic=find('microphone');
  const tick=(rounds=1)=>{for(let round=0;round<rounds;round++)for(const [id,fn] of [...timers])if(timers.has(id))fn();};
  try{await run({ui,panel,line,mic,timers,tick,body,find});}
  finally{ui.destroy();for(const key of keys){const descriptor=previous.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
}
const game=(text='A curious object has a story.')=>({phase:'thinking',customer:{name:'Customer'},lines:[{speaker:'customer',text}]});
const bargaining=()=>({...game(),phase:'listening',role:'buyer',bargain:{receptiveness:60,difficulty:'balanced',playerOffer:90,customerOffer:65,agreedPrice:null,status:'negotiating',feedback:'Tell me more about the condition.'},progress:{cash:120,profit:25,level:1,nextTarget:75,progress:1/3,deals:2,nextUnlock:'Feathered Coil'}});

test('new NPC line types once while microphone and speech repaints preserve progress and waiter',async()=>{
  await withUI(async({ui,line,timers,tick,mic})=>{
    const state=game('ABCDEFGHIJ');ui.update(state);const done=ui.typingDone;
    assert.equal(line.textContent,'');assert.equal(timers.size,1);assert.equal(mic.disabled,true);
    tick();assert.equal(line.textContent,'AB');
    ui.setMicState('recording');ui.setTranscript('testing');ui.setSpeechState('speaking');ui.setError('');ui.update(state);
    assert.equal(line.textContent,'AB');assert.equal(ui.typingDone,done);assert.equal(timers.size,1);
    tick(4);await done;assert.equal(line.textContent,'ABCDEFGHIJ');assert.equal(timers.size,0);
    state.phase='listening';ui.update(state);ui.setMicState('idle');
    assert.equal(line.textContent,'ABCDEFGHIJ');assert.equal(timers.size,0);assert.equal(mic.disabled,false);
  });
});

test('reduced motion reveals complete text immediately without a timer',async()=>{
  await withUI(async({ui,line,timers})=>{
    ui.update(game('A complete sentence.'));await ui.typingDone;
    assert.equal(line.textContent,'A complete sentence.');assert.equal(line.attributes['aria-label'],'A complete sentence.');assert.equal(timers.size,0);
  },{reduced:true});
});

test('leaving cancels a partial typewriter and resolves its waiter without waiting for another tick',async()=>{
  await withUI(async({ui,panel,line,timers,tick})=>{
    const state=game('A sentence that is still being typed.');ui.update(state);tick();const done=ui.typingDone;
    let completed=false;done.then(()=>{completed=true;});
    state.phase='leaving';ui.update(state);await Promise.resolve();
    assert.equal(completed,true);assert.equal(timers.size,0);assert.equal(panel.hidden,true);
    const partial=line.textContent;ui.setSpeechState('idle');ui.setMicState('idle');tick(30);
    assert.equal(timers.size,0);assert.equal(line.textContent,partial);
  });
});

test('next visit resolves the previous waiter and starts only the next customer line',async()=>{
  await withUI(async({ui,line,timers,tick})=>{
    const first=game('First customer speaking.');ui.update(first);tick();const firstDone=ui.typingDone;
    ui.update({phase:'arriving',customer:{name:'Next'},lines:[]});await firstDone;
    assert.equal(timers.size,0);assert.equal(line.textContent,'');
    const second=game('Second customer.');ui.update(second);const nextDone=ui.typingDone;
    assert.notEqual(firstDone,nextDone);assert.equal(timers.size,1);tick(100);await nextDone;
    assert.equal(line.textContent,'Second customer.');
  });
});

test('a replacement NPC response cancels the old timer and reveals Unicode without broken code points',async()=>{
  await withUI(async({ui,line,timers,tick})=>{
    const state=game('Old response.');ui.update(state);tick();const oldDone=ui.typingDone;
    state.lines.push({speaker:'customer',text:'🧭🔮 A new story.'});ui.update(state);await oldDone;
    assert.equal(timers.size,1);assert.equal(line.textContent,'');tick();assert.equal(line.textContent,'🧭🔮');
    tick(20);await ui.typingDone;assert.equal(line.textContent,'🧭🔮 A new story.');assert.equal(timers.size,0);
  });
});

test('idle and destroy both resolve outstanding presentations, and returning from idle can reveal again',async()=>{
  await withUI(async({ui,line,timers,tick,body})=>{
    const state=game('A resumed conversation.');ui.update(state);const firstDone=ui.typingDone;
    state.phase='idle';ui.update(state);await firstDone;assert.equal(timers.size,0);
    state.phase='listening';ui.update(state);assert.equal(timers.size,1);tick();assert.equal(line.textContent,'A ');
    const resumedDone=ui.typingDone;ui.destroy();await resumedDone;assert.equal(timers.size,0);assert.equal(body.children.length,0);
  });
});

test('buyer and seller offer labels show the actual direction of the trade',async()=>{
  await withUI(async({ui,find})=>{
    const state=bargaining();ui.update(state);
    assert.equal(find('player-offer').attributes['aria-label'],'You ask: $90');assert.equal(find('customer-offer').attributes['aria-label'],'They offer: $65');
    assert.equal(find('receptiveness-value').textContent,'Warming up');assert.equal(find('receptiveness-meter').attributes['aria-valuenow'],'60');assert.equal(find('negotiator-difficulty').textContent,'Steady negotiator');
    state.role='seller';state.bargain.playerOffer=null;state.bargain.difficulty='hard';ui.update(state);
    assert.equal(find('player-offer').attributes['aria-label'],'You offer: --');assert.equal(find('customer-offer').attributes['aria-label'],'They ask: $65');assert.equal(find('negotiator-difficulty').textContent,'Tough negotiator');
  });
});

test('progress shows real till, profit, level and the next item unlock',async()=>{
  await withUI(async({ui,find})=>{
    const state=bargaining();ui.update(state);
    assert.equal(find('shop-totals').attributes['aria-label'],'Till $120 · Profit +$25 · Level 1');assert.equal(find('level-track').attributes['aria-valuenow'],'33');
    assert.equal(find('next-unlock').textContent,'Next: Feathered Coil at $75 profit');
    state.progress.profit=-10;state.progress.progress=Infinity;state.progress.nextUnlock=null;state.bargain.receptiveness=200;ui.update(state);
    assert.equal(find('shop-totals').attributes['aria-label'],'Till $120 · Profit -$10 · Level 1');assert.equal(find('level-fill').style.width,'0%');assert.equal(find('next-unlock').hidden,true);assert.equal(find('receptiveness-marker').style.left,'100%');
  });
});

test('typed offers validate whole dollars, prevent duplicate submission, and preserve typewriter progress',async()=>{
  let resolve;const calls=[],pending=new Promise(r=>{resolve=r;});
  await withUI(async({ui,find,line,tick})=>{
    const state=bargaining();ui.update(state);tick();const partial=line.textContent,done=ui.typingDone;
    const form=find('offer-form'),input=find('offer-input'),submit=()=>form.onsubmit({preventDefault(){}});
    for(const value of ['', ' ', '0', '-1', '1.5', '501', 'NaN', '1e100']){input.value=value;await submit();}
    assert.deepEqual(calls,[]);assert.match(find('voice-hint').textContent,/whole-dollar/);
    input.value='83';const sent=submit();await submit();assert.deepEqual(calls,[83]);assert.equal(find('offer-button').disabled,true);
    assert.equal(line.textContent,partial);assert.equal(ui.typingDone,done);resolve(true);await sent;
    assert.equal(input.value,'');assert.equal(find('offer-button').disabled,false);
    ui.setMicState('recording');assert.equal(input.disabled,true);assert.equal(find('microphone').disabled,false);
  },{onOffer:amount=>{calls.push(amount);return pending;}});
});

test('agreement and completed trades show the price and enable only the appropriate actions',async()=>{
  let nextCalls=0;
  await withUI(async({ui,find})=>{
    const state=bargaining();state.bargain.status='agreed';state.bargain.agreedPrice=77;ui.update(state);
    assert.equal(find('agreed-price').hidden,false);assert.equal(find('agreed-price').textContent,'Agreed $77 · confirm to complete');assert.equal(find('next-customer').hidden,true);
    state.bargain.status='complete';state.phase='thinking';ui.update(state);
    assert.equal(find('agreed-price').textContent,'Deal complete: $77');assert.equal(find('offer-form').hidden,true);assert.equal(find('next-customer').hidden,false);assert.equal(find('next-customer').disabled,true);
    find('next-customer').onclick();assert.equal(nextCalls,0);state.phase='listening';ui.update(state);find('next-customer').onclick();assert.equal(nextCalls,1);
  },{onOffer(){},onNext(){nextCalls++;}});
});

test('an old offer completion cannot clear a new visitor input or show its old error',async()=>{
  let reject;const pending=new Promise((_,r)=>{reject=r;});
  await withUI(async({ui,find})=>{
    ui.update(bargaining());const input=find('offer-input');input.value='70';const sent=find('offer-form').onsubmit({preventDefault(){}});
    ui.update({phase:'arriving',lines:[],customer:{name:'Next'}});ui.update(bargaining());input.value='88';
    reject(Error('Old visitor'));await sent;assert.equal(input.value,'88');assert.ok(!find('voice-hint').textContent.includes('could not be sent'));assert.equal(find('offer-button').disabled,false);
  },{onOffer:()=>pending});
});

test('legacy conversation state hides bargain and profit UI without changing microphone behavior',async()=>{
  await withUI(async({ui,find,mic})=>{
    const state=game();state.phase='listening';ui.update(state);
    assert.equal(find('bargain').hidden,true);assert.equal(find('shop-progress').hidden,true);assert.equal(find('offer-form').hidden,true);assert.equal(find('next-customer').hidden,true);assert.equal(mic.disabled,false);
  });
});

test('two-ended marker tracks only canonical receptiveness and describes buying versus selling accurately',async()=>{
  await withUI(async({ui,find})=>{
    const state=bargaining();ui.update(state);
    assert.equal(find('scale-resistant').textContent,'Resistant');assert.equal(find('scale-convinced').textContent,'Convinced');assert.equal(find('receptiveness-meter').attributes.role,'meter');
    assert.equal(find('receptiveness-marker').style.left,'60%');assert.match(find('receptiveness-meter').attributes['aria-description'],/willingness to buy/);
    state.lines.push({speaker:'customer',text:'I absolutely love it!'});state.expression='pleased';ui.setSpeechState('speaking');ui.update(state);assert.equal(find('receptiveness-marker').style.left,'60%');
    for(const value of [0,25,50,75,100]){state.bargain.receptiveness=value;ui.update(state);assert.equal(find('receptiveness-marker').style.left,`${value}%`);assert.equal(find('receptiveness-meter').attributes['aria-valuenow'],String(value));}
    state.role='seller';ui.update(state);assert.match(find('receptiveness-meter').attributes['aria-description'],/willingness to sell/);
    state.bargain.receptiveness=-20;ui.update(state);assert.equal(find('receptiveness-marker').style.left,'0%');
  });
});

test('agreed price requires explicit confirm while offers and the microphone remain available',async()=>{
  let confirms=0,resolve;const pending=new Promise(r=>{resolve=r;});
  await withUI(async({ui,find,mic})=>{
    const state=bargaining();state.bargain.status='agreed';state.bargain.agreedPrice=83;ui.update(state);
    const confirm=find('confirm-deal');assert.equal(confirm.hidden,false);assert.equal(confirm.disabled,false);assert.equal(find('offer-form').hidden,false);assert.equal(find('offer-input').disabled,false);assert.equal(mic.disabled,false);assert.equal(find('next-customer').hidden,true);
    assert.equal(confirms,0);const clicked=confirm.onclick();assert.equal(confirms,1);assert.equal(confirm.disabled,true);await confirm.onclick();assert.equal(confirms,1);
    resolve();await clicked;state.phase='thinking';ui.update(state);await confirm.onclick();assert.equal(confirms,1);
    state.phase='listening';state.bargain.status='complete';ui.update(state);assert.equal(confirm.hidden,true);assert.equal(find('next-customer').hidden,false);
  },{onOffer(){},onNext(){},onConfirm(){confirms++;return pending;}});
});

test('undo shows the last purchase or sale and is usable only in listening or idle phases',async()=>{
  let undos=0;
  await withUI(async({ui,find})=>{
    const state=bargaining();state.undoDeal={itemName:'Amber Radio',price:70,kind:'buy'};ui.update(state);
    const undo=find('undo-deal');assert.equal(undo.hidden,false);assert.equal(undo.textContent,'Undo last purchase ($70)');assert.match(undo.title,/Amber Radio/);await undo.onclick();assert.equal(undos,1);
    state.phase='thinking';ui.update(state);assert.equal(undo.disabled,true);await undo.onclick();assert.equal(undos,1);
    state.phase='idle';state.undoDeal={itemName:'Tin Valentine',price:90,kind:'sell'};ui.update(state);assert.equal(undo.disabled,false);assert.equal(undo.textContent,'Undo last sale ($90)');await undo.onclick();assert.equal(undos,2);
    state.undoDeal=null;ui.update(state);assert.equal(undo.hidden,true);
  },{onUndo(){undos++;}});
});

test('a failed confirmation preserves the agreement and exposes a retry without changing any price',async()=>{
  await withUI(async({ui,find})=>{
    const state=bargaining();state.bargain.status='agreed';state.bargain.agreedPrice=72;ui.update(state);
    await find('confirm-deal').onclick();assert.equal(state.bargain.status,'agreed');assert.equal(state.bargain.agreedPrice,72);assert.equal(find('confirm-deal').disabled,false);assert.match(find('voice-hint').textContent,/could not be confirmed/);
  },{onConfirm:async()=>{throw Error('Temporary failure');}});
});


test('title opens the actual shop and the real HUD remains visible during arrival',async()=>{
  let starts=0;
  await withUI(async({ui,find,panel})=>{
    const state={...bargaining(),phase:'idle',visitNumber:0};ui.update(state);
    assert.equal(find('shop-title').hidden,false);assert.equal(panel.hidden,true);
    assert.equal(find('title-tagline').textContent,'Buy low. Sell strange.');
    assert.match(find('title-hint').textContent,/Tap Speak/);assert.equal(find('visitor-count').hidden,true);
    find('open-shop').onclick();assert.equal(starts,1);
    state.phase='arriving';state.visitNumber=1;ui.update(state);
    assert.equal(find('shop-title').hidden,true);assert.equal(find('open-shop').disabled,true);
    find('open-shop').onclick();assert.equal(starts,1);
    assert.equal(find('shop-progress').hidden,false);assert.equal(find('till-value').textContent,'$120');
    assert.equal(find('visitor-count').textContent,'Visitor 01');assert.equal(find('visit-status').hidden,false);
    state.phase='listening';state.visitNumber=12;ui.update(state);
    assert.equal(find('visit-status').hidden,true);assert.equal(find('visitor-count').textContent,'Visitor 12');assert.equal(panel.hidden,false);
  },{onStart(){starts++;}});
});

test('the item card and large prices reflect canonical state without adding invented prices or visitors',async()=>{
  await withUI(async({ui,find})=>{
    const state=bargaining();state.item={name:'Amber Radio',condition:'The dial sticks.'};ui.update(state);
    assert.equal(find('counter-item').textContent,'Amber Radio');assert.equal(find('item-condition').textContent,'The dial sticks.');
    assert.equal(find('player-offer-label').textContent,'You ask');assert.equal(find('player-price').textContent,'$90');
    assert.equal(find('customer-offer-label').textContent,'They offer');assert.equal(find('customer-price').textContent,'$65');
    assert.equal(find('visitor-count').hidden,true);
    state.role='seller';state.bargain.playerOffer=null;state.bargain.customerOffer=null;state.item={name:'Tin Valentine'};ui.update(state);
    assert.equal(find('player-price').textContent,'--');assert.equal(find('customer-price').textContent,'--');
    assert.equal(find('speaker-role').textContent,'Here to sell');assert.equal(find('item-condition').hidden,true);
  });
});

test('idle errors remain readable on the title and stale HUD actions cannot run during arrival',async()=>{
  let undos=0;
  await withUI(async({ui,find})=>{
    const state={...bargaining(),phase:'idle',undoDeal:{kind:'buy',price:65,itemName:'Amber Radio'}};ui.update(state);
    ui.setError('The shop is still loading.');assert.equal(find('title-hint').textContent,'The shop is still loading.');
    state.phase='arriving';ui.update(state);assert.equal(find('undo-deal').disabled,true);
    await find('undo-deal').onclick();assert.equal(undos,0);
    state.phase='listening';ui.update(state);await find('undo-deal').onclick();assert.equal(undos,1);
  },{onUndo(){undos++;}});
});
