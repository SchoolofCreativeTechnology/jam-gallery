import test from 'node:test';
import assert from 'node:assert/strict';
import {createBargain,parseSpokenOffer,applyBargainTurn,validateInterpretedOffer} from '../bargaining.js';
const item={id:'radio',cost:40,details:[{id:'origin',tags:['history']},{id:'function',tags:['function']},{id:'rarity',tags:['rarity']} ]};
const customer=(role='seller',extra={})=>({role,interests:['history','function'],skepticism:.35,personalityId:'nostalgic',...extra});
for(const [text,amount] of [["I'll give you fifty dollars",50],['would you take 40',40],['how about 75',75],['I can sell it for one hundred and twenty',120],['I offer $40',40],['I offer seventy-five dollars',75],['I offer one hundred and twenty',120],['I offer a hundred',100],['I offer five hundred',500],['I offer a hundred and seven',107],['I will pay forty, actually fifty',50],['I offer 45. I mean 50',50],['I offer 50, no, 60',60],['make it twenty one',21]])test(`spoken offer: ${text}`,()=>assert.deepEqual(parseSpokenOffer(text),{kind:'offer',amount}));
for(const text of ['It was made in 1953','The auction sold it for 310 dollars in 2019','There are two cracks',"I won't pay fifty",'I cannot offer 40','not fifty','no deal','I do not accept','That sounds nice','Can it work for fifty years?'])test(`not an offer: ${text}`,()=>assert.deepEqual(parseSpokenOffer(text),{kind:'none'}));
for(const text of ['deal','I accept',"I'll take it",'agreed','Yes, deal!','I accept your price','Yes, we have a deal'])test(`explicit acceptance: ${text}`,()=>assert.deepEqual(parseSpokenOffer(text),{kind:'accept'}));
for(const text of ['I offer 40 or 50','50 to 60','I offer between forty and sixty','I offer 50-60','I offer -40','minus 40','I offer minus 40','I offer negative fifty','I offer forty dollars and ten cents','I offer $40.50','I offer 0','I offer five hundred and one','I offer one thousand','one fifty'])test(`unsafe amount rejected: ${text}`,()=>assert.ok(['invalid','ambiguous'].includes(parseSpokenOffer(text).kind)));

test('bargains expose only public fields and sellers open with an item-based ask',()=>{const seller=createBargain(customer(),item),buyer=createBargain(customer('buyer'),item);assert.ok(seller.customerOffer>item.cost);assert.equal(buyer.customerOffer,null);assert.equal(seller.playerOffer,null);assert.equal(seller.status,'negotiating');assert.equal(seller.lastAction,'opening');assert.ok(seller.usedDetailIds instanceof Set);assert.ok(!Object.keys(seller).includes('_rules'));assert.ok(!JSON.stringify(seller).includes('ceiling'));});
test('personality and skepticism make easy and hard customers materially different',()=>{for(const role of ['buyer','seller']){const easy=createBargain(customer(role,{skepticism:.2,personalityId:'easygoing'}),item),hard=createBargain(customer(role,{skepticism:.6,personalityId:'guarded'}),item);assert.equal(easy.difficulty,'easy');assert.equal(hard.difficulty,'hard');assert.ok(easy.receptiveness>hard.receptiveness);applyBargainTurn(easy,{amount:role==='buyer'?500:1});applyBargainTurn(hard,{amount:role==='buyer'?500:1});assert.ok(role==='buyer'?easy.customerOffer>hard.customerOffer:easy.customerOffer<hard.customerOffer);}});
test('buyer counter rises and seller counter falls after grounded persuasion',()=>{for(const role of ['buyer','seller']){const b=createBargain(customer(role),item);applyBargainTurn(b,{amount:role==='buyer'?500:1});const before=b.customerOffer,gauge=b.receptiveness;applyBargainTurn(b,{text:'The maritime origin is documented.',reading:{relevant:[item.details[0]]}});assert.ok(b.receptiveness>gauge);assert.ok(role==='buyer'?b.customerOffer>before:b.customerOffer<before);assert.equal(b.usedDetailIds.has('origin'),true);}});
test('irrelevant, fabricated, repeated and rephrased facts cannot farm the gauge',()=>{const b=createBargain(customer(),item);const start=b.receptiveness;applyBargainTurn(b,{text:'A rare thing.',reading:{relevant:[item.details[2],{id:'invented',tags:['history']}]}});assert.equal(b.receptiveness,start+7);assert.equal(b.usedDetailIds.size,0);applyBargainTurn(b,{text:'Another supposed rare quality.',reading:{relevant:[{id:'invented',tags:['history']}]}});assert.equal(b.receptiveness,start+7);applyBargainTurn(b,{text:'The maker documented its origin.',reading:{relevant:[item.details[0]]}});const earned=b.receptiveness;applyBargainTurn(b,{text:'Let me repeat the origin a different way.',reading:{relevant:[item.details[0]]}});assert.equal(b.receptiveness,earned);applyBargainTurn(b,{text:'The maker documented its origin.',reading:{relevant:[item.details[0]]}});assert.ok(b.receptiveness<=earned);});
test('honesty helps only once and later bluffs hurt after the first benefit of doubt',()=>{const b=createBargain(customer(),item),start=b.receptiveness;applyBargainTurn(b,{text:'The dial is stuck.',reading:{honest:true}});assert.ok(b.receptiveness>start);const honest=b.receptiveness;applyBargainTurn(b,{text:'I admit the dial does not move.',reading:{honest:true}});assert.equal(b.receptiveness,honest);applyBargainTurn(b,{text:'Guaranteed perfect documented origin.',reading:{bluff:true,relevant:[item.details[0]]}});assert.equal(b.receptiveness,honest+7);applyBargainTurn(b,{text:'Another unsupported guarantee.',reading:{bluff:true}});assert.ok(b.receptiveness<honest);});
test('identical unimproved offers never ratchet the counter',()=>{for(const role of ['buyer','seller']){const b=createBargain(customer(role),item),amount=role==='buyer'?500:1;applyBargainTurn(b,{amount});const counter=b.customerOffer,gauge=b.receptiveness;for(let i=0;i<20;i++)applyBargainTurn(b,{amount});assert.equal(b.customerOffer,counter);assert.equal(b.receptiveness,gauge);assert.equal(b.playerOffer,amount);assert.equal(b.status,'negotiating');}});
test('acceptance requires a real quote and completed settlement freezes the agreed price',()=>{const b=createBargain(customer('buyer'),item);applyBargainTurn(b,{text:'deal'});assert.equal(b.status,'negotiating');assert.equal(b.lastAction,'clarify');applyBargainTurn(b,{amount:500});const quote=b.customerOffer;applyBargainTurn(b,{accept:true});assert.equal(b.agreedPrice,quote);assert.equal(b.status,'agreed');assert.equal(b.lastAction,'accepted');b.status='complete';const before=JSON.stringify(b);applyBargainTurn(b,{amount:1});assert.equal(JSON.stringify(b),before);});
test('both sides accept valid player offers and record the spoken amount immediately',()=>{for(const role of ['buyer','seller']){const b=createBargain(customer(role),item);applyBargainTurn(b,{amount:role==='buyer'?1:500});assert.equal(b.playerOffer,role==='buyer'?1:500);assert.equal(b.agreedPrice,b.playerOffer);assert.equal(b.status,'agreed');assert.equal(b.lastAction,'accepted');}});
test('invalid and ambiguous money cannot alter persuasion or execute agreement',()=>{for(const turn of [{amount:-1},{amount:501},{amount:NaN},{text:'50 or 60'},{amount:50,accept:true}]){const b=createBargain(customer(),item),gauge=b.receptiveness,quote=b.customerOffer;applyBargainTurn(b,{...turn,reading:{relevant:[item.details[0]]}});assert.equal(b.receptiveness,gauge);assert.equal(b.customerOffer,quote);assert.equal(b.playerOffer,null);assert.equal(b.agreedPrice,null);assert.ok(['invalid','clarify'].includes(b.lastAction));}});
test('quoted prices remain honored after later bad persuasion',()=>{for(const role of ['buyer','seller']){const b=createBargain(customer(role),item);applyBargainTurn(b,{amount:role==='buyer'?500:1});applyBargainTurn(b,{text:'Trust me, priceless.',reading:{bluff:true}});const quote=b.customerOffer;applyBargainTurn(b,{text:'And it is completely magical.',reading:{bluff:true}});assert.equal(b.customerOffer,quote);applyBargainTurn(b,{text:'I accept'});assert.equal(b.agreedPrice,quote);}});
test('published baseValue and value take precedence over acquisition cost',()=>{const a=createBargain(customer(),{...item,baseValue:200}),b=createBargain(customer(),{...item,value:200});assert.equal(a.customerOffer,b.customerOffer);assert.ok(a.customerOffer>createBargain(customer(),item).customerOffer);});
test('offer-shaped requests about time, damage and percentages are never money',()=>{for(const text of ['Would you take forty seconds to inspect it?','I can give you twenty years of history','I offer fifty percent','I will take two pieces'])assert.equal(parseSpokenOffer(text).kind,'none');});
test('price bounds and unicode negative amounts cannot become exact positive offers',()=>{for(const text of ['I will pay under fifty','I offer up to 50','I would pay at most 40'])assert.equal(parseSpokenOffer(text).kind,'ambiguous');assert.equal(parseSpokenOffer('I offer −50').kind,'invalid');assert.deepEqual(parseSpokenOffer("I'd give you fifty"),{kind:'offer',amount:50});});
test('questions cannot persuade or consume evidence needed by a later actual pitch',()=>{const b=createBargain(customer(),item),start=b.receptiveness;applyBargainTurn(b,{text:'The origin is documented?',reading:{question:true,honest:true,relevant:[item.details[0]]}});assert.equal(b.receptiveness,start);assert.equal(b.usedDetailIds.size,0);applyBargainTurn(b,{text:'The origin is documented.',reading:{relevant:[item.details[0]]}});assert.ok(b.receptiveness>start);assert.ok(b.usedDetailIds.has('origin'));});
test('bluffing does not consume the opportunity to later supply truthful evidence',()=>{const b=createBargain(customer(),item);applyBargainTurn(b,{text:'Guaranteed origin.',reading:{bluff:true,relevant:[item.details[0]]}});const lower=b.receptiveness;assert.equal(b.usedDetailIds.size,0);applyBargainTurn(b,{text:'Here is the documented origin.',reading:{relevant:[item.details[0]]}});assert.ok(b.receptiveness>lower);assert.ok(b.usedDetailIds.has('origin'));});
test('denying condition cannot earn either honesty or evidence credit',()=>{const b=createBargain(customer(),item),start=b.receptiveness;applyBargainTurn(b,{text:'There is no damage.',reading:{honest:true,deniesCondition:true,relevant:[item.details[0]]}});assert.equal(b.receptiveness,start);assert.equal(b.usedDetailIds.size,0);applyBargainTurn(b,{text:'The case really is cracked.',reading:{honest:true}});assert.ok(b.receptiveness>start);});
test('extreme offers hurt once per unique price and repeat attempts cannot ratchet',()=>{for(const role of ['buyer','seller']){const b=createBargain(customer(role),item),first=role==='buyer'?500:1,second=role==='buyer'?499:2,start=b.receptiveness;applyBargainTurn(b,{amount:first});assert.ok(b.receptiveness<start);const hurt=b.receptiveness,quote=b.customerOffer;applyBargainTurn(b,{amount:first});assert.equal(b.receptiveness,hurt);assert.equal(b.customerOffer,quote);applyBargainTurn(b,{amount:second});assert.ok(b.receptiveness<hurt);}});
test('accepting a quoted or directly acceptable price visibly completes the receptiveness gauge',()=>{const b=createBargain(customer(),item);applyBargainTurn(b,{accept:true});assert.ok(b.receptiveness>=75);const buyer=createBargain(customer('buyer'),item);applyBargainTurn(buyer,{amount:1});assert.ok(buyer.receptiveness>=75);});
test('natural spoken selling prices are actionable offers',()=>{for(const [text,amount] of [['My asking price is $500.',500],['I want fifty for it',50],["I'm looking for $75",75],["I'll let it go for $80",80],['You can have it for $90',90],['I am asking $60',60],['I ask seventy dollars',70]])assert.deepEqual(parseSpokenOffer(text),{kind:'offer',amount},text);});
test('negated natural selling phrases never submit the unwanted price',()=>{for(const text of ["My asking price isn't $500.",'My asking price is no longer $500.',"I don't want fifty for it","I'm not looking for $75","I won't let it go for $80",'You cannot have it for $90','I am not asking $60',"I don't ask seventy dollars"])assert.equal(parseSpokenOffer(text).kind,'none',text);});
test('elliptical prices and amount-plus-deal are new proposals, never acceptance of an old quote',()=>{for(const [text,amount] of [['fifty dollars for it',50],['$75 for the item',75],['fifty dollars, deal?',50],['75 for it, deal?',75]])assert.deepEqual(parseSpokenOffer(text),{kind:'offer',amount},text);assert.equal(parseSpokenOffer('$50 in 1979').kind,'none');});
const priceComplaint="$107 is a little much. I am not even a photographer and I don't think anybody would buy this. Why should I buy this camera?";
const correctedOffer="No, I don't wanna. No, a hundred and seven isn't how much I'm wanting. That's way too much. I'd say I'd buy it for 80 bucks.";
test('a quoted price and a later buying question never bind into an offer',()=>{
  for(const text of [priceComplaint,'$107 is too much. Why would I pay that?','The price is 107 dollars. I buy cameras.','Why should I buy this for $107?','You said "I offer $107."','I would not buy this for $107.','I paid $107 last year.'])assert.equal(parseSpokenOffer(text).kind,'none',text);
});
test('the actual final offer survives unrelated disputed and historical prices',()=>{
  assert.deepEqual(parseSpokenOffer(correctedOffer),{kind:'offer',amount:80});
  assert.deepEqual(parseSpokenOffer('You asked $107. I will give you $80.'),{kind:'offer',amount:80});
  assert.deepEqual(parseSpokenOffer('I paid $50 in 1979. My asking price is $80.'),{kind:'offer',amount:80});
});
test('price echoes and price questions require clarification without executing a purchase',()=>{
  for(const text of ['107','107?','$107? Why would I pay that?','seventy-five dollars','a hundred','I offer $80?','Deal?']){
    assert.ok(!['offer','accept'].includes(parseSpokenOffer(text).kind),text);
    const b=createBargain(customer(),item);applyBargainTurn(b,{text});
    assert.equal(b.playerOffer,null,text);assert.equal(b.agreedPrice,null,text);assert.equal(b.status,'negotiating',text);
  }
  for(const text of ['Would you take $80?','How about $80?'])assert.deepEqual(parseSpokenOffer(text),{kind:'offer',amount:80},text);
});
test('model action validation cannot promote a complaint, chopped negation, question or invented evidence',()=>{
  const intent=(evidence,amount=107)=>({kind:'offer',amount,evidence,confidence:.99});
  assert.equal(validateInterpretedOffer(priceComplaint,intent('$107')),false);
  assert.equal(validateInterpretedOffer("I wouldn't offer $107.",intent('$107')),false);
  assert.equal(validateInterpretedOffer('Why should I buy it for $107?',intent('$107')),false);
  assert.equal(validateInterpretedOffer('$107?',intent('$107')),false);
  assert.equal(validateInterpretedOffer('I will give you $80.',intent('I will give you $107.')),false);
  assert.equal(validateInterpretedOffer(correctedOffer,intent("I'd say I'd buy it for 80 bucks.",80)),true);
  assert.equal(validateInterpretedOffer(correctedOffer,intent('a hundred and seven',107)),false);
  assert.equal(validateInterpretedOffer('I will give you $80.',intent('$80',81)),false);
  assert.equal(validateInterpretedOffer('I offer 80.',intent('80',80)),false);
  assert.equal(validateInterpretedOffer('107',intent('107')),false);
});
test('model acceptance validation requires explicit whole-utterance agreement',()=>{
  const intent={kind:'accept',amount:null,evidence:'deal',confidence:.99};
  assert.equal(validateInterpretedOffer('deal',intent),true);
  for(const text of ['No deal','Is that a deal?','I said deal before, but now I disagree','I offer $80, deal?'])assert.equal(validateInterpretedOffer(text,intent),false,text);
});

test('conversational proposals accept fillers, contractions and natural price phrasing without command words',()=>{
  const screenshot="yeah so I'm offering 50 for it that's how much I'll buy otherwise just get out of here hit the road";
  for(const text of [screenshot,"I'm offering fifty for it",'how about 50','fifty sounds fair','I think fifty works for me','Can we do fifty?','Could we make it fifty?','I was thinking fifty','My best is fifty',"Let's settle on fifty", "I'll give you fifty, otherwise goodbye."]){
    assert.deepEqual(parseSpokenOffer(text),{kind:'offer',amount:50},text);
    assert.equal(validateInterpretedOffer(text,{kind:'offer',amount:50,evidence:text,confidence:.9}),true,text);
  }
  assert.equal(validateInterpretedOffer(screenshot,{kind:'offer',amount:50,evidence:"I'm offering 50 for it",confidence:.9}),true);
});

test('natural price language still excludes complaints, historical quotes and withdrawn offers',()=>{
  for(const text of ['$107 is too much','you said fifty sounds fair','fifty sounds fair if it worked',"Fifty sounds fair, but I won't pay it.","Fifty sounds fair, but I won't pay fifty.","I think fifty works for me. Actually, no.",'Fifty sounds fair, but that is not an offer.','Can we do fifty years of warranty?']){
    assert.notEqual(parseSpokenOffer(text).kind,'offer',text);
    assert.equal(validateInterpretedOffer(text,{kind:'offer',amount:text.includes('107')?107:50,evidence:text,confidence:.99}),false,text);
  }
  assert.deepEqual(parseSpokenOffer("Fifty sounds fair, but I won't pay it. I can do forty."),{kind:'offer',amount:40});
});

test('grounded AI meaning accepts indirect suggestions without requiring a locally recognized command phrase',()=>{
  const cases=[
    ['Yeah, so I am actually allergic to gold, so I think $45 would be way more reasonable.','$45 would be way more reasonable'],
    ['Considering the wear, $45 would fit what I can spend.','$45 would fit what I can spend'],
    ['With that scratch in mind, I am leaning toward forty-five.','I am leaning toward forty-five'],
    ['For something I would have to repair, forty-five feels like a better place to land.','forty-five feels like a better place to land'],
  ];
  for(const [text,evidence] of cases){
    const intent={kind:'offer',amount:45,evidence,confidence:.95};
    assert.equal(validateInterpretedOffer(text,intent),true,text);
    assert.equal(validateInterpretedOffer(text,{...intent,amount:46}),false,text);
    assert.equal(validateInterpretedOffer(text,{...intent,confidence:.79}),false,text);
  }
});

test('semantic fallback cannot promote uncertain, quoted, negated, hypothetical or withdrawn monetary statements',()=>{
  for(const [text,evidence] of [
    ['$107 is too much.','$107 is too much'],
    ['You said $45 would be more reasonable.','$45 would be more reasonable'],
    ['I do not think $45 would be reasonable.','$45 would be reasonable'],
    ['If it worked, $45 would be more reasonable.','$45 would be more reasonable'],
    ['Would $45 be more reasonable?','$45 be more reasonable'],
    ['$45 would be reasonable as an example.','$45 would be reasonable'],
    ['$45 would be reasonable. Actually, no.','$45 would be reasonable'],
    ['$45 would fit my plans. I will not pay it.','$45 would fit my plans'],
    ['It was used for forty-five years.','forty-five years'],
    ['$45 or $50 would be reasonable.','$45'],
  ])assert.equal(validateInterpretedOffer(text,{kind:'offer',amount:text.includes('107')?107:45,evidence,confidence:.99}),false,text);
});
test('discussion-only scoring never reinterprets text or supplied prices into a trade',()=>{
  for(const turn of [{text:'I offer $1',amount:1},{text:'deal',accept:true}]){
    const b=createBargain(customer('buyer'),item);applyBargainTurn(b,{amount:500});const quote=b.customerOffer,gauge=b.receptiveness;
    applyBargainTurn(b,{...turn,discussionOnly:true,reading:{relevant:[item.details[0]]}});
    assert.equal(b.status,'negotiating');assert.equal(b.agreedPrice,null);assert.equal(b.playerOffer,500);assert.ok(b.receptiveness>gauge);assert.ok(b.customerOffer>=quote);
  }
});
test('an explicit corrected offer reopens only an unsettled agreement',()=>{
  const b=createBargain(customer(),item);applyBargainTurn(b,{accept:true});const price=b.agreedPrice;
  applyBargainTurn(b,{text:'Actually, I offer $1.'});assert.equal(b.status,'negotiating');assert.equal(b.agreedPrice,null);assert.equal(b.playerOffer,1);
  applyBargainTurn(b,{accept:true});const before=JSON.stringify(b);applyBargainTurn(b,{text:'I am thinking about it.',discussionOnly:true});assert.equal(JSON.stringify(b),before);
  b.status='complete';applyBargainTurn(b,{amount:price+1});assert.equal(b.status,'complete');
});
test('fairer proposals improve receptiveness with a bounded nonfarmable reward',()=>{
  for(const role of ['buyer','seller']){
    const b=createBargain(customer(role),item),gauge=b.receptiveness,amount=role==='seller'?Math.floor(b.customerOffer*.7):Math.ceil(b._rules.ceiling*1.3);
    applyBargainTurn(b,{amount});assert.equal(b.status,'negotiating');assert.ok(b.receptiveness>gauge);const earned=b.receptiveness;
    for(let i=0;i<10;i++)applyBargainTurn(b,{amount});assert.equal(b.receptiveness,earned);
  }
});
test('direct insults lower receptiveness without consuming useful evidence',()=>{
  const b=createBargain(customer(),item),gauge=b.receptiveness;applyBargainTurn(b,{text:'You are an idiot.',discussionOnly:true,reading:{relevant:[item.details[0]]}});
  assert.ok(b.receptiveness<gauge);assert.equal(b.usedDetailIds.size,0);
});
test('hypothetical, reported, elsewhere and withdrawn offers never commit money',()=>{
  for(const text of ['I offer $80 as an example','I would buy it for $80 if it worked','I can buy it for $80 somewhere else','I offer $80, which is what you said','I offer $80, but never mind','I offer $80. No, forget it.','I offer $80, actually no',"I wouldn't pay, actually $80"]){
    assert.ok(!['offer','accept'].includes(parseSpokenOffer(text).kind),text);
    assert.equal(validateInterpretedOffer(text,{kind:'offer',amount:80,evidence:text,confidence:.99}),false,text);
  }
  assert.deepEqual(parseSpokenOffer('Never mind. I offer $70.'),{kind:'offer',amount:70});
});
test('a complete short correction can revise an existing player offer only',()=>{
  const text='No, I mean $80.',intent={kind:'offer',amount:80,evidence:text,confidence:.99};
  assert.equal(validateInterpretedOffer(text,intent,{playerOffer:107}),true);
  assert.equal(parseSpokenOffer(text).kind,'ambiguous');
  for(const playerOffer of [undefined,null,0,501,NaN,'107'])assert.equal(validateInterpretedOffer(text,intent,{playerOffer}),false);
  assert.equal(validateInterpretedOffer(text,intent),false);
  assert.equal(validateInterpretedOffer(text,{...intent,evidence:'$80'},{playerOffer:107}),false);
  assert.equal(validateInterpretedOffer(text,{...intent,amount:81},{playerOffer:107}),false);
  for(const bad of ['$80','No, I mean $80?','No, I mean not $80.','No, I mean $80 or $90.','No, I mean $80 is too much.','You said no, I mean $80.','No, I mean -80.','No, I mean $80.50.'])assert.equal(validateInterpretedOffer(bad,{...intent,evidence:bad},{playerOffer:107}),false,bad);
  const words='I mean eighty dollars.';assert.equal(validateInterpretedOffer(words,{...intent,evidence:words},{playerOffer:107}),true);
});
test('a seller never discounts the opening quote in response to repeated insulting lowballs',()=>{
  const b=createBargain(customer('seller',{skepticism:.1,personalityId:'easygoing'}),{...item,baseValue:96}),opening=b.customerOffer,gauge=b.receptiveness;
  assert.equal(opening,82);
  applyBargainTurn(b,{amount:1});assert.equal(b.receptiveness,gauge-8);assert.equal(b.customerOffer,opening);assert.equal(b.status,'negotiating');
  const hurt=b.receptiveness;for(let i=0;i<10;i++)applyBargainTurn(b,{amount:1});
  assert.equal(b.receptiveness,hurt);assert.equal(b.customerOffer,opening);assert.match(b.feedback,/unreasonable/);
  applyBargainTurn(b,{accept:true});assert.equal(b.agreedPrice,opening);
});
test('a buyer never raises an existing quote in response to repeated extreme overcharges',()=>{
  const b=createBargain(customer('buyer'),item);applyBargainTurn(b,{amount:Math.ceil(b._rules.ceiling*1.3)});
  const quote=b.customerOffer,gauge=b.receptiveness;assert.equal(b.status,'negotiating');
  applyBargainTurn(b,{amount:500});assert.ok(b.receptiveness<gauge);assert.equal(b.customerOffer,quote);
  const hurt=b.receptiveness;for(let i=0;i<10;i++)applyBargainTurn(b,{amount:500});
  assert.equal(b.receptiveness,hurt);assert.equal(b.customerOffer,quote);assert.match(b.feedback,/unreasonable/);
  applyBargainTurn(b,{accept:true});assert.equal(b.agreedPrice,quote);
});
test('even hard customers indulge one playful bluff, then recover strongly through evidence and honesty',()=>{
  for(const role of ['buyer','seller']){
    const b=createBargain(customer(role,{skepticism:.65,personalityId:'guarded'}),item),original=JSON.stringify(item);
    assert.equal(b.difficulty,'hard');assert.equal(b.receptiveness,28);
    applyBargainTurn(b,{text:'This radio probably attracts friendly ghosts.',reading:{bluff:true,relevant:[item.details[0]]}});
    assert.equal(b.receptiveness,34);assert.equal(b.usedDetailIds.size,0);assert.equal(b._rules.gullibilityUsed,true);assert.match(b.feedback,/unproven/);
    assert.equal(JSON.stringify(item),original);assert.ok(!JSON.stringify(b).includes('gullibilityUsed'));assert.equal(b.agreedPrice,null);
    applyBargainTurn(b,{text:'It can also tell the future.',reading:{bluff:true}});assert.equal(b.receptiveness,22);
    applyBargainTurn(b,{text:'Here is its documented maritime origin.',reading:{relevant:[item.details[0]]}});assert.equal(b.receptiveness,38);
    applyBargainTurn(b,{text:'The dial really is stuck.',reading:{honest:true}});assert.equal(b.receptiveness,48);
    assert.equal(b.status,'negotiating');assert.equal(b.agreedPrice,null);
  }
});
test('the one-time benefit of doubt cannot be farmed with repeated or new unsupported stories',()=>{
  for(const role of ['buyer','seller']){
    const b=createBargain(customer(role),item);applyBargainTurn(b,{text:'There is something special about this.'});assert.equal(b.receptiveness,43);
    applyBargainTurn(b,{text:'There is something special about this.'});assert.equal(b.receptiveness,41);
    applyBargainTurn(b,{text:'Another interesting but unsupported story.'});assert.equal(b.receptiveness,41);
    applyBargainTurn(b,{text:'Guaranteed magical powers.',reading:{bluff:true}});assert.equal(b.receptiveness,31);
    applyBargainTurn(b,{text:'Guaranteed magical powers.',reading:{bluff:true}});assert.equal(b.receptiveness,21);
  }
});
test('questions, known-condition denial, insults and previously repeated pitches cannot earn indulgence',()=>{
  for(const turn of [
    {text:'Does it have magical powers?',reading:{question:true,bluff:true}},
    {text:'There is no damage.',reading:{deniesCondition:true,bluff:true,honest:true,relevant:[item.details[0]]}},
    {text:'You are an idiot.',reading:{bluff:true}},
    {text:'That same dubious story.',reading:{repeated:true,bluff:true}},
  ]){
    const b=createBargain(customer('seller',{skepticism:.65,personalityId:'guarded'}),item),start=b.receptiveness;
    applyBargainTurn(b,turn);assert.ok(b.receptiveness<=start);assert.equal(b._rules.gullibilityUsed,false);assert.equal(b.usedDetailIds.size,0);
    applyBargainTurn(b,{text:'A fresh playful legend.',reading:{bluff:true}});assert.equal(b._rules.gullibilityUsed,true);
  }
});
test('completed trades freeze both the new benefit of doubt and persuasion tuning',()=>{
  const b=createBargain(customer(),item);applyBargainTurn(b,{accept:true});b.status='complete';const before=JSON.stringify(b);
  applyBargainTurn(b,{text:'A wild story.',reading:{bluff:true}});assert.equal(JSON.stringify(b),before);assert.equal(b._rules.gullibilityUsed,false);
});
