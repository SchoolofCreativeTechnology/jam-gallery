// The four worlds a survey can launch: a display name, the terrain shape and surface colours the ground is built
// from, the flat colours read off the reference images, and the survey result that world comes back with — the
// habitability percentage and the finding lines on the report.
// The reference images are look references only: the game never loads them and none of their art is copied.

// PLACEHOLDER SURVEY RESULTS: `habitability` and the two `findings` lines on each world below are stand-in text
// for the makers to replace with their own wording. The story is that every world comes back unsuitable, so
// every percentage stays below 50.

// Every world carries a `terrain` object with the same field names: the full field list, and what each number
// means, is in TERRAIN_DEFAULT in tuning.js, and terrain.js is what reads them. Two of those fields are the look:
//   `shade`   the vertex colours. The ground is painted low -> mid -> high by height, then bare `steep` colour on
//             the steep faces. lowBand/highBand are fractions of this world's own lowest-to-highest ground and
//             steepBand is read against its own steep faces, so the same numbers mean the same thing on all four.
//   `texture` which painted canvas pattern goes over it for close-up grain: 'ice', 'desert', 'jungle', 'alpine'.
// `ground`, `sky` and `rock` stay the flat colours: the ground's is the tint the terrain falls back to if a world
// ever has no `shade` scheme, and ui.js and main.js read the set of them.
export const PLANETS = [
  // planet-ice-cave.jpg: blue-white ice lit from a cave mouth, vivid cyan walls, dark slate in the shadows.
  // Sharp fractured ridges and crevasses, pale blue-white with cyan down in the crevices and on the steep walls.
  // cave: true gives ICE a roof over it — the ground's own shape raised and drawn from underneath, so this is the
  // one world you fly through rather than over. The roof's height and this world's own flight ceiling are both in
  // tuning.js (CAVE_CEILING, CAVE_FLY_CEILING).
  { name: 'ICE',    ground: '#d7ecf4', sky: '#5f93ad', rock: '#22708e', cave: true,
    // Cold and bright: a high blue-white key, hard blue in the shadows and near-white highlights (planet-ice.jpg).
    light: { key: '#eaf6ff', keyIntensity: 2.8, bearing: -28, elevation: 44,
      sky: '#dff0ff', ground: '#2a4a63', ambient: 1.9 },
    habitability: 12,                                                     // PLACEHOLDER: percent, keep below 50
    findings: ['Water ice across the whole survey strip.',                // PLACEHOLDER: two short lines for the report
      'Air too thin to hold heat or to breathe.'],
    terrain: {
      amplitude: 6.8,        // metres: about 8.5 m of relief, so the ice has real height to it
      zFrequency: 1,         // one ridge system per tile: 300 m crest to crest, filled in by the five octaves
      xFrequency: 0.12,      // the ridges grow and shrink across the strip instead of running dead straight
      xDepth: 0.45,
      rollMix: 0.35,         // mostly the jagged part: fracture, not rolling hills
      skew: 0.1,
      octaves: 5,            // 300 m ridges down to 19 m splinters: fractured ice, not a wave
      ridgeSharpness: 1.8,   // sharp crests with flat crevasse floors
      fracture: 1.2,         // each octave offset from the last, so the cracks land on the flanks too
      flatTops: 0,           // nothing flat about ice
      segmentsX: 200, segmentsZ: 150,  // 2 m mesh: fine enough for the splinters, and for smooth shading
      shade: {
        low: '#3f9fc4',      // cyan down in the crevasses
        mid: '#dceff8',      // blue-white over most of the ice
        high: '#ffffff',     // sunlit ice on the ridge tops
        steep: '#2f86a8',    // deep cyan on the steep walls
        lowBand: [0.03, 0.2], highBand: [0.66, 0.88], steepBand: [0.5, 1]
      },
      texture: 'ice' },
  },
  // planet-desert.jpg: a deep orange sunset, tan and olive flats, rust mountains, green scrub.
  // Long lopsided dunes, low and wide, with a few flat-topped mesas and olive on the flats.
  { name: 'DESERT', ground: '#bd8b58', sky: '#c96a24', rock: '#8a4c2a',
    // Bright, hazy, high-key and washed out: a high sun, almost no contrast (planet-desertmodel.jpg).
    light: { key: '#fff3dd', keyIntensity: 2.4, bearing: -20, elevation: 52,
      sky: '#e9dcc4', ground: '#b98f5e', ambient: 2.2 },
    habitability: 24,
    findings: ['Dry from pole to pole; no open water found.',
      'Dust storms hide the surface for weeks at a time.'],
    terrain: {
      amplitude: 3.0,        // low ground: about 5.5 m of relief over a whole tile
      zFrequency: 1,         // one dune system per 300 m tile: long dunes, and flat tops between them
      xFrequency: 0.05,      // very slowly across the strip: the dunes stay long
      xDepth: 0.3,
      rollMix: 0.85,         // almost all rolling
      skew: 0.35,            // lopsided: a long windward face and a short leeward one
      octaves: 2,
      ridgeSharpness: 1.1,
      fracture: 1.2,
      flatTops: 0.6,         // squashes the wave against its own crests: flat-topped mesas
      segmentsX: 160, segmentsZ: 120,  // 2.5 m mesh: the dunes are long and smooth, so they need less
      shade: {
        low: '#7f8253',      // olive patches on the flats, as in the reference
        mid: '#c79b62',      // tan sand
        high: '#e3c18e',     // pale sand on the crests and the mesa tops
        steep: '#9a7444',    // darker tan down the steep dune faces
        lowBand: [0.02, 0.16], highBand: [0.68, 0.95], steepBand: [0.55, 1]
      },
      texture: 'desert' },
  },
  // planet-jungle-river.jpg: a deep green canopy cut by a brown river, under a hazy pale sky.
  // Soft low hills, hardly any relief — the canopy is what you see — with brown down in the channels.
  { name: 'JUNGLE', ground: '#3f6f33', sky: '#87996b', rock: '#6b4a2e',
    // Dim and green-filtered, light coming down through the canopy: the darkest world (planet-jungle.jpg).
    light: { key: '#cfe0a0', keyIntensity: 1.4, bearing: -15, elevation: 38,
      sky: '#c8dca8', ground: '#233018', ambient: 1.0 },
    habitability: 38,
    findings: ['Dense canopy over every kilometre surveyed.',
      'Water only in the deep river channels.'],
    terrain: {
      amplitude: 1.6,        // hardly any relief at all: about 2.8 m
      zFrequency: 2,
      xFrequency: 0.06,
      xDepth: 0.3,
      rollMix: 1,            // pure rolling hills
      skew: 0.15,
      octaves: 1,
      ridgeSharpness: 1,
      fracture: 1.2,
      flatTops: 0,
      segmentsX: 140, segmentsZ: 105,  // 2.8 m mesh: the lowest ground of the four needs the least mesh
      shade: {
        low: '#5c4526',      // brown channels
        mid: '#2f5c2a',      // deep green canopy
        high: '#417f34',     // lighter green over the crests
        steep: '#4a3520',    // brown banks
        lowBand: [0, 0.13], highBand: [0.62, 1], steepBand: [0.5, 1]
      },
      texture: 'jungle' },
  },
  // planet-alpine-ridge.jpg: bright green ridges over grey rock, under a flat pale grey sky.
  // The sharpest world of the four: green ridges, grey rock on the steep faces, white above the snow line.
  { name: 'ALPINE', ground: '#64923f', sky: '#a8b2b8', rock: '#8f959a',
    // Golden hour: a low warm gold key raking in from the left, cool blue-grey in the shadowed valley
    // (mountain models.jpg).
    light: { key: '#ffd7a0', keyIntensity: 2.6, bearing: -35, elevation: 13,
      sky: '#ffe9c6', ground: '#5d6b3a', ambient: 1.1 },
    habitability: 29,
    findings: ['Green ridges, but no shelter from the wind.',
      'Thin air at every altitude surveyed.'],
    terrain: {
      amplitude: 14.0,       // the tall world, well clear of the other three: about 17 m of relief, twice ICE's
      zFrequency: 1,
      xFrequency: 0.12,
      xDepth: 0.45,
      rollMix: 0.3,          // mostly fractured: ridges, not hills
      skew: 0.1,
      octaves: 5,            // the finest fracture of any world
      ridgeSharpness: 2,     // and the sharpest crests
      fracture: 1.2,
      flatTops: 0,
      segmentsX: 200, segmentsZ: 150,  // 2 m mesh for the finest splinters of any world
      shade: {
        low: '#4e8a36',      // green down in the hollows
        mid: '#63a244',      // bright green ridges
        high: '#f5f8fb',     // white above the snow line
        steep: '#8a9096',    // grey rock on the steep faces
        lowBand: [0, 0.3], highBand: [0.76, 0.86], steepBand: [0.5, 1]
      },
      texture: 'alpine' },
  }
];
