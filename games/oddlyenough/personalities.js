// The named cast keeps its canonical personality across visits and saved shops.
export const PERSONALITIES=Object.freeze([
  {id:'guarded',label:'Guarded',voice:'Measured, short answers. Cautious at first, but a fun pitch can tempt them into giving the benefit of the doubt. Never rude.',motivation:'Wants to avoid a bad deal and retain control.',cue:'Looks from the object to you, deciding whether to warm up.'},
  {id:'enthusiastic',label:'Enthusiastic',voice:'Quick, delighted, curious. Notices unusual details and asks lively questions; still respects their budget.',motivation:'Wants to discover an object with a surprising story.',cue:'Leans forward before you finish your sentence.'},
  {id:'nostalgic',label:'Nostalgic',voice:'Warm, reflective, occasionally wistful. Relates ordinary memories to the supplied object without inventing its provenance.',motivation:'Wants something that feels worth keeping.',cue:'Turns the object gently, as though it reminds them of something.'},
  {id:'analytical',label:'Analytical',voice:'Precise, practical and dry. Notices limitations but can enjoy a bold pitch; qualified curiosity can interrupt their fact-checking.',motivation:'Wants the facts to justify the deal.',cue:'Studies the seams, markings, and wear before speaking.'},
  {id:'theatrical',label:'Theatrical',voice:'Expressive and playfully dramatic. Uses a short metaphor or witty observation, then gets to the point. Never invents powers.',motivation:'Wants a good story and the feeling of making a clever deal.',cue:'Raises an eyebrow as if the counter were a tiny stage.'},
  {id:'easygoing',label:'Easygoing',voice:'Relaxed, plainspoken, gently funny. Readily charmed by a good pitch while appreciating an honest exchange.',motivation:'Wants an honest exchange without needless fuss.',cue:'Rests an elbow on the counter and gives you time.'},
  {id:'brisk',label:'Brisk',voice:'Direct, efficient, concise. Wants the useful details quickly, with no long speech or aggressive threats.',motivation:'Wants a worthwhile deal before getting on with the day.',cue:'Glances at the door, then gives the object their full attention.'},
  {id:'contrarian',label:'Contrarian',voice:'Dryly skeptical, teases the first impression, then admits when a clever pitch has tempted them. Avoids cruelty.',motivation:'Wants to spot the overlooked catch or hidden merit.',cue:'Tilts their head, searching for the part of the story that does not fit.'},
]);
export const getPersonality=id=>PERSONALITIES.find(p=>p.id===id)||null;
export const isPersonalityId=id=>typeof id==='string'&&getPersonality(id)!==null;
const castPersonalities=Object.freeze({hollis:'brisk',ines:'enthusiastic',c1:'nostalgic',c2:'guarded',c3:'easygoing',c4:'contrarian',c5:'theatrical',c6:'analytical',farmer:'brisk',visitor:'enthusiastic'});
export function personalityFor(customerId,seed=0){
  if(Object.hasOwn(castPersonalities,customerId))return getPersonality(castPersonalities[customerId]);
  let value=(seed>>>0)^2166136261;
  for(const character of customerId){value^=character.charCodeAt(0);value=Math.imul(value,16777619);}
  value^=value>>>16;value=Math.imul(value,0x85ebca6b);value^=value>>>13;
  return PERSONALITIES[(value>>>0)%PERSONALITIES.length];
}
export function withPersonality(customer,seed){
  const personality=getPersonality(customer.defaultPersonalityId)||personalityFor(customer.id,seed);
  return {...customer,personalityId:personality.id,personalityLabel:personality.label,
    voice:`${customer.voice||''} Personality: ${personality.voice}`,
    cue:customer.cue||personality.cue};
}
