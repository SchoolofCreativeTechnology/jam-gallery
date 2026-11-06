// The deck: one shuffled permutation of every anomaly type per bag, with unchanged coaches interspersed.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Loop Engine contributors
// Adapted for Last Train Home under the terms of the MIT License.
// Derived from loop-engine/adaptive/anomaly-director.mjs ("never repeat or invent an effect"):
// a bag uses each eligible anomaly exactly once, padded with `null` (normal) rounds rather than
// repeated effects. Every gap between anomalies gets its own seeded random count of normal rounds
// in [minNormals, maxNormals]; the gaps before the first and after the last anomaly are included, so
// the first and last coach may be either an anomaly or a normal one and run length varies.
import { seededRandom, shuffled } from './random.js';

export const NORMAL_ROUND = 'normal';
export const ANOMALY_ROUND = 'anomaly';

function round(kind, anomalyId) {
  return { kind, anomalyId, expectedChoice: anomalyId === null ? 'continue' : 'turn_back' };
}

function normalRange(config) {
  const min = config?.minNormals, max = config?.maxNormals;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || max < min) throw new Error('Deck needs integer minNormals/maxNormals with 0 <= min <= max (from tuning)');
  return { min, max };
}

// The order the anomalies come in. With no mix, it is one shuffle of everything eligible. With a mix
// (RUN_MIX in tuning.js), it takes that many from each category first and only then tops up from whatever
// is left — so a ride is never all yokai or all coach-changes, and a category that came up short (a model
// that has not loaded) can never leave the bag too small to reach the home station.
function pickOrder(eligibleIds, config, random) {
  const mix = config?.mix, groups = config?.eligibleByCategory;
  if (!mix || !groups) return shuffled(eligibleIds, random);
  const pools = new Map(Object.entries(groups).map(([category, list]) => [category, shuffled(list, random)]));
  const wanted = Object.values(mix).reduce((total, count) => total + count, 0);
  const picked = [], spare = [];
  for (const [category, count] of Object.entries(mix)) {
    const pool = pools.get(category) ?? [];
    for (let i = 0; i < count && pool.length; i += 1) picked.push(pool.shift());
    spare.push(...pool);
  }
  for (const id of shuffled(spare, random)) { if (picked.length >= wanted) break; picked.push(id); }
  // The mix decides WHICH four, never the order: they are shuffled again, or every ride would open the
  // same way. If the mix somehow yields nothing, fall back to the whole eligible list rather than throw.
  return shuffled(picked.length ? picked : eligibleIds, random);
}

export function createBag(seed, cycle, eligibleIds, config, previousId = null) {
  if (!Array.isArray(eligibleIds) || !eligibleIds.length) throw new Error('A bag needs at least one eligible anomaly ID');
  if (new Set(eligibleIds).size !== eligibleIds.length) throw new Error('Eligible anomaly IDs must be unique');
  if (!Number.isSafeInteger(cycle) || cycle < 0) throw new Error('A bag cycle must be a non-negative integer');
  const { min, max } = normalRange(config);
  const random = seededRandom(`${String(seed)}:bag:${cycle}`), order = pickOrder(eligibleIds, config, random);
  if (previousId !== null && order.length > 1 && order[0] === previousId) {
    const j = 1 + Math.floor(random() * (order.length - 1));
    [order[0], order[j]] = [order[j], order[0]];
  }
  const gap = () => min + Math.floor(random() * (max - min + 1)), entries = [];
  for (const anomalyId of order) {
    for (let n = gap(); n > 0; n--) entries.push(round(NORMAL_ROUND, null));
    entries.push(round(ANOMALY_ROUND, anomalyId));
  }
  for (let n = gap(); n > 0; n--) entries.push(round(NORMAL_ROUND, null));
  return { cycle, seed: String(seed), cursor: 0, previousId, drawnId: previousId, entries };
}

export const lastAnomalyId = (bag) => bag?.drawnId ?? null;

// Hands back the next round, opening the next bag when the current one runs out.
export function draw(config, seed, previous) {
  const spent = !previous || previous.cursor >= previous.entries.length;
  const bag = spent ? createBag(seed, previous ? previous.cycle + 1 : 0, config.eligibleIds, config, lastAnomalyId(previous)) : previous;
  const entry = bag.entries[bag.cursor];
  if (!entry) throw new Error('Bag produced no round');
  return { bag: { ...bag, cursor: bag.cursor + 1, drawnId: entry.anomalyId ?? bag.drawnId ?? null }, anomalyId: entry.anomalyId };
}
