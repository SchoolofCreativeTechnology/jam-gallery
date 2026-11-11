// Jambi's head: a heavy, slippery glass ball you steer by momentum. Inside, his head floats
// upright as if suspended in oil: it turns to look where he's sliding and leans as he speeds up.
import * as THREE from 'three';
import * as tuning from './tuning.js';
import { nearest, getCourse, RAIL_RADIUS, RAIL_HEIGHT } from './path.js';

const MAX_STEP = 1 / 120; // long frames are split into steps this long, so nothing tunnels
const SKIN = '#6dae48';

export function createHead(scene) {
  const r = tuning.head.radius;
  const group = new THREE.Group();

  // ---- The glass ball: a clear shell with a soft outline so it reads on any background ----
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(r, 40, 28),
    new THREE.MeshPhysicalMaterial({
      color: '#e9fbff', transparent: true, opacity: 0.24, roughness: 0.03, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, depthWrite: false,
    })
  );
  glass.castShadow = true;
  glass.renderOrder = 2;
  group.add(glass);

  const outline = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.045, 32, 20),
    new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.BackSide, transparent: true, opacity: 0.55, depthWrite: false })
  );
  outline.renderOrder = 1;
  group.add(outline);

  // A glint that stays put while the ball rolls, so the glass always looks like glass.
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.16, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false })
  );
  glint.scale.set(1, 0.55, 0.5);
  glint.position.set(-r * 0.42, r * 0.62, r * 0.38);
  glint.rotation.z = 0.6;
  glint.renderOrder = 3;
  group.add(glint);

  // ---- The bust: his head, turban and earrings, never spun by the roll ----
  const faces = {
    neutral: faceTexture('neutral'),
    scared: faceTexture('scared'),
    happy: faceTexture('happy'),
    dizzy: faceTexture('dizzy'),
  };
  const bust = createBust(r, faces.neutral);
  group.add(bust.root);
  scene.add(group);

  // ---- State ----
  let velX = 0, velZ = 0, velY = 0;
  let prevVX = 0, prevVZ = 0;
  let leanX = 0, leanZ = 0, leanVX = 0, leanVZ = 0;
  let yaw = 0;
  let expressionTimer = 0;
  let expression = 'neutral';
  let spin = 0;
  let homeAnim = null;
  let wasOnEdge = false;
  let lastS = 0;
  let landed = false;

  const railStop = Math.sqrt(Math.max(0, (r + RAIL_RADIUS) ** 2 - (RAIL_HEIGHT - r) ** 2));

  // ---- Speed trail: a small pool of fading droplets ----
  const trailGeo = new THREE.SphereGeometry(tuning.head.trailSize, 8, 6);
  const trail = [];
  for (let i = 0; i < 14; i++) {
    const mesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    mesh.visible = false;
    scene.add(mesh);
    trail.push({ mesh, life: 0 });
  }
  let trailNext = 0;
  let trailClock = 0;

  const api = {
    group,
    isFalling: false,
    isHome: false,
    fellOff: false,
    airborne: false,
    onShove: null, // main.js hooks these for shake, sound and particles
    onBonk: null,
    onLand: null,
    onJump: null,
    onTouchdown: null,
    get velocity() { return { x: velX, z: velZ }; },
    get speed() { return Math.hypot(velX, velZ); },
    get progress() { return lastS; },
    update, reset, shove, scare, express, goHome,
  };

  function reset(x, z) {
    const n = nearest(x, z);
    group.position.set(x, n.y + r, z);
    velX = velZ = velY = prevVX = prevVZ = 0;
    leanX = leanZ = leanVX = leanVZ = 0;
    yaw = 0;
    spin = 0;
    lastS = n.s;
    api.isFalling = false;
    api.isHome = false;
    api.fellOff = false;
    api.airborne = false;
    landed = false;
    homeAnim = null;
    bust.root.position.set(0, 0, 0);
    bust.root.scale.setScalar(1);
    bust.root.rotation.set(-tuning.head.faceUp, 0, 0);
    glass.visible = outline.visible = glint.visible = true;
    group.visible = true;
    group.scale.setScalar(1);
    express('neutral', 0);
    for (const t of trail) { t.life = 0; t.mesh.visible = false; }
  }

  function shove(dx, dz) {
    if (api.isFalling || api.isHome) return;
    velX += dx;
    velZ += dz;
    capSpeed();
    scare();
    if (api.onShove) api.onShove();
  }

  function scare() {
    express('scared', tuning.head.scaredDuration);
  }

  // Swap his face. A timed face falls back to neutral when it runs out; 0 means hold it.
  function express(name, seconds) {
    expression = name;
    expressionTimer = seconds;
    bust.setFace(faces[name]);
  }

  // Reached the box: glide over it, then sink in.
  function goHome(box) {
    api.isHome = true;
    homeAnim = { t: 0, from: group.position.clone(), to: new THREE.Vector3(box.x, box.y, box.z) };
    express('happy', 0);
  }

  function update(dt, moveX, moveZ) {
    if (!(dt > 0)) return;

    if (expressionTimer > 0) {
      expressionTimer -= dt;
      if (expressionTimer <= 0 && !api.isFalling && !api.isHome) express('neutral', 0);
    }

    if (homeAnim) {
      updateHome(dt);
    } else {
      const steps = Math.min(16, Math.max(1, Math.ceil(dt / MAX_STEP)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) step(h, moveX, moveZ);
    }

    updateBust(dt);
    updateTrail(dt);
  }

  function capSpeed() {
    const speed = Math.hypot(velX, velZ);
    const max = tuning.head.maxSpeed;
    if (speed > max) {
      velX *= max / speed;
      velZ *= max / speed;
    }
  }

  // ---- PHYSICS ----
  function step(dt, moveX, moveZ) {
    const p = group.position;
    if (api.isFalling) {
      // Off the deck: keep the momentum, gravity takes over, no more steering.
      p.x += velX * dt;
      p.z += velZ * dt;
      velY -= tuning.rules.gravity * dt;
      p.y += velY * dt;
      spin += dt * (landed ? 2 : 9);
      // Land on the stage floor far below, bounce, and lie there seeing stars.
      const floor = getCourse().bounds.floorY + r;
      if (p.y < floor) {
        p.y = floor;
        if (!landed && api.onLand) api.onLand(Math.abs(velY));
        landed = true;
        velY = Math.abs(velY) > 2 ? -velY * 0.42 : 0;
        velX *= 0.6;
        velZ *= 0.6;
      }
      if (landed) {
        const keep = Math.exp(-3 * dt);
        velX *= keep;
        velZ *= keep;
      }
      return;
    }

    if (api.airborne) {
      // Over broken track: a ballistic arc, with only a little steering.
      const air = tuning.jump.airControl;
      velX += moveX * tuning.head.accel * air * dt;
      velZ += moveZ * tuning.head.accel * air * dt;
      p.x += velX * dt;
      p.z += velZ * dt;
      velY -= tuning.rules.gravity * dt;
      p.y += velY * dt;
      spin += dt * 4;
      const n = nearest(p.x, p.z);
      lastS = Math.max(lastS, n.s);
      const overDeck = !n.gap && Math.abs(n.lat) <= n.w && n.behind === 0 && n.beyond === 0;
      if (overDeck && p.y <= n.y + r) {
        if (p.y >= n.y + r - tuning.jump.landingGrace) {
          // Touchdown.
          const impact = -velY;
          p.y = n.y + r;
          velY = 0;
          spin = 0;
          api.airborne = false;
          express(impact > 9 ? 'scared' : 'happy', 0.6);
          if (api.onTouchdown) api.onTouchdown(impact);
        } else {
          // Came in short and hit the torn edge: bounce back and drop.
          const into = velX * n.tx + velZ * n.tz;
          velX -= n.tx * into * 1.4;
          velZ -= n.tz * into * 1.4;
          if (api.onBonk) api.onBonk(Math.abs(into));
          fallOff();
        }
      } else if (p.y < n.y - 1.2) {
        fallOff();
      }
      return;
    }

    const here = nearest(p.x, p.z);
    p.y = here.y + r;

    // Gravity along the slope: downhill speeds up, uphill slows down.
    velX += -here.slope * tuning.rules.slopeGravity * here.tx * dt;
    velZ += -here.slope * tuning.rules.slopeGravity * here.tz * dt;

    // Input is acceleration, never position: you have to ask him to slow down.
    velX += moveX * tuning.head.accel * dt;
    velZ += moveZ * tuning.head.accel * dt;

    const keep = Math.exp(-tuning.head.drag * dt);
    velX *= keep;
    velZ *= keep;
    capSpeed();

    p.x += velX * dt;
    p.z += velZ * dt;

    // Rails, and the walls at either end of the deck.
    const n = nearest(p.x, p.z);

    // Off the lip of a kicker and into the air.
    if (n.gap) {
      const gap = getCourse().gaps.find((g) => n.k >= g.k0 && n.k < g.k1);
      const along = velX * n.tx + velZ * n.tz;
      velY = Math.max(0, along) * (gap ? gap.lip : 0);
      api.airborne = true;
      lastS = n.s;
      express('scared', 0);
      if (api.onJump) api.onJump(along);
      return;
    }
    const limit = n.w - railStop;
    if ((n.lat > limit && n.railR) || (n.lat < -limit && n.railL)) {
      const side = Math.sign(n.lat);
      const over = n.lat - limit * side;
      p.x -= n.rx * over;
      p.z -= n.rz * over;
      const out = (velX * n.rx + velZ * n.rz) * side;
      if (out > 0) {
        velX -= n.rx * side * out * (1 + tuning.head.railBounce);
        velZ -= n.rz * side * out * (1 + tuning.head.railBounce);
        if (out > 1.5 && api.onBonk) api.onBonk(out);
      }
    }
    // The ends of the deck act like walls a little inside the edge, so the ball never overhangs.
    const endMargin = r * 0.6;
    const back = n.behind + Math.max(0, endMargin - n.s);
    const front = n.beyond + Math.max(0, n.s - (getCourse().length - endMargin));
    for (const [over, dir] of [[back, 1], [front, -1]]) {
      if (over <= 0) continue;
      p.x += n.tx * over * dir;
      p.z += n.tz * over * dir;
      const into = -(velX * n.tx + velZ * n.tz) * dir;
      if (into > 0) {
        velX += n.tx * into * dir * (1 + tuning.head.railBounce);
        velZ += n.tz * into * dir * (1 + tuning.head.railBounce);
        if (into > 1.5 && api.onBonk) api.onBonk(into);
      }
    }
    lastS = n.s;

    // Teetering on an open edge: he notices.
    const open = n.lat > 0 ? !n.railR : !n.railL;
    const edge = open && Math.abs(n.lat) > n.w - r * 0.35;
    if (edge && !wasOnEdge && expression === 'neutral') express('scared', 0.5);
    wasOnEdge = edge;

    // Over the edge.
    if (open && Math.abs(n.lat) > n.w + tuning.head.edgeGrace) {
      velY = 1.2;
      fallOff();
    }
  }

  function fallOff() {
    api.isFalling = true;
    api.fellOff = true;
    api.airborne = false;
    express('dizzy', 0);
  }

  function updateHome(dt) {
    homeAnim.t += dt;
    const t = homeAnim.t;
    const p = group.position;
    const { from, to } = homeAnim;
    if (t < 0.45) {
      // Hop up and over to the box.
      const k = t / 0.45;
      const e = 1 - (1 - k) * (1 - k);
      p.x = from.x + (to.x - from.x) * e;
      p.z = from.z + (to.z - from.z) * e;
      p.y = from.y + (to.y + 1.6 - from.y) * e + Math.sin(k * Math.PI) * 1.2;
    } else {
      // Sink all the way below the rim, shrinking a touch, then he's gone and the lid can shut.
      const k = Math.min(1, (t - 0.45) / 0.45);
      const e = k * k;
      p.x = to.x;
      p.z = to.z;
      p.y = to.y + 1.6 - e * (1.6 + r * 0.95);
      group.scale.setScalar(1 - 0.3 * e);
      if (k >= 1) group.visible = false;
    }
    velX = velZ = 0;
  }

  // ---- THE FACE IN THE OIL ----
  function updateBust(dt) {
    // He looks the way he's sliding, sideways mostly, because forward is away from the camera.
    const targetYaw = clamp(velX * tuning.head.turn, -tuning.head.maxTurn, tuning.head.maxTurn);
    yaw += (targetYaw - yaw) * (1 - Math.exp(-6 * dt));

    // He leans against any change in speed, then the oil brings him back upright.
    const ax = (velX - prevVX) / dt;
    const az = (velZ - prevVZ) / dt;
    prevVX = velX;
    prevVZ = velZ;
    const k = tuning.head.wobbleSpring;
    const targetX = clamp(-ax * tuning.head.wobble * 0.1, -tuning.head.maxLean, tuning.head.maxLean);
    const targetZ = clamp(az * tuning.head.wobble * 0.1, -tuning.head.maxLean, tuning.head.maxLean);
    leanVX += (k * k * (targetX - leanX) - 2 * k * 0.55 * leanVX) * dt;
    leanVZ += (k * k * (targetZ - leanZ) - 2 * k * 0.55 * leanVZ) * dt;
    leanX = clamp(leanX + leanVX * dt, -tuning.head.maxLean, tuning.head.maxLean);
    leanZ = clamp(leanZ + leanVZ * dt, -tuning.head.maxLean, tuning.head.maxLean);

    bust.root.rotation.set(-tuning.head.faceUp + leanZ, yaw + spin, leanX + Math.sin(spin * 0.7) * (spin > 0 ? 0.6 : 0));
  }

  function updateTrail(dt) {
    const speed = Math.hypot(velX, velZ);
    if (!api.isFalling && !api.isHome && speed > 4) {
      trailClock += dt;
      while (trailClock >= tuning.head.trailInterval) {
        trailClock -= tuning.head.trailInterval;
        const t = trail[trailNext];
        trailNext = (trailNext + 1) % trail.length;
        t.life = tuning.head.trailLife;
        t.mesh.visible = true;
        t.mesh.position.copy(group.position);
        t.mesh.position.y -= r * 0.55;
      }
    } else {
      trailClock = 0;
    }
    for (const t of trail) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) { t.mesh.visible = false; continue; }
      const k = t.life / tuning.head.trailLife;
      t.mesh.scale.setScalar(k);
      t.mesh.material.opacity = k * tuning.head.trailOpacity;
    }
  }

  reset(0, 0);
  return api;
}

// ---- MODEL ----
// His head is a slightly tall sphere with the face painted on the front; the turban, jewel
// and gold hoops sit on it. Everything is a child of `root`, which the code turns and tilts.
function createBust(r, faceMap) {
  const root = new THREE.Group();
  const headR = r * 0.52;

  const skin = new THREE.MeshStandardMaterial({ map: faceMap, roughness: 0.6 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 40, 28), skin);
  head.scale.set(1, 1.08, 0.96);
  head.position.y = -r * 0.08;
  head.castShadow = false;
  root.add(head);

  const ears = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.24, 12, 8), ears);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(side * headR * 0.98, -r * 0.08, -headR * 0.05);
    root.add(ear);
  }

  const magenta = new THREE.MeshStandardMaterial({ color: '#ff2a6d', roughness: 0.75 });
  const purple = new THREE.MeshStandardMaterial({ color: '#9d4edd', roughness: 0.75 });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd23d', metalness: 0.75, roughness: 0.22 });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.02, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), purple);
  dome.scale.set(1, 0.95, 0.98);
  dome.position.y = r * 0.12;
  root.add(dome);

  const bands = [[1.0, 0.2, 0.1, magenta], [0.9, 0.17, 0.25, purple], [0.72, 0.15, 0.38, magenta]];
  for (const [rad, tube, y, mat] of bands) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(headR * rad, headR * tube, 12, 36), mat);
    band.rotation.x = Math.PI / 2;
    band.position.y = r * y;
    root.add(band);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.24, 14, 10), magenta);
  knot.position.set(0, r * 0.5, -headR * 0.15);
  root.add(knot);

  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(headR * 0.2), new THREE.MeshStandardMaterial({
    color: '#05d9e8', emissive: '#05d9e8', emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.1,
  }));
  jewel.scale.set(0.8, 1.1, 0.5);
  jewel.position.set(0, r * 0.2, headR * 0.98);
  root.add(jewel);
  const setting = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.05, 8, 20), gold);
  setting.position.set(0, r * 0.2, headR * 0.96);
  root.add(setting);

  for (const side of [-1, 1]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.05, 8, 20), gold);
    hoop.position.set(side * headR * 1.0, -r * 0.33, 0);
    hoop.rotation.y = Math.PI / 2;
    root.add(hoop);
  }

  return {
    root,
    setFace(map) {
      if (skin.map !== map) {
        skin.map = map;
        skin.needsUpdate = true;
      }
    },
  };
}

// ---- FACE TEXTURES ----
// Painted on an equirectangular canvas: the front of the sphere (+z) is at u = 0.25.
function faceTexture(kind) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = SKIN;
  ctx.fillRect(0, 0, W, H);
  // Soft shading: lighter at the cheeks, darker toward the back.
  const glow = ctx.createRadialGradient(256, 270, 20, 256, 270, 300);
  glow.addColorStop(0, 'rgba(190,240,140,0.55)');
  glow.addColorStop(1, 'rgba(190,240,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const cx = 256;
  const eyeY = 228;
  const eyeDX = 68;
  const ink = '#2a1630';

  // Rosy cheeks.
  ctx.fillStyle = 'rgba(255,110,140,0.35)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * 100, 300, 34, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brows.
  ctx.strokeStyle = '#24480f';
  ctx.lineCap = 'round';
  ctx.lineWidth = 15;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (kind === 'scared') {
      ctx.moveTo(cx + s * 30, eyeY - 82);
      ctx.quadraticCurveTo(cx + s * 70, eyeY - 108, cx + s * 110, eyeY - 80);
    } else if (kind === 'dizzy') {
      ctx.moveTo(cx + s * 30, eyeY - 62);
      ctx.lineTo(cx + s * 108, eyeY - 76);
    } else {
      ctx.moveTo(cx + s * 30, eyeY - 66);
      ctx.quadraticCurveTo(cx + s * 70, eyeY - 92, cx + s * 110, eyeY - 62);
    }
    ctx.stroke();
  }

  // Eyes.
  for (const s of [-1, 1]) {
    const x = cx + s * eyeDX;
    if (kind === 'happy') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.arc(x, eyeY + 12, 30, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (kind === 'dizzy') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 9;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const rad = 3 + a * 2.2;
        const px = x + Math.cos(a * s) * rad, py = eyeY + Math.sin(a * s) * rad;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else {
      const big = kind === 'scared';
      const ew = big ? 44 : 38, eh = big ? 54 : 44;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, eyeY, ew, eh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(x + s * 4, eyeY + 6, big ? 12 : 18, big ? 15 : 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + s * 4 + 7, eyeY - 4, big ? 5 : 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Nose.
  ctx.fillStyle = 'rgba(40,90,20,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, 286, 18, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mustache: a curly genie flourish.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 11;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, 312);
    ctx.bezierCurveTo(cx + s * 30, 300, cx + s * 64, 320, cx + s * 78, 302);
    ctx.quadraticCurveTo(cx + s * 88, 288, cx + s * 74, 284);
    ctx.stroke();
  }

  // Mouth.
  ctx.fillStyle = '#5a1a2a';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 9;
  ctx.beginPath();
  if (kind === 'scared') {
    ctx.ellipse(cx, 362, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'happy') {
    ctx.moveTo(cx - 62, 338);
    ctx.quadraticCurveTo(cx, 420, cx + 62, 338);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff7a93';
    ctx.beginPath();
    ctx.ellipse(cx, 376, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'dizzy') {
    ctx.moveTo(cx - 50, 356);
    for (let i = 0; i <= 10; i++) ctx.lineTo(cx - 50 + i * 10, 356 + (i % 2 ? -10 : 8));
    ctx.stroke();
  } else {
    ctx.moveTo(cx - 44, 346);
    ctx.quadraticCurveTo(cx, 384, cx + 44, 346);
    ctx.stroke();
  }

  // A little pointed goatee.
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx - 14, 404);
  ctx.quadraticCurveTo(cx, 452, cx + 2, 470);
  ctx.quadraticCurveTo(cx + 8, 440, cx + 14, 404);
  ctx.closePath();
  ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
