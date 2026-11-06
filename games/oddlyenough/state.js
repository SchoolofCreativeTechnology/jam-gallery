// The ledger is the only authority for cash and item ownership.
import { CASH_START, RENT, MIN_OFFER, MAX_OFFER } from './tuning.js';
import { getItem } from './items.js';
function randomSeed(){
  const seed=new Uint32Array(1);
  try{if(globalThis.crypto?.getRandomValues){globalThis.crypto.getRandomValues(seed);return seed[0];}}catch{}
  return Math.floor(Math.random()*0x100000000)>>>0;
}
export function createState(overrides = {}) {
  return { cash:CASH_START, inventory:[], day:1, customerIndex:0, closedDeals:new Set(), paidDays:new Set(), log:[], memory:{}, personalitySeed:randomSeed(), ...overrides };
}
export const validPrice = p => Number.isSafeInteger(p) && p >= MIN_OFFER && p <= MAX_OFFER;
const validCash = cash => Number.isSafeInteger(cash) && cash >= 0;
export const canAfford = (s,p) => validPrice(p) && validCash(s.cash) && s.cash >= p;
function guard(s,id,p,dealId) {
  if (typeof dealId !== 'string' || !dealId.trim()) return 'invalid-deal';
  if (s.closedDeals.has(dealId)) return 'duplicate';
  if (typeof id !== 'string' || getItem(id)?.id !== id) return 'unknown-item';
  if (!validPrice(p)) return 'invalid-price';
  if (!validCash(s.cash)) return 'invalid-cash';
}
export function buy(s,id,p,dealId) {
  const reason = guard(s,id,p,dealId) || (s.inventory.some(x=>x.id===id) ? 'already-owned' : !canAfford(s,p) ? 'funds' : null);
  if (reason) return {ok:false,reason};
  s.cash -= p; s.inventory.push({...getItem(id),acquisitionPrice:p}); s.closedDeals.add(dealId);
  s.log.push({day:s.day,kind:'buy',itemId:id,price:p,dealId}); return {ok:true};
}
export function sell(s,id,p,dealId) {
  const at = s.inventory.findIndex(x=>x.id===id);
  const reason = guard(s,id,p,dealId) || (at<0 ? 'not-owned' : !validPrice(s.inventory[at].acquisitionPrice) ? 'invalid-stock' : !Number.isSafeInteger(s.cash+p) ? 'cash-overflow' : null);
  if (reason) return {ok:false,reason};
  const [owned] = s.inventory.splice(at,1); s.cash += p; s.closedDeals.add(dealId);
  s.log.push({day:s.day,kind:'sell',itemId:id,price:p,profit:p-owned.acquisitionPrice,dealId}); return {ok:true};
}
export const inventoryValue = s => s.inventory.reduce((sum,x)=>sum+x.acquisitionPrice,0);
export const score = s => s.cash + inventoryValue(s);
export function payRent(s) {
  if (!validCash(s.cash) || !Number.isSafeInteger(s.day) || s.day<1) return {ok:false,short:0,reason:'invalid-state'};
  if (s.paidDays.has(s.day)) return {ok:true,short:0};
  if (s.cash < RENT) return {ok:false,short:RENT-s.cash};
  s.cash -= RENT; s.paidDays.add(s.day); s.log.push({day:s.day,kind:'rent',price:RENT}); return {ok:true,short:0};
}
export const resetState = () => createState();
