const title = document.getElementById('title');
const gameover = document.getElementById('gameover');
const hud = document.getElementById('hud');
const hint = document.getElementById('hint');
const loading = document.getElementById('loading');

function show(el) {
  el.hidden = false;
  el.classList.add('active');
}

function hide(el) {
  el.hidden = true;
  el.classList.remove('active');
}

export const UI = {
  hideLoading() {
    if (loading) hide(loading);
  },

  showTitle() {
    hide(loading);
    hide(gameover);
    hide(hud);
    hide(hint);
    show(title);
  },

  showGame() {
    hide(title);
    hide(gameover);
    show(hud);
    show(hint);
  },

  showGameOver(currentHeight, maxHeight, vaseBonus) {
    hide(title);
    hide(hud);
    hide(hint);
    const scoreEl = document.getElementById('final-score');
    if (scoreEl) {
      const vases = vaseBonus > 0 ? ` · Vases ${vaseBonus}` : '';
      scoreEl.innerHTML = `Height ${Math.floor(currentHeight)} m · Best ${Math.floor(maxHeight)} m${vases}`;
    }
    show(gameover);
  },

  setHeight(currentY, maxY, vaseBonus) {
    const current = Math.max(0, Math.floor(currentY));
    const max = Math.max(0, Math.floor(maxY));
    const vases = vaseBonus > 0 ? `<span class="vase-bonus"> · Vases ${vaseBonus}</span>` : '';
    hud.innerHTML = `<span class="height-current">${current} m</span><span class="max"> / max ${max} m</span>${vases}`;
  },
};
