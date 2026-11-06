// Every number and label the game might want tuned later, in one place.

// --- the one action ---
export const PULL_RATE = 0.55;   // tension gained per second while SPACE is held
export const TENSION_MIN = 0;    // lowest tension (released)
export const TENSION_MAX = 1;    // highest tension (fully pulled)
export const KEY_PULL = ' ';     // hold to pull
export const KEY_RESTART = 'r';  // back to the title screen

// --- state machine ---
export const STATE_TITLE = 'title';
export const STATE_DUEL = 'duel';

// --- camera (fixed close-up on the two stalks) ---
// The interlock — where the two U-bends hook — sits at the world origin for every tension,
// so the camera looks straight at it and sits close enough for an intimate view of the two hooks.
export const CAMERA_POSITION = [0, 0.65, 2.6];   // pulled back for the full tube pair
export const CAMERA_LOOK_AT = [0, 0, 0];         // the interlock itself
export const CAMERA_FOV = 45;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 100;

// --- look (plain M1 palette; the real pass is M4) ---
export const BACKGROUND_COLOR = '#101a2b';           // midnight blue, kept dark so the stalks read bright
export const HEMISPHERE_LIGHT_COLOR = '#a8dcd6';
export const HEMISPHERE_GROUND_COLOR = '#33465f';    // lifted: thin tubes need a floor of light, not black
export const HEMISPHERE_LIGHT_INTENSITY = 1.25;
export const DIRECTIONAL_LIGHT_COLOR = '#ffdcae';    // warm key
export const DIRECTIONAL_LIGHT_INTENSITY = 1.7;
export const DIRECTIONAL_LIGHT_POSITION = [2.8, 3.4, 3.2];   // lower than before: lights the flank, not just the top
export const FILL_LIGHT_COLOR = '#7fa8ff';           // cool fill opposite the key, lifts the shaded side
export const FILL_LIGHT_INTENSITY = 1.0;
export const FILL_LIGHT_POSITION = [-3, 0.9, 2.4];
export const RIM_LIGHT_COLOR = '#d8f2ff';            // pale rim from behind: separates the tubes from the background
export const RIM_LIGHT_INTENSITY = 1.2;
export const RIM_LIGHT_POSITION = [-2.2, 2.2, -3.2];

// --- rival nerve (opponent.js) ---
// The rival's threshold is the fraction of its OWN Defense it will take before it lets go.
// Higher = it holds longer, so duels get closer to somebody breaking.
export const OP_RISK_CAUTIOUS = 0.88;     // cautious tier: holds until 88% of its Defense
export const OP_RISK_BALANCED = 0.96;     // balanced tier: holds until 96% (the base rival is bold)
export const OP_RISK_RECKLESS = 0.99;     // reckless tier: holds right to the edge
export const OP_RISK_STRONG = 0.99;       // strong tier: as bold as reckless, but hits harder
export const OP_RISK_CHAMPION = 1.0;      // champion tier: top of the scale (OP_RISK_MAX still caps the roll at 0.98; a gamble reaches 1.0)
export const OP_RISK_JITTER = 0.12;       // ±12% per stalk, so it never concedes at the same ratio twice
export const OP_RISK_MIN = 0.05;          // floor on its nerve
export const OP_RISK_MAX = 0.98;          // ceiling on its nerve, before any gamble
export const OP_GAMBLE_CHANCE = 0.2;      // per duel: chance the rival gambles and holds past its threshold
export const OP_GAMBLE_EXTRA = 0.25;      // ...by this much more of its Defense: enough to reach its own break
export const OP_RISK_EFFECTIVE_MAX = 1.0; // a gambled threshold stops here; 1.0 of Defense IS the break

// --- audio (procedural Web Audio; no external files) ---
export const MASTER_GAIN = 0.9;         // everything routes through this
export const CREAK_MAX_GAIN = 0.16;     // loudest the creak gets, at full tension
export const CREAK_LOW_HZ = 110;        // bandpass centre at tension 0
export const CREAK_HIGH_HZ = 950;       // bandpass centre at tension 1 (the pitch rises with tension)
export const CREAK_Q = 6;               // narrow band: a thin, strained creak
export const CREAK_TENSION_POWER = 2;   // volume scales with tension^this, so low tension stays quiet
export const CREAK_MOD_RATE = 5.5;      // Hz of the slow wobble on the creak's band
export const CREAK_MOD_DEPTH = 0.35;    // wobble depth, as a fraction of the centre frequency
export const CREAK_SMOOTH = 0.05;       // time constant for creak moves (seconds); safe per frame
export const SNAP_GAIN = 0.55;
export const SNAP_DECAY = 0.16;         // seconds until the snap is silent
export const SNAP_NOISE_HZ = 1800;      // highpass on the snap's noise burst
export const SNAP_TONE_FROM = 440;      // the "crack": a fast pitch drop ...
export const SNAP_TONE_TO = 60;         // ... down to here
export const CONCEDE_GAIN = 0.3;
export const CONCEDE_DECAY = 0.5;       // seconds
export const CONCEDE_TONE_FROM = 520;   // soft descending tone ...
export const CONCEDE_TONE_TO = 150;     // ... to here
export const CONCEDE_ATTACK = 0.06;     // gentle swell in, so it reads as a release and not a hit

// --- fx (M3/M4 feel: camera shake, break burst, hook glow) ---
// Shake: a decaying offset added to the camera's fixed framing position, never a change of aim.
export const SHAKE_MAX_OFFSET = 0.05;        // world units; the camera sits ~1.8 away, so this is a nudge
export const SHAKE_BREAK_INTENSITY = 1;      // a stalk snapping is the loud one (1 = the full max offset)
export const SHAKE_BREAK_DURATION = 0.45;    // seconds, and the default for a shake asked for with no duration
export const SHAKE_CONCEDE_INTENSITY = 0.3;  // letting go is barely a knock
export const SHAKE_CONCEDE_DURATION = 0.22;
export const SHAKE_FREQ_X = 43;              // rad/s of the horizontal wobble
export const SHAKE_FREQ_Y = 37;              // a different rate on Y, so the shake never draws a clean circle
export const SHAKE_FALLOFF = 2;              // offset scales with (timeLeft/duration)^this; higher = snappier stop

// Break burst: a puff of tiny glowing specks thrown from the interlock when a stalk snaps.
export const BURST_PARTICLES = 30;        // specks per burst (one instanced mesh, so cheap)
export const BURST_LIFETIME = 0.75;       // seconds until the last speck has faded away
export const BURST_SIZE = 0.022;          // world size of one speck when it is brightest
export const BURST_SHRINK = 0.35;         // a speck's size at the end, as a fraction of BURST_SIZE
export const BURST_SPEED = 1.15;          // outward speed, world units per second
export const BURST_SPEED_MIN = 0.6;       // each speck's speed is BURST_SPEED x (this .. this + BURST_SPEED_JITTER)
export const BURST_SPEED_JITTER = 0.7;
export const BURST_SPREAD = 0.06;         // radius of the start cloud, so the burst has body, not just a point
export const BURST_GRAVITY = 2.4;         // specks fall as they slow
export const BURST_SPIN = 6;              // rad/s of tumble, so square specks catch the light as they turn
export const BURST_ADDITIVE = true;       // additive: the specks glow against the dark background
export const BURST_PLAYER_COLOR = '#d98436';   // ochre: matches the player stalk's tint
export const BURST_RIVAL_COLOR = '#2f8f8a';    // teal: matches the rival's tint

// Hook glow: a warm point light at the interlock, plus a tiny emissive orb so the glow still shows where the
// tubes occlude the light. Both swell as the pull nears breaking and go quiet the moment tension decays.
export const HOOK_GLOW_COLOR = '#ff8a4c';         // ochre-coral: warm, so it reads as danger, not decoration
// three uses physical falloff (1 / distance^2) and this scene has no tone mapping, so a hot value here would
// clip straight to white: 0.05 is a bright warm hit at the interlock that is gone by the far ends of the arms.
export const HOOK_GLOW_MAX_INTENSITY = 0.05;
export const HOOK_GLOW_DISTANCE = 1.6;            // falls off before it reaches the held ends of the arms
export const HOOK_GLOW_DECAY = 2;
export const HOOK_GLOW_ORB_RADIUS = 0.06;         // world radius of the emissive orb at full tension
export const HOOK_GLOW_ORB_OPACITY = 0.55;        // additive, so this is a soft warm dot, never a solid ball
export const HOOK_GLOW_TENSION_POWER = 2.4;       // quiet through an easy pull, bright only near the break

// --- text ---
export const TITLE_TEXT = 'Stem to Stem — Hold SPACE to pull — Press R to restart';

// --- renderer ---
export const MAX_PIXEL_RATIO = 2;
