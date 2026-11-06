// Every tunable number for Comic Runner, in one place.

// --- Playfield / panel ---
export const PLAYFIELD_W = 960;      // logical panel width in game units
export const PLAYFIELD_H = 540;      // logical panel height in game units
export const PANEL_MARGIN = 22;      // inset of the comic panel border from the playfield edge
export const GROUND_Y = 460;         // y of the ground line, measured from the top of the playfield
export const GROUND_THICKNESS = 6;   // thickness of the ink ground line
export const OUTLINE_WIDTH = 4;      // chunky ink outline weight for shapes and player
export const TEXT_OUTLINE_WIDTH = 2.0; // ink outline for lettering: thick enough to read, thin enough to avoid overlap
export const MAX_DT = 1 / 30;        // longest step we simulate, so a stalled tab can't teleport the player

// --- Player ---
export const GRAVITY = 2200;         // downward acceleration in units per second squared
export const MAX_FALL_SPEED = 1400;  // terminal falling speed, keeps the fall readable
export const JUMP_VELOCITY = -820;   // upward launch speed on jump (negative is up)
export const MAX_JUMPS = 2;          // jumps allowed before the player must touch ground again
export const DOUBLE_JUMP_VELOCITY = -560; // upward speed of the second, weaker mid-air jump
export const MOVE_SPEED = 260;       // horizontal run speed in units per second
export const PLAYER_W = 46;          // player width
export const PLAYER_H = 56;          // player height
export const PLAYER_START_X = 220;   // player centre x at the start of a run
export const SHAPE_ROUND = 0.34;     // corner rounding of the wedge, as a fraction of the player's short side
export const EYE_OFFSET_X = -0.05;   // eye centre x, as a fraction of player width
export const EYE_OFFSET_Y = -0.52;   // eye centre y, as a fraction of player height above the feet
export const EYE_RADIUS_X = 0.16;    // eye radius x, as a fraction of player width
export const EYE_RADIUS_Y = 0.14;    // eye radius y, as a fraction of player height

// --- Slash ---
export const SLASH_DURATION = 0.18;    // seconds the swing arc stays on screen and can hit
export const SLASH_REACH = 78;         // arc radius, how far in front of the shoulder the swing reaches
export const SLASH_THICKNESS = 12;     // stroke weight of the arc, and half of it is the hit tolerance
export const SLASH_ARC_SPREAD = 2.6;   // total angular sweep of the arc in radians, centred on facing
export const SLASH_SAMPLES = 64;       // points sampled along the arc for hit detection
export const SHOULDER_HEIGHT = 0.55;   // arc pivot height above the feet, as a fraction of player height

// --- Monsters ---
// One roster per world, each mixing a low ground crawler you jump over or stomp
// on the head with a flying threat you run under or slash mid-air.
// w/h = size in units, flying = airborne, speedMult = per-type speed multiplier
// on MONSTER_SPEED, weight = relative chance of being picked for a spawn slot.
export const MONSTER_SPEED = 110;        // base leftward speed in units per second, before the per-type multiplier
export const MONSTER_SPEED_PANEL_RAMP = 0.07; // extra speed multiplier added per panel past the first
export const MONSTER_FLY_Y = 388;        // bottom y of a flying monster: above the hero's head, so you can run under it
export const MONSTER_FLY_BOB = 14;       // how far a flying monster drifts up and down, in units
export const MONSTER_FLY_BOB_SPEED = 2.4; // radians per second of the flight bob
export const MONSTER_HALFTONE_OPACITY = 0.14; // dot shading over each enemy's flat colour
export const MONSTER_STREAK_ALPHA = 0.55; // opacity of the eraser's ink speed lines, so they read over cream paper
export const MONSTER_SNIP_SPEED = 6;     // radians per second the scissor blades open and close
export const MONSTER_WING_SPEED = 9;     // radians per second of a bird's wing flap
export const MONSTER_WORM_WAVE_SPEED = 5; // radians per second of the worm's crawl wave
export const MONSTER_SPIN_SPEED = 1.1;   // radians per second the sun's rays roll
export const MONSTER_TYPES = [
  [ // World 0, Print Shop
    { id: 'scissors', w: 58, h: 46, flying: false, speedMult: 1.0, weight: 3 },
    { id: 'eraser',   w: 56, h: 38, flying: true,  speedMult: 1.1, weight: 2 },
  ],
  [ // World 1, The Garden
    { id: 'worm',    w: 64, h: 30, flying: false, speedMult: 0.9, weight: 2 },
    { id: 'robin',   w: 58, h: 42, flying: true,  speedMult: 1.2, weight: 3 },
    { id: 'bluejay', w: 62, h: 44, flying: true,  speedMult: 1.4, weight: 2 },
  ],
  [ // World 2, Midnight Sky
    { id: 'sun',          w: 64, h: 64, flying: false, speedMult: 0.85, weight: 3 },
    { id: 'shootingstar', w: 68, h: 34, flying: true,  speedMult: 1.8, weight: 2 },
  ],
];
export const BASE_MONSTERS_PER_PANEL = 2; // quota base added to the current panel number
export const SPAWN_INTERVAL = 2.0;     // seconds between monster spawns at panel 1
export const SPAWN_PANEL_MULTIPLIER = 0.25; // per-panel factor that raises spawn rate (interval / multiplier)
export const HIT_FLASH = 0.22;         // seconds a killed monster stays bright before disappearing
export const STOMP_SQUASH = 0.2;       // how flat the monster squashes on a stomp, as a fraction of its height
export const STOMP_BOUNCE_VELOCITY = -520; // small upward bounce after a successful stomp

// --- Panels / scoring ---
export const PANEL_CLEAR_DELAY = 1.4;  // seconds "PANEL N CLEARED!" stays on screen
export const PANEL_CLEAR_SCORE = 100;  // points awarded for clearing a panel
export const MONSTER_KILL_SCORE = 50;  // points awarded for each stomp or slash kill
export const SCORE_FONT_SIZE = 24;     // score counter text size in playfield units
export const PANEL_COUNTER_FONT_SIZE = 20; // panel X/8 counter text size
export const PANEL_CLEAR_FONT_SIZE = 56;   // "PANEL N CLEARED!" text size
export const VICTORY_FONT_SIZE = 72;   // victory banner text size
export const VICTORY_TEXT = 'VICTORY!'; // banner shown after clearing panel 8
export const VICTORY_HINT_LINE1 = 'R OR SPACE'; // first line of prompt under victory banner
export const VICTORY_HINT_LINE2 = 'TO PLAY AGAIN'; // second line of prompt under victory banner
export const PANEL_FLASH_COLOR = '#FFF4D2'; // bright ink flash behind the panel during a clear

// --- Game over ---
export const GAME_OVER_TEXT = 'GAME OVER!';        // banner shown when a run ends
export const RESTART_HINT_LINE1 = 'R OR SPACE';     // first line of the retry prompt
export const RESTART_HINT_LINE2 = 'TO RETRY';      // second line of the retry prompt
export const GAME_OVER_BANNER_Y = 230;             // banner centre y in playfield units
export const GAME_OVER_FONT_SIZE = 72;             // banner text size in playfield units
export const GAME_OVER_HINT_SIZE = 24;             // restart hint text size in playfield units
export const GAME_OVER_HINT_GAP = 58;              // vertical gap between banner centre and hint centre
export const FONT_STACK = '"Ka Blam", monospace'; // canvas font stack for panel text

// --- Pause ---
export const PAUSED_TEXT = 'PAUSED';               // pause overlay banner
export const PAUSED_HINT = 'P TO RESUME';          // prompt under pause banner
export const PAUSED_FONT_SIZE = 64;                // pause banner text size in playfield units

// --- Controls hint (temporary, bottom-left of the panel) ---
export const CONTROLS_HINT = 'ARROWS MOVE   SPACE OR UP OR W JUMP   SLASH ATTACK   P PAUSE'; // temporary controls line
export const CONTROLS_HINT_SIZE = 16;   // hint text size in playfield units
export const CONTROLS_HINT_DURATION = 8; // seconds the hint stays if the player never slashes
export const CONTROLS_HINT_MARGIN = 14; // gap between the hint and the panel edge

// --- Audio (procedural Web Audio SFX, no external sound files) ---
// The SFX_ prefix keeps these clear of the visual knobs above (SLASH_DURATION is
// the swing's on-screen life; SFX_SLASH_DURATION is how long the swoosh rings).
export const AUDIO_ENABLED = true;      // master switch: false silences every sound
export const AUDIO_MASTER_VOLUME = 0.5; // single master gain in front of all sounds, for overall loudness

export const SFX_JUMP_VOLUME = 0.35;      // loudness of the jump boing
export const SFX_JUMP_DURATION = 0.14;    // length of the jump boing in seconds
export const SFX_JUMP_BASE_FREQ = 320;    // Hz root of the springy jump tone

export const SFX_SLASH_VOLUME = 0.35;     // loudness of the sword swoosh
export const SFX_SLASH_DURATION = 0.16;   // length of the swoosh in seconds
export const SFX_SLASH_BASE_FREQ = 1800; // Hz the swoosh's noise sweep starts at, falling from there

export const SFX_STOMP_VOLUME = 0.5;     // loudness of the stomp thud
export const SFX_STOMP_DURATION = 0.14;  // length of the thud in seconds
export const SFX_STOMP_BASE_FREQ = 180;  // Hz the thud's body tone starts at, dropping for the impact

export const SFX_HIT_VOLUME = 0.4;       // loudness of the slash-kill ping
export const SFX_HIT_DURATION = 0.14;    // length of the ping in seconds
export const SFX_HIT_BASE_FREQ = 880;    // Hz the ping's square tone starts at

export const SFX_VICTORY_VOLUME = 0.45;    // loudness of the clearing jingle
export const SFX_VICTORY_DURATION = 0.6;   // total length of the jingle in seconds
export const SFX_VICTORY_BASE_FREQ = 523.25; // Hz of the jingle's root note (C5)
export const SFX_VICTORY_STEPS = [1, 1.25, 1.5, 2]; // pitch ratios of the four ascending notes, relative to the root

export const SFX_GAMEOVER_VOLUME = 0.4;      // loudness of the run-over tone
export const SFX_GAMEOVER_DURATION = 0.6;    // length of the descending tone in seconds
export const SFX_GAMEOVER_BASE_FREQ = 440;   // Hz the game-over tone starts at, sliding down from there

// --- Colours (from the Lucid Ink visual-system reference) ---
export const COLOR_DEATH = '#C4342A';       // hero's body and banner ink once the run has ended
export const COLOR_PAPER = '#F2E5C4';       // aged cream paper
export const COLOR_INK = '#242125';         // almost-black ink outline
export const COLOR_PLAYER = '#E94B35';      // the hero's vermilion body
export const COLOR_EYE = '#F2E5C4';         // the hero's and monsters' cream eyes, and the monster hit flash
// --- Monster colours (flat comic fills; every enemy also gets the chunky COLOR_INK outline) ---
export const MONSTER_COLORS = {
  scissors:     { body: '#B9BEC4', accent: '#E9B949' }, // silver blades, mustard handles
  eraser:       { body: '#E94B35', accent: '#F2E5C4' }, // vermilion block, cream sleeve and streaks
  worm:         { body: '#E58AA0', accent: '#C86D51' }, // garden pink worm
  robin:        { body: '#3B7EA1', accent: '#E94B35', beak: '#E9B949' }, // robin blue-grey with a red breast
  bluejay:      { body: '#4C6FBF', accent: '#FFF4D2', beak: '#E9B949' }, // jay blue with a cream belly
  sun:          { body: '#F7B32B', accent: '#E94B35' }, // fiery gold sun
  shootingstar: { body: '#FFF4D2', accent: '#F7B32B' }, // lunar cream star, gold tail
};
export const COLOR_GROUND = '#242125';      // ground line ink

// --- Worlds / player costumes ---
// Reference character designs: 0 = Triangle Guy, 1 = Ink Blot, 2 = Crescent Moon
export const WORLD_COUNT = 3;
export const WORLD_PAPER = ['#F2E5C4', '#F2E5C4', '#F2E5C4']; // aged-cream paper across worlds
export const WORLD_PLAYER_FILL = ['#E94B35', '#242125', '#FFF4D2'];
export const WORLD_PLAYER_EYE = ['#F2E5C4', '#F2E5C4', '#E9B949'];

// --- World environment styling ---
export const WORLD_SKY_TOP = ['#F2E5C4', '#E8D8C8', '#18233C'];
export const WORLD_SKY_BOTTOM = ['#E9A0A0', '#A8D5BA', '#3A4A6E'];
export const WORLD_PLATFORM_FILL = ['#C44B5A', '#76A035', '#5A4A8A'];
export const WORLD_PLATFORM_TOP = ['#E9B949', '#E9B949', '#E9B949'];
export const HALFTONE_OPACITY = 0.18;

// --- Comic progress stages (world draws in as the 8 panels advance) ---
// stage 0 = graphite sketch, 1 = bold ink, 2 = halftone colour, 3 = neon completed panel
export const STAGES_PER_PANEL = [0, 0, 1, 1, 2, 2, 3, 3];
