// opponent.js — the rival: its difficulty tier, its own persistent win/loss record, per-stalk Attack/Defense, concede nerve and growth choice.
// The risk thresholds and the gamble chance live in tuning.js; the rest of the numbers here wait for M3.

import {
  OP_RISK_CAUTIOUS, OP_RISK_BALANCED, OP_RISK_RECKLESS, OP_RISK_STRONG, OP_RISK_CHAMPION,
  OP_RISK_JITTER, OP_RISK_MIN, OP_RISK_MAX,
  OP_GAMBLE_CHANCE, OP_GAMBLE_EXTRA, OP_RISK_EFFECTIVE_MAX,
} from './tuning.js';

// --- difficulty tiers (AI_DIFFICULTY) ---
export const DIFFICULTY_CAUTIOUS = 0.5;
export const DIFFICULTY_BALANCED = 1.0;
export const DIFFICULTY_RECKLESS = 1.5;
export const DIFFICULTY_STRONG = 2.5;
export const DIFFICULTY_CHAMPION = 4.0;

// Higher difficulty = the rival will take more risk before it concedes.
const RISK_TIERS = [
  { difficulty: DIFFICULTY_CAUTIOUS, risk: OP_RISK_CAUTIOUS },   // cautious
  { difficulty: DIFFICULTY_BALANCED, risk: OP_RISK_BALANCED },   // balanced
  { difficulty: DIFFICULTY_RECKLESS, risk: OP_RISK_RECKLESS },   // reckless
  { difficulty: DIFFICULTY_STRONG, risk: OP_RISK_STRONG },       // strong
  { difficulty: DIFFICULTY_CHAMPION, risk: OP_RISK_CHAMPION },   // champion
];

// --- stalk creation ---
export const ATTACK_DEFENSE_SUM = 1000;
const MIN_STAT_SHARE = 0.25; // a normal stalk is never purely one stat (attack share 0.25 .. 0.75)
const MAX_STAT_SHARE = 0.75;
// Higher tiers lean on Attack: a smaller, more concentrated Defense pool means the same share of
// the pool lands harder, so strong and champion stalks hurt more even at the same nerve.
const STRONG_ATTACK_SHARE = [0.55, 0.75];
const CHAMPION_ATTACK_SHARE = [0.60, 0.75];

// Attack share range for a tier: normal until strong, the strong band at strong, champion above.
function attackShareRange(difficulty) {
  if (difficulty >= DIFFICULTY_CHAMPION) return CHAMPION_ATTACK_SHARE;
  if (difficulty >= DIFFICULTY_STRONG) return STRONG_ATTACK_SHARE;
  return [MIN_STAT_SHARE, MAX_STAT_SHARE];
}

// --- reward factor defaults (prototype settings from BUILD-PLAN) ---
const DEFAULT_GROWTH_BASE = 0.02;
const DEFAULT_PER_DUEL_CAP = 0.03;
const DEFAULT_RECORD_K = 6;
const DEFAULT_RECORD_WEIGHT = 0.5;
const CREDIBILITY_MIN = 0.6;
const CREDIBILITY_MAX = 1.6;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Risk the rival accepts at this difficulty, straight lines between the three tiers.
function riskForDifficulty(difficulty) {
  const first = RISK_TIERS[0];
  const last = RISK_TIERS[RISK_TIERS.length - 1];
  if (difficulty <= first.difficulty) return first.risk;
  if (difficulty >= last.difficulty) return last.risk;
  for (let i = 1; i < RISK_TIERS.length; i++) {
    const a = RISK_TIERS[i - 1];
    const b = RISK_TIERS[i];
    if (difficulty <= b.difficulty) {
      const k = (difficulty - a.difficulty) / (b.difficulty - a.difficulty);
      return a.risk + (b.risk - a.risk) * k;
    }
  }
  return last.risk;
}

let nextStalkNumber = 1;

export function createRival(difficulty = DIFFICULTY_BALANCED) {
  const value = Number(difficulty);
  let tier = Number.isFinite(value) ? value : DIFFICULTY_BALANCED;

  // The rival owns this record; its stalks come and go without touching it.
  const record = { wins: 0, losses: 0 };

  // Nerve belongs to the current stalk's identity: a replacement stalk gets fresh nerve.
  let riskNerve = 0;
  let riskGamble = 0;   // this duel only: the extra it is willing to take beyond its own nerve
  let stalkId = null;

  function rollNerve() {
    const swing = (Math.random() * 2 - 1) * OP_RISK_JITTER;
    riskNerve = clamp(riskForDifficulty(tier) * (1 + swing), OP_RISK_MIN, OP_RISK_MAX);
  }

  // A gamble is decided once, before the duel, from a coin flip of its own nerve alone.
  function rollGamble() {
    riskGamble = Math.random() < OP_GAMBLE_CHANCE ? OP_GAMBLE_EXTRA : 0;
  }

  // Nerve plus this duel's gamble. Capped at 1.0: a gambled rival holds until damage reaches its
  // Defense, which is exactly where it breaks.
  function riskAccepted() {
    return clamp(riskNerve + riskGamble, OP_RISK_MIN, OP_RISK_EFFECTIVE_MAX);
  }

  function addWin() {
    record.wins += 1;
    return record;
  }

  function addLoss() {
    record.losses += 1;
    return record;
  }

  // Frozen from the record before the duel: call this before the duel starts, not during it.
  function getRewardFactor({
    growthBase = DEFAULT_GROWTH_BASE,
    perDuelCap = DEFAULT_PER_DUEL_CAP,
    recordK = DEFAULT_RECORD_K,
    recordWeight = DEFAULT_RECORD_WEIGHT,
  } = {}) {
    const played = record.wins + record.losses;
    const denominator = played + recordK;
    const recordStrength = denominator > 0 ? (record.wins - record.losses) / denominator : 0;
    const credibility = clamp(1 + recordWeight * recordStrength, CREDIBILITY_MIN, CREDIBILITY_MAX);
    return clamp(growthBase * tier * credibility, 0, perDuelCap);
  }

  // Decides purely on the rival's own damage ratio. It never looks at the player's numbers or
  // the current tension, so it cannot mirror the player's release in the same frame.
  function shouldConcede(state = {}) {
    const defense = Number(state.rivalDefense);
    const damage = Number(state.rivalDamage);
    if (!Number.isFinite(defense) || defense <= 0) return true; // already broken
    if (!Number.isFinite(damage) || damage <= 0) return false;
    return damage / defense > riskAccepted();
  }

  // Grow whichever stat sits lower relative to its own baseline; ties go to attack.
  function chooseGrowthStat(attack, defense, attackBaseline, defenseBaseline) {
    const share = (stat, baseline) => (baseline > 0 ? Number(stat) / baseline : 1);
    return share(defense, defenseBaseline) < share(attack, attackBaseline) ? 'defense' : 'attack';
  }

  // A fresh stalk: new identity, random split of 1000 (leaning on Attack at the higher tiers),
  // both baselines recorded at creation.
  function generateStalkStats() {
    const [shareLo, shareHi] = attackShareRange(tier);
    const attack = Math.round(ATTACK_DEFENSE_SUM * (shareLo + Math.random() * (shareHi - shareLo)));
    const defense = ATTACK_DEFENSE_SUM - attack;
    riskNerve = 0;
    riskGamble = 0;
    rollNerve();
    rollGamble();
    stalkId = `rival-stalk-${nextStalkNumber++}`;
    return { attack, defense, attackBaseline: attack, defenseBaseline: defense, stalkId };
  }

  // Move the rival to another tier. Its record is untouched: only the nerve band and this duel's
  // gamble are re-rolled, so an escalating challenge keeps the same rival identity throughout.
  function setDifficulty(next) {
    const value = Number(next);
    if (Number.isFinite(value)) tier = value;
    rollNerve();
    rollGamble();
    return tier;
  }

  // Called once per duel, before it starts, so the gamble is fixed and cannot react to the player.
  function beginDuel() {
    rollGamble();
    return riskAccepted();
  }

  rollNerve(); // nerve exists before the first stalk is generated
  rollGamble();

  return {
    get difficulty() { return tier; },   // live: setDifficulty moves it mid-challenge
    record,
    addWin,
    addLoss,
    getRewardFactor,
    shouldConcede,
    chooseGrowthStat,
    generateStalkStats,
    setDifficulty,
    beginDuel,
    getRiskThreshold: () => riskAccepted(),
    getStalkId: () => stalkId,
  };
}

export default createRival;
