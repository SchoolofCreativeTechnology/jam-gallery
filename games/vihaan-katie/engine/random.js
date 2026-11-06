// Framework-free randomness helpers: seeded RNG, Fisher-Yates shuffle, deep freeze and clone.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Loop Engine contributors
// Adapted for Last Train Home under the terms of the MIT License.
export function seededRandom(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1));[result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
export const clone = (value) => structuredClone(value);
