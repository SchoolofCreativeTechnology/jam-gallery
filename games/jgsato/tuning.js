// Every number you might want to tune lives here. Change one, refresh the page, see what happens.

// ---- Camera ----
export const camera = {
  offset: { x: 0, y: 18, z: 14 }, // where it sits relative to the head (this angle is roughly isometric)
  fov: 50,
  follow: 1, // 1 = locked to the head, 0 = fixed in place
  shakeOnShove: 0.35, // camera shake intensity when a car hits
  shakeOnFall: 0.6,   // camera shake intensity when the head goes off the edge
  shakeDecay: 4.0,    // how fast shake fades (per second)
};

// ---- The path ----
// A guided route from the start to his box. Each point carries a half-width:
// the path reaches that far out from the centre line. Wide in places, tight in
// others, on purpose — that's the rhythm you chose.
export const path = {
  // Each point is a horizontal centre-line position plus an elevation (y).
  // Positive y is up; small hills and valleys make the head speed up and slow down.
  points: [
    { x: 0, z: 8, y: 0, halfWidth: 4.0 }, // start, wide, room to get going
    { x: 3, z: 3, y: 0, halfWidth: 3.0 }, // gentle right, flat
    { x: 5, z: -2, y: 1.0, halfWidth: 2.5 }, // keep curving right, rise
    { x: 2, z: -7, y: 1.0, halfWidth: 2.0 }, // cut back left, flat
    { x: -3, z: -11, y: -0.3, halfWidth: 1.6 }, // left again, descent
    { x: -1, z: -17, y: -0.3, halfWidth: 1.4 }, // slight right, flat valley
    { x: 3, z: -22, y: 0.7, halfWidth: 1.5 }, // right, climb
    { x: 4, z: -28, y: 0.7, halfWidth: 2.0 }, // keep right, flat
    { x: 0, z: -33, y: 0.1, halfWidth: 2.5 }, // left into the box, gentle descent
    { x: -2, z: -40, y: 0, halfWidth: 4.0 }, // his box sits here
  ],
  thickness: 0.6, // how thick the slab is
};

// ---- The head ----
export const head = {
  radius: 0.6,
  accel: 18, // how hard the keys push
  drag: 2.2, // how quickly it slows down. LOWER = slippier, more Marble Madness
  maxSpeed: 11,

  // The face, held upright as if it were suspended in oil inside the head.
  faceTilt: Math.PI / 3.2, // tilt the face up toward the camera (~56°)
  faceWidth: 0.75, // face width as a fraction of the head radius
  faceHeight: 0.65, // face height as a fraction of the head radius
  faceWobble: 0.35, // how far it leans back when you accelerate
  faceDamping: 2.5, // how slowly that lean settles

  // Feel: speed trail and scared face.
  trailInterval: 0.05, // seconds between trail droplets
  trailLife: 0.3,      // seconds a droplet lasts
  trailSize: 0.22,     // droplet size
  trailColor: '#ffffff',
  trailOpacity: 0.35,
  scaredDuration: 0.9, // seconds the scared face stays on after danger
};

// ---- Cars (the toys) ----
export const cars = {
  speed: 6, // how fast they drive across the path
  spawnGap: 1.8, // seconds between spawns
  difficultyRamp: 0.02, // per-second multiplier growth (1 + runTime * this)
  maxDifficulty: 2.0,   // cap so it doesn't become impossible
  minSpawnGap: 0.7,     // fastest spawn interval
  shoveForce: 5, // how hard they push the head
  radius: 0.4, // car collision radius
  length: 1.2, // visual length
  width: 0.6, // visual width
  colour: '#e74c3c', // flat red for gray box
  lookaheadMin: 3.5, // closest a car can spawn ahead of the ball
  lookaheadMax: 4.5, // farthest a car can spawn ahead of the ball
  warningTime: 0.25, // short blink before the car enters
  warningColor: '#f1c40f', // bright yellow marker
};

// ---- Goal ----
export const goal = {
  radius: 1.2, // trigger radius around the box
};

// ---- Rules ----
export const rules = {
  restartDelay: 0.4, // seconds before R will restart, so a death registers first
  fallTo: -25, // the head is gone once it drops below this
  gravity: 40, // how hard the void pulls once the head is off the path
  slopeGravity: 40, // how hard gravity pulls along a slope
};
