// The survey ship: a Space Shuttle orbiter built from three.js primitives and two textures drawn in code,
// plus where it sits over the ground and the steering the player does.
import * as THREE from 'three';
import * as T from './tuning.js';
import { terrainHeightAt } from './terrain.js';

// Shape-only numbers, in metres, in the ship's own frame: +x right, +y up, -z forward (the nose).
// They only fix the silhouette. The size the game plays with comes from tuning.js, and obstacles.js tests
// a rock against a box of half T.SHIP_WIDTH, half T.SHIP_HEIGHT and half T.SHIP_LENGTH about this origin:
// 1.6 out, 0.45 up and down, 1.8 fore and aft. Every part below has to stay inside that.
const HULL = [0.86, 0.32, 2.70];    // fuselage: across, tall, long
const HULL_Z = 0.05;                // the fuselage sits a little aft of the origin, so the ship straddles y = 0
const BELLY = [0.90, 0.06, 2.74];   // the black underside patch: a lip a little wider than the fuselage
const BELLY_Y = -0.155;             // just under the fuselage, so the belly reads black from the side too
const NOSE = [0.47, 0.175, 0.34];   // the black nose cap: a flattened dome over the fuselage front
const NOSE_Z = -1.44;
// A delta wing, as the three corners of its outline in (out from the centre, along the ship): root leading
// edge, tip, root trailing edge. The sweep from the first corner to the second is what reads as a shuttle
// from behind; the third closes the trailing edge back to the fuselage.
const WING = [[0.36, -0.72], [1.50, 0.42], [0.36, 1.00]];
const WING_T = 0.07;                // wing thickness: thin, so the wing is an edge from behind
const WING_Y = 0.03;                // where the wing meets the fuselage, a little above the centre line
const WING_VEE = 0.10;              // radians the wing tips lift: the orbiter's shallow vee
const EDGE = [0.06, 0.075];         // black leading-edge strip: across, and a little proud of the wing
// The tail fin, as (height above the ship's centre, how far back) corners. It is extruded sideways.
const FIN = [[0.10, 0.55], [0.42, 0.95], [0.42, 1.30], [0.10, 1.25]];
const FIN_T = 0.06;
const FIN_EDGE = 0.06;              // depth of the black strip down the fin's trailing edge
const POD = [0.30, 0.22, 0.58];     // OMS pods either side of the fin base
const POD_X = 0.43, POD_Y = 0.12, POD_Z = 1.12;
const BELL_R = 0.13, BELL_L = 0.26; // main engine bells: exit radius, length; the closest thing to the camera
const BELL_X = 0.17, BELL_Z = 1.42;
const BAY = [0.56, 0.03, 1.70];     // the lit payload bay strip along the spine
const BAY_Y = 0.155, BAY_Z = -0.30;
const DOOR = [0.28, 0.02];          // payload bay doors: width, thickness
const DOOR_OPEN = 1.05;             // radians they swing up from a hinge along the bay's outer edge (60 degrees
                                    // shows the lit strip between them; any wider and the doors hit the height box)

// A grid of squares drawn in code: the orbiter's thermal tiles. The white body and the black underside use
// the same grid with different colours, and each square is nudged in lightness so the tiling reads at a
// distance. cellsX and cellsY differ because a box face maps the whole texture over both of its sides, so
// the column count is set to keep the tiles roughly square on the wide, flat faces the camera looks down on.
function tileTexture(base, spread, cellsX, cellsY) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;                  // the gap left between squares is the tile seam
  ctx.fillRect(0, 0, size, size);
  const cellX = size / cellsX;
  const cellY = size / cellsY;
  const tint = new THREE.Color();
  for (let row = 0; row < cellsY; row++) {
    for (let col = 0; col < cellsX; col++) {
      const shade = (Math.random() - 0.5) * spread;
      ctx.fillStyle = '#' + tint.set(base).offsetHSL(0, 0, shade).getHexString();
      ctx.fillRect(col * cellX, row * cellY, cellX - 1, cellY - 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// T.SHIP_COLOR is the white body. Every black part (nose cap, underside, leading edges, fin trailing edge,
// nozzle throats) is T.SHIP_NOSE_COLOR taken far down to a tile black, so the ship's dark side still comes
// out of the game's palette while reading black, as it does in the makers' photo of Discovery.
const BLACK = '#' + new THREE.Color(T.SHIP_NOSE_COLOR).multiplyScalar(0.06).getHexString();
const skin = new THREE.MeshStandardMaterial({ map: tileTexture(T.SHIP_COLOR, 0.10, 4, 12), flatShading: true });
// Wings and fin are extruded shapes, so their texture coordinates run in metres and the grid is square.
const wingSkin = new THREE.MeshStandardMaterial({ map: tileTexture(T.SHIP_COLOR, 0.10, 8, 8), flatShading: true });
const dark = new THREE.MeshStandardMaterial({ map: tileTexture(BLACK, 0.16, 8, 8), flatShading: true });
const engine = new THREE.MeshStandardMaterial({ color: '#6f7681', flatShading: true });
const lit = new THREE.MeshBasicMaterial({ color: '#fff3d4' });   // unlit, so the bay reads as switched on

// A flat shape: a polygon laid out in the ship's XZ plane, given a little thickness in y, hung from the
// mesh's own y. ExtrudeGeometry draws it in its own XY plane, so rotating it about x stands it down flat
// and the shape's y becomes the ship's z: a wing outline can be written straight down in metres.
function slab(points, thickness) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

// The engine flame: two cones at each bell mouth — a broad warm shell with a hot core inside it — lit by nothing
// at all and drawn additively over the scene, which is what makes them read as light rather than as geometry.
// Depth writing is off so the two cones never fight over the same pixels. The pair of materials is shared by
// every flame, so the whole effect costs four more draw calls and no textures.
const flameShell = new THREE.MeshBasicMaterial({
  color: '#ff9435', transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});
const flameCore = new THREE.MeshBasicMaterial({
  color: '#fff0c2', transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});

const flames = [];   // one per engine, in the order the engine loop builds them

// One flame, as a group sitting on its nozzle's mouth. The group's own z IS the flame's length, so stretching the
// group along z lengthens the exhaust without moving the point it leaves the bell from. Each cone is turned a
// quarter turn so its point aims back down the tail, and pushed half its own height forward, which lands its
// wide base exactly on the nozzle mouth the group was placed at.
function flameAt(x, y, z, radius) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  for (const [material, r] of [[flameShell, radius], [flameCore, radius * T.FLAME_CORE]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1, 12, 1, true), material);
    cone.rotation.x = Math.PI / 2;
    cone.position.z = 0.5;
    group.add(cone);
  }
  group.scale.z = T.FLAME_LENGTH;
  return group;
}

export const ship = new THREE.Group();

// Fuselage: a white box, slightly flattened, with the black underside as its own bottom face.
const hull = new THREE.Mesh(
  new THREE.BoxGeometry(...HULL),
  [skin, skin, skin, dark, skin, skin]   // +x, -x, +y, -y (the belly), +z, -z
);
hull.position.set(0, 0, HULL_Z);
ship.add(hull);

const belly = new THREE.Mesh(new THREE.BoxGeometry(...BELLY), dark);
belly.position.set(0, BELLY_Y, HULL_Z);
ship.add(belly);

// Nose: a flattened dome of black tiles, set into the front of the body where the fuselage face is.
const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), dark);
nose.scale.set(...NOSE);
nose.position.set(0, 0, NOSE_Z);
ship.add(nose);

// Payload bay: a lit strip along the spine with the two doors hinged open over it. The chase camera looks
// down at the back of the ship, so this is one of the surfaces the player actually stares at.
const bay = new THREE.Mesh(new THREE.BoxGeometry(...BAY), lit);
bay.position.set(0, BAY_Y, BAY_Z);
ship.add(bay);

for (const side of [1, -1]) {
  // The wing: its own outline mirrored either side, in a group that carries the vee of the tips.
  const wing = new THREE.Group();
  wing.position.y = WING_Y;
  wing.rotation.z = side * WING_VEE;
  const [rootFront, tip, rootBack] = WING.map(([x, z]) => [side * x, z]);
  wing.add(new THREE.Mesh(slab([rootFront, tip, rootBack], WING_T), wingSkin));
  // The black leading edge: a strip laid along the edge those same two corners define, so the sweep of the
  // wing and the sweep of its black edge can never drift apart.
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(EDGE[0], EDGE[1], Math.hypot(tip[0] - rootFront[0], tip[1] - rootFront[1])),
    dark
  );
  edge.position.set((rootFront[0] + tip[0]) / 2, 0, (rootFront[1] + tip[1]) / 2);
  edge.rotation.y = Math.atan2(tip[0] - rootFront[0], tip[1] - rootFront[1]);   // along the leading edge
  wing.add(edge);
  ship.add(wing);

  // A payload bay door, hinged along the bay's outer edge and swung up and open over the lit strip.
  const doorGeometry = new THREE.BoxGeometry(DOOR[0], DOOR[1], BAY[2]);
  doorGeometry.translate(-side * DOOR[0] / 2, 0, 0);   // move the hinge to the mesh's own origin
  const door = new THREE.Mesh(doorGeometry, skin);
  door.position.set(side * BAY[0] / 2, BAY_Y + 0.01, BAY_Z);   // hinged on the bay's outer edge
  door.rotation.z = -side * DOOR_OPEN;
  ship.add(door);

  // The OMS pod on that side of the fin base, with its small nozzle facing back.
  const pod = new THREE.Mesh(new THREE.BoxGeometry(...POD), skin);
  pod.position.set(side * POD_X, POD_Y, POD_Z);
  const podNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.10, 8), engine);
  podNozzle.rotation.x = Math.PI / 2;                  // the axis of the nozzle runs fore and aft
  podNozzle.position.set(side * POD_X, POD_Y, POD_Z + POD[2] / 2 + 0.05);
  ship.add(pod, podNozzle);

  // A main engine: a grey bell facing the camera with a black throat set into its mouth.
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(BELL_R, 0.085, BELL_L, 12), engine);
  bell.rotation.x = Math.PI / 2;                       // the wide end faces back at the camera
  bell.position.set(side * BELL_X, 0, BELL_Z);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(BELL_R * 0.8, 12), dark);
  throat.position.set(side * BELL_X, 0, BELL_Z + BELL_L / 2 + 0.01);
  // The exhaust, leaving the bell's mouth and reaching back past the throat's black ring — the part of the ship
  // the chase camera stares at all run.
  const flame = flameAt(side * BELL_X, 0, BELL_Z + BELL_L / 2, BELL_R * T.FLAME_WIDTH);
  flames.push(flame);
  ship.add(bell, throat, flame);
}

// The vertical tail fin, standing up in the ship's YZ plane: a second quarter turn stands the flat outline
// upright, and then its first number is the height and its second is how far back.
const finGeometry = slab(FIN, FIN_T);
finGeometry.rotateZ(Math.PI / 2);
const fin = new THREE.Mesh(finGeometry, wingSkin);
fin.position.x = -FIN_T / 2;
ship.add(fin);

// The black strip down the fin's trailing edge, leaning with that edge's own two corners.
const [finBaseY, finBaseZ] = FIN[3];
const [finTopY, finTopZ] = FIN[2];
const finEdge = new THREE.Mesh(
  new THREE.BoxGeometry(FIN_T + 0.02, Math.hypot(finTopY - finBaseY, finTopZ - finBaseZ), FIN_EDGE),
  dark
);
finEdge.position.set(0, (finBaseY + finTopY) / 2, (finBaseZ + finTopZ) / 2);
finEdge.rotation.x = Math.atan2(finTopZ - finBaseZ, finTopY - finBaseY);
ship.add(finEdge);

// Altitude is height above the ground under the ship, not above zero, so low means low on the hills too.
// The ship's z never changes: the world comes to the ship.
let altitude = T.START_ALTITUDE;

// Where the exhaust's flicker has got to. It runs on its own clock rather than on the ship's, so it keeps
// wobbling while the ship is held perfectly still.
let flamePhase = 0;

export function resetShip() {
  altitude = T.START_ALTITUDE;
  ship.position.x = 0;
  ship.position.z = 0;
  ship.position.y = terrainHeightAt(0, 0) + altitude;
  ship.rotation.set(0, 0, 0);
}

// input is { steer, vertical }, each from -1 (left / down) to 1 (right / up), from the keyboard or a held pointer.
// `flyCeiling` is how high this world lets the ship climb, and it defaults to ALTITUDE_HIGH so every world but a
// cave keeps the sky it had. A world with a roof passes tuning.js's CAVE_FLY_CEILING instead: the roof itself sits
// above that, so the ship and the camera under it both stay inside the cave.
export function updateShip(dt, input, flyCeiling) {
  const top = flyCeiling || T.ALTITUDE_HIGH;
  ship.position.x = Math.max(-T.STEER_LIMIT, Math.min(T.STEER_LIMIT, ship.position.x + input.steer * T.STEER_SPEED * dt));
  altitude = Math.max(T.ALTITUDE_LOW, Math.min(top, altitude + input.vertical * T.CLIMB_SPEED * dt));

  const restY = terrainHeightAt(ship.position.x, ship.position.z) + altitude;
  const ease = 1 - Math.exp(-T.ALTITUDE_FOLLOW * dt);   // frame-rate-independent smoothing
  ship.position.y += (restY - ship.position.y) * ease;

  const tilt = 1 - Math.exp(-T.SHIP_TILT_SPEED * dt);
  ship.rotation.z += (-input.steer * T.SHIP_BANK - ship.rotation.z) * tilt;   // roll into the turn
  ship.rotation.x += (input.vertical * T.SHIP_PITCH - ship.rotation.x) * tilt; // nose up when climbing

  // The exhaust, driven by the same input the engine is: it stretches when the ship climbs, eases off when it
  // dives, and flickers on its own clock, so the flame is a readout of what the engine is doing and never looks
  // like a solid cone bolted to the tail.
  flamePhase += dt * T.FLAME_RATE;
  const burn = 1 + T.FLAME_BURN * input.vertical;
  for (let i = 0; i < flames.length; i++) {
    const flicker = 1 + T.FLAME_FLICKER * Math.sin(flamePhase + i * 2.4);   // the two engines are out of step
    flames[i].scale.z = T.FLAME_LENGTH * burn * flicker;
  }
}
