// Every tunable number for Fingertip Tactics, in one place. Constants only, no logic.

export const stepsToWin = 5;        // 要赢几次才获胜：从中间大格出发，走到第 5 格就多走半步踏进对方营地
export const laneLength = 2;        // 一格的长度，世界单位（board.js 用它摆小兵）
export const aiCounterChance = 0.5; // 电脑反制你上一轮招式的概率（M2 的 ai.js 用）
export const aiMemoryRounds = 1;    // 电脑往回看几轮
export const gestureHoldFrames = 8; // 手势连续多少帧才锁定（M2 的 gesture.js 用）
export const revealDelay = 0.7;     // 锁定后到揭晓之间停多久，秒
export const advanceDuration = 0.35; // 小兵滑到下一格的动画时长，秒
// —— 落格高亮：小兵走到一格停下时，脚下那格短暂亮起再柔和淡出 ——
export const landFlashSeconds = 0.5; // 高亮从亮起到淡完的时长，秒
export const landFlashColor = '#ffd27a'; // 高亮片的颜色：跟吊灯同一个暖金（加色混合上去，像"亮起来"）
export const landFlashAlpha = 0.9;  // 高亮片最亮时的透明度（0..1，加色混合，越接近 1 越亮）
export const showButtonFallback = true; // 是否显示屏幕按钮备用输入
export const useModels = true;      // 棋盘/棋子是否用 assets/*.glb；false = 只走方块那套（一键切回去对比）

// —— 棋子（Tripo 骑士，两枚同模、染色区分）——
// 骑士原始尺寸 0.91452(x) × 0.975647(y) × 0.662506(z)，两枚站在 x = ±0.6（间距 1.2）。
// 硬底线是两枚之间留 0.15 的缝 ⇒ x 宽 ≤ 1.05 ⇒ 缩放 ≤ 1.148；1.14 缩完 x 宽 1.0426、缝 0.157，取"尽量大又不贴脸"。
export const pawnScale = 1.14;      // 骑士模型缩放（1 = 原始大小）
export const pawnKeepTexture = false; // true = 骑士自己的贴图 + color 染色；false = 丢掉贴图改纯色材质（更像方块那套）
export const pawnTint = { player: '#b4562f', ai: '#3f6f9c' }; // 沿用两端营地的暖橙 / 冷蓝，两军一眼分得开
