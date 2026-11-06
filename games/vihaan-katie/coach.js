// One convincing coach: the baseline node list, the meshes it builds into, and the two door spots.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  BENCH, BRASS, COACH_DIMS, COACH_GEOMETRY, GLASS, LAMP, PALETTE, PASSENGER_IDLE, PASSENGER_MODELS,
  PASSENGER_Y, PASSENGERS, RACK, WINDOW, WOOD,
} from './tuning.js';
import { PROP_NODES, buildPropNode, PROP_KINDS } from './props.js';

const { width, length, height } = COACH_DIMS;
const g = COACH_GEOMETRY;
const HALF_LENGTH = length / 2;

// Seven grab handles hanging on the coach centreline, evenly spaced front to back. Each one is its own
// baseline node, so an anomaly can swing it: the node's scale carries the bar length, the strap drop and
// the bar thickness. firstZ/lastZ are the ends of the line the straps hang along.
const HANDLE = {
  count: 7, drop: 0.55, barLength: 0.34, barThickness: 0.025,
  strapWidth: 0.03, strapDepth: 0.01, firstZ: 1.5, lastZ: length - 1.5,
};

// The suitcase on the right-hand rack. RACK_DECK_Y is the top face of the rack slats, so the baseline
// rests the case ON the rack: the floating-luggage anomaly then reads as a lift, not a nudge.
const LUGGAGE = { size: [0.42, 0.26, 0.32], colour: '#4b3323', x: 1.225, z: 4.5, sink: 0.005 };
const RACK_DECK_Y = height - RACK.drop + RACK.slatSize / 2;

// Plain props (the suitcase) are one box in their node's colour: matte, barely metal.
const PROP = { roughness: 0.65, metalness: 0.03 };

// `kind` tells buildScene how to read a node: side walls become panels with window gaps, end walls get a
// door and a handle, the bench and the lamp get their fittings. IDs and colours are what the catalogue targets.
const node = (id, kind, position, scale, color) => ({
  id, kind, position, rotation: [0, 0, 0], scale, visible: true, color, asset: null,
});

// A passenger node from its seat in tuning.js: standing on the floor at the bench's aisle edge and turned
// across the aisle (the models leave Blender facing +z, so the left bench gets +PI/2, the right -PI/2).
// `asset` is that passenger's own model; the yokai anomalies swap it for the burst-open one.
const passenger = ({ id, species, x, z, yaw, scale }, color) => ({
  ...node(id, 'passenger', [x, PASSENGER_Y, z], [scale, scale, scale], color),
  rotation: [0, yaw, 0],
  asset: PASSENGER_MODELS[species].normal,
});

// Units are metres; node scale is the box's full size, so buildScene can use one unit cube for all of them.
// A handle node is the exception: its scale carries the bar length, the strap drop and the bar thickness.
export const BASELINE = [
  node('floor', 'floor', [0, -g.floorThickness / 2, HALF_LENGTH], [width, g.floorThickness, length], PALETTE.floor),
  node('ceiling', 'ceiling', [0, height + g.floorThickness / 2, HALF_LENGTH], [width, g.floorThickness, length], PALETTE.ceiling),
  node('wall-left', 'wall-side', [-width / 2 - g.wallThickness / 2, height / 2, HALF_LENGTH], [g.wallThickness, height, length], PALETTE.wall),
  node('wall-right', 'wall-side', [width / 2 + g.wallThickness / 2, height / 2, HALF_LENGTH], [g.wallThickness, height, length], PALETTE.wall),
  node('wall-front', 'wall-end', [0, height / 2, 0], [width, height, g.wallThickness], PALETTE.wall),
  node('wall-rear', 'wall-end', [0, height / 2, length], [width, height, g.wallThickness], PALETTE.wall),
  node('bench-left', 'bench', [-g.benchInset, g.benchHeight / 2, HALF_LENGTH], [g.benchWidth, g.benchHeight, g.benchLength], PALETTE.bench),
  node('bench-right', 'bench', [g.benchInset, g.benchHeight / 2, HALF_LENGTH], [g.benchWidth, g.benchHeight, g.benchLength], PALETTE.bench),
  node('lamp-fl', 'lamp', [-1.1, g.lampHeight / 2, 1.4], [g.lampSize, g.lampHeight, g.lampSize], PALETTE.lamp),
  node('lamp-fr', 'lamp', [1.1, g.lampHeight / 2, 1.4], [g.lampSize, g.lampHeight, g.lampSize], PALETTE.lamp),
  node('lamp-rl', 'lamp', [-1.1, g.lampHeight / 2, length - 1.4], [g.lampSize, g.lampHeight, g.lampSize], PALETTE.lamp),
  node('lamp-rr', 'lamp', [1.1, g.lampHeight / 2, length - 1.4], [g.lampSize, g.lampHeight, g.lampSize], PALETTE.lamp),
  // The cast: four passengers standing along the coach, one of each species, alternating benches and sizes
  // (why each number is what it is lives in tuning.js). Each one's `asset` is its own model file, which is
  // what the yokai anomalies swap for the burst-open version.
  passenger(PASSENGERS[0], '#c96a2a'),
  passenger(PASSENGERS[1], '#b9b2a6'),
  passenger(PASSENGERS[2], '#cdc6b8'),
  passenger(PASSENGERS[3], '#b25f26'),
  // The seven ceiling handles, one node each: rotation is zero here, which is exactly where the straps
  // hang now, and `upward-handles` is the only thing that ever turns them.
  ...Array.from({ length: HANDLE.count }, (_, i) => {
    const z = HANDLE.firstZ + (HANDLE.lastZ - HANDLE.firstZ) * (i / (HANDLE.count - 1));
    return node(`handle-${i + 1}`, 'handle', [0, height, z], [HANDLE.barLength, HANDLE.drop, HANDLE.barThickness], WOOD.trim);
  }),
  // One suitcase on the right-hand rack, above the windows and clear of the ceiling. `floating-luggage`
  // lifts this node into the aisle.
  node('luggage', 'prop', [LUGGAGE.x, RACK_DECK_Y + LUGGAGE.size[1] / 2 - LUGGAGE.sink, LUGGAGE.z], [...LUGGAGE.size], LUGGAGE.colour),
  // The four environmental props — footprints, shoji door, broken window, flickering lamp. Each is in the
  // baseline and switched OFF, so the untouched coach has none of them; an anomaly turns its own one on
  // and that is the whole change. props.js owns their shapes.
  ...PROP_NODES,
];

// --- TEXTURES --------------------------------------------------------------------------------------
// The three wood maps are fetched in the background. Until the last one arrives every wooden surface
// renders as its flat chestnut tint, so the first frame never waits on the network, and if a map never
// arrives that tint is what you keep. A repeat lives on the texture rather than the material, so the
// maps are attached once they are loaded, cloned per surface group.
const ASSETS = {
  map: 'assets/wood-floor-diffuse.jpg',
  normalMap: 'assets/wood-floor-normal.jpg',
  roughnessMap: 'assets/wood-floor-roughness.jpg',
};

const woodMaps = {};
let woodPending = Object.keys(ASSETS).length;

for (const [slot, url] of Object.entries(ASSETS)) {
  new THREE.TextureLoader().load(url, (texture) => {
    if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = WOOD.anisotropy;
    woodMaps[slot] = texture;
    woodPending -= 1;
    if (woodPending === 0) applyWoodMaps();
  }, undefined, () => {
    woodPending -= 1;
    console.warn(`Texture missing, the flat wood tint stays: ${url}`);
  });
}

// --- MATERIALS -------------------------------------------------------------------------------------
function woodMaterial(tint, name) {
  return new THREE.MeshStandardMaterial({
    name,
    normalScale: new THREE.Vector2(WOOD.normalScale, WOOD.normalScale),
    color: tint,
    roughness: WOOD.roughness,
    metalness: 0,
  });
}

const FLOOR = woodMaterial(PALETTE.floor, 'floor-wood');
const CEILING = woodMaterial(PALETTE.ceiling, 'ceiling-wood');
const SIDE_WALL = woodMaterial(PALETTE.wall, 'side-wall-wood');
const END_WALL = woodMaterial(PALETTE.wall, 'end-wall-wood');

// Which repeat each wooden surface gets: floor and ceiling planks run the length of the coach, the walls
// are boarded vertically.
const WOOD_SURFACES = [
  { material: FLOOR, repeat: WOOD.deckRepeat },
  { material: CEILING, repeat: WOOD.deckRepeat },
  { material: SIDE_WALL, repeat: WOOD.sideRepeat },
  { material: END_WALL, repeat: WOOD.endRepeat },
];

function applyWoodMaps() {
  for (const { material, repeat } of WOOD_SURFACES) {
    for (const slot of ['map', 'normalMap', 'roughnessMap']) {
      const source = woodMaps[slot];
      if (!source) continue;
      const texture = source.clone();
      texture.repeat.set(repeat[0], repeat[1]);
      material[slot] = texture;
    }
    material.needsUpdate = true;
  }
}
const TRIM = new THREE.MeshStandardMaterial({ name: 'trim', color: WOOD.trim, roughness: 0.7, metalness: 0 });
const CUSHION_MAT = new THREE.MeshStandardMaterial({ name: 'bench-cushion', color: PALETTE.cushion, roughness: 0.78, metalness: 0 });
const BRASS_MAT = new THREE.MeshStandardMaterial({ name: 'brass', color: BRASS.color, roughness: BRASS.roughness, metalness: BRASS.metalness });
const GLASS_MAT = new THREE.MeshStandardMaterial({
  name: 'window-glass', color: GLASS.color, transparent: true, opacity: GLASS.opacity,
  metalness: GLASS.metalness, roughness: GLASS.roughness, envMapIntensity: GLASS.envMapIntensity, side: THREE.DoubleSide,
});
const RACK_MAT = new THREE.MeshStandardMaterial({ name: 'luggage-rack', color: '#3a2e25', roughness: 0.6, metalness: 0.3 });

// Small round floor lanterns: plain emissive paper that the catalogue can recolour.
const floorLanternMaterials = new Map();
function floorLanternMaterial(color) {
  if (!floorLanternMaterials.has(color)) {
    floorLanternMaterials.set(color, new THREE.MeshStandardMaterial({
      name: 'floor-lantern', color, emissive: new THREE.Color(color),
      emissiveIntensity: LAMP.emissiveIntensity, roughness: 0.6, metalness: 0,
      transparent: true, opacity: 0.96, side: THREE.DoubleSide,
    }));
  }
  return floorLanternMaterials.get(color);
}

// Plain props (the suitcase) are drawn from their node's colour, so this cache keeps one material per
// colour instead of a new one on every rebuild.
const propMaterials = new Map();
function propMaterial(color) {
  if (!propMaterials.has(color)) {
    propMaterials.set(color, new THREE.MeshStandardMaterial({
      name: 'prop', color, roughness: PROP.roughness, metalness: PROP.metalness,
    }));
  }
  return propMaterials.get(color);
}

// --- MODELS ----------------------------------------------------------------------------------------
// Every character model loads once in the background: the plain ones the baseline asks for, and the
// burst-open ones the anomalies swap in.
//
// There is deliberately NO stand-in for a model on this list. A yokai coach whose anomaly model has not
// arrived yet would otherwise be drawn wearing the plain animal — the coach would look completely
// unchanged, and the player, who is looking right at it, would be told they got it wrong. So a listed
// model that is not here yet draws nothing at all, `missingAssets` reports it, and main.js refuses to
// show the coach or take a decision until it turns up.
//
// Only files that are actually on disk go here. A path with no file behind it is a failed request, and the
// browser prints a red 404 for it — so a character model is added to this list the moment it lands, never
// before. A passenger whose model is not on this list falls back to a box, with nothing in the console.
export const MODEL_PATHS = [
  PASSENGER_MODELS.fox.normal,
  PASSENGER_MODELS.fox.anomaly,
  PASSENGER_MODELS.rabbit.normal,
  PASSENGER_MODELS.rabbit.anomaly,
  PASSENGER_MODELS.goat.normal,
  PASSENGER_MODELS.goat.anomaly,
  PASSENGER_MODELS.mouse.normal,
  PASSENGER_MODELS.mouse.anomaly,
];
const modelTemplates = new Map();
// Files that will never arrive: a 404 or a broken GLB. Kept so the debug overlay can name them, and so
// the round stops waiting for something that is not coming.
export const failedModels = new Set();
let loadsInFlight = MODEL_PATHS.length;
export const assetsPending = () => loadsInFlight > 0;

const modelLoader = new GLTFLoader();
for (const path of MODEL_PATHS) {
  modelLoader.load(path, (gltf) => {
    loadsInFlight -= 1;
    // Models are authored with the origin wherever the modeller left it — the goat anomaly's feet are
    // 0.9 m BELOW its origin and the fox's are 0.3 m above. So measure each one here, once, and let
    // buildAsset stand it on the surface its node asks for. Without this a passenger sinks through the
    // floor or floats, and which one it does is different for every file.
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    modelTemplates.set(path, {
      scene: gltf.scene,
      // The idle clip rides along with the model: each passenger's clip animates its own head root by name.
      clip: gltf.animations?.[0] ?? null,
      minY: Number.isFinite(bounds.min.y) ? bounds.min.y : 0,
    });
    cached.key = null; // force the next frame to rebuild with the model
  }, undefined, () => {
    // Loud on purpose. A model that never arrives means the coach wearing it is wrong, and a player who
    // is shown a wrong coach is a player asked an unfair question.
    loadsInFlight -= 1;
    failedModels.add(path);
    console.error(`Model failed to load, coaches needing it are wrong: ${path}`);
  });
}

// Roughly the size of a passenger, so an unlisted model still reads as someone in the coach.
const PLACEHOLDER_SIZE = [0.55, 0.9, 0.45];

// The model files this scene needs and does not have yet. main.js holds the round back while this is
// non-empty, so nothing is ever judged against a coach that has not finished arriving.
export function missingAssets(sceneNodes) {
  const missing = [];
  for (const entry of sceneNodes) {
    if (!entry.visible || !entry.asset) continue;
    if (MODEL_PATHS.includes(entry.asset) && !modelTemplates.has(entry.asset)) missing.push(entry.asset);
  }
  return missing;
}

function buildAsset(group, entry) {
  const record = modelTemplates.get(entry.asset);
  if (!record) {
    // A listed model that has not arrived is left out of the coach on purpose: the round is waiting on it.
    if (MODEL_PATHS.includes(entry.asset)) return;
    const size = entry.scale.map((s, i) => s * PLACEHOLDER_SIZE[i]);
    const centre = [entry.position[0], entry.position[1] + size[1] / 2, entry.position[2]];
    addBox(group, TRIM, size, centre, { name: entry.id, cast: false });
    return;
  }
  // These models carry no skins, so a plain deep clone is enough: the mixer finds the head root by name
  // inside the clone, and every clone shares the template's geometry and materials.
  const model = record.scene.clone(true);
  model.name = entry.id;
  // entry.position[1] is the SURFACE the model stands on, not the model's own origin, so the measured
  // offset is applied here rather than baked into the node — an anomaly can still move the node freely.
  model.position.set(entry.position[0], entry.position[1] - record.minY * entry.scale[1], entry.position[2]);
  model.rotation.set(...entry.rotation);
  model.scale.set(...entry.scale);
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.add(model);
  addIdleMixer(model, record.clip);
}

// --- IDLE ANIMATION ---------------------------------------------------------------------------------
// One mixer per passenger that arrived with a clip. This list is REPLACED at the top of every rebuild, so
// the mixers that were driving the thrown-away coach stop with it and the list never grows: a run of
// twenty coaches still holds four.
let mixers = [];

function addIdleMixer(model, clip) {
  if (!clip) return;
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clip).play();
  // Each passenger starts somewhere else in the clip, or all four sway in step like a machine.
  mixer.setTime(mixers.length * PASSENGER_IDLE.offsetStep * clip.duration);
  mixers.push(mixer);
}

// Called once per frame by main.js, never from here. Safe before the first coach (nothing to drive), after
// a rebuild (the old mixers are already gone) and when a model never arrives (its passenger has no clip).
export function coachTick(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  for (const mixer of mixers) mixer.update(dt);
}

// --- MESHES ----------------------------------------------------------------------------------------
// Rounded boxes for the big surfaces (walls, benches, doors) and plain boxes for thin details
// (glass, frames, brass strips) so the thin pieces do not get a radius larger than their thickness.
const ROUNDED_BOX = new RoundedBoxGeometry(1, 1, 1, 4, 0.02);
const BOX = new THREE.BoxGeometry(1, 1, 1);

function addBox(group, material, size, position, { name = '', cast = true, receive = true, rounded = true } = {}) {
  const mesh = new THREE.Mesh(rounded ? ROUNDED_BOX : BOX, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...size);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  group.add(mesh);
  return mesh;
}

// A side wall is a sill panel, a header panel, and a post between every two window bays. The gaps
// between the posts are the windows: the water and the dusk sky show through them.
function buildSideWall(group, entry) {
  const [x, , z] = entry.position;
  const [thickness, , wallLength] = entry.scale;
  const lower = WINDOW.sill;
  const upper = height - WINDOW.head;
  addBox(group, SIDE_WALL, [thickness, lower, wallLength], [x, lower / 2, z], { name: `${entry.id}-sill-panel` });
  addBox(group, SIDE_WALL, [thickness, upper, wallLength], [x, WINDOW.head + upper / 2, z], { name: `${entry.id}-header-panel` });

  const pitch = (wallLength - WINDOW.post) / WINDOW.bays;
  const windowWidth = pitch - WINDOW.post;
  const first = z - wallLength / 2 + WINDOW.post / 2;
  for (let i = 0; i <= WINDOW.bays; i += 1) {
    addBox(group, TRIM, [thickness, WINDOW.head - WINDOW.sill, WINDOW.post], [x, (WINDOW.sill + WINDOW.head) / 2, first + i * pitch], { name: `${entry.id}-post-${i}` });
    if (i < WINDOW.bays) {
      // A brass sill strip under each opening, a couple of centimetres proud of the wall.
      addBox(group, BRASS_MAT, [thickness + 0.05, 0.05, windowWidth], [x, WINDOW.sill - 0.025, first + i * pitch + pitch / 2], { name: `${entry.id}-brass-sill-${i}`, cast: false, rounded: false });
      buildWindowFill(group, x, first + i * pitch + pitch / 2, thickness, windowWidth);
    }
  }
  buildLuggageRack(group, entry);
}

// A glass pane set just inside the window gap, plus a thin trim frame so the edge reads as a fitted sash.
function buildWindowFill(group, x, z, wallThickness, windowWidth) {
  const inward = -Math.sign(x);
  const paneX = x + inward * (wallThickness / 2 - WINDOW.inset);
  const paneHeight = WINDOW.head - WINDOW.sill;
  const paneThick = 0.02;
  addBox(group, GLASS_MAT, [paneThick, paneHeight, windowWidth], [paneX, WINDOW.sill + paneHeight / 2, z], { name: 'window-glass', cast: false, receive: false, rounded: false });

  const fw = WINDOW.frameWidth;
  addBox(group, TRIM, [paneThick + 0.02, fw, windowWidth + fw], [paneX, WINDOW.sill + fw / 2, z], { name: 'window-frame-bottom', cast: false, rounded: false });
  addBox(group, TRIM, [paneThick + 0.02, fw, windowWidth + fw], [paneX, WINDOW.head - fw / 2, z], { name: 'window-frame-top', cast: false, rounded: false });
  addBox(group, TRIM, [paneThick + 0.02, paneHeight, fw], [paneX, WINDOW.sill + paneHeight / 2, z - windowWidth / 2 - fw / 2], { name: 'window-frame-left', cast: false, rounded: false });
  addBox(group, TRIM, [paneThick + 0.02, paneHeight, fw], [paneX, WINDOW.sill + paneHeight / 2, z + windowWidth / 2 + fw / 2], { name: 'window-frame-right', cast: false, rounded: false });
}

// A luggage rack above the windows: a rail at the wall, a front rail, and slats between them.
function buildLuggageRack(group, entry) {
  const [x, , z] = entry.position;
  const [thickness, , wallLength] = entry.scale;
  const inward = -Math.sign(x);
  const y = height - RACK.drop;
  const railZ = z;
  const railX = x + inward * (RACK.depth / 2 + thickness / 2);
  const halfDepth = RACK.depth / 2;

  // wall bracket and front/back rails
  addBox(group, RACK_MAT, [thickness + 0.04, RACK.railSize, wallLength], [x + inward * thickness / 2, y, railZ], { name: `${entry.id}-rack-back-rail`, cast: false, rounded: false });
  addBox(group, RACK_MAT, [RACK.railSize, RACK.railSize, wallLength], [railX + inward * halfDepth, y, railZ], { name: `${entry.id}-rack-front-rail`, cast: false, rounded: false });

  // slats
  for (let i = 0; i < RACK.slats; i += 1) {
    const t = (i + 0.5) / RACK.slats;
    const slatX = railX + inward * (t - 0.5) * RACK.depth;
    addBox(group, RACK_MAT, [RACK.slatSize, RACK.slatSize, wallLength], [slatX, y, railZ], { name: `${entry.id}-rack-slat-${i}`, cast: false, rounded: false });
  }
}

// An end wall is one panel with a raised door and a brass lever on the inside face.
function buildEndWall(group, entry) {
  const [x, , z] = entry.position;
  const [wallWidth, wallHeight, thickness] = entry.scale;
  addBox(group, END_WALL, [wallWidth, wallHeight, thickness], [x, wallHeight / 2, z], { name: entry.id });

  const inward = z < HALF_LENGTH ? 1 : -1;
  const face = z + inward * (thickness / 2);
  addBox(group, TRIM, [0.92, 1.96, 0.04], [x, 0.98, face + inward * 0.02], { name: `${entry.id}-door` });

  // door handle: a round plate, a thin lever and a small knob
  const handleY = 1.08;
  const handleX = x + 0.13;
  const handleZ = face + inward * 0.055;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), BRASS_MAT);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(handleX, handleY, handleZ);
  plate.name = `${entry.id}-handle-plate`;
  group.add(plate);

  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 16), BRASS_MAT);
  lever.rotation.z = Math.PI / 2;
  lever.position.set(handleX - 0.06, handleY, handleZ + inward * 0.015);
  lever.name = `${entry.id}-handle-lever`;
  group.add(lever);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), BRASS_MAT);
  knob.position.set(handleX - 0.13, handleY, handleZ + inward * 0.015);
  knob.name = `${entry.id}-handle-knob`;
  group.add(knob);
}

// A wood-framed bench with a red upholstered cushion on the seat and back.
function buildBench(group, entry) {
  const [x, y, z] = entry.position;
  const [benchWidth, benchHeight, benchLength] = entry.scale;
  const top = y + benchHeight / 2;
  const wallSide = Math.sign(x) || -1;
  // red cushions
  addBox(group, CUSHION_MAT, [benchWidth, BENCH.seatThickness, benchLength], [x, top - BENCH.seatThickness / 2, z], { name: 'bench-seat' });
  addBox(group, CUSHION_MAT, [BENCH.backThickness, BENCH.backHeight, benchLength], [x + wallSide * (benchWidth - BENCH.backThickness) / 2, top + BENCH.backHeight / 2 - 0.02, z], { name: 'bench-back' });

  // wood frame and legs
  const legHeight = benchHeight - BENCH.seatThickness;
  for (let i = 0; i < BENCH.legs; i += 1) {
    const fraction = (i + 0.5) / BENCH.legs;
    const legZ = z - benchLength / 2 + benchLength * fraction;
    addBox(group, TRIM, [BENCH.legWidth, legHeight, BENCH.legWidth], [x - wallSide * (benchWidth / 2 - BENCH.legWidth / 2 - 0.02), legHeight / 2, legZ], { name: `bench-leg-${i}`, cast: false });
  }
}

// A small round floor lantern tucked into a corner: a wood base and cap with a glowing paper body.
function buildLamp(group, entry) {
  const [x, y, z] = entry.position;
  const [diameter, bodyHeight] = entry.scale;
  const radius = diameter / 2;

  // wood base and cap
  addBox(group, TRIM, [diameter + 0.06, 0.04, diameter + 0.06], [x, 0.02, z], { name: 'lamp-base', cast: false, rounded: false });
  addBox(group, TRIM, [diameter + 0.06, 0.04, diameter + 0.06], [x, bodyHeight - 0.02, z], { name: 'lamp-cap', cast: false, rounded: false });

  // round paper body
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), floorLanternMaterial(entry.color));
  body.name = 'lamp-body';
  body.position.set(x, y, z);
  body.scale.set(1, bodyHeight / diameter, 1);
  body.castShadow = false;
  body.receiveShadow = false;
  group.add(body);

  // soft corner light
  const light = new THREE.PointLight(new THREE.Color(entry.color), LAMP.lightIntensity, LAMP.lightDistance, LAMP.lightDecay);
  light.name = 'lamp-light';
  light.position.set(x, y + radius * 0.5, z);
  light.castShadow = LAMP.castShadow;
  light.shadow.mapSize.set(LAMP.shadowMapSize, LAMP.shadowMapSize);
  light.shadow.bias = -0.004;
  group.add(light);
}

// One hanging handle, built from its node. The node sits at the ceiling mount and the strap and bar are
// children pinned to the far end of it, so rotating the node swings the whole handle from that mount.
// With the node's rotation at zero the children land exactly where the straps used to hang.
function buildHandle(group, entry) {
  const [barLength, drop, barThickness] = entry.scale;
  const pivot = new THREE.Group();
  pivot.name = entry.id;
  pivot.position.set(...entry.position);
  pivot.rotation.set(...entry.rotation);

  // leather strap, then the brass grab bar at its end
  addBox(pivot, TRIM, [HANDLE.strapWidth, drop, HANDLE.strapDepth], [0, -drop / 2, 0], { name: `${entry.id}-strap`, cast: false, rounded: false });
  addBox(pivot, BRASS_MAT, [barLength, barThickness, barThickness], [0, -drop, 0], { name: `${entry.id}-bar`, cast: false, rounded: false });
  group.add(pivot);
}

// A prop node is one plain box in the node's own colour: the suitcase the floating-luggage anomaly lifts.
function buildProp(group, entry) {
  addBox(group, propMaterial(entry.color), entry.scale, entry.position, { name: entry.id });
}

// Brass caps where the side walls meet the end walls, at floor and ceiling: always there, whatever changed.
function buildCornerCaps(group) {
  const half = BRASS.cornerCap / 2;
  for (const x of [-width / 2 + half, width / 2 - half]) {
    for (const z of [half, length - half]) {
      for (const y of [half, height - half]) {
        addBox(group, BRASS_MAT, [BRASS.cornerCap, BRASS.cornerCap, BRASS.cornerCap], [x, y, z], { name: 'brass-corner-cap', cast: false });
      }
    }
  }
}

// Takes the array from deriveScene and returns fresh meshes. Hidden nodes are dropped, so hiding the
// bench still hides the whole bench. `key` names the round: the same key rebuilds nothing.
let cached = { key: null, group: null };

export function buildScene(sceneNodes, key = null) {
  if (key !== null && key === cached.key && cached.group) return cached.group;

  // A new coach: let go of the mixers that were driving the old one before building this one's.
  mixers = [];

  const group = new THREE.Group();
  for (const entry of sceneNodes) {
    if (!entry.visible) continue;
    if (entry.asset) buildAsset(group, entry);
    else if (PROP_KINDS.has(entry.kind)) buildPropNode(group, entry);
    else if (entry.kind === 'wall-side') buildSideWall(group, entry);
    else if (entry.kind === 'wall-end') buildEndWall(group, entry);
    else if (entry.kind === 'bench') buildBench(group, entry);
    else if (entry.kind === 'lamp') buildLamp(group, entry);
    else if (entry.kind === 'handle') buildHandle(group, entry);
    else if (entry.kind === 'prop') buildProp(group, entry);
    else if (entry.kind === 'floor') addBox(group, FLOOR, entry.scale, entry.position, { name: entry.id, cast: false });
    else if (entry.kind === 'ceiling') addBox(group, CEILING, entry.scale, entry.position, { name: entry.id, cast: false });
    else addBox(group, TRIM, entry.scale, entry.position, { name: entry.id });
  }
  buildCornerCaps(group);

  cached = { key, group };
  return group;
}

// The group is added at the origin, so coach-local space is world space.
export function getDoorPositions() {
  return { front: { x: 0, z: 0 }, rear: { x: 0, z: length } };
}
