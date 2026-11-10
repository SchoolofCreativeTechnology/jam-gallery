// The toys: wind-up cars that cross the deck, and jack-in-the-boxes that punch across it.
// Every car flashes its lane before it pulls out, and every jack rattles before it springs,
// so a hit is always something you could have seen coming.
import * as THREE from 'three';
import * as tuning from './tuning.js';
import { frameAt, distanceAt, getCourse } from './path.js';

let scene;
let root;           // everything for the current course hangs off this
let level;
const cars = [];
const carPool = [];
const lanes = [];   // warnings waiting to become cars
const lanePool = [];
const jacks = [];
let spawnTimer = 0;
let clock = 0;
let callbacks = {};

// ---- SHARED MODEL PARTS ----
const CAR_COLORS = ['#ff2a6d', '#ff8500', '#2f7bff', '#7ee787', '#9d4edd', '#f7e600'];
const L = tuning.cars.length;
const W = tuning.cars.width;
const bodyGeo = roundedBox(W * 0.94, 0.3, L * 0.9, 0.08);
const cabinGeo = roundedBox(W * 0.7, 0.22, L * 0.44, 0.06);
const wheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 14);
wheelGeo.rotateZ(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.13, 8);
hubGeo.rotateZ(Math.PI / 2);
const lampGeo = new THREE.BoxGeometry(0.1, 0.07, 0.04);
const keyGeo = new THREE.TorusGeometry(0.1, 0.025, 6, 16);
const bodyMats = new Map();
const glassMat = new THREE.MeshStandardMaterial({ color: '#bff6ff', roughness: 0.1, metalness: 0.2 });
const tyreMat = new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.85 });
const hubMat = new THREE.MeshStandardMaterial({ color: '#e8e8f0', metalness: 0.6, roughness: 0.3 });
const lampMat = new THREE.MeshStandardMaterial({ color: '#fff6b0', emissive: '#fff2a0', emissiveIntensity: 1.2 });
const keyMat = new THREE.MeshStandardMaterial({ color: '#ffd23d', metalness: 0.7, roughness: 0.25 });

const laneTexture = makeLaneTexture();

export function initToys(newScene, cb) {
  scene = newScene;
  callbacks = cb || {};
}

// Set up the toys for a course: build its jack-in-the-boxes, clear everything else.
export function loadToys(newLevel) {
  if (root) {
    scene.remove(root);
    for (const j of jacks) disposeTree(j.group);
  }
  for (const c of cars) carPool.push(c.model);
  for (const l of lanes) lanePool.push(l.mesh);
  cars.length = 0;
  lanes.length = 0;
  jacks.length = 0;
  level = newLevel;
  root = new THREE.Group();
  scene.add(root);
  for (const j of level.jacks) jacks.push(createJack(j));
  resetToys();
}

export function resetToys() {
  for (const c of cars) { root.remove(c.model.group); carPool.push(c.model); }
  for (const l of lanes) { root.remove(l.mesh); lanePool.push(l.mesh); }
  cars.length = 0;
  lanes.length = 0;
  spawnTimer = 1.0;
  clock = 0;
  for (const j of jacks) {
    j.t = j.phase;
    j.hit = false;
    j.sprung = false;
    poseJack(j, 0, 0);
  }
}

// One frame of toys. `active` is false on the title screen, so jacks idle but nothing spawns.
export function updateToys(dt, head, active) {
  if (!(dt > 0)) return;
  clock += dt;
  const course = getCourse();
  const hp = head.group.position;
  const progress = head.progress;
  const frac = Math.min(1, progress / course.length);

  // ---- SPAWNING: gaps shrink and cars speed up the further along the course you get ----
  if (active && !head.isFalling && !head.isHome) {
    const cfg = level.cars;
    if (frac > cfg.from) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const gap = lerp(cfg.gap[0], cfg.gap[1], frac);
        spawnTimer = gap * (0.8 + Math.random() * 0.4);
        queueCar(head, lerp(cfg.speed[0], cfg.speed[1], frac), cfg.warn);
      }
    }
  }

  // ---- LANE WARNINGS: flash, then pull out ----
  for (let i = lanes.length - 1; i >= 0; i--) {
    const lane = lanes[i];
    lane.t += dt;
    const k = lane.t / lane.warn;
    lane.mesh.material.opacity = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(lane.t * 22));
    lane.mesh.material.map.offset.y = lane.t * 2.5; // chevrons crawl the way the car will drive
    if (k >= 1) {
      root.remove(lane.mesh);
      lanePool.push(lane.mesh);
      lanes.splice(i, 1);
      spawnCar(lane);
    }
  }

  // ---- CARS ----
  const hr = tuning.head.radius;
  for (let i = cars.length - 1; i >= 0; i--) {
    const car = cars[i];
    const g = car.model.group;
    car.age += dt;
    g.position.x += car.vx * dt;
    g.position.z += car.vz * dt;
    const pop = Math.min(1, car.age / 0.14);
    g.scale.setScalar(0.3 + 0.7 * easeOutBack(pop));
    for (const w of car.model.wheels) w.rotation.x += car.speed * dt / 0.14;
    car.model.key.rotation.z += dt * 8;

    if (car.falling) {
      car.vy -= tuning.rules.gravity * dt;
      g.position.y += car.vy * dt;
      g.rotation.z += car.roll * dt;
      g.rotation.x += car.roll * 0.4 * dt;
      if (g.position.y < course.bounds.floorY - 1) {
        root.remove(g);
        carPool.push(car.model);
        cars.splice(i, 1);
      }
      continue;
    }

    // A little bounce, like a wind-up toy.
    g.position.y = car.y + W * 0.5 + Math.abs(Math.sin(car.age * 18)) * 0.05 + car.hop;
    car.hop = Math.max(0, car.hop - dt * 2);

    // Off the far edge: tumble into the void.
    const lat = (g.position.x - car.cx) * car.rx + (g.position.z - car.cz) * car.rz;
    if (lat * car.dir > car.w + 0.15) {
      car.falling = true;
      car.vy = 1.5;
      car.roll = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4);
      continue;
    }

    // Hit: a capsule along the car against the head's circle.
    if (!car.hit && !head.isFalling && !head.isHome && Math.abs(hp.y - g.position.y) < 1.2) {
      const ux = car.vx / car.speed, uz = car.vz / car.speed;
      const along = clamp((hp.x - g.position.x) * ux + (hp.z - g.position.z) * uz, -tuning.cars.hitLength, tuning.cars.hitLength);
      const qx = g.position.x + ux * along, qz = g.position.z + uz * along;
      const dx = hp.x - qx, dz = hp.z - qz;
      const d = Math.hypot(dx, dz);
      if (d < hr + tuning.cars.hitRadius) {
        car.hit = true;
        const nx = d > 1e-4 ? dx / d : ux, nz = d > 1e-4 ? dz / d : uz;
        let sx = ux * 0.75 + nx * 0.55, sz = uz * 0.75 + nz * 0.55;
        const sl = Math.hypot(sx, sz) || 1;
        const power = car.speed * tuning.cars.shove;
        head.shove(sx / sl * power, sz / sl * power);
        car.vx *= 0.55; car.vz *= 0.55; car.speed *= 0.55;
        car.hop = 0.35;
        if (callbacks.onHit) callbacks.onHit(new THREE.Vector3(qx + nx * hr, hp.y, qz + nz * hr), car.model.color);
      }
    }
  }

  // ---- JACK-IN-THE-BOXES ----
  const J = tuning.jacks;
  const idle = J.period - J.telegraph - J.extend - J.hold - J.retract;
  for (const j of jacks) {
    j.t = (j.t + dt) % J.period;
    const t = j.t;
    let ext = 0, shake = 0;
    if (t < idle) {
      j.hit = false;
      j.sprung = false;
    } else if (t < idle + J.telegraph) {
      const k = (t - idle) / J.telegraph;
      shake = 0.3 + k * 0.7;
    } else if (t < idle + J.telegraph + J.extend) {
      ext = easeOutBack((t - idle - J.telegraph) / J.extend);
      if (!j.sprung) {
        j.sprung = true;
        if (callbacks.onSpring) callbacks.onSpring(j.base.distanceTo(hp));
      }
    } else if (t < idle + J.telegraph + J.extend + J.hold) {
      ext = 1 + Math.sin((t - idle - J.telegraph - J.extend) * 30) * 0.04;
    } else {
      ext = 1 - (t - idle - J.telegraph - J.extend - J.hold) / J.retract;
    }
    poseJack(j, ext, shake);

    // The danger strip shows while it's winding up and while it's out.
    const showZone = t >= idle;
    j.zone.visible = showZone;
    if (showZone) j.zone.material.opacity = shake > 0 ? 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(clock * 26)) : 0.45;

    if (active && ext > 0.4 && !j.hit && !head.isFalling && !head.isHome) {
      const gp = j.glove.getWorldPosition(tmp);
      if (Math.hypot(hp.x - gp.x, hp.z - gp.z) < hr + J.gloveRadius && Math.abs(hp.y - gp.y) < 1.2) {
        j.hit = true;
        head.shove(j.dirX * J.power, j.dirZ * J.power);
        if (callbacks.onHit) callbacks.onHit(gp.clone(), '#ffffff');
      }
    }
  }
}

const tmp = new THREE.Vector3();

// For ?debug: every live collider as a circle on the deck.
export function getColliders() {
  const out = [];
  for (const c of cars) {
    if (c.falling) continue;
    const g = c.model.group;
    const ux = c.vx / c.speed, uz = c.vz / c.speed;
    for (const a of [-1, 0, 1]) {
      out.push({ x: g.position.x + ux * a * tuning.cars.hitLength, y: g.position.y, z: g.position.z + uz * a * tuning.cars.hitLength, r: tuning.cars.hitRadius });
    }
  }
  for (const j of jacks) {
    const gp = j.glove.getWorldPosition(new THREE.Vector3());
    out.push({ x: gp.x, y: gp.y, z: gp.z, r: tuning.jacks.gloveRadius });
  }
  return out;
}

// ---- CARS ----
function queueCar(head, speed, warn) {
  const course = getCourse();
  const v = head.velocity;
  // Aim the lane at where the head will be when the car is mid-crossing, give or take a little,
  // so a car is a real threat you dodge by speeding up, easing off, or picking a side.
  // Never closer than aheadMin, so there's always time to see it.
  for (let attempt = 0; attempt < 3; attempt++) {
    const f0 = frameAt(head.progress);
    const forward = Math.max(0, v.x * f0.tx + v.z * f0.tz);
    const cross = (f0.w * 2) / speed;
    const [j0, j1] = tuning.cars.aimJitter;
    const ahead = Math.max(tuning.cars.aheadMin, forward * (warn + cross * 0.5) + j0 + Math.random() * (j1 - j0));
    const s = head.progress + ahead;
    if (s > course.length - 5) return;
    // Don't stack lanes on top of each other.
    if (lanes.some((l) => Math.abs(l.s - s) < 1.8) || cars.some((c) => !c.falling && Math.abs(c.s - s) < 1.8)) continue;
    const f = frameAt(s);
    const dir = Math.random() < 0.5 ? -1 : 1; // the side it drives TOWARD
    const mesh = lanePool.pop() || new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: laneTexture.clone(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    );
    mesh.material.map.wrapT = THREE.RepeatWrapping;
    mesh.material.map.repeat.set(1, Math.max(1, Math.round(f.w * 2 / 0.7)));
    mesh.material.map.needsUpdate = true;
    mesh.scale.set(W + 0.15, f.w * 2, 1);
    mesh.rotation.order = 'YXZ';
    // Lay it flat across the deck, with the chevrons pointing the way the car will go.
    mesh.rotation.set(-Math.PI / 2, Math.atan2(f.rx * dir, f.rz * dir), 0);
    mesh.position.set(f.x, f.y + 0.02, f.z);
    mesh.renderOrder = 1;
    root.add(mesh);
    lanes.push({ mesh, t: 0, warn, s, f, dir, speed });
    if (callbacks.onWarn) callbacks.onWarn(new THREE.Vector3(f.x, f.y, f.z));
    return;
  }
}

function spawnCar(lane) {
  const { f, dir, speed } = lane;
  const model = carPool.pop() || createCarModel();
  const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  model.setColor(color);
  const g = model.group;
  const startLat = -dir * (f.w - 0.1);
  g.position.set(f.x + f.rx * startLat, f.y + W * 0.5, f.z + f.rz * startLat);
  g.rotation.set(0, Math.atan2(f.rx * dir, f.rz * dir), 0);
  g.scale.setScalar(0.3);
  root.add(g);
  cars.push({
    model, speed, age: 0, hop: 0, hit: false, falling: false, vy: 0, roll: 0,
    vx: f.rx * dir * speed, vz: f.rz * dir * speed,
    cx: f.x, cz: f.z, rx: f.rx, rz: f.rz, w: f.w, y: f.y, dir, s: f.s,
  });
}

function createCarModel() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, bodyMats.get(CAR_COLORS[0]) || carMat(CAR_COLORS[0]));
  body.position.y = -0.02;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 0.2, -L * 0.06);
  cabin.castShadow = true;
  group.add(cabin);
  const wheels = [];
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(wheelGeo, tyreMat), new THREE.Mesh(hubGeo, hubMat));
      wheel.position.set(side * W * 0.47, -W * 0.5 + 0.14, end * L * 0.3);
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(side * W * 0.28, 0.0, L * 0.45);
    group.add(lamp);
  }
  // The wind-up key on the back, turning as it goes.
  const key = new THREE.Group();
  const loop1 = new THREE.Mesh(keyGeo, keyMat);
  loop1.position.x = 0.1;
  const loop2 = new THREE.Mesh(keyGeo, keyMat);
  loop2.position.x = -0.1;
  key.add(loop1, loop2);
  key.position.set(0, 0.26, -L * 0.38);
  key.rotation.y = Math.PI / 2;
  const keyPivot = new THREE.Group();
  keyPivot.add(key);
  keyPivot.position.set(0, 0, 0);
  group.add(keyPivot);

  const model = {
    group, wheels, key: loop1.parent, color: CAR_COLORS[0],
    setColor(c) {
      model.color = c;
      body.material = carMat(c);
    },
  };
  return model;
}

function carMat(color) {
  if (!bodyMats.has(color)) bodyMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 }));
  return bodyMats.get(color);
}

// ---- JACK-IN-THE-BOXES ----
const jackBoxTex = makeJackBoxTexture();
const clownTex = makeClownTexture();

function createJack(data) {
  const s = distanceAt(data.at);
  const f = frameAt(s);
  const side = data.side;
  const boxSize = 0.9;
  const lat = side * (f.w + boxSize * 0.5 + 0.08);
  const base = new THREE.Vector3(f.x + f.rx * lat, f.y, f.z + f.rz * lat);
  const dirX = -f.rx * side, dirZ = -f.rz * side; // punches toward the deck

  const group = new THREE.Group();
  group.position.copy(base);
  group.rotation.y = Math.atan2(dirX, dirZ); // local +z points across the deck
  root.add(group);

  // A little bracket so the box hangs off the side of the deck.
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(boxSize * 1.1, 0.25, boxSize * 1.2),
    new THREE.MeshStandardMaterial({ color: '#6a2fa0', roughness: 0.7 }));
  bracket.position.y = -0.18;
  bracket.castShadow = true;
  group.add(bracket);

  const box = new THREE.Group();
  group.add(box);
  const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize, boxSize),
    new THREE.MeshStandardMaterial({ map: jackBoxTex, roughness: 0.55 }));
  boxMesh.position.y = boxSize / 2;
  boxMesh.castShadow = true;
  box.add(boxMesh);

  // Crank on the outer side.
  const crank = new THREE.Group();
  crank.position.set(0, boxSize * 0.5, -boxSize * 0.52);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), new THREE.MeshStandardMaterial({ color: '#ffd23d', metalness: 0.6, roughness: 0.3 }));
  arm.position.y = 0.13;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff2a6d', roughness: 0.4 }));
  knob.position.set(0, 0.28, -0.07);
  crank.add(arm, knob);
  box.add(crank);

  // The lid, hinged on the outer edge, so it flips away from the deck.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, boxSize, -boxSize / 2);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(boxSize * 1.04, 0.08, boxSize * 1.04),
    new THREE.MeshStandardMaterial({ color: '#ffd23d', roughness: 0.45 }));
  lid.position.set(0, 0.04, boxSize / 2);
  lidPivot.add(lid);
  box.add(lidPivot);

  // The spring and the clown, pointing across the deck.
  const springMat = new THREE.MeshStandardMaterial({ color: '#d8d8e6', metalness: 0.8, roughness: 0.25 });
  const spring = new THREE.Mesh(springGeometry(), springMat);
  spring.position.set(0, boxSize * 0.62, 0);
  box.add(spring);

  const glove = new THREE.Group();
  const clown = new THREE.Mesh(new THREE.SphereGeometry(tuning.jacks.gloveRadius, 24, 16),
    new THREE.MeshStandardMaterial({ map: clownTex, roughness: 0.5 }));
  clown.castShadow = true; // its painted face sits at u = 0.25, which is local +z: across the deck
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff2a3a', roughness: 0.3 }));
  nose.position.set(0, 0, tuning.jacks.gloveRadius * 0.98);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 14), new THREE.MeshStandardMaterial({ color: '#7ee787', roughness: 0.5 }));
  hat.position.y = tuning.jacks.gloveRadius + 0.12;
  hat.rotation.x = -0.25;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  pom.position.set(0, tuning.jacks.gloveRadius + 0.36, -0.05);
  glove.add(clown, nose, hat, pom);
  glove.position.set(0, boxSize * 0.62, 0);
  box.add(glove);

  // The danger strip across the deck: how far it reaches, so you know where's safe.
  const reach = f.w * 2 * tuning.jacks.reach;
  const zone = new THREE.Mesh(
    new THREE.PlaneGeometry(tuning.jacks.gloveRadius * 2 + 0.1, reach + 0.35),
    new THREE.MeshBasicMaterial({ color: '#ff2a3a', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
  );
  zone.rotation.x = -Math.PI / 2;
  const toEdge = boxSize * 0.5 + 0.08;
  zone.position.set(0, 0.025, toEdge + (reach + 0.35) / 2 - 0.1);
  zone.visible = false;
  zone.renderOrder = 1;
  group.add(zone);

  return {
    group, box, lidPivot, spring, glove, crank, zone, base,
    dirX, dirZ, reach: reach + toEdge, boxSize,
    phase: data.phase ?? (s * 0.37) % tuning.jacks.period,
    t: 0, hit: false, sprung: false,
  };
}

function poseJack(j, ext, shake) {
  const out = Math.max(0, ext);
  j.box.position.x = shake ? (Math.random() - 0.5) * 0.08 * shake : 0;
  j.box.rotation.z = shake ? (Math.random() - 0.5) * 0.12 * shake : 0;
  j.crank.rotation.z = j.t * (shake ? 14 : 2);
  j.lidPivot.rotation.x = -(Math.min(1, out * 3) * 2.1 + (shake ? Math.random() * 0.25 * shake : 0));
  const length = 0.05 + out * j.reach;
  j.glove.position.z = length;
  j.glove.visible = out > 0.02;
  j.spring.visible = out > 0.02;
  j.spring.scale.set(1, 1, Math.max(0.01, length));
}

// ---- GEOMETRY AND TEXTURES ----
// A coil along +z from 0 to 1, so scaling z stretches it.
function springGeometry() {
  const pts = [];
  const turns = 9;
  for (let i = 0; i <= turns * 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.14, Math.sin(a) * 0.14, i / (turns * 16)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, 0.025, 6, false);
}

function roundedBox(w, h, d, radius) {
  // A box with its corners pulled in, which reads as a moulded toy instead of a crate.
  const geo = new THREE.BoxGeometry(w, h, d, 4, 3, 4);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const hw = w / 2 - radius, hh = h / 2 - radius, hd = d / 2 - radius;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const cx = clamp(v.x, -hw, hw), cy = clamp(v.y, -hh, hh), cz = clamp(v.z, -hd, hd);
    const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len > 0) {
      v.set(cx + dx / len * radius, cy + dy / len * radius, cz + dz / len * radius);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function makeLaneTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255, 210, 40, 0.55)';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(40, 20, 60, 0.85)';
  ctx.beginPath();
  ctx.moveTo(8, 18); ctx.lineTo(32, 42); ctx.lineTo(56, 18); ctx.lineTo(56, 32); ctx.lineTo(32, 56); ctx.lineTo(8, 32);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeJackBoxTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff2a6d';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffd23d';
  ctx.fillRect(0, 0, 128, 10);
  ctx.fillRect(0, 118, 128, 10);
  ctx.fillRect(0, 0, 10, 128);
  ctx.fillRect(118, 0, 10, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeClownTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff4ec';
  ctx.fillRect(0, 0, 256, 128);
  const cx = 64; // u = 0.25, the front of the sphere
  ctx.fillStyle = '#2a1630';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * 14, 54, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#ff2a3a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, 70, 20, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = '#05d9e8';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 14, 38); ctx.lineTo(cx + s * 9, 30); ctx.lineTo(cx + s * 19, 30);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8500';
  ctx.fillRect(0, 0, 256, 18); // hair
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && o.geometry !== wheelGeo && o.geometry !== hubGeo) o.geometry.dispose();
  });
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function easeOutBack(t) {
  const c1 = 1.7, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
