// 一次性测试入口（jsc）：读仓库里的真实文件，跑完规则 / 可调数字 / 棋盘 / 界面 / 接线 / AI / 手势 的检查。
//
// 跑法（可整行复制）：
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc --module-file=/Users/yingxiliu/anthropic-game-jam/tests/run-tests.js
//
// 为什么这么搭：jsc 自带 ES module 加载器，只认相对/绝对路径，不认 'three' 这种裸名，也没有 DOM。
// 所以这个文件做三件事：
//   1) 纯逻辑（tuning / game / ai / gesture）直接 import 仓库里的真文件；
//   2) board.js / main.js 需要 'three' 和 DOM —— 每次运行现读源文件，只把 import 的路径改成本地桩再写进
//      /tmp，然后 import 那个副本。改的只有 import 语句里的路径，其余字节原样，所以测的仍是真文件；
//   3) ui.js 没有 import，直接 import 真文件，只给它一个最小 DOM 桩。
// 任何一步失败都打印 FAIL，最后一行汇总并抛异常（jsc 捕获异常时退出码非 0；注意 quit(1) 在这种 jsc 里退出码仍是 0）。

/* ==== 1. 路径 ==== */

const SELF_PATH = decodeURIComponent(import.meta.url.replace(/^file:\/\//, ''));
const TESTS_DIR = SELF_PATH.replace(/\/[^/]+$/, '');
const REPO = TESTS_DIR.replace(/\/[^/]+$/, '');
const TMP = '/tmp/fingertip-tactics-test';
if (REPO.indexOf('/') < 0 || REPO === TESTS_DIR) {
  throw new Error('拿不到仓库绝对路径，import.meta.url = ' + import.meta.url);
}

/* ==== 2. 测试框架 ==== */

let passed = 0;
let failed = 0;
let skipped = 0;

class CheckFail extends Error {}

function must(cond, msg) {
  if (!cond) throw new CheckFail(msg);
}

function fmt(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  } catch (e) {
    return String(v);
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new CheckFail(what + '：expected ' + fmt(expected) + '，actual ' + fmt(actual));
  }
}

function near(actual, expected, what, eps) {
  const limit = eps === undefined ? 1e-9 : eps;
  if (!(Math.abs(actual - expected) <= limit)) {
    throw new CheckFail(what + '：expected ' + fmt(expected) + '，actual ' + fmt(actual));
  }
}

function check(what, fn) {
  try {
    fn();
    passed += 1;
    print('PASS ' + what);
  } catch (e) {
    failed += 1;
    const msg = e && e.message ? e.message : String(e);
    const name = e instanceof CheckFail ? '' : (e && e.name ? e.name + ': ' : '');
    print('FAIL ' + what + ' — ' + name + msg);
  }
}

function skip(what) {
  skipped += 1;
  print('SKIP ' + what);
}

function section(title) {
  print('');
  print('—— ' + title + ' ——');
}

/* ==== 3. 独立写一遍的对照表（不 import game.js，免得拿被测代码证明被测代码） ==== */

const KEYS = ['heavy', 'slash', 'shield'];
// 界面上所有文字都是英文（ui.js）。期望值只写一份，两头都核：
//   - 招式名要和 game.js 导出的 MOVE_LABELS 一致（见「规则」那节的断言）；
//   - 按钮文字/揭晓行/结算文案要和 ui.js 真的建出来的 DOM 对得上（见「界面」那节）。
const LABELS = { heavy: 'Heavy', slash: 'Slash', shield: 'Shield' };
const LABEL_KEYS = { Heavy: 'heavy', Slash: 'slash', Shield: 'shield' };
// 重击克快斩 / 快斩克护盾 / 护盾克重击
const BEATS = { heavy: 'slash', slash: 'shield', shield: 'heavy' };
// 反过来：打赢 X 的那一招
const COUNTER = { heavy: 'shield', slash: 'heavy', shield: 'slash' };
// ui.js 的 RESULTS：揭晓行尾巴上的结果词
const RESULT_LABELS = { win: 'You win', lose: 'Computer wins', tie: 'Tie' };
const RESULT_KEYS = { 'You win': 'win', 'Computer wins': 'lose', Tie: 'tie' };
// ui.js 的 showWinner：结算卡片上的大字
const WINNER_TEXT = { player: 'You win!', ai: 'Computer wins!' };
// ui.js 的 showWinner：结算卡片上「各赢了几轮」的那一行（净胜定胜负，所以两边都是原始胜场）
const ROUNDS_LINE = (you, computer) => `Rounds — you ${you} · computer ${computer}`;

function outcomeOf(a, b) {
  if (a === b) return 'tie';
  return BEATS[a] === b ? 'win' : 'lose';
}

/* ==== 4. three.js 桩（只有 board.js / main.js 用得到的那部分） ==== */

const THREE_STUB_SRC = `
// 由 tests/run-tests.js 生成：够 board.js / main.js 用的 three.js 替身，不做任何渲染。
export const stub = {
  delta: 1 / 60,
  loop: null,
  renders: 0,
  scenes: [],
  reset() { this.delta = 1 / 60; this.loop = null; this.renders = 0; this.scenes.length = 0; },
};

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { return this.set(s, s, s); }
  copy(v) { return this.set(v.x, v.y, v.z); }
}
export class Object3D {
  constructor() {
    this.type = 'Object3D';
    this.children = [];
    this.position = new Vector3();
    this.rotation = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.visible = true;
    this.name = '';
  }
  add(...objs) { for (const o of objs) { if (o) this.children.push(o); } return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this; }
  traverse(fn) { fn(this); for (const c of this.children) { if (c && c.traverse) c.traverse(fn); } }
  lookAt() { return this; }
  updateProjectionMatrix() {}
  updateMatrixWorld() {}
  addEventListener() {}
}
export class Scene extends Object3D {
  constructor() { super(); this.type = 'Scene'; this.background = null; stub.scenes.push(this); }
}
export class Group extends Object3D { constructor() { super(); this.type = 'Group'; } }
export class Mesh extends Object3D {
  constructor(geometry, material) { super(); this.type = 'Mesh'; this.geometry = geometry; this.material = material; }
}
export class Color { constructor(value) { this.value = value; } setCSS() {} copy() { return this; } }
export class PerspectiveCamera extends Object3D {
  constructor(fov, aspect, near, far) { super(); this.type = 'PerspectiveCamera'; this.fov = fov; this.aspect = aspect; this.near = near; this.far = far; }
}
export class OrthographicCamera extends Object3D { constructor(...a) { super(); this.type = 'OrthographicCamera'; this.args = a; } }
export class MeshStandardMaterial { constructor(p) { Object.assign(this, p || {}); } }
export class MeshBasicMaterial { constructor(p) { Object.assign(this, p || {}); } }
export class MeshLambertMaterial { constructor(p) { Object.assign(this, p || {}); } }
export class MeshPhongMaterial { constructor(p) { Object.assign(this, p || {}); } }
export class LineBasicMaterial { constructor(p) { Object.assign(this, p || {}); } }
export class CylinderGeometry { constructor(...a) { this.type = 'CylinderGeometry'; this.args = a; } }
export class SphereGeometry { constructor(...a) { this.type = 'SphereGeometry'; this.args = a; } }
export class BoxGeometry { constructor(...a) { this.type = 'BoxGeometry'; this.args = a; } }
export class PlaneGeometry { constructor(...a) { this.type = 'PlaneGeometry'; this.args = a; } }
export class ConeGeometry { constructor(...a) { this.type = 'ConeGeometry'; this.args = a; } }
export class TorusGeometry { constructor(...a) { this.type = 'TorusGeometry'; this.args = a; } }
export class HemisphereLight extends Object3D { constructor(...a) { super(); this.type = 'HemisphereLight'; this.args = a; } }
export class DirectionalLight extends Object3D { constructor(...a) { super(); this.type = 'DirectionalLight'; this.args = a; } }
export class AmbientLight extends Object3D { constructor(...a) { super(); this.type = 'AmbientLight'; this.args = a; } }
export class PointLight extends Object3D { constructor(...a) { super(); this.type = 'PointLight'; this.args = a; } }
export class SpotLight extends Object3D { constructor(...a) { super(); this.type = 'SpotLight'; this.args = a; } }
export class Fog { constructor(...a) { this.args = a; } }
export class FogExp2 { constructor(...a) { this.args = a; } }
export class Clock {
  constructor() { this.elapsed = 0; }
  getDelta() { this.elapsed += stub.delta; return stub.delta; }
  getElapsedTime() { return this.elapsed; }
  start() { return this; }
}
export class WebGLRenderer {
  constructor(p) {
    this.params = p || {};
    this.domElement = {
      tagName: 'CANVAS', width: 300, height: 150, style: {},
      setAttribute() {}, addEventListener() {}, removeEventListener() {}, appendChild() {},
    };
    this.shadowMap = { enabled: false };
    this.info = { render: { calls: 0, triangles: 0 }, memory: {} };
  }
  setSize(w, h) { this.size = [w, h]; this.domElement.width = w; this.domElement.height = h; }
  setPixelRatio(r) { this.pixelRatio = r; }
  setClearColor() {}
  setAnimationLoop(cb) { stub.loop = cb; }
  render() { stub.renders += 1; }
  dispose() {}
  getContext() { return {}; }
}
export const MathUtils = {
  degToRad: (d) => (d * Math.PI) / 180,
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
};
export const AdditiveBlending = 2;
export const DoubleSide = 2;
export const SRGBColorSpace = 'srgb';
export const RepeatWrapping = 1000;
`;

/* ==== 5. DOM 桩（ui.js 只用到这些） ==== */

function createDom() {
  class ClassList {
    constructor() { this.items = new Set(); }
    add(...names) { for (const n of names) { if (n) this.items.add(String(n)); } }
    remove(...names) { for (const n of names) this.items.delete(String(n)); }
    contains(name) { return this.items.has(String(name)); }
    toggle(name, force) {
      const want = force === undefined ? !this.items.has(name) : !!force;
      if (want) this.items.add(String(name)); else this.items.delete(String(name));
      return want;
    }
    toString() { return Array.from(this.items).join(' '); }
  }

  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.nodeType = 1;
      this.children = [];
      this.childNodes = this.children;
      this.parentNode = null;
      this.attributes = {};
      this.style = {};
      this.id = '';
      this.type = '';
      this.disabled = false;
      this.value = '';
      this.classList = new ClassList();
      this._className = '';
      this._ownText = '';
      this._listeners = {};
    }
    get className() { return this._className; }
    set className(v) {
      this._className = v == null ? '' : String(v);
      this.classList = new ClassList();
      for (const n of this._className.split(/\s+/)) { if (n) this.classList.add(n); }
    }
    get textContent() {
      let s = this._ownText;
      for (const c of this.children) { s += c.textContent === undefined ? '' : c.textContent; }
      return s;
    }
    set textContent(v) {
      this._ownText = v == null ? '' : String(v);
      for (const c of this.children) { c.parentNode = null; }
      this.children.length = 0;
    }
    appendChild(child) { if (child == null) return null; this.children.push(child); child.parentNode = this; return child; }
    append(...nodes) {
      for (const n of nodes) {
        if (n == null) continue;
        if (Array.isArray(n)) { this.append(...n); continue; }
        if (typeof n === 'string' || typeof n === 'number') { this._ownText += String(n); continue; }
        this.appendChild(n);
      }
    }
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      if (child) child.parentNode = null;
      return child;
    }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k === 'id') this.id = String(v);
      else if (k === 'class') this.className = String(v);
    }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
    addEventListener(type, cb) { if (!this._listeners[type]) this._listeners[type] = []; this._listeners[type].push(cb); }
    removeEventListener(type, cb) {
      const l = this._listeners[type];
      if (!l) return;
      const i = l.indexOf(cb);
      if (i >= 0) l.splice(i, 1);
    }
    // 派发一个事件。跟浏览器一样：disabled 的按钮不会派发 click。
    dispatch(type) {
      if (type === 'click' && this.disabled) return 0;
      const list = (this._listeners[type] || []).slice();
      const ev = { type, target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} };
      for (const cb of list) cb(ev);
      return list.length;
    }
    focus() {}
    blur() {}
    click() { return this.dispatch('click'); }
  }

  function walk(el, fn) {
    fn(el);
    for (const c of el.children) { if (c && c.nodeType === 1) walk(c, fn); }
  }

  function matches(el, sel) {
    if (sel.charAt(0) === '.') return el.classList.contains(sel.slice(1));
    if (sel.charAt(0) === '#') return el.id === sel.slice(1);
    return el.tagName === sel.toUpperCase();
  }

  const html = new El('html');
  const head = new El('head');
  const body = new El('body');
  html.appendChild(head);
  html.appendChild(body);

  const clock = { now: 0 };
  const timers = { queue: [], nextId: 1 };
  const raf = { queue: [], nextId: 1 };
  const windowListeners = {};

  const documentStub = {};
  documentStub.documentElement = html;
  documentStub.head = head;
  documentStub.body = body;
  documentStub.title = '';
  documentStub.createElement = (tag) => new El(tag);
  documentStub.createTextNode = (text) => {
    const node = { nodeType: 3, textContent: String(text) };
    return node;
  };
  documentStub.querySelectorAll = (sel) => {
    const out = [];
    walk(html, (el) => { if (el !== html && matches(el, sel)) out.push(el); });
    return out;
  };
  documentStub.querySelector = (sel) => {
    const all = documentStub.querySelectorAll(sel);
    return all.length ? all[0] : null;
  };
  documentStub.getElementById = (id) => documentStub.querySelector('#' + id);
  documentStub.getElementsByTagName = (tag) => documentStub.querySelectorAll(tag);
  documentStub.addEventListener = () => {};
  documentStub.removeEventListener = () => {};

  function flushTimers(limit) {
    const cap = limit === undefined ? 500 : limit;
    let n = 0;
    while (n < cap) {
      const due = timers.queue.filter((t) => t.at <= clock.now).sort((a, b) => (a.at - b.at) || (a.id - b.id));
      if (!due.length) break;
      const t = due[0];
      if (t.repeat) t.at = clock.now + t.every;
      else timers.queue.splice(timers.queue.indexOf(t), 1);
      try { t.cb.apply(null, t.args); } catch (e) { /* 游戏代码里的定时器出错不影响测试继续 */ }
      n += 1;
    }
  }

  function flushRaf(limit) {
    const cap = limit === undefined ? 60 : limit;
    let n = 0;
    while (raf.queue.length && n < cap) {
      const list = raf.queue.splice(0, raf.queue.length);
      for (const cb of list) { try { cb(clock.now); } catch (e) { /* 同上 */ } }
      n += 1;
    }
  }

  const api = {
    document: documentStub,
    now: () => clock.now,
    advance: (ms) => { clock.now += ms; },
    query: (sel) => documentStub.querySelector(sel),
    queryAll: (sel) => documentStub.querySelectorAll(sel),
    flushTimers,
    flushRaf,
    windowAdd(type, cb) { if (!windowListeners[type]) windowListeners[type] = []; windowListeners[type].push(cb); },
    windowRemove(type, cb) {
      const l = windowListeners[type];
      if (!l) return;
      const i = l.indexOf(cb);
      if (i >= 0) l.splice(i, 1);
    },
    // 往 window 上派发一个事件（给 main.js 的空格监听用）。返回挂了几个监听、以及
    // 默认动作有没有被 preventDefault 拦掉 —— 后者正是"空格不会顺手点到焦点上的按钮"的凭据。
    windowDispatch(type, props) {
      const list = (windowListeners[type] || []).slice();
      const ev = Object.assign({ type, target: globalThis, currentTarget: globalThis }, props || {});
      ev.defaultPrevented = false;
      ev.preventDefault = () => { ev.defaultPrevented = true; };
      ev.stopPropagation = () => {};
      for (const cb of list) cb(ev);
      return { listeners: list.length, defaultPrevented: ev.defaultPrevented };
    },
    setTimeout: (cb, ms, ...args) => {
      const id = timers.nextId;
      timers.nextId += 1;
      timers.queue.push({ id, at: clock.now + (Number(ms) || 0), cb, args, repeat: false });
      return id;
    },
    setInterval: (cb, ms, ...args) => {
      const id = timers.nextId;
      timers.nextId += 1;
      const every = Number(ms) || 0;
      timers.queue.push({ id, at: clock.now + every, every, cb, args, repeat: true });
      return id;
    },
    clearTimeout: (id) => {
      const i = timers.queue.findIndex((t) => t.id === id);
      if (i >= 0) timers.queue.splice(i, 1);
    },
    requestAnimationFrame: (cb) => {
      const id = raf.nextId;
      raf.nextId += 1;
      raf.queue.push(cb);
      return id;
    },
    cancelAnimationFrame: (id) => { raf.queue.length = 0; },
  };
  return api;
}

function installDom(dom) {
  globalThis.document = dom.document;
  globalThis.window = globalThis;
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  globalThis.devicePixelRatio = 2;
  globalThis.addEventListener = dom.windowAdd;
  globalThis.removeEventListener = dom.windowRemove;
  globalThis.setTimeout = dom.setTimeout;
  globalThis.setInterval = dom.setInterval;
  globalThis.clearTimeout = dom.clearTimeout;
  globalThis.clearInterval = dom.clearTimeout;
  globalThis.requestAnimationFrame = dom.requestAnimationFrame;
  globalThis.cancelAnimationFrame = dom.cancelAnimationFrame;
  globalThis.performance = { now: () => dom.now() };
  globalThis.navigator = { userAgent: 'jsc-test', mediaDevices: null };
  globalThis.location = { href: 'http://localhost:8000/', search: '', hash: '' };
  globalThis.console = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
}

/* ==== 6. 加载真实文件（只改 import 路径，其余原样） ==== */

const moduleCache = new Map();
const realFileCache = new Map();

function importOnce(absPath) {
  if (!moduleCache.has(absPath)) moduleCache.set(absPath, import(absPath));
  return moduleCache.get(absPath);
}

function copyPathFor(relFile) {
  return TMP + '-copy-' + relFile.replace(/[^A-Za-z0-9]+/g, '_') + '.js';
}

function resolveSpecifier(spec, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, spec)) return overrides[spec];
  if (spec === 'three') return TMP + '-three.js';
  if (spec.charAt(0) === '/') return spec;
  if (spec.slice(0, 2) === './') return REPO + '/' + spec.slice(2);
  throw new CheckFail('jsc 解析不了裸模块 ' + fmt(spec) + '，要么给它一个桩，要么改成本地路径');
}

// 逐行只替换 import/export 语句里的路径字符串；行数、其它字节必须完全一致。
function rewriteSpecifiers(source, overrides) {
  const lines = source.split('\n');
  const out = [];
  let rewrites = 0;
  const importLine = /^(\s*(?:import|export)\b.*?\bfrom\s*)(['"])([^'"]+)\2(.*)$/;
  const bareLine = /^(\s*import\s*)(['"])([^'"]+)\2(.*)$/;
  for (const line of lines) {
    const m = importLine.exec(line) || bareLine.exec(line);
    if (!m) { out.push(line); continue; }
    const spec = m[3];
    if (spec.charAt(0) === '/' || spec === 'three') {
      out.push(m[1] + "'" + resolveSpecifier(spec, overrides) + "'" + m[4]);
      rewrites += 1;
      continue;
    }
    if (spec.slice(0, 2) !== './') {
      // 裸模块（'three/addons/…' 之类）：jsc 只有文件路径解析，得先给它一个桩，
      // 不然这行 import 会直接失败。这里是测试没跟上，不是游戏坏了。
      throw new CheckFail('这是个裸模块，测试里还没有对应的桩：' + fmt(spec) + '（在 tests/run-tests.js 的 three 桩里补上它，或把它换成相对路径）');
    }
    out.push(m[1] + "'" + resolveSpecifier(spec, overrides) + "'" + m[4]);
    rewrites += 1;
  }
  const rewritten = out.join('\n');
  if (rewritten.split('\n').length !== lines.length) {
    throw new CheckFail('改写 import 路径时弄丢了行数，说明这个改写不安全');
  }
  return { source: rewritten, rewrites };
}

// 读真文件 → 只改 import 路径 → 写 /tmp 副本。（只写，不求值：求值的时机由调用方决定，
// 因为 main.js 一求值就会碰 DOM，必须等 DOM 桩装好了再 import。）
function writeCopy(relFile, overrides) {
  const key = relFile + '|' + JSON.stringify(overrides || {});
  if (realFileCache.has(key)) return realFileCache.get(key);
  const info = (() => {
    const abs = REPO + '/' + relFile;
    const original = readFile(abs);
    const rw = rewriteSpecifiers(original, overrides || {});
    const copy = copyPathFor(relFile);
    try {
      writeFile(copy, rw.source);
    } catch (e) {
      throw new CheckFail('写不进临时副本 ' + copy + '：' + (e && e.message ? e.message : e));
    }
    return { abs, copy, rewrites: rw.rewrites, bytes: original.length };
  })();
  realFileCache.set(key, info);
  return info;
}

// 写副本并 import 它。
async function loadReal(relFile, overrides) {
  const info = writeCopy(relFile, overrides);
  const ns = await importOnce(info.copy);
  return { ...info, ns };
}

function fileExists(absPath) {
  try { readFile(absPath); return true; } catch (e) { return false; }
}

/* ==== 7. 小工具 ==== */

function walkObjects(root, fn) {
  fn(root);
  const kids = root.children || [];
  for (const kid of kids) { if (kid && kid.children) walkObjects(kid, fn); }
}

// 小兵 = 一个只装 Mesh 的 Group（棋盘那块板是 Mesh，营地也是 Mesh）。
function pawnsOf(root) {
  const found = [];
  walkObjects(root, (o) => {
    if (o.type !== 'Group' || !o.children || o.children.length === 0) return;
    if (o.children.every((c) => c.type === 'Mesh')) found.push(o);
  });
  must(found.length === 2, 'expected 场景里正好 2 枚小兵（只装 Mesh 的 Group），actual ' + found.length + ' 个');
  const player = found.filter((p) => p.position.x > 0)[0];
  const enemy = found.filter((p) => p.position.x < 0)[0];
  must(player && enemy, 'expected 两枚小兵分列中线两侧（x 一正一负），actual x = ' + found.map((p) => p.position.x).join(', '));
  return { player, enemy, all: found };
}

// 营地 = 每一侧离中线最远的那块方块（board.js：中间大格 → stepsToWin 个小格 → 营地）。
// 中线之外的方块不止两块（五个小格 + 营地），得挑最远的那个才对。
function campsOf(board) {
  const lane = board.children.filter((c) => c.type === 'Mesh' && Math.abs(c.position.z) > 0.5);
  must(lane.length >= 2, 'expected 中线之外至少有两块方块（小格和营地），actual ' + lane.length + ' 块');
  const enemy = lane.reduce((a, b) => (a.position.z <= b.position.z ? a : b));
  const player = lane.reduce((a, b) => (a.position.z >= b.position.z ? a : b));
  must(player !== enemy && player.position.z > 0 && enemy.position.z < 0,
    'expected 两侧各有一个营地，actual z = ' + lane.map((c) => c.position.z).join(', '));
  return { player, enemy };
}

// 揭晓行："You: Heavy  |  Computer: Slash → You win"（ui.js 的 showReveal）
function parseReveal(text) {
  const m = /^You:\s*(.*?)\s*\|\s*Computer:\s*(.*?)(?:\s*→\s*(.*))?$/.exec(text || '');
  if (!m) return { ok: false, raw: text };
  const playerLabel = m[1].trim();
  const aiLabel = m[2].trim();
  const resultLabel = (m[3] || '').trim();
  return {
    ok: true,
    raw: text,
    playerLabel,
    aiLabel,
    resultLabel,
    playerKey: LABEL_KEYS[playerLabel] || null,
    aiKey: LABEL_KEYS[aiLabel] || null,
    resultKey: RESULT_KEYS[resultLabel] || null,
  };
}

// ES module 没法直接喂给 checkSyntax（它按脚本解析），所以先去掉 import/export 再查一次。
function demodule(source) {
  const out = [];
  for (const line of source.split('\n')) {
    const t = line.trim();
    if (/^import\b/.test(t) && !/^import\s*\(/.test(t)) { out.push('// [test] 去模块化：删掉这行导入'); continue; }
    if (/^export\s*\{/.test(t)) { out.push('// [test] 去模块化：删掉这行导出'); continue; }
    if (/^export\s+default\b/.test(t)) return null;
    if (/^export\b/.test(t)) { out.push(line.replace(/^(\s*)export\s+/, '$1')); continue; }
    out.push(line);
  }
  return out.join('\n');
}

function syntaxCheckFile(absPath) {
  try {
    checkSyntax(absPath);
    return null;
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    if (!/Unexpected (keyword|identifier|token)/.test(msg)) return msg;
    let source;
    try { source = readFile(absPath); } catch (e2) { return msg; }
    const stripped = demodule(source);
    if (stripped === null) return 'ES module 形式（' + msg + '），且这个脚本不会处理 export default';
    const tmp = TMP + '-syntax-' + absPath.replace(/[^A-Za-z0-9]+/g, '_') + '.js';
    try { writeFile(tmp, stripped); } catch (e2) { return msg; }
    try {
      checkSyntax(tmp);
      return null;
    } catch (e2) {
      return '去掉 import/export 后仍然报语法错：' + ((e2 && e2.message) ? e2.message : String(e2));
    }
  }
}

function failOnce(what, e) {
  check(what, () => { throw e; });
}

/* ==== 8. 规则 · game.js ==== */

async function sectionRules() {
  let ns;
  let tuningForRules;
  try {
    ns = await importOnce(REPO + '/game.js');
    tuningForRules = await importOnce(REPO + '/tuning.js');
  } catch (e) {
    failOnce('规则 · 导入 game.js / tuning.js', e);
    return;
  }

  check('规则 · MOVES 三种招式齐全，MOVE_LABELS 文案正确', () => {
    eq(Array.isArray(ns.MOVES), true, 'MOVES 是不是数组');
    eq(ns.MOVES.slice().sort().join(','), KEYS.slice().sort().join(','), 'MOVES 里的招式');
    for (const key of KEYS) eq(ns.MOVE_LABELS && ns.MOVE_LABELS[key], LABELS[key], 'MOVE_LABELS.' + key);
  });

  check('规则 · 九种对局的胜负都符合「重击克快斩／快斩克护盾／护盾克重击」', () => {
    const wrong = [];
    for (const a of KEYS) {
      for (const b of KEYS) {
        const want = outcomeOf(a, b);
        const got = ns.outcome(a, b);
        if (got !== want) wrong.push(LABELS[a] + ' vs ' + LABELS[b] + ' expected ' + want + ' actual ' + got);
        const wantBeats = want === 'win';
        if (ns.beats(a, b) !== wantBeats) {
          wrong.push('beats(' + a + ',' + b + ') expected ' + wantBeats + ' actual ' + ns.beats(a, b));
        }
      }
    }
    must(wrong.length === 0, 'expected 九种对局全部对上，actual 有 ' + wrong.length + ' 处不对：' + wrong.join('；'));
  });

  check('规则 · 平局谁都不动', () => {
    for (const key of KEYS) {
      const game = ns.createGame();
      const round = game.playRound(key, key);
      eq(round.result, 'tie', LABELS[key] + ' 打 ' + LABELS[key] + ' 的结果');
      eq(round.playerSteps, 0, '平局后 playerSteps');
      eq(round.aiSteps, 0, '平局后 aiSteps');
      eq(round.winner, null, '平局后 winner');
    }
  });

  check('规则 · 赢一局，赢家从 0 走到 1', () => {
    const game = ns.createGame();
    const round = game.playRound('heavy', 'slash');
    eq(round.result, 'win', '重击打快斩的结果');
    eq(round.playerSteps, 1, '赢一局后 playerSteps');
    eq(round.aiSteps, 0, '赢一局后 aiSteps');
    eq(game.playerSteps, 1, '游戏对象上的 playerSteps');
    const lose = game.playRound('slash', 'heavy');
    eq(lose.result, 'lose', '快斩打重击的结果');
    eq(lose.aiSteps, 1, '输一局后 aiSteps');
    eq(lose.playerSteps, 1, '输一局后 playerSteps');
  });

  check('规则 · 走到 stepsToWin 就定胜负，之后再也打不动', () => {
    const steps = tuningForRules.stepsToWin;
    const game = ns.createGame();
    for (let i = 0; i < steps; i += 1) game.playRound('heavy', 'slash');
    eq(game.playerSteps, steps, '走满 stepsToWin 后的 playerSteps');
    eq(game.winner, 'player', '走满 stepsToWin 后的 winner');
    const frozen = { p: game.playerSteps, a: game.aiSteps, round: game.round };
    const after = game.playRound('slash', 'heavy'); // 这一局本来该电脑赢，但已经结算了
    eq(after.result, null, '结算后再打一局的结果');
    eq(game.playerSteps, frozen.p, '结算后 playerSteps');
    eq(game.aiSteps, frozen.a, '结算后 aiSteps');
    eq(game.round, frozen.round, '结算后 round');
    eq(game.winner, 'player', '结算后 winner');
  });

  check('规则 · 电脑走满 stepsToWin 时由电脑取胜', () => {
    const steps = tuningForRules.stepsToWin;
    const game = ns.createGame();
    for (let i = 0; i < steps; i += 1) game.playRound('slash', 'heavy');
    eq(game.aiSteps, steps, '电脑走满 stepsToWin 后的 aiSteps');
    eq(game.winner, 'ai', '电脑走满 stepsToWin 后的 winner');
  });

  check('规则 · 胜负按净胜判定：赢 5 输 2（净胜 3）还没结算，再赢到净胜 stepsToWin 才赢', () => {
    const steps = tuningForRules.stepsToWin;
    const game = ns.createGame();
    for (let i = 0; i < 2; i += 1) game.playRound('slash', 'heavy');   // 玩家先输 2 局
    for (let i = 0; i < steps; i += 1) game.playRound('heavy', 'slash'); // 玩家再赢 steps 局
    eq(game.playerSteps, steps, '玩家赢 steps 局后的 playerSteps');
    eq(game.aiSteps, 2, '玩家输 2 局后的 aiSteps');
    eq(game.playerSteps - game.aiSteps, steps - 2, '此时的净胜');
    eq(game.winner, null, '净胜 steps-2 时的 winner（原始胜场到过 steps，但净胜没到，不能结算）');
    for (let i = 0; i < steps - 3; i += 1) game.playRound('heavy', 'slash'); // 再把净胜推回 steps
    eq(game.playerSteps - game.aiSteps, steps, '补赢回净胜 steps 后的净胜');
    eq(game.winner, 'player', '净胜到 stepsToWin 时的 winner');
  });

  check('规则 · 认不出的招式不算一局，也不推进轮次', () => {
    const game = ns.createGame();
    const before = { p: game.playerSteps, a: game.aiSteps, round: game.round };
    const round = game.playRound('banana', 'heavy');
    eq(round.result, null, '非法招式的结果');
    eq(game.playerSteps, before.p, '非法招式后 playerSteps');
    eq(game.aiSteps, before.a, '非法招式后 aiSteps');
    eq(game.round, before.round, '非法招式后 round');
  });

  check('规则 · reset() 回到开局状态', () => {
    const game = ns.createGame();
    game.playRound('heavy', 'slash');
    game.playRound('shield', 'slash');
    game.reset();
    eq(game.playerSteps, 0, 'reset 后 playerSteps');
    eq(game.aiSteps, 0, 'reset 后 aiSteps');
    eq(game.round, 1, 'reset 后 round');
    eq(game.winner, null, 'reset 后 winner');
  });
}

/* ==== 9. 可调数字 · tuning.js ==== */

const TUNING_SPEC = [
  ['stepsToWin', 'number', 5],
  ['laneLength', 'number', 2],
  ['aiCounterChance', 'number', 0.5],
  ['aiMemoryRounds', 'number', 1],
  ['gestureHoldFrames', 'number', 8],
  ['revealDelay', 'number', 0.7],
  ['advanceDuration', 'number', 0.35],
  ['landFlashSeconds', 'number', 0.5],
  ['landFlashColor', 'string', '#ffd27a'],
  ['landFlashAlpha', 'number', 0.9],
  ['showButtonFallback', 'boolean', true],
];

async function sectionTuning() {
  let ns;
  try {
    ns = await importOnce(REPO + '/tuning.js');
  } catch (e) {
    failOnce('可调数字 · 导入 tuning.js', e);
    return;
  }
  for (const [name, type, value] of TUNING_SPEC) {
    check('可调数字 · ' + name + '（' + type + '，' + String(value) + '）', () => {
      must(Object.prototype.hasOwnProperty.call(ns, name), 'expected 有导出 ' + name + '，actual 没有');
      eq(typeof ns[name], type, name + ' 的类型');
      eq(ns[name], value, name + ' 的数值');
    });
  }
}

/* ==== 10. 棋盘 · board.js（three 桩） ==== */

async function sectionBoard() {
  let ctx;
  try {
    const three = await importOnce(TMP + '-three.js');
    const board = await loadReal('board.js');
    const tuning = await importOnce(REPO + '/tuning.js');
    ctx = { three, createBoard: board.ns.createBoard, tuning };
  } catch (e) {
    failOnce('棋盘 · 载入 board.js（带 three 桩）', e);
    return;
  }

  const { three, createBoard, tuning } = ctx;
  const laneLength = tuning.laneLength;
  const stepsToWin = tuning.stepsToWin;
  const advanceDuration = tuning.advanceDuration;
  const landFlashSeconds = tuning.landFlashSeconds;

  function newBoard() {
    const scene = new three.Scene();
    const board = createBoard(scene);
    must(board, 'expected createBoard(scene) 返回棋盘对象，actual ' + fmt(board));
    for (const fn of ['setSteps', 'animateAdvance', 'reset', 'update']) {
      must(typeof board[fn] === 'function', 'expected 棋盘上有 ' + fn + '()，actual ' + typeof board[fn]);
    }
    const groups = scene.children.filter((c) => c.type === 'Group');
    must(groups.length === 1, 'expected createBoard 往场景里挂了一个 Group（棋盘本身），actual ' + groups.length + ' 个');
    return { board, group: groups[0], pawns: pawnsOf(scene) };
  }

  // 推挤规则：照规格在这里独立写一遍（不 import board.js 的实现）。营地中心和 z 全部用 laneLength / stepsToWin 推。
  const campCenter = (stepsToWin + 0.5) * laneLength;
  const playerZFor = (s) => (s >= stepsToWin ? -laneLength * (stepsToWin - 1)
    : (s >= 1 ? -laneLength * (s - 1) : -laneLength * s));
  const aiZFor = (s) => -playerZFor(-s);
  const placeOf = (s) => {
    if (s >= stepsToWin) return { player: playerZFor(s), ai: -campCenter };   // 电脑被推进 -Z 端营地
    if (s <= -stepsToWin) return { player: campCenter, ai: aiZFor(s) };       // 玩家被推进 +Z 端营地
    return { player: playerZFor(s), ai: aiZFor(s) };
  };
  // 落格高亮片 = 棋盘上按加色混合画的 Mesh（board.children 里按加入顺序：先玩家、后电脑）。
  const highlightsOf = (group) => group.children.filter(
    (c) => c.type === 'Mesh' && c.material && c.material.blending === three.AdditiveBlending);

  check('棋盘 · 开局两枚小兵都站在中线上', () => {
    const { pawns } = newBoard();
    near(pawns.player.position.z, 0, '开局玩家小兵 z');
    near(pawns.enemy.position.z, 0, '开局电脑小兵 z');
    must(pawns.player.position.x !== pawns.enemy.position.x, 'expected 两枚小兵左右错开，actual x 都是 ' + pawns.player.position.x);
  });

  check('棋盘 · 玩家净胜 stepsToWin 次把电脑推进电脑营地，自己停在第 stepsToWin-1 格', () => {
    const { board, group, pawns } = newBoard();
    const camps = campsOf(group);
    near(camps.enemy.position.z, -campCenter, '电脑营地的 z（第 stepsToWin 格再往外半格）');
    for (let i = 0; i < stepsToWin; i += 1) {
      board.animateAdvance('player');
      board.update(advanceDuration * 2);
    }
    const want = placeOf(stepsToWin);
    near(pawns.player.position.z, want.player, '推满 stepsToWin 次后玩家（赢家）小兵 z');
    near(pawns.enemy.position.z, want.ai, '推满 stepsToWin 次后电脑（输家）小兵 z');
    near(pawns.enemy.position.z, camps.enemy.position.z, '电脑小兵正好被推进电脑营地中心');
  });

  check('棋盘 · 电脑净胜 stepsToWin 次把玩家推进玩家营地，自己停在第 stepsToWin-1 格', () => {
    const { board, group, pawns } = newBoard();
    const camps = campsOf(group);
    near(camps.player.position.z, campCenter, '玩家营地的 z（第 stepsToWin 格再往外半格）');
    for (let i = 0; i < stepsToWin; i += 1) {
      board.animateAdvance('ai');
      board.update(advanceDuration * 2);
    }
    const want = placeOf(-stepsToWin);
    near(pawns.enemy.position.z, want.ai, '推满 stepsToWin 次后电脑（赢家）小兵 z');
    near(pawns.player.position.z, want.player, '推满 stepsToWin 次后玩家（输家）小兵 z');
    near(pawns.player.position.z, camps.player.position.z, '玩家小兵正好被推进玩家营地中心');
  });

  check('棋盘 · setSteps 立刻对齐格子，并掐掉正在播的滑动', () => {
    const { board, pawns } = newBoard();
    board.animateAdvance('player'); // s = 1：只有电脑被顶出中间格，正在滑
    board.update(advanceDuration * 0.5);
    const mid = pawns.enemy.position.z;
    must(mid < 0 && mid > -laneLength, 'expected 滑到一半时电脑在中线到第 1 格之间，actual z=' + fmt(mid));
    board.setSteps(1, 2);
    near(pawns.player.position.z, -laneLength, 'setSteps(1,2) 后玩家小兵 z');
    near(pawns.enemy.position.z, 2 * laneLength, 'setSteps(1,2) 后电脑小兵 z');
    board.update(999);
    near(pawns.player.position.z, -laneLength, 'setSteps 之后再 update，玩家小兵 z 应该没被滑动继续推走');
    near(pawns.enemy.position.z, 2 * laneLength, 'setSteps 之后再 update，电脑小兵 z 应该没被滑动继续推走');
  });

  check('棋盘 · reset() 把两枚小兵送回中线', () => {
    const { board, pawns } = newBoard();
    board.animateAdvance('player');
    board.update(advanceDuration * 2);
    board.animateAdvance('ai');
    board.update(advanceDuration * 2);
    board.reset();
    near(pawns.player.position.z, 0, 'reset 后玩家小兵 z');
    near(pawns.enemy.position.z, 0, 'reset 后电脑小兵 z');
  });

  check('棋盘 · 连着前进也不跑偏格子', () => {
    // 每一格都滑到一半就被下一次 animateAdvance 接上，最后仍然要落在该落的地方。
    const a = newBoard();
    for (let i = 0; i < stepsToWin; i += 1) {
      a.board.animateAdvance('player');
      a.board.update(advanceDuration * 0.5);
    }
    a.board.update(advanceDuration * 2);
    near(a.pawns.player.position.z, placeOf(stepsToWin).player, '滑动中连按 stepsToWin 次后玩家小兵 z');
    near(a.pawns.enemy.position.z, placeOf(stepsToWin).ai, '滑动中连按 stepsToWin 次后电脑小兵 z（被推进营地）');

    // 一次都不刷新就按满：每一段都从当前位置出发，最后落在净胜 stepsToWin 的格子上。
    const b = newBoard();
    for (let i = 0; i < stepsToWin; i += 1) b.board.animateAdvance('ai');
    b.board.update(advanceDuration * 5);
    near(b.pawns.enemy.position.z, placeOf(-stepsToWin).ai, '一次没刷新就连按 stepsToWin 次后电脑小兵 z');
    near(b.pawns.player.position.z, placeOf(-stepsToWin).player, '一次没刷新就连按 stepsToWin 次后玩家小兵 z（被推进营地）');
  });

  check('棋盘 · 推挤规则：净胜 0→stepsToWin，每一步两枚小兵的位置', () => {
    const { board, pawns } = newBoard();
    near(pawns.player.position.z, 0, 's=0 玩家小兵 z（中间大格）');
    near(pawns.enemy.position.z, 0, 's=0 电脑小兵 z（同一格，并排）');
    for (let s = 1; s <= stepsToWin; s += 1) {
      board.animateAdvance('player');
      board.update(advanceDuration * 2);
      const want = placeOf(s);
      near(pawns.player.position.z, want.player, 's=' + s + ' 玩家小兵 z');
      near(pawns.enemy.position.z, want.ai, 's=' + s + ' 电脑小兵 z');
      if (s < stepsToWin) { // 推满那一步输家被顶进营地，间隔是半步，不在此列
        near(pawns.player.position.z - pawns.enemy.position.z, laneLength, 's=' + s + ' 两枚的间隔（恒为一格）');
        must(pawns.player.position.z !== pawns.enemy.position.z, 'expected s=' + s + ' 两枚不在同一格');
      }
    }
  });

  check('棋盘 · 推挤规则：净胜 0→-stepsToWin，每一步两枚小兵的位置', () => {
    const { board, pawns } = newBoard();
    for (let s = 1; s <= stepsToWin; s += 1) {
      board.animateAdvance('ai');
      board.update(advanceDuration * 2);
      const want = placeOf(-s);
      near(pawns.player.position.z, want.player, 's=' + -s + ' 玩家小兵 z');
      near(pawns.enemy.position.z, want.ai, 's=' + -s + ' 电脑小兵 z');
      if (s < stepsToWin) {
        near(Math.abs(pawns.enemy.position.z - pawns.player.position.z), laneLength, 's=' + -s + ' 两枚的间隔（恒为一格）');
        must(pawns.player.position.z !== pawns.enemy.position.z, 'expected s=' + -s + ' 两枚不在同一格');
      }
    }
  });

  check('棋盘 · 落格高亮：走到的格子亮起、随后淡出，reset 收掉', () => {
    const { board, group } = newBoard();
    const hls = highlightsOf(group);
    must(hls.length === 2, 'expected 棋盘上有两片落格高亮（加色混合的 Mesh），actual ' + hls.length + ' 片');
    const [playerHl, aiHl] = hls;
    const dt = 1 / 60; // 一帧一帧地推：一大步过去的话，高亮会在同一步里亮完又灭
    const run = (seconds) => { for (let t = 0; t < seconds; t += dt) board.update(dt); };

    // s = 1：只有电脑被顶出中间格、落到第 1 格，只有它那片亮。
    board.animateAdvance('player');
    run(advanceDuration + dt); // 走完这一格滑动
    must(aiHl.visible === true, 'expected 电脑落格后它那片高亮亮起');
    near(aiHl.position.z, -laneLength, '电脑落格后高亮片在它脚下的格子 z');
    must(playerHl.visible === false, 'expected 没走动的玩家那一片不亮');

    // 淡完之后收掉。
    run(landFlashSeconds + dt);
    must(aiHl.visible === false, 'expected 淡完之后高亮片收掉');

    // s = 2：这一下两枚一起动，两片一起亮在各自的格子上。
    board.animateAdvance('player');
    run(advanceDuration + dt);
    must(playerHl.visible === true && aiHl.visible === true, 'expected s=2 两枚都落格、两片都亮');
    near(playerHl.position.z, placeOf(2).player, 's=2 玩家落格高亮片的 z');
    near(aiHl.position.z, placeOf(2).ai, 's=2 电脑落格高亮片的 z');

    // reset 把高亮收掉。
    board.reset();
    must(playerHl.visible === false && aiHl.visible === false, 'expected reset 后高亮全部收掉');
  });
}

/* ==== 11. 界面 · ui.js（最小 DOM 桩） ==== */

async function sectionUi() {
  let createUI;
  try {
    const ns = await importOnce(REPO + '/ui.js');
    createUI = ns.createUI;
    must(typeof createUI === 'function', 'expected ui.js 导出 createUI()，actual ' + typeof createUI);
  } catch (e) {
    failOnce('界面 · 导入 ui.js', e);
    return;
  }

  function newUi(opts) {
    const dom = createDom();
    installDom(dom);
    const ui = createUI(opts || {});
    return { dom, ui };
  }
  const buttonsOf = (dom) => dom.queryAll('.ft-btn');
  const btnFor = (dom, key) => buttonsOf(dom).filter((b) => b.textContent.indexOf(LABELS[key]) === 0)[0];

  check('界面 · 三个按钮都在，文案跟招式对得上', () => {
    const { dom } = newUi({});
    const btns = buttonsOf(dom);
    eq(btns.length, 3, '按钮数量');
    const texts = btns.map((b) => b.textContent);
    for (const key of KEYS) {
      must(texts.some((t) => t.indexOf(LABELS[key]) === 0), 'expected 有个按钮写着「' + LABELS[key] + '」，actual 按钮文案是 ' + texts.join(' / '));
    }
  });

  check('界面 · 每个按钮点下去都用对应的招式回调 onChoose', () => {
    const picked = [];
    const { dom } = newUi({ onChoose: (key) => picked.push(key) });
    for (const key of KEYS) {
      const btn = btnFor(dom, key);
      must(btn, 'expected 找到写着「' + LABELS[key] + '」的按钮，actual 没找到');
      btn.dispatch('click');
    }
    eq(picked.join(','), KEYS.join(','), 'onChoose 依次收到的招式');
  });

  check('界面 · setEnabled(false) 挡住点击，setEnabled(true) 再放开', () => {
    const picked = [];
    const { dom, ui } = newUi({ onChoose: (key) => picked.push(key) });
    const btns = buttonsOf(dom);
    ui.setEnabled(false);
    const bar = dom.query('.ft-bar');
    must(bar, 'expected 页面上有 .ft-bar，actual 没有');
    eq(bar.classList.contains('ft-off'), true, '锁定时工具条上的 ft-off');
    eq(btns.every((b) => b.disabled === true), true, '锁定时每个按钮的 disabled');
    for (const b of btns) b.dispatch('click');
    eq(picked.length, 0, '锁定期间 onChoose 被调用的次数');
    ui.setEnabled(true);
    for (const b of btns) b.dispatch('click');
    eq(picked.length, 3, '放开后 onChoose 被调用的次数');
  });

  check('界面 · showReveal 画出「You: … | Computer: … → 结果」那一行', () => {
    const { dom, ui } = newUi({});
    ui.showReveal('heavy', 'slash', 'win');
    const el = dom.query('.ft-reveal');
    must(el, 'expected 页面上有 .ft-reveal，actual 没有');
    const text = el.textContent;
    const parsed = parseReveal(text);
    must(parsed.ok, 'expected 揭晓行是「You: … | Computer: …」，actual 「' + text + '」');
    eq(parsed.playerLabel, LABELS.heavy, '揭晓行里你出的招');
    eq(parsed.aiLabel, LABELS.slash, '揭晓行里电脑出的招');
    eq(parsed.resultKey, 'win', '赢的一局读出来的结果');
    must(text.indexOf(RESULT_LABELS.win) >= 0, 'expected 赢的一局写「' + RESULT_LABELS.win + '」，actual 「' + text + '」');
    ui.showReveal('slash', 'shield', 'lose');
    const loseText = dom.query('.ft-reveal').textContent;
    must(loseText.indexOf(RESULT_LABELS.lose) >= 0, 'expected 输的一局写「' + RESULT_LABELS.lose + '」，actual 「' + loseText + '」');
    ui.showReveal('heavy', 'heavy', 'tie');
    const tieText = dom.query('.ft-reveal').textContent;
    must(tieText.indexOf(RESULT_LABELS.tie) >= 0, 'expected 平局写「' + RESULT_LABELS.tie + '」，actual 「' + tieText + '」');
  });

  check('界面 · showReveal 遇到不认识的招式也不崩（写成 ?）', () => {
    const { dom, ui } = newUi({});
    ui.showReveal('banana', 'alsoBanana', 'weird');
    const el = dom.query('.ft-reveal');
    must(el, 'expected 页面上有 .ft-reveal，actual 没有');
    const parsed = parseReveal(el.textContent);
    must(parsed.ok, 'expected 仍然是可以读的「You: … | Computer: …」，actual 「' + el.textContent + '」');
    eq(parsed.playerLabel, '?', '认不出的招式写的字');
    eq(parsed.aiLabel, '?', '认不出的招式写的字（电脑那边）');
    must(parsed.playerKey === null && parsed.aiKey === null, 'expected 认不出的招式读不出招式名，actual ' + fmt(parsed.playerLabel) + ' / ' + fmt(parsed.aiLabel));
    eq(parsed.resultLabel, '', '认不出的结果不写结果词');
  });

  check('界面 · showWinner / hideOverlay 开关结算覆盖层', () => {
    const { dom, ui } = newUi({});
    const overlay = dom.query('.ft-overlay');
    must(overlay, 'expected 页面上有 .ft-overlay，actual 没有');
    eq(overlay.classList.contains('ft-hidden'), true, '刚建好时覆盖层是否隐藏');
    ui.showWinner('player');
    eq(overlay.classList.contains('ft-hidden'), false, 'showWinner 后覆盖层是否隐藏');
    eq(dom.query('.ft-winner').textContent, WINNER_TEXT.player, '玩家获胜的文案');
    ui.hideOverlay();
    eq(overlay.classList.contains('ft-hidden'), true, 'hideOverlay 后覆盖层是否隐藏');
    ui.showWinner('ai');
    eq(dom.query('.ft-winner').textContent, WINNER_TEXT.ai, '电脑获胜的文案');
  });

  check('界面 · showWinner 把最终比分写在结算卡片上（各赢了几轮）', () => {
    const { dom, ui } = newUi({});
    const score = dom.query('.ft-score');
    must(score, 'expected 结算卡片上有比分行（.ft-score），actual 没有');
    const card = dom.query('.ft-card');
    must(card, 'expected 页面上有 .ft-card，actual 没有');

    ui.showWinner('player', 5, 0);
    eq(dom.query('.ft-overlay').classList.contains('ft-hidden'), false, 'showWinner(5, 0) 后覆盖层是否隐藏');
    eq(dom.query('.ft-winner').textContent, WINNER_TEXT.player, '大字还是那行大字（比分没被塞进大字里）');
    eq(score.textContent, ROUNDS_LINE(5, 0), '5–0 的比分行');
    must(card.textContent.indexOf(ROUNDS_LINE(5, 0)) >= 0,
      'expected 比分写在结算卡片里，actual 卡片文字是「' + card.textContent + '」');
    eq(score.classList.contains('ft-hidden'), false, '有比分时不收起比分行');

    // 净胜到 -stepsToWin 也是"多赢几轮才收尾"，比分是两边的原始胜场，例如 2 比 7。
    ui.showWinner('ai', 2, 7);
    eq(dom.query('.ft-winner').textContent, WINNER_TEXT.ai, '电脑获胜的大字');
    eq(score.textContent, ROUNDS_LINE(2, 7), '2–7 的比分行');

    // 没传数字就整行收起来，别把上一局的比分留在卡片上。
    ui.showWinner('player');
    eq(score.textContent, '', '不传比分时比分行是空的');
    eq(score.classList.contains('ft-hidden'), true, '不传比分时比分行收起来');
  });

  check('界面 · 结算卡片上有「空格也能重开」的提示，PLAY AGAIN 按钮还在', () => {
    const { dom } = newUi({});
    const again = dom.query('.ft-again');
    must(again, 'expected 结算卡片上有 PLAY AGAIN 按钮（.ft-again），actual 没有');
    eq(again.textContent, 'PLAY AGAIN', 'PLAY AGAIN 的文案');
    eq(again.tagName, 'BUTTON', 'PLAY AGAIN 还是个按钮');

    const hint = dom.query('.ft-space-hint');
    must(hint, 'expected 结算卡片上有空格提示（.ft-space-hint），actual 没有');
    must(hint.textContent.indexOf('Space') >= 0, 'expected 提示里写着 Space，actual 「' + hint.textContent + '」');
    must(dom.query('.ft-card').textContent.indexOf(hint.textContent) >= 0, 'expected 提示就在结算卡片上');
    must(hint.tagName !== 'BUTTON', 'expected 提示是卡片上的一行字，actual 是 ' + hint.tagName);
  });
}

/* ==== 12. 接线 · main.js（three 桩 + DOM 桩） ==== */

async function wiringSetup() {
  const three = await importOnce(TMP + '-three.js');
  three.stub.reset();
  const boardCopy = (await loadReal('board.js')).copy;
  // 只写副本、先不求值：main.js 一求值就会碰 document，所以必须等 DOM 桩装好再 import 它。
  const mainCopy = writeCopy('main.js', {
    './board.js': boardCopy,
    './ui.js': REPO + '/ui.js',
    './game.js': TMP + '-game-probe.js',
  }).copy;

  const dom = createDom();
  installDom(dom);
  const mainModule = await importOnce(mainCopy); // 导入即执行 main.js 的顶层代码
  must(dom.queryAll('.ft-btn').length === 3,
    'expected main.js 求值时把界面建在这个 DOM 桩上（3 个按钮），actual ' + dom.queryAll('.ft-btn').length + ' 个');

  const probe = await importOnce(TMP + '-game-probe.js');
  const tuning = await importOnce(REPO + '/tuning.js');

  const game = probe.probeGame.last;
  must(game, 'expected main.js 用 game.js 的 createGame() 开一局，actual 没拦到 game 对象');
  const scene = three.stub.scenes[three.stub.scenes.length - 1];
  must(scene, 'expected main.js 建了一个 THREE.Scene，actual 没拦到');
  must(typeof three.stub.loop === 'function', 'expected main.js 用 renderer.setAnimationLoop 跑主循环，actual stub.loop 是 ' + typeof three.stub.loop);
  const pawns = pawnsOf(scene);
  return { three, dom, probe, tuning, game, scene, pawns, mainModule };
}

async function sectionWiring() {
  const savedRandom = Math.random;
  let ctx = null;
  try {
    Math.random = () => 0; // 让电脑那一下（占位随机出招）每次都一样，测试才有得比
    try {
      ctx = await wiringSetup();
    } catch (e) {
      failOnce('接线 · 搭台（DOM 桩 + main.js 副本）', e);
      return;
    }

    const { three, dom, game, pawns, tuning } = ctx;
    const laneLength = tuning.laneLength;
    const stepsToWin = tuning.stepsToWin;
    // 推挤规则（board.js 的 place）：净胜 s 时两枚小兵该站的 z。全部用 laneLength / stepsToWin 推。
    const campCenter = (stepsToWin + 0.5) * laneLength;
    const playerZFor = (s) => (s >= stepsToWin ? -laneLength * (stepsToWin - 1)
      : (s >= 1 ? -laneLength * (s - 1) : -laneLength * s));
    const aiZFor = (s) => -playerZFor(-s);
    const placeOf = (s) => {
      if (s >= stepsToWin) return { player: playerZFor(s), ai: -campCenter };   // 电脑被推进 -Z 端营地
      if (s <= -stepsToWin) return { player: campCenter, ai: aiZFor(s) };       // 玩家被推进 +Z 端营地
      return { player: playerZFor(s), ai: aiZFor(s) };
    };
    const netOf = () => game.playerSteps - game.aiSteps;
    const step = (frames, dt) => {
      const d = dt === undefined ? 1 / 30 : dt;
      for (let i = 0; i < frames; i += 1) {
        dom.advance(d * 1000);
        three.stub.delta = d;
        if (typeof three.stub.loop === 'function') three.stub.loop();
        else dom.flushRaf();
        dom.flushTimers();
      }
    };
    const settle = () => step(45, 1 / 30); // 一秒半的虚拟时间，够走完前进动画和揭晓延时
    const buttons = () => dom.queryAll('.ft-btn');
    const btnFor = (key) => buttons().filter((b) => b.textContent.indexOf(LABELS[key]) === 0)[0];
    const revealText = () => {
      const el = dom.query('.ft-reveal');
      return el ? el.textContent : '';
    };
    const overlay = () => dom.query('.ft-overlay');
    const overlayHidden = () => {
      const el = overlay();
      must(el, 'expected 页面上有 .ft-overlay，actual 没有');
      return el.classList.contains('ft-hidden');
    };

    check('接线 · 开局：两枚小兵在中线，覆盖层藏着，按钮能点', () => {
      near(pawns.player.position.z, 0, '开局玩家小兵 z');
      near(pawns.enemy.position.z, 0, '开局电脑小兵 z');
      eq(game.playerSteps, 0, '开局 game.playerSteps');
      eq(game.aiSteps, 0, '开局 game.aiSteps');
      eq(game.round, 1, '开局 game.round');
      eq(game.winner, null, '开局 game.winner');
      eq(overlayHidden(), true, '开局覆盖层是否隐藏');
      eq(buttons().length, 3, '按钮数量');
      eq(buttons().filter((b) => b.disabled).length, 0, '开局被禁用的按钮数');
    });

    const rounds = [];
    let problem = null;
    // 电脑开局手上没历史，Math.random=0 时它先出 Heavy；之后它每轮反制我上一招。
    // 所以先出 Shield 赢它，之后每轮出「能压住电脑反制我上一招」的那一招（= BEATS[上一招]），一路赢到净胜 stepsToWin。
    let nextKey = 'shield';

    check('接线 · 一轮轮出招到分出胜负：小兵位置 / 轮次 / 揭晓行每一步都对得上', () => {
      const maxRounds = stepsToWin * 4;
      for (let i = 0; i < maxRounds && game.winner === null; i += 1) {
        const before = { p: game.playerSteps, a: game.aiSteps, round: game.round };
        const playerKey = nextKey;
        const btn = btnFor(playerKey);
        if (!btn) { problem = 'expected 找到写着「' + LABELS[playerKey] + '」的按钮，actual 没找到'; break; }
        btn.dispatch('click');
        settle();

        const text = revealText();
        const parsed = parseReveal(text);
        if (!parsed.ok) { problem = 'expected 揭晓行是「You: … | Computer: …」，actual 「' + text + '」'; break; }
        if (parsed.playerKey !== playerKey) {
          problem = 'expected 揭晓行里你出的是 ' + LABELS[playerKey] + '，actual ' + parsed.playerLabel;
          break;
        }
        if (!parsed.aiKey) { problem = 'expected 揭晓行里电脑出的是三种招式之一，actual ' + parsed.aiLabel; break; }
        const wantResult = outcomeOf(playerKey, parsed.aiKey);
        if (parsed.resultKey !== wantResult) {
          problem = 'expected 这一局的结果是 ' + RESULT_LABELS[wantResult] + '，actual ' + (parsed.resultLabel || '（没写）');
          break;
        }
        const wantP = before.p + (wantResult === 'win' ? 1 : 0);
        const wantA = before.a + (wantResult === 'lose' ? 1 : 0);
        if (game.playerSteps !== wantP || game.aiSteps !== wantA) {
          problem = 'expected 步数是 ' + wantP + '/' + wantA + '，actual ' + game.playerSteps + '/' + game.aiSteps;
          break;
        }
        if (game.round !== before.round + 1) {
          problem = 'expected 轮次变成 ' + (before.round + 1) + '，actual ' + game.round;
          break;
        }
        if (Math.abs(pawns.player.position.z - placeOf(netOf()).player) > 1e-9) {
          problem = 'expected 玩家小兵 z = ' + placeOf(netOf()).player + '，actual ' + pawns.player.position.z;
          break;
        }
        if (Math.abs(pawns.enemy.position.z - placeOf(netOf()).ai) > 1e-9) {
          problem = 'expected 电脑小兵 z = ' + placeOf(netOf()).ai + '，actual ' + pawns.enemy.position.z;
          break;
        }
        rounds.push({ playerKey, aiKey: parsed.aiKey, result: wantResult });
        nextKey = BEATS[playerKey]; // 下一轮出能压住「电脑反制我这一招」的那一招 → 一路赢下去
      }
      if (problem) throw new CheckFail(problem);
      must(game.winner !== null, 'expected ' + maxRounds + ' 轮内有人走满 stepsToWin=' + stepsToWin + '，actual 打了 ' + rounds.length + ' 轮还没分出胜负');
    });

    check('接线 · 分出胜负：game.winner、结算文案和小兵的终点一致', () => {
      must(game.winner !== null, 'expected 有人赢了，actual winner=' + fmt(game.winner));
      eq(overlayHidden(), false, '结算后覆盖层是否隐藏');
      const winnerEl = dom.query('.ft-winner');
      must(winnerEl, 'expected 页面上有 .ft-winner，actual 没有');
      eq(game.winner, 'player', 'winner（一路压着打，应该由玩家赢）');
      eq(winnerEl.textContent, WINNER_TEXT.player, '结算文案');
      eq(netOf(), stepsToWin, '获胜后的净胜');
      eq(game.playerSteps, stepsToWin, '获胜后的 playerSteps（一路赢，没输过）');
      // 结算卡片上不只有大字，还有最终比分：一路赢下来就是 stepsToWin 比 0。
      const scoreEl = dom.query('.ft-score');
      must(scoreEl, 'expected 结算卡片上有比分行（.ft-score），actual 没有');
      eq(scoreEl.textContent, ROUNDS_LINE(stepsToWin, 0), '结算卡片上的最终比分');
      const want = placeOf(stepsToWin);
      near(pawns.player.position.z, want.player, '获胜后玩家（赢家）小兵 z（停在第 stepsToWin-1 格）');
      near(pawns.enemy.position.z, want.ai, '获胜后电脑（输家）小兵 z');
      near(pawns.enemy.position.z, -campCenter, '电脑小兵正好被推进电脑营地中心');
    });

    check('接线 · 结算后再点按钮：招发不出去，小兵也不动', () => {
      const before = {
        p: game.playerSteps, a: game.aiSteps, round: game.round,
        pz: pawns.player.position.z, az: pawns.enemy.position.z,
      };
      for (const b of buttons()) b.dispatch('click');
      settle();
      eq(buttons().filter((b) => !b.disabled).length, 0, '结算后还允许点的按钮数');
      // 就算界面失手没禁用，main.js 自己也该挡住这一下
      for (const b of buttons()) b.disabled = false;
      for (const b of buttons()) b.dispatch('click');
      settle();
      eq(game.playerSteps, before.p, '结算后再点，playerSteps');
      eq(game.aiSteps, before.a, '结算后再点，aiSteps');
      eq(game.round, before.round, '结算后再点，round');
      eq(pawns.player.position.z, before.pz, '结算后再点，玩家小兵 z');
      eq(pawns.enemy.position.z, before.az, '结算后再点，电脑小兵 z');
    });

    // 键盘重开：结算卡片亮着的时候，空格 = 点 PLAY AGAIN。走的是同一条 onRestart。
    check('接线 · 结算卡片亮着时按空格：整局回到开局', () => {
      eq(overlayHidden(), false, '按空格前覆盖层是否隐藏（得先是结算画面）');
      const space = dom.windowDispatch('keydown', { key: ' ' });
      must(space.listeners > 0, 'expected main.js 在 window 上挂了 keydown 监听，actual 挂了 ' + space.listeners + ' 个');
      eq(game.winner, null, '按空格重开后的 game.winner');
      eq(game.playerSteps, 0, '按空格重开后的 playerSteps');
      eq(game.aiSteps, 0, '按空格重开后的 aiSteps');
      eq(game.round, 1, '按空格重开后的 round');
      eq(overlayHidden(), true, '按空格重开后覆盖层是否隐藏');
      eq(revealText(), '', '按空格重开后揭晓行清空（上一局的 "You: … → You win" 不该留着）');
      near(pawns.player.position.z, 0, '按空格重开后玩家小兵 z');
      near(pawns.enemy.position.z, 0, '按空格重开后电脑小兵 z');
      eq(buttons().filter((b) => b.disabled).length, 0, '按空格重开后被禁用的按钮数');
    });

    check('接线 · 点 PLAY AGAIN：状态和两枚小兵都回到开局', () => {
      const again = dom.query('.ft-again');
      must(again, 'expected 结算覆盖层里有 PLAY AGAIN 按钮（.ft-again），actual 没有');
      again.dispatch('click');
      settle();
      eq(game.winner, null, '重开后的 game.winner');
      eq(game.playerSteps, 0, '重开后的 playerSteps');
      eq(game.aiSteps, 0, '重开后的 aiSteps');
      eq(game.round, 1, '重开后的 round');
      near(pawns.player.position.z, 0, '重开后玩家小兵 z');
      near(pawns.enemy.position.z, 0, '重开后电脑小兵 z');
      eq(overlayHidden(), true, '重开后覆盖层是否隐藏');
      eq(buttons().filter((b) => b.disabled).length, 0, '重开后被禁用的按钮数');
    });

    // 重开之后再玩一轮，确认是真的能接着玩
    check('接线 · 重开之后还能再出招', () => {
      const btn = btnFor('heavy');
      must(btn, 'expected 重开后还能找到「' + LABELS.heavy + '」按钮，actual 没找到');
      btn.dispatch('click');
      settle();
      eq(game.round, 2, '重开后再出招的 round');
      must(game.playerSteps + game.aiSteps >= 0, 'expected 步数正常，actual ' + game.playerSteps + '/' + game.aiSteps);
      const parsed = parseReveal(revealText());
      must(parsed.ok, 'expected 揭晓行读得出来，actual 「' + revealText() + '」');
      eq(parsed.playerKey, 'heavy', '重开后再出招，揭晓行里你出的招');
    });

    // 负例：正常一局里按空格什么都不做 —— 不出招，也不把打到一半的这一局重开。
    check('接线 · 一局途中按空格：不出招、不重开', () => {
      const before = {
        p: game.playerSteps, a: game.aiSteps, round: game.round,
        pz: pawns.player.position.z, az: pawns.enemy.position.z, reveal: revealText(),
      };
      const space = dom.windowDispatch('keydown', { key: ' ' });
      must(space.listeners > 0, 'expected main.js 在 window 上挂了 keydown 监听，actual 挂了 ' + space.listeners + ' 个');
      // 这一条是关键：不 preventDefault 的话浏览器会把空格当成"点一下焦点上的出招按钮"，
      // 而 launcher.js 开局就把焦点放在第一个出招按钮上，于是按空格就白出一招。
      eq(space.defaultPrevented, true, '空格有没有被 preventDefault 拦掉');
      settle();
      eq(game.round, before.round, '按空格后 round 有没有变');
      eq(game.playerSteps, before.p, '按空格后 playerSteps');
      eq(game.aiSteps, before.a, '按空格后 aiSteps');
      eq(pawns.player.position.z, before.pz, '按空格后玩家小兵 z');
      eq(pawns.enemy.position.z, before.az, '按空格后电脑小兵 z');
      eq(overlayHidden(), true, '按空格后覆盖层是否隐藏');
      eq(revealText(), before.reveal, '按空格后揭晓行有没有被动过（动了就说明这一下打出了一招）');
    });

    check('接线 · 锁定后还没揭晓时按空格：这一轮照常打完，不被掐掉重开', () => {
      const before = { p: game.playerSteps, a: game.aiSteps, round: game.round };
      const btn = btnFor('heavy');
      must(btn, 'expected 找到「' + LABELS.heavy + '」按钮，actual 没找到');
      btn.dispatch('click'); // 进入 locked：这一轮已经压上了
      const space = dom.windowDispatch('keydown', { code: 'Space' });
      eq(space.defaultPrevented, true, '空格有没有被 preventDefault 拦掉');
      settle();
      const parsed = parseReveal(revealText());
      must(parsed.ok, 'expected 这一轮的揭晓行读得出来，actual 「' + revealText() + '」');
      eq(parsed.playerKey, 'heavy', '这一轮出的招');
      eq(game.round, before.round + 1, '这一轮结算后的 round（被空格重开的话会退回 1）');
      eq(overlayHidden(), true, '覆盖层仍然是藏着的（没被当成结算画面）');
    });
  } finally {
    Math.random = savedRandom;
  }
}

/* ==== 13. AI · ai.js（没有就 SKIP） ==== */

async function sectionAi() {
  const aiPath = REPO + '/ai.js';
  if (!fileExists(aiPath)) {
    skip('AI · ai.js 还没有（M2 之前），跳过');
    return;
  }
  let ctx;
  try {
    const ns = await importOnce(aiPath);
    must(typeof ns.createAi === 'function', 'expected ai.js 导出 createAi()，actual ' + typeof ns.createAi);
    ctx = { ai: ns.createAi() };
  } catch (e) {
    failOnce('AI · 导入 ai.js', e);
    return;
  }
  const savedRandom = Math.random;
  try {
    Math.random = () => 0; // 0 < aiCounterChance(0.5)：一定走「反制上一招」那一路
    for (const key of KEYS) {
      check('AI · 你老出' + LABELS[key] + '，电脑就反制出' + LABELS[COUNTER[key]], () => {
        const got = ctx.ai.choose([key]);
        eq(got, COUNTER[key], 'choose([' + key + '])');
      });
    }
    check('AI · 没有历史、或历史里是看不懂的招式时，照样返回合法招式', () => {
      const empty = ctx.ai.choose([]);
      must(KEYS.indexOf(empty) >= 0, 'expected heavy/slash/shield 之一，actual ' + fmt(empty));
      const junk = ctx.ai.choose(['banana', null, 42]);
      must(KEYS.indexOf(junk) >= 0, 'expected heavy/slash/shield 之一，actual ' + fmt(junk));
    });
  } finally {
    Math.random = savedRandom;
  }
}

/* ==== 14. 手势 · gesture.js（只看语法和有没有静态拉 CDN，绝不调 start()） ==== */

async function sectionGesture() {
  const gesturePath = REPO + '/gesture.js';

  check('手势 · gesture.js 语法检查通过（checkSyntax，ES module 会先去模块化再查一次）', () => {
    const reason = syntaxCheckFile(gesturePath);
    must(reason === null, 'expected 语法检查通过，actual ' + reason);
  });

  let ns = null;
  let importError = null;
  try {
    ns = await importOnce(gesturePath); // 顶层没有副作用；MediaPipe 只在 start() 里动态载入，这里不碰
  } catch (e) {
    importError = e;
  }

  check('手势 · 能作为真模块导入，并导出 createGestureInput()', () => {
    must(!importError, 'expected 导入 gesture.js 成功，actual ' + ((importError && importError.message) ? importError.message : String(importError)));
    eq(typeof ns.createGestureInput, 'function', 'gesture.js 的 createGestureInput');
  });

  check('手势 · 没有在顶层静态 import 那个 CDN（CDN 只能出现在 start() 的动态 import 里）', () => {
    const source = readFile(gesturePath);
    const cdn = [];
    const staticCdn = [];
    source.split('\n').forEach((line, i) => {
      const t = line.trim();
      if (/['"]https?:\/\//.test(t)) {
        cdn.push((i + 1) + ': ' + t);
        if (/^(import|export)\b/.test(t)) staticCdn.push((i + 1) + ': ' + t);
      }
    });
    must(staticCdn.length === 0, 'expected 顶层没有 import ... from "https://"，actual 有 ' + staticCdn.join('；'));
    must(cdn.length > 0, 'expected gesture.js 里还能看到那个 CDN 地址，actual 一行都没有（识别功能可能被删了）');
    must(/import\s*\(\s*VISION_MODULE\s*\)/.test(source), 'expected CDN 是用 import(VISION_MODULE) 动态载入的，actual 找不到那处动态导入');
  });
}

/* ==== 15. 跑起来 ==== */

const PROBE_SRC = [
  '// 由 tests/run-tests.js 生成：包住真 game.js，让测试能读到 main.js 正在用的那一个 game 对象。',
  "export * from '" + REPO + "/game.js';",
  "import { createGame as createGameReal } from '" + REPO + "/game.js';",
  'export const probeGame = { all: [], last: null };',
  'export function createGame(...args) {',
  '  const game = createGameReal(...args);',
  '  probeGame.last = game;',
  '  probeGame.all.push(game);',
  '  return game;',
  '}',
].join('\n');

async function main() {
  print('Fingertip Tactics 测试 — tests/run-tests.js（jsc）');
  print('每次运行都现读仓库里的真文件：tuning/game/ai/gesture/ui 直接导入，board/main 只把 import 路径改成本地桩。');

  try {
    writeFile(TMP + '-three.js', THREE_STUB_SRC);
    writeFile(TMP + '-game-probe.js', PROBE_SRC);
  } catch (e) {
    throw new CheckFail('写不进临时桩文件（' + TMP + '-*）：' + ((e && e.message) ? e.message : String(e)));
  }

  section('规则 · game.js');
  await sectionRules();

  section('可调数字 · tuning.js');
  await sectionTuning();

  section('棋盘 · board.js（three 桩）');
  await sectionBoard();

  section('界面 · ui.js（DOM 桩）');
  await sectionUi();

  section('接线 · main.js（three 桩 + DOM 桩）');
  await sectionWiring();

  section('AI · ai.js');
  await sectionAi();

  section('手势 · gesture.js');
  await sectionGesture();
}

try {
  await main();
} catch (e) {
  failOnce('运行器 · 整体执行', e);
}

print('');
print(passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  // 这个 jsc 里 quit(1) 的退出码还是 0，只能靠抛异常拿非零退出码。
  throw new Error(failed + ' 项检查没通过');
}
