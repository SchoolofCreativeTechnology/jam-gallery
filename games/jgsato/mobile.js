// Touch controls. Drag anywhere on the screen and the head rolls toward your finger, like a
// thumbstick that appears where you touch. Tilting the phone works too, where it's allowed.
const STICK_RANGE = 60; // pixels of drag for full push
const TILT_SENSITIVITY = 0.07;
const TILT_DEADZONE = 2.5;

export const isTouch = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  (typeof window !== 'undefined' && 'ontouchstart' in window);

let stick = null; // { id, x0, y0, x, y }
let stickEl, knobEl;
let tiltOn = false, tiltAsked = false;
let gamma0 = 0, beta0 = 0, gamma = 0, beta = 0;

export function initTouch(canvas) {
  stickEl = document.getElementById('stick');
  knobEl = stickEl && stickEl.querySelector('.knob');

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

// Ask for tilt. iOS needs this called from inside a tap.
export async function requestTilt() {
  if (tiltAsked || !isTouch) return;
  tiltAsked = true;
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return;
    }
  } catch {
    return;
  }
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    if (!tiltOn) {
      gamma0 = e.gamma;
      beta0 = e.beta;
      tiltOn = true;
    }
    gamma = e.gamma;
    beta = e.beta;
  });
}

// Re-centre tilt to however the phone is held right now (called at the start of each run).
export function recentreTilt() {
  gamma0 = gamma;
  beta0 = beta;
}

// The touch "stick": {x, z} each in [-1, 1]. Screen up is away from the camera (-z).
export function readTouch() {
  let x = 0, z = 0;
  if (stick) {
    const s = readStickRaw();
    if (Math.hypot(s.x, s.y) > 0.12) { x += s.x; z += s.y; }
  }
  if (tiltOn) {
    let dx = gamma - gamma0, dz = beta - beta0;
    if (Math.abs(dx) < TILT_DEADZONE) dx = 0;
    if (Math.abs(dz) < TILT_DEADZONE) dz = 0;
    x += Math.max(-1, Math.min(1, dx * TILT_SENSITIVITY));
    z += Math.max(-1, Math.min(1, dz * TILT_SENSITIVITY));
  }
  return { x, z, touching: !!stick };
}
