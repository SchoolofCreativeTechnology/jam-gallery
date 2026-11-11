// His box at the end of the course: an ornate genie box with the lid thrown open, a column of
// light so you can always see where home is, and a lid that snaps shut when he's back inside.
import * as THREE from 'three';
import * as tuning from './tuning.js';
import { frameAt, getCourse } from './path.js';

const BOX_W = 1.6;
const BOX_H = 1.0;
const LID_OPEN = 1.95; // radians the lid stands open, swung up and back on its far hinge

let root = null;
let lidPivot, beam, ring, arrow, glow;
let closing = 0;
export const boxTop = new THREE.Vector3();
export const boxCentre = new THREE.Vector3();

const bodyTex = makeBoxTexture();
const ringTex = makeRingTexture();

export function loadGoal(scene) {
  if (root) scene.remove(root);
  const course = getCourse();
  const f = frameAt(course.length - 1.7);
  root = new THREE.Group();
  root.position.set(f.x, f.y, f.z);
  root.rotation.y = Math.atan2(f.tx, f.tz); // local +z points further along the course
  scene.add(root);
  boxCentre.set(f.x, f.y, f.z);
  boxTop.set(f.x, f.y + BOX_H, f.z);

  const gold = new THREE.MeshStandardMaterial({ color: '#ffd23d', metalness: 0.8, roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(BOX_W, BOX_H, BOX_W), [
    boxMat(), boxMat(), new THREE.MeshStandardMaterial({ color: '#2a0f3d', roughness: 1 }),
    boxMat(), boxMat(), boxMat(),
  ]);
  body.position.y = BOX_H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Velvet inside, gold trim on every edge, little ball feet.
  const velvet = new THREE.Mesh(new THREE.PlaneGeometry(BOX_W * 0.9, BOX_W * 0.9),
    new THREE.MeshStandardMaterial({ color: '#c2185b', roughness: 1, emissive: '#5a0f3a', emissiveIntensity: 0.5 }));
  velvet.rotation.x = -Math.PI / 2;
  velvet.position.y = BOX_H + 0.005;
  root.add(velvet);
  const trimGeo = new THREE.BoxGeometry(BOX_W + 0.1, 0.1, 0.1);
  for (const y of [0.05, BOX_H]) {
    for (const [x, z, ry] of [[0, BOX_W / 2, 0], [0, -BOX_W / 2, 0], [BOX_W / 2, 0, Math.PI / 2], [-BOX_W / 2, 0, Math.PI / 2]]) {
      const trim = new THREE.Mesh(trimGeo, gold);
      trim.position.set(x, y, z);
      trim.rotation.y = ry;
      root.add(trim);
    }
  }
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), gold);
      foot.position.set(x * BOX_W * 0.42, 0.04, z * BOX_W * 0.42);
      root.add(foot);
    }
  }

  // The lid hinges on the far edge and stands open.
  lidPivot = new THREE.Group();
  lidPivot.position.set(0, BOX_H, BOX_W / 2);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(BOX_W + 0.12, 0.14, BOX_W + 0.12), boxMat());
  lid.position.set(0, 0.07, -BOX_W / 2);
  lid.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), gold);
  knob.position.set(0, 0.2, -BOX_W / 2);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshStandardMaterial({ color: '#05d9e8', emissive: '#05d9e8', emissiveIntensity: 0.5 }));
  gem.position.set(0, 0.07, -BOX_W - 0.02);
  lidPivot.add(lid, knob, gem);
  root.add(lidPivot);

  // A soft column of light, and a ring on the deck showing how close counts as home.
  beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.85, 9, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  beam.position.y = BOX_H + 4.5;
  root.add(beam);
  glow = new THREE.PointLight('#ffd27a', 6, 6, 1.6);
  glow.position.y = BOX_H + 0.6;
  root.add(glow);

  ring = new THREE.Mesh(
    new THREE.RingGeometry(tuning.goal.radius - 0.12, tuning.goal.radius + 0.04, 48),
    new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);

  arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 4), new THREE.MeshStandardMaterial({ color: '#ffd23d', emissive: '#ff9a00', emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 }));
  arrow.rotation.x = Math.PI;
  root.add(arrow);

  resetGoal();
}

export function resetGoal() {
  closing = 0;
  lidPivot.rotation.x = LID_OPEN;
  beam.visible = true;
  arrow.visible = true;
  ring.visible = true;
}

export function closeLid() {
  closing = 0.0001;
}

export function updateGoal(dt, time) {
  arrow.position.y = BOX_H + 2.4 + Math.sin(time * 3) * 0.25;
  arrow.rotation.y = time * 2;
  ring.rotation.z = time * 0.6;
  beam.material.opacity = 0.13 + Math.sin(time * 2.5) * 0.04;
  glow.intensity = 5 + Math.sin(time * 4) * 1.5;
  if (closing > 0) {
    closing += dt;
    // Hold open while he sinks in, then slam shut with a little bounce.
    // He's fully below the rim (and hidden) at 0.9s; the lid starts swinging just after.
    const k = Math.max(0, (closing - 0.95) / 0.22);
    const shut = Math.min(1, k);
    const after = closing - 1.17;
    lidPivot.rotation.x = LID_OPEN * (1 - shut * shut) + (k >= 1 ? Math.abs(Math.sin(after * 30)) * Math.max(0, 0.15 - after * 0.3) : 0);
    if (k >= 1) { beam.visible = false; arrow.visible = false; ring.visible = false; }
  }
}

function boxMat() {
  return new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.5, metalness: 0.15 });
}

// Deep purple with a gold frame and a scatter of little stars.
function makeBoxTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7b2fc0');
  g.addColorStop(1, '#4a1580');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#ffd23d';
  ctx.lineWidth = 10;
  ctx.strokeRect(22, 22, 212, 212);
  ctx.lineWidth = 3;
  ctx.strokeRect(38, 38, 180, 180);
  ctx.fillStyle = '#ffd23d';
  const star = (x, y, r) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  star(128, 128, 34);
  for (const [x, y] of [[70, 70], [186, 70], [70, 186], [186, 186]]) star(x, y, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeRingTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 16;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,210,61,0.95)' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(i * 16, 0, 16, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
