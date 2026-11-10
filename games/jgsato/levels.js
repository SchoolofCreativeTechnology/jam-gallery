// The five courses, easiest first. Everything about a course lives in its entry here.
//
// points: the centre line, start to box. Each is [x, z, y, halfWidth, rails]:
//   x, z      where it is on the floor (the run heads away from the camera, toward -z)
//   y         elevation; hills and dips speed the head up and slow it down
//   halfWidth how far the deck reaches either side of the centre line
//   rails     'L', 'R', 'LR' or '': which sides of the segment that STARTS here have a
//             bumper rail. Rails bounce you back; open edges drop you into the void.
// cars:  from   fraction of the course before the first toy car shows up
//        gap    seconds between cars, at the start and at the end of the course
//        speed  how fast they cross, at the start and at the end of the course
//        warn   seconds of lane warning before a car pulls out
// jacks: jack-in-the-boxes beside the deck. at: [segment, fraction along it]; side: -1 left, 1 right
// stars: pickups. at: [segment, fraction]; off: -1 (left edge) to 1 (right edge). Each one takes time off.
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
      [-4, -6, 0.8, 2.2, 'R'],
      [-5, -14, 1.6, 2.0, ''],
      [-1, -21, 1.6, 1.9, 'L'],
      [4, -27, 0.8, 1.9, ''],
      [5, -35, 0.0, 2.0, 'R'],
      [1, -42, -0.4, 2.2, ''],
      [-1, -49, -0.4, 2.6, 'LR'],
      [-1, -55, -0.4, 3.2, ''],
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
    medals: [8.5, 11, 15.5],
  },
  {
    name: 'Spring Fever',
    tagline: 'Something is wound up tight.',
    points: [
      [0, 8, 0, 3.0, 'LR'],
      [0, 0, 0, 2.4, ''],
      [4, -7, 0.4, 2.0, 'L'],
      [4, -15, 0.8, 1.8, ''],
      [-1, -22, 0.8, 1.8, 'R'],
      [-5, -29, 0.4, 1.7, ''],
      [-4, -37, 0, 1.8, 'L'],
      [1, -44, 0.6, 1.6, ''],
      [3, -52, 1.2, 1.8, 'LR'],
      [1, -59, 1.2, 2.0, ''],
      [0, -65, 1.2, 3.0, ''],
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
    medals: [9.9, 13, 18],
  },
  {
    name: 'Downhill Derby',
    tagline: 'Gravity is not your friend.',
    points: [
      [0, 8, 3.0, 3.0, 'LR'],
      [0, 1, 2.6, 2.2, 'LR'],
      [-3, -7, 1.6, 1.8, ''],
      [-3, -15, 0.6, 1.6, 'R'],
      [2, -22, 0.2, 1.5, ''],
      [6, -29, 0.2, 1.6, 'L'],
      [5, -37, -0.8, 1.45, ''],
      [0, -44, -1.2, 1.5, ''],
      [-4, -51, -1.2, 1.6, 'R'],
      [-3, -59, -0.6, 1.5, ''],
      [1, -66, -0.6, 1.8, 'LR'],
      [1, -72, -0.6, 3.0, ''],
    ],
    cars: { from: 0.15, gap: [1.7, 1.15], speed: [6.0, 7.4], warn: 0.68 },
    jacks: [
      { at: [4, 0.5], side: 1 },
      { at: [7, 0.5], side: -1 },
      { at: [9, 0.5], side: 1 },
    ],
    stars: [
      { at: [2, 0.5], off: -0.7 },
      { at: [4, 0.5], off: -0.7 },
      { at: [6, 0.5], off: 0.7 },
      { at: [7, 0.6], off: 0.65 },
      { at: [9, 0.4], off: -0.65 },
    ],
    medals: [10.8, 14, 19.5],
  },
  {
    name: "Jambi's Gauntlet",
    tagline: 'Everything at once. Wish hard.',
    points: [
      [0, 8, 0, 2.8, 'LR'],
      [0, 1, 0, 1.9, ''],
      [4, -6, 0.6, 1.6, ''],
      [5, -14, 1.4, 1.45, 'L'],
      [1, -21, 1.4, 1.4, ''],
      [-4, -27, 0.6, 1.45, 'R'],
      [-6, -35, 0.6, 1.4, ''],
      [-2, -42, 1.2, 1.4, ''],
      [3, -48, 1.8, 1.45, 'L'],
      [4, -56, 1.0, 1.4, ''],
      [0, -63, 0.2, 1.4, ''],
      [-3, -70, 0.2, 1.5, 'R'],
      [-2, -78, 0.6, 1.45, ''],
      [0, -85, 0.6, 3.0, ''],
    ],
    cars: { from: 0.1, gap: [1.45, 1.0], speed: [6.4, 7.8], warn: 0.62 },
    jacks: [
      { at: [1, 0.6], side: 1 },
      { at: [4, 0.5], side: -1 },
      { at: [6, 0.5], side: 1 },
      { at: [9, 0.5], side: -1 },
      { at: [12, 0.4], side: 1 },
    ],
    stars: [
      { at: [2, 0.5], off: 0.7 },
      { at: [4, 0.5], off: 0.7 },
      { at: [6, 0.4], off: -0.7 },
      { at: [8, 0.5], off: 0.65 },
      { at: [10, 0.5], off: -0.65 },
    ],
    medals: [12.9, 17, 23.5],
  },
];
