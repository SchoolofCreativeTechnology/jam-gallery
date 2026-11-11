// The five courses, easiest first. Everything about a course lives in its entry here.
//
// points: the centre line, start to box. Each is [x, z, y, halfWidth, rails]:
//   x, z      where it is on the floor (the run heads away from the camera, toward -z)
//   y         elevation; hills and dips speed the head up and slow it down
//   halfWidth how far the deck reaches either side of the centre line
//   rails     'L', 'R', 'LR' or '': which sides of the segment that STARTS here have a
//             bumper rail. Rails bounce you back; open edges drop you into the void.
//             'G' means the segment starting here is broken track: a kicker ramp, then a gap to jump.
// cars:  from   fraction of the course before the first toy car shows up
//        gap    seconds between cars, at the start and at the end of the course
//        speed  how fast they cross, at the start and at the end of the course
//        warn   seconds of lane warning before a car pulls out
// jacks: jack-in-the-boxes beside the deck. at: [segment, fraction along it]; side: -1 left, 1 right
// stars: pickups. at: [segment, fraction]; off: -1 (left edge) to 1 (right edge); up: extra height
//        (for a star you catch in mid-air). Each one takes time off.
// medals: target times, in seconds after the star bonus, for gold / silver / bronze.

export const levels = [
  {
    name: 'The Big Rug',
    tagline: 'Roll him home. Mind the edges.',
    points: [
      [0, 8, 0, 3.4, 'LR'],
      [0, 0, 0, 3.0, 'LR'],
      [3, -7, 0.5, 2.8, 'LR'],
      [5, -14, 1.0, 2.6, ''],
      [3, -21, 0.6, 2.5, ''],
      [-1, -28, 0.2, 2.6, 'LR'],
      [-2, -35, 0, 3.0, 'LR'],
      [-2, -41, 0, 3.4, ''],
    ],
    cars: { from: 0.32, gap: [2.6, 2.0], speed: [4.2, 5.0], warn: 1.0 },
    jacks: [],
    stars: [
      { at: [1, 0.5], off: -0.7 },
      { at: [3, 0.5], off: 0.65 },
      { at: [5, 0.4], off: -0.6 },
    ],
    medals: [6.3, 8.2, 11.5],
  },
  {
    name: 'Block Party',
    tagline: 'Hills, dips, and fewer bumpers.',
    points: [
      [0, 8, 0, 3.0, 'LR'],
      [0, 1, 0, 2.6, 'L'],
      [-4, -6, 1.6, 2.2, 'R'],
      [-5, -14, 3.2, 2.0, ''],
      [-1, -21, 3.2, 1.9, 'L'],
      [4, -27, 1.6, 1.9, ''],
      [5, -35, 0, 2.0, 'R'],
      [1, -42, -0.8, 2.2, ''],
      [-1, -49, -0.8, 2.6, 'LR'],
      [-1, -55, -0.8, 3.2, ''],
    ],
    cars: { from: 0.18, gap: [2.1, 1.5], speed: [5.0, 6.2], warn: 0.85 },
    jacks: [
      { at: [5, 0.5], side: 1 },
    ],
    stars: [
      { at: [2, 0.6], off: 0.7 },
      { at: [3, 0.7], off: -0.75 },
      { at: [5, 0.5], off: -0.7 },
      { at: [7, 0.5], off: 0.7 },
    ],
    medals: [8.7, 11.3, 15.8],
  },
  {
    name: 'Spring Fever',
    tagline: 'Something is wound up tight.',
    points: [
      [0, 8, 0, 3.0, 'LR'],
      [0, 0, 0, 2.4, ''],
      [4, -7, 1.2, 2.0, 'L'],
      [4, -15, 2.4, 1.8, ''],
      [-1, -22, 2.4, 1.8, 'R'],
      [-5, -29, 1.2, 1.7, ''],
      [-4, -37, 0, 1.8, 'L'],
      [1, -44, 1.8, 1.6, ''],
      [3, -52, 3.6, 1.8, 'LR'],
      [1, -59, 3.6, 2.0, ''],
      [0, -65, 3.6, 3.0, ''],
    ],
    cars: { from: 0.2, gap: [1.9, 1.35], speed: [5.5, 6.8], warn: 0.78 },
    jacks: [
      { at: [1, 0.6], side: 1 },
      { at: [3, 0.5], side: -1 },
      { at: [5, 0.5], side: 1 },
      { at: [7, 0.5], side: -1 },
    ],
    stars: [
      { at: [1, 0.6], off: 0.75 },
      { at: [3, 0.3], off: -0.7 },
      { at: [5, 0.75], off: 0.7 },
      { at: [7, 0.3], off: -0.7 },
    ],
    medals: [10.4, 13.5, 18.8],
  },
  {
    name: 'Downhill Derby',
    tagline: 'Build up speed. Trust the ramp.',
    points: [
      [0, 8, 7.5, 3.0, 'LR'],
      [0, 1, 6.5, 2.2, 'LR'],
      [-3, -7, 4, 1.8, ''],
      [-3, -15, 1.5, 1.6, 'R'],
      [2, -22, 0.5, 1.5, ''],
      [6, -29, 0.5, 1.6, 'L'],
      [5, -37, -2, 1.45, ''],
      // The run-up: a steep, railed straight. Don't brake.
      [2, -44, -3.2, 1.7, 'LR'],
      [2, -52, -6.4, 1.7, 'LR'],
      [2, -58, -7.4, 1.7, 'LR'],
      // 'G': broken track. The deck kicks up at the lip; clear the gap or drop.
      [2, -60, -7.5, 1.7, 'G'],
      [2, -63.2, -8.4, 1.7, 'LR'],
      [-1, -70, -8.4, 1.6, ''],
      [-4, -77, -8.0, 1.5, 'R'],
      [-3, -84, -8.4, 1.6, ''],
      [0, -90, -8.4, 3.0, ''],
    ],
    cars: { from: 0.15, gap: [1.7, 1.15], speed: [6.0, 7.4], warn: 0.68 },
    jacks: [
      { at: [4, 0.5], side: 1 },
      { at: [6, 0.5], side: -1 },
      { at: [12, 0.5], side: 1 },
      { at: [14, 0.5], side: -1 },
    ],
    stars: [
      { at: [2, 0.5], off: -0.7 },
      { at: [4, 0.5], off: -0.7 },
      { at: [6, 0.5], off: 0.7 },
      { at: [10, 0.5], off: 0, up: 0.9 }, // in mid-air over the gap
      { at: [13, 0.4], off: -0.65 },
    ],
    medals: [12.6, 16.4, 22.9],
  },
  {
    name: "Jambi's Gauntlet",
    tagline: 'Everything at once, then down the drain.',
    points: [
      [0, 8, 0, 2.8, 'LR'],
      [0, 1, 0, 1.9, ''],
      [4, -6, 2.1, 1.6, ''],
      [5, -14, 4.9, 1.45, 'L'],
      [1, -21, 4.9, 1.4, ''],
      [-4, -27, 2.1, 1.45, 'R'],
      [-6, -35, 2.1, 1.4, ''],
      [-2, -42, 4.2, 1.4, ''],
      [3, -48, 6.3, 1.45, 'L'],
      [4, -56, 5.5, 1.4, ''],
      [4, -62, 5.2, 1.5, 'R'],
      // The funnel: a spiral that tightens and drops toward his box at the bottom.
      // The rail is on the outside; the inside edge is open all the way down.
      ...spiral({ cx: -6, cz: -70, r0: 10, r1: 2.6, turns: 1.25, y0: 5, y1: -1.5, w0: 1.5, w1: 1.7 }),
    ],
    cars: { from: 0.1, gap: [1.45, 1.0], speed: [6.4, 7.8], warn: 0.62 },
    jacks: [
      { at: [1, 0.6], side: 1 },
      { at: [4, 0.5], side: -1 },
      { at: [6, 0.5], side: 1 },
      { at: [14, 0.5], side: 1 },
      { at: [18, 0.5], side: 1 },
    ],
    stars: [
      { at: [2, 0.5], off: 0.7 },
      { at: [4, 0.5], off: 0.7 },
      { at: [6, 0.4], off: -0.7 },
      { at: [8, 0.5], off: 0.65 },
      { at: [13, 0.5], off: -0.6 },
      { at: [20, 0.5], off: -0.6 },
    ],
    medals: [18.3, 23.8, 33.2],
  },
];

// Points for a spiral that winds counter-clockwise (seen from above) inward and downward,
// starting due east of its centre and heading away from the camera. Rail on the outside.
function spiral({ cx, cz, r0, r1, turns, y0, y1, w0, w1, step = 30 }) {
  const pts = [];
  const total = turns * 360;
  for (let a = 0; a <= total + 1e-6; a += step) {
    const u = a / total;
    const r = r0 + (r1 - r0) * u;
    const rad = (a * Math.PI) / 180;
    const last = a + step > total + 1e-6;
    pts.push([
      +(cx + r * Math.cos(rad)).toFixed(2),
      +(cz - r * Math.sin(rad)).toFixed(2),
      +(y0 + (y1 - y0) * u).toFixed(2),
      +(w0 + (w1 - w0) * u * u).toFixed(2),
      last ? '' : 'R',
    ]);
  }
  return pts;
}
