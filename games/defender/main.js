// main.js — M4 look pass: GLB models, a canvas sand floor, dusk lighting, generated sounds and a ?fps readout.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  ARENA_SIZE,
  BASE_HP,
  BASE_RADIUS,
  DRONE_DAMAGE,
  FIRE_COOLDOWN,
  FIRE_CONE_DEGREES,
  SHOT_SPEED,
  SHOT_LIFETIME,
  HIT_RADIUS,
  DRONE_RADIUS,
  DRONE_SPEED,
  DRONE_HP,
  DRONE_HOVER,
  DRONE_SPAWN_INTERVAL,
  MAX_DRONES,
  DRONE_SWERVE_AMOUNT,
  DRONE_SWERVE_INTERVAL,
  DRONE_DASH_CHANCE,
  DRONE_DASH_MULTIPLIER,
  DRONE_DASH_DURATION,
  RED_RADIUS,
  RED_HP,
  RED_ORBIT_SPEED,
  RED_SPIRAL_CLOSE_RATE,
  RED_MIN_RADIUS,
  RED_RUSH_SPEED,
  RED_START_WAVE,
  RED_SPAWN_CHANCE,
  SMALL_DRONE_START_WAVE,
  SMALL_DRONE_RADIUS,
  SMALL_DRONE_HP,
  SMALL_DRONE_SPEED,
  SMALL_DRONE_CHANCE,
  TANK_DRONE_START_WAVE,
  TANK_DRONE_RADIUS,
  TANK_DRONE_HP,
  TANK_DRONE_SPEED,
  TANK_DRONE_CHANCE,
  BOSS_WAVES,
  BOSS_RADIUS,
  BOSS_HP,
  BOSS_SPEED,
  BOSS_MINION_COUNT,
  BOSS_MINION_SPREAD,
  START_WAVE,
  WIN_WAVE,
  WAVE_PAUSE_SECONDS,
  ABILITY_BOMB_COOLDOWN,
  ABILITY_BOMB_DAMAGE,
  ABILITY_RAPID_COOLDOWN,
  ABILITY_RAPID_DURATION,
  ABILITY_RAPID_MULTIPLIER,
  ABILITY_HEAL_COOLDOWN,
  ABILITY_HEAL_AMOUNT,
  WALL_MAX_COUNT,
  WALL_HP,
  WALL_RADIUS,
  WALL_MIN_PLACE_RADIUS,
  WALL_MAX_PLACE_RADIUS,
} from './tuning.js';
import { getWavePlan, pickCorners } from './waves.js';
import {
  initUI,
  updateUI,
  showGameOver,
  hideGameOver,
  showWin,
  hideWin,
  flashBaseDamage,
  showWaveAnnounce,
  hideWaveAnnounce,
  showStartScreen,
  hideStartScreen,
  updateAbilityHUD,
  updateWalls,
} from './ui.js';
import { groundTexture } from './textures.js';
import { initAudio, playShoot, playHit, playDamage } from './sounds.js';
import { makeArrow, makeWall } from './art.js';
import { showAbilityPick, hideAbilityPick } from './abilities.js';

// --- Abilities picked after boss waves; restart puts them all back ---
let maxHpNow = BASE_HP;    // Stone Plating / Rebuild raise this
let coneScale = 1;         // Focus Barrel shrinks the fire cone
let cooldownScale = 1;     // Rapid Fire shortens the time between arrows
let arrowDamage = 1;       // Heavy Arrows
let arrowsPerShot = 1;     // Triple Shot
let choosingAbility = false;

function applyAbility(id) {
  if (id === 'focus') coneScale = 0.35;
  if (id === 'plating' || id === 'mend') { maxHpNow += 50; baseHp = maxHpNow; }
  if (id === 'rapid') cooldownScale = 0.6;
  if (id === 'heavy') arrowDamage = 2;
  if (id === 'volley') arrowsPerShot = 3;
}

function resetAbilities() {
  maxHpNow = BASE_HP;
  coneScale = 1;
  cooldownScale = 1;
  arrowDamage = 1;
  arrowsPerShot = 1;
  choosingAbility = false;
  hideAbilityPick();
}

// --- Shapes and offsets that are not tuning knobs ---
const BASE_HEIGHT = 1;              // the loaded base model's deck top is y = 1, so the turret sits at y = 1
const TURRET_MUZZLE_HEIGHT = 1.65;  // firing window height on the loaded tower.glb
const TURRET_MUZZLE_Z = 1.7;        // firing window distance forward on the loaded tower.glb
const SHOT_RADIUS = 0.12;
const HIT_FLASH_TIME = 0.15;        // seconds a drone stays "popped" after being hit
const CORNER_INSET = 1.5;           // drones start this far in from the arena edge
const ARENA_LIMIT = ARENA_SIZE / 2 - DRONE_RADIUS; // drones stay fully inside the sand
// A hit counts a little past the sphere's edge; every drone size uses the same margin on top of its radius.
const HIT_MARGIN = HIT_RADIUS - DRONE_RADIUS;
const FIRE_CONE_RADIANS = (FIRE_CONE_DEGREES * Math.PI) / 180; // the tuning knob is in degrees

// --- The loaded models ---
const GARGOYLE_MODEL_RADIUS = 0.55;   // gargoyle.glb is about 0.55 units in radius
const TROLL_MODEL_RADIUS = 0.7;       // troll.glb is about 0.7 units in radius
const GLOW_MATERIAL = 'EyeGlow';      // gargoyle's emissive eye material; red enemies get a tinted copy
const RED_GLOW_COLOR = '#ff2a1f';
const RED_GLOW_INTENSITY = 2.0;

// --- Dusk palette ---
const SKY_COLOR = '#1b0e08';   // near-black with a hint of red: the rig lamps and the lasers do the lighting
const HEMI_SKY = '#ffa361';
const HEMI_GROUND = '#2b1a12';
const SUN_COLOR = '#ffc493';
const FILL_COLOR = '#6f7fa8';   // cool light from the side away from the sun

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// --- Scene and cameras ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);

// Gameplay camera: straight-down orthographic, best for aiming.
const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
orthoCamera.position.set(0, 50, 0);
orthoCamera.up.set(0, 0, -1);   // makes world -Z "up" on screen, so +X is right and +Z is down
orthoCamera.lookAt(0, 0, 0);

// Art camera: perspective from behind the tower, better for seeing the models.
const perspCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
perspCamera.position.set(0, 18, 28);
perspCamera.lookAt(0, 0, 0);
perspCamera.up.set(0, 1, 0);

let camera = orthoCamera;
let perspectiveView = false;

// Half the arena plus a 10% margin has to stay visible in both directions.
const VIEW_HALF = (ARENA_SIZE / 2) * 1.1;

function resize() {
  const aspect = innerWidth / innerHeight;
  if (perspectiveView) {
    perspCamera.aspect = aspect;
    perspCamera.updateProjectionMatrix();
  } else {
    const halfWidth = aspect >= 1 ? VIEW_HALF * aspect : VIEW_HALF;
    const halfHeight = aspect >= 1 ? VIEW_HALF : VIEW_HALF / aspect;
    orthoCamera.left = -halfWidth;
    orthoCamera.right = halfWidth;
    orthoCamera.top = halfHeight;
    orthoCamera.bottom = -halfHeight;
    orthoCamera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  renderer.setSize(innerWidth, innerHeight);
}
resize();
addEventListener('resize', resize);

function toggleCameraView() {
  perspectiveView = !perspectiveView;
  camera = perspectiveView ? perspCamera : orthoCamera;
  resize();
}

// --- Lights: dusk. A dim warm sky, and a low sun so the rig and its enemies stay readable ---
scene.add(new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, 0.65));
const sun = new THREE.DirectionalLight(SUN_COLOR, 1.7);
sun.position.set(16, 18, -12); // low and off to one side: the long light of dusk, no shadows to pay for
scene.add(sun);

// A dim cool counter-light from the other side: without it the metal parts of the rig and the
// drones read as flat dark shapes, and the turret stops standing out from its own deck.
const fill = new THREE.DirectionalLight(FILL_COLOR, 0.4);
fill.position.set(-14, 10, 12);
scene.add(fill);

// --- Ground: the canvas-drawn desert floor, one flat square ---
groundTexture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // keeps the grid lines from smearing
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
  new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.95, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- Turret: a group at the centre on top of the base; its +Z is "forward". The model goes in when it loads. ---
const turret = new THREE.Group();
turret.position.set(0, BASE_HEIGHT, 0);
scene.add(turret);

// Empty marker at the barrel tip; shots are born here.
const muzzle = new THREE.Object3D();
muzzle.position.set(0, TURRET_MUZZLE_HEIGHT, TURRET_MUZZLE_Z);
turret.add(muzzle);

// --- Shots: bright spheres, shared by every shot ---
const shotGeometry = new THREE.SphereGeometry(SHOT_RADIUS, 8, 6);
const shotMaterial = new THREE.MeshBasicMaterial({ color: '#ffe57a' });

// --- Enemies: gargoyles for most, troll for the boss ---
const gltfLoader = new GLTFLoader();
let gargoyleModel = null; // the loaded gargoyle; set before the first wave spawns
let trollModel = null;    // the loaded troll boss

// Every blue drone size in one table; spawnDroneAt copies a row onto the enemy object.
const DRONE_VARIANTS = {
  blue:  { radius: DRONE_RADIUS,       hp: DRONE_HP,       speed: DRONE_SPEED },
  small: { radius: SMALL_DRONE_RADIUS, hp: SMALL_DRONE_HP, speed: SMALL_DRONE_SPEED },
  tank:  { radius: TANK_DRONE_RADIUS,  hp: TANK_DRONE_HP,  speed: TANK_DRONE_SPEED },
};

// Swap one material on a clone for its own tinted copy, so red enemies and the boss glow their own colour
// while every blue drone keeps sharing the model's own blue glow material.
function tintGlow(root, color, intensity) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material || child.material.name !== GLOW_MATERIAL) return;
    const tinted = child.material.clone();
    tinted.color = new THREE.Color(color);
    tinted.emissive = new THREE.Color(color);
    tinted.emissiveIntensity = intensity;
    child.material = tinted;
  });
}

// One enemy mesh: a group holding a clone of `model`, scaled so the model's natural radius
// becomes `radius`. The group is what the game moves and pops, so the model's own scale stays put.
function makeEnemyMesh(model, modelRadius, radius, glowColor, glowIntensity) {
  const group = new THREE.Group();
  const clone = model.clone(); // geometry and materials stay shared unless tinted
  clone.scale.setScalar(radius / modelRadius);
  if (glowColor) tintGlow(clone, glowColor, glowIntensity);
  group.add(clone);
  return group;
}

// --- Game state ---
let baseHp = BASE_HP;
let wave = START_WAVE;
let waveInProgress = false;          // true while a wave is being fought, false during the pause
let waveTimer = WAVE_PAUSE_SECONDS;  // seconds left of the pause
let pauseTarget = START_WAVE;        // the wave the current pause leads into
let enemiesRemaining = 0;            // drones of this wave that have not spawned yet
let waveCorners = [];                // [signX, signZ] corners this wave spawns from
let cornerCursor = 0;                // which of those corners is next in line
let gameOver = false;
let won = false;                     // true once wave WIN_WAVE is cleared
let runStarted = false;              // true once the player clicks through the start screen
let runTime = 0;                     // seconds this run has lasted, stopped when it ends
let firing = false;
let fireCooldown = 0;
let spawnTimer = 0;                  // counts down to the next drone of this wave

// Active ability cooldowns (seconds remaining) and rapid-fire timer.
let bombCooldown = 0;
let rapidCooldown = 0;
let healCooldown = 0;
let rapidEndTime = 0;                // >0 while rapid fire is active

// Every live enemy: blue (three sizes), red or boss. All carry { type, mesh, hp, hitFlash, hitRadius, radius }.
// Blue adds: { variant, speed, heading, velocity, swerveTimer, dashTimer }
// Red adds: { spiralling, spin } and drops the zigzag fields.
// Boss adds: { speed } and walks straight at the base.
const drones = [];
const shots = [];  // { mesh, direction, life }
const walls = [];  // { mesh, hp, radius }
let wallsRemaining = WALL_MAX_COUNT;

// --- Mouse aim ---
const pointer = new THREE.Vector2(0, 0);                  // mouse position in -1..1 screen space
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // the mathematical ground, y = 0
const aimPoint = new THREE.Vector3();

function updateAim() {
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(aimPlane, aimPoint)) return; // never happens with a top-down camera
  // The loaded turret's barrel points along +Z at rotation 0, so +Z is "down" on screen and
  // atan2(x, z) is the yaw that points the barrel at the cursor.
  turret.rotation.y = Math.atan2(aimPoint.x, aimPoint.z);
}

addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / innerHeight) * 2 + 1;
});

addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return; // left button only (right-click is for walls in M3)
  initAudio();                    // the first click is the gesture that starts the audio context
  if (!runStarted) { startRun(); return; } // click through the title screen
  pointer.x = (event.clientX / innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / innerHeight) * 2 + 1;
  updateAim();                    // face where the click/tap landed
  if (gameOver || !waveInProgress) return; // between waves you can aim, but not fire
  firing = true;
  shoot();                        // a single quick click still fires one shot
  fireCooldown = FIRE_COOLDOWN * cooldownScale;
});

addEventListener('pointerup', (event) => {
  if (event.button === 0) firing = false;
});
addEventListener('pointercancel', () => { firing = false; });
addEventListener('blur', () => { firing = false; });          // no stuck trigger if the tab loses focus
addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (!runStarted || gameOver || won || wallsRemaining <= 0) return;
  initAudio();
  updateAim();
  tryPlaceWall(aimPoint.x, aimPoint.z);
});

addEventListener('keydown', (event) => {
  if (!loadingEl.hidden || event.repeat) return;
  if (!runStarted && (event.key === ' ' || event.code === 'Space')) { startRun(); return; }
  if (!runStarted) return;

  if (event.key === 'r' || event.key === 'R') restart();
  else if (event.key === ' ' || event.code === 'Space') useBomb();
  else if (event.key === 'Shift') useRapid();
  else if (event.key === 'h' || event.key === 'H') useHeal();
  else if (event.key === 'v' || event.key === 'V') toggleCameraView();
});

// --- Shooting ---
const muzzlePosition = new THREE.Vector3();

function shoot() {
  turret.updateMatrixWorld(true); // the turret turned this frame; refresh its world matrices
  muzzle.getWorldPosition(muzzlePosition);

  // The barrel stays put: only the shot's direction is nudged, by up to FIRE_CONE_DEGREES either way.
  for (let k = 0; k < arrowsPerShot; k++) {
    const fan = (k - (arrowsPerShot - 1) / 2) * 0.12; // Triple Shot fans three arrows out a little
    const spread = (Math.random() * 2 - 1) * FIRE_CONE_RADIANS * coneScale;
    const yaw = turret.rotation.y + spread + fan;

    const mesh = makeArrow();
    mesh.position.copy(muzzlePosition);
    mesh.rotation.y = yaw; // the arrow points the way it flies

    scene.add(mesh);
    shots.push({
      mesh,
      direction: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), // out of the window, inside the cone
      life: SHOT_LIFETIME,
    });
  }

  playShoot();
}

function updateFiring(dt) {
  if (fireCooldown > 0) fireCooldown = Math.max(0, fireCooldown - dt);
  if (!firing || fireCooldown > 0) return;
  shoot();
  const rapidScale = rapidEndTime > 0 ? ABILITY_RAPID_MULTIPLIER : 1;
  fireCooldown = FIRE_COOLDOWN * cooldownScale * rapidScale;
}

// --- Active abilities ---

function useBomb() {
  if (bombCooldown > 0) return;
  bombCooldown = ABILITY_BOMB_COOLDOWN;
  // Wipe every non-boss enemy on screen. Bosses are too tough for the bomb.
  for (let i = drones.length - 1; i >= 0; i--) {
    if (drones[i].type === 'boss') continue;
    scene.remove(drones[i].mesh);
    drones.splice(i, 1);
  }
  playHit();
  updateAbilityHUD({ bomb: bombCooldown, rapid: rapidCooldown, heal: healCooldown, rapidEndTime });
}

function useRapid() {
  if (rapidCooldown > 0) return;
  rapidCooldown = ABILITY_RAPID_COOLDOWN;
  rapidEndTime = ABILITY_RAPID_DURATION;
  updateAbilityHUD({ bomb: bombCooldown, rapid: rapidCooldown, heal: healCooldown, rapidEndTime });
}

function useHeal() {
  if (healCooldown > 0) return;
  healCooldown = ABILITY_HEAL_COOLDOWN;
  baseHp = Math.min(maxHpNow, baseHp + ABILITY_HEAL_AMOUNT);
  updateUI({ wave, hp: baseHp, maxHp: maxHpNow });
  updateAbilityHUD({ bomb: bombCooldown, rapid: rapidCooldown, heal: healCooldown, rapidEndTime });
}

function updateAbilities(dt) {
  let changed = false;
  if (bombCooldown > 0) { bombCooldown = Math.max(0, bombCooldown - dt); changed = true; }
  if (rapidCooldown > 0) { rapidCooldown = Math.max(0, rapidCooldown - dt); changed = true; }
  if (healCooldown > 0) { healCooldown = Math.max(0, healCooldown - dt); changed = true; }
  if (rapidEndTime > 0) {
    rapidEndTime = Math.max(0, rapidEndTime - dt);
    changed = true;
  }
  if (changed) updateAbilityHUD({ bomb: bombCooldown, rapid: rapidCooldown, heal: healCooldown, rapidEndTime });
}

function resetAbilityCooldowns() {
  bombCooldown = 0;
  rapidCooldown = 0;
  healCooldown = 0;
  rapidEndTime = 0;
}

// --- Walls ---

function tryPlaceWall(x, z) {
  const distance = Math.hypot(x, z);
  if (distance < WALL_MIN_PLACE_RADIUS || distance > WALL_MAX_PLACE_RADIUS) return;

  // Don't stack walls on top of each other.
  for (const wall of walls) {
    if (Math.hypot(wall.mesh.position.x - x, wall.mesh.position.z - z) < WALL_RADIUS * 2) return;
  }

  const mesh = makeWall();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  walls.push({ mesh, hp: WALL_HP, radius: WALL_RADIUS });
  wallsRemaining -= 1;
  updateWalls(wallsRemaining);
}

function updateWallsState(dt) {
  for (let i = walls.length - 1; i >= 0; i--) {
    if (walls[i].hp > 0) continue;
    scene.remove(walls[i].mesh);
    walls.splice(i, 1);
    wallsRemaining += 1;
    updateWalls(wallsRemaining);
  }
}

function resetWalls() {
  for (const wall of walls) scene.remove(wall.mesh);
  walls.length = 0;
  wallsRemaining = WALL_MAX_COUNT;
}

function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i];
    shot.mesh.position.addScaledVector(shot.direction, SHOT_SPEED * dt);
    shot.life -= dt;

    let remove = shot.life <= 0;

    if (!remove) {
      for (let j = drones.length - 1; j >= 0; j--) {
        const drone = drones[j];
        const dx = drone.mesh.position.x - shot.mesh.position.x;
        const dz = drone.mesh.position.z - shot.mesh.position.z;
        // Flat distance: drones fly above the barrel line, so height is ignored on purpose.
        if (dx * dx + dz * dz <= drone.hitRadius * drone.hitRadius) {
          hitEnemy(j);
          remove = true;
          break;
        }
      }
    }

    if (remove) {
      scene.remove(shot.mesh); // geometry and material are shared, so nothing to dispose
      shots.splice(i, 1);
    }
  }
}

function hitEnemy(index) {
  const drone = drones[index];
  drone.hp -= arrowDamage;
  drone.hitFlash = HIT_FLASH_TIME; // scale pop, so a hit is visible, on every enemy
  if (drone.hp > 0) return;

  playHit();

  // A boss is not removed on its own: its minions appear first, in the same frame.
  if (drone.type === 'boss') spawnBossMinions(drone.mesh.position);

  scene.remove(drone.mesh);
  drones.splice(index, 1);
}

// --- Waves ---

// A wave ends: pause, put "Wave N" up, and wait for the timer.
function beginWavePause(nextWave) {
  waveInProgress = false;
  pauseTarget = nextWave;
  waveTimer = WAVE_PAUSE_SECONDS;
  firing = false;                // the trigger cannot be held through the pause
  showWaveAnnounce(nextWave);
  updateUI({ wave: nextWave, hp: baseHp, maxHp: maxHpNow });
}

// The pause is over: this is wave `number`. Pick its corners and enemy count, then start spawning.
function startWave(number) {
  wave = number;

  if (isBossWave(number)) {
    // A boss wave replaces the mixed wave: one boss from one corner, plus the minions it will leave.
    waveCorners = pickCorners(1);
    enemiesRemaining = 1;
  } else {
    const plan = getWavePlan(number);
    waveCorners = pickCorners(plan.cornerCount);
    enemiesRemaining = plan.enemyCount;
  }

  cornerCursor = 0;
  spawnTimer = 0;                // the wave's first enemy comes out straight away

  waveInProgress = true;
  hideWaveAnnounce();
  updateUI({ wave, hp: baseHp, maxHp: maxHpNow });
}

function updateWaves(dt) {
  if (choosingAbility) return; // the game waits while the pick screen is up
  if (waveInProgress) {
    // Over when everything has spawned and nothing is left alive (for a boss wave: the boss and its minions).
    if (enemiesRemaining <= 0 && drones.length === 0) {
      if (wave >= WIN_WAVE) winGame(); // the last wave is cleared: the run is won, no wave 21
      else if (isBossWave(wave)) {
        // Boss down: take one of two abilities, then the next wave's pause begins.
        waveInProgress = false;
        firing = false;
        choosingAbility = true;
        const clearedWave = wave;
        showAbilityPick(clearedWave, (id) => {
          applyAbility(id);
          choosingAbility = false;
          beginWavePause(clearedWave + 1);
        });
      } else beginWavePause(wave + 1);
    }
    return;
  }

  waveTimer -= dt;
  if (waveTimer > 0) return;
  startWave(pauseTarget);
}

// --- Enemies: blue drones (three sizes), red spiral enemies, and the boss ---

// Is this wave a boss instead of a mixed wave?
function isBossWave(number) {
  return BOSS_WAVES.includes(number);
}

// One blue drone of any size, starting at (x, z). The variant's stats ride on the enemy,
// so updateBlue flies the small, normal and tank drones with the same code.
function spawnDroneAt(x, z, variantName) {
  const variant = DRONE_VARIANTS[variantName];

  const mesh = makeEnemyMesh(gargoyleModel, GARGOYLE_MODEL_RADIUS, variant.radius); // blue gargoyle, scaled to this size
  mesh.position.set(x, DRONE_HOVER, z);

  const drone = {
    type: 'blue',
    variant: variantName,
    mesh,
    radius: variant.radius,
    speed: variant.speed,
    hp: variant.hp,
    hitFlash: 0,
    hitRadius: variant.radius + HIT_MARGIN,
    heading: new THREE.Vector2(1, 0), // unit direction in the x/z plane
    velocity: new THREE.Vector3(),    // units per second, x/z only
    swerveTimer: 0,
    dashTimer: 0,
  };

  pickDroneHeading(drone);
  // Offset the next swerve so drones do not all turn on the same beat.
  drone.swerveTimer = Math.random() * DRONE_SWERVE_INTERVAL;

  scene.add(mesh);
  drones.push(drone);
}

// Send one enemy in from the corner at (signX, signZ): a boss on a boss wave, otherwise a red
// spiral enemy, a tank drone, a small fast drone, or the normal blue drone.
function spawnEnemy(signX, signZ) {
  const inset = ARENA_SIZE / 2 - CORNER_INSET;
  const x = signX * inset;
  const z = signZ * inset;

  if (isBossWave(wave)) { spawnBoss(x, z); return; }
  // Red is rolled before the sizes, so mixing the sizes in does not thin out the spirals.
  if (wave >= RED_START_WAVE && Math.random() < RED_SPAWN_CHANCE) { spawnRed(x, z); return; }
  if (wave >= TANK_DRONE_START_WAVE && Math.random() < TANK_DRONE_CHANCE) { spawnDroneAt(x, z, 'tank'); return; }
  if (wave >= SMALL_DRONE_START_WAVE && Math.random() < SMALL_DRONE_CHANCE) { spawnDroneAt(x, z, 'small'); return; }
  spawnDroneAt(x, z, 'blue');
}

// A red enemy starts at a corner like a drone, then spirals in on its own path.
function spawnRed(x, z) {
  const mesh = makeEnemyMesh(gargoyleModel, GARGOYLE_MODEL_RADIUS, RED_RADIUS, RED_GLOW_COLOR, RED_GLOW_INTENSITY);
  mesh.position.set(x, DRONE_HOVER, z);

  const red = {
    type: 'red',
    mesh,
    radius: RED_RADIUS,
    hp: RED_HP,
    hitFlash: 0,
    hitRadius: RED_RADIUS,
    spiralling: true,                   // false once it has closed in and started its rush
    spin: Math.random() < 0.5 ? 1 : -1, // which way it swings around the base
  };

  scene.add(mesh);
  drones.push(red);
}

// The boss: one big slow enemy that comes in from a corner and walks straight at the base.
function spawnBoss(x, z) {
  const mesh = makeEnemyMesh(trollModel, TROLL_MODEL_RADIUS, BOSS_RADIUS);
  mesh.position.set(x, DRONE_HOVER, z);

  const boss = {
    type: 'boss',
    mesh,
    radius: BOSS_RADIUS,
    speed: BOSS_SPEED,
    hp: BOSS_HP,
    hitFlash: 0,
    hitRadius: BOSS_RADIUS + HIT_MARGIN,
  };

  scene.add(mesh);
  drones.push(boss);
}

// The boss bursts into small fast drones spread around where it died. They are pushed onto the
// list before the boss is spliced out, so the wave only ends once they are all dead too.
function spawnBossMinions(position) {
  for (let i = 0; i < BOSS_MINION_COUNT; i++) {
    const angle = (i / BOSS_MINION_COUNT) * Math.PI * 2; // an even ring, so they do not stack up
    spawnDroneAt(
      position.x + Math.cos(angle) * BOSS_MINION_SPREAD,
      position.z + Math.sin(angle) * BOSS_MINION_SPREAD,
      'small'
    );
  }
}

// Aim a drone at a point beside the base centre: the line home, pushed sideways at random.
function pickDroneHeading(drone) {
  const position = drone.mesh.position;
  const distance = Math.hypot(position.x, position.z);
  const outwardX = distance > 0.001 ? position.x / distance : 1; // direction from the base out to the drone
  const outwardZ = distance > 0.001 ? position.z / distance : 0;

  const offset = (Math.random() * 2 - 1) * DRONE_SWERVE_AMOUNT;
  const targetX = -outwardZ * offset; // perpendicular to the line home, so the drone zigzags in
  const targetZ = outwardX * offset;

  const dx = targetX - position.x;
  const dz = targetZ - position.z;
  const length = Math.hypot(dx, dz) || 1;
  drone.heading.set(dx / length, dz / length);

  drone.swerveTimer = DRONE_SWERVE_INTERVAL;
  if (Math.random() < DRONE_DASH_CHANCE) drone.dashTimer = DRONE_DASH_DURATION;
}

// Hitting the arena edge turns the drone back toward the base instead of letting it rub along the wall.
function keepInArena(drone) {
  const position = drone.mesh.position;
  const x = Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, position.x));
  const z = Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, position.z));
  if (x === position.x && z === position.z) return;

  position.x = x;
  position.z = z;
  pickDroneHeading(drone);
}

function updateSpawning(dt) {
  if (!waveInProgress || enemiesRemaining <= 0 || waveCorners.length === 0) return;
  spawnTimer -= dt;
  if (spawnTimer > 0) return;
  spawnTimer = DRONE_SPAWN_INTERVAL;

  if (drones.length >= MAX_DRONES) return; // the arena is full; this drone waits for the next slot

  const [signX, signZ] = waveCorners[cornerCursor % waveCorners.length];
  cornerCursor += 1;
  spawnEnemy(signX, signZ);
  enemiesRemaining -= 1;
}

function updateDrones(dt) {
  for (let i = drones.length - 1; i >= 0; i--) {
    const drone = drones[i];
    const position = drone.mesh.position;
    const distance = Math.hypot(position.x, position.z); // horizontal distance to the base centre

    // Reached the base: it takes damage and the enemy is gone.
    if (distance <= BASE_RADIUS) {
      scene.remove(drone.mesh);
      drones.splice(i, 1);
      damageBase();
      continue;
    }

    if (drone.type === 'red') updateRed(drone, dt);
    else if (drone.type === 'boss') updateBoss(drone, dt);
    else updateBlue(drone, dt);

    // Walls block enemies: push the drone back to the wall's edge and damage the wall.
    for (const wall of walls) {
      const dx = position.x - wall.mesh.position.x;
      const dz = position.z - wall.mesh.position.z;
      const wallDist = Math.hypot(dx, dz);
      const minDist = drone.radius + wall.radius;
      if (wallDist >= minDist) continue;
      const overlap = minDist - wallDist;
      const nx = wallDist > 0.001 ? dx / wallDist : 1;
      const nz = wallDist > 0.001 ? dz / wallDist : 0;
      position.x += nx * overlap;
      position.z += nz * overlap;
      wall.hp -= DRONE_DAMAGE * dt;
    }

    // Shrink back down after a hit. Only the group is scaled: the model inside keeps its own size.
    if (drone.hitFlash > 0) drone.hitFlash = Math.max(0, drone.hitFlash - dt);
    const pop = 1 + 0.5 * (drone.hitFlash / HIT_FLASH_TIME);
    drone.mesh.scale.setScalar(pop);
  }

  updateWallsState(dt);
}

// Blue drones of every size: erratic flight, a fresh zigzag direction every DRONE_SWERVE_INTERVAL
// seconds, and now and then a dash that multiplies the drone's own speed for a moment.
function updateBlue(drone, dt) {
  drone.swerveTimer -= dt;
  if (drone.swerveTimer <= 0) pickDroneHeading(drone);
  if (drone.dashTimer > 0) drone.dashTimer = Math.max(0, drone.dashTimer - dt);

  const speed = drone.speed * (drone.dashTimer > 0 ? DRONE_DASH_MULTIPLIER : 1);
  drone.velocity.set(drone.heading.x * speed, 0, drone.heading.y * speed);
  drone.mesh.position.addScaledVector(drone.velocity, dt);
  keepInArena(drone);
}

// The boss does not zigzag: it walks straight at the middle of the base, slowly.
function updateBoss(boss, dt) {
  const position = boss.mesh.position;
  const distance = Math.hypot(position.x, position.z) || 1;
  const step = boss.speed * dt;
  position.x -= (position.x / distance) * step;
  position.z -= (position.z / distance) * step;
}

// Red enemies: swing around the base at RED_ORBIT_SPEED while the orbit tightens at
// RED_SPIRAL_CLOSE_RATE. Inside RED_MIN_RADIUS it drops the orbit and charges the base
// head-on at RED_RUSH_SPEED, so the last second of its approach is a straight line the
// player can lead and kill (kept the rush, not a tighter spiral: it reads as a lunge).
function updateRed(red, dt) {
  const position = red.mesh.position;

  if (!red.spiralling) {
    const distance = Math.hypot(position.x, position.z) || 1;
    const step = RED_RUSH_SPEED * dt;
    position.x -= (position.x / distance) * step; // straight toward the base centre
    position.z -= (position.z / distance) * step;
    return;
  }

  const radius = Math.hypot(position.x, position.z);
  const angle = Math.atan2(position.z, position.x) + RED_ORBIT_SPEED * dt * red.spin;
  const nextRadius = Math.max(RED_MIN_RADIUS, radius - RED_SPIRAL_CLOSE_RATE * dt);

  position.x = Math.cos(angle) * nextRadius;
  position.z = Math.sin(angle) * nextRadius;

  // An orbit that wide can swing past the sand near the axes; hold it on the arena, like blue drones.
  const limit = ARENA_SIZE / 2 - RED_RADIUS;
  position.x = Math.max(-limit, Math.min(limit, position.x));
  position.z = Math.max(-limit, Math.min(limit, position.z));

  if (nextRadius <= RED_MIN_RADIUS) red.spiralling = false; // close enough: next frame it rushes
}

// --- Base damage, game over, restart ---
function damageBase() {
  baseHp = Math.max(0, baseHp - DRONE_DAMAGE);
  updateUI({ wave, hp: baseHp, maxHp: maxHpNow });
  flashBaseDamage();
  playDamage();
  if (baseHp <= 0) endGame();
}

function endGame() {
  gameOver = true; // stops the wave loop, the clock and firing
  firing = false;
  hideWaveAnnounce();
  showGameOver(wave);
}

// Wave WIN_WAVE cleared: the rig held. The run stops here, with the time it took.
function winGame() {
  won = true;
  waveInProgress = false;
  firing = false;
  hideWaveAnnounce();
  updateUI({ wave, hp: baseHp, maxHp: maxHpNow });
  showWin(wave, runTime);
}

function restart() {
  for (const drone of drones) scene.remove(drone.mesh);
  for (const shot of shots) scene.remove(shot.mesh);
  drones.length = 0;
  shots.length = 0;

  resetAbilities();
  resetAbilityCooldowns();
  resetWalls();
  baseHp = BASE_HP;
  wave = START_WAVE;
  gameOver = false;
  won = false;
  runStarted = true;
  runTime = 0;
  firing = false;
  fireCooldown = 0;
  enemiesRemaining = 0;
  waveCorners = [];
  cornerCursor = 0;
  spawnTimer = 0;

  hideGameOver();
  hideWin();
  hideStartScreen();
  beginWavePause(START_WAVE); // a fresh pause, then the first wave (START_WAVE, for testing)
  updateUI({ wave, hp: baseHp, maxHp: maxHpNow });
}

// --- ?fps: a small readout in the corner, off unless the URL asks for it ---
const showFps = new URLSearchParams(location.search).has('fps');
const fpsEl = document.getElementById('fps');
if (showFps && fpsEl) fpsEl.hidden = false;

let fpsFrames = 0;
let fpsSeconds = 0;

function updateFps(frameSeconds) {
  if (!showFps || !fpsEl) return;
  fpsFrames += 1;
  fpsSeconds += frameSeconds;
  if (fpsSeconds < 0.5) return; // a new number twice a second is plenty
  fpsEl.textContent = `${Math.round(fpsFrames / fpsSeconds)} FPS`;
  fpsFrames = 0;
  fpsSeconds = 0;
}

// --- Load the models, then go ---
const loadingEl = document.getElementById('loading');

function loadModels() {
  return Promise.all([
    gltfLoader.loadAsync('./assets/base.glb'),
    gltfLoader.loadAsync('./assets/tower.glb'),
    gltfLoader.loadAsync('./assets/gargoyle.glb'),
    gltfLoader.loadAsync('./assets/troll.glb'),
  ]);
}

// Begin the first run after the player clicks or presses Space through the title screen.
function startRun() {
  if (runStarted) return;
  runStarted = true;
  hideStartScreen();
  beginWavePause(START_WAVE);
}

async function start() {
  const [baseGltf, towerGltf, gargoyleGltf, trollGltf] = await loadModels();

  const base = baseGltf.scene;  // 8 x 8, bottom face at y = 0, deck top at y = 1
  base.position.set(0, 0, 0);
  scene.add(base);

  const tower = towerGltf.scene;        // loaded medieval stone tower
  turret.add(tower);
  gargoyleModel = gargoyleGltf.scene;   // every enemy is a gargoyle; red ones get tinted eyes
  trollModel = trollGltf.scene;         // the boss is a troll

  if (loadingEl) loadingEl.hidden = true;

  initUI();
  updateUI({ wave, hp: baseHp, maxHp: maxHpNow });
  updateAbilityHUD({ bomb: 0, rapid: 0, heal: 0, rapidEndTime: 0 });
  updateWalls(wallsRemaining);
  showStartScreen();               // wait for the player to click / press Space
  lastFrameTime = performance.now(); // so the first frame's delta is not the whole load time
  renderer.setAnimationLoop(frame);
}

start().catch((error) => {
  console.error('Could not load the game models.', error);
  if (loadingEl) loadingEl.textContent = 'Could not load the game models. Check the console, then refresh.';
});

// Frame timing by hand: THREE.Clock is deprecated in three 0.186 and logs a console warning.
let lastFrameTime = 0;

function frame() {
  const now = performance.now();
  const frameSeconds = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  const dt = Math.min(frameSeconds, 0.05); // ignore huge gaps, e.g. after a hidden tab
  updateFps(frameSeconds);

  updateAim();
  if (!gameOver && !won && runStarted) {
    runTime += dt;     // the run clock; it stops the moment the run ends either way
    updateWaves(dt);
    updateSpawning(dt);
    if (waveInProgress) updateFiring(dt); // no shooting during the pause
    updateShots(dt);   // shots first, so a hit pops the drone on the same frame
    updateDrones(dt);
    updateAbilities(dt);
  }

  renderer.render(scene, camera);
}
