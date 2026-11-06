// UI panels for title, HUD, game over, and win.
const title = document.getElementById('title');
const hud = document.getElementById('hud');
const gameover = document.getElementById('gameover');
const win = document.getElementById('win');
const timer = document.getElementById('timer');
const gameoverTime = document.querySelector('#gameover .time');
const winTime = document.querySelector('#win .time');
const winBest = document.querySelector('#win .best');

function hideAll() {
  title.classList.add('hidden');
  hud.classList.add('hidden');
  gameover.classList.add('hidden');
  win.classList.add('hidden');
}

export function showTitle() {
  hideAll();
  title.classList.remove('hidden');
}

export function showHUD(timeString) {
  hideAll();
  hud.classList.remove('hidden');
  timer.textContent = timeString;
}

export function showGameOver(timeString) {
  hideAll();
  gameover.classList.remove('hidden');
  gameoverTime.textContent = timeString;
}

export function showWin(timeString, bestTimeString) {
  hideAll();
  win.classList.remove('hidden');
  winTime.textContent = timeString;
  winBest.textContent = bestTimeString;
}
