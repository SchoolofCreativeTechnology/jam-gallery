// Small, authored details for the supplied low-poly shop. Presentation only:
// no catalog IDs, inventory, interaction handlers, lights, or game state.
const textureCaches = new WeakMap();
const dressedModels = new WeakSet();
const counterGroups = new WeakMap();

function random(seed) {
  let value=seed>>>0;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
function canvas128() {
  if(typeof document!=='undefined') {const canvas=document.createElement('canvas');canvas.width=canvas.height=128;return canvas;}
  return typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(128,128):null;
}
function texture(THREE,kind) {
  let cache=textureCaches.get(THREE);if(!cache){cache=new Map();textureCaches.set(THREE,cache);}
  if(cache.has(kind))return cache.get(kind);
  const canvas=canvas128(),ctx=canvas?.getContext('2d');if(!ctx)return null;
  const wood=kind==='wood',felt=kind==='felt',rng=random(wood?713:felt?131:927);
  ctx.fillStyle=wood?'#76543c':felt?'#633a40':'#78908a';ctx.fillRect(0,0,128,128);
  // Two-pixel grain remains quiet at a distance and suits the pack's painted surfaces.
  for(let i=0;i<1000;i++){
    ctx.fillStyle=rng()>.5?'#fff1c41c':'#1c25252b';
    ctx.fillRect(Math.floor(rng()*64)*2,Math.floor(rng()*64)*2,2+Math.floor(rng()*2),2);
  }
  if(wood){
    for(let i=0;i<58;i++){
      const y=Math.floor(rng()*128),x=Math.floor(rng()*45)-10;
      ctx.strokeStyle=i%3?'#3a261b55':'#b8915a66';ctx.lineWidth=i%5?1:2;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+25,y+1);ctx.lineTo(x+70,y-1);ctx.lineTo(x+120,y+1);ctx.stroke();
    }
    for(const y of [0,63,127]){ctx.fillStyle='#392a1d55';ctx.fillRect(0,y,128,1);ctx.fillStyle='#c89a6950';ctx.fillRect(0,y+1,128,1);}
    for(const [x,y] of [[31,31],[100,91]]){
      ctx.strokeStyle='#39251c40';ctx.lineWidth=1;
      for(let r=0;r<3;r++){ctx.beginPath();ctx.ellipse(x,y,5+r*5,1.5+r*1.4,0,0,Math.PI*2);ctx.stroke();}
    }
  }else if(felt){
    for(let y=0;y<128;y+=4){ctx.fillStyle=y%8?'#341f2715':'#b9786d0c';ctx.fillRect(0,y,128,1);}
  }else{
    ctx.fillStyle='#d1d7ba16';ctx.fillRect(0,0,128,7);ctx.fillStyle='#263b3740';ctx.fillRect(0,124,128,4);
    for(let i=0;i<55;i++){
      const x=Math.floor(rng()*128),y=Math.floor(rng()*128),width=2+Math.floor(rng()*9);
      ctx.fillStyle=i%3?'#c0c6ae70':'#344d4970';ctx.fillRect(x,y,width,1+(i%4===0?1:0));
    }
    for(let i=0;i<10;i++){ctx.fillStyle='#33443d27';ctx.fillRect(Math.floor(rng()*128),Math.floor(rng()*128),3+Math.floor(rng()*5),2);}
  }
  const map=new THREE.CanvasTexture(canvas);map.name=`Oddly Enough ${kind} grain`;
  map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.NearestFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.anisotropy=4;
  cache.set(kind,map);return map;
}
function withPlanarUV(THREE,geometry) {
  if(geometry.getAttribute('uv')||!geometry.getAttribute('position'))return geometry;
  // Imported templates share geometry. Never mutate one to decorate another clone.
  const copy=geometry.clone();if(!copy.getAttribute('normal'))copy.computeVertexNormals();
  const position=copy.getAttribute('position'),normal=copy.getAttribute('normal'),uv=new Float32Array(position.count*2);
  for(let i=0;i<position.count;i++){
    const x=Math.abs(normal.getX(i)),y=Math.abs(normal.getY(i)),z=Math.abs(normal.getZ(i));
    uv[i*2]=(x>y&&x>z?position.getZ(i):position.getX(i))*.8;
    uv[i*2+1]=(y>x&&y>z?position.getZ(i):position.getY(i))*.8;
  }
  copy.setAttribute('uv',new THREE.BufferAttribute(uv,2));return copy;
}

export function dressShop(THREE,model) {
  if(!model?.traverse||dressedModels.has(model))return model;
  const replacements=new Map(),geometries=new Map();
  const categories={'4a3428':'wood','5a4030':'wood','6a4a38':'wood','98a8ac':'metal','a8b8bc':'metal','3a1418':'felt'};
  model.traverse(node=>{
    if(!node.isMesh)return;
    let changed=false;
    const apply=original=>{
      const kind=categories[original?.name?.toLowerCase()];
      // Preserve the pack's artwork and glass, including its original transparency.
      if(!kind||original.map||original.transparent||original.opacity<1)return original;
      changed=true;
      if(!replacements.has(original)){
        const material=original.clone(),map=texture(THREE,kind);
        material.map=map;material.color.set(map?0xffffff:kind==='wood'?0x76543c:kind==='felt'?0x633a40:0x78908a);
        if(kind==='wood'&&original.name==='4a3428')material.color.set(0xc8b49d);
        material.roughness=kind==='metal'?.73:kind==='felt'?.98:.84;
        material.metalness=kind==='metal'?.12:0;material.flatShading=true;material.needsUpdate=true;
        material.userData={...material.userData,oddlyDressed:true};replacements.set(original,material);
      }
      return replacements.get(original);
    };
    node.material=Array.isArray(node.material)?node.material.map(apply):apply(node.material);
    if(changed&&node.geometry){
      if(!geometries.has(node.geometry))geometries.set(node.geometry,withPlanarUV(THREE,node.geometry));
      node.geometry=geometries.get(node.geometry);
    }
  });
  dressedModels.add(model);return model;
}

export function addCounterCurios(THREE,scene) {
  if(counterGroups.has(scene))return counterGroups.get(scene);
  const root=new THREE.Group();root.name='Counter curios — decorative only';root.userData.decorative=true;
  const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
  const m={brass:mat(0xb59448,.43,.65),darkBrass:mat(0x69562f,.65,.45),teal:mat(0x547d73),cream:mat(0xdccaaa),red:mat(0x8d3840,.95),gem:mat(0x3c9b8e,.28,.15),ink:mat(0x24282a),steel:mat(0x9baba4,.5,.4),crystal:mat(0x809cba,.35,.18),felt:mat(0x445b50,.97),wood:mat(0x735440)};
  m.wood.map=texture(THREE,'wood');if(m.wood.map)m.wood.color.set(0xffffff);
  const mesh=(parent,geometry,material,x=0,y=0,z=0)=>{const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;parent.add(part);return part;};
  const box=(parent,w,h,d,material,x=0,y=0,z=0)=>mesh(parent,new THREE.BoxGeometry(w,h,d),material,x,y,z);
  const cylinder=(parent,r1,r2,h,material,x=0,y=0,z=0,segments=8)=>mesh(parent,new THREE.CylinderGeometry(r1,r2,h,segments),material,x,y,z);
  const torus=(parent,r,t,material,x=0,y=0,z=0)=>mesh(parent,new THREE.TorusGeometry(r,t,4,12),material,x,y,z);
  const stand=(name,x,z,turn=0)=>{
    const group=new THREE.Group();group.name=name;group.position.set(x,.65,z);group.rotation.y=turn;group.userData.decorative=true;root.add(group);
    box(group,.27,.04,.25,m.wood,0,-.02,0);box(group,.245,.006,.225,m.felt,0,.003,0);return group;
  };
  // Tray sits on the existing felt (.57m); all miniatures stay below the 1m glass lid.
  box(root,2.42,.04,.55,m.wood,.7,.59,-2);box(root,2.38,.006,.51,m.felt,.7,.613,-2);

  const key=stand('Curio: brass skeleton key',-.34,-2.13,-.28);
  const keyBow=torus(key,.047,.010,m.brass,-.06,.027,0);keyBow.rotation.x=Math.PI/2;
  box(key,.13,.018,.018,m.brass,.027,.027,0);box(key,.018,.018,.052,m.brass,.076,.027,.017);box(key,.018,.018,.038,m.brass,.046,.027,.01);

  const ring=stand('Curio: gem ring on velvet',.07,-1.85,.18);
  box(ring,.15,.035,.12,m.red,0,.023,0);box(ring,.145,.018,.105,m.red,0,.048,0);
  const band=torus(ring,.038,.009,m.brass,0,.09,0);band.rotation.y=.2;
  mesh(ring,new THREE.OctahedronGeometry(.031,0),m.gem,0,.141,0);
  for(const x of [-.023,.023])box(ring,.006,.035,.006,m.brass,x,.125,0);

  const robot=stand('Curio: tiny wind-up robot',.49,-2.13,-.16);
  for(const x of [-.039,.039]){box(robot,.041,.035,.064,m.ink,x,.026,.01);cylinder(robot,.015,.015,.04,m.steel,x,.058,0);}
  box(robot,.115,.075,.062,m.teal,0,.105,0);box(robot,.09,.052,.065,m.steel,0,.17,0);
  for(const x of [-.025,.025]){box(robot,.014,.013,.008,m.ink,x,.176,.036);box(robot,.024,.062,.027,m.teal,x<0?-.076:.076,.112,0);}
  box(robot,.035,.007,.006,m.red,0,.157,.037);cylinder(robot,.005,.005,.026,m.brass,0,.208,0);
  mesh(robot,new THREE.OctahedronGeometry(.012),m.brass,0,.226,0);

  const compass=stand('Curio: brass trail compass',.91,-1.85,.22);
  cylinder(compass,.085,.083,.03,m.darkBrass,0,.025,0,12);cylinder(compass,.072,.072,.008,m.cream,0,.045,0,12);
  const rim=torus(compass,.078,.008,m.brass,0,.049,0);rim.rotation.x=Math.PI/2;
  const north=mesh(compass,new THREE.ConeGeometry(.017,.057,3),m.red,0,.059,-.021);north.rotation.x=-Math.PI/2;
  const south=mesh(compass,new THREE.ConeGeometry(.017,.057,3),m.ink,0,.059,.021);south.rotation.x=Math.PI/2;
  cylinder(compass,.009,.009,.012,m.brass,0,.064,0);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const tick=box(compass,.005,.004,.012,m.ink,Math.sin(a)*.058,.052,Math.cos(a)*.058);tick.rotation.y=a;}

  const shell=stand('Curio: scalloped shell',1.33,-2.13,-.3);
  const shellPositions=[];const fan=[];
  for(let i=0;i<=8;i++){const a=-Math.PI*.82+i*Math.PI*1.64/8;fan.push([Math.sin(a)*.09,.028+Math.cos(a)*.018,Math.cos(a)*.087]);}
  for(let i=0;i<8;i++)shellPositions.push(0,.012,-.035,...fan[i],...fan[i+1]);
  const shellGeometry=new THREE.BufferGeometry();shellGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(shellPositions),3));shellGeometry.computeVertexNormals();
  const shellMaterial=m.cream.clone();shellMaterial.side=THREE.DoubleSide;mesh(shell,shellGeometry,shellMaterial,0,.025,0);
  for(const point of fan){
    const from=new THREE.Vector3(0,.037,-.035),to=new THREE.Vector3(point[0],point[1]+.025,point[2]),direction=to.clone().sub(from);
    const rib=cylinder(shell,.004,.006,direction.length(),m.cream);rib.position.copy(from).add(to).multiplyScalar(.5);rib.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  }

  const crystal=stand('Curio: blue mineral cluster',1.74,-1.85,.15);
  cylinder(crystal,.075,.095,.03,m.ink,0,.022,0,7);
  for(const [x,z,height,radius,tilt] of [[0,0,.17,.031,.03],[-.044,.018,.10,.023,-.24],[.042,.022,.125,.025,.22]]){
    const shard=new THREE.Group();shard.position.set(x,.035,z);shard.rotation.z=tilt;crystal.add(shard);
    cylinder(shard,radius,radius,height*.67,m.crystal,0,height*.335,0,5);
    cylinder(shard,0,radius,height*.33,m.crystal,0,height*.835,0,5);
  }
  scene.add(root);counterGroups.set(scene,root);return root;
}

const detailGroups=new WeakMap();
function paintedSurface(THREE,id,width,height,paint) {
  let cache=textureCaches.get(THREE);if(!cache){cache=new Map();textureCaches.set(THREE,cache);}
  const key=`detail:${id}`;if(cache.has(key))return cache.get(key);
  const canvas=canvas128();if(!canvas)return null;canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)return null;paint(ctx,width,height);
  const map=new THREE.CanvasTexture(canvas);map.name=`Oddly Enough hand-painted ${id}`;map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.NearestFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.anisotropy=4;cache.set(key,map);return map;
}
function signArt(THREE,id,title,subtitle,bg='#d6c39b',ink='#73352c') {
  return paintedSurface(THREE,id,256,128,(ctx,w,h)=>{
    const rng=random(312+id.length*91);ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=ink;ctx.lineWidth=5;ctx.strokeRect(6,6,w-12,h-12);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ink;ctx.font='900 28px "Archivo Black", sans-serif';ctx.fillText(title,w/2,48,w-28);
    ctx.font='bold 15px "IBM Plex Mono", monospace';ctx.fillText(subtitle,w/2,91,w-28);
    for(let i=0;i<155;i++){ctx.fillStyle=i%3?'#42352425':'#f4e5b954';const y=rng()<.65?(rng()<.5?rng()*12:h-rng()*13):rng()*h;ctx.fillRect(rng()*w,y,2+rng()*8,1+rng()*3);}
    ctx.fillStyle='#241f1bb0';for(const x of [12,w-12])for(const y of [13,h-13])ctx.fillRect(x,y,3,3);
  });
}

export function addShopDetails(THREE,scene) {
  if(detailGroups.has(scene))return detailGroups.get(scene);
  const root=new THREE.Group();root.name='Rundown shop dressing';root.userData.decorative=true;
  const mat=(color,roughness=.9,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
  const m={wood:mat(0x77513a),teal:mat(0x728c81,.8,.12),dark:mat(0x292b27),steel:mat(0x8d9690,.65,.3),rust:mat(0x83563d),clay:mat(0x855f48),soil:mat(0x302c24),leaf:mat(0x536448),leafLight:mat(0x78805a),leafDry:mat(0x96876a),cardboard:mat(0x9b845c),tape:mat(0xbca774),paper:mat(0xcbbd9b),red:mat(0x854638),blue:mat(0x4c646a),ochre:mat(0xa68b4f),cable:mat(0x272822)};
  m.wood.map=texture(THREE,'wood');if(m.wood.map)m.wood.color.set(0xffffff);
  m.teal.map=texture(THREE,'metal');if(m.teal.map)m.teal.color.set(0xffffff);
  const paperMap=paintedSurface(THREE,'old newspaper',128,128,(ctx,w,h)=>{
    ctx.fillStyle='#ccbea0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#504b3e';ctx.font='bold 14px serif';ctx.fillText('THE ODD TIMES',6,18);ctx.fillRect(6,24,116,2);
    for(let column=0;column<3;column++)for(let row=0;row<20;row++){ctx.fillStyle=row%4?'#625c4d90':'#8f816b90';ctx.fillRect(6+column*40,31+row*4,30-(row%5)*3,1);}
    ctx.fillStyle='#7a7662';ctx.fillRect(7,33,31,29);ctx.fillStyle='#a29a7e';ctx.fillRect(10,42,24,17);ctx.fillStyle='#92725135';ctx.fillRect(93,0,8,128);
  });
  const paperPrint=mat(0xffffff);paperPrint.map=paperMap;
  const mesh=(parent,geometry,material,x=0,y=0,z=0)=>{const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;parent.add(part);return part;};
  const box=(p,w,h,d,material,x=0,y=0,z=0)=>mesh(p,new THREE.BoxGeometry(w,h,d),material,x,y,z);
  const cylinder=(p,rt,rb,h,material,x=0,y=0,z=0,segments=8,open=false)=>mesh(p,new THREE.CylinderGeometry(rt,rb,h,segments,1,open),material,x,y,z);
  const group=(name,x=0,y=0,z=0,turn=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);g.rotation.y=turn;g.userData.decorative=true;root.add(g);return g;};
  const rod=(parent,a,b,r,material,segments=6)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const part=cylinder(parent,r,r,delta.length(),material,0,0,0,segments);part.position.copy(start).add(end).multiplyScalar(.5);part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return part;};
  const paper=(p,x,y,z,turn=0,w=.26,d=.19)=>{const page=mesh(p,new THREE.PlaneGeometry(w,d),paperPrint,x,y,z);page.rotation.set(-Math.PI/2,0,turn);page.castShadow=false;return page;};

  // The battered plant fills the unused back corner, away from the shopkeeper.
  const plant=group('Old rubber plant in a chipped pot',-3.78,0,-1.08,.15);
  cylinder(plant,.24,.17,.39,m.clay,0,.195,0,9);cylinder(plant,.255,.255,.055,m.clay,0,.38,0,9);cylinder(plant,.222,.222,.012,m.soil,0,.413,0,9);
  rod(plant,[0,.41,0],[.05,1.75,0],.016,m.wood);
  const leafGeometry=new THREE.BufferGeometry();leafGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array([0,0,0,-.12,.015,.18,0,.045,.40,0,0,0,0,.045,.40,.12,.015,.18]),3));leafGeometry.computeVertexNormals();
  const leafMaterials=[m.leaf,m.leafLight,m.leafDry].map(material=>{const clone=material.clone();clone.side=THREE.DoubleSide;return clone;});
  for(let i=0;i<10;i++){
    const a=i*2.43,y=.69+i*.105,r=.15+(i%3)*.035,end=[Math.sin(a)*r,y+.10,Math.cos(a)*r];
    rod(plant,[.02,y,0],end,.008,m.wood);const leaf=mesh(plant,leafGeometry,leafMaterials[i===2?2:i%2],...end);leaf.rotation.set(-.28+(i%3)*.14,a,0);leaf.scale.setScalar(i>7?.78:1);
  }

  const chair=group('Worn waiting chair',-3.5,0,.20,.3);
  for(const x of [-.19,.19])for(const z of [-.19,.19])rod(chair,[x,.02,z],[x*.9,.46,z*.9],.023,m.teal);
  box(chair,.47,.07,.45,m.wood,0,.46,0);box(chair,.41,.025,.39,m.red,0,.505,0);
  for(const x of [-.20,.20])rod(chair,[x,.42,-.19],[x,.94,-.23],.021,m.teal);
  box(chair,.44,.25,.045,m.wood,0,.82,-.23);box(chair,.37,.19,.02,m.red,0,.82,-.20);
  paper(chair,.03,.525,.015,.3,.25,.19);
  const stool=group('Paint-spattered low stool',2.9,0,3.2,-.22);
  cylinder(stool,.24,.23,.055,m.teal,0,.44,0,10);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(stool,[Math.sin(a)*.2,.02,Math.cos(a)*.2],[Math.sin(a)*.14,.42,Math.cos(a)*.14],.025,m.wood);}

  const bin=group('Dented rubbish bin and dropped papers',-3.8,0,1.1,.1);
  cylinder(bin,.22,.18,.50,m.teal,0,.25,0,10,true);cylinder(bin,.18,.18,.012,m.dark,0,.035,0,10);
  const rim=mesh(bin,new THREE.TorusGeometry(.217,.015,4,10),m.steel,0,.50,0);rim.rotation.x=Math.PI/2;
  for(const x of [-.225,.225])box(bin,.025,.08,.12,m.rust,x,.34,0);
  for(let i=0;i<4;i++){const crumple=mesh(bin,new THREE.IcosahedronGeometry(.055,0),m.paper,-.09+i*.06,.39+(i%2)*.04,.02*(i-1));crumple.scale.set(1,.6,1.2);}
  paper(root,-3.52,.009,.70,.3);paper(root,-4.02,.011,1.24,-.27,.20,.15);
  const bottle=cylinder(bin,.025,.035,.13,m.dark,.26,.03,.23,6);bottle.rotation.z=Math.PI/2;

  // Cartons and books live along the walls, not in the aisle or the walk-in route.
  const cartons=group('Old delivery cartons',3.85,0,-3.32,-.04);
  for(const [x,y,z,w,h,d] of [[0,.22,0,.56,.44,.48],[-.03,.62,.015,.49,.35,.43],[.02,.88,.01,.40,.17,.37]]){
    box(cartons,w,h,d,m.cardboard,x,y,z);box(cartons,w*.13,.006,d+.008,m.tape,x,y+h/2+.003,z);box(cartons,w*.13,h+.008,.006,m.tape,x,y,z+d/2+.004);
    box(cartons,w*.43,h*.28,.008,m.paper,x-w*.15,y,z+d/2+.007);
    for(let line=0;line<3;line++)box(cartons,w*.25,.008,.009,m.dark,x-w*.15,y+.025-line*.022,z+d/2+.013);
  }
  const crate=group('Books and old newspapers',-3.9,0,2.04,-.13);
  box(crate,.54,.34,.40,m.wood,0,.17,0);
  for(let i=0;i<4;i++)box(crate,.50,.045,.018,m.wood,0,.04+i*.08,.211);
  for(let i=0;i<7;i++){
    const book=box(crate,.29+(i%3)*.03,.035,.23,[m.red,m.blue,m.ochre][i%3],.02,.36+i*.039,0);book.rotation.y=(i%3-1)*.10;
    box(crate,.25+(i%3)*.03,.022,.006,m.paper,.02,.36+i*.039,.118);
  }
  for(let i=0;i<4;i++)paper(crate,-.13,.642+i*.005,.06,i*.07,.30,.21);

  const sign=(name,x,y,z,width,height,map,turn=0,tilt=0)=>{
    const g=group(name,x,y,z,turn);g.rotation.z=tilt;box(g,width+.035,height+.035,.034,m.wood);
    const face=mat(0xffffff);face.map=map;mesh(g,new THREE.PlaneGeometry(width,height),face,0,0,.020);return g;
  };
  sign('Hand-painted pawn shop sign',1.82,2.48,-3.89,2.55,.60,signArt(THREE,'pawn sign','ODDLY ENOUGH','BUY · SELL · TRADE'),0,-.018);
  sign('Crooked no refunds sign',2.88,1.86,-3.90,.62,.30,signArt(THREE,'no refunds','ALL SALES','FINAL'),0,.045);
  sign('Old wall notice',-4.42,1.94,.05,.77,.72,signArt(THREE,'strange wanted','WE BUY','STRANGE THINGS','#b7bea0','#344a40'),Math.PI/2,-.025);
  sign('Faded repair notice',-4.415,2.13,1.02,.51,.58,signArt(THREE,'repair notice','REPAIRS','ASK INSIDE','#c3bca4','#424a44'),Math.PI/2,.035);
  for(const x of [.77,2.86])rod(root,[x,2.80,-3.86],[x,3.08,-3.86],.009,m.dark);

  const vent=(name,x,y,z,turn=0)=>{
    const g=group(name,x,y,z,turn);box(g,.72,.44,.075,m.dark);box(g,.76,.025,.095,m.teal,0,.22,0);box(g,.76,.025,.095,m.teal,0,-.22,0);
    for(const sx of [-.37,.37])box(g,.025,.44,.095,m.teal,sx,0,0);
    for(let i=0;i<7;i++){const fin=box(g,.69,.025,.09,m.steel,0,-.17+i*.055,.046);fin.rotation.x=.30;}
    for(const sx of [-.345,.345])for(const sy of [-.195,.195]){const screw=cylinder(g,.009,.009,.009,m.dark,sx,sy,.055,5);screw.rotation.x=Math.PI/2;}
    return g;
  };
  vent('Dusty back-wall ventilation grille',3.72,2.92,-3.88);
  vent('West-wall ventilation grille',-4.42,2.76,1.70,Math.PI/2);
  const duct=group('Old square ventilation duct',3.72,2.38,-3.84);
  box(duct,.21,.59,.16,m.teal);for(const y of [-.25,.08,.27])box(duct,.23,.022,.18,m.steel,0,y,0);

  const cable=(name,points)=>{const g=group(name);for(let i=1;i<points.length;i++)rod(g,points[i-1],points[i],.011,m.cable,5);return g;};
  cable('Loose power cable against the back skirting',[[1.95,.055,-3.80],[2.30,.035,-3.74],[2.75,.035,-3.82],[3.04,.045,-3.66],[3.48,.035,-3.71],[4.10,.07,-3.80],[4.10,.54,-3.86]]);
  cable('Cable clipped down the west wall',[[-4.36,2.72,1.22],[-4.36,2.40,1.22],[-4.36,2.12,1.27],[-4.36,1.84,1.22],[-4.36,1.42,1.22],[-4.36,.80,1.22]]);
  const socket=group('Old wall outlet',-4.38,.76,1.22,Math.PI/2);box(socket,.095,.13,.035,m.paper);for(const y of [-.025,.025])for(const x of [-.016,.016])box(socket,.007,.018,.006,m.dark,x,y,.021);
  scene.add(root);detailGroups.set(scene,root);return root;
}
