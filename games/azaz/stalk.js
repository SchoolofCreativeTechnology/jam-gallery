// stalk.js — two open-U leaf stalks hooked through each other in 3D, bends driven by a 0..1 tension value.
// M4: replaced the sprawling Tripo mesh with clean tubes so the two dueling stalks read instantly.
import * as THREE from 'three';

// Shape numbers. M1 keeps them here; the M3 tuning pass moves them into tuning.js (see BUILD-PLAN tasks).
const ARC_RADIUS = 0.55;       // bend radius of a relaxed open U
const LEG_LENGTH = 0.9;        // how far each held end runs past its bend
const TUBE_RADIUS = 0.034;     // stalk thickness — thin and flexible, never a branch
const HOOK_GAP = 1.5;          // distance between the two bends, measured in bend radii
const ARC_SAMPLES = 12;        // samples across the bend
const LEG_SAMPLES = 4;         // samples along each held end
const TUBE_SEGMENTS = 90;      // tube resolution along the stalk
const TUBE_RADIAL = 10;        // tube resolution around the stalk
const REBUILD_EPSILON = 0.01;  // smallest tension change worth rebuilding geometry for
const ROTATION_Y = -0.62;      // turn the pair so both bends read as hooked in 3D, not just crossed

const PLAYER_COLOR = '#b52b2b'; // deep red stalk
const RIVAL_COLOR = '#dbe8e8';  // pale white-blue stalk
const RIVAL_EMISSIVE = '#1dd4c6'; // faint cyan glow, like the reference vine

// Relaxed pose is a deep, round open U. Pulled pose opens the bend out (half-wrap 90deg -> 62deg),
// stretches its radius, and drags the two held ends apart — the stalk visibly straightens and goes taut.
// Both bends keep their grip the whole way: each one's far bend stays inside the other one's opening,
// because the bends deepen less than the two hooks press towards each other.
const RELAXED = { halfWrap: Math.PI / 2, radius: 1, depth: 1, leg: 1 };
const TAUT = { halfWrap: (62 * Math.PI) / 180, radius: 1.45, depth: 0.95, leg: 1.35 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k); // a pull with weight at both ends

// Each stalk is built flat in its own frame (u = pull axis, v = spread between its two held ends),
// then placed in the world. Player lies in the XY plane, rival in the XZ plane: perpendicular planes,
// each bend pushed through the other's opening.
const FRAMES = {
  player: {
    origin: new THREE.Vector3(0, 0, 0),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 1, 0),
  },
  rival: {
    origin: new THREE.Vector3(-HOOK_GAP * ARC_RADIUS, 0, 0),
    u: new THREE.Vector3(-1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
  },
};

// Points for one stalk: far held end -> down the leg -> around the open bend -> back out the other leg.
function stalkPoints(tension) {
  const k = ease(clamp01(tension));
  const halfWrap = lerp(RELAXED.halfWrap, TAUT.halfWrap, k);
  const radius = ARC_RADIUS * lerp(RELAXED.radius, TAUT.radius, k);
  const depth = ARC_RADIUS * lerp(RELAXED.depth, TAUT.depth, k);
  const leg = LEG_LENGTH * lerp(RELAXED.leg, TAUT.leg, k);
  const bendCentre = radius - depth;                        // u of the bend's centre of curvature
  const mouth = bendCentre - radius * Math.cos(halfWrap);   // u where the bend hands over to a leg
  const spread = radius * Math.sin(halfWrap);               // half the gap between the two held ends

  const points = [];
  for (let i = LEG_SAMPLES; i > 0; i--) {
    points.push(new THREE.Vector3(mouth + (leg * i) / LEG_SAMPLES, -spread, 0));
  }
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const a = -halfWrap + (2 * halfWrap * i) / ARC_SAMPLES;
    points.push(new THREE.Vector3(bendCentre - radius * Math.cos(a), radius * Math.sin(a), 0));
  }
  for (let i = 1; i <= LEG_SAMPLES; i++) {
    points.push(new THREE.Vector3(mouth + (leg * i) / LEG_SAMPLES, spread, 0));
  }
  return points;
}

// A tube along a curve that passes through the bend and both legs. Open at both ends — a U, not a ring.
function stalkCurve(frame, tension) {
  const points = stalkPoints(tension).map((p) =>
    new THREE.Vector3()
      .copy(frame.origin)
      .addScaledVector(frame.u, p.x)
      .addScaledVector(frame.v, p.y)
  );
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

function stalkGeometry(frame, tension) {
  const curve = stalkCurve(frame, tension);
  return new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, TUBE_RADIAL, false);
}

function stalkMaterial(color, name, emissive) {
  // Matte sculptural look; the rival gets a faint emissive wash so it reads as the glowing vine.
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0,
    emissive: emissive || '#000000',
    emissiveIntensity: emissive ? 0.35 : 0,
    name,
  });
}

export function createPair(scene) {
  const group = new THREE.Group();
  group.name = 'stalk-pair';
  group.rotation.y = ROTATION_Y;

  // Keep the interlock (not the long held ends) near the centre of the view.
  const centre = new THREE.Vector3(-(HOOK_GAP * ARC_RADIUS) / 2, 0, 0);
  centre.applyAxisAngle(new THREE.Vector3(0, 1, 0), ROTATION_Y);
  group.position.copy(centre).multiplyScalar(-1);

  const player = new THREE.Mesh(stalkGeometry(FRAMES.player, 0), stalkMaterial(PLAYER_COLOR, 'player-stalk'));
  const rival = new THREE.Mesh(stalkGeometry(FRAMES.rival, 0), stalkMaterial(RIVAL_COLOR, 'rival-stalk', RIVAL_EMISSIVE));
  player.name = 'player-stalk';
  rival.name = 'rival-stalk';
  group.add(player, rival);
  if (scene) scene.add(group);

  let tension = 0;
  let built = 0;

  // 0 = relaxed interlocked pose, 1 = pulled taut pose. Values outside 0..1 are clamped.
  function setTension(next) {
    tension = clamp01(Number(next) || 0);
    if (Math.abs(tension - built) < REBUILD_EPSILON) return;
    built = tension;
    player.geometry.dispose();
    player.geometry = stalkGeometry(FRAMES.player, tension);
    rival.geometry.dispose();
    rival.geometry = stalkGeometry(FRAMES.rival, tension);
  }

  setTension(0);

  return {
    group,
    player,
    rival,
    setTension,
    getTension: () => tension,
  };
}

export default createPair; // so either `import { createPair }` or a default import works in main.js
