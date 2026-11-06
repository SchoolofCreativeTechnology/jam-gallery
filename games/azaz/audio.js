// audio.js — procedural Web Audio for Stem to Stem: a tension-driven creak, a break snap and a
// concede whoosh. Nothing is loaded from disk; every sound is generated at runtime.
//
// Tuning knobs live in tuning.js and are imported here.

import {
  MASTER_GAIN,
  CREAK_MAX_GAIN, CREAK_LOW_HZ, CREAK_HIGH_HZ, CREAK_Q,
  CREAK_TENSION_POWER, CREAK_MOD_RATE, CREAK_MOD_DEPTH, CREAK_SMOOTH,
  SNAP_GAIN, SNAP_DECAY, SNAP_NOISE_HZ, SNAP_TONE_FROM, SNAP_TONE_TO,
  CONCEDE_GAIN, CONCEDE_DECAY, CONCEDE_TONE_FROM, CONCEDE_TONE_TO, CONCEDE_ATTACK,
} from './tuning.js';

let ctx = null;          // the AudioContext, created on the first user gesture
let master = null;       // everything routes through here
let creakVoice = null;   // the persistent creak: built once, driven every frame by setCreak

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// A looping noise buffer. Brown for the creak's low rumble; white for the snap's bright edge.
function makeNoiseBuffer(seconds, brown) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function resumeContext() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

// Brown noise -> bandpass -> gain, with an LFO on the bandpass frequency so the creak wanders.
function buildCreakVoice() {
  const source = ctx.createBufferSource();
  source.buffer = makeNoiseBuffer(2, true);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = CREAK_LOW_HZ;
  filter.Q.value = CREAK_Q;

  const gain = ctx.createGain();
  gain.gain.value = 0;   // silent until setCreak raises it

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = CREAK_MOD_RATE;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = CREAK_LOW_HZ * CREAK_MOD_DEPTH;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
  lfo.start();

  creakVoice = { filter, gain, lfoGain };
}

// Create (or resume) the AudioContext. Must be called from a user gesture; browsers refuse otherwise.
// Safe to call repeatedly: the second call only resumes.
export function initAudio() {
  if (ctx) {
    resumeContext();
    return ctx;
  }
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;   // no Web Audio: the game simply stays silent
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    buildCreakVoice();
  } catch (error) {
    ctx = null;
    master = null;
    creakVoice = null;
    return null;
  }
  resumeContext();
  // Belt and braces: if this resume is refused for lack of a gesture, the next one unlocks it.
  if (typeof window !== 'undefined') {
    const unlock = () => {
      resumeContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }
  return ctx;
}

// Called every frame during a duel. Intensity 0..1: volume from tension^2, band frequency rising
// with tension. setTargetAtTime smooths it and is safe to call at 60 fps.
export function setCreak(intensity) {
  if (!ctx || !creakVoice) return;   // before init, or if Web Audio is unavailable
  const t = clamp01(Number(intensity) || 0);
  const freq = CREAK_LOW_HZ + (CREAK_HIGH_HZ - CREAK_LOW_HZ) * t;
  const level = CREAK_MAX_GAIN * Math.pow(t, CREAK_TENSION_POWER);
  const now = ctx.currentTime;
  creakVoice.filter.frequency.setTargetAtTime(freq, now, CREAK_SMOOTH);
  creakVoice.lfoGain.gain.setTargetAtTime(freq * CREAK_MOD_DEPTH, now, CREAK_SMOOTH);
  creakVoice.gain.gain.setTargetAtTime(level, now, CREAK_SMOOTH);
}

// A stalk broke: a bright noise burst plus a fast pitch-drop oscillator (the "crack").
export function playSnap() {
  if (!ctx || !master) return;
  const now = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(0.25, false);
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = SNAP_NOISE_HZ;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(SNAP_GAIN, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + SNAP_DECAY);
  noise.connect(highpass);
  highpass.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);
  noise.stop(now + SNAP_DECAY + 0.02);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(SNAP_TONE_FROM, now);
  osc.frequency.exponentialRampToValueAtTime(SNAP_TONE_TO, now + SNAP_DECAY * 0.8);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(SNAP_GAIN * 0.7, now);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + SNAP_DECAY);
  osc.connect(oscGain);
  oscGain.connect(master);
  osc.start(now);
  osc.stop(now + SNAP_DECAY + 0.02);
}

// The player conceded: a soft descending tone over a low filtered whoosh (the rope easing off).
export function playConcede() {
  if (!ctx || !master) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(CONCEDE_TONE_FROM, now);
  osc.frequency.exponentialRampToValueAtTime(CONCEDE_TONE_TO, now + CONCEDE_DECAY);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.exponentialRampToValueAtTime(CONCEDE_GAIN, now + CONCEDE_ATTACK);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + CONCEDE_DECAY);
  osc.connect(oscGain);
  oscGain.connect(master);
  osc.start(now);
  osc.stop(now + CONCEDE_DECAY + 0.02);

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(0.6, true);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 600;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(CONCEDE_GAIN * 0.5, now + CONCEDE_ATTACK);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + CONCEDE_DECAY);
  noise.connect(lowpass);
  lowpass.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);
  noise.stop(now + CONCEDE_DECAY + 0.02);
}

export default { initAudio, setCreak, playSnap, playConcede };
