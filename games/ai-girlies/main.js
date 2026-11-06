// M3 feel: 8-panel comic runner with spawning monsters, stomp, slash, score, instant restart, and procedural Web Audio SFX.
import {
  PLAYFIELD_W, PLAYFIELD_H, PANEL_MARGIN, GROUND_Y, OUTLINE_WIDTH, TEXT_OUTLINE_WIDTH, MAX_DT,
  GRAVITY, MAX_FALL_SPEED, JUMP_VELOCITY, MAX_JUMPS, DOUBLE_JUMP_VELOCITY,
  MOVE_SPEED, PLAYER_W, PLAYER_H, PLAYER_START_X,
  SLASH_DURATION, SLASH_REACH, SLASH_THICKNESS, SLASH_ARC_SPREAD, SLASH_SAMPLES, SHOULDER_HEIGHT,
  MONSTER_SPEED, MONSTER_SPEED_PANEL_RAMP, MONSTER_TYPES, MONSTER_FLY_Y, MONSTER_FLY_BOB, MONSTER_FLY_BOB_SPEED,
  MONSTER_HALFTONE_OPACITY, MONSTER_STREAK_ALPHA, MONSTER_SNIP_SPEED, MONSTER_WING_SPEED, MONSTER_WORM_WAVE_SPEED,
  MONSTER_SPIN_SPEED,
  BASE_MONSTERS_PER_PANEL, SPAWN_INTERVAL, SPAWN_PANEL_MULTIPLIER,
  HIT_FLASH, STOMP_SQUASH, STOMP_BOUNCE_VELOCITY,
  PANEL_CLEAR_DELAY, PANEL_CLEAR_SCORE, MONSTER_KILL_SCORE,
  SCORE_FONT_SIZE, PANEL_COUNTER_FONT_SIZE, PANEL_CLEAR_FONT_SIZE,
  VICTORY_FONT_SIZE, VICTORY_TEXT,
  GAME_OVER_TEXT, RESTART_HINT_LINE1, RESTART_HINT_LINE2, GAME_OVER_BANNER_Y, GAME_OVER_FONT_SIZE, GAME_OVER_HINT_SIZE,
  GAME_OVER_HINT_GAP, FONT_STACK,
  VICTORY_HINT_LINE1, VICTORY_HINT_LINE2,
  PAUSED_TEXT, PAUSED_HINT, PAUSED_FONT_SIZE,
  CONTROLS_HINT, CONTROLS_HINT_SIZE, CONTROLS_HINT_DURATION, CONTROLS_HINT_MARGIN,
  COLOR_PAPER, COLOR_INK, COLOR_EYE, MONSTER_COLORS,
  COLOR_DEATH, PANEL_FLASH_COLOR,
  WORLD_COUNT, WORLD_PAPER, WORLD_PLAYER_FILL, WORLD_PLAYER_EYE,
  HALFTONE_OPACITY, STAGES_PER_PANEL,
  AUDIO_ENABLED, AUDIO_MASTER_VOLUME,
  SFX_JUMP_VOLUME, SFX_JUMP_DURATION, SFX_JUMP_BASE_FREQ,
  SFX_SLASH_VOLUME, SFX_SLASH_DURATION, SFX_SLASH_BASE_FREQ,
  SFX_STOMP_VOLUME, SFX_STOMP_DURATION, SFX_STOMP_BASE_FREQ,
  SFX_HIT_VOLUME, SFX_HIT_DURATION, SFX_HIT_BASE_FREQ,
  SFX_VICTORY_VOLUME, SFX_VICTORY_DURATION, SFX_VICTORY_BASE_FREQ, SFX_VICTORY_STEPS,
  SFX_GAMEOVER_VOLUME, SFX_GAMEOVER_DURATION, SFX_GAMEOVER_BASE_FREQ,
} from './tuning.js';
import { drawWorldBackground } from './worlds.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// A reusable comic halftone dot pattern created once at startup.
const halftoneCanvas = document.createElement('canvas');
halftoneCanvas.width = 32;
halftoneCanvas.height = 32;
const hctx = halftoneCanvas.getContext('2d');
hctx.fillStyle = COLOR_INK;
for (let y = 4; y < 32; y += 8) {
  for (let x = 4; x < 32; x += 8) {
    hctx.beginPath();
    hctx.arc(x, y, 1.8, 0, Math.PI * 2);
    hctx.fill();
  }
}
const halftonePattern = ctx.createPattern(halftoneCanvas, 'repeat');

// A rough paper grain pattern.
const grainCanvas = document.createElement('canvas');
grainCanvas.width = 64;
grainCanvas.height = 64;
const gctx = grainCanvas.getContext('2d');
gctx.fillStyle = COLOR_INK;
for (let i = 0; i < 200; i++) {
  const x = Math.random() * 64;
  const y = Math.random() * 64;
  const r = Math.random() * 0.6 + 0.2;
  gctx.beginPath();
  gctx.arc(x, y, r, 0, Math.PI * 2);
  gctx.fill();
}
const grainPattern = ctx.createPattern(grainCanvas, 'repeat');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// player.y is the bottom of the hero (its feet), not its top.
const player = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, grounded: false, slashTimer: 0, jumpsUsed: 0 };
const monsters = [];

let panel = 1;                // current comic panel, 1 through 8
let spawnedThisPanel = 0;     // how many monsters have entered this panel
let spawnTimer = 0;           // countdown to the next spawn
let score = 0;                // run score
let panelClearTimer = 0;      // >0 while "PANEL N CLEARED!" is shown
let gameOver = false;         // run has ended: physics freezes, the panel keeps drawing
let victory = false;          // all 8 panels cleared
let paused = false;           // true while the run is paused (P or Escape)
let world = 0;                // current world theme, chosen per run
let currentPaper = COLOR_PAPER; // paper colour for the current world
let jumpQueued = false;       // a Space / ArrowUp / KeyW press waiting for update() to spend on a jump
let slashQueued = false;      // a '/' press waiting for update() to spend on a swing
let runTime = 0;              // seconds of active run, drives the temporary controls hint
let hasSlashed = false;       // true once the player has swung, which hides the controls hint

// Debug / performance overlays, enabled via ?fps and ?debug query parameters.
const urlParams = new URLSearchParams(location.search);
const SHOW_FPS = urlParams.has('fps');
const DEBUG_COLLIDERS = urlParams.has('debug');
let fps = 60;
let fpsAccumulator = 0;
let fpsFrameCount = 0;
let avgFps = 60;
let minFps = Infinity;
let touchDir = 0;             // -1 = left half of screen held, 1 = right half, 0 = none

function monstersPerPanel(p) {
  return BASE_MONSTERS_PER_PANEL + p;
}

// Weighted pick from the current world's roster: the type weights decide the
// mix of ground crawlers and flyers a panel throws at the player.
function pickMonsterType() {
  const roster = MONSTER_TYPES[world];
  let total = 0;
  for (const t of roster) total += t.weight;
  let roll = Math.random() * total;
  for (const t of roster) {
    roll -= t.weight;
    if (roll <= 0) return t;
  }
  return roster[roster.length - 1];
}

function spawnMonster() {
  const type = pickMonsterType();
  const flying = type.flying;
  const baseY = flying ? MONSTER_FLY_Y : GROUND_Y;
  monsters.push({
    type,
    flying,
    baseY,                 // ground types stand on this; flyers bob up from it
    x: PLAYFIELD_W - PANEL_MARGIN - type.w / 2,
    y: baseY,
    w: type.w,
    h: type.h,
    // Per-type speed, ramped a little for every panel the run has reached.
    speedMult: type.speedMult * (1 + (panel - 1) * MONSTER_SPEED_PANEL_RAMP),
    phase: Math.random() * Math.PI * 2, // offsets the bob so flyers never move in lockstep
    anim: 0,                            // seconds alive: drives snips, flaps, crawl waves
    dead: false,
    hitTimer: 0,
  });
}

function reset() {
  player.x = PLAYER_START_X;
  player.y = GROUND_Y;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.grounded = true;
  player.slashTimer = 0;
  player.jumpsUsed = 0;
  monsters.length = 0;
  panel = 1;
  spawnedThisPanel = 0;
  spawnTimer = 0;
  score = 0;
  panelClearTimer = 0;
  gameOver = false;
  victory = false;
  paused = false;
  world = Math.floor(Math.random() * WORLD_COUNT);
  currentPaper = WORLD_PAPER[world];
  jumpQueued = false;
  slashQueued = false;
  runTime = 0;
  hasSlashed = false;
}
reset();

// ---------------------------------------------------------------------------
// Audio: every sound is synthesized on the fly, no audio files
// ---------------------------------------------------------------------------

// One shared context for the whole page. Browsers block audio until the player
// interacts, so this is created (and resumed) from the first keydown.
let audioCtx = null;
let masterGain = null;
let noiseBuffer = null;
let audioTried = false;

function initAudio() {
  if (!AUDIO_ENABLED || audioTried) {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    audioTried = true; // no Web Audio here: stop trying, the game still runs
    return;
  }
  audioCtx = new Ctor();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = AUDIO_MASTER_VOLUME;
  masterGain.connect(audioCtx.destination);
  noiseBuffer = makeNoiseBuffer(0.5);
  audioTried = true;
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Half a second of white noise, reused as the source for every noisy sound.
function makeNoiseBuffer(seconds) {
  const length = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// A filtered noise burst: the air of the swoosh, the grit of the stomp, the click of the hit.
function noiseBurst(volume, duration, filterType, freqStart, freqEnd, q) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = q;
  const t = audioCtx.currentTime;
  filter.frequency.setValueAtTime(freqStart, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + duration);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(t);
  src.stop(t + duration + 0.02);
}

// One oscillator with a pitch sweep and a percussive attack/decay envelope.
function tone(volume, duration, type, freqStart, freqEnd, delay = 0) {
  const osc = audioCtx.createOscillator();
  osc.type = type;
  const t = audioCtx.currentTime + delay;
  osc.frequency.setValueAtTime(freqStart, t);
  if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

// Guard: silent until the context exists and has been unlocked by a keypress.
function audioReady() {
  return AUDIO_ENABLED && audioCtx !== null && audioCtx.state !== 'closed';
}

// Springing off the page: a quick rising-falling "boing" tone.
function playJump() {
  if (!audioReady()) return;
  tone(SFX_JUMP_VOLUME, SFX_JUMP_DURATION, 'triangle',
    SFX_JUMP_BASE_FREQ * 1.6, SFX_JUMP_BASE_FREQ * 0.55);
  tone(SFX_JUMP_VOLUME * 0.4, SFX_JUMP_DURATION * 0.8, 'sine',
    SFX_JUMP_BASE_FREQ * 1.2, SFX_JUMP_BASE_FREQ * 0.5, 0.02);
}

// Swinging the sword: a fast airy swoosh, with a falling blade tone under it.
function playSlash() {
  if (!audioReady()) return;
  noiseBurst(SFX_SLASH_VOLUME, SFX_SLASH_DURATION, 'bandpass',
    SFX_SLASH_BASE_FREQ, SFX_SLASH_BASE_FREQ * 0.18, 1.1);
  tone(SFX_SLASH_VOLUME * 0.5, SFX_SLASH_DURATION, 'triangle',
    SFX_SLASH_BASE_FREQ * 0.6, SFX_SLASH_BASE_FREQ * 0.15);
}

// Landing on a monster's head: a low body thump with a short noise slap on top.
function playStomp() {
  if (!audioReady()) return;
  tone(SFX_STOMP_VOLUME, SFX_STOMP_DURATION, 'sine', SFX_STOMP_BASE_FREQ, SFX_STOMP_BASE_FREQ * 0.28);
  noiseBurst(SFX_STOMP_VOLUME * 0.5, SFX_STOMP_DURATION * 0.5, 'lowpass',
    SFX_STOMP_BASE_FREQ * 6, SFX_STOMP_BASE_FREQ * 2, 0.7);
}

// A slash connecting: a sharp ping, layered over the swoosh.
function playHit() {
  if (!audioReady()) return;
  tone(SFX_HIT_VOLUME, SFX_HIT_DURATION, 'square', SFX_HIT_BASE_FREQ, SFX_HIT_BASE_FREQ * 0.3);
  noiseBurst(SFX_HIT_VOLUME * 0.4, SFX_HIT_DURATION * 0.4, 'highpass',
    SFX_HIT_BASE_FREQ * 2, SFX_HIT_BASE_FREQ * 1.5, 0.8);
}

// Panel 8 cleared: a four-note rising jingle.
function playVictory() {
  if (!audioReady()) return;
  const note = SFX_VICTORY_DURATION / SFX_VICTORY_STEPS.length;
  SFX_VICTORY_STEPS.forEach((ratio, i) => {
    tone(SFX_VICTORY_VOLUME, note * 1.6, 'triangle',
      SFX_VICTORY_BASE_FREQ * ratio, SFX_VICTORY_BASE_FREQ * ratio, i * note);
  });
}

// The run ends: one long tone sliding down, so failure reads instantly.
function playGameOver() {
  if (!audioReady()) return;
  tone(SFX_GAMEOVER_VOLUME, SFX_GAMEOVER_DURATION, 'square',
    SFX_GAMEOVER_BASE_FREQ, SFX_GAMEOVER_BASE_FREQ * 0.35);
}

// ---------------------------------------------------------------------------
// Input: held keys for movement, single presses for jump and slash
// ---------------------------------------------------------------------------

const held = new Set();
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const BLOCKED = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Slash', 'KeyW']);

addEventListener('keydown', (e) => {
  if (BLOCKED.has(e.code)) e.preventDefault();
  initAudio(); // first keypress is what lets the browser play sound
  held.add(e.code);
  if (e.repeat) return;
  // Space, Up arrow and W all jump while running, and retry once the run is over.
  if (JUMP_KEYS.has(e.code)) {
    if (gameOver || victory) reset();
    else jumpQueued = true;
  }
  if (e.code === 'Slash' || e.key === '/') slashQueued = true;
  if (e.code === 'KeyR') reset();
  if ((e.code === 'KeyP' || e.code === 'Escape') && !gameOver && !victory && panelClearTimer <= 0) {
    paused = !paused;
  }
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

// Mobile: left half of the screen moves left, right half moves right. Tap jumps; a two-finger tap slashes.
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  initAudio();
  updateTouchDir(e.touches);
  if (gameOver || victory) {
    reset();
    return;
  }
  if (e.touches.length >= 2) {
    slashQueued = true;
    return;
  }
  jumpQueued = true;
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  updateTouchDir(e.touches);
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  updateTouchDir(e.touches);
}, { passive: false });

function updateTouchDir(touches) {
  if (touches.length === 0) {
    touchDir = 0;
    return;
  }
  // Use the leftmost touch for direction when multiple fingers are down.
  let leftmost = touches[0];
  for (const t of touches) {
    if (t.clientX < leftmost.clientX) leftmost = t;
  }
  const half = window.innerWidth / 2;
  touchDir = leftmost.clientX < half ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

function killMonster(m) {
  if (m.dead) return;
  m.dead = true;
  m.hitTimer = HIT_FLASH;
  score += MONSTER_KILL_SCORE;
}

// The slash arc is sampled into points; if any sample lands inside a live
// monster's AABB expanded by half the arc's thickness, the swing connected.
function slashHitsMonster(m) {
  if (m.dead) return false;
  const shoulderX = player.x;
  const shoulderY = player.y - PLAYER_H * SHOULDER_HEIGHT;
  const pad = SLASH_THICKNESS / 2;
  const left = m.x - m.w / 2 - pad;
  const right = m.x + m.w / 2 + pad;
  const top = m.y - m.h - pad;
  const bottom = m.y + pad;
  const half = SLASH_ARC_SPREAD / 2;

  for (let i = 0; i < SLASH_SAMPLES; i++) {
    const angle = -half + SLASH_ARC_SPREAD * (i / (SLASH_SAMPLES - 1));
    const px = shoulderX + Math.cos(angle) * SLASH_REACH * player.facing;
    const py = shoulderY + Math.sin(angle) * SLASH_REACH;
    if (px >= left && px <= right && py >= top && py <= bottom) return true;
  }
  return false;
}

function updateMonsters(dt) {
  for (const m of monsters) {
    m.anim += dt;
    if (!m.dead) {
      m.x -= MONSTER_SPEED * m.speedMult * dt;
      // Wrap from the left edge back to the right edge so the player must kill it.
      if (m.x < -m.w / 2) m.x = PLAYFIELD_W - PANEL_MARGIN - m.w / 2;
      // Crawlers stay on the ground; flyers hover above head height and bob,
      // which is what makes running underneath them safe.
      m.y = m.flying
        ? m.baseY - MONSTER_FLY_BOB * (0.5 + 0.5 * Math.sin(m.anim * MONSTER_FLY_BOB_SPEED + m.phase))
        : m.baseY;
    }
    m.hitTimer = Math.max(0, m.hitTimer - dt);
  }
  // Dead monsters linger bright for HIT_FLASH seconds, then leave the array.
  for (let i = monsters.length - 1; i >= 0; i--) {
    if (monsters[i].dead && monsters[i].hitTimer <= 0) monsters.splice(i, 1);
  }
}

function advancePanel() {
  score += PANEL_CLEAR_SCORE;
  if (panel >= 8) {
    victory = true;
    playVictory();
    return;
  }
  panel++;
  spawnedThisPanel = 0;
  spawnTimer = 0;
  monsters.length = 0;
}

function update(dt) {
  // The run has ended, is paused, or a panel is being celebrated: hold physics still.
  if (gameOver || victory || paused) return;

  if (panelClearTimer > 0) {
    panelClearTimer = Math.max(0, panelClearTimer - dt);
    if (panelClearTimer <= 0) advancePanel();
    return;
  }

  // --- run ---
  // Only live play counts, so the temporary hint's clock pauses on overlays.
  runTime += dt;

  let dir = 0;
  if (held.has('ArrowLeft') || held.has('KeyA') || touchDir < 0) dir -= 1;
  if (held.has('ArrowRight') || held.has('KeyD') || touchDir > 0) dir += 1;
  player.vx = dir * MOVE_SPEED;
  if (dir !== 0) player.facing = dir;
  player.x += player.vx * dt;

  const halfW = PLAYER_W / 2;
  player.x = Math.min(PLAYFIELD_W - halfW, Math.max(halfW, player.x));

  // --- jump ---
  // The first jump uses JUMP_VELOCITY; the second, mid-air tap is weaker.
  if (jumpQueued && player.jumpsUsed < MAX_JUMPS) {
    player.vy = player.jumpsUsed === 0 ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY;
    player.grounded = false;
    player.jumpsUsed++;
    playJump();
  }
  jumpQueued = false;

  // --- gravity ---
  const prevBottom = player.y;
  player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED);
  player.y += player.vy * dt;
  player.grounded = false;

  // --- spawn ---
  spawnTimer -= dt;
  if (spawnTimer <= 0 && spawnedThisPanel < monstersPerPanel(panel)) {
    spawnMonster();
    spawnedThisPanel++;
    spawnTimer = SPAWN_INTERVAL / (1 + (panel - 1) * SPAWN_PANEL_MULTIPLIER);
  }

  updateMonsters(dt);

  // --- stomp ---
  // Falling onto a live ground crawler's top edge kills it and bounces the
  // player. Flyers are not stompable: land on one and it is still side contact.
  for (const m of monsters) {
    if (m.dead || m.flying) continue;
    const mLeft = m.x - m.w / 2;
    const mRight = m.x + m.w / 2;
    const mTop = m.y - m.h;
    const overlapX = player.x + halfW > mLeft && player.x - halfW < mRight;
    if (overlapX && player.vy > 0 && prevBottom <= mTop && player.y >= mTop) {
      player.y = mTop;
      player.vy = STOMP_BOUNCE_VELOCITY;
      player.grounded = true;
      player.jumpsUsed = 0;
      killMonster(m);
      playStomp();
      break;
    }
  }

  // --- ground ---
  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.grounded = true;
    player.jumpsUsed = 0;
  }

  // --- side contact / overlap ---
  // Any overlap with a live monster that wasn't a stomp ends the run. Flyers
  // included: running under one is safe, touching it is not.
  for (const m of monsters) {
    if (m.dead) continue;
    const mLeft = m.x - m.w / 2;
    const mRight = m.x + m.w / 2;
    const mTop = m.y - m.h;
    const mBottom = m.y;
    const pLeft = player.x - halfW;
    const pRight = player.x + halfW;
    const pTop = player.y - PLAYER_H;
    const pBottom = player.y;
    if (pRight > mLeft && pLeft < mRight && pBottom > mTop && pTop < mBottom) {
      player.x = player.x < m.x ? mLeft - halfW : mRight + halfW;
      player.vx = 0;
      player.vy = 0;
      gameOver = true;
      playGameOver();
      return;
    }
  }

  // --- slash ---
  if (slashQueued) {
    player.slashTimer = SLASH_DURATION;
    slashQueued = false;
    hasSlashed = true;
    playSlash();
  }
  if (player.slashTimer > 0) {
    player.slashTimer = Math.max(0, player.slashTimer - dt);
    let connected = false;
    for (const m of monsters) {
      if (!m.dead && slashHitsMonster(m)) {
        killMonster(m);
        connected = true;
      }
    }
    if (connected) playHit();
  }

  // --- panel clear ---
  if (spawnedThisPanel >= monstersPerPanel(panel) && monsters.every((m) => m.dead)) {
    panelClearTimer = PANEL_CLEAR_DELAY;
    jumpQueued = false;
    slashQueued = false;
  }
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

const view = { scale: 1, x: 0, y: 0 };

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cssW = innerWidth;
  const cssH = innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  view.scale = Math.min(cssW / PLAYFIELD_W, cssH / PLAYFIELD_H) * dpr;
  view.x = (cssW * dpr - PLAYFIELD_W * view.scale) / 2;
  view.y = (cssH * dpr - PLAYFIELD_H * view.scale) / 2;
}
addEventListener('resize', resize);
resize();

// Chunky comic shapes: a polygon with every corner rounded off.
function roundedPath(points, radius) {
  const n = points.length;
  const towards = (from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    return { x: from.x + dx * radius / len, y: from.y + dy * radius / len };
  };
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const cur = points[i];
    const enter = towards(cur, points[(i - 1 + n) % n]);
    const leave = towards(cur, points[(i + 1) % n]);
    if (i === 0) ctx.moveTo(enter.x, enter.y);
    else ctx.lineTo(enter.x, enter.y);
    ctx.arcTo(cur.x, cur.y, leave.x, leave.y, radius);
  }
  ctx.closePath();
}

function getStage() {
  return STAGES_PER_PANEL[Math.max(0, Math.min(panel - 1, STAGES_PER_PANEL.length - 1))];
}

// World backgrounds (sky, midground scenery, ground platform) now live in ./worlds.js.

function drawSketchOverlay(stage) {
  if (stage >= 2) return;
  ctx.save();
  ctx.strokeStyle = '#8A8A8A';
  ctx.lineWidth = 1;
  ctx.globalAlpha = stage === 0 ? 0.22 : 0.1;
  for (let i = -100; i < PLAYFIELD_W + 100; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, PANEL_MARGIN);
    ctx.lineTo(i + 90, GROUND_Y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHalftone() {
  ctx.save();
  ctx.fillStyle = halftonePattern;
  ctx.globalAlpha = HALFTONE_OPACITY;
  ctx.fillRect(PANEL_MARGIN, PANEL_MARGIN, PLAYFIELD_W - PANEL_MARGIN * 2, PLAYFIELD_H - PANEL_MARGIN * 2);
  ctx.restore();
}

function drawPaperGrain() {
  ctx.save();
  ctx.fillStyle = grainPattern;
  ctx.globalAlpha = 0.08;
  ctx.fillRect(PANEL_MARGIN, PANEL_MARGIN, PLAYFIELD_W - PANEL_MARGIN * 2, PLAYFIELD_H - PANEL_MARGIN * 2);
  ctx.restore();
}

function drawPanel() {
  const stage = getStage();

  ctx.fillStyle = currentPaper;
  ctx.fillRect(0, 0, PLAYFIELD_W, PLAYFIELD_H);

  // Whole world background (sky, midground scenery, ground platform) in one call.
  // The panel number drives its per-panel variation.
  drawWorldBackground(ctx, world, stage, currentPaper, panel);

  // Minimal inking flash while a panel clear is being celebrated.
  if (panelClearTimer > 0) {
    const flash = panelClearTimer / PANEL_CLEAR_DELAY;
    ctx.fillStyle = PANEL_FLASH_COLOR;
    ctx.globalAlpha = 0.15 + flash * 0.25;
    ctx.fillRect(PANEL_MARGIN, PANEL_MARGIN, PLAYFIELD_W - PANEL_MARGIN * 2, PLAYFIELD_H - PANEL_MARGIN * 2);
    ctx.globalAlpha = 1;
  }

  drawSketchOverlay(stage);
  drawHalftone();
  drawPaperGrain();

  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = COLOR_INK;
  ctx.strokeRect(PANEL_MARGIN, PANEL_MARGIN, PLAYFIELD_W - PANEL_MARGIN * 2, PLAYFIELD_H - PANEL_MARGIN * 2);
}

// ---------------------------------------------------------------------------
// Monster designs
// Canvas 2D, comic-ink style: flat world colours, chunky COLOR_INK outlines and
// halftone shading. Every shape is drawn in local space with the origin at the
// middle of the enemy's feet and y growing downward, like the rest of the field.
// ---------------------------------------------------------------------------

// Fill the finished path(s) with a flat colour, shade with clipped halftone
// dots, then ink the outline. A dying enemy flashes bright cream instead.
function paintMonster(m, colors, fillColor) {
  ctx.fillStyle = m.dead ? COLOR_EYE : (fillColor || colors.body);
  ctx.fill();
  if (!m.dead && getStage() >= 2) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = MONSTER_HALFTONE_OPACITY;
    ctx.fillStyle = halftonePattern;
    ctx.fillRect(-m.w * 2, -m.h * 3, m.w * 4, m.h * 6);
    ctx.restore();
  }
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = COLOR_INK;
  ctx.stroke();
}

// Cream eye with an ink pupil: the one face detail every living enemy shares.
function monsterEye(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_EYE;
  ctx.fill();
  ctx.lineWidth = OUTLINE_WIDTH * 0.6;
  ctx.strokeStyle = COLOR_INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_INK;
  ctx.fill();
}

// A star outline: alternating outer and inner radii, used for the shooting star.
function starPath(cx, cy, outer, inner, points, rot) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// World 0, Print Shop: scissors. One half of the tool: a chunky blade plus its
// handle ring, rotated about the pivot by `ang`.
function scissorsHalf(m, colors, ang, w, h) {
  const bladeLen = h * 0.62;
  const bladeW = h * 0.14;
  const ringX = w * 0.34;
  const ringR = h * 0.18;
  ctx.save();
  ctx.rotate(ang);
  // Blade, a wedge that opens upward as it walks.
  ctx.beginPath();
  ctx.moveTo(0, -bladeW / 2);
  ctx.lineTo(-bladeLen * 0.7, -bladeW * 0.34);
  ctx.lineTo(-bladeLen, 0);
  ctx.lineTo(-bladeLen * 0.7, bladeW * 0.34);
  ctx.lineTo(0, bladeW / 2);
  ctx.closePath();
  paintMonster(m, colors);
  // Handle: a mustard shank out to the ring.
  ctx.beginPath();
  ctx.moveTo(0, -bladeW * 0.6);
  ctx.lineTo(ringX - ringR, -ringR * 0.5);
  ctx.lineTo(ringX - ringR, ringR * 0.5);
  ctx.lineTo(0, bladeW * 0.6);
  ctx.closePath();
  paintMonster(m, colors, colors.accent);
  // The ring itself is just thick ink, like a real scissor handle.
  ctx.beginPath();
  ctx.arc(ringX, 0, ringR, 0, Math.PI * 2);
  ctx.lineWidth = OUTLINE_WIDTH * 1.3;
  ctx.strokeStyle = COLOR_INK;
  ctx.stroke();
  ctx.restore();
}

function drawScissorsMonster(m, w, h, colors) {
  const open = 0.28 + 0.42 * (0.5 + 0.5 * Math.sin(m.anim * MONSTER_SNIP_SPEED));
  const px = -w * 0.04;
  const py = -h * 0.52;
  ctx.save();
  ctx.translate(px, py);
  scissorsHalf(m, colors, open, w, h);
  scissorsHalf(m, colors, -open, w, h);
  ctx.restore();
  // Pivot bolt holding the halves together.
  ctx.beginPath();
  ctx.arc(px, py, h * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_INK;
  ctx.fill();
}

// World 0, Print Shop: flying eraser block, streaks trailing behind it.
function drawEraserMonster(m, w, h, colors) {
  ctx.save();
  ctx.strokeStyle = COLOR_INK; // ink lines, so they stay visible over cream paper
  ctx.globalAlpha = MONSTER_STREAK_ALPHA;
  ctx.lineCap = 'round';
  ctx.lineWidth = OUTLINE_WIDTH * 0.7;
  for (let i = 0; i < 3; i++) {
    const y = -h * (0.3 + i * 0.22);
    ctx.beginPath();
    ctx.moveTo(w * 0.48, y);
    ctx.lineTo(w * (0.9 + i * 0.3), y - h * 0.08 * (i - 1));
    ctx.stroke();
  }
  ctx.restore();
  // The block, with a cream sleeve band on its trailing side.
  roundedPath([
    { x: -w / 2, y: -h },
    { x: w / 2, y: -h },
    { x: w / 2, y: 0 },
    { x: -w / 2, y: 0 },
  ], h * 0.26);
  paintMonster(m, colors);
  ctx.beginPath();
  ctx.rect(w * 0.02, -h, w * 0.2, h);
  paintMonster(m, colors, colors.accent);
  if (!m.dead) monsterEye(-w * 0.24, -h * 0.55, h * 0.16);
}

// World 1, The Garden: pink worm, crawling on a wave of body segments.
function drawWormMonster(m, w, h, colors) {
  const segs = 5;
  const r = h * 0.3;
  const step = (w - r * 2) / (segs - 1);
  const wob = (i) => Math.sin(m.anim * MONSTER_WORM_WAVE_SPEED + i * 0.9) * h * 0.1;
  // Tail first so the head lands on top of the last segment.
  for (let i = segs - 1; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(-w / 2 + r + i * step, -r - h * 0.02 + wob(i), r * (1 - i * 0.06), 0, Math.PI * 2);
    paintMonster(m, colors);
  }
  if (!m.dead) {
    const hx = -w / 2 + r;
    const hy = -r - h * 0.02 + wob(0);
    monsterEye(hx - r * 0.25, hy - r * 0.2, r * 0.42);
    // Chewing mouth, opening toward the way it crawls.
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.95, hy + r * 0.3);
    ctx.quadraticCurveTo(hx - r * 0.45, hy + r * 0.8, hx - r * 0.05, hy + r * 0.35);
    ctx.lineWidth = OUTLINE_WIDTH * 0.7;
    ctx.strokeStyle = COLOR_INK;
    ctx.stroke();
  }
}

// World 1, The Garden: a chunky bird with a flapping wing, used for the robin
// (crest false, red breast) and the blue jay (crest true, cream belly).
function drawBirdMonster(m, w, h, colors, crest) {
  const cy = -h * 0.55;
  const flap = m.dead ? 0 : Math.sin(m.anim * MONSTER_WING_SPEED) * 0.5;
  const hx = -w * 0.26;
  const hy = cy - h * 0.24;
  // Tail feathers, trailing behind.
  ctx.beginPath();
  ctx.moveTo(w * 0.22, cy - h * 0.12);
  ctx.lineTo(w * 0.5, cy - h * 0.3);
  ctx.lineTo(w * 0.48, cy + h * 0.04);
  ctx.lineTo(w * 0.2, cy + h * 0.14);
  ctx.closePath();
  paintMonster(m, colors);
  // Body and breast.
  ctx.beginPath();
  ctx.ellipse(0, cy, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
  paintMonster(m, colors);
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, cy + h * 0.12, w * 0.19, h * 0.17, 0, 0, Math.PI * 2);
  paintMonster(m, colors, colors.accent);
  // Wing, hinged at the shoulder.
  ctx.save();
  ctx.translate(w * 0.02, cy - h * 0.16);
  ctx.rotate(flap);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(w * 0.06, -h * 0.42, -w * 0.06, -h * 0.5);
  ctx.quadraticCurveTo(w * 0.3, -h * 0.42, w * 0.34, -h * 0.02);
  ctx.closePath();
  paintMonster(m, colors);
  ctx.restore();
  // Head, beak, and the jay's spiked crest.
  if (crest) {
    ctx.beginPath();
    ctx.moveTo(hx - h * 0.14, hy - h * 0.1);
    ctx.lineTo(hx - h * 0.02, hy - h * 0.42);
    ctx.lineTo(hx + h * 0.1, hy - h * 0.12);
    ctx.closePath();
    paintMonster(m, colors);
  }
  ctx.beginPath();
  ctx.arc(hx, hy, h * 0.2, 0, Math.PI * 2);
  paintMonster(m, colors);
  ctx.beginPath();
  ctx.moveTo(hx - h * 0.16, hy - h * 0.07);
  ctx.lineTo(hx - h * 0.42, hy + h * 0.02);
  ctx.lineTo(hx - h * 0.16, hy + h * 0.1);
  ctx.closePath();
  paintMonster(m, colors, colors.beak);
  if (!m.dead) monsterEye(hx - h * 0.08, hy - h * 0.02, h * 0.07);
}

// World 2, Midnight Sky: a grinning gold sun with rays that roll as it goes.
function drawSunMonster(m, w, h, colors) {
  const r = h * 0.34;
  const rayLen = h * 0.16;
  const cy = -h * 0.5;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = m.anim * MONSTER_SPIN_SPEED + (i * Math.PI) / 6;
    ctx.moveTo(Math.cos(a - 0.13) * r, cy + Math.sin(a - 0.13) * r);
    ctx.lineTo(Math.cos(a) * (r + rayLen), cy + Math.sin(a) * (r + rayLen));
    ctx.lineTo(Math.cos(a + 0.13) * r, cy + Math.sin(a + 0.13) * r);
    ctx.closePath();
  }
  paintMonster(m, colors);
  ctx.beginPath();
  ctx.arc(0, cy, r, 0, Math.PI * 2);
  paintMonster(m, colors);
  if (!m.dead) {
    ctx.beginPath();
    ctx.arc(-r * 0.35, cy - r * 0.12, r * 0.12, 0, Math.PI * 2);
    ctx.arc(r * 0.35, cy - r * 0.12, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, cy + r * 0.1, r * 0.45, 0.25, Math.PI - 0.25);
    ctx.lineWidth = OUTLINE_WIDTH * 0.8;
    ctx.strokeStyle = COLOR_INK;
    ctx.stroke();
  }
}

// World 2, Midnight Sky: a fast cream star streaming a gold tail.
function drawShootingStarMonster(m, w, h, colors) {
  const outer = h * 0.5;
  const cx = -w * 0.2;
  const cy = -h * 0.5;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const spread = (i - 1) * h * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx + outer * 0.6, cy + spread * 0.5);
    ctx.lineTo(cx + w * 0.5 + i * w * 0.08, cy + spread);
    ctx.lineTo(cx + outer * 0.6, cy + spread * 0.5 + h * 0.1);
    ctx.closePath();
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.7 - i * 0.15;
    ctx.fill();
  }
  ctx.restore();
  starPath(cx, cy, outer, outer * 0.42, 5, m.anim * MONSTER_SPIN_SPEED * 0.6);
  paintMonster(m, colors);
  if (!m.dead) monsterEye(cx - outer * 0.12, cy - outer * 0.05, outer * 0.14);
}

// One enemy, drawn in its own local space. Killed crawlers squash flat under
// the stomp; a dying enemy flashes cream for HIT_FLASH seconds, then vanishes.
function drawMonster(m) {
  const colors = MONSTER_COLORS[m.type.id];
  const squash = m.dead && !m.flying ? STOMP_SQUASH * (m.hitTimer / HIT_FLASH) : 0;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(1 + squash * 0.5, 1 - squash);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (m.type.id) {
    case 'scissors': drawScissorsMonster(m, m.w, m.h, colors); break;
    case 'eraser': drawEraserMonster(m, m.w, m.h, colors); break;
    case 'worm': drawWormMonster(m, m.w, m.h, colors); break;
    case 'robin': drawBirdMonster(m, m.w, m.h, colors, false); break;
    case 'bluejay': drawBirdMonster(m, m.w, m.h, colors, true); break;
    case 'sun': drawSunMonster(m, m.w, m.h, colors); break;
    case 'shootingstar': drawShootingStarMonster(m, m.w, m.h, colors); break;
  }
  ctx.restore();
}

function drawMonsters() {
  for (const m of monsters) {
    // Dead monsters stay bright for HIT_FLASH seconds before disappearing.
    if (m.dead && m.hitTimer <= 0) continue;
    drawMonster(m);
  }
}

function drawMitten(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawPlayerShape(w, h) {
  if (world === 0) {
    // Triangle Guy: a rounded red triangle with a flowing cape behind him.
    const cy = -h / 2;
    // Cape.
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -h * 0.88);
    ctx.quadraticCurveTo(-w * 1.05, -h * 0.55, -w * 0.75, -h * 0.12);
    ctx.quadraticCurveTo(-w * 0.55, -h * 0.22, -w * 0.45, 0);
    ctx.lineTo(-w * 0.35, -h * 0.15);
    ctx.closePath();
    ctx.fillStyle = gameOver ? COLOR_DEATH : WORLD_PLAYER_FILL[world];
    ctx.fill();
    ctx.stroke();
    // Body.
    roundedPath([
      { x: -w / 2, y: -h },
      { x: w / 2, y: -h / 2 },
      { x: -w / 2, y: 0 },
    ], Math.min(w, h) * 0.32);
  } else if (world === 1) {
    // Ink Blot: a black teardrop with a small trailing droplet.
    const cy = -h / 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.48, cy);
    ctx.bezierCurveTo(w * 0.48, cy - h * 0.55, -w * 0.42, cy - h * 0.55, -w * 0.42, cy);
    ctx.bezierCurveTo(-w * 0.42, cy + h * 0.35, w * 0.12, cy + h * 0.5, w * 0.48, cy);
    ctx.closePath();
    // Trailing droplet.
    ctx.moveTo(-w * 0.62, -h * 0.45);
    ctx.arc(-w * 0.62, -h * 0.45, w * 0.12, 0, Math.PI * 2);
  } else {
    // Crescent Moon: a cream crescent opening forward.
    const cy = -h / 2;
    const r = h * 0.58;
    const outerX = -w * 0.1;
    const innerX = outerX + w * 0.32;
    ctx.beginPath();
    ctx.arc(outerX, cy, r, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.arc(innerX, cy, r * 0.78, Math.PI * 0.45, -Math.PI * 0.45, true);
    ctx.closePath();
  }
}

function drawPlayerFace(w, h) {
  ctx.fillStyle = WORLD_PLAYER_EYE[world];
  ctx.strokeStyle = COLOR_INK;
  ctx.lineWidth = OUTLINE_WIDTH * 0.75;
  if (world === 0) {
    // Triangle Guy: one big oval eye and a determined eyebrow.
    ctx.beginPath();
    ctx.ellipse(w * 0.02, -h * 0.55, w * 0.14, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Eyebrow.
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -h * 0.78);
    ctx.quadraticCurveTo(w * 0.05, -h * 0.85, w * 0.18, -h * 0.75);
    ctx.stroke();
  } else if (world === 1) {
    // Ink Blot: two cream eye holes and a worried brow.
    ctx.beginPath();
    ctx.ellipse(-w * 0.06, -h * 0.62, w * 0.1, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(w * 0.14, -h * 0.58, w * 0.09, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Worried lines.
    ctx.beginPath();
    ctx.moveTo(-w * 0.18, -h * 0.78);
    ctx.quadraticCurveTo(0, -h * 0.88, w * 0.22, -h * 0.76);
    ctx.stroke();
  } else {
    // Crescent: one yellow eye inside the moon bowl.
    ctx.beginPath();
    ctx.arc(-w * 0.02, -h * 0.5, w * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawPlayerHands(w, h) {
  ctx.fillStyle = gameOver ? COLOR_DEATH : WORLD_PLAYER_FILL[world];
  ctx.strokeStyle = COLOR_INK;
  ctx.lineWidth = OUTLINE_WIDTH * 0.75;
  if (world === 0) {
    // Triangle Guy: mittens at front and back.
    drawMitten(w * 0.42, -h * 0.35, w * 0.11);
    drawMitten(-w * 0.25, -h * 0.18, w * 0.1);
  } else if (world === 1) {
    // Ink Blot: tiny mittens.
    drawMitten(w * 0.25, -h * 0.25, w * 0.09);
    drawMitten(-w * 0.32, -h * 0.22, w * 0.08);
  } else {
    // Crescent: small mittens at the tips.
    drawMitten(w * 0.32, -h * 0.22, w * 0.09);
    drawMitten(w * 0.22, -h * 0.78, w * 0.09);
  }
}

function drawPlayer() {
  const w = PLAYER_W;
  const h = PLAYER_H;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(player.facing, 1);
  ctx.lineJoin = 'round';
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = COLOR_INK;

  drawPlayerShape(w, h);
  ctx.fillStyle = gameOver ? COLOR_DEATH : WORLD_PLAYER_FILL[world];
  ctx.fill();
  ctx.stroke();

  drawPlayerHands(w, h);
  drawPlayerFace(w, h);
  ctx.restore();
}

function drawSlash() {
  if (player.slashTimer <= 0) return;
  ctx.save();
  ctx.translate(player.x, player.y - PLAYER_H * SHOULDER_HEIGHT);
  ctx.scale(player.facing, 1);
  ctx.globalAlpha = player.slashTimer / SLASH_DURATION;
  ctx.strokeStyle = COLOR_INK;
  ctx.lineWidth = SLASH_THICKNESS;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, SLASH_REACH, -SLASH_ARC_SPREAD / 2, SLASH_ARC_SPREAD / 2);
  ctx.stroke();
  ctx.restore();
}

function drawScore() {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `${SCORE_FONT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  ctx.strokeStyle = COLOR_INK;
  const text = `SCORE ${score}`;
  const x = PANEL_MARGIN + 12;
  const y = PANEL_MARGIN + 8;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = currentPaper;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPanelCounter() {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = `${PANEL_COUNTER_FONT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  ctx.strokeStyle = COLOR_INK;
  const text = `PANEL ${panel} OF 8`;
  const x = PLAYFIELD_W - PANEL_MARGIN - 12;
  const y = PANEL_MARGIN + 10;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = currentPaper;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// A temporary nudge line in the bottom-left of the panel: it goes away as soon
// as the player has slashed once, or after CONTROLS_HINT_DURATION seconds.
function drawControlsHint() {
  if (hasSlashed || runTime >= CONTROLS_HINT_DURATION) return;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = `${CONTROLS_HINT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR_INK;
  const x = PANEL_MARGIN + CONTROLS_HINT_MARGIN;
  const y = PLAYFIELD_H - PANEL_MARGIN - CONTROLS_HINT_MARGIN;
  ctx.strokeText(CONTROLS_HINT, x, y);
  ctx.fillStyle = currentPaper;
  ctx.fillText(CONTROLS_HINT, x, y);
  ctx.restore();
}

function drawPanelClear() {
  if (panelClearTimer <= 0) return;
  const cx = PLAYFIELD_W / 2;
  const cy = PLAYFIELD_H / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR_INK;
  ctx.font = `${PANEL_CLEAR_FONT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  const text = `PANEL ${panel} CLEARED!`;
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = currentPaper;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

// The end-of-run marker: inked "GAME OVER" plus the retry prompt, centred in the panel.
function drawGameOver() {
  if (!gameOver) return;
  const cx = PLAYFIELD_W / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR_INK;

  ctx.font = `${GAME_OVER_FONT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  ctx.strokeText(GAME_OVER_TEXT, cx, GAME_OVER_BANNER_Y);
  ctx.fillStyle = currentPaper;
  ctx.fillText(GAME_OVER_TEXT, cx, GAME_OVER_BANNER_Y);

  ctx.font = `${GAME_OVER_HINT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  const scoreY = GAME_OVER_BANNER_Y + GAME_OVER_HINT_GAP;
  const scoreText = `FINAL SCORE ${score}`;
  ctx.strokeText(scoreText, cx, scoreY);
  ctx.fillStyle = currentPaper;
  ctx.fillText(scoreText, cx, scoreY);

  const hintY1 = scoreY + GAME_OVER_HINT_SIZE + 10;
  ctx.strokeText(RESTART_HINT_LINE1, cx, hintY1);
  ctx.fillStyle = currentPaper;
  ctx.fillText(RESTART_HINT_LINE1, cx, hintY1);
  const hintY2 = hintY1 + GAME_OVER_HINT_SIZE + 8;
  ctx.strokeText(RESTART_HINT_LINE2, cx, hintY2);
  ctx.fillText(RESTART_HINT_LINE2, cx, hintY2);
  ctx.restore();
}

function drawVictory() {
  if (!victory) return;
  const cx = PLAYFIELD_W / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR_INK;

  ctx.font = `${VICTORY_FONT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  ctx.strokeText(VICTORY_TEXT, cx, GAME_OVER_BANNER_Y);
  ctx.fillStyle = currentPaper;
  ctx.fillText(VICTORY_TEXT, cx, GAME_OVER_BANNER_Y);

  ctx.font = `${GAME_OVER_HINT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  const scoreY = GAME_OVER_BANNER_Y + GAME_OVER_HINT_GAP;
  const scoreText = `FINAL SCORE ${score}`;
  ctx.strokeText(scoreText, cx, scoreY);
  ctx.fillStyle = currentPaper;
  ctx.fillText(scoreText, cx, scoreY);

  const hintY1 = scoreY + GAME_OVER_HINT_GAP;
  ctx.strokeText(VICTORY_HINT_LINE1, cx, hintY1);
  ctx.fillStyle = currentPaper;
  ctx.fillText(VICTORY_HINT_LINE1, cx, hintY1);
  const hintY2 = hintY1 + GAME_OVER_HINT_SIZE + 8;
  ctx.strokeText(VICTORY_HINT_LINE2, cx, hintY2);
  ctx.fillText(VICTORY_HINT_LINE2, cx, hintY2);
  ctx.restore();
}

function drawPaused() {
  if (!paused) return;
  const cx = PLAYFIELD_W / 2;
  const cy = PLAYFIELD_H / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR_INK;

  ctx.font = `${PAUSED_FONT_SIZE}px ${FONT_STACK}`;
  ctx.lineWidth = TEXT_OUTLINE_WIDTH;
  ctx.strokeText(PAUSED_TEXT, cx, cy);
  ctx.fillStyle = currentPaper;
  ctx.fillText(PAUSED_TEXT, cx, cy);

  ctx.font = `${GAME_OVER_HINT_SIZE}px ${FONT_STACK}`;
  const hintY = cy + PAUSED_FONT_SIZE * 0.7;
  ctx.strokeText(PAUSED_HINT, cx, hintY);
  ctx.fillText(PAUSED_HINT, cx, hintY);
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = currentPaper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

  drawPanel();
  drawMonsters();
  drawPlayer();
  drawSlash();
  drawScore();
  drawPanelCounter();
  drawControlsHint();
  drawPanelClear();
  drawGameOver();
  drawVictory();
  drawPaused();
  if (DEBUG_COLLIDERS) drawDebugColliders();
  if (SHOW_FPS) drawFPS();
}

function drawDebugColliders() {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#00FF00';
  ctx.strokeRect(player.x - PLAYER_W / 2, player.y - PLAYER_H, PLAYER_W, PLAYER_H);
  ctx.strokeStyle = '#FF0000';
  for (const m of monsters) {
    if (m.dead && m.hitTimer <= 0) continue;
    ctx.strokeRect(m.x - m.w / 2, m.y - m.h, m.w, m.h);
  }
  ctx.restore();
}

function drawFPS() {
  ctx.save();
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR_INK;
  const minText = minFps === Infinity ? '--' : Math.round(minFps);
  const text = `FPS ${Math.round(fps)} AVG ${Math.round(avgFps)} MIN ${minText}`;
  ctx.strokeText(text, PANEL_MARGIN + 8, PANEL_MARGIN + 42);
  ctx.fillStyle = '#F2E5C4';
  ctx.fillText(text, PANEL_MARGIN + 8, PANEL_MARGIN + 42);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

let lastTime = performance.now();
function frame(now) {
  const rawDt = (now - lastTime) / 1000;
  const dt = Math.min(rawDt, MAX_DT);
  lastTime = now;
  update(dt);
  draw();

  if (SHOW_FPS) {
    fps = 1 / Math.max(rawDt, 0.0001);
    fpsAccumulator += fps;
    fpsFrameCount++;
    if (fpsFrameCount >= 30) {
      avgFps = fpsAccumulator / fpsFrameCount;
      minFps = Math.min(minFps, avgFps);
      fpsAccumulator = 0;
      fpsFrameCount = 0;
    }
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
