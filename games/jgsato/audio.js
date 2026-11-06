// Procedural toy sound effects using the Web Audio API.
let context = null;

let rollNodes = null;
let rollSpeed = 0;
let noiseBuffer = null;

function ensureContext() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
  }
  return context;
}

export function initAudio() {
  ensureContext();
}

export function resumeAudio() {
  const ctx = ensureContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

function getNoiseBuffer() {
  if (noiseBuffer) return noiseBuffer;
  const ctx = ensureContext();
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

function stopRoll() {
  if (!rollNodes) return;
  try {
    rollNodes.source.stop();
    rollNodes.source.disconnect();
    rollNodes.filter.disconnect();
    rollNodes.gain.disconnect();
  } catch {
    // Nodes may already be stopped.
  }
  rollNodes = null;
  rollSpeed = 0;
}

export function setRoll(speed) {
  rollSpeed = speed;
  if (!context || context.state !== 'running') return;

  if (speed < 0.2) {
    stopRoll();
    return;
  }

  if (!rollNodes) {
    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer();
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1;
    const gain = context.createGain();
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
    rollNodes = { source, filter, gain };
  }

  const t = Math.min(speed / 12, 1);
  const freq = 150 + t * 700;
  const vol = 0.02 + t * 0.12;
  const now = context.currentTime;
  rollNodes.filter.frequency.setTargetAtTime(freq, now, 0.05);
  rollNodes.gain.gain.setTargetAtTime(vol, now, 0.05);
}

export function playShove() {
  if (!context || context.state !== 'running') return;
  const ctx = context;
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.28, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + 0.12);
}

export function playFall() {
  if (!context || context.state !== 'running') return;
  const ctx = context;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.5);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

export function playWin() {
  if (!context || context.state !== 'running') return;
  const ctx = context;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.36);
  });
}
