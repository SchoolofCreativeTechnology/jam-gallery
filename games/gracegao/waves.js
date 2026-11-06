// Gentle waves: they spawn out in the sea, travel onto the wet sand, and knock the girl back.
import * as THREE from 'three';
import {
  WAVE_SPEED, WAVE_INTERVAL_MIN, WAVE_INTERVAL_MAX, WAVE_WIDTH_MIN, WAVE_WIDTH_MAX,
  WAVE_DEPTH, WAVE_SPAWN_OFFSET, WAVE_COLOR, WAVE_OPACITY, WAVE_REACH_Z,
  SEA_EDGE_Z, BEACH_WIDTH,
} from './tuning.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function createWaves(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // A thin sheet of water, a little wider than it is deep, so it reads as a wave on the sand.
  const geo = new THREE.BoxGeometry(1, 0.08, WAVE_DEPTH);
  const mat = new THREE.MeshStandardMaterial({
    color: WAVE_COLOR, transparent: true, opacity: WAVE_OPACITY, depthWrite: false,
  });

  let waves = [];   // { mesh, width, hit }
  let timer = 1;    // short grace before the first wave

  function spawn() {
    const width = rand(WAVE_WIDTH_MIN, WAVE_WIDTH_MAX);
    const half = Math.min(width, BEACH_WIDTH) / 2;
    const m = new THREE.Mesh(geo, mat);
    m.scale.x = width;
    m.position.set(rand(-half, half), 0.06, SEA_EDGE_Z - WAVE_SPAWN_OFFSET);
    group.add(m);
    waves.push({ mesh: m, width, hit: false });
  }

  function removeAt(i) {
    group.remove(waves[i].mesh);
    waves[i] = waves[waves.length - 1];
    waves.pop();
  }

  // SECTION: update — advance each wave; the front edge is what can catch her.
  function update(dt, player, onHit) {
    timer -= dt;
    if (timer <= 0) {
      spawn();
      timer = rand(WAVE_INTERVAL_MIN, WAVE_INTERVAL_MAX);
    }

    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.mesh.position.z += WAVE_SPEED * dt;
      const front = w.mesh.position.z + WAVE_DEPTH / 2;

      // She can only be caught out on the wet sand, and only once per wave.
      if (!w.hit && player.position.z <= WAVE_REACH_Z && front >= player.position.z) {
        if (Math.abs(player.position.x - w.mesh.position.x) <= w.width / 2 + player.radius) {
          w.hit = true;
          onHit(w.mesh.position.x, w.mesh.position.z);
        }
      }

      if (w.mesh.position.z - WAVE_DEPTH / 2 > WAVE_REACH_Z) removeAt(i);
    }
  }

  function reset() {
    for (const w of waves) group.remove(w.mesh);
    waves = [];
    timer = 1;
  }

  return { group, update, reset, count: () => waves.length };
}
