// The falling container: steer it left/right while it falls, then it lands automatically.
import * as THREE from 'three';
import * as TUNING from './tuning.js';
import { cargoMaterial } from './cargo.js';

export default class Container {
  constructor(scene, stack) {
    this.scene = scene;
    this.stack = stack;
    this.size = TUNING.GAME.containerSize;
    this.mesh = null;
    this.state = 'idle'; // 'idle' | 'falling'
    this.speed = TUNING.DROP.fallSpeedStart;
    this.moveDir = 0; // -1 left, 0 none, 1 right
    this.result = null; // null | 'win' | 'over'
  }

  // Remove the current container mesh and free GPU resources.
  clearMesh() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    // cargoMaterial is shared with the tower blocks; do not dispose it.
    this.mesh = null;
  }

// The first block is fixed in the center; later blocks spawn randomly on the left or right edge.
  spawn() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.size, this.size, this.size),
      cargoMaterial
    );

    // The very first block is the base: it always falls straight down the center.
    // Every block after that spawns on a random side.
    const isFirst = this.stack.getHeight() === 0;
    const x = isFirst
      ? 0
      : (Math.random() < 0.5 ? -1 : 1) * TUNING.DROP.spawnDriftMax;

    mesh.position.set(x, this.stack.getTopY() + TUNING.DROP.spawnHeight, 0);
    this.isFirst = isFirst;
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  reset() {
    this.clearMesh();
    this.result = null;
    this.moveDir = 0;
    this.speed = TUNING.DROP.fallSpeedStart;
    this.spawn();
    this.state = 'falling';
  }

  // Called by main.js each frame from held keys.
  setMove(dir) {
    this.moveDir = Math.max(-1, Math.min(1, dir));
  }

  update(dt) {
    if (this.state !== 'falling' || !this.mesh) return;

    // Horizontal steering (disabled for the first base block).
    if (!this.isFirst) {
      this.mesh.position.x += this.moveDir * TUNING.DROP.moveSpeed * dt;
      const limit = TUNING.DROP.spawnDriftMax;
      if (this.mesh.position.x < -limit) this.mesh.position.x = -limit;
      if (this.mesh.position.x > limit) this.mesh.position.x = limit;
    }

    // Automatic falling
    this.mesh.position.y -= this.speed * dt;

    // Land when the underside touches the tower top.
    if (this.mesh.position.y - this.size / 2 <= this.stack.getTopY()) {
      this.landAt(this.mesh.position.x);
    }
  }

  landAt(x) {
    const xOffset = x; // tower center is x = 0
    this.stack.land(xOffset);
    this.clearMesh();

    if (this.stack.isUnstable()) {
      this.result = 'over';
      this.state = 'idle';
    } else if (this.stack.checkWin()) {
      this.result = 'win';
      this.state = 'idle';
    } else if (this.stack.getCargoCount() >= TUNING.GAME.maxCargo) {
      this.result = 'over';
      this.state = 'idle';
    } else {
      this.speed += TUNING.DROP.fallSpeedGrowth;
      this.spawn();
      this.state = 'falling';
    }
  }
}
