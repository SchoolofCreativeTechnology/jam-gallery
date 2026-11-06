// 电脑的暗选逻辑：按概率反制玩家最近出过的招（纯逻辑，这文件永远不碰画面）。
import { MOVES, beats } from './game.js';
import { aiCounterChance, aiMemoryRounds } from './tuning.js';

// 反制招式：在三种招里找出唯一能打赢 move 的那一招（胜负关系只从 game.js 的 beats 来）。
function counterOf(move) {
  for (const candidate of MOVES) {
    if (beats(candidate, move)) return candidate;
  }
  return null;
}

// 均匀随机一招。
function randomMove() {
  return MOVES[Math.floor(Math.random() * MOVES.length)];
}

// 窗口里最常出现的合法招式；次数并列时取更近的那一招。
function mostFrequent(window) {
  let best = null;
  let bestCount = 0;
  const counts = new Map();
  for (const move of window) {
    const count = (counts.get(move) || 0) + 1;
    counts.set(move, count);
    if (count >= bestCount) {
      bestCount = count; // >= 让并列时后出现的（也就是更近的）那一招取胜
      best = move;
    }
  }
  return best;
}

// 玩家历史上最近的 memoryRounds 招里，最常出的那一招；看不出来就返回 null。
function readPlayerTell(playerHistory, memoryRounds) {
  if (!Array.isArray(playerHistory) || playerHistory.length === 0) return null;
  const recent = playerHistory.slice(-memoryRounds).filter((move) => MOVES.includes(move));
  return recent.length === 0 ? null : mostFrequent(recent);
}

// 一种棋风：同一个 ai 就是一套配置，出招只看传进来的历史，不偷偷记别的。
export function createAi() {
  const ai = {
    // playerHistory: 玩家出过的招，最早的在前。返回 'heavy' | 'slash' | 'shield'。
    choose(playerHistory) {
      // 每次出招都现读 tuning.js（改完刷新即生效）；数值是坏的（NaN、负数…）就退化成纯随机，绝不抛错。
      const chance = aiCounterChance;
      const canCounter = Number.isFinite(chance) && chance > 0 && Math.random() < chance;
      if (!canCounter) return randomMove();

      const memoryRounds =
        Number.isFinite(aiMemoryRounds) && aiMemoryRounds >= 1 ? Math.floor(aiMemoryRounds) : 0;
      if (memoryRounds === 0) return randomMove();

      const tell = readPlayerTell(playerHistory, memoryRounds);
      return (tell && counterOf(tell)) || randomMove();
    },

    // 回到开局状态。这里不留任何暗牌，所以只需要把「没有记忆」这件事说清楚。
    reset() {
      return ai;
    },
  };
  return ai;
}
