// Balance and presentation controls; encounter progression never depends on wall-clock time.
export const CASH_START = 120;
export const RENT = 25;
export const CUSTOMERS_PER_DAY = 8;
export const MIN_OFFER = 1;
export const MAX_OFFER = 500;
export const INTEREST_START = 0.24;
export const INTEREST_PER_GOOD_PITCH = 0.19;
export const INTEREST_PER_BAD_PITCH = -0.025;
export const SKEPTICISM_PER_BLUFF = 0.14;
export const PATIENCE_START = 7;
export const PATIENCE_PER_PITCH = -1;
export const WALK_AWAY_PATIENCE = 0;
export const OFFER_ACCEPT_MARGIN = 0.08;
export const COUNTER_SHIFT = 0.1;
export const AI_TIMEOUT_MS = 9000;
export const TYPEWRITER_SPEED = 28;
export const METER_LERP = 0.15;
export const ITEM_REVEAL_TIME = 0.35;
export const TRANSITION_MS = 1100;
export const NIGHT_START = 5;
export const MAX_PITCH_LENGTH = 12000;
export const MAX_HISTORY = 12;

// Voice-bargaining values are ordered easy, balanced, hard.
export const BARGAIN_TUNING = Object.freeze({
  receptivenessStart: Object.freeze([46, 36, 28]),
  evidenceGain: Object.freeze([22, 19, 16]),
  honestyGain: Object.freeze([14, 12, 10]),
  bluffPenalty: Object.freeze([8, 10, 12]),
  benefitOfDoubtGain: Object.freeze([8, 7, 6]),
});
