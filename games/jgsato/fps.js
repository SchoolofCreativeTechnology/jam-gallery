// Optional on-screen FPS panel for ?fps debugging.

const HISTORY = 60;

let panel = null;
let frameTimes = [];
let enabled = false;

export function initFPS() {
  enabled = new URLSearchParams(location.search).has('fps');
  if (!enabled) return;

  panel = document.createElement('div');
  panel.id = 'fps';
  panel.style.position = 'fixed';
  panel.style.top = '8px';
  panel.style.left = '8px';
  panel.style.padding = '6px 10px';
  panel.style.borderRadius = '4px';
  panel.style.background = 'rgba(0, 0, 0, 0.7)';
  panel.style.color = '#fff';
  panel.style.font = '12px monospace';
  panel.style.lineHeight = '1.4';
  panel.style.pointerEvents = 'none';
  panel.style.zIndex = '9999';
  panel.textContent = 'FPS: --';
  document.body.appendChild(panel);
}

export function updateFPS(dt, renderer) {
  if (!enabled) return;

  frameTimes.push(dt > 0 ? 1 / dt : 0);
  if (frameTimes.length > HISTORY) {
    frameTimes.shift();
  }

  const current = frameTimes.length ? frameTimes[frameTimes.length - 1] : 0;
  const avg = frameTimes.length
    ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
    : 0;
  const min = frameTimes.length ? Math.min(...frameTimes) : 0;

  panel.textContent =
    `FPS: ${Math.round(current)} / avg ${Math.round(avg)} / min ${Math.round(min)}\n` +
    `calls: ${renderer.info.render.calls}  tris: ${renderer.info.render.triangles}`;
}
