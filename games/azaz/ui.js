// ui.js — plain HTML/DOM overlays for Stem to Stem: title, HUD, duel result, growth choice, stalk selection, challenge results.

// Presentation-only constants. This file holds no gameplay numbers and changes none of the game's math.
const FONT = '16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const COLORS = {
  fg: '#e8eef7',
  dim: '#9fb0c9',
  faint: '#7d8ea8',
  panel: 'rgba(14,24,40,0.94)',
  backdrop: 'rgba(8,16,28,0.82)',
  border: 'rgba(159,216,208,0.28)',
  good: '#8fe3b0',
  bad: '#ff9a8a',
  warm: '#ffd9a0',
  teal: '#9fd8d0',
  button: 'rgba(255,255,255,0.08)',
};
const SESSION_TAG = 'Local / session stats — not a global leaderboard';

// ---------- module state ----------
const el = {};                 // built once, reused forever
let root = null;
let built = false;
// At most one of these is armed at a time; every show* resets them first.
const pending = { duelContinue: null, growth: null, growthTimer: 0, stalkSelect: null, stalkCount: 0 };

// ---------- tiny DOM helpers ----------
function style(node, css) { node.style.cssText = css; return node; }

function div(css, parent) {
  const d = document.createElement('div');
  if (css) style(d, css);
  if (parent) parent.appendChild(d);
  return d;
}

function text(parent, css, value) {
  const d = div(css, parent);
  d.textContent = value == null ? '' : String(value);
  return d;
}

function button(parent, label, primary) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  style(b, 'pointer-events:auto;cursor:pointer;font:600 15px/1 system-ui,sans-serif;' +
    'padding:11px 18px;margin:6px 6px 0 0;border-radius:10px;' +
    `color:${primary ? '#08131c' : COLORS.fg};` +
    `background:${primary ? COLORS.teal : COLORS.button};` +
    `border:1px solid ${primary ? COLORS.teal : COLORS.border};`);
  if (parent) parent.appendChild(b);
  return b;
}

function card(parent, maxRem) {
  return div('pointer-events:auto;box-sizing:border-box;padding:18px 22px;border-radius:14px;' +
    `max-width:${maxRem || 34}rem;width:100%;background:${COLORS.panel};` +
    `border:1px solid ${COLORS.border};box-shadow:0 14px 44px rgba(0,0,0,0.45);`, parent);
}

function backdrop(parent) {
  return div('position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
    'box-sizing:border-box;padding:24px;text-align:center;pointer-events:none;' +
    `background:${COLORS.backdrop};font:${FONT};color:${COLORS.fg};`, parent);
}

// A label/value row, used by the HUD and the results card.
function statRow(parent, label, gap) {
  const r = div(`display:flex;justify-content:space-between;align-items:baseline;gap:${gap || 14}px;` +
    'margin-top:6px;font-size:13px;', parent);
  text(r, `color:${COLORS.dim};`, label);
  return text(r, `text-align:right;color:${COLORS.fg};`, '');
}

// ---------- value formatting ----------
function n(value) { const v = Number(value); return Number.isFinite(v) ? v : 0; }
function signed(value) { const v = Math.round(n(value)); return v > 0 ? `+${v}` : String(v); }
function deltaColor(value) { const v = n(value); return v > 0 ? COLORS.good : v < 0 ? COLORS.bad : COLORS.dim; }

// The HUD's live duel numbers are percentages of the player's own stalk, nothing absolute.
function hudPct(value) { return `${Math.round(Math.min(100, Math.max(0, n(value))))}%`; }

// Writing the same string back every frame is pure churn; skip it.
function setText(node, value) { if (node && node.textContent !== value) node.textContent = value; }

// Growth is a fraction of the stalk's creation baseline, so show it as a percentage.
function formatAmount(amount) {
  if (typeof amount !== 'number' || !isFinite(amount)) return '';
  if (Math.abs(amount) < 1) {
    const pct = (amount * 100).toFixed(1).replace(/\.0$/, '');
    return `${pct}% of this stalk's baseline`;
  }
  return String(Math.round(amount * 100) / 100);
}

function recordText(record) {
  if (record == null) return 'no record yet';
  if (typeof record === 'string') return record;
  if (typeof record === 'number') return `${record} duels`;
  const w = record.wins ?? record.w ?? 0;
  const l = record.losses ?? record.l ?? 0;
  return `${n(w)}W / ${n(l)}L`;
}

function stalkId(item, index) {
  if (item == null) return `Stalk ${index + 1}`;
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  return String(item.sessionId ?? item.id ?? item.label ?? item.name ?? `Stalk ${index + 1}`);
}

// History only: wins, concessions, breaks caused. Attack/Defense are never read here.
function historyOf(item) {
  const src = (item && (item.history || item.record)) || item || {};
  return {
    wins: n(src.wins ?? src.w),
    concessions: n(src.concessions ?? src.conceded ?? src.lossesByConcession),
    breaksCaused: n(src.breaksCaused ?? src.breaks ?? src.broken),
  };
}

function historyLine(item) {
  const h = historyOf(item);
  return `${h.wins} won · ${h.concessions} conceded · broke ${h.breaksCaused}`;
}

// ---------- one-time build ----------
function ensure() {
  if (built) return;
  built = true;
  root = div('position:fixed;inset:0;z-index:10;pointer-events:none;' + `font:${FONT};color:${COLORS.fg};`);
  document.body.appendChild(root);

  // --- title ---
  el.title = backdrop(root);
  const tCard = card(el.title);
  style(tCard, 'background:transparent;border:0;box-shadow:none;');
  el.titleText = text(tCard, 'font-size:26px;line-height:1.5;letter-spacing:0.02em;', '');

  // --- HUD (small, top-left, always readable) ---
  el.hud = div('position:fixed;top:12px;left:12px;z-index:1;display:none;pointer-events:none;' +
    'box-sizing:border-box;min-width:216px;max-width:min(320px,60vw);padding:10px 14px;' +
    `border-radius:12px;text-align:left;background:${COLORS.panel};border:1px solid ${COLORS.border};`, root);
  text(el.hud, `font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.faint};`,
    'Local session stats');
  el.hudPoints = text(el.hud, `font-size:22px;font-weight:700;line-height:1.2;color:${COLORS.warm};margin-top:2px;`, '0');
  text(el.hud, `font-size:11px;letter-spacing:0.06em;color:${COLORS.dim};`, 'reward points (cosmetics only)');
  el.hudChallenge = statRow(el.hud, 'This challenge');
  el.hudRival = statRow(el.hud, 'Rival record', 10);
  text(el.hud, `font-size:10px;color:${COLORS.faint};margin-top:6px;`, 'session-local, resets on New Session');

  // --- HUD, live duel read-out (shown only while a duel is running) ---
  el.hudDuel = div('display:none;margin-top:8px;padding-top:8px;' +
    'border-top:1px solid rgba(159,216,208,0.22);', el.hud);
  el.hudDamage = statRow(el.hudDuel, 'Damage', 10);
  el.hudTension = statRow(el.hudDuel, 'Tension', 10);
  el.hudDamage.style.color = COLORS.warm;
  el.hudTension.style.color = COLORS.teal;
  text(el.hudDuel, `font-size:10px;color:${COLORS.faint};margin-top:6px;`,
    'your own stalk — its exact breaking point stays hidden');

  // --- post-duel result ---
  el.duel = backdrop(root);
  const dCard = card(el.duel, 30);
  el.duelOutcome = text(dCard, 'font-size:30px;font-weight:700;letter-spacing:0.01em;', '');
  el.duelPoints = text(dCard, 'font-size:17px;margin-top:8px;', '');
  el.duelMsg = text(dCard, `font-size:15px;line-height:1.55;margin-top:10px;color:${COLORS.dim};`, '');
  text(dCard, `font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.faint};margin-top:16px;`,
    'Click or press SPACE to continue');
  el.duel.addEventListener('click', () => fire('duelContinue'));

  // --- growth choice ---
  el.growth = backdrop(root);
  const gCard = card(el.growth, 28);
  text(gCard, `font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.teal};`, 'Victory');
  text(gCard, 'font-size:22px;font-weight:700;margin-top:6px;', 'Grow Attack [A] or Defense [D]');
  el.growthAmount = text(gCard, `font-size:14px;margin-top:8px;color:${COLORS.dim};`, '');
  const gRow = div('margin-top:12px;', gCard);
  el.growthA = button(gRow, 'Attack (A)', true);
  el.growthD = button(gRow, 'Defense (D)', false);
  text(gCard, `font-size:11px;color:${COLORS.faint};margin-top:10px;`, 'No choice in time grows Attack.');
  el.growthA.addEventListener('click', () => resolveGrowth('attack'));
  el.growthD.addEventListener('click', () => resolveGrowth('defense'));

  // --- stalk selection ---
  el.stalks = backdrop(root);
  const sCard = card(el.stalks, 38);
  text(sCard, 'font-size:22px;font-weight:700;', 'Choose a stalk for the next duel');
  text(sCard, `font-size:12px;color:${COLORS.faint};margin-top:6px;`,
    'Session ID and recorded history only — combat stats stay hidden.');
  el.stalksList = div('margin-top:14px;text-align:left;', sCard);
  text(sCard, `font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.faint};margin-top:14px;`,
    'Click a stalk, or press 1 / 2 / 3');

  // --- challenge results ---
  el.results = backdrop(root);
  const rCard = card(el.results, 40);
  text(rCard, 'font-size:24px;font-weight:700;', 'Challenge complete');
  text(rCard, `font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.faint};margin-top:4px;`,
    SESSION_TAG);
  el.resultsStats = div('margin-top:12px;', rCard);
  el.resultsSurvivors = div('margin-top:14px;text-align:left;', rCard);
  el.resultsGrave = div('margin-top:14px;text-align:left;', rCard);
  el.resultsRival = statRow(rCard, 'Rival record (separate from its stalks)', 12);
  const rRow = div('margin-top:16px;', rCard);
  el.resultsNext = button(rRow, 'Next Challenge', true);
  el.resultsNew = button(rRow, 'New Session', false);
  el.resultsNext.addEventListener('click', () => resolveResults('next'));
  el.resultsNew.addEventListener('click', () => resolveResults('new'));

  addEventListener('keydown', onKey);
}

// ---------- shared control flow ----------
const OVERLAYS = ['title', 'hud', 'duel', 'growth', 'stalks', 'results'];

function hideOthers(keep) {
  for (const key of OVERLAYS) {
    const node = el[key];
    if (node && node !== keep) node.style.display = 'none';
  }
}

function resetPending() {
  if (pending.growthTimer) clearTimeout(pending.growthTimer);
  pending.growthTimer = 0;
  pending.duelContinue = null;
  pending.growth = null;
  pending.stalkSelect = null;
  pending.stalkCount = 0;
}

function fire(key) {
  const fn = pending[key];
  if (typeof fn !== 'function') return;
  pending[key] = null;
  el.duel.style.display = 'none';
  fn();
}

function resolveGrowth(choice) {
  const fn = pending.growth;
  if (typeof fn !== 'function') return;
  pending.growth = null;
  if (pending.growthTimer) { clearTimeout(pending.growthTimer); pending.growthTimer = 0; }
  el.growth.style.display = 'none';
  fn(choice);
}

function resolveStalk(index) {
  const fn = pending.stalkSelect;
  if (typeof fn !== 'function') return;
  if (!Number.isInteger(index) || index < 0 || index >= pending.stalkCount) return;
  pending.stalkSelect = null;
  pending.stalkCount = 0;
  el.stalks.style.display = 'none';
  fn(index);
}

function resolveResults(which) {
  const fn = which === 'next' ? pending.onNext : pending.onNew;
  if (typeof fn !== 'function') return;
  pending.onNext = null;
  pending.onNew = null;
  el.results.style.display = 'none';
  fn();
}

function onKey(e) {
  if (e.repeat) return;
  const k = (e.key || '').toLowerCase();
  if ((k === ' ' || k === 'enter') && typeof pending.duelContinue === 'function') {
    e.preventDefault();
    fire('duelContinue');
    return;
  }
  if (typeof pending.growth === 'function' && (k === 'a' || k === 'd')) {
    e.preventDefault();
    resolveGrowth(k === 'a' ? 'attack' : 'defense');
    return;
  }
  if (typeof pending.stalkSelect === 'function' && /^[1-9]$/.test(k)) {
    e.preventDefault();
    resolveStalk(Number(k) - 1);
  }
}

// One stalk line: session ID plus recorded history. Never Attack/Defense.
function stalkEntry(parent, item, index, onPick) {
  const entry = document.createElement(onPick ? 'button' : 'div');
  if (onPick) entry.type = 'button';
  style(entry, 'display:block;width:100%;box-sizing:border-box;text-align:left;margin:6px 0;' +
    'padding:10px 12px;border-radius:10px;' +
    `background:${onPick ? COLORS.button : 'rgba(255,255,255,0.04)'};` +
    `border:1px solid ${COLORS.border};color:${COLORS.fg};font:${FONT};` +
    (onPick ? 'cursor:pointer;pointer-events:auto;' : ''));
  const head = div('display:flex;justify-content:space-between;gap:12px;align-items:baseline;', entry);
  const id = text(head, 'font-weight:600;', stalkId(item, index));
  if (onPick) text(head, `font-size:11px;color:${COLORS.faint};`, `press ${index + 1}`);
  else id.style.color = COLORS.fg;
  text(entry, `font-size:13px;margin-top:4px;color:${COLORS.dim};`, historyLine(item));
  if (onPick) entry.addEventListener('click', () => resolveStalk(index));
  parent.appendChild(entry);
  return entry;
}

function renderStalks(parent, list, onPick) {
  parent.textContent = '';
  const items = Array.isArray(list) ? list : [];
  if (!items.length) {
    text(parent, `font-size:13px;color:${COLORS.faint};`, 'None.');
    return;
  }
  items.forEach((item, index) => stalkEntry(parent, item, index, onPick));
}

// ---------- public API ----------
export function showTitle(titleText) {
  ensure();
  resetPending();
  hideOthers(el.title);
  if (titleText != null) el.titleText.textContent = String(titleText);
  el.title.style.display = 'flex';
}

export function hideTitle() {
  if (el.title) el.title.style.display = 'none';
}

export function showHUD(state) {
  ensure();
  const s = state || {};
  setText(el.hudPoints, String(Math.round(n(s.points))));
  setText(el.hudChallenge,
    `${n(s.challengeWins)} won · ${n(s.challengeLosses)} conceded · ${n(s.challengeBreaks)} broken`);
  setText(el.hudRival, recordText(s.rivalRecord));

  // The live duel rows: duel.js pushes these every frame, percentages only.
  const duel = s.duel || {};
  const live = duel.active === true;
  el.hudDuel.style.display = live ? 'block' : 'none';
  if (live) {
    setText(el.hudDamage, hudPct(duel.damagePercent));
    setText(el.hudTension, hudPct(duel.tensionPercent));
  }
  el.hud.style.display = 'block';
}

export function showDuelResult(result, onContinue) {
  ensure();
  resetPending();
  hideOthers(el.duel);
  const r = result || {};
  const raw = r.outcome == null ? 'Result' : String(r.outcome);
  const outcome = raw.charAt(0).toUpperCase() + raw.slice(1);
  el.duelOutcome.textContent = outcome;
  el.duelOutcome.style.color =
    /won|win/i.test(raw) ? COLORS.good : /broke|break|snap/i.test(raw) ? COLORS.bad : COLORS.warm;
  // A null delta means this beat did not move the balance (the growth confirmation, which follows
  // the victory screen): the points line is hidden rather than showing the same delta twice.
  if (r.pointsDelta == null) {
    el.duelPoints.textContent = '';
    el.duelPoints.style.display = 'none';
  } else {
    el.duelPoints.textContent = `Reward points ${signed(r.pointsDelta)}`;
    el.duelPoints.style.color = deltaColor(r.pointsDelta);
    el.duelPoints.style.display = 'block';
  }
  el.duelMsg.textContent = r.message == null ? '' : String(r.message);
  el.duel.style.display = 'flex';
  pending.duelContinue = typeof onContinue === 'function' ? onContinue : null;
}

export function showGrowthChoice(options, onChoose) {
  ensure();
  resetPending();
  hideOthers(el.growth);
  const o = options || {};
  const amount = formatAmount(o.amount);
  el.growthAmount.textContent = amount ? `Growth: ${amount}` : '';
  const ms = Number.isFinite(o.timeoutMs) && o.timeoutMs > 0 ? o.timeoutMs : 0;
  el.growth.style.display = 'flex';
  pending.growth = typeof onChoose === 'function' ? onChoose : null;
  if (pending.growth && ms > 0) {
    pending.growthTimer = setTimeout(() => resolveGrowth('attack'), ms);
  }
}

export function showStalkSelection(stalks, onSelect) {
  ensure();
  resetPending();
  hideOthers(el.stalks);
  const items = Array.isArray(stalks) ? stalks : [];
  pending.stalkCount = items.length;
  pending.stalkSelect = typeof onSelect === 'function' ? onSelect : null;
  renderStalks(el.stalksList, items, pending.stalkSelect != null);
  el.stalks.style.display = 'flex';
}

export function showChallengeResults(summary, onNextChallenge, onNewSession) {
  ensure();
  resetPending();
  hideOthers(el.results);
  const s = summary || {};

  el.resultsStats.textContent = '';
  const wins = statRow(el.resultsStats, 'Duels won', 16);
  const conc = statRow(el.resultsStats, 'Conceded', 16);
  const brk = statRow(el.resultsStats, 'Broke (stalk lost)', 16);
  const pts = statRow(el.resultsStats, 'Reward points balance', 16);
  wins.textContent = String(n(s.wins));
  wins.style.color = COLORS.good;
  conc.textContent = String(n(s.concessions));
  conc.style.color = COLORS.warm;
  brk.textContent = String(n(s.breaks));
  brk.style.color = n(s.breaks) > 0 ? COLORS.bad : COLORS.fg;
  pts.textContent = String(Math.round(n(s.points)));
  pts.style.color = COLORS.warm;

  text(el.resultsSurvivors, `font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.teal};`,
    'Surviving stalks');
  const survivors = div('', el.resultsSurvivors);
  renderStalks(survivors, s.survivingStalks, null);

  text(el.resultsGrave, `font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.bad};`,
    'Graveyard');
  const grave = div('', el.resultsGrave);
  const dead = Array.isArray(s.graveyardStalks) ? s.graveyardStalks : [];
  if (!dead.length) text(grave, `font-size:13px;color:${COLORS.faint};margin-top:4px;`, 'Empty — nothing broke.');
  else dead.forEach((item, i) => text(grave, `font-size:13px;color:${COLORS.dim};margin-top:4px;`,
    `· ${stalkId(item, i)}`));

  el.resultsRival.textContent = recordText(s.rivalRecord);
  el.results.style.display = 'flex';
  pending.onNext = typeof onNextChallenge === 'function' ? onNextChallenge : null;
  pending.onNew = typeof onNewSession === 'function' ? onNewSession : null;
}

export function clearAll() {
  resetPending();
  pending.onNext = null;
  pending.onNew = null;
  if (!built) return;
  hideOthers(null);
}

export default {
  showTitle, hideTitle, showHUD, showDuelResult,
  showGrowthChoice, showStalkSelection, showChallengeResults, clearAll,
};
