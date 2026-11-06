// A simple cargo crane silhouette built from boxes.
import * as THREE from 'three';
import * as TUNING from './tuning.js';

export default class Crane {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.build();
    scene.add(this.group);
  }

  build() {
    const mat = new THREE.MeshStandardMaterial({ color: TUNING.WORLD.craneColor });

    // Tower
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 12, 0.4), mat);
    tower.position.set(-3.5, 5.5, -1);
    this.group.add(tower);

    // Main arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 0.25), mat);
    arm.position.set(-0.3, 11, -1);
    this.group.add(arm);

    // Counterweight at the back
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.5), mat);
    counter.position.set(-4.5, 10.7, -1);
    this.group.add(counter);

    // Cable hanging down over the drop zone
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6, 8), mat);
    cable.position.set(0, 8, -1);
    this.group.add(cable);

    // Hook block
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.2), mat);
    hook.position.set(0, 5, -1);
    this.group.add(hook);
  }
}
