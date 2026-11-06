// Framework-free world-space walking inside one coach; the view supplies dt/input, tuning supplies the bounds.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Loop Engine contributors
// Adapted for Last Train Home under the terms of the MIT License.
// Coach-local space: x runs across the coach (width), z runs along it (length, front door at -z).
// `boundaryChoice` from the kit is deliberately NOT ported: automatic doorway decisions are forbidden.
const BOUND_KEYS = ['minX', 'maxX', 'minZ', 'maxZ', 'speed', 'turnSpeed'];
const FRAME_CLAMP = 0.05;

function checkedBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') throw new Error('movePlayer needs coach bounds from tuning');
  for (const key of BOUND_KEYS) if (!Number.isFinite(bounds[key])) throw new Error(`Coach bounds need a finite ${key} (from tuning)`);
  if (bounds.minX > bounds.maxX || bounds.minZ > bounds.maxZ) throw new Error('Coach bounds min must not exceed max');
  const maxStep = Number.isFinite(bounds.maxStep) ? bounds.maxStep : FRAME_CLAMP;
  return { ...bounds, maxStep };
}

export function movePlayer(player, { forward = 0, strafe = 0, turn = 0 } = {}, dt, bounds) {
  const b = checkedBounds(bounds);
  if (!Number.isFinite(dt) || dt <= 0) return { ...player };
  const step = Math.min(dt, b.maxStep), yaw = player.yaw + turn * step * b.turnSpeed;
  const length = Math.max(1, Math.hypot(forward, strafe));
  const f = forward / length, s = strafe / length;
  const dx = (Math.sin(yaw) * f + Math.cos(yaw) * s) * b.speed * step;
  const dz = (-Math.cos(yaw) * f + Math.sin(yaw) * s) * b.speed * step;
  return { x: Math.max(b.minX, Math.min(b.maxX, player.x + dx)), z: Math.max(b.minZ, Math.min(b.maxZ, player.z + dz)), yaw };
}
