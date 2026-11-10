// Gold stars along the course. Each one you roll through takes time off your run, and they
// sit near the edges on purpose: grabbing one is always a small risk.
import * as THREE from 'three';
import * as tuning from './tuning.js';
import { frameAt, distanceAt } from './path.js';

const starGeo = makeStarGeometry();
const starMat = new THREE.MeshStandardMaterial({
  color: '#ffd23d', emissive: '#ff9a00', emissiveIntensity: 0.45, metalness: 0.55, roughness: 0.25,
});
const haloMat = new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
const haloGeo = new THREE.CircleGeometry(0.62, 24);

let root = null;
const stars = [];
export let collected = 0;

export function loadStars(scene, level) {
  if (root) scene.remove(root);
  root = new THREE.Group();
  scene.add(root);
  stars.length = 0;
  for (const data of level.stars) {
    const f = frameAt(distanceAt(data.at));
    const lat = data.off * f.w * 0.82;
    const group = new THREE.Group();
    group.position.set(f.x + f.rx * lat, f.y + 0.75, f.z + f.rz * lat);
    const star = new THREE.Mesh(starGeo, starMat);
    star.castShadow = true;
    const halo = new THREE.Mesh(haloGeo, haloMat);
    group.add(halo, star);
    root.add(group);
    stars.push({ group, star, halo, baseY: group.position.y, phase: Math.random() * 6, taken: false });
  }
  resetStars();
}

export function resetStars() {
  collected = 0;
  for (const s of stars) {
    s.taken = false;
    s.group.visible = true;
    s.group.scale.setScalar(1);
  }
}

export function totalStars() {
  return stars.length;
}

// Spin and bob; collect any the head touches. Calls onStar(position) per pickup.
export function updateStars(dt, time, head, camera, onStar) {
  const hp = head.group.position;
  const reach = tuning.head.radius + tuning.stars.radius;
  for (const s of stars) {
    if (!s.group.visible) continue;
    if (s.taken) {
      // A quick pop as it's grabbed.
      s.pop += dt;
      s.group.scale.setScalar(1 + s.pop * 5);
      s.group.position.y += dt * 3;
      if (s.pop > 0.18) s.group.visible = false;
      continue;
    }
    // Face the camera (seen from above, a star spinning on its edge reads as a stick),
    // and twirl in place with a little rocking wobble.
    s.group.quaternion.copy(camera.quaternion);
    s.star.rotation.set(0, Math.sin(time * 3 + s.phase) * 0.55, time * 1.8 + s.phase);
    s.group.position.y = s.baseY + Math.sin(time * 3 + s.phase) * 0.12;
    s.halo.material.opacity = 0.25 + 0.15 * Math.sin(time * 5 + s.phase);
    if (!head.isFalling && Math.hypot(hp.x - s.group.position.x, hp.z - s.group.position.z) < reach && Math.abs(hp.y - s.group.position.y) < 1.2) {
      s.taken = true;
      s.pop = 0;
      collected++;
      onStar(s.group.position.clone());
    }
  }
}

function makeStarGeometry() {
  const shape = new THREE.Shape();
  const spikes = 5;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 0.2 : 0.45;
    const x = Math.cos(a) * r, y = -Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  geo.center();
  return geo;
}
