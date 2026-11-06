// 棋盘：中间一个大格是双方共同的起点，往两边各 stepsToWin 个小格，再过去就是对方的营地；GLB 到位后换掉方块。
import * as THREE from 'three';
import { advanceDuration, laneLength, landFlashAlpha, landFlashColor, landFlashSeconds, pawnKeepTexture, pawnScale, pawnTint, stepsToWin, useModels } from './tuning.js';

// —— GLB 模型 —— 棋盘来自 tools/ 的 Blender 脚本，棋子来自作者用 Tripo 生成的骑士。
const LOADER_MODULE = 'three/addons/loaders/GLTFLoader.js'; // 走 index.html 的 import map，动态 import
const BOARD_GLB = 'board.glb'; // 圆木桌 + 棋盘 + 格子 + 两端营地，全在一个文件里；可走面 y = 0
// 两枚棋子都是同一个骑士模型（作者只做了这一枚），差别只在颜色。
// 实测：原点在底座底面中心、底面就在 y = 0（不用平移）、脸朝 +Z、带贴图、无动画。
const PAWN_GLB = 'tripo/tripo-pawn.glb';
// 每个 GLB 的两个候选地址，按顺序试：先文档相对（index.html 就在仓库根，和封面图一个规矩），
// 再服务器根（页面住在子目录里时——比如 spike/ 下的临时页——相对路径会 404）；都不行就一直用方块。
const GLB_DIRS = ['assets/', '/assets/'];
const WALK_Y = 0; // 契约里的可走面：模型棋子站这里（方块棋子站在面板顶面 PLATE_TOP 上）

// 模型天生朝哪边 —— 换模型时只改这一个数：+1 = 脸朝 +Z，-1 = 脸朝 -Z（Tripo 骑士是 +1）。
const MODEL_FACING = 1;
// 让棋子面朝它要走的方向：走路方向 dir 是 ±1（玩家 -1、电脑 +1），和模型天生的朝向一致就不转。
const turnFor = (dir) => (dir === MODEL_FACING ? 0 : Math.PI);

// —— 尺寸 —— 格距就是 laneLength；格子比格距小一圈，露出来的木板就是格线。
const CELL_HALF_X = 0.7; // 小格半宽：1.4 × 1.4 的方块
const CELL_HALF_Z = 0.7; // 小格半长
const MID_HALF = 1.15; // 中间大格半边：2.3 × 2.3，比小格明显大
const CAMP_HALF_X = 1.5; // 营地半宽：比一格宽，像一块扎营的地方
const CAMP_HALF_Z = 0.55; // 营地半长：近边正好压在第 stepsToWin 格的外沿上，中间不留缝
const CAMP_Z = (stepsToWin + 0.5) * laneLength; // 营地中心 z = ±(5.5 格)

// —— 落格高亮片 —— 小兵落格时脚下那格亮一下；这块薄板是 board.js 自己放的，不去碰 GLB 里的格子网格。
const HIGHLIGHT_NAME = 'ft-land-highlight'; // hideBoxBoard 靠这个名字把高亮片留在明处
const HL_HALF = laneLength * 0.275; // 半边：跟格距走（laneLength = 2 时是 0.55），落在格面里、压不到格线的边框
const HL_THICKNESS = 0.012; // 薄板厚度
const HL_LIFT = 0.008; // 抬离格面一点点：既不悬空、也不穿进棋盘
export const SLAB_HALF_X = 2.2; // 棋盘板半宽（长边沿 Z）
export const SLAB_HALF_Z = CAMP_Z + CAMP_HALF_Z + 0.45; // 棋盘板半长：装下两个营地，外面留一条边
const SLAB_THICKNESS = 0.25;
const PLATE_TOP = 0.05; // 小格面板的顶面高度（棋盘板顶面是 y = 0）
const CAMP_TOP = 0.07; // 营地台面比小格高一档：它压着最后一格的外沿，高一点才不会和格子顶面打架
const MID_TOP = 0.09; // 中间大格再高一点，像一块中心台

const PLAYER_X = 0.6; // 两枚小兵并排站在中间大格里（不是叠成一个人）
const ENEMY_X = -0.6;

// —— 颜色 —— 打烊酒馆的木头色；中间大格最亮，两个营地一暖一冷。
const BOARD_COLOR = '#6b5540';
const MID_COLOR = '#9d8157';
const CELL_COLORS = ['#7d6549', '#715a41']; // 小格两色交替，一格格看得出
const PLAYER_CAMP_COLOR = '#b4562f';
const ENEMY_CAMP_COLOR = '#3f6f9c';
const PLAYER_PAWN_COLOR = '#e8792f';
const ENEMY_PAWN_COLOR = '#5aa0dd';

// 一枚方块小兵（GLB 没到位、或者加载失败时的样子）：一个圆台身子加一个球脑袋，纯几何。
function makePawn(color) {
  const pawn = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, 0.5, 16),
    material
  );
  body.position.y = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), material);
  head.position.y = 0.62;
  pawn.add(body, head);
  return pawn;
}

// 造一块平躺的方板，顶面正好在 y。
function makePlate(halfX, halfZ, thickness, color, y = 0) {
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(halfX * 2, thickness, halfZ * 2),
    new THREE.MeshStandardMaterial({ color })
  );
  plate.position.y = y - thickness / 2;
  return plate;
}

// 按 GLB_DIRS 的顺序试地址：这个地址加载失败就试下一个，试完还不行就把 reject 交回调用方。
function tryLoad(loader, file, i) {
  if (i >= GLB_DIRS.length) return Promise.reject(new Error('加载不了 ' + file));
  return new Promise((resolve, reject) => {
    loader.load(GLB_DIRS[i] + file, resolve, undefined, () => {
      tryLoad(loader, file, i + 1).then(resolve, reject);
    });
  });
}

// 加载一个 GLB：动态 import 加载器（顶层静态 import 会让没网时的棋盘整个起不来），再 load 那个文件。
function loadModel(file) {
  return import(LOADER_MODULE).then((mod) => tryLoad(new mod.GLTFLoader(), file, 0));
}

export function createBoard(scene) {
  const board = new THREE.Group();
  scene.add(board);

  // 棋盘板：顶面在 y = 0，长边沿 Z，装得下中间大格 + 每边 stepsToWin 格 + 两个营地。
  board.add(makePlate(SLAB_HALF_X, SLAB_HALF_Z, SLAB_THICKNESS, BOARD_COLOR, 0));

  // 中间大格：双方共同的起点，两枚小兵开局都站在这一块上。
  board.add(makePlate(MID_HALF, MID_HALF, MID_TOP, MID_COLOR, MID_TOP));

  // 每边 stepsToWin 个小格：z = ∓k * laneLength（k 从 1 数起），两色交替，一格格看得清。
  for (let k = 1; k <= stepsToWin; k += 1) {
    const color = CELL_COLORS[(k - 1) % CELL_COLORS.length];
    for (const dir of [1, -1]) {
      const cell = makePlate(CELL_HALF_X, CELL_HALF_Z, PLATE_TOP, color, PLATE_TOP);
      cell.position.z = dir * k * laneLength;
      board.add(cell);
    }
  }

  // 两个营地：在各自 stepsToWin 格之外，z = ±(stepsToWin + 0.5) * laneLength。
  const playerCamp = makePlate(CAMP_HALF_X, CAMP_HALF_Z, CAMP_TOP, PLAYER_CAMP_COLOR, CAMP_TOP);
  playerCamp.position.z = CAMP_Z; // 玩家营地在 +Z
  const enemyCamp = makePlate(CAMP_HALF_X, CAMP_HALF_Z, CAMP_TOP, ENEMY_CAMP_COLOR, CAMP_TOP);
  enemyCamp.position.z = -CAMP_Z; // 电脑营地在 -Z
  board.add(playerCamp, enemyCamp);

  // 两枚小兵：开局都在中间大格上，只左右错开；站着的高度跟面板齐平。
  const playerPawn = makePawn(PLAYER_PAWN_COLOR);
  playerPawn.position.set(PLAYER_X, PLATE_TOP, 0);
  const enemyPawn = makePawn(ENEMY_PAWN_COLOR);
  enemyPawn.position.set(ENEMY_X, PLATE_TOP, 0);
  board.add(playerPawn, enemyPawn);

  const dirOf = (side) => (side === 'player' ? -1 : 1); // 玩家往 -Z 走，电脑往 +Z 走
  const pawnOf = (side) => (side === 'player' ? playerPawn : enemyPawn);

  /* ==== 推挤规则 ==== */
  // 设 s = 玩家净胜次数 − 电脑净胜次数（棋盘自己数：animateAdvance('player') 记 +1、('ai') 记 −1）。
  // 两枚小兵的落点只由 s 决定，不再各走各的：赢家往前顶一格、输家被顶得后退一格，
  // 所以从第 2 次净胜起两枚一起移动、永远相邻（间隔恒为一格）。开局两枚并排站在中间大格。
  let net = 0;

  // s 时玩家小兵的 z：s = 1 时玩家还站在中间大格（它本来就占着那里），再净胜一次才前进一格。
  function playerZFor(s) {
    if (s >= stepsToWin) return -laneLength * (stepsToWin - 1); // 已经推满：赢家停在这里，不再往前
    if (s >= 1) return -laneLength * (s - 1);
    return -laneLength * s; // s ≤ 0：玩家被顶后退（往 +Z 方向）
  }
  // s 时电脑小兵的 z：和玩家左右对称 —— aiZFor(s) = -playerZFor(-s)。
  function aiZFor(s) {
    return -playerZFor(-s);
  }
  // 两枚小兵在净胜 s 时该站的 z。某一方净胜推满 stepsToWin 时，赢家把输家推进它自己的营地中心。
  function place(s) {
    if (s >= stepsToWin) return { player: playerZFor(s), ai: -CAMP_Z }; // 电脑被推进 -Z 端的营地
    if (s <= -stepsToWin) return { player: CAMP_Z, ai: aiZFor(s) };     // 玩家被推进 +Z 端的营地
    return { player: playerZFor(s), ai: aiZFor(s) };
  }

  // 正在播放的滑动：{ from, to, t }，没有动画时是 null。
  const anims = { player: null, ai: null };

  function startAnim(side, to) {
    anims[side] = { from: pawnOf(side).position.z, to, t: 0 };
  }

  // 一方赢了这一局：净胜记上 ±1，两枚小兵一起滑到新净胜算出来的格子上（赢家进、输家退）。
  function animateAdvance(side) {
    if (Math.abs(net) >= stepsToWin) return; // 已经分出胜负，不再移动
    net += side === 'player' ? 1 : -1;
    const target = place(net);
    startAnim('player', target.player);
    startAnim('ai', target.ai);
  }

  function stepAnim(side, dt) {
    const anim = anims[side];
    if (!anim) return;
    anim.t = Math.min(1, anim.t + dt / advanceDuration);
    const ease = 1 - Math.pow(1 - anim.t, 3); // 缓出：起步快、落点稳
    pawnOf(side).position.z = anim.from + (anim.to - anim.from) * ease;
    if (anim.t >= 1) {
      pawnOf(side).position.z = anim.to; // 收尾时对齐格子
      anims[side] = null;
      if (Math.abs(anim.to - anim.from) > 1e-6) flashLanding(side, anim.to); // 真的走动了：脚下那格亮一下
    }
  }

  // 底层摆位：直接把两枚小兵放到各自的第 k 格（不播动画、不闪高亮），净胜随之记成 playerSteps − aiSteps。
  function setSteps(playerSteps, aiSteps) {
    anims.player = null;
    anims.ai = null;
    net = playerSteps - aiSteps;
    playerPawn.position.z = dirOf('player') * playerSteps * laneLength;
    enemyPawn.position.z = dirOf('ai') * aiSteps * laneLength;
  }

  /* ==== 落格高亮 ==== */
  // 小兵走到一格停下时，它脚下那格短暂亮起、再柔和淡出。高亮片是这里自己放的一块薄板，
  // 不去改棋盘模型里的格子网格（board.glb 里那些格子多半是同一个网格，没法单格发光），
  // 所以方块棋盘和 GLB 棋盘都用得上，也不依赖模型内部结构。
  // 三种地面（中间大格 / 小格 / 营地）的高度：方块棋盘是一叠面板，GLB 棋盘只有中间口袋低 0.05。
  const BOX_TOPS = { mid: MID_TOP, cell: PLATE_TOP, camp: CAMP_TOP };
  const GLB_TOPS = { mid: WALK_Y - 0.05, cell: WALK_Y, camp: WALK_Y };
  let tops = BOX_TOPS; // 换上 GLB 棋盘时切成 GLB_TOPS
  function surfaceY(z) {
    const az = Math.abs(z);
    if (az < laneLength * 0.5) return tops.mid;
    if (az >= CAMP_Z) return tops.camp;
    return tops.cell;
  }

  function makeHighlight() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(HL_HALF * 2, HL_THICKNESS, HL_HALF * 2),
      new THREE.MeshBasicMaterial({
        color: landFlashColor,
        transparent: true,
        opacity: 0,
        depthWrite: false, // 只加光、不写深度，和格面之间不打架
        blending: THREE.AdditiveBlending, // 加色混合：看起来是"亮起来"，不是贴了块色纸
      })
    );
    mesh.name = HIGHLIGHT_NAME;
    mesh.visible = false;
    mesh.position.set(0, BOX_TOPS.mid + HL_LIFT + HL_THICKNESS / 2, 0);
    return mesh;
  }

  // 两枚小兵各一块，同一步里两枚一起落格也不会互相抢。
  const highlights = { player: makeHighlight(), ai: makeHighlight() };
  board.add(highlights.player, highlights.ai);
  const flashLeft = { player: 0, ai: 0 }; // 各自还剩多久淡完，秒

  function flashLanding(side, z) {
    const hl = highlights[side];
    hl.position.set(0, surfaceY(z) + HL_LIFT + HL_THICKNESS / 2, z); // 贴在这一格的面板上
    hl.material.opacity = landFlashAlpha; // 亮起来
    hl.visible = true;
    flashLeft[side] = landFlashSeconds;
  }

  function stepFlash(side, dt) {
    if (flashLeft[side] <= 0) return;
    flashLeft[side] = Math.max(0, flashLeft[side] - dt);
    const k = flashLeft[side] / landFlashSeconds; // 1 → 0
    highlights[side].material.opacity = landFlashAlpha * Math.min(1, k * 1.8); // 先满亮一小会儿，再柔和淡出
    if (flashLeft[side] === 0) highlights[side].visible = false;
  }

  function clearFlash() {
    for (const side of ['player', 'ai']) {
      flashLeft[side] = 0;
      highlights[side].visible = false;
      highlights[side].material.opacity = 0;
    }
  }

  // 重开：两枚小兵都回到中间大格，高亮收掉。
  function reset() {
    setSteps(0, 0);
    clearFlash();
  }

  function update(dt) {
    stepAnim('player', dt);
    stepAnim('ai', dt);
    stepFlash('player', dt);
    stepFlash('ai', dt);
  }

  /* ==== GLB：异步换成真模型（useModels = false 就整段不跑） ==== */

  // 模型单独装在一个 Group 里，所以"把方块棋盘收起来"只要遍历 board 的 Mesh 子节点。
  const modelLayer = new THREE.Group();
  board.add(modelLayer);

  // 把方块棋盘整批藏掉：board 的 Mesh 子节点正好是棋盘板 + 大格 + 十个小格 + 两个营地
  // （小兵是 Group、高亮片带 HIGHLIGHT_NAME，都不该被藏掉）。
  function hideBoxBoard() {
    for (const child of board.children) {
      if (child.type === 'Mesh' && child.name !== HIGHLIGHT_NAME) child.visible = false;
    }
  }

  // 深拷一份模型给这一枚棋子用。Object3D.clone() 只复制节点，材质还是和原件（以及另一枚）共用同一份 ——
  // 所以这里逐个 Mesh 把材质也 clone 一份，否则给一枚染红会把另一枚一起染红。
  function cloneWithOwnMaterials(root) {
    const copy = root.clone(true);
    copy.traverse((node) => {
      if (!node.isMesh) return;
      if (Array.isArray(node.material)) node.material = node.material.map((m) => m.clone());
      else node.material = node.material.clone();
    });
    return copy;
  }

  // 给一枚棋子的所有 Mesh 上色：pawnKeepTexture 时把颜色乘在贴图上；否则整块换成纯色材质。
  function paintPawn(model, tint) {
    model.traverse((node) => {
      if (!node.isMesh) return;
      const list = Array.isArray(node.material) ? node.material : [node.material];
      const painted = list.map((m) => {
        if (!pawnKeepTexture) return new THREE.MeshStandardMaterial({ color: tint });
        m.color.set(tint); // color 是乘在 map 上的：骑士贴图偏深，乘深色会发闷
        return m;
      });
      node.material = Array.isArray(node.material) ? painted : painted[0];
    });
  }

  // 一枚棋子换上模型：卸掉方块的身子脑袋，缩到棋子尺寸、染成自己那方的颜色，按契约摆到可走面上并面朝要走的方向。
  function useModelPawn(pawn, source, turn, tint) {
    const model = cloneWithOwnMaterials(source);
    model.scale.setScalar(pawnScale); // 底面就在模型原点，缩放后仍然贴着 y = 0
    paintPawn(model, tint);
    for (const part of pawn.children.slice()) pawn.remove(part);
    pawn.add(model);
    pawn.position.y = WALK_Y; // 模型原点就在底座底面中心，y = 0 正好站在可走面上
    pawn.rotation.y = turn;
  }

  if (useModels) {
    try {
      // 桌面和棋盘都在 board.glb 里，整份 scene 一起挂上去（圆木桌就是这么显示出来的）。
      loadModel(BOARD_GLB).then((gltf) => {
        hideBoxBoard();
        tops = GLB_TOPS; // 换成 GLB 棋盘后，高亮片贴在它的可走面（y = 0）上，不是方块面板的高度
        modelLayer.add(gltf.scene);
      }).catch(() => {}); // 加载失败：方块棋盘留在原地，什么都不用做
      // 两枚棋子是同一个骑士模型，只是各拿一份自己的材质、各染一种色。
      // 玩家往 -Z 走、电脑往 +Z 走，朝向由 turnFor 从 MODEL_FACING 算出来。
      loadModel(PAWN_GLB).then((gltf) => {
        const playerTurn = turnFor(dirOf('player'));
        const enemyTurn = turnFor(dirOf('ai'));
        useModelPawn(playerPawn, gltf.scene, playerTurn, pawnTint.player);
        useModelPawn(enemyPawn, gltf.scene, enemyTurn, pawnTint.ai);
      }).catch(() => {}); // 加载失败：方块棋子留在原地，什么都不用做
    } catch (e) {
      // 连动态 import 都抛了：还是方块那套，页面照常能玩，绝不把错误丢到窗口上。
    }
  }

  return { setSteps, animateAdvance, reset, update };
}
