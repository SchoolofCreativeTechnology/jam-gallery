// After beating Djinormous: K.O., a storm of emojis and fireworks, a fade to black, the end
// credits (every job in the studio, all done by Sato) with snapshots of the journey, and then
// "Thanks for playing. Remember, I love you." written out in script.
const EMOJI = ['🏆', '👑', '💥', '🎉', '🎊', '✨', '🌟', '🔥', '💖', '💜', '💛', '🥳', '🧞', '🍾', '🎆', '🎇', '💫', '🥇', '😎', '🤩'];

const ROLES = [
  ['Director', 'Sato'],
  ['Producer', 'Sato'],
  ['Executive Producer', 'Sato'],
  ['Creative Director', 'Sato'],
  null,
  ['Game Design', 'Sato'],
  ['Level Design', 'Sato'],
  ['Boss Design', 'Sato'],
  ['Systems Design', 'Sato'],
  null,
  ['Lead Programmer', 'Sato'],
  ['Physics Programmer', 'Sato'],
  ['Gameplay Programmer', 'Sato'],
  ['Graphics Programmer', 'Sato'],
  ['Tools Programmer', 'Sato'],
  null,
  ['Art Director', 'Sato'],
  ['Character Artist', 'Sato'],
  ['Environment Artist', 'Sato'],
  ['VFX Artist', 'Sato'],
  ['Technical Artist', 'Sato'],
  ['Animator', 'Sato'],
  null,
  ['UI / UX Design', 'Sato'],
  ['Composer', 'Sato'],
  ['Sound Design', 'Sato'],
  ['Writer', 'Sato'],
  ['Narrative Design', 'Sato'],
  null,
  ['QA Lead', 'Sato'],
  ['QA Tester', 'Sato'],
  ['QA Tester (Night Shift)', 'Sato'],
  ['Localization', 'Sato'],
  ['Accessibility', 'Sato'],
  null,
  ['Community Manager', 'Sato'],
  ['Marketing', 'Sato'],
  ['Legal', 'Sato'],
  ['Catering', 'Sato'],
  ['Studio Cat', 'Sato'],
  ['Head of Heads', 'Sato'],
];
const CAST = [
  ['Jambi', 'Sato'],
  ['Djinormous', 'Sato'],
  ['Toy Car #3', 'Sato'],
  ['Jack-in-the-Box', 'Sato'],
  ['The Big Rug', 'Sato'],
];
const SHOTS = [
  'Course 1 · The Big Rug',
  'Course 2 · Block Party',
  'Course 3 · Spring Fever',
  'Course 4 · Downhill Derby',
  "Course 5 · Jambi's Gauntlet",
  'Djinormous, moments before',
];

const ROLL_SPEED = 95; // pixels a second

let el, rain, roll, skipBtn, homeBtn, imgs = [];
let running = false;
let t = 0;
let stage = '';
let stageT = 0;
let rollY = 0;
let rollH = 0;
let spawnClock = 0;
let drops = [];
let onDone = null;

export function initCredits(done) {
  onDone = done;
  el = document.getElementById('credits');
  rain = el.querySelector('.rain');
  roll = el.querySelector('.roll');
  skipBtn = el.querySelector('.skip');
  homeBtn = el.querySelector('.home');
  skipBtn.addEventListener('click', skip);
  homeBtn.addEventListener('click', finish);
  buildRoll();
}

function buildRoll() {
  const parts = [];
  parts.push(`<div class="logo small"><span class="l1">Jambi's</span><span class="l2">Head</span></div>`);
  parts.push(`<p class="presents">A Sato Production</p>`);
  let shot = 0;
  let since = 0;
  const shotHtml = (i) => `<figure class="polaroid ${i % 2 ? 'right' : 'left'}"><div class="photo"><img alt=""></div><figcaption>${SHOTS[i]}</figcaption></figure>`;
  for (const row of ROLES) {
    if (!row) {
      parts.push('<div class="gap"></div>');
      if (since >= 4 && shot < 4) { parts.push(shotHtml(shot++)); since = 0; }
      continue;
    }
    parts.push(`<div class="role"><span>${row[0]}</span><b>${row[1]}</b></div>`);
    since++;
  }
  while (shot < 5) parts.push(shotHtml(shot++));
  parts.push('<h3>Starring</h3>');
  for (const [a, b] of CAST) parts.push(`<div class="role"><span>${a}</span><b>${b}</b></div>`);
  parts.push(shotHtml(5));
  parts.push('<h3>Special Thanks</h3><div class="role solo"><b>Sato</b></div><div class="role solo"><b>and you</b></div>');
  parts.push('<p class="fine">No heads were harmed in the making of this game.<br>Several were rolled.</p>');
  roll.innerHTML = parts.join('');
  imgs = [...roll.querySelectorAll('.polaroid img')];
}

export function creditsRunning() {
  return running;
}

// Fill in one of the snapshots (0 to 4: the courses, 5: the boss fight).
export function setShot(i, url) {
  if (imgs[i] && url) {
    imgs[i].src = url;
    imgs[i].parentElement.classList.add('has');
  }
}

export function startCredits() {
  running = true;
  t = 0;
  stage = 'party';
  stageT = 0;
  spawnClock = 0;
  drops = [];
  rain.innerHTML = '';
  el.className = '';
  void el.offsetWidth;
  el.classList.add('show', 'party');
  roll.style.transform = `translateY(${innerHeight}px)`;
  for (let i = 0; i < 70; i++) spawn(true);
}

// Enter / Space / Esc / the Skip button: jump to the next part.
export function skip() {
  if (!running) return;
  if (stage === 'party' && t > 1.5) goBlack();
  else if (stage === 'roll') goEnd();
  else if (stage === 'end' && stageT > 2) finish();
}

function goBlack() {
  stage = 'black';
  stageT = 0;
  el.classList.add('black');
}

function goEnd() {
  stage = 'end';
  stageT = 0;
  el.classList.remove('rolling');
  el.classList.add('end');
}

export function finish() {
  if (!running) return;
  running = false;
  el.className = 'hidden';
  rain.innerHTML = '';
  drops = [];
  if (onDone) onDone();
}

// Every frame. Returns a cue for main.js: 'ko', 'title', 'black', 'thanks', 'love', or null.
export function updateCredits(dt) {
  if (!running) return null;
  const before = stageT;
  t += dt;
  stageT += dt;
  const at = (s) => before < s && stageT >= s;
  let cue = null;

  if (stage === 'party') {
    if (at(0.05)) cue = 'ko';
    if (at(1.1)) { el.classList.add('title-in'); cue = 'title'; }
    if (at(2.3)) el.classList.add('sub-in');
    if (at(3.0)) el.classList.add('skippable');
    if (stageT > 6.5) goBlack();
    spawnClock += dt;
    const every = stageT < 2 ? 0.02 : 0.05;
    while (spawnClock > every) {
      spawnClock -= every;
      spawn(Math.random() < 0.35);
    }
  } else if (stage === 'black') {
    if (at(1.3)) {
      cue = 'black';
      el.classList.remove('party', 'title-in', 'sub-in');
      rain.innerHTML = '';
      drops = [];
    }
    if (stageT > 1.8) {
      stage = 'roll';
      stageT = 0;
      el.classList.add('rolling');
      rollH = roll.offsetHeight;
      rollY = innerHeight;
    }
  } else if (stage === 'roll') {
    rollY -= ROLL_SPEED * dt * (innerHeight < 700 ? 0.85 : 1);
    roll.style.transform = `translateY(${rollY}px)`;
    if (rollY < -rollH) goEnd();
  } else if (stage === 'end') {
    if (at(0.4)) { el.classList.add('line1'); cue = 'thanks'; }
    if (at(3.0)) { el.classList.add('line2'); cue = 'love'; }
    if (at(6.2)) el.classList.add('done');
  }

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.vy += d.g * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.r += d.vr * dt;
    if (d.y > innerHeight + 80) {
      d.node.remove();
      drops.splice(i, 1);
      continue;
    }
    d.node.style.transform = `translate(${d.x}px, ${d.y}px) rotate(${d.r}deg) scale(${d.s})`;
  }
  return cue;
}

function spawn(fountain) {
  if (drops.length > 180) return;
  const node = document.createElement('span');
  node.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
  rain.appendChild(node);
  const w = innerWidth, h = innerHeight;
  const d = fountain
    ? { x: w * (0.05 + Math.random() * 0.9), y: h + 30, vx: (Math.random() - 0.5) * 420, vy: -(h * 1.1 + Math.random() * h * 0.8), g: h * 1.4 }
    : { x: Math.random() * w, y: -50, vx: (Math.random() - 0.5) * 80, vy: 160 + Math.random() * 220, g: 90 };
  d.r = Math.random() * 360;
  d.vr = (Math.random() - 0.5) * 400;
  d.s = 0.8 + Math.random() * 1.4;
  d.node = node;
  drops.push(d);
}
