// First-person coach interior: WASD or a thumbstick to walk, drag to look. The doors are physical —
// walk through the one ahead to go on, or turn around and walk through the one behind to turn back —
// and R rides again. Title, homecoming and game-over cards come from screens.js; ?fps and ?debug from overlay.js.
// Two third-person shots of the cat from intro.js bookend a run: boarding at the start, leaving at the end.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import {
  BACKDROP, CAMERA, COACH_BOUNDS, COACH_DIMS, DOOM, ENTRY, ENVIRONMENT, GOAL, LIGHTS, LOOK_SENSITIVITY,
  MAX_FRAME_DT, MAX_MISTAKES, MESSAGE_MS, PITCH_LIMIT, PROMPT_TEXT, SHADOW, SPAWN, SUN_POSITION, SUN_TARGET, WATER,
} from './tuning.js';
import { assetsPending, buildScene, coachTick, failedModels, missingAssets } from './coach.js';
import { propTick } from './props.js';
import { movePlayer } from './engine/movement.js';
import { REFERENCE_EXPLANATION } from './engine/game.js';
import { config, currentScene, decide, doorCrossed, getPromptInfo, startRun, state, tick } from './journey.js';
import { createAudio } from './audio.js';
import { createWalkShot } from './intro.js';
import { createEndingShot } from './ending.js';
import { createColliderView, createFpsPanel } from './overlay.js';
import { isBlocking, showDoom, showEnding, showTitle } from './screens.js';
import { createTouchControls } from './touch.js';
import { hideMessage, hidePrompt, setHud, setupUI, showMessage, showPrompt } from './ui.js';

setupUI();

const scene = new THREE.Scene();
scene.background = new THREE.Color(BACKDROP);

const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, CAMERA.near, CAMERA.far);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = ENVIRONMENT.exposure;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#ffffff', '#4a4230', LIGHTS.hemisphere));
const sun = new THREE.DirectionalLight('#fff4e0', LIGHTS.directional);
sun.position.set(...SUN_POSITION);
sun.target.position.set(...SUN_TARGET);
sun.castShadow = true;
sun.shadow.mapSize.set(SHADOW.mapSize, SHADOW.mapSize);
sun.shadow.camera.left = -SHADOW.extent;
sun.shadow.camera.right = SHADOW.extent;
sun.shadow.camera.top = SHADOW.extent;
sun.shadow.camera.bottom = -SHADOW.extent;
sun.shadow.camera.near = SHADOW.near;
sun.shadow.camera.far = SHADOW.far;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias = SHADOW.normalBias;
scene.add(sun, sun.target);

// The sea the train crosses: one flat plane below the coach, seen through the window gaps. Its low
// roughness lets the dusk environment sky reflect in it.
const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(WATER.size, WATER.size),
  new THREE.MeshStandardMaterial({
    name: 'sea', color: WATER.color, roughness: WATER.roughness, metalness: WATER.metalness,
    envMapIntensity: WATER.envMapIntensity, transparent: true, opacity: WATER.opacity,
  }),
);
sea.name = 'sea';
sea.rotation.x = -Math.PI / 2;
sea.position.set(0, WATER.depth, COACH_DIMS.length / 2);
scene.add(sea);

// The dusk sky lights the coach and the water. Loaded in the background: if it never arrives, the flat
// dusk colour above still holds the scene together.
new RGBELoader().load(ENVIRONMENT.url, (sky) => {
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = sky;
  scene.environmentIntensity = ENVIRONMENT.intensity;
}, undefined, () => console.warn(`Environment sky missing: ${ENVIRONMENT.url}`));

// --- DIAGNOSTICS ------------------------------------------------------------------------------------
// Both are inert unless the URL asks: ?fps shows the frame rate, ?debug draws the walkable region.
const fps = createFpsPanel(renderer);
createColliderView(scene, {
  min: { x: COACH_BOUNDS.minX, y: 0, z: COACH_BOUNDS.minZ },
  max: { x: COACH_BOUNDS.maxX, y: COACH_DIMS.height, z: COACH_BOUNDS.maxZ },
});

// ?debug prints what the round actually is: which coach, which anomaly, which model files are on screen,
// what the last call was and what it cost. This is the only way to tell "the anomaly is invisible" apart
// from "the anomaly is there and I missed it", which is the difference between a bug and a hard game.
// `?force=<id>` (journey.js) puts any one anomaly in the next coach, so all of them can be walked past.
const DEBUG = new URLSearchParams(location.search).has('debug');
const debugPanel = DEBUG ? document.createElement('pre') : null;
if (debugPanel) {
  Object.assign(debugPanel.style, {
    position: 'fixed', left: '8px', bottom: '8px', margin: '0', padding: '8px 10px', zIndex: '10',
    font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace', color: '#e8f0f8',
    background: 'rgba(6,10,16,0.82)', border: '1px solid rgba(160,200,240,0.25)', borderRadius: '6px',
    whiteSpace: 'pre', pointerEvents: 'none',
  });
  document.body.appendChild(debugPanel);
}

function refreshDebug() {
  const entry = state.active?.anomalyId ? config.catalog.find((x) => x.id === state.active.anomalyId) : null;
  const models = currentScene().filter((node) => node.visible && node.asset).map((node) => node.asset.replace('assets/models/', ''));
  const last = state.history[state.history.length - 1];
  const pending = missingAssets(currentScene());
  debugPanel.textContent = [
    `phase      ${state.phase}${state.active?.reference ? ' (reference)' : ''}`,
    `round      ${state.active?.id ?? '—'}`,
    `anomaly    ${state.active?.anomalyId ?? 'none — a normal coach'}`,
    `change     ${entry ? entry.explanation : '—'}`,
    `models     ${models.join(', ') || '(none yet)'}`,
    pending.length ? `WAITING    ${pending.join(', ')}` : failedModels.size ? `FAILED     ${[...failedModels].join(', ')}` : 'assets     all loaded',
    `last call  ${last ? `${last.choice} → ${last.correct ? 'correct' : 'WRONG'}` : '—'}`,
    `clears     ${state.clears}/${GOAL}   mistakes ${state.mistakes}   decisions ${state.decisions}`,
    'force any  add ?force=<id> to the URL',
  ].join('\n');
}

let coachGroup = null;
let builtRound = null;
let seenRoundId = null;
let seenPhase = null;
let hudCache = '';
let endingShown = false;
// The failed ride. `doomAt` is stamped the moment the four yokai are actually standing on screen, not
// when the phase changes, so the five seconds are five seconds of the tableau and not five seconds of a
// coach that is still loading. `doomShown` is the one-way latch on the black screen.
let doomAt = null;
let doomShown = false;
// The round the player has already answered, and whether the coach on screen is still waiting on its
// models. Both are about ONE thing: a decision is only ever taken against a coach that is fully built
// and not yet judged. Without them the walk can commit a coach the player cannot see, or commit the same
// coach twice while the feedback beat plays.
let judgedRound = null;
let builtWaiting = false;

const player = { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw };
let pitch = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;

const held = new Set();
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const axis = (positive, negative) => (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);

// Touch controls build themselves only when the device has a coarse pointer; elsewhere this is inert.
const touch = createTouchControls({ onDecide: () => onDecide() });

// The whole soundtrack is synthesized in audio.js. Browsers refuse to make a sound before the player has
// touched the page, so the audio only builds on the first keypress, tap or click — which is the same
// gesture that dismisses the title card. Until then createAudio() holds nothing but numbers.
const audio = createAudio();
let audioStarted = false;
function startAudio() {
  if (audioStarted) return; // the gesture listeners below fire on every press, so this only runs once
  audioStarted = true;
  audio.start();
  removeEventListener('keydown', startAudio);
  removeEventListener('pointerdown', startAudio);
}
addEventListener('keydown', startAudio);
addEventListener('pointerdown', startAudio);

// The four chapters follow progress, not coach order: a chapter every two clears, the last one at home.
const chapterFor = (clears) => Math.min(3, Math.floor(clears / 2));

// Only one shot runs at a time. While it is up it owns the camera and the walk, and it hands the player
// back at the pose the cat stopped on, so the cut to first person is not a jump.
let shot = null;
let shotStartedAt = 0;

// A shot cannot be skipped in its first moments. The key that dismisses a card repeats while it is held,
// and without this, holding Space to start the game would kill the boarding shot it just started.
const SKIP_GRACE_MS = 400;
const canSkipShot = () => shot !== null && performance.now() - shotStartedAt > SKIP_GRACE_MS;

function endShot() {
  if (!shot) return;
  const finished = shot;
  shot = null;
  finished.dispose();
}

function playWalkShot(kind, onDone) {
  endShot();
  shotStartedAt = performance.now();
  shot = createWalkShot({
    scene,
    camera,
    kind,
    onDone: (pose) => {
      endShot();
      // Leaving ends at the front door, which leaves the player facing the front of the coach — the yaw
      // the camera already has — so that pose is taken as it comes.
      // Boarding is the exception. The cat walks the coach and stops in the middle of it, but a coach is
      // only ever inspected from a doorway (that is where walking through a door leaves you), and the
      // player has to have seen the whole coach before they are asked to remember it. So while a
      // reference coach is the one on screen the boarding pose is dropped and the player comes up where
      // the build block already stood them, at the rear door, looking down the full length of it. The
      // cat has faded out by this frame, so this lands as a cut, not as a lurch.
      if (!(state.active?.reference && state.active.id === builtRound)) Object.assign(player, pose);
      pitch = 0;
      if (onDone) onDone();
    },
  });
}

// The leaving walk hands over to the winning shot: the coach world is hidden, the field appears, and the
// cat crosses the grass. `onDone` runs when the ending is over — and it always runs, so a throw while
// building or playing the ending can never strand the player short of the card. The coach group is put
// back either way, because the homecoming card sits over it and a restart rebuilds the same group.
function playEndingShot(onDone) {
  const coachWasVisible = coachGroup ? coachGroup.visible : true;
  const restoreCoach = () => { if (coachGroup) coachGroup.visible = coachWasVisible; };
  let endingShot = null;
  try {
    endingShot = createEndingShot({
      scene,
      camera,
      onDone: () => {
        endShot();
        restoreCoach();
        if (onDone) onDone();
      },
    });
  } catch (error) {
    console.error('Ending shot failed to build, showing the card instead:', error);
  }
  if (!endingShot) {
    restoreCoach();
    if (onDone) onDone();
    return;
  }
  if (coachGroup) coachGroup.visible = false;
  endShot();
  shotStartedAt = performance.now();
  shot = endingShot;
}

function restart() {
  seenRoundId = null;
  seenPhase = null;
  endingShown = false;
  doomAt = null;
  doomShown = false;
  pendingEntry = null;
  // A new ride starts at the reference coach, and the reference coach is never a decision — so the round
  // the last ride ended on must be forgotten, or a fresh ride whose first round id happens to match it
  // would refuse the player's first move.
  judgedRound = null;
  builtRound = null;
  hideMessage();
  startRun();
}

// A fresh ride: the run from zero, then the cat walking aboard before the player takes the camera.
function startGame() {
  restart();
  playWalkShot('in');
}

// What the last decision should say. The rule the player is being tested on is restated every time, so
// the two outcomes can never be confused: an unchanged coach is walked on through, a changed one is
// turned back from. A wrong call says plainly what it cost.
function feedbackText() {
  const outcome = state.outcome;
  if (!outcome) return '';
  if (outcome.reference) return REFERENCE_EXPLANATION;
  if (!outcome.correct) {
    // The cost is stated twice: what it did to the progress, and how many are left before the train keeps
    // you. The second half is the whole reason the 10-turn limit is never a surprise.
    const left = Math.max(0, MAX_MISTAKES - state.mistakes);
    const tail = left === 0 ? 'That was your last wrong turn.' : `${left} wrong turn${left === 1 ? '' : 's'} left.`;
    return `Wrong call — this coach had changed. Back to the reference coach. Progress reset to 0 of ${GOAL}. ${tail}`;
  }
  if (outcome.clearGain) return `Correct — that was a change. ${outcome.explanation} Coaches cleared: ${state.clears}/${GOAL}.`;
  return `Correct — nothing had changed, walk on through. Coaches cleared: ${state.clears}/${GOAL}.`;
}

let pendingEntry = null;

// Both the walk and the on-screen button land here. `choice` is what the player just committed to, and
// it also says which door they went through, so they can be placed at the right end of the next coach.
function commitChoice(choice) {
  if (isBlocking() || shot) return;
  if (state.phase !== 'inspect' && state.phase !== 'ending') return;
  if (state.phase === 'inspect') {
    // One coach, one judgment — whichever door was used, and however long the player stands in the
    // doorway. The walk is tested every frame, so this is what stops a round being answered twice.
    if (judgedRound === state.active.id) return;
    // And a coach whose models have not arrived is not the coach on screen. Nothing is judged until it
    // is: an unfair question is worse than a pause.
    if (builtWaiting || state.active.id !== builtRound) return;
  }
  const before = state;
  decide(choice);
  if (state === before) return;
  if (state.phase === 'feedback') judgedRound = before.active.id;
  pendingEntry = choice;
  if (state.phase === 'feedback' && state.outcome) {
    // A wrong call keeps its message up until the reference coach's line replaces it.
    showMessage(feedbackText(), state.outcome.correct ? MESSAGE_MS : 0);
    // The sound says the same thing as the words, so a call can be felt without being read.
    if (state.outcome.correct) {
      audio.cue('clear');
      if (state.outcome.clearGain) audio.setChapter(chapterFor(state.clears));
    } else {
      // A wrong call drops the ride back to chapter 0 with the progress, which is the reset you hear.
      audio.cue('wrong');
      audio.setChapter(chapterFor(state.clears));
    }
  }
}

// The on-screen button (touch only) walks you through the nearest door, so a phone is not forced to
// aim a thumbstick at a doorway.
function onDecide() {
  const near = getPromptInfo(player);
  if (near.front) commitChoice('continue');
  else if (near.rear) commitChoice('turn_back');
}

function refreshPrompts() {
  // No prompt while a coach is still arriving: it would invite a decision the game is not going to take.
  if (isBlocking() || shot || builtWaiting) { hidePrompt(); touch.setDecideVisible(false); return; }
  const near = getPromptInfo(player);
  // The E button follows the door prompt, so it is only there when a decision would actually land.
  touch.setDecideVisible((state.phase === 'inspect' || state.phase === 'ending') && (near.front || near.rear));
  if (state.phase === 'ending' && (near.front || near.rear)) showPrompt(PROMPT_TEXT.ending);
  else if (state.phase === 'inspect' && near.front) showPrompt(PROMPT_TEXT.front);
  else if (state.phase === 'inspect' && near.rear) showPrompt(PROMPT_TEXT.rear);
  else hidePrompt();
}

// Speaks up on a new coach and on a new phase; silent otherwise.
function refreshText() {
  if (state.active.id !== seenRoundId) {
    seenRoundId = state.active.id;
    if (state.active.reference) showMessage(REFERENCE_EXPLANATION, 0);
  }
  if (state.phase === seenPhase) return;
  seenPhase = state.phase;
  if (state.phase === 'station') {
    audio.cue('station');
    showMessage(`Station — ${state.clears} of ${GOAL} coaches cleared. The train moves on.`, MESSAGE_MS);
  } else if (state.phase === 'ending') {
    audio.cue('home');
    showMessage(`Home — all ${GOAL} coaches cleared. Walk through the door to get off.`, 0);
  } else if (state.phase === 'gameover') {
    // Ten wrong turns. Nothing is asked of the player now and no text stands over the tableau: they stand
    // still and look at the four of them until the lights go out.
    hideMessage();
    hidePrompt();
  }
  else if (state.phase === 'complete' && !endingShown) {
    // The cat walks off the train first, and the homecoming card comes up over the empty coach after.
    // The numbers come off the session state and are read when the card is built, not now.
    endingShown = true;
    hideMessage();
    hidePrompt();
    // The cat leaves the train, then arrives somewhere green, and only then does the card come up over
    // the coach. The arguments are the same ones the card has always been given.
    playWalkShot('out', () => playEndingShot(() => showEnding({
      clears: state.clears, goal: GOAL, decisions: state.decisions, mistakes: state.mistakes, onRestart: startGame,
    })));
  }
}

// The HUD carries the two numbers the player has to be able to see at any moment: how far they have got,
// and how many wrong turns they have left before the train keeps them. The limit is up from the first
// coach, so the failure ending is a thing they watched coming rather than a thing that happened to them.
function refreshHud() {
  const text = state.phase === 'gameover'
    ? `game over  ·  ${state.clears}/${GOAL} coaches cleared`
    : `${state.clears}/${GOAL} coaches cleared${state.active.reference ? '  ·  reference coach' : ''}  ·  ${Math.max(0, MAX_MISTAKES - state.mistakes)} wrong turns left`;
  if (text === hudCache) return;
  hudCache = text;
  setHud(text);
}

addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  // A shot owns the keyboard: any of these skips it, the way a cutscene is skipped.
  if (canSkipShot() && (key === ' ' || key === 'enter' || key === 'escape')) { shot.skip(); return; }
  held.add(key);
  if (key === 'r' && state.phase === 'complete' && !isBlocking() && !shot) startGame();
});
addEventListener('keyup', (event) => held.delete(event.key.toLowerCase()));
addEventListener('blur', () => held.clear());

// Drag to look: drag right looks right, drag down looks down. No pointer lock needed at M1.
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (isBlocking()) return; // a card on screen owns the pointer until it is dismissed
  if (canSkipShot()) { shot.skip(); return; } // a tap skips a shot, rather than starting a look-drag
  if (shot) return; // still in the opening moments of the shot: it owns the pointer, so start no drag
  if (state.phase === 'complete') {
    startGame();
    return;
  }
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  player.yaw -= (event.clientX - lastX) * LOOK_SENSITIVITY;
  pitch = clamp(pitch - (event.clientY - lastY) * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
  lastX = event.clientX;
  lastY = event.clientY;
});
const stopDrag = () => { dragging = false; };
renderer.domElement.addEventListener('pointerup', stopDrag);
renderer.domElement.addEventListener('pointercancel', stopDrag);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

startRun();
// The title card sits over the reference coach, so the first thing the player sees is already the game.
// Dismissing it rolls the boarding shot before the player takes the camera.
showTitle({ onStart: startGame });

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta();
  const dt = Math.min(raw, MAX_FRAME_DT);
  fps.update(raw); // the real frame time, not the clamped step, or a slow frame would read as 20 fps

  tick(dt);

  // A new round: swap the coach (the same round always derives the same nodes), then stand the player
  // where they walked in — just inside the door they came through, facing the way they were already
  // going. A wrong call sends them back to the middle of the reference coach: the start-over moment.
  // A coach is only put up once every model it needs has arrived, and is rebuilt the moment the last one
  // does. Until then the coach that is up is not the one the player is being asked about, so the walk is
  // frozen and no decision lands — the alternative is judging a player against a coach they cannot see.
  if (state.active.id !== builtRound || builtWaiting) {
    const nodes = currentScene();
    const missing = missingAssets(nodes);
    // Only wait for a download that is still running. A file that has already failed is not coming, and
    // waiting on it forever would hang the game on a coach that never arrives.
    builtWaiting = missing.length > 0 && assetsPending();
    if (!builtWaiting) {
      // The key carries the ride's seed as well as the round, so a coach built on an earlier ride can
      // never be handed back for a round that merely shares its number.
      const next = buildScene(nodes, `${state.seed}:${state.active.id}`);
      // buildScene keeps the last group and hands it back when the key matches. So the old coach is only
      // thrown away when this really is a different group: emptying a group and then being handed that
      // same group back is how the coach vanishes and leaves the cat walking through nothing.
      if (next !== coachGroup) {
        if (coachGroup) {
          scene.remove(coachGroup);
          coachGroup.clear();
        }
        coachGroup = next;
        scene.add(coachGroup);
      }
      builtRound = state.active.id;
      // The failed ride stands you at the rear door, facing down the coach at the four of them. Everywhere
      // else you are placed where you walked in — just inside the door you came through, facing the way you
      // were already going.
      const pose = state.phase === 'gameover'
        ? DOOM.player
        : state.active.reference ? SPAWN : (ENTRY[pendingEntry] ?? SPAWN);
      Object.assign(player, pose);
      // The failed ride looks slightly down at them, or the nearest one falls below the camera's frame.
      pitch = state.phase === 'gameover' ? DOOM.pitch : 0;
      // The five seconds start here, on the frame the yokai are actually standing on screen.
      if (state.phase === 'gameover') doomAt = performance.now();
    }
  }
  coachTick(dt);
  propTick(dt, coachGroup);

  // A shot owns the camera and the walk while it runs. It returns false on the frame it hands the player
  // back, and by then it has already stood the player at the pose the cat stopped on — so that frame
  // falls straight through to first person and there is no gap between the two.
  if (shot) {
    const running = shot.update(dt);
    audio.update(dt);
    if (running) {
      refreshHud();
      renderer.render(scene, camera);
      return;
    }
    // A shot that ended this frame may already have started the next one: the leaving walk hands straight
    // over to the ending shot. That one owns the camera now, so don't fall through to first person.
    if (shot) {
      refreshHud();
      renderer.render(scene, camera);
      return;
    }
  }

  // Keyboard and thumbstick drive the same two axes. A card on screen freezes both, and so does a
  // transition: during the feedback beat and at a station the player is travelling, not walking, so they
  // cannot drift through the next coach's door and answer a coach they never looked at.
  const stick = touch.move();
  const walking = !isBlocking() && !builtWaiting && (state.phase === 'inspect' || state.phase === 'ending');
  const move = walking ? {
    forward: axis('w', 's') || stick.forward,
    strafe: axis('d', 'a') || stick.strafe,
  } : { forward: 0, strafe: 0 };
  Object.assign(player, movePlayer(player, move, dt, COACH_BOUNDS));
  camera.position.set(player.x, CAMERA.height, player.z);
  camera.rotation.set(pitch, player.yaw, 0, 'YXZ');

  // Stepping into a doorway is the decision itself, so it is tested after the walk has moved the player.
  if (walking) {
    const crossed = doorCrossed(player);
    if (crossed) commitChoice(crossed);
  }

  audio.update(dt);
  refreshPrompts();
  refreshText();
  refreshHud();
  if (debugPanel) refreshDebug();

  // The failed ride ends itself: the yokai hold the aisle for DOOM.holdMs, and then the coach goes dark
  // and tells the player what it has decided. The card is the last thing that happens — nothing after it
  // moves the player, and R (or a tap) starts a fresh ride from the title card's own rules.
  if (state.phase === 'gameover' && doomAt !== null && !doomShown && performance.now() - doomAt >= DOOM.holdMs) {
    doomShown = true;
    hideMessage();
    hidePrompt();
    showDoom({ mistakes: state.mistakes, onRestart: startGame });
  }

  renderer.render(scene, camera);
});
