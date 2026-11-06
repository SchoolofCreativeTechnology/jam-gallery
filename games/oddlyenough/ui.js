import * as T from './tuning.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const money=n=>`${n<0?'−':''}$${Math.abs(n).toLocaleString('en-US')}`;
const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};

// Minimal functional overlay. The scene and the game rules are separate adapters.
export function createUI(handlers) {
  const root=el('main','interface');document.body.append(root);
  const header=el('header','topbar'),title=el('strong','brand','ODDLY ENOUGH');
  const day=el('span'),cash=el('strong'),save=el('span','save-status');save.setAttribute('aria-live','polite');
  const sound=button('Sound off',()=>handlers.onSound(sound));sound.setAttribute('aria-pressed','false');
  header.append(title,day,cash,save,sound,button('Restart',()=>handlers.onRestart()));

  const tools=el('div','scene-tools');
  const inspectButton=button('Inspect object',()=>openInspection());
  const camera=button('Change view',()=>handlers.onCamera());camera.title='Switch between the whole counter and a close look.';
  const stock=el('select');stock.setAttribute('aria-label','Choose stock to offer');stock.onchange=()=>handlers.onSelectItem(stock.value);
  tools.append(inspectButton,camera,stock);

  const panel=el('section','conversation');panel.setAttribute('aria-label','Customer negotiation');
  const identity=el('div','identity'),name=el('strong'),role=el('span'),patience=el('span','patience');
  const historyButton=button('History',()=>{historyOpen=!historyOpen;paintLines();});
  identity.append(name,role,patience,historyButton);
  const cue=el('p','cue');
  const dialogue=el('div','dialogue');dialogue.setAttribute('role','log');dialogue.setAttribute('aria-live','polite');dialogue.setAttribute('aria-label','Conversation');dialogue.tabIndex=0;
  const history=el('div','history');history.hidden=true;history.setAttribute('aria-label','Conversation history');history.tabIndex=0;
  const form=el('form','pitch-form'),input=el('textarea');input.rows=1;input.maxLength=T.MAX_PITCH_LENGTH;input.placeholder='Ask or make your case…';input.setAttribute('aria-label','Your pitch');
  const speak=button('Say',submit);form.append(input,speak);form.onsubmit=e=>{e.preventDefault();submit();};
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}};
  function submit(){const text=input.value.trim();if(!text||input.disabled)return;input.value='';handlers.onPitch(text);}
  const offers=el('div','offers'),offerLabel=el('label'),amount=el('input');amount.id='offer-number';amount.type='number';amount.min=T.MIN_OFFER;amount.max=T.MAX_OFFER;amount.step=1;amount.setAttribute('aria-label','Offer in dollars');offerLabel.htmlFor=amount.id;
  const offer=button('Offer',()=>handlers.onOffer(Number(amount.value)));
  const counter=button('Match counter',()=>{amount.value=lastCounter;handlers.onOffer(lastCounter);});
  const leave=button('No deal',()=>handlers.onLeave());
  offers.append(offerLabel,amount,offer,counter,leave);
  const status=el('div','status');status.setAttribute('role','status');
  panel.append(identity,cue,history,dialogue,form,offers,status);

  const inspection=el('aside','inspection');inspection.hidden=true;inspection.setAttribute('aria-label','Item inspection');
  const inspectHeading=el('div','inspection-heading'),itemName=el('strong');
  inspectHeading.append(itemName,button('Close',()=>closeInspection()));
  const description=el('p'),condition=el('p'),claim=el('p'),details=el('div');inspection.append(inspectHeading,description,condition,claim,details);
  const overlay=el('section','overlay'),card=el('div','welcome-card');overlay.append(card);
  root.append(header,tools,panel,inspection,overlay);

  let game,encounterId=null,itemId=null,lastCounter=null,savedAvailable=false,serviceMode='authored',historyOpen=false;
  function openInspection(){if(game?.phase!=='play')return;inspection.hidden=false;inspectButton.setAttribute('aria-expanded','true');}
  function closeInspection(){inspection.hidden=true;inspectButton.setAttribute('aria-expanded','false');}
  function showItem(e){
    itemName.textContent=e.item.name;inspectButton.textContent='Inspect '+e.item.name;
    description.textContent=e.item.description;condition.textContent='Condition: '+e.item.condition;
    claim.textContent='Unverified story: '+(e.item.claim||'Unknown origin.');
    details.replaceChildren();
    for(const d of e.item.details){const section=el('details'),summary=el('summary','',d.label);section.append(summary,el('p','',d.text));section.ontoggle=()=>{if(section.open)handlers.onInspect(d.id);};details.append(section);}
  }
  function makeLine(line){const n=el('p','line '+line.speaker);const label=line.speaker==='player'?'You: ':line.speaker==='customer'?`${game.encounter.customer.name.split(' ')[0]}: `:'';n.textContent=label+line.text;return n;}
  function paintLines(){
    if(!game?.encounter)return;
    const lines=game.lines,latest=lines.at(-1);dialogue.replaceChildren();
    if(latest){if(latest.speaker==='system'&&lines.at(-2)?.speaker==='customer')dialogue.append(makeLine(lines.at(-2)));dialogue.append(makeLine(latest));}
    history.hidden=!historyOpen;historyButton.textContent=historyOpen?'Hide history':'History';historyButton.setAttribute('aria-expanded',String(historyOpen));
    if(historyOpen){history.replaceChildren(...lines.map(makeLine));history.scrollTop=history.scrollHeight;}
  }
  function update(g){
    game=g;root.dataset.phase=g.phase;
    const playing=g.phase==='play';overlay.hidden=playing;tools.hidden=panel.hidden=!playing;
    day.textContent=`Day ${g.state.day} · ${g.encounter?.number??Math.min(g.state.customerIndex+1,T.CUSTOMERS_PER_DAY)}/${T.CUSTOMERS_PER_DAY}`;
    cash.textContent=money(g.state.cash);cash.title=`Keep ${money(T.RENT)} for rent at closing.`;
    if(!playing){closeInspection();paintOverlay(g);return;}
    const e=g.encounter;if(!e)return;
    if(e.id!==encounterId){encounterId=e.id;itemId=null;historyOpen=false;closeInspection();input.value='';}
    if(itemId!==e.item.id){itemId=e.item.id;showItem(e);amount.value=e.offer;}
    const buying=e.customer.role==='seller',active=e.status==='active';
    name.textContent=e.customer.name;name.title=e.customer.occupation||e.customer.voice;
    role.textContent=(e.customer.personalityLabel?e.customer.personalityLabel+' · ':'')+(buying?`Selling · asks ${money(e.customer.asking)}`:'Buying from you');
    patience.textContent=`Patience ${e.patience}/${e.customer.patience}`;patience.title=`Interest ${Math.round(e.interest*100)}% · Doubt ${Math.round(e.skepticism*100)}%`;
    cue.textContent=e.customer.cue||'';
    paintLines();
    input.disabled=speak.disabled=!active||e.finalOffer;amount.disabled=offer.disabled=!active;leave.disabled=e.status==='leaving';
    offerLabel.textContent=buying?'Pay $':'Ask $';
    lastCounter=e.counter;counter.hidden=!e.counter||e.agreement!==null;counter.disabled=!active;counter.textContent=`Match ${money(e.counter||0)}`;
    offer.textContent=e.agreement!==null?`${buying?'Buy':'Sell'} ${money(e.agreement)}`:'Offer';
    offer.onclick=e.agreement!==null?()=>handlers.onConfirm():()=>handlers.onOffer(Number(amount.value));
    if(e.agreement!==null){amount.value=e.agreement;amount.disabled=true;}
    status.textContent=e.status==='thinking'?(e.pendingEvent==='reply'?'Thinking…':'Considering the object…'):e.status==='leaving'?'Next visitor…':e.finalOffer?'Final offer: match their counter, offer once more, or walk away.':e.agreement!==null?'Price agreed. Confirm to exchange the item and money.':serviceMode==='live'?(e.source==='live'?'Live dialogue':e.turn>0||e.greeted?'Authored fallback · live reply unavailable':'Live dialogue ready'):'Authored dialogue';
    stock.replaceChildren();
    const placeholder=el('option','',`Stock (${g.state.inventory.length})`);placeholder.value='';stock.append(placeholder);
    for(const item of g.state.inventory){const option=el('option','',`${item.name} · cost ${money(item.acquisitionPrice)}`);option.value=item.id;stock.append(option);}
    stock.value=buying||!g.state.inventory.some(item=>item.id===e.item.id)?'':e.item.id;stock.disabled=buying||(!active&&!(e.status==='thinking'&&e.pendingEvent!=='reply'))||e.finalOffer||g.state.inventory.length===0;
  }
  function paintOverlay(g){
    card.replaceChildren();
    if(g.phase==='title'){
      card.append(el('h1','','Oddly Enough'),el('p','','Inspect. Bargain. Buy and sell.'),el('p','',`${money(T.CASH_START)} to start. ${T.CUSTOMERS_PER_DAY} visitors. ${money(T.RENT)} rent per day.`));
      if(savedAvailable)card.append(button('Resume shop',()=>handlers.onResume()));
      card.append(button('New shop',()=>handlers.onStart()));
    }else{
      const r=g.result;card.append(el('h1','',r.rentPaid?'Day complete':'Shop closed'),el('p','',r.rentPaid?`Rent paid. ${money(g.state.cash)} in the till.`:`You were ${money(r.short)} short on rent.`));
      card.append(el('p','',`Bought ${r.bought} · Sold ${r.sold} · Trade profit ${money(r.profit)} · Stock ${money(r.stock)}`));
      if(r.rentPaid)card.append(button('Next day',()=>handlers.onContinue()));
      card.append(button('New shop',()=>handlers.onRestart()));
    }
  }
  return {update,inspect:openInspection,setResumeAvailable(value){savedAvailable=!!value;if(game?.phase==='title')paintOverlay(game);},setServiceMode(mode){serviceMode=mode;if(game)update(game);},setSaveStatus(ok){save.textContent=ok?'Saved':'Save unavailable';save.title=ok?'Your shop can resume after reloading.':'Storage unavailable; keep this page open.';},focus(){if(!input.disabled)input.focus();}};
}
