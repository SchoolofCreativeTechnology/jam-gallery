# Devlog

Your record of the jam, in your words. The devlog terminal (`claude --agent devlog`) helps you write it; you decide what goes in. On a team, initials show who decided.

## Entries

Format for each change (one change per entry):

### HH:MM: short title
- **Changed:**
- **Expected:**
- **Saw:**
- **Decided, and why (who):**

Format for each milestone check-in (M1 to M5):

### HH:MM: M# check-in
- **Expected:**
- **Saw when we played it:**
- **Next (who decided):**

Format for each playtest (after M2 and after M3):

### HH:MM: Playtest N
- **Their story:**
- **Bored or stuck:**
- **What we'll change (who decided):**

### 15:51: 三种手势测试，按钮验证比赛版一轮结算
- **Changed:** 在 Mac Chrome 测试握拳、比 V、张掌三种手势；用按钮验证比赛版的一轮结算。
- **Expected:** didn't predict
- **Saw:** 三种手势都测过；比赛版一轮结算已用按钮验证。
- **Decided, and why (who):** Gesture test run by LYX. Decided by ZJP. Why: iteration.

### 15:54: Two rounds of our own testing: gestures and the button round
- **Changed:** Two rounds of our own testing, not a cross-team playtest. Mac Chrome gesture test page, the standalone prototype, and the jam build.
- **Expected:** didn't predict
- **Saw:** The gesture test page recognized a fist, a V sign, and an open palm. In the standalone prototype, gestures triggered rounds. In the jam build, we completed one round using the on-screen buttons.
- **Decided, and why (who):** Feature changes from these rounds are recorded below as team decisions.

### 15:52: M1 check-in
- **Expected:** 桌面上有棋盘、两个营地、两枚小兵；屏幕按钮能出三种招，小兵按胜负前进；一键重开。
- **Saw when we played it:** 待确认
- **Next (who decided):** M2，电脑暗选一招 + 摄像头手势（待确认：谁决定）

### 15:52: M2 check-in
- **Expected:** 电脑先暗选一招，我锁定后一起揭晓；三格到营地就结算。
- **Saw when we played it:** 待确认
- **Next (who decided):** M3，数字放进 `tuning.js`，出招和揭晓要有反馈（待确认：谁决定）

### 15:52: M3 check-in
- **Expected:** 数字都在 `tuning.js` 里能调；出招和揭晓有明确反馈（谁赢、为什么赢）。
- **Saw when we played it:** 待确认
- **Next (who decided):** M4，酒馆的光和桌子、模型、音效，规则冻结（待确认：谁决定）

### 15:52: M4 check-in
- **Expected:** 酒馆的光和桌子、小兵与营地的形状、音效。规则冻结。
- **Saw when we played it:** 待确认
- **Next (who decided):** M5，`JUDGING.md` 自检和 `/jam-ship`（待确认：谁决定）

### 15:52: M5 check-in
- **Expected:** `JUDGING.md` 自检走完，`/jam-ship`。
- **Saw when we played it:** 待确认
- **Next (who decided):** 待确认

### 15:55: Pawn movement: the winner advances and pushes the losing pawn back
- **Changed:** Changed pawn movement so the winner advances and pushes the losing pawn back.
- **Expected:** didn't predict
- **Saw:** 玩法循环
- **Decided, and why (who):** Team decision. Why: to let the win or loss show directly on the front line, and to iterate the gameplay and the loop (who: LYX and ZJP, decided together).

### 15:55: Tile highlight for where a pawn lands
- **Changed:** Added a tile highlight that shows where a pawn lands.
- **Expected:** didn't predict
- **Saw:** 玩法循环
- **Decided, and why (who):** Team decision. Why: to iterate the gameplay and the loop (who: LYX and ZJP, decided together).

### 15:55: Prompt to lower your hand before the next gesture
- **Changed:** Added a prompt to lower your hand before making the next gesture.
- **Expected:** didn't predict
- **Saw:** 玩法循环
- **Decided, and why (who):** Team decision. Why: to iterate the gameplay and the loop (who: LYX and ZJP, decided together).

## Reflection

*At the end: What did you decide that Claude didn't? What did you reject from Claude, and why? What would you do with another jam session?*

我们在 Mac Chrome 测过握拳、比 V 和张掌，也用按钮验证了比赛版的一轮结算。我们把棋子各走各的改成赢家前进、输家后退，让战线变化更清楚。

我们决定采用推挤规则，让胜负直接体现在战线上。我们保留自建棋盘，因为 Tripo 棋盘的格距和走位对不上。下次会更早做完整手势试玩。

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*

Claude Code 协助开发和测试，并编写 Blender 脚本生成棋盘。ChatGPT 生成封面。Tripo 生成骑士。

AI 生成的游戏文件：`assets/board.glb`（Blender 脚本，Claude Code 编写）、`assets/fingertip-tactics-cover.jpg`（ChatGPT）、`assets/tripo/tripo-pawn.glb`（Tripo）。

Tripo 和 ChatGPT 的授权档位与条款：not sure yet。
