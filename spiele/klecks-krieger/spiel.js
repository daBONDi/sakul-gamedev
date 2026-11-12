// =====================================================
//  KLECKS-KRIEGER
//  Krakel (und Klecksi) spritzen Farbe auf die Grauschleimer!
// =====================================================
'use strict';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 960, H = 540;
const GRAV = 1500;          // Schwerkraft
const GROUND_Y = 460;       // Höhe vom Boden in den Leveln
const ARENA_Y = 470;        // Höhe vom Boden in den Boss-Arenen

// ---------- Tastatur ----------
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) e.preventDefault();
  initAudio();
  if (!e.repeat) onKey(e.code);   // gedrückt halten zählt nur einmal
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Maus: Taste gedrückt halten = spritzen
addEventListener('pointerdown', e => {
  if (e.button === 0 || e.button === 2) { keys.Mouse = true; initAudio(); }
  if (state === 'map' && e.button === 0) mapClick(e);
});
addEventListener('pointerup', () => { keys.Mouse = false; });
// Wo ist die Maus? (in Spiel-Koordinaten)
const mouse = { x: 0, y: 0, moved: false };
addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * W / r.width;
  mouse.y = (e.clientY - r.top) * H / r.height;
  mouse.moved = true;
});
addEventListener('contextmenu', e => e.preventDefault());

// Spieler 1: A/D + Leertaste/W springen + Maus (oder Q/E) zielen + Maus spritzen, Spieler 2: Pfeiltasten + Enter
const CTRL = [
  { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'], dive: ['KeyS'], shoot: ['Mouse'], aimUp: ['KeyQ'], aimDown: ['KeyE'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], dive: ['ArrowDown'], shoot: ['Enter', 'NumpadEnter'],
    aimUp: ['ShiftRight'], aimDown: ['ControlRight'] },
];

function getPads() {
  if (!navigator.getGamepads) return [];
  return [...navigator.getGamepads()].filter(Boolean);
}

function getInput(i) {
  // Allein spielen: beide Tastenbelegungen steuern Krakel
  const sets = numPlayers === 1 ? CTRL : [CTRL[i]];
  const h = k => sets.some(c => c[k].some(code => keys[code]));
  const r = { left: h('left'), right: h('right'), jump: h('jump'), dive: h('dive'), shoot: h('shoot'),
    aimUp: h('aimUp'), aimDown: h('aimDown'), stick: null };
  const gp = getPads()[i];
  if (gp) {
    // rechter Stick = zielen
    const sx = gp.axes[2] || 0, sy = gp.axes[3] || 0;
    if (Math.hypot(sx, sy) > 0.4) r.stick = Math.atan2(sy, sx);
    const b = n => gp.buttons[n] && gp.buttons[n].pressed;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    r.left = r.left || ax < -0.4 || b(14);
    r.right = r.right || ax > 0.4 || b(15);
    r.jump = r.jump || b(0);
    r.dive = r.dive || b(1) || ay > 0.6 || b(13);
    r.shoot = r.shoot || b(2) || b(5) || b(7);
  }
  return r;
}

// ---------- Sound (Web Audio, ganz ohne Dateien) ----------
let actx = null;
function initAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
  else if (actx.state === 'suspended') actx.resume();
}
function tone(f1, f2, dur, type = 'square', vol = 0.08, delay = 0) {
  if (!actx) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  shoot: () => tone(700, 300, 0.07, 'square', 0.025),
  jump: () => tone(300, 700, 0.12, 'triangle', 0.08),
  hit: () => tone(220, 120, 0.06, 'square', 0.04),
  pop: () => tone(500, 1200, 0.15, 'triangle', 0.08),
  hurt: () => tone(300, 80, 0.3, 'sawtooth', 0.08),
  coin: () => tone(900, 1500, 0.08, 'triangle', 0.05),
  boom: () => tone(150, 40, 0.5, 'sawtooth', 0.12),
  revive: () => { tone(400, 800, 0.15, 'triangle', 0.08); tone(600, 1200, 0.2, 'triangle', 0.08, 0.12); },
  win: () => { tone(523, 523, 0.15, 'triangle', 0.1); tone(659, 659, 0.15, 'triangle', 0.1, 0.15); tone(784, 1046, 0.35, 'triangle', 0.1, 0.3); },
  lose: () => { tone(400, 300, 0.25, 'triangle', 0.1); tone(300, 200, 0.25, 'triangle', 0.1, 0.25); tone(200, 90, 0.5, 'triangle', 0.1, 0.5); },
};

// ---------- Hilfsfunktionen ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function circleRect(c, r) {
  const nx = clamp(c.x, r.x, r.x + r.w), ny = clamp(c.y, r.y, r.y + r.h);
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r * c.r;
}
function solidAt(x, y) {
  return solids.find(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

// ---------- Level-Daten ----------
const LEVEL1 = {
  width: 4000, goal: 3850,
  ground: [[0, 900], [1000, 1700], [1820, 2420], [2550, 4000]],
  plats: [[400, 360, 140], [650, 290, 140], [1150, 350, 160], [1400, 280, 140], [1900, 360, 120],
          [2100, 300, 140], [2300, 360, 120], [2800, 350, 160], [3100, 280, 160], [3400, 340, 140]],
  movers: [],
  walkers: [700, 1300, 1600, 2000, 2700, 3000, 3300, 3600],
  flyers: [1500, 2400, 3200],
  hearts: [[2170, 260]],
};
const LEVEL2 = {
  width: 5200, goal: 5050,
  ground: [[0, 700], [850, 1150], [1300, 1800], [2100, 2500], [2700, 3200], [3500, 3900], [4100, 5200]],
  plats: [[740, 390, 80], [2560, 380, 90], [3420, 330, 80], [400, 340, 140], [1400, 330, 140], [1600, 260, 120],
          [2250, 330, 140], [2900, 320, 140], [3100, 250, 120], [4300, 340, 140], [4600, 280, 140]],
  movers: [
    { x: 1170, y: 400, w: 110, ax: 'y', range: 60, speed: 1.5 },
    { x: 1850, y: 410, w: 110, ax: 'x', range: 90, speed: 1 },
    { x: 3300, y: 400, w: 110, ax: 'y', range: 70, speed: 1.3 },
    { x: 3940, y: 410, w: 100, ax: 'x', range: 50, speed: 1.2 },
  ],
  walkers: [500, 1000, 1500, 1700, 2300, 2900, 3100, 3700, 4300, 4700, 4900],
  flyers: [900, 1900, 2600, 3300, 4000, 4500, 4800],
  hearts: [[1660, 220], [3160, 210]],
};
const LEVEL3 = {
  width: 5600, goal: 5450,
  ground: [[0, 800], [950, 1500], [1650, 2100], [2250, 2900], [3050, 3500], [3700, 4300], [4450, 5600]],
  plats: [[300, 350, 140], [600, 280, 120], [1100, 340, 140], [1300, 270, 120], [1800, 330, 140], [2400, 350, 140],
          [2600, 280, 140], [3200, 340, 140], [3560, 390, 90], [3900, 330, 140], [4100, 260, 120], [4700, 340, 140], [5000, 280, 140]],
  movers: [
    { x: 2130, y: 400, w: 100, ax: 'y', range: 60, speed: 1.4 },
  ],
  walkers: [600, 1200, 1400, 1900, 2500, 2700, 3300, 3900, 4200, 4800, 5200],
  flyers: [1000, 2000, 2800, 3600, 4400, 5000],
  spitters: [1250, 2750, 3950, 5100],   // NEU: Spucker
  hearts: [[1340, 230], [4140, 220]],
};
const LEVEL4 = {
  width: 6000, goal: 5850,
  ground: [[0, 700], [900, 1300], [1600, 2000], [2200, 2600], [2900, 3300], [3500, 4000], [4300, 4700], [4900, 6000]],
  plats: [[400, 340, 140], [1000, 330, 140], [1750, 320, 120], [2350, 330, 140], [3000, 320, 140], [3650, 340, 140],
          [3850, 270, 120], [4450, 330, 140], [5200, 340, 140], [5500, 280, 140]],
  movers: [
    { x: 740, y: 400, w: 120, ax: 'x', range: 40, speed: 1.2 },
    { x: 1390, y: 400, w: 120, ax: 'x', range: 80, speed: 1.1 },
    { x: 2040, y: 390, w: 110, ax: 'y', range: 60, speed: 1.5 },
    { x: 2690, y: 400, w: 120, ax: 'x', range: 80, speed: 1.3 },
    { x: 3340, y: 390, w: 110, ax: 'y', range: 70, speed: 1.6 },
    { x: 4090, y: 400, w: 120, ax: 'x', range: 80, speed: 1.4 },
    { x: 4740, y: 390, w: 110, ax: 'y', range: 60, speed: 1.7 },
  ],
  walkers: [500, 1100, 1200, 1800, 2400, 2500, 3100, 3700, 3900, 4500, 5100, 5400, 5700],
  flyers: [800, 1500, 2200, 2800, 3400, 4000, 4600, 5200, 5600],
  spitters: [1900, 3200, 4600, 5300],
  hearts: [[1800, 280], [3900, 230], [5560, 240]],
};

// map: [x, y] = wo das Level auf der Weltkarte liegt
const STAGES = [
  { type: 'level', name: 'Level 1: Farbwiesen', level: LEVEL1, map: [130, 410],
    sky: ['#6ec6ff', '#dff4ff'], hill2: '#9ad7a5', hill: '#6cc47f', dirt: '#8a5a3b', top: '#55b85f', plat: '#c98b4f' },
  { type: 'boss', name: 'Boss: Wackel-Pudding', boss: 'pudding', map: [300, 420],
    sky: ['#ff9cc4', '#fff0f6'], hill2: '#f7c6dc', hill: '#f29bc0', dirt: '#b5651d', top: '#ffd27f', plat: '#e889b3' },
  { type: 'level', name: 'Level 2: Wolkenberge', level: LEVEL2, map: [470, 405],
    sky: ['#ff8f5a', '#ffd7a8'], hill2: '#c8a2d8', hill: '#9d7bc4', dirt: '#6b4a7a', top: '#f0e8ff', plat: '#f5f0ff' },
  { type: 'boss', name: 'Boss: Turbo-Toaster', boss: 'toaster', night: true, map: [650, 420],
    sky: ['#141842', '#4a3f8a'], hill2: '#2a2a62', hill: '#36347a', dirt: '#3d3d48', top: '#9aa0b0', plat: '#8a90a0' },
  { type: 'level', name: 'Level 3: Zuckerwatte-Wald', level: LEVEL3, map: [820, 320],
    sky: ['#ffb3e6', '#fff0fa'], hill2: '#ffd1f0', hill: '#ff9ed8', dirt: '#c45c9a', top: '#fff5fb', plat: '#7fd6ff' },
  { type: 'level', name: 'Level 4: Lava-Land', level: LEVEL4, map: [640, 235], lava: true,
    sky: ['#5a1a1a', '#ff7a3a'], hill2: '#7a2a20', hill: '#4a1a18', dirt: '#3a2420', top: '#6a4a40', plat: '#8a6a60' },
  { type: 'boss', name: 'Endboss: Staubsauger-König', boss: 'king', map: [400, 215],
    sky: ['#2d2840', '#7a6f9a'], hill2: '#4a4560', hill: '#3a3550', dirt: '#4a4458', top: '#bfb8d8', plat: '#9a92b8' },
];

// ---------- Spielzustand ----------
let state = 'title';     // title, map, play, clear, gameover, win
let paused = false;
let numPlayers = 1, stageIndex = 0, score = 0, stageStartScore = 0;
let highscore = 0;
try { highscore = +localStorage.getItem('klecks-krieger-highscore') || 0; } catch (e) { }
let players = [], enemies = [], shots = [], enemyShots = [], splats = [], solids = [], pickups = [], particles = [];
let boss = null, goalX = Infinity, levelW = W, camX = 0;
let shake = 0, bannerTimer = 0, clearTimer = 0, t = 0;
const clouds = Array.from({ length: 8 }, (_, i) => ({ x: i * 150 + rand(0, 80), y: rand(40, 180), s: rand(0.7, 1.4) }));
const stars = Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, 300), r: rand(0.5, 2) }));
let titleSplats = [];

// ---------- Weltkarte: welche Level sind frei? (wird im Browser gespeichert) ----------
let progress = { unlocked: 1, cleared: [] };
try {
  const p = JSON.parse(localStorage.getItem('klecks-krieger-karte'));
  if (p && p.unlocked) progress = p;
} catch (e) { }
// Falls neue Level dazugekommen sind: hinter dem letzten geschafften Level aufmachen
while (progress.cleared[progress.unlocked - 1] && progress.unlocked < STAGES.length) progress.unlocked++;
function saveProgress() {
  try { localStorage.setItem('klecks-krieger-karte', JSON.stringify(progress)); } catch (e) { }
}
let mapSel = 0, mapLock = 0, mapUnlockTimer = 0, mapFace = 1;
let mapPos = { x: STAGES[0].map[0], y: STAGES[0].map[1] };

function goToMap(sel, fromIndex = sel) {
  state = 'map';
  mapSel = sel;
  const from = STAGES[fromIndex].map;
  mapPos = { x: from[0], y: from[1] };
  mapLock = 0.5;
}
function mapMove(dir) {
  const n = clamp(mapSel + dir, 0, Math.min(progress.unlocked, STAGES.length) - 1);
  if (n !== mapSel) { mapSel = n; tone(500, 750, 0.07, 'triangle', 0.06); }
}
function startStage(i) {
  if (mapLock > 0 || i >= progress.unlocked) return;
  sfx.coin();
  loadStage(i);
  state = 'play';
}
function mapClick(e) {
  const r = cv.getBoundingClientRect();
  const mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
  STAGES.forEach((st, i) => {
    if (Math.hypot(mx - st.map[0], my - st.map[1]) < 42 && i < progress.unlocked) { mapSel = i; startStage(i); }
  });
}

function saveHighscore() {
  if (score > highscore) {
    highscore = score;
    try { localStorage.setItem('klecks-krieger-highscore', highscore); } catch (e) { }
  }
}

// ---------- Spieler ----------
function makePlayer(k) {
  return {
    k, name: k ? 'Klecksi' : 'Krakel',
    color: k ? '#b44cff' : '#ff7a00', light: k ? '#dda6ff' : '#ffb870',
    x: 0, y: 0, w: 32, h: 44, vx: 0, vy: 0, face: 1, hp: 3, ink: 100, inv: 0, cool: 0,
    dive: false, down: false, onGround: false, standOn: null, coyote: 0, prevJump: false,
    lastSafe: { x: 0, y: 0 }, anim: 0,
    aim: 0, tilt: 0, aimMode: 'keys',   // aim = Richtung der Spritze (Winkel), tilt = Neigung per Tasten
  };
}
function resetPlayer(p, x, y) {
  Object.assign(p, { x, y, vx: 0, vy: 0, hp: 3, ink: 100, down: false, inv: 1, face: 1, standOn: null, dive: false });
  p.lastSafe = { x, y };
}

function start(n) {
  numPlayers = n;
  players = [];
  for (let k = 0; k < n; k++) players.push(makePlayer(k));
  score = 0;
  const last = Math.min(progress.unlocked, STAGES.length) - 1;
  goToMap(last);
}

function loadStage(i) {
  stageIndex = i;
  stageStartScore = score;
  const st = STAGES[i];
  solids = []; shots = []; enemyShots = []; splats = []; enemies = []; pickups = []; particles = [];
  boss = null; camX = 0; paused = false;
  if (st.type === 'level') {
    const L = st.level;
    levelW = L.width; goalX = L.goal;
    for (const [a, b] of L.ground) solids.push({ x: a, y: GROUND_Y, w: b - a, h: H - GROUND_Y, kind: 'ground' });
    for (const [x, y, w] of L.plats) solids.push({ x, y, w, h: 18, oneWay: true, kind: 'plat' });
    for (const m of L.movers) solids.push({ x: m.x, y: m.y, w: m.w, h: 18, oneWay: true, kind: 'mover',
      bx: m.x, by: m.y, ax: m.ax, range: m.range, speed: m.speed, t: 0, dx: 0, dy: 0 });
    for (const x of L.walkers) enemies.push(makeWalker(x));
    for (const x of L.flyers) enemies.push(makeFlyer(x));
    for (const x of (L.spitters || [])) enemies.push(makeSpitter(x));
    // Farbtropfen zum Einsammeln
    for (const [a, b] of L.ground)
      for (let x = a + 150; x < b - 80; x += 260) if (x < goalX - 100) pickups.push({ kind: 'drop', x: x - 10, y: GROUND_Y - 50, w: 20, h: 24 });
    for (const [x, y, w] of L.plats) pickups.push({ kind: 'drop', x: x + w / 2 - 10, y: y - 40, w: 20, h: 24 });
    for (const [x, y] of L.hearts) pickups.push({ kind: 'heart', x, y, w: 26, h: 24 });
  } else {
    levelW = W; goalX = Infinity;
    solids.push({ x: -50, y: ARENA_Y, w: W + 100, h: H - ARENA_Y, kind: 'ground' });
    solids.push({ x: 120, y: 340, w: 170, h: 18, oneWay: true, kind: 'plat' });
    solids.push({ x: W - 290, y: 340, w: 170, h: 18, oneWay: true, kind: 'plat' });
    boss = { pudding: makePudding, toaster: makeToaster, king: makeKing }[st.boss]();
  }
  players.forEach((p, k) => resetPlayer(p, 80 + k * 50, 300));
  bannerTimer = 2.5;
}

function hurt(p, force) {
  if (p.down || (p.inv > 0 && !force)) return;
  p.hp--;
  p.inv = 1.5;
  shake = 0.3;
  sfx.hurt();
  burst(p.x + p.w / 2, p.y + p.h / 2, p.color, 12);
  if (p.hp <= 0) {
    p.hp = 0; p.down = true; p.vx = p.vy = 0;
    p.y = clamp(p.y, 120, 380);
  }
}

function nearestPlayer(o) {
  let best = null, bd = Infinity;
  for (const p of players) {
    if (p.down) continue;
    const d = Math.abs(p.x - o.x) + Math.abs(p.y - o.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// Bewegen und an Wänden/Böden anhalten
function moveAndCollide(o, dt) {
  o.hitWall = false;
  o.x += o.vx * dt;
  for (const s of solids) {
    if (s.oneWay || !overlap(o, s)) continue;
    if (o.vx > 0) o.x = s.x - o.w; else if (o.vx < 0) o.x = s.x + s.w;
    o.hitWall = true;
  }
  const prevBottom = o.y + o.h;
  o.y += o.vy * dt;
  o.onGround = false; o.standOn = null;
  for (const s of solids) {
    if (!overlap(o, s)) continue;
    if (o.vy >= 0 && prevBottom <= s.y + 6) {
      o.y = s.y - o.h; o.vy = 0; o.onGround = true; o.standOn = s;
    } else if (!s.oneWay && o.vy < 0) {
      o.y = s.y + s.h; o.vy = 0;
    }
  }
}

function updatePlayer(p, dt) {
  p.anim += dt;
  if (p.down) {
    // Geist: der andere Spieler kann ihn durch Berühren wiederbeleben
    p.x = clamp(p.x, camX + 10, camX + W - p.w - 10);
    for (const o of players) {
      if (o !== p && !o.down && overlap(o, { x: p.x - 10, y: p.y - 10, w: p.w + 20, h: p.h + 20 })) {
        p.down = false; p.hp = 2; p.inv = 2; p.vy = 0;
        sfx.revive();
        burst(p.x + p.w / 2, p.y + p.h / 2, '#fff', 20);
      }
    }
    return;
  }
  const inp = getInput(p.k);
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  p.dive = inp.dive && p.onGround;
  p.vx = dir * (p.dive ? 340 : 240);

  // ---- Zielen ----
  if (inp.aimUp || inp.aimDown) p.aimMode = 'keys';
  else if (inp.stick !== null) p.aimMode = 'stick';
  else if (p.k === 0 && mouse.moved && mouse.x + mouse.y !== p.lastMouse) p.aimMode = 'mouse';   // Maus bewegt
  if (p.k === 0) p.lastMouse = mouse.x + mouse.y;
  if (p.aimMode === 'stick' && inp.stick !== null) {
    p.aim = inp.stick;
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
  } else if (p.aimMode === 'mouse') {
    const gx = p.x + p.w / 2 + p.face * 8 - camX, gy = p.y + 27;
    p.aim = Math.atan2(mouse.y - gy, mouse.x - gx);
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;   // schaut immer zur Maus
  } else {
    if (dir) p.face = dir;
    p.tilt = clamp(p.tilt + ((inp.aimUp ? 1 : 0) - (inp.aimDown ? 1 : 0)) * 2.5 * dt, -1.3, 1.3);
    p.aim = Math.atan2(-Math.sin(p.tilt), p.face * Math.cos(p.tilt));
  }

  p.coyote = p.onGround ? 0.1 : p.coyote - dt;
  if (inp.jump && !p.prevJump && p.coyote > 0) {
    p.vy = -560; p.coyote = 0; p.dive = false;
    sfx.jump();
  }
  if (!inp.jump && p.vy < -220) p.vy = -220;   // kurz drücken = kleiner Sprung
  p.prevJump = inp.jump;

  p.vy = Math.min(900, p.vy + GRAV * dt);
  if (p.standOn && p.standOn.kind === 'mover') { p.x += p.standOn.dx; p.y += p.standOn.dy; }
  moveAndCollide(p, dt);
  p.x = clamp(p.x, Math.max(0, camX), Math.min(levelW, camX + W) - p.w);
  if (p.onGround && p.standOn && p.standOn.kind !== 'mover') p.lastSafe = { x: p.x, y: p.y };

  // Tinte: lädt sich auf, abtauchen lädt viel schneller
  p.ink = Math.min(100, p.ink + (p.dive ? 75 : 18) * dt);
  p.cool -= dt;
  if (inp.shoot && !p.dive && p.cool <= 0 && p.ink >= 5) {
    // Schuss fliegt in Zielrichtung aus der Spritzen-Spitze
    const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
    shots.push({ x: p.x + p.w / 2 + p.face * 8 + ca * 26, y: p.y + 27 + sa * 26, vx: ca * 720, vy: sa * 720 - 40,
      r: 7, color: p.color, life: 1.3 });
    p.ink -= 5; p.cool = 0.12;
    sfx.shoot();
  }
  p.inv -= dt;

  // In ein Loch gefallen?
  if (p.y > H + 60) {
    p.x = p.lastSafe.x; p.y = p.lastSafe.y - 40; p.vx = p.vy = 0;
    hurt(p, true);
  }
}

// ---------- Gegner ----------
function makeWalker(x) {
  return { type: 'walker', x, y: GROUND_Y - 34, w: 42, h: 34, vx: -70, vy: 0, hp: 3, flash: 0, active: false, t: rand(0, 6) };
}
function makeFlyer(x) {
  const y = rand(200, 300);
  return { type: 'flyer', x, y, by: y, w: 38, h: 30, hp: 2, flash: 0, active: false, t: rand(0, 6) };
}
// Spucker: bleibt stehen und spuckt grauen Schleim
function makeSpitter(x) {
  return { type: 'spitter', x, y: GROUND_Y - 44, w: 40, h: 44, vx: 0, vy: 0, hp: 3, flash: 0, active: false, t: rand(0, 6),
    cool: rand(1, 2.5), look: -1, spit: 0 };
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.active) { if (e.x < camX + W + 60) e.active = true; else continue; }
    e.t += dt; e.flash -= dt;
    if (e.type === 'walker') {
      e.vy = Math.min(900, e.vy + GRAV * dt);
      moveAndCollide(e, dt);
      if (e.hitWall) e.vx = -e.vx;
      else if (e.onGround) {
        const fx = e.vx > 0 ? e.x + e.w + 3 : e.x - 3;
        if (!solidAt(fx, e.y + e.h + 6)) e.vx = -e.vx;
      }
      if (e.y > H + 100) e.dead = true;
      // in der Boss-Arena nicht aus dem Bild laufen
      if (boss && (e.x < 0 || e.x > W - e.w)) { e.x = clamp(e.x, 0, W - e.w); e.vx = e.x <= 0 ? Math.abs(e.vx) : -Math.abs(e.vx); }
    } else if (e.type === 'spitter') {
      e.vy = Math.min(900, e.vy + GRAV * dt);
      moveAndCollide(e, dt);
      e.cool -= dt; e.spit -= dt;
      const tp = nearestPlayer(e);
      if (tp) e.look = tp.x > e.x ? 1 : -1;
      if (tp && Math.abs(tp.x - e.x) < 550 && e.cool <= 0) {
        const sx = e.x + e.w / 2, sy = e.y + 4;
        const v = lob(sx, sy, tp.x + tp.w / 2, tp.y + tp.h, 1.0, 700);
        enemyShots.push({ type: 'slime', x: sx, y: sy, vx: v.vx, vy: v.vy, r: 10, g: 700, life: 3 });
        e.cool = rand(2, 2.8); e.spit = 0.3;
        tone(250, 120, 0.15, 'sawtooth', 0.04);
      }
      if (e.y > H + 100) e.dead = true;
    } else {
      const tp = nearestPlayer(e);
      if (tp && Math.abs(tp.x - e.x) < 600) e.x += clamp(tp.x - e.x, -1, 1) * 90 * dt;
      e.y = e.by + Math.sin(e.t * 3) * 40;
    }
    for (const p of players) if (!p.down && overlap(p, e)) hurt(p);
  }
  enemies = enemies.filter(e => !e.dead);
}

// ---------- Bosse ----------
function bossHp(base) { return Math.round(base * (numPlayers === 2 ? 1.6 : 1)); }

function makePudding() {
  const hp = bossHp(60);
  return { kind: 'pudding', name: 'Wackel-Pudding', x: W - 260, y: ARENA_Y - 130, w: 150, h: 130, vx: 0, vy: 0,
    hp, maxHp: hp, timer: 2.2, act: 'idle', squish: 0, flash: 0, t: 0, splats: [], dying: 0 };
}
function makeToaster() {
  const hp = bossHp(80);
  return { kind: 'toaster', name: 'Turbo-Toaster', x: W / 2 - 80, y: -150, w: 160, h: 110, vy: 0,
    hp, maxHp: hp, timer: 2.5, act: 'fly', baseY: 210, flash: 0, t: 0, splats: [], dying: 0, tx: 0 };
}

// Endboss: rollt hin und her, saugt die Spieler an und spuckt Staubbälle
function makeKing() {
  const hp = bossHp(110);
  return { kind: 'king', name: 'Staubsauger-König', x: W - 280, y: ARENA_Y - 120, w: 190, h: 120, face: -1,
    hp, maxHp: hp, timer: 2, act: 'idle', tx: 0, flash: 0, t: 0, splats: [], dying: 0 };
}
function kingNozzle(b) {
  return { x: b.face > 0 ? b.x + b.w + 45 : b.x - 45, y: ARENA_Y - 25 };
}
function kingSpit(b, tp, n) {
  const nz = kingNozzle(b);
  for (let i = 0; i < n; i++) {
    const v = lob(nz.x, nz.y, tp.x + tp.w / 2 + (i - (n - 1) / 2) * 100, ARENA_Y - 10, 1.0, 700);
    enemyShots.push({ type: 'slime', x: nz.x, y: nz.y, vx: v.vx, vy: v.vy, r: 12, g: 700, life: 4 });
  }
  tone(300, 100, 0.25, 'sawtooth', 0.06);
}

// Wurf, der nach T Sekunden bei (tx, ty) ankommt
function lob(sx, sy, tx, ty, T, g) {
  return { vx: (tx - sx) / T, vy: (ty - sy - 0.5 * g * T * T) / T };
}

function shockwaves(b, speed) {
  enemyShots.push({ type: 'wave', x: b.x - 20, y: ARENA_Y - 28, w: 34, h: 28, vx: -speed, life: 4 });
  enemyShots.push({ type: 'wave', x: b.x + b.w - 14, y: ARENA_Y - 28, w: 34, h: 28, vx: speed, life: 4 });
}

function updateBoss(b, dt) {
  b.t += dt; b.flash -= dt;
  if (b.dying > 0) {
    b.dying -= dt;
    if (Math.random() < 0.4) { burst(b.x + rand(0, b.w), b.y + rand(0, b.h), ['#ff7a00', '#b44cff', '#ffe04a', '#3ad1c4'][Math.floor(rand(0, 4))], 15); sfx.pop(); }
    if (b.dying <= 0) { stageClear(); }
    return;
  }
  const phase2 = b.hp < b.maxHp / 2;
  const tp = nearestPlayer(b);

  if (b.kind === 'pudding') {
    b.squish = Math.max(0, b.squish - dt * 2.5);
    if (b.act === 'jump') {
      b.vy += GRAV * 0.9 * dt;
      b.x = clamp(b.x + b.vx * dt, 0, W - b.w);
      b.y += b.vy * dt;
      if (b.vy > 0 && b.y >= ARENA_Y - b.h) {
        b.y = ARENA_Y - b.h; b.vy = 0; b.act = 'idle'; b.squish = 1;
        shake = 0.4; sfx.boom();
        shockwaves(b, phase2 ? 380 : 300);
        b.timer = phase2 ? 0.8 : 1.3;
      }
    } else {
      b.timer -= dt;
      if (b.timer <= 0 && tp) {
        if (Math.random() < 0.5) {
          b.act = 'jump'; b.vy = -(phase2 ? 850 : 780);
          const air = 2 * -b.vy / (GRAV * 0.9);
          b.vx = clamp((tp.x + tp.w / 2 - (b.x + b.w / 2)) / air, -500, 500);
          sfx.jump();
        } else {
          const n = phase2 ? 5 : 3;
          const sx = b.x + b.w / 2, sy = b.y + 10;
          for (let i = 0; i < n; i++) {
            const v = lob(sx, sy, tp.x + tp.w / 2 + (i - (n - 1) / 2) * 90, ARENA_Y - 10, 1.1, 700);
            enemyShots.push({ type: 'blob', x: sx, y: sy, vx: v.vx, vy: v.vy, r: 13, g: 700, life: 4 });
          }
          b.squish = 0.6; b.timer = phase2 ? 1.2 : 1.8;
          tone(200, 500, 0.15, 'triangle', 0.08);
        }
      }
    }
  } else if (b.kind === 'king') {
    if (b.act === 'roll') {
      // auf die andere Seite rollen – schnell auf eine Plattform!
      const d = b.tx - b.x;
      b.face = Math.sign(d) || b.face;
      b.x += Math.sign(d) * Math.min(Math.abs(d), (phase2 ? 320 : 230) * dt);
      if (Math.abs(d) < 2) { b.act = 'idle'; b.timer = phase2 ? 0.6 : 1.0; }
    } else if (b.act === 'idle') {
      b.timer -= dt;
      if (tp) b.face = tp.x + tp.w / 2 > b.x + b.w / 2 ? 1 : -1;
      if (b.timer <= 0 && tp) {
        const r = Math.random();
        if (r < 0.35) {
          b.act = 'roll'; b.tx = b.x < W / 2 - b.w / 2 ? W - b.w - 20 : 20;
          tone(120, 220, 0.4, 'sawtooth', 0.06);
        } else if (r < 0.7) {
          b.act = 'suck'; b.timer = 2.2;
          tone(150, 600, 2, 'sawtooth', 0.03);
        } else {
          kingSpit(b, tp, phase2 ? 5 : 3);
          b.timer = phase2 ? 1.0 : 1.5;
        }
      }
    } else if (b.act === 'suck') {
      // Saugen! Lauf weg, sonst wirst du reingezogen
      b.timer -= dt;
      const nz = kingNozzle(b);
      for (const p of players) {
        if (p.down) continue;
        const dx = nz.x - (p.x + p.w / 2);
        if (Math.abs(dx) < 650) p.x += Math.sign(dx) * (phase2 ? 170 : 130) * dt;
      }
      if (b.timer <= 0) {
        b.act = 'idle'; b.timer = 0.8;
        if (tp) kingSpit(b, tp, phase2 ? 4 : 2);
        if (phase2) {   // spuckt einen Grauschleimer aus
          const e = makeWalker(clamp(nz.x - 21, 10, W - 52));
          e.y = ARENA_Y - 80; e.vx = b.face * 90; e.active = true;
          enemies.push(e);
        }
      }
    }
  } else { // Toaster
    if (b.act === 'fly') {
      const tx = W / 2 - b.w / 2 + Math.sin(b.t * (phase2 ? 1.1 : 0.8)) * 300;
      const ty = b.baseY + Math.sin(b.t * 2) * 35;
      b.x += (tx - b.x) * Math.min(1, dt * 3);
      b.y += (ty - b.y) * Math.min(1, dt * 3);
      b.timer -= dt;
      if (b.timer <= 0 && tp) {
        if (Math.random() < 0.35) {
          b.act = 'warn'; b.timer = 0.8;
          b.tx = clamp(tp.x + tp.w / 2 - b.w / 2, 0, W - b.w);
        } else {
          const n = phase2 ? 3 : 1;
          const sx = b.x + b.w / 2, sy = b.y;
          for (let i = 0; i < n; i++) {
            const v = lob(sx, sy, tp.x + tp.w / 2 + (i - (n - 1) / 2) * 110, ARENA_Y - 10, 1.2, 700);
            enemyShots.push({ type: 'toast', x: sx + (i - 1) * 20, y: sy, vx: v.vx, vy: v.vy, r: 14, g: 700, life: 4, rot: 0 });
          }
          b.timer = phase2 ? 1.0 : 1.6;
          tone(800, 300, 0.2, 'square', 0.05);
        }
      }
    } else if (b.act === 'warn') {
      b.timer -= dt;
      b.x += (b.tx - b.x) * Math.min(1, dt * 5);
      if (b.timer <= 0) { b.act = 'dive'; b.vy = 0; }
    } else if (b.act === 'dive') {
      b.vy += 2500 * dt; b.y += b.vy * dt;
      if (b.y >= ARENA_Y - b.h) {
        b.y = ARENA_Y - b.h; b.act = 'ground'; b.timer = phase2 ? 1.2 : 1.8;
        shake = 0.5; sfx.boom();
        shockwaves(b, phase2 ? 400 : 320);
      }
    } else if (b.act === 'ground') {
      b.timer -= dt;
      if (b.timer <= 0) b.act = 'rise';
    } else if (b.act === 'rise') {
      b.y -= 300 * dt;
      if (b.y <= b.baseY) { b.act = 'fly'; b.timer = 1.2; }
    }
  }
  // Berührung tut weh
  const box = { x: b.x + 12, y: b.y + 12, w: b.w - 24, h: b.h - 12 };
  for (const p of players) if (!p.down && overlap(p, box)) hurt(p);
}

// ---------- Schüsse, Farbkleckse, Partikel ----------
function addSplat(s, x, y, color, r) {
  const dots = Array.from({ length: 5 }, () => { const a = rand(0, 6.28), d = r * rand(0.8, 1.5); return [Math.cos(a) * d, Math.sin(a) * d, r * rand(0.2, 0.4)]; });
  splats.push({ s, ox: x - s.x, oy: y - s.y, r, color, dots });
  if (splats.length > 400) splats.shift();
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(100, 350);
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, life: rand(0.4, 0.9), r: rand(3, 7), color });
  }
}

function updateShots(dt) {
  for (const s of shots) {
    s.vy += 250 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    const so = solidAt(s.x, s.y);
    if (so) { addSplat(so, s.x, s.y, s.color, rand(14, 24)); s.dead = true; continue; }
    for (const e of enemies) {
      if (!e.active || !circleRect(s, e)) continue;
      s.dead = true; e.hp--; e.flash = 0.1; sfx.hit();
      burst(s.x, s.y, s.color, 4);
      if (e.hp <= 0) {
        e.dead = true; score += 100; sfx.pop();
        burst(e.x + e.w / 2, e.y + e.h / 2, s.color, 25);
        const under = solidAt(e.x + e.w / 2, e.y + e.h + 4) || solidAt(e.x + e.w / 2, GROUND_Y + 2);
        if (under) addSplat(under, e.x + e.w / 2, under.y + 4, s.color, 34);
      }
      break;
    }
    if (!s.dead && boss && boss.hp > 0 && circleRect(s, boss)) {
      s.dead = true; boss.hp--; boss.flash = 0.06; score += 5; sfx.hit();
      burst(s.x, s.y, s.color, 3);
      boss.splats.push({ ox: s.x - boss.x + s.vx * 0.01, oy: s.y - boss.y, r: rand(7, 13), color: s.color });
      if (boss.splats.length > 80) boss.splats.shift();
      if (boss.hp <= 0) {
        boss.hp = 0; boss.dying = 2; score += 1000; shake = 0.6; sfx.boom(); enemyShots = [];
        for (const e of enemies) burst(e.x + e.w / 2, e.y + e.h / 2, s.color, 15);
        enemies = [];
      }
    }
    if (s.life <= 0 || s.x < camX - 50 || s.x > camX + W + 50) s.dead = true;
  }
  shots = shots.filter(s => !s.dead);

  for (const s of enemyShots) {
    s.life -= dt;
    if (s.type === 'wave') {
      s.x += s.vx * dt;
      if (s.x < -60 || s.x > W + 60) s.dead = true;
      for (const p of players) if (!p.down && overlap(p, s)) { hurt(p); }
    } else {
      s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.rot !== undefined) s.rot += dt * 8;
      for (const p of players) if (!p.down && circleRect(s, p)) { hurt(p); s.dead = true; }
      const so = solidAt(s.x, s.y + s.r);
      if (so && !so.oneWay) { addSplat(so, s.x, so.y + 3, '#6d6a7c', 20); burst(s.x, s.y, '#8a8799', 6); s.dead = true; }
    }
    if (s.life <= 0) s.dead = true;
  }
  enemyShots = enemyShots.filter(s => !s.dead);

  for (const q of particles) { q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  particles = particles.filter(q => q.life > 0);
}

function updatePickups() {
  for (const it of pickups) {
    for (const p of players) {
      if (p.down || it.taken || !overlap(p, it)) continue;
      if (it.kind === 'drop') { score += 10; sfx.coin(); burst(it.x + 10, it.y + 12, `hsl(${(it.x * 0.3) % 360},90%,60%)`, 6); it.taken = true; }
      else if (p.hp < 3) { p.hp++; sfx.revive(); burst(it.x + 13, it.y + 12, '#ff3b5c', 12); it.taken = true; }
    }
  }
  pickups = pickups.filter(it => !it.taken);
}

function stageClear() {
  if (state !== 'play') return;
  state = 'clear'; clearTimer = 3;
  score += 500;
  sfx.win();
  for (let i = 0; i < 6; i++) burst(camX + rand(100, W - 100), rand(100, 300), `hsl(${rand(0, 360)},90%,60%)`, 15);
}

// ---------- Hauptupdate ----------
function update(dt) {
  t += dt;
  shake = Math.max(0, shake - dt);
  bannerTimer -= dt;

  if (state === 'title') {
    if (Math.random() < dt * 6) titleSplats.push({ x: rand(0, W), y: rand(0, H), r: rand(20, 60), color: `hsl(${rand(0, 360)},90%,60%)`, a: 0 });
    for (const s of titleSplats) s.a = Math.min(0.35, s.a + dt);
    if (titleSplats.length > 60) titleSplats.shift();
    return;
  }
  if (state === 'clear') {
    for (const q of particles) { q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    particles = particles.filter(q => q.life > 0);
    if (Math.random() < dt * 4) burst(camX + rand(100, W - 100), rand(80, 300), `hsl(${rand(0, 360)},90%,60%)`, 12);
    clearTimer -= dt;
    if (clearTimer <= 0) {
      // geschafft merken und nächstes Level freischalten
      progress.cleared[stageIndex] = true;
      const before = progress.unlocked;
      progress.unlocked = Math.max(progress.unlocked, Math.min(STAGES.length, stageIndex + 2));
      saveProgress();
      saveHighscore();
      if (stageIndex + 1 < STAGES.length) {
        goToMap(stageIndex + 1, stageIndex);
        if (progress.unlocked > before) { mapUnlockTimer = 2.5; sfx.revive(); }
      } else { state = 'win'; }
    }
    return;
  }
  if (state === 'map') {
    const [tx, ty] = STAGES[mapSel].map;
    if (Math.abs(tx - mapPos.x) > 2) mapFace = Math.sign(tx - mapPos.x);
    mapPos.x += (tx - mapPos.x) * Math.min(1, dt * 4);
    mapPos.y += (ty - mapPos.y) * Math.min(1, dt * 4);
    mapLock -= dt; mapUnlockTimer -= dt;
    return;
  }
  if (state !== 'play' || paused) return;

  // bewegliche Plattformen
  for (const s of solids) {
    if (s.kind !== 'mover') continue;
    s.t += dt;
    const off = Math.sin(s.t * s.speed) * s.range;
    const nx = s.ax === 'x' ? s.bx + off : s.bx, ny = s.ax === 'y' ? s.by + off : s.by;
    s.dx = nx - s.x; s.dy = ny - s.y; s.x = nx; s.y = ny;
  }
  for (const p of players) updatePlayer(p, dt);
  updateEnemies(dt);
  if (boss) updateBoss(boss, dt);
  updateShots(dt);
  updatePickups();

  // Kamera folgt den Spielern
  const alive = players.filter(p => !p.down);
  const ref = alive.length ? alive : players;
  const avg = ref.reduce((s, p) => s + p.x, 0) / ref.length;
  const target = clamp(avg - W * 0.4, 0, levelW - W);
  camX += (target - camX) * Math.min(1, dt * 5);

  // Ziel erreicht?
  if (alive.some(p => p.x + p.w > goalX)) stageClear();
  // Alle besiegt?
  if (state === 'play' && !alive.length) { state = 'gameover'; saveHighscore(); sfx.lose(); }
}

function onKey(code) {
  if (state === 'title') {
    if (code === 'Digit1' || code === 'Numpad1') start(1);
    if (code === 'Digit2' || code === 'Numpad2') start(2);
  } else if (state === 'map') {
    if (code === 'KeyA' || code === 'ArrowLeft') mapMove(-1);
    if (code === 'KeyD' || code === 'ArrowRight') mapMove(1);
    if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') startStage(mapSel);
    if (code === 'Escape') state = 'title';
  } else if (state === 'gameover') {
    if (code === 'Space' || code === 'Enter') { score = stageStartScore; loadStage(stageIndex); state = 'play'; }
    if (code === 'Escape') { score = stageStartScore; goToMap(stageIndex); }
  } else if (state === 'win') {
    if (code === 'Space' || code === 'Enter') goToMap(STAGES.length - 1);
  } else if (state === 'play') {
    if (code === 'Escape' || code === 'KeyP') paused = !paused;
    if (paused && code === 'KeyQ') { paused = false; score = stageStartScore; goToMap(stageIndex); }
  }
}

// Controller-Knopf A / Start im Menü
let padPrev = false, padPrevDir = 0;
function pollPadMenu() {
  const pads = getPads();
  const btn = pads.some(gp => (gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[9] && gp.buttons[9].pressed));
  if (btn && !padPrev) {
    if (state === 'title') start(clamp(pads.length, 1, 2));
    else if (state === 'map') startStage(mapSel);
    else if (state === 'gameover') onKey('Enter');
    else if (state === 'win') onKey('Enter');
  }
  padPrev = btn;
  // Steuerkreuz / Stick links-rechts auf der Weltkarte
  let dir = 0;
  for (const gp of pads) {
    const ax = gp.axes[0] || 0;
    if (ax < -0.5 || (gp.buttons[14] && gp.buttons[14].pressed)) dir = -1;
    if (ax > 0.5 || (gp.buttons[15] && gp.buttons[15].pressed)) dir = 1;
  }
  if (state === 'map' && dir && dir !== padPrevDir) mapMove(dir);
  padPrevDir = dir;
}

// =====================================================
//  ZEICHNEN
// =====================================================
function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function heart(x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-11, -2, -6, -12, 0, -5);
  ctx.bezierCurveTo(6, -12, 11, -2, 0, 6);
  ctx.fill(); ctx.restore();
}
function text(str, x, y, size, color, align = 'center', outline = true) {
  ctx.font = `900 ${size}px "Arial Black", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (outline) { ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = '#1a1030'; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function drawCloud(x, y, s, color = 'rgba(255,255,255,0.85)') {
  ctx.fillStyle = color;
  circle(x, y, 22 * s); circle(x + 25 * s, y - 10 * s, 28 * s); circle(x + 52 * s, y, 22 * s); ellipse(x + 26 * s, y + 8 * s, 48 * s, 14 * s);
}

function drawBackground(st) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, st.sky[0]); g.addColorStop(1, st.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (st.night) {
    for (const s of stars) { ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 2 + s.x)})`; circle(s.x, s.y, s.r); }
    ctx.fillStyle = '#fff6c8'; circle(800, 90, 40); ctx.fillStyle = st.sky[0]; circle(785, 80, 34);
  } else {
    ctx.fillStyle = 'rgba(255,240,150,0.9)'; circle(820, 90, 45);
  }
  for (const c of clouds) {
    const x = ((c.x - camX * 0.1) % (W + 200) + W + 200) % (W + 200) - 100;
    drawCloud(x, c.y, c.s, st.night ? 'rgba(180,180,255,0.15)' : 'rgba(255,255,255,0.85)');
  }
  const hills = (color, par, base, a1, a2) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) { const wx = x + camX * par; ctx.lineTo(x, base + Math.sin(wx * 0.006) * a1 + Math.sin(wx * 0.017) * a2); }
    ctx.lineTo(W, H); ctx.fill();
  };
  hills(st.hill2, 0.2, 320, 40, 15);
  hills(st.hill, 0.45, 380, 30, 12);
}

// Blubbernde Lava ganz unten (sieht man in den Löchern)
function drawLava() {
  const g = ctx.createLinearGradient(0, 470, 0, H);
  g.addColorStop(0, '#ffcf3a'); g.addColorStop(1, '#ff3a1a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 490 + Math.sin((x + camX) * 0.03 + t * 3) * 6);
  ctx.lineTo(W, H); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,150,0.8)';
  for (let i = 0; i < 12; i++) {
    const bx = ((i * 233 - camX) % W + W) % W, ph = (t * 0.8 + i * 0.37) % 1;
    circle(bx, 505 - ph * 25, 5 * (1 - ph));
  }
}

function drawSolids(st) {
  for (const s of solids) {
    const x = s.x - camX;
    if (x > W || x + s.w < 0) continue;
    if (s.kind === 'ground') {
      ctx.fillStyle = st.dirt; ctx.fillRect(x, s.y, s.w, s.h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 20; i < s.w; i += 60) circle(x + i, s.y + 40 + (i % 3) * 10, 6);
      ctx.fillStyle = st.top; ctx.beginPath(); ctx.roundRect(x, s.y - 4, s.w, 16, 6); ctx.fill();
    } else {
      ctx.fillStyle = s.kind === 'mover' ? '#ffd23f' : st.plat;
      ctx.beginPath(); ctx.roundRect(x, s.y, s.w, s.h, 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 6, s.y + s.h - 5, s.w - 12, 3);
    }
  }
  // Farbkleckse auf dem Boden (nur innerhalb der Böden sichtbar)
  ctx.save();
  ctx.beginPath();
  for (const s of solids) ctx.rect(s.x - camX, s.y - 4, s.w, s.h + 4);
  ctx.clip();
  for (const sp of splats) {
    const x = sp.s.x + sp.ox - camX, y = sp.s.y + sp.oy;
    if (x < -80 || x > W + 80) continue;
    ctx.fillStyle = sp.color;
    circle(x, y, sp.r);
    for (const [dx, dy, r] of sp.dots) circle(x + dx, y + dy, r);
  }
  ctx.restore();
}

function drawGoal() {
  const x = goalX - camX;
  if (x < -100 || x > W + 100) return;
  ctx.fillStyle = '#ddd'; ctx.fillRect(x, GROUND_Y - 180, 8, 180);
  ctx.fillStyle = '#ffe04a'; circle(x + 4, GROUND_Y - 184, 9);
  ctx.beginPath(); ctx.moveTo(x + 8, GROUND_Y - 175);
  for (let i = 0; i <= 10; i++) ctx.lineTo(x + 8 + i * 9, GROUND_Y - 175 + Math.sin(t * 5 + i * 0.6) * 5);
  for (let i = 10; i >= 0; i--) ctx.lineTo(x + 8 + i * 9, GROUND_Y - 120 + Math.sin(t * 5 + i * 0.6) * 5);
  const g = ctx.createLinearGradient(x, 0, x + 100, 0);
  g.addColorStop(0, '#ff7a00'); g.addColorStop(0.5, '#ff3b8d'); g.addColorStop(1, '#b44cff');
  ctx.fillStyle = g; ctx.fill();
  text('ZIEL', x + 54, GROUND_Y - 147, 18, '#fff');
}

function drawPickups() {
  for (const it of pickups) {
    const x = it.x - camX, y = it.y + Math.sin(t * 4 + it.x) * 4;
    if (x < -40 || x > W + 40) continue;
    if (it.kind === 'drop') {
      ctx.fillStyle = `hsl(${(it.x * 0.3 + t * 60) % 360},90%,58%)`;
      ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.quadraticCurveTo(x + 22, y + 14, x + 10, y + 24); ctx.quadraticCurveTo(x - 2, y + 14, x + 10, y); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(x + 7, y + 14, 3);
    } else {
      heart(x + 13, y + 12, 1.6 + Math.sin(t * 6) * 0.1, '#ff3b5c');
    }
  }
}

// Unser Held: ein Tintenfisch-Kind mit Farbspritze
function drawKrakel(p, x, y, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(p.face * scale, scale);
  const c = p.color, l = p.light;
  if (p.dive) {
    ctx.fillStyle = c; ellipse(0, -6, 28, 8 + Math.sin(t * 12));
    ctx.fillStyle = l; ellipse(-6, -8, 10, 3);
    ctx.fillStyle = '#fff'; circle(8, -10, 4); circle(16, -10, 4);
    ctx.fillStyle = '#111'; circle(9, -10, 2); circle(17, -10, 2);
    ctx.restore(); return;
  }
  const walk = p.onGround && Math.abs(p.vx) > 1 ? Math.sin(p.anim * 16) : 0;
  // Tentakel-Beinchen
  ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const lx = -11 + i * 7, s = i % 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(lx, -16);
    ctx.quadraticCurveTo(lx + walk * 5 * s, -8, lx + s * 3 + walk * 4 * s, -3);
    ctx.stroke();
  }
  // Kopf
  ctx.fillStyle = c; ellipse(0, -30, 17, 19);
  // Zipfel oben
  ctx.beginPath(); ctx.moveTo(-12, -42); ctx.quadraticCurveTo(-4, -60 + walk * 2, 8, -46); ctx.fill();
  ctx.fillStyle = l; circle(-9, -38, 3.5); circle(-11, -26, 2.5); circle(-3, -46, 2);
  // Augen
  ctx.fillStyle = '#fff'; ellipse(3, -31, 5.5, 7); ellipse(12, -31, 5.5, 7);
  ctx.fillStyle = '#111'; circle(5, -30, 3); circle(14, -30, 3);
  ctx.fillStyle = '#fff'; circle(6, -32, 1.2); circle(15, -32, 1.2);
  // Mund
  ctx.strokeStyle = '#3a1a00'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(9, -22, 4, 0.2, Math.PI - 0.2); ctx.stroke();
  // Farbspritze (dreht sich in Zielrichtung)
  const aim = p.aim || 0;
  ctx.save(); ctx.translate(8, -17); ctx.rotate(Math.atan2(Math.sin(aim), Math.abs(Math.cos(aim))));
  ctx.fillStyle = '#3b3b4f'; ctx.beginPath(); ctx.roundRect(0, -4, 20, 8, 3); ctx.fill();
  ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(2, -10, 10, 7, 3); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(19, -2, 5, 4);
  ctx.restore();
  // Farbtank auf dem Rücken
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.roundRect(-24, -40, 9, 22, 4); ctx.fill();
  ctx.fillStyle = c; ctx.fillRect(-23, -19 - 20 * (p.ink / 100), 7, 20 * (p.ink / 100));
  ctx.restore();
}

function drawPlayers() {
  for (const p of players) {
    const x = p.x + p.w / 2 - camX, y = p.y + p.h;
    if (p.down) {
      ctx.save(); ctx.globalAlpha = 0.5;
      drawKrakel({ ...p, dive: false, onGround: false }, x, y + Math.sin(t * 3) * 6);
      ctx.strokeStyle = '#ffe04a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y - 64 + Math.sin(t * 3) * 6, 14, 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (players.some(o => !o.down)) text('Berühr mich!', x, y - 82, 13, '#fff');
      continue;
    }
    // Ziel-Pünktchen zeigen, wohin du spritzt
    if (!p.dive) {
      const gx = p.x + p.w / 2 + p.face * 8 - camX, gy = p.y + 27;
      ctx.fillStyle = p.light;
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.8 - i * 0.2;
        circle(gx + Math.cos(p.aim) * (30 + i * 16), gy + Math.sin(p.aim) * (30 + i * 16), 4 - i * 0.6);
      }
      ctx.globalAlpha = 1;
    }
    if (p.inv > 0 && Math.floor(p.inv * 15) % 2) continue;   // blinken
    drawKrakel(p, x, y);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const x = e.x - camX, y = e.y;
    if (x < -60 || x > W + 60) continue;
    const body = e.flash > 0 ? '#fff' : '#6f6a86';
    const dir = e.type === 'walker' ? Math.sign(e.vx) : e.type === 'spitter' ? e.look : 1;
    if (e.type === 'spitter') {
      // dicker Schleimturm mit Spuck-Mund oben
      const puff = e.spit > 0 ? 4 : Math.sin(e.t * 4) * 1.5;
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(x - 2, y + e.h); ctx.quadraticCurveTo(x - 4 - puff, y + 6, x + e.w / 2, y - puff);
      ctx.quadraticCurveTo(x + e.w + 4 + puff, y + 6, x + e.w + 2, y + e.h); ctx.fill();
      ctx.fillStyle = '#3d3852'; ellipse(x + e.w / 2, y + 30, 7, e.spit > 0 ? 7 : 4);
      ctx.fillStyle = '#58536e'; circle(x + 6, y + e.h - 3, 5); circle(x + e.w - 6, y + e.h - 2, 4);
    } else if (e.type === 'walker') {
      const sq = Math.sin(e.t * 10) * 2;
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(x, y + e.h); ctx.quadraticCurveTo(x - 2, y - sq, x + e.w / 2, y - sq); ctx.quadraticCurveTo(x + e.w + 2, y - sq, x + e.w, y + e.h); ctx.fill();
      ctx.fillStyle = '#58536e'; circle(x + 8, y + e.h - 2, 4); circle(x + e.w - 10, y + e.h - 1, 5);
    } else {
      const flap = Math.sin(e.t * 18) * 10;
      ctx.fillStyle = '#58536e';
      ctx.beginPath(); ctx.moveTo(x + 8, y + 12); ctx.lineTo(x - 14, y + 2 + flap); ctx.lineTo(x + 4, y + 22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + e.w - 8, y + 12); ctx.lineTo(x + e.w + 14, y + 2 + flap); ctx.lineTo(x + e.w - 4, y + 22); ctx.fill();
      ctx.fillStyle = body; ellipse(x + e.w / 2, y + e.h / 2, e.w / 2, e.h / 2);
    }
    // böse Augen
    const ex = x + e.w / 2 + dir * 4, ey = y + (e.type === 'walker' ? 13 : 12);
    ctx.fillStyle = '#fff'; circle(ex - 7, ey, 5); circle(ex + 7, ey, 5);
    ctx.fillStyle = '#d4ff3a'; circle(ex - 7 + dir * 1.5, ey + 1, 2.5); circle(ex + 7 + dir * 1.5, ey + 1, 2.5);
    ctx.strokeStyle = '#2a2540'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ex - 12, ey - 7); ctx.lineTo(ex - 3, ey - 4); ctx.moveTo(ex + 12, ey - 7); ctx.lineTo(ex + 3, ey - 4); ctx.stroke();
  }
}

function bossEyes(b, cx, cy, gap, flip = 1) {
  const tp = nearestPlayer(b);
  const lx = tp ? clamp((tp.x - b.x - b.w / 2) / 200, -1, 1) * 4 * flip : 0;
  ctx.fillStyle = '#fff'; ellipse(cx - gap, cy, 13, 15); ellipse(cx + gap, cy, 13, 15);
  ctx.fillStyle = '#111'; circle(cx - gap + lx, cy + 3, 6); circle(cx + gap + lx, cy + 3, 6);
  ctx.strokeStyle = '#2a1000'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - gap - 14, cy - 20); ctx.lineTo(cx - gap + 10, cy - 12);
  ctx.moveTo(cx + gap + 14, cy - 20); ctx.lineTo(cx + gap - 10, cy - 12); ctx.stroke();
}

function drawBossSplats(b) {
  for (const s of b.splats) { ctx.fillStyle = s.color; circle(s.ox, s.oy, s.r); }
}

function drawBoss(b) {
  ctx.save();
  if (b.dying > 0) { ctx.globalAlpha = Math.max(0, b.dying / 2); ctx.translate(rand(-4, 4), rand(-4, 4)); }
  const phase2 = b.hp < b.maxHp / 2;
  if (b.kind === 'pudding') {
    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(b.x + b.w / 2, ARENA_Y + 4, b.w / 2 + 10, 8);
    const wob = Math.sin(t * 8) * 0.03;
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    ctx.scale(1 + b.squish * 0.25 + wob, 1 - b.squish * 0.25 - wob);
    ctx.translate(-b.w / 2, -b.h);
    // Pudding-Körper
    const body = new Path2D();
    body.moveTo(0, b.h); body.lineTo(20, 20); body.quadraticCurveTo(75, 0, 130, 20); body.lineTo(b.w, b.h); body.closePath();
    ctx.fillStyle = b.flash > 0 ? '#fff' : (phase2 ? '#f6a65e' : '#f7cf6a');
    ctx.fill(body);
    ctx.save(); ctx.clip(body); drawBossSplats(b);
    // Karamell oben
    ctx.fillStyle = '#8b4a1c';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(b.w, 0); ctx.lineTo(b.w, 30);
    for (let i = 6; i >= 0; i--) ctx.lineTo(i * 25, 30 + (i % 2 ? 18 : 4) + Math.sin(t * 3 + i) * 3);
    ctx.fill();
    ctx.restore();
    // Kirsche
    ctx.strokeStyle = '#3a6b1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(75, 4); ctx.quadraticCurveTo(80, -20, 92, -26); ctx.stroke();
    ctx.fillStyle = '#e0123f'; circle(75, 2, 13); ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(70, -2, 4);
    bossEyes(b, 75, 68, 26);
    // Mund
    ctx.fillStyle = '#5a1a0a'; ctx.beginPath(); ctx.ellipse(75, 102, 24, 8 + b.squish * 8 + (phase2 ? 4 : 0), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(62, 95, 8, 6); ctx.fillRect(80, 95, 8, 6);
  } else if (b.kind === 'king') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(b.x + b.w / 2, ARENA_Y + 4, b.w / 2 + 10, 8);
    const flip = b.face < 0 ? -1 : 1;
    ctx.translate(b.x + (flip < 0 ? b.w : 0), b.y); ctx.scale(flip, 1);
    const bob = b.act === 'roll' ? Math.sin(t * 20) * 2 : 0;
    const nzx = b.w + 45, nzy = b.h - 25, cx = b.w / 2;
    // Saug-Wirbel: Luft fliegt in die Düse
    if (b.act === 'suck') {
      for (let i = 0; i < 12; i++) {
        const d = (t * 2.5 + i / 12) % 1;
        ctx.fillStyle = `rgba(255,255,255,${0.7 * d})`;
        circle(nzx + 20 + (1 - d) * 280, nzy + Math.sin(i * 2.3) * 80 * (1 - d), 3 + 4 * (1 - d));
      }
    }
    // Schlauch und Düse
    ctx.strokeStyle = '#4a4560'; ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.w - 20, 50 + bob); ctx.quadraticCurveTo(b.w + 50, 30, nzx, nzy - 14); ctx.stroke();
    ctx.fillStyle = '#2f2b40';
    ctx.beginPath(); ctx.moveTo(nzx - 12, nzy - 18); ctx.lineTo(nzx + 12, nzy - 18); ctx.lineTo(nzx + 24, nzy + 14); ctx.lineTo(nzx - 24, nzy + 14); ctx.fill();
    // Räder
    for (const wx of [40, b.w - 40]) {
      ctx.fillStyle = '#222'; circle(wx, b.h - 14, 14);
      ctx.fillStyle = '#888'; circle(wx + Math.cos(b.x * 0.1) * 6, b.h - 14 + Math.sin(b.x * 0.1) * 6, 3);
    }
    // Körper
    const body = new Path2D(); body.roundRect(0, bob, b.w, b.h - 20, 34);
    ctx.fillStyle = b.flash > 0 ? '#fff' : (phase2 ? '#a86a9a' : '#7d7896');
    ctx.fill(body);
    ctx.save(); ctx.clip(body);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 66 + bob, b.w, 12);
    drawBossSplats(b);
    ctx.restore();
    // Krone
    ctx.fillStyle = '#ffd23f'; ctx.beginPath();
    ctx.moveTo(cx - 40, 8 + bob); ctx.lineTo(cx - 40, -22 + bob); ctx.lineTo(cx - 20, -6 + bob); ctx.lineTo(cx, -32 + bob);
    ctx.lineTo(cx + 20, -6 + bob); ctx.lineTo(cx + 40, -22 + bob); ctx.lineTo(cx + 40, 8 + bob); ctx.fill();
    ctx.fillStyle = '#e0123f'; circle(cx, -6 + bob, 5);
    ctx.fillStyle = '#3ad1c4'; circle(cx - 26, 0 + bob, 3.5); circle(cx + 26, 0 + bob, 3.5);
    // Gesicht
    bossEyes(b, cx + 12, 40 + bob, 26, flip);
    ctx.fillStyle = '#2a2540'; ctx.beginPath(); ctx.roundRect(cx - 10, 72 + bob, 44, 10 + (b.act === 'suck' ? 12 : 0), 5); ctx.fill();
  } else {
    // Toaster
    const warn = b.act === 'warn' && Math.floor(t * 12) % 2;
    if (b.act !== 'ground' && b.act !== 'dive') {
      ctx.fillStyle = `rgba(255,${150 + Math.random() * 80},40,0.9)`;
      for (const fx of [30, b.w - 30]) { ctx.beginPath(); ctx.moveTo(b.x + fx - 12, b.y + b.h); ctx.lineTo(b.x + fx, b.y + b.h + 25 + Math.random() * 15); ctx.lineTo(b.x + fx + 12, b.y + b.h); ctx.fill(); }
    }
    ctx.translate(b.x, b.y);
    // Toastscheiben schauen raus
    ctx.fillStyle = '#d99a4e';
    for (const sx of [30, 90]) { ctx.beginPath(); ctx.roundRect(sx, -18 + Math.sin(t * 6 + sx) * 4, 40, 30, 10); ctx.fill(); }
    const body = new Path2D(); body.roundRect(0, 0, b.w, b.h, 22);
    ctx.fillStyle = b.flash > 0 || warn ? '#fff' : (phase2 ? '#e8a9a9' : '#c9d1dc');
    ctx.fill(body);
    ctx.save(); ctx.clip(body);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(10, 8, 18, b.h - 16);
    drawBossSplats(b);
    ctx.restore();
    ctx.fillStyle = '#4a4f5c'; ctx.fillRect(25, 2, 50, 6); ctx.fillRect(85, 2, 50, 6);
    // Hebel
    ctx.fillStyle = '#333'; ctx.fillRect(b.w, 40, 14, 8); ctx.fillStyle = '#e0123f'; ctx.beginPath(); ctx.roundRect(b.w + 8, 34, 14, 20, 5); ctx.fill();
    bossEyes(b, 80, 48, 30);
    ctx.fillStyle = '#2a2a33'; ctx.beginPath(); ctx.roundRect(52, 76, 56, 14 + (phase2 ? 6 : 0), 6); ctx.fill();
    ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) ctx.fillRect(56 + i * 10, 76, 7, 5);
  }
  ctx.restore();
}

function drawShots() {
  for (const s of shots) {
    ctx.fillStyle = s.color; circle(s.x - camX, s.y, s.r);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(s.x - camX - 2, s.y - 2, 2.5);
    const sp = Math.hypot(s.vx, s.vy) || 1;
    ctx.fillStyle = s.color; circle(s.x - camX - s.vx / sp * 10, s.y - s.vy / sp * 10, 4);
  }
  for (const s of enemyShots) {
    const x = s.x - camX;
    if (s.type === 'wave') {
      ctx.fillStyle = boss && boss.kind === 'toaster' ? '#ffd86b' : '#f7cf6a';
      ctx.beginPath(); ctx.moveTo(x, s.y + s.h); ctx.quadraticCurveTo(x + s.w / 2, s.y - 14, x + s.w, s.y + s.h); ctx.fill();
    } else if (s.type === 'blob') {
      ctx.fillStyle = '#8b4a1c'; circle(x, s.y, s.r);
      ctx.fillStyle = '#c47a3a'; circle(x - 4, s.y - 4, 4);
    } else if (s.type === 'slime') {
      ctx.fillStyle = '#6f6a86'; circle(x, s.y, s.r);
      ctx.fillStyle = '#a7a2bd'; circle(x - 3, s.y - 3, 3);
    } else {
      ctx.save(); ctx.translate(x, s.y); ctx.rotate(s.rot);
      ctx.fillStyle = '#9c5a1f'; ctx.beginPath(); ctx.roundRect(-15, -15, 30, 30, 8); ctx.fill();
      ctx.fillStyle = '#f0c27a'; ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 5); ctx.fill();
      ctx.restore();
    }
  }
  for (const q of particles) {
    ctx.globalAlpha = clamp(q.life * 2, 0, 1);
    ctx.fillStyle = q.color; circle(q.x - camX, q.y, q.r);
  }
  ctx.globalAlpha = 1;
}

function drawHUD(st) {
  players.forEach((p, k) => {
    const x = k ? W - 196 : 14, y = 12;
    ctx.fillStyle = 'rgba(20,12,40,0.55)'; ctx.beginPath(); ctx.roundRect(x, y, 182, 58, 12); ctx.fill();
    text(p.name, x + 12, y + 16, 15, p.color, 'left');
    for (let i = 0; i < 3; i++) heart(x + 108 + i * 24, y + 16, 1.1, i < p.hp ? '#ff3b5c' : 'rgba(255,255,255,0.25)');
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.roundRect(x + 12, y + 34, 158, 12, 6); ctx.fill();
    ctx.fillStyle = p.ink < 5 ? '#ff3b5c' : p.color; ctx.beginPath(); ctx.roundRect(x + 12, y + 34, Math.max(6, 158 * p.ink / 100), 12, 6); ctx.fill();
  });
  text('Punkte: ' + score, W / 2, 26, 20, '#ffe04a');
  if (boss) {
    const bw = 500, bx = W / 2 - bw / 2, by = H - 34;
    ctx.fillStyle = 'rgba(20,12,40,0.6)'; ctx.beginPath(); ctx.roundRect(bx - 8, by - 26, bw + 16, 50, 12); ctx.fill();
    text(boss.name, W / 2, by - 12, 14, '#fff');
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = '#ff3b5c'; ctx.fillRect(bx, by, bw * boss.hp / boss.maxHp, 12);
  }
  if (bannerTimer > 0 && state === 'play') {
    ctx.globalAlpha = clamp(bannerTimer, 0, 1);
    text(st.name, W / 2, H / 2 - 40, 44, '#fff');
    if (st.type === 'boss') text('Spritz ihn voll!', W / 2, H / 2 + 10, 22, '#ffe04a');
    else text('Lauf bis zur Zielflagge!', W / 2, H / 2 + 10, 22, '#ffe04a');
    ctx.globalAlpha = 1;
  }
}

function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b1660'); g.addColorStop(1, '#120c24');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const s of titleSplats) { ctx.globalAlpha = s.a; ctx.fillStyle = s.color; circle(s.x, s.y, s.r); }
  ctx.globalAlpha = 1;
  const bounce = Math.sin(t * 3) * 6;
  text('KLECKS-KRIEGER', W / 2, 80 + bounce, 64, '#ff7a00');
  text('Die Grauschleimer wollen alle Farben der Welt aufsaugen!', W / 2, 140, 18, '#fff', 'center', false);
  text('Nur Krakel und Klecksi können sie mit ihren Farbspritzen aufhalten.', W / 2, 164, 18, '#fff', 'center', false);
  drawKrakel({ ...makePlayer(0), face: 1, onGround: true, vx: 1, anim: t }, W / 2 - 90, 290, 2.2);
  drawKrakel({ ...makePlayer(1), face: -1, onGround: true, vx: 1, anim: t + 0.3 }, W / 2 + 90, 290, 2.2);
  const blink = Math.floor(t * 2) % 2 ? '#ffe04a' : '#fff';
  text('[1] Allein spielen      [2] Zu zweit spielen', W / 2, 335, 26, blink);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(110, 370, W - 220, 128, 14); ctx.fill();
  text('Krakel:  A / D laufen  ·  Leertaste springen  ·  S abtauchen  ·  Maus oder Q/E zielen + klicken = spritzen', W / 2, 395, 15, '#ffb870', 'center', false);
  text('Klecksi:  ← / → laufen  ·  ↑ springen  ·  ↓ abtauchen  ·  Enter spritzen  ·  Shift/Strg rechts zielen', W / 2, 420, 15, '#dda6ff', 'center', false);
  text('Abtauchen füllt deine Tinte schnell wieder auf!  ·  Esc = Pause', W / 2, 448, 15, '#fff', 'center', false);
  text('Ist dein Freund ein Geist? Berühr ihn, dann lebt er wieder!', W / 2, 474, 15, '#fff', 'center', false);
  text('Highscore: ' + highscore, W / 2, 520, 18, '#ffe04a');
}

// ---------- Weltkarte zeichnen ----------
function star(x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
}
function drawBossIcon(kind, x, y) {
  if (kind === 'pudding') {
    ctx.fillStyle = '#f7cf6a';
    ctx.beginPath(); ctx.moveTo(x - 16, y + 14); ctx.lineTo(x - 11, y - 8); ctx.lineTo(x + 11, y - 8); ctx.lineTo(x + 16, y + 14); ctx.fill();
    ctx.fillStyle = '#8b4a1c';
    ctx.beginPath(); ctx.moveTo(x - 11, y - 8); ctx.lineTo(x + 11, y - 8); ctx.lineTo(x + 12, y - 1); ctx.lineTo(x - 12, y - 1); ctx.fill();
    ctx.fillStyle = '#e0123f'; circle(x, y - 12, 5);
  } else if (kind === 'toaster') {
    ctx.fillStyle = '#d99a4e';
    ctx.beginPath(); ctx.roundRect(x - 12, y - 17, 9, 9, 3); ctx.roundRect(x + 3, y - 17, 9, 9, 3); ctx.fill();
    ctx.fillStyle = '#c9d1dc'; ctx.beginPath(); ctx.roundRect(x - 17, y - 10, 34, 24, 6); ctx.fill();
    ctx.fillStyle = '#4a4f5c'; ctx.fillRect(x - 13, y - 9, 10, 3); ctx.fillRect(x + 3, y - 9, 10, 3);
  } else if (kind === 'king') {
    ctx.fillStyle = '#7d7896'; ctx.beginPath(); ctx.roundRect(x - 18, y - 6, 36, 22, 9); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath();
    ctx.moveTo(x - 12, y - 4); ctx.lineTo(x - 12, y - 18); ctx.lineTo(x - 6, y - 10); ctx.lineTo(x, y - 20);
    ctx.lineTo(x + 6, y - 10); ctx.lineTo(x + 12, y - 18); ctx.lineTo(x + 12, y - 4); ctx.fill();
  } else {
    text('!', x, y, 26, '#fff');
    return;
  }
  // kleine böse Augen
  ctx.fillStyle = '#111'; circle(x - 5, y + 4, 2.2); circle(x + 5, y + 4, 2.2);
}

function drawMap() {
  // Meer
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4cb4f0'); g.addColorStop(1, '#1d5fa8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x = ((i * 137 + t * 15) % (W + 60)) - 30, y = 30 + (i * 71) % 500;
    ctx.beginPath(); ctx.arc(x, y, 10, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  // Insel
  ctx.fillStyle = '#f3d98b'; ellipse(480, 320, 455, 200);
  ctx.fillStyle = '#6cc47f'; ellipse(480, 315, 430, 180);
  // farbige Gebiete um jedes Level
  STAGES.forEach(st => {
    ctx.globalAlpha = 0.85; ctx.fillStyle = st.hill; ellipse(st.map[0], st.map[1] + 8, 75, 50);
  });
  ctx.globalAlpha = 1;
  // Bäume
  for (const [x, y] of [[200, 260], [540, 320], [870, 430], [95, 300], [780, 185], [215, 345], [500, 150]]) {
    ctx.fillStyle = '#7a4a26'; ctx.fillRect(x - 3, y, 6, 14);
    ctx.fillStyle = '#3f9a52'; circle(x, y - 4, 13); circle(x - 8, y + 3, 9); circle(x + 8, y + 3, 9);
  }
  // Weg zwischen den Leveln
  ctx.lineWidth = 8; ctx.setLineDash([2, 16]);
  for (let i = 1; i < STAGES.length; i++) {
    const [ax, ay] = STAGES[i - 1].map, [bx, by] = STAGES[i].map;
    ctx.strokeStyle = i < progress.unlocked ? '#fff3c4' : 'rgba(60,60,70,0.45)';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 50, bx, by); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Level-Punkte
  STAGES.forEach((st, i) => {
    const [x, y] = st.map;
    const open = i < progress.unlocked, sel = i === mapSel;
    const isNew = mapUnlockTimer > 0 && i === progress.unlocked - 1;
    let r = st.type === 'boss' ? 34 : 28;
    if (sel || isNew) r += Math.sin(t * 6) * 2.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(x, y + r - 2, r, 8);
    ctx.fillStyle = open ? st.sky[0] : '#8a8799'; circle(x, y, r);
    ctx.strokeStyle = sel ? '#ffe04a' : '#fff'; ctx.lineWidth = sel ? 7 : 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    if (!open) {
      // Schloss
      ctx.strokeStyle = '#444'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y - 4, 7, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#444'; ctx.beginPath(); ctx.roundRect(x - 10, y - 4, 20, 15, 3); ctx.fill();
    } else if (st.type === 'boss') {
      drawBossIcon(st.boss, x, y + 2);
    } else {
      text(String(STAGES.slice(0, i + 1).filter(s => s.type === 'level').length), x, y + 1, 26, '#fff');
    }
    if (progress.cleared[i]) star(x + r * 0.75, y - r * 0.75, 13, '#ffe04a');
    if (isNew) text('NEU!', x, y - r - 45, 20, '#ffe04a');
  });
  // Krakel (und Klecksi) laufen auf der Karte
  const moving = Math.abs(STAGES[mapSel].map[0] - mapPos.x) > 3;
  const hop = moving ? -Math.abs(Math.sin(t * 14)) * 8 : 0;
  players.forEach((p, k) => {
    const off = players.length > 1 ? (k ? 14 : -14) : 0;
    drawKrakel({ ...p, face: mapFace, dive: false, onGround: true, vx: moving ? 1 : 0, anim: t + k * 0.3 },
      mapPos.x + off, mapPos.y - 12 + hop, 1.1);
  });
  // Überschrift und Infos
  text('WELTKARTE', W / 2, 38, 40, '#ffe04a');
  text('Punkte: ' + score, 20, 38, 18, '#fff', 'left');
  text('Highscore: ' + highscore, W - 20, 38, 18, '#fff', 'right');
  ctx.fillStyle = 'rgba(20,12,40,0.7)'; ctx.beginPath(); ctx.roundRect(W / 2 - 330, H - 74, 660, 62, 14); ctx.fill();
  text(STAGES[mapSel].name, W / 2, H - 52, 22, '#fff');
  text('← → aussuchen  ·  Enter / Leertaste / Klick = Los!  ·  Esc = zurück', W / 2, H - 26, 15, '#ffe04a', 'center', false);
}

function draw() {
  if (state === 'title') { drawTitle(); return; }
  if (state === 'map') { drawMap(); return; }
  const st = STAGES[stageIndex];
  ctx.save();
  if (shake > 0) ctx.translate(rand(-1, 1) * shake * 14, rand(-1, 1) * shake * 14);
  drawBackground(st);
  if (st.lava) drawLava();
  drawSolids(st);
  if (st.type === 'level') drawGoal();
  drawPickups();
  drawEnemies();
  if (boss) drawBoss({ ...boss, x: boss.x - camX });
  drawPlayers();
  drawShots();
  ctx.restore();
  drawHUD(st);
  drawCrosshair();

  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
    text('PAUSE', W / 2, H / 2 - 20, 56, '#fff');
    text('Esc = weiter   ·   Q = zur Weltkarte', W / 2, H / 2 + 30, 18, '#ffe04a');
  }
  if (state === 'clear') {
    text(st.type === 'boss' ? 'BOSS BESIEGT!' : 'GESCHAFFT!', W / 2, H / 2 - 30, 64, '#ffe04a');
    text('+500 Bonus', W / 2, H / 2 + 25, 24, '#fff');
  }
  if (state === 'gameover') {
    ctx.fillStyle = 'rgba(20,12,40,0.7)'; ctx.fillRect(0, 0, W, H);
    text('OH NEIN!', W / 2, H / 2 - 50, 64, '#ff3b5c');
    text('Die Grauschleimer haben gewonnen... diesmal!', W / 2, H / 2 + 5, 22, '#fff');
    text('Leertaste / Enter = nochmal versuchen   ·   Esc = zur Weltkarte', W / 2, H / 2 + 50, 18, '#ffe04a');
  }
  if (state === 'win') {
    ctx.fillStyle = 'rgba(20,12,40,0.75)'; ctx.fillRect(0, 0, W, H);
    text('DU HAST GEWONNEN!', W / 2, H / 2 - 80, 56, '#ffe04a');
    text('Die Welt ist wieder bunt! 🎨', W / 2, H / 2 - 20, 26, '#fff');
    text('Punkte: ' + score + '    Highscore: ' + highscore, W / 2, H / 2 + 30, 24, '#ff7a00');
    text('Enter = zur Weltkarte', W / 2, H / 2 + 80, 18, '#fff');
  }
}

// Fadenkreuz: zeigt, wohin Krakel mit der Maus zielt
function drawCrosshair() {
  const p = players[0];
  const show = state === 'play' && !paused && p && !p.down && p.aimMode === 'mouse';
  cv.style.cursor = show ? 'none' : 'crosshair';   // echten Mauszeiger verstecken
  if (!show) return;
  const x = mouse.x, y = mouse.y, r = 13 + Math.sin(t * 6) * 1.5;   // pulsiert ein bisschen
  ctx.save();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.35)';   // dunkler Rand, damit man es überall sieht
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = p.color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  // vier kleine Striche
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x + c * (r - 6), y + s * (r - 6)); ctx.lineTo(x + c * (r + 7), y + s * (r + 7)); ctx.stroke();
  }
  ctx.fillStyle = p.light; circle(x, y, 2.5);   // Punkt in der Mitte
  ctx.restore();
}

// ---------- Spiel-Schleife ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  pollPadMenu();
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
