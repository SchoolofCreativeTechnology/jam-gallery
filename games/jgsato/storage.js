// Best times, unlocked courses, and the sound and tilt settings, kept in this browser.
// If storage is blocked (private windows, some embeds) the game still plays; it just forgets.
const KEY = 'jambis-head-v1';

const data = read();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return { best: parsed.best || {}, unlocked: Math.max(1, parsed.unlocked | 0), muted: !!parsed.muted, tilt: parsed.tilt !== false, boss: !!parsed.boss };
    }
  } catch { /* storage unavailable */ }
  return { best: {}, unlocked: 1, muted: false, tilt: true, boss: false };
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* storage unavailable */ }
}

export function bestTime(level) {
  const t = data.best[level];
  return typeof t === 'number' ? t : null;
}

export function unlockedCount() {
  return data.unlocked;
}

export function isMuted() {
  return data.muted;
}

export function setMuted(m) {
  data.muted = m;
  write();
}

export function tiltOn() {
  return data.tilt;
}

export function setTilt(on) {
  data.tilt = on;
  write();
}

export function bossBeaten() {
  return data.boss;
}

export function setBossBeaten() {
  data.boss = true;
  write();
}

// Record a finished run. Returns true if it's a new best for that course.
export function recordRun(level, time, levelCount) {
  const prev = bestTime(level);
  const isBest = prev === null || time < prev;
  if (isBest) data.best[level] = time;
  data.unlocked = Math.min(levelCount, Math.max(data.unlocked, level + 2));
  write();
  return isBest;
}

// 0 gold, 1 silver, 2 bronze, -1 none.
export function medalFor(time, medals) {
  if (time === null) return -1;
  for (let i = 0; i < medals.length; i++) if (time <= medals[i]) return i;
  return -1;
}
