// Replay the ledger to recover money, ownership, acquisition costs, and earned progression.
import {ITEMS} from './items.js';
import {createState,buy,sell} from './state.js';
const catalog=Object.values(ITEMS).sort((a,b)=>a.cost-b.cost);
const targets=[75,200,400,750,1200,2000];
const validSeed=value=>Number.isSafeInteger(value)&&value>=0&&value<=0xffffffff;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function createShop(seed){
  return createState({personalitySeed:seed>>>0,inventory:catalog.slice(0,3).map(item=>({...item,acquisitionPrice:item.cost}))});
}
function tier(profit){
  let level=1,previous=0;
  for(const target of targets){if(profit<target)break;previous=target;level++;}
  if(profit>=2000){level=7+Math.floor((profit-2000)/1000);previous=2000+(level-7)*1000;}
  const nextTarget=targets[level-1]??previous+1000;
  return {level,nextTarget,progress:Math.max(0,Math.min(1,(profit-previous)/(nextTarget-previous)))};
}
function replay(seed,transactions){
  if(!validSeed(seed)||!Array.isArray(transactions)||transactions.length>1000)return null;
  const state=createShop(seed);let profit=0;
  for(const tx of transactions){
    if(!plain(tx)||!['buy','sell'].includes(tx.kind)||typeof tx.dealId!=='string'||!tx.dealId.trim()||tx.dealId.length>100)return null;
    if(tx.kind==='buy'&&!catalog.slice(0,Math.min(catalog.length,tier(profit).level+3)).some(item=>item.id===tx.itemId))return null;
    const result=(tx.kind==='buy'?buy:sell)(state,tx.itemId,tx.price,tx.dealId);
    if(!result.ok)return null;
    if(tx.kind==='sell')profit+=state.log.at(-1).profit;
  }
  return {state,profit};
}
export function shopProgress(state){
  const result=replay(state?.personalitySeed,state?.log);
  const profit=result?.profit??0,earned=tier(profit),unlocked=Math.min(catalog.length,earned.level+3);
  return {cash:result?.state.cash??0,profit,...earned,deals:result?.state.log.length??0,nextUnlock:catalog[unlocked]?.name||null};
}
export function unlockedItems(state){return catalog.slice(0,Math.min(catalog.length,shopProgress(state).level+3));}
function matchesLedger(state,replayed){
  if(state.cash!==replayed.cash||!Array.isArray(state.inventory)||state.inventory.length!==replayed.inventory.length||!(state.closedDeals instanceof Set)||state.closedDeals.size!==replayed.closedDeals.size)return false;
  const seen=new Set();
  for(const item of state.inventory){
    if(!plain(item)||seen.has(item.id)||!replayed.inventory.some(owned=>owned.id===item.id&&owned.acquisitionPrice===item.acquisitionPrice))return false;
    seen.add(item.id);
  }
  if([...state.closedDeals].some(id=>!replayed.closedDeals.has(id)))return false;
  return state.log.every((tx,index)=>tx.kind!=='sell'||tx.profit===replayed.log[index].profit);
}
// Undo only the newest committed trade by replaying the remaining validated ledger.
export function undoLastTransaction(state){
  const current=replay(state?.personalitySeed,state?.log);
  if(!current||!state.log.length||!matchesLedger(state,current.state))return null;
  return replay(state.personalitySeed,state.log.slice(0,-1))?.state??null;
}
export function createProgressStore({storage,key='oddly-enough.voice-shop.v1'}={}){
  const access=()=>storage===undefined?globalThis.localStorage:storage;
  return {
    load(){
      try{
        const raw=access()?.getItem(key);if(typeof raw!=='string'||!raw||raw.length>300000)return null;
        const data=JSON.parse(raw);
        if(!plain(data)||data.version!==1||Object.keys(data).length!==3||!Object.keys(data).every(name=>['version','seed','transactions'].includes(name)))return null;
        if(!Array.isArray(data.transactions)||data.transactions.some(tx=>!plain(tx)||Object.keys(tx).length!==4||!Object.keys(tx).every(name=>['kind','itemId','price','dealId'].includes(name))))return null;
        return replay(data.seed,data.transactions)?.state??null;
      }catch{return null;}
    },
    save(state){
      try{
        const result=replay(state?.personalitySeed,state?.log);
        if(!result||!matchesLedger(state,result.state))return false;
        const transactions=result.state.log.map(({kind,itemId,price,dealId})=>({kind,itemId,price,dealId}));
        const raw=JSON.stringify({version:1,seed:state.personalitySeed,transactions});
        const target=access();if(raw.length>300000||!target||typeof target.setItem!=='function')return false;
        target.setItem(key,raw);return true;
      }catch{return false;}
    },
  };
}
