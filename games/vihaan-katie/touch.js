// On-screen thumbstick and E button, built only on coarse pointers (phones); styles injected, no imports.

// Sizes in pixels. They sit here rather than in tuning.js because this file takes no imports at all.
const STICK_SIZE = 128;
const KNOB_SIZE = 54;
const TRAVEL = (STICK_SIZE - KNOB_SIZE) / 2; // how far the knob's centre may leave the middle
const DEAD_ZONE = 0.22;                      // share of TRAVEL ignored, so a resting thumb stands still

// No background on the overlay itself: only the stick and the button take pointer events, so a drag
// anywhere else reaches the canvas and the look handler in main.js keeps working. touch-action: none
// stops the browser reading a drag as a scroll or a pinch.
const STYLE = `
#touch-controls {
  position: fixed; inset: 0; z-index: 10; pointer-events: none;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
}
#touch-controls, #touch-controls * { touch-action: none; }
canvas { touch-action: none; }
#touch-stick {
  position: absolute;
  left: calc(24px + env(safe-area-inset-left, 0px));
  bottom: calc(26px + env(safe-area-inset-bottom, 0px));
  width: ${STICK_SIZE}px; height: ${STICK_SIZE}px;
  border-radius: 50%; pointer-events: auto;
  background: radial-gradient(circle, rgba(43, 29, 18, 0.34) 0%, rgba(20, 13, 7, 0.5) 100%);
  border: 1px solid rgba(214, 198, 154, 0.22);
  box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.45);
  transition: border-color 120ms ease-out;
}
#touch-stick.active { border-color: rgba(214, 198, 154, 0.5); }
#touch-knob {
  position: absolute; left: ${TRAVEL}px; top: ${TRAVEL}px;
  width: ${KNOB_SIZE}px; height: ${KNOB_SIZE}px; border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, rgba(214, 198, 154, 0.5), rgba(214, 198, 154, 0.24));
  border: 1px solid rgba(214, 198, 154, 0.42);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
}
#touch-knob.spring { transition: transform 140ms cubic-bezier(0.22, 0.9, 0.32, 1); }
#touch-decide {
  position: absolute;
  right: calc(28px + env(safe-area-inset-right, 0px));
  bottom: calc(34px + env(safe-area-inset-bottom, 0px));
  width: 78px; height: 78px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  padding: 0; margin: 0;
  color: #d6c69a; font: 600 26px/1 'Courier New', Courier, monospace;
  pointer-events: auto;
  background: radial-gradient(circle at 50% 34%, rgba(72, 50, 31, 0.72), rgba(24, 16, 10, 0.66));
  border: 1px solid rgba(214, 198, 154, 0.4);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), inset 0 0 14px rgba(0, 0, 0, 0.4);
  transition: transform 80ms ease-out, border-color 80ms ease-out;
}
#touch-decide[hidden] { display: none; }
#touch-decide.pressed { transform: scale(0.93); border-color: rgba(214, 198, 154, 0.75); }
`;

let styleEl = null;

// True on a phone or tablet, where the game has no keyboard to read.
export function isCoarsePointer() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

function injectStyle() {
  if (styleEl && styleEl.isConnected) return;
  styleEl = document.createElement('style');
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);
}

function noopControls() {
  const still = { forward: 0, strafe: 0 };
  return {
    enabled: false,
    move: () => still,
    setDecideVisible() {},
    dispose() {},
    disposed() {},
  };
}

// Builds a thumbstick and a decision button on a coarse-pointer device, and returns the handle the main
// loop reads. move() hands back the same live { forward, strafe } object every call, each axis -1, 0 or 1
// exactly like the held-key axes; onMove(move) is the optional push form, called only when the axes change.
// onLook is accepted but never called: look drags pass straight through to the canvas handler in main.js,
// so a second look callback here would turn the camera twice as fast.
export function createTouchControls({ onMove, onLook, onDecide } = {}) {
  if (!isCoarsePointer()) return noopControls();

  injectStyle();

  const root = document.createElement('div');
  root.id = 'touch-controls';
  const stick = document.createElement('div');
  stick.id = 'touch-stick';
  const knob = document.createElement('div');
  knob.id = 'touch-knob';
  stick.appendChild(knob);

  const decide = document.createElement('button');
  decide.id = 'touch-decide';
  decide.type = 'button';
  decide.textContent = 'E';
  decide.hidden = true;

  root.append(stick, decide);
  document.body.appendChild(root);

  const move = { forward: 0, strafe: 0 };
  let stickPointer = null;
  let disposed = false;

  function setMove(forward, strafe) {
    if (forward === move.forward && strafe === move.strafe) return;
    move.forward = forward;
    move.strafe = strafe;
    if (onMove) onMove(move);
  }

  // Places the knob under the finger, clamped to TRAVEL, and turns the offset into the two axes.
  function placeKnob(clientX, clientY) {
    const rect = stick.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    const reach = Math.min(dist, TRAVEL);
    knob.style.transform = `translate(${(dx / dist) * reach}px, ${(dy / dist) * reach}px)`;
    const dead = DEAD_ZONE * TRAVEL;
    setMove(
      Math.abs(dy) > dead ? (dy < 0 ? 1 : -1) : 0, // up the screen is forward
      Math.abs(dx) > dead ? (dx > 0 ? 1 : -1) : 0,
    );
  }

  function releaseStick() {
    stickPointer = null;
    knob.classList.add('spring'); // the class is dropped again on the next press, so dragging stays instant
    stick.classList.remove('active');
    knob.style.transform = 'translate(0px, 0px)';
    setMove(0, 0);
  }

  stick.addEventListener('pointerdown', (event) => {
    if (stickPointer !== null) return; // one finger owns the stick; a second is free to look around
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId); // a finger that slides off the stick keeps steering it
    knob.classList.remove('spring');
    stick.classList.add('active');
    event.preventDefault();
    placeKnob(event.clientX, event.clientY);
  });

  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== stickPointer) return;
    event.preventDefault();
    placeKnob(event.clientX, event.clientY);
  });

  stick.addEventListener('pointerup', (event) => {
    if (event.pointerId === stickPointer) releaseStick();
  });
  stick.addEventListener('pointercancel', (event) => {
    if (event.pointerId === stickPointer) releaseStick();
  });
  // The browser can take the pointer back at any time; the stick must not stay stuck on.
  stick.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === stickPointer) releaseStick();
  });

  decide.addEventListener('pointerdown', (event) => {
    decide.setPointerCapture(event.pointerId);
    decide.classList.add('pressed');
    event.preventDefault();
    if (onDecide) onDecide();
  });
  const unpress = () => decide.classList.remove('pressed');
  decide.addEventListener('pointerup', unpress);
  decide.addEventListener('pointercancel', unpress);
  decide.addEventListener('lostpointercapture', unpress);

  function setDecideVisible(visible) {
    if (!visible) unpress();
    decide.hidden = !visible;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stickPointer = null;
    setMove(0, 0);
    root.remove();
    if (styleEl && styleEl.isConnected) styleEl.remove();
  }

  return {
    enabled: true,
    move: () => move,
    setDecideVisible,
    dispose,
    disposed: dispose, // same teardown under the other name
  };
}
