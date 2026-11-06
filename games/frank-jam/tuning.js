// Tuning knobs for the one-button stacker. Change numbers here to change the feel.

export const WORLD = {
  // Camera framing
  cameraHeight: 12,
  cameraDistance: 14,
  cameraFov: 50,

  // Construction site palette
  skyTop: '#7d8795',
  skyBottom: '#aab2bd',
  fogColor: '#7d8795',
  cloudColor: '#e0e4e8',
  ufoColor: '#ffffff',
  craneColor: '#e67e22',
  containerColor: '#c25e47',
  containerEdgeColor: '#9e4636',
  platformColor: '#6b6b6b',
  fenceColor: '#d4a017',
  groundColor: '#7a756b',
};

export const SKY = {
  // Skyline photo used as the dusk background
  image: 'assets/marble-platform-front-city-skyline.jpg',

  // Dusk tint multiplied over the photo, so it matches the site palette
  tintTop: '#5f6b86',    // cool evening blue at the top of the frame
  tintBottom: '#c98b5e', // warm sunset haze near the horizon
  tintStrength: 0.0,     // 0 = photo untouched, 1 = full tint
  canvasWidth: 1280,     // background canvas resolution the tint is drawn at
};

export const BUILDINGS = {
  // Abandoned blocks scattered outside the safety fence
  count: 26,
  color: '#33364a',
  minRadius: 8,          // distance from the platform center
  maxRadius: 28,
  keepOut: 5.6,          // no block may reach inside this square around the platform
  frontClear: 9,         // keeps the aisle the camera looks in through free of blocks
  minWidth: 2,           // footprint, width and depth
  maxWidth: 5,
  minHeight: 3,
  maxHeight: 12,
  groundY: -0.55,        // the construction-site ground surface
};

export const DEBUG = {
  // ?fps panel
  fpsInterval: 0.25,     // seconds between readout updates
};

export const GAME = {
  // How tall the tower must get before touching the UFO (in world units)
  ufoHeight: 10,

  // Container size (width/depth; height is usually the same)
  containerSize: 1,

  // Maximum cargo boxes in one run. Run out before reaching the target line = lose.
  maxCargo: 10,

  // Tower balance: lean changes based on how far each new block lands from the previous one.
  // A block to the left of the previous one tilts left; to the right tilts right.
  tiltFactor: 0.4,  // how much a relative offset changes the lean
  leanLimit: 0.7,   // visual lean at which the tower collapses

  // Score
  scorePerSnap: 100,
  scorePerHeight: 10,
};

export const DROP = {
  // Falling speed (units per second)
  fallSpeedStart: 2,
  fallSpeedGrowth: 0.15,

  // How far left/right the container can move (also the spawn drift limit)
  spawnDriftMax: 2.5,

  // Height above the tower top where a new container spawns
  spawnHeight: 4,

  // Horizontal movement speed while falling (units per second)
  moveSpeed: 3.5,

  // How close to the tower center counts as a clean snap
  snapTolerance: 0.12,
};

export const INPUT = {
  // Keys that start or restart the game
  startKeys: [' ', 'Spacebar', 'Enter'],

  // Keys that move the falling container left
  leftKeys: ['a', 'A', 'ArrowLeft', 'Home'],

  // Keys that move the falling container right
  rightKeys: ['d', 'D', 'ArrowRight', 'End'],
};
