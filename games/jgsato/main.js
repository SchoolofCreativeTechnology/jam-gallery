// The scene, the camera, the input, the game states and the loop.
// States: loading -> title -> ready (course shown, waiting for the first push) -> playing
//         -> dead (fell off) or won (home), with paused over the top of ready/playing.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as tuning from './tuning.js';
import { levels } from './levels.js';
import { buildCourse, createPathMesh, frameAt, getCourse } from './path.js';
import { createHead } from './head.js';
import { initToys, loadToys, resetToys, updateToys } from './toys.js';
import { loadStars, resetStars, updateStars, totalStars, collected } from './pickups.js';
import { loadGoal, resetGoal, updateGoal, closeLid, boxCentre, boxTop } from './goal.js';
import { loadPlayhouse } from './playhouse.js';
import { loadWorld, updateWorld } from './world.js';
import { initFX, burst, shockwave, clearFX, updateFX } from './fx.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import * as store from './storage.js';
import { initFinale, startFinale, updateFinale, finaleRunning, finish as finishFinale } from './finale.js';
import { createBoss, createPortal, placePortal, updatePortal, startFight, updateFight, ballState, bossCentre, bossRoot3D, taunt } from './boss.js';
import { initCredits, startCredits, updateCredits, creditsRunning, setShot, skip as skipCredits } from './credits.js';
import { initTouch, readTouch, requestTilt, recentreTilt, setTiltWanted, tiltActive, isTouch } from './mobile.js';
import { initFPS, updateFPS } from './fps.js';
import { debugLoad, debugUpdate } from './debug.js';

if (isTouch) document.body.classList.add('touch');

// ---- RENDERER, SCENE, LIGHT ----
const BG = '#1a1025';
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 42, 125);

// Soft reflections on everything shiny (the glass, the gold, the toy plastic).
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.38;
pmrem.dispose();

const hemi = new THREE.HemisphereLight('#fff2e0', '#3a2050', 1.15);
scene.add(hemi);
// The key light follows the head, so its shadow is always crisp right where you're looking.
const sun = new THREE.DirectionalLight('#fff3dc', 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight('#ff7ad0', 0.8);
scene.add(rim, rim.target);

const camera = new THREE.PerspectiveCamera(tuning.camera.fov, innerWidth / innerHeight, 0.1, 260);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- THE WORLD ----
let levelIndex = -1;
let pathMesh = null;
buildCourse(levels[0]);
const head = createHead(scene);
initFX(scene);
// Everything in the scene so far (lights, the head, effects) stays on in the boss arena;
// everything added after this (the course, the stage, the toys) is hidden there.
const keepInArena = new Set(scene.children);
keepInArena.add(createBoss(scene));
createPortal(scene);
initToys(scene, {
  onHit(pos, color) {
    burst(pos, { count: 18, colors: ['#ffd23d', '#ffffff', color], speed: 5, up: 3, life: 0.6, size: 1 });
    shockwave(pos, { color: '#ffffff', size: 2.4 });
    hitStop = tuning.rules.hitStop;
  },
  onWarn(pos) {
    if (state === 'playing') audio.playHorn(pos.distanceTo(head.group.position));
  },
  onSpring(distance) {
    if (state === 'playing') audio.playSpring(distance);
  },
});
head.onShove = () => {
  shake(tuning.camera.shakeOnShove);
  audio.playShove();
};
head.onLand = (speed) => {
  const p = head.group.position;
  burst(new THREE.Vector3(p.x, p.y - tuning.head.radius * 0.8, p.z), { count: 26, colors: ['#ffd23d', '#ffffff', '#ff2a6d'], speed: 4, up: 4, life: 0.8 });
  shockwave(new THREE.Vector3(p.x, p.y - tuning.head.radius, p.z), { color: '#ffffff', size: 3 });
  shake(Math.min(0.35, speed * 0.015));
  audio.playBonk(speed);
};
head.onJump = () => {
  audio.playSpring(0);
  const p = head.group.position;
  shockwave(new THREE.Vector3(p.x, p.y - tuning.head.radius, p.z), { color: '#ffcb2e', size: 2.2 });
};
head.onTouchdown = (impact) => {
  const p = head.group.position;
  burst(new THREE.Vector3(p.x, p.y - tuning.head.radius * 0.8, p.z), { count: 30, colors: ['#ffcb2e', '#ffffff', '#05d9e8'], speed: 5, up: 3.5, life: 0.7 });
  shockwave(new THREE.Vector3(p.x, p.y - tuning.head.radius, p.z), { color: '#ffffff', size: 3.2 });
  shake(Math.min(0.4, 0.12 + impact * 0.02));
  hitStop = Math.max(hitStop, tuning.rules.hitStop);
  audio.playBonk(Math.max(4, impact));
};
head.onBonk = (strength) => {
  shake(tuning.camera.shakeOnBonk * Math.min(1, strength / 6));
  audio.playBonk(strength);
};

function loadLevel(i) {
  if (i === levelIndex) return;
  levelIndex = i;
  const level = levels[i];
  const course = buildCourse(level);
  if (pathMesh) {
    scene.remove(pathMesh);
    pathMesh.traverse((o) => o.geometry && o.geometry.dispose());
  }
  pathMesh = createPathMesh(anisotropy);
  scene.add(pathMesh);
  loadPlayhouse(scene, renderer, course.bounds);
  loadWorld(scene);
  loadToys(level);
  loadStars(scene, level);
  loadGoal(scene);
  debugLoad(scene);
  audio.setTempo(120 + i * 5);
}

// Every course beaten: the far end of course 1 opens onto the portal to the secret boss.
function secretOpen() {
  return store.bestTime(levels.length - 1) !== null;
}

function resetRun() {
  const f = frameAt(0.9);
  head.reset(f.x, f.z);
  head.openEnd = levelIndex === 0 && secretOpen();
  const L = getCourse().length;
  const e = frameAt(L);
  placePortal(e.x + e.tx * 3.4, e.y - 0.8, e.z + e.tz * 3.4, head.openEnd);
  resetToys();
  resetStars();
  resetGoal();
  clearFX();
  runTime = 0;
  hitStop = 0;
  shakeAmount = 0;
  snapCamera = true;
}

// ---- STATE ----
let state = 'loading';
let stateTime = 0;
let runTime = 0;
let hitStop = 0;
let selected = Math.min(store.unlockedCount() - 1, levels.length - 1);
let pausedFrom = null;
let panelShown = false;
let winResult = null;
let titlePan = 0;
let worldTime = 0;

function setState(s) {
  state = s;
  stateTime = 0;
  panelShown = false;
}

function goTitle() {
  leaveArena();
  loadLevel(Math.min(selected, levels.length - 1));
  resetRun();
  setState('title');
  ui.showTitle(selected);
  audio.setMusicLevel(0.75);
  titlePan = 0;
}

function play(i) {
  if (i === levels.length && store.bossBeaten()) { bossFromMenu(); return; }
  if (i >= store.unlockedCount()) return;
  leaveArena();
  audio.unlockAudio();
  if (isTouch && store.tiltOn()) requestTilt();
  selected = i;
  loadLevel(i);
  resetRun();
  recentreTilt();
  setState('ready');
  ui.showHUD(i);
  ui.showBanner(i);
  ui.updateHUD(0, 0, totalStars(), 0);
  audio.setMusicLevel(1);
}

function retry() {
  if (mode === 'boss') enterBoss();
  else play(levelIndex);
}

// ---- THE SECRET BOSS ----
let mode = 'course'; // 'course', or 'boss' while you're in Djinormous's arena
let hiddenInArena = [];
let wantBossShot = false;
let bossShot = null;
let fireworkClock = 0;
let shotQueue = [];
const SHOT_AT = [0.42, 0.5, 0.55, 0.6, 0.86]; // how far along each course its credits snapshot is taken

function enterArena() {
  if (mode === 'boss') return;
  mode = 'boss';
  hiddenInArena = [];
  for (const o of scene.children) {
    if (!keepInArena.has(o) && o.visible) { o.visible = false; hiddenInArena.push(o); }
  }
  bossRoot3D().visible = true;
  // Dark, with one spotlight on the platter.
  scene.background.set('#030206');
  scene.fog.color.set('#030206');
  scene.fog.near = 34;
  scene.fog.far = 90;
  hemi.intensity = 0.14;
  sun.intensity = 0.35;
  rim.intensity = 0.2;
  scene.environmentIntensity = 0.2;
}

function leaveArena() {
  if (mode !== 'boss') return;
  mode = 'course';
  for (const o of hiddenInArena) o.visible = true;
  hiddenInArena = [];
  bossRoot3D().visible = false;
  scene.background.set(BG);
  scene.fog.color.set(BG);
  scene.fog.near = 42;
  scene.fog.far = 125;
  hemi.intensity = 1.15;
  sun.intensity = 2.3;
  rim.intensity = 0.8;
  scene.environmentIntensity = 0.38;
}

function warpFlash() {
  const w = document.getElementById('warp');
  w.classList.remove('hidden', 'go');
  void w.offsetWidth;
  w.classList.add('go');
}

// Rolled off the end of course 1: down the portal.
function startWarp() {
  setState('warp');
  audio.setRoll(0);
  audio.playWarp();
  ui.hideHUD();
  fallTarget.copy(camTarget);
  warpFlash();
  shake(0.3);
}

function bossFromMenu() {
  audio.unlockAudio();
  if (isTouch && store.tiltOn()) requestTilt();
  audio.playWarp();
  warpFlash();
  enterBoss();
}

function enterBoss() {
  enterArena();
  startFight();
  const b = ballState();
  head.placeAt(b.x, b.y, b.z);
  clearFX();
  runTime = 0;
  hitStop = 0;
  shakeAmount = 0;
  snapCamera = true;
  wantBossShot = false;
  recentreTilt();
  setState('ready');
  ui.showBossHUD(tuning.boss.health);
  ui.showBannerText('Secret course', 'Djinormous', 'Ram him hard. Stay on the platter.');
  audio.setTempo(156);
  audio.setMusicLevel(1);
}

function bossLost() {
  setState('dead');
  shake(tuning.camera.shakeOnFall);
  audio.playFall();
  audio.setRoll(0);
  head.express('dizzy', 0);
  taunt();
  setTimeout(() => { if (mode === 'boss' && state === 'dead') audio.playRoar(); }, 500);
}

function bossWon() {
  setState('won');
  store.setBossBeaten();
  audio.setRoll(0);
  head.express('happy', 0);
  wantBossShot = true;
  fireworkClock = 0;
  audio.setMusicLevel(0.5);
}

function firework() {
  const colors = [['#ff2a6d', '#ffd23d', '#ffffff'], ['#05d9e8', '#9d4edd', '#ffffff'], ['#7ee787', '#ffd23d', '#ff8500'], ['#ff7ab0', '#fff3a0', '#05d9e8']];
  const p = new THREE.Vector3((Math.random() - 0.5) * 18, 6 + Math.random() * 7, -4 - Math.random() * 8);
  burst(p, { count: 60, colors: colors[Math.floor(Math.random() * colors.length)], speed: 9, up: 2, gravity: 4, life: 1.6, size: 1.3 });
  shockwave(p, { color: '#ffffff', size: 4 });
  audio.playFirework();
}

// One frame of the fight: run the platter and him, then react to what happened.
function bossFrame(dt, input) {
  const ev = updateFight(dt, input, state === 'playing');
  const b = ballState();
  head.group.position.set(b.x, b.y, b.z);
  head.drive(dt, b.vx, b.vz, b.falling ? 9 : 0);
  const centre = bossCentre();

  if (state === 'playing') {
    runTime += dt;
    audio.setRoll(b.falling ? 0 : Math.hypot(b.vx, b.vz));
  }
  if (ev.roar) { audio.playRoar(); shake(0.25); }
  if (ev.telegraph) audio.playWindup();
  if (ev.lunge) { shake(0.2); audio.playBoom(false); }
  if (ev.slam) {
    audio.playBoom(false);
    shake(0.5);
    shockwave(new THREE.Vector3(0, 0.2, 0), { color: '#ffb02e', size: 9 });
    burst(new THREE.Vector3(0, 0.5, 0), { count: 40, colors: ['#ffb02e', '#ffffff', '#ff2a6d'], speed: 9, up: 3, life: 0.8 });
  }
  if (ev.shoved) { head.express('scared', 0.7); audio.playShove(); }
  if (ev.bump) { audio.playBonk(ev.bump + 3); shake(0.1); head.express('scared', 0.4); }
  if (ev.hit) {
    const p = new THREE.Vector3(ev.hit.x, centre.y - 0.6, ev.hit.z);
    burst(p, { count: 50, colors: ['#ffd23d', '#ffffff', '#ff2a6d', '#05d9e8'], speed: 9, up: 6, life: 0.9, size: 1.3 });
    shockwave(p, { color: '#ffffff', size: 5 });
    hitStop = 0.12;
    shake(0.55);
    audio.playBossHit(ev.hit.hp);
    ui.setBossHP(ev.hit.hp, tuning.boss.health);
    ui.flash();
    head.express('happy', 0.9);
  }
  if (ev.defeated) bossWon();
  if (ev.pop) {
    const p = centre.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3));
    burst(p, { count: 24, colors: ['#ff2a6d', '#ffd23d', '#ffffff'], speed: 6, up: 3, life: 0.6 });
    audio.playBonk(7);
    shake(0.12);
  }
  if (ev.boom) {
    for (let i = 0; i < 4; i++) {
      burst(centre, { count: 90, colors: ['#ff2a6d', '#ffd23d', '#05d9e8', '#9d4edd', '#7ee787', '#ffffff'], speed: 10 + i * 3, up: 8, gravity: 6, life: 2, size: 1.5 });
    }
    shockwave(centre, { color: '#ffffff', size: 12 });
    shockwave(new THREE.Vector3(0, 0.2, 0), { color: '#ffd23d', size: 14 });
    audio.playBoom(true);
    audio.playWin();
    shake(1);
    ui.flash();
  }
  if (ev.fell && state === 'playing') bossLost();

  if (state === 'dead' && !panelShown && stateTime > tuning.rules.deathPanelDelay) {
    panelShown = true;
    ui.showGameOver(true);
  }
  if (state === 'won') {
    if (stateTime > 2.5 && stateTime < 10) {
      fireworkClock -= dt;
      if (fireworkClock <= 0) { fireworkClock = 0.18 + Math.random() * 0.2; firework(); }
    }
    if (!panelShown && stateTime > 2.9) {
      panelShown = true;
      ui.hideBossHUD();
      startCredits();
      if (bossShot) setShot(5, bossShot);
    }
  }
}

// A snapshot of one course for the credits, taken behind the black screen.
function captureCourseShot(i) {
  loadLevel(i);
  resetRun();
  placePortal(0, -999, 0, false);
  const f = frameAt(getCourse().length * SHOT_AT[i]);
  head.reset(f.x, f.z);
  head.express('happy', 0);
  updateStars(0, worldTime, head, camera, () => {});
  snapCamera = true;
  updateCamera(0);
  renderer.render(scene, camera);
  setShot(i, grabShot());
}

function grabShot() {
  try {
    const src = renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 300;
    const want = c.width / c.height;
    let w = src.width, h = src.width / want;
    if (h > src.height) { h = src.height; w = h * want; }
    c.getContext('2d').drawImage(src, (src.width - w) / 2, (src.height - h) / 2, w, h, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

function creditsDone() {
  selected = 0;
  goTitle();
}

function next() {
  if (levelIndex + 1 < levels.length) {
    play(levelIndex + 1);
  } else {
    selected = levelIndex;
    goTitle();
  }
}

function pause() {
  if (state !== 'playing' && state !== 'ready') return;
  pausedFrom = state;
  setState('paused');
  ui.showPause(audio.isMuted());
  audio.setMusicLevel(0.35);
  audio.setRoll(0);
}

function resume() {
  if (state !== 'paused') return;
  ui.hidePause();
  recentreTilt(); // they may have put the phone down
  state = pausedFrom;
  audio.setMusicLevel(1);
}

async function toggleTilt() {
  audio.unlockAudio();
  const on = !store.tiltOn();
  store.setTilt(on);
  setTiltWanted(on);
  ui.setTiltLabel(on);
  if (on) {
    const ok = await requestTilt();
    ui.toast(ok ? 'Tilt on: hold it how you like' : 'No tilt here: drag to roll', 1.6);
  } else {
    ui.toast('Tilt off: drag to roll', 1.2);
  }
}

function levelTilt() {
  recentreTilt();
  ui.toast('Level set', 0.9);
}

function toggleMute() {
  audio.unlockAudio();
  const m = !audio.isMuted();
  audio.setMuted(m);
  store.setMuted(m);
  ui.setMuteLabel(m);
  ui.toast(m ? 'Sound off' : 'Sound on', 1);
}

function die() {
  setState('dead');
  shake(tuning.camera.shakeOnFall);
  audio.playFall();
  audio.setRoll(0);
  fallTarget.copy(camTarget);
}

function win() {
  setState('won');
  audio.setRoll(0);
  head.goHome(boxTop);
  closeLid();
  audio.playWin();
  ui.flash();
  burst(boxTop.clone().setY(boxTop.y + 1), { count: 70, colors: ['#ff2a6d', '#ffd23d', '#05d9e8', '#9d4edd', '#7ee787', '#ffffff'], speed: 7, up: 9, gravity: 10, life: 1.6, size: 1.1 });
  const level = levels[levelIndex];
  const stars = collected;
  const bonus = stars * tuning.stars.bonus;
  const final = Math.max(0, runTime - bonus);
  const previousBest = store.bestTime(levelIndex);
  const isBest = store.recordRun(levelIndex, final, levels.length);
  const medal = store.medalFor(final, level.medals);
  if (medal >= 0) audio.playMedal(medal);
  winResult = {
    levelIndex, raw: runTime, stars, bonus, final, medal, isBest, previousBest,
    isLast: levelIndex === levels.length - 1,
  };
}

ui.initUI(levels, {
  play, retry, next, resume, pause,
  menu: () => { ui.hidePause(); selected = levelIndex; goTitle(); },
  mute: toggleMute,
  tilt: toggleTilt,
  level: levelTilt,
  hover: (i) => { if (state === 'title' && i !== selected) selectCourse(i); },
  boss: bossFromMenu,
  bossUnlocked: () => store.bossBeaten(),
});

// On the title screen: highlight a card and fly over that course (the boss card keeps the last one).
function selectCourse(i) {
  selected = i;
  ui.selectCard(i);
  if (i < levels.length) { loadLevel(i); resetRun(); titlePan = 0; }
}

// ---- INPUT: WASD and the arrow keys, both live, plus touch ----
const held = new Set();
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

addEventListener('keydown', (e) => {
  if (MOVE[e.code] || e.code === 'Space') e.preventDefault();
  held.add(e.code);
  audio.unlockAudio();
  if (e.repeat) return;
  const code = e.code;
  if (code === 'KeyM') { toggleMute(); return; }

  if (creditsRunning()) {
    if (code === 'Enter' || code === 'Space' || code === 'Escape') skipCredits();
    return;
  }
  if (state === 'title') {
    const last = store.bossBeaten() ? levels.length : store.unlockedCount() - 1;
    if (code === 'ArrowLeft' || code === 'KeyA') { selectCourse(Math.max(0, selected - 1)); audio.playClick(); }
    if (code === 'ArrowRight' || code === 'KeyD') { selectCourse(Math.min(last, selected + 1)); audio.playClick(); }
    if (code === 'Enter' || code === 'Space' || code === 'ArrowUp' || code === 'KeyW') play(selected);
  } else if (state === 'ready' || state === 'playing') {
    if (code === 'Escape' || code === 'KeyP') pause();
    if (code === 'KeyR') retry();
  } else if (state === 'paused') {
    if (code === 'Escape' || code === 'KeyP') resume();
    if (code === 'KeyR') retry();
  } else if (state === 'dead') {
    if (stateTime < tuning.rules.restartDelay) return;
    if (code === 'Escape') { selected = levelIndex; goTitle(); }
    else if (code === 'KeyR' || code === 'Enter' || code === 'Space' || MOVE[code]) retry();
  } else if (state === 'won') {
    if (mode === 'boss') return;
    if (finaleRunning()) {
      if (stateTime > 3 && (code === 'Enter' || code === 'Space' || code === 'Escape')) finishFinale();
      return;
    }
    if (stateTime < tuning.rules.winPanelDelay * 0.6) return;
    if (code === 'Escape') { selected = levelIndex; goTitle(); }
    else if (code === 'KeyR') retry();
    else if (code === 'Enter' || code === 'Space' || code === 'KeyN') next();
  }
});
addEventListener('keyup', (e) => held.delete(e.code));
// Alt-tabbing away swallows keyups, so drop every key, and pause a run in progress.
addEventListener('blur', () => { held.clear(); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
initFinale(() => ui.showWin(winResult));
initCredits(creditsDone);
initTouch(renderer.domElement);
setTiltWanted(store.tiltOn());
ui.setTiltLabel(store.tiltOn());
// Swap "Tilt to roll" / "Drag to roll" depending on whether tilt is really working.
let tiltShown = null;
function syncTiltClass() {
  const on = isTouch && tiltActive();
  if (on !== tiltShown) { tiltShown = on; document.body.classList.toggle('tilt', on); }
}
renderer.domElement.addEventListener('pointerdown', () => audio.unlockAudio());

// Move input for this frame: x and z each in [-1, 1], never faster on the diagonal.
function readInput() {
  let x = 0, z = 0;
  for (const code of held) {
    const m = MOVE[code];
    if (m) { x += m[0]; z += m[1]; }
  }
  x = Math.max(-1, Math.min(1, x));
  z = Math.max(-1, Math.min(1, z));
  const t = readTouch();
  x += t.x;
  z += t.z;
  if (window.__jam.bot) {
    const b = window.__jam.bot();
    x += b.x;
    z += b.z;
  }
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  return { x, z, len };
}

// ---- CAMERA ----
const camTarget = new THREE.Vector3();
const fallTarget = new THREE.Vector3();
const wanted = new THREE.Vector3();
let snapCamera = true;
let zoom = 1;
let shakeAmount = 0;

function shake(amount) {
  shakeAmount = Math.min(1, shakeAmount + amount);
}

function updateCamera(dt) {
  const hp = head.group.position;
  let wantZoom = 1 + head.speed * tuning.camera.speedZoom * 0.1;
  if (mode === 'boss') {
    // Keep the whole platter in view, leaning a little toward the ball.
    const lean = state === 'won' ? 0.15 : 0.4;
    wanted.set(hp.x * lean, Math.max(-3, Math.min(hp.y, 1)) * 0.5, hp.z * lean + 0.6);
    wantZoom = (state === 'won' ? 1.3 : 1.42) * (camera.aspect < 1 ? 1.45 : 1); // phones: see both edges
  } else if (state === 'title') {
    // A slow fly-along of the course behind the title.
    const L = getCourse().length;
    titlePan += dt * 4.5;
    const s = L * (0.5 - 0.5 * Math.cos((titlePan / L) * Math.PI));
    const f = frameAt(s);
    wanted.set(f.x, f.y, f.z);
    wantZoom = 1.25;
  } else if (state === 'won') {
    wanted.set(boxCentre.x, boxCentre.y + 0.5, boxCentre.z);
    wantZoom = 0.72;
  } else if (head.isFalling) {
    // Hold over the edge he went off, sinking a little to follow him down.
    wanted.set(fallTarget.x, Math.max(hp.y, fallTarget.y - 2.5), fallTarget.z);
  } else {
    const v = head.velocity;
    let lx = v.x * tuning.camera.lookahead, lz = v.z * tuning.camera.lookahead;
    const len = Math.hypot(lx, lz);
    if (len > tuning.camera.maxLookahead) { lx *= tuning.camera.maxLookahead / len; lz *= tuning.camera.maxLookahead / len; }
    wanted.set(hp.x + lx, hp.y, hp.z + lz);
  }
  const k = snapCamera ? 1 : 1 - Math.exp(-tuning.camera.follow * dt);
  camTarget.lerp(wanted, k);
  zoom += (wantZoom - zoom) * (snapCamera ? 1 : 1 - Math.exp(-2.5 * dt));
  snapCamera = false;

  // Tall phone screens see less side to side, so pull back to keep the deck in view.
  const aspect = camera.aspect;
  const fit = aspect < 1 ? 1 + (1 - aspect) * 0.75 : 1;
  const o = tuning.camera.offset;
  const z = zoom * fit;
  camera.position.set(camTarget.x + o.x * z, camTarget.y + o.y * z, camTarget.z + o.z * z);
  if (shakeAmount > 0) {
    const s = shakeAmount * shakeAmount * 0.9;
    camera.position.x += (Math.random() * 2 - 1) * s;
    camera.position.y += (Math.random() * 2 - 1) * s;
    camera.position.z += (Math.random() * 2 - 1) * s;
  }
  camera.lookAt(camTarget);

  sun.position.set(camTarget.x + 7, camTarget.y + 18, camTarget.z + 9);
  sun.target.position.copy(camTarget);
  rim.position.set(camTarget.x - 14, camTarget.y + 8, camTarget.z - 20);
  rim.target.position.copy(camTarget);
}

// ---- PERFORMANCE: if the frame rate sags, trade sharpness for smoothness ----
let perfClock = 0, perfFrames = 0, perfStep = 0;
function watchPerformance(dt) {
  if (state !== 'playing') { perfClock = perfFrames = 0; return; }
  perfClock += dt;
  perfFrames++;
  if (perfClock < 3) return;
  const fps = perfFrames / perfClock;
  perfClock = perfFrames = 0;
  if (fps < 40 && perfStep === 0) {
    perfStep = 1;
    pixelRatio = Math.max(1, pixelRatio * 0.7);
    renderer.setPixelRatio(pixelRatio);
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  } else if (fps < 30 && perfStep === 1) {
    perfStep = 2;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
  }
}

// ---- THE LOOP ----
let last = performance.now() / 1000;
initFPS();

function frame(nowMs) {
  const now = nowMs / 1000;
  const dt = Math.min(0.05, Math.max(0, now - last));
  last = now;
  stateTime += dt;
  syncTiltClass();
  const cue = updateFinale(dt);
  if (cue === 'write') audio.playMedal(0);
  else if (cue === 'jambi') audio.playWin();
  else if (cue === 'wink') audio.playStar(4);

  let gameDt = state === 'paused' ? 0 : dt;
  if (hitStop > 0) {
    hitStop -= dt;
    gameDt *= 0.05;
  }
  worldTime += gameDt;

  const input = (state === 'ready' || state === 'playing') ? readInput() : { x: 0, z: 0, len: 0 };

  if (state === 'ready' && input.len > 0.15) {
    setState('playing');
    ui.hideBanner();
  }

  const ccue = updateCredits(dt);
  if (ccue === 'ko') { audio.playWin(); audio.playBoom(true); }
  else if (ccue === 'title') audio.playMedal(0);
  else if (ccue === 'black') {
    // Behind the black: back to the courses, and take a snapshot of each for the credits.
    leaveArena();
    clearFX(); // no leftover fireworks in the snapshots
    setState('credits');
    shotQueue = [0, 1, 2, 3, 4];
    audio.setTempo(96);
    audio.setMusicLevel(0.6);
  } else if (ccue === 'thanks') audio.playMedal(0);
  else if (ccue === 'love') audio.playWin();
  updatePortal(worldTime);

  if (mode === 'boss' && state !== 'paused') {
    bossFrame(gameDt, input);
  } else if (state === 'credits') {
    if (shotQueue.length) captureCourseShot(shotQueue.shift());
  } else if (state === 'warp') {
    head.update(gameDt, 0, 0);
    if (stateTime > 0.75) enterBoss();
  } else if (state === 'playing') {
    runTime += gameDt;
    head.update(gameDt, input.x, input.z);
    updateToys(gameDt, head, !window.__jam.calm);
    updateStars(gameDt, worldTime, head, camera, (pos) => {
      audio.playStar(collected);
      burst(pos, { count: 22, colors: ['#ffd23d', '#fff3a0', '#ffffff'], speed: 3.5, up: 4, gravity: 6, life: 0.7, size: 0.8 });
      shockwave(pos.clone().setY(pos.y - 0.7), { color: '#ffd23d', size: 1.8 });
    });
    audio.setRoll(head.speed);
    ui.updateHUD(runTime, collected, totalStars(), head.progress / getCourse().length);
    if (head.fellOff) {
      if (head.offEnd) startWarp();
      else die();
    } else if (Math.hypot(head.group.position.x - boxCentre.x, head.group.position.z - boxCentre.z) < tuning.goal.radius) {
      win();
    }
  } else if (state === 'dead') {
    head.update(gameDt, 0, 0);
    updateToys(gameDt, head, false);
    if (!panelShown && stateTime > tuning.rules.deathPanelDelay) {
      panelShown = true;
      ui.showGameOver();
    }
  } else if (state === 'won') {
    head.update(gameDt, 0, 0);
    updateToys(gameDt, head, false);
    if (stateTime > 0.95 && stateTime - gameDt <= 0.95) {
      burst(boxTop.clone().setY(boxTop.y + 0.4), { count: 40, colors: ['#ffd23d', '#ffffff', '#05d9e8'], speed: 5, up: 6, life: 1.1 });
      shake(0.12);
    }
    if (winResult.isLast) {
      // The very last box: the big ending first, then the score.
      if (!panelShown && !finaleRunning() && stateTime > 1.0) {
        panelShown = true;
        ui.hideHUD();
        startFinale();
      }
    } else if (!panelShown && stateTime > tuning.rules.winPanelDelay) {
      panelShown = true;
      ui.showWin(winResult);
    }
  } else if (state === 'title' || state === 'ready') {
    updateToys(gameDt, head, false);
    updateStars(0, worldTime, head, camera, () => {});
  }

  updateGoal(gameDt, worldTime);
  updateWorld(gameDt, worldTime);
  updateFX(gameDt);
  updateCamera(dt);
  shakeAmount = Math.max(0, shakeAmount - tuning.camera.shakeDecay * dt * 0.5);
  debugUpdate(head);
  renderer.render(scene, camera);
  if (wantBossShot) { wantBossShot = false; bossShot = grabShot(); }
  updateFPS(dt, renderer);
  watchPerformance(dt);
}

// ---- TEST HOOK: read-only peeks for automated play tests (and a bot input slot) ----
window.__jam = {
  get state() { return state; },
  get level() { return levelIndex; },
  get time() { return runTime; },
  get stars() { return collected; },
  get result() { return winResult; },
  get mode() { return mode; },
  get stateTime() { return stateTime; },
  ball: ballState,
  boss: bossFromMenu,
  head,
  course: getCourse,
  frameAt,
  play,
  bot: null,   // a function returning {x, z}, added to the player's input
  calm: false, // true switches the toys off, for timing a course
};

// ---- START ----
audio.setMuted(store.isMuted());
// Wait (briefly) for the display font, so the ABC blocks are painted in it.
const fontReady = document.fonts ? document.fonts.load('84px "Lilita One"').catch(() => {}) : Promise.resolve();
Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  goTitle();
  renderer.setAnimationLoop(frame);
});
