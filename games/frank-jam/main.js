// Boots the scene, camera, lights, and the render loop, and owns the title/playing/won/over states.
import * as THREE from 'three';
import * as TUNING from './tuning.js';
import Container from './container.js';
import Stack from './stack.js';
import UI from './ui.js';
import Alien from './alien.js';
import Crane from './crane.js';
import { applySkyBackground, addAbandonedBuildings } from './world.js';

// --- Scene, camera, renderer ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(TUNING.WORLD.skyBottom); // flat dusk until the photo loads
applySkyBackground(scene);

const camera = new THREE.PerspectiveCamera(
  TUNING.WORLD.cameraFov,
  innerWidth / innerHeight,
  0.1,
  200
);
camera.position.set(0, TUNING.WORLD.cameraHeight, TUNING.WORLD.cameraDistance);
camera.lookAt(0, TUNING.GAME.ufoHeight / 2, 0); // aim at the middle of the climb

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Lights ---
scene.add(new THREE.HemisphereLight(TUNING.WORLD.cloudColor, TUNING.WORLD.fogColor, 1.2));
const sun = new THREE.DirectionalLight(TUNING.WORLD.cloudColor, 2);
sun.position.set(6, 14, 8);
scene.add(sun);

// --- Platform: the flat surface the tower starts on, at y = 0 ---
const platform = new THREE.Mesh(
  new THREE.BoxGeometry(10, 1, 10),
  new THREE.MeshStandardMaterial({ color: TUNING.WORLD.platformColor })
);
platform.position.y = -0.5; // top face sits exactly at y = 0
scene.add(platform);

// --- Construction site ground ---
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: TUNING.WORLD.groundColor })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.55;
scene.add(ground);

// --- Abandoned skyline blocks ringing the site, well outside the fence ---
addAbandonedBuildings(scene);

// --- Safety fence around the cargo platform: a simple square perimeter ---
const fenceMat = new THREE.MeshStandardMaterial({ color: TUNING.WORLD.fenceColor });
const fenceHalf = 5.1; // just outside the 10x10 platform
const railY = 0.85;
const postHeight = 1.3;
const postGeo = new THREE.BoxGeometry(0.12, postHeight, 0.12);
const sideRailGeo = new THREE.BoxGeometry(0.08, 0.08, fenceHalf * 2);
const frontRailGeo = new THREE.BoxGeometry(fenceHalf * 2, 0.08, 0.08);

// Four corner posts
for (let i = -1; i <= 1; i += 2) {
  for (let j = -1; j <= 1; j += 2) {
    const post = new THREE.Mesh(postGeo, fenceMat);
    post.position.set(i * fenceHalf, postHeight / 2 - 0.55, j * fenceHalf);
    scene.add(post);
  }
}

// Four perimeter rails (one on each side of the big square)
for (let i = -1; i <= 1; i += 2) {
  const leftRail = new THREE.Mesh(sideRailGeo, fenceMat);
  leftRail.position.set(i * fenceHalf, railY, 0);
  scene.add(leftRail);
  const backRail = new THREE.Mesh(frontRailGeo, fenceMat);
  backRail.position.set(0, railY, i * fenceHalf);
  scene.add(backRail);
}

// --- UFO: hover above the target height. Reach it with the tower top to win ---
const targetY = TUNING.GAME.ufoHeight;
const ufo = new THREE.Group();
{
  const ufoMat = new THREE.MeshStandardMaterial({
    color: TUNING.WORLD.ufoColor,
    emissive: '#444444',
    roughness: 0.3,
    metalness: 0.4,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffee88' });

  // Saucer body
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.25, 32), ufoMat);
  disc.position.y = 0.125;
  ufo.add(disc);

  // Dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), ufoMat);
  dome.scale.y = 0.55;
  dome.position.y = 0.25;
  ufo.add(dome);

  // Ring lights
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), glowMat);
    light.position.set(Math.cos(angle) * 2.1, 0.05, Math.sin(angle) * 2.1);
    ufo.add(light);
  }
}
ufo.position.y = targetY;
scene.add(ufo);

// --- Alien thumbs-up on win ---
const alien = new Alien(scene);

// --- Crane silhouette ---
new Crane(scene);

// --- Game pieces ---
const stack = new Stack(scene);
const container = new Container(scene, stack);
const ui = new UI(document.getElementById('ui'));

let state = 'title'; // 'title' | 'playing' | 'paused' | 'won' | 'over'
let bestScore = Number(localStorage.getItem('skyCraneBest') || 0);

function startRun() {
  stack.reset();
  container.reset();
  alien.hide();
  ui.hideOverlays();
  state = 'playing';
}

// --- Input: steer with held keys, tap/click/space to start or restart ---
const held = new Set();
let touchDir = 0; // -1 / 1 from the left/right half of the screen on mobile

function startIfIdle() {
  if (state === 'title' || state === 'won' || state === 'over') startRun();
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    ui.showPause();
  } else if (state === 'paused') {
    state = 'playing';
    ui.hidePause();
  }
}

function readTouchSide(touch) {
  return touch.clientX < innerWidth / 2 ? -1 : 1;
}

addEventListener('keydown', (e) => {
  held.add(e.key);
  if (e.repeat) return;
  if (e.key === 'Escape') {
    togglePause();
  } else if (TUNING.INPUT.startKeys.includes(e.key)) {
    startIfIdle();
  }
});
addEventListener('keyup', (e) => held.delete(e.key));
addEventListener('mousedown', startIfIdle);
addEventListener('touchstart', (e) => {
  e.preventDefault();
  startIfIdle();
  if (state === 'playing' && e.touches.length) touchDir = readTouchSide(e.touches[0]);
}, { passive: false });
addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (state === 'playing' && e.touches.length) touchDir = readTouchSide(e.touches[0]);
}, { passive: false });
addEventListener('touchend', () => { touchDir = 0; });

ui.showTitle(bestScore);

// --- Diagnostics: add ?fps to the URL for a tiny frame-rate panel ---
function makeFpsPanel() {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:5;padding:4px 7px;border-radius:4px;' +
    'background:rgba(0,0,0,0.45);color:#bfe9ff;font:11px/1.35 ui-monospace,monospace;' +
    'pointer-events:none;white-space:pre;';
  document.body.appendChild(panel);

  let last = performance.now();
  let frames = 0;
  return () => {
    frames += 1;
    const now = performance.now();
    if (now - last < TUNING.DEBUG.fpsInterval * 1000) return;
    const info = renderer.info.render;
    panel.textContent =
      `${Math.round((frames * 1000) / (now - last))} fps\n` +
      `${info.calls} draws\n${info.triangles} tris`;
    frames = 0;
    last = now;
  };
}
const updateFpsPanel = new URLSearchParams(location.search).has('fps') ? makeFpsPanel() : null;

// --- Render loop ---
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1); // clamp so a paused tab can't jump the drop
  if (state === 'playing') {
    let moveDir = touchDir;
    for (const key of held) {
      if (TUNING.INPUT.leftKeys.includes(key)) moveDir -= 1;
      if (TUNING.INPUT.rightKeys.includes(key)) moveDir += 1;
    }
    container.setMove(moveDir);
    container.update(dt);
    ui.setScore(stack.getScore());
    ui.setBest(bestScore);
    ui.setTilt(stack.getLean(), stack.getLeanLimit());
    ui.setCargo(stack.getCargoCount(), TUNING.GAME.maxCargo);

    if (container.result === 'win') {
      const score = stack.getScore();
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('skyCraneBest', String(bestScore));
      }
      state = 'won';
      ui.showWin(score, bestScore);
      alien.show(targetY);
      container.result = null;
    } else if (container.result === 'over') {
      const score = stack.getScore();
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('skyCraneBest', String(bestScore));
      }
      state = 'over';
      ui.showGameOver(score, bestScore);
      container.result = null;
    }
  }

  // Idle animations
  ufo.rotation.y += dt * 0.3;
  if (state === 'won') alien.update(dt);

  renderer.render(scene, camera);

  if (updateFpsPanel) updateFpsPanel();
});
