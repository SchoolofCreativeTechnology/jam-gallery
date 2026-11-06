// On-screen text: the door prompt, timed feedback messages, and the progress line in the corner.
// Prompts and messages are rendered as parchment scrolls with a handwritten-style font.
import { MESSAGE_MS } from './tuning.js';

const STYLE = `
#ui-prompt, #ui-message {
  position: fixed; left: 50%; transform: translateX(-50%);
  color: #2b1d12;
  border-left: 2px solid #7a5a3a; border-right: 2px solid #7a5a3a;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), inset 0 0 40px rgba(90, 60, 30, 0.18);
  background: linear-gradient(90deg, #b8a778 0%, #cbb885 8%, #d6c69a 25%, #d6c69a 75%, #cbb885 92%, #b8a778 100%);
  font-family: 'Courier New', Courier, monospace;
  letter-spacing: 0.4px;
}
.ui-scroll-roller {
  height: 12px;
  background: linear-gradient(#6b4a2e, #3e2a1a);
  border-radius: 6px;
  margin: 0 -10px;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
}
.ui-scroll-text {
  display: block;
  padding: 12px 20px;
  font-size: 17px;
  line-height: 1.4;
}
#ui-prompt { bottom: 18%; }
#ui-message { bottom: 7%; max-width: 76vw; text-align: center; }
#ui-message .ui-scroll-text { font-size: 16px; }
#ui-hud { position: fixed; left: 12px; top: 12px; color: #cdbba0; font: 13px/1.4 ui-monospace, Menlo, Consolas, monospace; }
#ui-prompt[hidden], #ui-message[hidden] { display: none; }
`;

let els = null;
let messageTimer = 0;

function makeScroll(id) {
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.hidden = true;
  const top = document.createElement('div');
  top.className = 'ui-scroll-roller';
  const content = document.createElement('span');
  content.className = 'ui-scroll-text';
  const bottom = document.createElement('div');
  bottom.className = 'ui-scroll-roller';
  wrap.append(top, content, bottom);
  document.body.appendChild(wrap);
  return { wrap, content };
}

// Creates the DOM once; every show/hide call can safely call it again.
export function setupUI() {
  if (els) return els;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  const prompt = makeScroll('ui-prompt');
  const message = makeScroll('ui-message');
  const hud = document.createElement('div');
  hud.id = 'ui-hud';
  document.body.appendChild(hud);
  els = { prompt: prompt.wrap, promptText: prompt.content, message: message.wrap, messageText: message.content, hud };
  els.hud.hidden = false;
  return els;
}

export function showPrompt(text) {
  const { prompt, promptText } = setupUI();
  promptText.textContent = text;
  prompt.hidden = false;
}

export function hidePrompt() {
  setupUI().prompt.hidden = true;
}

// durationMs of 0 keeps the message up until the next one replaces it.
export function showMessage(text, durationMs = MESSAGE_MS) {
  const { message, messageText } = setupUI();
  clearTimeout(messageTimer);
  messageText.textContent = text;
  message.hidden = false;
  if (durationMs > 0) messageTimer = setTimeout(() => { message.hidden = true; }, durationMs);
}

export function hideMessage() {
  clearTimeout(messageTimer);
  setupUI().message.hidden = true;
}

export function setHud(text) {
  setupUI().hud.textContent = text;
}
