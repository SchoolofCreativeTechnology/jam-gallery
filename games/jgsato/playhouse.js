// The Playhouse stage the run is set on: checkerboard floor, dotted backdrop, curtains, valance,
// clock and toy shelves. It's rebuilt around each course, so every course gets a proper stage.
import * as THREE from 'three';

// Stage measurements, relative to the course's bounds and the stage floor.
const FLOOR_SIZE = 320;     // wide enough that its far edge is always lost in the fog
const FLOOR_TILE = 3.5;     // world units per checker square
const WALL_GAP = 9;         // the backdrop stands this far behind the box
const WALL_HEIGHT = 30;
const CURTAIN_MARGIN = 13;  // the curtains frame the stage this far out from the course's widest point
const CURTAIN_NEAR = 30;    // how far past the start they reach toward the camera
const CURTAIN_HEIGHT = 32;  // tall enough that their tops never enter this steep view
const CURTAIN_THICKNESS = 1.2;
const VALANCE_BOTTOM = 7.3; // heights above the stage floor
const VALANCE_TOP = 12.3;
const FRINGE_Y = 6.9;
const CLOCK_Y = 4.2;
const CLOCK_RADIUS = 2.4;

// Palette.
const FLOOR_PINK = '#c91d62';
const FLOOR_YELLOW = '#f2b72a';
const SEAM_COLOR = 'rgba(26, 6, 40, 0.45)';
const WALL_BLUE = '#1f5fbf';
const DOT_COLORS = ['#ff2f7a', '#ffd23d', '#05d9e8', '#9d4edd', '#ff8500', '#7ee787'];
const CURTAIN_DARK = '#8f0e1c';
const CURTAIN_RED = '#d6203a';
const CURTAIN_HIGHLIGHT = '#ff6a55';
const CURTAIN_SOLID = '#b81527';
const SHELF_WOOD = '#c4783a';
const CLOCK_FACE = '#fdf6e3';
const CLOCK_RIM = '#ffd23d';
const CLOCK_INK = '#2b1a3d';

// Shared toy shapes for the shelves, so every shelf toy reuses one geometry per shape.
const TOY_GEOMETRY = {
  ball: new THREE.SphereGeometry(0.5, 12, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  peg: new THREE.CylinderGeometry(0.4, 0.4, 1, 10),
};
const TOY_COLORS = ['#ff2a6d', '#f7e600', '#05d9e8', '#9d4edd', '#ff8500', '#7ee787'];
const toyMaterials = new Map();
const textures = {};

let stage = null;
let S; // this course's stage layout

export function loadPlayhouse(scene, renderer, bounds) {
  if (stage) {
    scene.remove(stage);
    stage.traverse((o) => { if (o.geometry && !Object.values(TOY_GEOMETRY).includes(o.geometry)) o.geometry.dispose(); });
  }
  const anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const halfSpan = (bounds.maxX - bounds.minX) / 2;
  S = {
    cx,
    floorY: bounds.floorY,
    floorZ: (bounds.minZ + bounds.maxZ) / 2,
    wallZ: bounds.minZ - WALL_GAP,
    wallWidth: Math.max(112, halfSpan * 2 + 90),
    curtainX: halfSpan + CURTAIN_MARGIN,
    curtainNear: bounds.maxZ + CURTAIN_NEAR,
    shelfX: halfSpan + 8,
  };
  stage = new THREE.Group();
  stage.add(createFloor(anisotropy));
  stage.add(createBackWall(anisotropy));
  stage.add(createCurtains(anisotropy));
  stage.add(createValance(anisotropy));
  stage.add(createClock());
  stage.add(createShelves());
  scene.add(stage);
  return stage;
}

function cached(key, make) {
  if (!textures[key]) textures[key] = make();
  return textures[key];
}

// ---- Floor: one big plane of canvas-generated checkerboard squares. ----
function createFloor(anisotropy) {
  const texture = cached('checker', checkerTexture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeats = FLOOR_SIZE / (FLOOR_TILE * 2); // the canvas holds two squares across
  texture.repeat.set(repeats, repeats);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;

  const geometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
  geometry.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }));
  floor.position.set(S.cx, S.floorY, S.floorZ);
  floor.receiveShadow = true;
  return floor;
}

// ---- Backdrop: a blue wall of polka dots closing off the far end of the stage. ----
function createBackWall(anisotropy) {
  const texture = cached('dots', dotTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(S.wallWidth, WALL_HEIGHT),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 })
  );
  wall.position.set(S.cx, S.floorY + WALL_HEIGHT / 2 - 2, S.wallZ);
  wall.receiveShadow = true;
  return wall;
}

// ---- Curtains: one long red pleated box down each side of the stage. ----
function createCurtains(anisotropy) {
  const group = new THREE.Group();
  const far = S.wallZ + 1;
  const length = S.curtainNear - far;

  const pleat = curtainTexture();
  pleat.wrapS = THREE.RepeatWrapping;
  pleat.repeat.set(length / 6, 1); // one canvas (four pleats) every six units
  pleat.colorSpace = THREE.SRGBColorSpace;
  pleat.anisotropy = anisotropy;

  const pleatMaterial = new THREE.MeshStandardMaterial({ map: pleat, roughness: 0.75 });
  const solidMaterial = new THREE.MeshStandardMaterial({ color: CURTAIN_SOLID, roughness: 0.85 });
  // +x, -x, +y, -y, +z, -z. The pleats face the stage; the ends and the top stay plain red.
  const materials = [pleatMaterial, pleatMaterial, solidMaterial, solidMaterial, solidMaterial, solidMaterial];

  for (const side of [-1, 1]) {
    const curtain = new THREE.Mesh(new THREE.BoxGeometry(CURTAIN_THICKNESS, CURTAIN_HEIGHT, length), materials);
    curtain.position.set(S.cx + S.curtainX * side, S.floorY + CURTAIN_HEIGHT / 2, (S.curtainNear + far) / 2);
    group.add(curtain);
  }
  return group;
}

// ---- Valance: the proscenium band across the top of the backdrop, with a beaded fringe. ----
function createValance(anisotropy) {
  const group = new THREE.Group();

  const pleat = curtainTexture();
  pleat.wrapS = THREE.RepeatWrapping;
  pleat.repeat.set(S.wallWidth / 6, 1);
  pleat.colorSpace = THREE.SRGBColorSpace;
  pleat.anisotropy = anisotropy;

  const band = new THREE.Mesh(
    new THREE.BoxGeometry(S.wallWidth, VALANCE_TOP - VALANCE_BOTTOM, 1.2),
    new THREE.MeshStandardMaterial({ map: pleat, roughness: 0.75 })
  );
  band.position.set(S.cx, S.floorY + (VALANCE_BOTTOM + VALANCE_TOP) / 2, S.wallZ + 0.8);
  group.add(band);

  // The fringe is one instanced mesh of beads, so it stays a single draw call.
  const radius = 0.5;
  const spacing = radius * 2.3;
  const count = Math.floor(S.wallWidth / spacing);
  const beads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(radius, 10, 8),
    new THREE.MeshStandardMaterial({ color: CLOCK_RIM, roughness: 0.5 }),
    count
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const x = S.cx - S.wallWidth / 2 + (i + 0.5) * spacing;
    matrix.makeTranslation(x, S.floorY + FRINGE_Y, S.wallZ + 0.9);
    beads.setMatrixAt(i, matrix);
  }
  beads.instanceMatrix.needsUpdate = true;
  group.add(beads);

  return group;
}

// ---- Clock: a painted face, a gold rim and two simple hands. ----
function createClock() {
  const group = new THREE.Group();
  group.position.set(S.cx, S.floorY + CLOCK_Y, S.wallZ + 0.35);

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(CLOCK_RADIUS, 40),
    new THREE.MeshStandardMaterial({ map: cached('clock', clockTexture), roughness: 0.7 })
  );
  group.add(face);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(CLOCK_RADIUS, 0.26, 10, 40),
    new THREE.MeshStandardMaterial({ color: CLOCK_RIM, roughness: 0.35 })
  );
  group.add(rim);

  const handMaterial = new THREE.MeshStandardMaterial({ color: CLOCK_INK, roughness: 0.6 });
  group.add(createHand(1.25, 0.16, Math.PI * 2 * (10 / 12), handMaterial)); // ten o'clock
  group.add(createHand(1.7, 0.12, Math.PI * 2 * (10 / 60), handMaterial));  // ten past

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 10),
    new THREE.MeshStandardMaterial({ color: CLOCK_RIM, roughness: 0.4 })
  );
  cap.position.z = 0.12;
  group.add(cap);

  return group;
}

// One clock hand: a thin bar hanging from the centre at `angle`, measured from twelve o'clock.
function createHand(length, width, angle, material) {
  const hand = new THREE.Mesh(new THREE.BoxGeometry(width, length, 0.07), material);
  hand.position.set(Math.sin(angle) * length / 2, Math.cos(angle) * length / 2, 0.09);
  hand.rotation.z = -angle;
  return hand;
}

// ---- Toy shelves: two units of bright blocks, balls, cones and pegs against the back corners. ----
function createShelves() {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const unit = createShelfUnit();
    unit.position.set(S.cx + S.shelfX * side, S.floorY, S.wallZ + 6);
    unit.rotation.y = -0.3 * side; // turned a little toward the middle of the stage
    group.add(unit);
  }
  return group;
}

function createShelfUnit() {
  const unit = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: SHELF_WOOD, roughness: 0.85 });
  const width = 4.6;
  const height = 4.2;

  const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.3), wood);
  back.position.set(0, height / 2, 0);
  unit.add(back);

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, height, 1.3), wood);
    post.position.set((width / 2 - 0.15) * side, height / 2, 0.5);
    unit.add(post);
  }

  // Two planks, three toys each: shapes and colours cycle so the shelves look stocked.
  const plan = [['ball', 0.5], ['box', 0.62], ['cone', 0.72], ['peg', 0.62], ['box', 0.5], ['ball', 0.42]];
  const planks = [1.25, 2.7];

  planks.forEach((plankY, row) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, 1.3), wood);
    plank.position.set(0, plankY, 0.5);
    unit.add(plank);

    for (let slot = 0; slot < 3; slot++) {
      const [shape, size] = plan[(row * 3 + slot) % plan.length];
      const color = TOY_COLORS[(row * 4 + slot) % TOY_COLORS.length];
      const toy = new THREE.Mesh(TOY_GEOMETRY[shape], toyMaterial(color));
      toy.scale.setScalar(size);
      toy.position.set(-1.4 + slot * 1.4, plankY + 0.125 + size / 2, 0.55);
      toy.rotation.y = row * 0.6 + slot * 0.4;
      unit.add(toy);
    }
  });

  return unit;
}

function toyMaterial(color) {
  let material = toyMaterials.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 });
    toyMaterials.set(color, material);
  }
  return material;
}

// ---- Canvas textures. No image files: every pattern here is drawn at load time. ----

// A 2x2 checker of stage squares with a soft seam, so the tiles read as tiles.
function checkerTexture() {
  const size = 256;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = FLOOR_PINK;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = FLOOR_YELLOW;
  ctx.fillRect(half, 0, half, half);
  ctx.fillRect(0, half, half, half);

  ctx.fillStyle = SEAM_COLOR;
  const seam = 4;
  for (const at of [0, half]) {
    ctx.fillRect(at - seam / 2, 0, seam, size);
    ctx.fillRect(0, at - seam / 2, size, seam);
  }

  return new THREE.CanvasTexture(canvas);
}

// Blue with rows of bright dots, on a grid so the pattern is the same every load.
function dotTexture() {
  const width = 1024;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = WALL_BLUE;
  ctx.fillRect(0, 0, width, height);

  const step = 56;
  let row = 0;
  for (let y = step / 2; y < height; y += step, row++) {
    for (let x = step / 2 + (row % 2 ? step / 2 : 0); x < width; x += step) {
      const cell = row * 13 + Math.round(x / step);
      ctx.fillStyle = DOT_COLORS[cell % DOT_COLORS.length];
      ctx.beginPath();
      ctx.arc(x, y, 7 + (cell % 3) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return new THREE.CanvasTexture(canvas);
}

// Vertical pleats: each fold runs dark, bright, dark, so the curtain reads as folded cloth.
function curtainTexture() {
  const width = 128;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const pleats = 4;
  const pleatWidth = width / pleats;
  for (let i = 0; i < pleats; i++) {
    const fold = ctx.createLinearGradient(i * pleatWidth, 0, (i + 1) * pleatWidth, 0);
    fold.addColorStop(0, CURTAIN_DARK);
    fold.addColorStop(0.35, CURTAIN_RED);
    fold.addColorStop(0.6, CURTAIN_HIGHLIGHT);
    fold.addColorStop(1, CURTAIN_DARK);
    ctx.fillStyle = fold;
    ctx.fillRect(i * pleatWidth, 0, pleatWidth + 1, height);
  }

  return new THREE.CanvasTexture(canvas);
}

// A cream clock face with a ring of dots for the hours.
function clockTexture() {
  const size = 256;
  const centre = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = CLOCK_FACE;
  ctx.beginPath();
  ctx.arc(centre, centre, centre - 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = CLOCK_RIM;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(centre, centre, centre - 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = CLOCK_INK;
  for (let hour = 0; hour < 12; hour++) {
    const angle = (hour / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centre + Math.sin(angle) * (centre - 34), centre - Math.cos(angle) * (centre - 34), hour % 3 === 0 ? 9 : 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
