// The shop (counter, mixing table, three cups, signboard), the wooden pier, and the boat that buys the day's goods.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as T from './tuning.js';

function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
}
function cyl(rTop, rBottom, h, color, seg = 12) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), new THREE.MeshStandardMaterial({ color }));
}

export function createShop(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // SECTION: the shop counter — walking up to this and pressing the craft key starts crafting.
  const counter = box(T.SHOP_COUNTER_WIDTH, T.SHOP_COUNTER_HEIGHT, 0.9, T.SHOP_COUNTER_COLOR);
  counter.position.set(T.SHOP_COUNTER_X, T.SHOP_COUNTER_HEIGHT / 2, T.SHOP_COUNTER_Z);
  const counterTop = box(T.SHOP_COUNTER_WIDTH + 0.3, 0.12, 1.1, T.SHOP_SIGN_POST_COLOR);
  counterTop.position.set(T.SHOP_COUNTER_X, T.SHOP_COUNTER_HEIGHT + 0.06, T.SHOP_COUNTER_Z);
  group.add(counter, counterTop);

  // Two posts and a beam over the counter, so it reads as a stall. A full roof would hide the
  // mixing table and cups from the angled camera, so the beam is kept thin.
  for (const dx of [-1, 1]) {
    const post = box(0.14, 2.1, 0.14, T.SHOP_SIGN_POST_COLOR);
    post.position.set(T.SHOP_COUNTER_X + dx * (T.SHOP_COUNTER_WIDTH / 2 + 0.1), 1.05, T.SHOP_COUNTER_Z);
    group.add(post);
  }
  const beam = box(T.SHOP_COUNTER_WIDTH + 0.4, 0.18, 0.3, '#e88f8f');
  beam.position.set(T.SHOP_COUNTER_X, 2.0, T.SHOP_COUNTER_Z);
  group.add(beam);

  // SECTION: the mixing table with three cups, just behind the counter.
  const tableX = T.SHOP_COUNTER_X;
  const tableZ = T.SHOP_COUNTER_Z - 1.9;
  const table = box(1.8, 1.0, 0.9, T.SHOP_TABLE_COLOR);
  table.position.set(tableX, 0.5, tableZ);
  group.add(table);
  T.SHOP_CUP_COLORS.forEach((c, i) => {
    const cup = cyl(0.16, 0.13, 0.34, c, 10);
    cup.position.set(tableX - 0.55 + i * 0.55, 1.17, tableZ);
    group.add(cup);
  });

  // SECTION: the signboard. Its words are DOM text pinned to the board, so no textures are needed.
  const signPost = box(0.14, 1.7, 0.14, T.SHOP_SIGN_POST_COLOR);
  signPost.position.set(T.SHOP_SIGN_X, 0.85, T.SHOP_SIGN_Z);
  const signBoard = box(2.0, 0.72, 0.1, T.SHOP_SIGN_BOARD_COLOR);
  signBoard.position.set(T.SHOP_SIGN_X, 1.85, T.SHOP_SIGN_Z);
  group.add(signPost, signBoard);
  const signAnchor = new THREE.Vector3(T.SHOP_SIGN_X, 1.85, T.SHOP_SIGN_Z);

  // SECTION: the wooden pier, running from the dry land out into the sea.
  const pierEndZ = T.PIER_START_Z - T.PIER_LENGTH;
  const deck = box(T.PIER_WIDTH, 0.16, T.PIER_LENGTH, T.PIER_COLOR);
  deck.position.set(T.PIER_X, T.PIER_DECK_Y, (T.PIER_START_Z + pierEndZ) / 2);
  group.add(deck);
  for (let i = 0; i <= T.PIER_LENGTH; i += 2) {
    for (const dx of [-1, 1]) {
      const post = cyl(0.11, 0.11, 1.5, T.PIER_POST_COLOR, 8);
      post.position.set(T.PIER_X + dx * (T.PIER_WIDTH / 2 - 0.16), -0.15, T.PIER_START_Z - i);
      group.add(post);
    }
  }

  // SECTION: the boat. It waits far out at sea and sails in to the pier end to buy the day's goods.
  const dockZ = pierEndZ - T.BOAT_DOCK_GAP;
  const sailZ = dockZ - T.BOAT_START_DISTANCE;
  const boat = new THREE.Group();
  const hull = box(2.0, 0.7, 4.2, T.BOAT_COLOR);
  hull.position.y = 0.35;
  const cabin = box(1.1, 0.8, 1.2, T.BOAT_CABIN_COLOR);
  cabin.position.set(0, 1.05, -0.7);
  const mast = cyl(0.05, 0.05, 2.4, T.SHOP_SIGN_POST_COLOR, 6);
  mast.position.set(0, 1.8, 0.8);
  boat.add(hull, cabin, mast);
  boat.position.set(T.PIER_X, T.HIGH_WATER_Y, sailZ);
  boat.visible = false;
  group.add(boat);

  // Swap the plain hull/cabin/mast for the real model if it is there. Missing model: keep the shapes
  // and log one message. The boat still sails in and docks either way.
  new GLTFLoader().load(
    T.BOAT_MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const size = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getSize(size);
      const longest = Math.max(size.x, size.z, 0.001);
      model.scale.setScalar(T.BOAT_MODEL_LENGTH / longest);
      model.rotation.y = T.BOAT_MODEL_YAW;
      model.updateMatrixWorld(true);
      model.position.y -= new THREE.Box3().setFromObject(model).min.y;   // hull sits on the water line
      boat.remove(hull, cabin, mast);
      boat.add(model);
    },
    undefined,
    () => {
      if (window.__glbFallbackLogged) return;
      window.__glbFallbackLogged = true;
      console.info('Boat model not found; using fallback shapes.');
    }
  );

  let boatActive = false;

  function isNearCounter(p) {
    return Math.hypot(p.x - T.SHOP_COUNTER_X, p.z - T.SHOP_COUNTER_Z) <= T.CRAFT_RADIUS;
  }

  function sendBoat() {
    boatActive = true;
    boat.visible = true;
    boat.position.set(T.PIER_X, T.HIGH_WATER_Y, sailZ);
  }

  // Sails the boat toward the pier at a constant speed; calls onArrive once when it gets there.
  function updateBoat(dt, onArrive) {
    if (!boatActive) return;
    boat.position.z = Math.min(dockZ, boat.position.z + T.BOAT_SAIL_SPEED * dt);
    boat.position.y = T.HIGH_WATER_Y + Math.sin(performance.now() * 0.003) * 0.05;   // gentle bob
    if (boat.position.z >= dockZ) { boatActive = false; onArrive(); }
  }

  function reset() {
    boatActive = false;
    boat.visible = false;
    boat.position.set(T.PIER_X, T.HIGH_WATER_Y, sailZ);
  }

  return { group, signAnchor, isNearCounter, sendBoat, updateBoat, reset, isBoatActive: () => boatActive };
}
