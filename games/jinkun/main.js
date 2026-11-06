// Dodge: choose a world on the title screen, then steer low over it while the scanner fills;
// rocks cost the hull, a full scan gives a report, and either end restarts the same world in one keypress.
import * as THREE from 'three';
import * as T from './tuning.js';
import { PLANETS } from './planets.js';
import { ground, updateTerrain, terrainHeightAt, applyTerrainLook, ceiling } from './terrain.js';
import { rockGroup, updateRocks, resetRocks, resetHull, updateHull, collideRocks, hullPoints, applyRockLook } from './obstacles.js';
import { ship, updateShip, resetShip } from './ship.js';
import { props, updateProps, resetProps, applyPropLook } from './props.js';
import { createSky, applySkyLook } from './sky.js';
import { createLights, applyLightLook } from './lighting.js';
import { initSound, startScan, stopScan, setScanTone, startEngine, stopEngine, setEngineTone, startMusic, playHit, playCrash, playComplete } from './sound.js';
import { createBadge, showBadge, hideBadge, setBadgeQuarters } from './badge.js';
import { resetScan, updateScan, scanProgress, scanDone, scanRateMultiple } from './scanner.js';
import { showHud, hideHud, updateHud, hitFlash, updateFlash, clearFlash, showReport, hideReport, showFps, updateFps } from './ui.js';

// Sky, ground and fog; the fog hides the ground's far edge so the world reads as endless.
const scene = new THREE.Scene();
scene.background = new THREE.Color(T.SKY_COLOR);
scene.fog = new THREE.Fog(T.SKY_COLOR, T.FOG_NEAR, T.FOG_FAR);
// The sky (star, gradient dome, gas giant, starfield) is built once and only repainted per world.
const sky = createSky();
// The ceiling rides with the ground: it is hidden on the three open worlds and becomes the cave roof on ICE.
scene.add(sky, ground, ceiling, rockGroup, props, ship);

// The lights are built once and then repainted per world, like the sky. Each world carries its own key-light
// direction, colour and ambient in planets.js, so four very different places stop being lit identically.
scene.add(createLights());

// Chase camera: sits behind and above the ship, aims at a point in front of it.
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 400);
const cameraWant = new THREE.Vector3();
const cameraAim = new THREE.Vector3();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Overlay text for the title picker and the crash message. Its style lives in index.html.
const overlay = document.createElement('div');
overlay.id = 'overlay';
document.body.appendChild(overlay);

// The title keeps saying how to fly the ship; the picker is the only thing this screen adds.
const CONTROLS_TEXT = 'Steer: left / right arrows, or A and D<br>Climb and dive: up / down arrows, or W and S';

// Which world the picker highlights. It survives a crash, so Space flies that same world again with no picker.
let pick = 0;

// The picker: the four world names stacked with the highlighted one marked, and one line on how to choose.
function renderPicker() {
  const rows = PLANETS.map((world, i) => (i === pick
    ? `<div class="sel">&rarr; ${i + 1}  ${world.name} WORLD &larr;</div>`
    : `<div>${i + 1}  ${world.name} WORLD</div>`)).join('');
  overlay.innerHTML = '<div>DODGE<br><br>Choose a world to survey:'
    + rows
    + '<div>left / right arrows or A / D to choose &nbsp; 1-4 to pick a world &nbsp; Space or Enter to launch</div>'
    + '<div><br>' + CONTROLS_TEXT + '</div></div>';
}

function movePick(step) {
  pick = (pick + step + PLANETS.length) % PLANETS.length;
  renderPicker();
}

function pickWorld(index) {
  pick = index;
  renderPicker();
}

// Paint the scene in the chosen world: the air and the fog, its own sky, then the ground's shape, colours and
// detail and the rocks that world carries. Those two rebuilds are what make a world read as its own place, and
// they are skipped when the world is already dressed, so relaunching the same one stays instant.
let dressed = null;
function applyWorld(world) {
  scene.background.set(world.sky);
  scene.fog.color.set(world.sky);
  applySkyLook(world);
  applyLightLook(world);   // the air and the light change per world; the geometry below only changes once
  if (dressed === world.name) return;
  dressed = world.name;
  applyTerrainLook(world);
  applyRockLook(world);
  applyPropLook(world);   // the scenery stands on the ground, so it is dressed after the ground itself
}

// The run clock: two minutes a world to get the survey in, and the two ways a run can end without one. The clock
// lives here rather than in the scanner because it is the run's, not the instrument's: it starts on launch, stops
// the moment the run ends either way, and the report or the crash screen is what stops it.
let timeLeft = T.RUN_SECONDS;
let outOfTime = false;

// The run-over messages name the world the run was flying, what the lost run is worth — the scan meter had got
// somewhere, and that number is the only result it has — and which of the two ways it ended.
function crashText() {
  const pct = Math.round(scanProgress() * 100);
  const again = '\n\nPress Space or Enter to fly again\nEscape or Backspace to choose another world';
  if (outOfTime) {
    return 'OUT OF TIME — ' + PLANETS[pick].name + ' WORLD\n\nThe two-minute window closed with the scan '
      + pct + '% done.' + again;
  }
  return 'CRASHED — ' + PLANETS[pick].name + ' WORLD\n\nThe hull is gone and the survey ship is lost — the scan reached '
    + pct + '%.' + again;
}

// The badge: one quarter earned for each world whose survey comes back. It counts within this session only —
// the plan's cut list drops saving between sessions, so a refresh starts the badge again.
const surveyed = new Set();

// Game state: title (with its picker) -> run -> crashed or report -> run. Escape or Backspace from either
// ending goes back to the picker. enter() is the only thing that writes this, so no key can strand the flow.
let state = 'title';
function enter(next) {
  state = next;
  if (next === 'run') {
    applyWorld(PLANETS[pick]);   // the run always flies the highlighted world
    resetRocks();
    resetProps();
    resetShip();
    resetScan();
    resetHull();
    timeLeft = T.RUN_SECONDS;   // every run gets its own two minutes; nothing carries over from the last one
    outOfTime = false;
    camera.position.set(ship.position.x, ship.position.y + T.CAMERA_HEIGHT, ship.position.z + T.CAMERA_BACK);
    overlay.hidden = true;
    hideReport();
    clearFlash();
    startScan();   // the scanner runs for the whole run; its hum follows how fast the meter fills
    startEngine();
    showHud();
    hideBadge();   // the run screen is the action and nothing else; the badge belongs between runs
  } else if (next === 'title') {
    stopScan();                  // no instrument running on the picker: that sound belongs to a survey
    stopEngine();
    showBadge();                 // the picker shows how much of the badge you have earned so far
    applyWorld(PLANETS[pick]);   // the picker stands in the world it is offering
    renderPicker();
    overlay.hidden = false;
    hideReport();
    hideHud();
  } else if (next === 'report') {
    stopScan();
    stopEngine();
    playComplete();              // the one pleasant sound in the game, and it means the survey is in
    surveyed.add(PLANETS[pick].name);   // this world is done, so its quarter of the badge is earned
    setBadgeQuarters(surveyed.size);
    showBadge();
    showReport(PLANETS[pick]);   // the world's percentage and findings live in planets.js
    overlay.hidden = true;
    hideHud();
  } else {                       // crashed
    stopScan();
    stopEngine();
    playCrash();
    showBadge();
    overlay.textContent = crashText();
    overlay.hidden = false;
    hideReport();
    hideHud();
  }
}

// Keyboard: Space or Enter launches and restarts. On the title the picker takes left/right and A/D,
// plus the number keys; from a crash or a report, Escape or Backspace goes back to the picker.
const held = new Set();
const DIGIT_KEYS = ['1', '2', '3', '4'];
addEventListener('keydown', (e) => {
  initSound();     // browsers only allow sound after a real gesture, so the first key is what starts the audio
  startMusic();    // the music bed belongs to the whole game, the picker included, so it starts here too
  const key = e.key.toLowerCase();
  if (key === ' ' || key === 'enter') {
    e.preventDefault();
    if (!e.repeat && state !== 'run') enter('run');   // a held key must not restart the run over and over
    return;
  }
  if (state === 'title') {
    if (key === 'arrowleft' || key === 'a') { e.preventDefault(); movePick(-1); return; }
    if (key === 'arrowright' || key === 'd') { e.preventDefault(); movePick(1); return; }
    const digit = DIGIT_KEYS.indexOf(key);
    if (digit !== -1) { e.preventDefault(); pickWorld(digit); return; }
  } else if ((state === 'crashed' || state === 'report') && (key === 'escape' || key === 'backspace')) {
    e.preventDefault();
    enter('title');   // back to the picker, still on the world just flown
    return;
  }
  held.add(key);
});
addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => held.clear());   // a key held when the tab loses focus must not stick

// Pointer: while held down, where the pointer sits on screen steers (left/right and up/down).
const pointer = { down: false, x: 0, y: 0 };
function readPointer(e) {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
}
canvas.addEventListener('pointerdown', (e) => {
  initSound();     // a click is a gesture too, and the pointer is the other way to fly the ship
  startMusic();
  if (state !== 'run') enter('run');   // the tap that launches also arms the steer, so a held finger flies
  pointer.down = true;
  readPointer(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => { if (pointer.down) readPointer(e); });
addEventListener('pointerup', () => { pointer.down = false; });
addEventListener('pointercancel', () => { pointer.down = false; });

const clamp = (v) => Math.max(-1, Math.min(1, v));
const NEUTRAL = { steer: 0, vertical: 0 };

function steerInput() {
  if (pointer.down) return { steer: clamp(pointer.x), vertical: clamp(-pointer.y) };
  const input = { steer: 0, vertical: 0 };
  if (held.has('arrowleft') || held.has('a')) input.steer -= 1;
  if (held.has('arrowright') || held.has('d')) input.steer += 1;
  if (held.has('arrowup') || held.has('w')) input.vertical += 1;
  if (held.has('arrowdown') || held.has('s')) input.vertical -= 1;
  return input;
}

function updateCamera(dt) {
  cameraWant.set(ship.position.x, ship.position.y + T.CAMERA_HEIGHT, ship.position.z + T.CAMERA_BACK);
  camera.position.lerp(cameraWant, 1 - Math.exp(-T.CAMERA_FOLLOW * dt));
  cameraAim.set(ship.position.x, ship.position.y, ship.position.z - T.CAMERA_LOOK_AHEAD);
  camera.lookAt(cameraAim);
}

// How high the ship is above the ground under it. This is the number the scan rate comes from, and the
// number the HUD shows, so what the player reads and what the scan does can never drift apart.
function altitudeAboveGround() {
  return ship.position.y - terrainHeightAt(ship.position.x, ship.position.z);
}

// The loop. The world scrolls on the title and in a run; a crash or a report freezes it; the camera keeps following.
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta();                 // the true frame time, kept for the ?fps readout
  const dt = Math.min(raw, T.MAX_DELTA);
  if (state === 'run' || state === 'title') {
    updateTerrain(dt);
    updateRocks(dt);
    updateProps(dt);
  }
  if (state === 'run') {
    const input = steerInput();
    // ICE is a cave, so it caps how high the ship may climb; every other world keeps the open sky's ceiling.
    updateShip(dt, input, PLANETS[pick].cave ? T.CAVE_FLY_CEILING : T.ALTITUDE_HIGH);
    setEngineTone(input.vertical);            // the engine works harder climbing and eases off diving
    const altitude = altitudeAboveGround();
    updateScan(dt, altitude);                 // low fills the meter fast, high fills it slowly
    setScanTone(scanRateMultiple(altitude));  // and the scanner's hum follows that same rate
    updateHull(dt);                           // count down the window where rocks cannot hurt
    if (collideRocks(ship.position)) { hitFlash(); playHit(); }
    timeLeft = Math.max(0, timeLeft - dt);
    // A finished survey beats the clock: landing the scan on the buzzer still counts.
    if (hullPoints() <= 0) enter('crashed');
    else if (scanDone()) enter('report');
    else if (timeLeft <= 0) { outOfTime = true; enter('crashed'); }
    else updateHud({
      scan: scanProgress(), hull: hullPoints(), hullMax: T.HULL_MAX,
      altitude, multiple: scanRateMultiple(altitude), timeLeft
    });
  } else if (state === 'title') {
    updateShip(dt, NEUTRAL);
  }
  updateFlash(dt);   // the hurt flash is outside the run branch so it fades on the crash screen too
  updateCamera(dt);
  updateFps(raw);    // the readout takes the true frame time, not the clamped one the game simulates
  renderer.render(scene, camera);
});

createBadge();   // draw the medal once at load; enter('title') below is what makes it visible
if (location.search.includes('fps')) showFps();   // ?fps puts the frame-rate readout in the corner
enter('title');
