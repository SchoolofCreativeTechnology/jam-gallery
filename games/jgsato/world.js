// Playhouse-style floating props framing the path in the void.
import * as THREE from 'three';
import * as tuning from './tuning.js';
import { getPathHeight } from './path.js';

const PALETTE = [
  '#ff2a6d', '#f7e600', '#05d9e8', '#9d4edd', '#ff8500', '#c9f227',
];

const PROP_COUNT = 35;

// Base geometries that get cloned and scaled per prop for variety.
const baseGeometries = [
  new THREE.SphereGeometry(1, 16, 12),
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.ConeGeometry(1, 1, 16),
  new THREE.TorusGeometry(1, 0.25, 12, 24),
  new THREE.CylinderGeometry(1, 1, 1, 16),
];

const props = [];
let startTime = 0;

function randomGeometry() {
  const base = baseGeometries[Math.floor(Math.random() * baseGeometries.length)];
  const geometry = base.clone();
  const scale = 0.35 + Math.random() * 0.55;
  geometry.scale(
    scale * (0.6 + Math.random() * 0.8),
    scale * (0.6 + Math.random() * 0.8),
    scale * (0.6 + Math.random() * 0.8),
  );
  return geometry;
}

export function createWorld(scene) {
  startTime = performance.now() / 1000;

  const points = tuning.path.points;
  for (let i = 0; i < PROP_COUNT; i++) {
    const seg = Math.floor(Math.random() * (points.length - 1));
    const t = Math.random();
    const a = points[seg];
    const b = points[seg + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const dirX = dx / len;
    const dirZ = dz / len;
    const perpX = -dirZ;
    const perpZ = dirX;

    const hw = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
    const cx = a.x + dx * t;
    const cz = a.z + dz * t;

    const side = Math.random() < 0.5 ? -1 : 1;
    const offset = hw + 2 + Math.random() * 8;
    const x = cx + perpX * offset * side;
    const z = cz + perpZ * offset * side;
    const y = getPathHeight(x, z) - 2 - Math.random() * 10;

    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(randomGeometry(), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    scene.add(mesh);

    props.push({
      mesh,
      baseY: y,
      rotX: (Math.random() - 0.5) * 0.8,
      rotY: (Math.random() - 0.5) * 0.8,
      rotZ: (Math.random() - 0.5) * 0.8,
      bobSpeed: 0.5 + Math.random() * 1.5,
      bobAmp: 0.2 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

export function updateWorld(dt, time) {
  for (const p of props) {
    p.mesh.rotation.x += p.rotX * dt;
    p.mesh.rotation.y += p.rotY * dt;
    p.mesh.rotation.z += p.rotZ * dt;
    p.mesh.position.y = p.baseY + Math.sin((time - startTime) * p.bobSpeed + p.phase) * p.bobAmp;
  }
}
