// The scene, the camera, the input and the loop. Gray box: plain shapes only.
import * as THREE from 'three';
import * as tuning from './tuning.js';
import { createPath, pathStart, goalPosition, isOnPath } from './path.js';
import { createHead } from './head.js';
import { initCars, updateCars, resetCars } from './toys.js';
import { showTitle, showHUD, showGameOver, showWin } from './ui.js';
import { createWorld, updateWorld } from './world.js';
import * as audio from './audio.js';
import { initFPS, updateFPS } from './fps.js';

// ---- Scene and renderer ----
const scene = new THREE.Scene();
scene.background = new THREE.Color('#101018'); // the void below, plain and dark for now

const camera = new THREE.PerspectiveCamera(tuning.camera.fov, innerWidth / innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Light: soft sky light plus a sun ----
scene.add(new THREE.HemisphereLight('#ffffff', '#445566', 1.5));
const sun = new THREE.DirectionalLight('#ffffff', 2);
sun.position.set(6, 12, 6);
scene.add(sun);

// ---- The world ----
createPath(scene);
createWorld(scene);
const head = createHead(scene);
head.reset(pathStart.x, pathStart.z);
initCars(scene);
audio.initAudio();
initFPS();

// ---- State machine: title / playing / dead / won ----
let state = 'title';
let deathTime = 0;

// ---- Run timer ----
let runStartTime = 0;
let runTime = 0;
let bestTime = Infinity;

// ---- Time ----
const clock = new THREE.Clock();

// ---- Head speed for audio roll ----
const lastHeadPos = new THREE.Vector3();
lastHeadPos.copy(head.group.position);

// ---- Camera shake ----
let shakeAmount = 0;

function shakeCamera(amount) {
  shakeAmount += amount;
}

// Hook the head's shove event so a car hit shakes the camera and scares the face.
head.onShove = () => {
  shakeCamera(tuning.camera.shakeOnShove);
  head.scare();
  audio.playShove();
};

// ---- Input: WASD and the arrow keys, both live, held-key style ----
const held = new Set();
const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

addEventListener('keydown', (e) => {
  if (MOVE_KEYS.has(e.code)) {
    held.add(e.code);
    if (state === 'title') startRun();
  }
  if (e.code === 'KeyR') {
    if (state === 'dead' && clock.elapsedTime - deathTime >= tuning.rules.restartDelay) {
      startRun();
    } else if (state === 'won') {
      startRun();
    }
  }
});
addEventListener('keyup', (e) => {
  held.delete(e.code);
});
// Alt-tabbing away swallows the keyup, so drop everything when the page loses focus.
addEventListener('blur', () => held.clear());

// Move input for this frame: each of moveX / moveZ in [-1, 1], never faster on the diagonal.
function readInput() {
  let moveX = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0)
            - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
  // The path runs away from the camera toward -z, so "forward" is -z.
  let moveZ = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0)
            - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);

  const length = Math.hypot(moveX, moveZ);
  if (length > 1) {
    moveX /= length;
    moveZ /= length;
  }
  return { moveX, moveZ };
}

function startRun() {
  resetCars();
  head.reset(pathStart.x, pathStart.z);
  lastHeadPos.copy(head.group.position);
  runStartTime = clock.elapsedTime;
  state = 'playing';
  showHUD(formatTime(0));
  audio.resumeAudio();
}

function formatTime(t) {
  return t.toFixed(2);
}

// ---- Camera: a fixed isometric-flavoured offset from the head ----
// Seated over the start. With follow = 1 the camera rides with the head.
const camAnchor = new THREE.Vector3(pathStart.x, 0, pathStart.z);
const camLook = new THREE.Vector3();

function updateCamera() {
  camLook.copy(camAnchor).lerp(head.group.position, tuning.camera.follow);
  camera.position.set(
    camLook.x + tuning.camera.offset.x,
    camLook.y + tuning.camera.offset.y,
    camLook.z + tuning.camera.offset.z
  );

  // Apply shake as a random jitter around the computed position.
  const s = shakeAmount;
  camera.position.x += (Math.random() * 2 - 1) * s;
  camera.position.y += (Math.random() * 2 - 1) * s;
  camera.position.z += (Math.random() * 2 - 1) * s;

  camera.lookAt(camLook);
}
updateCamera(); // so the very first frame is already framed, before any head update

// ---- The loop ----
showTitle();

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const { moveX, moveZ } = state === 'playing' ? readInput() : { moveX: 0, moveZ: 0 };

  head.update(dt, moveX, moveZ);

  let speed = 0;
  if (dt > 0) {
    speed = head.group.position.distanceTo(lastHeadPos) / dt;
    lastHeadPos.copy(head.group.position);
  }
  audio.setRoll(state === 'playing' ? speed : 0);

  if (state === 'playing') {
    updateCars(dt, head, runTime);
    runTime = clock.elapsedTime - runStartTime;
    showHUD(formatTime(runTime));

    if (!isOnPath(head.group.position.x, head.group.position.z)) {
      shakeCamera(tuning.camera.shakeOnFall);
      head.scare();
      head.startFalling();
      audio.playFall();
      audio.setRoll(0);
      state = 'dead';
      deathTime = clock.elapsedTime;
      showGameOver(formatTime(runTime));
    } else if (Math.hypot(head.group.position.x - goalPosition.x, head.group.position.z - goalPosition.z) < tuning.goal.radius) {
      audio.playWin();
      audio.setRoll(0);
      state = 'won';
      if (runTime < bestTime) bestTime = runTime;
      showWin(formatTime(runTime), bestTime === Infinity ? '—' : formatTime(bestTime));
    }
  }

  updateWorld(dt, clock.elapsedTime);
  updateCamera();
  renderer.render(scene, camera);
  updateFPS(dt, renderer);

  // Fade out camera shake each frame.
  shakeAmount = Math.max(0, shakeAmount - tuning.camera.shakeDecay * dt);
});
