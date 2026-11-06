// 出招按钮、状态行、揭晓文字、结算覆盖层，以及"放下手再比一次"的抬手提示条 —— 纯 DOM，不碰 three.js。
// 自己的 DOM 和样式都由这个文件注入，index.html 只需要有 <body>。

const MOVES = {
  heavy: { label: 'Heavy', hand: 'Fist' },
  slash: { label: 'Slash', hand: 'V-sign' },
  shield: { label: 'Shield', hand: 'Open palm' },
};
const MOVE_KEYS = ['heavy', 'slash', 'shield'];

const RESULTS = { win: 'You win', lose: 'Computer wins', tie: 'Tie' };

// 抬手提示条的两句话（界面上所有文字都是英文）。
const ARM_TEXT = {
  lower: 'Lower your hand, then sign again', // 刚锁完一招，得先放下手
  ready: 'Ready — make your sign',           // 已经可以再锁一次了
};

// 手 + 向下箭头（该放下手了）；手 + 向上箭头（可以抬手比了）。stroke 用 currentColor，跟着状态换色。
const ARM_ICON = {
  lower: '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="1.7" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M8 12V6.6a1.3 1.3 0 0 1 2.6 0V11"/><path d="M10.6 11V5.6a1.3 1.3 0 0 1 2.6 0V11"/>'
    + '<path d="M13.2 11.4V7.2a1.3 1.3 0 0 1 2.6 0v4.2"/><path d="M15.8 12.2V9.4a1.3 1.3 0 0 1 2.6 0v5.2a6 6 0 0 1-6 6h-1.6a4.6 4.6 0 0 1-3.6-1.7L4.6 15.6a1.5 1.5 0 0 1 2.2-2l1.2 1.3"/>'
    + '<path d="M33 5v11M28.5 11.5l4.5 4.5 4.5-4.5"/></svg>',
  ready: '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="1.7" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M8 12V6.6a1.3 1.3 0 0 1 2.6 0V11"/><path d="M10.6 11V5.6a1.3 1.3 0 0 1 2.6 0V11"/>'
    + '<path d="M13.2 11.4V7.2a1.3 1.3 0 0 1 2.6 0v4.2"/><path d="M15.8 12.2V9.4a1.3 1.3 0 0 1 2.6 0v5.2a6 6 0 0 1-6 6h-1.6a4.6 4.6 0 0 1-3.6-1.7L4.6 15.6a1.5 1.5 0 0 1 2.2-2l1.2 1.3"/>'
    + '<path d="M33 19V8M28.5 12.5l4.5-4.5 4.5 4.5"/></svg>',
};

// 认不出来的招式一律显示 '?'，不让界面崩掉。
function labelOf(moveKey) {
  const move = MOVES[moveKey];
  return move ? move.label : '?';
}

const STYLE = `
.ft-ui { position: fixed; inset: 0; z-index: 1000; pointer-events: none; color: #f4ece0;
  font: 16px/1.4 "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
  -webkit-user-select: none; user-select: none; }
/* 顶部三行（状态 / 已锁定 / 揭晓）摞成一列：哪一行换行，都不会压到下一行身上。
   以前三行各自写死 top（16 / 46 / 76），窄屏上状态行一换行就叠在揭晓行上。 */
.ft-top { position: absolute; top: 16px; left: 0; right: 0; display: flex;
  flex-direction: column; align-items: center; gap: 4px; padding: 0 12px; }
.ft-status { text-align: center; font-size: 20px; text-shadow: 0 1px 3px rgba(0,0,0,.8); }
.ft-lock { text-align: center; font-size: 16px; color: #ffd98a; text-shadow: 0 1px 3px rgba(0,0,0,.8); }
.ft-reveal { text-align: center; font-size: 18px; text-shadow: 0 1px 3px rgba(0,0,0,.8); }
/* 窄屏：右上角挂着摄像头小窗时（.ft-has-cam），顶部文字往左让开它 ——
   不然揭晓行的尾巴「→ You win」正好被视频盖住，玩家看不到这局谁赢了。 */
@media (max-width: 560px) {
  .ft-ui.ft-has-cam .ft-top { padding-right: 112px; }
  .ft-status { font-size: 17px; }
  .ft-reveal { font-size: 16px; }
  /* 结算卡片上最长的就是比分行："Rounds — you 5 · computer 0"，窄屏上缩一档才不出卡片。 */
  .ft-score { font-size: 16px; }
}
/* 底部这一摞：提示条在上、三个按钮在下，整摞贴着底边往上长。
   提示条隐藏（display:none）时不占位，按钮位置和以前一模一样。 */
.ft-bottom { position: absolute; left: 0; right: 0; bottom: 24px; display: flex;
  flex-direction: column; align-items: center; gap: 10px; }
.ft-bar { align-self: stretch; display: flex;
  justify-content: center; gap: 14px; flex-wrap: wrap; padding: 0 12px; }
/* 抬手提示条：没调过 setArmHint 就一直是 .ft-hidden，整条不存在。 */
.ft-arm-hint { display: flex; align-items: center; gap: 9px; padding: 7px 16px;
  border: 1px solid rgba(201, 166, 107, .5); border-radius: 999px;
  background: rgba(28, 18, 12, .78); box-shadow: 0 4px 14px rgba(0, 0, 0, .45);
  font-size: 17px; letter-spacing: .01em; white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .8); }
.ft-arm-hint.ft-hidden { display: none; }
.ft-arm-hint svg { display: block; width: 35px; height: 21px; }
.ft-arm-lower { color: #ffd98a; border-color: rgba(228, 172, 115, .62);
  animation: ft-arm-pulse 1.4s ease-in-out infinite; }
.ft-arm-ready { color: #8ee6a8; border-color: rgba(110, 214, 150, .55); }
@keyframes ft-arm-pulse {
  0%, 100% { opacity: 1; transform: translateY(0); }
  50% { opacity: .5; transform: translateY(3px); }
}
.ft-btn { pointer-events: auto; cursor: pointer; touch-action: manipulation; min-width: 116px; padding: 12px 18px;
  border: 2px solid #c9a66b; border-radius: 12px; background: rgba(38, 26, 18, .82);
  color: inherit; font: inherit; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ft-btn:hover { background: rgba(70, 48, 30, .92); }
.ft-btn:active { transform: translateY(1px); }
.ft-btn-name { font-size: 22px; font-weight: 600; }
.ft-btn-hand { font-size: 13px; color: #cbb99d; }
.ft-bar.ft-off .ft-btn { opacity: .35; cursor: default; }
.ft-bar.ft-off .ft-btn:hover { background: rgba(38, 26, 18, .82); }
.ft-overlay { position: absolute; inset: 0; display: grid; place-items: center;
  background: rgba(0, 0, 0, .6); pointer-events: auto; }
.ft-overlay.ft-hidden { display: none; }
/* 结算卡片：大字 → 最终比分 → 重开按钮 → 「空格也能重开」那一小行，从上到下摞成一列。
   以前是大字自带 margin-bottom，现在摞四行，交给 flex 的 gap 排，改文案不用再调间距。 */
.ft-card { padding: 28px 40px; border: 2px solid #c9a66b; border-radius: 16px;
  background: rgba(28, 18, 12, .95); text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ft-winner { font-size: 34px; font-weight: 700; }
/* 最终比分，例："Rounds — you 5 · computer 0"。没传数字进来时整行收掉（.ft-hidden）。 */
.ft-score { font-size: 18px; color: #e6cba4; }
.ft-score.ft-hidden { display: none; }
.ft-again { pointer-events: auto; cursor: pointer; padding: 10px 24px; margin-top: 8px; font: inherit;
  font-size: 20px; color: inherit; background: rgba(70, 48, 30, .95);
  border: 2px solid #c9a66b; border-radius: 12px; }
.ft-again:hover { background: rgba(110, 76, 46, .95); }
/* 按钮下面那一小行：提醒键盘也能重开（键位由 main.js 的空格监听管）。 */
.ft-space-hint { font-size: 13px; color: #cbb99d; }
.ft-cam { position: fixed; top: 16px; right: 16px; z-index: 900; width: min(200px, 22vw);
  border: 1px solid #e4ac73; border-radius: 10px; overflow: hidden; pointer-events: none;
  background: rgba(20, 14, 10, .85); box-shadow: 0 6px 18px rgba(0, 0, 0, .55); }
.ft-cam-mirror { aspect-ratio: 4 / 3; transform: scaleX(-1); background: #000; }
.ft-cam video { display: block; width: 100%; height: 100%; object-fit: cover; }
.ft-cam-label { padding: 3px 0 5px; text-align: center; font-size: 11px; letter-spacing: .14em;
  color: #e4ac73; }
`;

function injectStyle() {
  if (document.getElementById('ft-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'ft-ui-style';
  style.textContent = STYLE;
  document.head.appendChild(style);
}

export function createUI({ onChoose, onRestart, showButtons = true } = {}) {
  injectStyle();

  let enabled = true;

  const root = document.createElement('div');
  root.className = 'ft-ui';

  const status = document.createElement('div');
  status.className = 'ft-status';

  const lock = document.createElement('div');
  lock.className = 'ft-lock';

  const reveal = document.createElement('div');
  reveal.className = 'ft-reveal';

  // 三行装进同一个容器，靠 flex 从上往下排（见 .ft-top 的注释）。
  const top = document.createElement('div');
  top.className = 'ft-top';
  top.append(status, lock, reveal);

  const bar = document.createElement('div');
  bar.className = 'ft-bar';

  const buttons = {};
  for (const key of MOVE_KEYS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ft-btn';
    const name = document.createElement('span');
    name.className = 'ft-btn-name';
    name.textContent = MOVES[key].label;
    const hand = document.createElement('span');
    hand.className = 'ft-btn-hand';
    hand.textContent = MOVES[key].hand;
    btn.append(name, hand);
    btn.addEventListener('click', () => {
      if (!enabled) return; // 锁定期间点了不算
      if (onChoose) onChoose(key);
    });
    buttons[key] = btn;
    bar.appendChild(btn);
  }

  const overlay = document.createElement('div');
  overlay.className = 'ft-overlay ft-hidden';
  const card = document.createElement('div');
  card.className = 'ft-card';
  const winner = document.createElement('div');
  winner.className = 'ft-winner';
  // 最终比分那一行：建好先收起来，showWinner 拿到数字才写。
  const score = document.createElement('div');
  score.className = 'ft-score ft-hidden';
  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'ft-again';
  again.textContent = 'PLAY AGAIN';
  again.addEventListener('click', () => {
    if (onRestart) onRestart();
  });
  // 「空格也能重开」的提示：按钮下面一小行，键位真正的实现是 main.js 里的 keydown 监听。
  const spaceHint = document.createElement('div');
  spaceHint.className = 'ft-space-hint';
  spaceHint.textContent = 'or press Space';
  card.append(winner, score, again, spaceHint);
  overlay.appendChild(card);

  // 抬手提示条：建好就藏起来（.ft-hidden），只有 setArmHint 被调过之后才现身。
  const armHint = document.createElement('div');
  armHint.className = 'ft-arm-hint ft-hidden';
  const armIcon = document.createElement('span');
  armIcon.className = 'ft-arm-icon';
  const armText = document.createElement('span');
  armText.className = 'ft-arm-text';
  armHint.append(armIcon, armText);

  // 提示条在三个按钮正上方；藏起来时 display:none，不占位、不挤动按钮。
  const bottom = document.createElement('div');
  bottom.className = 'ft-bottom';
  bottom.append(armHint, bar);

  // tuning.js 的 showButtonFallback：真关了就把屏幕上那排按钮收掉（手势还是能出招）。
  // 默认 true，所以平常这段什么都不做。
  if (showButtons === false) bar.style.display = 'none';

  root.append(top, bottom, overlay);
  document.body.appendChild(root);

  return {
    setEnabled(on) {
      enabled = !!on;
      bar.classList.toggle('ft-off', !enabled);
      for (const key of MOVE_KEYS) buttons[key].disabled = !enabled;
    },

    setStatus(text) {
      status.textContent = text == null ? '' : String(text);
    },

    // 例：showLocked('heavy') → "LOCKED IN: Heavy"；传 null 清空。
    showLocked(moveKey) {
      lock.textContent = MOVES[moveKey] ? `LOCKED IN: ${MOVES[moveKey].label}` : '';
    },

    // 例："You: Heavy  |  Computer: Slash → You win"
    showReveal(playerMove, aiMove, result) {
      lock.textContent = ''; // 揭晓了就收起"已锁定"
      const line = `You: ${labelOf(playerMove)}  |  Computer: ${labelOf(aiMove)}`;
      reveal.textContent = RESULTS[result] ? `${line} → ${RESULTS[result]}` : line;
    },

    // winner_：'player' | 其它（电脑赢）。后两个是最终比分，各赢了几轮
    // （main.js 把 game.playerSteps / game.aiSteps 直接递进来；胜负按净胜算，所以可能是 6–1 这种）。
    // 两个数字都传了才写那一行；没传就整行收起来 —— 免得上一局的比分留在卡片上。
    showWinner(winner_, playerSteps, aiSteps) {
      winner.textContent = winner_ === 'player' ? 'You win!' : 'Computer wins!';
      const hasScore = Number.isFinite(playerSteps) && Number.isFinite(aiSteps);
      score.textContent = hasScore ? `Rounds — you ${playerSteps} · computer ${aiSteps}` : '';
      score.classList.toggle('ft-hidden', !hasScore);
      overlay.classList.remove('ft-hidden');
    },

    // 收结算覆盖层。顺手把"已锁定"和揭晓行也清掉：重开走的就是这里
    // （main.js 的 onRestart 只调这一个），不清的话上一局的 "You: … → You win" 会留在屏幕上。
    hideOverlay() {
      overlay.classList.add('ft-hidden');
      lock.textContent = '';
      reveal.textContent = '';
    },

    // 抬手提示条，只有摄像头真的在跑（gesture.js 的 onArmChange）才会被调到。
    // armed=false：刚锁定完，该放下手 → 金色 + 手/向下箭头 + 轻轻脉动。
    // armed=true： 可以出招了 → 绿色 + 手/向上箭头，不脉动。
    // 没调过这个方法就一直是 .ft-hidden：整条提示不存在，不留空条也不占位。
    setArmHint(armed) {
      const ready = !!armed;
      armIcon.innerHTML = ready ? ARM_ICON.ready : ARM_ICON.lower;
      armText.textContent = ready ? ARM_TEXT.ready : ARM_TEXT.lower;
      armHint.className = `ft-arm-hint ${ready ? 'ft-arm-ready' : 'ft-arm-lower'}`;
    },

    // 右上角摄像头小窗：只有真的传进来一个 <video> 元素才挂上去。
    // 没摄像头（gesture.start() 失败）时没人调这个方法，界面上不会留空框，也不动棋盘和按钮的位置。
    attachCamera(videoEl) {
      if (!videoEl || typeof videoEl.appendChild !== 'function') return;
      if (videoEl.tagName !== 'VIDEO') return;
      if (root.querySelector('.ft-cam')) return; // 只挂一次

      // 挂上了就在 .ft-ui 上做个记号：窄屏的 CSS 靠它把顶部文字让开这个角（见 .ft-top 上面那段）。
      root.classList.add('ft-has-cam');

      const box = document.createElement('div');
      box.className = 'ft-cam';
      const mirror = document.createElement('div');
      mirror.className = 'ft-cam-mirror'; // 镜像放在这层，下面的标签才不会被翻过来
      const label = document.createElement('div');
      label.className = 'ft-cam-label';
      label.textContent = 'YOUR HAND';

      // gesture.js 原来把 <video> 藏到屏幕外（2px、透明），这里改成填满小窗、可见。
      videoEl.style.position = 'static';
      videoEl.style.left = 'auto';
      videoEl.style.top = 'auto';
      videoEl.style.width = '100%';
      videoEl.style.height = '100%';
      videoEl.style.opacity = '1';

      // 小窗高度跟着视频自己的宽高比走；元数据晚到就等 loadedmetadata 再补一次。
      const fitAspect = () => {
        if (videoEl.videoWidth && videoEl.videoHeight) {
          mirror.style.aspectRatio = `${videoEl.videoWidth} / ${videoEl.videoHeight}`;
        }
      };
      fitAspect();
      videoEl.addEventListener('loadedmetadata', fitAspect);

      mirror.appendChild(videoEl);
      box.append(mirror, label);
      root.appendChild(box);
    },

    update() {
      // M1 用不上：界面没有需要逐帧更新的东西。
    },
  };
}
