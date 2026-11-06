// The rock field: plain boxes on the ground, laid out once from tuning.js and recycled forever, then dressed
// as what you would find on the world being surveyed — ice shards, sandstone outcrops, jungle trees of three
// kinds, grey mountain peaks. The layout never moves; each shape is fitted into a box of its own inside the
// tuning.js envelope and given a small instance scale of its own, so a world's rocks are not all one size, and
// each rock's hitbox follows its own size. Only the size and the paint filling each rock change here.
// A rock does not end the run: it costs the hull a hit point, unless the ship is still in its invulnerability window.
import * as THREE from 'three';
import * as T from './tuning.js';
import { terrainHeightAt } from './terrain.js';

export const rockGroup = new THREE.Group();
const rocks = [];

// The size envelope every shape is fitted into, from tuning.js, and the ceiling on a rock's visible height.
// Each shape takes a box of its own inside the envelope (see SHAPE_PROFILES), so a world's rocks read as
// different obstacles — a low wide slab, a medium block, a tall thin spire — instead of every one filling the
// same box. A rock's visible size is its fitted box times its own uniform instance scale, and the fitted height
// is capped at FIT_H_MAX below so that even the largest scale stays at or under the ceiling in tuning.js.
const FIT_H_MAX = T.ROCK_HEIGHT_MAX / T.ROCK_SCALE_MAX;   // tallest a fitted shape may be, before instance scale

// Look numbers, which belong to this file: the makers' tuning.js is the course, not the paint. The rocks are
// built finely enough to read as rounded or crystalline solids up close — the same handful of shared shapes per
// world as before, only subdivided — and the painted tile carries a normal map and a roughness map as well as
// its colour, so cracks, strata, moss and grain sit in the surface instead of on it.
const ROCK_TEXTURE_SIZE = 256;   // pixels a side of the painted rock texture, and of the relief built from it
const TEXTURE_METRES = 3;        // metres of rock one repeat of that texture covers
const ROCK_TEXTURE_REPEAT = 1;   // repeats of that tile over those metres: the colour and the relief maps share it
const TURN_STEP = 0.05;          // radians: the step the turn test walks, and the step a rock's turn is taken in
const TURN_STEPS_MAX = 10;       // most steps a shape is tested for: 10 x 0.05 = 0.5 radians
const LUMP = 0.3;                // how far a boulder's or a crag's surface may wander from smooth
const LUMP_FINE = 0.35;          // the second, tighter octave of that wander, as a fraction of the first
const SHARD_SIDES = 16;          // points round an ice ring: enough small crystal faces that a shard is not five
const SHARD_CLUSTER_SIDES = 12;  // a smaller count for the broken pieces of the ice cluster, so they stay jagged
const SHARD_RINGS = 10;          // bands a shard is built from, so its taper is a faceted curve, not one step
const SHARD_STEP_SEED = 7;       // the one point pattern every band of the ice block's snapped rim steps up by
const SLAB_SEGMENTS = 7;         // grid divisions across each face of a stacked slab or crag block
const SLAB_ROUND = 0.22;         // metres its edges and corners are rounded off by, so it shades as worn stone
const CROWN_STEPS = 2;           // icosahedron subdivisions on one lobe of a tree's crown: 20 x 4^2 faces
const CONIFER_SIDES = 12;        // points round a conifer's tiers: a multiple of four, so each tier is cut even
const CONIFER_SEED = 20;         // the one point pattern a conifer's tier rims are chipped from
const CONIFER_CHIP = 0.09;       // how far a conifer's rim may be cut in from its tier's own radius
const UMBRELLA_LOBES = 6;        // lobes spread round the flat crown of the squat tree
const UMBRELLA_TWIST = 0.5;      // radians that ring of lobes is turned by, so no lobe sits square to the track
const PEAK_SIDES = 16;           // points round a summit: enough that its rim reads as broken rock, not a polygon
const PEAK_SEED = 40;            // the one point pattern a summit's rims are chipped from
const PEAK_CHIP = 0.07;          // how far a summit's rim may be cut in from its ring's own radius
const PEAK_LUMP = LUMP * 0.6;    // how far a summit's surface may wander from smooth: a crag, not a boulder
const RELIEF_HEIGHT = 4;         // how deep the painted tile is read as relief, before the normal map's own scale
const NORMAL_STRENGTH = 0.8;     // normalScale: how far that relief is allowed to tilt the surface's shading
const ROUGH_MIN = 0.55;          // roughness of the brightest painted grain: ice flash, dust, snow
const ROUGH_MAX = 1;             // ...and of the darkest marks: cracks, seams, moss

// The field's first look, until a world is launched: the plain box the course was tuned on, at the tuning size.
let fieldGeometries = [new THREE.BoxGeometry(T.ROCK_WIDTH, T.ROCK_HEIGHT, T.ROCK_LENGTH)];
let fieldMaterial = new THREE.MeshStandardMaterial({ color: T.ROCK_COLOR, flatShading: true });

function addRock(x, z) {
  const rock = new THREE.Mesh(fieldGeometries[0], fieldMaterial);
  rock.position.set(x, 0, z);
  rock.userData.startZ = z;   // where this rock goes back to when a run restarts
  // The half sizes of the shape this rock is currently wearing, its fitted box times its own instance scale.
  // Each rock carries its own, so sitOnGround and rockHitTest below follow the rock in front of the player
  // rather than one shared box. The plain box above is fitted by hand here; dressRocks fills these in for a world.
  rock.userData.half = { x: T.ROCK_WIDTH / 2, y: T.ROCK_HEIGHT / 2, z: T.ROCK_LENGTH / 2 };
  rocks.push(rock);
  rockGroup.add(rock);
}

// Lay the field out once, ahead of the ship. A repeating block of rows, each one a mass of rock rather than a
// lone obstacle:
//   a dodge row is a pair on one side to swing past, the side alternating and stepping outward so no lane is
//   always safe, with the far side of the corridor left wide open;
//   a gate row is a pair each side, so hugging an edge will not do and the way through is down the middle;
//   a ridge row runs rocks right across the corridor, too wide to steer around, so it has to be flown over.
// Every one of those shapes still leaves a gap the ship fits through: the rows are more crowded, not closed.
let fieldLength = 0;
let lane = 0;
let z = -T.ROCK_SPACING;
for (let row = 0; row < T.ROCK_ROWS; row++) {
  const kind = row % T.ROCK_ROW_PATTERN;              // the last two row kinds are the gate and the ridge
  if (kind === T.ROCK_ROW_PATTERN - 1) {
    for (let i = 0; i < T.RIDGE_ROCKS; i++) {
      addRock(-T.RIDGE_HALF + (i * 2 * T.RIDGE_HALF) / (T.RIDGE_ROCKS - 1), z);
    }
  } else if (kind === T.ROCK_ROW_PATTERN - 2) {
    const spread = T.GATE_SPREAD + T.GATE_JITTER * ((row * 0.618034) % 1);
    addRock(-spread, z);
    addRock(spread, z);
    // A second rock inboard of each of those, so a gate row is a wall on each side with a way through the middle
    // rather than two lone rocks. The gap in the middle is what stays open, and it is far wider than the ship.
    addRock(-(spread - T.GATE_COMPANION), z);
    addRock(spread - T.GATE_COMPANION, z);
  } else {
    const side = T.LANE_OFFSETS[lane % T.LANE_OFFSETS.length];
    addRock(side, z);
    // The row's second rock, further out on the same side (see LANE_COMPANION): the dodge is the same swing it
    // always was, past a mass of rock instead of one lump, and the far side of the corridor stays wide open.
    addRock(side + Math.sign(side) * T.LANE_COMPANION, z);
    lane += 1;
  }
  // A full spacing into and out of a gate or a ridge, so a player skimming the ground has time to climb.
  const nextKind = (row + 1) % T.ROCK_ROW_PATTERN;
  const roomy = kind >= T.ROCK_ROW_PATTERN - 2 || nextKind >= T.ROCK_ROW_PATTERN - 2;
  const gap = T.ROCK_SPACING * (roomy ? 1 : T.ROCK_TIGHT_GAP);
  z -= gap;
  fieldLength += gap;
}

// Sit the rock on the ground under it. Called every frame, because the ground rolls as the field scrolls.
// The rock's own half height — its fitted box times its instance scale — is how far its centre sits above its
// base, so its bottom edge lands exactly on the terrain whatever size the rock was dressed at.
function sitOnGround(rock) {
  rock.position.y = terrainHeightAt(rock.position.x, rock.position.z) + rock.userData.half.y;
}

export function resetRocks() {
  for (const rock of rocks) {
    rock.position.z = rock.userData.startZ;
    sitOnGround(rock);
  }
}

// Scroll the rocks with the ground, and send each one that passes the camera back a whole field length.
export function updateRocks(dt) {
  const moved = T.FORWARD_SPEED * dt;
  for (const rock of rocks) {
    rock.position.z += moved;
    if (rock.position.z > T.CAMERA_BACK + 10) rock.position.z -= fieldLength;
    sitOnGround(rock);
  }
}

// Did the ship's box meet any rock's box? Plain axis-aligned boxes are enough for M1. Each rock is tested
// against its own half sizes, so the box reaches exactly as far as the rock the player can see does, whatever
// size that rock was dressed at.
function rockHitTest(shipPosition) {
  for (const rock of rocks) {
    const half = rock.userData.half;
    if (Math.abs(shipPosition.x - rock.position.x) < T.SHIP_WIDTH / 2 + half.x
      && Math.abs(shipPosition.y - rock.position.y) < T.SHIP_HEIGHT / 2 + half.y
      && Math.abs(shipPosition.z - rock.position.z) < T.SHIP_LENGTH / 2 + half.z) return true;
  }
  return false;
}

// The hull, and the invulnerability window that makes it fair. A rock scrolls through the ship's box over
// several frames, so without the window one rock would hand out a hit on every one of those frames.
let hull = T.HULL_MAX;
let invulnerable = 0;

export function resetHull() {
  hull = T.HULL_MAX;
  invulnerable = 0;   // no grace period needed: the field starts a whole row ahead of the ship
}

export function hullPoints() {
  return hull;
}

export function updateHull(dt) {
  if (invulnerable > 0) invulnerable = Math.max(0, invulnerable - dt);
}

// Tick the window down, then take a hit if a rock is touching the ship. Returns true only on the frame a
// rock actually costs hull, which is the frame the HUD flashes.
export function collideRocks(shipPosition) {
  if (invulnerable > 0) return false;
  if (!rockHitTest(shipPosition)) return false;
  hull = Math.max(0, hull - T.COLLISION_DAMAGE);
  invulnerable = T.HIT_INVULNERABLE;
  return true;
}

// --- building one rock's shape -----------------------------------------------

// How much of the way from a to b the value v has come, smoothed. Used to blend the rock's colours.
function smoothstep(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// One ring of points round the y axis: `n` of them at height `y`, each at `radius` times its own entry in
// `perPoint` (which is what makes a jagged rim) plus its own entry in `lift`. `phase` turns the whole ring,
// which is how a square ring is stood up so its flat sides face the axes. Rings carry many points, so the solids
// they stack into are finely faceted rather than built of a handful of big planes.
function ring(n, radius, y, phase, perPoint, lift) {
  const points = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (phase || 0);
    const r = radius * (perPoint ? perPoint[i] : 1);
    points.push([Math.cos(angle) * r, y + (lift ? lift[i] : 0), Math.sin(angle) * r]);
  }
  return points;
}

// The fractional part of a hashed number: a fixed, arbitrary-looking value in 0..1 for whatever it is given.
// Nothing random is used anywhere in this file, so every world is dressed exactly the same way on every run.
function hashed(value) {
  const h = Math.sin(value) * 43758.5453;
  return h - Math.floor(h);
}

// Per-point radius factors for a rim that has been chipped back: `amount` is how far a point may be cut in from
// the ring's own radius, never past it. The four points that sit on the x and z axes keep the full radius, so
// the widest part of a shard stays exactly on the box faces — which is the only reason the turn test can find
// any safe angle for it at all (see fitTurnSteps). Every ring that uses this has a point count that is a
// multiple of four, so those four axis points exist. The hash is the point and the ring number, so a rim is
// chipped the same way every run, and two rings of one solid are not chipped in step.
function wobble(n, seed, amount) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = i % (n / 4) === 0 ? 1 : 1 - amount * hashed((i + 1) * 12.9898 + (seed + 1) * 78.233);
  }
  return out;
}

// The same for a rim that steps up off its ring's own height and never below it — a block snapped off rather
// than cut. Every ring of one solid is given the same `seed`, so a point that steps up in one band steps up in
// all of them: with the amounts growing gently upward, no band can cross over the one below it.
function stepped(n, seed, amount) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = amount * hashed((i + 1) * 4.1231 + (seed + 1) * 27.619);
  return out;
}

// The per-point radius factors of a rounded square: square enough at the four flat sides to read as a mesa,
// round enough through the four corners that smooth shading has a curve to work with. `power` is how square.
function squircle(n, power) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const c = Math.pow(Math.abs(Math.cos(angle)), power);
    const s = Math.pow(Math.abs(Math.sin(angle)), power);
    out[i] = 1 / Math.pow(c + s, 1 / power);
  }
  return out;
}

// A closed solid from a stack of rings of the same length, bottom first: sides between each pair of
// rings, a cap underneath, and the top closed either by a cap or by a single `apex` point, which is what makes
// a crystal shard. Every triangle is wound to look outward. The shading it is left with is per face, which is
// what the crystal shapes want and what finish() smooths over for the ones that want a woven skin instead.
function solid(rings, apex) {
  const verts = [];
  const tri = (a, b, c) => { verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); };
  const n = rings[0].length;
  for (let r = 0; r < rings.length - 1; r++) {
    const low = rings[r];
    const high = rings[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(low[i], high[i], low[j]);
      tri(low[j], high[i], high[j]);
    }
  }
  const centreOf = (points) => {
    let x = 0; let y = 0; let z = 0;
    for (const p of points) { x += p[0]; y += p[1]; z += p[2]; }
    return [x / points.length, y / points.length, z / points.length];
  };
  const bottom = rings[0];
  const foot = centreOf(bottom);
  for (let i = 0; i < n; i++) tri(foot, bottom[i], bottom[(i + 1) % n]);
  const top = rings[rings.length - 1];
  if (apex) {
    for (let i = 0; i < n; i++) tri(top[i], apex, top[(i + 1) % n]);
  } else {
    const cap = centreOf(top);
    for (let i = 0; i < n; i++) tri(cap, top[(i + 1) % n], top[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geometry.computeVertexNormals();   // non-indexed, so this gives one normal per face
  return geometry;
}

// Glue a few primitives into one geometry, so a rock made of several pieces is still one mesh and one draw
// call. The pieces are thrown away once their vertices have been copied.
function merge(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  let at = 0;
  for (const g of parts) {
    position.set(g.attributes.position.array, at);
    normal.set(g.attributes.normal.array, at);
    at += g.attributes.position.array.length;
  }
  for (const g of list) g.dispose();
  for (const g of parts) g.dispose();
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  return merged;
}

// Average the face normals of every vertex that sits at the same point, so a subdivided surface shades as one
// woven skin instead of a web of facets: this is what turns "many small triangles" into "a rounded rock". The
// flat-faceted shapes never call it — their per-face normals are the point of them. Geometry is non-indexed by
// the time it gets here, so the faces meeting at a corner are found by their shared position, quantised to a
// tenth of a millimetre so that floating-point dust cannot split a corner in two.
function smoothNormals(geometry) {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  const at = (i) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const sums = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = at(i);
    let sum = sums.get(key);
    if (!sum) { sum = [0, 0, 0]; sums.set(key, sum); }
    sum[0] += n.getX(i);
    sum[1] += n.getY(i);
    sum[2] += n.getZ(i);
  }
  for (let i = 0; i < p.count; i++) {
    const sum = sums.get(at(i));
    const length = Math.hypot(sum[0], sum[1], sum[2]) || 1;
    n.setXYZ(i, sum[0] / length, sum[1] / length, sum[2] / length);
  }
  n.needsUpdate = true;
}

// A box with its edges and corners rounded off. Each vertex is pulled back to a core box the same size less the
// round radius, then pushed back out along that offset by the radius, which leaves the flat faces exactly where
// they were and bends every edge and corner through a quarter circle of that radius. It is the difference
// between a stacked outcrop of cubes and the same outcrop weathered.
function roundedBox(w, h, d, radius, segments) {
  const geometry = new THREE.BoxGeometry(w, h, d, segments, segments, segments);
  const r = Math.min(radius, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  const core = [w / 2 - r, h / 2 - r, d / 2 - r];
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const cx = Math.max(-core[0], Math.min(core[0], x));   // the nearest point of the core box
    const cy = Math.max(-core[1], Math.min(core[1], y));
    const cz = Math.max(-core[2], Math.min(core[2], z));
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length > 1e-6) {
      const back = r / length;    // push the offset back out to exactly the round radius
      p.setXYZ(i, cx + dx * back, cy + dy * back, cz + dz * back);
    }
  }
  return geometry;
}

// A box slab, moved and turned about its own centre: the sandstone and the alpine rock are stacked from these.
// The slab is subdivided and its edges rounded (see roundedBox), so a stack of them shades as worn stone with
// soft steps rather than as a pile of plain cubes with knife corners.
function block(w, h, d, x, y, z, rotY, rotZ) {
  const geometry = roundedBox(w, h, d, SLAB_ROUND, SLAB_SEGMENTS);
  if (rotY) geometry.rotateY(rotY);
  if (rotZ) geometry.rotateZ(rotZ);
  geometry.translate(x, y, z);
  return geometry;
}

// Push a shape's surface in and out with a fixed hash of where each vertex is, so a boulder comes out lumpy
// but identical every run. The hash is the position, so vertices shared by two faces move together and the
// surface cannot split open. Two octaves: the wide swell a boulder has, and a second at twice that frequency
// and a third of the size, which the subdivided mesh is fine enough to resolve — lumps within lumps rather than
// one bumpy shell.
function lump(geometry, amount) {
  const p = geometry.attributes.position;
  const fine = amount * LUMP_FINE;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const wide = hashed(x * 12.9898 + y * 78.233 + z * 37.719) - 0.5;
    const small = hashed(x * 25.9796 + y * 156.466 + z * 75.438) - 0.5;
    const wobble = 1 + amount * wide + fine * small;
    p.setXYZ(i, x * wobble, y * wobble, z * wobble);
  }
  p.needsUpdate = true;
}

// The box one shape is fitted into, from its profile: the profile's three fractions run 0..1 and are spread
// across the envelope in tuning.js, so no two of a world's six shapes come out the same size. The height
// fraction stops at FIT_H_MAX rather than ROCK_HEIGHT_MAX, since that is the ceiling with the instance scale
// still to come.
function sizeForProfile(profile) {
  const between = (min, max, t) => min + (max - min) * t;
  return {
    x: between(T.ROCK_WIDTH_MIN, T.ROCK_WIDTH_MAX, profile.w),
    y: between(T.ROCK_HEIGHT_MIN, FIT_H_MAX, profile.h),
    z: between(T.ROCK_LENGTH_MIN, T.ROCK_LENGTH_MAX, profile.l)
  };
}

// Squash and shift a built shape until its bounding box is exactly the box its profile asked for: the widest
// part of the rock reaches the box's own faces in x and z, nothing pokes past them, and the bottom edge sits on
// the ground that sitOnGround puts it on. Every rock goes through this, so no shape can quietly outgrow its box.
// The box's half sizes are stored on the geometry, so the turn test, the paint and the hit test all read the
// exact size this shape was fitted to.
function fitToBox(geometry, size) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const sx = size.x / Math.max(1e-6, box.max.x - box.min.x);
  const sy = size.y / Math.max(1e-6, box.max.y - box.min.y);
  const sz = size.z / Math.max(1e-6, box.max.z - box.min.z);
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
  geometry.scale(sx, sy, sz);
  geometry.computeVertexNormals();   // the scale was not even, so the face normals are remade here
  geometry.userData.half = { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
  return geometry;
}

// Flip a fitted shape left to right, reversing each triangle as it goes so the faces still look outward. The
// fitted box is symmetric about the origin, so a mirrored rock fills it exactly: this doubles the shapes a
// world has to show without a single new triangle, so neighbours in a ridge row need not be the same rock twice.
function mirrorX(geometry) {
  const p = geometry.attributes.position.array;
  const n = geometry.attributes.normal.array;
  const c = geometry.attributes.color.array;
  for (let i = 0; i < p.length; i += 9) {   // one triangle is nine numbers: swap its first and last vertex
    for (let k = 0; k < 3; k++) {
      const a = i + k;
      const b = i + 6 + k;
      const held = p[a]; p[a] = p[b]; p[b] = held;
      const other = n[a]; n[a] = n[b]; n[b] = other;
      const shade = c[a]; c[a] = c[b]; c[b] = shade;
    }
  }
  for (let i = 0; i < p.length; i += 3) {   // then reflect the whole rock in x
    p[i] = -p[i];
    n[i] = -n[i];
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.normal.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  return geometry;
}

// How many whole TURN_STEP turns about y a shape can take, either way, and still fit its own box. A fitted rock
// fills its box as it stands, so turning it pushes its corners out; this walks its vertices round in steps in
// both directions and keeps the last step that stayed inside. A rock's own turn is taken in whole steps out of
// this count (see dressRocks), so no rock is ever turned to an angle the test did not check.
function fitTurnSteps(geometry) {
  const p = geometry.attributes.position;
  const half = geometry.userData.half;   // the box this shape was fitted to, not one shared size
  const reach = (sign) => {
    let safe = 0;
    for (let step = 1; step <= TURN_STEPS_MAX; step++) {
      const c = Math.cos(step * TURN_STEP * sign);
      const s = Math.sin(step * TURN_STEP * sign);
      let inside = true;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) * c + p.getZ(i) * s;    // three's own rotation about y
        const z = p.getZ(i) * c - p.getX(i) * s;
        if (Math.abs(x) > half.x + 1e-4 || Math.abs(z) > half.z + 1e-4) { inside = false; break; }
      }
      if (!inside) break;
      safe = step;
    }
    return safe;
  };
  return Math.min(reach(1), reach(-1));
}

// --- painting one rock -------------------------------------------------------

const paintColor = new THREE.Color();
const paintTop = new THREE.Color();
const paintFoot = new THREE.Color();

// Colour the rock by which way each face looks and how high it sits: the pale `top` colour on the faces the
// sky shines on, `side` on the flanks, and the world's own rock colour gathering at the foot and under any
// overhang. It is the same rule for all four worlds; only the three colours change. `halfY` is this shape's own
// half height, so the foot colour gathers over each rock's own height whether it is a low slab or a tall spire.
function paintRock(geometry, palette, halfY) {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  const colors = new Float32Array(p.count * 3);
  paintTop.set(palette.top);
  paintFoot.set(palette.foot);
  for (let i = 0; i < p.count; i++) {
    const up = smoothstep(0.3, 0.85, n.getY(i));                        // 1 on a face the sky shines on
    const low = smoothstep(0.1, 0.9, (halfY - p.getY(i)) / (2 * halfY)); // 1 at the rock's foot
    const down = smoothstep(-0.2, -0.7, n.getY(i));                     // 1 under an overhang
    paintColor.set(palette.side).lerp(paintTop, up).lerp(paintFoot, Math.min(1, 0.7 * low + 0.5 * down));
    colors[i * 3] = paintColor.r;
    colors[i * 3 + 1] = paintColor.g;
    colors[i * 3 + 2] = paintColor.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// Texture coordinates in metres, so the painted grain is the same size on a shard, a slab and a boulder. Each
// triangle is projected along whichever axis it mostly faces: the two world axes it lies in become u and v.
function setRockUVs(geometry) {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 3) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    for (let k = 0; k < 3; k++) {
      const j = i + k;
      let u;
      let v;
      if (ay >= ax && ay >= az) { u = p.getX(j); v = p.getZ(j); }        // a top face: seen from above
      else if (ax >= az) { u = p.getZ(j); v = p.getY(j); }               // a face looking along x
      else { u = p.getX(j); v = p.getY(j); }                            // a face looking along z
      uv[j * 2] = u / TEXTURE_METRES;
      uv[j * 2 + 1] = v / TEXTURE_METRES;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

// --- the painted detail ------------------------------------------------------

const TAU = Math.PI * 2;
// A mark near a texture edge is drawn at all nine whole-canvas offsets, which carries the part that runs off
// one side back in on the other; one well inside the tile needs a single pass.
const INSIDE_OFFSETS = [[0, 0]];
const WRAP_OFFSETS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]];

// Run `draw` at every offset a mark needs, so the painted tile has no seam where it repeats.
function repeated(size, minX, minY, maxX, maxY, draw) {
  const outside = minX < 0 || minY < 0 || maxX > size || maxY > size;
  for (const [dx, dy] of (outside ? WRAP_OFFSETS : INSIDE_OFFSETS)) draw(dx * size, dy * size);
}

// A straight-sided path on the tile: stroked when `width` is given, filled when it is not, closed if asked.
function mark(ctx, size, points, style, width, closed) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  if (width) ctx.strokeStyle = style; else ctx.fillStyle = style;
  ctx.lineWidth = width || 1;
  repeated(size, minX, minY, maxX, maxY, (dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x + dx, points[0].y + dy);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x + dx, points[i].y + dy);
    if (closed) ctx.closePath();
    if (width) ctx.stroke(); else ctx.fill();
  });
}

// A rounded mark: a patch of moss, a speck of grit, a crystal flash.
function blob(ctx, size, x, y, rx, ry, fill, rotation) {
  ctx.fillStyle = fill;
  repeated(size, x - rx, y - ry, x + rx, y + ry, (dx, dy) => {
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, rx, ry, rotation || 0, 0, TAU);
    ctx.fill();
  });
}

// A full-width band across the tile, drawn again a tile above and below: the sandstone's strata. Bands run
// across the canvas, and the side faces of a rock map their height to v, so they come out as layers.
function band(ctx, size, y, height, fill) {
  ctx.fillStyle = fill;
  for (let k = -1; k <= 1; k++) ctx.fillRect(0, y + k * size, size, height);
}

// Ice: a pale crystalline grain, faint faceted flashes, and long jittered cracks each drawn as a cyan seam
// with a white lip beside it — the cyan the reference photo shows down in the ice.
function paintIce(ctx, size) {
  ctx.fillStyle = '#f2fbff';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.06 + Math.random() * 0.14);
    mark(ctx, size, [{ x, y }, { x: x + r, y: y + r * 0.3 }, { x: x + r * 0.4, y: y + r }],
      Math.random() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(150,205,225,0.35)', 0, true);
  }
  for (let crack = 0; crack < 16; crack++) {
    const points = [];
    let x = Math.random() * size;
    let y = Math.random() * size;
    let angle = Math.random() * TAU;
    for (let step = 0; step < 6; step++) {
      points.push({ x, y });
      angle += (Math.random() - 0.5) * 1.1;
      const run = size * (0.08 + Math.random() * 0.12);
      x += Math.cos(angle) * run;
      y += Math.sin(angle) * run;
    }
    mark(ctx, size, points, 'rgba(34,112,142,0.6)', 1.8 * PEN);
    mark(ctx, size, points.map((p) => ({ x: p.x + 1.4 * PEN, y: p.y + 1.4 * PEN })), 'rgba(255,255,255,0.85)', 0.8 * PEN);
  }
  for (let i = 0; i < 150; i++) {
    blob(ctx, size, Math.random() * size, Math.random() * size, 0.9 * PEN, 0.9 * PEN, 'rgba(255,255,255,0.8)');
  }
}

// Desert: sandstone laid down in strata — bands of rust-red, tan and dust across the tile — with grit over it.
function paintDesert(ctx, size) {
  ctx.fillStyle = '#f7ecd6';
  ctx.fillRect(0, 0, size, size);
  let y = 0;
  while (y < size) {
    const height = size * (0.05 + Math.random() * 0.13);
    const roll = Math.random();
    const fill = roll < 0.3 ? 'rgba(138,76,42,0.45)'    // a rust-red band, the world's own rock colour
      : roll < 0.6 ? 'rgba(196,158,110,0.4)'            // a softer tan band
        : 'rgba(255,255,255,0.35)';                     // a pale, dustier band
    band(ctx, size, y, height, fill);
    y += height;
  }
  for (let i = 0; i < 300; i++) {
    blob(ctx, size, Math.random() * size, Math.random() * size, 0.8 * PEN, 0.8 * PEN,
      Math.random() < 0.5 ? 'rgba(150,112,70,0.5)' : 'rgba(255,255,255,0.7)');
  }
}

// Jungle: bare brown rock with clumps of moss growing over it, lighter on top of each clump and dark in the
// gaps between them — the canopy has had a long time to settle on these.
function paintJungle(ctx, size) {
  ctx.fillStyle = '#efe9db';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rx = size * (0.03 + Math.random() * 0.08);
    const ry = rx * (0.6 + Math.random() * 0.6);
    blob(ctx, size, x, y, rx, ry, 'rgba(74,112,52,0.45)', Math.random() * Math.PI);
    blob(ctx, size, x - rx * 0.15, y - ry * 0.2, rx * 0.65, ry * 0.6, 'rgba(126,164,88,0.4)', Math.random() * Math.PI);
  }
  for (let i = 0; i < 90; i++) {
    blob(ctx, size, Math.random() * size, Math.random() * size, size * 0.01, size * 0.016,
      'rgba(107,74,46,0.4)', Math.random() * Math.PI);
  }
  for (let i = 0; i < 70; i++) {
    blob(ctx, size, Math.random() * size, Math.random() * size, 0.8 * PEN, 0.8 * PEN, 'rgba(30,46,24,0.5)');
  }
}

// Alpine: grey rock grain, dark fractures running through it, and pale streaks of snow dust lying along the
// faces — the world's own grey with its snow line carried up onto the rocks.
function paintAlpine(ctx, size) {
  ctx.fillStyle = '#f2f4f6';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const rx = size * (0.02 + Math.random() * 0.06);
    blob(ctx, size, Math.random() * size, Math.random() * size, rx, rx * (0.5 + Math.random() * 0.5),
      'rgba(110,116,122,0.35)', Math.random() * Math.PI);
  }
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const angle = (Math.random() - 0.5) * 0.8;
    const run = size * (0.08 + Math.random() * 0.2);
    mark(ctx, size, [{ x, y }, { x: x + Math.cos(angle) * run, y: y + Math.sin(angle) * run }],
      'rgba(74,80,86,0.5)', 1.4 * PEN);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const run = size * (0.05 + Math.random() * 0.15);
    mark(ctx, size, [{ x, y }, { x: x + run, y: y + run * 0.25 }], 'rgba(255,255,255,0.75)', 1.1 * PEN);
  }
  for (let i = 0; i < 200; i++) {
    blob(ctx, size, Math.random() * size, Math.random() * size, 0.8 * PEN, 0.8 * PEN,
      Math.random() < 0.5 ? 'rgba(96,102,108,0.4)' : 'rgba(255,255,255,0.6)');
  }
}

const PAINTERS = { ICE: paintIce, DESERT: paintDesert, JUNGLE: paintJungle, ALPINE: paintAlpine };

// The crack and speck weights inside the painters are quoted in pixels of a 128 px tile and multiplied by this,
// so the painted marks keep the same weight on the tile whatever resolution ROCK_TEXTURE_SIZE asks for: a finer
// tile gives finer detail, not thinner lines.
const PEN = ROCK_TEXTURE_SIZE / 128;

// One square of painted rock, drawn in code — the game loads no image files. It is pale, so it multiplies the
// rock's vertex colours rather than replacing them, and its faces are mapped in metres (see setRockUVs), so
// one texture serves every shape in a world.
function rockCanvas(kind) {
  const size = ROCK_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  PAINTERS[kind](ctx, size);
  return canvas;
}

// A canvas as one of the rock's textures. They all repeat the same way over the same metres of rock, so the
// relief and the roughness can never slide against the colour they were painted from.
function rockCanvasTexture(canvas, srgb) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(ROCK_TEXTURE_REPEAT, ROCK_TEXTURE_REPEAT);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;   // the colour map is colour; the relief maps are numbers
  texture.needsUpdate = true;   // colorSpace and repeat are read when the texture is uploaded
  return texture;
}

// Read the painted tile back as relief. Its own brightness becomes a height: a darker mark is a groove, and the
// slope of that brightness across the tile is the tilt of the surface, which is the normal map three wants in
// tangent space. The same brightness becomes roughness, so the pale grain the light lands on is smoother than
// the dark seams running through it. Nothing new is drawn here — the cracks, strata, moss and grain the painters
// already laid down are what stand proud of the rock.
function reliefMaps(canvas) {
  const size = canvas.width;
  const pixels = canvas.getContext('2d').getImageData(0, 0, size, size).data;
  const bright = new Float32Array(size * size);
  for (let i = 0; i < bright.length; i++) {
    bright[i] = (pixels[i * 4] * 0.299 + pixels[i * 4 + 1] * 0.587 + pixels[i * 4 + 2] * 0.114) / 255;
  }
  const normalCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  for (const target of [normalCanvas, roughCanvas]) {
    target.width = size;
    target.height = size;
  }
  const normalCtx = normalCanvas.getContext('2d');
  const roughCtx = roughCanvas.getContext('2d');
  const normalImage = normalCtx.createImageData(size, size);
  const roughImage = roughCtx.createImageData(size, size);
  // The tile repeats, so a sample off one edge is read from the far side: the relief has no seam either.
  const at = (x, y) => bright[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // How fast the paint darkens across the tile, and down it. A mark that darkens to the right is a wall
      // facing left, so the surface tilts back; a mark that darkens downward tilts the other way, the two
      // flipped axes cancelling out because v runs up the map's image while y runs down it.
      const du = (at(x + 1, y) - at(x - 1, y)) * RELIEF_HEIGHT;
      const dv = (at(x, y + 1) - at(x, y - 1)) * RELIEF_HEIGHT;
      const length = Math.sqrt(du * du + dv * dv + 1);
      normalImage.data[i * 4] = ((-du / length) * 0.5 + 0.5) * 255;
      normalImage.data[i * 4 + 1] = ((dv / length) * 0.5 + 0.5) * 255;
      normalImage.data[i * 4 + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      normalImage.data[i * 4 + 3] = 255;
      const rough = (ROUGH_MIN + (ROUGH_MAX - ROUGH_MIN) * (1 - at(x, y))) * 255;
      roughImage.data[i * 4] = rough;
      roughImage.data[i * 4 + 1] = rough;
      roughImage.data[i * 4 + 2] = rough;
      roughImage.data[i * 4 + 3] = 255;
    }
  }
  normalCtx.putImageData(normalImage, 0, 0);
  roughCtx.putImageData(roughImage, 0, 0);
  return {
    normalMap: rockCanvasTexture(normalCanvas, false),
    roughnessMap: rockCanvasTexture(roughCanvas, false)
  };
}

// --- the four worlds' rocks --------------------------------------------------

// ICE: sharp shards and broken crystal. A tapered prism closed to a point is a shard; a prism whose rim steps
// up and up as it climbs is a block that looks snapped off rather than cut. Every ring carries many points and a
// hashed chip out of its rim, so a shard is a cluster of small crystal faces rather than five big ones, and the
// shading pass leaves them all flat: cut crystal keeps crisp facets, and rounding them would lose the look.

// One shard: a foot ring of `footRadius` at the rock's base, `SHARD_RINGS` bands above it narrowing to
// `tipRadius` at height `top`, and a point at `apexY`. `t` is how far up the taper a band sits, and the radius
// falls off with its square, which is the concave ice-crystal profile the shards have always had. `phase` turns
// the whole prism, which is how the cluster's two pieces are twisted away from each other.
function shard(n, footRadius, tipRadius, top, apexY, phase, seed, chip) {
  const rings = [ring(n, footRadius, -1, phase)];
  for (let k = 1; k <= SHARD_RINGS; k++) {
    const t = k / SHARD_RINGS;
    rings.push(ring(n, footRadius + (tipRadius - footRadius) * t * t, -1 + (top + 1) * t, phase,
      wobble(n, seed + k, chip + 0.06 * t)));
  }
  return solid(rings, [0, apexY, 0]);
}

function iceShard() {
  return shard(SHARD_SIDES, 1, 0.3, 0.9, 1.5, 0, 0, 0.07);
}

// The same block as before, in eight bands whose rims step up by more and more as they climb, so its top is a
// broken surface rather than one lifted ring.
function iceBlock() {
  const n = SHARD_SIDES;
  const bands = 8;
  const rings = [];
  for (let k = 0; k < bands; k++) {
    const t = k / (bands - 1);
    rings.push(ring(n, 1 - 0.14 * t, -1 + 1.6 * t, 0,
      k === 0 ? null : wobble(n, 10 + k, 0.07),
      k === 0 ? null : stepped(n, SHARD_STEP_SEED, 0.62 * t * t)));
  }
  return solid(rings);
}

// Two shards of different sizes leaning away from each other: the broken pieces such a cave floor is littered with.
function iceCluster() {
  const big = shard(SHARD_CLUSTER_SIDES, 0.9, 0.45, 0.5, 1.4, 0, 30, 0.09);
  big.rotateZ(0.18);
  big.translate(-0.35, 0, 0);
  const small = shard(SHARD_CLUSTER_SIDES, 0.55, 0.3, 0.2, 0.9, 0.6, 60, 0.1);
  small.rotateZ(-0.3);
  small.translate(0.7, 0, -0.3);
  return merge([big, small]);
}

// DESERT: sandstone. Flat slabs stacked into an outcrop, a blunt flat-topped butte, and a mesa whose top slab
// has started to slide. The stacking is the shape it always was; the blocks themselves are rounded, subdivided
// and shaded smooth, so the steps between them read as worn sandstone rather than as hard low-poly cubes.
function desertSlabs() {
  return merge([
    block(1.9, 1.3, 2.4, 0, -1.6, 0, 0.05),
    block(1.65, 1.1, 2.05, 0.14, -0.42, -0.12, -0.08),
    block(1.25, 1.0, 1.6, -0.1, 0.62, 0.1, 0.12),
    block(0.95, 0.6, 1.2, 0.05, 1.5, -0.05, -0.2)
  ]);
}

// A rounded-square cross-section stands its flat sides to the axes, so this reads as a butte rather than a
// diamond; twenty points round give the four corners a curve for the smooth shading to soften, five rings give
// the flanks a slight swell, and the top is left blunt and flat.
function desertButte() {
  const n = 20;
  const profile = squircle(n, 6);
  return solid([
    ring(n, 1, -1, 0, profile),
    ring(n, 0.98, -0.6, 0, profile),
    ring(n, 0.9, -0.1, 0, profile),
    ring(n, 0.82, 0.4, 0, profile),
    ring(n, 0.74, 0.95, 0, wobble(n, 51, 0.03))
  ]);
}

function desertTilt() {
  return merge([
    block(1.85, 1.8, 2.3, 0, -1.3, 0),
    block(1.6, 1.1, 2.0, 0.1, 0.05, 0, 0.1, 0.14),
    block(0.9, 0.7, 1.1, -0.25, 1.35, 0.15, -0.3, -0.12)
  ]);
}

// JUNGLE: three kinds of tree, each a different height and a different build — a broad full-canopy tree, a
// narrower, taller conifer, and a squat wide umbrella. A tree is a few rounded pieces glued into one mesh: an
// octagonal trunk, and a crown of icosahedral lobes, lumped and then welded smooth by finish(), which is what
// turns a handful of balls into one leafy mass. Two rules keep every tree honest against the hit test: the
// widest part of a tree is up in its crown rather than at a point, and its trunk is at least half as wide as
// that crown, so the box around the tree is nowhere much wider than the tree the ship can see.

// One lobe of a tree's crown: an icosahedron, squashed a little vertically so a crown of them reads as one leafy
// mass rather than as a bunch of balls, moved to where it sits on the tree.
function lobe(x, y, z, radius, squash) {
  const geometry = new THREE.IcosahedronGeometry(radius, CROWN_STEPS);
  geometry.scale(1, squash, 1);
  geometry.translate(x, y, z);
  return geometry;
}

// A tree's trunk: a short octagonal column of three rings, widest where it meets the ground, narrowing a little
// where the crown takes over. Eight points round is enough for the smooth shading to give it a curve.
function trunk(rFoot, rTop, yFoot, yTop) {
  const n = 8;
  return solid([
    ring(n, rFoot, yFoot),
    ring(n, (rFoot + rTop) / 2, (yFoot + yTop) / 2),
    ring(n, rTop, yTop)
  ]);
}

// Kind one: a broad, full-canopy tree. A fat trunk under a wide crown of five intergrown lobes, the middle one
// the highest and broadest, so the tree's widest ring is up among its leaves.
function jungleCanopyTree() {
  const geometry = merge([
    trunk(0.62, 0.55, -1.0, -0.3),
    lobe(0, 0.34, 0, 0.88, 0.8),
    lobe(-0.64, 0.02, 0.08, 0.54, 0.5),
    lobe(0.68, -0.02, -0.1, 0.5, 0.48),
    lobe(0.06, 0.0, 0.62, 0.5, 0.46),
    lobe(-0.05, -0.06, -0.6, 0.46, 0.44)
  ]);
  lump(geometry, LUMP * 0.8);
  return geometry;
}

// Kind two: a narrower, taller conifer. Four tiers of fronds, each stepping out a little from the tier below and
// then falling away to the next, up to a blunt summit that is still over two thirds of the foot's width: a
// stepped spire of a tree, but a full-bodied one, with no thin empty taper for the hit test to catch the ship on.
function jungleConifer() {
  const n = CONIFER_SIDES;
  const rim = (k) => wobble(n, CONIFER_SEED + k, CONIFER_CHIP);
  const geometry = solid([
    ring(n, 1.0, -1.0, 0, null),      // the foot, and the tree's widest ring
    ring(n, 0.86, -0.58, 0, rim(0)),
    ring(n, 0.95, -0.54, 0, rim(1)),  // tier two steps out
    ring(n, 0.8, -0.12, 0, rim(2)),
    ring(n, 0.87, -0.08, 0, rim(3)),  // tier three
    ring(n, 0.75, 0.34, 0, rim(4)),
    ring(n, 0.79, 0.38, 0, rim(5)),   // the top tier
    ring(n, 0.71, 1.0, 0, rim(6))     // the blunt summit
  ]);
  lump(geometry, LUMP * 0.7);
  return geometry;
}

// Kind three: a squat, wide tree. A short trunk under one flat crown of seven lobes — six spread round a ring
// and one in the middle of them — so it is much wider than it is tall and its silhouette is an umbrella, a
// different kind of tree again and not another size of the first two.
function jungleUmbrella() {
  const parts = [trunk(0.7, 0.6, -1.0, -0.4)];
  for (let i = 0; i < UMBRELLA_LOBES; i++) {
    const angle = (i / UMBRELLA_LOBES) * Math.PI * 2 + UMBRELLA_TWIST;
    parts.push(lobe(Math.cos(angle) * 0.88, 0.2, Math.sin(angle) * 0.88, 0.6, 0.42));
  }
  parts.push(lobe(0, 0.36, 0, 0.78, 0.6));
  const geometry = merge(parts);
  lump(geometry, LUMP * 0.7);
  return geometry;
}

// ALPINE: mountain peaks — the tops of mountains, where the crags stood. Every peak is a full-bodied solid: its
// widest ring is a shoulder up the flank rather than the ground itself, its foot is only a little narrower than
// that shoulder, and its summit stays close to three quarters of the shoulder's width, so the box the hit test
// uses never reaches far past the rock the ship can see. Each of the three has a different build and takes a
// different size out of SHAPE_PROFILES, so a field of them is a range of summits rather than one summit repeated.

// Kind one: a broad summit. Widest at the shoulder a third of the way up, flanks falling away to a foot almost
// as wide, and a summit that keeps three quarters of the shoulder's width.
function alpineBroadPeak() {
  const n = PEAK_SIDES;
  const rim = (k) => wobble(n, PEAK_SEED + k, PEAK_CHIP);
  const geometry = solid([
    ring(n, 0.95, -1.0, 0, rim(0)),
    ring(n, 1.0, -0.35, 0, rim(1)),    // the shoulder, and the peak's widest ring
    ring(n, 0.97, 0.1, 0, rim(2)),
    ring(n, 0.91, 0.5, 0, rim(3)),
    ring(n, 0.83, 0.82, 0, rim(4)),
    ring(n, 0.76, 1.0, 0, rim(5))      // the summit
  ]);
  lump(geometry, PEAK_LUMP);
  return geometry;
}

// Kind two: a whaleback. Its widest ring is high up the flank rather than near the foot, and its summit is a
// broad rounded dome almost as wide as that — a mountain worn down rather than one still sharp, and a different
// silhouette from the peak above.
function alpineDome() {
  const n = PEAK_SIDES;
  const rim = (k) => wobble(n, PEAK_SEED + 10 + k, PEAK_CHIP);
  const geometry = solid([
    ring(n, 0.88, -1.0, 0, rim(0)),
    ring(n, 0.96, -0.42, 0, rim(1)),
    ring(n, 1.0, 0.1, 0, rim(2)),      // widest high up the flank
    ring(n, 0.96, 0.5, 0, rim(3)),
    ring(n, 0.9, 0.78, 0, rim(4)),
    ring(n, 0.85, 1.0, 0, rim(5))      // the dome, nearly as wide as the flank below it
  ]);
  lump(geometry, LUMP * 0.5);
  return geometry;
}

// Kind three: two summits on one massif — the top of more than one mountain at once. The main summit rises from a
// broad base; a lower summit stands beside it, joined to it by a shoulder, so the silhouette is a saddle over a
// broad body rather than two thin cones. Both summits keep most of the massif's width, which is what keeps the
// pair of them from leaving a notch of empty air inside the box.
function alpineTwinPeaks() {
  const n = PEAK_SIDES;
  const main = solid([
    ring(n, 1.0, -1.0, 0, wobble(n, PEAK_SEED + 20, PEAK_CHIP)),
    ring(n, 0.99, -0.3, 0, wobble(n, PEAK_SEED + 21, PEAK_CHIP)),
    ring(n, 0.93, 0.3, 0, wobble(n, PEAK_SEED + 22, PEAK_CHIP)),
    ring(n, 0.86, 1.0, 0, wobble(n, PEAK_SEED + 23, PEAK_CHIP))
  ]);
  main.translate(-0.3, 0, 0);
  const second = solid([
    ring(n, 0.84, -0.3, 0, wobble(n, PEAK_SEED + 30, PEAK_CHIP)),
    ring(n, 0.8, 0.25, 0, wobble(n, PEAK_SEED + 31, PEAK_CHIP)),
    ring(n, 0.72, 0.8, 0, wobble(n, PEAK_SEED + 32, PEAK_CHIP))
  ]);
  second.translate(0.62, 0, 0);
  const geometry = merge([main, second]);
  lump(geometry, PEAK_LUMP);
  return geometry;
}

// Each world's rocks: the shapes it is cut into, the painted detail texture over them, and the three colours
// paintRock blends between. The `foot` colour is the `rock` colour the makers chose for that world in
// planets.js — the palette base — and `side` and `top` are picked to sit with it: cyan rising to blue-white
// for the ice, rust-red to dusty tan for the sandstone, brown to canopy green for the jungle, grey to snow
// white for the alpine rock.
//
// Each shape also says how it should be shaded, shape by shape rather than file by file:
//   smooth false — the ICE shapes. A shard is cut crystal: its faces are meant to be hard, and welding them
//                  smooth would round off the edges that are the whole look of the world.
//   smooth true  — everything else. A boulder, a sandstone slab and a grey crag are weathered, not cut, so the
//                  many small triangles they are now built from are woven into one continuous surface.
const LOOKS = {
  ICE: {
    shapes: [
      { build: iceShard, smooth: false },
      { build: iceBlock, smooth: false },
      { build: iceCluster, smooth: false }
    ],
    texture: 'ICE',
    palette: (rock) => ({ top: '#eaf7fc', side: '#8fd2e8', foot: rock })
  },
  DESERT: {
    shapes: [
      { build: desertSlabs, smooth: true },
      { build: desertButte, smooth: true },
      { build: desertTilt, smooth: true }
    ],
    texture: 'DESERT',
    palette: (rock) => ({ top: '#d9c19b', side: '#b98a5c', foot: rock })
  },
  JUNGLE: {
    shapes: [
      { build: jungleCanopyTree, smooth: true },
      { build: jungleConifer, smooth: true },
      { build: jungleUmbrella, smooth: true }
    ],
    texture: 'JUNGLE',
    palette: (rock) => ({ top: '#3f7a35', side: '#557040', foot: rock })
  },
  ALPINE: {
    shapes: [
      { build: alpineBroadPeak, smooth: true },
      { build: alpineDome, smooth: true },
      { build: alpineTwinPeaks, smooth: true }
    ],
    texture: 'ALPINE',
    palette: (rock) => ({ top: '#eef3f8', side: '#a2a9ae', foot: rock })
  }
};

// The six sizes a world's rocks are cut to, one per geometry the world builds: three shapes, each as itself and
// mirrored left to right. Each entry is a point in the envelope in tuning.js: `h`, `w` and `l` run 0..1 from the
// smallest to the largest that axis is allowed to be, so the spread below reads as a low wide slab, a medium
// block and a tall thin spire rather than six copies of one rock. The two entries for one shape are deliberately
// far apart, so a shape's mirrored twin is not simply the same rock turned round. `h` deliberately crowds the top
// of its range — half these entries are at 0.75 or above — because a field whose obstacles all sit low is the one
// thing the makers asked twice not to have; and the two tall entries are given real width, so they read as big
// trees and peaks rather than as needles.
const SHAPE_PROFILES = [
  { h: 0.10, w: 1.00, l: 0.85 },   // a low, wide slab: skimmable
  { h: 1.00, w: 0.40, l: 0.35 },   // the tallest in the field, full-bodied rather than a needle
  { h: 0.45, w: 0.50, l: 0.55 },   // a medium block
  { h: 0.75, w: 0.68, l: 0.45 },   // a tall, broad block
  { h: 0.20, w: 0.62, l: 1.00 },   // a long, low slab
  { h: 0.92, w: 0.30, l: 0.38 }    // very tall and narrow, beside the second entry
];

// Everything a built shape has to go through once, in the one order that works: plain triangles first, because
// every step after this — welding the normals, fitting, mirroring, painting, the turn test — reads the vertices
// as three per face; then the fit to the shape's own box (see sizeForProfile), which also remakes the normals
// per face; then the shading the shape asked for, since painting below reads those normals; then the vertex
// colours and the texture coordinates.
function finish(geometry, palette, smooth, profile) {
  let shape = geometry;
  if (shape.index) {                       // a sphere arrives indexed; nothing below copes with that
    shape = shape.toNonIndexed();
    geometry.dispose();
  }
  const size = sizeForProfile(profile);
  fitToBox(shape, size);
  if (smooth) smoothNormals(shape);
  paintRock(shape, palette, size.y / 2);
  setRockUVs(shape);
  return shape;
}

// Hand each rock one of the world's shapes, the world's paint, a turn of its own taken from the angles the turn
// test checked for that shape, and a uniform scale of its own over the shape's own fitted size. The shapes are
// shared, so the whole field costs six geometries and one material between it: only the pick, the turn and the
// size differ from rock to rock, which keeps the triangles down.
function dressRocks(geometries, material, steps) {
  rocks.forEach((rock, i) => {
    // A fixed, evenly spread sequence rather than a random one, so a world always looks the same when it is
    // launched, and so neighbours in a ridge row do not fall into an obvious repeat.
    const shape = Math.floor(((i * 0.6180339887) % 1) * geometries.length);
    const reach = steps[shape];
    rock.geometry = geometries[shape];
    rock.material = material;
    // A shape whose corners already sit on the box faces takes no turn at all: it stands straight.
    rock.rotation.y = reach === 0 ? 0
      : (Math.round(((i * 0.7548776662) % 1) * (2 * reach + 1)) - reach) * TURN_STEP;
    // A small uniform scale on top of the fitted size, so two neighbours of one shape are not identical. Uniform,
    // never per axis, and that matters: three transforms an instance's normals by the matrix alone, so a rock
    // stretched on one axis would carry skewed normals and its normal map would not lie on it. The sequence is
    // the same evenly spread one the pick above uses, at a step of its own, so size does not march in step with
    // shape. This is the only randomness in the dressing, and it is a fixed hash of the rock's place, so a world
    // looks the same on every launch.
    const scale = T.ROCK_SCALE_MIN + (T.ROCK_SCALE_MAX - T.ROCK_SCALE_MIN) * ((i * 0.5698402909) % 1);
    const fitted = geometries[shape].userData.half;
    rock.scale.setScalar(scale);
    // The rock's own half sizes for sitOnGround and rockHitTest: its fitted box times this instance scale.
    rock.userData.half = { x: fitted.x * scale, y: fitted.y * scale, z: fitted.z * scale };
  });
}

// Rebuild the rocks as the world being launched: new shapes, new paint, each rock's own size, and the old ones
// let go of only once every rock has the new ones. main.js calls this on launch, right after applyWorld, so a run
// flies the world the picker highlighted. Where the rocks stand, and the rows they stand in, are not touched here;
// only the shape, the size and the paint each one wears.
export function applyRockLook(world) {
  // A world added to planets.js with no look of its own keeps the alpine rock rather than failing to launch.
  const look = LOOKS[world.name] || LOOKS.ALPINE;
  const palette = look.palette(world.rock);
  const geometries = [];
  for (const shape of look.shapes) {
    // Each shape is built and fitted twice, once as itself and once mirrored left to right, and each copy takes
    // its own profile out of SHAPE_PROFILES. So the six rocks a world carries are six different sizes as well as
    // six different shapes. mirrorX keeps the fitted box symmetric about the origin, so a mirrored rock fills its
    // own box exactly too; the flipped copy is re-projected because the flip reorders its triangles.
    for (let flip = 0; flip < 2; flip++) {
      const profile = SHAPE_PROFILES[geometries.length % SHAPE_PROFILES.length];
      const geometry = finish(shape.build(), palette, shape.smooth, profile);
      geometries.push(flip ? setRockUVs(mirrorX(geometry)) : geometry);
    }
  }
  // The relief and the roughness are read back out of the colour tile the painters just drew, so all three maps
  // repeat over the same metres of rock and none of them can slide against the colour.
  const painted = rockCanvas(look.texture);
  const relief = reliefMaps(painted);
  // No flatShading here: the shapes carry their own normals now, one per face on the crystal and welded smooth
  // on everything else, which is what lets a single material serve both.
  const material = new THREE.MeshStandardMaterial({
    map: rockCanvasTexture(painted, true),
    normalMap: relief.normalMap,
    normalScale: new THREE.Vector2(NORMAL_STRENGTH, NORMAL_STRENGTH),
    roughnessMap: relief.roughnessMap,
    roughness: 1,           // the map is the roughness: pale grain smooth, dark cracks rough
    vertexColors: true
  });
  const steps = geometries.map(fitTurnSteps);
  const oldGeometries = fieldGeometries;
  const oldMaterial = fieldMaterial;
  fieldGeometries = geometries;
  fieldMaterial = material;
  dressRocks(geometries, material, steps);
  for (const geometry of oldGeometries) geometry.dispose();
  // material.dispose() does not free its textures, and there are three of them now.
  for (const map of [oldMaterial.map, oldMaterial.normalMap, oldMaterial.roughnessMap]) {
    if (map) map.dispose();
  }
  oldMaterial.dispose();
}
