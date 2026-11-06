// The anomaly catalog: every changed coach the deck can draw.
// Each entry is baseline-derived: one operation per change, nothing invented at runtime.
import { DOOM, PASSENGER_MODELS, PASSENGER_Y, PASSENGERS, YOKAI } from './tuning.js';
import { NEW_ANOMALIES } from './new-anomalies.js';

const seat = (id) => PASSENGERS.find((passenger) => passenger.id === id);

// The yokai below are aimed at fixed passengers, so which seat wears which anomaly is decided here, once.
// The three swaps own the first three seats and `all-yokai` owns all four, so no two of them ever land on
// the same passenger with different intentions.
const FOX_SEAT = seat('passenger');
const RABBIT_SEAT = seat('passenger-2');
const GOAT_SEAT = seat('passenger-3');
const MOUSE_SEAT = seat('passenger-4');
const GONE_SEAT = seat('passenger-4');

// One yokai swap, written once: the passenger keeps its seat and its facing and only the model changes,
// which is what makes it read as that same passenger burst open rather than as a new animal arriving.
const yokaiSwap = (id, species, seatEntry, at, explanation) => ({
  id,
  category: 'yokai',
  explanation,
  operations: [
    { type: 'asset', target: seatEntry.id, value: PASSENGER_MODELS[species].anomaly },
    { type: 'position', target: seatEntry.id, value: [at.x, PASSENGER_Y, at.z] },
    { type: 'scale', target: seatEntry.id, value: Array(3).fill(at.scale) },
  ],
  requiresAssets: [PASSENGER_MODELS[species].anomaly],
  requiresCapabilities: [],
});

// --- The coach a failed ride ends in ----------------------------------------------------------------
// This is NOT a puzzle and the deck can never draw it: it asks for a capability the game does not declare
// (`doom`), so `configure` leaves it out of the eligible list. It is written as a catalog entry anyway so
// that the machinery which builds every other coach builds this one too — `sceneFor` finds it by id like
// anything else, and main.js is handed the tableau without knowing how it was made.
// Every passenger has burst open and the four of them are standing in the aisle, facing the player, in a
// line that leaves no way through. They reuse the four seats rather than new nodes, so there is nothing
// extra to load and the yokai you failed to notice are literally the ones standing in front of you.
const DOOM_SEAT = new Map(PASSENGERS.map((passenger) => [passenger.species, passenger]));
export const DOOM_ENTRY = {
  id: 'doom',
  category: 'yokai',
  explanation: 'They have been waiting for you.',
  operations: DOOM.line.flatMap((spot) => {
    const passenger = DOOM_SEAT.get(spot.species);
    return [
      { type: 'asset', target: passenger.id, value: PASSENGER_MODELS[spot.species].anomaly },
      { type: 'position', target: passenger.id, value: [spot.x, PASSENGER_Y, spot.z] },
      // Every seat normally faces its own bench. In the aisle line every one of them faces the player.
      { type: 'rotation', target: passenger.id, value: [0, 0, 0] },
      { type: 'scale', target: passenger.id, value: Array(3).fill(spot.scale) },
    ];
  }),
  requiresAssets: DOOM.line.map((spot) => PASSENGER_MODELS[spot.species].anomaly),
  requiresCapabilities: ['doom'],
};

export const CATALOG = [
  {
    id: 'missing-bench',
    category: 'environmental',
    explanation: 'The benches are missing.',
    operations: [
      { type: 'visible', target: 'bench-left', value: false },
      { type: 'visible', target: 'bench-right', value: false },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
  {
    id: 'lamp-red',
    category: 'environmental',
    explanation: 'The corner lamps burn red.',
    operations: [
      { type: 'color', target: 'lamp-fl', value: '#c02020' },
      { type: 'color', target: 'lamp-fr', value: '#c02020' },
      { type: 'color', target: 'lamp-rl', value: '#c02020' },
      { type: 'color', target: 'lamp-rr', value: '#c02020' },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
  // --- The two yokai that are real models ----------------------------------------------------------
  // Each one keeps its passenger on the same spot and only swaps the model, so the change reads as that
  // same passenger burst open. The fit numbers (why the fox sits 5 cm in from its seat, why the rabbit
  // stays put) live next to YOKAI in tuning.js.
  yokaiSwap('fox-yokai', 'fox', FOX_SEAT, YOKAI.fox, 'The fox passenger is no longer a fox.'),
  yokaiSwap('rabbit-yokai', 'rabbit', RABBIT_SEAT, YOKAI.rabbit, 'The rabbit passenger is no longer a rabbit.'),
  yokaiSwap('goat-yokai', 'goat', GOAT_SEAT, YOKAI.goat, 'The goat passenger is no longer a goat.'),
  yokaiSwap('mouse-yokai', 'mouse', MOUSE_SEAT, YOKAI.mouse, 'The mouse passenger is no longer a mouse.'),
  {
    // The fourth yokai, and the only one nobody can miss: every passenger in the coach has gone. Same
    // seats, same sizes — only the animal in each one is wrong.
    id: 'all-yokai',
    category: 'yokai',
    explanation: 'Every passenger in the coach has changed.',
    operations: PASSENGERS.map((passenger) => ({
      type: 'asset',
      target: passenger.id,
      value: PASSENGER_MODELS[passenger.species].anomaly,
    })),
    requiresAssets: PASSENGERS.map((passenger) => PASSENGER_MODELS[passenger.species].anomaly),
    requiresCapabilities: [],
  },
  {
    id: 'floating-luggage',
    category: 'environmental',
    explanation: 'The suitcase floats.',
    operations: [
      // Off the rack and into the aisle at eye height: the baseline case sits high on the right-hand rack.
      { type: 'position', target: 'luggage', value: [0, 1.55, 4.2] },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
  {
    id: 'upward-handles',
    category: 'environmental',
    explanation: 'The hanging handles have swung up.',
    operations: [
      // Every strap folds up from its ceiling mount, so the brass bars end near the ceiling.
      { type: 'rotation', target: 'handle-1', value: [1.4, 0, 0] },
      { type: 'rotation', target: 'handle-2', value: [1.4, 0, 0] },
      { type: 'rotation', target: 'handle-3', value: [1.4, 0, 0] },
      { type: 'rotation', target: 'handle-4', value: [1.4, 0, 0] },
      { type: 'rotation', target: 'handle-5', value: [1.4, 0, 0] },
      { type: 'rotation', target: 'handle-6', value: [1.4, 0, 0] },
      { type: 'rotation', target: 'handle-7', value: [1.4, 0, 0] },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
  // --- The one yokai that is not a model swap ---------------------------------------------------------
  // A whole passenger missing from a seat you walk past. It is the last seat, the one nearest the far
  // door, so the gap is behind you as you reach the choice. Two other non-model yokai used to sit here —
  // a passenger turned to face its bench, and one swelled 1.28x. Both were dropped on purpose: from the
  // far end of a 12 m coach they read as nothing at all, and a change a player cannot see is not a
  // puzzle, it is a coin flip. Everything left in this catalog is visible from the door.
  {
    id: 'passenger-gone',
    category: 'yokai',
    explanation: 'The passenger is gone.',
    operations: [
      { type: 'visible', target: GONE_SEAT.id, value: false },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
  // --- The four environmental changes ---------------------------------------------------------------
  // Footprints on the floor, a shoji door, a shattered window, and a lamp that flickers. props.js owns
  // both the shapes and the flicker's clock; each one is a single `visible` operation here.
  ...NEW_ANOMALIES,
  // Last, and unreachable by the deck: the coach a run ends in after ten wrong turns.
  DOOM_ENTRY,
];
