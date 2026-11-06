import test from 'node:test';
import assert from 'node:assert/strict';
import {makeIntentRequest,parseIntentReply} from '../server-intent.js';
const packet=result=>({content:[{type:'text',text:JSON.stringify(result)}],stop_reason:'end_turn'});
const result=(kind,evidence,amount=null)=>({kind,amount,evidence,confidence:.99});
const context={state:{role:'seller',negotiation:{customerOffer:107,playerOffer:80}},item:{name:'Camera'},history:[],text:'Why are you asking $107?'};

test('intent prompt identifies the player side and distinguishes price mentions from proposals',()=>{
  for(const role of ['buyer','seller']){
    const request=makeIntentRequest({...context,state:{...context.state,role}});
    const body=JSON.parse(request.messages[0].content);
    assert.equal(body.playerRole,role==='seller'?'buyer':'seller');assert.equal(body.npcRole,role);
    assert.match(request.system,/ONLY the latest PLAYER message/);
    for(const example of ['Why are you asking $107?','You said $107, that\'s ridiculous.','I cannot pay $107.','I asked for $107, not $80.','I paid $80 last year.','Would you take $80?'])assert.ok(request.system.includes(example));
    assert.equal(body.latestPlayerMessage,context.text);
  }
});

test('intent prompt understands conversational offers and an attached ultimatum while retaining exact evidence',()=>{
  const text="yeah so I'm offering 50 for it that's how much I'll buy otherwise just get out of here hit the road";
  const request=makeIntentRequest({...context,text}),evidence="I'm offering 50 for it";
  assert.ok(request.system.includes(text));assert.match(request.system,/never require a command phrase/);
  assert.match(request.system,/ultimatum attached to a current offer is still an offer/);
  for(const phrase of ['Fifty sounds fair.','How about fifty?','Can we do fifty?','$107 is too much.'])assert.ok(request.system.includes(phrase));
  assert.deepEqual(parseIntentReply(packet(result('offer',evidence,50)),text,context),result('offer',evidence,50));
  const long=`${'I am considering this object. '.repeat(100)}${text}`;
  assert.equal(JSON.parse(makeIntentRequest({...context,text:long}).messages[0].content).latestPlayerMessage,long);
});

test('discussion, questions and ambiguous mentions retain null amounts',()=>{
  for(const [kind,text] of [['question','Why are you asking $107?'],['discussion','You said $107, that is ridiculous.'],['discussion','I cannot pay $107.'],['ambiguous','If I offered $80, would you laugh?'],['discussion','This was made in 1953.']]){
    assert.deepEqual(parseIntentReply(packet(result(kind,text)),text,context),result(kind,text));
  }
});

test('offer amounts must be grounded in exact current evidence, including spoken numbers and corrections',()=>{
  for(const [text,evidence,amount] of [['I offer $80.','offer $80',80],['My asking price is one hundred and seven.','one hundred and seven',107],['I will pay eighty-five.','eighty-five',85],["I won't pay $107, but I can offer $80.",'I can offer $80',80]]){
    assert.deepEqual(parseIntentReply(packet(result('offer',evidence,amount)),text,context),result('offer',evidence,amount));
  }
  assert.equal(parseIntentReply(packet(result('offer','offer $80',81)),'I offer $80.',context),null);
  assert.equal(parseIntentReply(packet(result('offer','eighty',80)),'I offer one hundred eighty.',context),null);
});

test('relative proposals use only an explicit current quote and cannot treat the delta as the offer',()=>{
  for(const [text,amount] of [['I can do five less than your price.',102],['I will offer five more than my last offer.',85],['I will offer the same price.',107]]){
    assert.equal(parseIntentReply(packet(result('offer',text,amount)),text,context).amount,amount);
    assert.equal(parseIntentReply(packet(result('offer',text,amount)),text),null);
  }
  const text='I can do five less than your price.';
  assert.equal(parseIntentReply(packet(result('offer',text,5)),text,context),null);
  assert.equal(parseIntentReply(packet(result('offer','five',5)),text,context),null);
});

test('more reasonable describes a proposed total rather than an invented relative increase',()=>{
  const text='Yeah, so I am actually allergic to gold, so I think $45 would be way more reasonable.';
  const evidence='$45 would be way more reasonable';
  assert.deepEqual(parseIntentReply(packet(result('offer',evidence,45)),text,context),result('offer',evidence,45));
  assert.equal(parseIntentReply(packet(result('offer',evidence,152)),text,context),null);
  for(const evidence of ['$45 seems more sensible','$45 is less painful','$45 would be a little more comfortable']){
    assert.equal(parseIntentReply(packet(result('offer',evidence,45)),evidence,context).amount,45);
  }
});

test('acceptance without a current quoted price becomes ambiguous',()=>{
  const text='Yes, I accept your price.';
  assert.equal(parseIntentReply(packet(result('accept',text)),text,context).kind,'accept');
  assert.equal(parseIntentReply(packet(result('accept',text)),text,{state:{negotiation:{customerOffer:null}}}).kind,'ambiguous');
});

test('malformed fields, forged evidence, unsupported amounts and truncated model output are rejected',()=>{
  const text='I offer $80.',good=result('offer','offer $80',80);
  for(const bad of [{...good,source:'live'},{...good,cash:100},{...good,confidence:2},{...good,confidence:'1'},{...good,kind:'buy'},{...good,evidence:''},{...good,evidence:'Offer $80'},{...good,evidence:'offer $81'},{...good,amount:0},{...good,amount:501},{...good,amount:80.5},{...good,kind:'accept'}])assert.equal(parseIntentReply(packet(bad),text,context),null);
  assert.equal(parseIntentReply({...packet(good),stop_reason:'max_tokens'},text,context),null);
  assert.equal(parseIntentReply({content:[{type:'text',text:'not-json'}]},text,context),null);
});
