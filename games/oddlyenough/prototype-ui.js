export function createPrototypeUI({onSpeak,onStart,onOffer,onNext,onConfirm,onUndo}) {
  const make=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const root=make('div','game-interface'),hud=make('header','shop-hud'),brand=make('div','shop-brand','ODDLY ENOUGH'),visitor=make('span','visitor-count');
  const title=make('section','shop-title'),titleCard=make('div','title-card'),eyebrow=make('p','title-eyebrow','A little shop. A lot of stories.'),titleName=make('h1','title-name','ODDLY\nENOUGH'),tagline=make('p','title-tagline','Buy low. Sell strange.'),open=make('button','open-shop','Open the shop'),titleHint=make('p','title-hint','Sound on. Tap Speak to talk, then Send when you’re done. You can also type a price.');
  title.setAttribute('aria-label','Welcome to Oddly Enough');open.type='button';open.onclick=()=>{if(game?.phase==='idle'&&!open.disabled)return onStart?.();};titleCard.append(eyebrow,titleName,tagline,open,titleHint);title.append(titleCard);
  const panel=document.createElement('section');panel.className='voice-chat';panel.hidden=true;panel.setAttribute('aria-label','Conversation');
  const name=document.createElement('strong'),line=document.createElement('p'),heard=document.createElement('p'),controls=document.createElement('div'),hint=document.createElement('span'),mic=document.createElement('button');
  name.className='speaker';line.className='spoken-line';heard.className='heard';controls.className='voice-controls';hint.className='voice-hint';hint.setAttribute('role','status');mic.type='button';mic.className='microphone';mic.onclick=()=>game?.phase==='idle'?onStart():onSpeak();
  const heading=make('div','conversation-heading'),speakerRole=make('span','speaker-role'),speech=make('div','speech-card'),progress=make('div','shop-progress'),totals=make('div','shop-totals'),till=make('span','till-value'),profit=make('span','profit-value'),level=make('span','shop-level'),levelTrack=make('div','level-track'),levelFill=make('span','level-fill'),unlock=make('span','next-unlock');
  const tillStat=make('div','till-stat'),profitStat=make('div','profit-stat');tillStat.append(make('span','stat-label','Till'),till);profitStat.append(make('span','stat-label','Profit'),profit);totals.append(tillStat,profitStat,level);
  levelTrack.setAttribute('role','progressbar');levelTrack.setAttribute('aria-valuemin','0');levelTrack.setAttribute('aria-valuemax','100');levelTrack.append(levelFill);progress.append(totals,levelTrack,unlock);heading.append(name,speakerRole);
  const bargain=make('div','bargain'),meterRow=make('div','bargain-meter-row'),meterLabel=make('span','receptiveness-label'),meterValue=make('span','receptiveness-value'),meter=make('div','receptiveness-meter'),meterMarker=make('span','receptiveness-marker'),difficulty=make('span','negotiator-difficulty');
  const scale=make('div','receptiveness-scale'),ends=make('div','receptiveness-ends'),resistant=make('span','scale-resistant'),convinced=make('span','scale-convinced');resistant.textContent='Resistant';convinced.textContent='Convinced';ends.append(resistant,convinced);
  meterLabel.textContent='Receptiveness';meter.setAttribute('role','meter');meter.setAttribute('aria-label','Customer receptiveness');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meterMarker.setAttribute('aria-hidden','true');meter.append(meterMarker);scale.append(ends,meter);meterRow.append(meterLabel,scale,meterValue,difficulty);
  const itemHeading=make('div','item-heading'),itemName=make('strong','counter-item'),itemCondition=make('span','item-condition');itemHeading.append(itemName,itemCondition);
  const offers=make('div','latest-offers'),playerOffer=make('div','player-offer'),customerOffer=make('div','customer-offer'),playerOfferLabel=make('span','player-offer-label'),playerPrice=make('strong','player-price'),customerOfferLabel=make('span','customer-offer-label'),customerPrice=make('strong','customer-price'),agreement=make('strong','agreed-price'),feedback=make('span','bargain-feedback');playerOffer.append(playerOfferLabel,playerPrice);customerOffer.append(customerOfferLabel,customerPrice);offers.append(customerOffer,playerOffer);bargain.append(itemHeading,offers,meterRow,agreement,feedback);
  const offerForm=make('form','offer-form'),offerLabel=make('label','offer-label'),offerInput=make('input','offer-input'),offerButton=make('button','offer-button'),next=make('button','next-customer'),confirm=make('button','confirm-deal'),undo=make('button','undo-deal');
  offerInput.type='number';offerInput.inputMode='numeric';offerInput.min='1';offerInput.max='500';offerInput.step='1';offerInput.placeholder='Your price';offerInput.autocomplete='off';offerInput.value='';offerLabel.append(make('span','offer-currency','$'),offerInput);offerButton.type='submit';offerButton.textContent='Offer';offerForm.append(offerLabel,offerButton);
  next.type='button';next.textContent='Next customer';next.onclick=()=>{if(!next.disabled&&game?.bargain?.status==='complete')onNext?.();};
  confirm.type='button';confirm.textContent='Confirm deal';confirm.onclick=()=>{if(!confirm.disabled&&game?.phase==='listening'&&game.bargain?.status==='agreed')return runAction(onConfirm,'The deal could not be confirmed. Try again.');};
  undo.type='button';undo.onclick=()=>{if(!undo.disabled&&game?.undoDeal&&['idle','listening'].includes(game.phase))return runAction(onUndo,'The last deal could not be undone. Try again.');};
  const actions=make('div','conversation-actions'),hudEnd=make('div','hud-end'),visitStatus=make('div','visit-status');visitStatus.setAttribute('role','status');
  actions.append(offerForm,confirm,next);bargain.append(actions);controls.append(hint,mic);speech.append(heading,line,heard,controls);panel.append(speech,bargain);hudEnd.append(visitor,undo);hud.append(brand,progress,hudEnd);root.append(hud,title,visitStatus,panel);document.body.append(root);
  let game=null,micState='idle',speechState='idle',error='',draft='',lastLine=null,timer=null,resolveTyping=null,typingDone=Promise.resolve(),offerPending=false,actionPending=false,offerEpoch=0;
  const money=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value):'--';
  const percent=value=>Number.isFinite(value)?Math.max(0,Math.min(100,value)):0;
  async function runAction(callback,message){
    if(typeof callback!=='function'||actionPending||offerPending)return;
    const epoch=offerEpoch;actionPending=true;error='';paint();
    try{await callback();}catch{if(epoch===offerEpoch)error=message;}
    finally{if(epoch===offerEpoch){actionPending=false;paint();}}
  }
  offerForm.onsubmit=async event=>{
    event.preventDefault();
    if(offerPending||actionPending||typeof onOffer!=='function'||game?.phase!=='listening'||!game.bargain||game.bargain.status==='complete'||micState!=='idle')return;
    const amount=Number(offerInput.value);
    if(!offerInput.value.trim()||!Number.isSafeInteger(amount)||amount<1||amount>500){error='Enter a whole-dollar amount from $1 to $500.';paint();return;}
    const epoch=offerEpoch;offerPending=true;error='';paint();
    try{const result=await onOffer(amount);if(epoch===offerEpoch&&result!==false)offerInput.value='';}
    catch{if(epoch===offerEpoch)error='That offer could not be sent. Try again.';}
    finally{if(epoch===offerEpoch){offerPending=false;paint();}}
  };
  function paintBargain(idle){
    const p=game.progress,b=game.bargain;progress.hidden=!p;bargain.hidden=idle||!b;panel.setAttribute('data-bargaining',String(Boolean(b)));
    if(p){
      const amount=percent(p.progress*100),currentLevel=Number.isSafeInteger(p.level)&&p.level>0?p.level:1;
      till.textContent=money(p.cash);profit.textContent=`${p.profit>0?'+':''}${money(p.profit)}`;level.textContent=`Level ${currentLevel}`;totals.setAttribute('aria-label',`Till ${till.textContent} · Profit ${profit.textContent} · ${level.textContent}`);
      levelFill.style.width=`${amount}%`;levelTrack.setAttribute('aria-valuenow',String(Math.round(amount)));levelTrack.setAttribute('aria-label',`Level ${currentLevel} progress`);
      unlock.textContent=p.nextUnlock?`Next: ${p.nextUnlock} at ${money(p.nextTarget)} profit`:'';unlock.hidden=!unlock.textContent;progress.title=unlock.textContent;
    }
    if(b){
      const value=percent(b.receptiveness);meterValue.textContent=value<25?'Reserved':value<50?'Considering':value<75?'Warming up':'Ready';meterMarker.style.left=`${value}%`;meter.setAttribute('aria-valuenow',String(Math.round(value)));meter.setAttribute('aria-valuetext',`${Math.round(value)} of 100, ${meterValue.textContent}`);
      difficulty.textContent={easy:'Easygoing negotiator',balanced:'Steady negotiator',hard:'Tough negotiator'}[b.difficulty]||'Steady negotiator';
      const selling=game.role==='buyer';playerOfferLabel.textContent=selling?'You ask':'You offer';customerOfferLabel.textContent=selling?'They offer':'They ask';playerPrice.textContent=money(b.playerOffer);customerPrice.textContent=money(b.customerOffer);playerOffer.setAttribute('aria-label',`${playerOfferLabel.textContent}: ${playerPrice.textContent}`);customerOffer.setAttribute('aria-label',`${customerOfferLabel.textContent}: ${customerPrice.textContent}`);
      meter.setAttribute('aria-description',`Customer's willingness to ${selling?'buy':'sell'} this item. Left: resistant; right: convinced.`);
      agreement.hidden=!['agreed','complete'].includes(b.status);agreement.textContent=b.status==='complete'?`Deal complete: ${money(b.agreedPrice)}`:`Agreed ${money(b.agreedPrice)} · confirm to complete`;
      feedback.textContent=typeof b.feedback==='string'?b.feedback:'';feedback.hidden=!feedback.textContent;
      offerInput.setAttribute('aria-label',selling?'Your asking price in whole dollars':'Your offer in whole dollars');offerInput.title=selling?'Your asking price':'Your offer';
      itemName.textContent=game.item?.name||'At the counter';itemCondition.textContent=game.item?.condition||'';itemCondition.title=itemCondition.textContent;itemCondition.hidden=!itemCondition.textContent;
    }
    offerForm.hidden=idle||!b||typeof onOffer!=='function'||b.status==='complete';offerInput.disabled=offerButton.disabled=game.phase!=='listening'||offerPending||actionPending||micState!=='idle';
    confirm.hidden=idle||b?.status!=='agreed'||typeof onConfirm!=='function';confirm.disabled=game.phase!=='listening'||offerPending||actionPending;
    next.hidden=idle||b?.status!=='complete'||typeof onNext!=='function';next.disabled=game.phase!=='listening'||offerPending||actionPending;
    const latest=game.undoDeal;undo.hidden=!latest||!['buy','sell'].includes(latest.kind)||typeof onUndo!=='function';undo.disabled=!['idle','listening'].includes(game.phase)||offerPending||actionPending;
    if(latest){const kind=latest.kind==='buy'?'purchase':'sale';undo.textContent=`Undo last ${kind} (${money(latest.price)})`;undo.title=`Undo ${kind}: ${latest.itemName||'item'}`;}
  }
  function finishTyping(){clearInterval(timer);timer=null;resolveTyping?.();resolveTyping=null;}
  function reveal(entry){
    if(entry===lastLine)return;
    finishTyping();lastLine=entry;
    const text=entry?.text||'';line.textContent='';line.setAttribute('aria-label',text);
    if(!text||matchMedia('(prefers-reduced-motion: reduce)').matches){line.textContent=text;return;}
    const letters=Array.from(text);let count=0;
    typingDone=new Promise(resolve=>resolveTyping=resolve);
    timer=setInterval(()=>{count=Math.min(letters.length,count+2);line.textContent=letters.slice(0,count).join('');line.scrollTop=line.scrollHeight;if(count===letters.length)finishTyping();},28);
  }
  function paint(){
    if(!game)return;
    const idle=game.phase==='idle';panel.hidden=!['thinking','listening'].includes(game.phase);title.hidden=!idle;open.disabled=!idle;
    const count=Number.isSafeInteger(game.visitNumber)&&game.visitNumber>0?game.visitNumber:null;visitor.hidden=!count;visitor.textContent=count?`Visitor ${String(count).padStart(2,'0')}`:'';
    visitStatus.hidden=!['arriving','leaving'].includes(game.phase);visitStatus.textContent=game.phase==='leaving'?'See you around.':game.role==='buyer'?'A customer is browsing…':'Someone has a story to sell…';
    paintBargain(idle);
    // A visit can be cancelled while its line is still typing. Resolve that
    // presentation now, and do not restart it during hidden-panel repaints.
    if(panel.hidden){finishTyping();if(idle){lastLine=null;titleHint.textContent=error||'Sound on. Tap Speak to talk, then Send when you’re done. You can also type a price.';}return;}
    name.textContent=game.customer?.name||'';speakerRole.textContent=game.role==='seller'?'Here to sell':'Here to buy';
    reveal(game.lines?.findLast(entry=>entry.speaker==='customer')||null);
    const lastPlayer=game.lines?.findLast(entry=>entry.speaker==='player');
    heard.textContent=draft?`You: ${draft}`:lastPlayer?`You: ${lastPlayer.text}`:'';heard.hidden=!heard.textContent;
    mic.disabled=!idle&&game.phase!=='listening';
    mic.textContent=idle?'Enter shop':micState==='recording'?'Send':['requesting','transcribing'].includes(micState)?'Cancel':'Speak';
    mic.setAttribute('aria-label',idle?'Enter shop and enable character voices':micState==='recording'?'Send your spoken reply':['requesting','transcribing'].includes(micState)?'Cancel microphone input':'Speak to the customer');mic.setAttribute('aria-pressed',String(micState==='recording'));
    hint.textContent=error||(micState==='recording'?'Listening… tap Send when you finish.':micState==='requesting'?'Allow microphone access when your browser asks.':micState==='transcribing'?'Transcribing…':speechState==='speaking'?'Speaking…':game.phase==='thinking'?'Considering your words…':'Talk naturally: ask, haggle, or say “goodbye”. Tap Speak to reply.');
  }
  return {update(value){game=value;if(['arriving','idle'].includes(game.phase)){offerEpoch++;offerPending=false;actionPending=false;offerInput.value='';}if(game.phase==='arriving'){error='';draft='';finishTyping();lastLine=null;line.textContent='';}paint();},setMicState(value){micState=value;if(value==='recording'){error='';draft='';}paint();},setSpeechState(value){speechState=value;paint();},setTranscript(text){draft=text;paint();},setError(text){error=text;paint();},clearTranscript(){draft='';paint();},get typingDone(){return typingDone;},destroy(){offerEpoch++;finishTyping();root.remove();}};
}
