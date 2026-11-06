// Debug and performance overlays for dev/test builds.
import * as THREE from 'three';
import * as T from './tuning.js';

export function createFpsPanel() {
  const panel = document.createElement('div');
  panel.id = 'fps-panel';
  panel.className = 'fps-panel';
  document.body.appendChild(panel);
  return panel;
}

export function updateFpsPanel(panel, renderer, dt, history) {
  if (!panel) return;
  history.push(1 / Math.max(dt, 0.001));
  if (history.length > 60) history.shift();

  const current = Math.round(history[history.length - 1]);
  const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
  const min = Math.round(Math.min(...history));
  const info = renderer.info.render;
  panel.innerHTML = `FPS ${current} · avg ${avg} · min ${min}<br>calls ${info.calls} · tris ${info.triangles}`;
}

export function createDebugBox(color) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

export class DebugOverlay {
  constructor(scene) {
    this.scene = scene;
    this.playerBox = createDebugBox(0x00ff00);
    this.scene.add(this.playerBox);
    this.roofBoxes = [];
    this.vaseBoxes = [];
  }

  update(player, world) {
    // Player collider
    this.playerBox.position.copy(player.position);
    this.playerBox.scale.set(T.playerWidth, T.playerHeight, T.playerDepth);

    // Roof colliders
    this.syncBoxes(this.roofBoxes, world.roofs.length, () => createDebugBox(0xff0000));
    for (let i = 0; i < world.roofs.length; i++) {
      const r = world.roofs[i];
      const box = this.roofBoxes[i];
      const centerX = (r.left + r.right) / 2;
      const centerY = r.top;
      const depth = 5;
      box.position.set(centerX, centerY, 0);
      box.scale.set(r.width, 0.1, depth);
      box.rotation.z = r.slopeAngle;
    }

    // Vase colliders
    this.syncBoxes(this.vaseBoxes, world.vases.length, () => createDebugBox(0x00ccff));
    for (let i = 0; i < world.vases.length; i++) {
      const v = world.vases[i];
      const box = this.vaseBoxes[i];
      box.position.set(v.x, v.y, 0);
      box.scale.set(v.width, v.height, v.width);
      box.rotation.z = 0;
    }
  }

  syncBoxes(pool, count, factory) {
    while (pool.length < count) {
      const box = factory();
      this.scene.add(box);
      pool.push(box);
    }
    while (pool.length > count) {
      const box = pool.pop();
      this.scene.remove(box);
      box.geometry.dispose();
      box.material.dispose();
    }
  }

  dispose() {
    this.scene.remove(this.playerBox);
    this.playerBox.geometry.dispose();
    this.playerBox.material.dispose();
    for (const box of this.roofBoxes) {
      this.scene.remove(box);
      box.geometry.dispose();
      box.material.dispose();
    }
    for (const box of this.vaseBoxes) {
      this.scene.remove(box);
      box.geometry.dispose();
      box.material.dispose();
    }
    this.roofBoxes.length = 0;
    this.vaseBoxes.length = 0;
  }
}
