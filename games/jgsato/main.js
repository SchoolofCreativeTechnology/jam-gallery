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
import { initTouch, readTouch, requestTilt, recentreTilt, isTouch } from './mobile.js';
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

scene.add(new THREE.HemisphereLight('#fff2e0', '#3a2050', 1.15));
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

function resetRun() {
  const f = frameAt(0.9);
  head.reset(f.x, f.z);
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
  loadLevel(selected);
  resetRun();
  setState('title');
  ui.showTitle(selected);
  audio.setMusicLevel(0.75);
  titlePan = 0;
}

function play(i) {
  if (i >= store.unlockedCount()) return;
  audio.unlockAudio();
  if (isTouch) requestTilt();
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
  play(levelIndex);
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
  state = pausedFrom;
  audio.setMusicLevel(1);
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
  hover: (i) => { if (state === 'title' && i !== selected) { selected = i; ui.selectCard(i); loadLevel(i); resetRun(); titlePan = 0; } },
});

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

  if (state === 'title') {
    const unlocked = store.unlockedCount();
    if (code === 'ArrowLeft' || code === 'KeyA') { selected = Math.max(0, selected - 1); ui.selectCard(selected); loadLevel(selected); resetRun(); titlePan = 0; audio.playClick(); }
    if (code === 'ArrowRight' || code === 'KeyD') { selected = Math.min(unlocked - 1, selected + 1); ui.selectCard(selected); loadLevel(selected); resetRun(); titlePan = 0; audio.playClick(); }
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
initTouch(renderer.domElement);
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
  if (state === 'title') {
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

  if (state === 'playing') {
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
      die();
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
    if (!panelShown && stateTime > tuning.rules.winPanelDelay) {
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
