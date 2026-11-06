// Jambi's head: a heavy, slippery sphere you steer by momentum, with an upright face that leans as it rolls.

import * as THREE from 'three';
import * as tuning from './tuning.js';
import { getPathHeight, getPathTangentAndSlope } from './path.js';

// --- The face panel ---
const FACE_DEPTH = 0.2; // thickness of the face plate, as a fraction of the radius

// The most the face is ever allowed to lean (radians, about 29 degrees).
// Well under 45, so a hard stop can never tip it over or roll it round.
const MAX_LEAN = 0.5;

// The face starts looking down the path (-Z), which is where the run begins.
const START_YAW = Math.PI;

// How hard the void pulls once the head is off the path.
const FALL_GRAVITY = tuning.rules.gravity;

// Long frames are split into steps this long, so the face spring can't blow up.
const MAX_STEP = 1 / 60;

export function createHead(scene) {
  const radius = tuning.head.radius;

  const group = new THREE.Group();

  // The head itself: a clear shell so the face and turban inside are visible. The roll is
  // read from the drifting movement, not from marks on the sphere.
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.25,
      roughness: 0.05,
      metalness: 0.1,
    })
  );
  group.add(sphere);

  // The face is a sibling of the sphere, never its child, so it can never
  // inherit a spin: we set its rotation ourselves, every frame.
  // It sits at the centre of the sphere, suspended like a head in oil.
  const depth = radius * FACE_DEPTH;
  const faceW = radius * tuning.head.faceWidth;
  const faceH = radius * tuning.head.faceHeight;
  const faceTexture = createFaceTexture(false);
  const scaredTexture = createFaceTexture(true);
  const faceMaterial = new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.8 });
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(faceW, faceH, depth),
    faceMaterial
  );
  face.position.z = 0; // centred in the clear sphere
  face.rotation.order = 'YXZ'; // lean first, about the travel direction, then yaw
  group.add(face);

  // Turban and earrings are siblings of the sphere so they do not spin with the face.
  group.add(createTurban(radius));

  const earringGeo = new THREE.SphereGeometry(radius * 0.08, 12, 10);
  const earringMat = new THREE.MeshStandardMaterial({
    color: '#ffd700',
    metalness: 0.6,
    roughness: 0.25,
  });
  const leftEarring = new THREE.Mesh(earringGeo, earringMat);
  leftEarring.position.set(-radius * 0.92, -radius * 0.15, -radius * 0.05);
  group.add(leftEarring);
  const rightEarring = new THREE.Mesh(earringGeo, earringMat);
  rightEarring.position.set(radius * 0.92, -radius * 0.15, -radius * 0.05);
  group.add(rightEarring);

  scene.add(group);

  // --- State ---
  let velX = 0, velZ = 0, velY = 0; // world units per second
  let lean = 0, leanVel = 0;        // the face's tilt, and how fast that tilt is changing
  let yaw = START_YAW;
  let scaredTimer = 0;              // how long the scared face stays on

  // Trail droplets: independent scene objects that fade out behind the head.
  const trail = [];
  let trailAccumulator = 0;
  const trailGeo = new THREE.SphereGeometry(tuning.head.trailSize, 8, 6);

  const api = {
    group,
    isFalling: false,
    onShove: null, // main.js sets this to hook camera shake + scare
    update,
    reset,
    startFalling,
    shove,
    scare,
  };

  // Back to the start line: on the ground, still, face upright and looking ahead.
  function reset(startX, startZ) {
    const startY = getPathHeight(startX, startZ);
    group.position.set(startX, startY + radius, startZ);
    velX = velZ = velY = 0;
    lean = leanVel = 0;
    yaw = START_YAW;
    face.rotation.set(0, yaw, 0);
    api.isFalling = false;
    scaredTimer = 0;
    setNeutralFace();
    clearTrail();
  }

  function startFalling() {
    if (api.isFalling) return;
    api.isFalling = true;
    velY = 0;
  }

  function shove(dx, dz) {
    if (api.isFalling) return;
    velX += dx;
    velZ += dz;
    const speed = Math.hypot(velX, velZ);
    const max = tuning.head.maxSpeed;
    if (speed > max) {
      const scale = max / speed;
      velX *= scale;
      velZ *= scale;
    }
    if (api.onShove) api.onShove();
  }

  function update(dt, moveX, moveZ) {
    if (!(dt > 0)) return;

    // The scared face counts down in real frame time, not sub-steps.
    if (scaredTimer > 0) {
      scaredTimer -= dt;
      if (scaredTimer <= 0) setNeutralFace();
    }

    const steps = Math.min(8, Math.max(1, Math.ceil(dt / MAX_STEP)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) step(h, moveX, moveZ);

    updateTrail(dt);
  }

  function step(dt, moveX, moveZ) {
    if (api.isFalling) {
      // The head keeps its horizontal momentum and sails forward while falling.
      group.position.x += velX * dt;
      group.position.z += velZ * dt;

      // Gravity only. Input no longer steers.
      velY -= FALL_GRAVITY * dt;
      group.position.y += velY * dt;
    } else {
      // Snap to the path surface so slope is read from where we are.
      const pathHeight = getPathHeight(group.position.x, group.position.z);
      group.position.y = pathHeight + radius;

      // Gravity along the slope: downhill (negative slope forward) speeds up,
      // uphill slows down. Applied before input so the terrain owns the baseline.
      const { tx, tz, slope } = getPathTangentAndSlope(group.position.x, group.position.z);
      velX += -slope * tuning.rules.slopeGravity * tx * dt;
      velZ += -slope * tuning.rules.slopeGravity * tz * dt;

      // Input is acceleration, never position: the head has to be told to slow
      // down, which is the whole slippery feel.
      velX += clamp(moveX, -1, 1) * tuning.head.accel * dt;
      velZ += clamp(moveZ, -1, 1) * tuning.head.accel * dt;

      // Drag, applied as an exact decay so the feel doesn't change with frame rate.
      const keep = Math.exp(-tuning.head.drag * dt);
      velX *= keep;
      velZ *= keep;

      // Cap the speed.
      const speed = Math.hypot(velX, velZ);
      const max = tuning.head.maxSpeed;
      if (speed > max) {
        const scale = max / speed;
        velX *= scale;
        velZ *= scale;
      }

      group.position.x += velX * dt;
      group.position.z += velZ * dt;
      // Height is set from the path at the start of the frame.
    }

    updateFace(dt);
  }

  function scare() {
    scaredTimer = tuning.head.scaredDuration;
    faceMaterial.map = scaredTexture;
    faceMaterial.needsUpdate = true;
  }

  function setNeutralFace() {
    faceMaterial.map = faceTexture;
    faceMaterial.needsUpdate = true;
  }

  function updateTrail(dt) {
    // Spawn a droplet when moving quickly on the path.
    const speed = Math.hypot(velX, velZ);
    if (!api.isFalling && speed > 1) {
      trailAccumulator += dt;
      while (trailAccumulator >= tuning.head.trailInterval) {
        trailAccumulator -= tuning.head.trailInterval;
        spawnTrailDroplet();
      }
    } else {
      // Don't let a long stall dump a burst of droplets later.
      trailAccumulator = 0;
    }

    // Age out existing droplets.
    for (let i = trail.length - 1; i >= 0; i--) {
      const drop = trail[i];
      drop.life -= dt;
      if (drop.life <= 0) {
        scene.remove(drop.mesh);
        trail.splice(i, 1);
      } else {
        const t = drop.life / drop.maxLife;
        drop.mesh.scale.setScalar(t);
        drop.mesh.material.opacity = t * tuning.head.trailOpacity;
      }
    }
  }

  function spawnTrailDroplet() {
    const material = new THREE.MeshBasicMaterial({
      color: tuning.head.trailColor,
      transparent: true,
      opacity: tuning.head.trailOpacity,
    });
    const mesh = new THREE.Mesh(trailGeo, material);
    mesh.position.copy(group.position);
    mesh.position.y -= radius * 0.4; // slightly below the sphere centre
    scene.add(mesh);
    trail.push({ mesh, life: tuning.head.trailLife, maxLife: tuning.head.trailLife });
  }

  function clearTrail() {
    for (const drop of trail) scene.remove(drop.mesh);
    trail.length = 0;
    trailAccumulator = 0;
  }

  function updateFace(dt) {
    const speed = Math.hypot(velX, velZ);

    // Turn the face the way the head is travelling, easing in. Ignore it when
    // it has all but stopped, so a slow drift can't swing the face about.
    if (speed > 0.05) {
      const heading = Math.atan2(velX, velZ); // the face's forward is its local +Z
      yaw += shortestAngle(yaw, heading) * (1 - Math.exp(-tuning.head.faceDamping * dt));
    }

    // The lean follows how fast the head is going the way the face points, so
    // sliding sideways doesn't tilt it. At full speed it leans right back.
    const forward = velX * Math.sin(yaw) + velZ * Math.cos(yaw);
    const target = tuning.head.faceWobble * clamp(forward / tuning.head.maxSpeed, -1, 1);

    // A damped spring: speed up towards the target, and brake on the way.
    // Critical damping, so it leans back on a push and settles without wobbling.
    const stiffness = tuning.head.faceDamping * tuning.head.faceDamping;
    const brake = 2 * tuning.head.faceDamping;
    leanVel += (stiffness * (target - lean) - brake * leanVel) * dt;
    lean += leanVel * dt;

    // Whatever the spring does, it never tips over, and it always comes back up.
    if (lean > MAX_LEAN) {
      lean = MAX_LEAN;
      leanVel = 0;
    } else if (lean < -MAX_LEAN) {
      lean = -MAX_LEAN;
      leanVel = 0;
    }

    // Base tilt angles the face up toward the camera; the lean adds more tilt
    // when the head accelerates.
    face.rotation.set(-lean + tuning.head.faceTilt, yaw, 0);
  }

  reset(0, 0);
  return api;
}

// Signed angle from a to b, wrapped to [-PI, PI], so the face takes the short way round.
function shortestAngle(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

// Build a cartoon Jambi face texture so you can read which way the head is
// facing and which way it leans. `scared` widens the eyes and opens the mouth.
function createFaceTexture(scared = false) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Green Jambi skin with rounded corners.
  ctx.fillStyle = '#6dae48';
  roundRect(ctx, 0, 0, size, size, size * 0.18);
  ctx.fill();

  // Expressive eyes, high on the face.
  const eyeY = size * 0.38;
  const eyeW = scared ? size * 0.22 : size * 0.18;
  const eyeH = scared ? size * 0.28 : size * 0.22;
  drawEye(ctx, size * 0.32, eyeY, eyeW, eyeH);
  drawEye(ctx, size * 0.68, eyeY, eyeW, eyeH);

  // Eyebrows.
  ctx.lineWidth = size * 0.04;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2e5a16';
  ctx.beginPath();
  ctx.arc(size * 0.32, eyeY - size * 0.18, size * 0.14, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.68, eyeY - size * 0.18, size * 0.14, 0.2, Math.PI - 0.2);
  ctx.stroke();

  if (scared) {
    // Open oval mouth for the scared face.
    ctx.fillStyle = '#3a1f1f';
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.72, size * 0.16, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // A small dark smile beneath the eyes.
    ctx.lineWidth = size * 0.045;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a1f1f';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.68, size * 0.18, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTurban(radius) {
  const turban = new THREE.Group();

  const magenta = new THREE.MeshStandardMaterial({ color: '#ff2a6d', roughness: 0.9 });
  const purple = new THREE.MeshStandardMaterial({ color: '#9d4edd', roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({
    color: '#ffd700',
    metalness: 0.6,
    roughness: 0.25,
  });

  const band1 = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.88, radius * 0.18, 12, 32),
    magenta
  );
  band1.rotation.x = Math.PI / 2;
  band1.position.y = radius * 0.12;
  turban.add(band1);

  const band2 = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.8, radius * 0.14, 12, 32),
    purple
  );
  band2.rotation.x = Math.PI / 2;
  band2.position.y = radius * 0.3;
  turban.add(band2);

  const band3 = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.66, radius * 0.11, 12, 32),
    magenta
  );
  band3.rotation.x = Math.PI / 2;
  band3.position.y = radius * 0.46;
  turban.add(band3);

  const jewel = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.12, 16, 12),
    gold
  );
  jewel.position.set(0, radius * 0.22, -radius * 0.82);
  turban.add(jewel);

  return turban;
}

function drawEye(ctx, x, y, w, h) {
  // Sclera.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupil.
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.05, w * 0.22, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + w * 0.08, y - h * 0.12, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
