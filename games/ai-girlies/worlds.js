// Lucid Ink world backgrounds: draws the Print Shop, The Garden and Midnight Sky panels in one call,
// varying props, detail and colour lift per comic panel (1-8) while the stage keeps driving the look.
import {
  PLAYFIELD_W, PLAYFIELD_H, PANEL_MARGIN, GROUND_Y, OUTLINE_WIDTH,
  COLOR_PAPER, COLOR_INK, HALFTONE_OPACITY,
} from './tuning.js';

// Panel bounds every layer stays inside.
const LEFT = PANEL_MARGIN;
const RIGHT = PLAYFIELD_W - PANEL_MARGIN;
const TOP = PANEL_MARGIN;
const BASE = GROUND_Y;                                     // y of the ground line
const GROUND_BOTTOM = Math.min(GROUND_Y + 72, PLAYFIELD_H - PANEL_MARGIN);

// Drawing stages: 0 graphite sketch, 1 bold ink, 2 halftone colour, 3 neon finished panel.
const SKETCH = 0;
const INK = 1;
const COLOR = 2;
const NEON = 3;

// Per-world accents named in context/LOOK.md.
const PALETTES = [
  { // 0 Print Shop: vermilion, mustard, silver.
    skyTop: '#D9553C', skyMid: '#EDA173', skyBottom: '#F2E5C4',
    brickA: '#C4342A', brickB: '#E94B35', brickC: '#E9B949',
    accent: '#E94B35', glow: '#E9B949', silver: '#B9BEC4',
    ground: '#C44B5A', groundTop: '#E9B949',
  },
  { // 1 The Garden: terracotta, leaf green, pink, robin blue.
    skyTop: '#7EC8E3', skyMid: '#C8E6DE', skyBottom: '#F2E5C4',
    hillFar: '#8FBC5A', hillMid: '#76A035', hillNear: '#5C8A2A',
    leaf: '#76A035', leafDark: '#4E7A24', terracotta: '#C86D51', pink: '#E58AA0',
    robin: '#3B7EA1', iron: '#4A4A4A',
    accent: '#76A035', glow: '#E9B949',
    ground: '#76A035', groundTop: '#C86D51',
  },
  { // 2 Midnight Sky: deep blue, lunar cream, fiery gold.
    skyTop: '#141C33', skyMid: '#26304F', skyBottom: '#4A3D6B',
    buildA: '#2A3352', buildB: '#1E2740', buildC: '#3A3560',
    moon: '#FFF4D2', gold: '#F7B32B',
    accent: '#F7B32B', glow: '#F7B32B',
    ground: '#5A4A8A', groundTop: '#F7B32B',
  },
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const halftoneCache = new Map();

// A cached halftone dot pattern tinted to one colour, built on the panel's own context.
function halftone(ctx, color) {
  if (halftoneCache.has(color)) return halftoneCache.get(color);
  const tile = document.createElement('canvas');
  tile.width = 14;
  tile.height = 14;
  const t = tile.getContext('2d');
  t.fillStyle = color;
  t.beginPath(); t.arc(4, 4, 1.9, 0, Math.PI * 2); t.fill();
  t.beginPath(); t.arc(11, 11, 1.9, 0, Math.PI * 2); t.fill();
  const pattern = ctx.createPattern(tile, 'repeat');
  halftoneCache.set(color, pattern);
  return pattern;
}

// Stable 0..1 noise so scenery never jitters between frames.
function rng(seed) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Sketch pass: grey construction lines only, no fill.
function sketchStyle(ctx, alpha) {
  ctx.strokeStyle = '#8A8A8A';
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = alpha;
}

// Ink pass: bold comic outline.
function inkStyle(ctx, weight) {
  ctx.strokeStyle = COLOR_INK;
  ctx.lineWidth = OUTLINE_WIDTH * (weight === undefined ? 0.8 : weight);
  ctx.globalAlpha = 1;
}

// Paint a coloured surface with a halftone tint and a chunky ink outline.
// inkFill overrides the flat ink used at stage 1 (paper for signs and windows).
function surface(ctx, stage, x, y, w, h, color, tint, inkFill) {
  if (stage === SKETCH) {
    sketchStyle(ctx, 0.65);
    ctx.strokeRect(x, y, w, h);
    return;
  }
  ctx.fillStyle = stage === INK ? (inkFill || COLOR_INK) : color;
  ctx.fillRect(x, y, w, h);
  if (stage >= COLOR && tint) {
    ctx.globalAlpha = HALFTONE_OPACITY;
    ctx.fillStyle = halftone(ctx, tint);
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
  inkStyle(ctx);
  ctx.strokeRect(x, y, w, h);
}

// Diagonal pencil hatching, clipped exactly to the rectangle it fills.
function hatch(ctx, x, y, w, h, step) {
  ctx.beginPath();
  for (let i = 0; i <= w + h; i += (step || 16)) {
    const px0 = Math.max(x, x + i);
    const px1 = Math.min(x + w, x + i + h);
    if (px1 <= px0) continue;
    ctx.moveTo(px0, y + h - (px0 - x - i));
    ctx.lineTo(px1, y + h - (px1 - x - i));
  }
  ctx.stroke();
}

function bird(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y);
  ctx.quadraticCurveTo(x - 3 * s, y - 5 * s, x, y);
  ctx.quadraticCurveTo(x + 3 * s, y - 5 * s, x + 6 * s, y);
  ctx.stroke();
}

function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const rad = i % 2 === 0 ? r : r * 0.32;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

function sunburst(ctx, cx, cy, r0, r1, rays, weight) {
  ctx.lineWidth = weight || 3;
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI * 2 * i) / rays;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
}

// Per-panel progression: every panel 1-8 nudges what the scene shows so no two
// panels read the same, without changing the world's theme or the stage look.
function vary(panel) {
  const pn = Math.max(1, Math.min(8, Math.round(Number(panel) || 1)));
  const t = (pn - 1) / 7;                 // 0 on panel 1, 1 on panel 8
  return {
    panel: pn,
    t,                                    // how far into the strip we are
    shift: ((pn * 7) % 25) - 12,          // horizontal prop drift in pixels
    extra: Math.floor((pn - 1) / 3),      // 0,0,0,1,1,1,2,2 extra details
    accent: pn === 4 || pn === 8,         // the two hero panels get a burst
    tint: 0.04 + t * 0.08,                // colour lift: later panels run richer
  };
}

// A soft accent wash laid over the scenery: panels gain colour intensity toward 8.
function panelTone(ctx, stage, p, v) {
  if (stage < COLOR || v.t <= 0) return;
  ctx.save();
  ctx.globalAlpha = v.tint;
  ctx.fillStyle = p.accent;
  ctx.fillRect(LEFT, TOP, RIGHT - LEFT, BASE - TOP);
  ctx.restore();
}

// Rays bursting from a point: the shared "this panel is a hero panel" flourish.
function accentBurst(ctx, stage, v, cx, cy, color) {
  if (!v.accent || stage < COLOR) return;
  ctx.save();
  ctx.strokeStyle = stage === NEON ? color : COLOR_INK;
  ctx.globalAlpha = stage === NEON ? 0.85 : 0.45;
  if (stage === NEON) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
  }
  sunburst(ctx, cx, cy, 16 + v.panel, 34 + v.panel * 1.6, 14, 3);
  ctx.restore();
}

// Rounded ink blob (ink splatter), sized in pixels.
function blob(ctx, cx, cy, r, seed) {
  const n = 7;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const rad = r * (0.7 + rng(seed + i * 31) * 0.6);
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad * 0.7;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Layer 1: sky
// ---------------------------------------------------------------------------

function drawSky(ctx, stage, p, v) {
  if (stage === SKETCH) {
    ctx.save();
    ctx.fillStyle = '#B8B0A0';
    ctx.globalAlpha = 0.14 + v.t * 0.08;   // the sketch firms up panel by panel
    ctx.fillRect(LEFT, TOP, RIGHT - LEFT, BASE - TOP);
    ctx.restore();
    return;
  }
  const grad = ctx.createLinearGradient(0, TOP, 0, BASE);
  grad.addColorStop(0, p.skyTop);
  grad.addColorStop(0.42 + v.t * 0.14, p.skyMid); // mid band sinks as the strip goes on
  grad.addColorStop(1, p.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(LEFT, TOP, RIGHT - LEFT, BASE - TOP);

  if (stage === NEON) {
    // Neon horizon bloom, deeper on the later panels.
    ctx.save();
    const h = 110 + v.panel * 6;
    const glow = ctx.createLinearGradient(0, BASE - h, 0, BASE);
    glow.addColorStop(0, 'rgba(255,244,210,0)');
    glow.addColorStop(1, `rgba(255,244,210,${(0.3 + v.t * 0.14).toFixed(3)})`);
    ctx.fillStyle = glow;
    ctx.fillRect(LEFT, BASE - h, RIGHT - LEFT, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// World 0: Print Shop
// ---------------------------------------------------------------------------

function drawBrickBlock(ctx, stage, b, depth, p) {
  const x = b.x;
  const y = BASE - b.h;
  const w = b.w;
  const h = b.h;
  ctx.save();
  if (stage === SKETCH) {
    sketchStyle(ctx, depth < 1 ? 0.4 : 0.7);
    ctx.strokeRect(x, y, w, h);
    hatch(ctx, x, y, w, h, depth < 1 ? 22 : 15);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = depth < 1 ? 0.55 : 1;
  ctx.fillStyle = depth < 1 ? p.brickA : b.shade;
  ctx.fillRect(x, y, w, h);
  inkStyle(ctx, 0.85);
  ctx.strokeRect(x, y, w, h);

  if (stage >= COLOR) {
    // Brick courses.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = COLOR_INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let ry = y + 12; ry < BASE; ry += 12) {
      ctx.moveTo(x, ry);
      ctx.lineTo(x + w, ry);
    }
    ctx.stroke();
    ctx.restore();
    // Halftone shadow down the shaded side.
    ctx.save();
    ctx.globalAlpha = HALFTONE_OPACITY * (depth < 1 ? 0.7 : 1);
    ctx.fillStyle = halftone(ctx, p.accent);
    ctx.fillRect(x + w * 0.62, y, w * 0.38, h);
    ctx.restore();
    // Cornice band.
    surface(ctx, stage, x - 3, y - 7, w + 6, 8, p.brickC, p.accent, COLOR_PAPER);
  }
  ctx.restore();
}

// Windows light up differently on every panel: how many are lit, and which.
function drawWindows(ctx, stage, b, p, v) {
  const cols = 2;
  const rows = b.windows;
  const winW = b.w * 0.22;
  const winH = 15;
  const spanY = (b.h - 60) / rows;
  ctx.save();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = b.x + b.w * 0.16 + c * (b.w * 0.46);
      const wy = BASE - b.h + 34 + r * spanY;
      const lit = rng(v.panel * 977 + b.x + r * 17 + c * 29) > 0.2 + v.t * 0.3;
      if (lit) {
        if (stage === NEON) {
          ctx.save();
          ctx.shadowColor = p.glow;
          ctx.shadowBlur = 10;
        }
        surface(ctx, stage, wx, wy, winW, winH, stage === NEON ? p.glow : p.skyBottom, p.accent, COLOR_PAPER);
        if (stage === NEON) ctx.restore();
      } else {
        surface(ctx, stage, wx, wy, winW, winH, 'rgba(40,34,30,0.4)', p.accent, COLOR_INK);
      }
    }
  }
  ctx.restore();
}

function drawFireEscape(ctx, stage, b) {
  if (stage <= SKETCH) return;
  ctx.save();
  inkStyle(ctx, 0.55);
  const x = b.x - 20;
  const levels = 3;
  const stepY = b.h / 3.4;
  for (let i = 0; i < levels; i++) {
    const py = BASE - b.h + 48 + i * stepY;
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(x + 34, py);
    ctx.stroke();
    ctx.beginPath();
    for (let rx = x; rx <= x + 34; rx += 8) {
      ctx.moveTo(rx, py);
      ctx.lineTo(rx, py - 12);
    }
    ctx.moveTo(x, py - 12);
    ctx.lineTo(x + 34, py - 12);
    ctx.stroke();
    if (i < levels - 1) {
      ctx.beginPath();
      ctx.moveTo(x + 30, py);
      ctx.lineTo(x + 6, py + stepY);
      ctx.moveTo(x + 20, py);
      ctx.lineTo(x - 4, py + stepY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRoofKit(ctx, stage, b, p, v) {
  const y = BASE - b.h;
  // Chimney.
  surface(ctx, stage, b.x + b.w * 0.18, y - 22, 16, 24, p.brickA, p.accent);
  // Water tank on legs, taller on the later panels.
  const tx = b.x + b.w * 0.62;
  const tankH = 24 + v.extra * 5;
  if (stage > SKETCH) {
    inkStyle(ctx, 0.6);
    ctx.beginPath();
    ctx.moveTo(tx, y); ctx.lineTo(tx, y - 14);
    ctx.moveTo(tx + 26, y); ctx.lineTo(tx + 26, y - 14);
    ctx.stroke();
  }
  surface(ctx, stage, tx - 4, y - 14 - tankH, 34, tankH, p.silver, p.accent, COLOR_PAPER);
  // Later panels add a second vent stack beside the tank.
  if (v.extra > 0) surface(ctx, stage, tx + 40, y - 20 - v.extra * 8, 10, 20 + v.extra * 8, p.silver, p.accent);
}

// The hanging shop sign: a stylised ink bottle and press roller, no lettering.
// The whole sign drifts a little from panel to panel.
function drawInkSign(ctx, stage, p, v) {
  const sx = RIGHT - 176 + v.shift;
  const sy = 132 + (v.panel % 3) * 7;
  ctx.save();
  inkStyle(ctx, 0.6);
  if (stage === SKETCH) sketchStyle(ctx, 0.7);
  // Bracket arm.
  ctx.beginPath();
  ctx.moveTo(sx - 10, sy);
  ctx.lineTo(sx + 96, sy);
  ctx.stroke();
  // Chains.
  ctx.beginPath();
  ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 28);
  ctx.moveTo(sx + 66, sy); ctx.lineTo(sx + 66, sy + 28);
  ctx.stroke();
  // Board.
  surface(ctx, stage, sx - 6, sy + 26, 78, 44, stage === NEON ? p.glow : COLOR_PAPER, p.accent, COLOR_PAPER);
  if (stage === SKETCH) {
    ctx.restore();
    return;
  }
  // Icon: ink bottle (left) and printing-press roller with its crank (right).
  ctx.save();
  ctx.strokeStyle = COLOR_INK;
  ctx.fillStyle = COLOR_INK;
  ctx.lineWidth = OUTLINE_WIDTH * 0.5;
  ctx.lineJoin = 'round';
  // Bottle body, then neck and cap.
  ctx.beginPath();
  ctx.moveTo(sx + 14, sy + 58);
  ctx.lineTo(sx + 17, sy + 46);
  ctx.lineTo(sx + 29, sy + 46);
  ctx.lineTo(sx + 32, sy + 58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(sx + 19, sy + 38, 8, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(sx + 16, sy + 33, 14, 5);
  ctx.fill();
  ctx.stroke();
  // Roller barrel with a crank handle.
  ctx.beginPath();
  ctx.rect(sx + 38, sy + 43, 24, 13);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + 62, sy + 49);
  ctx.lineTo(sx + 68, sy + 49);
  ctx.lineTo(sx + 68, sy + 37);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawScissors(ctx, stage, p) {
  const cx = RIGHT - 84;
  const cy = 186;
  ctx.save();
  inkStyle(ctx, 0.6);
  if (stage === SKETCH) sketchStyle(ctx, 0.7);
  ctx.strokeStyle = stage === SKETCH ? '#8A8A8A' : (stage === INK ? COLOR_PAPER : p.silver);
  ctx.lineWidth = OUTLINE_WIDTH * 0.8;
  // Two handles.
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 12, 8, 0, Math.PI * 2);
  ctx.arc(cx + 8, cy + 12, 8, 0, Math.PI * 2);
  ctx.stroke();
  // Blades crossing to a point.
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 6);
  ctx.lineTo(cx + 14, cy - 22);
  ctx.lineTo(cx + 18, cy - 18);
  ctx.lineTo(cx - 4, cy + 10);
  ctx.closePath();
  ctx.moveTo(cx + 12, cy + 6);
  ctx.lineTo(cx - 14, cy - 22);
  ctx.lineTo(cx - 18, cy - 18);
  ctx.lineTo(cx + 4, cy + 10);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawPowerLines(ctx, stage, p, v) {
  if (stage <= SKETCH) return;
  ctx.save();
  ctx.strokeStyle = COLOR_INK;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = stage === INK ? 0.4 : 0.6;
  const y = 128 + (v.panel % 4) * 4;                  // the wires ride up and down
  const poles = [LEFT + 40 + v.shift, LEFT + 210 + v.shift,
    RIGHT - 250 - v.shift, RIGHT - 90 - v.shift];
  for (const px of poles) {
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, BASE - 70);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - 15, y);
    ctx.lineTo(px + 15, y);
    ctx.stroke();
  }
  // Crisscrossing wires.
  ctx.beginPath();
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i];
    const b = poles[i + 1];
    ctx.moveTo(a - 14, y + 3);
    ctx.quadraticCurveTo((a + b) / 2, y + 26, b - 14, y + 3);
    ctx.moveTo(a + 14, y + 6);
    ctx.quadraticCurveTo((a + b) / 2, y - 12, b + 14, y + 6);
  }
  ctx.stroke();
  ctx.restore();
  // Birds perched on the wires: a couple more join on the later panels.
  ctx.save();
  inkStyle(ctx, 0.5);
  bird(ctx, poles[1] + 40, y + 16, 1);
  bird(ctx, poles[1] + 58, y + 20, 0.8);
  bird(ctx, poles[2] - 30, y + 13, 0.9);
  if (v.extra > 0) bird(ctx, poles[2] - 12, y + 18, 0.75);
  if (v.extra > 1) bird(ctx, poles[0] + 60, y + 14, 0.85);
  ctx.restore();
}

function drawInkSplatters(ctx, stage, p, v) {
  if (stage <= SKETCH) return;
  ctx.save();
  inkStyle(ctx, 0.6);
  // A pool of candidate splats: which ones show, and how many, rotates per panel.
  const spots = [
    { x: LEFT + 120, y: 168, r: 13 },
    { x: LEFT + 320, y: 96, r: 9 },
    { x: RIGHT - 300, y: 200, r: 11 },
    { x: LEFT + 240, y: 236, r: 7 },
    { x: RIGHT - 190, y: 108, r: 12 },
    { x: LEFT + 430, y: 190, r: 8 },
    { x: RIGHT - 420, y: 246, r: 10 },
  ];
  const count = 3 + (v.panel % 4);        // 3 to 6 splats, a new set every panel
  const start = v.panel % spots.length;
  for (let i = 0; i < count; i++) {
    const s = spots[(start + i) % spots.length];
    const x = s.x + v.shift;
    const y = s.y + ((v.panel % 3) - 1) * 9;
    ctx.fillStyle = stage === INK ? COLOR_INK : p.accent;
    blob(ctx, x, y, s.r, v.panel * 97 + i * 31 + 11);
    ctx.fill();
    ctx.stroke();
    // A couple of flung droplets, always in the same direction for this panel.
    const flung = 2 + (v.panel + i) % 3;
    for (let d = 0; d < flung; d++) {
      const a = rng(v.panel * 53 + i * 7 + d * 19) * Math.PI * 2;
      const dist = s.r * (2.1 + rng(i * 29 + d) * 1.6);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist * 0.7,
        Math.max(1.5, s.r * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Halftone shadow pooling along the base of the block, behind the near buildings.
function drawBaseShadow(ctx, stage, p) {
  if (stage < COLOR) return;
  ctx.save();
  ctx.globalAlpha = HALFTONE_OPACITY;
  ctx.fillStyle = halftone(ctx, p.accent);
  ctx.fillRect(LEFT, BASE - 96, RIGHT - LEFT, 96);
  ctx.restore();
}

function drawPrintShop(ctx, stage, p, v) {
  // Far row of brick blocks, hazy behind everything. Later panels add one more roof.
  const far = [
    { x: LEFT + 6, w: 70, h: 132, shade: p.brickA },
    { x: LEFT + 84, w: 58, h: 172, shade: p.brickC },
    { x: LEFT + 150, w: 84, h: 112, shade: p.brickA },
    { x: RIGHT - 246, w: 66, h: 152, shade: p.brickC },
    { x: RIGHT - 172, w: 90, h: 122, shade: p.brickA },
    { x: RIGHT - 74, w: 62, h: 188, shade: p.brickC },
  ];
  if (v.extra > 1) far.push({ x: LEFT + 240, w: 54, h: 144, shade: p.brickC });
  for (const b of far) drawBrickBlock(ctx, stage, b, 0.5, p);
  drawBaseShadow(ctx, stage, p);

  drawPowerLines(ctx, stage, p, v);

  // Near row, taller, with lit windows, fire escapes and rooftop kit.
  // The pair slides horizontally panel to panel so the skyline keeps changing.
  const near = [
    { x: LEFT + 22 + v.shift, w: 106, h: 212, shade: p.brickB, windows: 4, fire: true, roof: true },
    { x: RIGHT - 156 - v.shift, w: 130, h: 238, shade: p.brickA, windows: 4, fire: true, roof: false },
  ];
  for (const b of near) drawBrickBlock(ctx, stage, b, 1, p);
  for (const b of near) {
    if (stage > SKETCH) {
      drawWindows(ctx, stage, b, p, v);
      if (b.roof) drawRoofKit(ctx, stage, b, p, v);
      if (b.fire) drawFireEscape(ctx, stage, b);
    }
  }

  // Hero panels 4 and 8 get a burst in a different patch of the sky.
  accentBurst(ctx, stage, v, v.panel === 4 ? LEFT + 330 : RIGHT - 470,
    v.panel === 4 ? 128 : 208, p.accent);

  drawInkSign(ctx, stage, p, v);
  drawScissors(ctx, stage, p);
  drawInkSplatters(ctx, stage, p, v);
}

// ---------------------------------------------------------------------------
// World 1: The Garden
// ---------------------------------------------------------------------------

function drawHills(ctx, stage, p, v) {
  // Each panel slides the hill crests along, so the horizon never repeats.
  const drift = v.panel * 26;
  const layers = [
    { y: BASE - 96 - v.extra * 6, amp: 34, freq: 0.0055, shift: drift, fill: p.hillFar },
    { y: BASE - 58, amp: 26, freq: 0.008, shift: 140 + drift, fill: p.hillMid },
    { y: BASE - 24, amp: 18, freq: 0.011, shift: 60 - drift, fill: p.hillNear },
  ];
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    ctx.beginPath();
    ctx.moveTo(LEFT, L.y);
    for (let x = LEFT; x <= RIGHT; x += 16) {
      ctx.lineTo(x, L.y - Math.sin((x + L.shift) * L.freq) * L.amp);
    }
    ctx.lineTo(RIGHT, BASE);
    ctx.lineTo(LEFT, BASE);
    ctx.closePath();
    if (stage === SKETCH) {
      sketchStyle(ctx, 0.55);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = stage === INK ? COLOR_INK : L.fill;
    ctx.globalAlpha = stage === INK ? 1 : (i === 0 ? 0.7 : 1);
    ctx.fill();
    inkStyle(ctx, 0.8);
    ctx.stroke();
    // Leaf halftone drifting over the nearer hills.
    if (stage >= COLOR && i === 2) {
      ctx.save();
      ctx.globalAlpha = HALFTONE_OPACITY;
      ctx.fillStyle = halftone(ctx, p.leafDark);
      ctx.fillRect(LEFT, L.y - L.amp, RIGHT - LEFT, BASE - (L.y - L.amp));
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function drawTree(ctx, stage, x, groundY, s, p) {
  const trunkH = 46 * s;
  ctx.save();
  if (stage === SKETCH) {
    sketchStyle(ctx, 0.6);
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, groundY - trunkH);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, groundY - trunkH - 26 * s, 30 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Trunk.
  const tw = 10 * s;
  ctx.fillStyle = p.terracotta;
  ctx.fillRect(x - tw / 2, groundY - trunkH, tw, trunkH);
  inkStyle(ctx, 0.7);
  ctx.strokeRect(x - tw / 2, groundY - trunkH, tw, trunkH);
  // Canopy: three overlapping leaf clumps.
  const cy = groundY - trunkH - 20 * s;
  const clumps = [
    { dx: -22 * s, dy: 6 * s, r: 24 * s },
    { dx: 22 * s, dy: 4 * s, r: 22 * s },
    { dx: 0, dy: -14 * s, r: 28 * s },
  ];
  for (const c of clumps) {
    ctx.beginPath();
    ctx.arc(x + c.dx, cy + c.dy, c.r, 0, Math.PI * 2);
    ctx.fillStyle = stage === INK ? COLOR_INK : p.leaf;
    ctx.fill();
    if (stage >= COLOR) {
      ctx.save();
      ctx.globalAlpha = HALFTONE_OPACITY;
      ctx.fillStyle = halftone(ctx, p.leafDark);
      ctx.fill();
      ctx.restore();
    }
    inkStyle(ctx, 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHedge(ctx, stage, x, y, w, p) {
  ctx.save();
  const bumps = Math.max(2, Math.round(w / 26));
  const r = w / bumps / 2;
  ctx.beginPath();
  for (let i = 0; i < bumps; i++) {
    const bx = x + r + i * r * 2;
    ctx.moveTo(bx - r, y);
    ctx.arc(bx, y, r, Math.PI, 0, false);
  }
  ctx.lineTo(x + w, y + 20);
  ctx.lineTo(x, y + 20);
  ctx.closePath();
  if (stage === SKETCH) {
    sketchStyle(ctx, 0.6);
    ctx.stroke();
  } else {
    ctx.fillStyle = stage === INK ? COLOR_INK : p.leafDark;
    ctx.fill();
    inkStyle(ctx, 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlanter(ctx, stage, x, groundY, p) {
  const w = 46;
  const h = 34;
  ctx.save();
  // Tapered terracotta pot.
  ctx.beginPath();
  ctx.moveTo(x - w / 2, groundY - h);
  ctx.lineTo(x + w / 2, groundY - h);
  ctx.lineTo(x + w * 0.34, groundY);
  ctx.lineTo(x - w * 0.34, groundY);
  ctx.closePath();
  if (stage !== SKETCH) {
    ctx.fillStyle = stage === INK ? COLOR_INK : p.terracotta;
    ctx.fill();
  }
  if (stage === SKETCH) sketchStyle(ctx, 0.6); else inkStyle(ctx, 0.8);
  ctx.stroke();
  // Rim.
  surface(ctx, stage, x - w / 2 - 4, groundY - h - 9, w + 8, 10, p.terracotta, p.leafDark, COLOR_PAPER);
  // Sprigs.
  if (stage > SKETCH) {
    inkStyle(ctx, 0.6);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 10, groundY - h - 8);
      ctx.quadraticCurveTo(x + i * 18, groundY - h - 30, x + i * 6, groundY - h - 44);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + i * 6, groundY - h - 44, 5, 0, Math.PI * 2);
      ctx.fillStyle = stage >= COLOR ? p.pink : COLOR_PAPER;
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGate(ctx, stage, x, groundY, p) {
  const w = 108;
  const h = 122;
  ctx.save();
  inkStyle(ctx, 0.7);
  if (stage === SKETCH) sketchStyle(ctx, 0.6);
  ctx.strokeStyle = stage === SKETCH ? '#8A8A8A' : p.iron;
  ctx.lineWidth = 3;
  // Posts.
  ctx.beginPath();
  ctx.moveTo(x - w / 2, groundY);
  ctx.lineTo(x - w / 2, groundY - h);
  ctx.moveTo(x + w / 2, groundY);
  ctx.lineTo(x + w / 2, groundY - h);
  ctx.stroke();
  // Arch.
  ctx.beginPath();
  ctx.moveTo(x - w / 2, groundY - h);
  ctx.quadraticCurveTo(x, groundY - h - 40, x + w / 2, groundY - h);
  ctx.stroke();
  // Bars and scroll.
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const bx = x - w / 2 + (w / 6) * i;
    ctx.beginPath();
    ctx.moveTo(bx, groundY);
    ctx.lineTo(bx, groundY - h + 12);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x - w / 2, groundY - h * 0.55);
  ctx.quadraticCurveTo(x, groundY - h * 0.75, x + w / 2, groundY - h * 0.55);
  ctx.stroke();
  ctx.restore();
}

function drawFlowers(ctx, stage, p, v) {
  if (stage <= SKETCH) return;
  const colors = [p.pink, p.glow, p.robin];
  // A larger bed to pick from: the count and the mix change every panel.
  const all = [
    { x: LEFT + 60, h: 26 }, { x: LEFT + 108, h: 34 }, { x: LEFT + 168, h: 22 },
    { x: RIGHT - 84, h: 30 }, { x: RIGHT - 140, h: 24 }, { x: LEFT + 320, h: 28 },
    { x: RIGHT - 260, h: 20 }, { x: LEFT + 400, h: 32 }, { x: RIGHT - 190, h: 34 },
  ];
  const count = 4 + (v.panel % 4);        // 4 to 7 blooms, rotating down the bed
  const start = (v.panel * 2) % all.length;
  const spots = [];
  for (let i = 0; i < count; i++) spots.push(all[(start + i) % all.length]);
  ctx.save();
  inkStyle(ctx, 0.55);
  for (let i = 0; i < spots.length; i++) {
    const f = spots[i];
    const gy = BASE;
    ctx.beginPath();
    ctx.moveTo(f.x, gy);
    ctx.quadraticCurveTo(f.x - 5, gy - f.h * 0.6, f.x, gy - f.h);
    ctx.stroke();
    // Petals.
    const cx = f.x;
    const cy = gy - f.h;
    const r = 5;
    for (let pt = 0; pt < 5; pt++) {
      const a = (Math.PI * 2 * pt) / 5;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = stage === INK ? COLOR_INK : colors[(i + v.panel) % colors.length];
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = stage === INK ? COLOR_PAPER : p.glow;
    ctx.fill();
    ctx.stroke();
  }
  // A small robin perched on the gate arch, with company on the later panels.
  ctx.strokeStyle = COLOR_INK;
  bird(ctx, LEFT + 250 + v.shift * 0.5, 284, 1.2);
  if (v.extra > 0) bird(ctx, LEFT + 300 - v.shift * 0.5, 292, 0.9);
  ctx.restore();
}

function drawGarden(ctx, stage, p, v) {
  drawHills(ctx, stage, p, v);

  // Leaf halftone washing the distant field, behind every tree and hedge.
  if (stage >= COLOR) {
    ctx.save();
    ctx.globalAlpha = HALFTONE_OPACITY * (1 + v.t * 0.5);
    ctx.fillStyle = halftone(ctx, p.leafDark);
    ctx.fillRect(LEFT, BASE - 150, RIGHT - LEFT, 150);
    ctx.restore();
  }

  const sx = v.shift * 1.4;               // plants drift a little each panel

  // Far tree line: the middle tree wanders, and later panels gain a fourth.
  drawTree(ctx, stage, LEFT + 70 + sx, BASE - 40, 0.7, p);
  drawTree(ctx, stage, RIGHT - 90 - sx, BASE - 36, 0.6, p);
  drawTree(ctx, stage, PLAYFIELD_W / 2 + 40 + sx * 2, BASE - 46, 0.5, p);
  if (v.extra > 1) drawTree(ctx, stage, LEFT + 400 + sx, BASE - 42, 0.55, p);

  drawGate(ctx, stage, LEFT + 250 + v.shift, BASE - 20, p);

  // Mid hedge and planters.
  drawHedge(ctx, stage, LEFT + 10, BASE - 78 - v.extra * 4, 150, p);
  drawHedge(ctx, stage, RIGHT - 190, BASE - 74, 180, p);
  drawPlanter(ctx, stage, LEFT + 46 + sx, BASE - 4, p);
  drawPlanter(ctx, stage, RIGHT - 46 - sx, BASE - 4, p);
  // Panels 4 and up add one more planter between the pair.
  if (v.extra > 0) drawPlanter(ctx, stage, LEFT + 300 - sx, BASE - 4, p);

  // Near trees in front of the hedges, shifting against the far line.
  drawTree(ctx, stage, LEFT + 160 - sx, BASE - 6, 1.0, p);
  drawTree(ctx, stage, RIGHT - 120 + sx, BASE - 6, 1.1, p);

  // Hero panels 4 and 8 flower into an open burst above the hedges.
  accentBurst(ctx, stage, v, v.panel === 4 ? PLAYFIELD_W / 2 - 40 : PLAYFIELD_W / 2 + 150,
    v.panel === 4 ? 150 : 196, p.pink);

  drawFlowers(ctx, stage, p, v);
}

// ---------------------------------------------------------------------------
// World 2: Midnight Sky
// ---------------------------------------------------------------------------

function drawStars(ctx, stage, p, v) {
  if (stage <= SKETCH) return;
  ctx.save();
  ctx.strokeStyle = COLOR_INK;
  ctx.lineWidth = 1.4;
  const count = 10 + v.panel * 2;         // 12 stars on panel 1 up to 26 on panel 8
  const spread = 150 + v.t * 40;          // the later skies open up vertically
  for (let i = 0; i < count; i++) {
    const x = LEFT + 24 + rng(i * 71 + 3) * (RIGHT - LEFT - 48);
    const y = TOP + 22 + rng(i * 37 + 9) * spread;
    const r = 3 + rng(i * 13 + 5) * 4;
    star(ctx, x, y, r, stage === INK ? COLOR_PAPER : p.moon);
  }
  // A couple of sparkle bursts, nudged with the panel.
  if (stage >= COLOR) {
    ctx.strokeStyle = stage === NEON ? p.gold : COLOR_INK;
    ctx.lineWidth = 2;
    sunburst(ctx, LEFT + 150 + v.shift, 96 + (v.panel % 4) * 8, 12, 22, 4, 2);
    sunburst(ctx, RIGHT - 200 - v.shift, 150 - (v.panel % 3) * 6, 10, 18, 4, 2);
  }
  ctx.restore();
}

function drawMoon(ctx, stage, p, v) {
  if (stage === SKETCH) return;
  const cx = RIGHT - 120 - v.shift;
  const cy = 120 + (v.panel % 3) * 5;
  const r = 48 + v.t * 9;                 // the moon swells toward the last panel
  ctx.save();
  inkStyle(ctx, 0.85);
  if (stage === NEON) {
    ctx.shadowColor = p.moon;
    ctx.shadowBlur = 26;
  }
  ctx.fillStyle = p.moon;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.62, Math.PI * 0.62);
  ctx.arc(cx + 24, cy, r - 10, Math.PI * 0.5, -Math.PI * 0.5, true);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  // Crater dents: a different set on every panel.
  if (stage >= COLOR) {
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 2 + (v.panel % 3); i++) {
      const a = rng(v.panel * 41 + i * 13) * Math.PI * 2;
      const d = rng(v.panel * 17 + i * 7) * r * 0.45;
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4 + rng(i * 5 + v.panel) * 4, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawSkyline(ctx, stage, p, v) {
  // Back row: flat dark silhouettes.
  const back = [
    { x: LEFT + 4, w: 56, h: 150, shade: p.buildB },
    { x: LEFT + 66, w: 44, h: 190, shade: p.buildB },
    { x: LEFT + 116, w: 62, h: 128, shade: p.buildB },
    { x: RIGHT - 236, w: 52, h: 168, shade: p.buildB },
    { x: RIGHT - 178, w: 68, h: 132, shade: p.buildB },
    { x: RIGHT - 104, w: 48, h: 200, shade: p.buildB },
  ];
  if (v.extra > 0) back.push({ x: LEFT + 380, w: 50, h: 176, shade: p.buildB });
  for (const b of back) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    surface(ctx, stage, b.x, BASE - b.h, b.w, b.h, b.shade, p.accent);
    ctx.restore();
  }

  // Front row: taller, with lit windows and rooftop antennae. The row slides
  // a little per panel, and the towers grow as the strip goes on.
  const front = [
    { x: LEFT + 18 + v.shift, w: 92, h: 236 + v.extra * 10, shade: p.buildA, rows: 6 },
    { x: PLAYFIELD_W / 2 - 40 - v.shift, w: 84, h: 276 + v.extra * 8, shade: p.buildC, rows: 7 },
    { x: RIGHT - 150 - v.shift, w: 108, h: 250 - v.extra * 6, shade: p.buildA, rows: 6 },
  ];
  for (const b of front) {
    surface(ctx, stage, b.x, BASE - b.h, b.w, b.h, b.shade, p.accent);
    if (stage > SKETCH) {
      // Lit windows: how many are lit shifts panel by panel.
      const cols = 2;
      const winW = b.w * 0.2;
      const winH = 13;
      const spanY = (b.h - 60) / b.rows;
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = rng(v.panel * 613 + b.x + r * 17 + c * 29) > 0.1 + v.t * 0.4;
          const wx = b.x + b.w * 0.16 + c * (b.w * 0.46);
          const wy = BASE - b.h + 30 + r * spanY;
          ctx.save();
          if (stage === NEON && lit) {
            ctx.shadowColor = p.gold;
            ctx.shadowBlur = 10;
          }
          ctx.fillStyle = lit ? (stage === INK ? COLOR_PAPER : p.moon) : 'rgba(36,33,37,0.35)';
          ctx.fillRect(wx, wy, winW, winH);
          ctx.restore();
        }
      }
      // Antenna with a blinker, taller on the later panels.
      ctx.save();
      inkStyle(ctx, 0.5);
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, BASE - b.h);
      ctx.lineTo(b.x + b.w * 0.5, BASE - b.h - 30 - v.extra * 14);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// The neon shopfront: a glowing geometric burst in a gold surround, no lettering.
function drawNeonBurst(ctx, stage, p, v) {
  if (stage === SKETCH) return;
  const nx = PLAYFIELD_W / 2 - 62 - v.shift;
  const ny = 176 + (v.panel % 3) * 8;
  const cx = nx + 62;
  const cy = ny + 23;
  const rays = 6 + v.extra * 2;           // more points on the later panels
  ctx.save();
  if (stage === NEON) {
    ctx.shadowColor = p.gold;
    ctx.shadowBlur = 22;
  }
  surface(ctx, stage, nx, ny, 124, 46, stage === INK ? COLOR_PAPER : p.gold, p.accent, COLOR_PAPER);
  ctx.shadowBlur = 0;
  // Ink spokes on paper at stage 1, ink spokes on gold from stage 2 up.
  ctx.strokeStyle = COLOR_INK;
  ctx.fillStyle = COLOR_INK;
  ctx.lineWidth = OUTLINE_WIDTH * 0.55;
  ctx.lineJoin = 'round';
  // Radiating spokes.
  ctx.beginPath();
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI * 2 * i) / rays + 0.2;
    ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
    ctx.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
  }
  ctx.stroke();
  // Diamond core.
  ctx.beginPath();
  ctx.moveTo(cx, cy - 11);
  ctx.lineTo(cx + 11, cy);
  ctx.lineTo(cx, cy + 11);
  ctx.lineTo(cx - 11, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMidnightWires(ctx, stage, p, v) {
  if (stage <= SKETCH) return;
  ctx.save();
  ctx.strokeStyle = COLOR_INK;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = stage === INK ? 0.4 : 0.55;
  const y = 118 + (v.panel % 4) * 5;
  const poles = [LEFT + 60 + v.shift, PLAYFIELD_W / 2 - 180 - v.shift,
    PLAYFIELD_W / 2 + 180 + v.shift, RIGHT - 60 - v.shift];
  for (const px of poles) {
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, BASE - 60);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i < poles.length - 1; i++) {
    ctx.moveTo(poles[i], y);
    ctx.quadraticCurveTo((poles[i] + poles[i + 1]) / 2, y + 22, poles[i + 1], y);
  }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  inkStyle(ctx, 0.5);
  bird(ctx, poles[1] + 34, y + 13, 0.9);
  bird(ctx, poles[2] - 46, y + 13, 0.9);
  if (v.extra > 0) bird(ctx, poles[0] + 70, y + 14, 0.8);
  ctx.restore();
}

function drawMidnight(ctx, stage, p, v) {
  drawStars(ctx, stage, p, v);
  drawMoon(ctx, stage, p, v);

  // Glowing gold halftone haze along the horizon, behind the skyline.
  if (stage >= COLOR) {
    ctx.save();
    ctx.globalAlpha = HALFTONE_OPACITY * (stage === NEON ? 1.4 : 1) * (1 + v.t * 0.6);
    ctx.fillStyle = halftone(ctx, p.gold);
    ctx.fillRect(LEFT, BASE - 130, RIGHT - LEFT, 130);
    ctx.restore();
  }

  drawSkyline(ctx, stage, p, v);
  drawMidnightWires(ctx, stage, p, v);
  drawNeonBurst(ctx, stage, p, v);

  // Gold sun-burst accents over the skyline, spreading as the panels go on.
  if (stage >= COLOR) {
    ctx.save();
    ctx.strokeStyle = stage === NEON ? p.gold : COLOR_INK;
    ctx.globalAlpha = stage === NEON ? 0.9 : 0.5;
    sunburst(ctx, LEFT + 250 + v.shift, 150 - v.extra * 8, 22, 40, 12, 3);
    if (stage === NEON) {
      ctx.shadowColor = p.gold;
      ctx.shadowBlur = 16;
    }
    sunburst(ctx, RIGHT - 320 - v.shift, 86 + (v.panel % 3) * 9, 16, 30, 10, 2.5);
    ctx.restore();
  }

  // Hero panels 4 and 8 light up a wide burst above the towers.
  accentBurst(ctx, stage, v, v.panel === 4 ? PLAYFIELD_W / 2 - 150 : PLAYFIELD_W / 2 + 130,
    v.panel === 4 ? 96 : 214, p.gold);
}

// ---------------------------------------------------------------------------
// Layer 3: ground platform
// ---------------------------------------------------------------------------

function drawGround(ctx, stage, p, paper) {
  const w = RIGHT - LEFT;
  const h = GROUND_BOTTOM - BASE;

  if (stage === SKETCH) {
    ctx.save();
    sketchStyle(ctx, 0.75);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(LEFT, BASE, w, h);
    hatch(ctx, LEFT, BASE, w, h, 18);
    ctx.restore();
    return;
  }

  const arches = 8;
  const archW = w / arches;
  ctx.save();
  // Body with arch cut-outs along the bottom edge.
  ctx.beginPath();
  ctx.moveTo(LEFT, BASE);
  ctx.lineTo(RIGHT, BASE);
  ctx.lineTo(RIGHT, GROUND_BOTTOM);
  for (let i = arches - 1; i >= 0; i--) {
    const cx = LEFT + archW * (i + 0.5);
    ctx.lineTo(cx + archW * 0.34, GROUND_BOTTOM);
    ctx.arc(cx, GROUND_BOTTOM, archW * 0.34, 0, Math.PI, true);
    ctx.lineTo(cx - archW * 0.34, GROUND_BOTTOM);
  }
  ctx.closePath();
  ctx.fillStyle = stage === INK ? COLOR_INK : p.ground;
  ctx.fill();
  if (stage >= COLOR) {
    ctx.save();
    ctx.globalAlpha = HALFTONE_OPACITY;
    ctx.fillStyle = halftone(ctx, p.accent);
    ctx.fill();
    ctx.restore();
  }
  inkStyle(ctx, 1);
  ctx.stroke();

  // Arch cut-outs read as bare paper showing through the platform.
  ctx.fillStyle = paper || COLOR_PAPER;
  ctx.beginPath();
  for (let i = 0; i < arches; i++) {
    const cx = LEFT + archW * (i + 0.5);
    ctx.moveTo(cx + archW * 0.34, GROUND_BOTTOM);
    ctx.arc(cx, GROUND_BOTTOM, archW * 0.34, 0, Math.PI, true);
    ctx.closePath();
  }
  ctx.fill();

  // Mustard / terracotta top trim.
  surface(ctx, stage, LEFT, BASE, w, 10, p.groundTop, p.accent, COLOR_PAPER);

  if (stage >= COLOR) {
    // Brick courses over the platform face.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = COLOR_INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = BASE + 20; y < GROUND_BOTTOM; y += 14) {
      ctx.moveTo(LEFT, y);
      ctx.lineTo(RIGHT, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// Draws the whole background for one world panel: sky, midground scenery and ground platform.
// `panel` (1-8) varies the props, extra detail, window lights and colour lift per panel.
export function drawWorldBackground(ctx, world, stage, currentPaper, panel) {
  const p = PALETTES[world % PALETTES.length];
  const v = vary(panel);
  ctx.save();
  // Nothing may spill outside the comic panel.
  ctx.beginPath();
  ctx.rect(LEFT, TOP, RIGHT - LEFT, PLAYFIELD_H - TOP - PANEL_MARGIN);
  ctx.clip();

  drawSky(ctx, stage, p, v);
  if (world === 0) drawPrintShop(ctx, stage, p, v);
  else if (world === 1) drawGarden(ctx, stage, p, v);
  else drawMidnight(ctx, stage, p, v);
  panelTone(ctx, stage, p, v);
  drawGround(ctx, stage, p, currentPaper);

  ctx.restore();
}
