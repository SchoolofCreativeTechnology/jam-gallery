// A tiny alien that gives a thumbs-up when you win. Built from primitives.
import * as THREE from 'three';

export default class Alien {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.time = 0;
    this.build();
    scene.add(this.group);
  }

  build() {
    const skin = new THREE.MeshStandardMaterial({ color: '#7bd97b', roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.5 });

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), skin);
    body.scale.y = 1.2;
    body.position.y = 0.6;
    this.group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), skin);
    head.position.y = 1.25;
    this.group.add(head);

    // Eyes
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), dark);
    leftEye.position.set(-0.14, 1.32, 0.32);
    this.group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), dark);
    rightEye.position.set(0.14, 1.32, 0.32);
    this.group.add(rightEye);

    // Raised arm
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 12), skin);
    arm.position.set(0.45, 1.1, 0);
    arm.rotation.z = -Math.PI / 3;
    this.group.add(arm);

    // Thumb up (a small box on top of the arm)
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), skin);
    thumb.position.set(0.65, 1.35, 0);
    this.group.add(thumb);
  }

  show(y) {
    this.group.visible = true;
    this.group.position.set(2.2, y, 0);
  }

  hide() {
    this.group.visible = false;
  }

  update(dt) {
    if (!this.group.visible) return;
    this.time += dt;
    // Cheerful bob
    this.group.position.y += Math.sin(this.time * 8) * 0.003;
    // Slow spin
    this.group.rotation.y += dt * 1.5;
  }
}
