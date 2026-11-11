// The secret boss: Djinormous, a giant genie head on a golden platter that he tips to throw
// you off. Ram him hard enough, often enough, and he's done. Also the swirling portal at the far
// end of course 1 that takes you there once every course is beaten.
//
// The arena lives in its own group. main.js hides the course while you're here and shows it again
// after. This module moves the ball itself (the platter is not a course) and tells main.js what
// happened each frame through the events it returns.
import * as THREE from 'three';
import * as tuning from './tuning.js';

const B = tuning.boss;
const r = tuning.head.radius;
const PLATTER_THICK = 0.55;
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (pair, f) => lerp(pair[0], pair[1], f);

let root, platter, bossRoot, bossBody, pivot, inner, faceMat, eyeGlow, telegraph, slamRing, beamMat, motes;
const faces = {};
let spot, rimSpot;

// ---- Fight state ----
const ball = { x: 0, z: 6, y: r, vx: 0, vz: 0, vy: 0, falling: false };
const G = new THREE.Vector2();      // platter slope: height = G.x * x + G.y * z
const Gv = new THREE.Vector2();
const Gt = new THREE.Vector2();     // where he wants the slope
let hp = B.health;
let mode = 'intro';                 // intro, sway, windup, lunge, recoil, slamUp, slamDown, defeat, gone
let modeT = 0;
let clock = 0;
let nextAttack = 3;
let invuln = 0;
let hurtT = 0;
let aim = new THREE.Vector2(0, 1);
let attackCount = 0;
let slamR = -1;
let defeatT = 0;
let yaw = 0;
let lift = 0;
let face = '';

export function createBoss(scene) {
  root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ---- The spotlight, its visible beam, and specks of dust hanging in it ----
  spot = new THREE.SpotLight('#fff1d6', 900, 60, 0.46, 0.55, 1.6);
  spot.position.set(0, 26, 3);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  spot.shadow.camera.near = 8;
  spot.shadow.camera.far = 50;
  root.add(spot, spot.target);
  rimSpot = new THREE.SpotLight('#ff3060', 260, 50, 0.5, 0.7, 1.5);
  rimSpot.position.set(0, 14, -22);
  rimSpot.target.position.set(0, 2.5, 0);
  root.add(rimSpot, rimSpot.target);

  beamMat = new THREE.MeshBasicMaterial({ color: '#fff0d0', transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 10.4, 26, 48, 1, true), beamMat);
  beam.position.set(0, 13, 1.5);
  root.add(beam);

  const moteGeo = new THREE.BufferGeometry();
  const mp = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 9, y = Math.random() * 22;
    mp[i * 3] = Math.cos(a) * d * (0.2 + y / 26);
    mp[i * 3 + 1] = y + 1;
    mp[i * 3 + 2] = Math.sin(a) * d * (0.2 + y / 26);
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: '#ffe9c0', size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(motes);

  // ---- The platter on its stand ----
  platter = new THREE.Group();
  root.add(platter);
  const gold = new THREE.MeshStandardMaterial({ color: '#e8b830', metalness: 0.9, roughness: 0.28 });
  const darkGold = new THREE.MeshStandardMaterial({ color: '#8a6514', metalness: 0.85, roughness: 0.4 });
  const R = B.platterRadius;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.15, R * 0.86, PLATTER_THICK, 96), [gold, gold, darkGold]);
  dish.position.y = -PLATTER_THICK / 2 - 0.02;
  dish.receiveShadow = true;
  dish.castShadow = true;
  platter.add(dish);
  const topTex = platterTexture();
  const top = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.55, metalness: 0.25 }));
  top.rotation.x = -Math.PI / 2;
  top.receiveShadow = true;
  platter.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.08, 0.13, 10, 120), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  platter.add(rim);
  // Pedestal under the middle where he sits.
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(B.headRadius * 0.8, B.headRadius * 0.95, 0.35, 48), gold);
  dais.position.y = 0.17;
  dais.castShadow = dais.receiveShadow = true;
  platter.add(dais);

  // Stand: a stem dropping away into the dark (not tilted).
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 30, 32), darkGold);
  stem.position.y = -15.6;
  root.add(stem);
  const collar = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 12), gold);
  collar.position.y = -1.0;
  root.add(collar);

  // A red arc on the side that's about to drop, as warning.
  telegraph = new THREE.Mesh(
    new THREE.RingGeometry(R - 1.4, R - 0.1, 48, 1, -0.7, 1.4),
    new THREE.MeshBasicMaterial({ color: '#ff1e3c', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  telegraph.rotation.x = -Math.PI / 2;
  telegraph.position.y = 0.04;
  platter.add(telegraph);

  // The slam's shockwave ring.
  slamRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 64),
    new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  slamRing.rotation.x = -Math.PI / 2;
  slamRing.position.y = 0.08;
  platter.add(slamRing);

  // ---- Djinormous ----
  for (const k of ['angry', 'windup', 'hurt', 'tired', 'laugh']) faces[k] = bossFace(k);
  bossRoot = new THREE.Group();
  platter.add(bossRoot);
  bossBody = new THREE.Group();
  bossRoot.add(bossBody);
  // He tips about the middle of his head, so his face stays where you hit him.
  pivot = new THREE.Group();
  pivot.position.y = B.headRadius * 1.25;
  bossBody.add(pivot);
  inner = new THREE.Group();
  inner.position.y = -B.headRadius * 1.25;
  pivot.add(inner);
  buildBoss(inner, bossBody);

  eyeGlow = new THREE.PointLight('#ff2040', 0, 9, 1.5);
  eyeGlow.position.set(0, B.headRadius * 1.1, B.headRadius * 1.2);
  inner.add(eyeGlow);
  return root;
}

function buildBoss(g, base) {
  const hr = B.headRadius;
  // A swirl of smoke under him, as if he's coming out of a lamp.
  const smokeMat = new THREE.MeshStandardMaterial({ color: '#5b2a7a', transparent: true, opacity: 0.55, roughness: 1, emissive: '#2a0d3d', emissiveIntensity: 0.6, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(hr * (0.75 - i * 0.12), hr * 0.16, 10, 32), smokeMat);
    s.rotation.x = Math.PI / 2;
    s.position.y = 0.35 + i * 0.32;
    s.userData.smoke = i;
    base.add(s);
  }
  faceMat = new THREE.MeshStandardMaterial({ map: faces.angry, roughness: 0.55, emissive: '#ffffff', emissiveIntensity: 0, emissiveMap: faces.angry });
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(hr, 48, 32), faceMat);
  headMesh.scale.set(1.05, 1.12, 1);
  headMesh.position.y = hr * 1.25;
  headMesh.castShadow = true;
  g.add(headMesh);

  const skin = new THREE.MeshStandardMaterial({ color: '#a8243e', roughness: 0.6 });
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.26, 14, 10), skin);
    ear.scale.set(0.45, 1.1, 0.8);
    ear.position.set(s * hr * 1.06, hr * 1.25, -hr * 0.05);
    g.add(ear);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(hr * 0.24, hr * 0.06, 10, 24), new THREE.MeshStandardMaterial({ color: '#ffd23d', metalness: 0.85, roughness: 0.2 }));
    hoop.position.set(s * hr * 1.1, hr * 0.82, 0);
    hoop.rotation.y = Math.PI / 2;
    g.add(hoop);
    // Little horns poking out of the turban.
    const horn = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.16, hr * 0.6, 12), new THREE.MeshStandardMaterial({ color: '#2a0d1a', roughness: 0.4, metalness: 0.3 }));
    horn.position.set(s * hr * 0.72, hr * 2.25, hr * 0.15);
    horn.rotation.z = -s * 0.55;
    g.add(horn);
  }
  // Turban: black and gold, much grander than Jambi's.
  const black = new THREE.MeshStandardMaterial({ color: '#1a0f24', roughness: 0.7 });
  const goldT = new THREE.MeshStandardMaterial({ color: '#ffcf3a', metalness: 0.8, roughness: 0.25 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), black);
  dome.position.y = hr * 1.62;
  dome.scale.set(1, 0.9, 1);
  g.add(dome);
  for (const [rad, y, mat] of [[1.04, 1.62, goldT], [0.92, 1.92, black], [0.7, 2.15, goldT]]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(hr * rad, hr * 0.19, 12, 40), mat);
    band.rotation.x = Math.PI / 2;
    band.position.y = hr * y;
    g.add(band);
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(hr * 0.3), new THREE.MeshStandardMaterial({ color: '#ff1e3c', emissive: '#ff1e3c', emissiveIntensity: 0.9, roughness: 0.1 }));
  gem.scale.set(0.8, 1.1, 0.5);
  gem.position.set(0, hr * 1.78, hr * 1.06);
  g.add(gem);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.12, hr * 1.1, 10), goldT);
  plume.position.set(0, hr * 2.6, hr * 0.3);
  plume.rotation.x = -0.4;
  g.add(plume);
}

// ---- Portal: the swirl just past the end of course 1 ----
let portal = null;
export function createPortal(scene) {
  portal = new THREE.Group();
  const tex = swirlTexture();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2;
  portal.add(disc);
  const disc2 = disc.clone();
  disc2.material = disc.material.clone();
  disc2.scale.setScalar(0.6);
  disc2.position.y = 0.05;
  portal.add(disc2);
  const light = new THREE.PointLight('#c04dff', 8, 9, 1.6);
  light.position.y = 1;
  portal.add(light);
  portal.visible = false;
  scene.add(portal);
  return portal;
}

export function placePortal(x, y, z, show) {
  portal.position.set(x, y, z);
  portal.visible = show;
}

export function updatePortal(time) {
  if (!portal || !portal.visible) return;
  portal.children[0].rotation.z = time * 1.4;
  portal.children[1].rotation.z = -time * 2.3;
  portal.children[2].intensity = 7 + Math.sin(time * 3) * 2;
}

// ---- Fight ----
export function bossRoot3D() {
  return root;
}

export function bossHP() {
  return hp;
}

export function ballState() {
  return ball;
}

export function startFight() {
  hp = B.health;
  mode = 'intro';
  modeT = 0;
  clock = 0;
  nextAttack = 3.2;
  invuln = 0;
  hurtT = 0;
  attackCount = 0;
  slamR = -1;
  defeatT = 0;
  lift = -6;
  yaw = 0;
  G.set(0, 0); Gv.set(0, 0); Gt.set(0, 0);
  Object.assign(ball, { x: 0, z: 6.2, y: r, vx: 0, vz: 0, vy: 0, falling: false });
  bossRoot.visible = true;
  bossRoot.scale.setScalar(1);
  telegraph.material.opacity = 0;
  slamRing.material.opacity = 0;
  setFace('laugh');
  updatePlatter(0);
}

// He laughs at you when you fall off.
export function taunt() {
  setFace('laugh');
}

function setFace(k) {
  if (face === k) return;
  face = k;
  faceMat.map = faces[k];
  faceMat.emissiveMap = faces[k];
  faceMat.needsUpdate = true;
}

function phase() {
  return Math.min(1, (B.health - hp) / Math.max(1, B.health - 1));
}

function heightAt(x, z) {
  return G.x * x + G.y * z;
}

// One frame of the fight. input: {x, z} from the player (zero once he's beaten).
// Returns events for main.js: hit, bump, fell, defeated, boom, telegraph, slam, roar, pop.
export function updateFight(dt, input, controls) {
  const ev = {};
  if (!(dt > 0)) return ev;
  clock += dt;
  modeT += dt;
  invuln = Math.max(0, invuln - dt);
  hurtT = Math.max(0, hurtT - dt);
  const f = phase();

  // ---- What he's doing ----
  const toBall = new THREE.Vector2(ball.x, ball.z);
  const dist = toBall.length() || 1;
  Gt.set(0, 0);
  if (mode === 'intro') {
    lift = Math.min(0, -6 + modeT * 5);
    if (lift === 0 && modeT - dt < 1.2 && modeT >= 1.2) ev.roar = true;
    if (modeT > 2.2) { mode = 'sway'; modeT = 0; setFace('angry'); }
  } else if (mode === 'sway') {
    const a = clock * pick(B.swaySpeed, f);
    const amp = controls ? pick(B.sway, f) : 0; // holds still until you make your first move
    Gt.set(Math.cos(a) * amp, Math.sin(a) * amp);
    if (controls) nextAttack -= dt;
    if (nextAttack <= 0) {
      attackCount++;
      const slam = f > 0.4 && attackCount % 2 === 0;
      mode = slam ? 'slamUp' : 'windup';
      modeT = 0;
      aim.copy(toBall).divideScalar(dist);
      setFace('windup');
      ev.telegraph = slam ? 'slam' : 'lunge';
    }
  } else if (mode === 'windup') {
    // Follow you while he winds up, then lock on.
    if (modeT < pick(B.windup, f) * 0.6) aim.lerp(toBall.clone().divideScalar(dist), 1 - Math.exp(-6 * dt)).normalize();
    Gt.set(-aim.x * 0.03, -aim.y * 0.03);
    G.x += (Math.random() - 0.5) * 0.004;
    G.y += (Math.random() - 0.5) * 0.004;
    if (modeT > pick(B.windup, f)) { mode = 'lunge'; modeT = 0; ev.lunge = true; }
  } else if (mode === 'lunge') {
    const amp = pick(B.lunge, f);
    // Downhill points out through your side: height drops toward you.
    Gt.set(-aim.x * amp, -aim.y * amp);
    if (modeT > B.lungeHold) { mode = 'recoil'; modeT = 0; setFace('tired'); }
  } else if (mode === 'recoil') {
    Gt.set(aim.x * B.recoil, aim.y * B.recoil);
    if (modeT > B.recoilTime) { mode = 'sway'; modeT = 0; nextAttack = pick(B.lungeEvery, f); setFace('angry'); }
  } else if (mode === 'slamUp') {
    lift = Math.min(2.4, modeT * 4);
    if (modeT > pick(B.windup, f)) { mode = 'slamDown'; modeT = 0; }
  } else if (mode === 'slamDown') {
    lift = Math.max(0, 2.4 - modeT * 18);
    if (lift === 0 && slamR < 0) {
      slamR = B.headRadius;
      ev.slam = true;
      G.x += (Math.random() - 0.5) * 0.08;
      G.y += (Math.random() - 0.5) * 0.08;
    }
    if (modeT > 0.9) { mode = 'recoil'; modeT = 0; aim.copy(toBall).divideScalar(dist); setFace('tired'); }
  } else if (mode === 'defeat') {
    defeatT += dt;
    if (defeatT - dt < 2.4 && defeatT >= 2.4) {
      ev.boom = true;
      bossRoot.visible = false;
      mode = 'gone';
    } else if (Math.floor(defeatT * 6) !== Math.floor((defeatT - dt) * 6)) {
      ev.pop = true;
    }
  }

  // The slam's ring sweeps outward; it shoves you as it passes.
  if (slamR >= 0) {
    const before = slamR;
    slamR += dt * 13;
    if (!ball.falling && dist > before && dist <= slamR) {
      ball.vx += (ball.x / dist) * B.slamPush;
      ball.vz += (ball.z / dist) * B.slamPush;
      ev.shoved = true;
    }
    if (slamR > B.platterRadius + 1) slamR = -1;
  }

  // ---- The platter follows, heavy and springy ----
  const k = B.tiltSpring;
  Gv.x += (k * k * (Gt.x - G.x) - 2 * k * 0.6 * Gv.x) * dt;
  Gv.y += (k * k * (Gt.y - G.y) - 2 * k * 0.6 * Gv.y) * dt;
  G.x += Gv.x * dt;
  G.y += Gv.y * dt;

  // ---- The ball ----
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) stepBall(h, controls ? input : { x: 0, z: 0 }, ev);

  // ---- Looks ----
  updatePlatter(dt);
  ev.fell = ev.fell || false;
  return ev;
}

function stepBall(dt, input, ev) {
  if (ball.falling) {
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    ball.vy -= tuning.rules.gravity * dt;
    ball.y += ball.vy * dt;
    return;
  }
  const hd = tuning.head;
  ball.vx += (input.x * hd.accel - G.x * tuning.rules.slopeGravity) * dt;
  ball.vz += (input.z * hd.accel - G.y * tuning.rules.slopeGravity) * dt;
  const keep = Math.exp(-hd.drag * dt);
  ball.vx *= keep;
  ball.vz *= keep;
  const sp = Math.hypot(ball.vx, ball.vz), max = hd.maxSpeed * 1.2;
  if (sp > max) { ball.vx *= max / sp; ball.vz *= max / sp; }
  ball.x += ball.vx * dt;
  ball.z += ball.vz * dt;

  // Bumping into him.
  const d = Math.hypot(ball.x, ball.z) || 0.001;
  const minD = B.headRadius + r;
  if (bossRoot.visible && mode !== 'gone' && d < minD && lift < r * 2) {
    const nx = ball.x / d, nz = ball.z / d;
    ball.x = nx * minD;
    ball.z = nz * minD;
    const inward = -(ball.vx * nx + ball.vz * nz);
    if (inward > 0) {
      const tx = ball.vx + nx * inward, tz = ball.vz + nz * inward; // the sideways part
      if (inward >= B.hitSpeed && invuln <= 0 && mode !== 'defeat') {
        hp--;
        invuln = B.invulnerable;
        hurtT = 0.8;
        ev.hit = { x: nx * B.headRadius, z: nz * B.headRadius, speed: inward, hp };
        ball.vx = nx * B.knockback + tx * 0.4;
        ball.vz = nz * B.knockback + tz * 0.4;
        setFace('hurt');
        if (hp <= 0) {
          mode = 'defeat';
          modeT = 0;
          defeatT = 0;
          ev.defeated = true;
        } else {
          // Furious: straight back to rocking, and soon.
          mode = 'sway';
          modeT = 0;
          nextAttack = 1.8;
          slamR = -1; // a hit breaks up his slam, so its shockwave never stacks on the knockback
          lift = 0;
        }
      } else {
        ball.vx = tx * 0.7 + nx * (inward * 0.5 + B.shrug);
        ball.vz = tz * 0.7 + nz * (inward * 0.5 + B.shrug);
        if (!ev.bump || inward > ev.bump) ev.bump = Math.max(1, inward);
      }
    }
  }

  // Over the edge.
  if (d > B.platterRadius + tuning.head.edgeGrace) {
    ball.falling = true;
    ball.vy = 1.5;
    ev.fell = true;
  }
  ball.y = heightAt(ball.x, ball.z) + r;
}

function updatePlatter(dt) {
  // Tilt the platter so its slope matches G: normal is (-Gx, 1, -Gz).
  const n = new THREE.Vector3(-G.x, 1, -G.y).normalize();
  platter.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);

  // Him: bob, face the ball, shake when hurt, swell when beaten.
  const toYaw = Math.atan2(ball.x, ball.z);
  let dy = toYaw - yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  yaw += dy * (1 - Math.exp(-(mode === 'windup' ? 8 : 3) * dt));
  bossRoot.rotation.y = yaw;
  const bob = mode === 'gone' ? 0 : Math.sin(clock * 2.2) * 0.12;
  bossRoot.position.set(0, 0.3 + lift + bob, 0);
  let shake = hurtT > 0 ? hurtT * 0.25 : 0;
  if (mode === 'windup') shake = 0.04;
  let scale = 1 + (hurtT > 0 ? Math.sin(hurtT * 40) * 0.04 : 0);
  if (mode === 'defeat') {
    shake = 0.1 + defeatT * 0.12;
    scale = 1 + defeatT * 0.22 + Math.sin(defeatT * 30) * 0.05;
    setFace(Math.floor(defeatT * 5) % 2 ? 'hurt' : 'tired');
  }
  bossBody.position.set((Math.random() - 0.5) * shake, 0, (Math.random() - 0.5) * shake);
  bossBody.scale.setScalar(scale);
  // Tipped back so his face looks up at the camera, not at the floor; slumps forward when winded.
  const pitch = mode === 'recoil' ? -0.25 + Math.sin(clock * 9) * 0.05 : -0.62;
  pivot.rotation.x += (pitch - pivot.rotation.x) * (1 - Math.exp(-6 * dt));
  if (hurtT <= 0 && face === 'hurt' && mode === 'sway') setFace('angry');
  faceMat.emissiveIntensity = mode === 'defeat' ? 0.3 + Math.abs(Math.sin(defeatT * 20)) * 0.6 : hurtT > 0.5 ? 0.9 : invuln > 0 && Math.floor(invuln * 14) % 2 ? 0.35 : 0;
  eyeGlow.intensity = mode === 'windup' || mode === 'slamUp' ? 14 + Math.sin(clock * 30) * 6 : mode === 'lunge' ? 10 : 0;
  for (const c of bossBody.children) if (c.userData.smoke !== undefined) c.rotation.z = clock * (1 + c.userData.smoke * 0.5) * (c.userData.smoke % 2 ? -1 : 1);

  // Warning arc on the side that's going to drop.
  const warn = mode === 'windup' ? 0.35 + Math.abs(Math.sin(modeT * 14)) * 0.55 : mode === 'lunge' ? Math.max(0, 0.5 - modeT * 0.5) : 0;
  telegraph.material.opacity = warn;
  telegraph.rotation.z = Math.atan2(-aim.y, aim.x);

  if (slamR >= 0) {
    slamRing.scale.setScalar(slamR);
    slamRing.material.opacity = Math.max(0, 1 - slamR / (B.platterRadius + 1)) * 0.9;
  } else slamRing.material.opacity = 0;

  motes.rotation.y = clock * 0.05;
  beamMat.opacity = 0.035 + Math.sin(clock * 0.7) * 0.008;
}

// Where the ball and his head are, for the camera and the effects.
export function bossCentre() {
  return new THREE.Vector3(0, 0.3 + lift + B.headRadius * 1.3, 0).applyQuaternion(platter.quaternion);
}

// ---- Textures ----
function platterTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const m = S / 2;
  const g = x.createRadialGradient(m, m, 40, m, m, m);
  g.addColorStop(0, '#3a1250');
  g.addColorStop(0.7, '#240a35');
  g.addColorStop(1, '#14061f');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  x.strokeStyle = '#d9a52a';
  x.lineWidth = 6;
  for (const rr of [0.26, 0.5, 0.74, 0.96]) {
    x.beginPath(); x.arc(m, m, m * rr, 0, Math.PI * 2); x.stroke();
  }
  // Mandala petals between the rings.
  x.lineWidth = 3;
  x.strokeStyle = 'rgba(232, 184, 48, 0.75)';
  for (const [rr, n] of [[0.38, 16], [0.62, 24], [0.85, 32]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.save();
      x.translate(m + Math.cos(a) * m * rr, m + Math.sin(a) * m * rr);
      x.rotate(a);
      x.beginPath();
      x.ellipse(0, 0, m * 0.1, m * 0.035, 0, 0, Math.PI * 2);
      x.stroke();
      x.restore();
    }
  }
  // Spokes so the tilt reads.
  x.strokeStyle = 'rgba(232, 184, 48, 0.35)';
  x.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    x.beginPath();
    x.moveTo(m + Math.cos(a) * m * 0.26, m + Math.sin(a) * m * 0.26);
    x.lineTo(m + Math.cos(a) * m * 0.96, m + Math.sin(a) * m * 0.96);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function swirlTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const m = S / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(210,120,255,0.9)');
  g.addColorStop(0.7, 'rgba(110,30,200,0.45)');
  g.addColorStop(1, 'rgba(60,0,120,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  x.lineWidth = 7;
  for (let arm = 0; arm < 4; arm++) {
    x.strokeStyle = arm % 2 ? 'rgba(255,120,220,0.8)' : 'rgba(120,230,255,0.75)';
    x.beginPath();
    for (let i = 0; i <= 60; i++) {
      const tt = i / 60;
      const a = arm * Math.PI / 2 + tt * Math.PI * 2.2;
      const rr = tt * m * 0.95;
      const px = m + Math.cos(a) * rr, py = m + Math.sin(a) * rr;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// His face, painted like Jambi's (front of the sphere at u = 0.25) but crimson and furious.
function bossFace(kind) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#a8243e';
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(256, 270, 20, 256, 270, 300);
  glow.addColorStop(0, 'rgba(255,120,120,0.45)');
  glow.addColorStop(1, 'rgba(255,120,120,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);
  const cx = 256, eyeY = 236, ink = '#1a0710';
  x.lineCap = x.lineJoin = 'round';

  // Brows: heavy and slanted in.
  x.strokeStyle = ink;
  x.lineWidth = 24;
  for (const s of [-1, 1]) {
    x.beginPath();
    if (kind === 'hurt' || kind === 'tired') {
      x.moveTo(cx + s * 26, eyeY - 70); x.lineTo(cx + s * 118, eyeY - 92);
    } else if (kind === 'laugh') {
      x.moveTo(cx + s * 26, eyeY - 74); x.quadraticCurveTo(cx + s * 70, eyeY - 104, cx + s * 120, eyeY - 80);
    } else {
      x.moveTo(cx + s * 22, eyeY - 52); x.lineTo(cx + s * 120, eyeY - 96);
    }
    x.stroke();
  }
  // Eyes.
  for (const s of [-1, 1]) {
    const ex = cx + s * 70;
    if (kind === 'hurt') {
      x.lineWidth = 14;
      x.beginPath(); x.moveTo(ex - 26, eyeY - 26); x.lineTo(ex + 26, eyeY + 26); x.moveTo(ex + 26, eyeY - 26); x.lineTo(ex - 26, eyeY + 26); x.stroke();
    } else if (kind === 'laugh') {
      x.lineWidth = 14;
      x.beginPath(); x.arc(ex, eyeY + 14, 30, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    } else {
      const glowEye = kind === 'windup';
      x.fillStyle = glowEye ? '#ffec5a' : '#fff4d8';
      x.beginPath();
      // Angry eyes are cut flat along the top.
      x.moveTo(ex - 42, eyeY - (s < 0 ? 4 : 22));
      x.lineTo(ex + 42, eyeY - (s < 0 ? 22 : 4));
      x.quadraticCurveTo(ex + 40, eyeY + 44, ex, eyeY + 40);
      x.quadraticCurveTo(ex - 40, eyeY + 44, ex - 42, eyeY - (s < 0 ? 4 : 22));
      x.fill();
      x.lineWidth = 6; x.stroke();
      if (kind === 'tired') {
        x.fillStyle = '#a8243e';
        x.fillRect(ex - 46, eyeY - 30, 92, 34);
        x.lineWidth = 8;
        x.beginPath(); x.moveTo(ex - 42, eyeY + 4); x.lineTo(ex + 42, eyeY + 4); x.stroke();
      }
      x.fillStyle = glowEye ? '#ff1e1e' : ink;
      x.beginPath(); x.arc(ex - s * 4, eyeY + 14, glowEye ? 9 : 13, 0, Math.PI * 2); x.fill();
    }
  }
  // Nose.
  x.fillStyle = 'rgba(70,0,20,0.5)';
  x.beginPath(); x.ellipse(cx, 300, 24, 16, 0, 0, Math.PI * 2); x.fill();
  // Huge curled mustache.
  x.strokeStyle = ink;
  x.lineWidth = 20;
  for (const s of [-1, 1]) {
    x.beginPath();
    x.moveTo(cx, 326);
    x.bezierCurveTo(cx + s * 40, 306, cx + s * 96, 340, cx + s * 118, 306);
    x.quadraticCurveTo(cx + s * 132, 280, cx + s * 108, 276);
    x.stroke();
  }
  // Mouth.
  x.fillStyle = '#3a0412';
  x.lineWidth = 9;
  x.beginPath();
  if (kind === 'laugh') {
    x.moveTo(cx - 80, 352); x.quadraticCurveTo(cx, 460, cx + 80, 352); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#fff4d8';
    x.fillRect(cx - 60, 354, 120, 18);
  } else if (kind === 'hurt') {
    x.ellipse(cx, 384, 36, 44, 0, 0, Math.PI * 2); x.fill(); x.stroke();
  } else if (kind === 'tired') {
    x.moveTo(cx - 50, 372); x.quadraticCurveTo(cx, 350, cx + 50, 372); x.stroke();
    x.fillStyle = '#ff6a8a';
    x.beginPath(); x.ellipse(cx + 18, 388, 18, 24, 0.3, 0, Math.PI * 2); x.fill();
  } else {
    // Gritted teeth.
    x.moveTo(cx - 70, 360); x.lineTo(cx + 70, 360); x.lineTo(cx + 56, 408); x.lineTo(cx - 56, 408); x.closePath();
    x.fill(); x.stroke();
    x.fillStyle = '#fff4d8';
    x.fillRect(cx - 62, 366, 124, 36);
    x.strokeStyle = ink; x.lineWidth = 4;
    for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(cx + i * 17, 366); x.lineTo(cx + i * 17, 402); x.stroke(); }
    x.beginPath(); x.moveTo(cx - 62, 384); x.lineTo(cx + 62, 384); x.stroke();
  }
  // Pointed black beard.
  x.fillStyle = ink;
  x.beginPath();
  x.moveTo(cx - 40, 430); x.quadraticCurveTo(cx, 520, cx + 6, 512); x.quadraticCurveTo(cx + 20, 480, cx + 40, 430);
  x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
