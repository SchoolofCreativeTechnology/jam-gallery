// HUD: title, money, next-area goal, inventory, low-tide bar, craft prompt, boat banner, sale summary and sunset/day-end screen.
import {
  ITEM_TYPES, CRAFT_GOODS_SHOW_TIME,
  BANNER_DURATION, SUNSET_COLOR, SUNSET_FADE_IN, SUNSET_HOLD, SUNSET_FADE_OUT,
  AREA_GOAL_LABEL, AREA_UNLOCKED_TEXT,
} from './tuning.js';

export function createUI({ onStart, onRestart, onNextDay }) {
  const $ = (id) => document.getElementById(id);
  const els = {
    title: $('title-screen'),
    play: $('play'),
    restart: $('restart'),
    inventory: $('items'),
    total: $('total'),
    tideFill: $('tide-fill'),
    tideLabel: $('tide-label'),
    message: $('message'),
    moneyCard: $('money'),
    money: $('money-value'),
    prompt: $('prompt'),
    sign: $('sign-label'),
    goods: $('goods'),
    dayEnd: $('day-end'),
    dayLines: $('day-lines'),
    dayEarned: $('day-earned'),
    dayMoney: $('day-money'),
    nextDay: $('next-day'),
  };

  // SECTION: inventory — one row per item type, built once and then updated in place.
  const rows = {};
  for (const t of ITEM_TYPES) {
    const row = document.createElement('div');
    row.className = 'inv-row';
    row.innerHTML = `<span class="dot" style="background:${t.color}"></span>`
      + `<span class="name">${t.label}</span><span class="count">0</span>`;
    els.inventory.appendChild(row);
    rows[t.id] = { row, count: row.querySelector('.count') };
  }

  function updateInventory(inv, total) {
    for (const t of ITEM_TYPES) {
      const n = inv[t.id] || 0;
      rows[t.id].count.textContent = n;
      rows[t.id].row.classList.toggle('empty', n === 0);
    }
    els.total.textContent = total;
  }

  // SECTION: money — the running total, carried across days.
  function setMoney(v) { els.money.textContent = `$${v}`; }

  // SECTION: the next-area goal — progress toward unlocking the area across the water.
  // Created here (with inline styles) so index.html stays untouched; it sits under the money card.
  const goal = document.createElement('div');
  Object.assign(goal.style, {
    background: 'rgba(255,255,255,0.85)', borderRadius: '12px', padding: '6px 12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.12)', font: '600 13px system-ui, sans-serif',
    color: '#2b3a44', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  });
  els.moneyCard.parentNode.insertBefore(goal, els.moneyCard.nextSibling);

  function setGoal(current, target) {
    if (current >= target) {
      goal.textContent = `${AREA_GOAL_LABEL}: ${AREA_UNLOCKED_TEXT}`;
      goal.style.color = '#1f7a3d';
      goal.style.background = 'rgba(214,242,220,0.92)';
    } else {
      goal.textContent = `${AREA_GOAL_LABEL}: $${current} / $${target}`;
      goal.style.color = '#2b3a44';
      goal.style.background = 'rgba(255,255,255,0.85)';
    }
  }

  // SECTION: tide bar.
  function setTide(p) {
    els.tideFill.style.width = `${Math.round(p * 100)}%`;
    els.tideLabel.textContent = p >= 1 ? 'High tide — the sea is coming in' : 'Low tide';
  }

  // SECTION: a short line of feedback (pickup, drop, tide change, sale).
  let msgTimer = 0;
  function setMessage(text) {
    if (!text) { els.message.classList.remove('show'); return; }
    els.message.textContent = text;
    els.message.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => els.message.classList.remove('show'), 2200);
  }

  // SECTION: the craft prompt, pinned in the world over the shop counter.
  function setPrompt(text, x, y, visible) {
    els.prompt.textContent = text;
    els.prompt.classList.toggle('hidden', !visible);
    if (visible) { els.prompt.style.left = `${x}px`; els.prompt.style.top = `${y}px`; }
  }
  function hidePrompt() { els.prompt.classList.add('hidden'); }

  // SECTION: the signboard label, pinned in the world over the sign.
  function setSignLabel(text, x, y, visible) {
    els.sign.textContent = text;
    els.sign.classList.toggle('hidden', !visible);
    if (visible) { els.sign.style.left = `${x}px`; els.sign.style.top = `${y}px`; }
  }

  // SECTION: the "Locked" label, pinned in the world over the islet across the water.
  // Created here (with inline styles) so index.html stays untouched.
  const areaLabel = document.createElement('div');
  Object.assign(areaLabel.style, {
    position: 'fixed', transform: 'translate(-50%, -50%)', background: 'rgba(43,58,68,0.88)',
    color: '#fff', padding: '4px 11px', borderRadius: '8px', font: '600 12px system-ui, sans-serif',
    letterSpacing: '0.04em', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: '4',
    boxShadow: '0 3px 10px rgba(0,0,0,0.22)', display: 'none',
  });
  document.body.appendChild(areaLabel);

  function setAreaLabel(text, x, y, visible) {
    areaLabel.textContent = text;
    if (visible) {
      areaLabel.style.display = '';
      areaLabel.style.left = `${x}px`;
      areaLabel.style.top = `${y}px`;
    } else {
      areaLabel.style.display = 'none';
    }
  }

  // SECTION: the announcement banner. Created here (with inline styles) so index.html stays untouched.
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed', top: '96px', left: '50%', transform: 'translate(-50%, -12px)',
    background: 'rgba(255,157,92,0.96)', color: '#4a2410', padding: '10px 28px',
    borderRadius: '999px', fontSize: '19px', fontWeight: '700', letterSpacing: '0.02em',
    boxShadow: '0 6px 20px rgba(0,0,0,0.22)', zIndex: '30', pointerEvents: 'none',
    opacity: '0', transition: 'opacity 0.35s, transform 0.35s',
  });
  document.body.appendChild(banner);

  let bannerTimer = 0;
  function showBanner(text, seconds = BANNER_DURATION) {
    banner.textContent = text;
    banner.style.opacity = '1';
    banner.style.transform = 'translate(-50%, 0)';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, seconds * 1000);
  }
  function hideBanner() {
    clearTimeout(bannerTimer);
    banner.style.opacity = '0';
    banner.style.transform = 'translate(-50%, -12px)';
  }

  // SECTION: the sunset overlay for the short rest moment between the sale and the next day.
  const sunset = document.createElement('div');
  Object.assign(sunset.style, {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
    background: SUNSET_COLOR, opacity: '0', pointerEvents: 'none', zIndex: '40',
    transitionProperty: 'opacity', transitionTimingFunction: 'ease-in-out',
  });
  document.body.appendChild(sunset);

  let sunsetTimer = 0;
  function playSunset(onDone) {
    clearTimeout(sunsetTimer);
    sunset.style.transitionDuration = `${SUNSET_FADE_IN}s`;
    sunset.style.opacity = '1';
    sunsetTimer = setTimeout(() => {
      sunset.style.transitionDuration = `${SUNSET_FADE_OUT}s`;
      sunset.style.opacity = '0';
      sunsetTimer = setTimeout(onDone, SUNSET_FADE_OUT * 1000);
    }, (SUNSET_FADE_IN + SUNSET_HOLD) * 1000);
  }
  function hideSunset() {
    clearTimeout(sunsetTimer);
    sunset.style.transitionDuration = '0s';
    sunset.style.opacity = '0';
  }

  // SECTION: the crafted goods, shown for a few seconds after crafting.
  let goodsTimer = 0;
  function showGoods(g) {
    els.goods.innerHTML = '<div class="goods-title">Crafted</div>'
      + `<div class="goods-row"><span>Ice cream × ${g.iceCream.count}</span><span>$${g.iceCream.value}</span></div>`
      + `<div class="goods-row"><span>Jewelry × ${g.jewelry.count}</span><span>$${g.jewelry.value}</span></div>`;
    els.goods.classList.remove('hidden');
    clearTimeout(goodsTimer);
    goodsTimer = setTimeout(() => els.goods.classList.add('hidden'), CRAFT_GOODS_SHOW_TIME * 1000);
  }
  function hideGoods() { clearTimeout(goodsTimer); els.goods.classList.add('hidden'); }

  // SECTION: the sale summary panel, shown when the boat docks. The next-day button stays hidden
  // until the sunset rest moment has played.
  function summaryLine(label, count, value) {
    return `<div class="day-line"><span>${label} × ${count} =</span><span>$${value}</span></div>`;
  }
  function showSaleSummary(g, earned, money) {
    els.dayLines.innerHTML = summaryLine('Ice cream', g.iceCream.count, g.iceCream.value)
      + summaryLine('Jewelry', g.jewelry.count, g.jewelry.value);
    els.dayEarned.textContent = `$${earned}`;
    els.dayMoney.textContent = `$${money}`;
    els.nextDay.style.display = 'none';
    els.dayEnd.classList.remove('hidden');
  }
  function revealNextDay() { els.nextDay.style.display = ''; }
  function hideDayEnd() {
    els.dayEnd.classList.add('hidden');
    els.nextDay.style.display = '';
    hideSunset();
  }

  function showTitle() { els.title.classList.remove('hidden'); }
  function hideTitle() { els.title.classList.add('hidden'); }

  els.play.addEventListener('click', onStart);
  els.restart.addEventListener('click', onRestart);
  els.nextDay.addEventListener('click', onNextDay);
  els.title.addEventListener('click', (e) => { if (e.target === els.title) onStart(); });

  return {
    updateInventory, setTide, setMessage, setMoney, setGoal,
    setPrompt, hidePrompt, setSignLabel, setAreaLabel,
    showBanner, hideBanner, playSunset, hideSunset,
    showGoods, hideGoods, showSaleSummary, revealNextDay, hideDayEnd,
    showTitle, hideTitle,
  };
}
