// The tower of landed containers: exact placement, cumulative lean, and collapse.
import * as THREE from 'three';
import * as TUNING from './tuning.js';
import { cargoMaterial } from './cargo.js';

export default class Stack {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.blocks = [];
    this.snaps = 0;
    this.lastX = 0;
    this.lean = 0;
  }

  reset() {
    for (const block of this.blocks) {
      this.group.remove(block);
      block.geometry.dispose();
      // cargoMaterial is shared; disposing it here would break later blocks.
    }
    this.blocks = [];
    this.snaps = 0;
    this.lastX = 0;
    this.lean = 0;
    this.group.rotation.z = 0;
  }

  getTopY() {
    return this.blocks.length * TUNING.GAME.containerSize;
  }

  getHeight() {
    return this.getTopY();
  }

  // xOffset is how far the falling container's center is from the tower center.
  land(xOffset) {
    const size = TUNING.GAME.containerSize;
    const crooked = Math.abs(xOffset) > TUNING.DROP.snapTolerance;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      cargoMaterial
    );
    mesh.position.set(xOffset, this.getTopY() + size / 2, 0);

    this.group.add(mesh);
    this.blocks.push(mesh);

    if (!crooked) this.snaps++;

    // The first block sets the baseline and does not tilt the tower.
    // After that, lean changes by how far the new block is from the previous one.
    if (this.blocks.length === 1) {
      this.lastX = xOffset;
      this.lean = 0;
    } else {
      const delta = xOffset - this.lastX;
      this.lean -= delta * TUNING.GAME.tiltFactor;
      this.lastX = xOffset;
    }
    this.group.rotation.z = this.lean;

    return crooked ? 'crooked' : 'snap';
  }

  getLean() {
    return this.lean;
  }

  getLeanLimit() {
    return TUNING.GAME.leanLimit;
  }

  getCargoCount() {
    return this.blocks.length;
  }

  isUnstable() {
    return Math.abs(this.lean) > TUNING.GAME.leanLimit;
  }

  getSnapCount() {
    return this.snaps;
  }

  getScore() {
    return this.getHeight() * TUNING.GAME.scorePerHeight + this.snaps * TUNING.GAME.scorePerSnap;
  }

  checkWin() {
    return this.getHeight() >= TUNING.GAME.ufoHeight;
  }
}
