// Four more anomalies, each one the mere presence of a prop node from props.js, which is invisible in
// the baseline and shown by the one operation below. Same shape as an events.js CATALOG entry.
// The last of them, `flickering-lamp`, is the only one with any time in it: its node turns the lamp's
// stutter on, and props.js's propTick does the flickering.
export const NEW_ANOMALIES = [
  {
    id: 'footprints',
    category: 'environmental',
    explanation: 'There are footprints on the floor.',
    operations: [
      { type: 'visible', target: 'prop-footprints', value: true },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
  {
    id: 'shoji-door',
    category: 'environmental',
    explanation: 'The door at the front is a paper shoji door.',
    operations: [
      { type: 'visible', target: 'prop-shoji', value: true },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
  {
    id: 'broken-window',
    category: 'environmental',
    explanation: 'One of the windows is shattered.',
    operations: [
      { type: 'visible', target: 'prop-broken-window', value: true },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
  {
    id: 'flickering-lamp',
    category: 'environmental',
    explanation: 'One of the lamps is flickering.',
    operations: [
      { type: 'visible', target: 'prop-flicker-lamp', value: true },
    ],
    requiresAssets: [],
    requiresCapabilities: [],
  },
];
