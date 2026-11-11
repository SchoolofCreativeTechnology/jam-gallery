// Every number you might want to tune lives here. Change one, refresh the page, see what happens.
// Course layouts (paths, cars per course, jack-in-the-boxes, stars, medal times) live in levels.js.

// ---- Camera ----
export const camera = {
  offset: { x: 0, y: 11.5, z: 8.6 }, // where it sits relative to the head (roughly isometric)
  fov: 46,
  follow: 6,          // how quickly it catches up with the head (higher = tighter)
  lookahead: 0.3,     // seconds of the head's velocity the camera leads by
  maxLookahead: 3.0,  // never lead by more than this many units
  speedZoom: 0.12,    // extra pull-back per unit of speed, so fast runs see further
  shakeOnShove: 0.3,  // camera shake when a toy hits
  shakeOnFall: 0.45,  // camera shake when the head goes off the edge
  shakeOnBonk: 0.08,  // camera shake when the head bounces off a rail
  shakeDecay: 3.5,    // how fast shake fades (per second)
};

// ---- The head ----
export const head = {
  radius: 0.65,
  accel: 19,      // how hard the keys push
  drag: 1.9,      // how quickly it slows down. LOWER = slippier, more Marble Madness
  maxSpeed: 11.5,
  edgeGrace: 0.2, // how far past the edge the centre can hang before it tips over
  railBounce: 0.45, // how much speed a rail hands back (0 = dead stop, 1 = perfect bounce)

  // The face, held upright as if suspended in oil inside the glass.
  faceUp: 0.62,      // how far the face tips up toward the camera (radians)
  turn: 0.07,        // how far he looks the way he's sliding, per unit of sideways speed
  maxTurn: 0.6,
  wobble: 0.05,      // how far he leans per unit of speed change
  maxLean: 0.45,
  wobbleSpring: 3.2, // how quickly the lean settles; lower = gloopier oil

  // Feel: speed trail and expressions.
  trailInterval: 0.045,
  trailLife: 0.32,
  trailSize: 0.2,
  trailOpacity: 0.3,
  scaredDuration: 0.9, // seconds the scared face stays on after danger
};

// ---- Toy cars (per-course speed, gap and warning live in levels.js) ----
export const cars = {
  aheadMin: 2.8,   // closest a car lane can open ahead of the head
  aimJitter: [-1.0, 2.2], // how far before/after your arrival point the lane opens (units)
  shove: 0.95,     // how much of the car's speed it hands to the head
  hitRadius: 0.32, // half the car's width, for the hit capsule
  hitLength: 0.36, // half the car's length, minus the rounded ends
  length: 1.2,
  width: 0.62,
};

// ---- Jack-in-the-boxes ----
export const jacks = {
  period: 2.9,     // seconds per full cycle
  telegraph: 0.7,  // seconds of rattling before it springs
  extend: 0.12,    // seconds to spring out
  hold: 0.45,      // seconds it stays out
  retract: 0.55,   // seconds to wind back in
  reach: 0.62,     // how far across the deck it punches, as a fraction of the full width
  power: 8.5,      // how hard it shoves
  gloveRadius: 0.42,
};

// ---- Stars ----
export const stars = {
  bonus: 0.5,  // seconds off your time per star
  radius: 0.5, // pickup reach, added to the head's radius
};

// ---- Jumps (a 'G' segment in levels.js is broken track you have to jump) ----
export const jump = {
  kickLength: 1.6,   // how long the kicker ramp before the gap is
  kickHeight: 0.42,  // how high it curls up at the lip; steeper = more air
  airControl: 0.25,  // how much steering you get in the air (1 = same as on the deck)
  landingGrace: 0.45, // how far below the far deck's surface you can arrive and still scrape on
};

// ---- Touch and tilt ----
export const touch = {
  tiltFull: 16,      // degrees of tilt for a full push
  tiltDeadzone: 2.5, // degrees of tilt that do nothing, so a steady hand holds still
  tiltSmoothing: 0.35, // 0..1, how much each tilt reading moves the input (lower = smoother)
};

// ---- Goal ----
export const goal = {
  radius: 1.4, // how close to his box counts as home
};

// ---- Rules ----
export const rules = {
  restartDelay: 0.35,   // seconds before a restart key works, so a death registers first
  deathPanelDelay: 0.95, // seconds of watching him fall (and land) before the panel shows
  winPanelDelay: 1.15,  // seconds of celebration before the panel shows
  gravity: 34,          // how hard the void pulls once the head is off the deck
  slopeGravity: 30,     // how hard gravity pulls along a slope
  hitStop: 0.06,        // seconds the world freezes on a hit, so it lands
};
