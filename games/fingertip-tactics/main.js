// 主循环：建场景和相机，把 game / board / ui / ai / gesture 接成一个回合状态机。
import * as THREE from 'three';
import { createGame } from './game.js';
import { createBoard } from './board.js';
import { createUI } from './ui.js';
import { createAi } from './ai.js';
import { createGestureInput } from './gesture.js';
import { revealDelay, advanceDuration, stepsToWin, laneLength, showButtonFallback } from './tuning.js';

// 场景：打烊后的酒馆里，桌上的棋盘就是全部舞台。
const scene = new THREE.Scene();
scene.background = new THREE.Color('#14100e');

// 横屏：固定相机站在棋盘的 +X 一侧俯视棋盘中心 (0, 0, 0)，棋盘长轴 Z 就横铺在画面里 ——
// 玩家橙色营地 z=+11 在画面左边、电脑蓝色营地 z=-11 在画面右边（lookAt 之后相机的右轴正好是 -Z）。
// 俯角 58°（竖屏那版是 43°）：横过来以后两枚小兵那 1.2 的横向间距（x=±0.6）落在画面竖直方向上，
// 43° 时两枚棋子会上下叠在一起看不清，58° 才拉得开。fov 22° 不变（长焦）：整块板都在画面里，两端的小兵一样大。
// 竖直方向本来就是一条横带，上下留白交给 fitCamera() 算出来的距离兜着。
// 横屏：棋盘长轴水平铺开，两端营地各留 0.86 的余量。
// 取景用真 three.js（同一个 0.186.1，PerspectiveCamera.project）复算过，16:9 / 1.54 / 4:3 三种宽高比：
// 棋盘角 |ndc.x| ≤ 0.872（|ndc.y| ≤ 0.257）、营地四角 |ndc.x| ≤ 0.831，两端都是 0.860（留 0.14 的边）；
// 两枚小兵起点在 |ndc.y| = 0.061 / 0.067，彼此相隔 0.128（16:9 720p 下 45.9px，约 2.4 个棋子高，不叠在一起）。
// 720px 高的窗口里棋盘横带占 y 276..452（176px 高），上边空 276px、下边空 268px，
// 顶上三行（状态/锁定/揭晓，到 y ≈ 98px）和底下三个按钮（从 y ≈ 630px 起）都不压到棋盘。
// 距离只由宽高比定：16:9 → 41.05、1.54 → 47.47、4:3 → 54.74（再窄就封顶在 54.74）。
const CAMERA_FOV = 22; // 长焦：视锥窄，远近大小差别小
const CAMERA_PITCH_DEG = 58; // 俯角：相机看向棋盘中心的视线和水平面的夹角
const FIT_HALF_Z = 12.2; // 取景按这个棋盘半长留余量（板到 ±12，两端各多留 0.2）
const FIT_NDC_X = 0.86; // 棋盘两端落在 |ndc.x| = 0.86，左右各留 0.14 的空
const FIT_MIN_ASPECT = 4 / 3; // 窗口窄过 4:3 就不再后退（距离封顶）：宁可切掉两端，也不把镜头甩到很远

// 灯光：打烊后的酒馆 —— 桌子正上方只有一盏暖金吊灯，光聚在棋盘中央的地图和两枚小兵上；
// 桌心最亮、往桌沿自然衰减，四周沉进暗红和近黑。环境光只留一丝，只够暗处不死黑。
// 圆桌半径 13.2、棋盘长轴 Z（z ∈ ±12）、两端营地 z = ∓11，下面的高度和角度都按这几个数配。
const SPOT_COLOR = '#ffc46b'; // 吊灯颜色：暖金 / 琥珀（别往冷白走）
const SPOT_INTENSITY = 1300; // 吊灯强度：decay = 2 时亮度 ≈ 强度 / 距离²，18 的高度下桌心约 4
const SPOT_HEIGHT = 18; // 吊灯挂在桌心正上方多高：桌面上光斑半径 ≈ 高度 × tan(半角)
const SPOT_ANGLE_DEG = 45; // 光锥半角：桌面上罩到半径 18（比圆桌 13.2 大一圈），两端营地也吃到 1/3 的光
const SPOT_PENUMBRA = 0.9; // 0..1，越大边缘越柔：小了就出一圈硬边光斑
const SPOT_DECAY = 2; // 距离衰减指数：2 = 物理正确，桌心亮、桌沿暗
const AMBIENT_COLOR = '#6d4433'; // 环境光颜色：很弱的暖褐，把暗处抬离纯黑（暗处是暗红，不是黑）
const AMBIENT_INTENSITY = 0.45; // 环境光强度：只够看清两端营地的轮廓
// 两端营地各补一盏很弱的点光：主灯到那儿只剩三成光，深色的那顶帐篷会糊在暗里，
// 得单独留一点余光，玩家才一眼看得出"小兵到了没有"。灯挂得低 + distance 收得紧，光只落在营地上。
const CAMP_Z = (stepsToWin + 0.5) * laneLength; // 营地中心的 z = ±11（和 board.js 里同一个算法）
const CAMP_FILL_COLOR = '#ffd8a6'; // 营地补光的颜色：跟吊灯同一个暖色，别引入第二种色温
const CAMP_FILL_INTENSITY = 26; // 补光强度：只把营地抬到看得清轮廓，不跟桌心抢亮
const CAMP_FILL_HEIGHT = 4.5; // 补光挂在营地正上方多高
const CAMP_FILL_DISTANCE = 7.5; // 补光的照射半径：够覆盖营地，够不到桌沿

// 暗角：只压在 3D 画面上。界面（状态行 / 三个按钮 / 抬手提示条 / 摄像头小窗 / 结算层）都是盖在
// canvas 上面的 DOM，所以暗角必须做在 3D 里 —— 一张现画的贴图贴在相机前面的全屏面片上。
// 形状是椭圆不是正圆：横向摊得开，才压不到画面左右两端的那两个营地。
const VIGNETTE_TEX_SIZE = 256; // 暗角贴图边长（像素），开局画一次就够
const VIGNETTE_INNER = 0.55; // 椭圆半径的 0.55 以内完全不压（棋盘中央必须完全透明）
const VIGNETTE_X = 1.5; // 椭圆横向半径：1 = 画面左右边缘，1.5 比画面还宽（两端营地不被压到）
const VIGNETTE_Y = 0.62; // 椭圆纵向半径：比横向小得多，上下的暗角压得比左右重
const VIGNETTE_MAX_ALPHA = 0.85; // 四角最暗压到这个程度（1 = 全黑）
const VIGNETTE_DISTANCE = 0.5; // 面片离相机多远：在近裁剪面 0.1 之外，贴着镜头又不被裁掉

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);

// 取景：按当前窗口的宽高比选相机距离，让棋盘两端（z = ±12.2）落在 |ndc.x| = FIT_NDC_X。
// 针孔投影里 z 端点的 |ndc.x| = FIT_HALF_Z / (d · tan(fov/2) · aspect)，反解出距离：
//   d = FIT_HALF_Z / (FIT_NDC_X · tan(fov/2) · max(aspect, FIT_MIN_ASPECT))
// 竖屏转横屏后棋盘是一条横带，宽度是唯一的约束，所以距离只跟宽高比走；初始化时和每次 resize 都调一次。
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  const fitAspect = Math.max(aspect, FIT_MIN_ASPECT); // 极端竖长时距离封顶
  const distance = FIT_HALF_Z / (FIT_NDC_X * Math.tan((CAMERA_FOV * Math.PI) / 360) * fitAspect);
  const pitch = (CAMERA_PITCH_DEG * Math.PI) / 180;
  camera.aspect = aspect;
  camera.position.set(distance * Math.cos(pitch), distance * Math.sin(pitch), 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
fitCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// 灯光：桌子正上方一盏暖金吊灯，垂直向下照桌心 —— SpotLight 默认的 target 就在原点，
// 所以灯摆在 (0, y, 0) 就是对着 (0, 0, 0) 照。distance 留默认的 0（不截断）：
// 桌心到桌沿的衰减全靠 decay 的平方项加上入射角的余弦，桌沿自然沉下去，不会有一圈硬边。
const spotLight = new THREE.SpotLight(SPOT_COLOR, SPOT_INTENSITY);
spotLight.position.set(0, SPOT_HEIGHT, 0);
spotLight.angle = (SPOT_ANGLE_DEG * Math.PI) / 180;
spotLight.penumbra = SPOT_PENUMBRA;
spotLight.decay = SPOT_DECAY;
scene.add(spotLight);

// 环境光：很弱，只把桌沿和两端营地抬出纯黑，别指望它照亮什么。
scene.add(new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY));

// 两端营地的一点余光（各自一盏小点光，就在营地正上方）。
for (const dir of [1, -1]) {
  const campFill = new THREE.PointLight(CAMP_FILL_COLOR, CAMP_FILL_INTENSITY, CAMP_FILL_DISTANCE);
  campFill.position.set(0, CAMP_FILL_HEIGHT, dir * CAMP_Z);
  scene.add(campFill);
}

/* ==== 暗角：现画一张贴图压在画面四周，只压 3D，压不到上面的界面 ==== */

// 逐像素算一张椭圆暗角：中央完全透明，越靠外越黑，用的是 smoothstep，边界柔和没有硬圈。
// 不用文件、不用渐变 API，256×256 一次算完就完事。
function makeVignetteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = VIGNETTE_TEX_SIZE;
  canvas.height = VIGNETTE_TEX_SIZE;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx || typeof ctx.createImageData !== 'function') return null; // 没有 2D 画布（测试桩）就算了
  const size = VIGNETTE_TEX_SIZE;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    const ry = (((y + 0.5) / size) * 2 - 1) / VIGNETTE_Y; // -1..1 是画面边缘，再除以椭圆半径
    for (let x = 0; x < size; x += 1) {
      const rx = (((x + 0.5) / size) * 2 - 1) / VIGNETTE_X;
      const r = Math.sqrt(rx * rx + ry * ry); // 0 = 画面正中，1 = 这一圈就是最暗处
      let fade = (r - VIGNETTE_INNER) / (1 - VIGNETTE_INNER);
      fade = fade < 0 ? 0 : fade > 1 ? 1 : fade;
      const alpha = fade * fade * (3 - 2 * fade) * VIGNETTE_MAX_ALPHA;
      const i = (y * size + x) * 4;
      img.data[i] = 0; // 纯黑：暗角只做减法（有颜色的暗角会被当成线性色再编码一次，糊上一层棕雾）
      img.data[i + 1] = 0;
      img.data[i + 2] = 0;
      img.data[i + 3] = Math.round(alpha * 255); // 四周的暗红是灯光给的，不是暗角给的
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

// 把这张贴图铺在一块挂到相机前面的面片上：暗角永远正对镜头，depthTest: false 让它最后盖在 3D 上。
function createVignette() {
  if (typeof THREE.CanvasTexture !== 'function') return null; // 宿主没有 CanvasTexture（测试桩）就整段跳过
  const texture = makeVignetteTexture();
  if (!texture) return null;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
  );
  mesh.frustumCulled = false; // 挂在相机上、贴着镜头，别让视锥剔除把它丢掉
  mesh.renderOrder = 1; // 3D 画完最后画它
  mesh.position.set(0, 0, -VIGNETTE_DISTANCE);
  camera.add(mesh);
  scene.add(camera); // 相机得进场景，挂在它身上的面片才会被渲染出来

  // 面片的大小 = 这个距离上视锥的高和宽，正好盖满画面；宽高比变了要重算，
  // 所以自己听一次 resize（主循环那套取景和 dt 一个字都不动）。
  // 宽高比直接读窗口，不读 camera.aspect —— 两个 resize 回调谁先跑都不影响结果。
  function layout() {
    const halfHeight = Math.tan((CAMERA_FOV * Math.PI) / 360) * VIGNETTE_DISTANCE;
    mesh.scale.set(halfHeight * 2 * (innerWidth / innerHeight), halfHeight * 2, 1);
  }
  layout();
  addEventListener('resize', layout);
}

createVignette();

addEventListener('resize', () => {
  fitCamera(); // 换宽高比就重新算距离
  renderer.setSize(innerWidth, innerHeight);
});

const game = createGame();
const board = createBoard(scene);
const ai = createAi();

/* ==== 回合状态机 ==== */

// choose（等出招）→ locked（已锁定，等揭晓）→ advance（小兵走一格）→ choose，或 → over。
let phase = 'choose';
let timer = 0;           // 当前这段已经过了多少秒
let lockedMove = null;   // 这一回合玩家锁定的招
let lockedAiMove = null; // 电脑在玩家锁定前就暗选好的招
const playerHistory = []; // 玩家出过的招，最早的在前；只给 ai.js 看，绝不含本回合这一招

// 出招：屏幕按钮和摄像头锁定都走这里，只有 choose 阶段收招。
// 这一道闸也是"揭晓途中摄像头又锁一次"不会多打一轮的原因。
function onChoose(move) {
  if (phase !== 'choose') return;
  ui.showLocked(move);
  ui.setEnabled(false);
  phase = 'locked';
  timer = 0;
  lockedMove = move;
  lockedAiMove = ai.choose(playerHistory); // 先暗选：此刻历史里还没有本回合的招
  playerHistory.push(move);
}

// 揭晓：结果只从 game.js 拿，赢的一方前进一格（动画交给 board.js）。
function reveal() {
  const round = game.playRound(lockedMove, lockedAiMove);
  ui.showReveal(lockedMove, lockedAiMove, round.result);
  if (round.result === 'win') board.animateAdvance('player');
  else if (round.result === 'lose') board.animateAdvance('ai');
  phase = 'advance';
  timer = 0;
  lockedMove = null;
}

// 小兵走完这一格：没人进营地就开下一回合，有人进了就结算。
function finishAdvance() {
  if (game.winner) {
    // 结算卡片上除了大字，还要写最终比分：两侧各赢了几轮（game.js 的原始胜场，不是净胜）。
    ui.showWinner(game.winner, game.playerSteps, game.aiSteps);
    phase = 'over';
    ui.setEnabled(false);
    return;
  }
  phase = 'choose';
  ui.setEnabled(true);
}

// 逐帧推进这两个"等一会儿"的阶段：用 dt 累加，不用 setTimeout。
function stepPhases(dt) {
  if (phase === 'locked') {
    timer += dt;
    if (timer >= revealDelay) reveal();
  } else if (phase === 'advance') {
    timer += dt;
    if (timer >= advanceDuration) finishAdvance();
  }
}

function onRestart() {
  game.reset();
  board.reset();
  ai.reset();
  playerHistory.length = 0;
  phase = 'choose';
  timer = 0;
  lockedMove = null;
  lockedAiMove = null;
  ui.hideOverlay();
  ui.setEnabled(true);
}

// showButtonFallback（tuning.js）真的关掉时，屏幕上那排备用按钮就不画了。
const ui = createUI({ onChoose, onRestart, showButtons: showButtonFallback });

/* ==== 空格重开 ==== */

// 结算卡片亮着（phase === 'over'）时，空格 = 点 PLAY AGAIN；打牌的其它时候按空格什么都不做：
// 不出招，也不把打到一半的这一局掐掉重开。
// 所有空格都要 preventDefault：launcher.js 开局就把焦点放在第一个出招按钮上
// （`.ft-btn:not(:disabled)` 那一句），按钮拿着焦点时浏览器默认会把空格当成"点这个按钮"——
// 不拦的话正常一局里按一下空格就白白出一招。拦掉默认动作，焦点上的按钮就不会被空格点到。
function onKeyDown(event) {
  if (event.key !== ' ' && event.code !== 'Space') return; // 只认空格
  event.preventDefault();
  if (phase !== 'over' || event.repeat) return; // 只有结算画面才重开；按住不重复触发
  onRestart();
}
addEventListener('keydown', onKeyDown);

/* ==== 摄像头 ==== */

// 认出握拳 / 比 V / 张开手掌就当成一次出招，走的是和按钮同一条路（onChoose），回合逻辑只有一份。
const gesture = createGestureInput({
  onLock: (move) => onChoose(move),
  onStatus: (text) => ui.setStatus(text),
  // 锁完一招要放下手、放下手又能再锁：底部那条提示跟着换（没摄像头时没人调，界面不出这条）。
  onArmChange: (armed) => ui.setArmHint(armed),
});
// 打不开也不要紧：gesture 已经把原因写进状态行，按钮照样能打完一局。
// 成功（start() 返回 true）才接右上角小窗，把摄像头画面显示出来；失败时 videoElement() 是 null，attachCamera 自己会跳过。
gesture.start()
  .then((ok) => { if (ok) ui.attachCamera(gesture.videoElement()); })
  .catch(() => {});

/* ==== 帧率面板（只有地址里带 fps 才存在） ==== */

// ?fps / ?fps=1 才建面板。不带参数时这里只花一次正则判断：不建节点、不开定时器，
// 主循环和渲染一帧都不碰，画面和没有这段代码逐像素一样。
// 面板自己用一个 requestAnimationFrame 数帧（和渲染同一个 rAF 节拍，所以就是渲染帧率），
// 每秒才写一次 DOM，不给主循环添任何每帧开销。
const FPS_PARAM = /(^|[?&])fps(=|&|$)/; // 同时认 ?fps 和 ?fps=1
const FPS_PANEL_SAMPLE_MS = 1000; // 每秒统计一次，不每帧写 DOM

function createFpsPanel(renderer) {
  const el = document.createElement('div');
  el.id = 'fps-panel';
  // 左上角：右上角 16px 处是摄像头小窗（z-index 900），所以左上同样留 16px 也不会重叠。
  // z-index 800：压在棋盘画布之上，又在摄像头小窗（900）和界面层（1000）之下。
  el.style.cssText =
    'position:fixed;top:16px;left:16px;z-index:800;padding:8px 10px;border-radius:6px;' +
    'background:rgba(12,9,7,0.72);color:#d9ffd2;white-space:pre;pointer-events:none;' +
    'user-select:none;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;';
  document.body.appendChild(el);

  let frames = 0;
  let windowStart = performance.now(); // 平均 / 最低都从这个时刻开始统计
  let sampleCount = 0;
  let fpsSum = 0;
  let fpsMin = Infinity;
  let fpsLast = 0;

  function paint() {
    const r = renderer.info.render;
    el.textContent =
      'fps    ' + fpsLast.toFixed(1) + '\n' +
      'avg    ' + (sampleCount ? (fpsSum / sampleCount).toFixed(1) : '--') + '\n' +
      'min    ' + (fpsMin === Infinity ? '--' : fpsMin.toFixed(1)) + '\n' +
      'calls  ' + r.calls + '\n' +
      'tris   ' + r.triangles;
  }

  function tick(now) {
    frames++;
    const span = now - windowStart;
    if (span >= FPS_PANEL_SAMPLE_MS) {
      fpsLast = (frames * 1000) / span;
      fpsSum += fpsLast;
      sampleCount++;
      if (fpsLast < fpsMin) fpsMin = fpsLast;
      frames = 0;
      windowStart = now;
      paint();
    }
    requestAnimationFrame(tick);
  }

  paint();
  requestAnimationFrame(tick);
}

if (FPS_PARAM.test(location.search)) createFpsPanel(renderer);

/* ==== 主循环 ==== */

// delta 上限：切回标签页时 rAF 会一次跳好几秒，不封顶的话 stepPhases 的累加会一步跨过
// 好几个回合阶段。100ms 大约是掉到 10fps 时的一帧，正常游玩永远碰不到。
const MAX_FRAME_DELTA = 0.1;

// 不用 THREE.Clock（0.186.1 里它已被弃用，控制台会出告警）。
// setAnimationLoop 的回调本身就收到一个毫秒时间戳（和 performance.now() 同一套时钟），
// 第一帧还没有上一帧，delta 记 0，之后就是 (now - last) / 1000。
// 万一调用方没给这个参数（测试里的 renderer 桩就是空参调用），退回 performance.now()，读的还是同一套时钟。
let lastFrameMs = null;
renderer.setAnimationLoop((nowMs) => {
  const now = typeof nowMs === 'number' ? nowMs : performance.now();
  const dt = lastFrameMs === null ? 0 : Math.min((now - lastFrameMs) / 1000, MAX_FRAME_DELTA);
  lastFrameMs = now;
  board.update(dt); // 推进小兵前进动画
  ui.update(dt); // 推进界面自己的动画
  gesture.update(dt); // 跑一帧手势识别
  stepPhases(dt); // 推进"锁定 → 揭晓 → 前进"
  renderer.render(scene, camera);
});
