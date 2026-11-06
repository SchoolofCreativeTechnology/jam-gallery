// Builds the HTML overlay UI (title, HUD, win and game-over screens) for the one-button stacker.
const STYLE = `
  .skycrane-overlay {
    position: absolute; inset: 0; z-index: 2;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    background: rgba(15, 20, 35, 0.72);
    color: #fff; text-align: center;
    font: 600 1em system-ui, sans-serif;
    padding: 24px; box-sizing: border-box;
  }
  .skycrane-overlay[hidden] { display: none; }
  .skycrane-overlay h1 {
    margin: 0; font-size: clamp(40px, 8vw, 84px); letter-spacing: 2px;
    text-shadow: 0 4px 18px rgba(0, 0, 0, 0.6);
  }
  .skycrane-overlay h2 {
    margin: 0; font-size: clamp(28px, 5vw, 52px);
    text-shadow: 0 4px 18px rgba(0, 0, 0, 0.6);
  }
  .skycrane-sub { font-size: clamp(16px, 2.4vw, 24px); opacity: 0.85; }
  .skycrane-final { font-size: clamp(18px, 3vw, 30px); opacity: 0.95; }
  .skycrane-hud {
    position: absolute; top: 0; left: 0; right: 0; z-index: 3;
    display: flex; justify-content: space-between; gap: 24px;
    padding: 16px 22px; box-sizing: border-box;
    color: #fff; pointer-events: none;
    font: 700 clamp(16px, 2.2vw, 24px)/1.2 system-ui, sans-serif;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
  }
`;

// Small helper: make an element with an optional class and text.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export default class UI {
  constructor(root) {
    this.root = root;

    // One injected stylesheet for every overlay; no separate CSS file.
    const style = el('style');
    style.textContent = STYLE;
    root.appendChild(style);

    // Title screen
    this.title = el('div', 'skycrane-overlay');
    this.title.append(
      el('h1', null, 'Sky Crane'),
      el('div', 'skycrane-sub', 'A / D, arrows, or Home / End to steer. Space or tap to start.'),
      this.titleBestEl = el('div', 'skycrane-sub', '')
    );
    root.appendChild(this.title);

    // Win screen
    this.winScoreEl = el('div', 'skycrane-final');
    this.winBestEl = el('div', 'skycrane-final');
    this.win = el('div', 'skycrane-overlay');
    this.win.append(
      el('h2', null, 'Thank you for betraying Earth. The alien received the cargo.'),
      this.winScoreEl,
      this.winBestEl,
      el('div', 'skycrane-sub', 'Press to play again')
    );
    root.appendChild(this.win);

    // Game-over screen
    this.overScoreEl = el('div', 'skycrane-final');
    this.overBestEl = el('div', 'skycrane-final');
    this.over = el('div', 'skycrane-overlay');
    this.over.append(
      el('h2', null, 'Cargo collapsed!'),
      this.overScoreEl,
      this.overBestEl,
      el('div', 'skycrane-sub', 'Press to try again')
    );
    root.appendChild(this.over);

    // Pause overlay
    this.pause = el('div', 'skycrane-overlay');
    this.pause.append(
      el('h2', null, 'Paused'),
      el('div', 'skycrane-sub', 'Press ESC to continue')
    );
    this.pause.hidden = true;
    root.appendChild(this.pause);

    // HUD (always visible, clicks pass through)
    this.hud = el('div', 'skycrane-hud');
    const scoreBox = el('div');
    scoreBox.append('Score: ');
    this.scoreEl = el('span', null, '0');
    scoreBox.appendChild(this.scoreEl);
    const bestBox = el('div');
    bestBox.append('Best: ');
    this.bestEl = el('span', null, '0');
    bestBox.appendChild(this.bestEl);
    const tiltBox = el('div');
    tiltBox.append('Tilt: ');
    this.tiltEl = el('span', null, '0%');
    tiltBox.appendChild(this.tiltEl);
    const cargoBox = el('div');
    cargoBox.append('Cargo: ');
    this.cargoEl = el('span', null, '0/10');
    cargoBox.appendChild(this.cargoEl);
    this.hud.append(scoreBox, bestBox, tiltBox, cargoBox);
    root.appendChild(this.hud);

    // Everything but the HUD starts hidden.
    this.hideOverlays();
  }

  showTitle(bestScore = 0) {
    this.win.hidden = true;
    this.over.hidden = true;
    this.title.hidden = false;
    this.titleBestEl.textContent = bestScore > 0 ? `Best: ${bestScore}` : '';
  }

  hideOverlays() {
    this.title.hidden = true;
    this.win.hidden = true;
    this.over.hidden = true;
    this.pause.hidden = true;
  }

  showPause() {
    this.pause.hidden = false;
  }

  hidePause() {
    this.pause.hidden = true;
  }

  setScore(score) {
    this.scoreEl.textContent = String(score);
  }

  setBest(bestScore) {
    this.bestEl.textContent = String(bestScore);
  }

  setTilt(lean, limit) {
    const pct = Math.min(100, Math.round((Math.abs(lean) / limit) * 100));
    this.tiltEl.textContent = `${pct}%`;
  }

  setCargo(used, max) {
    this.cargoEl.textContent = `${used}/${max}`;
  }

  showWin(finalScore, bestScore = finalScore) {
    this.winScoreEl.textContent = `Score: ${finalScore}`;
    this.winBestEl.textContent = `Best: ${bestScore}`;
    this.title.hidden = true;
    this.over.hidden = true;
    this.win.hidden = false;
  }

  showGameOver(finalScore, bestScore = finalScore) {
    this.overScoreEl.textContent = `Score: ${finalScore}`;
    this.overBestEl.textContent = `Best: ${bestScore}`;
    this.title.hidden = true;
    this.win.hidden = true;
    this.over.hidden = false;
  }
}
