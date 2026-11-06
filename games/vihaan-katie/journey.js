// The run: wires the ported engine to the coach — reference round, door decisions, progress, restart.
import { configure, newSession, sceneFor, commit, advance, CHOICES, DISEMBARK } from './engine/game.js';
import { createBag } from './engine/deck.js';
import { freeze } from './engine/random.js';
import { BASELINE, MODEL_PATHS, getDoorPositions } from './coach.js';
import { CATALOG, DOOM_ENTRY } from './events.js';
import {
  DOOR_PROMPT_RADIUS, DOOR_ZONE, FEEDBACK_MS, GOAL, MAX_MISTAKES, MAX_NORMALS, MIN_NORMALS, RESET_FEEDBACK_MS, RUN_MIX, SEED, STATION_MARKS, STATION_MS,
} from './tuning.js';

const RUN_ID = 'last-train-home';

export const config = configure({
  baseline: BASELINE,
  catalog: CATALOG,
  // Declares the model files this build ships, so an anomaly that needs one is only eligible when it is here.
  assets: MODEL_PATHS,
  goal: GOAL,
  stationMarks: STATION_MARKS,
  minNormals: MIN_NORMALS,
  maxNormals: MAX_NORMALS,
  // Two yokai and two changed coaches, every ride, whichever four the shuffle picks.
  mix: RUN_MIX,
  // Ten wrong turns and the ride is over: the train keeps you. `doom` is the coach that ends it, and the
  // engine refuses to start if that coach could ever be dealt as a puzzle (events.js keeps it out of the
  // deck by requiring a capability nothing declares).
  maxMistakes: MAX_MISTAKES,
  failureAnomalyId: DOOM_ENTRY.id,
});

export let state = null;

let pendingMs = 0;

// --- A test hook, not part of the game ------------------------------------------------------------
// ?force=<anomaly-id> makes the coach after the reference one BE that anomaly, with nothing in front of
// it. One walk forward then shows the change on its own, which is how each of them can be checked by
// hand without waiting for the deck to draw it. `?force=list` prints what the ids are.
const forcedId = new URLSearchParams(location.search).get('force');
if (forcedId === 'list') console.log(`anomalies: ${config.catalog.map((entry) => entry.id).join(', ')}`);
const FORCED = config.catalog.some((entry) => entry.id === forcedId) ? forcedId : null;
if (forcedId && !FORCED && forcedId !== 'list') console.warn(`?force=${forcedId} is not an anomaly. Use ?force=list to see them.`);

// The seed a ride is dealt from. It is NOT a constant: the four coaches you have to catch should be a
// different four every time you board, or the second ride is the first ride with the answers known.
// ?seed=<anything> pins it, so a ride that went wrong can be replayed exactly.
const pinnedSeed = new URLSearchParams(location.search).get('seed');
let rideNumber = 0;
const nextSeed = () => pinnedSeed || `${SEED}:${(rideNumber += 1)}:${Date.now().toString(36)}`;

// Starts a fresh journey. The reference coach is the first coach you play; the deck for the coaches
// after it is built here (cursor 0), so the whole run is decided the moment the run starts.
export function startRun() {
  const seed = nextSeed();
  const session = newSession(config, seed, RUN_ID);
  let bag = config.eligibleIds.length ? createBag(seed, 0, config.eligibleIds, config, null) : null;
  if (bag && FORCED) {
    // The forced anomaly takes the first slot, and the normal coaches that would have come before it are
    // dropped, so it is the very next coach. The rest of the deck is left exactly as the seed made it.
    bag = { ...bag, entries: [{ kind: 'anomaly', anomalyId: FORCED, expectedChoice: 'turn_back' }, ...bag.entries.filter((e) => e.anomalyId !== FORCED)] };
  }
  pendingMs = 0;
  state = freeze({ ...session, bag });
  return state;
}

export function currentScene() {
  return sceneFor(config, state);
}

// Close enough to a door to interact. The coach is narrow, so distance along it decides: anywhere on an
// end wall counts, and the two zones are 12 m apart so they can never both be true.
export function getPromptInfo(player) {
  const { front, rear } = getDoorPositions();
  const withinReach = (door) => Math.abs(player.z - door.z) <= DOOR_PROMPT_RADIUS;
  return { front: withinReach(front), rear: withinReach(rear) };
}

// The doors are physical, so the walk itself is the decision: step into the doorway at the front of the
// coach to go on, or turn around and step into the one behind to turn back. Stand in the middle and
// nothing is committed, so the player can still cross the coach freely before choosing.
export function doorCrossed(player) {
  const { front, rear } = getDoorPositions();
  if (state.phase === 'ending') {
    return player.z <= front.z + DOOR_ZONE || player.z >= rear.z - DOOR_ZONE ? 'continue' : null;
  }
  if (state.phase !== 'inspect') return null;
  if (player.z <= front.z + DOOR_ZONE) return 'continue';
  if (player.z >= rear.z - DOOR_ZONE) return 'turn_back';
  return null;
}

// Crosses the front door to continue, or the rear one to turn back. At the home station either door disembarks.
export function decide(choice) {
  if (state.phase === 'ending') {
    state = advance(config, state, DISEMBARK);
    return state;
  }
  if (!CHOICES.includes(choice) || state.phase !== 'inspect') return state;
  const committed = commit(config, state, choice, state.active.id);
  if (committed === state) return state;
  state = committed;
  // A wrong call is read before it is acted on, so it holds the coach a little longer.
  pendingMs = state.outcome.correct ? FEEDBACK_MS : RESET_FEEDBACK_MS;
  return state;
}

// Counts down the feedback hold, lets a station announce itself, then moves the train on.
export function tick(dt) {
  // There is nothing to move on to at home, and nothing left to move on to once the ride has ended.
  if (state.phase === 'ending' || state.phase === 'complete' || state.phase === 'gameover') return state;
  if (state.phase === 'station' && pendingMs <= 0) pendingMs = STATION_MS;
  if (pendingMs <= 0) return state;
  pendingMs -= dt * 1000;
  if (pendingMs <= 0) {
    pendingMs = 0;
    state = advance(config, state);
  }
  return state;
}
