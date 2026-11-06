// scanner.js — the survey scan meter: how fast it fills at a given altitude, and how far the run has got.
import * as T from './tuning.js';

// The scan rate at the two ends of the altitude band, as a fraction of a whole scan per second.
// The Math.max guards keep a maker from turning a tuning edit into a division by zero.
const ALTITUDE_SPAN = Math.max(1e-6, T.ALTITUDE_HIGH - T.ALTITUDE_LOW);
const RATE_LOW = 1 / Math.max(0.001, T.SCAN_SECONDS_LOW);    // a whole scan in SCAN_SECONDS_LOW at ALTITUDE_LOW
const RATE_HIGH = 1 / Math.max(0.001, T.SCAN_SECONDS_HIGH);  // and in SCAN_SECONDS_HIGH at ALTITUDE_HIGH

// The scan rate at this altitude: linear between the two ends, and flat outside them.
export function scanRateAt(altitude) {
  const t = Math.min(1, Math.max(0, (altitude - T.ALTITUDE_LOW) / ALTITUDE_SPAN));
  return RATE_LOW + (RATE_HIGH - RATE_LOW) * t;
}

// The multiplier the HUD shows: 1.0 at the slowest altitude (the top of the band), up to
// SCAN_SECONDS_HIGH / SCAN_SECONDS_LOW at the bottom. Always at least 1, so it can never divide by zero.
export function scanRateMultiple(altitude) {
  return scanRateAt(altitude) / RATE_HIGH;
}

// How far the scan has got, from 0 to 1. Only the run state calls updateScan, so it is frozen on any other screen.
let progress = 0;

export function resetScan() {
  progress = 0;
}

export function updateScan(dt, altitude) {
  progress = Math.min(1, progress + scanRateAt(altitude) * dt);
}

export function scanProgress() {
  return progress;
}

export function scanDone() {
  return progress >= 1;
}
