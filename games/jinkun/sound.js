// sound.js — the game's three sounds, synthesized live with WebAudio: no audio files anywhere.

// ---- Tunables. One place to change the whole mix. Levels are linear gains, times are seconds, pitches are Hz.

const MASTER_GAIN = 0.5;          // the single overall volume knob: every voice routes through this one node.

// The scan drone: a low, filtered, slowly pulsing hum that says the instrument is running. It has to sit under
// everything for a full minute without getting annoying, so it stays quiet, low and steady.
const SCAN_DRONE_HZ = 55;         // the drone's base pitch: A1, low enough to sit under everything else.
const SCAN_DRONE_RATIO = 1.5;     // the second sawtooth runs a fifth above, E2, so the two beat gently.
const SCAN_DRONE_DETUNE = 5;      // cents the second sawtooth is detuned, for a slow wobble, not a clean tone.
const SCAN_FILTER_HZ = 300;       // the lowpass that keeps the sawtooths soft instead of buzzy.
const SCAN_FILTER_Q = 2;          // a little resonance, so the drone has a faint voice of its own.
const SCAN_FILTER_SWING = 0.25;   // how much a faster scan opens that filter: brighter when you fly low.
const SCAN_LEVEL = 0.16;          // the drone's peak level: quiet, so a minute of it stays unobtrusive.
const SCAN_PULSE_DEPTH = 0.5;     // how deep the pulse dips: 0.5 swings the level from full down to silence.
const SCAN_PULSE_HZ = 0.8;        // pulses per second at scan multiple 1.0, the slowest rate.
const SCAN_PITCH_SWING = 0.12;    // how much a faster scan raises the drone: +12 percent pitch per multiple step.
const SCAN_FADE = 0.25;           // seconds to fade the drone in and out, so it never clicks on or off.
const SCAN_MULTIPLE_MIN = 0.5;    // the incoming multiple is clamped to this...
const SCAN_MULTIPLE_MAX = 3;      // ...and to this, so a bad value cannot give silence or a scream.

// The hit: a short, low thud for a rock collision. It must survive four hits in a few seconds without hurting.
const HIT_NOISE_HZ = 900;         // the lowpass on the noise burst: dull, not a sharp crack.
const HIT_NOISE_LEVEL = 0.45;     // the noise burst's peak.
const HIT_NOISE_DECAY = 0.13;     // how fast the burst dies: short enough to read as a bump, not a bang.
const HIT_THUMP_HZ = 90;          // the low sine's starting pitch...
const HIT_THUMP_END_HZ = 45;      // ...dropping to here, the weight under the burst.
const HIT_THUMP_LEVEL = 0.6;      // the thump's peak: the body of the hit.
const HIT_THUMP_DECAY = 0.22;     // the thump's decay, a touch longer than the noise.

// The crash: the run is over. Longer and lower than a hit, falling away to nothing.
const CRASH_START_HZ = 220;       // where the descending tone starts...
const CRASH_END_HZ = 38;          // ...and where it lands, near the bottom of hearing.
const CRASH_FILTER_START_HZ = 1200;  // the lowpass starts open...
const CRASH_FILTER_END_HZ = 200;     // ...and closes as the tone falls, so the tail is a low groan.
const CRASH_LEVEL = 0.6;          // the crash's peak.
const CRASH_DURATION = 1.6;       // how long the fall takes: clearly longer than a hit.

// The complete chime: the one clearly pleasant sound in the game. Three rising notes.
const CHIME_NOTES = [523.25, 659.25, 783.99];  // C5, E5, G5: a plain rising major triad.
const CHIME_STEP = 0.12;          // seconds between the notes, so they ring out as one rising figure.
const CHIME_LEVEL = 0.3;          // each note's peak.
const CHIME_DECAY = 0.7;          // how long each note rings before it dies.

// The engine: the ship's steady hum. It is a constant forward flight, not a throttle, so the only thing it
// answers is the climb and dive the player does constantly. It sits an octave above the scan drone and, unlike
// the drone, never pulses: the two read as different machines.
const ENGINE_HZ = 110;            // the hum's base pitch: A2, an octave above the scan drone so the two never fight.
const ENGINE_OCTAVE = 2;          // the second voice runs an octave up, adding body without a slow beat.
const ENGINE_FILTER_HZ = 600;     // the lowpass that keeps the hum warm rather than buzzy.
const ENGINE_FILTER_Q = 1;        // barely any resonance: a hum, not a whistle.
const ENGINE_LEVEL = 0.1;         // the hum's steady level: above the drone's average, well below a hit.
const ENGINE_PITCH_SWING = 0.18;  // how much a full climb raises the pitch: +18 percent at climb 1, -18 at -1.
const ENGINE_FILTER_SWING = 0.6;  // how much a full climb opens the filter: brighter working against gravity.
const ENGINE_FADE = 0.4;          // seconds to fade the hum in and out.
const ENGINE_CLIMB_MIN = -1;      // climb is clamped to this...
const ENGINE_CLIMB_MAX = 1;       // ...and this. A non-finite climb falls back to 0, level flight.

// The music: a slow drifting pad, not a tune. Three soft detuned voices through a lowpass, with two very slow
// and deliberately mismatched drifts on the cutoff and the level. No rhythm, no melody, no chord change, and
// nothing that ever restarts, so it runs forever with no audible seam. It is the quietest continuous voice.
const MUSIC_ROOT_HZ = 196;        // G3: the pad's root, above the engine so the bed never crowds the hum.
const MUSIC_RATIO_FIFTH = 1.5;    // the fifth above the root...
const MUSIC_RATIO_OCTAVE = 2;     // ...and the octave, so the pad is a soft open chord.
const MUSIC_DETUNE = 7;           // cents the pad's voices are detuned, for a slow drift rather than a clean tone.
const MUSIC_FILTER_HZ = 1100;     // the lowpass that keeps the pad soft and distant.
const MUSIC_FILTER_Q = 1;         // a hair of resonance, so the drift is heard as movement.
const MUSIC_CUTOFF_DRIFT_HZ = 0.06;    // the slow cutoff drift: a swell of about seventeen seconds, not a rhythm.
const MUSIC_CUTOFF_DRIFT_DEPTH = 260;  // how far in Hz that drift moves the cutoff either way.
const MUSIC_LEVEL_DRIFT_HZ = 0.043;    // a second, slower drift on the level, set incommensurate so no pattern forms.
const MUSIC_LEVEL_DRIFT_DEPTH = 0.3;   // how deep the level drift goes, as a fraction of the pad's level.
const MUSIC_LEVEL = 0.06;         // the pad's level: the quietest continuous voice in the mix.
const MUSIC_FADE = 1.5;           // seconds to fade the bed in and out, so it never starts or stops abruptly.

// The noise burst is built once, deterministically, from this seed: no Math.random, same sound every load.
const NOISE_SEED = 0x9e3779b9;
const NOISE_SECONDS = 0.4;        // the buffer's length: comfortably past the hit's decay.

// ---- State. Everything here is null or idle until initSound() runs from a real user gesture.

let ctx = null;         // the AudioContext, created lazily and only ever once.
let master = null;      // the single gain node every voice routes through.
let scanNodes = null;   // the running scan's nodes, or null when the scan is not playing.
let scanMultiple = 1;   // the last multiple setScanTone() was given, so a fresh scan starts in tune.
let engineNodes = null; // the running engine's nodes, or null when the hum is not playing.
let engineClimb = 0;    // the last climb setEngineTone() was given, so a fresh hum starts in tune.
let musicNodes = null;  // the running music bed's nodes, or null when the bed is not playing.
let noiseBuf = null;    // the cached deterministic noise buffer.

// mulberry32: the same small seeded random sky.js uses, so the noise burst is identical on every load.
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Keep a caller's multiple sane. A missing or non-finite value falls back to 1.0, never to silence or a scream.
function clampMultiple(multiple) {
  const m = Number(multiple);
  if (!Number.isFinite(m)) return 1;
  return Math.min(SCAN_MULTIPLE_MAX, Math.max(SCAN_MULTIPLE_MIN, m));
}

// Keep a caller's climb sane. A missing or non-finite value falls back to 0, level flight.
function clampClimb(climb) {
  const c = Number(climb);
  if (!Number.isFinite(c)) return 0;
  return Math.min(ENGINE_CLIMB_MAX, Math.max(ENGINE_CLIMB_MIN, c));
}

// The noise buffer: filled once from the seeded random and then reused, so the hit sounds the same every time.
function noiseBuffer() {
  if (noiseBuf) return noiseBuf;
  const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
  noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  const random = makeRandom(NOISE_SEED);
  for (let i = 0; i < length; i++) data[i] = random() * 2 - 1;
  return noiseBuf;
}

// Build and start the scan drone. Only called from startScan(), and only when a context exists.
function buildScan() {
  const now = ctx.currentTime;
  const m = scanMultiple;
  const pitch = SCAN_DRONE_HZ * (1 + SCAN_PITCH_SWING * (m - 1));

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = SCAN_FILTER_HZ * (1 + SCAN_FILTER_SWING * (m - 1));
  filter.Q.value = SCAN_FILTER_Q;

  // The gain's own value is the pulse's low point; the LFO adds on top of it to swing it up to full.
  const gain = ctx.createGain();
  gain.gain.value = 0;   // starts silent and is faded up below, so the drone never pops in.
  filter.connect(gain);
  gain.connect(master);

  const oscA = ctx.createOscillator();
  oscA.type = 'sawtooth';
  oscA.frequency.value = pitch;
  oscA.connect(filter);

  const oscB = ctx.createOscillator();
  oscB.type = 'sawtooth';
  oscB.frequency.value = pitch * SCAN_DRONE_RATIO;
  oscB.detune.value = SCAN_DRONE_DETUNE;
  oscB.connect(filter);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = SCAN_PULSE_HZ * m;
  const depth = ctx.createGain();
  depth.gain.value = SCAN_LEVEL * SCAN_PULSE_DEPTH;
  lfo.connect(depth);
  depth.connect(gain.gain);

  oscA.start(now);
  oscB.start(now);
  lfo.start(now);
  gain.gain.setTargetAtTime(SCAN_LEVEL * (1 - SCAN_PULSE_DEPTH), now, SCAN_FADE / 3);

  scanNodes = { oscA, oscB, lfo, filter, gain, depth };
}

// Create the AudioContext and resume it. Safe to call any number of times, from any user gesture.
export function initSound() {
  if (!ctx) {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return;   // no WebAudio in this browser: every export stays a quiet no-op.
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') {
    const resumed = ctx.resume();
    if (resumed && resumed.catch) resumed.catch(() => {});   // a blocked resume must not surface as an error.
  }
}

// Start the continuous scan sound. Idempotent: a second call while it is running does nothing.
export function startScan() {
  if (!ctx || scanNodes) return;
  buildScan();
}

// Stop the scan sound. Idempotent: safe to call when it is not running.
export function stopScan() {
  if (!ctx || !scanNodes) return;
  const { oscA, oscB, lfo, gain } = scanNodes;
  const now = ctx.currentTime;
  lfo.stop(now);   // stop the pulse first, so the fade below is not re-modulated.
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + SCAN_FADE);
  const end = now + SCAN_FADE + 0.05;
  oscA.stop(end);
  oscB.stop(end);
  scanNodes = null;
}

// Point the scan sound at a scan-rate multiple. 1.0 is the slowest rate; higher is faster. Clamped to sane bounds.
export function setScanTone(multiple) {
  scanMultiple = clampMultiple(multiple);   // remembered even before the context exists, so a fresh scan is in tune.
  if (!ctx || !scanNodes) return;
  const now = ctx.currentTime;
  const m = scanMultiple;
  const pitch = SCAN_DRONE_HZ * (1 + SCAN_PITCH_SWING * (m - 1));
  scanNodes.oscA.frequency.setTargetAtTime(pitch, now, 0.08);
  scanNodes.oscB.frequency.setTargetAtTime(pitch * SCAN_DRONE_RATIO, now, 0.08);
  scanNodes.lfo.frequency.setTargetAtTime(SCAN_PULSE_HZ * m, now, 0.08);
  scanNodes.filter.frequency.setTargetAtTime(SCAN_FILTER_HZ * (1 + SCAN_FILTER_SWING * (m - 1)), now, 0.12);
}

// Build and start the engine hum. Only called from startEngine(), and only when a context exists.
function buildEngine() {
  const now = ctx.currentTime;
  const m = 1 + ENGINE_PITCH_SWING * engineClimb;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = ENGINE_FILTER_HZ * (1 + ENGINE_FILTER_SWING * engineClimb);
  filter.Q.value = ENGINE_FILTER_Q;

  const gain = ctx.createGain();
  gain.gain.value = 0;   // starts silent and is faded up below.
  filter.connect(gain);
  gain.connect(master);

  // Two voices an octave apart and never detuned against each other, so the hum is steady: no pulse, no beat.
  const oscA = ctx.createOscillator();
  oscA.type = 'sawtooth';
  oscA.frequency.value = ENGINE_HZ * m;
  oscA.connect(filter);

  const oscB = ctx.createOscillator();
  oscB.type = 'triangle';
  oscB.frequency.value = ENGINE_HZ * ENGINE_OCTAVE * m;
  oscB.connect(filter);

  oscA.start(now);
  oscB.start(now);
  gain.gain.setTargetAtTime(ENGINE_LEVEL, now, ENGINE_FADE / 3);

  engineNodes = { oscA, oscB, filter, gain };
}

// Begin the ship's hum. Idempotent: a second call while it is running does nothing.
export function startEngine() {
  if (!ctx || engineNodes) return;
  buildEngine();
}

// Stop the hum. Idempotent: safe to call when it is not running.
export function stopEngine() {
  if (!ctx || !engineNodes) return;
  const { oscA, oscB, gain } = engineNodes;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + ENGINE_FADE);
  const end = now + ENGINE_FADE + 0.05;
  oscA.stop(end);
  oscB.stop(end);
  engineNodes = null;
}

// Point the hum at a climb. +1 is climbing hard, 0 is level, -1 is diving. Clamped, and remembered for a restart.
export function setEngineTone(climb) {
  engineClimb = clampClimb(climb);   // remembered even before the context exists, so a fresh hum is in tune.
  if (!ctx || !engineNodes) return;
  const now = ctx.currentTime;
  const m = 1 + ENGINE_PITCH_SWING * engineClimb;
  engineNodes.oscA.frequency.setTargetAtTime(ENGINE_HZ * m, now, 0.12);
  engineNodes.oscB.frequency.setTargetAtTime(ENGINE_HZ * ENGINE_OCTAVE * m, now, 0.12);
  engineNodes.filter.frequency.setTargetAtTime(ENGINE_FILTER_HZ * (1 + ENGINE_FILTER_SWING * engineClimb), now, 0.15);
}

// Build and start the music bed. Only called from startMusic(), and only when a context exists.
function buildMusic() {
  const now = ctx.currentTime;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = MUSIC_FILTER_HZ;
  filter.Q.value = MUSIC_FILTER_Q;

  // The level's own value is the drift's low point; the level LFO adds on top to swell it back up.
  const baseLevel = MUSIC_LEVEL * (1 - MUSIC_LEVEL_DRIFT_DEPTH);
  const gain = ctx.createGain();
  gain.gain.value = 0;   // starts silent and is faded up below.
  filter.connect(gain);
  gain.connect(master);

  // Three soft voices on a bare open chord, each detuned a little so they drift against one another very slowly.
  const oscs = [
    { type: 'sawtooth', hz: MUSIC_ROOT_HZ, detune: MUSIC_DETUNE },
    { type: 'sawtooth', hz: MUSIC_ROOT_HZ * MUSIC_RATIO_FIFTH, detune: -MUSIC_DETUNE },
    { type: 'triangle', hz: MUSIC_ROOT_HZ * MUSIC_RATIO_OCTAVE, detune: MUSIC_DETUNE * 0.6 }
  ].map((voice) => {
    const osc = ctx.createOscillator();
    osc.type = voice.type;
    osc.frequency.value = voice.hz;
    osc.detune.value = voice.detune;
    osc.connect(filter);
    osc.start(now);
    return osc;
  });

  // Two slow drifts, at deliberately mismatched rates so no pattern ever forms and no restart is ever heard.
  const cutoffLfo = ctx.createOscillator();
  cutoffLfo.type = 'sine';
  cutoffLfo.frequency.value = MUSIC_CUTOFF_DRIFT_HZ;
  const cutoffDepth = ctx.createGain();
  cutoffDepth.gain.value = MUSIC_CUTOFF_DRIFT_DEPTH;
  cutoffLfo.connect(cutoffDepth);
  cutoffDepth.connect(filter.frequency);
  cutoffLfo.start(now);

  const levelLfo = ctx.createOscillator();
  levelLfo.type = 'sine';
  levelLfo.frequency.value = MUSIC_LEVEL_DRIFT_HZ;
  const levelDepth = ctx.createGain();
  levelDepth.gain.value = MUSIC_LEVEL * MUSIC_LEVEL_DRIFT_DEPTH;
  levelLfo.connect(levelDepth);
  levelDepth.connect(gain.gain);
  levelLfo.start(now);

  gain.gain.setTargetAtTime(baseLevel, now, MUSIC_FADE / 3);

  musicNodes = { oscs, filter, gain, cutoffLfo, levelLfo };
}

// Begin the ambient music bed. Idempotent: a second call while it is running does nothing.
export function startMusic() {
  if (!ctx || musicNodes) return;
  buildMusic();
}

// Stop the music bed. Idempotent: safe to call when it is not running.
export function stopMusic() {
  if (!ctx || !musicNodes) return;
  const { oscs, gain, cutoffLfo, levelLfo } = musicNodes;
  const now = ctx.currentTime;
  cutoffLfo.stop(now);   // stop both drifts first, so the fade below is not re-modulated.
  levelLfo.stop(now);
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE);
  const end = now + MUSIC_FADE + 0.05;
  for (const osc of oscs) osc.stop(end);
  musicNodes = null;
}

// One-shot: a rock collision. A dull noise burst over a low thump, short and quiet enough to repeat.
export function playHit() {
  if (!ctx) return;
  const now = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer();
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = HIT_NOISE_HZ;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(HIT_NOISE_LEVEL, now + 0.005);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + HIT_NOISE_DECAY);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);
  noise.stop(now + HIT_NOISE_DECAY + 0.02);

  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(HIT_THUMP_HZ, now);
  thump.frequency.exponentialRampToValueAtTime(HIT_THUMP_END_HZ, now + HIT_THUMP_DECAY);
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.exponentialRampToValueAtTime(HIT_THUMP_LEVEL, now + 0.006);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + HIT_THUMP_DECAY);
  thump.connect(thumpGain);
  thumpGain.connect(master);
  thump.start(now);
  thump.stop(now + HIT_THUMP_DECAY + 0.02);
}

// One-shot: the hull is gone, the run is over. A low tone falling away, longer and heavier than a hit.
export function playCrash() {
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(CRASH_START_HZ, now);
  osc.frequency.exponentialRampToValueAtTime(CRASH_END_HZ, now + CRASH_DURATION);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(CRASH_FILTER_START_HZ, now);
  filter.frequency.exponentialRampToValueAtTime(CRASH_FILTER_END_HZ, now + CRASH_DURATION);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(CRASH_LEVEL, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + CRASH_DURATION);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + CRASH_DURATION + 0.05);
}

// One-shot: the scan finished. Three rising notes, the one clearly pleasant sound in the game.
export function playComplete() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < CHIME_NOTES.length; i++) {
    const at = now + i * CHIME_STEP;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = CHIME_NOTES[i];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(CHIME_LEVEL, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + CHIME_DECAY);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + CHIME_DECAY + 0.02);
  }
}
