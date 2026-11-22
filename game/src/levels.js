// THE VELVET VAULT — 2.5D isometric heist game.
// Level data, written from scratch for the isometric version.
// World units are 1280x720 top-down; rendering projects them isometrically.
// All coordinates below are my own layout for this version.

const WORLD_W = 1280;
const WORLD_H = 720;
const BOUNDS = { x0: 60, y0: 60, x1: 1220, y1: 660 };

// Isometric projection constants (rendering only, mechanics stay top-down).
const ISO = { ox: 486, oy: 85, s: 0.55, sy: 0.275, wallH: 46 };

const LEVELS = [
  {
    id: 0,
    name: 'THE GALLERY',
    sub: 'Room 1 of 3 — steal the Sunset Portrait',
    floor: '#171a26', floorA: '#1c2133', floorB: '#141724',
    accent: '#d8a94e', accent2: '#8a6d2f',
    wallTop: '#2b3049', wallSide: '#1d2136', wallFront: '#12141f',
    playerStart: { x: 120, y: 620 },
    target: { kind: 'portrait', x: 1150, y: 300, reach: 60, seconds: 1.6, label: 'SUNSET PORTRAIT', points: 500 },
    exit: { x: 1176, y: 84, w: 76, h: 40, label: 'EXIT' },
    keycard: null,
    loot: [
      { x: 300, y: 200, kind: 'coin' }, { x: 520, y: 540, kind: 'ring' }, { x: 920, y: 620, kind: 'coin' },
      { x: 240, y: 420, kind: 'watch' }, { x: 700, y: 180, kind: 'gem' }, { x: 1020, y: 500, kind: 'gem' }, { x: 1150, y: 620, kind: 'gem' },
      { x: 640, y: 340, kind: 'antique' },
    ],
    guards: [
      { wp: [[220, 180], [1000, 180], [1000, 320], [220, 320]] },
      { wp: [[400, 560], [1080, 560], [1080, 640], [400, 640]], speed: 0.85, fov: 0.55 },
    ],
    sentries: [{ x: 200, y: 120, base: 0.6, sweep: 0.9 }],
    dogs: [{ x1: 620, y1: 500, x2: 860, y2: 500, name: 'Rex' }],
    cameras: [{ x: 640, y: 70 }],
    terminal: { x: 480, y: 160 },
    lasers: [{ axis: 'h', at: 460, from: 520, to: 760, period: 3, on: 1.6 }],
    shadows: [{ x: 280, y: 280, w: 200, h: 120 }, { x: 840, y: 100, w: 220, h: 100 }],
    walls: [
      { x: 560, y: 380, w: 24, h: 140 },
      { x: 880, y: 380, w: 24, h: 140 },
    ],
    props: [
      { kind: 'case', x: 400, y: 360, w: 90, d: 44, h: 34, solid: true, color: '#3a4a6b' },
      { kind: 'case', x: 820, y: 220, w: 90, d: 44, h: 34, solid: true, color: '#3a4a6b' },
      { kind: 'rug', x: 560, y: 300, w: 220, d: 120, color: '#5a1f2b' },
      { kind: 'painting', x: 300, y: 62, w: 90, d: 10, h: 54, color: '#c98f2e' },
      { kind: 'painting', x: 900, y: 62, w: 90, d: 10, h: 54, color: '#2e7f8f' },
      { kind: 'plant', x: 120, y: 120, w: 34, d: 34, h: 40, color: '#2f6b3a' },
      { kind: 'plant', x: 1180, y: 600, w: 34, d: 34, h: 40, color: '#2f6b3a' },
      { kind: 'chandelier', x: 640, y: 200, w: 60, d: 60, h: 18, color: '#d8a94e' },
      { kind: 'lamp', x: 1100, y: 140, w: 24, d: 24, h: 48, color: '#d8a94e' },
      { kind: 'lamp', x: 180, y: 580, w: 24, d: 24, h: 48, color: '#d8a94e' },
    ],
  },
  {
    id: 1,
    name: 'THE VAULT HALL',
    sub: 'Room 2 of 3 — steal the Velvet Diamond',
    floor: '#122019', floorA: '#16281e', floorB: '#0e1a13',
    accent: '#c9a227', accent2: '#7a5f14',
    wallTop: '#24382c', wallSide: '#182619', wallFront: '#0d130e',
    playerStart: { x: 120, y: 620 },
    target: { kind: 'diamond', x: 990, y: 360, reach: 60, seconds: 2.6, label: 'VELVET DIAMOND', points: 500, locked: true },
    exit: { x: 84, y: 84, w: 76, h: 40, label: 'EXIT' },
    keycard: { x: 820, y: 360 },
    loot: [
      { x: 200, y: 200, kind: 'coin' }, { x: 350, y: 600, kind: 'coin' }, { x: 600, y: 200, kind: 'ring' }, { x: 850, y: 600, kind: 'coin' }, { x: 1100, y: 200, kind: 'coin' },
      { x: 250, y: 400, kind: 'watch' }, { x: 700, y: 500, kind: 'gem' }, { x: 1050, y: 450, kind: 'gem' },
      { x: 500, y: 360, kind: 'antique' }, { x: 990, y: 600, kind: 'antique' },
    ],
    guards: [
      { wp: [[700, 360], [950, 360], [950, 500], [700, 500]] },
      { wp: [[200, 180], [1100, 180], [1100, 280], [200, 280]], speed: 0.85, fov: 0.55 },
    ],
    sentries: [{ x: 640, y: 120, base: Math.PI / 2, sweep: 0.9 }],
    dogs: [{ x1: 350, y1: 480, x2: 600, y2: 480, name: 'Bella' }],
    cameras: [{ x: 300, y: 70 }, { x: 700, y: 70 }],
    terminal: { x: 500, y: 150 },
    lasers: [{ axis: 'v', at: 970, from: 280, to: 440, period: 3, on: 1.8 }],
    shadows: [{ x: 150, y: 300, w: 180, h: 120 }, { x: 900, y: 500, w: 200, h: 110 }],
    walls: [
      { x: 420, y: 560, w: 24, h: 90 },
      { x: 1050, y: 420, w: 24, h: 140 },
    ],
    props: [
      { kind: 'safe', x: 200, y: 300, w: 70, d: 40, h: 52, solid: true, color: '#4a4f55' },
      { kind: 'safe', x: 280, y: 300, w: 70, d: 40, h: 52, solid: true, color: '#4a4f55' },
      { kind: 'vaultdoor', x: 1080, y: 320, w: 100, d: 50, h: 60, solid: true, color: '#6b6f75' },
      { kind: 'rug', x: 500, y: 420, w: 240, d: 120, color: '#3d2f10' },
      { kind: 'goldbars', x: 700, y: 600, w: 90, d: 30, h: 16, color: '#c9a227' },
      { kind: 'plant', x: 1180, y: 120, w: 34, d: 34, h: 40, color: '#2f6b3a' },
      { kind: 'plant', x: 120, y: 600, w: 34, d: 34, h: 40, color: '#2f6b3a' },
      { kind: 'lamp', x: 140, y: 200, w: 24, d: 24, h: 48, color: '#c9a227' },
      { kind: 'lamp', x: 1120, y: 580, w: 24, d: 24, h: 48, color: '#c9a227' },
    ],
  },
  {
    id: 2,
    name: 'THE PENTHOUSE',
    sub: 'Room 3 of 3 — steal the Crown',
    floor: '#221420', floorA: '#2a1828', floorB: '#1a1018',
    accent: '#d98a7a', accent2: '#8a4a3f',
    wallTop: '#3a2233', wallSide: '#281724', wallFront: '#170e14',
    playerStart: { x: 120, y: 620 },
    target: { kind: 'crown', x: 640, y: 440, reach: 70, seconds: 2.2, label: 'THE CROWN', points: 500 },
    exit: { x: 604, y: 60, w: 76, h: 40, label: 'SKYLIGHT' },
    keycard: null,
    loot: [
      { x: 180, y: 180, kind: 'coin' }, { x: 400, y: 620, kind: 'coin' }, { x: 760, y: 180, kind: 'ring' }, { x: 1080, y: 300, kind: 'coin' }, { x: 1080, y: 620, kind: 'coin' },
      { x: 300, y: 380, kind: 'watch' }, { x: 640, y: 620, kind: 'gem' }, { x: 900, y: 520, kind: 'gem' },
      { x: 200, y: 560, kind: 'antique' }, { x: 1100, y: 120, kind: 'antique' },
    ],
    guards: [
      { wp: [[200, 200], [1000, 200], [1000, 360], [200, 360]] },
      { wp: [[400, 560], [1100, 560], [1100, 640], [400, 640]], speed: 0.85, fov: 0.55 },
    ],
    sentries: [{ x: 120, y: 660, base: -0.3, sweep: 0.9 }],
    dogs: [{ x1: 500, y1: 600, x2: 800, y2: 600, name: 'Duke' }],
    cameras: [{ x: 320, y: 70 }, { x: 960, y: 70 }],
    terminal: { x: 640, y: 150 },
    lasers: [{ axis: 'h', at: 300, from: 480, to: 800, period: 2.6, on: 1.4 }],
    shadows: [{ x: 200, y: 420, w: 200, h: 110 }, { x: 850, y: 120, w: 200, h: 100 }],
    walls: [
      { x: 420, y: 400, w: 24, h: 100 },
      { x: 900, y: 400, w: 24, h: 100 },
    ],
    props: [
      { kind: 'bed', x: 1020, y: 120, w: 140, d: 70, h: 30, solid: true, color: '#7a2f4a' },
      { kind: 'sofa', x: 300, y: 420, w: 120, d: 50, h: 26, solid: true, color: '#4a2f5e' },
      { kind: 'bar', x: 180, y: 120, w: 90, d: 40, h: 34, solid: true, color: '#5e3a1f' },
      { kind: 'rug', x: 480, y: 420, w: 220, d: 110, color: '#4a1f2b' },
      { kind: 'painting', x: 500, y: 62, w: 90, d: 10, h: 54, color: '#d98a7a' },
      { kind: 'plant', x: 1180, y: 600, w: 34, d: 34, h: 40, color: '#2f6b3a' },
      { kind: 'plant', x: 120, y: 120, w: 34, d: 34, h: 40, color: '#2f6b3a' },
      { kind: 'lamp', x: 180, y: 300, w: 24, d: 24, h: 48, color: '#d98a7a' },
      { kind: 'lamp', x: 1120, y: 480, w: 24, d: 24, h: 48, color: '#d98a7a' },
    ],
  },
];

// Loot values and crack times.
const LOOT_VALUE = { coin: 100, gem: 250, antique: 400, watch: 250, ring: 100 };
const LOOT_LABEL = { coin: 'COIN', gem: 'GEM', antique: 'ANTIQUE', watch: 'WATCH', ring: 'RING' };

// Tunables (same balance as the 2D version).
const TUNE = {
  playerWalk: 175, playerSneak: 98, playerRadius: 14,
  guardPatrol: 70, guardSearch: 118, guardVision: 260, guardFov: 0.61, guardHearing: 200,
  dogPatrol: 130, dogChase: 230, dogVision: 170, dogFov: 0.75, dogHearing: 320,
  sentryVision: 300, sentryFov: 0.75,
  cameraVision: 300, cameraFov: 0.5,
  alarmRate: 70, alarmDecay: 26, laserRate: 60, dogPounce: 40,
  searchDwell: 2.2, chaseMemory: 2.0, cameraOffTime: 12, smokeTime: 5,
  coins: 3, smokes: 2,
};
