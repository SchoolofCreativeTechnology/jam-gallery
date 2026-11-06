// particles.js — one-shot break bursts: a small puff of glowing specks thrown from a world point, then disposed.
// main.js ticks updateBursts(dt) every frame; duel.js spawns one burst on the frame a stalk snaps.
import * as THREE from 'three';
import {
  BURST_PARTICLES, BURST_LIFETIME, BURST_SIZE, BURST_SHRINK, BURST_SPEED, BURST_SPEED_MIN,
  BURST_SPEED_JITTER, BURST_SPREAD, BURST_GRAVITY, BURST_SPIN, BURST_ADDITIVE, BURST_PLAYER_COLOR,
} from './tuning.js';

// One tiny cube, shared by every speck of every burst; only the per-burst material and the
// per-particle instance matrices are new each time, so a burst costs almost no allocation.
const speckGeometry = new THREE.BoxGeometry(1, 1, 1);

const bursts = [];                 // live bursts, oldest first
const scratch = new THREE.Object3D();   // reused to compose each speck's matrix

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// A burst position may arrive as a THREE.Vector3 or as [x, y, z].
function placeAt(object, position) {
  if (Array.isArray(position)) object.position.set(position[0] || 0, position[1] || 0, position[2] || 0);
  else if (position) object.position.set(position.x || 0, position.y || 0, position.z || 0);
  else object.position.set(0, 0, 0);
}

function writeMatrix(burst, i, size) {
  const p = i * 3;
  scratch.position.set(burst.local[p], burst.local[p + 1], burst.local[p + 2]);
  scratch.rotation.set(
    burst.spin[p] * burst.age,
    burst.spin[p + 1] * burst.age,
    burst.spin[p + 2] * burst.age,
  );
  scratch.scale.setScalar(size);
  scratch.updateMatrix();
  burst.mesh.setMatrixAt(i, scratch.matrix);
}

function disposeBurst(burst) {
  if (burst.mesh.parent) burst.mesh.parent.remove(burst.mesh);
  burst.mesh.dispose();      // frees this burst's instance buffers; the shared geometry is untouched
  burst.material.dispose();
}

// Spawns one burst of tiny specks at `position` (world units) in `color`, and returns it.
export function createBreakBurst(scene, position, color) {
  if (!scene) return null;

  const count = Math.max(1, Math.floor(Number(BURST_PARTICLES) || 30));
  const life = Math.max(0.05, Number(BURST_LIFETIME) || 0.75);
  const size = Math.max(0.001, Number(BURST_SIZE) || 0.02);
  const spread = Math.max(0, Number(BURST_SPREAD) || 0);
  const speed = Math.max(0, Number(BURST_SPEED) || 0);
  const speedMin = clamp(Number(BURST_SPEED_MIN) || 0, 0, 1);
  const speedJitter = Math.max(0, Number(BURST_SPEED_JITTER) || 0);
  const spin = Math.max(0, Number(BURST_SPIN) || 0);

  const material = new THREE.MeshBasicMaterial({
    color: color || BURST_PLAYER_COLOR,
    transparent: true,
    opacity: 1,
    depthWrite: false,          // specks are additive glints, not solid geometry
    toneMapped: false,
    blending: BURST_ADDITIVE ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const mesh = new THREE.InstancedMesh(speckGeometry, material, count);
  mesh.name = 'break-burst';
  mesh.frustumCulled = false;   // the specks fly out of the burst's own bounds, so never cull the group
  placeAt(mesh, position);

  const local = new Float32Array(count * 3);
  const velocity = new Float32Array(count * 3);
  const tumble = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const p = i * 3;
    // Start inside a small cloud, so the burst has body instead of firing from a single point.
    local[p] = (Math.random() * 2 - 1) * spread;
    local[p + 1] = (Math.random() * 2 - 1) * spread;
    local[p + 2] = (Math.random() * 2 - 1) * spread;

    // An even direction on the sphere: uniform in cos(theta) so no pole gets crowded.
    const cosTheta = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const ring = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const v = speed * (speedMin + Math.random() * speedJitter);
    velocity[p] = Math.cos(phi) * ring * v;
    velocity[p + 1] = cosTheta * v;
    velocity[p + 2] = Math.sin(phi) * ring * v;

    tumble[p] = (Math.random() * 2 - 1) * spin;
    tumble[p + 1] = (Math.random() * 2 - 1) * spin;
    tumble[p + 2] = (Math.random() * 2 - 1) * spin;
  }

  const burst = { mesh, material, local, velocity, spin: tumble, count, age: 0, life, size, shrink: clamp(Number(BURST_SHRINK) || 0.35, 0, 1) };
  for (let i = 0; i < count; i++) writeMatrix(burst, i, size);   // correct on the first frame too
  mesh.instanceMatrix.needsUpdate = true;

  scene.add(mesh);
  bursts.push(burst);
  return burst;
}

// Advances every live burst; faded-out bursts remove themselves from the scene and are disposed.
export function updateBursts(dt) {
  if (bursts.length === 0) return;
  const step = clamp(Number(dt) || 0, 0, 0.1);

  for (let b = bursts.length - 1; b >= 0; b--) {
    const burst = bursts[b];
    burst.age += step;
    const k = burst.life > 0 ? burst.age / burst.life : 1;
    if (k >= 1) {
      disposeBurst(burst);
      bursts.splice(b, 1);
      continue;
    }

    const fade = 1 - k;
    const size = burst.size * (burst.shrink + (1 - burst.shrink) * fade);
    const drag = 1 - 0.6 * step;   // the specks slow as they fly, so the puff hangs before it falls
    for (let i = 0; i < burst.count; i++) {
      const p = i * 3;
      burst.velocity[p] *= drag;
      burst.velocity[p + 1] = burst.velocity[p + 1] * drag - BURST_GRAVITY * step;
      burst.velocity[p + 2] *= drag;
      burst.local[p] += burst.velocity[p] * step;
      burst.local[p + 1] += burst.velocity[p + 1] * step;
      burst.local[p + 2] += burst.velocity[p + 2] * step;
      writeMatrix(burst, i, size);
    }
    burst.mesh.instanceMatrix.needsUpdate = true;
    burst.material.opacity = fade;
  }
}

// Kill every live burst at once (a restart should not leave specks in the air).
export function clearBursts() {
  for (const burst of bursts) disposeBurst(burst);
  bursts.length = 0;
}

export default createBreakBurst;
