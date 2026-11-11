// The deck the head rolls along: built from a course's centre line (levels.js), and the
// one place that answers "where is the deck here, how wide, how steep, is there a rail?".
// The mesh and the collision come from the same samples, so what you see is what you hit.
import * as THREE from 'three';
import * as tuning from './tuning.js';

// ---- SHAPE ----
const SPACING = 0.3;       // centre-line sample spacing, in world units
export const THICKNESS = 0.6;
const TILE = 1.3;          // world units per deck tile
const CURB_WIDTH = 0.26;   // the red-and-white warning stripe along open edges
export const RAIL_RADIUS = 0.12;
export const RAIL_HEIGHT = 0.3;
const POST_SPACING = 1.4;
const LEG_SPACING = 4.5;
const LEG_RADIUS = 0.14;

// ---- PALETTE: a calm deck, loud edges ----
const DECK_A = '#fdf3dc';
const DECK_B = '#eadcf7';
const GROUT = '#c9b5e2';
const CURB_RED = '#ff2a6d';
const CURB_WHITE = '#fff8ee';
const SIDE_TRIM = '#ffcb2e';
const RAIL_COLOR = '#19d3e6';
const POST_COLOR = '#ffcb2e';
const LEG_COLOR = '#05d9e8';

// ---- COURSE: centre-line samples ----
let C = null;

// Sample a course's centre line into a smooth spline. Sets it as the current course.
export function buildCourse(level) {
  const pts = level.points;
  const n = pts.length;
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p[0], p[2], p[1])), false, 'centripetal'
  );
  const xs = [], ys = [], zs = [], ws = [], rl = [], rr = [], gp = [], seg = [], segF = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const steps = Math.max(4, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / SPACING));
    const last = i === n - 2;
    for (let k = 0; k <= (last ? steps : steps - 1); k++) {
      const f = k / steps;
      curve.getPoint((i + f) / (n - 1), v);
      xs.push(v.x); ys.push(v.y); zs.push(v.z);
      const e = f * f * (3 - 2 * f);
      ws.push(a[3] + (b[3] - a[3]) * e);
      rl.push(a[4].includes('L'));
      rr.push(a[4].includes('R'));
      gp.push(a[4].includes('G'));
      seg.push(i);
      segF.push(f);
    }
  }

  const N = xs.length;
  gp[N - 1] = false;
  const s = new Float32Array(N);
  const tx = new Float32Array(N);
  const tz = new Float32Array(N);
  const slope = new Float32Array(N);
  for (let k = 1; k < N; k++) s[k] = s[k - 1] + Math.hypot(xs[k] - xs[k - 1], zs[k] - zs[k - 1]);

  // Broken track: a 'G' segment has no deck. The deck curls up into a kicker just before it,
  // and the air over the gap is a straight line from lip to landing.
  const gaps = [];
  const kick = new Float32Array(N); // 0..1 up the kicker, for the hazard stripes
  for (let k = 0; k < N - 1; k++) {
    if (!gp[k] || (k > 0 && gp[k - 1])) continue;
    let k1 = k;
    while (gp[k1]) k1++;
    for (let j = k - 1; j >= 0 && s[k] - s[j] < tuning.jump.kickLength; j--) {
      const t = 1 - (s[k] - s[j]) / tuning.jump.kickLength;
      ys[j] += tuning.jump.kickHeight * t * t;
      kick[j] = t;
    }
    kick[k] = 1;
    ys[k] += tuning.jump.kickHeight;
    for (let j = k + 1; j < k1; j++) ys[j] = ys[k] + (ys[k1] - ys[k]) * (s[j] - s[k]) / (s[k1] - s[k]);
    gaps.push({ k0: k, k1, s0: s[k], s1: s[k1], lip: 2 * tuning.jump.kickHeight / tuning.jump.kickLength });
  }
  for (let k = 0; k < N; k++) {
    const a = Math.max(0, k - 1);
    const b = Math.min(N - 1, k + 1);
    const dx = xs[b] - xs[a];
    const dz = zs[b] - zs[a];
    const h = Math.hypot(dx, dz) || 1;
    tx[k] = dx / h;
    tz[k] = dz / h;
    slope[k] = (ys[b] - ys[a]) / h;
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
  for (let k = 0; k < N; k++) {
    minX = Math.min(minX, xs[k] - ws[k]); maxX = Math.max(maxX, xs[k] + ws[k]);
    minZ = Math.min(minZ, zs[k] - ws[k]); maxZ = Math.max(maxZ, zs[k] + ws[k]);
    minY = Math.min(minY, ys[k]);
  }

  C = {
    level, N, xs, ys, zs, ws, rl, rr, gp, gaps, kick, seg, segF, s, tx, tz, slope,
    length: s[N - 1],
    start: { x: xs[0], y: ys[0], z: zs[0] },
    end: { x: xs[N - 1], y: ys[N - 1], z: zs[N - 1] },
    bounds: { minX, maxX, minZ, maxZ, minY, floorY: minY - 4.2 },
  };
  return C;
}

export function getCourse() {
  return C;
}

// Distance along the course of a level-data position: [segment, fraction].
export function distanceAt(at) {
  const [i, f] = at;
  for (let k = 0; k < C.N - 1; k++) {
    if (C.seg[k] !== i) continue;
    const f0 = C.segF[k];
    const f1 = C.seg[k + 1] === i ? C.segF[k + 1] : 1;
    if (f <= f1 + 1e-6) {
      const t = f1 > f0 ? (f - f0) / (f1 - f0) : 0;
      return C.s[k] + (C.s[k + 1] - C.s[k]) * Math.min(1, Math.max(0, t));
    }
  }
  return C.length;
}

// The deck at a distance along the course: centre, height, width, direction, rails.
export function frameAt(dist) {
  const s = C.s;
  let lo = 0, hi = C.N - 1;
  dist = Math.min(C.length, Math.max(0, dist));
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] <= dist) lo = mid; else hi = mid;
  }
  const span = s[hi] - s[lo];
  const t = span > 0 ? (dist - s[lo]) / span : 0;
  const lerp = (arr) => arr[lo] + (arr[hi] - arr[lo]) * t;
  const tx = lerp(C.tx), tz = lerp(C.tz);
  const h = Math.hypot(tx, tz) || 1;
  return {
    x: lerp(C.xs), y: lerp(C.ys), z: lerp(C.zs), w: lerp(C.ws),
    tx: tx / h, tz: tz / h, rx: -tz / h, rz: tx / h,
    railL: C.rl[lo], railR: C.rr[lo], gap: C.gp[lo], s: dist,
  };
}

// ---- COLLISION QUERIES ----
// The nearest point on the centre line to (x, z), with everything the physics needs.
// lat is the signed sideways offset: positive is to the right of the direction of travel.
export function nearest(x, z) {
  const { xs, zs, N } = C;
  let best = Infinity, bk = 0, bf = 0, braw = 0;
  for (let k = 0; k < N - 1; k++) {
    const ax = xs[k], az = zs[k];
    const dx = xs[k + 1] - ax, dz = zs[k + 1] - az;
    const lenSq = dx * dx + dz * dz;
    const raw = lenSq > 0 ? ((x - ax) * dx + (z - az) * dz) / lenSq : 0;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const px = ax + dx * f - x, pz = az + dz * f - z;
    const d2 = px * px + pz * pz;
    if (d2 < best) { best = d2; bk = k; bf = f; braw = raw; }
  }
  const k = bk, f = bf;
  const dx = xs[k + 1] - xs[k], dz = zs[k + 1] - zs[k];
  const len = Math.hypot(dx, dz) || 1;
  const tx = dx / len, tz = dz / len;
  const rx = -tz, rz = tx;
  const cx = xs[k] + dx * f, cz = zs[k] + dz * f;
  return {
    k, f,
    x: cx, z: cz,
    y: C.ys[k] + (C.ys[k + 1] - C.ys[k]) * f,
    w: C.ws[k] + (C.ws[k + 1] - C.ws[k]) * f,
    s: C.s[k] + (C.s[k + 1] - C.s[k]) * f,
    slope: C.slope[k] + (C.slope[k + 1] - C.slope[k]) * f,
    tx, tz, rx, rz,
    lat: (x - cx) * rx + (z - cz) * rz,
    railL: C.rl[k], railR: C.rr[k], gap: C.gp[k],
    behind: k === 0 && braw < 0 ? -braw * len : 0,
    beyond: k === N - 2 && braw > 1 ? (braw - 1) * len : 0,
  };
}

export function getPathHeight(x, z) {
  return nearest(x, z).y;
}

// ---- MESH ----
const textureCache = {};
function cachedTexture(key, make) {
  if (!textureCache[key]) textureCache[key] = make();
  return textureCache[key];
}

// Build the deck, its curbs, rails, side walls and support legs for the current course.
export function createPathMesh(anisotropy = 1) {
  const group = new THREE.Group();
  const floorY = C.bounds.floorY;

  const deckTex = cachedTexture('deck', deckTexture);
  deckTex.anisotropy = anisotropy;
  const curbTex = cachedTexture('curb', curbTexture);
  curbTex.anisotropy = anisotropy;
  const sideTex = cachedTexture('side', sideTexture);

  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.55, metalness: 0.0 });
  const curbMat = new THREE.MeshStandardMaterial({
    map: curbTex, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.7 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: '#3a1a5c', roughness: 0.9 });

  const all = (k) => !C.gp[k];
  const w = (k) => C.ws[k];

  // Top surface: square tiles, laid in world units so they never stretch.
  const deck = new THREE.Mesh(ribbon(
    (k) => -w(k), (k) => w(k), () => 0, () => 0,
    (k) => [-w(k) / TILE, C.s[k] / TILE], (k) => [w(k) / TILE, C.s[k] / TILE], all
  ), deckMat);
  deck.receiveShadow = true;
  group.add(deck);

  // Curbs on the open (railless) edges: the hard line Marble Madness taught everyone to fear.
  const curbV = (k) => C.s[k] / 0.8;
  const leftCurb = new THREE.Mesh(ribbon(
    (k) => -w(k), (k) => -w(k) + CURB_WIDTH, () => 0.004, () => 0.004,
    (k) => [0, curbV(k)], (k) => [1, curbV(k)], (k) => !C.rl[k] && !C.gp[k]
  ), curbMat);
  const rightCurb = new THREE.Mesh(ribbon(
    (k) => w(k) - CURB_WIDTH, (k) => w(k), () => 0.004, () => 0.004,
    (k) => [0, curbV(k)], (k) => [1, curbV(k)], (k) => !C.rr[k] && !C.gp[k]
  ), curbMat);
  leftCurb.receiveShadow = rightCurb.receiveShadow = true;
  group.add(leftCurb, rightCurb);

  // Side walls and the underside.
  const sideU = (k) => C.s[k] / 3;
  const rightWall = new THREE.Mesh(ribbon(
    (k) => w(k), (k) => w(k), () => 0, () => -THICKNESS,
    (k) => [sideU(k), 1], (k) => [sideU(k), 0], all
  ), sideMat);
  const leftWall = new THREE.Mesh(ribbon(
    (k) => -w(k), (k) => -w(k), () => -THICKNESS, () => 0,
    (k) => [sideU(k), 0], (k) => [sideU(k), 1], all
  ), sideMat);
  const bottom = new THREE.Mesh(ribbon(
    (k) => w(k), (k) => -w(k), () => -THICKNESS, () => -THICKNESS,
    () => [0, 0], () => [1, 0], all
  ), bottomMat);
  for (const m of [rightWall, leftWall, bottom]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  group.add(endCap(0, -1, sideMat), endCap(C.N - 1, 1, sideMat));
  for (const g of C.gaps) {
    group.add(endCap(g.k0, 1, sideMat), endCap(g.k1, -1, sideMat));
    group.add(createJumpDressing(g, floorY, deckMat, sideMat));
  }
  if (C.gaps.length) {
    // Hazard stripes up every kicker, so the jump reads from a long way back.
    const hazardTex = cachedTexture('hazard', hazardTexture);
    const stripes = new THREE.Mesh(ribbon(
      (k) => -w(k), (k) => w(k), () => 0.006, () => 0.006,
      (k) => [-w(k) / 0.9, C.s[k] / 0.9], (k) => [w(k) / 0.9, C.s[k] / 0.9], (k) => C.kick[k] > 0 && !C.gp[k]
    ), new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    stripes.receiveShadow = true;
    group.add(stripes);
  }

  group.add(createRails());
  group.add(createLegs(floorY));
  group.add(createStartLine());

  return group;
}

// A strip running the length of the course. latA/latB give the two edges (sideways offsets),
// yA/yB their heights above the centre line, uvA/uvB their texture coordinates, and
// include(k) whether the quad from sample k to k+1 is drawn. Faces point along (B - A) x travel.
function ribbon(latA, latB, yA, yB, uvA, uvB, include) {
  const { N, xs, ys, zs, tx, tz } = C;
  const pos = new Float32Array(N * 6);
  const uv = new Float32Array(N * 4);
  for (let k = 0; k < N; k++) {
    const rx = -tz[k], rz = tx[k];
    const la = latA(k), lb = latB(k);
    pos.set([xs[k] + rx * la, ys[k] + yA(k), zs[k] + rz * la, xs[k] + rx * lb, ys[k] + yB(k), zs[k] + rz * lb], k * 6);
    uv.set([...uvA(k), ...uvB(k)], k * 4);
  }
  const index = [];
  for (let k = 0; k < N - 1; k++) {
    if (!include(k)) continue;
    const a0 = k * 2, b0 = k * 2 + 1, a1 = k * 2 + 2, b1 = k * 2 + 3;
    index.push(a0, b0, a1, b0, b1, a1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// The flat end of the slab at the start (dir -1) or the box end (dir 1).
function endCap(k, dir, material) {
  const w = C.ws[k];
  const geo = new THREE.PlaneGeometry(w * 2, THICKNESS);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(C.xs[k], C.ys[k] - THICKNESS / 2, C.zs[k]);
  mesh.lookAt(C.xs[k] + C.tx[k] * dir, C.ys[k] - THICKNESS / 2, C.zs[k] + C.tz[k] * dir);
  return mesh;
}

// Bumper rails: a rounded tube on little yellow posts, wherever the course says so.
function createRails() {
  const group = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({ color: RAIL_COLOR, roughness: 0.3, metalness: 0.15 });
  const postMat = new THREE.MeshStandardMaterial({ color: POST_COLOR, roughness: 0.45 });
  const postGeo = new THREE.CylinderGeometry(0.07, 0.09, RAIL_HEIGHT, 8);
  postGeo.translate(0, RAIL_HEIGHT / 2, 0);
  const capGeo = new THREE.SphereGeometry(RAIL_RADIUS * 1.5, 12, 8);
  const posts = [];
  const caps = [];

  for (const side of [-1, 1]) {
    const flags = side < 0 ? C.rl : C.rr;
    let k = 0;
    while (k < C.N - 1) {
      if (!flags[k]) { k++; continue; }
      const startK = k;
      while (k < C.N - 1 && flags[k]) k++;
      const endK = k; // the run covers samples startK..endK
      if (endK - startK < 2) continue;
      const pts = [];
      for (let j = startK; j <= endK; j++) {
        const p = edgePoint(j, side, RAIL_HEIGHT);
        pts.push(new THREE.Vector3(p.x, p.y, p.z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, RAIL_RADIUS, 8, false), railMat);
      tube.castShadow = true;
      group.add(tube);
      caps.push(pts[0], pts[pts.length - 1]);
      for (let d = C.s[startK] + 0.2; d < C.s[endK]; d += POST_SPACING) {
        const f = frameAt(d);
        posts.push(new THREE.Vector3(f.x + f.rx * f.w * side, f.y, f.z + f.rz * f.w * side));
      }
    }
  }

  const m = new THREE.Matrix4();
  if (posts.length) {
    const inst = new THREE.InstancedMesh(postGeo, postMat, posts.length);
    posts.forEach((p, i) => inst.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    inst.castShadow = true;
    group.add(inst);
  }
  if (caps.length) {
    const inst = new THREE.InstancedMesh(capGeo, postMat, caps.length);
    caps.forEach((p, i) => inst.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    group.add(inst);
  }
  return group;
}

function edgePoint(k, side, y) {
  const rx = -C.tz[k], rz = C.tx[k];
  const w = C.ws[k];
  return { x: C.xs[k] + rx * w * side, y: C.ys[k] + y, z: C.zs[k] + rz * w * side };
}

// Support legs down to the stage floor, in pairs, like a toy race track's stands.
function createLegs(floorY) {
  const spots = [];
  for (let d = 1.5; d < C.length - 0.5; d += LEG_SPACING) {
    const f = frameAt(d);
    if (C.gaps.some((g) => d > g.s0 - 0.6 && d < g.s1 + 0.6)) continue;
    for (const side of [-1, 1]) {
      const lat = f.w * 0.55 * side;
      spots.push({ x: f.x + f.rx * lat, z: f.z + f.rz * lat, top: f.y - THICKNESS + 0.05 });
    }
  }
  const geo = new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS * 1.3, 1, 10);
  geo.translate(0, 0.5, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: LEG_COLOR, roughness: 0.5 }), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach((p, i) => {
    m.makeScale(1, Math.max(0.1, p.top - floorY), 1);
    m.setPosition(p.x, floorY, p.z);
    inst.setMatrixAt(i, m);
  });
  inst.receiveShadow = true;
  return inst;
}

// The broken bit: jagged teeth on both torn edges, and the missing chunks of track lying
// smashed on the floor below, so it's obvious the deck is gone and why.
function createJumpDressing(g, floorY, deckMat, sideMat) {
  const group = new THREE.Group();
  const toothGeo = new THREE.ConeGeometry(0.16, 0.42, 4);
  const teeth = [];
  for (const [k, dir] of [[g.k0, 1], [g.k1, -1]]) {
    const w = C.ws[k];
    const rx = -C.tz[k], rz = C.tx[k];
    for (let lat = -w + 0.2; lat <= w - 0.15; lat += 0.38) {
      const len = 0.18 + ((Math.sin(lat * 12.9 + k) + 1) * 0.5) * 0.24;
      teeth.push({
        x: C.xs[k] + rx * lat + C.tx[k] * dir * len * 0.5,
        y: C.ys[k] - THICKNESS * 0.5,
        z: C.zs[k] + rz * lat + C.tz[k] * dir * len * 0.5,
        yaw: Math.atan2(C.tx[k] * dir, C.tz[k] * dir), len,
      });
    }
  }
  const inst = new THREE.InstancedMesh(toothGeo, sideMat, teeth.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
  teeth.forEach((t, i) => {
    e.set(Math.PI / 2, t.yaw, 0, 'YXZ');
    q.setFromEuler(e);
    sc.set(1, t.len / 0.42, THICKNESS / 0.32);
    m.compose(new THREE.Vector3(t.x, t.y, t.z), q, sc);
    inst.setMatrixAt(i, m);
  });
  inst.castShadow = true;
  group.add(inst);

  // Chunks of the missing deck, tumbled on the floor.
  const mid = frameAt((g.s0 + g.s1) / 2);
  const chunkGeo = new THREE.BoxGeometry(1, THICKNESS, 1);
  const mats = [sideMat, sideMat, deckMat, sideMat, sideMat, sideMat];
  const pieces = [[-0.7, 0.4, 1.5, 1.2, 0.5], [0.9, -0.5, 1.2, 1.0, -0.8], [0.1, 1.3, 0.9, 0.7, 2.1]];
  for (const [a, b, sx, sz, yaw] of pieces) {
    const chunk = new THREE.Mesh(chunkGeo, mats);
    chunk.scale.set(sx * mid.w * 0.6, 1, sz);
    chunk.position.set(mid.x + mid.rx * a * mid.w * 0.6 + mid.tx * b, floorY + THICKNESS * 0.5 + 0.05, mid.z + mid.rz * a * mid.w * 0.6 + mid.tz * b);
    chunk.rotation.set(a * 0.25, yaw, b * 0.2);
    chunk.castShadow = chunk.receiveShadow = true;
    group.add(chunk);
  }
  return group;
}

// A chequered start line across the deck.
function createStartLine() {
  const f = frameAt(1.4);
  const tex = cachedTexture('start', startTexture);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(Math.round(f.w * 2 / 0.5), 1);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(f.w * 2, 0.5),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(-Math.PI / 2, Math.atan2(f.tx, f.tz), 0);
  mesh.position.set(f.x, f.y + 0.006, f.z);
  mesh.receiveShadow = true;
  return mesh;
}

// ---- TEXTURES: all drawn on canvases at load time ----
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Two soft tones in a checker, with grout and a faint bevel so each tile reads as a tile.
function deckTexture() {
  const [c, ctx] = canvas(256, 256);
  const h = 128;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? DECK_B : DECK_A;
      ctx.fillRect(i * h, j * h, h, h);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(i * h + 6, j * h + 6, h - 12, 5);
      ctx.fillStyle = 'rgba(80,40,120,0.07)';
      ctx.fillRect(i * h + 6, j * h + h - 11, h - 12, 5);
    }
  }
  ctx.fillStyle = GROUT;
  for (const at of [0, h]) {
    ctx.fillRect(at - 2, 0, 4, 256);
    ctx.fillRect(0, at - 2, 256, 4);
  }
  return finish(c);
}

function curbTexture() {
  const [c, ctx] = canvas(32, 128);
  ctx.fillStyle = CURB_WHITE;
  ctx.fillRect(0, 0, 32, 128);
  ctx.fillStyle = CURB_RED;
  ctx.fillRect(0, 0, 32, 64);
  return finish(c);
}

function sideTexture() {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#8a49c4');
  g.addColorStop(1, '#3d1766');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = SIDE_TRIM;
  ctx.fillRect(0, 0, 64, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = 4; x < 64; x += 16) {
    ctx.beginPath();
    ctx.arc(x + 4, 38, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c);
}

function hazardTexture() {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#ffcb2e';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#2a1640';
  for (let i = -64; i < 64; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 64); ctx.lineTo(i + 16, 64); ctx.lineTo(i + 80, 0); ctx.lineTo(i + 64, 0);
    ctx.closePath();
    ctx.fill();
  }
  return finish(c);
}

function startTexture() {
  const [c, ctx] = canvas(32, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#1e1030';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillRect(16, 16, 16, 16);
  return finish(c);
}
