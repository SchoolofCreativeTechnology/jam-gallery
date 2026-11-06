// Generate three short synthesised WAV files for Way of the Whisker.
// Run with: node assets/audio/generate.js

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const BITS = 16;
const BYTES = BITS / 8;
const MAX_AMP = (1 << (BITS - 1)) - 1;

function writeWav(filename, samples) {
  const dataLength = samples.length * BYTES;
  const buffer = Buffer.alloc(44 + dataLength);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * BYTES, 28);
  buffer.writeUInt16LE(BYTES, 32);
  buffer.writeUInt16LE(BITS, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * (1 << (BITS - 1)) : s * MAX_AMP;
    buffer.writeInt16LE(Math.round(val), 44 + i * BYTES);
  }

  fs.writeFileSync(filename, buffer);
  console.log(`wrote ${filename} (${samples.length} samples)`);
}

function envelope(t, duration, attack, decay, sustain, release) {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * ((t - attack) / decay);
  if (t < duration - release) return sustain;
  if (t < duration) return sustain * ((duration - t) / release);
  return 0;
}

// Soft pounce/whoosh: sine sweep up with quick attack and soft decay.
function makeJump(duration = 0.35) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f0 = 120;
    const f1 = 520;
    const f = f0 + (f1 - f0) * (t / duration);
    const phase = 2 * Math.PI * (f0 * t + 0.5 * (f1 - f0) * (t * t) / duration);
    const env = envelope(t, duration, 0.02, 0.15, 0.4, 0.12);
    samples[i] = 0.45 * Math.sin(phase) * env;
  }
  return samples;
}

// Ceramic break: short burst of noise with a bright tick and ringing decay.
function makeBreak(duration = 0.28) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const noise = Math.random() * 2 - 1;
    const ring = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 18);
    const env = envelope(t, duration, 0.005, 0.06, 0.25, 0.18);
    samples[i] = 0.5 * noise * env + 0.25 * ring * env;
  }
  return samples;
}

// Water splash: low noise wash with a bubbly sine wobble.
function makeSplash(duration = 0.55) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const noise = Math.random() * 2 - 1;
    const bubble = Math.sin(2 * Math.PI * (90 + 60 * Math.sin(2 * Math.PI * 6 * t)) * t);
    const env = envelope(t, duration, 0.02, 0.15, 0.55, 0.35);
    samples[i] = 0.35 * noise * env + 0.3 * bubble * env;
  }
  return samples;
}

const outDir = __dirname;
writeWav(path.join(outDir, 'jump.wav'), makeJump());
writeWav(path.join(outDir, 'break.wav'), makeBreak());
writeWav(path.join(outDir, 'splash.wav'), makeSplash());
