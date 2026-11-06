import {ITEMS} from './items.js';

const catalog=Object.values(ITEMS).sort((a,b)=>a.cost-b.cost);

// Each canonical object has one stable shelf home. Reordering a saved inventory
// must not move everything when a purchase or a sale happens.
export function shelfSlot(id){
  const index=catalog.findIndex(item=>item.id===id);
  if(index<0)return null;
  const right=index>=5,column=index%5;
  return {x:right?.90:-1.65,y:1.64,z:.10+column*.56,browseX:right?1.52:-1.08,facing:right?-Math.PI/2:-Math.PI/2};
}

export function planShelfInventory(inventory,activeItemId=null){
  const owned=new Set((Array.isArray(inventory)?inventory:[]).map(item=>item?.id));
  return catalog.filter(item=>owned.has(item.id)).map(item=>({item,slot:shelfSlot(item.id),visible:item.id!==activeItemId}));
}
