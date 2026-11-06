// Every number the game uses: coach size, walking, door reach, camera, lighting and run rules.

// Coach-local space: x runs across the coach (width), z runs along it (length).
// The front door sits at z = 0, the rear door at z = COACH_DIMS.length.
export const COACH_DIMS = { width: 3, length: 12, height: 2.8 };

// The doors are physical. Walking into a doorway IS the decision: cross the front door to go on, turn
// around and cross the rear one to turn back. The bounds stop you just inside the doorway, so the walk
// itself can never push you through a wall, and DOOR_ZONE is the strip at each end that decides.
export const DOOR_ZONE = 0.5;
export const COACH_BOUNDS = {
  minX: -0.85, maxX: 0.85,
  minZ: DOOR_ZONE - 0.05, maxZ: COACH_DIMS.length - DOOR_ZONE + 0.05,
  speed: 3.5, turnSpeed: 1.8, maxStep: 0.05,
};

// Where you stand after walking through a door: just inside the door you came through, still facing the
// way you were already walking. The keys are the two engine choices — `continue` means you crossed a
// front door, `turn_back` a rear one.
export const ENTRY = {
  continue: { x: 0, z: COACH_DIMS.length - 1.2, yaw: 0 },
  turn_back: { x: 0, z: 1.2, yaw: Math.PI },
};

// Box sizes for the coach interior. Two benches line the walls with a wide central aisle.
export const COACH_GEOMETRY = {
  floorThickness: 0.1,
  wallThickness: 0.1,
  benchInset: 1.25,
  benchWidth: 0.55,
  benchHeight: 0.48,
  benchLength: 8,
  lampSize: 0.24,
  lampHeight: 0.36,
};

// Every node colour is one of these. The wood ones TINT the oak maps, so they are much lighter than the
// wood ends up looking; the bench and the lamp are used as-is. The anomaly catalogue recolours the lamp.
export const PALETTE = {
  floor: '#8f6b4a',
  wall: '#8a6446',
  ceiling: '#967a5c',
  cushion: '#a63a32',
  bench: '#5c6b3f',
  lamp: '#e85a3a',
};

// --- Look: one convincing coach, from the makers' reference palette -------------------------------
// Chestnut wood comes from the oak maps tinted by PALETTE; plain trim has no map, so its colour is final
// and must be darker than the tinted wood or it reads as a brighter wood than the panels.
export const WOOD = {
  trim: '#2e180a',
  roughness: 0.85,
  normalScale: 0.6,
  anisotropy: 4,
  deckRepeat: [2.5, 4],   // floor and ceiling: planks run along the coach (the map's planks run up its V)
  sideRepeat: [13, 0.7],  // long side-wall panels: vertical boards
  endRepeat: [3.3, 2],    // end walls: vertical boards
};

// Side walls are built as a sill panel, a header panel and five posts: four window bays with gaps.
export const WINDOW = { bays: 4, sill: 1, head: 2.05, post: 0.42, frameWidth: 0.04, inset: 0.05 };

// Glass pane in each window gap: thin, reflective, slightly blue.
export const GLASS = { color: '#a8c4d9', opacity: 0.22, metalness: 0.95, roughness: 0.03, envMapIntensity: 1.2 };

export const BENCH = { seatThickness: 0.09, backHeight: 0.42, backThickness: 0.07, cushionThickness: 0.08, legWidth: 0.09, legs: 4 };
export const BRASS = { color: '#a87f38', metalness: 0.85, roughness: 0.36, cornerCap: 0.16 };

// Overhead luggage rack: a rail and slats above the windows.
export const RACK = { depth: 0.55, drop: 0.42, railSize: 0.05, slats: 6, slatSize: 0.03 };

// --- The cast: four passengers, standing at the bench edge -----------------------------------------
// Every model here has its origin at its feet and faces +z out of Blender, so PASSENGER_Y = 0 stands one
// on the coach floor (its lowest vertex sits at y = 0.02) and a yaw of ±PI/2 turns it across the aisle to
// face the opposite bench. That is the angle to compare a passenger against its yokai from: you walk
// past it face on. x = ±0.95 is the bench's aisle edge (the bench itself starts at |x| = 0.975), so each
// one reads as a passenger who has just stood up, and the walking lane stays clear.
// One of each species, alternating benches, and no two scales matching, so four passengers never read as
// one model pasted four times. Heights at these scales: fox 1.35 m, rabbit 1.13 m, goat 1.17 m, mouse
// 0.93 m, against a 2.8 m coach. z sits clear of the bench legs (3, 5, 7, 9) and of both door zones.
// The mouse takes the rear-right seat, which is the first one seen after walking in through the front
// door — the newest and smallest passenger is the one you meet first.
export const PASSENGER_Y = 0;
export const PASSENGERS = [
  { id: 'passenger',   species: 'fox',    x: -0.95, z: 4.5, yaw:  Math.PI / 2, scale: 0.85 },
  { id: 'passenger-2', species: 'rabbit', x:  0.95, z: 2.7, yaw: -Math.PI / 2, scale: 0.90 },
  { id: 'passenger-3', species: 'goat',   x: -0.95, z: 7.4, yaw:  Math.PI / 2, scale: 0.85 },
  { id: 'passenger-4', species: 'mouse',  x:  0.95, z: 9.3, yaw: -Math.PI / 2, scale: 1 },
];

// Each species has the plain model and the burst-open one. Every path here is a file that is actually on
// disk: a path with nothing behind it is a failed request the browser prints in red.
export const PASSENGER_MODELS = {
  fox: { normal: 'assets/models/fox-normal.glb', anomaly: 'assets/models/fox-anomaly.glb' },
  rabbit: { normal: 'assets/models/rabbit-normal.glb', anomaly: 'assets/models/rabbit-anomaly.glb' },
  goat: { normal: 'assets/models/goat-normal.glb', anomaly: 'assets/models/goat-anomaly.glb' },
  mouse: { normal: 'assets/models/mouse-normal.glb', anomaly: 'assets/models/mouse-anomaly.glb' },
};

// The yokai swaps: the passenger keeps its own seat (same z, same facing) and only its model is replaced,
// by the one the maker modelled, at the size the maker modelled it.
// The fox's fan of 11 tails is 2.108 m wide — but once the fox faces the aisle that width lies ALONG the
// coach, and only its 0.795 m depth faces the side wall. Measured from the mesh: the deepest tail is
// 0.49 m behind the model's origin, so nudging the seat 5 cm in from the bench to x = 0.90 leaves that
// tail at |x| = 1.39 — 0.11 m of air inside the wall at |x| = 1.5. That 5 cm is the whole reason this
// entry is not the seat's own x: at the seat's 0.95 the tail would sit at 1.44, a 6 cm shave.
// The rabbit's long neck is thin (0.885 m wide, 0.448 m deep), so it stays exactly where its seat is.
export const YOKAI = {
  fox: { x: -0.90, z: 4.5, yaw: Math.PI / 2, scale: 1 },
  rabbit: { x: 0.95, z: 2.7, yaw: -Math.PI / 2, scale: 1 },
  // The goat anomaly is low and long rather than tall — it lies along the floor — so it keeps its seat's
  // spot and scale and lets its own shape do the work.
  goat: { x: -0.95, z: 7.4, yaw: Math.PI / 2, scale: 1 },
  // The mouse anomaly is the same height as the mouse and only a little wider, so it too stays exactly on
  // its seat. The whole change is what the animal is, which is the point.
  mouse: { x: 0.95, z: 9.3, yaw: -Math.PI / 2, scale: 1 },
};

// Every passenger's idle clip is the same length (5.04 s of slow head sway). Each mixer starts at a
// different point in it, 0.37 of the clip apart — near the golden ratio, so four mixers never line up
// again — because four passengers swaying together would read as a machine.
export const PASSENGER_IDLE = { offsetStep: 0.37 };

// --- The cat, its walk, and the camera that trails it -----------------------------------------------
// The player sees the cat only in the two intro shots, so its size and its gait live together here.
// Distances are metres and times are seconds, the two swings are radians, and `stride`, `bob` and
// `lookHeight` are shares of `height` instead (0.025 means 2.5% of the cat) — those are the three that
// keep the walk and the framing looking right if that one height number is raised. 0.85 m is a world
// choice, not a guess: the passengers standing at the bench edge are 1.0 m to 1.5 m tall, so the cat reads
// as one of the same small cast rather than as a person. Raise `height` past about 1.1 and it stops.
export const CAT_SHOT = {
  height: 0.85,

  // Boarding: four unhurried seconds down the coach, then a short blend onto the player's eye. Leaving:
  // the same framing at a slower pace, with a longer fade and blend, because it is the last thing the
  // player sees. startZ is where the feet start; the camera trails `camera.back` behind that.
  // `out.startZ` is set so the cat's walk covers exactly the coach it has to: from here it reaches the
  // front door right as the shot ends. Start it further back and the cat treads water against the wall
  // for the last second, legs still going, while it fades.
  in: { startZ: 9.8, speed: 1.25, walk: 4, blend: 0.9, fade: 0.7 },
  out: { startZ: 7.0, speed: 1.3, walk: 4.6, blend: 1.3, fade: 1.1 },

  // The gait is driven by distance covered, never by the clock, so it looks the same at any frame rate:
  // `stride` is one full left-right cycle (one body height, so a step is half a height, the same as a
  // person's), and `bob` is the rise at each mid-stance. A tired cat on a night train, so both are small.
  // The real model is a single mesh with no legs, so the body carries the whole walk: a rise and fall
  // twice a cycle, once per step, and a roll once a cycle as the weight goes from one foot to the other.
  // `bobSharp` below 1 sharpens the drop into each contact, so the footfalls read as weight landing
  // instead of the body floating through a sine; at 1 it is a plain sine. `legSwing` is only ever seen on
  // the box fallback cat, the one thing here that has hips to swing.
  gait: { ramp: 0.7, stride: 1, legSwing: 0.55, bob: 0.025, bobSharp: 0.65, sway: 0.03 },

  // Third person: the camera trails the cat, then lifts and pushes in onto the player's own eye, and
  // `lookHeight` keeps its place on the cat's body by moving with `height`. `back` must stay under
  // startZ, or the camera starts inside the rear wall of the coach.
  // `lookHeight` also sets the pitch, over the `back + lookAhead` throw — and it pulls two ways, so it is
  // not a free dial. Aim higher up the cat (a larger share) and the camera looks less downward, which
  // moves the cat *down* the frame, not up; past about 0.75 its feet reach the bottom edge. 0.55 holds
  // the pitch the shot was framed around, with the head just above centre. To move the cat up in frame,
  // shorten `lookAhead` or lower `height` instead of touching this.
  camera: { back: 1.8, height: 1.25, lookAhead: 2.6, lookHeight: 0.55 },
};

// The lantern light takes the shade's colour, so the red-lamp anomaly glows red. castShadow is off: the
// sun already carries the shadows and a point-light shadow costs six shadow maps.
export const LAMP = { stemLength: 0.42, emissiveIntensity: 1.1, lightIntensity: 5.5, lightDistance: 10, lightDecay: 2.2, castShadow: false, shadowMapSize: 512 };

// Cool blue water outside the windows, below the coach. The sun and the sky light land straight on a
// flat plane, so the colour is a deep one: it is deliberately much darker than the blue you want to see.
// A high roughness and a near-dead sky reflection keep the grazing view out of a window blue instead of
// washing it into the sun's glare.
export const WATER = { color: '#081826', size: 240, depth: -2.2, roughness: 0.95, metalness: 0, opacity: 0.95, envMapIntensity: 0.12 };

// The dusk HDR is the scene environment (cheap: no background work, and the brass and water reflect it).
export const ENVIRONMENT = { url: 'assets/dusk-sky.hdr', intensity: 0.27, exposure: 0.55 };

// Subtle contact shadows from the sun. The ceiling does not cast, so the sun keeps the interior lit, and
// the sun sits low enough beside the coach that the wall shadows the floor and the windows stripe it.
export const SHADOW = { mapSize: 1024, extent: 10, near: 0.5, far: 40, normalBias: 0.02 };

export const DOOR_PROMPT_RADIUS = 1.2;
export const PROMPT_TEXT = {
  front: 'Walk on through the door ahead',
  rear: 'Turn back through the door behind',
  ending: 'Walk through to get off',
};

export const CAMERA = { fov: 60, near: 0.1, far: 100, height: 1.6 };
export const LOOK_SENSITIVITY = 0.0032;
export const PITCH_LIMIT = 1.2;
export const MAX_FRAME_DT = 0.05;
// Where the reference coach is inspected from. This is NOT a free choice and it is not "the middle of
// the coach": it must be the same place a coach puts you when you have just walked in through a door
// (ENTRY.continue), or the coach you are asked to remember is a different view of the coach you are
// tested on.
// It was z = 6 — the middle — and that was the fairness bug the makers kept hitting: from the middle,
// facing the front, the goat (z 7.4) and the mouse (z 9.3) are BEHIND you. You never saw them unchanged.
// Then the next coach puts you at the rear door and you walk forward, straight past a goat and a mouse
// you have no memory of. A yokai swap on either one, or `passenger-gone` on the mouse's seat, is then a
// change to something the player has never seen, which reads exactly as "nothing changed but it failed
// me". From the rear door the whole coach is in front of you and every change is to something you saw.
export const SPAWN = { x: 0, z: COACH_DIMS.length - 1.2, yaw: 0 };

// Dusk sky over the sea: what shows above the horizon through the window gaps.
export const BACKDROP = '#0f1420';
export const LIGHTS = { hemisphere: 0.36, directional: 0.6 };
export const SUN_POSITION = [6, 5, 4];
// The sun aims at the middle of the 12 m coach, not at the origin, or only the front half is lit.
export const SUN_TARGET = [0, 0, 6];

// How long the on-screen text stays up, and how long a decision is held before the next coach.
export const MESSAGE_MS = 2200;
export const FEEDBACK_MS = 600;
export const RESET_FEEDBACK_MS = 1800;
export const STATION_MS = 1600;

// A run is four changed coaches: turn back at each one, walk on through everything else. Four, not eight,
// because four is how many a player can hold in their head on one ride — the anomaly POOL is much bigger
// than four, and which four you get is re-shuffled every run, so no two rides look alike.
export const GOAL = 4;
// Every ride deals exactly this mix: two coaches where a passenger has turned, and two where the coach
// itself is wrong. It is guaranteed, not left to the shuffle, so a ride is never four yokai in a row or
// four empty coaches, and every run teaches both halves of the rule. The counts sum to GOAL, and the deck
// tops a short category up from the other rather than ever dealing a run that cannot be finished — which
// is why the mix must never sum to less than GOAL.
export const RUN_MIX = { yokai: 2, environmental: 2 };
// A station announcement at a halfway mark. Every mark must be below the goal, so this shortens with it.
export const STATION_MARKS = [2];
// How many unchanged coaches may sit between two changed ones. At most one: the bag holds the whole run,
// and an anomaly must never be more than one normal coach away, or a run turns into a long walk with
// nothing to look at. Zero is allowed, so two changed coaches can follow each other — and most runs deal
// several in a row, which is what keeps a four-coach run down to six coaches or so of walking.
export const MIN_NORMALS = 0;
export const MAX_NORMALS = 1;
export const SEED = 'last-train-home-m1';

// --- The failed ride: the train keeps you -----------------------------------------------------------
// Five wrong turns in one ride and the run is over. Five is past a player who is reading the coaches and
// getting some of them wrong, but close enough that guessing runs them out of the ride. The count is
// shown in the HUD from the first coach, so the limit is never a surprise.
export const MAX_MISTAKES = 5;
export const DOOM = {
  // They stand there lit and do not move for this long, and then the coach goes dark.
  holdMs: 5000,
  // You are stood at the rear of the coach and they are between you and the front door: there is no walk
  // out of this, which is the point.
  // `pitch` matters as much as the line does. The eye is at 1.6 m and the camera is 60°, so at level gaze
  // the bottom of the frame is 1.6 - 0.577*d metres up the wall: anything nearer than about 2.8 m has its
  // feet out of shot, and the nearest of the four would have been completely invisible — the player would
  // have seen an empty coach with a monster somewhere further down it. Looking down 0.18 rad (10°) brings
  // all four into frame from where they actually stand. This is what makes them "right in front of you"
  // rather than "somewhere over there".
  player: { x: 0, z: 11.2, yaw: 0 },
  pitch: -0.18,
  // Nearest first, so the four of them fill the aisle one behind the other with no way past. The models
  // are authored facing +z and the player looks down -z, so a yaw of 0 turns every one of them to face the
  // player. Each z comes off the models' own measured depths, so no two bodies touch, and the fox is
  // scaled down because its fan of tails is 2.108 m wide — at scale 1 it would pass through both benches.
  // The nearest one stands 1.95 m out, which is a whole body in frame from the 11.2 m mark: the four of
  // them are checked to be fully inside the lens, not just present in the room.
  line: [
    { species: 'mouse', x: 0.30, z: 9.0, scale: 1 },
    { species: 'goat', x: -0.32, z: 8.3, scale: 1 },
    { species: 'rabbit', x: 0.30, z: 7.5, scale: 1 },
    { species: 'fox', x: 0, z: 6.5, scale: 0.88 },
  ],
};

// --- The winning shot: the field the cat arrives in -------------------------------------------------
// The coach world is hidden at the cut and this midday field takes its place, so the cat walks out of the
// carriage and across green grass toward a small house. Warm greens and a pale blue sky on purpose: the
// deliberate opposite of the coach's dusk blues, so arriving somewhere green reads as a payoff.
// Everything is world space — the shot is a cut, so it does not share the coach's axes. The cat walks
// along -z; the carriage sits behind it at +z and the camera trails it.
export const ENDING = {
  // `walk` is the full-pace stretch and `blend` the ease-out, so duration = walk + blend; the distances
  // are set so the cat covers startZ to endZ in exactly that time and never treads water against the end.
  duration: 5.0,
  walk: 4.2,
  blend: 0.8,
  ramp: 0.6,
  speed: 1.2,          // metres per second
  startZ: 1.1,         // the cat's feet, a metre clear of the carriage at the cut
  endZ: -4.0,          // and where it stops, out in the open field

  sky: '#93c5ea',      // the daytime sky, and the colour the grass fades into at the horizon
  fog: { near: 25, far: 140 },
  ground: { size: 260, color: '#4e7a34', roughness: 1 },
  sun: { color: '#fff1cf', intensity: 2.6, position: [-7, 15, 9], target: [-2, 0, -6] },
  fill: { sky: '#cfe6ff', ground: '#495a2c', intensity: 2.0 },

  // The dark end of the carriage the cat has just left: one box for its body and a slab for its roof.
  // The coach group itself is hidden for the cut, so this is a stand-in that keeps the train in frame.
  carriage: { frontZ: 2.4, depth: 5, width: 3, height: 2.8, body: '#2a1d13', roof: '#23252c', roofSlab: [3.4, 0.26, 5.4] },

  // A small house across the field: a cream body, a four-sided pitched roof, and one warm lit window on
  // the face toward the camera, with a little light so it glows.
  house: {
    at: [-4.0, 0, -13],
    body: [6, 4, 5], bodyColor: '#e6d9bd',
    roofRadius: 4.3, roofHeight: 2.4, roofColor: '#8a4a37',
    window: [1.0, 1.2], windowAt: [-1.3, 2.1], windowColor: '#ffce78', windowGlow: 1.8,
    windowLight: { intensity: 9, distance: 14 },
  },

  // Third person, trailing the cat from behind and to the right. `start`/`end` are the camera's x and y
  // (its z follows the cat by `trail + pull`), so it drifts in and lifts as the carriage slides out of
  // frame and the field takes its place. trail at t=0 must stay shorter than carriage.frontZ - startZ,
  // or the camera starts inside the carriage it is filming.
  camera: { start: [2.5, 1.65], end: [1.6, 2.15], trail: 0.9, pull: 1.0, lookHeight: 0.5, lookAhead: 0.5 },
};
