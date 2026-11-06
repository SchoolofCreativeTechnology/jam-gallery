// Turn rules and win condition for Fingertip Tactics. Pure logic: this file never touches the screen.
import { stepsToWin } from './tuning.js';

export const MOVES = ['heavy', 'slash', 'shield'];
export const MOVE_LABELS = { heavy: 'Heavy', slash: 'Slash', shield: 'Shield' };

// 重击克快斩，快斩克护盾，护盾克重击。
const BEATS = { heavy: 'slash', slash: 'shield', shield: 'heavy' };

// True when move a beats move b. Unknown moves beat nothing.
export function beats(a, b) {
  return BEATS[a] === b;
}

// 'win' | 'lose' | 'tie' from the player's view.
export function outcome(playerMove, aiMove) {
  if (beats(playerMove, aiMove)) return 'win';
  if (beats(aiMove, playerMove)) return 'lose';
  return 'tie';
}

// One game: two win counts, a round number, and a winner or null.
// This is the object main.js reads (game.playerSteps, game.winner), so it is always the same object.
export function createGame() {
  const game = {
    playerSteps: 0, // 玩家赢过的局数（原始计数，不是净胜）
    aiSteps: 0,     // 电脑赢过的局数（原始计数，不是净胜）
    round: 1,
    winner: null,

    // Play one round with both moves already revealed. 谁赢就把对方的小兵往后推（推挤规则在 board.js 里画），
    // on a tie or an unknown move nobody moves. Returns { result, playerSteps, aiSteps, winner },
    // where result is null when no round was played (bad move, or the game is already over).
    playRound(playerMove, aiMove) {
      if (!game.winner && MOVES.includes(playerMove) && MOVES.includes(aiMove)) {
        const result = outcome(playerMove, aiMove);
        if (result === 'win') game.playerSteps += 1;
        if (result === 'lose') game.aiSteps += 1;
        // 胜负按净胜 s = 玩家赢过的局数 − 电脑赢过的局数 判定（不是各自赢的原始次数）：
        // 谁把对方推满 stepsToWin 格谁赢。所以"赢 5 输 2"（净胜 3）还不到结算。
        const net = game.playerSteps - game.aiSteps;
        if (net >= stepsToWin) game.winner = 'player';
        else if (net <= -stepsToWin) game.winner = 'ai';
        game.round += 1;
        return { result, playerSteps: game.playerSteps, aiSteps: game.aiSteps, winner: game.winner };
      }
      // Nothing changed: the game is over, or one of the moves was not heavy/slash/shield.
      return { result: null, playerSteps: game.playerSteps, aiSteps: game.aiSteps, winner: game.winner };
    },

    // Back to the opening state: both at the midline, round 1, no winner.
    reset() {
      game.playerSteps = 0;
      game.aiSteps = 0;
      game.round = 1;
      game.winner = null;
      return game;
    },
  };
  return game;
}
