import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GATEWAY_URL, makeGatewayRequest, parseGatewayReply, parseTalkRequest } from './server-dialogue.js';
import { MAX_PITCH_LENGTH } from './tuning.js';
import { MAX_AUDIO_BYTES, TRANSCRIPTION_URL, TRANSCRIPTION_MODEL, makeTranscriptionRequest, parseTranscriptionReply, parseTranscriptionRequest } from './transcription.js';
import { SPEECH_URL, SPEECH_MODEL, makeSpeechRequest, parseSpeechReply, parseSpeechRequest } from './speech.js';
import { makeIntentRequest, parseIntentReply } from './server-intent.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/ui.css', ['ui.css', 'text/css; charset=utf-8']],
  ...['main', 'engine', 'state', 'talk', 'items', 'customers', 'tuning', 'audio', 'objects', 'scene', 'ui', 'persistence', 'blockout', 'scene-assets', 'inventory-display', 'shop-dressing', 'personalities', 'prototype', 'prototype-ui', 'microphone', 'speech-player', 'bargaining', 'progress', 'intent'].map(name => [`/${name}.js`, [`${name}.js`, 'text/javascript; charset=utf-8']]),
  ...['01-subway-guy','02-suit-guy','03-jacket-guy','04-hoodie-guy','05-red-skirt-woman','06-jeans-woman','07-homeless-guy','08-fish-man','09-sack-head','10-grey-alien'].map(name=>[`/assets/pawn-shop/characters/${name}.glb`,[`assets/pawn-shop/characters/${name}.glb`,'model/gltf-binary']]),
  ...['01-camera','02-pocket-watch','03-guitar','04-porcelain-cat','05-gold-trophy','06-winged-snake','07-storm-globe','08-laugh-jar','09-door','10-alien-egg'].map(name=>[`/assets/pawn-shop/items/${name}.glb`,[`assets/pawn-shop/items/${name}.glb`,'model/gltf-binary']]),
  ['/assets/pawn-shop/store/pawn-shop.glb',['assets/pawn-shop/store/pawn-shop.glb','model/gltf-binary']],
  ...['archivo-black','ibm-plex-mono','ibm-plex-mono-semibold','vt323'].map(name=>[`/assets/fonts/${name}.ttf`,[`assets/fonts/${name}.ttf`,'font/ttf']]),
]);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function json(res, status, body, headers = {}) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}

function validRequestOrigin(req, port) {
  try {
    const host = new URL(`http://${req.headers.host}`);
    if (!LOOPBACK.has(host.hostname) || host.username || host.password || Number(host.port || 80) !== port || host.pathname !== '/') return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin);
      if (origin.origin !== host.origin) return false;
    }
    return true;
  } catch { return false; }
}

function readBody(req, maxBytes, timeoutMs) {
  return new Promise((resolveBody, reject) => {
    const declaredLength = Number(req.headers['content-length']);
    if (declaredLength > maxBytes) { req.resume(); reject(new Error('body-too-large')); return; }
    let total = 0;
    const chunks = [];
    const cleanup = () => { clearTimeout(timer); req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted); };
    const fail = reason => { cleanup(); req.resume(); reject(new Error(reason)); };
    const data = chunk => { total += chunk.length; if (total > maxBytes) fail('body-too-large'); else chunks.push(chunk); };
    const end = () => { cleanup(); try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('invalid-json')); } };
    const error = () => fail('invalid-request');
    const aborted = () => fail('invalid-request');
    const timer = setTimeout(() => fail('body-timeout'), timeoutMs);
    req.on('data', data); req.once('end', end); req.once('error', error); req.once('aborted', aborted);
  });
}

export function createGameServer({
  apiKey = process.env.AI_GATEWAY_API_KEY || '', fetchImpl = globalThis.fetch,
  root = ROOT, timeoutMs = 8000, bodyTimeoutMs = 10000, maxBodyBytes = 512 * 1024,
  transcriptionTimeoutMs = 120000, speechTimeoutMs = 15000, maxTranscriptionBodyBytes = Math.ceil(MAX_AUDIO_BYTES / 3) * 4 + 1024,
  maxConcurrent = 2,
} = {}) {
  let activeCalls = 0;
  const keyAvailable = typeof apiKey === 'string' && apiKey.trim().length > 0;

  const server = createServer(async (req, res) => {
    try {
      const port = server.address()?.port;
      if (!validRequestOrigin(req, port)) { json(res, 403, { error: 'origin-not-allowed' }); return; }
      // Check the raw path before URL normalization can erase ../ segments.
      let pathname;
      try { pathname = decodeURIComponent((req.url || '').split('?')[0]); } catch { json(res, 400, { error: 'invalid-path' }); return; }
      if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part === '..' || part === '.')) { json(res, 404, { error: 'not-found' }); return; }

      if (pathname === '/api/status') {
        if (req.method !== 'GET') { json(res, 405, { error: 'method-not-allowed' }, { Allow: 'GET' }); return; }
        const available = keyAvailable;
        json(res, 200, { available, transcription: available, speech: available, interpretation: available, mode: available ? 'live' : 'authored', ...(!available ? { reason: 'missing-key' } : {}) });
        return;
      }

      if (pathname === '/api/talk' || pathname === '/api/transcribe' || pathname === '/api/speak' || pathname === '/api/interpret') {
        const transcribing = pathname === '/api/transcribe';
        const speaking = pathname === '/api/speak';
        const interpreting = pathname === '/api/interpret';
        if (req.method !== 'POST') { json(res, 405, { error: 'method-not-allowed' }, { Allow: 'POST' }); return; }
        if (!keyAvailable) { json(res, 503, { error: interpreting ? 'interpretation-unavailable' : speaking ? 'speech-unavailable' : transcribing ? 'transcription-unavailable' : 'live-unavailable' }); return; }
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) { json(res, 415, { error: 'json-required' }); return; }
        let body;
        try { body = await readBody(req, transcribing ? maxTranscriptionBodyBytes : maxBodyBytes, bodyTimeoutMs); } catch (error) {
          json(res, error.message === 'body-too-large' ? 413 : error.message === 'body-timeout' ? 408 : 400, { error: error.message }); return;
        }
        const context = speaking ? parseSpeechRequest(body) : transcribing ? parseTranscriptionRequest(body) : parseTalkRequest(body);
        if (!context || interpreting && (!context.prototype || context.event !== 'reply' || !context.state.negotiation)) { json(res, 400, { error: speaking ? 'invalid-speech' : transcribing ? 'invalid-audio' : 'invalid-context' }); return; }
        if (activeCalls >= maxConcurrent) { json(res, 429, { error: 'busy' }, { 'Retry-After': '1' }); return; }
        activeCalls++;
        const controller = new AbortController();
        let timer;
        const disconnected = () => { if (!res.writableEnded) controller.abort(); };
        res.once('close', disconnected);
        try {
          const upstream = (async () => {
            const response = await fetchImpl(speaking ? SPEECH_URL : transcribing ? TRANSCRIPTION_URL : GATEWAY_URL, {
              method: 'POST', signal: controller.signal, redirect: 'error',
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(speaking ? { 'ai-gateway-protocol-version': '0.0.1', 'ai-speech-model-specification-version': '4', 'ai-model-id': SPEECH_MODEL } : transcribing ? { 'ai-gateway-protocol-version': '0.0.1', 'ai-transcription-model-specification-version': '4', 'ai-model-id': TRANSCRIPTION_MODEL } : { 'anthropic-version': '2023-06-01' }) },
              body: JSON.stringify(interpreting ? makeIntentRequest(context) : speaking ? makeSpeechRequest(context) : transcribing ? makeTranscriptionRequest(context) : makeGatewayRequest(context)),
            });
            if (!response.ok) throw new Error('upstream-unavailable');
            const raw = await response.text();
            if (raw.length > (speaking ? 1500000 : transcribing ? 256000 : 24000)) throw new Error('invalid-upstream');
            let payload;
            try { payload = JSON.parse(raw); } catch { throw new Error('invalid-upstream'); }
            if (transcribing && typeof payload?.text === 'string' && payload.text.trim().length > MAX_PITCH_LENGTH) throw new Error('transcript-too-long');
            const result = interpreting ? parseIntentReply(payload,context.text,context) : speaking ? parseSpeechReply(payload) : transcribing ? parseTranscriptionReply(payload) : parseGatewayReply(payload, context.item, context.event);
            if (!result) throw new Error('invalid-upstream');
            return result;
          })();
          const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('upstream-timeout')); }, speaking ? speechTimeoutMs : transcribing ? transcriptionTimeoutMs : timeoutMs); });
          json(res, 200, await Promise.race([upstream, deadline]));
        } catch (error) {
          const timeout = error.message === 'upstream-timeout';
          if (transcribing && error.message === 'transcript-too-long') { json(res, 413, { error: 'transcript-too-long' }); return; }
          // Never expose provider error text, player input, prompts, or credentials.
          json(res, timeout ? 504 : 502, { error: interpreting ? 'interpretation-unavailable' : speaking ? 'speech-unavailable' : transcribing ? 'transcription-unavailable' : timeout ? 'live-timeout' : 'live-unavailable' });
        } finally {
          clearTimeout(timer); res.off('close', disconnected); activeCalls--;
        }
        return;
      }

      if (!['GET', 'HEAD'].includes(req.method)) { json(res, 405, { error: 'method-not-allowed' }, { Allow: 'GET, HEAD' }); return; }
      const file = PUBLIC_FILES.get(pathname);
      if (!file) { json(res, 404, { error: 'not-found' }); return; }
      const base = await realpath(root);
      const filePath = await realpath(resolve(base, file[0]));
      if (!filePath.startsWith(`${base}${sep}`) || filePath !== resolve(base, file[0])) { json(res, 404, { error: 'not-found' }); return; }
      let bytes = await readFile(filePath);
      if (file[0] === 'index.html') bytes = Buffer.from(bytes.toString('utf8').replace('</head>', '  <meta name="oddly-api" content="./api/talk">\n</head>'));
      res.writeHead(200, { 'Content-Type': file[1], 'Content-Length': bytes.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch {
      json(res, 500, { error: 'server-error' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 1000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8001);
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Use a loopback HOST and a PORT from 1 to 65535.');
    process.exitCode = 1;
  } else {
    const server = createGameServer();
    server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : 'Could not start the local game server.'); process.exitCode = 1; });
    server.listen(port, host, () => console.log(`ODDLY ENOUGH: http://${host === '::1' ? '[::1]' : host}:${port} — ${process.env.AI_GATEWAY_API_KEY ? 'live dialogue enabled' : 'authored dialogue (no API key configured)'}`));
  }
}
