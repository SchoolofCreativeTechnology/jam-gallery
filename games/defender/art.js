// art.js — hand-built low-poly shapes for the stone archer tower, the goblins and the arrows.
// Everything is made from three.js primitives so it loads instantly; a Blender pass can replace it later.
import * as THREE from 'three';

const stone = new THREE.MeshStandardMaterial({ color: '#5d675e', roughness: 0.95, flatShading: true });
const stoneLight = new THREE.MeshStandardMaterial({ color: '#7f8a7c', roughness: 0.95, flatShading: true });
const slate = new THREE.MeshStandardMaterial({ color: '#3c4440', roughness: 0.9, flatShading: true });
const windowDark = new THREE.MeshStandardMaterial({ color: '#120c08', roughness: 1 });
const windowLit = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8a1f', emissiveIntensity: 1.2 });
const wood = new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.9, flatShading: true });
const moss = new THREE.MeshStandardMaterial({ color: '#5f7a3a', roughness: 1, flatShading: true });

// Stone archer tower. Pivot at the bottom centre; +Z is the side it shoots from.
// Seen from straight above, the roof is kept small so the stone ring and windows show around it.
export function makeTower() {
  const tower = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 2.2, 8), stone);
  body.position.y = 1.1;
  tower.add(body);

  // Chunky ring of stone blocks around the middle.
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.45), i % 2 ? stone : stoneLight);
    block.position.set(Math.sin(angle) * 1.55, 1.25 + (i % 3) * 0.05, Math.cos(angle) * 1.55);
    block.rotation.y = angle;
    tower.add(block);
  }

  // Upper storey and a small pointed slate roof.
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 1.0, 8), stoneLight);
  upper.position.y = 2.7;
  tower.add(upper);
  const eave = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 8), slate);
  eave.position.y = 3.35;
  tower.add(eave);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.4, 8), slate);
  roof.position.y = 3.95;
  tower.add(roof);

  // Arched windows all round; the one facing +Z glows, so you can read the aim from above.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.2), i === 0 ? windowLit : windowDark);
    win.position.set(Math.sin(angle) * 1.1, 2.7, Math.cos(angle) * 1.1);
    win.rotation.y = angle;
    tower.add(win);
  }

  // Wooden archer's ledge under the firing window: points where the arrows go.
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 1.1), wood);
  ledge.position.set(0, 2.25, 1.55);
  tower.add(ledge);

  // Moss at the foot.
  const mossRing = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.12, 8), moss);
  mossRing.position.y = 0.06;
  tower.add(mossRing);

  return tower;
}

// Where arrows leave the tower, in the tower's own frame.
export const TOWER_MUZZLE_HEIGHT = 2.3;
export const TOWER_MUZZLE_Z = 2.0;

// Goblin: about 1 unit in radius so the game can scale it like the old drone.
// The eyes use the material named `glowName`, so red enemies and the boss get tinted eyes.
const goblinSkin = new THREE.MeshStandardMaterial({ color: '#6f8f5c', roughness: 0.85, flatShading: true });
const goblinDark = new THREE.MeshStandardMaterial({ color: '#4a5e3e', roughness: 0.9, flatShading: true });
const horn = new THREE.MeshStandardMaterial({ color: '#c9cfbf', roughness: 0.7, flatShading: true });
const hammerHead = new THREE.MeshStandardMaterial({ color: '#8d939a', roughness: 0.6, metalness: 0.3, flatShading: true });

export function makeGoblin(glowName) {
  const goblin = new THREE.Group();

  const eyeGlow = new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffd21f', emissiveIntensity: 1.6 });
  eyeGlow.name = glowName;

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), goblinSkin);
  body.scale.set(1, 0.85, 0.9);
  body.position.y = -0.2;
  goblin.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 6), goblinSkin);
  head.position.set(0, 0.45, 0.2);
  goblin.add(head);

  // Two tall horns and two long ears: the shapes that read from straight above.
  for (const side of [-1, 1]) {
    const hornMesh = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.75, 5), horn);
    hornMesh.position.set(side * 0.28, 0.95, 0.1);
    hornMesh.rotation.z = -side * 0.35;
    goblin.add(hornMesh);

    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 4), goblinDark);
    ear.position.set(side * 0.62, 0.45, 0.15);
    ear.rotation.z = side * 1.35;
    goblin.add(ear);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), eyeGlow);
    eye.position.set(side * 0.17, 0.52, 0.63);
    goblin.add(eye);
  }

  // A stubby hammer on one side.
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), wood);
  handle.position.set(0.75, -0.15, 0.2);
  goblin.add(handle);
  const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.3), hammerHead);
  headBox.position.set(0.75, -0.15, 0.6);
  goblin.add(headBox);

  return goblin;
}

// Wall: a short stone pillar the player places to block enemies.
export function makeWall() {
  const wall = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 1.6, 8), stone);
  pillar.position.y = 0.8;
  wall.add(pillar);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 8), slate);
  cap.position.y = 1.7;
  wall.add(cap);
  const mossPatch = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.15, 8), moss);
  mossPatch.position.y = 0.08;
  wall.add(mossPatch);
  return wall;
}

// Arrow: a pale shaft with a grey tip and white fletching, pointing along +Z.
const shaftMat = new THREE.MeshBasicMaterial({ color: '#f1e3c2' });
const tipMat = new THREE.MeshBasicMaterial({ color: '#d7dde3' });
const fletchMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const shaftGeo = new THREE.BoxGeometry(0.07, 0.07, 1.0);
const tipGeo = new THREE.ConeGeometry(0.11, 0.28, 4);
tipGeo.rotateX(Math.PI / 2); // cone points along +Z
const fletchGeo = new THREE.BoxGeometry(0.28, 0.03, 0.22);

export function makeArrow() {
  const arrow = new THREE.Group();
  arrow.add(new THREE.Mesh(shaftGeo, shaftMat));
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.z = 0.6;
  arrow.add(tip);
  const fletch = new THREE.Mesh(fletchGeo, fletchMat);
  fletch.position.z = -0.42;
  arrow.add(fletch);
  return arrow;
}
