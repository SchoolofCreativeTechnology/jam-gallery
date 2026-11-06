// Low-tide clock: the bar fills over time, then the sea rises and covers the beach.
import * as THREE from 'three';
import {
  LOW_TIDE_DURATION, TIDE_RISE_DURATION, LOW_WATER_Y, HIGH_WATER_Y, SEA_COLOR,
} from './tuning.js';

export function createTide(scene) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: SEA_COLOR, transparent: true, opacity: 0.9 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = LOW_WATER_Y;
  scene.add(water);

  let progress = 0;
  let full = false;
  let riseT = 0;

  // SECTION: update — fill the low-tide bar, then raise the water over the sand.
  // main.js watches `full` and reacts to the change; there is no callback to forget.
  function update(dt) {
    if (!full) {
      progress = Math.min(1, progress + dt / LOW_TIDE_DURATION);
      if (progress >= 1) full = true;
      return;
    }
    if (riseT < 1) {
      riseT = Math.min(1, riseT + dt / TIDE_RISE_DURATION);
      const ease = riseT * riseT * (3 - 2 * riseT);   // smooth step
      water.position.y = LOW_WATER_Y + (HIGH_WATER_Y - LOW_WATER_Y) * ease;
    }
  }

  function reset() {
    progress = 0;
    full = false;
    riseT = 0;
    water.position.y = LOW_WATER_Y;
  }

  return {
    water, update, reset,
    get progress() { return progress; },
    get full() { return full; },
  };
}
