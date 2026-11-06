// ending.js — the winning shot. The coach world is hidden and this midday field takes its place: the cat
// walks out of the carriage and across green grass toward a small house with one lit window. It returns
// the same { update, skip, dispose } contract as intro.js's walk shots, and if anything throws it hands
// straight over to onDone, so a player is never left stranded on a black screen.

import * as THREE from 'three';
import { ENDING } from './tuning.js';
import { createCat } from './intro.js';

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function createEndingShot({ scene, camera, onDone }) {
  const previousBackground = scene.background;
  const previousFog = scene.fog;

  const world = new THREE.Group();
  world.name = 'ending-world';

  // --- GROUND, SUN, SKY LIGHT -----------------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ENDING.ground.size, ENDING.ground.size),
    new THREE.MeshStandardMaterial({
      name: 'ending-grass', color: ENDING.ground.color, roughness: ENDING.ground.roughness, metalness: 0,
    }),
  );
  ground.name = 'ending-grass';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);

  const fill = new THREE.HemisphereLight(ENDING.fill.sky, ENDING.fill.ground, ENDING.fill.intensity);
  fill.name = 'ending-fill';
  const sun = new THREE.DirectionalLight(ENDING.sun.color, ENDING.sun.intensity);
  sun.name = 'ending-sun';
  sun.position.set(...ENDING.sun.position);
  sun.target.position.set(...ENDING.sun.target);
  world.add(fill, sun, sun.target);

  // --- THE HOUSE ------------------------------------------------------------------------------------
  const h = ENDING.house;
  const house = new THREE.Group();
  house.name = 'ending-house';
  house.position.set(...h.at);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(...h.body),
    new THREE.MeshStandardMaterial({ name: 'ending-house-wall', color: h.bodyColor, roughness: 0.9, metalness: 0 }),
  );
  body.position.y = h.body[1] / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  house.add(body);

  // A four-sided cone is a pitched roof: its corners face the axes by default, so a quarter turn squares
  // it up over the walls.
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(h.roofRadius, h.roofHeight, 4),
    new THREE.MeshStandardMaterial({
      name: 'ending-house-roof', color: h.roofColor, roughness: 0.85, metalness: 0, flatShading: true,
    }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h.body[1] + h.roofHeight / 2;
  roof.castShadow = true;
  house.add(roof);

  // The one warm lit window, on the face toward the camera, and a small light so it spills onto the wall.
  const windowZ = h.body[2] / 2 + 0.02;
  const litWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(...h.window),
    new THREE.MeshStandardMaterial({
      name: 'ending-window', color: h.windowColor, emissive: new THREE.Color(h.windowColor),
      emissiveIntensity: h.windowGlow, roughness: 0.6, metalness: 0,
    }),
  );
  litWindow.position.set(h.windowAt[0], h.windowAt[1], windowZ);
  house.add(litWindow);
  const lamp = new THREE.PointLight(new THREE.Color(h.windowColor), h.windowLight.intensity, h.windowLight.distance, 2);
  lamp.position.set(h.windowAt[0], h.windowAt[1], windowZ + 0.1);
  house.add(lamp);
  world.add(house);

  // --- THE CARRIAGE THE CAT WALKS AWAY FROM ---------------------------------------------------------
  const c = ENDING.carriage;
  const carriage = new THREE.Mesh(
    new THREE.BoxGeometry(c.width, c.height, c.depth),
    new THREE.MeshStandardMaterial({ name: 'ending-carriage', color: c.body, roughness: 0.85, metalness: 0 }),
  );
  carriage.name = 'ending-carriage';
  carriage.position.set(0, c.height / 2, c.frontZ + c.depth / 2);
  carriage.castShadow = true;
  world.add(carriage);

  const carriageRoof = new THREE.Mesh(
    new THREE.BoxGeometry(...c.roofSlab),
    new THREE.MeshStandardMaterial({
      name: 'ending-carriage-roof', color: c.roof, roughness: 0.8, metalness: 0.05, flatShading: true,
    }),
  );
  carriageRoof.position.set(0, c.height + c.roofSlab[1] / 2, c.frontZ + c.depth / 2 - 0.2);
  carriageRoof.castShadow = true;
  world.add(carriageRoof);

  // --- THE CAT --------------------------------------------------------------------------------------
  const cat = createCat();
  world.add(cat.root);

  // --- THE SHOT -------------------------------------------------------------------------------------
  let time = 0;
  let catZ = ENDING.startZ;
  let phase = 0;
  let finished = false;
  let disposed = false;

  // The same shape the aisle walks use: an ease-in, an even pace, an ease-out. Distance walked drives the
  // gait, so the walk looks the same at any frame rate and stops when the cat does.
  function speedAt(t) {
    if (t < ENDING.ramp) return ENDING.speed * smooth(t / ENDING.ramp);
    if (t < ENDING.walk) return ENDING.speed;
    return ENDING.speed * (1 - smooth((t - ENDING.walk) / ENDING.blend));
  }

  // Trails the cat from behind and to its right, drifting in and lifting as it goes: the carriage slides
  // out of frame and the field and the house take its place.
  function placeCamera(t) {
    const k = smooth(t / ENDING.duration);
    const cam = ENDING.camera;
    camera.position.set(
      cam.start[0] + (cam.end[0] - cam.start[0]) * k,
      cam.start[1] + (cam.end[1] - cam.start[1]) * k,
      catZ + cam.trail + cam.pull * k,
    );
    camera.lookAt(0, cam.lookHeight, catZ - cam.lookAhead);
  }

  function poseCat(speed) {
    cat.root.position.set(0, 0, catZ);
    cat.pose(phase, clamp01(speed / ENDING.speed));
  }

  function step(dt) {
    const amount = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    time = Math.min(time + amount, ENDING.duration);
    cat.adoptModel();
    const speed = speedAt(time);
    catZ = Math.max(ENDING.endZ, catZ - speed * amount);
    phase += (speed * amount) / cat.stride * Math.PI * 2;
    poseCat(speed);
    placeCamera(time);
    return time >= ENDING.duration;
  }

  // Frame one is already framed: the cat is placed and the camera is on it before the first update.
  poseCat(0);
  placeCamera(0);

  // The cut. Nothing above touched the scene on purpose: the sky and the fog go on, and the world goes in,
  // only once every mesh is built, so a throw while building leaves the coach world exactly as it was.
  try {
    scene.background = new THREE.Color(ENDING.sky);
    scene.fog = new THREE.Fog(ENDING.sky, ENDING.fog.near, ENDING.fog.far);
    scene.add(world);
  } catch (error) {
    scene.background = previousBackground;
    scene.fog = previousFog;
    scene.remove(world);
    throw error;
  }

  function settle() {
    if (finished) return;
    finished = true; // set first, so a re-entrant call can never fire onDone twice
    if (typeof onDone === 'function') onDone();
  }

  // Owns the camera while it returns true, and calls onDone exactly once. A throw anywhere in the shot
  // ends it there and then: the card must still come up.
  function update(dt) {
    if (disposed || finished) return false;
    let done = false;
    try {
      done = step(dt);
    } catch (error) {
      console.error('Ending shot failed, showing the card instead:', error);
      done = true;
    }
    if (done) { settle(); return false; }
    return true;
  }

  // Ends the shot at once, at the pose it would have ended on, and hands the camera back.
  function skip() {
    if (disposed || finished) return;
    catZ = ENDING.endZ;
    poseCat(0);
    placeCamera(ENDING.duration);
    settle();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    // The model cat shares its geometry with the template every shot loads from, so it is taken out of
    // the world before the sweep below: nothing may dispose it but createCat itself.
    world.remove(cat.root);
    cat.dispose();
    world.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
    scene.remove(world);
    scene.background = previousBackground;
    scene.fog = previousFog;
  }

  return { update, skip, dispose };
}
