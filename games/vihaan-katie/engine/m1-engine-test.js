// Temporary M1 check: exercises the ported engine (scene, deck, movement, reducer) with node only.
import assert from 'node:assert/strict';
import * as movement from './movement.js';
import { validateBaseline, validateAnomaly, deriveScene } from './scene.js';
import { createBag, draw } from './deck.js';
import { configure, newSession, sceneFor, commit, advance, setPaused, replayRecord, DISEMBARK } from './game.js';

let passed = 0;
const ok = (label) => { passed += 1; console.log(`  ok  ${label}`); };

// --- baseline and anomalies -------------------------------------------------------------------
const baseline = [
  { id: 'bench-left', kind: 'bench', position: [-0.6, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, color: '#8b5a2b', asset: null },
  { id: 'luggage', kind: 'luggage', position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, color: '#4a4a4a', asset: null },
  { id: 'lamp', kind: 'lamp', position: [1.2, 2.4, -3], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, color: '#ffcc88', asset: null },
];
assert.equal(validateBaseline(baseline).size, 3);
ok('a valid baseline passes validateBaseline');
assert.throws(() => validateBaseline([...baseline, { ...baseline[0] }]), /unique/);
assert.throws(() => validateBaseline([{ ...baseline[0], scale: [1, 0, 1] }]), /transform/);
assert.throws(() => validateBaseline([]), /must contain/);
ok('baseline validation still rejects duplicate IDs, bad transforms and empty baselines');

const anomaly = { id: 'floating-luggage', explanation: 'The luggage floats.', operations: [{ type: 'position', target: 'luggage', value: [0, 1.6, 0] }], requiresAssets: [], requiresCapabilities: [] };
validateAnomaly(anomaly, baseline);
const changed = deriveScene(baseline, anomaly);
assert.notDeepEqual(changed, baseline);
assert.deepEqual(changed[1].position, [0, 1.6, 0]);
assert.deepEqual(baseline[1].position, [0, 1, 0]);
assert.ok(Object.isFrozen(changed) && Object.isFrozen(changed[1]));
ok('a valid anomaly produces a different, frozen scene derived from the untouched baseline');

assert.throws(() => validateAnomaly({ ...anomaly, id: 'no-op', operations: [{ type: 'position', target: 'luggage', value: [0, 1, 0] }] }, baseline), /no state change/);
ok('an anomaly that makes no state change throws in validateAnomaly');
assert.throws(() => validateAnomaly({ ...anomaly, id: 'ghost', operations: [{ type: 'visible', target: 'nobody', value: false }] }, baseline), /Unknown target/);
assert.throws(() => validateAnomaly({ ...anomaly, id: 'swap', operations: [{ type: 'asset', target: 'lamp', value: 'yokai-1.glb' }] }, baseline), /required asset/);
ok('validateAnomaly rejects unknown targets and undeclared assets');

// --- movement ---------------------------------------------------------------------------------
assert.equal(movement.boundaryChoice, undefined);
assert.equal(movement.SPAWN, undefined);
ok('movement deleted boundaryChoice (no automatic doorway decisions)');

const bounds = { minX: -1.2, maxX: 1.2, minZ: -5.7, maxZ: 5.7, speed: 3.2, turnSpeed: 1.8 };
const start = { x: 0, z: 4.5, yaw: 0 };
const walked = movement.movePlayer(start, { forward: 1 }, 1 / 60, bounds);
assert.ok(walked.z < start.z && Math.abs(walked.x) < 1e-12 && walked.yaw === 0);
ok('forward at yaw 0 walks up the coach (-z)');

const turned = movement.movePlayer(start, { turn: 1 }, 1 / 60, bounds);
assert.ok(turned.yaw > 0 && turned.x === 0 && turned.z === 4.5);
assert.ok(movement.movePlayer(start, { turn: 1 }, 1, bounds).yaw < bounds.turnSpeed * 0.06);
ok('turning changes yaw and dt is clamped to one frame');

assert.equal(movement.movePlayer({ x: 0, z: 5.7, yaw: 0 }, { forward: -1 }, 0.5, bounds).z, 5.7);
assert.equal(movement.movePlayer({ x: 1.2, z: 0, yaw: 0 }, { strafe: 1 }, 1, bounds).x, 1.2);
assert.equal(movement.movePlayer({ x: -1.2, z: -5.7, yaw: 0 }, { forward: 1, strafe: -1 }, 1, bounds).x, -1.2);
ok('the walk is clamped to the coach bounds laterally and lengthwise');

assert.deepEqual(movement.movePlayer(start, { forward: 1 }, 0, bounds), start);
assert.deepEqual(movement.movePlayer(start, { forward: 1 }, -1, bounds), start);
assert.throws(() => movement.movePlayer(start, { forward: 1 }, 0.016, { minX: -1 }), /finite /);
ok('a non-positive dt returns a copy and partial bounds throw');

// --- config -----------------------------------------------------------------------------------
for (const missing of [{ goal: 8 }, { goal: 8, stationMarks: [2, 4, 6] }, { goal: 8, stationMarks: [2, 4, 6], minNormals: 0 }]) {
  assert.throws(() => configure({ baseline, catalog: [anomaly], ...missing }), /from tuning/);
}
assert.throws(() => configure({ baseline, catalog: [anomaly], goal: 8, stationMarks: [8], minNormals: 0, maxNormals: 1 }), /stationMarks/);
ok('configure requires the tuning numbers (goal, stationMarks, minNormals, maxNormals)');

const catalog = Array.from({ length: 8 }, (_, i) => ({
  id: `a${i + 1}`, explanation: `Change number ${i + 1}.`,
  operations: [{ type: 'position', target: 'luggage', value: [0, 1 + (i + 1) * 0.1, 0] }],
  requiresAssets: [], requiresCapabilities: [],
}));
const partial = configure({ baseline, catalog: catalog.slice(0, 4), assets: [], capabilities: [], goal: 8, stationMarks: [2, 4, 6], minNormals: 1, maxNormals: 2 });
assert.equal(partial.eligibleIds.length, 4);
assert.match(partial.warnings.join(' '), /cannot reach the home station/);
ok('configure filters the catalog and warns when too few anomalies exist to finish a run');

const CONFIG = configure({ baseline, catalog, assets: [], capabilities: [], goal: 8, stationMarks: [2, 4, 6], minNormals: 1, maxNormals: 2 });
assert.equal(CONFIG.eligibleIds.length, 8);
assert.deepEqual(CONFIG.eligibleIds, ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
assert.equal(CONFIG.warnings.length, 0);

// --- deck -------------------------------------------------------------------------------------
const bag = createBag('seed-1', 0, CONFIG.eligibleIds, CONFIG, null);
const anomalies = bag.entries.filter((entry) => entry.kind === 'anomaly').map((entry) => entry.anomalyId);
assert.equal(anomalies.length, 8);
assert.equal(new Set(anomalies).size, 8);
assert.deepEqual([...anomalies].sort(), [...CONFIG.eligibleIds].sort());
assert.ok(bag.entries.every((entry) => entry.expectedChoice === (entry.anomalyId === null ? 'continue' : 'turn_back')));
ok('a bag holds every anomaly exactly once, interleaved with normal rounds');

assert.deepEqual(createBag('seed-1', 0, CONFIG.eligibleIds, CONFIG, null).entries, bag.entries);
assert.notDeepEqual(createBag('seed-1', 1, CONFIG.eligibleIds, CONFIG, null).entries, bag.entries);
for (const cycle of [0, 1, 2, 3, 4]) {
  const next = createBag('seed-1', cycle, CONFIG.eligibleIds, CONFIG, 'a4');
  assert.notEqual(next.entries.find((entry) => entry.kind === 'anomaly').anomalyId, 'a4');
}
ok('bags are deterministic per seed and cycle, and never open with the previous bag last anomaly');

const bagX = createBag('seed-x', 0, CONFIG.eligibleIds, CONFIG, null);
let cursor = bagX;
const size = bagX.entries.length, drawn = [];
for (let i = 0; i <= size; i += 1) { const next = draw(CONFIG, 'seed-x', cursor); cursor = next.bag; drawn.push(next.anomalyId); }
assert.deepEqual(drawn.slice(0, size), bagX.entries.map((entry) => entry.anomalyId));
assert.deepEqual(drawn.filter((id) => id !== null).slice(0, 8), bagX.entries.filter((entry) => entry.kind === 'anomaly').map((entry) => entry.anomalyId));
assert.equal(cursor.cycle, 1);
assert.equal(cursor.cursor, 1);
ok('draw walks a bag to the end then opens the next cycle');

assert.throws(() => createBag('seed-1', 0, [], CONFIG, null), /at least one/);
assert.throws(() => createBag('seed-1', 0, ['a1', 'a1'], CONFIG, null), /unique/);
assert.throws(() => draw({ eligibleIds: ['a1'] }, 'seed-1', null), /minNormals/);
ok('deck rejects empty or duplicated eligible IDs and a config without a normal-round range');

// --- reducer ----------------------------------------------------------------------------------
const state0 = newSession(CONFIG, 'night-run', 'run-1');
assert.equal(state0.phase, 'inspect');
assert.equal(state0.clears, 0);
assert.equal(state0.active.reference, true);
assert.ok(Object.isFrozen(state0));
ok('newSession starts at inspect with zero clears on the reference coach');

const referenceFeedback = commit(CONFIG, state0, 'continue', state0.active.id);
assert.equal(referenceFeedback.phase, 'feedback');
assert.equal(referenceFeedback.clears, 0);
assert.equal(referenceFeedback.decisions, 0);
assert.equal(referenceFeedback.reshuffle, false);
assert.equal(referenceFeedback.outcome.explanation.length > 0, true);
const afterReference = advance(CONFIG, referenceFeedback);
assert.equal(afterReference.phase, 'inspect');
assert.equal(afterReference.active.reference, false);
assert.equal(afterReference.bag.cycle, 0);
ok('the reference coach is unscored and never penalised');

const repeat = advance(CONFIG, commit(CONFIG, state0, 'turn_back', state0.active.id));
assert.equal(repeat.active.reference, true);
assert.equal(repeat.mistakes, 0);
assert.equal(repeat.clears, 0);
ok('turning back on the reference coach repeats the tutorial with no penalty');

const isInspect = (state) => state.phase === 'inspect' && !state.active.reference;
function step(state) {
  if (state.phase === 'station') return advance(CONFIG, state);
  assert.equal(state.phase, 'inspect');
  const choice = state.active.anomalyId === null ? 'continue' : 'turn_back';
  return advance(CONFIG, commit(CONFIG, state, choice, state.active.id));
}
function walkTo(kind, state) {
  let s = state, guard = 0;
  while (!(isInspect(s) && (s.active.anomalyId === null) === (kind === 'normal')) && guard++ < 200) s = step(s);
  assert.ok(guard < 200, `no ${kind} round found`);
  assert.equal(s.phase, 'inspect');
  return s;
}

const at = walkTo('anomaly', afterReference);
const firstClear = commit(CONFIG, at, 'turn_back', at.active.id);
assert.equal(firstClear.outcome.correct, true);
assert.equal(firstClear.clears, 1);
assert.equal(firstClear.outcome.clearGain, 1);
assert.equal(firstClear.reshuffle, false);
assert.notDeepEqual(sceneFor(CONFIG, at), deriveScene(baseline, null));
ok('turn_back on an anomaly coach increments clears and its scene differs from the baseline');

const normalRound = walkTo('normal', advance(CONFIG, firstClear));
const before = normalRound.clears;
assert.ok(before >= 1);
assert.deepEqual(sceneFor(CONFIG, normalRound), deriveScene(baseline, null));
const kept = commit(CONFIG, normalRound, 'continue', normalRound.active.id);
assert.equal(kept.outcome.correct, true);
assert.equal(kept.clears, before);
assert.equal(kept.outcome.clearGain, 0);
assert.equal(kept.reshuffle, false);
ok('continue on a normal coach preserves clears and adds none');

const wrongNormal = commit(CONFIG, normalRound, 'turn_back', normalRound.active.id);
assert.equal(wrongNormal.outcome.correct, false);
assert.equal(wrongNormal.outcome.expected, 'continue');
assert.equal(wrongNormal.clears, 0);
assert.equal(wrongNormal.clearedIds.length, 0);
assert.equal(wrongNormal.reshuffle, true);
assert.equal(wrongNormal.mistakes, 1);
const bagBefore = normalRound.bag.cycle;
const sentBack = advance(CONFIG, wrongNormal);
assert.equal(sentBack.phase, 'inspect');
assert.equal(sentBack.active.reference, true);
assert.equal(sentBack.clears, 0);
assert.equal(sentBack.reshuffle, false);
assert.equal(sentBack.bag.cycle, bagBefore + 1);
assert.equal(sentBack.bag.cursor, 0);
ok('turn_back on a normal coach zeroes progress, flags a reshuffle and returns to the reference');

const anomalyRound = walkTo('anomaly', advance(CONFIG, commit(CONFIG, sentBack, 'continue', sentBack.active.id)));
const clearsBefore = anomalyRound.clears;
assert.equal(commit(CONFIG, anomalyRound, 'turn_back', anomalyRound.active.id).clears, clearsBefore + 1);
ok('turn_back on an anomaly coach after the reshuffle starts counting again');

const wrongAnomaly = commit(CONFIG, anomalyRound, 'continue', anomalyRound.active.id);
assert.equal(wrongAnomaly.outcome.correct, false);
assert.equal(wrongAnomaly.outcome.expected, 'turn_back');
assert.equal(wrongAnomaly.clears, 0);
assert.equal(wrongAnomaly.reshuffle, true);
ok('continue on an anomaly coach is a wrong call and resets clears');

assert.equal(commit(CONFIG, anomalyRound, 'continue', 'stale-round'), anomalyRound);
assert.equal(commit(CONFIG, anomalyRound, 'sideways', anomalyRound.active.id), anomalyRound);
const paused = setPaused(anomalyRound, true);
assert.equal(commit(CONFIG, paused, 'turn_back', anomalyRound.active.id), paused);
assert.equal(advance(CONFIG, paused), paused);
assert.equal(setPaused(paused, false).paused, false);
ok('a stale roundId, an unknown choice or a pause leaves the state untouched');

// Eight clears: stations at 2/4/6, home at 8, run ends only on a deliberate disembark.
let s = afterReference, stations = [], guard = 0;
while (s.phase !== 'ending' && guard++ < 400) {
  s = step(s);
  assert.equal(new Set(s.clearedIds).size, s.clearedIds.length, 'an anomaly type was cleared twice');
  if (s.phase === 'station') stations.push(s.clears);
}
assert.ok(guard < 400, 'the run never reached the home station');
assert.deepEqual(stations, [2, 4, 6]);
assert.equal(s.phase, 'ending');
assert.equal(s.clears, 8);
assert.equal(s.clearedIds.length, 8);
assert.equal(new Set(s.clearedIds).size, 8);
ok('advance enters station at 2, 4 and 6 clears and ending at 8');

assert.equal(advance(CONFIG, s), s);
assert.equal(commit(CONFIG, s, 'continue', s.active.id), s);
ok('the home station holds until an explicit disembark');

const complete = advance(CONFIG, s, DISEMBARK);
assert.equal(complete.phase, 'complete');
assert.equal(setPaused(complete, true), complete);
const record = replayRecord(complete);
assert.equal(record.seed, complete.seed);
assert.equal(record.clears, complete.clears);
assert.equal(record.decisions.length, complete.history.length);
assert.equal(record.decisions.filter((d) => !d.reference).length, complete.decisions);
ok('disembark completes the run and the replay record lists every decision');

console.log(`\nM1 engine check: ${passed} groups passed, 0 failed.`);
