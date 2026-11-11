// The ending, for getting him home on the very last course: the screen fills with emojis,
// "I love you" writes itself out in big looping script, and Jambi pops up beside it, winking.
const EMOJI = ['💖', '💜', '💛', '✨', '🌟', '🎉', '🎊', '🥳', '😍', '🎈', '💫', '🍭', '🌈', '💕', '🧞', '👑'];

let el, rain, script, jambi, ctx, go;
let running = false;
let t = 0;
let onDone = null;
let spawnClock = 0;
let winkClock = 0;
let drops = [];

export function initFinale(done) {
  el = document.getElementById('finale');
  rain = el.querySelector('.rain');
  script = el.querySelector('.script text');
  jambi = el.querySelector('.jambi');
  ctx = jambi.getContext('2d');
  go = el.querySelector('.go');
  onDone = done;
  go.addEventListener('click', finish);
  // Fetch the script font now, so it's ready long before anyone reaches the end.
  try { document.fonts.load('200px "Great Vibes"'); } catch { /* fine without */ }
}

export function finaleRunning() {
  return running;
}

export function startFinale() {
  running = true;
  t = 0;
  spawnClock = 0;
  winkClock = 0;
  rain.innerHTML = '';
  drops = [];
  el.classList.remove('hidden', 'writing', 'written', 'jambi-in', 'ready', 'hinted');
  void el.offsetWidth; // restart the CSS animations
  el.classList.add('show');
  drawJambi(false);
  // A first big burst of emojis from the bottom.
  for (let i = 0; i < 46; i++) spawn(true);
}

export function finish() {
  if (!running) return;
  running = false;
  el.classList.add('hidden');
  el.classList.remove('show');
  rain.innerHTML = '';
  drops = [];
  if (onDone) onDone();
}

// Called every frame from main.js. Returns cues ('write', 'jambi', 'wink') for sounds.
export function updateFinale(dt) {
  if (!running) return null;
  const before = t;
  t += dt;
  let cue = null;
  const at = (s) => before < s && t >= s;

  if (at(0.7)) { el.classList.add('writing'); cue = 'write'; }
  if (at(3.0)) el.classList.add('written');
  if (at(3.1)) { el.classList.add('jambi-in'); cue = 'jambi'; }
  if (at(4.4)) el.classList.add('ready');
  if (at(5.6)) el.classList.add('hinted');

  // Wink every couple of seconds once he's up.
  if (t > 3.6) {
    winkClock += dt;
    const phase = winkClock % 2.2;
    const winking = phase < 0.42;
    drawJambi(winking);
    if (phase - dt < 0 && phase >= 0) cue = cue || 'wink';
  }

  // A steady shower, thicker at the start.
  spawnClock += dt;
  const every = t < 2 ? 0.03 : 0.09;
  while (spawnClock > every) {
    spawnClock -= every;
    spawn(false);
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.vy += d.g * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.r += d.vr * dt;
    if (d.y > innerHeight + 80 || (d.vy > 0 && d.y > innerHeight + 40)) {
      d.node.remove();
      drops.splice(i, 1);
      continue;
    }
    d.node.style.transform = `translate(${d.x}px, ${d.y}px) rotate(${d.r}deg) scale(${d.s})`;
  }
  return cue;
}

function spawn(fountain) {
  if (drops.length > 140) return;
  const node = document.createElement('span');
  node.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
  rain.appendChild(node);
  const w = innerWidth, h = innerHeight;
  const d = fountain
    ? { x: w * (0.1 + Math.random() * 0.8), y: h + 30, vx: (Math.random() - 0.5) * 360, vy: -(h * 1.1 + Math.random() * h * 0.7), g: h * 1.4 }
    : { x: Math.random() * w, y: -50, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160, g: 60 };
  d.r = Math.random() * 360;
  d.vr = (Math.random() - 0.5) * 300;
  d.s = 0.7 + Math.random() * 1.1;
  d.node = node;
  drops.push(d);
}

// ---- Jambi, drawn flat for the finale: green face, purple turban, cyan jewel, gold hoops ----
function drawJambi(wink) {
  const c = ctx;
  c.clearRect(0, 0, 320, 360);
  const ink = '#2a1630';
  c.lineWidth = 6;
  c.lineJoin = c.lineCap = 'round';
  c.strokeStyle = ink;

  // Ears and hoops.
  for (const s of [-1, 1]) {
    c.fillStyle = '#5f9c3d';
    ellipse(160 + s * 102, 200, 22, 34);
    c.fill(); c.stroke();
    c.strokeStyle = '#ffd23d';
    c.lineWidth = 7;
    c.beginPath(); c.arc(160 + s * 106, 250, 17, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = ink;
    c.lineWidth = 6;
  }

  // Face.
  const g = c.createRadialGradient(130, 170, 20, 160, 210, 130);
  g.addColorStop(0, '#8fd468');
  g.addColorStop(1, '#5a9a38');
  c.fillStyle = g;
  ellipse(160, 210, 100, 118);
  c.fill(); c.stroke();

  // Turban: a big purple swirl with a magenta band.
  c.fillStyle = '#9d4edd';
  c.beginPath();
  c.moveTo(52, 160);
  c.bezierCurveTo(40, 40, 280, 40, 268, 160);
  c.bezierCurveTo(220, 128, 100, 128, 52, 160);
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(80 + i * 18, 140 - i * 22);
    c.bezierCurveTo(130, 95 - i * 18, 200, 95 - i * 18, 240 - i * 18, 140 - i * 22);
    c.stroke();
  }
  c.strokeStyle = ink;
  c.lineWidth = 6;
  c.fillStyle = '#ff2a6d';
  c.beginPath();
  c.moveTo(52, 160);
  c.bezierCurveTo(100, 128, 220, 128, 268, 160);
  c.lineTo(262, 178);
  c.bezierCurveTo(220, 150, 100, 150, 58, 178);
  c.closePath();
  c.fill(); c.stroke();
  // Jewel and feather.
  c.fillStyle = '#05d9e8';
  c.beginPath(); c.moveTo(160, 128); c.lineTo(178, 150); c.lineTo(160, 172); c.lineTo(142, 150); c.closePath();
  c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.beginPath(); c.arc(154, 144, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffd23d';
  c.beginPath(); c.moveTo(160, 128); c.bezierCurveTo(150, 80, 186, 50, 204, 40); c.bezierCurveTo(196, 74, 180, 104, 160, 128); c.fill(); c.stroke();

  // Brows: one cocked up for the wink.
  c.beginPath(); c.moveTo(98, 196); c.quadraticCurveTo(120, 182, 142, 192); c.stroke();
  c.beginPath(); c.moveTo(178, wink ? 196 : 190); c.quadraticCurveTo(200, wink ? 186 : 176, 222, wink ? 194 : 186); c.stroke();

  // Eyes. Left always open, right winks.
  c.fillStyle = '#ffffff';
  ellipse(120, 222, 20, 24); c.fill(); c.stroke();
  c.fillStyle = ink;
  c.beginPath(); c.arc(124, 226, 10, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(128, 220, 4, 0, Math.PI * 2); c.fill();
  if (wink) {
    c.beginPath(); c.moveTo(180, 222); c.quadraticCurveTo(200, 236, 220, 222); c.stroke();
    c.beginPath(); c.moveTo(222, 216); c.lineTo(232, 208); c.stroke();
  } else {
    c.fillStyle = '#ffffff';
    ellipse(200, 222, 20, 24); c.fill(); c.stroke();
    c.fillStyle = ink;
    c.beginPath(); c.arc(196, 226, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(200, 220, 4, 0, Math.PI * 2); c.fill();
  }

  // Cheeks, nose, and a big lopsided grin.
  c.fillStyle = 'rgba(255, 90, 130, 0.45)';
  ellipse(96, 262, 18, 11); c.fill();
  ellipse(224, 262, 18, 11); c.fill();
  c.fillStyle = '#4d8a2e';
  ellipse(160, 252, 12, 9); c.fill();
  c.fillStyle = '#5a1a2a';
  c.beginPath();
  c.moveTo(112, 276);
  c.quadraticCurveTo(162, wink ? 336 : 326, 214, wink ? 268 : 276);
  c.quadraticCurveTo(160, 292, 112, 276);
  c.closePath();
  c.fill(); c.stroke();
  c.fillStyle = '#ff7a93';
  ellipse(166, 304, 20, 8); c.fill();
}

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
