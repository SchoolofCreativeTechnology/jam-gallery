// The run's state reducer: session, scene, door decision, station/ending beats, restart. Pure data, no rendering.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Loop Engine contributors
// Adapted for Last Train Home under the terms of the MIT License.
// Rule changes from the approved BUILD-PLAN:
//   1. Progress counts cleared anomaly TYPES only; a correct "continue" on an unchanged coach preserves it.
//   2. A wrong call zeroes progress and reshuffles the bag (`reshuffle` is set here, consumed in `advance`).
//   3. Station beats at the tuning marks (2/4/6) and the home station at the goal (8), which waits for `disembark`.
// Also: a wrong call sends the traveller back to the reference coach with zero marks, and reference decisions
// are never scored, never penalised and never trigger a station.
import { clone, freeze } from './random.js';
import { validateBaseline, validateAnomaly, deriveScene } from './scene.js';
import { createBag, draw, lastAnomalyId } from './deck.js';

export const PHASES = ['inspect', 'feedback', 'station', 'ending', 'complete', 'gameover'];
export const CHOICES = ['continue', 'turn_back'];
export const REFERENCE_EXPLANATION = 'Remember this coach. If something changes, go back. If nothing changes, go forward.';
export const MATCHED_EXPLANATION = 'This coach matches the baseline. Nothing has changed.';
export const DISEMBARK = 'disembark';

const referenceRound = (runId, serial) => ({ id: `${runId}:${serial}`, anomalyId: null, reference: true });
const deckRound = (runId, serial, anomalyId) => ({ id: `${runId}:${serial}`, anomalyId, reference: false });

export function configure({ baseline, catalog, assets = [], capabilities = [], goal, stationMarks, minNormals, maxNormals, mix = null, maxMistakes = 0, failureAnomalyId = null }) {
  validateBaseline(baseline);
  if (!Number.isSafeInteger(goal) || goal < 1 || goal > 100) throw new Error('goal must be an integer 1-100 (from tuning)');
  if (!Array.isArray(stationMarks) || !stationMarks.length || !stationMarks.every((m) => Number.isSafeInteger(m) && m > 0 && m < goal)) throw new Error('stationMarks must be integers below goal (from tuning)');
  if (!Number.isSafeInteger(minNormals) || !Number.isSafeInteger(maxNormals) || minNormals < 0 || maxNormals < minNormals) throw new Error('minNormals/maxNormals must be integers with 0 <= min <= max (from tuning)');
  if (!Array.isArray(catalog) || !catalog.length) throw new Error('Catalog must be a non-empty array');
  const ids = new Set(), loaded = new Set(assets), supported = new Set(capabilities);
  for (const entry of catalog) { if (ids.has(entry.id)) throw new Error('Duplicate anomaly ID'); ids.add(entry.id); validateAnomaly(entry, baseline); }
  if (mix !== null) {
    if (typeof mix !== 'object' || Array.isArray(mix) || !Object.keys(mix).length) throw new Error('mix must be an object of category name to count (from tuning)');
    for (const [category, count] of Object.entries(mix)) {
      if (!Number.isSafeInteger(count) || count < 0) throw new Error(`mix.${category} must be a non-negative integer (from tuning)`);
      if (!catalog.some((entry) => entry.category === category)) throw new Error(`The mix names "${category}" and no catalog entry has that category`);
    }
    if (Object.values(mix).reduce((total, count) => total + count, 0) < goal) throw new Error('The mix draws fewer anomalies than the goal: a clean run could not reach the home station');
  }
  const eligible = catalog.filter((entry) => entry.requiresAssets.every((x) => loaded.has(x)) && entry.requiresCapabilities.every((x) => supported.has(x)));
  // The failure ending is off at 0. When it is on it needs a coach to end the ride in, and that coach must
  // not be one the deck can deal: if it were, a ride could hand the player the end of the game as an
  // ordinary puzzle and let them turn back from it. The entry keeps itself out by requiring a capability
  // the game never declares, and this proves that is still true rather than trusting it.
  if (!Number.isSafeInteger(maxMistakes) || maxMistakes < 0) throw new Error('maxMistakes must be a non-negative integer (from tuning); 0 switches the failure ending off');
  if (maxMistakes > 0) {
    if (typeof failureAnomalyId !== 'string' || !failureAnomalyId) throw new Error('failureAnomalyId is required when maxMistakes is above 0 (from tuning)');
    if (!catalog.some((entry) => entry.id === failureAnomalyId)) throw new Error(`failureAnomalyId "${failureAnomalyId}" is not in the catalog`);
    if (eligible.some((entry) => entry.id === failureAnomalyId)) throw new Error(`The failure anomaly "${failureAnomalyId}" can be drawn by the deck: it must require a capability the game does not declare`);
  }
  // Which eligible anomalies belong to each category the mix names. The deck draws from these instead of
  // from one flat pool, which is what makes every ride two of one kind and two of the other.
  const eligibleByCategory = mix === null ? null : Object.fromEntries(
    Object.keys(mix).map((category) => [category, eligible.filter((entry) => entry.category === category).map((entry) => entry.id).sort()]),
  );
  const warnings = [];
  if (!eligible.length) warnings.push('No anomalies available. This configuration is baseline practice only.');
  else if (eligible.length < goal) warnings.push(`Only ${eligible.length} eligible anomalies for a goal of ${goal}: a clean run cannot reach the home station.`);
  for (const [category, list] of Object.entries(eligibleByCategory ?? {})) {
    if (list.length < mix[category]) warnings.push(`Only ${list.length} eligible "${category}" anomalies for a mix of ${mix[category]}: the deck will top that category up from the others.`);
  }
  return freeze(clone({ baseline, catalog, goal, stationMarks: [...stationMarks], minNormals, maxNormals, mix, maxMistakes, failureAnomalyId: maxMistakes > 0 ? failureAnomalyId : null, eligibleByCategory, eligibleIds: eligible.map((x) => x.id).sort(), warnings }));
}

export function newSession(config, seed = 'default-seed', runId = 'run-1') {
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 100) throw new Error('Seed must be 1-100 characters');
  if (typeof runId !== 'string' || !runId) throw new Error('A run ID is required');
  return freeze({
    version: 1, seed, runId, serial: 0, cycle: 0, phase: 'inspect', paused: false,
    clears: 0, clearedIds: [], streak: 0, mistakes: 0, decisions: 0, reshuffle: false,
    bag: null, active: referenceRound(runId, 0), outcome: null, history: [],
  });
}

export function sceneFor(config, state) {
  const id = state.active?.anomalyId;
  const entry = id === null || id === undefined ? null : config.catalog.find((x) => x.id === id);
  if (id && !entry) throw new Error('Active effect is not in the catalog');
  return deriveScene(config.baseline, entry);
}

export function commit(config, state, choice, roundId) {
  if (!CHOICES.includes(choice) || state.phase !== 'inspect' || state.paused || !state.active || roundId !== state.active.id) return state;
  const anomalyId = state.active.anomalyId ?? null, reference = Boolean(state.active.reference);
  const entry = anomalyId === null ? null : config.catalog.find((x) => x.id === anomalyId);
  if (anomalyId !== null && !entry) throw new Error('Active effect is not in the catalog');
  const expected = anomalyId === null ? 'continue' : 'turn_back', correct = choice === expected;
  const gained = correct && !reference && anomalyId !== null && !state.clearedIds.includes(anomalyId);
  const clearedIds = gained ? [...state.clearedIds, anomalyId] : correct ? state.clearedIds : [];
  const outcome = { correct, choice, expected, anomalyId, reference, clearGain: Number(gained), explanation: reference ? REFERENCE_EXPLANATION : entry ? entry.explanation : MATCHED_EXPLANATION };
  return freeze({
    ...state, phase: 'feedback', clearedIds, clears: clearedIds.length,
    streak: correct ? state.streak + 1 : 0,
    mistakes: state.mistakes + Number(!correct && !reference),
    decisions: state.decisions + Number(!reference),
    reshuffle: !correct && !reference,
    outcome,
    history: [...state.history, { roundId, anomalyId, reference, choice, correct, clears: clearedIds.length }],
  });
}

export function advance(config, state, action = null) {
  if (state.paused) return state;
  if (state.phase === 'ending') return action === DISEMBARK ? freeze({ ...state, phase: 'complete', outcome: null, bag: null }) : state;
  if (state.phase === 'station') {
    // A station is an announcement you travel on from: the next coach is the next round in the bag.
    const serial = state.serial + 1, next = draw(config, state.seed, state.bag);
    return freeze({ ...state, serial, phase: 'inspect', outcome: null, cycle: next.bag.cycle, bag: next.bag, active: deckRound(state.runId, serial, next.anomalyId) });
  }
  if (state.phase !== 'feedback' || !state.outcome) return state;
  const serial = state.serial + 1;
  if (state.active.reference) {
    if (!state.outcome.correct) return freeze({ ...state, serial, phase: 'inspect', outcome: null, active: referenceRound(state.runId, serial) });
    const next = draw(config, state.seed, state.bag);
    return freeze({ ...state, serial, phase: 'inspect', outcome: null, cycle: next.bag.cycle, bag: next.bag, active: deckRound(state.runId, serial, next.anomalyId) });
  }
  if (state.outcome.clearGain && state.clears >= config.goal) return freeze({ ...state, phase: 'ending', outcome: null });
  if (state.outcome.clearGain && config.stationMarks.includes(state.clears)) return freeze({ ...state, phase: 'station', outcome: null });
  // Past the last allowed wrong turn, a wrong call no longer sends you back to the reference coach. The
  // feedback beat still plays first, so the player is told what they got wrong one last time, and then the
  // ride ends in the failure coach instead of starting over.
  if (state.reshuffle && config.maxMistakes > 0 && state.mistakes >= config.maxMistakes) {
    return freeze({ ...state, serial, phase: 'gameover', outcome: null, reshuffle: false, bag: null, active: deckRound(state.runId, serial, config.failureAnomalyId) });
  }
  // A wrong call rebuilds the deck and puts the traveller back at the reference coach with zero marks.
  if (state.reshuffle) {
    const rebuilt = createBag(state.seed, state.cycle + 1, config.eligibleIds, config, lastAnomalyId(state.bag));
    return freeze({ ...state, serial, phase: 'inspect', outcome: null, reshuffle: false, cycle: rebuilt.cycle, bag: rebuilt, active: referenceRound(state.runId, serial) });
  }
  const next = draw(config, state.seed, state.bag);
  return freeze({ ...state, serial, phase: 'inspect', outcome: null, cycle: next.bag.cycle, bag: next.bag, active: deckRound(state.runId, serial, next.anomalyId) });
}

export function setPaused(state, paused) {
  return state.phase === 'complete' ? state : freeze({ ...state, paused: Boolean(paused) });
}

export function replayRecord(state) {
  return clone({
    version: 1, seed: state.seed, clears: state.clears,
    decisions: state.history.map(({ roundId, anomalyId, reference, choice, correct }) => ({ roundId, anomalyId, reference, choice, correct })),
  });
}
