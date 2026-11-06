// Per-world lighting: one hemisphere ambient and one directional key light, rebuilt for each world from the
// `light` block in planets.js. It replaces the single fixed rig the scene used to carry, so four very different
// places stop being lit identically. No shadow maps: the lights cast none.

import * as THREE from 'three';
import * as T from './tuning.js';

// How far out along its bearing the key light is placed. A DirectionalLight is purely directional, so only the
// direction matters; the distance is just a convenient number to hang that direction on.
const KEY_DISTANCE = 100;

// Handles filled in by createLights() so applyLightLook() can repaint what it built. applyLightLook() is safe
// before createLights() has run: with no handles yet there is simply nothing to repaint.
let hemisphere = null;
let key = null;

// Place the key light by the same compass convention sky.js uses for the star (see skyPoint() there): `bearing`
// degrees left of straight ahead (negative is left, positive right), `elevation` degrees above the horizon, and
// the camera looking down -z, so -z is straight ahead, +x is right and +y is up.
function placeKey(light, look) {
  const bearing = THREE.MathUtils.degToRad(look.bearing);
  const elevation = THREE.MathUtils.degToRad(look.elevation);
  const flat = Math.cos(elevation) * KEY_DISTANCE;   // how far out it is across the ground, not along the slant
  light.position.set(Math.sin(bearing) * flat, Math.sin(elevation) * KEY_DISTANCE, -Math.cos(bearing) * flat);
}

// Build the lights once and hand them back for the scene to add. The default look is the shared fallback in
// tuning.js, so the title screen before a world is launched stays lit exactly as it always was.
export function createLights() {
  const group = new THREE.Group();
  const look = T.LIGHT_DEFAULT;
  hemisphere = new THREE.HemisphereLight(look.sky, look.ground, look.ambient);
  key = new THREE.DirectionalLight(look.key, look.keyIntensity);
  placeKey(key, look);
  group.add(hemisphere, key);
  return group;
}

// Repaint the lights for the world just launched: its own key colour, direction and intensity, and its own
// ambient. A world with no `light` block falls back to LIGHT_DEFAULT, so this is always safe to call.
export function applyLightLook(world) {
  if (!hemisphere || !key) return;   // nothing to repaint until createLights() has run
  const look = (world && world.light) || T.LIGHT_DEFAULT;
  hemisphere.color.set(look.sky);
  hemisphere.groundColor.set(look.ground);
  hemisphere.intensity = look.ambient;
  key.color.set(look.key);
  key.intensity = look.keyIntensity;
  placeKey(key, look);
}
