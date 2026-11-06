// Validate every games/<handle>/ folder and write games.json for the gallery page.
// Runs on Vercel deploy and on every PR; any invalid game fails the build.
import { readdirSync, readFileSync, existsSync, lstatSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HANDLE = /^[a-z0-9-]{2,30}$/;
// Files a game may contain without crediting them in meta.json.
const FREE_NAMES = new Set(['index.html', 'meta.json', 'DEVLOG.md']);
const FREE_EXTS = new Set(['.js', '.mjs', '.css']);
const KEY = /vck_[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}/;
// Credits written as ./a.png, /a.png, or a\\b.png still mean a.png, a/b.png.
const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.?\//, '');

function walk(dir, root = dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    const s = lstatSync(p);
    // A link could loop forever or pull in files from outside the game folder.
    if (s.isSymbolicLink()) throw new Error(`${relative(root, p)} is a symbolic link; copy the real file instead`);
    return s.isDirectory() ? walk(p, root) : [relative(root, p).split('\\').join('/')];
  });
}

function checkGame(gamesDir, folder) {
  const dir = join(gamesDir, folder);
  const fail = (msg) => { throw new Error(`games/${folder}: ${msg}`); };

  if (!existsSync(join(dir, 'meta.json'))) fail('missing meta.json');
  if (!existsSync(join(dir, 'index.html'))) fail('missing index.html');

  let meta;
  try { meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8').replace(/^\uFEFF/, '')); }
  catch (e) { fail(`meta.json is not valid JSON (${e.message})`); }

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) fail('meta.json must be an object like {"title": ...}');
  if (!HANDLE.test(meta.handle ?? '')) fail(`handle "${meta.handle}" must be 2-30 lowercase letters, numbers, or dashes`);
  if (meta.handle !== folder) fail(`folder name must match meta.json handle "${meta.handle}"`);
  for (const key of ['title', 'description']) {
    if (typeof meta[key] !== 'string' || !meta[key].trim()) fail(`meta.json ${key} is empty`);
  }

  const assets = Array.isArray(meta.assets) ? meta.assets : [];
  const aiAssets = Array.isArray(meta.ai_assets) ? meta.ai_assets : [];
  for (const a of assets) {
    for (const key of ['file', 'source', 'license']) {
      if (typeof a?.[key] !== 'string' || !a[key].trim()) fail(`asset ${a?.file ?? '(unnamed)'} needs a ${key}`);
    }
  }

  const credited = new Set([...assets.map((a) => norm(a.file)), ...aiAssets.map((a) => norm(a?.file ?? a))]);
  for (const f of walk(dir)) {
    if (f.split('/').some((part) => part.startsWith('.'))) fail(`${f} is a hidden file or folder; remove it (never ship .claude/)`);
    if (KEY.test(readFileSync(join(dir, f), 'latin1'))) fail(`${f} contains something shaped like an API key; remove it and ship again`);
    const name = f.split('/').pop();
    if (FREE_NAMES.has(name) || FREE_EXTS.has(extname(f)) || credited.has(f)) continue;
    fail(`${f} is not credited; add it to meta.json assets (with source and license) or ai_assets`);
  }

  return { handle: meta.handle, title: meta.title.trim(), description: meta.description.trim(), path: `games/${folder}/` };
}

export function buildIndex(gamesDir) {
  const folders = readdirSync(gamesDir).filter((n) => lstatSync(join(gamesDir, n)).isDirectory());
  return folders.map((f) => checkGame(gamesDir, f)).sort((a, b) => a.title.localeCompare(b.title));
}

// A student PR may only add one new games/<handle>/ folder: no edits to other
// games, the build script, or the workflow.
export function checkPrScope(changedPaths, existingHandles) {
  const outside = changedPaths.filter((p) => !/^games\/[^/]+\/./.test(p));
  if (outside.length) throw new Error(`PR changes files outside games/: ${outside.join(', ')}`);
  const handles = [...new Set(changedPaths.map((p) => p.split('/')[1]))];
  if (handles.length !== 1) throw new Error(`PR must add exactly one game folder, found: ${handles.join(', ')}`);
  if (existingHandles.includes(handles[0])) throw new Error(`games/${handles[0]} already exists on main; pick another handle`);
  return handles[0];
}

if (process.argv[2] === '--pr-scope') {
  // Usage: node scripts/build-index.mjs --pr-scope <base-ref>
  const { execFileSync } = await import('node:child_process');
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
  const base = process.argv[3];
  try {
    const changed = git('-c', 'core.quotePath=false', 'diff', '--name-only', '--no-renames', `${base}...HEAD`);
    const existing = git('ls-tree', '--name-only', `${base}`, 'games/').map((p) => p.replace(/^games\//, ''));
    console.log(`PR scope ok: games/${checkPrScope(changed, existing)}/`);
  } catch (e) {
    console.error(`PR scope check failed: ${e.message}`);
    process.exit(1);
  }
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), '..', '..');
  try {
    const games = buildIndex(join(root, 'games'));
    writeFileSync(join(root, 'games.json'), JSON.stringify(games, null, 2) + '\n');
    console.log(`games.json: ${games.length} game(s)`);
  } catch (e) {
    console.error(`build failed: ${e.message}`);
    process.exit(1);
  }
}
