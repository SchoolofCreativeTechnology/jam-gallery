// All gameplay numbers live here. Tweak these and refresh the page.

// Jump physics
export const jumpSpeed = 12;
export const gravity = 20;

// Aim sweep: angle from horizontal oscillates around 90° (straight up)
export const aimSweepSpeed = 1.6; // radians per second
export const aimRangeDeg = 60; // sweep from 30° to 150°

// Player collider size (visual cat is separate)
export const playerWidth = 0.8;
export const playerHeight = 0.8;
export const playerDepth = 0.8;

// Rooftops
export const roofWidthMin = 1.4; // narrowest ledge
export const roofWidthMax = 4.0; // widest roof (rest platforms reach this)
export const narrowRoofChance = 0.18; // odds of an extra-narrow roof
export const restPlatformChance = 0.12; // odds of an extra-wide resting roof
export const roofClearance = 1.2; // clear mist between two roofs' edges (metres)
export const roofDepth = 5;
export const roofThickness = 0.5;
export const startRoofWidth = 8;

// Roof look: painted tiles on a simple slab
export const roofTiltDeg = 14; // roof tips toward the camera so the tiles show
export const roofEaveRise = 0.3; // lift of the upturned eave tips
export const roofCrownRise = 0.06; // gentle arc across the roof silhouette

// Slopes
export const slopeChance = 0.18; // chance a generated roof is sloped
export const slopeChanceGrowth = 0.01; // added slope chance per height step
export const slopeAngleDeg = 15; // how steep a slope is (positive or negative)
export const slideSpeed = 1.5; // horizontal sliding speed down a slope

// World generation
// jumpSpeed 12 / gravity 20 give a flat range of v^2/g = 7.2 m, so a centre
// gap past gapHardMax would be unreachable at any angle.
export const gapMin = 3.6;
export const gapMax = 5.6;
export const gapHardMax = 6.2; // never ask for a longer jump than the arc can reach
export const heightVariance = 2.5;
export const generateAhead = 15; // generate roofs this far above the player

// Difficulty scaling by max height reached
export const heightStepM = 10; // metres of new max height per difficulty step
export const gapGrowth = 0.1; // added to gap range per height step
export const heightVarianceGrowth = 0.12; // added height variance per height step

// Flood
export const floodStartHeight = -12;
export const floodRiseSpeed = 0.8; // initial rise speed in m/s
export const floodSpeedStep = 0.15; // added rise speed per height step
export const floodSpeedMax = 4.5; // cap on rise speed
export const floodColor = '#4a6b7a';

// Breakable vases
export const vaseChance = 0.3;
export const vasePoints = 50;
export const vaseColor = '#c97b5a';
export const vaseSize = 0.45;

// Camera
export const cameraZ = 18;
export const cameraYOffset = 3;
export const lookAtYOffset = 2;
export const cameraFollowSpeed = 3; // higher = snappier

// Trajectory preview
export const trajectorySteps = 80;
export const trajectoryDt = 0.03;
export const arcColor = '#ffcc00';
export const markerColor = '#ff3333';

// Lose plane
export const killPlaneY = -20;
