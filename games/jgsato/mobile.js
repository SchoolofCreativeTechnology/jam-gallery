// Touch controls. Tilt the phone and the head rolls downhill, like a marble in a tray.
// Dragging anywhere also works, as a thumbstick that appears where you touch, so the game is
// playable on devices with no motion sensor (or where the player said no).
import * as tuning from './tuning.js';

const STICK_RANGE = 60; // pixels of drag for full push

export const isTouch = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  (typeof window !== 'undefined' && 'ontouchstart' in window);

let stick = null; // { id, x0, y0, x, y }
let stickEl, knobEl, levelEl, bubbleEl;

// Tilt state. "up" is the direction of the sky in screen coordinates, so it works the same
// in portrait and landscape and however steeply the phone is held.
let tiltWanted = true;
let listening = false;
let gotReading = false;
let pitch = 0, roll = 0;     // the phone right now, radians
let pitch0 = 0, roll0 = 0;   // the "level" the player is holding it at
let needCentre = true;
let tx = 0, tz = 0;          // smoothed tilt input

export function initTouch(canvas) {
  stickEl = document.getElementById('stick');
  knobEl = stickEl && stickEl.querySelector('.knob');
  levelEl = document.getElementById('tilt-level');
  bubbleEl = levelEl && levelEl.querySelector('.bubble');

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || stick) return;
    stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    if (stickEl) {
      stickEl.style.left = `${e.clientX}px`;
      stickEl.style.top = `${e.clientY}px`;
      stickEl.classList.add('on');
    }
    drawKnob();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!stick || e.pointerId !== stick.id) return;
    stick.x = e.clientX;
    stick.y = e.clientY;
    drawKnob();
  });
  const end = (e) => {
    if (!stick || e.pointerId !== stick.id) return;
    stick = null;
    if (stickEl) stickEl.classList.remove('on');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // Turning the phone between portrait and landscape changes what "level" means.
  const recentre = () => { needCentre = true; };
  if (screen.orientation) screen.orientation.addEventListener('change', recentre);
  window.addEventListener('orientationchange', recentre);
}

function drawKnob() {
  if (!knobEl || !stick) return;
  const { x, y } = readStickRaw();
  knobEl.style.transform = `translate(${x * STICK_RANGE * 0.6}px, ${y * STICK_RANGE * 0.6}px)`;
}

function readStickRaw() {
  let dx = (stick.x - stick.x0) / STICK_RANGE;
  let dy = (stick.y - stick.y0) / STICK_RANGE;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  return { x: dx, y: dy };
}

// Turn tilt on or off. Turning it on asks for permission where the browser needs it (iOS),
// which only works from inside a tap. Resolves to true if tilt is (or may soon be) working.
export async function requestTilt() {
  tiltWanted = true;
  if (!isTouch || typeof DeviceOrientationEvent === 'undefined') return false;
  if (listening) return true;
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return false;
    }
  } catch {
    return false;
  }
  window.addEventListener('deviceorientation', onOrientation);
  listening = true;
  needCentre = true;
  return true;
}

export function setTiltWanted(on) {
  tiltWanted = on;
  tx = tz = 0;
  needCentre = true;
}

// True once the phone has actually reported its tilt and the player wants it.
export function tiltActive() {
  return tiltWanted && gotReading;
}

function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  gotReading = true;
  // The sky's direction in the phone's own frame, from its Euler angles...
  const b = (e.beta * Math.PI) / 180, g = (e.gamma * Math.PI) / 180;
  const ux = -Math.sin(g) * Math.cos(b), uy = Math.sin(b), uz = Math.cos(g) * Math.cos(b);
  // ...then turned into the screen's frame, for whichever way up the screen is.
  const angle = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * Math.PI / 180;
  const sx = ux * Math.cos(angle) - uy * Math.sin(angle);
  const sy = ux * Math.sin(angle) + uy * Math.cos(angle);
  roll = Math.asin(Math.max(-1, Math.min(1, sx)));
  pitch = Math.atan2(sy, uz);
  if (needCentre) recentreTilt();

  const t = tuning.touch;
  const full = (t.tiltFull * Math.PI) / 180, dead = (t.tiltDeadzone * Math.PI) / 180;
  const shape = (d) => {
    const a = Math.abs(d);
    if (a < dead) return 0;
    return Math.sign(d) * Math.min(1, (a - dead) / (full - dead));
  };
  // Right edge down rolls him right; top edge down rolls him up the screen.
  const wantX = shape(-(roll - roll0));
  const wantZ = shape(wrap(pitch - pitch0));
  tx += (wantX - tx) * t.tiltSmoothing;
  tz += (wantZ - tz) * t.tiltSmoothing;
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Make however the phone is held right now count as level (called at the start of each run).
export function recentreTilt() {
  pitch0 = pitch;
  roll0 = roll;
  tx = tz = 0;
  needCentre = !gotReading;
}

// The touch "stick": {x, z} each in [-1, 1]. Screen up is away from the camera (-z).
export function readTouch() {
  let x = 0, z = 0;
  if (stick) {
    const s = readStickRaw();
    if (Math.hypot(s.x, s.y) > 0.12) { x += s.x; z += s.y; }
  }
  const tilting = tiltActive();
  if (tilting) { x += tx; z += tz; }
  if (levelEl) {
    levelEl.classList.toggle('on', tilting);
    if (tilting && bubbleEl) bubbleEl.style.transform = `translate(${tx * 18}px, ${tz * 18}px)`;
  }
  return { x, z, touching: !!stick };
}
