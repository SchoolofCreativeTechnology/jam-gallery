import * as THREE from 'three';
import * as T from './tuning.js';

// Watercolor calico cat: side-view, facing right.
// Everything is drawn with soft radial gradients and low-opacity blotches so
// the sprite reads as a cute watercolor painting rather than vector art.

const PALETTE = {
  cream: '#f5e6d3',
  creamShadow: '#e8d4c0',
  orange: '#d98645',
  orangeSoft: '#e6a368',
  brown: '#5c3a2a',
  brownSoft: '#7a5240',
  pink: '#f4a4a4',
  pinkDark: '#e08e8e',
  eye: '#d4a017',
  eyeDark: '#8f6a18',
  nose: '#e89b9b',
  outline: '#4a3b32',
};

function drawWatercolorBlotch(ctx, x, y, rx, ry, color, alpha = 0.35) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  const a = Math.floor(alpha * 255).toString(16).padStart(2, '0');
  g.addColorStop(0, color + a);
  g.addColorStop(0.55, color + Math.floor(alpha * 180).toString(16).padStart(2, '0'));
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSoftEllipse(ctx, x, y, rx, ry, color, alpha = 0.4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  const a = Math.floor(alpha * 255).toString(16).padStart(2, '0');
  g.addColorStop(0, color + a);
  g.addColorStop(0.75, color + Math.floor(alpha * 120).toString(16).padStart(2, '0'));
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEar(ctx, x, y, angle, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Outer ear
  ctx.fillStyle = PALETTE.cream;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -34, 26, -42);
  ctx.quadraticCurveTo(34, -20, 24, 4);
  ctx.closePath();
  ctx.fill();

  // Inner pink
  ctx.fillStyle = PALETTE.pink;
  ctx.beginPath();
  ctx.moveTo(8, -8);
  ctx.quadraticCurveTo(14, -28, 24, -34);
  ctx.quadraticCurveTo(28, -20, 22, -4);
  ctx.closePath();
  ctx.fill();

  // Soft shadow at base
  drawWatercolorBlotch(ctx, 12, 0, 16, 8, PALETTE.creamShadow, 0.25);

  ctx.restore();
}

function drawTail(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Soft tail body
  ctx.strokeStyle = PALETTE.cream;
  ctx.lineWidth = 22;
  ctx.filter = 'blur(3px)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-45, 5, -60, -35, -90, -25);
  ctx.stroke();

  ctx.filter = 'none';
  ctx.strokeStyle = PALETTE.cream;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-42, 4, -56, -32, -86, -23);
  ctx.stroke();

  // Tail stripes
  drawWatercolorBlotch(ctx, -35, 2, 10, 8, PALETTE.orange, 0.55);
  drawWatercolorBlotch(ctx, -62, -18, 11, 9, PALETTE.brown, 0.5);
  drawWatercolorBlotch(ctx, -82, -24, 9, 8, PALETTE.orange, 0.45);
  ctx.restore();
}

export function createCatSprite() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Rice-paper wash background (kept transparent at edges)
  const bg = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, 240);
  bg.addColorStop(0, 'rgba(250, 245, 235, 0.18)');
  bg.addColorStop(1, 'rgba(250, 245, 235, 0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Center the cat in the canvas, facing right.
  ctx.save();
  ctx.translate(size * 0.35, size * 0.58);

  // Tail behind body
  drawTail(ctx, -30, -20);

  // Back haunch
  drawSoftEllipse(ctx, -35, 15, 55, 45, PALETTE.cream, 0.85);
  drawWatercolorBlotch(ctx, -50, 0, 28, 24, PALETTE.orange, 0.45);
  drawWatercolorBlotch(ctx, -25, 30, 22, 18, PALETTE.brown, 0.35);

  // Main body
  drawSoftEllipse(ctx, 35, 10, 85, 58, PALETTE.cream, 0.9);

  // Calico patches (low opacity blotches)
  drawWatercolorBlotch(ctx, 70, -18, 42, 32, PALETTE.orange, 0.5);
  drawWatercolorBlotch(ctx, 95, 12, 32, 28, PALETTE.brown, 0.45);
  drawWatercolorBlotch(ctx, 20, 32, 38, 26, PALETTE.orange, 0.4);
  drawWatercolorBlotch(ctx, -5, -10, 30, 24, PALETTE.brown, 0.35);
  drawWatercolorBlotch(ctx, 50, 38, 26, 18, PALETTE.brownSoft, 0.3);

  // Chest/belly highlight
  drawSoftEllipse(ctx, 45, 45, 50, 22, '#ffffff', 0.18);

  // Back legs
  drawSoftEllipse(ctx, -45, 55, 22, 18, PALETTE.cream, 0.8);
  drawWatercolorBlotch(ctx, -48, 58, 14, 12, PALETTE.brown, 0.4);
  drawSoftEllipse(ctx, -15, 60, 20, 16, PALETTE.cream, 0.8);

  // Front legs
  drawSoftEllipse(ctx, 70, 58, 18, 16, PALETTE.cream, 0.8);
  drawSoftEllipse(ctx, 95, 58, 17, 15, PALETTE.cream, 0.8);
  drawWatercolorBlotch(ctx, 72, 60, 10, 9, PALETTE.orange, 0.35);

  // Head
  drawSoftEllipse(ctx, 110, -35, 58, 50, PALETTE.cream, 0.9);

  // Head patches
  drawWatercolorBlotch(ctx, 135, -55, 26, 22, PALETTE.orange, 0.5);
  drawWatercolorBlotch(ctx, 145, -28, 18, 16, PALETTE.brown, 0.45);
  drawWatercolorBlotch(ctx, 90, -55, 18, 16, PALETTE.brown, 0.35);

  // Ears
  drawEar(ctx, 88, -70, -0.25, 0.95);
  drawEar(ctx, 125, -75, 0.15, 1.05);

  // Face details
  // Eyes
  ctx.save();
  ctx.translate(118, -42);
  drawSoftEllipse(ctx, 0, 0, 11, 13, '#fff', 0.7);
  drawSoftEllipse(ctx, 0, 1, 7, 9, PALETTE.eye, 0.85);
  drawSoftEllipse(ctx, 2, -1, 2.5, 3, '#fff', 0.8);
  ctx.restore();

  // Nose
  ctx.fillStyle = PALETTE.nose;
  ctx.beginPath();
  ctx.moveTo(132, -28);
  ctx.lineTo(142, -28);
  ctx.lineTo(137, -20);
  ctx.closePath();
  ctx.fill();

  // Mouth line
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(137, -20);
  ctx.quadraticCurveTo(132, -12, 125, -15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(137, -20);
  ctx.quadraticCurveTo(142, -12, 149, -15);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Whiskers
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(145, -24 + i * 5);
    ctx.lineTo(185, -30 + i * 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Paw details
  drawSoftEllipse(ctx, 72, 68, 8, 5, PALETTE.pinkDark, 0.35);
  drawSoftEllipse(ctx, 96, 68, 7, 5, PALETTE.pinkDark, 0.35);

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.01,
  }));

  // Size the sprite to match the player's collision box.
  sprite.scale.set(T.playerWidth * 2.2, T.playerHeight * 2.2, 1);
  sprite.center.set(0.5, 0.42);
  return sprite;
}
