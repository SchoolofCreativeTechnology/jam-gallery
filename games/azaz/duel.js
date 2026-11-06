// duel.js — duel and session state for Stem to Stem (M2): hidden stalk stats, shared tension,
// steep damage, concede / break / win outcomes, the growth choice, reward points and the six-duel
// challenge. The rival is opponent.js (identity, record, nerve, stalk factory); overlays are ui.js.
// M3/M4 feel: the module also fires the break FX (a burst from particles.js, a shake from main.js's camera)
// and drives the warm hook glow that swells with the tension.
//
// The tuning numbers below live in this module for M2 on purpose: BUILD-PLAN's M3 task ("move every
// remaining number into tuning.js") owns relocating them, and tuning.js is not in this task's files.
import * as THREE from 'three';
import { createRival, DIFFICULTY_BALANCED, DIFFICULTY_STRONG, DIFFICULTY_CHAMPION } from './opponent.js';
import * as UI from './ui.js';
import { createBreakBurst, clearBursts } from './particles.js';
import {
  PULL_RATE, TENSION_MAX, TITLE_TEXT,
  SHAKE_BREAK_INTENSITY, SHAKE_BREAK_DURATION, SHAKE_CONCEDE_INTENSITY, SHAKE_CONCEDE_DURATION,
  BURST_PLAYER_COLOR, BURST_RIVAL_COLOR,
  HOOK_GLOW_COLOR, HOOK_GLOW_MAX_INTENSITY, HOOK_GLOW_DISTANCE, HOOK_GLOW_DECAY,
  HOOK_GLOW_ORB_RADIUS, HOOK_GLOW_ORB_OPACITY, HOOK_GLOW_TENSION_POWER,
} from './tuning.js';
import { initAudio, setCreak, playSnap, playConcede } from './audio.js';

// --- tuning (prototype settings) ---
const ATTACK_DEFENSE_SUM = 1000;  // every stalk is created with Attack + Defense = this
const ALLOC_SHARE_MIN = 0.25;     // matches opponent.js's stalk rule: no allocation dominates
const ALLOC_SHARE_MAX = 0.75;
const STALK_COUNT = 3;            // player stalks in a session
const DUEL_COUNT = 6;             // duels in a challenge
const BASE_DAMAGE = 420;          // damage per second at full tension against a 1000-attack stalk
const DAMAGE_TENSION_POWER = 2.6; // > 1: low tension is fairly safe, high tension is not
const PER_DUEL_CAP = 0.03;        // growth can never exceed this per duel (GROWTH_BASE lives in opponent.js)
const GROWTH_MIN = 0.7;           // session-wide stat floor, as a fraction of baseline
const GROWTH_MAX = 1.3;           // session-wide stat ceiling
const RECORD_K = 6;               // smoothing, so a 1-0 rival is not treated as unbeatable
const RECORD_WEIGHT = 0.5;        // see opponent.js: the same weights feed the growth factor
const CRED_MIN = 0.6;
const CRED_MAX = 1.6;
const REWARD_BASE = 10;           // reward points at credibility 1
const REWARD_MIN = 3;             // hard floor on the per-duel reward
const REWARD_STEP = 2;            // coarse steps, so a win then a concession nets out to zero
const START_POINTS = 20;          // reward-point balance at the start of a session
const TENSION_DECAY = 2;          // tension lost per second outside a duel, so the stalks relax
const OUTCOME_MS = 6000;          // stall guard while ui.js is showing "press SPACE to continue"
const OUTCOME_FALLBACK_MS = 1500; // with no ui.js, the result advances on its own, briskly
const GROWTH_TIMEOUT_MS = 4000;   // ui.js's growth screen times out to Attack at this point
const GROWTH_FALLBACK_MS = 5000;  // only used with no ui.js: the lower stat, per MECHANIC
const DT_MAX = 0.05;              // a stalled tab must not jump the damage forward

const PHASE = {
  TITLE: 'title',
  SELECT: 'select',   // choose which stalk to bring
  DUEL: 'duel',       // hold SPACE to pull
  GROWTH: 'growth',   // win: grow Attack or Defense
  OUTCOME: 'outcome', // the post-duel result, and the post-growth confirmation
  RESULTS: 'results', // six duels done, or the run ended
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Keep a stat inside [GROWTH_MIN, GROWTH_MAX] x its own creation baseline.
function clampStat(value, baseline) {
  return clamp(value, baseline * GROWTH_MIN, baseline * GROWTH_MAX);
}

const historyOf = (s) => ({ wins: s.wins, concessions: s.concessions, breaksCaused: s.breaksCaused });

// The overlays only ever see this: never an Attack or Defense number.
const publicStalk = (s) => ({ id: s.id, ...historyOf(s), broken: s.broken });

const pct = (factor) => `${(factor * 100).toFixed(1)}%`;

let sessionCounter = 0;

function createStalk(sessionId, index) {
  const share = ALLOC_SHARE_MIN + Math.random() * (ALLOC_SHARE_MAX - ALLOC_SHARE_MIN);
  const attack = Math.round(ATTACK_DEFENSE_SUM * share);
  return {
    id: `S${sessionId}-${index + 1}`,
    attack,
    defense: ATTACK_DEFENSE_SUM - attack,
    attackBaseline: attack,   // growth and penalties are always a fraction of these
    defenseBaseline: ATTACK_DEFENSE_SUM - attack,
    wins: 0,
    concessions: 0,
    breaksCaused: 0,          // breaks this stalk has caused to opponents
    broken: false,
  };
}

// ui.js is a namespace import so a renamed export degrades to "no overlay", never to a crash.
function ui(name, ...args) {
  const fn = UI[name] || (UI.default && UI.default[name]);
  if (typeof fn === 'function') fn(...args);
}

export function createDuel(scene, stalkPair, fx = {}) {
  // `scene` also carries the M3/M4 feel pass: the break bursts and the hook glow live in it.
  const uiPresent = typeof (UI.showStalkSelection || (UI.default && UI.default.showStalkSelection)) === 'function';
  const outcomeMs = uiPresent ? OUTCOME_MS : OUTCOME_FALLBACK_MS;

  // --- fx (M3/M4 feel) ---
  // The shake belongs to main.js's camera, which hands us its trigger; the burst and the glow are ours.
  const shake = typeof fx.shake === 'function' ? fx.shake : null;
  const hookPoint = new THREE.Vector3(0, 0, 0);   // the two hooks interlock at the world origin (stalk.js)
  let hookGlow = null;
  let hookGlowOrb = null;
  if (scene) {
    // One warm point light at the interlock: it swells with the pull and goes quiet as soon as tension decays.
    hookGlow = new THREE.PointLight(HOOK_GLOW_COLOR, 0, HOOK_GLOW_DISTANCE, HOOK_GLOW_DECAY);
    hookGlow.name = 'hook-glow';
    hookGlow.position.copy(hookPoint);
    scene.add(hookGlow);

    // The light alone sits inside the interlocked tubes, so a small additive orb rides with it and carries
    // the glow into the gaps the camera can actually see. Depth-tested: a tube in front still hides it.
    hookGlowOrb = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({
      color: HOOK_GLOW_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    }));
    hookGlowOrb.name = 'hook-glow-orb';
    hookGlowOrb.position.copy(hookPoint);
    hookGlowOrb.scale.setScalar(0);   // grown by tension, see armTension
    scene.add(hookGlowOrb);
  }

  let phase = PHASE.TITLE;
  let sessionId = 0;
  let points = START_POINTS;
  let stalks = [];
  let graveyard = [];
  let challengeLog = [];         // one entry per finished challenge
  let challengeNumber = 1;
  let duelsThisChallenge = 0;
  let challengeWins = 0;         // HUD counters for the challenge in progress
  let challengeConcessions = 0;
  let challengeBreaks = 0;
  let picked = 0;                // index of the stalk brought into the current duel
  let rival = createRival();     // the rival's identity, record and nerve outlive its stalks
  let rivalStalk = rival.generateStalkStats();   // duel.js holds the rival's current stalk
  let tension = 0;
  let damageToRival = 0;
  let damageToPlayer = 0;
  let frozen = null;             // this duel's reward numbers, frozen before the duel started
  let outcome = null;            // the last duel's result, for the overlay
  let timer = 0;                 // seconds spent in the current timed phase
  let growthTimer = 0;
  let runOver = false;
  let prevPulling = false;
  let armed = false;             // first frame of a phase: settle the release edge before trusting it
  let hudKey = '';               // last HUD content pushed, so a 60 fps hold is not 60 DOM writes/s

  addEventListener('keydown', (e) => {
    if (phase !== PHASE.GROWTH) return;
    const k = e.key.toLowerCase();
    if (k === 'a') chooseGrowth('attack');
    else if (k === 'd') chooseGrowth('defense');
  });

  // --- session and challenge plumbing ---
  function aliveStalks() {
    return stalks.reduce((out, s, i) => (s.broken ? out : (out.push(i), out)), []);
  }

  function resetChallengeCounters() {
    challengeWins = 0;
    challengeConcessions = 0;
    challengeBreaks = 0;
  }

  function newSession() {
    sessionCounter += 1;
    sessionId = sessionCounter;
    stalks = [];
    for (let i = 0; i < STALK_COUNT; i++) stalks.push(createStalk(sessionId, i));
    graveyard = [];
    challengeLog = [];
    challengeNumber = 1;
    duelsThisChallenge = 0;
    resetChallengeCounters();
    points = START_POINTS;
    picked = 0;
    tension = 0;
    damageToRival = 0;
    damageToPlayer = 0;
    frozen = null;
    outcome = null;
    timer = 0;
    growthTimer = 0;
    runOver = false;
    rival = createRival(DIFFICULTY_BALANCED);        // a new session is a new rival, starting at the base tier
    rivalStalk = rival.generateStalkStats();
    phase = PHASE.TITLE;
    armTension();
    syncUI();
  }

  function openSelection() {
    const alive = aliveStalks();
    if (alive.length === 0) {
      runOver = true;
      phase = PHASE.RESULTS;
      closeChallenge();
      syncUI();
      return;
    }
    // Default highlight only: the stalk last used if it survived, else the first survivor in order.
    // Never chosen by hidden stats.
    picked = alive.includes(picked) ? picked : alive[0];
    phase = PHASE.SELECT;
    armed = false;
    syncUI();
  }

  function selectStalk(index) {
    if (phase !== PHASE.SELECT) return;
    const i = Number.isInteger(index) ? index : picked;
    if (i < 0 || i >= stalks.length || stalks[i].broken) return;
    picked = i;
    startDuel();
  }

  // The challenge escalates: the same rival gets bolder and more Attack-heavy as the six duels go on.
  // Both the difficulty and the gamble are fixed here, before the duel, so neither can react to play.
  function difficultyForDuel(index) {
    if (index >= 4) return DIFFICULTY_CHAMPION;   // duels 4 and 5
    if (index >= 2) return DIFFICULTY_STRONG;     // duels 2 and 3
    return DIFFICULTY_BALANCED;                   // duels 0 and 1
  }

  function startDuel() {
    // The rival moves up its own tiers mid-challenge; its record survives the move.
    const difficulty = difficultyForDuel(duelsThisChallenge);
    if (typeof rival.setDifficulty === 'function') rival.setDifficulty(difficulty);
    // Fixed before the duel, from the rival's own nerve: whether it gambles this time. It is never
    // rolled again mid-duel, so the rival cannot react to the player.
    if (typeof rival.beginDuel === 'function') rival.beginDuel();
    frozen = freezeReward();
    tension = 0;
    damageToRival = 0;
    damageToPlayer = 0;
    outcome = null;
    timer = 0;
    growthTimer = 0;
    armed = false;
    phase = PHASE.DUEL;
    syncUI();
  }

  function closeChallenge() {
    challengeLog.push({
      number: challengeNumber,
      duels: duelsThisChallenge,
      wins: challengeWins,
      concessions: challengeConcessions,
      breaks: challengeBreaks,
      survivors: stalks.filter((s) => !s.broken).map((s) => s.id),
      broken: stalks.filter((s) => s.broken).map((s) => s.id),
    });
  }

  function nextChallenge() {
    if (phase !== PHASE.RESULTS || runOver) return;
    if (aliveStalks().length === 0) return;
    challengeNumber += 1;
    duelsThisChallenge = 0;
    resetChallengeCounters();
    outcome = null;
    timer = 0;
    openSelection();   // syncs the UI
  }

  // --- the rival, through opponent.js's real API ---
  function freezeReward() {
    // Growth comes from the rival (frozen from its record before the duel starts) ...
    const growthFactor = typeof rival.getRewardFactor === 'function'
      ? Number(rival.getRewardFactor()) || 0
      : 0;
    // ... and the reward-point magnitude from the same record, in duel.js's own coarse steps.
    const record = rival.record || { wins: 0, losses: 0 };
    const played = (Number(record.wins) || 0) + (Number(record.losses) || 0);
    const recordStrength = played > 0 ? ((Number(record.wins) || 0) - (Number(record.losses) || 0)) / (played + RECORD_K) : 0;
    const credibility = clamp(1 + RECORD_WEIGHT * recordStrength, CRED_MIN, CRED_MAX);
    const reward = Math.max(REWARD_MIN, Math.round((REWARD_BASE * credibility) / REWARD_STEP) * REWARD_STEP);
    return { growthFactor: clamp(growthFactor, 0, PER_DUEL_CAP), credibility, reward };
  }

  // The rival grows whichever stat sits lower relative to its baseline (opponent.js decides which).
  function growRival() {
    const factor = frozen ? frozen.growthFactor : 0;
    const stat = typeof rival.chooseGrowthStat === 'function'
      ? rival.chooseGrowthStat(rivalStalk.attack, rivalStalk.defense, rivalStalk.attackBaseline, rivalStalk.defenseBaseline)
      : 'attack';
    if (stat === 'defense') {
      rivalStalk.defense = clampStat(rivalStalk.defense + factor * rivalStalk.defenseBaseline, rivalStalk.defenseBaseline);
    } else {
      rivalStalk.attack = clampStat(rivalStalk.attack + factor * rivalStalk.attackBaseline, rivalStalk.attackBaseline);
    }
  }

  function rivalResult(kind) {   // 'win' | 'loss', from the rival's side of the duel
    if (kind === 'win') {
      if (typeof rival.addWin === 'function') rival.addWin();
      growRival();
    } else if (typeof rival.addLoss === 'function') {
      rival.addLoss();
    }
  }

  function rivalWantsConcede() {
    // opponent.js decides on its own damage/Defense ratio and its nerve alone: it never reads the
    // player's numbers or the tension, so it cannot mirror the player's release in the same frame.
    if (typeof rival.shouldConcede !== 'function') return false;
    return rival.shouldConcede({ rivalDefense: rivalStalk.defense, rivalDamage: damageToRival }) === true;
  }

  // --- the duel itself ---
  function outcomeMessage(result, rivalBroke, factor) {
    if (result === 'win') {
      return rivalBroke
        ? "Your rival's stalk snapped. The duel is yours."
        : 'Your rival let go. The duel is yours.';
    }
    if (result === 'concede') {
      return `You let go in time — this stalk survives, but it loses ground: Attack and Defense each drop by ${pct(factor)} of baseline.`;
    }
    return 'You held too long. This stalk goes to the Graveyard. No extra stat penalty.';
  }

  function finishDuel(result, rivalBroke) {   // result: 'win' | 'concede' | 'break'
    // One settlement per duel: the reward, the stat change and the record entry all happen here,
    // and here only. This duel's frozen numbers carry the flag.
    if (frozen && frozen.settled) return;
    if (frozen) frozen.settled = true;

    // A break rings out — the player's own ('break') or the rival's ('win' + rivalBroke). A player
    // concede eases off. One sound per duel, settled in the same place as everything else, and the
    // break's feel (burst colour + shake) rides with it: the two never disagree about whose stalk went.
    if (result === 'break' || (result === 'win' && rivalBroke)) {
      playSnap();
      const rivalSnapped = result === 'win' && !!rivalBroke;
      // Ochre for the player's own stalk, teal for the rival's, both thrown from the interlock where it went.
      createBreakBurst(scene, hookPoint, rivalSnapped ? BURST_RIVAL_COLOR : BURST_PLAYER_COLOR);
      if (shake) shake(SHAKE_BREAK_INTENSITY, SHAKE_BREAK_DURATION);
    } else if (result === 'concede') {
      playConcede();
      if (shake) shake(SHAKE_CONCEDE_INTENSITY, SHAKE_CONCEDE_DURATION);   // a knock, not a snap
    }

    const stalk = stalks[picked];
    const factor = frozen ? frozen.growthFactor : 0;
    const reward = frozen ? frozen.reward : REWARD_MIN;
    const before = points;

    if (result === 'win') {
      points += reward;
      stalk.wins += 1;
      challengeWins += 1;
      if (rivalBroke) {
        stalk.breaksCaused += 1;
        rivalStalk = rival.generateStalkStats();   // a fresh stalk, a new identity
      }
      rivalResult('loss');
    } else if (result === 'concede') {
      points -= reward;
      stalk.concessions += 1;
      challengeConcessions += 1;
      // The concession penalty has the same magnitude as this duel's growth, on both stats.
      stalk.attack = clampStat(stalk.attack - factor * stalk.attackBaseline, stalk.attackBaseline);
      stalk.defense = clampStat(stalk.defense - factor * stalk.defenseBaseline, stalk.defenseBaseline);
      rivalResult('win');
    } else {
      points -= reward;
      challengeBreaks += 1;
      stalk.broken = true;
      graveyard.push(stalk.id);
      rivalResult('win');   // breaking yourself still hands the rival the duel
    }
    points = Math.max(0, points);   // reward points never go negative

    outcome = {
      result,
      rivalBroke: !!rivalBroke,
      delta: points - before,
      points,
      growth: result === 'win' ? factor : 0,
      applied: null,                                  // set once the growth choice is made
      message: outcomeMessage(result, rivalBroke, factor),
    };
    duelsThisChallenge += 1;
    timer = 0;
    growthTimer = 0;
    phase = PHASE.OUTCOME;   // the result always gets its own beat before anything else
    syncUI();
  }

  function lowerStat(stalk) {
    const a = stalk.attack / stalk.attackBaseline;
    const d = stalk.defense / stalk.defenseBaseline;
    return a <= d ? 'attack' : 'defense';   // tie goes to Attack, per the mechanic
  }

  function chooseGrowth(kind) {
    if (phase !== PHASE.GROWTH) return;
    const stalk = stalks[picked];
    const factor = frozen ? frozen.growthFactor : 0;
    const stat = String(kind || '').toLowerCase().startsWith('d') ? 'defense' : 'attack';
    // Growth is applied once, as a fraction of that stat's creation baseline.
    if (stat === 'attack') stalk.attack = clampStat(stalk.attack + factor * stalk.attackBaseline, stalk.attackBaseline);
    else stalk.defense = clampStat(stalk.defense + factor * stalk.defenseBaseline, stalk.defenseBaseline);
    if (outcome) outcome.applied = stat;
    phase = PHASE.OUTCOME;   // the growth confirmation is its own beat too
    timer = 0;
    syncUI();
  }

  function advanceFromOutcome() {
    if (phase !== PHASE.OUTCOME) return;
    if (outcome && outcome.result === 'win' && outcome.growth > 0 && !outcome.applied) {
      phase = PHASE.GROWTH;
      growthTimer = 0;
      syncUI();
      return;
    }
    if (aliveStalks().length === 0) {
      runOver = true;
      phase = PHASE.RESULTS;
      closeChallenge();
      syncUI();
      return;
    }
    if (duelsThisChallenge >= DUEL_COUNT) {
      phase = PHASE.RESULTS;
      closeChallenge();
      syncUI();
      return;
    }
    openSelection();   // syncs the UI
  }

  // --- per-frame ---
  // Pushes the current tension at everything that reads it: the stalks' pose, and the hook glow. Called on
  // every path that moves tension, so the glow can never be left bright after a duel or a restart.
  function armTension() {
    if (stalkPair && typeof stalkPair.setTension === 'function') stalkPair.setTension(clamp(tension, 0, 1));
    const t = clamp(tension / (TENSION_MAX || 1), 0, 1);
    const swell = Math.pow(t, HOOK_GLOW_TENSION_POWER);   // a light pull stays quiet; only the break is loud
    if (hookGlow) hookGlow.intensity = swell * HOOK_GLOW_MAX_INTENSITY;
    if (hookGlowOrb) {
      hookGlowOrb.scale.setScalar(HOOK_GLOW_ORB_RADIUS * (0.25 + 0.75 * t));
      hookGlowOrb.material.opacity = swell * HOOK_GLOW_ORB_OPACITY;
    }
  }

  function update(dt, input) {
    const phaseBefore = phase;
    const step = Math.min(Math.max(Number(dt) || 0, 0), DT_MAX);
    const pressing = !!(input && input.pulling);
    const pressed = pressing && !prevPulling;    // rising edge: confirm / start a pull
    const released = !pressing && prevPulling;   // falling edge: let go

    if (input && input.restart) {
      setCreak(0);   // never leave the creak droning into the title screen
      clearBursts(); // nor specks hanging in the air from the duel being restarted away
      newSession();
      prevPulling = pressing;
      armTension();
      return;
    }

    switch (phase) {
      case PHASE.TITLE:
        if (pressed) {
          initAudio();   // first user gesture: unlock Web Audio here
          openSelection();
        }
        break;

      case PHASE.SELECT:
        // One frame to settle, then a fresh SPACE press confirms the highlighted stalk. Holding on
        // from the previous screen therefore never skips the choice; a click or 1/2/3 also works.
        if (!armed) armed = true;
        else if (pressed) selectStalk(picked);
        break;

      case PHASE.DUEL: {
        if (!armed) {
          armed = true;
          break;
        }
        if (pressed) initAudio();   // a click through selection can reach the pull without a title press
        if (pressing) {
          tension = Math.min(TENSION_MAX, tension + PULL_RATE * step);
          const rate = BASE_DAMAGE * Math.pow(tension, DAMAGE_TENSION_POWER);
          damageToPlayer += (rivalStalk.attack / ATTACK_DEFENSE_SUM) * rate * step;
          damageToRival += (stalks[picked].attack / ATTACK_DEFENSE_SUM) * rate * step;
          setCreak(tension / TENSION_MAX);
          if (damageToPlayer >= stalks[picked].defense) finishDuel('break', false);
          else if (damageToRival >= rivalStalk.defense) finishDuel('win', true);
          else if (rivalWantsConcede()) finishDuel('win', false);
        } else if (released) {
          finishDuel('concede', false);
        }
        break;
      }

      case PHASE.GROWTH:
        growthTimer += step;
        // ui.js times the growth screen out to Attack itself; this is the no-overlay safety net and
        // it follows MECHANIC (the lower stat relative to baseline, ties to Attack).
        if (growthTimer * 1000 >= GROWTH_FALLBACK_MS) chooseGrowth(lowerStat(stalks[picked]));
        break;

      case PHASE.OUTCOME:
        timer += step;
        if (timer * 1000 >= outcomeMs) advanceFromOutcome();
        else if (!uiPresent && timer > 0.25 && pressed) advanceFromOutcome();
        break;

      case PHASE.RESULTS:
        timer += step;
        // ui.js offers Next Challenge / New Session buttons; with no overlay, SPACE goes on.
        if (!uiPresent && timer > 0.25 && pressed) nextChallenge();
        break;

      default:
        break;
    }

    if (phase !== PHASE.DUEL) {
      tension = Math.max(0, tension - TENSION_DECAY * step);
      setCreak(0);   // the creak never outlives the duel
    }

    prevPulling = pressing;
    armTension();
    if (phase !== phaseBefore) syncUI();   // any transition made here reaches the overlays
    if (phase === PHASE.DUEL) pushHud();   // every frame: the player's own damage and the tension
  }

  // --- overlays: every screen duel.js can show, in ui.js's own shapes ---
  function hudState() {
    const stalk = stalks[picked];
    const inDuel = phase === PHASE.DUEL && !!stalk;
    return {
      points,
      challengeWins,
      challengeLosses: challengeConcessions,
      challengeBreaks,
      rivalRecord: rival.record,
      // Live duel read-out for ui.js: the player's own damage as a share of their stalk's Defense,
      // and the shared tension. Percentages only — the exact Attack and Defense never leave this
      // module, and the rival's condition is never shown at all.
      duel: {
        active: inDuel,
        damagePercent: inDuel && stalk.defense > 0
          ? clamp((damageToPlayer / stalk.defense) * 100, 0, 100)
          : 0,
        tensionPercent: inDuel ? clamp((tension / TENSION_MAX) * 100, 0, 100) : 0,
      },
    };
  }

  // Push the HUD, but only when the rounded percentages or the counters actually move.
  function pushHud(force) {
    const state = hudState();
    const key = [
      state.points, state.challengeWins, state.challengeLosses, state.challengeBreaks,
      state.duel.active ? 1 : 0,
      Math.round(state.duel.damagePercent), Math.round(state.duel.tensionPercent),
    ].join('|');
    if (!force && key === hudKey) return;
    hudKey = key;
    ui('showHUD', state);
  }

  function aliveViews() {
    return aliveStalks().map((i) => ({ index: i, id: stalks[i].id, history: historyOf(stalks[i]) }));
  }

  function resultView() {
    const o = outcome || {};
    if (o.applied) {
      const label = o.applied === 'attack' ? 'Attack honed' : 'Defense hardened';
      return {
        outcome: 'Growth',
        // The reward was granted once, on the victory screen. This beat shows the growth only:
        // null tells ui.js to drop the points line rather than repeat the delta.
        pointsDelta: null,
        message: `${label} — ${pct(o.growth)} of this stalk's baseline.`,
      };
    }
    const label = o.result === 'win' ? 'Won' : o.result === 'concede' ? 'Conceded' : 'Stalk broken';
    return { outcome: label, pointsDelta: o.delta || 0, message: o.message || '' };
  }

  function resultsView() {
    return {
      wins: challengeWins,
      concessions: challengeConcessions,
      breaks: challengeBreaks,
      points,
      survivingStalks: aliveViews(),
      graveyardStalks: graveyard.slice(),
      rivalRecord: rival.record,
    };
  }

  function syncUI() {
    switch (phase) {
      case PHASE.TITLE:
        ui('clearAll');
        ui('showTitle', TITLE_TEXT);
        pushHud(true);
        break;

      case PHASE.SELECT: {
        const list = aliveViews();
        pushHud(true);
        ui('showStalkSelection', list, (listIndex) => {
          const entry = list[listIndex];           // the overlay numbers the survivors it was given
          if (entry) selectStalk(entry.index);
        });
        break;
      }

      case PHASE.DUEL:
        ui('clearAll');                            // drops the selection overlay, keeps the HUD next
        pushHud(true);
        break;

      case PHASE.GROWTH:
        ui('showGrowthChoice', { amount: outcome ? outcome.growth : 0, timeoutMs: GROWTH_TIMEOUT_MS },
          (kind) => chooseGrowth(kind));
        break;

      case PHASE.OUTCOME:
        ui('showDuelResult', resultView(), () => advanceFromOutcome());
        break;

      case PHASE.RESULTS:
        ui('showChallengeResults', resultsView(), () => nextChallenge(), () => newSession());
        break;

      default:
        break;
    }
  }

  // Read-only snapshot for debugging and tests. Never carries an Attack or Defense number.
  function viewModel() {
    const alive = aliveStalks();
    return {
      phase,
      points,
      tension,
      challenge: {
        number: challengeNumber,
        duel: Math.min(duelsThisChallenge + 1, DUEL_COUNT),
        total: DUEL_COUNT,
      },
      picked,
      stalk: stalks[picked] ? publicStalk(stalks[picked]) : null,
      stalks: stalks.map(publicStalk),
      aliveCount: alive.length,
      graveyard: graveyard.slice(),
      log: challengeLog.slice(),
      rival: { record: { ...rival.record }, difficulty: rival.difficulty, stalkId: rivalStalk.stalkId },
      outcome,
      canNextChallenge: phase === PHASE.RESULTS && !runOver && alive.length > 0,
      runOver,
    };
  }

  newSession();   // build the first session and show the title

  return {
    update,
    getState: () => phase,
    getViewModel: viewModel,
  };
}

export default createDuel;
