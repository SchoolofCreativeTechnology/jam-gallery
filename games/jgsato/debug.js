// ?debug: draws what the physics sees. Deck edges (green where a rail bounces you back, red
// where you fall), the head's collision circle, and every toy's hit circle.
import * as THREE from 'three';
import * as tuning from './tuning.js';
import { getCourse } from './path.js';
import { getColliders } from './toys.js';

export const enabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

let edges = null;
const circles = [];
let scene = null;
const circleGeo = (() => {
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
})();

export function debugLoad(newScene) {
  if (!enabled) return;
  scene = newScene;
  if (edges) scene.remove(edges);
  const C = getCourse();
  const pos = [], col = [];
  const green = [0.2, 1, 0.4], red = [1, 0.2, 0.2];
  for (let k = 0; k < C.N - 1; k++) {
    for (const side of [-1, 1]) {
      const rail = side < 0 ? C.rl[k] : C.rr[k];
      for (const j of [k, k + 1]) {
        const rx = -C.tz[j], rz = C.tx[j];
        pos.push(C.xs[j] + rx * C.ws[j] * side, C.ys[j] + 0.05, C.zs[j] + rz * C.ws[j] * side);
        col.push(...(rail ? green : red));
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  edges = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }));
  edges.renderOrder = 10;
  scene.add(edges);
}

export function debugUpdate(head) {
  if (!enabled || !scene) return;
  const list = [{ ...head.group.position, r: tuning.head.radius, head: true }, ...getColliders()];
  while (circles.length < list.length) {
    const line = new THREE.LineLoop(circleGeo, new THREE.LineBasicMaterial({ color: '#ffff00', depthTest: false }));
    line.renderOrder = 11;
    scene.add(line);
    circles.push(line);
  }
  circles.forEach((c, i) => {
    const item = list[i];
    c.visible = !!item;
    if (!item) return;
    c.position.set(item.x, item.y, item.z);
    c.scale.setScalar(item.r);
    c.material.color.set(item.head ? '#00ffff' : '#ffff00');
  });
}
