// The sky: one red dwarf star, a per-world gradient dome, a distant banded gas giant and a faint starfield.
// createSky() builds it all once and returns a group for the scene; applySkyLook(world) repaints it for the
// world about to be flown. Every texture is drawn with canvas 2D at load: no image files anywhere.

import * as THREE from 'three';

// ---- Tunables. Placed distances are metres, angles are degrees, sizes are metres unless the name says pixels.

const STAR_DISTANCE = 290;      // how far from the world origin the red dwarf's centre sits.
const STAR_BEARING = -25;       // which way it hangs: degrees left of straight ahead (the camera looks down -z).
const STAR_ELEVATION = 15;      // how high it hangs: degrees above the horizon.
const STAR_RADIUS = 42;         // the star sphere's radius. At this distance the disc is about a quarter of the
                                // view height: a big dim sun a long way off, not a nearby ball.
const STAR_ROTATION = 0.6;      // radians the star is turned about its axis, so a well-blotched face looks back.
const STAR_TEXTURE_W = 1024;    // the star's canvas texture width in pixels.
const STAR_TEXTURE_H = 512;     // and its height: half the width, as a sphere's wrapped texture wants.
const STAR_BASE = '#8d2113';    // the star's deep red: the colour the makers asked for.
const STAR_DARK = '#5c1109';    // the darker blotches that mottle that base.
const STAR_BRIGHT = '#e2542a';  // the brighter red-orange granulation, laid on additively.
const STAR_FLARE = '#ffd7bd';   // the pale flares.
const STAR_DARK_BLOTCHES = 90;  // how many dark blobs mottle it.
const STAR_BLOTCHES = 320;      // how many granulation blobs cover it.
const STAR_FLARES = 7;          // how many pale flares sit on it.
const STAR_SEED = 20261106;     // the random seed: the sky is drawn fresh each load, so pin it and it repeats.

// The hot rim: a thin bright ring sprite that always faces the camera, so it hugs the disc exactly.
// The ring is drawn at RIM_INNER of the canvas's half-width and the sprite is then scaled by 1/RIM_INNER, so
// the ring lands on the star's silhouette whatever STAR_RADIUS is.
const RIM_INNER = 0.84;         // where the rim starts, as a fraction of the sprite's half-width.
const RIM_PEAK = 0.88;          // the offset up the gradient where the rim is brightest.
const RIM_FALLOFF = 0.55;       // where the warm bleed outside the hot line has faded to the RIM_WARM colour.
const RIM_OUTER = 1;            // beyond this fraction of the half-width it has faded out completely.
const RIM_HOT = 'rgba(255, 244, 228, 0.95)';  // the rim itself: near-white, the hot edge of the disc.
const RIM_WARM = 'rgba(255, 158, 96, 0.35)';  // the softer warm bleed outside it, so the edge is not a hard line.

// The corona: a few big soft glow sprites, drawn additively, so red bleeds off the disc into space.
const CORONA_SCALE = 2.4;       // the widest glow's width as a multiple of the star's diameter.
const CORONA_LAYERS = [1, 0.72, 0.5];  // the glow sprites' scales. All their middles hide behind the disc,
                                       // so what shows is a soft red bleed thinning outwards.
const CORONA_HOT = 'rgba(255, 126, 70, 0.95)';  // the glow's colour at the centre (never seen: the disc covers it).
const CORONA_MID = 'rgba(150, 38, 16, 0.5)';    // its colour out where it is seen, just off the rim.
const CORONA_FADE = 'rgba(64, 14, 6, 0.12)';    // the far tail of the bleed.

// The gas giant: the world the story has the ship refuel at, so it hangs in every sky.
const GAS_DISTANCE = 320;       // how far off it sits: well outside the fog, so the air cannot touch it.
const GAS_BEARING = 30;         // degrees to the right of straight ahead, the other side of the sky from the star.
const GAS_ELEVATION = 14;       // degrees above the horizon.
const GAS_RADIUS = 15;          // its radius: about a third of the star's width in the sky.
const GAS_TILT = 0.18;          // radians its poles are tipped, so its bands are not level with the horizon.
const GAS_TEXTURE_W = 512;      // its canvas texture width in pixels.
const GAS_TEXTURE_H = 256;      // its height.
const GAS_BANDS = 7;            // how many soft bands ring it from pole to pole.
const GAS_LIGHT = '#d8ece2';    // its light band colour: pale cyan-green.
const GAS_DARK = '#93b6a8';     // its dark band colour. Keep the two close: low contrast, no rings.
const GAS_POLE_SHADE = 0.22;    // how much darker its poles go, which is what keeps it reading as a sphere.
const GAS_STORMS = 14;          // how many soft storms break up the bands.
const GAS_STORM = '#f2fbf6';    // the storms' colour: paler still.

// The dome: the sky itself. A big inside-out sphere carrying a per-world gradient, never fogged.
const DOME_RADIUS = 350;        // comfortably outside the fog (about 190) and inside the camera's 400 far plane.
const DOME_TEXTURE_W = 64;      // the dome's gradient only changes top to bottom, so a narrow texture is plenty.
const DOME_TEXTURE_H = 512;     // plenty of rows, though, so the gradient has nothing to band on.

// The starfield: dim dots, kept clear of the star and the gas giant.
const STAR_COUNT = 420;         // how many dots the sky has.
const STARFIELD_RADIUS = 330;   // how far out they sit: past the star, inside the dome and the far plane.
const STAR_DOT_SIZE = 2;        // dot size in device pixels: attenuation is off, so distance cannot shrink it.
const STAR_DOT_COLOR = '#cdd8e6';  // a pale, almost colourless white-blue.
const STAR_DOT_OPACITY = 0.7;   // keep them dim: the red dwarf is the bright thing in this sky.
const STAR_CLEAR_DEG = 24;      // keep dots this far off the star, so none sit on its disc or in its corona.
const GIANT_CLEAR_DEG = 10;     // and this far off the gas giant, for the same reason.

// Draw order inside the transparent pass. The dome goes down first and everything else adds on top of it.
const ORDER_DOME = -50;
const ORDER_STARS = -40;
const ORDER_RIM = -30;
const ORDER_CORONA = -20;

// One sky gradient per world, top of the canvas (the zenith) down to the bottom (below the horizon).
// THE STOP AT 0.5 IS THE HORIZON LINE and is exactly the world's sky colour in planets.js, so the ground,
// fogged out at FOG_FAR, meets the dome with no seam. The star sits about a third of the way from the
// horizon stop up to the zenith.
const SKY_GRADIENTS = {
  ICE: [[0, '#eaf7fc'], [0.20, '#d3ecf5'], [0.50, '#5f93ad'], [0.62, '#2f5f79'], [0.80, '#1b405a'], [1, '#112d40']],
  DESERT: [[0, '#241d33'], [0.20, '#3d2330'], [0.36, '#8a4527'], [0.46, '#e08a3a'], [0.50, '#c96a24'],
    [0.60, '#8a4418'], [0.78, '#43200e'], [1, '#221005']],
  JUNGLE: [[0, '#e4ebda'], [0.20, '#cfdabb'], [0.50, '#87996b'], [0.62, '#5c6b47'], [0.80, '#3a452c'], [1, '#232a1a']],
  ALPINE: [[0, '#c6ced4'], [0.20, '#b8c1c7'], [0.50, '#a8b2b8'], [0.64, '#8b959b'], [0.82, '#6b747a'], [1, '#4c5359']]
};
const DEFAULT_SKY_KEY = 'NEUTRAL';  // used if a world turns up that this table has never heard of.
const DEFAULT_SKY_STOPS = [[0, '#31415f'], [0.30, '#27354f'], [0.50, '#22304a'], [0.68, '#151f31'], [1, '#0b1220']];

// A slight per-world tint on the star. It stays the same deep red everywhere; only the air in front of it
// changes. `glow` scales the rim and the corona, which are drawn additively, so it dims them without moving them.
const STAR_LOOKS = {
  ICE: { tint: '#eef4ff', glow: 1 },       // clear cold air, the glow at full strength.
  DESERT: { tint: '#ffdcb4', glow: 0.8 },  // the orange sky already glows, so the corona backs off.
  JUNGLE: { tint: '#eef6e2', glow: 1.05 }, // hazy green air, a touch more bleed.
  ALPINE: { tint: '#f6f8fa', glow: 0.9 }   // flat grey air: keep it a clean disc.
};
const DEFAULT_STAR_LOOK = { tint: '#ffffff', glow: 1 };

// Handles filled in by createSky() so applySkyLook() can repaint what it built. The two functions are the
// whole of sky.js's public surface, so this is where the dome, the star, the rim and the glow are kept.
let domeMaterial = null;
let starBody = null;
let rimSprite = null;
const coronaSprites = [];
const domeTextures = new Map();   // one gradient texture per world name, built once and reused on every launch.

// ---------------------------------------------------------------------------- drawing helpers

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Wrap a drawn canvas as a colour texture. Without the sRGB tag three.js reads the pixels as linear and every
// sky in the game comes out washed out.
function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// mulberry32: a small seeded random, so the star's blotches and the starfield land the same way on every load.
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A soft blob: dense in the middle, nothing at the edge. Laid on additively and at low alpha, a few hundred of
// them build up into mottling instead of reading as separate spots.
function softBlob(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');   // fades to transparent black, which adds and paints nothing
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Sphere textures wrap, so a blob near the left edge is drawn again a texture-width to either side: the seam
// then meets itself instead of cutting a hard line down the star.
function softBlobWrapped(ctx, width, x, y, radius, color) {
  softBlob(ctx, x - width, y, radius, color);
  softBlob(ctx, x, y, radius, color);
  softBlob(ctx, x + width, y, radius, color);
}

// Where something hangs in the sky: `away` metres out along a compass bearing in degrees (right is positive,
// so a negative bearing is to the left) and an elevation in degrees above the horizon. The camera looks down
// -z, so -z is straight ahead, +x is to the right and +y is up.
function skyPoint(away, bearingDegrees, elevationDegrees, target) {
  const bearing = THREE.MathUtils.degToRad(bearingDegrees);
  const elevation = THREE.MathUtils.degToRad(elevationDegrees);
  const flat = Math.cos(elevation) * away;   // how far out it is across the ground, rather than along the slant
  return target.set(Math.sin(bearing) * flat, Math.sin(elevation) * away, -Math.cos(bearing) * flat);
}

// ---------------------------------------------------------------------------- the star's textures

// The red dwarf's face: a deep red base, blotchy brighter granulation, a few pale flares.
function makeStarCanvas() {
  const ctx = makeCanvas(STAR_TEXTURE_W, STAR_TEXTURE_H).getContext('2d');
  const random = makeRandom(STAR_SEED);

  ctx.fillStyle = STAR_BASE;
  ctx.fillRect(0, 0, STAR_TEXTURE_W, STAR_TEXTURE_H);

  // Dark blotches first, at low alpha, for the mottling.
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < STAR_DARK_BLOTCHES; i++) {
    const radius = STAR_TEXTURE_H * (0.08 + random() * 0.18);
    softBlobWrapped(ctx, STAR_TEXTURE_W, random() * STAR_TEXTURE_W, random() * STAR_TEXTURE_H, radius, STAR_DARK);
  }

  // Then the granulation, laid on additively so overlapping blobs add up rather than pile up.
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < STAR_BLOTCHES; i++) {
    const radius = STAR_TEXTURE_H * (0.02 + random() * 0.06);
    softBlobWrapped(ctx, STAR_TEXTURE_W, random() * STAR_TEXTURE_W, random() * STAR_TEXTURE_H, radius, STAR_BRIGHT);
  }

  // And a handful of pale flares, wider and softer than the granulation.
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < STAR_FLARES; i++) {
    const radius = STAR_TEXTURE_H * (0.12 + random() * 0.16);
    softBlobWrapped(ctx, STAR_TEXTURE_W, random() * STAR_TEXTURE_W, random() * STAR_TEXTURE_H, radius, STAR_FLARE);
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return ctx.canvas;
}

// The hot rim: the bright ring the reference image's sun has around its edge, painted as an additive sprite so
// it can face the camera and stay a circle as the ship moves. The star itself writes depth, so only the sliver
// of the ring outside the disc's silhouette is ever seen.
function makeRimCanvas() {
  const size = 256;
  const ctx = makeCanvas(size, size).getContext('2d');
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, half * RIM_INNER, half, half, half * RIM_OUTER);
  // Inside the inner radius the gradient paints its first stop and outside the outer radius its last one: both
  // are transparent, so only the ring between them shows. The stops are added in ascending order: the peak
  // fraction is 0.25 with these numbers, between the transparent inside and the warm bleed.
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop((RIM_PEAK - RIM_INNER) / (RIM_OUTER - RIM_INNER), RIM_HOT);
  gradient.addColorStop(RIM_FALLOFF, RIM_WARM);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return ctx.canvas;
}

// The corona: a soft red glow, dense at the middle and thinning all the way to the edge of the sprite.
function makeCoronaCanvas() {
  const size = 256;
  const ctx = makeCanvas(size, size).getContext('2d');
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, CORONA_HOT);
  gradient.addColorStop(0.38, CORONA_MID);
  gradient.addColorStop(0.72, CORONA_FADE);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return ctx.canvas;
}

// ---------------------------------------------------------------------------- the other textures

// The skydome's gradient. The canvas top is the zenith, the middle row is the horizon and the bottom is the
// ground under it, which the terrain hides anyway but the gradient has to keep going to.
function makeSkyTexture(stops) {
  const ctx = makeCanvas(DOME_TEXTURE_W, DOME_TEXTURE_H).getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, DOME_TEXTURE_H);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, DOME_TEXTURE_W, DOME_TEXTURE_H);
  return toTexture(ctx.canvas);
}

// The gas giant: soft horizontal bands, low contrast, no rings.
function makeGasGiantTexture() {
  const width = GAS_TEXTURE_W;
  const ctx = makeCanvas(width, GAS_TEXTURE_H).getContext('2d');
  const light = new THREE.Color(GAS_LIGHT);
  const dark = new THREE.Color(GAS_DARK);
  const band = new THREE.Color();

  // One row of pixels at a time: two slow sines give soft irregular bands, and they pinch together at the
  // poles on their own, because the sphere squeezes the top and bottom rows of the texture together.
  for (let y = 0; y < GAS_TEXTURE_H; y++) {
    const t = y / GAS_TEXTURE_H;
    const wave = 0.5 + 0.28 * Math.sin(t * GAS_BANDS * Math.PI * 2)
                     + 0.22 * Math.sin(t * GAS_BANDS * Math.PI * 4 + 1.7);
    band.copy(dark).lerp(light, THREE.MathUtils.clamp(wave, 0, 1));
    const poles = 1 - GAS_POLE_SHADE * (Math.abs(t - 0.5) * 2) ** 2;   // darker toward both poles
    ctx.fillStyle = '#' + band.multiplyScalar(poles).getHexString();
    ctx.fillRect(0, y, width, 1);
  }

  // A few soft storms, so the bands are not perfectly regular.
  const random = makeRandom(STAR_SEED + 5);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < GAS_STORMS; i++) {
    const radius = GAS_TEXTURE_H * (0.08 + random() * 0.12);
    const y = GAS_TEXTURE_H * (0.25 + random() * 0.5);   // keep them off the poles
    softBlobWrapped(ctx, width, random() * width, y, radius, GAS_STORM);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(ctx.canvas);
}

// ---------------------------------------------------------------------------- building the sky

function buildStar(group) {
  starBody = new THREE.Mesh(
    new THREE.SphereGeometry(STAR_RADIUS, 48, 32),
    // MeshBasicMaterial: the star is its own light. Nothing in the scene lights it and nothing may dim it,
    // and fog: false keeps the air from washing it out.
    new THREE.MeshBasicMaterial({ map: toTexture(makeStarCanvas()), fog: false })
  );
  starBody.rotation.y = STAR_ROTATION;
  starBody.position.copy(skyPoint(STAR_DISTANCE, STAR_BEARING, STAR_ELEVATION, new THREE.Vector3()));
  group.add(starBody);

  // The rim sprite is scaled so its inner ring lands on the star's silhouette: the star itself writes depth,
  // so the only part of the ring that survives the depth test is the sliver just outside the disc.
  rimSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: toTexture(makeRimCanvas()), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false
  }));
  rimSprite.scale.setScalar((STAR_RADIUS * 2) / RIM_INNER);   // half of this is STAR_RADIUS / RIM_INNER wide
  rimSprite.position.copy(starBody.position);
  rimSprite.renderOrder = ORDER_RIM;
  group.add(rimSprite);

  // The corona: the same soft glow at a few sizes, all additive and none of them writing depth, so they add
  // light around the disc instead of hiding anything behind them.
  const coronaMap = toTexture(makeCoronaCanvas());
  coronaSprites.length = 0;
  for (const layer of CORONA_LAYERS) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coronaMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    sprite.scale.setScalar(STAR_RADIUS * 2 * CORONA_SCALE * layer);
    sprite.position.copy(starBody.position);
    sprite.renderOrder = ORDER_CORONA;
    coronaSprites.push(sprite);
    group.add(sprite);
  }
}

function buildGasGiant(group) {
  const giant = new THREE.Mesh(
    new THREE.SphereGeometry(GAS_RADIUS, 32, 24),
    new THREE.MeshBasicMaterial({ map: makeGasGiantTexture(), fog: false })
  );
  giant.position.copy(skyPoint(GAS_DISTANCE, GAS_BEARING, GAS_ELEVATION, new THREE.Vector3()));
  giant.rotation.z = GAS_TILT;
  group.add(giant);
}

function buildStarfield(group) {
  const random = makeRandom(STAR_SEED + 11);
  const starDirection = skyPoint(1, STAR_BEARING, STAR_ELEVATION, new THREE.Vector3()).normalize();
  const giantDirection = skyPoint(1, GAS_BEARING, GAS_ELEVATION, new THREE.Vector3()).normalize();
  const keepOffStar = Math.cos(THREE.MathUtils.degToRad(STAR_CLEAR_DEG));
  const keepOffGiant = Math.cos(THREE.MathUtils.degToRad(GIANT_CLEAR_DEG));

  const positions = new Float32Array(STAR_COUNT * 3);
  const direction = new THREE.Vector3();
  for (let i = 0; i < STAR_COUNT; i++) {
    // Pick a direction on the sphere rather than a point in a cube: a cube clumps the dots into the corners
    // of the sky. Re-roll while a dot would land on the star's disc or the gas giant.
    for (let attempt = 0; attempt < 20; attempt++) {
      const up = random() * 2 - 1;
      const around = random() * Math.PI * 2;
      const ring = Math.sqrt(1 - up * up);   // how wide the latitude circle is at this height
      direction.set(Math.cos(around) * ring, up, Math.sin(around) * ring);
      if (direction.dot(starDirection) < keepOffStar && direction.dot(giantDirection) < keepOffGiant) break;
    }
    positions[i * 3] = direction.x * STARFIELD_RADIUS;
    positions[i * 3 + 1] = direction.y * STARFIELD_RADIUS;
    positions[i * 3 + 2] = direction.z * STARFIELD_RADIUS;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: STAR_DOT_COLOR, size: STAR_DOT_SIZE,
    sizeAttenuation: false,   // size in pixels, so a dot stays a dot however far out it is
    fog: false, transparent: true, opacity: STAR_DOT_OPACITY, depthWrite: false
  }));
  points.renderOrder = ORDER_STARS;
  group.add(points);
}

function buildDome(group) {
  // Build every world's gradient now, once, so a launch only ever swaps a texture rather than drawing one.
  domeTextures.set(DEFAULT_SKY_KEY, makeSkyTexture(DEFAULT_SKY_STOPS));
  for (const name of Object.keys(SKY_GRADIENTS)) domeTextures.set(name, makeSkyTexture(SKY_GRADIENTS[name]));

  // An inside-out sphere around everything, drawn first and writing no depth: the terrain in front of it still
  // hides it, but the air cannot fog it out. transparent: true puts it in the pass renderOrder can order.
  domeMaterial = new THREE.MeshBasicMaterial({
    map: domeTextures.get(DEFAULT_SKY_KEY), side: THREE.BackSide,
    fog: false, depthWrite: false, transparent: true
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 32, 24), domeMaterial);
  dome.renderOrder = ORDER_DOME;
  group.add(dome);
}

// Build the whole sky once and hand it back for the scene to add.
export function createSky() {
  const group = new THREE.Group();
  buildDome(group);
  buildGasGiant(group);
  buildStarfield(group);
  buildStar(group);
  return group;
}

// Repaint the sky for the world just launched: its own dome gradient, and a slight tint on the star.
export function applySkyLook(world) {
  if (!domeMaterial) return;   // nothing to repaint until createSky() has run
  const name = world && world.name;
  domeMaterial.map = domeTextures.get(name) || domeTextures.get(DEFAULT_SKY_KEY);

  const look = STAR_LOOKS[name] || DEFAULT_STAR_LOOK;
  const glow = new THREE.Color(look.tint).multiplyScalar(look.glow);   // additive layers dim by colour, not alpha
  starBody.material.color.set(look.tint);
  rimSprite.material.color.copy(glow);
  for (const sprite of coronaSprites) sprite.material.color.copy(glow);
}
