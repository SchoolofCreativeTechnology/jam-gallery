// Builds the ribbon of path the head rolls along, and answers "is this point on it?".
import * as THREE from 'three';
import * as tuning from './tuning.js';

// Playhouse ramp colours.
const RAIL_COLOR = '#ff2a6d';
const SIDE_COLOR = '#4a5568';
const STRIPE_COLORS = ['#ff2a6d', '#f7e600', '#05d9e8', '#9d4edd'];
const STRIPE_WIDTH = 1.2;
const MARKER_COLOR = '#e08a3c';
const MARKER_SIZE = 1.5;
const CHEVRON_COLOR = 0xf7e600;
const CHEVRON_SPACING = 1.8;

const points = tuning.path.points;

// The spawn point: the first centre-line point.
export const pathStart = { x: points[0].x, z: points[0].z };

// The goal: the last centre-line point, where his box sits.
export const goalPosition = { x: points[points.length - 1].x, z: points[points.length - 1].z };

// One flat box per segment, plus a square patch under each point so corners meet
// cleanly and the slab is never narrower than the point's own half-width.
export function createPath(scene) {
  const group = new THREE.Group();
  const sideMaterial = new THREE.MeshStandardMaterial({ color: SIDE_COLOR });
  const thickness = tuning.path.thickness;
  // The top surface follows the path elevation; the slab centre hangs half its thickness below.
  const centreYOffset = -thickness / 2;
  const chevronGeo = createChevronGeometry();
  const chevronMat = new THREE.MeshStandardMaterial({
    color: CHEVRON_COLOR,
    emissive: CHEVRON_COLOR,
    emissiveIntensity: 0.35,
    roughness: 0.6,
  });

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const horizontalLength = Math.hypot(dx, dz);
    if (horizontalLength === 0) continue;

    // A box can't taper, so the slab takes the average of the two half-widths.
    const halfWidth = (a.halfWidth + b.halfWidth) / 2;
    const length3D = Math.hypot(horizontalLength, dy);

    const topTexture = createStripeTexture();
    topTexture.wrapS = THREE.RepeatWrapping;
    topTexture.wrapT = THREE.RepeatWrapping;
    topTexture.repeat.set(1, length3D / (STRIPE_COLORS.length * STRIPE_WIDTH));
    topTexture.colorSpace = THREE.SRGBColorSpace;
    const topMaterial = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.8 });
    const materials = [
      sideMaterial, // +x
      sideMaterial, // -x
      topMaterial,  // +y top
      sideMaterial, // -y bottom
      sideMaterial, // +z
      sideMaterial, // -z
    ];

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(halfWidth * 2, thickness, length3D),
      materials
    );
    // The box's local +z is its length; lookAt pitches it along the segment.
    slab.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + centreYOffset, (a.z + b.z) / 2);
    slab.lookAt(b.x, b.y, b.z);
    group.add(slab);

    // Chevron arrows on slopes, pointing downhill.
    const slope = dy / horizontalLength;
    if (Math.abs(slope) > 0.05) {
      const arrowCount = Math.floor(length3D / CHEVRON_SPACING);
      for (let i = 0; i < arrowCount; i++) {
        const arrow = new THREE.Mesh(chevronGeo, chevronMat);
        arrow.position.set(0, thickness / 2 + 0.02, -length3D / 2 + CHEVRON_SPACING * (i + 0.5));
        if (b.y > a.y) {
          arrow.rotation.y = Math.PI;
        }
        slab.add(arrow);
      }
    }

    // Thin edge rails just above the path surface, following the segment pitch.
    const railGeo = new THREE.BoxGeometry(0.12, 0.12, length3D);
    const railMat = new THREE.MeshStandardMaterial({ color: RAIL_COLOR, roughness: 0.4 });
    const railY = thickness / 2 + 0.12 / 2;

    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(halfWidth, railY, 0);
    slab.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(-halfWidth, railY, 0);
    slab.add(rightRail);
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const patchSize = p.halfWidth * 2;

    const topTexture = createStripeTexture();
    topTexture.wrapS = THREE.RepeatWrapping;
    topTexture.wrapT = THREE.RepeatWrapping;
    topTexture.repeat.set(1, patchSize / (STRIPE_COLORS.length * STRIPE_WIDTH));
    topTexture.colorSpace = THREE.SRGBColorSpace;
    const topMaterial = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.8 });
    const materials = [
      sideMaterial, // +x
      sideMaterial, // -x
      topMaterial,  // +y top
      sideMaterial, // -y bottom
      sideMaterial, // +z
      sideMaterial, // -z
    ];

    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(patchSize, thickness, patchSize),
      materials
    );
    patch.position.set(p.x, p.y + centreYOffset, p.z);

    // Keep stripes running along the path through corners.
    if (i < points.length - 1) {
      const next = points[i + 1];
      patch.lookAt(next.x, next.y, next.z);
    } else if (i > 0) {
      const prev = points[i - 1];
      patch.lookAt(prev.x, prev.y, prev.z);
    }
    group.add(patch);
  }

  // A plain cube standing in for where his box will be. No win logic yet.
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(MARKER_SIZE, MARKER_SIZE, MARKER_SIZE),
    new THREE.MeshStandardMaterial({ color: MARKER_COLOR })
  );
  marker.position.set(goalPosition.x, points[points.length - 1].y + MARKER_SIZE / 2, goalPosition.z); // resting on the path
  group.add(marker);

  scene.add(group);
  return group;
}

function createChevronGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.35);
  shape.lineTo(-0.25, -0.2);
  shape.lineTo(0.25, -0.2);
  shape.lineTo(0, 0.35);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function createStripeTexture() {
  const width = 64;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const bandHeight = height / STRIPE_COLORS.length;
  for (let i = 0; i < STRIPE_COLORS.length; i++) {
    ctx.fillStyle = STRIPE_COLORS[i];
    ctx.fillRect(0, i * bandHeight, width, bandHeight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// True if (x, z) is over the path: within the half-width of the nearest point on
// the centre polyline, with the half-width interpolated along each segment.
export function isOnPath(x, z) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;

    // How far along the segment that nearest point is, clamped to the segment (0 to 1).
    let t = 0;
    if (lenSq > 0) t = ((x - a.x) * dx + (z - a.z) * dz) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;

    const nearestX = a.x + dx * t;
    const nearestZ = a.z + dz * t;
    const halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * t;

    if (Math.hypot(x - nearestX, z - nearestZ) < halfWidth) return true;
  }
  return false;
}

// Height of the path centre line at the nearest horizontal point to (x, z).
export function getPathHeight(x, z) {
  let bestIndex = 0;
  let bestDistSq = Infinity;
  let bestT = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;

    let t = 0;
    if (lenSq > 0) t = ((x - a.x) * dx + (z - a.z) * dz) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;

    const nearestX = a.x + dx * t;
    const nearestZ = a.z + dz * t;
    const distSq = (x - nearestX) ** 2 + (z - nearestZ) ** 2;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
      bestT = t;
    }
  }

  const a = points[bestIndex];
  const b = points[bestIndex + 1];
  return a.y + (b.y - a.y) * bestT;
}

// Unit tangent of the nearest segment in the X/Z plane, plus slope (rise / horizontal run).
export function getPathTangentAndSlope(x, z) {
  let bestIndex = 0;
  let bestDistSq = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;

    let t = 0;
    if (lenSq > 0) t = ((x - a.x) * dx + (z - a.z) * dz) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;

    const nearestX = a.x + dx * t;
    const nearestZ = a.z + dz * t;
    const distSq = (x - nearestX) ** 2 + (z - nearestZ) ** 2;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }

  const a = points[bestIndex];
  const b = points[bestIndex + 1];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const horizontalLength = Math.hypot(dx, dz);
  if (horizontalLength === 0) return { tx: 0, tz: -1, slope: 0 };

  const tx = dx / horizontalLength;
  const tz = dz / horizontalLength;
  const slope = (b.y - a.y) / horizontalLength;
  return { tx, tz, slope };
}
