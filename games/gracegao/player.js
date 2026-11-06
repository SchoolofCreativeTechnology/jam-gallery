// The little girl: a GLB model (falling back to plain shapes), WASD/arrow movement, wave knockback.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  PLAYER_SPEED, PLAYER_RADIUS, KNOCKBACK_STRENGTH, KNOCKBACK_DURATION,
  KNOCKBACK_CONTROL, KNOCKBACK_DAMPING, MIN_X, MAX_X, MIN_Z, MAX_Z,
  PLAYER_START_X, PLAYER_START_Z, PLAYER_MODEL_URL, PLAYER_MODEL_HEIGHT, PLAYER_MODEL_YAW,
} from './tuning.js';

const MOVE_KEYS = {
  up: ['w', 'arrowup'],
  down: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
};

function mesh(geo, color) {
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
}

export function createPlayer(scene) {
  const group = new THREE.Group();

  // SECTION: the girl placeholder, built from a cone dress, a ball head and a straw hat.
  // A visible fallback if the GLB model is missing (or still loading).
  const dress = mesh(new THREE.ConeGeometry(0.45, 0.95, 16), '#ff9ec4');
  dress.position.y = 0.475;
  const head = mesh(new THREE.SphereGeometry(0.26, 16, 12), '#f7d3b0');
  head.position.y = 1.2;
  const brim = mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 20), '#f2d07a');
  brim.position.y = 1.34;
  const crown = mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.22, 16), '#f2d07a');
  crown.position.y = 1.45;
  const placeholder = new THREE.Group();
  placeholder.add(dress, head, brim, crown);
  group.add(placeholder);
  scene.add(group);

  // SECTION: try the real model. On success it replaces the placeholder and sets up animations.
  let mixer = null;
  const actions = {};
  let currentAction = null;

  new GLTFLoader().load(
    PLAYER_MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const size = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getSize(size);
      model.scale.setScalar(PLAYER_MODEL_HEIGHT / (size.y || 1));
      model.rotation.y = PLAYER_MODEL_YAW;
      model.updateMatrixWorld(true);
      model.position.y -= new THREE.Box3().setFromObject(model).min.y;   // feet on the sand
      group.remove(placeholder);
      group.add(model);

      mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        actions[clip.name] = mixer.clipAction(clip);
      }
      if (actions.idle) {
        currentAction = actions.idle;
        currentAction.play();
      }
    },
    undefined,
    () => {
      if (window.__glbFallbackLogged) return;
      window.__glbFallbackLogged = true;
      console.info('Girl model not found; using fallback shapes.');
    }
  );

  function playAnimation(name) {
    const next = actions[name];
    if (!next || next === currentAction) return;
    next.reset().fadeIn(0.15).play();
    if (currentAction) currentAction.fadeOut(0.15);
    currentAction = next;
  }

  // SECTION: input. We track held keys, so moving keys never scroll the page.
  const held = new Set();
  const isMoveKey = (k) => Object.values(MOVE_KEYS).some((keys) => keys.includes(k));
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (isMoveKey(k)) { held.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  addEventListener('blur', () => held.clear());
  const isDown = (names) => names.some((k) => held.has(k));

  // SECTION: state — position lives on the group; knockback is a decaying velocity.
  const knockVel = new THREE.Vector3();
  let knockTimer = 0;

  function update(dt) {
    let dx = 0;
    let dz = 0;
    if (isDown(MOVE_KEYS.up)) dz -= 1;
    if (isDown(MOVE_KEYS.down)) dz += 1;
    if (isDown(MOVE_KEYS.left)) dx -= 1;
    if (isDown(MOVE_KEYS.right)) dx += 1;
    if (dx || dz) {
      const len = Math.hypot(dx, dz);
      dx /= len; dz /= len;
      group.rotation.y = Math.atan2(dx, dz);
    }

    const control = knockTimer > 0 ? KNOCKBACK_CONTROL : 1;
    group.position.x += (dx * PLAYER_SPEED * control + knockVel.x) * dt;
    group.position.z += (dz * PLAYER_SPEED * control + knockVel.z) * dt;

    // Fade the push out so she comes to a stop instead of sliding forever.
    if (knockTimer > 0) {
      knockTimer -= dt;
      const damp = Math.exp(-KNOCKBACK_DAMPING * dt);
      knockVel.multiplyScalar(damp);
      if (knockTimer <= 0) knockVel.set(0, 0, 0);
    }

    // SECTION: animation state — idle when still, walk when moving.
    const moving = dx !== 0 || dz !== 0 || knockVel.lengthSq() > 0.001;
    playAnimation(moving ? 'walk' : 'idle');
    if (mixer) mixer.update(dt);

    // SECTION: keep her on the beach.
    group.position.x = Math.min(MAX_X - PLAYER_RADIUS, Math.max(MIN_X + PLAYER_RADIUS, group.position.x));
    group.position.z = Math.min(MAX_Z - PLAYER_RADIUS, Math.max(MIN_Z + PLAYER_RADIUS, group.position.z));
  }

  // SECTION: knockback — push her directly away from whatever hit her.
  function knockback(fromX, fromZ) {
    const dx = group.position.x - fromX;
    const dz = group.position.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    knockVel.set((dx / len) * KNOCKBACK_STRENGTH, 0, (dz / len) * KNOCKBACK_STRENGTH);
    knockTimer = KNOCKBACK_DURATION;
  }

  function reset() {
    group.position.set(PLAYER_START_X, 0, PLAYER_START_Z);
    group.rotation.y = 0;
    knockVel.set(0, 0, 0);
    knockTimer = 0;
  }
  reset();

  return { group, position: group.position, radius: PLAYER_RADIUS, update, knockback, reset };
}
