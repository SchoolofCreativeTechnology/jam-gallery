// The loud void around the deck: toy clutter scattered over the stage floor (ABC blocks,
// striped balls, stacking rings, spinning tops) and balloons drifting beside the deck.
// Everything keeps clear of the deck, so nothing ever hides the head.
import * as THREE from 'three';
import { nearest, getCourse } from './path.js';

const PALETTE = ['#ff2a6d', '#f7e600', '#05d9e8', '#9d4edd', '#ff8500', '#7ee787'];
const CLUTTER = 44;
const BALLOONS = 12;
const LETTERS = 'ABCDEFGHJKMPRSTWXYZ';

let root = null;
const spinners = [];
const balloons = [];
const mats = new Map();
const letterTextures = [];

const geo = {
  block: new THREE.BoxGeometry(1, 1, 1),
  ball: new THREE.SphereGeometry(0.5, 24, 16),
  ring: new THREE.TorusGeometry(0.42, 0.16, 12, 24),
  peg: new THREE.CylinderGeometry(0.1, 0.1, 1, 8),
  base: new THREE.CylinderGeometry(0.5, 0.55, 0.18, 20),
  top: new THREE.ConeGeometry(0.5, 0.7, 20),
  topCap: new THREE.CylinderGeometry(0.5, 0.5, 0.12, 20),
  balloon: new THREE.SphereGeometry(0.5, 20, 14),
  knot: new THREE.ConeGeometry(0.07, 0.12, 8),
};
geo.balloon.scale(1, 1.18, 1);

let stripeTex = null;

export function loadWorld(scene) {
  if (root) scene.remove(root);
  root = new THREE.Group();
  scene.add(root);
  spinners.length = 0;
  balloons.length = 0;

  const course = getCourse();
  const { minX, maxX, minZ, maxZ, floorY } = course.bounds;
  const rand = mulberry(Math.round(course.length * 1000));

  // ---- Floor clutter ----
  let placed = 0;
  for (let tries = 0; placed < CLUTTER && tries < CLUTTER * 12; tries++) {
    const x = minX - 14 + rand() * (maxX - minX + 28);
    const z = minZ - 6 + rand() * (maxZ - minZ + 14);
    const n = nearest(x, z);
    if (Math.abs(n.lat) < n.w + 2.4 && n.behind === 0 && n.beyond === 0) continue; // never under or beside the deck
    const kind = pick(rand, ['block', 'block', 'block', 'ball', 'ball', 'rings', 'top']);
    const item = makeClutter(kind, rand);
    item.position.set(x, floorY, z);
    item.rotation.y = rand() * Math.PI * 2;
    root.add(item);
    placed++;
  }

  // ---- Balloons, floating at deck height out past the edges ----
  for (let i = 0; i < BALLOONS; i++) {
    const k = Math.min(course.N - 1, Math.round(((i + 0.5) / BALLOONS) * (course.N - 1)));
    const rx = -course.tz[k], rz = course.tx[k];
    const side = i % 2 ? 1 : -1;
    const off = course.ws[k] + 4.5 + rand() * 4;
    const x = course.xs[k] + rx * off * side;
    const z = course.zs[k] + rz * off * side;
    const check = nearest(x, z);
    if (Math.abs(check.lat) < check.w + 3.5) continue;
    const balloon = makeBalloon(PALETTE[i % PALETTE.length], floorY, course.ys[k] + 0.3 + rand() * 1.8);
    balloon.group.position.set(x, 0, z);
    root.add(balloon.group);
    balloons.push({ ...balloon, phase: rand() * 6, speed: 0.6 + rand() * 0.6 });
  }
}

export function updateWorld(dt, time) {
  for (const s of spinners) s.rotation.y += s.userData.spin * dt;
  for (const b of balloons) {
    b.group.position.y = Math.sin(time * b.speed + b.phase) * 0.25;
    b.body.rotation.z = Math.sin(time * b.speed * 0.8 + b.phase) * 0.12;
  }
}

function makeClutter(kind, rand) {
  const g = new THREE.Group();
  const color = pick(rand, PALETTE);
  if (kind === 'block') {
    // An ABC block: a letter on every side, a coloured frame.
    const size = 0.8 + rand() * 0.8;
    const tex = letterTexture(Math.floor(rand() * LETTERS.length));
    const m = new THREE.Mesh(geo.block, letterMat(tex, color));
    m.scale.setScalar(size);
    m.position.y = size / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    // Sometimes a second block stacked on top.
    if (rand() < 0.35) {
      const s2 = size * 0.75;
      const tex2 = letterTexture(Math.floor(rand() * LETTERS.length));
      const c2 = pick(rand, PALETTE);
      const m2 = new THREE.Mesh(geo.block, letterMat(tex2, c2));
      m2.scale.setScalar(s2);
      m2.position.y = size + s2 / 2;
      m2.rotation.y = rand();
      m2.castShadow = true;
      g.add(m2);
    }
  } else if (kind === 'ball') {
    const size = 0.7 + rand() * 1.0;
    const m = new THREE.Mesh(geo.ball, stripeMat(color));
    m.scale.setScalar(size);
    m.position.y = size / 2;
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    m.castShadow = true;
    g.add(m);
  } else if (kind === 'rings') {
    // A stacking-ring tower.
    const base = new THREE.Mesh(geo.base, mat('#c4783a'));
    base.position.y = 0.09;
    g.add(base);
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const ring = new THREE.Mesh(geo.ring, mat(PALETTE[(i + Math.floor(rand() * 6)) % PALETTE.length]));
      const s = 1.15 - i * 0.16;
      ring.scale.set(s, s, 1.2);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3 + i * 0.32;
      ring.castShadow = true;
      g.add(ring);
    }
    const peg = new THREE.Mesh(geo.peg, mat('#c4783a'));
    peg.scale.y = 0.3 + count * 0.32 + 0.2;
    peg.position.y = peg.scale.y / 2;
    g.add(peg);
    g.scale.setScalar(1.2 + rand() * 0.6);
  } else {
    // A spinning top, actually spinning.
    const body = new THREE.Group();
    const cone = new THREE.Mesh(geo.top, stripeMat(color));
    cone.rotation.x = Math.PI;
    cone.position.y = 0.35;
    const cap = new THREE.Mesh(geo.topCap, mat(pick(rand, PALETTE)));
    cap.position.y = 0.76;
    const handle = new THREE.Mesh(geo.peg, mat('#ffffff'));
    handle.scale.set(0.7, 0.35, 0.7);
    handle.position.y = 0.98;
    cone.castShadow = cap.castShadow = true;
    body.add(cone, cap, handle);
    body.rotation.z = (rand() - 0.5) * 0.25;
    const spin = new THREE.Group();
    spin.add(body);
    spin.userData.spin = 6 + rand() * 6;
    spinners.push(spin);
    g.add(spin);
    g.scale.setScalar(1.3 + rand() * 0.8);
  }
  return g;
}

function makeBalloon(color, floorY, height) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = height;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.05, emissive: color, emissiveIntensity: 0.12 });
  const balloon = new THREE.Mesh(geo.balloon, m);
  balloon.scale.setScalar(0.85);
  balloon.castShadow = true;
  const knot = new THREE.Mesh(geo.knot, m);
  knot.position.y = -0.55;
  body.add(balloon, knot);
  // The string runs down to a little weight on the floor.
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector3(Math.sin(t * 9) * 0.08, height - 0.6 - t * (height - 0.6 - floorY), 0));
  }
  const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#fff4dc', transparent: true, opacity: 0.6 }));
  group.add(body, string);
  return { group, body };
}

function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 }));
  return mats.get(color);
}

const letterMats = new Map();
function letterMat(tex, color) {
  const key = tex.uuid + color;
  if (!letterMats.has(key)) letterMats.set(key, new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', roughness: 0.6 }));
  return letterMats.get(key);
}

function letterTexture(i) {
  if (letterTextures[i]) return letterTextures[i];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const bg = PALETTE[i % PALETTE.length];
  const fg = PALETTE[(i + 3) % PALETTE.length];
  ctx.fillStyle = '#fff6e6';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = bg;
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 112, 112);
  ctx.fillStyle = fg;
  ctx.font = 'bold 84px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(LETTERS[i], 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  letterTextures[i] = t;
  return t;
}

const stripeMats = new Map();
function stripeMat(color) {
  if (!stripeTex) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#d8d8d8';
    for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 8);
    stripeTex = new THREE.CanvasTexture(c);
    stripeTex.colorSpace = THREE.SRGBColorSpace;
    stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
    stripeTex.repeat.set(1, 1);
  }
  if (!stripeMats.has(color)) stripeMats.set(color, new THREE.MeshStandardMaterial({ map: stripeTex, color, roughness: 0.35 }));
  return stripeMats.get(color);
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// A tiny seeded random, so each course's clutter lands in the same place every time.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
