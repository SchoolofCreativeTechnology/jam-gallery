// ui.js — the plain-DOM HUD (scan meter, hull, altitude), the red flash on a hit, and the survey report screen.
import * as T from './tuning.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const altitudeSpan = () => Math.max(1e-6, T.ALTITUDE_HIGH - T.ALTITUDE_LOW);   // guards an odd tuning edit
const number = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// The HUD is built once, here; after that only text and bar widths change. Its style lives in index.html.
const hud = document.createElement('div');
hud.id = 'hud';
hud.hidden = true;
hud.innerHTML = '<div class="row"><span class="label">SCAN</span>'
  + '<span class="bar"><span class="fill" id="hud-scan-fill"></span></span>'
  + '<span class="value" id="hud-scan-text">0%</span></div>'
  + '<div class="row"><span class="label">TIME</span>'
  + '<span class="bar"><span class="fill" id="hud-time-fill"></span></span>'
  + '<span class="value" id="hud-time-text">2:00</span></div>'
  + '<div class="row"><span class="label">HULL</span><span class="pips" id="hud-pips"></span>'
  + '<span class="value" id="hud-hull-text"></span></div>'
  + '<div class="row"><span class="label">ALT</span>'
  + '<span class="bar"><span class="fill" id="hud-alt-fill"></span></span>'
  + '<span class="value" id="hud-alt-text">0.0 m</span></div>'
  + '<div class="note">Lower = faster scan, and the rocks are down low.</div>';
document.body.appendChild(hud);

const scanFill = hud.querySelector('#hud-scan-fill');
const scanText = hud.querySelector('#hud-scan-text');
const timeFill = hud.querySelector('#hud-time-fill');
const timeText = hud.querySelector('#hud-time-text');
const pipsEl = hud.querySelector('#hud-pips');
const hullText = hud.querySelector('#hud-hull-text');
const altFill = hud.querySelector('#hud-alt-fill');
const altText = hud.querySelector('#hud-alt-text');

// The altitude readout along the bottom of the screen: the two numbers a maker tunes the trade with.
const readout = document.createElement('div');
readout.id = 'readout';
readout.hidden = true;
document.body.appendChild(readout);

// The red flash on a hit: a flat full-screen wash that fades away over a few frames.
const flashEl = document.createElement('div');
flashEl.id = 'flash';
document.body.appendChild(flashEl);
let flashLevel = 0;

// The report screen: the world, its findings, and the habitability verdict.
const report = document.createElement('div');
report.id = 'report';
report.hidden = true;
document.body.appendChild(report);

export function showHud() {
  hud.hidden = false;
  readout.hidden = false;
}

export function hideHud() {
  hud.hidden = true;
  readout.hidden = true;
}

// One hull pip per hit point, rebuilt only when a hit changes them.
let pipHull = -1;
let pipMax = -1;
function renderPips(hull, hullMax) {
  if (hull === pipHull && hullMax === pipMax) return;
  pipHull = hull;
  pipMax = hullMax;
  let html = '';
  for (let i = 0; i < hullMax; i++) html += '<span class="pip' + (i < hull ? ' on' : '') + '"></span>';
  pipsEl.innerHTML = html;
}

// s is { scan, hull, hullMax, altitude, multiple, timeLeft }. Called every frame of a run.
export function updateHud(s) {
  const percent = Math.round(clamp01(s.scan) * 100);
  scanFill.style.width = percent + '%';
  scanText.textContent = percent + '%';

  // The run clock. Its bar drains as the two minutes go, and it turns urgent near the end, so the one number that
  // decides whether the survey lands is never off-screen.
  const timeLeft = Math.max(0, number(s.timeLeft));
  const seconds = Math.ceil(timeLeft);
  timeFill.style.width = clamp01(timeLeft / Math.max(1e-6, T.RUN_SECONDS)) * 100 + '%';
  timeText.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  const urgent = seconds <= T.HUD_URGENT_SECONDS ? T.HUD_COLOR_URGENT : '';
  timeFill.style.background = urgent;
  timeText.style.color = urgent;

  const hull = Math.max(0, Math.round(number(s.hull)));
  const hullMax = Math.max(0, Math.round(number(s.hullMax)));
  renderPips(hull, hullMax);
  hullText.textContent = hull + ' / ' + hullMax;

  const altitude = number(s.altitude);
  altFill.style.width = clamp01((altitude - T.ALTITUDE_LOW) / altitudeSpan()) * 100 + '%';
  altText.textContent = altitude.toFixed(1) + ' m';

  // The band colours make the trade visible at a glance: yellow low and fast, grey high and slow.
  const band = altitude <= T.HUD_FAST_ALTITUDE ? T.HUD_COLOR_FAST
    : altitude >= T.HUD_SLOW_ALTITUDE ? T.HUD_COLOR_SLOW : T.HUD_COLOR_MID;
  altFill.style.background = band;
  altText.style.color = band;
  readout.style.color = band;
  readout.textContent = 'ALT ' + altitude.toFixed(1) + ' m  SCAN x' + number(s.multiple).toFixed(1);
}

export function hitFlash() {
  flashLevel = Math.max(flashLevel, T.HIT_FLASH_OPACITY);
  flashEl.style.opacity = flashLevel;
}

export function updateFlash(dt) {
  if (flashLevel <= 0) return;
  flashLevel *= Math.exp(-T.HIT_FLASH_DECAY * dt);
  if (flashLevel < 0.01) flashLevel = 0;
  flashEl.style.opacity = flashLevel;
}

export function clearFlash() {
  flashLevel = 0;
  flashEl.style.opacity = 0;
}

// world is one entry of PLANETS: { name, habitability, findings }.
export function showReport(world) {
  const findings = Array.isArray(world.findings) ? world.findings.join('\n') : '';
  report.textContent = 'SURVEY COMPLETE — ' + world.name + ' WORLD\n'
    + (findings ? findings + '\n' : '')
    + '\nHABITABILITY ' + Math.round(number(world.habitability)) + '%\n\n'
    + 'The world comes back unsuitable for settlement.\n\n'
    + 'Press Space or Enter to survey it again\nEscape or Backspace to choose another world';
  report.hidden = false;
}

export function hideReport() {
  report.hidden = true;
}

// The frame-rate readout, in the corner. It stays hidden unless the game is opened with ?fps, so it is a
// maker's check on how much detail the scene can carry rather than part of the game. Its style is in index.html.
const fpsEl = document.createElement('div');
fpsEl.id = 'fps';
fpsEl.hidden = true;
document.body.appendChild(fpsEl);
let fpsSeconds = 0;
let fpsFrames = 0;

export function showFps() {
  fpsEl.hidden = false;
}

// dt must be the REAL frame time, not the clamped one the game simulates: a clamped delta would report a
// healthy number exactly when the game is struggling, which is the one moment the readout is worth having.
export function updateFps(dt) {
  if (fpsEl.hidden) return;
  fpsSeconds += dt;
  fpsFrames += 1;
  if (fpsSeconds < 0.5) return;              // average over half a second, so the number is readable
  fpsEl.textContent = Math.round(fpsFrames / fpsSeconds) + ' FPS';
  fpsSeconds = 0;
  fpsFrames = 0;
}
