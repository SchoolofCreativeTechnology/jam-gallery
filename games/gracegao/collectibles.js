// The 8 collectibles (GLB models where we have them, plain shapes otherwise), the palm trees and
// bushes fruit grows around, and walk-over pickup.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  ITEM_TYPES, ITEMS_PER_TYPE_WET, ITEMS_PER_TYPE_DRY, ITEM_HOVER, ITEM_SPIN_SPEED,
  PICKUP_RADIUS, BEACH_WIDTH, MIN_Z, MAX_Z, WET_SAND_DEPTH, DRY_LINE_Z,
  ITEM_START_CLEARANCE, PLAYER_START_X, PLAYER_START_Z,
  TREE_COUNT, BUSH_COUNT, TREE_HEIGHT, TREE_TRUNK_COLOR, TREE_LEAF_COLOR, BUSH_COLOR,
  PLANT_MARGIN, PLANT_CLEARANCE, PLANT_SPACING, FRUIT_NEAR_PLANT,
  SHOP_COUNTER_X, SHOP_COUNTER_Z, SHOP_KEEPOUT,
  ITEM_MODELS, TREE_MODEL_URLS, TREE_MODEL_HEIGHT, TREE_MODEL_YAW,
} from './tuning.js';

// Log a missing model once per file, so a missing asset never spams the console.
const warned = new Set();
function warnOnce(url, what) {
  if (warned.has(url)) return;
  warned.add(url);
  console.info(`${what} not found; using fallback shapes.`);
}

// SECTION: turning a loaded GLB into a reusable prototype. We scale it (longest side, or height for
// trees) and shift it so the prototype's origin is the model's centre (items) or its base (trees).
// Clones of the prototype then behave exactly like the old plain-shape meshes.
function protoFrom(scene3, target, byHeight, yaw, baseAtZero) {
  const holder = new THREE.Group();
  holder.add(scene3);
  scene3.rotation.y = yaw;
  scene3.updateMatrixWorld(true);
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(scene3).getSize(size);
  const dim = byHeight ? size.y : Math.max(size.x, size.y, size.z);
  scene3.scale.setScalar(target / (dim || 1));
  scene3.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene3);
  const centre = box.getCenter(new THREE.Vector3());
  scene3.position.x -= centre.x;
  scene3.position.z -= centre.z;
  scene3.position.y -= baseAtZero ? box.min.y : centre.y;
  return holder;
}

// One geometry per item id, so no shape is built twice.
function geometryFor(id) {
  switch (id) {
    case 'shell': return new THREE.SphereGeometry(0.34, 10, 8).scale(1, 0.55, 1);
    case 'pearl': return new THREE.SphereGeometry(0.22, 14, 10);
    case 'coral': return new THREE.IcosahedronGeometry(0.3, 0);
    case 'seaglass': return new THREE.OctahedronGeometry(0.3, 0);
    case 'seasalt': return new THREE.BoxGeometry(0.32, 0.32, 0.32);
    case 'coconut': return new THREE.SphereGeometry(0.32, 12, 10).scale(1, 0.85, 1);
    case 'berries': return new THREE.IcosahedronGeometry(0.24, 0);
    case 'banana': return new THREE.TorusGeometry(0.22, 0.08, 8, 16, Math.PI);
    default: return new THREE.BoxGeometry(0.3, 0.3, 0.3);
  }
}

const rand = (a, b) => a + Math.random() * (b - a);

export function createCollectibles(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const plantsGroup = new THREE.Group();
  scene.add(plantsGroup);

  const geos = {};
  const mats = {};
  for (const t of ITEM_TYPES) {
    geos[t.id] = geometryFor(t.id);
    mats[t.id] = new THREE.MeshStandardMaterial({ color: t.color });
  }

  let items = [];        // { mesh, type }
  let plants = [];       // { x, z } — every tree and bush on the dry land (fruit grows around these)
  let trees = [];        // { group, x, z } — palms only, so their look can swap when a model loads
  const itemProtos = {}; // item id -> ready-to-clone model, once its GLB has loaded
  const palmProtos = []; // loaded palm prototypes; one is picked at random per tree

  // SECTION: palm trees and bushes. They are decoration only (no collision for M2), but fruit only
  // appears around them, so the dry land reads as an orchard rather than open sand.
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, TREE_HEIGHT, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: TREE_TRUNK_COLOR });
  const leafGeo = new THREE.SphereGeometry(0.95, 8, 6).scale(1, 0.22, 1);
  const leafMat = new THREE.MeshStandardMaterial({ color: TREE_LEAF_COLOR });
  const bushGeo = new THREE.IcosahedronGeometry(0.7, 0).scale(1, 0.85, 1);
  const bushMat = new THREE.MeshStandardMaterial({ color: BUSH_COLOR });

  // Fills one tree's group with either a clone of a loaded palm model or the old trunk+leaves shape.
  // Called again for every tree when a palm model finishes loading, so trees swap in place.
  function buildTree(ref) {
    const g = ref.group;
    for (const c of g.children.slice()) g.remove(c);
    if (palmProtos.length) {
      const palm = palmProtos[Math.floor(Math.random() * palmProtos.length)];
      g.add(palm.clone(true));
      return;
    }
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = TREE_HEIGHT / 2;
    trunk.rotation.z = 0.08;
    g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.cos(a) * 0.55, TREE_HEIGHT + 0.15, Math.sin(a) * 0.55);
      leaf.rotation.y = -a;
      leaf.rotation.z = -0.35;
      g.add(leaf);
    }
  }

  function addTree(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rand(0, Math.PI * 2);
    plantsGroup.add(g);
    const ref = { group: g, x, z };
    trees.push(ref);
    buildTree(ref);
    plants.push({ x, z });
  }

  function addBush(x, z) {
    const b = new THREE.Mesh(bushGeo, bushMat);
    b.position.set(x, 0.55, z);
    b.rotation.y = rand(0, Math.PI * 2);
    plantsGroup.add(b);
    plants.push({ x, z });
  }

  // Plants live on the dry land, clear of the girl's start, of the shop, and of each other.
  function plantSpot() {
    let x = 0; let z = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = rand(-BEACH_WIDTH / 2 + PLANT_MARGIN, BEACH_WIDTH / 2 - PLANT_MARGIN);
      z = rand(DRY_LINE_Z + PLANT_MARGIN, MAX_Z - PLANT_MARGIN);
      const nearStart = Math.hypot(x - PLAYER_START_X, z - PLAYER_START_Z) < PLANT_CLEARANCE;
      const nearShop = Math.hypot(x - SHOP_COUNTER_X, z - SHOP_COUNTER_Z) < SHOP_KEEPOUT;
      const crowded = plants.some((p) => Math.hypot(x - p.x, z - p.z) < PLANT_SPACING);
      if (!nearStart && !nearShop && !crowded) break;
    }
    return [x, z];
  }

  function buildPlants() {
    for (const p of plantsGroup.children.slice()) plantsGroup.remove(p);
    plants = [];
    trees = [];
    for (let i = 0; i < TREE_COUNT; i++) { const [x, z] = plantSpot(); addTree(x, z); }
    for (let i = 0; i < BUSH_COUNT; i++) { const [x, z] = plantSpot(); addBush(x, z); }
  }

  // SECTION: spawning — sea items go on the wet sand, fruit goes under and beside the plants.
  function zoneRect(zone, margin) {
    const halfW = BEACH_WIDTH / 2 - margin;
    if (zone === 'wet') {
      return { minX: -halfW, maxX: halfW, minZ: MIN_Z + margin, maxZ: MIN_Z + WET_SAND_DEPTH - margin };
    }
    return { minX: -halfW, maxX: halfW, minZ: MIN_Z + WET_SAND_DEPTH + margin, maxZ: MAX_Z - margin };
  }

  // The visual for one item: a clone of the loaded model if we have it, else the plain shape.
  // Models get a wrapper group so they spin without tipping over; shapes keep the old random tilt.
  function makeVisual(type) {
    const proto = itemProtos[type.id];
    if (proto) {
      const wrapper = new THREE.Group();
      wrapper.add(proto.clone(true));
      return wrapper;
    }
    const m = new THREE.Mesh(geos[type.id], mats[type.id]);
    m.rotation.x = rand(0, Math.PI);
    return m;
  }

  function add(type, x, z) {
    const m = makeVisual(type);
    m.position.set(x, ITEM_HOVER, z);
    group.add(m);
    items.push({ mesh: m, type });
  }

  // A model finished loading: swap the plain shapes on the beach for it right now, keeping each
  // item exactly where it was so nothing teleports into (or out of) the girl's path.
  function swapItems(id) {
    for (const it of items) {
      if (it.type.id !== id) continue;
      const pos = it.mesh.position.clone();
      const spin = it.mesh.rotation.y;
      group.remove(it.mesh);
      const m = makeVisual(it.type);
      m.position.copy(pos);
      m.rotation.y = spin;
      group.add(m);
      it.mesh = m;
    }
  }

  // SECTION: background loading of the GLB models. Every load has a plain-shape fallback already in
  // the scene, so the game is playable from the first frame and models pop in when they are ready.
  const loader = new GLTFLoader();
  for (const [id, cfg] of Object.entries(ITEM_MODELS)) {
    loader.load(
      cfg.url,
      (gltf) => { itemProtos[id] = protoFrom(gltf.scene, cfg.size, false, cfg.yaw, false); swapItems(id); },
      undefined,
      () => warnOnce(cfg.url, `${id} model`)
    );
  }
  for (const url of TREE_MODEL_URLS) {
    loader.load(
      url,
      (gltf) => {
        palmProtos.push(protoFrom(gltf.scene, TREE_MODEL_HEIGHT, true, TREE_MODEL_YAW, true));
        for (const ref of trees) buildTree(ref);   // re-dress every tree that is already standing
      },
      undefined,
      () => warnOnce(url, 'palm tree model')
    );
  }

  // Nothing may spawn on top of where the girl starts, or she'd collect it at once.
  function spot(r) {
    let x = 0; let z = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = rand(r.minX, r.maxX);
      z = rand(r.minZ, r.maxZ);
      if (Math.hypot(x - PLAYER_START_X, z - PLAYER_START_Z) > ITEM_START_CLEARANCE) break;
    }
    return [x, z];
  }

  // Fruit always lands in the shade of a tree or bush, never out in the open.
  function fruitSpot() {
    if (!plants.length) return spot(zoneRect('dry', 0.9));
    let x = 0; let z = 0;
    for (let tries = 0; tries < 30; tries++) {
      const p = plants[Math.floor(Math.random() * plants.length)];
      const a = rand(0, Math.PI * 2);
      const r = rand(0, FRUIT_NEAR_PLANT);
      x = p.x + Math.cos(a) * r;
      z = p.z + Math.sin(a) * r;
      const inDry = z > DRY_LINE_Z + 0.4 && z < MAX_Z - 0.4 && Math.abs(x) < BEACH_WIDTH / 2 - 0.4;
      const nearStart = Math.hypot(x - PLAYER_START_X, z - PLAYER_START_Z) < ITEM_START_CLEARANCE;
      const nearShop = Math.hypot(x - SHOP_COUNTER_X, z - SHOP_COUNTER_Z) < SHOP_KEEPOUT * 0.7;
      if (inDry && !nearStart && !nearShop) break;
    }
    return [x, z];
  }

  function reset() {
    for (const it of items) group.remove(it.mesh);
    items = [];
    buildPlants();
    for (const t of ITEM_TYPES) {
      const count = t.zone === 'wet' ? ITEMS_PER_TYPE_WET : ITEMS_PER_TYPE_DRY;
      const r = zoneRect(t.zone, 0.9);
      for (let i = 0; i < count; i++) {
        const [x, z] = t.zone === 'wet' ? spot(r) : fruitSpot();
        add(t, x, z);
      }
    }
  }

  // A dropped item lands a little behind the girl, but stays on the beach.
  function spawnAt(id, x, z) {
    const type = ITEM_TYPES.find((t) => t.id === id);
    if (!type) return;
    const lim = BEACH_WIDTH / 2 - 0.5;
    add(type, Math.max(-lim, Math.min(lim, x)), Math.max(MIN_Z + 0.5, Math.min(MAX_Z - 0.5, z)));
  }

  function removeAt(i) {
    group.remove(items[i].mesh);
    items[i] = items[items.length - 1];
    items.pop();
  }

  // SECTION: update — spin the items and pick one up when the girl walks into it.
  function update(dt, player, onPickup) {
    for (const it of items) it.mesh.rotation.y += ITEM_SPIN_SPEED * dt;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i].mesh.position;
      const dx = p.x - player.position.x;
      const dz = p.z - player.position.z;
      if (Math.hypot(dx, dz) < PICKUP_RADIUS + player.radius) {
        const type = items[i].type;
        removeAt(i);
        onPickup(type);
      }
    }
  }

  // SECTION: the rising tide washes away everything on the wet sand.
  function clearSeaItems() {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].type.zone === 'wet') removeAt(i);
    }
  }

  return { group, update, reset, spawnAt, clearSeaItems, count: () => items.length };
}
