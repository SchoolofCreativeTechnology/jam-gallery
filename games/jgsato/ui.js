// The overlay screens: title and course picker, HUD, course banner, fell-off, home, pause.
// Buttons call back into main.js through the handlers passed to initUI.
import { bestTime, unlockedCount, medalFor } from './storage.js';

const $ = (id) => document.getElementById(id);
const els = {
  loading: $('loading'), title: $('title'), levels: $('levels'), hud: $('hud'), banner: $('banner'),
  gameover: $('gameover'), win: $('win'), pause: $('pause'), toast: $('toast'), flash: $('flash'),
  timer: $('timer'), hudLevel: $('hud-level'), hudProgress: $('hud-progress'), hudStars: $('hud-stars'),
  bossHud: $('boss-hud'),
};
const BOSS_QUIPS = [
  'He tipped. You slipped.',
  'Djinormous laughs a big laugh.',
  'Hit him harder. Run up first.',
  'When he winds up, lean in.',
  'After he lunges, he\'s winded. Go!',
  'Off the platter. Again!',
];
const MEDAL_NAMES = ['gold', 'silver', 'bronze'];
const QUIPS = [
  'Into the void he goes.',
  'He did not wish for that.',
  'Mekka lekka... oops.',
  'The floor is very far down.',
  'Heads don\'t bounce. Noted.',
  'That edge was closer than it looked.',
  'Toy cars: 1. Jambi: 0.',
  'Roll gently. Roll home.',
];

let handlers = {};
let levels = [];
let lastQuip = -1;
let toastTimer = 0;

export function initUI(levelList, h) {
  levels = levelList;
  handlers = h;
  for (const panel of [els.gameover, els.win, els.pause]) {
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (btn && handlers[btn.dataset.act]) handlers[btn.dataset.act]();
    });
  }
  $('pause-btn').addEventListener('click', () => handlers.pause && handlers.pause());
  els.bossHud.querySelector('.boss-pause').addEventListener('click', () => handlers.pause && handlers.pause());
  $('tilt-btn').addEventListener('click', (e) => { e.stopPropagation(); handlers.tilt && handlers.tilt(); });
}

function hideAll() {
  for (const k of ['loading', 'title', 'hud', 'banner', 'gameover', 'win', 'pause', 'bossHud']) els[k].classList.add('hidden');
}

// ---- BOSS ----
export function showBossHUD(max) {
  hideAll();
  els.bossHud.classList.remove('hidden');
  els.bossHud.querySelector('.boss-pips').innerHTML = '<i></i>'.repeat(max);
  setBossHP(max, max);
}

export function setBossHP(hp, max) {
  els.bossHud.querySelector('.boss-fill').style.width = `${(Math.max(0, hp) / max) * 100}%`;
  if (hp < max) {
    els.bossHud.classList.remove('hit');
    void els.bossHud.offsetWidth;
    els.bossHud.classList.add('hit');
  }
}

export function hideBossHUD() {
  els.bossHud.classList.add('hidden');
}

export function showBannerText(num, name, tag) {
  els.banner.querySelector('.banner-num').textContent = num;
  els.banner.querySelector('.banner-name').textContent = name;
  els.banner.querySelector('.banner-tag').textContent = tag;
  els.banner.classList.remove('hidden', 'out');
}

// ---- TITLE ----
export function showTitle(selected) {
  hideAll();
  els.title.classList.remove('hidden');
  renderCards(selected);
}

export function selectCard(selected) {
  renderCards(selected);
}

function renderCards(selected) {
  const unlocked = unlockedCount();
  els.levels.innerHTML = '';
  levels.forEach((lv, i) => {
    const card = document.createElement('div');
    card.className = 'card' + (i === selected ? ' selected' : '') + (i >= unlocked ? ' locked' : '');
    card.setAttribute('role', 'listitem');
    const best = bestTime(i);
    const medal = medalFor(best, lv.medals);
    card.innerHTML = `
      <div class="medal ${medal >= 0 ? MEDAL_NAMES[medal] : 'none'}"></div>
      <div class="num">${i + 1}</div>
      <div class="name">${lv.name}</div>
      <div class="best">${best !== null ? best.toFixed(2) + 's' : i < unlocked ? 'not yet' : ''}</div>`;
    if (i < unlocked) {
      // Mouse only: on iPhone, changing the page on hover swallows the tap that follows.
      card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && handlers.hover) handlers.hover(i); });
      card.addEventListener('click', () => handlers.play && handlers.play(i));
    }
    els.levels.appendChild(card);
  });
  // Once he's been beaten, he can be fought again from here.
  if (handlers.bossUnlocked && handlers.bossUnlocked()) {
    const i = levels.length;
    const card = document.createElement('div');
    card.className = 'card boss-card' + (i === selected ? ' selected' : '');
    card.setAttribute('role', 'listitem');
    card.innerHTML = `<div class="medal gold"></div><div class="num">★</div><div class="name">Djinormous</div><div class="best">secret</div>`;
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && handlers.hover) handlers.hover(i); });
    card.addEventListener('click', () => handlers.boss && handlers.boss());
    els.levels.appendChild(card);
  }
}

export function setTiltLabel(on) {
  for (const b of document.querySelectorAll('#tilt-btn, .tilt-btn')) b.textContent = on ? 'Tilt: on' : 'Tilt: off';
}

// ---- HUD ----
export function showHUD(levelIndex) {
  hideAll();
  els.hud.classList.remove('hidden');
  els.hudLevel.textContent = `${levelIndex + 1} · ${levels[levelIndex].name}`;
}

export function updateHUD(time, stars, totalStars, progress) {
  els.timer.textContent = time.toFixed(2);
  const text = `★ ${stars}/${totalStars}`;
  if (els.hudStars.textContent !== text) {
    if (els.hudStars.textContent) {
      els.hudStars.classList.remove('bump');
      void els.hudStars.offsetWidth;
      els.hudStars.classList.add('bump');
    }
    els.hudStars.textContent = text;
  }
  els.hudProgress.style.width = `${Math.round(Math.min(1, progress) * 100)}%`;
}

export function hideHUD() {
  els.hud.classList.add('hidden');
}

export function showBanner(levelIndex) {
  const lv = levels[levelIndex];
  els.banner.querySelector('.banner-num').textContent = `Course ${levelIndex + 1} of ${levels.length}`;
  els.banner.querySelector('.banner-name').textContent = lv.name;
  els.banner.querySelector('.banner-tag').textContent = lv.tagline;
  els.banner.classList.remove('hidden', 'out');
}

export function hideBanner() {
  if (els.banner.classList.contains('hidden')) return;
  els.banner.classList.add('out');
  setTimeout(() => { if (els.banner.classList.contains('out')) els.banner.classList.add('hidden'); }, 300);
}

// ---- END OF A RUN ----
export function showGameOver(boss = false) {
  els.banner.classList.add('hidden');
  els.gameover.classList.remove('hidden');
  const list = boss ? BOSS_QUIPS : QUIPS;
  let q;
  do q = Math.floor(Math.random() * list.length); while (q === lastQuip && list.length > 1);
  lastQuip = q;
  els.gameover.querySelector('.quip').textContent = list[q];
}

export function showWin({ levelIndex, raw, stars, bonus, final, medal, isBest, previousBest, isLast }) {
  els.win.classList.remove('hidden');
  const w = els.win;
  w.querySelector('.win-title').textContent = isLast ? 'All home!' : 'Home!';
  const m = w.querySelector('.medal');
  m.className = 'medal big ' + (medal >= 0 ? MEDAL_NAMES[medal] : 'none');
  w.querySelector('.raw').textContent = raw.toFixed(2);
  w.querySelector('.stars-label').textContent = `★ × ${stars}`;
  w.querySelector('.bonus').textContent = `−${bonus.toFixed(2)}`;
  w.querySelector('.stars-line').style.display = stars ? '' : 'none';
  w.querySelector('.final').textContent = final.toFixed(2);
  const best = w.querySelector('.best-line');
  best.className = 'best-line' + (isBest ? ' new' : '');
  best.textContent = isBest
    ? (previousBest !== null ? `New best! (was ${previousBest.toFixed(2)})` : 'New best!')
    : `Best: ${previousBest.toFixed(2)}`;
  const t = levels[levelIndex].medals;
  w.querySelector('.targets').innerHTML = t.map((v, i) => `<span><span class="medal ${MEDAL_NAMES[i]}"></span>${v.toFixed(1)}</span>`).join('');
  const next = w.querySelector('[data-act="next"]');
  next.innerHTML = isLast ? 'Courses <kbd>Enter</kbd>' : 'Next <kbd>Enter</kbd>';
}

export function showPause(muted) {
  els.pause.classList.remove('hidden');
  setMuteLabel(muted);
}

export function hidePause() {
  els.pause.classList.add('hidden');
}

export function setMuteLabel(muted) {
  els.pause.querySelector('.mute-btn').innerHTML = `Sound: ${muted ? 'off' : 'on'} <kbd>M</kbd>`;
}

export function toast(text, seconds = 1.6) {
  els.toast.textContent = text;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), seconds * 1000);
}

export function flash() {
  els.flash.classList.remove('go');
  void els.flash.offsetWidth;
  els.flash.classList.add('go');
}
