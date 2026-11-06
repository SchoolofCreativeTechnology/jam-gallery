// Scene, angled top-down camera, day-cycle state machine and loop for the tidal-island arena dodger (M2/M3).
import * as THREE from 'three';
import * as T from './tuning.js';
import { createPlayer } from './player.js';
import { createCollectibles } from './collectibles.js';
import { createWaves } from './waves.js';
import { createTide } from './tide.js';
import { createShop } from './shop.js';
import { createUI } from './ui.js';

// SECTION: renderer and camera.
const scene = new THREE.Scene();
scene.background = new THREE.Color(T.SKY_COLOR);
scene.fog = new THREE.Fog(T.SKY_COLOR, 45, 95);

const camera = new THREE.PerspectiveCamera(T.CAMERA_FOV, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, T.CAMERA_HEIGHT, T.CAMERA_BACK);
camera.lookAt(0, T.CAMERA_LOOK_HEIGHT, T.CAMERA_LOOK_AHEAD);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(new THREE.HemisphereLight('#ffffff', '#8fb6c9', 1.6));
const sun = new THREE.DirectionalLight('#fff3d6', 2.0);
sun.position.set(6, 14, 8);
scene.add(sun);

// SECTION: the beach — a dry-sand island with a wet-sand strip along the sea edge.
function sandPlane(width, depth, zCenter, color, y) {
  const p = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color })
  );
  p.rotation.x = -Math.PI / 2;
  p.position.set(0, y, zCenter);
  scene.add(p);
  return p;
}
const dryDepth = T.BEACH_LENGTH - T.WET_SAND_DEPTH;
sandPlane(T.BEACH_WIDTH, dryDepth, T.DRY_LINE_Z + dryDepth / 2, T.DRY_SAND_COLOR, 0);
sandPlane(T.BEACH_WIDTH, T.WET_SAND_DEPTH, T.MIN_Z + T.WET_SAND_DEPTH / 2, T.WET_SAND_COLOR, 0.01);

// SECTION: the locked islet across the water. Plain shapes only — visible from the beach, but there is
// no way to walk there yet (that is a Stretch goal). A small padlock and a world-pinned "Locked" label
// make its status clear.
const islet = new THREE.Group();
const isletSand = new THREE.Mesh(
  new THREE.CylinderGeometry(T.ISLET_SAND_RADIUS, T.ISLET_SAND_RADIUS * 1.15, T.ISLET_SAND_HEIGHT, 24),
  new THREE.MeshStandardMaterial({ color: T.ISLET_SAND_COLOR })
);
isletSand.position.y = T.ISLET_SAND_HEIGHT / 2;
const isletGrass = new THREE.Mesh(
  new THREE.SphereGeometry(T.ISLET_GRASS_RADIUS, 16, 12),
  new THREE.MeshStandardMaterial({ color: T.ISLET_GRASS_COLOR })
);
isletGrass.scale.y = 0.6;
isletGrass.position.y = T.ISLET_SAND_HEIGHT;
const isletTrunk = new THREE.Mesh(
  new THREE.CylinderGeometry(0.08, 0.12, 1.3, 8),
  new THREE.MeshStandardMaterial({ color: T.ISLET_PALM_TRUNK_COLOR })
);
isletTrunk.position.set(0.9, T.ISLET_SAND_HEIGHT + 0.65, 0);
const isletLeaves = new THREE.Mesh(
  new THREE.ConeGeometry(0.7, 0.7, 6),
  new THREE.MeshStandardMaterial({ color: T.ISLET_PALM_LEAF_COLOR })
);
isletLeaves.position.set(0.9, T.ISLET_SAND_HEIGHT + 1.4, 0);
// The padlock: a small body with a ring shackle, floating above the islet.
const lockBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 0.56, 0.28),
  new THREE.MeshStandardMaterial({ color: T.ISLET_LOCK_COLOR })
);
lockBody.position.set(0, 1.85, 0);
const lockShackle = new THREE.Mesh(
  new THREE.TorusGeometry(0.24, 0.08, 8, 16),
  new THREE.MeshStandardMaterial({ color: T.ISLET_LOCK_COLOR })
);
lockShackle.position.set(0, 2.15, 0);
islet.add(isletSand, isletGrass, isletTrunk, isletLeaves, lockBody, lockShackle);
islet.position.set(T.ISLET_X, 0, T.ISLET_Z);
scene.add(islet);
const isletAnchor = new THREE.Vector3(T.ISLET_X, T.ISLET_LABEL_Y, T.ISLET_Z);

// SECTION: the game pieces.
const player = createPlayer(scene);
const collectibles = createCollectibles(scene);
const waves = createWaves(scene);
const tide = createTide(scene);
const shop = createShop(scene);

// SECTION: the day. One day runs title -> low_tide -> high_tide -> crafting -> day_end, then round again.
const state = {
  phase: 'title',
  inventory: {},
  total: 0,        // items in the satchel today
  money: 0,        // carried across days
  goods: null,     // what was crafted today
};

function emptyInventory() {
  const inv = {};
  for (const t of T.ITEM_TYPES) inv[t.id] = 0;
  return inv;
}

// SECTION: crafting — fruit becomes ice cream, sea items become jewelry; their value is the sell price.
function goodsFrom(inv) {
  const iceCream = { count: 0, value: 0 };
  const jewelry = { count: 0, value: 0 };
  for (const t of T.ITEM_TYPES) {
    const n = inv[t.id] || 0;
    if (!n) continue;
    const basket = t.zone === 'dry' ? iceCream : jewelry;
    basket.count += n;
    basket.value += n * t.value * (t.zone === 'dry' ? T.ICE_CREAM_VALUE_MULT : T.JEWELRY_VALUE_MULT);
  }
  iceCream.value = Math.round(iceCream.value);
  jewelry.value = Math.round(jewelry.value);
  return { iceCream, jewelry, total: iceCream.value + jewelry.value };
}

const ui = createUI({
  onStart: startDay,
  onRestart: startDay,
  onNextDay: startDay,
});

// A dropped item lands a little behind her, so she has to walk back for it.
function dropRandomItem() {
  const owned = T.ITEM_TYPES.filter((t) => state.inventory[t.id] > 0);
  if (!owned.length) return;
  const type = owned[Math.floor(Math.random() * owned.length)];
  state.inventory[type.id] -= 1;
  state.total -= 1;
  const a = Math.random() * Math.PI * 2;
  collectibles.spawnAt(type.id, player.position.x + Math.cos(a) * 1.6, player.position.z + 1.2);
  ui.updateInventory(state.inventory, state.total);
  ui.setMessage(`Splash! You dropped a ${type.label.toLowerCase()}.`);
}

function onPickup(type) {
  state.inventory[type.id] += 1;
  state.total += 1;
  ui.updateInventory(state.inventory, state.total);
  ui.setMessage(`Picked up ${type.label.toLowerCase()}.`);
}

function onWaveHit(fromX, fromZ) {
  player.knockback(fromX, fromZ);
  ui.setMessage('A wave knocked you back!');
  if (Math.random() < T.DROP_CHANCE) dropRandomItem();
}

// The bar is full: the sea takes the beach back and only the fruit under the palms is left.
function onTideFull() {
  collectibles.clearSeaItems();
  waves.reset();
  state.phase = 'high_tide';
  ui.setMessage('High tide. The sea items are gone — fruit still grows under the palms.');
}

// At the counter, one key turns the whole satchel into goods and calls the boat in from far out at sea.
function craft() {
  const g = goodsFrom(state.inventory);
  state.goods = g;
  for (const t of T.ITEM_TYPES) state.inventory[t.id] = 0;
  state.total = 0;
  ui.updateInventory(state.inventory, state.total);
  ui.showGoods(g);
  ui.hidePrompt();
  ui.showBanner('A boat is coming...');
  state.phase = 'crafting';
  shop.sendBoat();
}

// The boat has docked: show the sale summary and update the running money.
function onBoatArrive() {
  state.money += state.goods.total;
  ui.setMoney(state.money);
  ui.setGoal(state.money, T.AREA_UNLOCK_COST);
  ui.hideBanner();
  state.phase = 'summary';
  ui.showSaleSummary(state.goods, state.goods.total, state.money);
  setTimeout(beginSunset, T.SUMMARY_READ_TIME * 1000);
}

// A short rest: fade to a warm sunset, come back, then offer the next day.
function beginSunset() {
  if (state.phase !== 'summary') return;
  state.phase = 'sunset';
  ui.playSunset(() => {
    if (state.phase !== 'sunset') return;
    state.phase = 'day_end';
    ui.revealNextDay();
  });
}

// SECTION: state changes. Money is deliberately NOT reset, so it carries across days.
function resetDay() {
  state.inventory = emptyInventory();
  state.total = 0;
  state.goods = null;
  player.reset();
  collectibles.reset();
  waves.reset();
  tide.reset();
  shop.reset();
  ui.updateInventory(state.inventory, state.total);
  ui.setTide(0);
  ui.setMessage('');
  ui.hidePrompt();
  ui.hideGoods();
  ui.hideBanner();
  ui.hideDayEnd();
}

function startDay() {
  resetDay();
  state.phase = 'low_tide';
  ui.hideTitle();
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'r') { startDay(); return; }
  if ((state.phase === 'title' || state.phase === 'day_end') && (k === ' ' || k === 'enter')) { startDay(); return; }
  if (state.phase === 'high_tide' && k === T.CRAFT_KEY && shop.isNearCounter(player.position)) craft();
});

resetDay();
ui.setMoney(state.money);
ui.setGoal(state.money, T.AREA_UNLOCK_COST);
ui.showTitle();

// SECTION: camera follow — close behind the girl, angled down the beach so the waves rolling in
// from the sea edge stay in view. Higher CAMERA_FOLLOW follows her more tightly.
const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
function updateCamera(dt) {
  const f = T.CAMERA_FOLLOW;
  const px = player.position.x * f;
  const pz = player.position.z * f;
  camTarget.set(px, T.CAMERA_HEIGHT, pz + T.CAMERA_BACK);
  camera.position.lerp(camTarget, Math.min(1, dt * T.CAMERA_EASE));
  lookTarget.set(px, T.CAMERA_LOOK_HEIGHT, pz + T.CAMERA_LOOK_AHEAD);
  camera.lookAt(lookTarget);
}

// SECTION: world-to-screen, so UI text can sit over the counter and the signboard.
const projVec = new THREE.Vector3();
function toScreen(pos) {
  projVec.copy(pos).project(camera);
  return {
    x: (projVec.x * 0.5 + 0.5) * innerWidth,
    y: (-projVec.y * 0.5 + 0.5) * innerHeight,
    visible: projVec.z < 1 && Math.abs(projVec.x) < 1.15 && Math.abs(projVec.y) < 1.15,
  };
}

const counterAnchor = new THREE.Vector3(T.SHOP_COUNTER_X, T.SHOP_COUNTER_HEIGHT + 1.4, T.SHOP_COUNTER_Z);

function updatePrompt() {
  if (state.phase === 'high_tide' && shop.isNearCounter(player.position)) {
    const s = toScreen(counterAnchor);
    ui.setPrompt(`Press ${T.CRAFT_KEY_LABEL} to craft`, s.x, s.y, s.visible);
  } else {
    ui.hidePrompt();
  }
}

function updateSignLabel() {
  const s = toScreen(shop.signAnchor);
  ui.setSignLabel(T.SHOP_SIGN_TEXT, s.x, s.y, s.visible && state.phase !== 'title');
}

function updateAreaLabel() {
  const s = toScreen(isletAnchor);
  ui.setAreaLabel(T.ISLET_LABEL_TEXT, s.x, s.y, s.visible && state.phase !== 'title');
}

// SECTION: the loop. dt is capped so a slow frame cannot teleport anyone.
let lastFrame = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  if (state.phase === 'low_tide' || state.phase === 'high_tide') {
    player.update(dt);
    collectibles.update(dt, player, onPickup);
    tide.update(dt);              // keeps rising after the bar fills
    ui.setTide(tide.progress);
    if (state.phase === 'low_tide') {
      waves.update(dt, player, onWaveHit);
      if (tide.full) onTideFull();
    }
  } else if (state.phase === 'crafting') {
    tide.update(dt);              // the water keeps rising toward the high-water line while the boat sails in
    shop.updateBoat(dt, onBoatArrive);
  }

  updatePrompt();
  updateSignLabel();
  updateAreaLabel();
  updateCamera(dt);
  renderer.render(scene, camera);
});

// Handy for the browser console while building.
window.game = { player, collectibles, waves, tide, shop, state };
