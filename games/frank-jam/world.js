// World dressing outside the platform: the dusk skyline background and abandoned building blocks.
import * as THREE from 'three';
import * as TUNING from './tuning.js';

// Draw the skyline photo into a canvas (cover-fitted so it never stretches), multiply a dusk
// gradient over it, and use the result as the scene background. Stays out of the way of gameplay.
export function applySkyBackground(scene) {
  const cfg = TUNING.SKY;
  new THREE.TextureLoader().load(cfg.image, (photo) => {
    const width = cfg.canvasWidth;
    const height = Math.round(width / Math.max(0.5, innerWidth / innerHeight));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Cover-fit: fill the canvas and crop the overflow, keeping the photo's proportions.
    const scale = Math.max(width / photo.width, height / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    ctx.drawImage(photo, (width - w) / 2, (height - h) / 2, w, h);

    // Dusk tint: multiply a vertical gradient over the photo so it reads as evening concrete.
    const dusk = ctx.createLinearGradient(0, 0, 0, height);
    dusk.addColorStop(0, cfg.tintTop);
    dusk.addColorStop(1, cfg.tintBottom);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = cfg.tintStrength;
    ctx.fillStyle = dusk;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
  });
}

// Scatter dark boxes in a ring outside the safety fence: the abandoned blocks around the site.
export function addAbandonedBuildings(scene) {
  const cfg = TUNING.BUILDINGS;
  const geometry = new THREE.BoxGeometry(1, 1, 1); // one shared box, scaled per building
  const material = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 1 });

  for (let i = 0; i < cfg.count; i++) {
    const width = rand(cfg.minWidth, cfg.maxWidth);
    const depth = rand(cfg.minWidth, cfg.maxWidth);
    const height = rand(cfg.minHeight, cfg.maxHeight);
    const reach = Math.hypot(width, depth) / 2; // half-diagonal, so rotation can't sneak in

    // Try a few spots until the block clears the fence and the camera's corridor.
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 12; tries++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = rand(cfg.minRadius, cfg.maxRadius);
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      if (isClear(cfg, x, z, reach)) break;
    }

    const block = new THREE.Mesh(geometry, material);
    block.scale.set(width, height, depth);
    block.position.set(x, cfg.groundY + height / 2, z);
    block.rotation.y = Math.random() * Math.PI;
    scene.add(block);
  }
}

// A spot is clear if the block misses the platform + fence square, and misses the open
// aisle the camera looks in through (otherwise a tall block would sit in front of the tower).
function isClear(cfg, x, z, reach) {
  const clearsPlatform = Math.abs(x) - reach > cfg.keepOut || Math.abs(z) - reach > cfg.keepOut;
  const clearsCameraSide = z + reach < 0 || Math.abs(x) - reach > cfg.frontClear;
  return clearsPlatform && clearsCameraSide;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
