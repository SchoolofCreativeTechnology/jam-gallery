// The completion badge: a canvas-drawn gold medal, fixed bottom right, that fills one quarter per finished world.
// createBadge() builds the element and draws it once; showBadge/hideBadge toggle it; setBadgeQuarters(n) fills
// the first n of the four quadrants. Every mark is drawn with canvas 2D at load: no image files anywhere.

// ---- Tunables. Lengths are design units inside a DESIGN x DESIGN drawing box unless the name says pixels.

const BADGE_ID = 'badge';        // the element's id: index.html carries the style block that places it.
const SIZE_CSS = 112;            // its on-screen size in CSS pixels: inside the 96 to 128 the makers asked for, and
                                 // matched to the width/height index.html's own #badge rule sets, so it cannot spill.
const DESIGN = 128;              // the drawing box the medal is composed in; all the numbers below live in it.
const BACKING_SCALE = 2;         // the canvas is drawn at this many device pixels per design unit, so it is crisp.
const QUARTER_COUNT = 4;         // four worlds, four quadrants.

// The medal disc.
const MEDAL_CX = 64;             // its centre, a little below the middle to leave room for the bow on top.
const MEDAL_CY = 68;
const MEDAL_R = 38;              // outer radius of the gold ring.
const RING_WIDTH = 8;            // how thick that gold ring is.
const RECESS_R = MEDAL_R - RING_WIDTH;   // radius of the darker recessed centre inside it.

// Golds, darkest at the bottom of every gradient so the metal reads as lit from above.
const GOLD_HILIGHT = '#fff6d2';
const GOLD_LIGHT = '#f3cf62';
const GOLD_MID = '#cfa22b';
const GOLD_DARK = '#8a6410';
const GOLD_EDGE = '#4d3606';     // the thin dark line that keeps the ring from bleeding into the centre.

// The recessed centre: dark, darkest at its rim so it looks sunk rather than painted on.
const CENTRE_LIGHT = '#2b323c';
const CENTRE_DARK = '#0c1015';

// The studs dotted around the ring, the reference medal's jewels. Kept small and pale: texture, not sparkle.
const STUD_COUNT = 18;
const STUD_R = MEDAL_R - RING_WIDTH / 2;   // they sit on the middle of the ring.
const STUD_SIZE = 1.5;
const STUD_COLOR = 'rgba(255, 250, 226, 0.55)';

// The laurel: two arcs of small leaves flanking the centre. Your own simple drawing, not a copy of the reference.
const LAUREL_R = 24;
const LAUREL_LEAVES = 9;         // per side.
const LAUREL_SPREAD = 1.0;       // radians the arc covers either side of the centre of each flank.
const LAUREL_LEAF_RX = 4.4;      // leaf length along the arc.
const LAUREL_LEAF_RY = 1.9;      // and its width.
const LAUREL_COLOR = '#e9c65f';
const LAUREL_ALPHA = 0.9;

// The motif in the middle: a five-pointed star. It stands in for the reference's lettering, which is not ours.
const STAR_POINTS = 5;
const STAR_OUTER = 13;
const STAR_INNER = 5.4;
const STAR_ROTATION = -Math.PI / 2;   // a point uppermost.

// The bow: two red loops and a knot sitting on the top of the medal.
const BOW_CY = 22;
const BOW_LOOP_RX = 17;
const BOW_LOOP_RY = 10.5;
const BOW_LOOP_OFFSET = 16;      // how far each loop's centre sits out from the middle.
const BOW_LOOP_TILT = 0.3;       // radians each loop is cocked, so the bow looks tied rather than stacked.
const BOW_LIGHT = '#ff5b4a';
const BOW_MID = '#d8151c';
const BOW_DARK = '#7d070f';
const BOW_HOLE = 'rgba(90, 6, 14, 0.45)';   // the shadow inside each loop.
const KNOT_RX = 7.5;
const KNOT_RY = 7;
const BOW_TAIL_END_Y = 46;       // the short tails from the knot end here, on the gold ring.
const BOW_TAIL_HALF = 5;         // half their width where they end.

// The two ribbons below the medal, drawn first so the disc covers where they attach.
const RIBBON_TOP_Y = 90;
const RIBBON_TIP_Y = 126;
const RIBBON_NOTCH = 6;          // how far the V cut up into each ribbon's tip reaches.
const RIBBON_LIGHT = '#e6342c';
const RIBBON_MID = '#b8171b';
const RIBBON_DARK = '#6e0b12';
const RIBBON_FOLD = 'rgba(80, 8, 12, 0.45)';   // the darker half of each ribbon that suggests a fold.

// The dim, unfilled look: desaturated towards its own brightness and then darkened, so all four quadrants are
// visible from the start but none of them looks earned.
const DIM_SATURATION = 0.28;     // how much of the original colour survives; the rest becomes grey.
const DIM_BRIGHTNESS = 0.42;     // and then everything is scaled down by this, so a dim quadrant is clearly unlit.

// The lit look: the finished medal plus a warm additive wash, so a newly filled quadrant is brighter than a
// merely un-dimmed one and the reward reads at a glance. Its sparkles are at fixed spots: nothing random here.
const LIT_WASH_HOT = 'rgba(255, 244, 202, 0.26)';
const LIT_WASH_FADE = 'rgba(255, 214, 120, 0.02)';
const LIT_SPARKLES = [           // [x, y, size] in design units, relative to the medal's centre.
  [-20, -20, 7],
  [18, 15, 6],
  [-13, 22, 5],
  [22, -17, 5]
];
const SPARKLE_COLOR = 'rgba(255, 252, 232, 0.85)';

// The full-badge touch: a brighter ring and a soft glow, so a complete medal reads as complete.
const COMPLETE_RING_COLOR = 'rgba(255, 244, 200, 0.7)';
const COMPLETE_RING_WIDTH = 1.6;
const COMPLETE_RING_OFFSET = 2.4;   // how far outside the gold ring that bright ring is drawn.
const COMPLETE_GLOW_IN = 'rgba(255, 214, 110, 0.32)';
const COMPLETE_GLOW_OUT = 'rgba(255, 190, 70, 0)';
const COMPLETE_SPARKLES = [         // [angle in radians, size in design units] around the ring.
  [0.4, 6],
  [1.85, 4.5],
  [3.2, 6],
  [4.6, 4.5]
];
const COMPLETE_SPARKLE_R = MEDAL_R + 8;

// The four quadrants in fill order: top-left, top-right, bottom-right, bottom-left.
const QUADRANTS = [
  { x: 0, y: 0, w: DESIGN / 2, h: DESIGN / 2 },
  { x: DESIGN / 2, y: 0, w: DESIGN / 2, h: DESIGN / 2 },
  { x: DESIGN / 2, y: DESIGN / 2, w: DESIGN / 2, h: DESIGN / 2 },
  { x: 0, y: DESIGN / 2, w: DESIGN / 2, h: DESIGN / 2 }
];

// ---------------------------------------------------------------------------- state

// Everything the public functions share. `quarters` is what the last redraw drew, so a per-frame caller that
// passes the same number costs nothing.
const state = {
  element: null,
  ctx: null,
  masterCanvas: null,   // the finished, brightest medal.
  litCanvas: null,      // the finished medal plus the lit wash, used inside a filled quadrant.
  dimCanvas: null,      // the desaturated, darkened medal, used everywhere else.
  quarters: -1,         // -1 until the first paint, so createBadge() always draws once.
  created: false
};

// ---------------------------------------------------------------------------- small drawing helpers

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawSparkle(ctx, x, y, size, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * 0.12, y - size * 0.12, x + size, y);
  ctx.quadraticCurveTo(x + size * 0.12, y + size * 0.12, x, y + size);
  ctx.quadraticCurveTo(x - size * 0.12, y + size * 0.12, x - size, y);
  ctx.quadraticCurveTo(x - size * 0.12, y - size * 0.12, x, y - size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, cx, cy, outer, inner, points, rotation) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------- the medal

function drawRibbon(ctx, topInnerX, topOuterX, tipInnerX, tipOuterX) {
  const notchX = (tipInnerX + tipOuterX) / 2;
  ctx.beginPath();
  ctx.moveTo(topInnerX, RIBBON_TOP_Y);
  ctx.lineTo(topOuterX, RIBBON_TOP_Y);
  ctx.lineTo(tipOuterX, RIBBON_TIP_Y);
  ctx.lineTo(notchX, RIBBON_TIP_Y - RIBBON_NOTCH);
  ctx.lineTo(tipInnerX, RIBBON_TIP_Y);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, RIBBON_TOP_Y, 0, RIBBON_TIP_Y);
  gradient.addColorStop(0, RIBBON_LIGHT);
  gradient.addColorStop(0.5, RIBBON_MID);
  gradient.addColorStop(1, RIBBON_DARK);
  ctx.fillStyle = gradient;
  ctx.fill();

  // The fold: a darker wedge down the middle of each ribbon, so it is not a flat shape.
  ctx.beginPath();
  ctx.moveTo((topInnerX + topOuterX) / 2, RIBBON_TOP_Y);
  ctx.lineTo(topOuterX, RIBBON_TOP_Y);
  ctx.lineTo(tipOuterX, RIBBON_TIP_Y);
  ctx.lineTo(notchX, RIBBON_TIP_Y - RIBBON_NOTCH);
  ctx.closePath();
  ctx.fillStyle = RIBBON_FOLD;
  ctx.fill();
}

function drawRibbons(ctx) {
  // Left tail, then its mirror on the right.
  drawRibbon(ctx, MEDAL_CX - 16, MEDAL_CX - 5, MEDAL_CX - 27, MEDAL_CX - 12);
  drawRibbon(ctx, MEDAL_CX + 5, MEDAL_CX + 16, MEDAL_CX + 12, MEDAL_CX + 27);
}

function drawMedalDisc(ctx) {
  // The recessed centre first, so the gold ring covers its edge.
  const centre = ctx.createRadialGradient(MEDAL_CX, MEDAL_CY, 0, MEDAL_CX, MEDAL_CY, RECESS_R);
  centre.addColorStop(0, CENTRE_LIGHT);
  centre.addColorStop(1, CENTRE_DARK);
  ctx.fillStyle = centre;
  ctx.beginPath();
  ctx.arc(MEDAL_CX, MEDAL_CY, RECESS_R, 0, Math.PI * 2);
  ctx.fill();

  // The gold ring: a thick stroke with a gradient across it, lighter at the top.
  const ring = ctx.createLinearGradient(MEDAL_CX, MEDAL_CY - MEDAL_R, MEDAL_CX, MEDAL_CY + MEDAL_R);
  ring.addColorStop(0, GOLD_HILIGHT);
  ring.addColorStop(0.28, GOLD_LIGHT);
  ring.addColorStop(0.62, GOLD_MID);
  ring.addColorStop(1, GOLD_DARK);
  ctx.strokeStyle = ring;
  ctx.lineWidth = RING_WIDTH;
  ctx.beginPath();
  ctx.arc(MEDAL_CX, MEDAL_CY, MEDAL_R - RING_WIDTH / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Two thin lines: one dark just inside the ring, one pale just outside it, so the edge is defined.
  ctx.strokeStyle = GOLD_EDGE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(MEDAL_CX, MEDAL_CY, RECESS_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = GOLD_HILIGHT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(MEDAL_CX, MEDAL_CY, MEDAL_R - 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawStuds(ctx) {
  ctx.save();
  ctx.fillStyle = STUD_COLOR;
  for (let i = 0; i < STUD_COUNT; i++) {
    const angle = (i / STUD_COUNT) * Math.PI * 2;
    const x = MEDAL_CX + Math.cos(angle) * STUD_R;
    const y = MEDAL_CY + Math.sin(angle) * STUD_R;
    const size = i % 2 === 0 ? STUD_SIZE : STUD_SIZE * 0.7;   // alternating sizes, so the ring has a beat
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLaurel(ctx) {
  ctx.save();
  ctx.fillStyle = LAUREL_COLOR;
  ctx.globalAlpha = LAUREL_ALPHA;
  for (const side of [-1, 1]) {
    const middle = side > 0 ? 0 : Math.PI;   // right flank centred on 0 radians, left on pi.
    // A thin stem along the arc first, then the leaves sitting on it.
    ctx.strokeStyle = LAUREL_COLOR;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(MEDAL_CX, MEDAL_CY, LAUREL_R, middle - LAUREL_SPREAD, middle + LAUREL_SPREAD);
    ctx.stroke();

    for (let i = 0; i < LAUREL_LEAVES; i++) {
      const t = LAUREL_LEAVES === 1 ? 0 : i / (LAUREL_LEAVES - 1);
      const angle = middle + (t - 0.5) * 2 * LAUREL_SPREAD;
      const scale = 0.65 + 0.35 * Math.sin(t * Math.PI);   // smaller leaves at both ends of each arc
      ctx.save();
      ctx.translate(MEDAL_CX + Math.cos(angle) * LAUREL_R, MEDAL_CY + Math.sin(angle) * LAUREL_R);
      ctx.rotate(angle + Math.PI / 2);                    // the leaf lies along the arc, not across it
      ctx.beginPath();
      ctx.ellipse(0, 0, LAUREL_LEAF_RX * scale, LAUREL_LEAF_RY * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawCentreStar(ctx) {
  const gold = ctx.createRadialGradient(MEDAL_CX - 4, MEDAL_CY - 5, 1, MEDAL_CX, MEDAL_CY, STAR_OUTER);
  gold.addColorStop(0, GOLD_HILIGHT);
  gold.addColorStop(0.55, GOLD_LIGHT);
  gold.addColorStop(1, GOLD_MID);
  drawStar(ctx, MEDAL_CX, MEDAL_CY, STAR_OUTER, STAR_INNER, STAR_POINTS, STAR_ROTATION);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.strokeStyle = GOLD_EDGE;
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawBowLoop(ctx, direction) {
  ctx.save();
  ctx.translate(MEDAL_CX + direction * BOW_LOOP_OFFSET, BOW_CY);
  ctx.rotate(direction * BOW_LOOP_TILT);
  const red = ctx.createLinearGradient(0, -BOW_LOOP_RY, 0, BOW_LOOP_RY);
  red.addColorStop(0, BOW_LIGHT);
  red.addColorStop(0.5, BOW_MID);
  red.addColorStop(1, BOW_DARK);
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.ellipse(0, 0, BOW_LOOP_RX, BOW_LOOP_RY, 0, 0, Math.PI * 2);
  ctx.fill();

  // The pinch of the loop: an elliptical shadow pushed toward the knot.
  ctx.fillStyle = BOW_HOLE;
  ctx.beginPath();
  ctx.ellipse(-direction * BOW_LOOP_RX * 0.22, 1.5, BOW_LOOP_RX * 0.42, BOW_LOOP_RY * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBow(ctx) {
  drawBowLoop(ctx, -1);
  drawBowLoop(ctx, 1);

  // The two short tails from the knot down onto the medal's ring.
  ctx.fillStyle = BOW_DARK;
  for (const direction of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(MEDAL_CX, BOW_CY + 2);
    ctx.lineTo(MEDAL_CX + direction * (KNOT_RX + 2), BOW_CY + 6);
    ctx.lineTo(MEDAL_CX + direction * (BOW_TAIL_HALF + 4), BOW_TAIL_END_Y);
    ctx.lineTo(MEDAL_CX + direction * BOW_TAIL_HALF, BOW_TAIL_END_Y);
    ctx.closePath();
    ctx.fill();
  }

  // And the knot over them.
  const red = ctx.createLinearGradient(0, BOW_CY - KNOT_RY, 0, BOW_CY + KNOT_RY);
  red.addColorStop(0, BOW_LIGHT);
  red.addColorStop(0.55, BOW_MID);
  red.addColorStop(1, BOW_DARK);
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.ellipse(MEDAL_CX, BOW_CY, KNOT_RX, KNOT_RY, 0, 0, Math.PI * 2);
  ctx.fill();
}

// The whole medal, brightest it ever gets, drawn back to front: ribbons, disc, motifs, bow.
function drawMaster(ctx) {
  drawRibbons(ctx);
  drawMedalDisc(ctx);
  drawStuds(ctx);
  drawLaurel(ctx);
  drawCentreStar(ctx);
  drawBow(ctx);
}

// ---------------------------------------------------------------------------- the three states

// The dim version: every pixel pulled most of the way towards its own brightness and then darkened. Done by
// hand rather than with a canvas filter, so it lands the same in every browser.
function makeDimCanvas(master) {
  const width = master.width;
  const height = master.height;
  const dim = makeCanvas(width, height);
  const dimCtx = dim.getContext('2d');
  dimCtx.drawImage(master, 0, 0);

  const image = dimCtx.getImageData(0, 0, width, height);
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const grey = 0.3 * pixels[i] + 0.59 * pixels[i + 1] + 0.11 * pixels[i + 2];
    pixels[i] = (grey * (1 - DIM_SATURATION) + pixels[i] * DIM_SATURATION) * DIM_BRIGHTNESS;
    pixels[i + 1] = (grey * (1 - DIM_SATURATION) + pixels[i + 1] * DIM_SATURATION) * DIM_BRIGHTNESS;
    pixels[i + 2] = (grey * (1 - DIM_SATURATION) + pixels[i + 2] * DIM_SATURATION) * DIM_BRIGHTNESS;
  }
  dimCtx.putImageData(image, 0, 0);
  return dim;
}

// The lit version: the finished medal with a warm additive wash inside the disc and a few fixed sparkles.
function makeLitCanvas(master) {
  const lit = makeCanvas(master.width, master.height);
  const ctx = lit.getContext('2d');
  ctx.drawImage(master, 0, 0);

  // Everything below is drawn in design units, so scale the same way the master was drawn.
  ctx.save();
  ctx.scale(BACKING_SCALE, BACKING_SCALE);
  ctx.beginPath();
  ctx.arc(MEDAL_CX, MEDAL_CY, MEDAL_R, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const wash = ctx.createRadialGradient(MEDAL_CX, MEDAL_CY - 6, 0, MEDAL_CX, MEDAL_CY, MEDAL_R);
  wash.addColorStop(0, LIT_WASH_HOT);
  wash.addColorStop(1, LIT_WASH_FADE);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, DESIGN, DESIGN);
  ctx.restore();

  ctx.save();
  ctx.scale(BACKING_SCALE, BACKING_SCALE);
  for (const [dx, dy, size] of LIT_SPARKLES) {
    drawSparkle(ctx, MEDAL_CX + dx, MEDAL_CY + dy, size, SPARKLE_COLOR);
  }
  ctx.restore();
  return lit;
}

// Drawn on top of everything once all four quadrants are filled: a soft glow outside the ring, a brighter ring,
// and four fixed sparkles around it.
function drawComplete(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(MEDAL_CX, MEDAL_CY, MEDAL_R * 0.8, MEDAL_CX, MEDAL_CY, MEDAL_R * 1.5);
  glow.addColorStop(0, COMPLETE_GLOW_IN);
  glow.addColorStop(1, COMPLETE_GLOW_OUT);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, DESIGN, DESIGN);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = COMPLETE_RING_COLOR;
  ctx.lineWidth = COMPLETE_RING_WIDTH;
  ctx.beginPath();
  ctx.arc(MEDAL_CX, MEDAL_CY, MEDAL_R + COMPLETE_RING_OFFSET, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(MEDAL_CX, MEDAL_CY);   // so the fixed angles below are read from the medal's centre
  for (const [angle, size] of COMPLETE_SPARKLES) {
    drawSparkle(ctx, Math.cos(angle) * COMPLETE_SPARKLE_R, Math.sin(angle) * COMPLETE_SPARKLE_R, size, SPARKLE_COLOR);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------- painting

// Repaint the badge for the current number of filled quadrants: the dim medal everywhere, the lit one clipped
// into each filled quadrant, and the completion touch when all four are lit.
function paint() {
  const ctx = state.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, DESIGN, DESIGN);
  ctx.drawImage(state.dimCanvas, 0, 0, DESIGN, DESIGN);

  const lit = state.quarters;
  for (let i = 0; i < lit && i < QUADRANTS.length; i++) {
    const quadrant = QUADRANTS[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(quadrant.x, quadrant.y, quadrant.w, quadrant.h);
    ctx.clip();
    ctx.drawImage(state.litCanvas, 0, 0, DESIGN, DESIGN);
    ctx.restore();
  }

  if (lit >= QUARTER_COUNT) drawComplete(ctx);
}

// Junk in, a sane number out: anything that is not a number counts as none, and everything else is clamped.
function clampQuarters(n) {
  const value = Math.floor(Number(n));
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(QUARTER_COUNT, value));
}

// ---------------------------------------------------------------------------- public surface

// Build the element and draw the medal. Safe to call more than once: the second call only hands back the element.
export function createBadge() {
  if (state.created) return state.element;

  const canvas = makeCanvas(DESIGN * BACKING_SCALE, DESIGN * BACKING_SCALE);
  canvas.style.display = 'block';
  canvas.style.width = SIZE_CSS + 'px';
  canvas.style.height = SIZE_CSS + 'px';

  const element = document.createElement('div');
  element.id = BADGE_ID;
  element.hidden = true;                 // index.html's style block places it; this keeps it invisible until asked
  element.style.pointerEvents = 'none';  // the ship is flown on the canvas underneath: the badge must not eat input
  element.appendChild(canvas);

  state.element = element;
  state.ctx = canvas.getContext('2d');
  state.ctx.scale(BACKING_SCALE, BACKING_SCALE);   // everything below this is drawn in design units

  state.masterCanvas = makeCanvas(canvas.width, canvas.height);
  const masterCtx = state.masterCanvas.getContext('2d');
  masterCtx.scale(BACKING_SCALE, BACKING_SCALE);
  drawMaster(masterCtx);

  state.dimCanvas = makeDimCanvas(state.masterCanvas);
  state.litCanvas = makeLitCanvas(state.masterCanvas);
  state.created = true;
  state.quarters = 0;
  paint();

  if (document.body) document.body.appendChild(element);
  return element;
}

// Make it visible. Called by main.js when a run is under way.
export function showBadge() {
  createBadge();
  state.element.hidden = false;
}

// Hide it again. The medal keeps its fill, so showing it later picks up where setBadgeQuarters left off.
export function hideBadge() {
  createBadge();
  state.element.hidden = true;
}

// Fill the first n of the four quadrants. Called every frame, so it redraws only when n actually changes.
export function setBadgeQuarters(n) {
  createBadge();
  const wanted = clampQuarters(n);
  if (wanted === state.quarters) return;   // nothing changed: no redraw
  state.quarters = wanted;
  paint();
}
