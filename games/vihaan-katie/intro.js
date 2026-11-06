// intro.js — the game's two third-person shots of the cat: walking down the coach on the way in, and
// again on the way out. The player never sees the cat anywhere else, so both shots end by easing the
// camera onto the player's own eye, and both fade the cat out before they hand the camera back.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAMERA, CAT_SHOT, COACH_BOUNDS, COACH_DIMS } from './tuning.js';

// --- THE CAT ----------------------------------------------------------------------------------------
// A small dark cat, origin at its feet, facing -z: down the aisle, toward the front door. Box sizes are
// metres, and nose to tail the primitives span about CAT.length. It is mostly seen from behind.
// The real model is one static mesh, 1.9 units tall out of Blender with no skeleton and no legs; it is
// loaded in the background below and swapped in for these boxes the moment it arrives. The boxes are what
// the shot walks until then, and what it keeps if the GLB is missing: the error path only warns.
const CAT_PATH = 'assets/models/cat.glb';
const CAT = {
  length: 0.9,
  colour: '#2b2420',
  eyeColour: '#e8d79a',
  eyeGlow: 0.9,
  modelYaw: Math.PI,     // the GLBs leave Blender facing +z, so a half turn points the cat down the aisle
  legThickness: 0.045,
  legLength: 0.22,
  legX: 0.055,
  legZ: 0.22,
};

// head, ears, eyes and tail sit off the ends of the body, placed off CAT.length rather than by hand
const CAT_PARTS = {
  body: { size: [0.18, 0.2, 0.62], at: [0, 0.32, 0] },
  head: { size: [0.17, 0.16, 0.16], at: [0, 0.43, -(CAT.length / 2 - 0.11)] },
  ear: { size: [0.05, 0.07, 0.02], at: [0.05, 0.535, -(CAT.length / 2 - 0.12)] },
  eye: { size: [0.028, 0.024, 0.012], at: [0.047, 0.45, -(CAT.length / 2 - 0.02)] },
  tail: { size: [0.05, 0.05, 0.26], at: [0, 0.4, CAT.length / 2 - 0.07], tilt: -0.5 },
};

// Which hip swings with which: front-left pairs with rear-right, and the other diagonal is half a cycle
// behind. The order matches the leg positions built below.
const LEG_PHASE = [0, Math.PI, Math.PI, 0];

// --- THE WALK ---------------------------------------------------------------------------------------
// The gait is driven by a phase accumulator fed by distance covered, never by the clock, so it looks the
// same at any frame rate and stops when the cat does. tuning.js writes the gait in shares of the cat's
// height, so the two lengths the body motion actually needs are worked out here, once, in metres.
const GAIT = {
  ramp: CAT_SHOT.gait.ramp,
  legSwing: CAT_SHOT.gait.legSwing,
  sharp: CAT_SHOT.gait.bobSharp,
  sway: CAT_SHOT.gait.sway, // a roll is an angle: the head already tips in proportion to the height
  stride: CAT_SHOT.gait.stride * CAT_SHOT.height, // ground per full left-right cycle, in metres
  bob: CAT_SHOT.gait.bob * CAT_SHOT.height,       // rise at each mid-stance, in metres
};

// How far up the body is through the cycle. |sin| gives the right number of rises (two per cycle, one per
// step, and zero at each contact); raising it to a power below 1 squeezes the shape towards the top, so
// the drop into a contact is steep and the body pushes straight back off it. At a power of 1 this is a
// plain sine, which reads as the cat being carried along instead of walking.
const bobAt = (phase) => Math.abs(Math.sin(phase)) ** GAIT.sharp;

// Third person: the camera trails the cat down the aisle, then lifts and pushes in onto the player's own
// eye. CAMERA_YAW is the yaw the player starts with, so the cut to first person is not a jump. The aim
// point is `lookHeight` shares of a cat up from the floor, so a taller cat is framed the same way.
const CAMERA_OFFSET = {
  back: CAT_SHOT.camera.back,
  height: CAT_SHOT.camera.height,
  lookAhead: CAT_SHOT.camera.lookAhead,
  lookHeight: CAT_SHOT.camera.lookHeight * CAT_SHOT.height,
};
const CAMERA_YAW = 0;
const FOLLOW_PITCH = -Math.atan2(
  CAMERA_OFFSET.height - CAMERA_OFFSET.lookHeight,
  CAMERA_OFFSET.back + CAMERA_OFFSET.lookAhead,
);

// `in` boards the train and `out` leaves it. startZ is the cat's feet, so the rear of the coach sits
// CAMERA_OFFSET.back behind it and the camera itself stays clear of the rear wall at z = 12.
const SHOTS = { in: CAT_SHOT.in, out: CAT_SHOT.out };

// The cat keeps to the centre line and stops more than half its own length short of either end wall, so
// neither its nose nor its tail can pass through one. The benches are a metre off the aisle each side.
const CAT_MARGIN = 0.6;
const CAT_MIN_Z = CAT_MARGIN;
const CAT_MAX_Z = COACH_DIMS.length - CAT_MARGIN;

// --- MODEL ------------------------------------------------------------------------------------------
// Loaded once in the background, the way coach.js loads its foxes. Until it arrives every shot walks the
// box cat, and if the GLB is missing the boxes are simply what you keep: the error path only warns.
let catTemplate = null;
if (CAT_PATH) {
  new GLTFLoader().load(CAT_PATH, (gltf) => {
    catTemplate = gltf.scene;
  }, undefined, () => console.warn(`Model missing, the box cat is used: ${CAT_PATH}`));
}

// --- HELPERS ----------------------------------------------------------------------------------------
const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

// Smoothstep, so the camera settles onto the player's eye instead of arriving with a bump.
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

// The cat eases up to its pace, holds it evenly, then eases to a stop as the camera takes over.
function speedAt(t, shot) {
  if (t < GAIT.ramp) return shot.speed * smooth(t / GAIT.ramp);
  if (t < shot.walk) return shot.speed;
  return shot.speed * (1 - smooth((t - shot.walk) / shot.blend));
}

// Opacity is the only thing that changes frame to frame, so a material stays opaque (depth writing, no
// sorting) until the fade begins, and goes back to opaque if a fade is undone. The flag only changes at
// those two moments, so the shader is recompiled at most twice in a shot rather than never.
function fadeMaterial(material, value) {
  const fading = value < 1;
  if (material.transparent !== fading) {
    material.transparent = fading;
    material.needsUpdate = true;
  }
  material.opacity = value;
}

// One unit cube scaled by each part, so the whole cat is a handful of meshes off one geometry.
function catPart(parent, geometry, material, size, at, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...at);
  mesh.scale.set(...size);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// The fallback cat. Its geometry and materials are its own, so `dispose` can free them; `hips` are the
// leg pivots the walk rotates.
function buildPrimitiveCat() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  // Opaque, and only made transparent by fadeMaterial when the shot actually starts fading: a material
  // that is transparent from the start writes no depth and gets sorted, which shows a cat its own insides.
  const fur = new THREE.MeshStandardMaterial({
    name: 'cat-fur', color: CAT.colour, roughness: 0.92, metalness: 0,
  });
  const eyes = new THREE.MeshStandardMaterial({
    name: 'cat-eyes', color: CAT.eyeColour, emissive: new THREE.Color(CAT.eyeColour),
    emissiveIntensity: CAT.eyeGlow, roughness: 0.5, metalness: 0,
  });

  const root = new THREE.Group();
  root.name = 'cat-body';
  catPart(root, geometry, fur, CAT_PARTS.body.size, CAT_PARTS.body.at, 'cat-torso');
  catPart(root, geometry, fur, CAT_PARTS.head.size, CAT_PARTS.head.at, 'cat-head');
  const tail = catPart(root, geometry, fur, CAT_PARTS.tail.size, CAT_PARTS.tail.at, 'cat-tail');
  tail.rotation.x = CAT_PARTS.tail.tilt;
  for (const side of [1, -1]) {
    const at = CAT_PARTS.ear.at;
    catPart(root, geometry, fur, CAT_PARTS.ear.size, [side * at[0], at[1], at[2]], 'cat-ear');
    catPart(root, geometry, eyes, CAT_PARTS.eye.size, [side * CAT_PARTS.eye.at[0], CAT_PARTS.eye.at[1], CAT_PARTS.eye.at[2]], 'cat-eye');
  }

  // Each leg hangs from a hip pivot, so the swing is a rotation at the joint rather than a slide.
  const legAt = [[CAT.legX, CAT.legZ], [-CAT.legX, CAT.legZ], [CAT.legX, -CAT.legZ], [-CAT.legX, -CAT.legZ]];
  const hips = legAt.map(([x, z], i) => {
    const hip = new THREE.Group();
    hip.name = `cat-hip-${i}`;
    hip.position.set(x, CAT.legLength, z);
    catPart(hip, geometry, fur, [CAT.legThickness, CAT.legLength, CAT.legThickness], [0, -CAT.legLength / 2, 0], `cat-leg-${i}`);
    root.add(hip);
    return hip;
  });

  return { root, hips, materials: [fur, eyes], geometries: [geometry] };
}

// The GLB, fitted to the cat's height and stood on its feet. Its geometries belong to the shared
// template, so only the cloned materials are this shot's to free. It is fitted rather than scaled by a
// number because the export is 1.9 units tall: measuring it keeps the scale right if it is re-exported.
function buildModelCat(template) {
  const model = template.clone(true);
  model.rotation.y = CAT.modelYaw;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const span = bounds.isEmpty() ? 0 : bounds.max.y - bounds.min.y;
  const scale = span > 0 ? CAT_SHOT.height / span : 1;
  model.scale.setScalar(scale);
  model.position.y = -bounds.min.y * scale; // the origin sits at the feet, give or take; this puts them on the floor

  const holder = new THREE.Group();
  holder.name = 'cat-body';
  holder.add(model);

  const materials = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    // Cloned, so fading this shot never dims the template the other shot clones from. Left opaque: the
    // model is double sided, and a transparent material writes no depth, so the cat would show its own
    // back faces and backpack through its chest for the whole walk. Only a fade needs transparency, and
    // fadeMaterial switches it on then.
    const material = child.material.clone();
    child.material = material;
    materials.push(material);
  });
  return { root: holder, hips: null, materials, geometries: [] };
}

// --- THE SHOT ---------------------------------------------------------------------------------------
// Returns { update, skip, dispose }. `update` owns the camera while it returns true, and calls onDone
// once when it hands the camera back; `skip` does the same immediately. onDone is passed the pose the cat
// stopped on — { x, z, yaw } — so the player can be stood exactly where the camera already is.
export function createWalkShot({ scene, camera, kind, onDone }) {
  const shot = SHOTS[kind] || SHOTS.in;
  const total = shot.walk + shot.blend;
  const aisleX = (COACH_BOUNDS.minX + COACH_BOUNDS.maxX) / 2; // the aisle is the coach centre line

  let stage = buildPrimitiveCat();
  let fadeMaterials = stage.materials;
  let bobTarget = stage.root;
  let time = 0;
  let catZ = Math.min(CAT_MAX_Z, Math.max(CAT_MIN_Z, shot.startZ));
  let phase = 0;
  let opacity = 1;
  let finished = false;
  let disposed = false;

  const cat = new THREE.Group();
  cat.name = 'intro-cat';
  cat.position.set(aisleX, 0, catZ);
  cat.add(stage.root);
  scene.add(cat);

  // Fades the cat itself rather than the screen: it is the only thing that has to be gone by the time
  // the player is looking through its eyes.
  function setFade(value) {
    if (Math.abs(value - opacity) < 0.002) return;
    opacity = value;
    for (const material of fadeMaterials) fadeMaterial(material, value);
  }

  function hideCat() {
    cat.visible = false;
  }

  // The whole walk, and it has to be the whole walk: the model cat has no legs, so this rise and roll is
  // all that says "walking" rather than "sliding". `ease` damps it to nothing as the cat slows to a stop.
  function pose(speed) {
    const ease = clamp01(speed / shot.speed);
    cat.position.z = catZ;
    bobTarget.position.y = bobAt(phase) * GAIT.bob * ease;
    cat.rotation.z = Math.sin(phase) * GAIT.sway * ease;
    // The boxes have legs, so they get to swing them as well. The model returns here every frame.
    if (!stage.hips) return;
    for (let i = 0; i < stage.hips.length; i += 1) {
      stage.hips[i].rotation.x = Math.sin(phase + LEG_PHASE[i]) * GAIT.legSwing * ease;
    }
  }

  // Trail the cat, then ease onto the player's eye: aisle centre line, CAMERA.height, level and facing
  // down the aisle, which is where main.js puts the camera on the next frame.
  function placeCamera(t) {
    const k = smooth((t - shot.walk) / shot.blend);
    const followZ = catZ + CAMERA_OFFSET.back;
    camera.position.set(
      aisleX,
      CAMERA_OFFSET.height + (CAMERA.height - CAMERA_OFFSET.height) * k,
      followZ + (catZ - followZ) * k,
    );
    camera.rotation.set(FOLLOW_PITCH * (1 - k), CAMERA_YAW, 0, 'YXZ');
  }

  // Set before the first update, so frame one is already framed rather than waiting for a step.
  pose(0);
  placeCamera(0);

  // Swaps the boxes for the GLB the moment it arrives, mid-shot if that is when it lands.
  function adoptModel() {
    if (!catTemplate || stage.hips === null) return;
    const next = buildModelCat(catTemplate);
    const previous = stage;
    stage = next;
    cat.remove(previous.root);
    for (const material of previous.materials) material.dispose();
    for (const geometry of previous.geometries) geometry.dispose();
    // A shot that is already fading when the model lands hands its fade straight on to the new materials.
    for (const material of next.materials) fadeMaterial(material, opacity);
    fadeMaterials = next.materials;
    bobTarget = next.root;
    cat.add(next.root);
  }

  // Hands back where the cat actually stopped, so main.js can stand the player there and the cut to first
  // person lands on the eye the camera is already at. Exact by construction: nothing to keep in step.
  function settle() {
    if (finished) return;
    finished = true; // set first, so a re-entrant call cannot fire onDone twice
    if (typeof onDone === 'function') onDone({ x: aisleX, z: catZ, yaw: CAMERA_YAW });
  }

  function update(dt) {
    if (disposed || finished) return false;
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    time = Math.min(time + step, total);
    adoptModel();

    const speed = speedAt(time, shot);
    catZ = Math.min(CAT_MAX_Z, Math.max(CAT_MIN_Z, catZ - speed * step));
    phase += (speed * step) / GAIT.stride * Math.PI * 2;
    pose(speed);
    placeCamera(time);
    setFade(clamp01((total - time) / shot.fade));

    if (time >= total) {
      setFade(0); // the player is about to be inside the cat, so it must be gone
      hideCat();
      settle();
      return false;
    }
    return true;
  }

  // Ends the shot at once. The camera is left where it is: main.js owns it from the next frame.
  function skip() {
    if (disposed || finished) return;
    setFade(0);
    hideCat();
    settle();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(cat);
    for (const material of stage.materials) material.dispose();
    for (const geometry of stage.geometries) geometry.dispose();
    stage.materials.length = 0;
    stage.geometries.length = 0;
  }

  return { update, skip, dispose };
}

// A cat on its own, for a shot other than the two aisle walks: the box cat now, swapped for the GLB the
// moment it lands, and the same rise-and-roll gait. The caller owns placing `root` in the scene and
// calling `pose` and `dispose`; `stride` is the ground covered per full gait cycle, so the caller turns
// distance walked into the phase angle. This adds nothing to the two walk shots above.
export function createCat() {
  let stage = buildPrimitiveCat();
  let bobTarget = stage.root;
  const root = new THREE.Group();
  root.name = 'cat';
  root.add(stage.root);

  return {
    root,
    stride: GAIT.stride,

    // Swaps the boxes for the GLB if it has arrived, exactly as the walk shots do mid-shot.
    adoptModel() {
      if (!catTemplate || stage.hips === null) return;
      const next = buildModelCat(catTemplate);
      const previous = stage;
      stage = next;
      root.remove(previous.root);
      for (const material of previous.materials) material.dispose();
      for (const geometry of previous.geometries) geometry.dispose();
      bobTarget = next.root;
      root.add(next.root);
    },

    // The same walk the aisle shots use: `phase` is a gait angle and `ease` (0..1) damps it to nothing as
    // the cat slows. The model cat has no legs, so the body carries the whole walk.
    pose(phase, ease) {
      bobTarget.position.y = bobAt(phase) * GAIT.bob * ease;
      root.rotation.z = Math.sin(phase) * GAIT.sway * ease;
      if (!stage.hips) return;
      for (let i = 0; i < stage.hips.length; i += 1) {
        stage.hips[i].rotation.x = Math.sin(phase + LEG_PHASE[i]) * GAIT.legSwing * ease;
      }
    },

    // Only this cat's own materials and geometries — a model cat's geometry belongs to the shared
    // template and is deliberately left alone.
    dispose() {
      for (const material of stage.materials) material.dispose();
      for (const geometry of stage.geometries) geometry.dispose();
      stage.materials.length = 0;
      stage.geometries.length = 0;
    },
  };
}
