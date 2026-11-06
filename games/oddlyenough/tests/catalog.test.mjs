import test from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOMERS,getCustomer} from '../customers.js';
import {ITEMS,getItem} from '../items.js';
import {PERSONALITIES,getPersonality,personalityFor,withPersonality} from '../personalities.js';
import {makeGatewayRequest,parseTalkRequest} from '../server-dialogue.js';

const cast=[
  ['hollis','Mr. Whitfield','buyer','02-suit-guy'],['ines','Dre','seller','01-subway-guy'],
  ['c1','Kai','seller','03-jacket-guy'],['c2','Tino','seller','04-hoodie-guy'],
  ['c3','Linda','buyer','05-red-skirt-woman'],['c4','Jess','buyer','06-jeans-woman'],
  ['c5','Earl','seller','07-homeless-guy'],['c6','Mr. Marlowe','buyer','08-fish-man'],
  ['farmer','The Farmer','seller','09-sack-head'],['visitor','Visitor','buyer','10-grey-alien'],
];
const models={
  'hollow-room-camera':'01-camera','minute-eater-clock':'02-pocket-watch','amber-radio':'03-guitar',
  'tomorrowquack-duck':'04-porcelain-cat','tin-valentine':'05-gold-trophy','feathered-coil':'06-winged-snake',
  'storm-globe':'07-storm-globe','laugh-jar':'08-laugh-jar','house-less-door':'09-door','alien-egg':'10-alien-egg',
};
const legacyCosts={'tomorrowquack-duck':32,'amber-radio':40,'minute-eater-clock':48,'hollow-room-camera':55,'tin-valentine':66,'feathered-coil':75};

test('ten cast members retain save IDs and map to their exact Pack models and roles',()=>{
  assert.deepEqual(CUSTOMERS.map(({id,name,role,model})=>[id,name,role,model]),cast);
  assert.equal(new Set(CUSTOMERS.map(c=>c.model)).size,10);
  assert.equal(new Set(CUSTOMERS.map(c=>c.voiceIdentity)).size,10);
  for(const customer of CUSTOMERS){
    assert.ok(customer.background&&customer.voice&&customer.cue);
    assert.ok(getPersonality(customer.defaultPersonalityId));
    assert.ok(customer.preferredItemIds.length);
    for(const id of [...customer.preferredItemIds,...(customer.exclusiveItemIds||[]),...Object.keys(customer.itemStories||{})])assert.ok(getItem(id));
  }
  assert.deepEqual(CUSTOMERS.find(c=>c.id==='visitor').exclusiveItemIds,['alien-egg']);
  assert.equal(getCustomer(-1).id,'visitor');assert.equal(getCustomer(10).id,'hollis');
});

test('named character personality, voice identity and mannerism stay stable across shop seeds',()=>{
  for(const customer of CUSTOMERS)for(const seed of [0,1,17,123456,0xffffffff]){
    const assigned=withPersonality(customer,seed);
    assert.equal(assigned.personalityId,customer.defaultPersonalityId);
    assert.equal(personalityFor(customer.id,seed).id,customer.defaultPersonalityId);
    assert.equal(assigned.voiceIdentity,customer.voiceIdentity);assert.equal(assigned.cue,customer.cue);
    assert.equal(assigned.patience,customer.patience);assert.equal(assigned.skepticism,customer.skepticism);
    assert.deepEqual(assigned.interests,customer.interests);
  }
  assert.doesNotMatch(PERSONALITIES.map(p=>p.voice).join(' '),/never gullible|not easy to cheat/i);
});

test('the expanded catalog maps real shapes while preserving every legacy acquisition cost and unlock position',()=>{
  assert.deepEqual(Object.fromEntries(Object.values(ITEMS).map(i=>[i.id,i.model])),models);
  assert.deepEqual(Object.fromEntries(Object.keys(legacyCosts).map(id=>[id,ITEMS[id].cost])),legacyCosts);
  const sorted=Object.values(ITEMS).sort((a,b)=>a.cost-b.cost);
  assert.deepEqual(sorted.slice(0,6).map(i=>i.id),Object.keys(legacyCosts));
  for(const item of sorted){
    assert.equal(item.details.length,4);assert.equal(new Set(item.details.map(d=>d.id)).size,4);
    assert.ok(item.description&&item.condition&&item.claim&&item.form);
    for(const detail of item.details)assert.ok(detail.label&&detail.text&&detail.tags.length);
  }
  assert.equal(ITEMS['amber-radio'].form,'guitar');assert.equal(ITEMS['tomorrowquack-duck'].form,'cat');
  assert.equal(ITEMS['minute-eater-clock'].form,'watch');assert.equal(ITEMS['tin-valentine'].form,'trophy');
  assert.match(ITEMS['hollow-room-camera'].description,/two reels/);
  assert.equal(getItem('__proto__'),undefined);
});

test('canonical character stories attach only to their matching object and cannot be spoofed by the client',()=>{
  const request=(customer,item)=>makeGatewayRequest(parseTalkRequest({prototype:true,text:'Tell me about it.',customer,item,personalityId:'guarded',background:'invented',itemStories:{[item]:'invented'},state:{role:'seller'}}));
  const guitar=JSON.parse(request('c1','amber-radio').messages[0].content);
  assert.match(guitar.persona.currentObjectStory,/late brother/);
  assert.equal(guitar.persona.personality.id,'nostalgic');assert.doesNotMatch(JSON.stringify(guitar),/invented/);
  const cat=JSON.parse(request('c1','tomorrowquack-duck').messages[0].content);
  assert.equal(cat.persona.currentObjectStory,undefined);assert.doesNotMatch(cat.persona.background,/brother|guitar/);
  const camera=JSON.parse(request('ines','hollow-room-camera').messages[0].content);
  assert.match(camera.persona.currentObjectStory,/someone else's name/);
  const watch=JSON.parse(request('ines','minute-eater-clock').messages[0].content);
  assert.equal(watch.persona.currentObjectStory,undefined);
  assert.match(request('c1','amber-radio').system,/privateBackground shapes subtext; do not volunteer those secrets/);
  assert.match(request('c1','amber-radio').system,/do not extend it to other objects/);
});
