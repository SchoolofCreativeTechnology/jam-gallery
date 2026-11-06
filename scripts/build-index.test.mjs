import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex } from './build-index.mjs';

const meta = (handle, extra = {}) => ({
  title: 'A Game', handle, description: 'd', assets: [], ai_assets: [], ...extra,
});

function gamesDir(games) {
  const dir = mkdtempSync(join(tmpdir(), 'gallery-'));
  for (const [folder, { meta: m, files = {} }] of Object.entries(games)) {
    mkdirSync(join(dir, folder), { recursive: true });
    if (!('index.html' in files)) writeFileSync(join(dir, folder, 'index.html'), '<html></html>');
    if (m) writeFileSync(join(dir, folder, 'meta.json'), JSON.stringify(m));
    for (const [f, body] of Object.entries(files)) {
      if (body === null) continue;
      mkdirSync(join(dir, folder, f, '..'), { recursive: true });
      writeFileSync(join(dir, folder, f), body);
    }
  }
  return dir;
}

test('valid game listed', () => {
  const games = buildIndex(gamesDir({ 'ok-handle': { meta: meta('ok-handle') } }));
  assert.equal(games.length, 1);
  assert.equal(games[0].handle, 'ok-handle');
  assert.equal(games[0].path, 'games/ok-handle/');
});

test('folder name must match meta.handle', () => {
  assert.throws(() => buildIndex(gamesDir({ aa: { meta: meta('bb') } })), /aa.*handle/);
});

test('invalid handle rejected', () => {
  assert.throws(() => buildIndex(gamesDir({ 'My Name!': { meta: meta('My Name!') } })), /handle/);
});

test('asset missing license rejected', () => {
  const m = meta('hh', { assets: [{ file: 'x.png', source: 'url', license: '' }] });
  assert.throws(() => buildIndex(gamesDir({ hh: { meta: m, files: { 'x.png': 'p' } } })), /x\.png.*license/);
});

test('asset file not listed rejected', () => {
  assert.throws(() => buildIndex(gamesDir({ hh: { meta: meta('hh'), files: { 'tex.png': 'p' } } })), /tex\.png/);
});

test('ai asset and nested listed asset accepted', () => {
  const m = meta('hh', {
    ai_assets: ['gen.png'],
    assets: [{ file: 'sfx/hit.wav', source: 'https://example.com', license: 'CC0' }],
  });
  const games = buildIndex(gamesDir({ hh: { meta: m, files: { 'gen.png': 'p', 'sfx/hit.wav': 'w', 'DEVLOG.md': '#', 'game.js': '' } } }));
  assert.equal(games.length, 1);
});

test('missing index.html rejected', () => {
  assert.throws(() => buildIndex(gamesDir({ hh: { meta: meta('hh'), files: { 'index.html': null } } })), /index\.html/);
});

test('missing meta.json rejected', () => {
  assert.throws(() => buildIndex(gamesDir({ hh: {} })), /hh.*meta\.json/);
});

test('empty title rejected', () => {
  assert.throws(() => buildIndex(gamesDir({ hh: { meta: meta('hh', { title: '' }) } })), /hh.*title/);
});

test('sorted by title', () => {
  const games = buildIndex(gamesDir({
    zed: { meta: meta('zed', { title: 'Alpha' }) },
    amy: { meta: meta('amy', { title: 'Beta' }) },
  }));
  assert.deepEqual(games.map((g) => g.title), ['Alpha', 'Beta']);
});

import { checkPrScope } from './build-index.mjs';

test('pr adding one new game passes', () => {
  assert.equal(checkPrScope(['games/new-kid/index.html', 'games/new-kid/meta.json'], ['example']), 'new-kid');
});

test('pr overwriting an existing game rejected', () => {
  assert.throws(() => checkPrScope(['games/example/index.html'], ['example']), /example.*already/);
});

test('pr touching files outside games rejected', () => {
  assert.throws(() => checkPrScope(['games/new-kid/index.html', 'scripts/build-index.mjs'], []), /scripts\/build-index\.mjs/);
});

test('pr touching two games rejected', () => {
  assert.throws(() => checkPrScope(['games/aa/index.html', 'games/bb/index.html'], []), /one game/);
});

test('symbolic link in a game rejected', () => {
  const dir = gamesDir({ 'linky': { meta: meta('linky') } });
  symlinkSync('..', join(dir, 'linky', 'up'));
  assert.throws(() => buildIndex(dir), /symbolic link/);
});

test('meta.json with a BOM is read', () => {
  const dir = gamesDir({ 'bom': { files: { 'meta.json': '\uFEFF' + JSON.stringify(meta('bom')) } } });
  assert.equal(buildIndex(dir)[0].handle, 'bom');
});

test('key-shaped string in game code rejected', () => {
  const dir = gamesDir({ 'leaky': { meta: meta('leaky'), files: { 'main.js': 'const k = "vck_' + 'a'.repeat(30) + '";' } } });
  assert.throws(() => buildIndex(dir), /shaped like an API key/);
});

test('credits with ./ or backslashes match', () => {
  const dir = gamesDir({ 'paths': { meta: meta('paths', { ai_assets: ['./a.png', 'img\\b.png'] }), files: { 'a.png': 'x', 'img/b.png': 'x' } } });
  assert.equal(buildIndex(dir).length, 1);
});

test('hidden files and folders rejected', () => {
  assert.throws(() => buildIndex(gamesDir({ hh: { meta: meta('hh'), files: { '.claude/settings.local.json': '{}' } } })), /hidden/);
});
