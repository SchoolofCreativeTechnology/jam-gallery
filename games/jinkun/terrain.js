// The ground the ship skims: one repeating ground tile whose shape, vertex colours and painted detail texture
// are all rebuilt from the world in planets.js when a run launches, so each world reads as its own place.
import * as THREE from 'three';
import * as T from './tuning.js';

const TAU = Math.PI * 2;
// A painted feature near a texture edge is drawn at all nine whole-canvas offsets, which carries the part that
// runs off one side back in on the other; one well inside the tile needs a single pass.
const INSIDE_OFFSETS = [[0, 0]];
const WRAP_OFFSETS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]];

// --- the shape ---------------------------------------------------------------

// What the ground is shaped like: the title screen's plain rolling ground until a world is launched.
let shape = T.TERRAIN_DEFAULT;

// The surface of one tile at a point inside it, in metres. Periodic in z with period GROUND_TILE_LENGTH (the wave
// below uses whole numbers of cycles per tile), which is what lets the tiles join; x only shifts and scales the
// pattern, and is free. Also the exact height the ship, the rocks and the draw all agree on.
function tileHeight(x, z) {
  const p = shape;
  const u = z / T.GROUND_TILE_LENGTH;   // 0 to 1 across one tile: one whole tile is one repeat of the shape

  // Sideways: the same ridges are allowed to grow and shrink across the strip, never to move it out of step.
  const across = 1 - p.xDepth * (1 - Math.cos(x * p.xFrequency)) / 2;

  // Rolling part: one wave, with a second harmonic that leans it over where the world has dunes.
  const phase = TAU * p.zFrequency * u;
  const roll = (Math.cos(phase) + p.skew * Math.cos(phase * 2 + 1)) / (1 + Math.abs(p.skew));

  // Jagged part: octaves of a ridged wave. 1 - |sin| is a repeating ridge whose crest sits at u = 0, so the first
  // octave stands up where the rolling part does; each octave doubles the frequency, takes a fixed fraction of the
  // strength (TERRAIN_OCTAVE_DECAY), and is offset from the last by `fracture`, which is what puts cracks on the
  // flanks instead of only on the crests.
  let ridge = 0;
  let weight = 1;
  let total = 0;
  let harmonic = p.zFrequency;
  for (let octave = 0; octave < p.octaves; octave++) {
    const crest = 1 - Math.abs(Math.sin(Math.PI * harmonic * u + p.fracture * octave));
    ridge += Math.pow(crest, p.ridgeSharpness) * weight;
    total += weight;
    weight *= T.TERRAIN_OCTAVE_DECAY;
    harmonic *= 2;
  }
  const jagged = total > 0 ? (2 * ridge) / total - 1 : 0;

  let mixed = p.rollMix * roll + (1 - p.rollMix) * jagged;
  // Flat tops: tanh squashes the wave against its own crests and troughs, which is what a mesa looks like.
  if (p.flatTops > 0) {
    const squashed = Math.tanh(mixed * T.TERRAIN_FLAT_TOP_GAIN) / Math.tanh(T.TERRAIN_FLAT_TOP_GAIN);
    mixed += (squashed - mixed) * p.flatTops;
  }
  return p.amplitude * across * mixed;
}

// --- the vertex colours ------------------------------------------------------

const lowColor = new THREE.Color();
const midColor = new THREE.Color();
const highColor = new THREE.Color();
const steepColor = new THREE.Color();
const painted = new THREE.Color();

// 0 below the band, 1 above it, smooth in between. Every band in planets.js is read through this.
function smoothstep(edge0, edge1, v) {
  const span = edge1 - edge0;
  if (span <= 0) return v >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (v - edge0) / span));
  return t * t * (3 - 2 * t);
}

// Paint every vertex of a tile: its own world's colour low down, its surface colour over most of it, a bright
// colour at the top, and the bare-material colour wherever the face is steep enough to show it. The height bands
// are read against the tile's own lowest and highest ground, so they always spread over the range this world has.
function paintVertices(geometry, low, high, shade) {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const count = positions.count;
  const colors = new Float32Array(count * 3);

  // How steep a face is, 0 flat to 1 vertical. On a ground this wide open the steepest face is still a gentle
  // slope, so the steep band is read against this world's own steep faces — its 90th-percentile slope — rather
  // than against a vertical wall no world here ever has.
  const slopes = new Float32Array(count);
  for (let i = 0; i < count; i++) slopes[i] = 1 - Math.max(0, Math.min(1, normals.getY(i)));
  const ranked = Float32Array.from(slopes).sort();
  const steepest = ranked[Math.min(count - 1, Math.floor(count * T.TERRAIN_STEEP_PERCENTILE))];
  const steepReference = 1 / Math.max(1e-4, steepest);

  lowColor.set(shade.low);
  midColor.set(shade.mid);
  highColor.set(shade.high);
  steepColor.set(shade.steep);
  const span = Math.max(1e-6, high - low);   // guards a dead-flat world against dividing by zero
  for (let i = 0; i < count; i++) {
    const height = (positions.getY(i) - low) / span;   // 0 at the lowest ground, 1 at the highest
    const slope = slopes[i] * steepReference;          // 1 on this world's own steep faces, more where steeper
    painted.copy(lowColor)
      .lerp(midColor, smoothstep(shade.lowBand[0], shade.lowBand[1], height))
      .lerp(highColor, smoothstep(shade.highBand[0], shade.highBand[1], height))
      .lerp(steepColor, smoothstep(shade.steepBand[0], shade.steepBand[1], slope));
    colors[i * 3] = painted.r;
    colors[i * 3 + 1] = painted.g;
    colors[i * 3 + 2] = painted.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// --- the painted detail ------------------------------------------------------

// A short line, drawn once or at all nine whole-canvas offsets (see the note at the top of the file).
function drawStroke(ctx, size, points, style, width) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  const outside = minX < 0 || minY < 0 || maxX > size || maxY > size;
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  for (const [dx, dy] of (outside ? WRAP_OFFSETS : INSIDE_OFFSETS)) {
    ctx.beginPath();
    ctx.moveTo(points[0].x + dx * size, points[0].y + dy * size);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x + dx * size, points[i].y + dy * size);
    ctx.stroke();
  }
}

// The same for an ellipse: a leaf clump, a rock patch, a speck of grit.
function drawBlob(ctx, size, x, y, rx, ry, fill, rotation) {
  const outside = x - rx < 0 || y - ry < 0 || x + rx > size || y + ry > size;
  ctx.fillStyle = fill;
  for (const [dx, dy] of (outside ? WRAP_OFFSETS : INSIDE_OFFSETS)) {
    ctx.beginPath();
    ctx.ellipse(x + dx * size, y + dy * size, rx, ry, rotation || 0, 0, TAU);
    ctx.fill();
  }
}

// Ice cracks: jittered walks across the tile, a cyan seam with a white lip beside it, on crystalline grain.
function paintIce(ctx, size) {
  for (let crack = 0; crack < 20; crack++) {
    const points = [];
    let x = Math.random() * size;
    let y = Math.random() * size;
    let angle = Math.random() * TAU;
    for (let step = 0; step < 9; step++) {
      points.push({ x, y });
      angle += (Math.random() - 0.5) * 0.9;
      const run = size * (0.06 + Math.random() * 0.09);
      x += Math.cos(angle) * run;
      y += Math.sin(angle) * run;
    }
    drawStroke(ctx, size, points, 'rgba(96,168,196,0.75)', 1.6);
    drawStroke(ctx, size, points.map((p) => ({ x: p.x + 1.2, y: p.y + 1.2 })), 'rgba(255,255,255,0.85)', 0.9);
  }
  for (let i = 0; i < 200; i++) {
    drawBlob(ctx, size, Math.random() * size, Math.random() * size, 0.9, 0.9, 'rgba(255,255,255,0.8)');
  }
}

// Desert ripples: long shallow waves running across the track, each with a lit crest in front of it. The wobble
// is a function of the row's own height, not of the row's number, so a row and its wrapped copy stay identical.
function paintDesert(ctx, size) {
  const rows = 24;
  const spacing = size / rows;
  for (let i = 0; i < rows; i++) {
    const base = (i + 0.5) * spacing;
    const points = [];
    for (let s = 0; s <= 10; s++) {
      const x = (s / 10) * size;
      points.push({ x, y: base + Math.sin((x / size) * TAU * 2 + (base / size) * TAU) * spacing * 0.4 });
    }
    drawStroke(ctx, size, points, 'rgba(170,132,84,0.6)', 1.5);
    drawStroke(ctx, size, points.map((p) => ({ x: p.x, y: p.y + 1.8 })), 'rgba(255,255,255,0.8)', 0.9);
  }
  for (let i = 0; i < 260; i++) {
    drawBlob(ctx, size, Math.random() * size, Math.random() * size, 0.7, 0.7,
      Math.random() < 0.5 ? 'rgba(140,108,66,0.5)' : 'rgba(255,255,255,0.7)');
  }
}

// Jungle mottle: overlapping clumps of canopy, lighter tops over darker undersides, with unlit gaps between them.
function paintJungle(ctx, size) {
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rx = size * (0.02 + Math.random() * 0.06);
    const ry = rx * (0.5 + Math.random() * 0.7);
    drawBlob(ctx, size, x, y, rx, ry, 'rgba(70,110,60,0.35)', Math.random() * Math.PI);
    drawBlob(ctx, size, x - rx * 0.2, y - ry * 0.25, rx * 0.7, ry * 0.6, 'rgba(150,190,120,0.3)', Math.random() * Math.PI);
  }
  for (let i = 0; i < 60; i++) {
    drawBlob(ctx, size, Math.random() * size, Math.random() * size, size * 0.008, size * 0.013,
      'rgba(30,50,25,0.4)', Math.random() * Math.PI);
  }
}

// Alpine grain: grey rock showing through, over short strokes of grass standing at every angle.
function paintAlpine(ctx, size) {
  for (let i = 0; i < 30; i++) {
    const rx = size * (0.02 + Math.random() * 0.05);
    drawBlob(ctx, size, Math.random() * size, Math.random() * size, rx, rx * (0.5 + Math.random() * 0.4),
      'rgba(120,124,124,0.35)', Math.random() * Math.PI);
  }
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const angle = (Math.random() - 0.5) * 0.6;
    const run = size * (0.008 + Math.random() * 0.02);
    drawStroke(ctx, size, [{ x, y }, { x: x + Math.cos(angle) * run, y: y + Math.sin(angle) * run }],
      Math.random() < 0.5 ? 'rgba(90,140,70,0.5)' : 'rgba(255,255,255,0.6)', 0.8);
  }
}

// Each world's pattern sits over a slightly different pale base, so the grain still reads as that world's surface.
const BASE_COLOR = { ice: '#f1f9fd', desert: '#fdf5e8', jungle: '#eff4e9', alpine: '#f3f6ee' };
const PAINTERS = { ice: paintIce, desert: paintDesert, jungle: paintJungle, alpine: paintAlpine };

// One square of painted detail, drawn in code — the game loads no image files. It is near white, so it multiplies
// the vertex colours and only adds grain, and it repeats a whole number of times along the tile, so the detail
// still lines up across the joins as the ground scrolls. Its pixels are read back below, so this one painting is
// also the source of the ground's relief and its roughness: all three maps show the same cracks and the same grain.
function paintDetail(kind) {
  const size = T.GROUND_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.fillStyle = BASE_COLOR[kind];
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = T.GROUND_DETAIL_STRENGTH;   // how far the pattern is allowed to bite into the surface colour
  PAINTERS[kind](ctx, size);
  ctx.globalAlpha = 1;
  return canvas;
}

// One texture over one of those canvases. Every map the ground gets repeats the same whole number of times
// across and along the tile and wraps the same way, so the colour, the relief and the roughness stay locked to
// each other while the ground scrolls; if they drifted apart the relief would slide over the colour.
function detailTexture(canvas, srgb) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(T.GROUND_DETAIL_REPEAT_X, T.GROUND_DETAIL_REPEAT_Z);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;   // colour carries colour; the data maps below must not
  texture.needsUpdate = true;   // colourSpace and repeat are read when the texture is uploaded
  return texture;
}

// The painted pixels read back as a height field: how bright a pixel is, is how high the ground stands there.
function detailHeights(canvas, size) {
  const pixels = canvas.getContext('2d').getImageData(0, 0, size, size).data;
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i++) {
    // Rec. 601 luminance over the composited pixels, 0 to 1: a crack, an unlit gap or a grey rock patch reads
    // dark, so it comes out as a groove under the ice, the sand and the canopy around it.
    height[i] = (0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]) / 255;
  }
  return height;
}

// That height field as a normal map, in the usual tangent-space encoding, so a painted crack is a real groove
// under the sun and a ripple crest really catches it. Each pixel takes the difference between its neighbours
// and wraps at the edge, so the map has no seam where the ground tiles. The one sign worth watching is the
// vertical: canvas y runs down the image while the texture's v runs up it, because three flips a canvas texture
// as it uploads it.
function reliefCanvas(height, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const pixel = (x, y) => height[y * size + x];
  const span = T.GROUND_RELIEF_STRENGTH;   // how far one step up in brightness tilts the surface
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = -(pixel((x + 1) % size, y) - pixel((x + size - 1) % size, y)) * span;
      const ny = (pixel(x, (y + 1) % size) - pixel(x, (y + size - 1) % size)) * span;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);   // the normal, before it is packed into 0-255
      const i = (y * size + x) * 4;
      image.data[i] = (nx * inv * 0.5 + 0.5) * 255;
      image.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      image.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// The same height field as a roughness map: the bright grain of a surface is left smoother than the dark marks
// over it, so lit ice glints and dry sand does not, and the ground stops reading as one flat paint. three reads
// the green channel of a roughness map, so the grey is written to every channel.
function roughnessCanvas(height, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const gloss = T.GROUND_ROUGHNESS_GLOSS;
  const span = T.GROUND_ROUGHNESS_DULL - gloss;
  for (let i = 0; i < height.length; i++) {
    const rough = (gloss + span * (1 - height[i])) * 255;
    const i4 = i * 4;
    image.data[i4] = rough;
    image.data[i4 + 1] = rough;
    image.data[i4 + 2] = rough;
    image.data[i4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// --- the tiles ---------------------------------------------------------------

// One tile's geometry: the flat grid displaced by the world's shape, then coloured by height and slope. Every
// tile shares it, and since a tile is exactly one period of the shape its two ends meet the tiles either side.
function buildGeometry(p) {
  const geometry = new THREE.PlaneGeometry(T.GROUND_WIDTH, T.GROUND_TILE_LENGTH, p.segmentsX, p.segmentsZ);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const y = tileHeight(positions.getX(i), positions.getZ(i));   // reads `shape`, which rebuild() has set
    positions.setY(i, y);
    if (y < low) low = y;
    if (y > high) high = y;
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  if (p.shade) paintVertices(geometry, low, high, p.shade);
  return geometry;
}

function buildMaterial(p, fallback) {
  const material = new THREE.MeshStandardMaterial({
    // With a shade scheme the colour arrives on the vertices, so the material itself stays white; without one it
    // falls back to a flat colour, which is the world's own `ground` colour from planets.js.
    color: p.shade ? '#ffffff' : fallback,
    vertexColors: Boolean(p.shade)
    // No flatShading: the mesh is smooth-shaded, so computeVertexNormals' averaged normals are used and the
    // ground reads as one continuous surface. At 2 m a quad the old faceted look is what made it read as low-poly.
  });
  if (!p.texture) return material;   // the title screen's ground carries no painted detail and so no relief

  const size = T.GROUND_TEXTURE_SIZE;
  const canvas = paintDetail(p.texture);
  const heights = detailHeights(canvas, size);
  material.map = detailTexture(canvas, true);
  // The relief and the roughness are cut from the very pixels of the colour map, so all three show the same
  // features at the same size and place on the ground, and all three repeat identically.
  material.normalMap = detailTexture(reliefCanvas(heights, size), false);
  material.normalScale = new THREE.Vector2(T.GROUND_NORMAL_SCALE, T.GROUND_NORMAL_SCALE);
  material.roughnessMap = detailTexture(roughnessCanvas(heights, size), false);
  return material;
}

export const ground = new THREE.Group();
const tiles = [];
for (let i = 0; i < T.GROUND_TILES; i++) {
  const tile = new THREE.Mesh();
  tile.position.z = -i * T.GROUND_TILE_LENGTH;
  tiles.push(tile);
  ground.add(tile);
}

// The cave roof, for the worlds that have one. It is built exactly like the ground and out of the very same
// geometry — one mesh per ground tile, sitting CAVE_CEILING above it — so the roof rolls with the hills the way
// the floor does, and there is no second terrain to keep in step. Two things differ: the tiles are raised, and
// the material is drawn from underneath (BackSide), which is the face the ship sees from inside the cave.
export const ceiling = new THREE.Group();
ceiling.visible = false;
const ceilingTiles = [];
for (let i = 0; i < T.GROUND_TILES; i++) {
  const tile = new THREE.Mesh();
  tile.position.set(0, T.CAVE_CEILING, -i * T.GROUND_TILE_LENGTH);
  ceilingTiles.push(tile);
  ceiling.add(tile);
}
const ceilingMaterial = new THREE.MeshStandardMaterial({
  color: T.CAVE_COLOR, roughness: T.CAVE_ROUGHNESS, metalness: 0.04, side: THREE.BackSide
});

// Swap the tiles over to a world's shape: build the new geometry and material first, hand them to every tile,
// then let go of the old ones — this is what switching worlds calls.
function rebuild(p, fallback, cave) {
  shape = p;
  const geometry = buildGeometry(p);
  const material = buildMaterial(p, fallback);
  const oldGeometry = tiles[0].geometry;
  const oldMaterial = tiles[0].material;
  for (const tile of tiles) {
    tile.geometry = geometry;
    tile.material = material;
  }
  // The roof, on a world that has one: the floor's own geometry raised, worn by the ceiling tiles. One geometry
  // object is shared by all six meshes, so letting go of the old one here disposes the roof with the floor.
  ceiling.visible = Boolean(cave);
  if (cave) {
    for (const tile of ceilingTiles) {
      tile.geometry = geometry;
      tile.material = ceilingMaterial;
    }
  }
  oldGeometry.dispose();
  // material.dispose() frees no texture, so every map is let go of by hand
  for (const map of [oldMaterial.map, oldMaterial.normalMap, oldMaterial.roughnessMap]) if (map) map.dispose();
  oldMaterial.dispose();
}

// Give the ground a world's shape, colours and detail. main.js calls this from applyWorld when a run launches.
export function applyTerrainLook(world) {
  rebuild(world.terrain, world.ground || T.GROUND_COLOR, world.cave);
}

rebuild(T.TERRAIN_DEFAULT, T.GROUND_COLOR);   // the title screen's rolling ground, until a world is launched

// How high the ground is at a world point. Every tile sits a whole number of tile lengths apart, so one tile's
// offset gives the same answer as any other, and the answer keeps matching the drawn surface as the field recycles.
export function terrainHeightAt(x, z) {
  return tileHeight(x, z - tiles[0].position.z);
}

// Scroll the ground toward the ship and send each finished tile back to the front of the queue.
export function updateTerrain(dt) {
  for (const tile of tiles) {
    tile.position.z += T.FORWARD_SPEED * dt;
    if (tile.position.z - T.GROUND_TILE_LENGTH / 2 > T.CAMERA_BACK + 25) {
      tile.position.z -= T.GROUND_TILES * T.GROUND_TILE_LENGTH;
    }
  }
  // The roof is the floor's own tiles raised, so it is moved by copying them rather than by scrolling on a clock
  // of its own: any drift between the two and the cave's mouth would open and close as it went past.
  for (let i = 0; i < ceilingTiles.length; i++) ceilingTiles[i].position.z = tiles[i].position.z;
}
