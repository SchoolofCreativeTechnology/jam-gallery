// Declarative baseline + anomaly operations: validate a scene, validate an anomaly, derive the changed scene.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Loop Engine contributors
// Adapted for Last Train Home under the terms of the MIT License.
import { clone, freeze } from './random.js';

const vector = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const color = (v) => typeof v === 'string' && /^#[a-fA-F0-9]{6}$/.test(v);
const TRANSFORMS = ['position', 'rotation', 'scale'];
const OPERATIONS = [...TRANSFORMS, 'visible', 'color', 'asset'];

export function validateBaseline(baseline) {
  if (!Array.isArray(baseline) || !baseline.length) throw new Error('Baseline must contain scene nodes');
  const ids = new Set();
  for (const node of baseline) {
    if (!node || typeof node.id !== 'string' || !node.id || ids.has(node.id)) throw new Error('Scene node IDs must be nonempty and unique');
    ids.add(node.id);
    if (!vector(node.position) || !vector(node.rotation) || !vector(node.scale) || node.scale.some((x) => x <= 0)) throw new Error(`Invalid transform: ${node.id}`);
    if (typeof node.visible !== 'boolean' || !color(node.color)) throw new Error(`Invalid appearance: ${node.id}`);
    if (node.asset !== null && typeof node.asset !== 'string') throw new Error(`Invalid asset: ${node.id}`);
  }
  return ids;
}

export function validateAnomaly(entry, baseline) {
  const targets = new Map(baseline.map((node) => [node.id, node]));
  if (!entry || typeof entry.id !== 'string' || !entry.id || typeof entry.explanation !== 'string' || !entry.explanation.trim()) throw new Error('Anomaly needs an ID and explanation');
  if (!Array.isArray(entry.operations) || !entry.operations.length) throw new Error(`Missing operations: ${entry.id}`);
  for (const key of ['requiresAssets', 'requiresCapabilities']) if (!Array.isArray(entry[key]) || entry[key].some((x) => typeof x !== 'string')) throw new Error(`Invalid ${key}: ${entry.id}`);
  for (const op of entry.operations) {
    if (!targets.has(op.target)) throw new Error(`Unknown target ${op.target} in ${entry.id}`);
    if (TRANSFORMS.includes(op.type)) {
      if (!vector(op.value) || (op.type === 'scale' && op.value.some((x) => x <= 0))) throw new Error(`Invalid transform operation: ${entry.id}`);
    } else if (op.type === 'visible') {
      if (typeof op.value !== 'boolean') throw new Error(`Invalid visibility: ${entry.id}`);
    } else if (op.type === 'color') {
      if (!color(op.value)) throw new Error(`Invalid color: ${entry.id}`);
    } else if (op.type === 'asset') {
      if (typeof op.value !== 'string' || !entry.requiresAssets.includes(op.value)) throw new Error(`Asset operation must declare its required asset: ${entry.id}`);
    } else throw new Error(`Unsupported operation ${op.type}`);
  }
  if (JSON.stringify(deriveScene(baseline, entry)) === JSON.stringify(baseline)) throw new Error(`Anomaly makes no state change: ${entry.id}`);
}

// Always derive from baseline, never from the previously mutated scene.
export function deriveScene(baseline, entry = null) {
  const scene = clone(baseline), nodes = new Map(scene.map((node) => [node.id, node]));
  for (const op of entry?.operations ?? []) {
    const node = nodes.get(op.target);
    if (!node) throw new Error(`Unknown scene target ${op.target}`);
    if (!OPERATIONS.includes(op.type)) throw new Error(`Unsupported operation ${op.type}`);
    node[op.type] = clone(op.value);
  }
  return freeze(scene);
}
