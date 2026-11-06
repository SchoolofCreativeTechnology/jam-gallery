// Toy cars that drive across the path and shove Jambi's head.
import * as THREE from 'three';
import * as tuning from './tuning.js';
import { getPathHeight } from './path.js';

let scene;
const cars = [];
const warnings = [];
let spawnTimer = 0;
let totalTime = 0;

const carGeometry = new THREE.BoxGeometry(tuning.cars.length, tuning.cars.width, tuning.cars.width);
const carMaterial = new THREE.MeshStandardMaterial({ color: tuning.cars.colour });

const warningGeometry = new THREE.BoxGeometry(0.35, 0.08, 0.35);
const warningMaterial = new THREE.MeshStandardMaterial({
  color: tuning.cars.warningColor,
  emissive: tuning.cars.warningColor,
  emissiveIntensity: 0.6,
});

export function initCars(newScene) {
  scene = newScene;
}

export function resetCars() {
  for (const car of cars) {
    scene.remove(car.mesh);
  }
  cars.length = 0;
  for (const warning of warnings) {
    scene.remove(warning.mesh);
  }
  warnings.length = 0;
  spawnTimer = 0;
  totalTime = 0;
}

export function updateCars(dt, head, runTime) {
  if (!(dt > 0)) return;
  totalTime += dt;

  const difficulty = Math.min(tuning.cars.maxDifficulty, 1 + runTime * tuning.cars.difficultyRamp);
  const effectiveSpeed = tuning.cars.speed * difficulty;
  const effectiveSpawnGap = Math.max(tuning.cars.minSpawnGap, tuning.cars.spawnGap / difficulty);

  // Spawn a new car every spawnGap seconds, but only while the player is alive.
  spawnTimer += dt;
  while (spawnTimer >= effectiveSpawnGap) {
    spawnTimer -= effectiveSpawnGap;
    if (!head.isFalling) {
      queueCar(head, effectiveSpeed);
    }
  }

  // Promote warnings whose time has come into real cars.
  for (let i = warnings.length - 1; i >= 0; i--) {
    const warning = warnings[i];
    warning.mesh.scale.setScalar(1 + Math.sin(totalTime * 12) * 0.25);
    if (totalTime >= warning.spawnAt) {
      scene.remove(warning.mesh);
      spawnCarFromWarning(warning);
      warnings.splice(i, 1);
    }
  }

  const headRadius = tuning.head.radius;
  const carRadius = tuning.cars.radius;

  for (let i = cars.length - 1; i >= 0; i--) {
    const car = cars[i];
    car.mesh.position.x += car.velX * dt;
    car.mesh.position.z += car.velZ * dt;
    car.mesh.position.y = getPathHeight(car.mesh.position.x, car.mesh.position.z) + tuning.cars.width * 0.5;

    // Collision: treat head and car as circles in the X/Z plane.
    const dx = head.group.position.x - car.mesh.position.x;
    const dz = head.group.position.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (!car.hasHit && !head.isFalling && dist < headRadius + carRadius) {
      head.shove(car.velX * tuning.cars.shoveForce, car.velZ * tuning.cars.shoveForce);
      car.hasHit = true;
    }

    // Despawn once the car has crossed the path by at least its own length past the far edge.
    const travelled = Math.abs(
      (car.mesh.position.x - car.startX) * car.perpX +
      (car.mesh.position.z - car.startZ) * car.perpZ
    );
    if (travelled > car.crossDistance + tuning.cars.length) {
      scene.remove(car.mesh);
      cars.splice(i, 1);
    }
  }
}

// Find the point on the path centre line that is `distance` units ahead of (x, z).
function pointAheadOnPath(x, z, distance) {
  const points = tuning.path.points;
  if (points.length < 2) {
    return { x, z, segmentIndex: 0, t: 0, perpX: -1, perpZ: 0, hw: 0 };
  }

  // First find the nearest segment and the t along that segment.
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

  // Walk forward along the path by `distance` units.
  let segmentIndex = bestIndex;
  let t = bestT;
  let remaining = distance;

  while (segmentIndex < points.length - 1 && remaining > 0) {
    const a = points[segmentIndex];
    const b = points[segmentIndex + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segLen = Math.hypot(dx, dz);
    if (segLen === 0) break;

    const remainingInSegment = (1 - t) * segLen;
    if (remaining <= remainingInSegment) {
      t += remaining / segLen;
      remaining = 0;
    } else {
      remaining -= remainingInSegment;
      segmentIndex += 1;
      t = 0;
    }
  }

  // Clamp to the final point if we ran off the end.
  if (segmentIndex >= points.length - 1) {
    segmentIndex = points.length - 2;
    t = 1;
  }

  const a = points[segmentIndex];
  const b = points[segmentIndex + 1];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const segLen = Math.hypot(dx, dz);

  let perpX = -1;
  let perpZ = 0;
  let hw = a.halfWidth;

  if (segLen > 0) {
    const dirX = dx / segLen;
    const dirZ = dz / segLen;
    perpX = -dirZ;
    perpZ = dirX;
    hw = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
  }

  const cx = a.x + dx * t;
  const cz = a.z + dz * t;

  return { x: cx, z: cz, segmentIndex, t, perpX, perpZ, hw };
}

function queueCar(head, effectiveSpeed) {
  const distance = tuning.cars.lookaheadMin +
    Math.random() * (tuning.cars.lookaheadMax - tuning.cars.lookaheadMin);
  const point = pointAheadOnPath(
    head.group.position.x,
    head.group.position.z,
    distance,
  );
  spawnWarning(point, effectiveSpeed);
}

function spawnWarning(point, effectiveSpeed) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const startX = point.x + point.perpX * point.hw * side;
  const startZ = point.z + point.perpZ * point.hw * side;
  const velX = -point.perpX * effectiveSpeed * side;
  const velZ = -point.perpZ * effectiveSpeed * side;

  const mesh = new THREE.Mesh(warningGeometry, warningMaterial);
  const pathHeight = getPathHeight(startX, startZ);
  mesh.position.set(startX, pathHeight + 0.06, startZ);
  scene.add(mesh);

  warnings.push({
    mesh,
    spawnAt: totalTime + tuning.cars.warningTime,
    segmentIndex: point.segmentIndex,
    t: point.t,
    side,
    perpX: point.perpX * side,
    perpZ: point.perpZ * side,
    hw: point.hw,
    startX,
    startZ,
    velX,
    velZ,
  });
}

function spawnCarFromWarning(warning) {
  const mesh = new THREE.Mesh(carGeometry, carMaterial);
  mesh.rotation.y = Math.atan2(warning.velX, warning.velZ);
  const pathHeight = getPathHeight(warning.startX, warning.startZ);
  mesh.position.set(warning.startX, pathHeight + tuning.cars.width * 0.5, warning.startZ);
  scene.add(mesh);

  cars.push({
    mesh,
    velX: warning.velX,
    velZ: warning.velZ,
    startX: warning.startX,
    startZ: warning.startZ,
    perpX: warning.perpX,
    perpZ: warning.perpZ,
    crossDistance: warning.hw * 2,
    hasHit: false,
  });
}
