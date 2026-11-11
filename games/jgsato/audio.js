// Every sound is made here with the Web Audio API: no sound files.
// SOUND EFFECTS: rolling, boings, horns, the slide whistle. MUSIC: a little oom-pah loop.
// The audio context is only created on the player's first key or tap, so the browser
// never blocks it (and never logs a warning about it).
let ctx = null;
let master, sfx, music, noise;
let muted = false;
let musicOn = false;
let roll = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);
    music = ctx.createGain();
    music.gain.value = 0.32;
    music.connect(master);
    noise = makeNoise();
    startMusic();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}

export function isMuted() {
  return muted;
}

// Duck the music under the pause menu, the title, and so on. 1 = full.
export function setMusicLevel(level) {
  if (music) music.gain.setTargetAtTime(0.32 * level, ctx.currentTime, 0.2);
}

function ready() {
  return ctx && ctx.state === 'running';
}

function makeNoise() {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function env(gainNode, t, peak, attack, decay) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(type, freq, t, peak, attack, decay, dest = sfx) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  env(g, t, peak, attack, decay);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + attack + decay + 0.02);
  return o;
}

function noiseHit(t, peak, decay, type, freq, dest = sfx) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  env(g, t, peak, 0.004, decay);
  s.connect(f);
  f.connect(g);
  g.connect(dest);
  s.start(t, Math.random());
  s.stop(t + decay + 0.05);
}

// ---- SOUND EFFECTS ----

// A rumble that rises with speed while the head rolls.
export function setRoll(speed) {
  if (!ready()) return;
  if (speed < 0.3) {
    if (roll) {
      roll.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
    return;
  }
  if (!roll) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(sfx);
    source.start();
    roll = { source, filter, gain };
  }
  const t = Math.min(speed / 12, 1);
  roll.filter.frequency.setTargetAtTime(120 + t * 600, ctx.currentTime, 0.05);
  roll.gain.gain.setTargetAtTime(0.03 + t * 0.12, ctx.currentTime, 0.05);
}

// A cartoon boing when a toy hits.
export function playShove() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(520, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(220, t + 0.35);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 22;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 40;
  lfo.connect(lfoGain);
  lfoGain.connect(o.frequency);
  const g = ctx.createGain();
  env(g, t, 0.35, 0.01, 0.38);
  o.connect(g);
  g.connect(sfx);
  o.start(t); lfo.start(t);
  o.stop(t + 0.42); lfo.stop(t + 0.42);
  noiseHit(t, 0.3, 0.08, 'lowpass', 900);
}

// A soft rubbery thud off a rail.
export function playBonk(strength) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const v = Math.min(1, strength / 8);
  const o = tone('triangle', 150, t, 0.12 + v * 0.2, 0.004, 0.12);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
}

// Meep meep: a wind-up car pulling out.
export function playHorn(distance) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const v = Math.max(0.05, 0.16 - distance * 0.008);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2200;
  f.connect(sfx);
  const pitch = 560 + Math.random() * 160;
  tone('square', pitch, t, v, 0.005, 0.07, f);
  tone('square', pitch * 0.84, t + 0.11, v, 0.005, 0.09, f);
}

// Sproing: a jack-in-the-box letting go.
export function playSpring(distance) {
  if (!ready()) return;
  const v = Math.max(0, 0.28 - distance * 0.018);
  if (v <= 0.01) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.22);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 34;
  const lg = ctx.createGain();
  lg.gain.value = 70;
  lfo.connect(lg);
  lg.connect(o.frequency);
  const g = ctx.createGain();
  env(g, t, v, 0.01, 0.3);
  o.connect(g);
  g.connect(sfx);
  o.start(t); lfo.start(t);
  o.stop(t + 0.34); lfo.stop(t + 0.34);
}

// A bright little arpeggio for a star.
export function playStar(count) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const base = 880 * Math.pow(2, (count % 5) / 12);
  [1, 1.26, 1.5, 2].forEach((m, i) => tone('triangle', base * m, t + i * 0.045, 0.14, 0.005, 0.22));
  tone('sine', base * 4, t + 0.18, 0.05, 0.005, 0.3);
}

// The slide whistle, all the way down.
export function playFall() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1500, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 1.0);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 7;
  const lg = ctx.createGain();
  lg.gain.value = 18;
  lfo.connect(lg);
  lg.connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.04);
  g.gain.setValueAtTime(0.22, t + 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
  o.connect(g);
  g.connect(sfx);
  o.start(t); lfo.start(t);
  o.stop(t + 1.1); lfo.stop(t + 1.1);
}

// Home! A fanfare, then the lid's clack.
export function playWin() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone('triangle', f, t + i * 0.09, 0.18, 0.01, 0.3);
    tone('square', f / 2, t + i * 0.09, 0.04, 0.01, 0.2);
  });
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone('triangle', f, t + 0.42, 0.1, 0.02, 0.9));
  noiseHit(t + 0.95, 0.35, 0.06, 'bandpass', 1800);
}

export function playMedal(rank) {
  if (!ready()) return;
  const t = ctx.currentTime + 1.3;
  const top = [1568, 1318.5, 1174.7][rank] || 1046.5;
  tone('sine', top, t, 0.12, 0.005, 0.5);
  tone('sine', top * 1.5, t + 0.08, 0.08, 0.005, 0.6);
}

// ---- THE SECRET BOSS ----

// Through the portal: a rising, warbling whoosh.
export function playWarp() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(1800, t + 1.1);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 11;
  const lg = ctx.createGain();
  lg.gain.value = 60;
  lfo.connect(lg);
  lg.connect(o.frequency);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2400;
  const g = ctx.createGain();
  env(g, t, 0.16, 0.3, 1.0);
  o.connect(f); f.connect(g); g.connect(sfx);
  o.start(t); lfo.start(t);
  o.stop(t + 1.4); lfo.stop(t + 1.4);
  noiseHit(t + 0.2, 0.3, 1.1, 'bandpass', 900);
}

// Djinormous laughs: a low, wobbling "ho ho ho".
export function playRoar() {
  if (!ready()) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const s = t + i * 0.26;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95 - i * 6, s);
    o.frequency.exponentialRampToValueAtTime(62 - i * 4, s + 0.22);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420;
    f.Q.value = 3;
    const g = ctx.createGain();
    env(g, s, 0.5, 0.02, 0.22);
    o.connect(f); f.connect(g); g.connect(sfx);
    o.start(s);
    o.stop(s + 0.28);
  }
}

// He's winding up: a nasty rising rattle.
export function playWindup() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(240, t + 0.8);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 18;
  const lg = ctx.createGain();
  lg.gain.value = 0.5;
  const g = ctx.createGain();
  g.gain.value = 0;
  lfo.connect(lg);
  lg.connect(g.gain);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const out = ctx.createGain();
  env(out, t, 0.25, 0.05, 0.8);
  o.connect(g); g.connect(f); f.connect(out); out.connect(sfx);
  o.start(t); lfo.start(t);
  o.stop(t + 0.9); lfo.stop(t + 0.9);
}

// A solid hit on him: a crunchy smack and a falling pitch.
export function playBossHit(hpLeft) {
  if (!ready()) return;
  const t = ctx.currentTime;
  noiseHit(t, 0.7, 0.18, 'lowpass', 2400);
  const o = tone('square', 420 + hpLeft * 40, t, 0.22, 0.003, 0.3);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.3);
  const b = tone('sine', 120, t, 0.5, 0.003, 0.35);
  b.frequency.exponentialRampToValueAtTime(40, t + 0.35);
}

// A big deep thud (his slam, and the final explosion when big = true).
export function playBoom(big = false) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = tone('sine', big ? 90 : 110, t, big ? 0.9 : 0.55, 0.005, big ? 1.4 : 0.5);
  o.frequency.exponentialRampToValueAtTime(28, t + (big ? 1.2 : 0.45));
  noiseHit(t, big ? 0.9 : 0.5, big ? 1.4 : 0.4, 'lowpass', big ? 1400 : 700);
}

// One firework: a whistle up, then a crackling pop.
export function playFirework() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  const top = 1400 + Math.random() * 900;
  o.frequency.setValueAtTime(500, t);
  o.frequency.exponentialRampToValueAtTime(top, t + 0.35);
  const g = ctx.createGain();
  env(g, t, 0.05, 0.05, 0.3);
  o.connect(g); g.connect(sfx);
  o.start(t);
  o.stop(t + 0.4);
  noiseHit(t + 0.38, 0.35, 0.5, 'bandpass', 2500 + Math.random() * 2000);
  for (let i = 0; i < 5; i++) noiseHit(t + 0.5 + Math.random() * 0.5, 0.08, 0.04, 'highpass', 5000);
}

export function playClick() {
  if (!ready()) return;
  tone('triangle', 900, ctx.currentTime, 0.08, 0.002, 0.05);
}

// ---- MUSIC ----
// Eight bars of I-vi-IV-V oom-pah, generated note by note on a lookahead scheduler.
const MELODY = [
  [76, null, 79, 76, 72, null, 74, 76],
  [72, null, 69, 72, 76, null, 74, 72],
  [69, 72, 77, null, 76, 74, 72, null],
  [71, 74, 79, null, 77, 76, 74, 71],
  [76, null, 79, 76, 72, null, 74, 76],
  [72, null, 69, 72, 76, null, 77, 79],
  [81, null, 77, 81, 79, 77, 76, 74],
  [79, 77, 76, 74, 72, null, null, null],
];
const ROOTS = [48, 45, 41, 43, 48, 45, 41, 43];
const CHORDS = { 48: [60, 64, 67], 45: [57, 60, 64], 41: [57, 60, 65], 43: [59, 62, 67] };
let tempo = 124;
let step = 0;
let nextTime = 0;
let timer = null;

export function setTempo(bpm) {
  tempo = bpm;
}

function midi(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function startMusic() {
  if (musicOn) return;
  musicOn = true;
  nextTime = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 25);
}

function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  const eighth = 60 / tempo / 2;
  while (nextTime < ctx.currentTime + 0.12) {
    playStep(step, nextTime, eighth);
    step = (step + 1) % 64;
    nextTime += eighth;
  }
}

// Which loop plays: 'main' (the oom-pah) or 'boss' (Djinormous's dirge).
let song = 'main';
let intensity = 0; // 0..1: the boss song adds layers as he wears down

export function setSong(name) {
  if (name === song) return;
  song = name;
  step = 0; // start the new loop from its first bar
  if (ctx) nextTime = Math.max(nextTime, ctx.currentTime + 0.05);
}

export function setIntensity(x) {
  intensity = Math.max(0, Math.min(1, x));
}

function playStep(i, t, eighth) {
  if (song === 'boss') { bossStep(i, t, eighth); return; }
  const bar = Math.floor(i / 8);
  const beat = i % 8;
  const root = ROOTS[bar];

  // Bass: root on the beat, octave up on the off-beat.
  tone('triangle', midi(beat % 2 ? root + 12 : root), t, 0.22, 0.005, eighth * 0.9, music);
  // Chord stabs on the off-beats: the "pah".
  if (beat % 2) for (const n of CHORDS[root]) tone('square', midi(n), t, 0.025, 0.004, eighth * 0.5, music);
  // Melody.
  const note = MELODY[bar][beat];
  if (note) {
    tone('triangle', midi(note), t, 0.12, 0.008, eighth * 1.6, music);
    tone('sine', midi(note + 12), t, 0.025, 0.008, eighth * 0.8, music);
  }
  // A light kick and a tick hat.
  if (beat % 4 === 0) {
    const o = tone('sine', 130, t, 0.3, 0.003, 0.14, music);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
  }
  if (beat % 2) noiseHit(t, 0.04, 0.03, 'highpass', 7000, music);
}

// ---- BOSS MUSIC ----
// Djinormous's dirge, in D minor with a phrygian Eb: a growling saw drone, a low organ line,
// a ghostly choir, war drums in 3+3+2, and a funeral bell. As he wears down (intensity),
// the drone opens up, a pulsing bass and ticking hats join in, and the drums double.
const B_ROOTS = [38, 38, 34, 33, 38, 38, 39, 33]; // D D Bb A D D Eb A
const B_CHOIR = { 38: [50, 53, 57], 34: [50, 53, 58], 33: [49, 52, 57], 39: [51, 55, 58] };
const B_MELODY = [
  [62, null, null, null, 65, null, 64, null],
  [62, null, 61, null, 62, null, null, null],
  [58, null, null, null, 62, null, 65, null],
  [64, null, null, 61, null, null, null, null],
  [62, null, null, null, 65, null, 69, null],
  [68, null, 67, null, 65, null, 64, null], // G#: the tritone over D
  [63, null, null, null, 62, null, 63, null],
  [61, null, null, null, null, null, null, null],
];

// An oscillator (or two, detuned) through a lowpass filter, for the darker voices.
function darkTone(type, freq, t, peak, attack, decay, cutoff, detune = 0) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  f.Q.value = 2;
  const g = ctx.createGain();
  env(g, t, peak, attack, decay);
  f.connect(g);
  g.connect(music);
  const freqs = detune ? [freq * (1 - detune), freq * (1 + detune)] : [freq];
  for (const fr of freqs) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(fr, t);
    o.connect(f);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }
  return f;
}

function warDrum(t, peak) {
  const o = tone('sine', 95, t, peak, 0.004, 0.45, music);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
  noiseHit(t, peak * 0.25, 0.12, 'lowpass', 600, music);
}

function bell(t) {
  const f = midi(74);
  tone('sine', f, t, 0.07, 0.004, 3.2, music);
  tone('sine', f * 2.76, t, 0.025, 0.004, 1.6, music); // the clang: an inharmonic partial
  tone('sine', f * 0.5, t, 0.05, 0.004, 3.6, music);
}

function bossStep(i, t, eighth) {
  const bar = Math.floor(i / 8);
  const beat = i % 8;
  const root = B_ROOTS[bar];
  const barLen = eighth * 8;

  if (beat === 0) {
    // The drone: a detuned saw growl, choked down low, opening up as he gets desperate.
    darkTone('sawtooth', midi(root), t, 0.2, 0.08, barLen * 1.05, 260 + intensity * 700, 0.006);
    darkTone('sine', midi(root - 12), t, 0.22, 0.05, barLen, 200);
    // The choir: a slow-swelling minor chord, breathy and far away.
    for (const n of B_CHOIR[root]) darkTone('triangle', midi(n), t, 0.035, barLen * 0.45, barLen * 0.7, 1400, 0.004);
    if (bar % 4 === 0) bell(t);
  }

  // Organ line, low and slow.
  const note = B_MELODY[bar][beat];
  if (note) {
    darkTone('square', midi(note - 12), t, 0.05, 0.03, eighth * 2.6, 900, 0.003);
    darkTone('triangle', midi(note), t, 0.04, 0.03, eighth * 2.2, 2000);
  }

  // War drums: DUM . . DUM . . DUM . — doubling up when he's nearly done.
  if (beat === 0 || beat === 3 || beat === 6) warDrum(t, beat === 0 ? 0.5 : 0.36);
  else if (intensity > 0.55 && (beat === 7 || beat === 4)) warDrum(t, 0.22);

  // Later layers: a pulsing bass and ticking hats, like a clock running out.
  if (intensity > 0.3) darkTone('sawtooth', midi(root + 12), t, 0.06 * intensity, 0.005, eighth * 0.6, 500);
  if (intensity > 0.3 && beat % 2) noiseHit(t, 0.025, 0.025, 'highpass', 8000, music);
}
