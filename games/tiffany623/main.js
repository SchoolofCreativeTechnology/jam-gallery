import * as THREE from 'three';
import * as T from './tuning.js';
import { Player } from './player.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { play } from './audio.js';
import { WhiskerCat } from './cat-controller.js';
import { createFpsPanel, updateFpsPanel, DebugOverlay } from './debug.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#87b5e0');
scene.fog = new THREE.Fog('#87b5e0', 15, 55);

const camera = new THREE.PerspectiveCamera(
  60,
  innerWidth / innerHeight,
  0.1,
  100
);
camera.position.set(0, T.cameraYOffset, T.cameraZ);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#ffffff', '#445566', 1.5));
const sun = new THREE.DirectionalLight('#ffffff', 2);
sun.position.set(5, 10, 5);
scene.add(sun);

const world = new World(scene);
let player = null;
let gameState = 'TITLE';
let score = 0;
let vaseBonus = 0;
let maxHeight = 0;

const params = new URLSearchParams(location.search);
const showFps = params.has('fps');
const showDebug = params.has('debug');
const fpsPanel = showFps ? createFpsPanel() : null;
const fpsHistory = [];
let debugOverlay = null;

async function loadCat() {
  try {
    const cat = await WhiskerCat.load('./assets/cat.glb');
    return cat;
  } catch (e) {
    console.warn('Custom GLB cat failed to load, using sprite fallback', e);
    return null;
  }
}

function startGame() {
  if (!player) return;
  world.reset();
  player.reset(0, world.startRoof.top + player.halfH);
  player.world = world;
  score = 0;
  vaseBonus = 0;
  maxHeight = 0;
  gameState = 'PLAY';
  UI.showGame();
}

function restart() {
  startGame();
}

function updateScoreAndVases() {
  const currentHeight = Math.max(0, player.position.y);
  if (currentHeight > maxHeight) {
    maxHeight = currentHeight;
  }

  const vaseIndex = world.testVaseCollision(player.position, T.playerWidth / 2, T.playerHeight / 2);
  if (vaseIndex >= 0) {
    const points = world.removeVase(vaseIndex);
    vaseBonus += points;
    play('break');
  }

  UI.setHeight(currentHeight, maxHeight, vaseBonus);
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  if (e.code === 'Space') {
    if (gameState === 'TITLE' || gameState === 'GAMEOVER') {
      startGame();
    } else if (gameState === 'PLAY') {
      player.startAim();
    }
  }

  if (e.key.toLowerCase() === 'r' && gameState !== 'TITLE') {
    restart();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && gameState === 'PLAY') {
    player.releaseAim();
    play('jump');
  }
});

// Touch controls: tap to start, hold to aim, release to jump.
window.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === 'TITLE' || gameState === 'GAMEOVER') {
    startGame();
  } else if (gameState === 'PLAY' && player) {
    player.startAim();
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (gameState === 'PLAY' && player) {
    player.releaseAim();
    play('jump');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);

  if (gameState === 'PLAY' && player) {
    player.update(dt, world);
    world.update(player.position, dt);

    if (player.state === 'dead') {
      gameState = 'GAMEOVER';
      play('splash');
      UI.showGameOver(player.position.y, maxHeight, vaseBonus);
    } else {
      if (world.getFloodY() >= player.position.y - player.halfH) {
        player.state = 'dead';
        gameState = 'GAMEOVER';
        play('splash');
        UI.showGameOver(player.position.y, maxHeight, vaseBonus);
      } else {
        updateScoreAndVases();
      }
    }
  }

  const target = world.getCameraTarget();
  const k = 1 - Math.exp(-T.cameraFollowSpeed * dt);
  camera.position.x += (target.x - camera.position.x) * k;
  camera.position.y += (target.y - camera.position.y) * k;
  camera.position.z = T.cameraZ;
  camera.lookAt(player ? player.position.x : 0, (player ? player.position.y : 0) + T.lookAtYOffset, 0);

  if (showFps) {
    updateFpsPanel(fpsPanel, renderer, rawDt, fpsHistory);
  }

  if (showDebug && debugOverlay && player) {
    debugOverlay.update(player, world);
  }

  renderer.render(scene, camera);
});

// Load the custom cat, then create the player and show the title screen.
loadCat().then((whiskerCat) => {
  player = new Player(scene, whiskerCat);
  if (showDebug) debugOverlay = new DebugOverlay(scene);
  UI.hideLoading();
  UI.showTitle();
}).catch((e) => {
  console.error(e);
  player = new Player(scene, null);
  if (showDebug) debugOverlay = new DebugOverlay(scene);
  UI.hideLoading();
  UI.showTitle();
});
