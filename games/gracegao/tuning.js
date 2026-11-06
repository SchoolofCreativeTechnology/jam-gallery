// Every tunable number for the game lives here as a named export. Change these to taste.

// --- Beach / world ---
export const BEACH_WIDTH = 22;          // x size of the playable beach
export const BEACH_LENGTH = 18;         // z size of the playable beach
export const SEA_EDGE_Z = -BEACH_LENGTH / 2;   // the sea is at the negative-z edge
export const WET_SAND_DEPTH = 5.5;      // risky zone depth, measured from the sea edge
export const WET_SAND_COLOR = '#d8c096';
export const DRY_SAND_COLOR = '#efe1bd';
export const SEA_COLOR = '#4aa3c7';
export const SKY_COLOR = '#bfe0ef';

// Playable bounds for the girl (z runs from the sea edge inward).
export const MIN_X = -BEACH_WIDTH / 2;
export const MAX_X = BEACH_WIDTH / 2;
export const MIN_Z = SEA_EDGE_Z;
export const MAX_Z = SEA_EDGE_Z + BEACH_LENGTH;
export const DRY_LINE_Z = SEA_EDGE_Z + WET_SAND_DEPTH;   // wet sand is z < DRY_LINE_Z

// --- Camera (close third-person behind the girl, angled so waves are still visible) ---
export const CAMERA_FOV = 55;
export const CAMERA_HEIGHT = 4.2;       // how high above the girl the camera sits
export const CAMERA_BACK = 5.5;         // how far behind her the camera sits
export const CAMERA_LOOK_AHEAD = -5;    // look this far ahead of her (negative z = out to sea)
export const CAMERA_LOOK_HEIGHT = 0.6;  // height of the point the camera aims at
export const CAMERA_FOLLOW = 1;         // 0 = camera fixed at origin, 1 = camera rides with the girl
export const CAMERA_EASE = 6;           // how fast the camera eases toward its target

// --- Player ---
export const PLAYER_START_X = 0;
export const PLAYER_START_Z = 2;         // she starts on the dry sand
export const PLAYER_SPEED = 7;
export const PLAYER_RADIUS = 0.45;      // collision/pickup radius (fixed, even when a model loads)

// --- Player model (the girl's GLB). If the file is missing the plain shapes are used instead. ---
export const PLAYER_MODEL_URL = 'assets/tripo_convert_68b874cf-77b5-427a-ab5d-3875b44eba50.glb';
export const PLAYER_MODEL_HEIGHT = 1.7;  // the model is scaled so it stands this tall
export const PLAYER_MODEL_YAW = 0;       // rotate the model if it does not face forward
export const KNOCKBACK_STRENGTH = 13;   // initial push speed from a wave
export const KNOCKBACK_DURATION = 0.5;  // seconds of reduced control while pushed
export const KNOCKBACK_CONTROL = 0.25;  // movement control left while being pushed
export const KNOCKBACK_DAMPING = 5;     // how fast the push fades

// --- Waves ---
export const WAVE_SPEED = 5.5;
export const WAVE_INTERVAL_MIN = 0.9;   // seconds between waves (random in [min,max])
export const WAVE_INTERVAL_MAX = 2.0;
export const WAVE_WIDTH_MIN = 5;
export const WAVE_WIDTH_MAX = 11;
export const WAVE_DEPTH = 1.8;
export const WAVE_SPAWN_OFFSET = 4;     // how far out in the sea waves appear
export const WAVE_COLOR = '#67c7e8';
export const WAVE_OPACITY = 0.55;
export const WAVE_REACH_Z = SEA_EDGE_Z + WET_SAND_DEPTH;   // waves stop at the dry-sand line

// --- Collectibles ---
export const ITEM_HOVER = 0.35;         // how high items float off the sand
export const ITEM_SPIN_SPEED = 1.4;     // radians per second
export const PICKUP_RADIUS = 0.8;       // walk within this to pick an item up
export const ITEMS_PER_TYPE_WET = 3;    // how many of each sea item spawn
export const ITEMS_PER_TYPE_DRY = 3;    // how many of each fruit spawn
export const ITEM_START_CLEARANCE = 2.2; // items never spawn this close to where she starts

// The 8 items: id, which zone it spawns in, what it's worth, its colour and HUD label.
export const ITEM_TYPES = [
  { id: 'shell',    label: 'Shell',        zone: 'wet', value: 2, color: '#ffb3c6' },
  { id: 'pearl',    label: 'Pearl',        zone: 'wet', value: 6, color: '#f6f2ff' },
  { id: 'coral',    label: 'Coral',        zone: 'wet', value: 4, color: '#ff7f6b' },
  { id: 'seaglass', label: 'Sea glass',    zone: 'wet', value: 3, color: '#8fe3d0' },
  { id: 'seasalt',  label: 'Sea salt',     zone: 'wet', value: 2, color: '#dfe9ff' },
  { id: 'coconut',  label: 'Coconut',      zone: 'dry', value: 3, color: '#8b5a2b' },
  { id: 'berries',  label: 'Wild berries', zone: 'dry', value: 4, color: '#6b4fa0' },
  { id: 'banana',   label: 'Banana',       zone: 'dry', value: 3, color: '#ffd94a' },
];

// --- Model swap (M4): the GLB files in assets/, loaded in the background ---
// Items listed here are shown as their model once it loads; every other item keeps its plain shape.
// `size` is the model's longest side in world units; `yaw` turns the model to face nicely.
export const ITEM_MODELS = {
  shell:   { url: 'assets/Nautilus%20shell%20by%20Poly%20by%20Google%20-%20bceVxKNzLaJ.glb', size: 0.6, yaw: 0 },
  coconut: { url: 'assets/Coconut%20by%20Poly%20by%20Google%20-%20fY5jzVAVuCl.glb',          size: 0.42, yaw: 0 },
  banana:  { url: 'assets/Banana%20by%20Poly%20by%20Google%20-%202GM0SoFqf9c.glb',            size: 0.45, yaw: 0 },
  berries: { url: 'assets/Blueberries%20by%20sirkitree%20-%20ecQMbKzX7Mo.glb',                size: 0.4, yaw: 0 },
};
// Pearl, coral, sea glass and sea salt have no model yet, so they stay plain shapes.

// --- Palm tree models: one is picked at random per tree; plain shapes if the files are missing ---
export const TREE_MODEL_URLS = [
  'assets/Palm%20Tree%20by%20Quaternius%20-%20A6cKJYFsIb.glb',
  'assets/Palm%20tree%20by%20jeremy%20-%20bjGeBbKhAVN.glb',
];
export const TREE_MODEL_HEIGHT = 3.2;   // each palm is scaled so it stands this tall
export const TREE_MODEL_YAW = 0;        // rotate the palms if they do not stand upright

// --- Tide ---
export const LOW_TIDE_DURATION = 45;    // seconds for the low-tide bar to fill
export const TIDE_RISE_DURATION = 4;    // seconds for the water to rise and cover the beach
export const LOW_WATER_Y = -0.1;        // water sits below the sand at low tide
export const HIGH_WATER_Y = 0.09;       // water sits just above the sand at high tide

// --- Risk ---
export const DROP_CHANCE = 0.5;         // chance a wave hit makes her drop one item

// --- Plants (palm trees and bushes on the dry land; fruit only grows around them) ---
export const TREE_COUNT = 5;
export const BUSH_COUNT = 4;
export const TREE_HEIGHT = 2.6;
export const TREE_TRUNK_COLOR = '#9a6b3f';
export const TREE_LEAF_COLOR = '#4f9d5b';
export const BUSH_COLOR = '#6db86b';
export const PLANT_MARGIN = 1.4;        // keep plants this far inside the dry-land edge
export const PLANT_CLEARANCE = 3.5;     // keep plants away from where the girl starts
export const PLANT_SPACING = 3.2;       // keep plants from clumping into one corner
export const FRUIT_NEAR_PLANT = 1.6;    // fruit spawns within this radius of a tree or bush

// --- Shop (counter, mixing table, cups, signboard) ---
export const SHOP_COUNTER_X = -7.5;
export const SHOP_COUNTER_Z = -0.5;      // just inland of the shore line
export const SHOP_COUNTER_WIDTH = 3.2;
export const SHOP_COUNTER_HEIGHT = 1.0;
export const SHOP_COUNTER_COLOR = '#cf9a63';
export const SHOP_TABLE_COLOR = '#b5794a';
export const SHOP_CUP_COLORS = ['#ffd1dc', '#c7e6ff', '#fff0b3'];
export const SHOP_SIGN_X = SHOP_COUNTER_X + 3.6;
export const SHOP_SIGN_Z = SHOP_COUNTER_Z - 0.1;
export const SHOP_SIGN_BOARD_COLOR = '#efe0bd';
export const SHOP_SIGN_POST_COLOR = '#8d6a45';
export const SHOP_SIGN_TEXT = 'Decorate · Unlock';
export const SHOP_KEEPOUT = 4.5;         // plants keep this far from the counter
export const CRAFT_RADIUS = 2.8;         // how close to the counter she can craft
export const CRAFT_KEY = 'e';            // one key crafts the whole satchel (shown in the HUD)
export const CRAFT_KEY_LABEL = 'E';

// --- Pier and boat ---
export const PIER_X = 9;                       // pier runs out on the right-hand side
export const PIER_START_Z = DRY_LINE_Z + 1.0;  // pier starts on the dry land...
export const PIER_LENGTH = 11;                 // ...and reaches this far into the sea
export const PIER_WIDTH = 1.8;
export const PIER_DECK_Y = 0.5;
export const PIER_COLOR = '#b08050';
export const PIER_POST_COLOR = '#8d6a45';
export const BOAT_COLOR = '#e0644f';
export const BOAT_CABIN_COLOR = '#f4efe4';
export const BOAT_MODEL_URL = 'assets/after_moved.glb';   // falls back to plain shapes if missing
export const BOAT_MODEL_LENGTH = 4.2;              // the model is scaled so its longest side is this
export const BOAT_MODEL_YAW = 0;                   // rotate the model so its bow points at -z
export const BOAT_DOCK_GAP = 1.6;        // the boat sits this far past the pier end
export const BOAT_START_DISTANCE = 28;   // how far out at sea the boat starts (much farther than the old approach)
export const BOAT_SAIL_SPEED = 3.2;      // units per second the boat sails in toward the pier

// --- Boat-ending beat (M3): banner, sale summary and the sunset rest moment ---
export const BANNER_DURATION = 4;        // seconds the "A boat is coming..." banner stays up
export const SUMMARY_READ_TIME = 2.4;    // seconds the sale summary shows before the sunset starts
export const SUNSET_COLOR = '#ff9d5c';   // warm sunset tint used for the rest fade
export const SUNSET_FADE_IN = 1.2;       // seconds to fade the screen to the sunset colour
export const SUNSET_HOLD = 0.8;          // seconds held at full sunset
export const SUNSET_FADE_OUT = 1.2;      // seconds to fade back in before the next-day option

// --- Crafting and selling ---
export const ICE_CREAM_VALUE_MULT = 1;   // fruit value -> ice cream sell value
export const JEWELRY_VALUE_MULT = 1;     // sea-item value -> jewelry sell value
export const CRAFT_GOODS_SHOW_TIME = 3;  // seconds the crafted-goods panel stays up

// --- Money goal HUD (how much money unlocks the next area) ---
export const AREA_UNLOCK_COST = 100;              // money needed to unlock the next area
export const AREA_GOAL_LABEL = 'Next area';       // HUD prefix: "Next area: $current / $target"
export const AREA_UNLOCKED_TEXT = 'unlocked!';    // shown in place of the numbers once reached

// --- Locked islet across the water (visible, not reachable — unlocking is a Stretch goal) ---
export const ISLET_X = -12;                       // sits across the water, left of the pier
export const ISLET_Z = SEA_EDGE_Z - 4.5;          // beyond the sea edge (SEA_EDGE_Z = -9)
export const ISLET_SAND_RADIUS = 2.6;
export const ISLET_SAND_HEIGHT = 0.7;
export const ISLET_SAND_COLOR = '#e3cfa0';
export const ISLET_GRASS_RADIUS = 1.4;
export const ISLET_GRASS_COLOR = '#63a862';
export const ISLET_PALM_TRUNK_COLOR = '#9a6b3f';
export const ISLET_PALM_LEAF_COLOR = '#4f9d5b';
export const ISLET_LOCK_COLOR = '#f0c24b';       // the little padlock that marks the islet as locked
export const ISLET_LABEL_Y = 2.7;                // height of the "Locked" label above the islet
export const ISLET_LABEL_TEXT = 'Locked';
