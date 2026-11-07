// tuning.js — every number the game cares about. Edit these to change how it plays.

// --- Arena and base ---
export const ARENA_SIZE = 40;            // width and depth of the square desert floor
export const BASE_HP = 100;              // base health; the run ends when it reaches 0
export const BASE_RADIUS = 5;            // drone centre this close to the middle: its edge (DRONE_RADIUS) touches the base edge (4)
export const DRONE_DAMAGE = 10;          // base HP lost each time a drone reaches the base

// --- Turret ---
export const FIRE_COOLDOWN = 0.18;       // seconds between shots while the button is held
export const SHOT_SPEED = 30;            // how fast a shot travels, in units per second
export const SHOT_LIFETIME = 1.5;        // seconds before a shot disappears
export const HIT_RADIUS = 1.2;           // how close a shot must get to a drone's centre to hit it
export const FIRE_CONE_DEGREES = 8;      // shots spread ± this many degrees

// --- Drones ---
export const DRONE_RADIUS = 1.0;         // sphere size of a drone (and how far it reaches past its centre)
export const DRONE_SPEED = 3;            // how fast a drone flies toward the base
export const DRONE_HP = 3;               // hits needed to destroy one drone
export const DRONE_HOVER = 1.2;          // height the drones hover at above the sand
export const DRONE_SPAWN_INTERVAL = 1.5; // seconds between spawn attempts
export const MAX_DRONES = 6;             // most drones that can be alive at once

// --- Small fast drones (from wave 2) ---
// Half the size, one hit, and quicker than a normal drone: a swarm you can clear fast.
export const SMALL_DRONE_START_WAVE = 2; // first wave a spawn can turn out small
export const SMALL_DRONE_RADIUS = 0.5;   // sphere size (half a normal drone)
export const SMALL_DRONE_HP = 1;         // hits needed to destroy one
export const SMALL_DRONE_SPEED = 5;      // faster than DRONE_SPEED
export const SMALL_DRONE_CHANCE = 0.25;  // 0..1 chance a spawn is small, once this wave is reached

// --- Big tank drones (from wave 7) ---
// Twice the size, slow, and they soak a lot of shots: a wall you have to chew through.
export const TANK_DRONE_START_WAVE = 7;  // first wave a spawn can turn out a tank
export const TANK_DRONE_RADIUS = 2.0;    // sphere size (double a normal drone)
export const TANK_DRONE_HP = 8;          // hits needed to destroy one
export const TANK_DRONE_SPEED = 1.5;     // slower than DRONE_SPEED
export const TANK_DRONE_CHANCE = 0.2;    // 0..1 chance a spawn is a tank, once this wave is reached

// --- Drone flight: zigzag, and the odd dash ---
export const DRONE_SWERVE_AMOUNT = 3;        // units the aiming point is nudged sideways off the line home
export const DRONE_SWERVE_INTERVAL = 0.5;    // seconds between fresh zigzag directions
export const DRONE_DASH_CHANCE = 0.25;       // 0..1 chance a swerve turns into a dash
export const DRONE_DASH_MULTIPLIER = 2.2;    // speed is multiplied by this while dashing
export const DRONE_DASH_DURATION = 0.35;     // seconds a dash lasts

// --- Red spiral enemies (M3) ---
// A red enemy spawns at a corner like a drone, but swings around the base in a
// tightening spiral before it charges in. It is bigger and tougher than a drone,
// and harder to hit because it is always circling.
export const RED_RADIUS = 1.4;            // sphere size of a red enemy (also how close a shot must get)
export const RED_HP = 4;                 // hits needed to destroy one red enemy
export const RED_ORBIT_SPEED = 0.6;      // radians per second around the centre (wide orbits move faster;
                                         // 0.6 is about 15 units/s at spawn, easing off as it tightens)
export const RED_SPIRAL_CLOSE_RATE = 4;  // units per second its distance to the centre shrinks
export const RED_MIN_RADIUS = 12;        // once this close it stops spiralling and charges the base
export const RED_RUSH_SPEED = 7;         // units per second while it charges straight in
export const RED_START_WAVE = 3;         // first wave a spawn can turn out red
export const RED_SPAWN_CHANCE = 0.25;    // 0..1 chance a given spawn is red instead of a blue drone

// --- Boss ---
// A boss wave replaces the normal mixed wave: one boss, then the small drones it leaves behind.
export const BOSS_WAVES = [5, 10, 15, 20]; // waves that are a boss instead of a mixed wave
export const BOSS_RADIUS = 3;            // sphere size of the boss
export const BOSS_HP = 40;               // hits needed to bring the boss down
export const BOSS_SPEED = 0.8;           // units per second, straight at the base (slow on purpose)
export const BOSS_MINION_COUNT = 6;      // small fast drones the boss bursts into when it dies
export const BOSS_MINION_SPREAD = 3;     // how far from the boss centre those minions appear

// --- Waves ---
export const START_WAVE = 1;             // wave number a run starts on (5 is a boss wave, for testing)
export const WIN_WAVE = 20;              // clearing this wave wins the run
export const WAVE_PAUSE_SECONDS = 2;     // quiet seconds between waves, with "Wave N" on screen

// Which corners a wave spawns from, and how many drones it sends.
export const WAVE_PLANS = [
  { startWave: 1, endWave: 4, corners: 1, minEnemies: 5, maxEnemies: 10 },
  { startWave: 5, endWave: 9, corners: 2, minEnemies: 7, maxEnemies: 12 },
  { startWave: 10, endWave: 14, corners: 3, minEnemies: 9, maxEnemies: 14 },
  { startWave: 15, endWave: Infinity, corners: 4, minEnemies: 11, maxEnemies: 16 },
];

// --- Active abilities ---
// Three once-per-cooldown powers activated with keys. They add burst options without
// replacing the one-action loop of aiming and shooting.
export const ABILITY_BOMB_COOLDOWN = 12;       // seconds before the bomb can be used again
export const ABILITY_BOMB_DAMAGE = 1000;       // enough to one-shot non-boss enemies
export const ABILITY_RAPID_COOLDOWN = 15;      // seconds before rapid fire can be used again
export const ABILITY_RAPID_DURATION = 3;       // seconds rapid fire lasts
export const ABILITY_RAPID_MULTIPLIER = 0.4;   // fire cooldown is multiplied by this (lower = faster)
export const ABILITY_HEAL_COOLDOWN = 20;       // seconds before heal can be used again
export const ABILITY_HEAL_AMOUNT = 30;         // HP restored, capped at max HP

// --- Walls ---
// Right-click the sand to place a stone wall. Walls block enemies and soak damage.
export const WALL_MAX_COUNT = 3;               // how many walls the player can have at once
export const WALL_HP = 50;                     // damage a wall can take before crumbling
export const WALL_RADIUS = 1.0;                // collision radius of a wall
export const WALL_MIN_PLACE_RADIUS = 7;        // walls can't be placed closer than this to the base
export const WALL_MAX_PLACE_RADIUS = 18;       // walls can't be placed outside this ring
