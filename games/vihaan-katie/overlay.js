// Optional on-screen diagnostics behind URL flags: ?fps shows a performance panel, ?debug draws the
// walkable region as a wireframe box. Both build nothing at all unless their flag is in the URL.
import * as THREE from 'three';

// --- FLAGS ---------------------------------------------------------------------------------------
// True when the query string carries the flag, e.g. hasFlag('fps', location.search). The search string
// is a parameter (not read here) so the check stays testable outside a browser.
export function hasFlag(name, search) {
  return new URLSearchParams(search || '').has(name);
}

// --- FPS PANEL -----------------------------------------------------------------------------------
// Kept local rather than in tuning.js: this brief owns overlay.js alone and must not edit tuning.js.
const WINDOW_MS = 3000;   // average and minimum are measured over this rolling window
const CURRENT_MS = 500;   // "current" FPS averages the last half second, so it is not one jittery frame
const REFRESH_MS = 250;   // repaint four times a second: readable, and the panel itself costs no frames
const PANEL_STYLE = 'position:fixed;top:12px;right:12px;z-index:10;pointer-events:none;'
  + 'padding:7px 10px;background:rgba(15,20,32,0.72);color:#cdbba0;'
  + 'border:1px solid rgba(205,187,160,0.22);border-radius:4px;text-align:right;white-space:pre;'
  + 'font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.3px;';

const NO_FPS_PANEL = { update() {}, dispose() {} };

function buildPanel() {
  const el = document.createElement('div');
  el.style.cssText = PANEL_STYLE;
  el.textContent = 'FPS ...';
  document.body.appendChild(el);
  return el;
}

// Current, average and minimum FPS, plus what the renderer drew this frame. Missing fields become '?'.
function fpsStats(samples, elapsed) {
  if (!samples.length) return { current: 0, average: 0, minimum: 0 };
  const span = Math.max(elapsed - samples[0].t, 1 / 1000);
  let worst = 0;
  let recent = 0;
  for (const sample of samples) {
    worst = Math.max(worst, sample.dt);
    if (elapsed - sample.t <= CURRENT_MS / 1000) recent += 1;
  }
  return {
    current: recent / Math.min(CURRENT_MS / 1000, span),
    average: samples.length / span,
    minimum: worst > 0 ? 1 / worst : 0,
  };
}

function readout(renderer, stats) {
  const info = renderer && renderer.info && renderer.info.render ? renderer.info.render : {};
  const calls = Number.isFinite(info.calls) ? info.calls : '?';
  const triangles = Number.isFinite(info.triangles) ? info.triangles : '?';
  const ratio = renderer && typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio().toFixed(2) : '?';
  return `FPS ${Math.round(stats.current)}  avg ${Math.round(stats.average)}  min ${Math.round(stats.minimum)}\n`
    + `draws ${calls}  tris ${triangles}\n`
    + `pixel ratio ${ratio}`;
}

export function createFpsPanel(renderer) {
  if (!hasFlag('fps', location.search)) return NO_FPS_PANEL;

  const panel = buildPanel();
  const samples = [];
  let elapsed = 0;
  let sincePaint = 0;

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    elapsed += dt;
    samples.push({ t: elapsed, dt });
    while (samples.length && elapsed - samples[0].t > WINDOW_MS / 1000) samples.shift();

    sincePaint += dt;
    if (sincePaint < REFRESH_MS / 1000) return;
    sincePaint = 0;
    panel.textContent = readout(renderer, fpsStats(samples, elapsed));
  }

  return {
    update,
    dispose() {
      panel.remove();
    },
  };
}

// --- COLLIDER VIEW -------------------------------------------------------------------------------
const COLLIDER_COLOR = '#cdbba0'; // the HUD cream, so the wireframe reads as one of the game's own lines

const NO_COLLIDER_VIEW = { dispose() {} };

// Accepts a THREE.Box3 or any { min, max } of vector-likes; build a fresh Box3 so a plain object works.
function toBox3(box) {
  const min = box && box.min ? box.min : { x: 0, y: 0, z: 0 };
  const max = box && box.max ? box.max : { x: 0, y: 0, z: 0 };
  return new THREE.Box3(
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  );
}

export function createColliderView(scene, box) {
  if (!hasFlag('debug', location.search)) return NO_COLLIDER_VIEW;

  const helper = new THREE.Box3Helper(toBox3(box), COLLIDER_COLOR);
  helper.name = 'collider-view';
  scene.add(helper);

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(helper);
      helper.geometry.dispose();
      helper.material.dispose();
    },
  };
}
