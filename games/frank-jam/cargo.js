// Shared cargo container material: a rust-red box with a dark frame and brace lines.
import * as THREE from 'three';
import * as TUNING from './tuning.js';

function makeCargoTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = TUNING.WORLD.containerColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = TUNING.WORLD.containerEdgeColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, size, size);

  ctx.lineWidth = 3;
  for (let y = 0; y <= size; y += size / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let x = 0; x <= size; x += size / 3) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const cargoMaterial = new THREE.MeshStandardMaterial({
  map: makeCargoTexture(),
  roughness: 0.6,
  metalness: 0.1,
});
