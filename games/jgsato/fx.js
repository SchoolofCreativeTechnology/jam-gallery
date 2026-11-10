// Particles: confetti, sparkles and hit bursts, all one instanced mesh (one draw call),
// plus a few pooled shockwave rings. Nothing is created while you play.
import * as THREE from 'three';

const MAX = 400;
const RINGS = 8;

let mesh;
const parts = [];
let next = 0;
const rings = [];
const dummy = new THREE.Object3D();
const color = new THREE.Color();

export function initFX(scene) {
  const geo = new THREE.BoxGeometry(0.14, 0.14, 0.04);
  mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.15 }), MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  for (let i = 0; i < MAX; i++) {
    parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, spin: 0, size: 1, gravity: 0, drag: 0 });
    mesh.setColorAt(i, color.set('#ffffff'));
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mesh);

  const ringGeo = new THREE.RingGeometry(0.8, 1, 40);
  ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < RINGS; i++) {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }));
    ring.visible = false;
    scene.add(ring);
    rings.push({ ring, life: 0, max: 1, size: 1 });
  }
}

// Throw `count` bits out from `pos`. Options: colors, speed, up, gravity, life, size, spread.
export function burst(pos, opts = {}) {
  const {
    count = 16, colors = ['#ffd23d'], speed = 4, up = 3, gravity = 12, life = 0.8, size = 1, drag = 1.5,
  } = opts;
  for (let i = 0; i < count; i++) {
    const idx = next;
    const p = parts[idx];
    next = (next + 1) % MAX;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    p.vx = Math.cos(a) * s;
    p.vz = Math.sin(a) * s;
    p.vy = up * (0.5 + Math.random());
    p.life = p.max = life * (0.7 + Math.random() * 0.6);
    p.rx = Math.random() * 6;
    p.ry = Math.random() * 6;
    p.spin = (Math.random() - 0.5) * 18;
    p.size = size * (0.7 + Math.random() * 0.6);
    p.gravity = gravity;
    p.drag = drag;
    mesh.setColorAt(idx, color.set(colors[Math.floor(Math.random() * colors.length)]));
  }
  mesh.instanceColor.needsUpdate = true;
}

export function shockwave(pos, opts = {}) {
  const { color: c = '#ffffff', size = 2.2, life = 0.35 } = opts;
  const r = rings.find((x) => x.life <= 0) || rings[0];
  r.ring.position.set(pos.x, pos.y + 0.05, pos.z);
  r.ring.material.color.set(c);
  r.ring.visible = true;
  r.life = r.max = life;
  r.size = size;
}

export function clearFX() {
  for (const p of parts) p.life = 0;
  for (const r of rings) { r.life = 0; r.ring.visible = false; }
}

export function updateFX(dt) {
  for (let i = 0; i < MAX; i++) {
    const p = parts[i];
    if (p.life <= 0) {
      if (p.max > 0) {
        p.max = 0;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      continue;
    }
    p.life -= dt;
    const keep = Math.exp(-p.drag * dt);
    p.vx *= keep;
    p.vz *= keep;
    p.vy -= p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.rx += p.spin * dt;
    p.ry += p.spin * 0.7 * dt;
    const k = Math.max(0, p.life / p.max);
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rx, p.ry, 0);
    dummy.scale.setScalar(p.size * Math.min(1, k * 3));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  for (const r of rings) {
    if (r.life <= 0) continue;
    r.life -= dt;
    const k = 1 - Math.max(0, r.life / r.max);
    r.ring.scale.setScalar(0.2 + k * r.size);
    r.ring.material.opacity = (1 - k) * 0.8;
    if (r.life <= 0) r.ring.visible = false;
  }
}
