import * as THREE from 'three';
import * as T from './tuning.js';

// Ink-wash Jiangnan palette for the environment.
export const PALETTE = {
  ricePaper: '#f4ede3',
  ricePaperLight: '#f7f1e8',
  ricePaperDark: '#efe6d8',
  wallWhite: '#f8f4ed',
  roofDark: '#3a3a3a',
  inkLight: '#c5ccd4',
  inkMid: '#9aa8b8',
  ink: '#7a8a99',
  inkDark: '#4a5560',
  townGrey: '#a8b2be',
};

function createCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function setBackground(scene) {
  scene.background = new THREE.Color(PALETTE.ricePaper);
  scene.fog = new THREE.Fog(PALETTE.ricePaper, 22, 78);
}

function drawMountainRange(ctx, w, h, baseY, color, opacity, amp, freq, seed) {
  ctx.save();
  ctx.globalAlpha = opacity;

  const grad = ctx.createLinearGradient(0, baseY - h * 0.22, 0, h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(244, 237, 227, 0)');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseY);

  const step = 40;
  let prevY = baseY;
  for (let x = step; x <= w + step; x += step) {
    const t = x * freq + seed;
    const noise = Math.sin(t) + Math.sin(t * 2.1) * 0.5 + Math.sin(t * 0.55) * 0.5;
    const y = baseY + noise * h * amp;
    const cpX = x - step / 2;
    const cpY = (prevY + y) / 2 - Math.abs(noise) * h * amp * 0.25;
    ctx.quadraticCurveTo(cpX, cpY, x, y);
    prevY = y;
  }

  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createMountainTexture() {
  return createCanvasTexture(1024, 2048, (ctx, w, h) => {
    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0, PALETTE.ricePaperLight);
    baseGrad.addColorStop(0.5, PALETTE.ricePaper);
    baseGrad.addColorStop(1, PALETTE.ricePaperDark);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // Far layers first.
    const layers = [
      { y: 0.34, color: PALETTE.inkLight, opacity: 0.32, amp: 0.11, freq: 0.010, seed: 1.2 },
      { y: 0.46, color: PALETTE.inkMid, opacity: 0.38, amp: 0.13, freq: 0.013, seed: 3.4 },
      { y: 0.58, color: PALETTE.ink, opacity: 0.46, amp: 0.15, freq: 0.016, seed: 5.1 },
      { y: 0.72, color: PALETTE.inkDark, opacity: 0.55, amp: 0.17, freq: 0.020, seed: 7.8 },
    ];

    for (const layer of layers) {
      drawMountainRange(ctx, w, h, h * layer.y, layer.color, layer.opacity, layer.amp, layer.freq, layer.seed);
    }
  });
}

export function createMountainPlane(scene) {
  const texture = createMountainTexture();
  const geometry = new THREE.PlaneGeometry(80, 110);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, -26);
  scene.add(mesh);
  return mesh;
}

function createMistTexture() {
  return createCanvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(244, 237, 227, 0)');
    grad.addColorStop(0.45, 'rgba(244, 237, 227, 0.25)');
    grad.addColorStop(1, 'rgba(244, 237, 227, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

export function createMistLayer(scene, z, opacity, scale) {
  const texture = createMistTexture();
  const geometry = new THREE.PlaneGeometry(55 * scale, 42 * scale);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, z);
  scene.add(mesh);
  return mesh;
}

export function createTownSilhouettes(scene) {
  const silhouettes = [];
  const color = PALETTE.townGrey;

  const clusters = [
    { x: -15, baseY: -7, z: -14, width: 10, height: 7 },
    { x: 11, baseY: -6, z: -16, width: 12, height: 6 },
    { x: -4, baseY: -8, z: -19, width: 8, height: 9 },
    { x: 19, baseY: -5, z: -12, width: 6, height: 4 },
    { x: -22, baseY: -4, z: -11, width: 5, height: 5 },
  ];

  for (const cluster of clusters) {
    const group = new THREE.Group();
    group.position.set(cluster.x, cluster.baseY, cluster.z);

    const count = 2 + Math.floor(Math.random() * 2);
    let currentX = -cluster.width / 2;
    for (let i = 0; i < count; i++) {
      const bw = (cluster.width / count) * (0.7 + Math.random() * 0.5);
      const bh = cluster.height * (0.55 + Math.random() * 0.55);
      const geo = new THREE.BoxGeometry(bw, bh, 1.5);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(currentX + bw / 2, bh / 2, 0);
      group.add(mesh);
      currentX += bw * 0.82;
    }

    scene.add(group);
    silhouettes.push({ mesh: group, baseY: cluster.baseY });
  }

  return silhouettes;
}

// --- Painted rooftop tiles --------------------------------------------------
// One watercolor sheet is painted once into a canvas and shared by every roof.

let roofTileTexture = null;

function getRoofTileTexture() {
  if (roofTileTexture) return roofTileTexture;

  const size = 512;
  const hex = (color, alpha) =>
    color + Math.floor(alpha * 255).toString(16).padStart(2, '0');

  roofTileTexture = createCanvasTexture(size, size, (ctx, w, h) => {
    // Soft rice-paper ground with an uneven grey wash.
    const base = ctx.createLinearGradient(0, 0, w * 0.6, h);
    base.addColorStop(0, PALETTE.inkMid);
    base.addColorStop(0.55, PALETTE.ink);
    base.addColorStop(1, PALETTE.inkDark);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Loose watercolor pigment clouds — larger, softer, fewer.
    const blot = (x, y, r, color, alpha) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hex(color, alpha));
      g.addColorStop(0.5, hex(color, alpha * 0.35));
      g.addColorStop(1, hex(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    blot(w * 0.2, h * 0.25, w * 0.55, PALETTE.ricePaperDark, 0.18);
    blot(w * 0.75, h * 0.35, w * 0.48, PALETTE.inkLight, 0.16);
    blot(w * 0.45, h * 0.7, w * 0.6, PALETTE.ricePaperLight, 0.12);
    blot(w * 0.1, h * 0.85, w * 0.4, PALETTE.inkDark, 0.2);

    // A few wandering horizontal tile rows, hand-painted and irregular.
    const rowCount = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rowCount; i++) {
      const y = ((i + 0.5) / rowCount) * h + (Math.random() - 0.5) * h * 0.04;
      const g = ctx.createLinearGradient(0, y - h * 0.02, 0, y + h * 0.04);
      g.addColorStop(0, hex(PALETTE.inkDark, 0));
      g.addColorStop(0.25, hex(PALETTE.inkDark, 0.28));
      g.addColorStop(0.5, hex(PALETTE.ricePaperLight, 0.18));
      g.addColorStop(0.75, hex(PALETTE.ink, 0.22));
      g.addColorStop(1, hex(PALETTE.inkDark, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - h * 0.03, w, h * 0.06);
    }

    // Soft vertical separations between tiles, unevenly spaced.
    const sepCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i <= sepCount; i++) {
      const x = (i / sepCount) * w + (Math.random() - 0.5) * w * 0.04;
      const g = ctx.createLinearGradient(x - w * 0.02, 0, x + w * 0.02, 0);
      g.addColorStop(0, hex(PALETTE.inkDark, 0));
      g.addColorStop(0.5, hex(PALETTE.inkDark, 0.22));
      g.addColorStop(1, hex(PALETTE.inkDark, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w * 0.02, 0, w * 0.04, h);
    }

    // Faded vignette edges so each roof melts into the mist.
    const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
    vignette.addColorStop(0, hex(PALETTE.ricePaper, 0));
    vignette.addColorStop(0.6, hex(PALETTE.ricePaper, 0.05));
    vignette.addColorStop(1, hex(PALETTE.ricePaper, 0.22));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Paper grain and tiny ink flecks.
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const bright = Math.random() < 0.5;
      ctx.fillStyle = bright
        ? hex(PALETTE.ricePaperLight, 0.08 + Math.random() * 0.12)
        : hex(PALETTE.inkDark, 0.06 + Math.random() * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, 0.5 + Math.random() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // UVs on the roof come out in world metres, so the repeat sets the tile size.
  const metresPerSheet = 1.6; // roughly one painted sheet in world metres
  roofTileTexture.wrapS = THREE.RepeatWrapping;
  roofTileTexture.wrapT = THREE.RepeatWrapping;
  roofTileTexture.repeat.set(1 / metresPerSheet, 1 / metresPerSheet);
  roofTileTexture.anisotropy = 4;
  return roofTileTexture;
}

export function createChineseRoofMesh(centerX, topY, width, slopeAngle) {
  const group = new THREE.Group();

  const halfW = width / 2;
  const thickness = T.roofThickness;
  const surface = thickness / 2; // local y of the walkable top surface

  // Eave tips and the crown scale with the roof, so narrow ledges stay gentle.
  const eaveRise = Math.min(T.roofEaveRise, width * 0.12);
  const crownRise = Math.min(T.roofCrownRise, width * 0.03);

  // Side profile: one thin slab whose top edge arcs gently and lifts into
  // upturned eaves at both ends. Sampled 64 times so the curve is smooth and
  // the top-surface UVs (world x across, world z back) never flip axis.
  const steps = 64;
  const profile = [];
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * 2 - 1; // -1 (left eave) .. 1 (right eave)
    const crown = crownRise * (1 - u * u);
    const tip = Math.max(0, (Math.abs(u) - 0.66) / 0.34);
    const eave = eaveRise * tip * tip;
    profile.push([u * halfW, surface + crown + eave]);
  }

  const shape = new THREE.Shape();
  shape.moveTo(profile[0][0], profile[0][1]);
  for (let i = 1; i <= steps; i++) shape.lineTo(profile[i][0], profile[i][1]);
  // Underside: the same silhouette dropped by the slab thickness.
  for (let i = steps; i >= 0; i--) shape.lineTo(profile[i][0], profile[i][1] - thickness);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: T.roofDepth,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.translate(0, 0, -T.roofDepth / 2); // centre the depth on z = 0

  const roof = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map: getRoofTileTexture(),
      roughness: 0.75,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Same origin as the old box roof, so world.js collision still lines up.
  group.position.set(centerX, topY - thickness / 2, 0);
  group.rotation.z = slopeAngle;
  // Tip the slab toward the camera so the painted tile surface reads as 3D.
  group.rotation.x = THREE.MathUtils.degToRad(T.roofTiltDeg);

  return group;
}
