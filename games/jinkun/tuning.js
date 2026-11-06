// Every number the game is tuned with, in one place: speeds, limits, sizes and the few flat colours.

// Flight
export const FORWARD_SPEED = 30;        // metres per second the world scrolls past: the ship's airspeed.
export const STEER_SPEED = 16;          // metres per second of sideways movement at full left/right.
export const STEER_LIMIT = 18;          // how far left or right of the centre line the ship may fly.
export const CLIMB_SPEED = 10;          // metres per second of altitude change at full up/down.
export const ALTITUDE_LOW = 2.5;        // lowest altitude: skimming the ground, the fast scan in M2.
export const ALTITUDE_HIGH = 14;        // highest altitude: clear of every rock, the slow scan.
export const START_ALTITUDE = 6;        // altitude above the ground the ship starts each run at.
export const ALTITUDE_FOLLOW = 16;      // how quickly the ship settles onto the ground's height (higher is stiffer).
                                        // ALPINE's ridges are around 0.74 steep, and the ship lags the ground by
                                        // about forward speed / ALTITUDE_FOLLOW times that slope: 16 holds the lag
                                        // under 1 m on every world, so a low pass over the hills stays flyable.
export const MAX_DELTA = 0.05;          // longest frame the game simulates, so a hitch cannot skip a rock.

// Ship
export const SHIP_WIDTH = 3.2;          // wingspan, left tip to right tip.
export const SHIP_HEIGHT = 0.9;         // how tall the hull is.
export const SHIP_LENGTH = 3.6;         // nose to tail.
export const SHIP_BANK = 0.5;           // radians the ship rolls into a full left/right steer.
export const SHIP_PITCH = 0.25;         // radians the nose lifts or drops at full climb/dive.
export const SHIP_TILT_SPEED = 8;       // how quickly the nose and wings move to that bank and pitch.

// The engine flame. It is a readout as much as a decoration: FLAME_LENGTH at a level cruise, stretched by
// FLAME_BURN when the ship climbs and shortened when it dives, so what the exhaust is doing is what the engine is
// doing. FLAME_FLICKER and FLAME_RATE are the wobble that keeps it from reading as a cone glued to the tail.
export const FLAME_LENGTH = 1.5;        // metres the flame reaches back from the engine nozzles at a level cruise.
export const FLAME_BURN = 0.35;         // how much a full climb stretches it, and a full dive shortens it, as a
                                        // fraction of FLAME_LENGTH: 0 would make the flame one fixed length.
export const FLAME_WIDTH = 0.9;         // the flame's width at the nozzle, as a fraction of the engine bell radius.
export const FLAME_CORE = 0.45;         // the hot white core inside it, as a fraction of the flame's own width.
export const FLAME_FLICKER = 0.13;      // how much its length wobbles, as a fraction.
export const FLAME_RATE = 26;           // how fast that wobble runs, in radians per second.

// Camera
export const CAMERA_BACK = 15;          // how far behind the ship the chase camera sits.
export const CAMERA_HEIGHT = 5;         // how far above the ship the camera sits.
export const CAMERA_LOOK_AHEAD = 26;    // how far in front of the ship the camera aims.
export const CAMERA_FOLLOW = 7;         // how quickly the camera catches up to the ship (higher is stiffer).

// Ground
export const GROUND_WIDTH = 400;        // how wide the rolling ground is, side to side.
export const GROUND_TILE_LENGTH = 300;  // length of one ground tile; the tiles repeat forever.
export const GROUND_TILES = 3;          // how many ground tiles exist at once.
export const GROUND_SEGMENTS_X = 40;    // ground mesh detail across.
export const GROUND_SEGMENTS_Z = 30;    // ground mesh detail along one tile.
export const TERRAIN_AMPLITUDE = 3.5;   // how tall the rolling ground is, peak to trough about twice this.
export const TERRAIN_X_FREQUENCY = 0.12;// how often the ground repeats sideways.
export const TERRAIN_FLAT_TOP_GAIN = 3; // how hard the flatTops setting squashes a wave: higher = flatter mesa tops.
export const TERRAIN_OCTAVE_DECAY = 0.55;  // each octave of the jagged part is this fraction of the one before:
                                           // higher = more of the height lives in the fine fracture.
export const TERRAIN_STEEP_PERCENTILE = 0.9; // the steep colour is read against this tile's 90th-percentile face,
                                             // so `steepBand` means the same thing on every world's shape.
export const GROUND_DETAIL_REPEAT_X = 40;  // times the painted detail texture tiles across the ground's width.
export const GROUND_DETAIL_REPEAT_Z = 30;  // times it tiles along one ground tile; a whole number, so tiles join.
export const GROUND_TEXTURE_SIZE = 256;    // pixels a side of the generated detail texture.
export const GROUND_DETAIL_STRENGTH = 0.4; // how far the painted detail bites into the surface colour (0 to 1).
export const GROUND_RELIEF_STRENGTH = 2.5; // how hard one step of brightness in the detail painting tilts the
                                           // ground's normal map: higher makes its cracks and ripples deeper.
export const GROUND_NORMAL_SCALE = 0.8;    // how strongly that relief reads on the lit ground (the material's
                                           // normalScale): 0 is dead flat colour, 1 is full strength.
export const GROUND_ROUGHNESS_GLOSS = 0.7; // roughness of the brightest grain in the detail painting: lower sends
                                           // a sharper glint along the ice and the sand.
export const GROUND_ROUGHNESS_DULL = 1;    // roughness of its darkest marks, its cracks and its shadows: 1 = matte.

// The cave roof. A world that carries `cave: true` in planets.js (ICE, whose reference shows a cave) gets a roof
// over it: the ground's own shape raised by CAVE_CEILING and drawn from underneath, so the roof rolls with the
// hills exactly as the floor does and the headroom over the ship is the same everywhere in the world. CAVE_FLY_CEILING
// is the separate number — how high the ship itself may climb inside that cave. It must stay below CAVE_CEILING by
// more than the camera's own CAMERA_HEIGHT, or the chase camera would end up above the roof looking down through it.
export const CAVE_CEILING = 20;         // metres between the ground and a cave world's roof.
export const CAVE_FLY_CEILING = 12;     // metres: the highest the ship may climb inside that cave.
export const CAVE_ROUGHNESS = 0.28;     // how glossy the roof is: low, because a cave roof is wet ice.
export const CAVE_COLOR = '#9ed6ea';    // the roof's own colour, before the world's light falls on it.

// The ground on the title screen, before a world is launched: the plain rolling ground, no vertex colours and no
// detail texture. Each world in planets.js carries a `terrain` object with these same field names; terrain.js is
// where they are read. amplitude is metres; zFrequency is whole wave cycles per ground tile, and must stay a whole
// number or the tiles will not join; xFrequency and xDepth bend the shape sideways, which is free. Each `shade`
// band is a [start, end] pair of fractions: lowBand and highBand are read against the tile's own lowest and
// highest ground, and steepBand against its own steep faces (see TERRAIN_STEEP_PERCENTILE), so one number means
// the same thing on all four worlds.
export const TERRAIN_DEFAULT = {
  amplitude: TERRAIN_AMPLITUDE,   // how tall the ground is, peak to trough about twice this
  zFrequency: 2,                  // whole wave cycles per ground tile
  xFrequency: TERRAIN_X_FREQUENCY,// how often the shape varies sideways, per metre of x
  xDepth: 0.25,                   // how far it varies: 0 = the same across the strip, 1 = the sides go flat
  rollMix: 1,                     // 1 = rolling hills only, 0 = jagged ridges only
  skew: 0,                        // how lopsided the rolling part is: a dune leans, a hill does not
  octaves: 1,                     // harmonics in the jagged part: more = finer fracture
  ridgeSharpness: 1,              // exponent on each jagged octave: higher = sharper crests
  fracture: 1.2,                  // radians each jagged octave is offset from the last: 0 = all crests stacked
  flatTops: 0,                    // 0 = rounded, 1 = flat-topped mesas with steeper flanks
  segmentsX: GROUND_SEGMENTS_X,   // ground mesh detail across one tile
  segmentsZ: GROUND_SEGMENTS_Z,   // and along it
  shade: null,                    // null = no height-and-slope vertex colours: the flat GROUND_COLOR below
  texture: null                   // null = no painted detail texture
};

// Rocks
export const ROCK_ROWS = 12;            // how many rows the rock field holds before the pattern repeats.
export const ROCK_ROW_PATTERN = 4;      // rows in one repeating block: two dodge rows, a gate row, then a ridge row.
export const ROCK_SPACING = 34;         // gap along the track between rock rows. This is the number that sets how
                                        // much time there is between one row and the next, so shortening it makes
                                        // the field harder to fly rather than merely fuller of rock. How MANY rocks
                                        // a row holds is LANE_COMPANION, GATE_COMPANION and RIDGE_ROCKS below.
export const ROCK_TIGHT_GAP = 0.55;     // the closest rows sit this fraction of a spacing apart.
export const LANE_OFFSETS = [2, -2, 5, -5, 11, -11]; // where each dodge row's FIRST rock sits, in turn: sides alternate and step outward, so no one lane is always safe.
export const LANE_COMPANION = 5;        // how much further out a dodge row's second rock sits, on the SAME side.
                                        // A dodge row is a pair on one side rather than a single rock: the swing
                                        // past it is the same, but it is a mass of rock rather than one lump. Same
                                        // side, never the opposite one — that is what keeps the far side of the
                                        // corridor wide open, so no pair can close into a wall the ship cannot
                                        // thread. Raise this for a bigger mass; it can never block the far side.
export const GATE_SPREAD = 17;          // how far out a gate row's outer rocks sit: stops edge-hugging, with a way through the middle.
export const GATE_JITTER = 2;           // how much further out a gate rock may sit, so gate rows are not all identical.
export const GATE_COMPANION = 5;        // how much nearer in a gate row's second rock sits, on the same side: the
                                        // inboard pair that turns two lone rocks into a wall each side.
export const RIDGE_ROCKS = 13;          // how many rocks make up one ridge: enough that a ridge is a wall of rock.
export const RIDGE_HALF = 24;           // half the width a ridge covers: wider than the ship can steer around, so it has to be flown over.
export const ROCK_WIDTH = 4;            // rock width.
export const ROCK_HEIGHT = 4.5;         // rock height above the ground.
export const ROCK_LENGTH = 5;           // rock length along the track.

// Obstacle size variety. ROCK_WIDTH/HEIGHT/LENGTH above now only dress the plain field shown before a world is
// launched; the rocks a world puts in front of the player are each fitted into a box of their own inside this
// envelope (see obstacles.js), so the obstacles read as different sizes instead of all filling one box.
// ROCK_HEIGHT_MAX is how tall the tallest obstacle in the field may stand, and it is deliberately far taller than
// the ship and far above a low pass: a tower you fly past or between, not a thing you hop over. The variety comes
// from everything BELOW it. A short shape is low enough to skim over at ALTITUDE_LOW, so altitude decides whether
// you can fly over an obstacle as well as how fast the scanner fills, and a ridge row with a low stretch in it is
// a decision rather than a wall. Raise ROCK_HEIGHT_MAX and the whole field grows with it, since every shape's
// fitted height is a fraction of the range below; lower it and the field flattens toward one uniform height.
// This is the first number to reach for if the field ever reads as too short or too flat again.
export const ROCK_HEIGHT_MAX = 9;       // tallest an obstacle may stand above its own ground, instance scale included.

export const ROCK_HEIGHT_MIN = 0.7;     // shortest a fitted shape may be: low enough to fly straight over.
export const ROCK_WIDTH_MIN = 1.4;      // narrowest cross-section a shape may be fitted to, side to side.
export const ROCK_WIDTH_MAX = 6;        // widest, side to side: a low slab may be much broader than the old box.
export const ROCK_LENGTH_MIN = 1.6;     // shallowest a shape may be fitted to, along the track.
export const ROCK_LENGTH_MAX = 7.5;     // deepest, along the track.
export const ROCK_SCALE_MIN = 0.85;     // smallest per-instance uniform scale, for jitter between neighbours.
export const ROCK_SCALE_MAX = 1.15;     // largest; uniform, never per-axis, or instance normals would skew.

// Scan: the altitude trade that is the whole game. Low fills fast, high fills slowly, and the rate is
// linear between ALTITUDE_LOW and ALTITUDE_HIGH, so only these two ends need tuning.
export const SCAN_SECONDS_LOW = 60;      // seconds to fill the scan while skimming at ALTITUDE_LOW.
export const SCAN_SECONDS_HIGH = 150;    // seconds to fill the scan at ALTITUDE_HIGH: the slow, safe end.
export const RUN_SECONDS = 120;          // how long one run may last. Deliberately set BETWEEN those two scan
                                         // times: a low pass lands its survey inside the window with room to spare,
                                         // and a high, safe pass does not. So this clock is what makes flying high
                                         // cost you the survey, rather than only delay it. Every world gets the same
                                         // two minutes; raise it and the safe high pass starts to become viable again.

// Hull: a rock costs hit points instead of ending the run on the spot. A rock passes through the ship's
// box over several frames, so a short window of invulnerability is what stops one rock draining the hull.
export const HULL_MAX = 4;               // hit points the hull starts a run with.
export const COLLISION_DAMAGE = 1;       // hit points one rock costs.
export const HIT_INVULNERABLE = 1.2;     // seconds after a hit when rocks pass through without damage.

// HUD: the altitude bands that colour the readouts, and how hard the red flash on a hit is.
export const HUD_FAST_ALTITUDE = 5;      // at or below this altitude the HUD shows the fast-scan colour.
export const HUD_SLOW_ALTITUDE = 11;     // at or above this altitude it shows the slow-scan colour.
export const HUD_COLOR_FAST = '#ffd479'; // the HUD colour for the fast (low) band.
export const HUD_COLOR_MID = '#f2f5f9';  // the HUD colour between the two bands.
export const HUD_COLOR_SLOW = '#8fa2b8'; // the HUD colour for the slow (high) band.
export const HUD_COLOR_URGENT = '#ff6b57'; // the run clock's colour in its last seconds.
export const HUD_URGENT_SECONDS = 20;    // the clock turns urgent at this many seconds left.
export const HIT_FLASH_OPACITY = 0.45;   // how strong the red flash on a hit starts out (0 to 1).
export const HIT_FLASH_DECAY = 6;        // how fast the flash fades, per second (higher is quicker).

// Sky, fog and the flat colours before a world is launched; launching repaints all three from planets.js.
export const FOG_NEAR = 45;             // distance where the ground starts to fade into the sky.
export const FOG_FAR = 190;             // distance where the ground has faded out completely.
export const SKY_COLOR = '#22304a';     // the sky and the fog colour until a world is chosen.
export const GROUND_COLOR = '#5c6b4a';  // the ground mesh until a world is chosen.
export const ROCK_COLOR = '#8a6a52';    // the rock mesh until a world is chosen.
export const SHIP_COLOR = '#dce3ec';
export const SHIP_NOSE_COLOR = '#8fa2b8';

// Lighting. The shared fallback rig, used on the title screen and for any world that carries no `light` block of
// its own. Each world in planets.js has a `light` object with these same seven field names; lighting.js reads
// them. `key` is the directional sun's colour, `keyIntensity` its strength, `bearing` and `elevation` its
// direction in degrees (bearing: negative is left of straight ahead, the camera looking down -z; elevation:
// degrees above the horizon). `sky` and `ground` are the hemisphere light's up and bounce colours and `ambient`
// its intensity. These numbers reproduce the one fixed rig the scene used before worlds were lit individually.
export const LIGHT_DEFAULT = {
  key: '#ffffff',
  keyIntensity: 2.2,
  bearing: -25,
  elevation: 30,
  sky: '#ffffff',
  ground: '#334455',
  ambient: 1.6
};
