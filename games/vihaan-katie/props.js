// The four new prop anomalies' meshes: footprints on the floor, a shoji door, a broken window and one
// lamp that flickers. Self-contained on purpose — it imports three and tuning.js only and builds every
// mesh it needs itself, because coach.js's helpers are private to it.
// NOTE FOR THE MAKERS: every number below is this file's own and belongs in tuning.js with the rest.
// Another agent owns tuning.js at this moment, so these constants live here until it is free.
import * as THREE from 'three';
import { COACH_DIMS, COACH_GEOMETRY, LAMP, PALETTE, WINDOW, WOOD } from './tuning.js';

const { width, length } = COACH_DIMS;
const g = COACH_GEOMETRY;

// One unit cube for every box in this file (the coach does the same); the node scale carries the size.
const BOX = new THREE.BoxGeometry(1, 1, 1);

// Deterministic hash in [0, 1). The only randomness here: the shard angles and the flicker's timing.
const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

function addMesh(parent, geometry, material, name, position, scale, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = false; // every prop here is a flat or thin overlay: shadows would only be noise
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// --- 1. FOOTPRINTS -----------------------------------------------------------------------------------
// A short trail walking down the aisle from the rear toward the middle. The print lies 4 mm above the
// floor top (y = 0) and carries a negative polygonOffset, so it can never fight the floorboards.
// A player walking the aisle looks level, not down, so a print has to be big and dark enough to catch the
// eye on its own. It is the one change in the catalogue that happens below the sightline, and the first
// player to walk these coaches could not find it.
const FOOTPRINT = {
  ink: '#0d0803',
  opacity: 0.9,
  length: 0.34,   // heel to toe
  lift: 0.004,
  toeOut: 0.14,   // radians each print turns away from straight ahead
  count: 7,
  stride: 0.9,
  firstZ: 9.7,    // rear-most print: right where you come in, so the trail starts underfoot
  sideStep: 0.17, // how far each print sits off the centreline, alternating left and right
};
// Half-width of the sole, in metres, at eleven points from heel (0) to toe (1). This outline is what
// makes the print read as a foot rather than as a smudge.
const FOOT_OUTLINE = [
  [0, 0.014], [0.06, 0.036], [0.16, 0.046], [0.3, 0.04], [0.42, 0.034], [0.55, 0.041],
  [0.7, 0.052], [0.82, 0.055], [0.9, 0.048], [0.96, 0.034], [1, 0.016],
];
// A hand-written wobble per print (x offset in metres, yaw offset in radians) so the trail is not a metronome.
const FOOT_WOBBLE = [
  [0.02, -0.06], [-0.03, 0.09], [0.015, -0.03], [-0.025, 0.07], [0.03, -0.09],
];

// The foot shape, built once: a closed outline in the XY plane with the toe toward +y.
const FOOT_GEOMETRY = (() => {
  const shape = new THREE.Shape();
  const [, firstWidth] = FOOT_OUTLINE[0];
  shape.moveTo(-firstWidth, 0);
  for (let i = 1; i < FOOT_OUTLINE.length; i += 1) shape.lineTo(-FOOT_OUTLINE[i][1], FOOT_OUTLINE[i][0] * FOOTPRINT.length);
  for (let i = FOOT_OUTLINE.length - 1; i >= 0; i -= 1) shape.lineTo(FOOT_OUTLINE[i][1], FOOT_OUTLINE[i][0] * FOOTPRINT.length);
  return new THREE.ShapeGeometry(shape);
})();

const footprintInks = new Map();
function footprintInk(color) {
  if (!footprintInks.has(color)) {
    footprintInks.set(color, new THREE.MeshStandardMaterial({
      name: 'footprint-ink', color, roughness: 0.92, metalness: 0,
      transparent: true, opacity: FOOTPRINT.opacity, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      depthWrite: false,
    }));
  }
  return footprintInks.get(color);
}

function buildFootprints(group, entry) {
  const material = footprintInk(entry.color);
  for (let i = 0; i < FOOTPRINT.count; i += 1) {
    const [wobbleX, wobbleYaw] = FOOT_WOBBLE[i % FOOT_WOBBLE.length];
    const side = i % 2 === 0 ? -1 : 1;
    // A flat shape in the XY plane: tipping it face-up puts its toe toward -z (the front door), and
    // the YXZ order then yaws the print about the world's up axis, which is what a footprint's angle is.
    const print = addMesh(group, FOOT_GEOMETRY, material, `${entry.id}-${i}`,
      [side * FOOTPRINT.sideStep + wobbleX, FOOTPRINT.lift, FOOTPRINT.firstZ - i * FOOTPRINT.stride]);
    print.rotation.order = 'YXZ';
    print.rotation.set(-Math.PI / 2, side * FOOTPRINT.toeOut + wobbleYaw, 0);
  }
}

// --- 2. SHOJI DOOR -----------------------------------------------------------------------------------
// A paper-and-lattice sliding door over the front wall's painted door panel. The end wall's node sits at
// z = 0 with the wall's thickness, so its inward face is at wallThickness/2 = 0.05; the painted panel is
// 0.02 further in and 0.04 thick, which puts the panel's face at 0.09. Everything here sits just proud
// of that (0.091 and up), so the shoji covers the panel instead of intersecting it.
const DOOR_PANEL = { offset: 0.02, thickness: 0.04, width: 0.92, height: 1.96 };
const PANEL_FACE_Z = g.wallThickness / 2 + DOOR_PANEL.offset + DOOR_PANEL.thickness / 2;
const SHOJI = {
  width: 0.98, height: 2, centreY: 1.005, // 5 mm of floor showing under the bottom rail, 2.005 at the top
  paperThickness: 0.014, paperZ: PANEL_FACE_Z + 0.008,
  latticeThickness: 0.016,
  frameWidth: 0.06, barWidth: 0.028, columns: 4, rows: 5,
  paper: '#e9e2d2',
};

const SHOJI_PAPER_MAT = new THREE.MeshStandardMaterial({
  name: 'shoji-paper', color: SHOJI.paper, roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
});

const shojiLattice = new Map();
function shojiLatticeMaterial(color) {
  if (!shojiLattice.has(color)) {
    shojiLattice.set(color, new THREE.MeshStandardMaterial({ name: 'shoji-lattice', color, roughness: 0.72, metalness: 0 }));
  }
  return shojiLattice.get(color);
}

function buildShoji(group, entry) {
  const material = shojiLatticeMaterial(entry.color);
  const z = SHOJI.paperZ;
  const top = SHOJI.centreY + SHOJI.height / 2;
  const bottom = SHOJI.centreY - SHOJI.height / 2;
  const { width: w, height: h, frameWidth: f, latticeThickness: t } = SHOJI;
  // Dark wood lattice first, then the paper sits behind it — the paper is the wider, softer surface.
  const barZ = SHOJI.paperZ + SHOJI.paperThickness / 2 + t / 2;
  addMesh(group, BOX, material, `${entry.id}-frame-top`, [0, top - f / 2, barZ], [w, f, t]);
  addMesh(group, BOX, material, `${entry.id}-frame-bottom`, [0, bottom + f / 2, barZ], [w, f, t]);
  addMesh(group, BOX, material, `${entry.id}-frame-left`, [-w / 2 + f / 2, SHOJI.centreY, barZ], [f, h, t]);
  addMesh(group, BOX, material, `${entry.id}-frame-right`, [w / 2 - f / 2, SHOJI.centreY, barZ], [f, h, t]);
  for (let i = 1; i < SHOJI.columns; i += 1) {
    const x = -w / 2 + (w * i) / SHOJI.columns;
    addMesh(group, BOX, material, `${entry.id}-mullion-${i}`, [x, SHOJI.centreY, barZ], [SHOJI.barWidth, h - f * 2, t]);
  }
  for (let i = 1; i < SHOJI.rows; i += 1) {
    const y = bottom + (h * i) / SHOJI.rows;
    addMesh(group, BOX, material, `${entry.id}-rail-${i}`, [0, y, barZ], [w - f * 2, SHOJI.barWidth, t]);
  }
  addMesh(group, BOX, SHOJI_PAPER_MAT, `${entry.id}-paper`, [0, SHOJI.centreY, z], [w, h, SHOJI.paperThickness]);
}

// --- 3. BROKEN WINDOW --------------------------------------------------------------------------------
// The pane has to land in a real opening, so the bay geometry is recomputed with the same arithmetic
// coach.js's buildSideWall uses: the wall node is centred on the coach's midpoint and spans its length,
// the bays are evenly pitched along it, and a post of WINDOW.post eats into each end of that pitch.
const PITCH = (length - WINDOW.post) / WINDOW.bays;         // 2.895: distance from one bay's centre to the next
const OPENING = PITCH - WINDOW.post;                        // 2.475: clear width of a window gap
const FIRST_POST = WINDOW.post / 2;                         // 0.21: the front post's centre, coach-local z
const OPENING_Y = (WINDOW.sill + WINDOW.head) / 2;           // 1.525: a window's vertical centre
const OPENING_H = WINDOW.head - WINDOW.sill;                 // 1.05

const BROKEN = {
  bay: 1,                  // the second bay from the front, z = 4.5525: beside the player, in plain view
  side: 1,                 // the right-hand wall
  inset: 0.03,             // shrink the pane inside the opening so no part of it pokes through a post
  gap: 0.012,              // how far the pane sits inside the wall's inner face
  paneThickness: 0.008,
  crackGap: 0.01,          // the cracks float this far in front of the pane, so the two never overlap
  crackThickness: 0.009,
  crackWidth: 0.016,       // each crack bar's thickness on the pane; thicker than a line, so it reads
  spokes: 14,
  // Loose shards on the bench under the window. The pane is what you see from across the coach; the glass
  // on the seat is what you see when you look down as you pass, and between them the window cannot be
  // walked past unnoticed.
  benchShards: 4,
  impact: [-0.35, 0.12],   // the impact point in the pane's own plane: -x toward the front, +y up
  minShard: 0.18,
  maxShard: 0.95,
  glass: '#d8ecf7',
  glassOpacity: 0.4,
  ink: '#0d0a06',
};

const brokenGlass = new THREE.MeshStandardMaterial({
  name: 'broken-glass', color: BROKEN.glass, roughness: 0.12, metalness: 0,
  transparent: true, opacity: BROKEN.glassOpacity, side: THREE.DoubleSide, depthWrite: false,
});
const brokenInk = new THREE.MeshStandardMaterial({ name: 'crack-ink', color: BROKEN.ink, roughness: 0.85, metalness: 0 });

// The pane's own frame: local +x runs along the coach toward the rear, +y is up, +z points in at the aisle.
function buildBrokenWindow(group, entry) {
  const bayCentre = FIRST_POST + BROKEN.bay * PITCH + PITCH / 2;
  const pane = new THREE.Group();
  pane.name = entry.id;
  pane.position.set(BROKEN.side * (width / 2 - BROKEN.gap), OPENING_Y, bayCentre);
  pane.rotation.y = BROKEN.side > 0 ? -Math.PI / 2 : Math.PI / 2;
  group.add(pane);

  const paneW = OPENING - BROKEN.inset * 2;
  const paneH = OPENING_H - BROKEN.inset * 2;
  addMesh(pane, BOX, brokenGlass, `${entry.id}-pane`, [0, 0, 0], [paneW, paneH, BROKEN.paneThickness]);

  const crackZ = BROKEN.crackGap;
  const [ix, iy] = BROKEN.impact;
  const halfX = paneW / 2 - 0.02; // a shard stops this far short of the pane's edge
  const halfY = paneH / 2 - 0.02;
  for (let i = 0; i < BROKEN.spokes; i += 1) {
    const angle = (i / BROKEN.spokes) * Math.PI * 2 + hash(i * 3.1) * 0.5;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // How far this shard can run before it would leave the pane, clipped per axis.
    const reach = Math.min(
      dx > 1e-6 ? (halfX - ix) / dx : Infinity,
      dx < -1e-6 ? (-halfX - ix) / dx : Infinity,
      dy > 1e-6 ? (halfY - iy) / dy : Infinity,
      dy < -1e-6 ? (-halfY - iy) / dy : Infinity,
    );
    const wanted = BROKEN.minShard + hash(i * 7.7) * (BROKEN.maxShard - BROKEN.minShard);
    const shard = Math.max(0.06, Math.min(wanted, reach));
    addMesh(pane, BOX, brokenInk, `${entry.id}-shard-${i}`,
      [ix + (dx * shard) / 2, iy + (dy * shard) / 2, crackZ],
      [shard, BROKEN.crackWidth, BROKEN.crackThickness], [0, 0, angle]);
  }
  addMesh(pane, new THREE.CircleGeometry(0.07, 12), brokenInk, `${entry.id}-impact`, [ix, iy, crackZ]);

  // Glass that came in with the break, lying on the bench seat below the window. The bench is at
  // g.benchInset and this is a flat scatter across its top face, so it reads from the aisle.
  const benchTop = g.benchHeight + 0.006;
  for (let i = 0; i < BROKEN.benchShards; i += 1) {
    const spread = hash(i * 4.7), spin = hash(i * 6.1);
    addMesh(group, BOX, brokenInk, `${entry.id}-bench-shard-${i}`,
      [BROKEN.side * (g.benchInset + (spread - 0.5) * 0.38), benchTop, bayCentre + (hash(i * 9.1) - 0.5) * 1.1],
      [0.1 + spread * 0.08, 0.008, 0.05 + hash(i * 2.3) * 0.07], [0, spin * Math.PI, 0]);
  }
}

// --- 4. FLICKERING LAMP ------------------------------------------------------------------------------
// One lantern, marked as failing by its node being visible. The paper body's material is shared between
// every lamp of that colour and the mesh cannot be dimmed, so the darkening is a separate shell drawn
// over the paper — and the light is dropped, both the lamp's own (its PointLight is its own object) and
// a small extra one of ours that sputters on a second, faster rhythm. Nothing here is a clean sine.
const FLICKER = {
  x: -1.1, z: 1.4,             // lamp-fl, on the left at the front of the coach
  shellGrow: 1.06,             // the shell's width as a share over the paper body's, so it never z-fights
  shellSquash: 0.995,          // its height share: at the very tips it hides inside the wooden base and cap
  shellLift: 0.003,            // a few millimetres up, so its bottom tip stays above the floor at y = 0
  shadeMax: 0.92,              // how opaque the shell gets at the bottom of a dip
  shadeRest: 0.62,             // what it is built at, so the lamp reads as a failing one before it ticks
  floorShare: 0.06,            // the lamp's own light never goes completely out
  glowShare: 0.7,              // our spare light at full on, over the lamp's own intensity
  glowRest: 0,                 // and it is built dark, so an untick-ed frame is not a brighter lamp
  ease: 18,                    // how fast a level snaps to its new value: fast, but never a one-frame flash
  minHold: 0.045,
  holdSpread: 0.155,
  dipChance: 0.45,             // how often a new level is a deep dip rather than a bright patch
};

const FLICKER_SHADE = 'prop-flicker-shade';
const FLICKER_GLOW = 'prop-flicker-glow';
const FLICKER_SHADE_MAT = new THREE.MeshBasicMaterial({
  name: 'flicker-shade', color: '#160d06', transparent: true, opacity: FLICKER.shadeRest, depthWrite: false,
});

function buildFlickerLamp(group, entry) {
  const [x, y, z] = entry.position;
  const radius = g.lampSize / 2;
  // A sphere grown over the paper body: it covers the glow and nothing else, so the wooden base and cap
  // stay visible and the lantern reads as dark rather than as missing. Wider than the paper, a shade
  // shorter, and a few millimetres up: it only has to hide the glowing part.
  addMesh(group, new THREE.SphereGeometry(radius, 24, 16), FLICKER_SHADE_MAT, FLICKER_SHADE,
    [x, y + FLICKER.shellLift, z],
    [FLICKER.shellGrow, (g.lampHeight / g.lampSize) * FLICKER.shellSquash, FLICKER.shellGrow]);
  const glow = new THREE.PointLight(new THREE.Color(PALETTE.lamp), LAMP.lightIntensity * FLICKER.glowRest, LAMP.lightDistance, LAMP.lightDecay);
  glow.name = FLICKER_GLOW;
  glow.castShadow = false;
  glow.position.set(x, y + radius * 0.5, z); // exactly where coach.js puts a lamp's own light
  group.add(glow);
}

// --- THE NODES ---------------------------------------------------------------------------------------
// Every prop is invisible in the baseline; an anomaly turns its node on. The shapes above are built from
// the node's own position and colour, so a `color` or `position` operation would still mean something.
const propNode = (id, kind, position, color) => ({
  id, kind, position, rotation: [0, 0, 0], scale: [1, 1, 1], visible: false, color, asset: null,
});

export const PROP_NODES = [
  propNode('prop-footprints', 'footprint', [0, 0, 0], FOOTPRINT.ink),
  propNode('prop-shoji', 'shoji', [0, 0, 0], WOOD.trim),
  propNode('prop-broken-window', 'broken-window', [0, 0, 0], BROKEN.ink),
  propNode('prop-flicker-lamp', 'flicker-lamp', [FLICKER.x, g.lampHeight / 2, FLICKER.z], PALETTE.lamp),
];

// The node kinds coach.js has to hand to buildPropNode, derived from the list above so a prop added here
// is routed without a second edit over there.
export const PROP_KINDS = new Set(PROP_NODES.map((entry) => entry.kind));

export function buildPropNode(group, entry) {
  if (entry.kind === 'footprint') buildFootprints(group, entry);
  else if (entry.kind === 'shoji') buildShoji(group, entry);
  else if (entry.kind === 'broken-window') buildBrokenWindow(group, entry);
  else if (entry.kind === 'flicker-lamp') buildFlickerLamp(group, entry);
}

// --- THE TICK ----------------------------------------------------------------------------------------
// One stutter channel: a level that jumps every 45-200 ms and eases onto the new value fast enough to
// read as a failing bulb and slow enough that a 200 fps frame never shows a one-frame black flash.
function stutter(channel, dt) {
  channel.held += dt;
  if (channel.held >= channel.next) {
    channel.held = 0;
    channel.step += 1;
    const roll = hash(channel.seed + channel.step * 1.37);
    channel.next = FLICKER.minHold + hash(channel.seed + channel.step * 2.11) * FLICKER.holdSpread;
    channel.target = roll < FLICKER.dipChance
      ? 0.04 + hash(channel.seed + channel.step * 5.31) * 0.14
      : 0.58 + hash(channel.seed + channel.step * 3.77) * 0.42;
  }
  channel.level += (channel.target - channel.level) * Math.min(1, Math.max(0, dt) * FLICKER.ease);
  return channel.level;
}

// Everything the tick needs, resolved once per built coach and then only read: a group, one object and
// one number. No allocation happens on a frame.
const tick = {
  group: null, shade: null, glow: null, lampLight: null,
  bulb: { seed: 0, step: 0, held: 0, next: 0, level: 1, target: 1 },
  sputter: { seed: 17.3, step: 0, held: 0, next: 0, level: 0.4, target: 0.4 },
};

function resolveTick(group) {
  tick.group = group;
  tick.shade = group.getObjectByName(FLICKER_SHADE) ?? null;
  tick.glow = group.getObjectByName(FLICKER_GLOW) ?? null;
  tick.lampLight = null;
  if (!tick.shade) return;
  // The lamp's own PointLight is per-lamp, so the right one is the one standing where our shell is.
  const { x, y, z } = tick.shade.position;
  let best = Infinity;
  group.traverse((child) => {
    if (!child.isPointLight || child === tick.glow) return;
    const dx = child.position.x - x;
    const dy = child.position.y - y;
    const dz = child.position.z - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) { best = d; tick.lampLight = child; }
  });
}

// Called once a frame from main.js. Safe with no coach, no anomaly, or a coach built without one.
export function propTick(dt, group) {
  if (!group) return;
  if (tick.group !== group) resolveTick(group);
  const { shade, glow, lampLight } = tick;
  if (!shade) return;
  const bulb = stutter(tick.bulb, dt);
  const sputter = stutter(tick.sputter, dt);
  shade.material.opacity = FLICKER.shadeMax * (1 - bulb);
  if (lampLight) lampLight.intensity = LAMP.lightIntensity * (FLICKER.floorShare + (1 - FLICKER.floorShare) * bulb);
  if (glow) glow.intensity = LAMP.lightIntensity * FLICKER.glowShare * sputter;
}
