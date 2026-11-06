import test from 'node:test';
import assert from 'node:assert/strict';
import {createShop,shopProgress,unlockedItems,createProgressStore,undoLastTransaction} from '../progress.js';
import {buy,sell} from '../state.js';
import {ITEMS} from '../items.js';

const catalog=Object.values(ITEMS).sort((a,b)=>a.cost-b.cost);
const snapshot=state=>({cash:state.cash,seed:state.personalitySeed,inventory:state.inventory.map(({id,acquisitionPrice})=>({id,acquisitionPrice})),deals:[...state.closedDeals],log:state.log});
function storage(){let raw=null;return {getItem:()=>raw,setItem:(_,value)=>{raw=value;},get raw(){return raw;},put:value=>{raw=typeof value==='string'?value:JSON.stringify(value);}};}
const thin=state=>state.log.map(({kind,itemId,price,dealId})=>({kind,itemId,price,dealId}));
const saved=(transactions,seed=123)=>({version:1,seed,transactions});

test('new shop has canonical starter acquisition prices and four accessible catalog items',()=>{
  const state=createShop(123);
  assert.equal(state.personalitySeed,123);
  assert.deepEqual(state.inventory.map(({id,acquisitionPrice})=>({id,acquisitionPrice})),catalog.slice(0,3).map(item=>({id:item.id,acquisitionPrice:item.cost})));
  assert.deepEqual(unlockedItems(state).map(item=>item.id),catalog.slice(0,4).map(item=>item.id));
  assert.deepEqual(shopProgress(state),{cash:120,profit:0,level:1,nextTarget:75,progress:0,deals:0,nextUnlock:catalog[4].name});
});

test('buying is not profit and resale uses the actual acquisition price',()=>{
  const state=createShop(123),item=catalog[3];
  assert.equal(buy(state,item.id,20,'purchase').ok,true);
  assert.equal(shopProgress(state).profit,0);assert.equal(shopProgress(state).cash,100);
  assert.equal(sell(state,item.id,50,'resale').ok,true);
  assert.equal(shopProgress(state).profit,30);assert.equal(shopProgress(state).cash,150);
  assert.equal(shopProgress(state).deals,2);
});

test('realized profits retain the legacy unlock order and reveal the expanded catalog progressively',()=>{
  const state=createShop(123);
  sell(state,catalog[0].id,catalog[0].cost+74,'first');
  assert.equal(shopProgress(state).level,1);assert.equal(unlockedItems(state).length,4);
  sell(state,catalog[1].id,catalog[1].cost+1,'second');
  assert.equal(shopProgress(state).profit,75);assert.equal(shopProgress(state).level,2);
  assert.deepEqual(unlockedItems(state).map(item=>item.id),catalog.slice(0,5).map(item=>item.id));
  sell(state,catalog[2].id,catalog[2].cost+125,'third');
  assert.equal(shopProgress(state).profit,200);assert.equal(shopProgress(state).level,3);
  assert.deepEqual(unlockedItems(state).map(item=>item.id),catalog.slice(0,6).map(item=>item.id));
  assert.equal(shopProgress(state).nextUnlock,catalog[6].name);
  let cycle=0;
  while(shopProgress(state).level<7){
    assert.equal(buy(state,catalog[0].id,1,`catalog-buy-${cycle}`).ok,true);
    assert.equal(sell(state,catalog[0].id,500,`catalog-sell-${cycle++}`).ok,true);
  }
  assert.deepEqual(unlockedItems(state).map(item=>item.id),catalog.map(item=>item.id));
  assert.equal(shopProgress(state).nextUnlock,null);
});

test('losses are counted and forged profit fields cannot grant levels',()=>{
  const state=createShop(123);sell(state,catalog[0].id,1,'loss');
  assert.equal(shopProgress(state).profit,1-catalog[0].cost);assert.equal(shopProgress(state).progress,0);
  state.log[0].profit=Infinity;
  assert.equal(shopProgress(state).profit,1-catalog[0].cost);assert.equal(shopProgress(state).level,1);
  state.log[0].price=Infinity;
  assert.equal(shopProgress(state).level,1);assert.equal(shopProgress(state).profit,0);
});

test('save/load replays money, ownership, seed, profit and duplicate guards exactly',()=>{
  const memory=storage(),store=createProgressStore({storage:memory}),state=createShop(123);
  buy(state,catalog[3].id,20,'buy-camera');sell(state,catalog[3].id,70,'sell-camera');
  sell(state,catalog[0].id,catalog[0].cost+25,'sell-duck');
  buy(state,catalog[4].id,40,'buy-unlocked');
  assert.equal(store.save(state),true);
  assert.deepEqual(JSON.parse(memory.raw),saved(thin(state)));
  const restored=store.load();assert.deepEqual(snapshot(restored),snapshot(state));
  assert.deepEqual(shopProgress(restored),shopProgress(state));
  assert.equal(buy(restored,catalog[3].id,20,'buy-camera').reason,'duplicate');
});

test('replay rejects unowned sales, duplicate deals, unaffordable buys and locked stock',()=>{
  const memory=storage(),store=createProgressStore({storage:memory});
  for(const transactions of [
    [{kind:'sell',itemId:catalog[3].id,price:500,dealId:'free-money'}],
    [{kind:'buy',itemId:catalog[3].id,price:121,dealId:'overdraw'}],
    [{kind:'buy',itemId:catalog[4].id,price:1,dealId:'locked'}],
    [{kind:'buy',itemId:catalog[3].id,price:20,dealId:'same'},{kind:'sell',itemId:catalog[3].id,price:40,dealId:'same'}],
    [{kind:'sell',itemId:catalog[0].id,price:50,dealId:'first'},{kind:'sell',itemId:catalog[0].id,price:50,dealId:'again'}],
    [{kind:'buy',itemId:'__proto__',price:1,dealId:'phantom'}],
  ]){memory.put(saved(transactions));assert.equal(store.load(),null);}
});

test('save refuses inconsistent cash, ownership, acquisition prices, duplicate guards or profits',()=>{
  const memory=storage(),store=createProgressStore({storage:memory});assert.equal(store.save(createShop(123)),true);const original=memory.raw;
  const mutations=[
    state=>{state.cash+=100;},state=>{state.inventory.push({...catalog[5],acquisitionPrice:1});},
    state=>{state.inventory[0].acquisitionPrice=0;},state=>{state.inventory.push(state.inventory[0]);},
    state=>{state.closedDeals.add('unearned');},state=>{state.log[0].profit=10000;},
  ];
  for(const mutate of mutations){const state=createShop(123);sell(state,catalog[1].id,60,'actual');mutate(state);assert.equal(store.save(state),false);assert.equal(memory.raw,original);}
});

test('malformed, injected and oversized saved states are rejected without granting stock',()=>{
  const memory=storage(),store=createProgressStore({storage:memory});
  const base=saved([]);
  for(const value of ['{',null,[],{...base,version:2},{...base,seed:-1},{...base,seed:0x100000000},{...base,inventory:[catalog[5]]},{...base,cash:9999},saved([{kind:'sell',itemId:catalog[0].id,price:500,dealId:'x',profit:10000}]),saved(Array(1001).fill({kind:'buy',itemId:catalog[3].id,price:1,dealId:'x'})),'x'.repeat(300001)]){
    memory.put(value);assert.equal(store.load(),null);
  }
  for(const price of [0,-1,501,1.5,'20',null]){memory.put(saved([{kind:'buy',itemId:catalog[3].id,price,dealId:'bad'}]));assert.equal(store.load(),null);}
});

test('blocked or unavailable local storage fails cleanly',()=>{
  for(const target of [null,{getItem(){throw Error('blocked');},setItem(){throw Error('quota');}}]){
    const store=createProgressStore({storage:target});assert.equal(store.load(),null);assert.equal(store.save(createShop(123)),false);
  }
});

test('undoing a purchase restores only its cash and ownership while preserving earlier profit and unlocks',()=>{
  const state=createShop(123);sell(state,catalog[0].id,catalog[0].cost+75,'earned-level');
  const before=structuredClone(snapshot(state)),progress=shopProgress(state);
  buy(state,catalog[4].id,40,'new-purchase');const committed=structuredClone(snapshot(state));
  const restored=undoLastTransaction(state);assert.deepEqual(snapshot(restored),before);assert.deepEqual(shopProgress(restored),progress);
  assert.deepEqual(snapshot(state),committed,'undo returns a replayed state without mutating the source');
  assert.equal(restored.closedDeals.has('new-purchase'),false);assert.equal(restored.closedDeals.has('earned-level'),true);
});

test('undoing a resale restores the original acquisition price and retains earlier transactions',()=>{
  const state=createShop(123);buy(state,catalog[3].id,20,'purchase');sell(state,catalog[0].id,catalog[0].cost+75,'earlier-sale');
  const before=structuredClone(snapshot(state));sell(state,catalog[3].id,100,'resale');assert.equal(shopProgress(state).profit,155);
  const restored=undoLastTransaction(state);assert.deepEqual(snapshot(restored),before);assert.equal(restored.inventory.find(item=>item.id===catalog[3].id).acquisitionPrice,20);
  assert.equal(shopProgress(restored).profit,75);assert.equal(unlockedItems(restored).length,5);
  const memory=storage(),store=createProgressStore({storage:memory});assert.equal(store.save(restored),true);assert.deepEqual(snapshot(store.load()),before);
});

test('undo refuses an empty or inconsistent ledger rather than creating free cash or inventory',()=>{
  assert.equal(undoLastTransaction(createShop(123)),null);assert.equal(undoLastTransaction(null),null);
  for(const corrupt of [state=>{state.cash++;},state=>{state.inventory.push({...catalog[5],acquisitionPrice:1});},state=>{state.log[0].profit=99999;},state=>{state.closedDeals.clear();}]){
    const state=createShop(123);sell(state,catalog[0].id,50,'sale');corrupt(state);const before=structuredClone(snapshot(state));
    assert.equal(undoLastTransaction(state),null);assert.deepEqual(snapshot(state),before);
  }
});
