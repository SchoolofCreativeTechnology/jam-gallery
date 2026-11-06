// The scenery each world grows: a rainforest canopy of overlapping lumps, alpine conifers that thin out as the
// ground climbs, ice seracs and shards tipped off vertical, and widely spaced desert scrub. It is laid out once
// per world as a field that scrolls and recycles exactly like the rock field in obstacles.js.
// Scenery only, it never collides: every prop stands outside the flight corridor and fills the ground either side
// of it, so the ship keeps clear sky over the corridor and a wall of world on both flanks.
import * as THREE from 'three';
import * as T from './tuning.js';
import { terrainHeightAt } from './terrain.js';

// --- the field's own numbers --------------------------------------------------
// The makers' tuning.js is the course; how the scenery is laid out and painted is this file's own business.

const TAU = Math.PI * 2;
const FIELD_TILES = 1;                                     // ground tiles long the prop field is: a whole number,
const FIELD_LENGTH = T.GROUND_TILE_LENGTH * FIELD_TILES;   // 300 m, so the field repeats exactly when it recycles
const SPAWN_Z = T.CAMERA_BACK + 10;                        // 25 m: the near edge of the field, just past the camera
const CORRIDOR_CLEAR = 30;                                 // metres from the centre line no prop may come inside

// --- the field itself ---------------------------------------------------------

export const props = new THREE.Group();   // handed to the scene once by main.js
let field = [];                           // one record per prop kind: { mesh, items }, in the order it was built

// --- a fixed, repeating kind of random ---------------------------------------

// The k-th pseudo-random number of one site: `seed` picks the site, `k` picks which number of that site is
// wanted. A hash, never Math.random, so a world's trees stand in the same places every time it is launched.
function roll(seed, k) {
  const noise = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return noise - Math.floor(noise);
}

// A colour partway from `a` to `b`: how a canopy, a scrub field or an ice field gets its range of shades
// without a single texture. Mixed in the renderer's own colour space, then handed back as a hex string.
const mixA = new THREE.Color();
const mixB = new THREE.Color();
function shadeOf(a, b, t) {
  return mixA.set(a).lerp(mixB.set(b), t).getHexString();
}

// --- the shapes a prop is built from ------------------------------------------
// Every shape is built with its base on its own origin, so an instance's scale is the height it stands and a
// lean tips it about the ground it stands on rather than about its middle.

// A thin tube with no caps: a tree trunk. The bottom is underground and the top is inside the canopy, so there
// is nothing to close. Its radius is baked in, so a taller tree is also a thicker one when it is scaled.
function trunkGeometry(topRadius, bottomRadius, sides) {
  const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, 1, sides, 1, true);
  geometry.translate(0, 0.5, 0);   // the shape's unit height now runs from its origin up to 1
  return geometry;
}

// A lumpy ball: a twenty-face sphere pushed in and out by a fixed hash of where each vertex sits, so a canopy
// lump or a rock outcrop reads as grown rather than moulded. Two faces sharing a vertex hash it the same way,
// so the surface stays closed, and it comes out identical every launch. `squash` flattens it.
function lumpyBallGeometry(squash, lump) {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const noise = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const wobble = 1 + lump * (noise - Math.floor(noise) - 0.5);
    p.setXYZ(i, x * wobble, y * wobble * squash, z * wobble);
  }
  p.needsUpdate = true;
  geometry.computeVertexNormals();   // non-indexed, so this gives one normal per face
  return geometry;
}

// A cone: a conifer crown or an ice shard. Closed at the base as well, because the camera can be below the top
// of a tall tree and an open cone seen from underneath would show its own inside.
function coneGeometry(sides) {
  const geometry = new THREE.ConeGeometry(1, 1, sides, 1, false);
  geometry.translate(0, 0.5, 0);
  return geometry;
}

// A tapered spire, closed at both ends: a cactus stem or an ice pillar.
function spireGeometry(topRadius, bottomRadius, sides) {
  const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, 1, sides, 1, false);
  geometry.translate(0, 0.5, 0);
  return geometry;
}

// A block on its own base: an ice serac or a snapped slab.
function blockGeometry(width, height, depth) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(0, height / 2, 0);
  return geometry;
}

// --- the paint ----------------------------------------------------------------
// Props are lit like the rest of the scene and flat-shaded like the rocks, and none of them carries a texture:
// the colour comes from each instance, so one mesh holds a whole range of greens or blues. Ice alone is given a
// low roughness, because a serac should catch the sun.

function foliageMaterial() {
  return new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 });
}
function rockMaterial() {
  return new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
}
function iceMaterial() {
  return new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.22, metalness: 0.04 });
}

// --- laying a field out -------------------------------------------------------

// One prop kind: the shape every instance of it shares, its paint, and where every instance of it stands.
function newPart(geometry, material) {
  return { geometry, material, items: [] };
}

// One instance of one kind. `lift` is how far its own origin stands above the ground it was put on, `turn` is
// its rotation about y, `scale` is its size in the three axes, and `colour` its own shade of the world's
// palette. Everything is a plain number, so the field costs nothing but its numbers.
function place(part, x, z, lift, turn, scale, colour, leanX, leanZ) {
  // The clamp is the field's flat guarantee that no prop reaches into the corridor, whatever offset a shape's
  // origin was given: `x` here can be a canopy lump hung out from its trunk as easily as the trunk itself. The
  // worlds below keep their sites far enough out that it should never actually bite on one of them.
  const stood = (x < 0 ? -1 : 1) * Math.max(CORRIDOR_CLEAR, Math.abs(x));
  part.items.push({
    x: stood, z, startZ: z, lift, ground: terrainHeightAt(stood, z),
    turn, leanX: leanX || 0, leanZ: leanZ || 0,
    sx: scale[0], sy: scale[1], sz: scale[2],
    colour
  });
}

// Walk the field as a grid of candidate sites: rows spaced `rowSpacing` apart along the track from the near edge
// back, and `columns` spots per side stepping outward from `inner`. `rowSpacing` must divide FIELD_LENGTH, so
// the last row and the first row are the same rowSpacing apart once the field has recycled. Every world lays
// its props out on this grid, then scatters, thins and scales them.
function eachSite(rowSpacing, inner, step, columns, visit) {
  const rows = Math.round(FIELD_LENGTH / rowSpacing);
  for (let row = 0; row < rows; row++) {
    for (let side = -1; side <= 1; side += 2) {
      for (let col = 0; col < columns; col++) {
        visit({
          seed: row * 311 + col * 17 + (side < 0 ? 71 : 0),
          x: side * (inner + col * step),
          z: SPAWN_Z - row * rowSpacing
        });
      }
    }
  }
}

// The lowest and highest ground any site of a grid stands on. The alpine world reads each tree's height against
// this, so its own snow line means the same thing on any shape those makers give it.
function groundRange(rowSpacing, inner, step, columns) {
  let low = Infinity;
  let high = -Infinity;
  eachSite(rowSpacing, inner, step, columns, (site) => {
    const ground = terrainHeightAt(site.x, site.z);
    if (ground < low) low = ground;
    if (ground > high) high = ground;
  });
  return { low, high };
}

// --- JUNGLE: a rainforest canopy ----------------------------------------------

const JUNGLE_ROW_SPACING = 10;    // metres between the rows of trees along the track
const JUNGLE_STEP = 10;           // metres between the trees across the field
const JUNGLE_COLUMNS = 12;        // trees per side, from JUNGLE_INNER outward
const JUNGLE_INNER = 40;          // the nearest trunk: deeper than the other worlds, because a canopy lump is
                                  // hung a few metres inward of its trunk and must still clear the corridor
const JUNGLE_TRUNK = 4.6;         // metres of bare trunk under the crown
const JUNGLE_CROWN = 4.2;         // metres from a crown's middle to its edge
const JUNGLE_EMERGENTS = 0.07;    // share of trees that stand above the rest of the canopy
const JUNGLE_TALL = 1.6;          // how much taller an emergent is
const JUNGLE_VARIATION = 0.35;    // how far a tree may wander from those sizes

// Three lumps round the top of each trunk make one tree: the crown on top, then two smaller ones hung either
// side and a little lower. Overlapping neighbours turn the lumps into a canopy rather than a field of balls.
function buildJungle(world) {
  const trunk = newPart(trunkGeometry(0.22, 0.34, 5), foliageMaterial());
  const crown = newPart(lumpyBallGeometry(0.85, 0.4), foliageMaterial());
  const leafDark = shadeOf('#0f2009', world.ground, 0.45);   // shadowed canopy, lifted toward the world's green
  const leafLight = shadeOf(world.ground, '#74b052', 0.5);   // sunlit canopy
  const barkDark = shadeOf('#241a10', world.rock || '#6b4a2e', 0.5);
  const barkLight = shadeOf('#3d2c1c', world.rock || '#6b4a2e', 0.5);

  eachSite(JUNGLE_ROW_SPACING, JUNGLE_INNER, JUNGLE_STEP, JUNGLE_COLUMNS, (site) => {
    const x = site.x + (roll(site.seed, 1) - 0.5) * JUNGLE_STEP * 0.6;   // scatter, so no rows of trees show
    const z = site.z + (roll(site.seed, 2) - 0.5) * JUNGLE_ROW_SPACING * 0.6;
    const size = (roll(site.seed, 3) < JUNGLE_EMERGENTS ? JUNGLE_TALL : 1)
      * (1 - JUNGLE_VARIATION / 2 + JUNGLE_VARIATION * roll(site.seed, 4));
    const trunkHeight = JUNGLE_TRUNK * size;
    const radius = JUNGLE_CROWN * size;
    const turn = roll(site.seed, 5) * TAU;
    place(trunk, x, z, 0, turn, [size, trunkHeight, size], shadeOf(barkDark, barkLight, roll(site.seed, 6)));
    for (let blob = 0; blob < 3; blob++) {
      // The lumps are stacked on the trunk and spaced a third of a turn apart, so a tree reads as one rounded
      // crown from every angle and an empty space opens on none of them.
      const around = turn + blob * (TAU / 3);
      const reach = blob === 0 ? 0 : radius * 0.45;      // the crown sits on the trunk; the others hang out
      const lift = trunkHeight + radius * (0.55 - blob * 0.28);
      const r = radius * (blob === 0 ? 1 : 0.78 - blob * 0.08);
      place(crown,
        x + Math.cos(around) * reach,
        z + Math.sin(around) * reach,
        lift, around, [r, r, r],
        shadeOf(leafDark, leafLight, blob === 0
          ? 0.4 + 0.45 * roll(site.seed, 7)                // the crown takes the light
          : 0.12 + 0.5 * roll(site.seed, 8 + blob)));
    }
  });
  return [trunk, crown];
}

// --- ALPINE: conifers on the low ground, bare rock above the snow line --------

const ALPINE_ROW_SPACING = 12;    // metres between the rows along the track
const ALPINE_STEP = 13;           // metres between the conifers across the field
const ALPINE_COLUMNS = 11;        // conifers per side, from ALPINE_INNER outward
const ALPINE_INNER = 36;          // where the nearest conifer stands: a crown is narrow, so this is enough
const ALPINE_HEIGHT = 7.5;        // metres of a full-grown conifer
const ALPINE_TRUNK = 0.14;        // how much of that is bare trunk below the crown
const ALPINE_SNOW_LINE = 0.8;     // fraction of this world's own ground height above which nothing grows
const ALPINE_THINNING = 2;        // how sharply the conifers thin out as the ground climbs
const ALPINE_OUTCROPS = 0.07;     // share of the sites that carry a bare grey outcrop instead of a tree

// A conifer is a dark cone on a short trunk. Where each one stands is settled by the ground under it: the trees
// thin out as it climbs and stop altogether at the snow line, so the world's white tops stay clean.
function buildAlpine(world) {
  const trunk = newPart(trunkGeometry(0.16, 0.26, 5), foliageMaterial());
  const crown = newPart(coneGeometry(7), foliageMaterial());
  const outcrop = newPart(lumpyBallGeometry(0.7, 0.5), rockMaterial());
  const { low, high } = groundRange(ALPINE_ROW_SPACING, ALPINE_INNER, ALPINE_STEP, ALPINE_COLUMNS);
  const span = Math.max(1e-6, high - low);
  const needleDark = shadeOf('#12301a', world.ground, 0.3);
  const needleLight = shadeOf('#264a24', world.ground, 0.55);
  const rockDark = shadeOf('#5c6167', world.rock || '#8f959a', 0.7);
  const rockLight = shadeOf('#9ba2a8', world.rock || '#8f959a', 0.4);

  eachSite(ALPINE_ROW_SPACING, ALPINE_INNER, ALPINE_STEP, ALPINE_COLUMNS, (site) => {
    const x = site.x + (roll(site.seed, 1) - 0.5) * ALPINE_STEP * 0.7;
    const z = site.z + (roll(site.seed, 2) - 0.5) * ALPINE_ROW_SPACING * 0.7;
    const ground = terrainHeightAt(x, z);
    const climb = Math.max(0, (ground - low) / span);   // 0 on this world's lowest ground, 1 on its highest

    if (roll(site.seed, 3) < ALPINE_OUTCROPS) {
      // Rock, not growth, so an outcrop is allowed anywhere — including up on the snow.
      const size = 3 + 2.5 * roll(site.seed, 4);
      place(outcrop, x, z, size * 0.2, roll(site.seed, 5) * TAU,
        [size, size * (0.5 + 0.3 * roll(site.seed, 6)), size * (0.6 + 0.5 * roll(site.seed, 7))],
        shadeOf(rockDark, rockLight, roll(site.seed, 8)));
      return;
    }
    // Nothing grows at or above the snow line, and below it the conifers thin out as the ground climbs.
    if (climb >= ALPINE_SNOW_LINE) return;
    if (roll(site.seed, 9) < Math.pow(climb / ALPINE_SNOW_LINE, ALPINE_THINNING)) return;

    const height = ALPINE_HEIGHT * (0.7 + 0.4 * roll(site.seed, 10));
    const trunkHeight = height * ALPINE_TRUNK;
    const width = height * (0.2 + 0.06 * roll(site.seed, 11));
    const turn = roll(site.seed, 12) * TAU;
    place(trunk, x, z, 0, turn, [height * 0.08, trunkHeight, height * 0.08], shadeOf('#2a1d12', '#4a3524', roll(site.seed, 13)));
    place(crown, x, z, trunkHeight * 0.6, turn, [width, height - trunkHeight * 0.6, width],
      shadeOf(needleDark, needleLight, roll(site.seed, 14)));
  });
  return [trunk, crown, outcrop];
}

// --- ICE: seracs, shards and drift ridges -------------------------------------

const ICE_ROW_SPACING = 12;      // metres between the rows along the track
const ICE_STEP = 18;             // metres between the seracs across the field
const ICE_COLUMNS = 8;           // seracs per side, from ICE_INNER outward
const ICE_INNER = 36;            // where the nearest serac stands: a leaning shard reaches inward from here
const ICE_CHANCE = 0.62;         // share of the sites that carry a serac
const ICE_DRIFT_CHANCE = 0.3;    // share of the sites that carry a low drift ridge
const ICE_TILT = 0.3;            // radians a serac may lean off vertical
const ICE_HEIGHT = 6;            // metres a serac's own height is multiplied by

// Blocks snapped off square, slabs lying between them, tapered shards standing among both, and drift ridges
// filling the gaps: the shapes the reference shows on a fractured ice floor. Every upright is leaned a little,
// which is what stops the field reading as a grid of standing boxes.
function buildIce(world) {
  const shard = newPart(coneGeometry(5), iceMaterial());
  const block = newPart(blockGeometry(1.0, 1.0, 0.7), iceMaterial());
  const slab = newPart(blockGeometry(1.3, 1.0, 1.05), iceMaterial());
  const drift = newPart(lumpyBallGeometry(0.3, 0.3), iceMaterial());
  const shardDark = shadeOf('#a8dcee', '#ffffff', 0.2);
  const shardLight = shadeOf('#e7f6fc', '#ffffff', 0.5);
  const blockDark = shadeOf('#8fc9e2', world.ground, 0.35);
  const blockLight = shadeOf('#dff1f9', world.ground, 0.4);
  const driftDark = shadeOf('#cfe6f1', world.ground, 0.6);
  const driftLight = shadeOf('#f4fbff', world.ground, 0.5);

  eachSite(ICE_ROW_SPACING, ICE_INNER, ICE_STEP, ICE_COLUMNS, (site) => {
    const x = site.x + (roll(site.seed, 1) - 0.5) * ICE_STEP * 0.6;
    const z = site.z + (roll(site.seed, 2) - 0.5) * ICE_ROW_SPACING * 0.6;
    const turn = roll(site.seed, 3) * TAU;
    const leanX = (roll(site.seed, 4) - 0.5) * 2 * ICE_TILT;
    const leanZ = (roll(site.seed, 5) - 0.5) * 2 * ICE_TILT;
    const size = 0.7 + 0.9 * roll(site.seed, 6);

    if (roll(site.seed, 7) < ICE_CHANCE) {
      const height = ICE_HEIGHT * (0.55 + 0.75 * roll(site.seed, 8));
      const pick = roll(site.seed, 9);
      if (pick < 0.45) {
        const width = 1.1 + 1.3 * roll(site.seed, 10);
        place(shard, x, z, 0, turn, [width, height, width], shadeOf(shardDark, shardLight, roll(site.seed, 11)), leanX, leanZ);
      } else if (pick < 0.78) {
        place(block, x, z, 0, turn, [size, height * 0.6, size], shadeOf(blockDark, blockLight, roll(site.seed, 12)), leanX, leanZ);
      } else {
        place(slab, x, z, 0, turn, [size, height * 0.3, size], shadeOf(blockDark, blockLight, roll(site.seed, 13)), leanX, leanZ);
      }
    } else if (roll(site.seed, 14) < ICE_DRIFT_CHANCE) {
      const reach = 3.5 + 3.5 * roll(site.seed, 15);
      place(drift, x, z, reach * 0.06, turn, [reach, 1 + 0.6 * roll(site.seed, 16), reach * (0.6 + 0.4 * roll(site.seed, 17))],
        shadeOf(driftDark, driftLight, roll(site.seed, 18)));
    }
  });
  return [shard, block, slab, drift];
}

// --- DESERT: dry scrub, widely spaced ----------------------------------------

const DESERT_ROW_SPACING = 20;   // metres between the rows along the track: the flats stay open
const DESERT_STEP = 18;          // metres between the sites across the field
const DESERT_COLUMNS = 8;        // sites per side, from DESERT_INNER outward
const DESERT_INNER = 36;         // where the nearest bush stands
const DESERT_SCRUB_CHANCE = 0.5; // share of the sites that carry a scrub bush
const DESERT_SPIRE_CHANCE = 0.15;// share that carry a cactus spire instead
const DESERT_BUSH = 1.5;         // metres across a scrub bush
const DESERT_SPIRE = 6;          // metres of the tallest cactus spire

// Small dusty bushes with the odd tall green spire standing among them, and the space between them left bare:
// this world's photograph is an open flat with a few plants on it, not a thicket.
function buildDesert(world) {
  const scrub = newPart(lumpyBallGeometry(0.72, 0.45), foliageMaterial());
  const spire = newPart(spireGeometry(0.42, 0.62, 5), foliageMaterial());
  const scrubDark = shadeOf('#3d4a20', world.ground, 0.22);
  const scrubLight = shadeOf('#79804a', world.ground, 0.25);
  const spireDark = shadeOf('#2f4a22', world.ground, 0.18);
  const spireLight = shadeOf('#5d7a3a', world.ground, 0.12);

  eachSite(DESERT_ROW_SPACING, DESERT_INNER, DESERT_STEP, DESERT_COLUMNS, (site) => {
    const x = site.x + (roll(site.seed, 1) - 0.5) * DESERT_STEP * 0.6;
    const z = site.z + (roll(site.seed, 2) - 0.5) * DESERT_ROW_SPACING * 0.6;
    const pick = roll(site.seed, 3);
    if (pick < DESERT_SPIRE_CHANCE) {
      const height = DESERT_SPIRE * (0.55 + 0.5 * roll(site.seed, 4));
      const lean = (roll(site.seed, 5) - 0.5) * 0.2;
      place(spire, x, z, 0, roll(site.seed, 6) * TAU, [height * 0.16, height, height * 0.16],
        shadeOf(spireDark, spireLight, roll(site.seed, 7)), lean, lean * 0.6);
    } else if (pick < DESERT_SPIRE_CHANCE + DESERT_SCRUB_CHANCE) {
      const size = DESERT_BUSH * (0.6 + 0.6 * roll(site.seed, 8));
      place(scrub, x, z, size * 0.45, roll(site.seed, 9) * TAU, [size, size, size],
        shadeOf(scrubDark, scrubLight, roll(site.seed, 10)));
    }
  });
  return [scrub, spire];
}

// --- building and letting go of the field -------------------------------------

// The four worlds' scenery. A world with no props of its own falls back to the alpine look below.
const BUILDERS = { ICE: buildIce, DESERT: buildDesert, JUNGLE: buildJungle, ALPINE: buildAlpine };

// One prop kind as one InstancedMesh: every instance's matrix and colour is written once, right here, so a whole
// forest costs one call to draw. The matrices are the field's only moving part afterwards (see updateProps).
function makeInstancedMesh(part) {
  const mesh = new THREE.InstancedMesh(part.geometry, part.material, part.items.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);   // these matrices are rewritten every frame
  const position = new THREE.Vector3();
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const colour = new THREE.Color();
  part.items.forEach((item, i) => {
    position.set(item.x, item.ground + item.lift, item.z);
    euler.set(item.leanX, item.turn, item.leanZ);
    quaternion.setFromEuler(euler);
    scale.set(item.sx, item.sy, item.sz);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, colour.set(item.colour));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // The field always surrounds the camera, so it is never worth testing against the frustum — and a bounding
  // sphere worked out once, before the field starts moving, must not be allowed to cull it.
  mesh.frustumCulled = false;
  props.add(mesh);
  return mesh;
}

// Let go of the field standing at the moment: its paints, its shapes, and the two buffers each mesh keeps.
function disposeField() {
  for (const part of field) {
    props.remove(part.mesh);
    part.mesh.geometry.dispose();
    part.mesh.material.dispose();
    part.mesh.dispose();
  }
  field = [];
}

// Build the scenery for the world being launched, and let go of the one it replaces. main.js calls this from
// applyWorld, and it wants the ground's shape already swapped in (applyTerrainLook before it, exactly as
// applyRockLook does), because this reads terrainHeightAt to stand every prop on that ground.
export function applyPropLook(world) {
  // The world is read for its name and the colours its props are painted from. A name with no scenery of its own
  // falls back to the alpine look rather than failing to launch, and a world missing a colour still gets one.
  const safe = Object.assign({}, world || {});
  if (!safe.ground) safe.ground = '#64923f';   // the alpine world's own green
  if (!safe.rock) safe.rock = '#8f959a';       // and its grey rock
  const build = BUILDERS[safe.name] || BUILDERS.ALPINE;
  const parts = build(safe);
  const next = [];
  for (const part of parts) {
    if (part.items.length === 0) {   // nothing was planted of this kind: throw the shape away again
      part.geometry.dispose();
      part.material.dispose();
      continue;
    }
    next.push({ mesh: makeInstancedMesh(part), items: part.items });
  }
  disposeField();   // the old field goes only once the new one is standing
  field = next;
}

// Move the field with the ground and send every prop that passes the camera back a whole field length. The
// matrices are written straight into each mesh's own buffer, which is the whole cost of a whole forest.
export function updateProps(dt) {
  const moved = T.FORWARD_SPEED * dt;
  for (const part of field) {
    const matrices = part.mesh.instanceMatrix.array;
    for (let i = 0; i < part.items.length; i++) {
      const item = part.items[i];
      item.z += moved;
      // A whole FIELD_LENGTH back, which is a whole number of ground tiles, so the field repeats exactly and the
      // ground under every prop is the same ground it was standing on. It lands far beyond the fog, out of sight.
      if (item.z > SPAWN_Z) item.z -= FIELD_LENGTH;
      const at = i * 16;                     // sixteen numbers a matrix; the translation is the last four
      matrices[at + 14] = item.z;
      // Stand the prop on the ground under it. This only ever changes anything if the ground itself has moved
      // under the field, which it does not while the field and the tiles recycle in whole tile lengths.
      const ground = terrainHeightAt(item.x, item.z);
      if (ground !== item.ground) {
        matrices[at + 13] += ground - item.ground;
        item.ground = ground;
      }
    }
    part.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Put every prop back where it started: the same field as the world was launched with. main.js calls this on
// launch, next to resetRocks.
export function resetProps() {
  for (const part of field) {
    const matrices = part.mesh.instanceMatrix.array;
    part.items.forEach((item, i) => {
      item.z = item.startZ;
      item.ground = terrainHeightAt(item.x, item.z);
      const at = i * 16;
      matrices[at + 13] = item.ground + item.lift;
      matrices[at + 14] = item.z;
    });
    part.mesh.instanceMatrix.needsUpdate = true;
  }
}
