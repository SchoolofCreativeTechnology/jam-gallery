import test from 'node:test';
import assert from 'node:assert/strict';
import {planShelfInventory,shelfSlot} from '../inventory-display.js';
import {createShop} from '../progress.js';
import {buy,sell} from '../state.js';
import {ITEMS} from '../items.js';

test('shelves contain only actual owned stock, with one physical copy per canonical item',()=>{
  const state=createShop(17);
  const plan=planShelfInventory([...state.inventory,state.inventory[0],{id:'unknown'}]);
  assert.equal(plan.length,3);
  assert.equal(new Set(plan.map(entry=>entry.item.id)).size,3);
  assert.ok(plan.every(entry=>entry.visible&&state.inventory.some(item=>item.id===entry.item.id)));
  assert.equal(shelfSlot('unknown'),null);
});

test('a purchase gains a stable shelf slot, a buyer pickup hides its shelf copy, and a sale removes it',()=>{
  const state=createShop(17),item=ITEMS['hollow-room-camera'];
  assert.ok(!state.inventory.some(owned=>owned.id===item.id));
  assert.equal(buy(state,item.id,50,'purchase').ok,true);
  const purchased=planShelfInventory(state.inventory).find(entry=>entry.item.id===item.id);
  assert.ok(purchased?.visible);
  const pickup=planShelfInventory(state.inventory,item.id);
  assert.equal(pickup.find(entry=>entry.item.id===item.id).visible,false);
  assert.equal(pickup.filter(entry=>entry.visible).length,3);
  assert.deepEqual(planShelfInventory([...state.inventory].reverse()).find(entry=>entry.item.id===item.id).slot,purchased.slot);
  assert.equal(sell(state,item.id,75,'sale').ok,true);
  assert.ok(!planShelfInventory(state.inventory).some(entry=>entry.item.id===item.id));
});

test('a visiting seller does not create shelf stock until the purchase is committed',()=>{
  const state=createShop(17);
  const before=planShelfInventory(state.inventory,'hollow-room-camera');
  assert.equal(before.length,3);
  assert.ok(before.every(entry=>entry.visible));
  const slots=Object.keys(ITEMS).map(id=>shelfSlot(id));
  assert.equal(new Set(slots.map(({x,y,z})=>`${x}:${y}:${z}`)).size,Object.keys(ITEMS).length);
});
