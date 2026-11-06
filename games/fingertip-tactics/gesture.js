// gesture.js — 摄像头手势输入：把 MediaPipe 的手部关键点变成 heavy / slash / shield 三种出招，认稳了就回调 onLock。
// 用法：const g = createGestureInput({ onLock, onStatus, onArmChange }); await g.start(); 每帧 g.update(dt);
// onArmChange(armed)：锁完一招要放下手（false），放下手 / 换手形够了帧数又能再锁一次（true）；
// 只在状态真变了的时候各发一次，没在跑（没摄像头 / 已停）时一个信号都不发。
// NO_HAND_SECONDS 和 DETECT_FPS 是这里的节奏常数（tuning.js 归别人管，谁拿到谁再搬过去）。

import { gestureHoldFrames } from './tuning.js';

// MediaPipe 从 CDN 拿。这里是动态 import（在 start() 里），CDN 挂了页面照样能用按钮玩。
const VISION_MODULE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const DETECT_FPS = 30;        // 识别最多跑这么快（比视频快没意义）
const NO_HAND_SECONDS = 5;    // 载好模型后多久没看到手，就提醒一次

const MOVE_NAMES = { heavy: 'Heavy', slash: 'Slash', shield: 'Shield' };

// 给玩家看的话，尽量短。
const MSG = {
  camera: 'Asking for camera permission…',
  denied: 'Camera permission was denied — click the camera icon in the address bar to allow it, or use the buttons below.',
  noCamera: 'No camera found. Use the buttons below.',
  busy: 'The camera is being used by another app. Use the buttons below.',
  cameraFail: 'Could not open the camera. Use the buttons below.',
  dropped: 'Camera disconnected. Use the buttons below.',
  model: 'Loading the hand-tracking model…',
  modelFail: 'Could not load the hand-tracking model (needs internet). Use the buttons below.',
  showHand: 'Put your hand in frame — make a fist, a V-sign, or an open palm.',
  noHand: 'No hand in frame — raise your hand into view, 40–70 cm from the camera.',
  unclear: 'Could not read that shape — try a fist, a V-sign, or an open palm.',
};

// 21 个关键点：0 手腕；指尖 4/8/12/16/20；指节 3/6/10/14/18。
const WRIST = 0;
const TIPS = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIPS = { thumb: 3, index: 6, middle: 10, ring: 14, pinky: 18 };
const FINGERS = ['index', 'middle', 'ring', 'pinky'];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 指尖离手腕比指节离手腕更远 => 这根手指伸开着（跟手离镜头远近无关，比角度稳）。
function extended(lm, finger) {
  return dist(lm[TIPS[finger]], lm[WRIST]) > dist(lm[PIPS[finger]], lm[WRIST]);
}

// 只看“伸开了几根手指”，不看不张开角度（食中夹角那套已经废弃）。
function classify(lm) {
  const isOpen = {};
  for (const f of FINGERS) isOpen[f] = extended(lm, f);
  const n = FINGERS.filter((f) => isOpen[f]).length;
  if (n >= 4) return 'shield';                                          // 五指张开
  if (n <= 1) return 'heavy';                                           // 握拳
  if (isOpen.index && isOpen.middle && !isOpen.ring && !isOpen.pinky) return 'slash'; // 只伸食指和中指
  return null;                                                          // 不在三种里
}

// tuning.js 里的帧数，改成别的值立刻生效；万一被删掉也不至于卡死。
function holdFramesNeeded() {
  const n = Number(gestureHoldFrames);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function cameraFailMessage(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return MSG.denied;
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return MSG.noCamera;
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return MSG.busy;
  return MSG.cameraFail;
}

export function createGestureInput({ onLock, onStatus, onArmChange } = {}) {
  const emitLock = typeof onLock === 'function' ? onLock : () => {};
  const emitStatus = typeof onStatus === 'function' ? onStatus : () => {};
  const emitArmChange = typeof onArmChange === 'function' ? onArmChange : () => {};

  let video = null;
  let stream = null;
  let landmarker = null;
  let running = false;
  let startPromise = null;

  // 节奏：跳过还没到时间的帧，也跳过视频没出新帧的帧。
  let lastDetectAt = 0;
  let lastVideoTime = -1;
  let lastTimestamp = 0;

  // 识别状态
  let holdShape = null;    // 正在连续累积的那个招式
  let holdCount = 0;
  let lockedShape = null;  // 上一次锁定后，等着玩家松手的那个招式（松手前不再发招）
  let armed = null;        // 能不能再锁一次；null = 还没开跑，界面不该收到任何信号
  let releaseCount = 0;
  let trackWrist = null;   // 上一帧跟着的那只手腕
  let noHandSeconds = 0;
  let unclearCount = 0;
  let lastMessage = null;

  // 同一句话不重复刷屏。force = 同一招连出两次也要重新报一次。
  function say(text, force = false) {
    if (!force && text === lastMessage) return;
    lastMessage = text;
    try { emitStatus(text); } catch { /* 界面出问题不能拖垮识别 */ }
  }

  // 只报"真的变了"的那一次；没在跑（没摄像头 / 已经停了）时一个信号都不发，
  // 界面那条提示就完全不会出现，连空条都不会留。
  function setArmed(next) {
    if (!running) return;
    if (armed === next) return;
    armed = next;
    try { emitArmChange(next); } catch { /* 界面出问题不能拖垮识别 */ }
  }

  function resetRecognition() {
    holdShape = null;
    holdCount = 0;
    lockedShape = null;
    releaseCount = 0;
    trackWrist = null;
    noHandSeconds = 0;
    unclearCount = 0;
    lastDetectAt = 0;
    lastVideoTime = -1;
    lastTimestamp = 0;
  }

  function teardown() {
    running = false;
    if (stream) {
      for (const t of stream.getTracks()) { try { t.stop(); } catch { /* 已经停了 */ } }
      stream = null;
    }
    if (video) {
      try { video.pause(); } catch { /* 没在播 */ }
      video.srcObject = null;
      video.remove();
      video = null;
    }
    if (landmarker) {
      try { landmarker.close(); } catch { /* 已经关了 */ }
      landmarker = null;
    }
    resetRecognition();
    armed = null; // 不补发信号（停了就是没这条提示），只把状态清干净，下次 start() 重新报一次
    lastMessage = null;
  }

  // 摄像头中途被拔掉 / 被别的程序抢走。
  function onCameraLost() {
    if (!running) return;
    teardown();
    say(MSG.dropped);
  }

  async function start() {
    if (running) return true;
    if (startPromise) return startPromise;

    startPromise = (async () => {
      let stage = 'camera';
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          say(MSG.cameraFail);
          return false;
        }

        say(MSG.camera);
        video = document.createElement('video');
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        // 1x1、透明、挪到屏幕外：不用 display:none，免得某些浏览器不再喂帧。
        video.style.cssText = 'position:fixed;left:-8px;top:-8px;width:2px;height:2px;opacity:0;pointer-events:none;';
        document.body.appendChild(video);

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        video.srcObject = stream;
        for (const t of stream.getTracks()) t.addEventListener('ended', onCameraLost);
        try { await video.play(); } catch { /* blocked 也别慌，muted + playsinline 通常还能播 */ }

        stage = 'model';
        say(MSG.model);
        const vision = await import(VISION_MODULE);
        const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
        const make = (delegate) => vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        try { landmarker = await make('GPU'); }
        catch { landmarker = await make('CPU'); }  // 有些机器只能跑 CPU

        resetRecognition();
        running = true;
        say(MSG.showHand);
        setArmed(true); // 刚起来就是"可以出招"；摄像头没起来就根本走不到这一行
        return true;
      } catch (err) {
        say(stage === 'camera' ? cameraFailMessage(err) : MSG.modelFail);
        teardown();
        return false;
      }
    })();

    const ok = await startPromise;
    startPromise = null;
    return ok;
  }

  function stop() {
    teardown();
  }

  // 两只手时跟着上一帧那只，不然识别结果会在两手之间来回跳。
  function pickHand(hands) {
    if (hands.length < 2 || !trackWrist) return hands[0];
    return dist(hands[1][WRIST], trackWrist) < dist(hands[0][WRIST], trackWrist) ? hands[1] : hands[0];
  }

  // 松手计数：手形离开上一次的招式，或者干脆看不到手，都算。
  function countRelease() {
    releaseCount++;
    if (releaseCount >= holdFramesNeeded()) {
      lockedShape = null;
      releaseCount = 0;
      setArmed(true); // 手松开 / 换了手形够帧数了，可以再锁一次
    }
  }

  function handleResult(result) {
    const hands = (result && result.landmarks) || [];

    if (hands.length === 0) {
      holdShape = null;
      holdCount = 0;
      unclearCount = 0;
      trackWrist = null;
      if (lockedShape !== null) countRelease();
      if (noHandSeconds >= NO_HAND_SECONDS) say(MSG.noHand);
      return;
    }

    noHandSeconds = 0;
    const lm = pickHand(hands);
    trackWrist = lm[WRIST];
    const shape = classify(lm);

    // 上一招还举着：不出招，等手离开这个手形（或者没手）一会儿再说。
    if (lockedShape !== null) {
      if (shape === lockedShape) {
        releaseCount = 0;
        unclearCount = 0;
        return;
      }
      countRelease();
    }

    if (shape === null) {
      holdShape = null;
      holdCount = 0;
      unclearCount++;
      if (unclearCount === holdFramesNeeded()) say(MSG.unclear);
      return;
    }

    unclearCount = 0;
    if (shape === holdShape) holdCount++;
    else { holdShape = shape; holdCount = 1; }

    if (holdCount >= holdFramesNeeded()) {
      lockedShape = shape;
      releaseCount = 0;
      holdShape = null;
      holdCount = 0;
      setArmed(false); // 刚锁定：这一招还举着，玩家得先放下手
      say('Recognized: ' + MOVE_NAMES[shape], true);
      try { emitLock(shape); } catch { /* 主流程的事，跟识别无关 */ }
    }
  }

  function update(dt) {
    if (!running || !landmarker || !video) return;

    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 1 / 60;
    noHandSeconds += step;

    const now = performance.now();
    if (now - lastDetectAt < 1000 / DETECT_FPS) return;   // 这帧太早，跳过
    if (video.readyState < 2 || !video.videoWidth) return; // 画面还没准备好
    if (video.currentTime === lastVideoTime) return;        // 视频没出新帧，别重复识别旧帧

    lastDetectAt = now;
    lastVideoTime = video.currentTime;
    lastTimestamp = Math.max(lastTimestamp + 1, now);

    let result;
    try { result = landmarker.detectForVideo(video, lastTimestamp); }
    catch { return; }  // 识别这一帧出错就跳过，主循环照跑
    handleResult(result);
  }

  function isRunning() {
    return running && !!video && !!landmarker;
  }

  // 给界面用：把这支 <video> 交出去做右上角小窗预览。start() 建好之前（或失败/停掉之后）是 null。
  function videoElement() {
    return video;
  }

  return { start, stop, update, isRunning, videoElement };
}
