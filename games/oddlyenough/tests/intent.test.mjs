import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createIntentClient} from '../intent.js';
import {MAX_HISTORY,MAX_PITCH_LENGTH} from '../tuning.js';

const context={text:'I can offer you $45 for it.',customer:{id:'hollis',personalityId:'guarded',role:'buyer'},item:{id:'amber-radio'},turn:2,
  history:[{role:'assistant',content:'I could offer $40.'}],state:{role:'buyer',turn:2,negotiation:{difficulty:'hard',receptiveness:30,playerOffer:50,customerOffer:40,agreedPrice:null,status:'negotiating',lastAction:'counter',feedback:'They offer $40.'}}};
const offer={kind:'offer',amount:45,evidence:'offer you $45',confidence:0.98};
const fromPayload=payload=>createIntentClient({endpoint:'/api/interpret',fetchImpl:async()=>({ok:true,json:async()=>payload})});
const isSafe=result=>{assert.equal(result.kind,'ambiguous');assert.equal(result.amount,null);assert.equal(result.source,'fallback');};

test('valid live offer is returned only after exact latest-message evidence and confidence validation',async()=>{
  assert.deepEqual(await fromPayload(offer)(context),{...offer,source:'live'});
});

test('request contains latest text, canonical IDs, bounded history and current public negotiation only',async()=>{
  let sent;
  const client=createIntentClient({endpoint:'/api/interpret',fetchImpl:async(url,options)=>{sent={url,options};return {ok:true,json:async()=>offer};}});
  const input={...context,history:Array.from({length:30},(_,i)=>({role:i%2?'user':'assistant',content:`Line ${i}`,secret:'omitted'})),state:{...context.state,cash:999,negotiation:{...context.state.negotiation,_rules:{floor:1}}}};
  await client(input);const body=JSON.parse(sent.options.body);
  assert.equal(sent.url,'/api/interpret');assert.equal(sent.options.method,'POST');assert.equal(sent.options.headers['Content-Type'],'application/json');assert.ok(sent.options.signal instanceof AbortSignal);
  assert.equal(body.text,context.text);assert.equal(body.customer,'hollis');assert.equal(body.item,'amber-radio');assert.equal(body.personalityId,'guarded');assert.equal(body.prototype,true);assert.equal(body.event,'reply');
  assert.equal(body.history.length,MAX_HISTORY);assert.equal(body.history[0].secret,undefined);assert.equal(body.state.cash,undefined);assert.equal(body.state.negotiation._rules,undefined);assert.equal(body.state.negotiation.customerOffer,40);
});

test('offers below 0.8 and acceptance below 0.9 become ambiguous without a usable amount',async()=>{
  for(const kind of ['offer','accept']){
    const input=kind==='accept'?{...context,text:'Deal.'}:context;
    const confidence=kind==='offer'?0.79:0.89;
    const result=await fromPayload({kind,amount:kind==='offer'?45:null,evidence:kind==='offer'?'$45':'Deal',confidence})(input);
    assert.equal(result.kind,'ambiguous');assert.equal(result.amount,null);assert.equal(result.source,'live');assert.equal(result.confidence,confidence);
  }
  assert.equal((await fromPayload({...offer,confidence:0.8})(context)).kind,'offer');
  assert.equal((await fromPayload({kind:'accept',amount:null,evidence:'Deal',confidence:0.9})({...context,text:'Deal'})).kind,'accept');
});

test('grounded corrected offer with 0.82 confidence remains available for separate confirmation',async()=>{
  const text="I was thinking 100, but I'd buy it for 80 bucks.",payload={kind:'offer',amount:80,evidence:"I'd buy it for 80 bucks",confidence:0.82};
  assert.deepEqual(await fromPayload(payload)({...context,text}),{...payload,source:'live'});
  isSafe(await fromPayload({...payload,evidence:'I would buy it for 80 bucks'})({...context,text}));
});

test('validated acceptance carries no replacement price and nonfinancial kinds retain their classification',async()=>{
  for(const kind of ['accept','decline','question','discussion','ambiguous']){
    const payload={kind,amount:null,evidence:'Deal',confidence:0.95};
    assert.deepEqual(await fromPayload(payload)({...context,text:'Deal'}),{...payload,source:'live'});
  }
  isSafe(await fromPayload({kind:'accept',amount:500,evidence:'Deal',confidence:1})({...context,text:'Deal'}));
});

test('malformed kinds, prices, confidence, extra fields and wrong types fail closed',async()=>{
  const payloads=[null,[],{},'offer',{...offer,kind:'transfer'},{...offer,amount:null},{...offer,amount:0},{...offer,amount:501},{...offer,amount:1.5},{...offer,amount:'45'},
    {...offer,confidence:'0.99'},{...offer,confidence:NaN},{...offer,confidence:Infinity},{...offer,confidence:-1},{...offer,confidence:1.01},
    {...offer,cash:999999},{...offer,source:'live'},{kind:'offer',amount:45,evidence:'$45'}];
  for(const payload of payloads)isSafe(await fromPayload(payload)(context));
});

test('evidence must occur exactly in the latest message, never merely in earlier dialogue',async()=>{
  for(const evidence of ['', '   ', 'I offer $45', 'offer you $40', 'Offer you $45', 'x'.repeat(221)])isSafe(await fromPayload({...offer,evidence})(context));
  isSafe(await fromPayload({...offer,evidence:'I could offer $40.'})(context));
});

test('unconfigured endpoint, invalid input and an already-cancelled signal issue no request',async()=>{
  let calls=0;const fetchImpl=()=>{calls++;throw Error('Must not request');};
  isSafe(await createIntentClient({fetchImpl})(context));
  const client=createIntentClient({endpoint:'/api/interpret',fetchImpl}),controller=new AbortController();controller.abort();
  isSafe(await client(context,{signal:controller.signal}));
  for(const text of [null,undefined,'','   ',5,'x'.repeat(MAX_PITCH_LENGTH+1)])isSafe(await client({...context,text}));
  assert.equal(calls,0);
});

test('long natural speech and prior user turns retain their full text through intent transport',async()=>{
  const phrase="I'm offering 50 for it",text=`${'Let me think about the condition. '.repeat(35)}${phrase}`;
  assert.ok(text.length>500&&text.length<=MAX_PITCH_LENGTH);let body;
  const payload={kind:'offer',amount:50,evidence:phrase,confidence:.9};
  const client=createIntentClient({endpoint:'/api/interpret',fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>payload};}});
  assert.deepEqual(await client({...context,text,history:[{role:'user',content:text}]}),{...payload,source:'live'});
  assert.equal(body.text,text);assert.equal(body.history[0].content,text);
});

test('network, server and invalid JSON failures cannot fall back into an executable parsed offer',async()=>{
  for(const fetchImpl of [async()=>{throw Error('offline');},async()=>({ok:false}),async()=>({ok:true,json:async()=>{throw Error('invalid json');}})]){
    isSafe(await createIntentClient({endpoint:'/api/interpret',fetchImpl})(context));
  }
});

test('timeout races a fetch that ignores abort and a JSON body that never resolves',async()=>{
  for(const fetchImpl of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){
    let requestSignal;const client=createIntentClient({endpoint:'/api/interpret',timeout:5,fetchImpl:(url,options)=>{requestSignal=options.signal;return fetchImpl(url,options);}});
    isSafe(await client(context));assert.equal(requestSignal.aborted,true);
  }
});

test('external cancellation returns safely without waiting and ignores a later valid response',async()=>{
  let resolve,started;const beginning=new Promise(r=>{started=r;});
  const client=createIntentClient({endpoint:'/api/interpret',fetchImpl:()=>{started();return new Promise(r=>{resolve=r;});}}),controller=new AbortController();
  const pending=client(context,{signal:controller.signal});await beginning;controller.abort();const result=await pending;isSafe(result);
  resolve({ok:true,json:async()=>offer});await Promise.resolve();isSafe(result);
});

test('cancelling between call and fetch microtask prevents even the outbound request',async()=>{
  let calls=0;const controller=new AbortController(),client=createIntentClient({endpoint:'/api/interpret',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>offer};}});
  const pending=client(context,{signal:controller.signal});controller.abort();isSafe(await pending);assert.equal(calls,0);
});

test('independent calls do not reuse earlier evidence or intents',async()=>{
  let calls=0;const client=createIntentClient({endpoint:'/api/interpret',fetchImpl:async()=>({ok:true,json:async()=>{calls++;return offer;}})});
  assert.equal((await client(context)).kind,'offer');isSafe(await client({...context,text:'Tell me about its age.'}));assert.equal(calls,2);
});
