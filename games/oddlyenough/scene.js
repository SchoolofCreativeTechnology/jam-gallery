// scene.js — the gray-box pawn shop: room, counter, strange item, customer, warm light, fixed isometric camera.

import * as THREE from 'three';
import { createObject, signTexture, floorTexture } from './objects.js';

// ---- Palette: every colour in the shop lives here, so the look retunes in one place ----
const C_BACKGROUND = '#192e28';
const C_FLOOR = '#6b5540';
const C_WALL = '#5a6c56';
const C_WALL_TRIM = '#4b3d2c';
const C_COUNTER = '#455548';
const C_COUNTER_TOP = '#9a9473';
const C_PEDESTAL = '#2a241f';
const C_ITEM = '#c86bff';
const C_ITEM_GLOW = '#7b2fd6';
const C_BODY = '#5c5763';
const C_HEAD = '#c6a077';
const C_PROP = '#4e4234';
const C_PROP_DARK = '#39301f';
const C_LAMP_SHADE = '#c9a35f';
const C_LAMP_BULB = '#ffd28a';
const C_KEY_LIGHT = '#ffd9a8';
const C_AMBIENT = '#6b5643';
const C_COUNTER_LIGHT = '#ffd2a0';

// ---- Layout: room, counter, item and customer positions ----
const ROOM_W = 11;
const ROOM_D = 14;
const WALL_H = 3.6;
const WALL_T = 0.24;
const FLOOR_T = 0.2;

const COUNTER_W = 3.4;
const COUNTER_D = 1.0;
const COUNTER_H = 1.0;
const COUNTER_TOP_T = 0.12;
const COUNTER_TOP_Y = COUNTER_H + COUNTER_TOP_T; // 1.12, the surface things sit on

const ITEM_X = -0.45;
const ITEM_Z = -0.05;
const PEDESTAL_R = 0.3;
const PEDESTAL_H = 0.16;
const ITEM_H = 0.42;
const ITEM_EMISSIVE = 0.35;
const ITEM_EMISSIVE_HOVER = 1.1;
const ITEM_HOVER_SCALE = 1.08;

const CUSTOMER_X = 0.5;
const CUSTOMER_Z = -1.9; // far side of the counter from the camera

const CAM_POS = [6.8, 7.0, 9.4];
const CAM_TARGET = [0, 1.0, -1.8]; // 36 degrees above the horizon, never moves
const CAM_FOV = 45;
const CAM_NEAR = 0.1;
const CAM_FAR = 100;

// ---- Small helpers ----
function material(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.92,
    metalness: 0,
    ...extra,
  });
}

function shadowed(mesh, cast = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Build the shop. The caller owns the frame loop: call render() yourself.
 * Returns { scene, camera, renderer, resize, render, setItemVisible,
 *           setCustomerPresent, onItemClick, setItemHover }.
 */
export function createScene(container, options = {}) {
  const host = container && typeof container.appendChild === 'function' ? container : document.body;

  // ---- Scene, camera, renderer ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C_BACKGROUND);

  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, CAM_NEAR, CAM_FAR);
  camera.position.set(CAM_POS[0], CAM_POS[1], CAM_POS[2]);
  camera.lookAt(CAM_TARGET[0], CAM_TARGET[1], CAM_TARGET[2]);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in r186 and logs a warning
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  // ---- Materials (flat colours only) ----
  const mats = {
    floor: material('#ffffff', {map: floorTexture()}),
    wall: material(C_WALL),
    trim: material(C_WALL_TRIM),
    counter: material(C_COUNTER),
    counterTop: material(C_COUNTER_TOP),
    pedestal: material(C_PEDESTAL),
    prop: material(C_PROP),
    propDark: material(C_PROP_DARK),
    body: material(C_BODY),
    head: material(C_HEAD),
    lampShade: material(C_LAMP_SHADE, { flatShading: true }),
    lampBulb: material(C_LAMP_BULB, { emissive: new THREE.Color(C_LAMP_BULB), emissiveIntensity: 1.4 }),
  };
  const itemMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(C_ITEM),
    emissive: new THREE.Color(C_ITEM_GLOW),
    emissiveIntensity: ITEM_EMISSIVE,
    roughness: 0.35,
    metalness: 0.1,
  });

  // ---- Room: floor and two back walls, open toward the camera ----
  const floor = shadowed(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, FLOOR_T, ROOM_D), mats.floor), false);
  floor.position.set(0, -FLOOR_T / 2, 0);
  scene.add(floor);

  const backWall = shadowed(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, WALL_H, WALL_T), mats.wall), false);
  backWall.position.set(0, WALL_H / 2, -ROOM_D / 2 + WALL_T / 2);
  scene.add(backWall);

  const leftWall = shadowed(new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, ROOM_D), mats.wall), false);
  leftWall.position.set(-ROOM_W / 2 + WALL_T / 2, WALL_H / 2, 0);
  scene.add(leftWall);

  // Skirting, so the walls meet the floor instead of floating.
  const skirtBack = shadowed(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.22, 0.06), mats.trim), false);
  skirtBack.position.set(0, 0.11, backWall.position.z + WALL_T / 2);
  scene.add(skirtBack);
  const skirtLeft = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, ROOM_D), mats.trim), false);
  skirtLeft.position.set(leftWall.position.x + WALL_T / 2, 0.11, 0);
  scene.add(skirtLeft);

  // ---- Counter, at waist height in the middle of the room ----
  const counter = shadowed(new THREE.Mesh(new THREE.BoxGeometry(COUNTER_W, COUNTER_H, COUNTER_D), mats.counter));
  counter.position.set(0, COUNTER_H / 2, 0);
  scene.add(counter);

  const counterTop = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(COUNTER_W + 0.24, COUNTER_TOP_T, COUNTER_D + 0.24), mats.counterTop)
  );
  counterTop.position.set(0, COUNTER_H + COUNTER_TOP_T / 2, 0);
  scene.add(counterTop);

  // ---- The spot on the counter, and the strange object on it ----
  const itemGroup = new THREE.Group();
  itemGroup.position.set(ITEM_X, 0, ITEM_Z);
  scene.add(itemGroup);

  const pedestal = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(PEDESTAL_R, PEDESTAL_R + 0.04, PEDESTAL_H, 20), mats.pedestal)
  );
  pedestal.position.y = COUNTER_TOP_Y + PEDESTAL_H / 2;
  itemGroup.add(pedestal);

  let itemMesh = createObject({form:'radio',color:'#d39d4a'});
  itemMesh.position.y = COUNTER_TOP_Y + PEDESTAL_H;
  itemMesh.rotation.y = .18;
  itemGroup.add(itemMesh);
  let currentItemId = null;

  // ---- Customer: box body with a distinct head block, dimmer than the item ----
  const customer = new THREE.Group();
  customer.position.set(CUSTOMER_X, 0, CUSTOMER_Z);
  customer.rotation.y = -0.14;
  scene.add(customer); // present by default; setCustomerPresent(false) clears them

  const part = (mesh) => {
    customer.add(shadowed(mesh));
    return mesh;
  };

  const legs = part(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.75, 0.3), mats.body));
  legs.position.y = 0.375;

  const torso = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 12), mats.body));
  torso.position.y = 1.15;

  const shoulders = part(new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.34), mats.body));
  shoulders.position.y = 1.5;

  for (const side of [-1, 1]) {
    const arm = part(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.15), mats.body));
    arm.position.set(side * 0.37, 1.2, 0);
    arm.rotation.z = side * 0.08;
  }

  const head = part(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.34), mats.head));
  head.position.y = 1.84; // distinct head block, clear of the shoulders

  // ---- Background props: shelving, stock and crates, all dim and out of the way ----
  function makeShelf(width, height, depth) {
    const shelf = new THREE.Group();
    const upright = 0.09;
    const slab = 0.08;
    for (const side of [-1, 1]) {
      const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(upright, height, depth), mats.propDark));
      post.position.set(side * (width / 2 - upright / 2), height / 2, 0);
      shelf.add(post);
    }
    for (const y of [0.5, 1.15, 1.8]) {
      const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(width, slab, depth), mats.prop));
      board.position.y = y;
      shelf.add(board);
    }
    return shelf;
  }

  const shelfBack = makeShelf(2.4, 2.2, 0.5);
  shelfBack.position.set(2.7, 0, -6.5);
  scene.add(shelfBack);
  const shelfLeft = makeShelf(2.4, 2.2, 0.5);
  shelfLeft.position.set(-5.0, 0, 0.6);
  shelfLeft.rotation.y = Math.PI / 2;
  scene.add(shelfLeft);

  // Stock on the shelves: small dim boxes, so the shop reads as cluttered.
  const stock = [
    [2.2, 0.72, -6.5, 0.42, 0.36, 0.36],
    [3.3, 0.69, -6.5, 0.5, 0.3, 0.42],
    [2.6, 1.35, -6.5, 0.36, 0.32, 0.34],
    [3.4, 1.4, -6.5, 0.44, 0.42, 0.4],
    [-5.0, 0.72, 1.4, 0.4, 0.32, 0.38],
    [-5.0, 1.35, 0.1, 0.44, 0.4, 0.36],
  ];
  for (const [x, y, z, w, h, d] of stock) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.propDark);
    box.position.set(x, y, z);
    box.rotation.y = 0.2;
    scene.add(box);
  }

  const crates = [
    [-4.3, 0.35, -5.5, 0.7],
    [-4.25, 1.02, -5.55, 0.62],
    [-3.45, 0.3, -5.9, 0.6],
  ];
  for (const [x, y, z, size] of crates) {
    const crate = shadowed(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats.prop));
    crate.position.set(x, y, z);
    crate.rotation.y = 0.15;
    scene.add(crate);
  }

  // ---- Hanging lamp above the counter: the cord runs up out of frame ----
  const lampGroup = new THREE.Group();
  lampGroup.position.set(ITEM_X, 0, ITEM_Z);
  scene.add(lampGroup);

  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 4.4, 6), mats.propDark);
  cord.position.y = 4.95; // 2.75 up to 7.15, past the top of the frame
  lampGroup.add(cord);

  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.36, 14, 1, true), mats.lampShade);
  shade.position.y = 2.55;
  lampGroup.add(shade);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mats.lampBulb);
  bulb.position.y = 2.4;
  lampGroup.add(bulb);

  // ---- Warm lighting: dim ambient fill, warm key, a pool of light on the item ----
  scene.add(new THREE.AmbientLight(new THREE.Color(C_AMBIENT), 1.0));

  const keyLight = new THREE.DirectionalLight(new THREE.Color(C_KEY_LIGHT), 1.9);
  keyLight.position.set(4.5, 8.5, 6.5);
  keyLight.target.position.set(0, 1, -0.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -9;
  keyLight.shadow.camera.right = 9;
  keyLight.shadow.camera.top = 9;
  keyLight.shadow.camera.bottom = -9;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const counterLight = new THREE.SpotLight(new THREE.Color(C_COUNTER_LIGHT), 12, 8, 0.5, 0.6, 2);
  counterLight.position.set(ITEM_X, 2.45, ITEM_Z);
  counterLight.target.position.set(ITEM_X, COUNTER_TOP_Y, ITEM_Z);
  counterLight.castShadow = true;
  counterLight.shadow.mapSize.set(1024, 1024);
  counterLight.shadow.camera.near = 0.4;
  counterLight.shadow.camera.far = 6;
  counterLight.shadow.bias = -0.0005;
  counterLight.shadow.normalBias = 0.02;
  scene.add(counterLight);
  scene.add(counterLight.target);

  // Worn shop fittings, ordinary clutter and cool daylight.
  const windowMat=material('#8fb6ac',{emissive:'#547e78',emissiveIntensity:.3,roughness:.3});
  const decorBox=(w,h,d,mat,x,y,z)=>{const m=shadowed(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat));m.position.set(x,y,z);scene.add(m);return m;};
  decorBox(3.0,2.15,.08,mats.trim,-2.8,2.0,-6.78);
  decorBox(2.8,1.95,.09,windowMat,-2.8,2.0,-6.70);
  decorBox(.08,2.0,.12,mats.trim,-2.8,2.0,-6.62);decorBox(2.8,.08,.12,mats.trim,-2.8,2.0,-6.62);
  for(let i=0;i<8;i++)decorBox(.09,2,.13,mats.propDark,-4.1+i*.37,2,-6.58);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6),material('#ffffff',{map:signTexture('ODDLY ENOUGH\nBUY · SELL · WONDER')}));sign.position.set(.65,2.7,-6.74);scene.add(sign);
  const poster=new THREE.Mesh(new THREE.PlaneGeometry(.75,1.05),material('#ffffff',{map:signTexture('NO REFUNDS\nON CURSES',{background:'#ae754e',color:'#f1dfb5'})}));poster.position.set(4.55,2.35,-6.73);scene.add(poster);
  // A register, ledger, brass bell and a paper bag, all within reach.
  decorBox(.52,.25,.44,mats.propDark,1.18,1.28,.05);decorBox(.45,.25,.1,mats.trim,1.18,1.55,-.12).rotation.x=-.18;
  decorBox(.3,.13,.025,windowMat,1.18,1.56,-.055);decorBox(.55,.04,.37,material('#b4b08e'),-.98,1.2,.05);
  const bell=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),material('#b89b55',{metalness:.65}));bell.scale.y=.5;bell.position.set(.42,1.2,.24);scene.add(bell);
  for(let i=0;i<6;i++)decorBox(.22,.6,.7,material(['#655543','#817052','#5d725e'][i%3]),-1.27+i*.5,.55,.57);
  // Filled bookcase, small sideboard, records and assorted stock.
  const colors=['#8b6347','#788364','#a79a6a','#4a6f6e','#9f8565'];
  for(let i=0;i<28;i++){const row=Math.floor(i/10),col=i%10;decorBox(.13+(i%3)*.04,.23+(i%4)*.07,.32,material(colors[i%5]),1.65+col*.23,.66+row*.65,-6.43);}
  decorBox(1.8,.85,.8,mats.counter,-3.8,.43,-3.9);decorBox(1.9,.08,.9,mats.counterTop,-3.8,.9,-3.9);
  for(let i=0;i<3;i++){const o=createObject({form:['clock','camera','duck'][i],color:colors[i]});o.position.set(-4.4+i*.6,.95,-3.9);o.scale.setScalar(.8);scene.add(o);}
  // Potted plant, rug, stack of battered storage boxes.
  const pot=shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.28,.19,.48,9),material('#915e47')));pot.position.set(-4.6,.24,-1.9);scene.add(pot);
  for(let i=0;i<7;i++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.22,.75,4),material(i%2?'#526849':'#738061'));leaf.position.set(-4.6+Math.sin(i*2)*.22,.75+i*.12,-1.9+Math.cos(i*2)*.22);leaf.rotation.z=Math.sin(i)*.6;scene.add(leaf);}
  decorBox(2.1,.025,1.25,material('#655c47'),.3,.02,-2.0);
  const blueLight=new THREE.DirectionalLight('#a4d1c9',1.0);blueLight.position.set(-4,4,-5);scene.add(blueLight);
  scene.add(new THREE.HemisphereLight('#a9bfa6','#332c20',1.1));
  // Eyes, nose, shoes and hair turn the old grey box into a readable person.
  const facePart=(w,h,d,color,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y,z);customer.add(m);return m;};
  facePart(.42,.12,.39,'#40352b',0,2.04,0);facePart(.085,.10,.09,'#b28868',0,1.83,.21);
  for(const side of [-1,1]){facePart(.055,.035,.02,'#292c23',side*.085,1.89,.18);facePart(.19,.13,.39,'#342f28',side*.14,.07,.05);facePart(.14,.15,.15,'#bd9878',side*.37,.89,0);}
  facePart(.1,.055,.03,'#735c45',0,1.72,.18);
  const hat=facePart(.52,.06,.46,'#6d6c4c',0,2.08,0);const hatTop=facePart(.35,.19,.3,'#6d6c4c',0,2.2,0);
  let emotion='neutral',status='active',night=false,closeCamera=false;
  const desiredPosition=new THREE.Vector3(...CAM_POS),desiredTarget=new THREE.Vector3(...CAM_TARGET),lookTarget=new THREE.Vector3(...CAM_TARGET);
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastTime=performance.now();

  // ---- Pointer: click the object to inspect, hover to highlight ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let itemVisible = true;
  let hovering = false;
  let clickHandler = null;

  function aimAt(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    camera.updateMatrixWorld();
    itemMesh.updateWorldMatrix(true, false);
    raycaster.setFromCamera(pointer, camera);
    return true;
  }

  function pointerOverItem(event) {
    // Only the object on the counter is clickable.
    if (!itemVisible || !aimAt(event)) return false;
    return raycaster.intersectObject(itemMesh, true).length > 0;
  }

  renderer.domElement.addEventListener(
    'pointermove',
    (event) => {
      setItemHover(pointerOverItem(event));
    },
    { passive: true }
  );

  renderer.domElement.addEventListener('pointerleave', () => setItemHover(false), { passive: true });

  renderer.domElement.addEventListener('click', (event) => {
    if (pointerOverItem(event) && typeof clickHandler === 'function') clickHandler();
  });

  // ---- Public API ----
  function measure() {
    const w = host.clientWidth || window.innerWidth || 0;
    const h = host.clientHeight || window.innerHeight || 0;
    // Never hand the camera or the renderer a zero.
    return { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
  }

  function resize() {
    const { w, h } = measure();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
  }

  function render() {
    const now=performance.now(),dt=Math.min(.1,(now-lastTime)/1000);lastTime=now;
    camera.position.lerp(desiredPosition,reduceMotion?1:1-Math.exp(-dt*5));lookTarget.lerp(desiredTarget,reduceMotion?1:1-Math.exp(-dt*5));camera.lookAt(lookTarget);
    if(!reduceMotion){customer.position.y=Math.sin(now*.0018)*.012;head.rotation.z=Math.sin(now*.001)*.025+(emotion==='doubt'?.12:0);customer.rotation.y+=( (emotion==='pleased'?-.03:emotion==='doubt'?-.25:-.14)-customer.rotation.y)*.04;}
    renderer.render(scene, camera);
  }
  function setItem(item){
    if(currentItemId===item.id)return;currentItemId=item.id;
    itemGroup.remove(itemMesh);itemMesh.traverse(n=>{n.geometry?.dispose();if(n.material){n.material.map?.dispose();n.material.dispose();}});
    itemMesh=createObject(item);itemMesh.position.y=COUNTER_TOP_Y+PEDESTAL_H;itemMesh.rotation.y=.18;itemMesh.visible=itemVisible;itemGroup.add(itemMesh);
  }
  function setCustomer(data){mats.body.color.set(data.color||'#6f7358');const style=[...data.id].reduce((n,c)=>n+c.charCodeAt(0),0);hat.visible=hatTop.visible=style%2===0;customer.position.z=CUSTOMER_Z;}
  function setReaction(value,nextStatus){emotion=value;status=nextStatus;}
  function setNight(on){if(on===night)return;night=on;blueLight.color.set(on?'#7a95c1':'#a4d1c9');blueLight.intensity=on?.45:1;keyLight.intensity=on?1.15:1.9;windowMat.color.set(on?'#324a59':'#8fb6ac');windowMat.emissive.set(on?'#365165':'#547e78');}
  function toggleCamera(){closeCamera=!closeCamera;desiredPosition.set(...(closeCamera?[3.1,3.2,4.8]:CAM_POS));desiredTarget.set(...(closeCamera?[0,1.35,-.65]:CAM_TARGET));return closeCamera;}


  function setItemVisible(visible) {
    itemVisible = !!visible;
    itemMesh.visible = itemVisible;
    if (!itemVisible) setItemHover(false);
  }

  function setCustomerPresent(present) {
    customer.visible = !!present;
  }

  function onItemClick(callback) {
    clickHandler = typeof callback === 'function' ? callback : null;
  }

  function setItemHover(on) {
    const next = !!on;
    if (next === hovering) return;
    hovering = next;
    itemMesh.traverse(node => {if(node.material?.emissive) {node.material.emissive.set('#c8b475');node.material.emissiveIntensity=hovering?.13:0;}});
    itemMesh.scale.setScalar(hovering ? ITEM_HOVER_SCALE : 1);
    document.body.style.cursor = hovering ? 'pointer' : '';
  }

  setItemVisible(true);
  setCustomerPresent(true);
  resize();

  return {
    scene,
    camera,
    renderer,
    resize,
    render,
    setItemVisible,
    setCustomerPresent,
    onItemClick,
    setItemHover,
    setItem, setCustomer, setReaction, setNight, toggleCamera,
  };
}
