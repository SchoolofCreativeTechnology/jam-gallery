// Full-screen DOM overlays: the title card before a run, and the homecoming card when it ends.

const STYLE = `
.screens-overlay {
  position: fixed; inset: 0; z-index: 30;
  display: flex; overflow: auto;
  padding: 5vh 6vw;
  background: radial-gradient(ellipse at center, rgba(12, 9, 7, 0.42) 0%, rgba(7, 5, 4, 0.86) 100%);
  font-family: 'Courier New', Courier, monospace;
  color: #2b1d12;
  text-align: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.screens-scroll {
  margin: auto;
  width: min(760px, 100%);
  /* The rollers overhang the paper, so nothing here may clip. */
  border-left: 2px solid #7a5a3a; border-right: 2px solid #7a5a3a;
  background: linear-gradient(90deg, #b8a778 0%, #cbb885 8%, #d6c69a 25%, #d6c69a 75%, #cbb885 92%, #b8a778 100%);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6), inset 0 0 60px rgba(90, 60, 30, 0.18);
}
.screens-roller {
  height: 12px;
  background: linear-gradient(#6b4a2e, #3e2a1a);
  border-radius: 6px;
  margin: 0 -12px;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
}
.screens-body { padding: 30px 34px 26px; }
.screens-title {
  margin: 0 0 18px;
  font-size: clamp(26px, 5.2vw, 44px);
  font-weight: 700;
  letter-spacing: 2px;
}
.screens-rule, .screens-line {
  margin: 0 auto 22px;
  max-width: 34em;
  font-size: clamp(14px, 1.8vw, 17px);
  line-height: 1.55;
}
.screens-stats {
  display: grid; gap: 7px;
  max-width: 25em; margin: 0 auto 24px;
  font-size: 16px;
}
.screens-stat {
  display: flex; justify-content: space-between; gap: 16px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(122, 90, 58, 0.35);
}
.screens-prompt { margin: 0; font-size: clamp(15px, 2vw, 19px); font-weight: 700; letter-spacing: 1px; }
.screens-hint { margin: 8px 0 0; font-size: 13px; opacity: 0.68; }

/* The failed ride: no paper, no rollers. The screen goes from the lit coach to pitch black, and the
   message arrives out of the dark a beat later. */
.screens-doom {
  background: #000;
  color: #b9c2cc;
  opacity: 0;
  animation: screens-doom-dark 1.7s ease-in forwards;
}
.screens-doom .screens-scroll {
  background: none; border: 0; box-shadow: none;
}
.screens-doom .screens-roller { display: none; }
.screens-doom .screens-body { opacity: 0; animation: screens-doom-say 1.3s ease-out 1.5s forwards; }
.screens-doom .screens-title { color: #e9edf2; text-shadow: 0 0 26px rgba(150, 180, 210, 0.3); }
.screens-doom .screens-prompt { color: #dbe3ea; }
@keyframes screens-doom-dark { from { opacity: 0 } to { opacity: 1 } }
@keyframes screens-doom-say { from { opacity: 0 } to { opacity: 1 } }
`;

let styleInjected = false;
let blocking = null;

export function isBlocking() {
  return blocking !== null;
}

// One overlay at a time: a repeat call while one is up is ignored, so titles cannot stack.
function showOverlay({ className, body, keys, onDismiss }) {
  if (blocking) return;
  if (!styleInjected) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    styleInjected = true;
  }

  const overlay = document.createElement('div');
  overlay.className = `screens-overlay ${className}`;
  overlay.append(makeScroll(body));
  document.body.appendChild(overlay);
  blocking = overlay;

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    removeEventListener('keydown', onKeyDown);
    overlay.removeEventListener('pointerdown', dismiss);
    overlay.remove();
    blocking = null;
    if (typeof onDismiss === 'function') onDismiss();
  };
  const onKeyDown = (event) => {
    if (keys.includes(event.key.toLowerCase())) dismiss();
  };

  addEventListener('keydown', onKeyDown);
  overlay.addEventListener('pointerdown', dismiss);
}

// The paper panel: a roller bar, the content, a roller bar. Same shape as ui.js scrolls.
function makeScroll(body) {
  const scroll = document.createElement('div');
  scroll.className = 'screens-scroll';
  scroll.append(makeRoller(), body, makeRoller());
  return scroll;
}

function makeRoller() {
  const roller = document.createElement('div');
  roller.className = 'screens-roller';
  return roller;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function statRow(label, value) {
  const row = el('div', 'screens-stat');
  row.append(el('span', 'screens-stat-label', label), el('span', 'screens-stat-value', String(value)));
  return row;
}

export function showTitle({ onStart } = {}) {
  const body = el('div', 'screens-body');
  body.append(
    el('h1', 'screens-title', 'Last Train Home'),
    el('p', 'screens-line', 'A cat boards with a basket of fish for the family dinner. But anomalies are riding this carriage tonight, and the only way off this train, and home, is past every one of them.'),
    el('p', 'screens-rule', 'Remember this coach. If something changes, go back. If nothing changes, go forward.'),
    el('p', 'screens-prompt', 'Press Space to board'),
    el('p', 'screens-hint', 'or tap anywhere on a phone'),
  );
  showOverlay({ className: 'screens-title-card', body, keys: [' ', 'enter'], onDismiss: onStart });
}

// The failed ending. The coach has already gone dark behind this — the overlay starts transparent and
// fades to black — so the words arrive on nothing at all.
export function showDoom({ mistakes = 0, onRestart } = {}) {
  const body = el('div', 'screens-body');
  body.append(
    el('h1', 'screens-title', 'Game over'),
    el('p', 'screens-line', "You're stuck here forever and you will become a ghost on this train now."),
    el('p', 'screens-line', 'And we will take all your fish too... hahaha'),
    el('p', 'screens-prompt', mistakes ? `Ride again — press R  (${mistakes} wrong turns)` : 'Press R to ride again'),
  );
  showOverlay({ className: 'screens-doom', body, keys: ['r', ' ', 'enter'], onDismiss: onRestart });
}

export function showEnding({ clears = 0, goal = 0, decisions = 0, mistakes = 0, onRestart } = {}) {
  const body = el('div', 'screens-body');
  const stats = el('div', 'screens-stats');
  stats.append(
    statRow('Anomalies cleared', goal ? `${clears} of ${goal}` : clears),
    statRow('Decisions made', decisions),
    statRow('Wrong turns', mistakes === 0 ? 'none' : mistakes),
  );
  body.append(
    el('h1', 'screens-title', 'You made it back home.'),
    el('p', 'screens-line', 'Go feed your family before you have to go fishing again tomorrow.'),
    stats,
    el('p', 'screens-prompt', 'Press R to ride again'),
    el('p', 'screens-hint', 'or press Space, Enter or click'),
  );
  showOverlay({ className: 'screens-ending-card', body, keys: ['r', ' ', 'enter'], onDismiss: onRestart });
}
