// The Pawn Shop Pack supplies the world and cast. This adapter owns presentation only.
import * as THREE from 'three';
import { loadPawnModel, fitProp } from './scene-assets.js';
import { planShelfInventory, shelfSlot } from './inventory-display.js';
import { dressShop, addCounterCurios, addShopDetails } from './shop-dressing.js';

export function createScene(host) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x171b19);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.style.cssText = 'display:block;width:100%;height:100%;'; host.append(canvas);
  const camera = new THREE.PerspectiveCamera(48, 1, .045, 50), target = new THREE.Vector3();
  const V = (x,y,z) => new THREE.Vector3(x,y,z);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .87, flatShading: true });
  const m = { wood:material(0x59432f), wall:material(0x716855), floor:material(0x8d8471), steel:material(0x566561), shirt:material(0xb4aa94), apron:material(0x354c45), skin:material(0xc89570), hair:material(0x7d7971), dark:material(0x252826), prop:material(0xb9b1a1), brass:material(0xa58c57) };
  const group = (parent,x=0,y=0,z=0) => { const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g; };
  function mesh(parent,geometry,mat,x=0,y=0,z=0) {const p=new THREE.Mesh(geometry,mat);p.position.set(x,y,z);p.castShadow=true;p.receiveShadow=true;parent.add(p);return p;}
  const box = (parent,w,h,d,mat,x=0,y=0,z=0) => mesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const cylinder = (parent,top,bottom,h,mat,x=0,y=0,z=0) => mesh(parent,new THREE.CylinderGeometry(top,bottom,h,10),mat,x,y,z);
  const fallback = group(scene);
  box(fallback,9,.12,8,m.floor,0,-.06,0);box(fallback,7,3.2,.12,m.wall,1,1.6,-4.06);box(fallback,.12,3.2,8,m.wall,4.56,1.6,0);
  box(fallback,2.6,.98,.7,m.wood,.7,.49,-2);box(fallback,2.64,.05,.74,m.steel,.7,1.005,-2);
  for(const x of [-1.9,.65])for(const y of [.13,.53,.93,1.33])box(fallback,.9,.04,3.2,m.steel,x,y,1.3);

  // Model-space staging: doorway/steps at (-3.5,-3), display case at (.7,-2).
  const door=V(-4.05,.45,-3.55),landing=V(-2.7,.45,-2.2),step1=V(-2.47,.30,-1.97),step2=V(-2.23,.15,-1.73),floorEntry=V(-1.98,0,-1.48);
  const counterSpot=V(.68,0,-1.08),keeperSpot=V(.82,0,-2.95),counterItem=V(.75,1.035,-1.97);
  const browseSpot=V(-2.88,0,.62),shelfItem=V(-2.13,.94,.62);
  let object=null,currentItem=null,customerName='Customer',reaction='neutral',status='idle',sideView=false,visible=true,night=false;
  let sequence=null,loadWaiter=null,visitVersion=0,itemVersion=0,characterVersion=0,lastTime=performance.now()/1000,elapsed=0;
  let interactive=false,inspecting=false,inspectionAmount=0,inspectionAngle=0,inspectionScale=2.15,itemClick=null,pointerDown=null;
  const assetState={store:'loading',character:'fallback',keeper:'loading',item:'fallback'};
  const shelfStock=new Map();let inventory=[],inventoryKey='',activeItemId=null;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

  function simpleFigure(isKeeper=false) {
    const root=group(scene),body=group(root),head=group(body,0,1.53,0),arms=[],legs=[];body.userData.disposable=true;
    const clothing=isKeeper?m.shirt:m.steel;
    box(body,.40,.52,.25,clothing,0,1.18,0);box(body,.35,.16,.24,m.dark,0,.86,0);
    cylinder(body,.07,.07,.12,m.skin,0,1.48,0);
    box(head,.23,.27,.23,m.skin,0,.12,0);box(head,.25,.09,.25,isKeeper?m.hair:m.dark,0,.26,-.015);
    box(head,.075,.065,.07,m.skin,0,.105,.135);
    for(const x of [-.056,.056]){box(head,.045,.027,.015,m.dark,x,.15,.123);if(isKeeper)box(head,.075,.045,.015,m.brass,x,.15,.131);}
    if(isKeeper){box(body,.33,.55,.025,m.apron,0,1.1,.14);box(body,.21,.13,.03,m.wood,0,1.05,.158);box(head,.16,.035,.02,m.hair,0,.044,.126);}
    for(const side of [-1,1]){
      const leg=group(body,side*.11,.88,0);box(leg,.15,.72,.18,m.dark,0,-.36,0);box(leg,.17,.10,.27,m.dark,0,-.79,.045);legs.push(leg);
      const arm=group(body,side*.25,1.41,0);box(arm,.13,.49,.14,clothing,0,-.245,0);box(arm,.105,.13,.105,m.skin,0,-.55,.02);arms.push(arm);
    }
    const hand=group(arms[1],0,-.56,.11);
    return {root,body,head,arms,legs,hand,walking:false,carrying:false,baseY:0,loaded:false};
  }
  const visitor=simpleFigure(),keeper=simpleFigure(true);visitor.root.visible=false;keeper.root.position.copy(keeperSpot);keeper.root.rotation.y=-.08;

  function rigLoadedCharacter(model) {
    const visual=new THREE.Group();visual.add(model);visual.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);model.position.y-=bounds.min.y;visual.updateMatrixWorld(true);
    const head=group(visual,0,1.5,0),arms=[group(visual,-.245,1.42,0),group(visual,.245,1.42,0)],legs=[group(visual,-.105,.89,0),group(visual,.105,.89,0)];
    const parts=[];model.traverse(node=>{if(node.isMesh)parts.push(node);});
    for(const part of parts){
      const name=part.name.toLowerCase(),pos=part.getWorldPosition(new THREE.Vector3()),b=new THREE.Box3().setFromObject(part),center=b.getCenter(new THREE.Vector3());
      if(/upperarm|forearm|hand|cuff/.test(name))arms[pos.x<0?0:1].attach(part);
      else if(/thigh|shin|baggy|widepant|foot|chunky|boot|shoe/.test(name)&&Math.abs(pos.x)>.03)legs[pos.x<0?0:1].attach(part);
      else if(center.y>1.54&&b.min.y>1.35)head.attach(part);
    }
    return {body:visual,head,arms,legs,hand:group(arms[1],.025,-.57,.10),loaded:true};
  }
  async function setCustomer(customer) {
    customerName=customer?.name||'Customer';const version=++characterVersion;
    const modelName=customer?.model;assetState.character='loading';label();
    const loaded=await loadPawnModel('characters',modelName);
    if(version!==characterVersion)return;
    const held=object&&object.parent===visitor.hand;
    if(held){scene.updateMatrixWorld(true);scene.attach(object);}
    let rig;
    if(loaded)rig=rigLoadedCharacter(loaded);
    else {const placeholder=simpleFigure();placeholder.root.removeFromParent();rig={body:placeholder.body,head:placeholder.head,arms:placeholder.arms,legs:placeholder.legs,hand:placeholder.hand,loaded:false};}
    releaseFallback(visitor.body);visitor.body.removeFromParent();Object.assign(visitor,rig);visitor.root.add(visitor.body);
    if(held)attachToHand();assetState.character=loaded?'ready':'fallback';label();
  }
  const keeperReady=loadPawnModel('characters','01-subway-guy').then(model=>{
    if(!model){assetState.keeper='fallback';label();return;}
    keeper.body.traverse(part=>part.geometry?.dispose());keeper.body.removeFromParent();
    Object.assign(keeper,rigLoadedCharacter(model));keeper.root.add(keeper.body);assetState.keeper='ready';label();
  });

  const hemi=new THREE.HemisphereLight(0xc3d6cc,0x59412e,.85);scene.add(hemi);
  const windowLight=new THREE.DirectionalLight(0xa9cbd2,1.05);windowLight.position.set(-4,3,1);scene.add(windowLight);
  const counterLight=new THREE.SpotLight(0xffdfad,32,8,1.03,.7,1.6);counterLight.position.set(.8,2.42,-1.92);counterLight.target.position.set(.7,.8,-1.8);counterLight.castShadow=true;
  counterLight.shadow.mapSize.set(1024,1024);counterLight.shadow.bias=-.0003;counterLight.shadow.normalBias=.015;scene.add(counterLight,counterLight.target);
  const faceFill=new THREE.PointLight(0xf6ddba,5.5,6,1.6);faceFill.position.set(3.2,2.1,-1.7);scene.add(faceFill);
  let storeLights=[];
  const ready=loadPawnModel('store','pawn-shop').then(model=>{
    if(!model){assetState.store='fallback';label();return false;}
    model.traverse(node=>{if(node.isLight){node.castShadow=false;storeLights.push({light:node,intensity:node.intensity});if(night)node.intensity*=.65;}});
    dressShop(THREE,model);scene.add(model);addCounterCurios(THREE,scene);addShopDetails(THREE,scene);fallback.visible=false;assetState.store='ready';label();return true;
  });
  function refreshShelves(){
    for(const {item,visible} of planShelfInventory(inventory,activeItemId)){
      const entry=shelfStock.get(item.id);if(entry?.object)entry.object.visible=visible;
    }
    canvas.dataset.shelfItems=[...shelfStock].filter(([,entry])=>entry.object?.visible).map(([id])=>id).join(',');
  }
  function setInventory(next){
    inventory=Array.isArray(next)?next:[];
    const plan=planShelfInventory(inventory,activeItemId),key=plan.map(entry=>entry.item.id).join(',');
    if(key===inventoryKey){refreshShelves();return;}
    inventoryKey=key;const wanted=new Set(plan.map(entry=>entry.item.id));
    for(const [id,entry] of shelfStock)if(!wanted.has(id)){entry.object?.removeFromParent();shelfStock.delete(id);}
    for(const {item,slot} of plan){
      if(shelfStock.has(item.id))continue;
      const entry={object:null};shelfStock.set(item.id,entry);
      void loadPawnModel('items',item.model).then(model=>{
        if(shelfStock.get(item.id)!==entry||!model)return;
        const prop=fitProp(model,.34);prop.position.set(slot.x,slot.y,slot.z);prop.rotation.y=Math.PI/2-.16;
        entry.object=prop;scene.add(prop);refreshShelves();
      });
    }
    refreshShelves();
  }
  function canInspect(){return interactive&&sideView&&!sequence&&visitor.root.visible&&object?.visible&&object.parent===scene;}
  function label(){
    canvas.dataset.shopAsset=assetState.store;canvas.dataset.characterAsset=assetState.character;canvas.dataset.keeperAsset=assetState.keeper;canvas.dataset.itemAsset=assetState.item;
    canvas.setAttribute('aria-label',`${sideView?'Customer on the left, shopkeeper on the right, glass counter in the middle.':'Pawn shop with a corner doorway, tiled floor and shelves.'} ${visitor.root.visible?customerName+' is '+status+'.':'Waiting for a customer.'}${currentItem&&object?.visible?' Object: '+(currentItem.name||currentItem.id)+'.':''}${inspecting?' Enlarged item floating and slowly rotating. Click again or press Escape to return it.':canInspect()?' Click the item or press Enter to inspect it.':''}`);
    canvas.setAttribute('role',canInspect()?'button':'img');canvas.tabIndex=canInspect()?0:-1;if(canInspect())canvas.setAttribute('aria-pressed',String(inspecting));else canvas.removeAttribute('aria-pressed');
  }
  function resetInspection(){inspecting=false;inspectionAmount=0;inspectionAngle=0;pointerDown=null;canvas.style.cursor='';if(object){object.scale.setScalar(1);if(object.parent===scene){object.position.copy(counterItem);object.quaternion.identity();}}}
  function toggleInspection(){if(!canInspect())return;inspecting=!inspecting;if(!inspecting)inspectionAngle=Math.atan2(Math.sin(inspectionAngle),Math.cos(inspectionAngle));canvas.style.cursor=inspecting?'zoom-out':'zoom-in';label();itemClick?.(currentItem,inspecting);}
  function hitsItem(event){
    if(!canInspect())return false;const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    scene.updateMatrixWorld(true);camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(object,true).length>0;
  }
  canvas.addEventListener('pointermove',event=>{canvas.style.cursor=inspecting?'zoom-out':hitsItem(event)?'zoom-in':'';});
  canvas.addEventListener('pointerleave',()=>{pointerDown=null;canvas.style.cursor='';});
  canvas.addEventListener('pointerdown',event=>{if(event.button===0)pointerDown={x:event.clientX,y:event.clientY};});
  canvas.addEventListener('pointercancel',()=>{pointerDown=null;});
  canvas.addEventListener('pointerup',event=>{const down=pointerDown;pointerDown=null;if(event.button!==0||!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>8)return;if(canInspect()&&(inspecting||hitsItem(event))){canvas.focus({preventScroll:true});toggleInspection();}});
  canvas.addEventListener('keydown',event=>{if(canInspect()&&!event.repeat&&(event.key==='Enter'||event.key===' ')){event.preventDefault();toggleInspection();}});
  addEventListener('keydown',event=>{if(event.key==='Escape'&&inspecting&&canInspect()){event.preventDefault();toggleInspection();}});
  function animateInspection(dt){
    if(!canInspect())return;const blend=1-Math.exp(-7*Math.min(dt,.1));inspectionAmount=THREE.MathUtils.lerp(inspectionAmount,inspecting?1:0,blend);
    if(Math.abs(inspectionAmount-(inspecting?1:0))<.001)inspectionAmount=inspecting?1:0;
    inspectionAngle=inspecting?(inspectionAngle+.35*Math.min(dt,.1))%(Math.PI*2):THREE.MathUtils.lerp(inspectionAngle,0,blend);
    if(!inspectionAmount)inspectionAngle=0;object.position.copy(counterItem);object.position.y+=inspectionAmount*(.25+.018*Math.sin(elapsed*1.5));object.scale.setScalar(1+inspectionAmount*(inspectionScale-1));object.rotation.set(0,inspectionAngle,0);
  }
  const ease=t=>t*t*(3-2*t);
  function cameraPose(side){return side?{position:V(4.12,2.04,-1.86),target:V(.64,1.02,-2.02)}:{position:V(4.08,2.93,3.4),target:V(-.95,1.0,-1.45)};}
  function applyCamera(side){const pose=cameraPose(side);camera.position.copy(pose.position);target.copy(pose.target);camera.lookAt(target);}
  function cancelVisit(){
    ++visitVersion;if(sequence){const old=sequence;sequence=null;old.resolve({cancelled:true});}
    if(loadWaiter){loadWaiter.resolve(false);loadWaiter=null;}
    interactive=false;resetInspection();visitor.walking=false;visitor.root.position.y=visitor.baseY;label();
  }
  function run(steps,onReady){return new Promise(resolve=>{sequence={steps,index:0,elapsed:0,entered:false,resolve,onReady};});}
  function advance(dt){
    while(sequence&&dt>=0){
      const current=sequence,step=current.steps[current.index];if(!current.entered){current.entered=true;step.enter?.();}
      const consumed=Math.min(dt,Math.max(0,step.duration-current.elapsed));current.elapsed+=consumed;dt-=consumed;step.update?.(Math.min(1,current.elapsed/step.duration));
      if(current.elapsed+1e-8<step.duration)break;step.exit?.();if(sequence!==current)break;current.index++;current.elapsed=0;current.entered=false;
      if(current.index===current.steps.length){sequence=null;label();current.resolve({cancelled:false});try{current.onReady?.();}catch(error){console.error('Visit callback failed',error);}break;}if(dt<=0)break;
    }
  }
  function move(to,duration,faceAtEnd=null){let from;return {duration,enter(){from=visitor.root.position.clone();from.y=visitor.baseY;visitor.walking=true;visitor.root.rotation.y=Math.atan2(to.x-from.x,to.z-from.z);},update(t){visitor.root.position.lerpVectors(from,to,t);visitor.baseY=visitor.root.position.y;},exit(){visitor.walking=false;visitor.root.position.copy(to);visitor.baseY=to.y;if(faceAtEnd!==null)visitor.root.rotation.y=faceAtEnd;}};}
  const pause=(duration,action)=>({duration,enter:action});
  function cameraShift(side,duration=.8){let from,fromTarget;return {duration,enter(){from=camera.position.clone();fromTarget=target.clone();sideView=side;label();},update(t){const pose=cameraPose(side);camera.position.lerpVectors(from,pose.position,ease(t));target.lerpVectors(fromTarget,pose.target,ease(t));camera.lookAt(target);},exit(){applyCamera(side);}};}
  function attachToHand(){if(!object)return;visitor.carrying=true;visitor.hand.add(object);object.position.set(0,0,0);object.quaternion.identity();object.visible=true;}
  function transferToCounter(duration=.32){let from,rotation;return {duration,enter(){if(!object)return;scene.updateMatrixWorld(true);scene.attach(object);from=object.position.clone();rotation=object.quaternion.clone();},update(t){if(!object||!from)return;object.position.lerpVectors(from,counterItem,ease(t));object.quaternion.copy(rotation).slerp(new THREE.Quaternion(),ease(t));},exit(){visitor.carrying=false;if(object){object.position.copy(counterItem);object.quaternion.identity();}}};}
  function pickFromShelf(){let from;return {duration:.3,enter(){visitor.carrying=true;from=object?.position.clone();},update(t){if(!object||!from)return;scene.updateMatrixWorld(true);const hand=visitor.hand.getWorldPosition(new THREE.Vector3());object.position.lerpVectors(from,hand,ease(t));},exit:attachToHand};}
  function releaseFallback(root){root.traverse(node=>{if(node.userData.disposable)node.traverse(part=>part.geometry?.dispose());});}
  function fallbackProp(data){const root=new THREE.Group();root.userData.disposable=true;box(root,.36,.28,.22,m.prop,0,.14,0);if(data?.form==='camera')cylinder(root,.08,.08,.12,m.dark,0,.14,.15).rotation.x=Math.PI/2;else{box(root,.24,.13,.02,m.dark,0,.17,.12);cylinder(root,.025,.025,.025,m.brass,.13,.09,.13).rotation.x=Math.PI/2;}return root;}
  async function setItem(data){
    if(!data)return;if(currentItem?.id===data.id&&currentItem?.model===data.model&&object)return;
    const version=++itemVersion;resetInspection();if(object){releaseFallback(object);object.removeFromParent();}currentItem=data;object=group(scene);object.position.copy(counterItem);object.visible=visible;
    const container=object;container.add(fallbackProp(data));inspectionScale=2.15;assetState.item='loading';label();
    const loaded=await loadPawnModel('items',data.model);
    if(version!==itemVersion||container!==object)return;
    if(loaded){
      releaseFallback(container);container.clear();const fitted=fitProp(loaded,/guitar|door/.test(data.model)?.7:.48);fitted.rotation.y=Math.PI/2-.16;
      const height=new THREE.Box3().setFromObject(fitted).getSize(new THREE.Vector3()).y;
      // Keep tall props clear of the portrait HUD while retaining their proportions.
      inspectionScale=Math.min(2.15,.88/Math.max(height,.001));container.add(fitted);assetState.item='ready';
    }else assetState.item='fallback';label();
  }
  async function startVisit({customer,item,role=customer?.role||'buyer',onReady}={}){
    cancelVisit();const version=visitVersion;status='arriving';sideView=false;applyCamera(false);visitor.root.visible=false;
    activeItemId=item?.id||null;refreshShelves();
    // The animation starts only after this visit's assets are ready; cancellation
    // during loading cannot resurrect a stale customer or start an old route.
    let waiter;const cancelled=new Promise(resolve=>{waiter={resolve,version};loadWaiter=waiter;});
    const loaded=await Promise.race([Promise.allSettled([ready,keeperReady,setCustomer(customer),setItem(item)]).then(()=>true),cancelled]);
    if(loadWaiter===waiter)loadWaiter=null;
    if(!loaded||version!==visitVersion)return {cancelled:true};
    reaction='neutral';status=role==='buyer'?'browsing':'arriving';visitor.root.visible=true;visitor.root.position.copy(door);visitor.baseY=door.y;visitor.root.rotation.y=Math.PI/4;visitor.carrying=false;visible=true;
    object.removeFromParent();scene.add(object);object.quaternion.identity();object.visible=true;
    const steps=[move(landing,.75),move(step1,.18),move(step2,.18),move(floorEntry,.2)];
    if(role==='seller'){attachToHand();steps.push(move(V(-1.1,0,-1.08),.65),move(counterSpot,.95,Math.PI));}
    else{
      const slot=shelfSlot(item.id),display=slot?V(slot.x,slot.y,slot.z):shelfItem,browse=slot?V(slot.browseX,0,slot.z):browseSpot;
      object.position.copy(display);
      steps.push(move(V(browse.x,0,-.95),.65),move(browse,1.05,slot?.facing??Math.PI/2),pause(.6,()=>{status='browsing';reaction='curious';label();}),pickFromShelf(),move(V(browse.x,0,-.95),.85),move(V(-1.1,0,-.95),.6),move(counterSpot,1.05,Math.PI));
    }
    steps.push(transferToCounter(),cameraShift(true,.8),pause(.01,()=>{status='listening';reaction='neutral';visitor.root.rotation.y=Math.PI-.075;label();}));label();return run(steps,onReady);
  }
  function endVisit({takeItem=false}={}){
    cancelVisit();status='leaving';reaction='neutral';label();if(!visitor.root.visible)return Promise.resolve({cancelled:false});if(takeItem||visitor.carrying)attachToHand();
    return run([move(V(-1.98,0,-1.48),.9),move(step2,.19),move(step1,.19),move(landing,.19),move(door,.65),pause(.01,()=>{visitor.root.visible=false;visitor.carrying=false;if(object)object.visible=false;activeItemId=null;refreshShelves();status='idle';label();})]);
  }
  function animateFigure(person,dt){
    const blend=1-Math.exp(-12*Math.min(dt,.1)),stride=person.walking?Math.sin(elapsed*9)*.28:0;
    person.legs[0].rotation.x=THREE.MathUtils.lerp(person.legs[0].rotation.x,stride,blend);person.legs[1].rotation.x=THREE.MathUtils.lerp(person.legs[1].rotation.x,-stride,blend);
    person.arms[0].rotation.x=THREE.MathUtils.lerp(person.arms[0].rotation.x,-stride*.55,blend);person.arms[1].rotation.x=THREE.MathUtils.lerp(person.arms[1].rotation.x,person.carrying?-1.08:stride*.55,blend);
    person.root.position.y=person.baseY+(person.walking?Math.abs(Math.sin(elapsed*9))*.019:0);
    const speaking=person===visitor&&(status==='talking'||status==='speaking');person.head.rotation.x=THREE.MathUtils.lerp(person.head.rotation.x,speaking?Math.sin(elapsed*6.8)*.045:0,blend);
    person.head.rotation.z=THREE.MathUtils.lerp(person.head.rotation.z,person===visitor&&reaction==='doubt'?.075:person===visitor&&reaction==='curious'?-.06:0,blend);
    person.body.rotation.z=person.walking?Math.sin(elapsed*4.5)*.012:Math.sin(elapsed*1.1)*.003;
  }
  function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(48)/2)/Math.min(1,camera.aspect)));camera.updateProjectionMatrix();if(!sequence)applyCamera(sideView);}
  resize();applyCamera(false);label();
  return {
    renderer,ready,resize,startVisit,endVisit,cancelVisit,setInventory,
    render(){const now=performance.now()/1000,dt=Math.max(0,now-lastTime);lastTime=now;elapsed+=dt;advance(dt);animateInspection(dt);animateFigure(visitor,dt);animateFigure(keeper,dt);renderer.render(scene,camera);},
    setCustomerPresent(present){visitor.root.visible=Boolean(present);label();},setCustomer,setItem,
    setItemVisible(value){visible=Boolean(value);if(!visible)resetInspection();if(object)object.visible=visible;label();},
    setReaction(expression,nextStatus){reaction=expression||'neutral';if(nextStatus)status=nextStatus;label();},
    setNight(value){night=Boolean(value);hemi.intensity=night?.55:.85;windowLight.intensity=night?.3:1.05;storeLights.forEach(({light,intensity})=>{light.intensity=intensity*(night?.65:1);});renderer.toneMappingExposure=night?.96:1.04;},
    setActive(value){interactive=Boolean(value);if(!interactive)resetInspection();label();},onItemClick(callback){itemClick=typeof callback==='function'?callback:null;},setItemHover(){},
    toggleCamera(){sideView=!sideView;applyCamera(sideView);label();return sideView;},
  };
}
