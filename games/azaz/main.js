// Stem to Stem: scene, fixed close-up camera, input, and the render loop.
// Game state lives in duel.js; this file only builds the world and feeds it input.
import * as THREE from 'three';
import { createPair } from './stalk.js';
import { createDuel } from './duel.js';
import { updateBursts } from './particles.js';
import { initAudio } from './audio.js';
import {
  KEY_PULL, KEY_RESTART,
  CAMERA_POSITION, CAMERA_LOOK_AT, CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR,
  BACKGROUND_COLOR,
  HEMISPHERE_LIGHT_COLOR, HEMISPHERE_GROUND_COLOR, HEMISPHERE_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY, DIRECTIONAL_LIGHT_POSITION,
  FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY, FILL_LIGHT_POSITION,
  RIM_LIGHT_COLOR, RIM_LIGHT_INTENSITY, RIM_LIGHT_POSITION,
  MAX_PIXEL_RATIO,
  SHAKE_MAX_OFFSET, SHAKE_BREAK_DURATION, SHAKE_FREQ_X, SHAKE_FREQ_Y, SHAKE_FALLOFF,
} from './tuning.js';

// --- SCENE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(BACKGROUND_COLOR);

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, CAMERA_NEAR, CAMERA_FAR);
camera.position.fromArray(CAMERA_POSITION);
camera.lookAt(new THREE.Vector3().fromArray(CAMERA_LOOK_AT));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
document.body.appendChild(renderer.domElement);

// --- FPS OVERLAY (?fps) ---
let fpsPanel = null;
let fpsFrames = 0;
let fpsTime = 0;
const showFps = location.search.includes('fps');
if (showFps) {
  fpsPanel = document.createElement('div');
  fpsPanel.style.cssText = 'position:fixed;top:8px;left:8px;padding:6px 10px;background:rgba(0,0,0,0.6);color:#9fd8d0;font:12px monospace;z-index:1000;pointer-events:none;';
  document.body.appendChild(fpsPanel);
}

// --- LIGHT ---
// Three directional lights around one hemisphere: the stalks are thin tubes, and a single light
// leaves most of each tube turned away from it, so they read as dark silhouettes. Key warms one
// flank, fill lifts the opposite one, rim picks out the edge against the midnight-blue background.
scene.add(new THREE.HemisphereLight(
  HEMISPHERE_LIGHT_COLOR, HEMISPHERE_GROUND_COLOR, HEMISPHERE_LIGHT_INTENSITY));

function addDirectional(color, intensity, position) {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.fromArray(position);
  scene.add(light);
}

addDirectional(DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY, DIRECTIONAL_LIGHT_POSITION);
addDirectional(FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY, FILL_LIGHT_POSITION);
addDirectional(RIM_LIGHT_COLOR, RIM_LIGHT_INTENSITY, RIM_LIGHT_POSITION);

// --- FX: camera shake ---
// A shake is a short-lived offset added on top of the camera's fixed framing position. It never changes where
// the camera looks, and it is taken away exactly when it ends, so the framing always returns to CAMERA_POSITION.
const cameraBase = camera.position.clone();   // the framing position, kept pristine
const shakeOffset = new THREE.Vector3();
let shakeAmp = 0;          // world units of offset at the moment the shake landed
let shakeLeft = 0;         // seconds of shake still to run
let shakeLen = 0;          // seconds the current shake started with (the decay's denominator)
let shakeDirty = false;    // true while the camera is off its base, so it can be put back exactly

// Ask the camera to shake. intensity 1 = SHAKE_MAX_OFFSET at the start; durationSeconds is how long it decays.
export function shakeCamera(intensity = 1, durationSeconds = SHAKE_BREAK_DURATION) {
  const amp = Math.max(0, Number(intensity) || 0) * SHAKE_MAX_OFFSET;
  const len = Math.max(0, Number(durationSeconds) || 0);
  if (amp <= 0 || len <= 0) return;   // a zero shake is not a shake, so do not mark the camera dirty
  // A new shake inherits whatever is still running instead of cutting it short: the stronger one wins.
  const running = shakeLen > 0 ? shakeAmp * (shakeLeft / shakeLen) : 0;
  shakeAmp = Math.max(running, amp);
  shakeLen = Math.max(shakeLeft, len);
  shakeLeft = shakeLen;
}

function applyShake(dt) {
  if (shakeLeft <= 0) {
    if (shakeDirty) { camera.position.copy(cameraBase); shakeDirty = false; }
    return;
  }
  shakeDirty = true;
  shakeLeft = Math.max(0, shakeLeft - Math.max(dt, 0));
  const falloff = shakeLen > 0 ? Math.pow(shakeLeft / shakeLen, SHAKE_FALLOFF) : 0;
  const amp = shakeAmp * falloff;
  const t = performance.now() * 0.001;
  // Two different rates with a phase offset each: a jitter, not a smooth oscillation.
  shakeOffset.set(
    Math.sin(t * SHAKE_FREQ_X) * amp,
    Math.sin(t * SHAKE_FREQ_Y + 1.7) * amp,
    0,   // no dolly: moving the camera in depth would breathe the framing instead of shaking it
  );
  camera.position.copy(cameraBase).add(shakeOffset);
}

// --- INPUT ---
let pulling = false;         // SPACE held
let restartQueued = false;   // R pressed, consumed by the next frame

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === KEY_RESTART) {
    restartQueued = true;
    return;
  }
  if (k === KEY_PULL) {
    e.preventDefault();   // space would otherwise scroll the page
    pulling = true;
  }
});

addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === KEY_PULL) pulling = false;
});

addEventListener('blur', () => {
  pulling = false;   // a lost focus is not a held key
});

// --- TOUCH ---
// The one action is "hold to pull, release to let go". A single finger anywhere on the canvas does that.
let touchPulling = false;
addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchPulling = true;
  pulling = true;
  initAudio();   // touch is a user gesture, so it can unlock the AudioContext
}, { passive: false });

addEventListener('touchend', (e) => {
  e.preventDefault();
  touchPulling = false;
  pulling = false;
});

addEventListener('touchcancel', () => {
  touchPulling = false;
  pulling = false;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- STALKS, DUEL AND LOOP --- (duel.js owns the state; main.js only passes input through)
const loading = document.getElementById('loading');
if (loading) loading.remove();

const pair = createPair(scene);
const duel = createDuel(scene, pair, { shake: shakeCamera });

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  duel.update(dt, { pulling, restart: restartQueued });
  restartQueued = false;
  updateBursts(dt);   // particles.js ages and disposes its own bursts
  applyShake(dt);
  renderer.render(scene, camera);

  if (fpsPanel) {
    fpsFrames += 1;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      const fps = Math.round(fpsFrames / fpsTime);
      const tri = renderer.info.render.triangles;
      const calls = renderer.info.render.calls;
      fpsPanel.textContent = `FPS ${fps} | calls ${calls} | tris ${tri}`;
      fpsFrames = 0;
      fpsTime = 0;
    }
  }
});
