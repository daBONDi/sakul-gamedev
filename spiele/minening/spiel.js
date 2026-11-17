// ⛏️ MINENING – ein Bergbau-Spiel
// Grabe nach unten, sammle Erze, verkaufe sie im Laden und kaufe bessere Ausrüstung!

const canvas = document.getElementById('spiel');
const ctx = canvas.getContext('2d');

// ---------- Einstellungen ----------
const T = 40;          // Größe eines Blocks in Pixeln
const W = 32;          // Welt-Breite in Blöcken
const H = 140;         // Welt-Tiefe in Blöcken
const BODEN = 5;       // In dieser Reihe beginnt das Gras
const LADEN_X = [2, 3, 4]; // Hier steht der Laden

// Block-Arten
const LUFT = 0, GRAS = 1, ERDE = 2, STEIN = 3, TIEFSTEIN = 4,
      KOHLE = 5, EISEN = 6, GOLD = 7, DIAMANT = 8, SMARAGD = 9,
      GRUNDGESTEIN = 10, LEITER = 11, LAVA = 12;

const BLOECKE = {
  [GRAS]:      { name: 'Gras',      haerte: 1,   farbe: '#7a5230', wert: 0 },
  [ERDE]:      { name: 'Erde',      haerte: 1,   farbe: '#7a5230', wert: 0 },
  [STEIN]:     { name: 'Stein',     haerte: 2.5, farbe: '#7d7d7d', wert: 0 },
  [TIEFSTEIN]: { name: 'Tiefstein', haerte: 5,   farbe: '#4a4a55', wert: 0 },
  [KOHLE]:     { name: 'Kohle',     haerte: 3,   farbe: '#222222', wert: 5 },
  [EISEN]:     { name: 'Eisen',     haerte: 4,   farbe: '#e0a878', wert: 15 },
  [GOLD]:      { name: 'Gold',      haerte: 5,   farbe: '#ffd700', wert: 40 },
  [DIAMANT]:   { name: 'Diamant',   haerte: 8,   farbe: '#5ff3ff', wert: 120 },
  [SMARAGD]:   { name: 'Smaragd',   haerte: 10,  farbe: '#2ee86b', wert: 250 },
};
const ERZE = [KOHLE, EISEN, GOLD, DIAMANT, SMARAGD];

// Ausrüstung: Stufen mit Preis und Stärke
const AUSRUESTUNG = [
  { name: 'Spitzhacke', feld: 'hacke',    werte: [1, 1.8, 3, 5, 8],     preise: [0, 50, 200, 600, 1500], einheit: 'x Kraft' },
  { name: 'Rucksack',   feld: 'rucksack', werte: [6, 12, 20, 35, 60],   preise: [0, 40, 150, 400, 1000], einheit: ' Plätze' },
  { name: 'Lampe',      feld: 'lampe',    werte: [3, 4.5, 6, 8, 11],    preise: [0, 30, 120, 350, 900],  einheit: ' Blöcke Licht' },
];

// ---------- Spielzustand ----------
let welt;
let spieler;
let geld, verdient, rekordTiefe;
let stufen;     // { hacke, rucksack, lampe }
let inventar;   // { 5: Anzahl Kohle, 6: ... }
let graben = null;  // { x, y, fortschritt }
let texte = [];     // fliegende Texte (+Gold usw.)
let partikel = [];
let imLaden = false;
let laeuft = false;
let kamera = { x: 0, y: 0 };

// ---------- Welt bauen ----------
function zufall(min, max) { return min + Math.random() * (max - min); }

function neueWelt() {
  welt = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let b;
      if (y < BODEN) b = LUFT;
      else if (y === BODEN) b = GRAS;
      else if (y < BODEN + 7) b = Math.random() < 0.08 ? STEIN : ERDE;
      else if (y < 50) b = Math.random() < 0.05 ? ERDE : STEIN;
      else b = Math.random() < 0.08 ? STEIN : TIEFSTEIN;
      if (x === 0 || x === W - 1 || y === H - 1) b = GRUNDGESTEIN;
      welt[y * W + x] = b;
    }
  }
  // Erze verteilen – je tiefer, desto wertvoller
  const regeln = [
    { erz: KOHLE,   ab: 3,  chance: 0.025 },
    { erz: EISEN,   ab: 12, chance: 0.018 },
    { erz: GOLD,    ab: 30, chance: 0.012 },
    { erz: DIAMANT, ab: 55, chance: 0.007 },
    { erz: SMARAGD, ab: 85, chance: 0.005 },
  ];
  for (let y = BODEN + 1; y < H - 1; y++) {
    const tiefe = y - BODEN;
    for (let x = 1; x < W - 1; x++) {
      for (const r of regeln) {
        if (tiefe >= r.ab && Math.random() < r.chance) erzAder(x, y, r.erz);
      }
    }
  }
  // Ein paar Höhlen und Lava-Seen in der Tiefe
  for (let i = 0; i < 18; i++) {
    const cx = Math.floor(zufall(3, W - 3)), cy = Math.floor(zufall(25, H - 6));
    const r = zufall(1.5, 3.2);
    const lava = cy > 60 && Math.random() < 0.45;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 1 || x >= W - 1 || y < BODEN + 2 || y >= H - 1) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
          welt[y * W + x] = (lava && y > cy) ? LAVA : LUFT;
        }
      }
    }
  }
}

function erzAder(x, y, erz) {
  let n = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    if (x > 0 && x < W - 1 && y > BODEN && y < H - 1) welt[y * W + x] = erz;
    x += Math.floor(Math.random() * 3) - 1;
    y += Math.floor(Math.random() * 3) - 1;
  }
}

function block(x, y) {
  if (x < 0 || x >= W || y >= H) return GRUNDGESTEIN;
  if (y < 0) return LUFT;
  return welt[y * W + x];
}
function setzeBlock(x, y, b) { welt[y * W + x] = b; }
function begehbar(b) { return b === LUFT || b === LEITER || b === LAVA; }

// ---------- Speichern / Laden ----------
const SPEICHER = 'minening-spielstand';

let gespeichertAnzeige = 0;

function speichern() {
  gespeichertAnzeige = 1.5;
  try {
    localStorage.setItem(SPEICHER, JSON.stringify({
      welt: Array.from(welt), x: spieler.x, y: spieler.y, geld, verdient, stufen, inventar,
    }));
    localStorage.setItem('minening-rekord', String(rekordTiefe));
  } catch (e) { /* egal */ }
}

function ladeSpielstand() {
  try {
    rekordTiefe = Number(localStorage.getItem('minening-rekord')) || 0;
    const d = JSON.parse(localStorage.getItem(SPEICHER));
    if (!d || d.welt.length !== W * H) return false;
    welt = Uint8Array.from(d.welt);
    spieler = neuerSpieler(d.x, d.y);
    geld = d.geld; verdient = d.verdient; stufen = d.stufen; inventar = d.inventar;
    return true;
  } catch (e) { return false; }
}

function neuerSpieler(x, y) {
  return { x, y, zx: x * T, zy: y * T, ziel: null, blick: 1, schritt: 0 };
}

function neuesSpiel() {
  neueWelt();
  spieler = neuerSpieler(8, BODEN - 1);
  geld = 0; verdient = 0;
  stufen = { hacke: 0, rucksack: 0, lampe: 0 };
  inventar = {};
  if (rekordTiefe === undefined) rekordTiefe = 0;
}

// ---------- Steuerung ----------
const gedrueckt = [];  // Liste der gedrückten Richtungen, die letzte zählt
const TASTEN = {
  ArrowLeft: 'links', a: 'links', A: 'links',
  ArrowRight: 'rechts', d: 'rechts', D: 'rechts',
  ArrowUp: 'hoch', w: 'hoch', W: 'hoch', ' ': 'hoch',
  ArrowDown: 'runter', s: 'runter', S: 'runter',
};

function drueck(r) { if (!gedrueckt.includes(r)) gedrueckt.push(r); }
function loslass(r) { const i = gedrueckt.indexOf(r); if (i >= 0) gedrueckt.splice(i, 1); }

addEventListener('keydown', e => {
  if (TASTEN[e.key]) { drueck(TASTEN[e.key]); e.preventDefault(); }
  if (!laeuft) return;
  if (e.key === 'h' || e.key === 'H') nachHause();
  if (imLaden && ['1', '2', '3'].includes(e.key)) kaufen(Number(e.key) - 1);
});
addEventListener('keyup', e => { if (TASTEN[e.key]) loslass(TASTEN[e.key]); });
addEventListener('blur', () => { gedrueckt.length = 0; });

// Touch-Knöpfe
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  document.getElementById('touch').style.display = 'flex';
}
document.querySelectorAll('#touch button').forEach(knopf => {
  const k = knopf.dataset.k;
  knopf.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (k === 'haus') nachHause(); else drueck(k);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => knopf.addEventListener(ev, () => loslass(k)));
});

// Im Laden auf die Angebote tippen/klicken
canvas.addEventListener('pointerdown', e => {
  if (!imLaden) return;
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * canvas.width / r.width;
  const my = (e.clientY - r.top) * canvas.height / r.height;
  ladenKnoepfe.forEach((k, i) => {
    if (mx > k.x && mx < k.x + k.w && my > k.y && my < k.y + k.h) kaufen(i);
  });
});

// ---------- Sound (kleine Piepser mit Web Audio) ----------
let audio;
function ton(freq, dauer = 0.08, typ = 'square', lautst = 0.05) {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = typ; o.frequency.value = freq;
    g.gain.setValueAtTime(lautst, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dauer);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dauer);
  } catch (e) { /* kein Ton */ }
}

// ---------- Spiel-Logik ----------
function rucksackVoll() {
  let n = 0;
  for (const k in inventar) n += inventar[k];
  return n;
}
function rucksackPlatz() { return AUSRUESTUNG[1].werte[stufen.rucksack]; }

function text(t, x, y, farbe = '#fff') {
  texte.push({ t, x, y, farbe, leben: 1.3 });
}

function nachHause() {
  if (!laeuft) return;
  spieler = neuerSpieler(5, BODEN - 1);
  graben = null;
  ton(300, 0.1, 'sine', 0.1); setTimeout(() => ton(600, 0.15, 'sine', 0.1), 100);
}

function verkaufen() {
  let summe = 0;
  for (const k in inventar) summe += inventar[k] * BLOECKE[k].wert;
  if (summe > 0) {
    geld += summe; verdient += summe;
    inventar = {};
    text('+' + summe + ' 💰', spieler.zx + T / 2, spieler.zy - 10, '#ffd166');
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => ton(f, 0.12, 'triangle', 0.08), i * 80));
    speichern();
  }
}

function kaufen(i) {
  const a = AUSRUESTUNG[i];
  const stufe = stufen[a.feld];
  if (stufe >= a.werte.length - 1) { text('Schon das Beste!', spieler.zx + T / 2, spieler.zy - 10); return; }
  const preis = a.preise[stufe + 1];
  if (geld < preis) { text('Zu wenig Geld!', spieler.zx + T / 2, spieler.zy - 10, '#ff6b6b'); ton(120, 0.2); return; }
  geld -= preis;
  stufen[a.feld]++;
  text(a.name + ' verbessert!', spieler.zx + T / 2, spieler.zy - 10, '#7bd389');
  [400, 600, 900].forEach((f, j) => setTimeout(() => ton(f, 0.1, 'triangle', 0.08), j * 70));
  speichern();
}

function abbauen(x, y) {
  const b = block(x, y);
  const info = BLOECKE[b];
  setzeBlock(x, y, LUFT);
  for (let i = 0; i < 10; i++) {
    partikel.push({ x: x * T + T / 2, y: y * T + T / 2, vx: zufall(-120, 120), vy: zufall(-200, 0),
      farbe: Math.random() < 0.5 ? info.farbe : BLOECKE[ERDE].farbe, leben: zufall(0.4, 0.8) });
  }
  if (ERZE.includes(b)) {
    if (rucksackVoll() < rucksackPlatz()) {
      inventar[b] = (inventar[b] || 0) + 1;
      text('+1 ' + info.name, x * T + T / 2, y * T, info.farbe);
      ton(880, 0.1, 'triangle', 0.08);
    } else {
      text('Rucksack voll!', x * T + T / 2, y * T, '#ff6b6b');
      ton(150, 0.2);
    }
  } else {
    ton(140 + Math.random() * 60, 0.05, 'square', 0.04);
  }
}

function update(dt) {
  const s = spieler;

  // Bewegung zu einem Ziel-Block (weich gleiten)
  if (s.ziel) {
    const tx = s.ziel.x * T, ty = s.ziel.y * T;
    const tempo = s.ziel.fallen ? 520 : 260;
    const dx = tx - s.zx, dy = ty - s.zy;
    const dist = Math.hypot(dx, dy);
    if (dist <= tempo * dt) {
      s.zx = tx; s.zy = ty; s.x = s.ziel.x; s.y = s.ziel.y; s.ziel = null;
    } else {
      s.zx += dx / dist * tempo * dt; s.zy += dy / dist * tempo * dt;
      s.schritt += dt * 10;
    }
  }

  // Im Laden? (wird geprüft, sobald wir auf einem Block ankommen)
  if (!s.ziel) {
    const jetztImLaden = s.y === BODEN - 1 && LADEN_X.includes(s.x);
    if (jetztImLaden && !imLaden) verkaufen();
    imLaden = jetztImLaden;
  }

  if (!s.ziel) {
    // Lava? Dann zurück nach Hause und Rucksack verlieren
    if (block(s.x, s.y) === LAVA) {
      inventar = {};
      text('Autsch, Lava! Rucksack verloren!', s.zx + T / 2, s.zy, '#ff6b2b');
      ton(100, 0.4, 'sawtooth', 0.08);
      nachHause();
      return;
    }

    // Fallen, wenn unter uns nichts ist (außer wir sind auf einer Leiter)
    if (block(s.x, s.y) !== LEITER && begehbar(block(s.x, s.y + 1))) {
      s.ziel = { x: s.x, y: s.y + 1, fallen: true };
      graben = null;
    } else {
      const richtung = gedrueckt[gedrueckt.length - 1];
      let dx = 0, dy = 0;
      if (richtung === 'links') dx = -1;
      if (richtung === 'rechts') dx = 1;
      if (richtung === 'hoch') dy = -1;
      if (richtung === 'runter') dy = 1;
      if (dx) s.blick = dx;

      if (dx || dy) {
        const zx = s.x + dx, zy = s.y + dy;
        const ziel = block(zx, zy);
        if (begehbar(ziel)) {
          graben = null;
          if (dy === -1) {
            // Hochklettern: Leiter bauen, wo wir stehen
            if (zy >= 0) {
              if (block(s.x, s.y) === LUFT) { setzeBlock(s.x, s.y, LEITER); ton(500, 0.04, 'square', 0.03); }
              s.ziel = { x: zx, y: zy };
            }
          } else {
            s.ziel = { x: zx, y: zy };
          }
        } else if (BLOECKE[ziel]) {
          // Graben!
          if (!graben || graben.x !== zx || graben.y !== zy) graben = { x: zx, y: zy, fortschritt: 0 };
          const kraft = AUSRUESTUNG[0].werte[stufen.hacke];
          graben.fortschritt += dt * kraft / (BLOECKE[ziel].haerte * 0.35);
          if (Math.random() < dt * 8) ton(200 + Math.random() * 100, 0.03, 'square', 0.02);
          if (graben.fortschritt >= 1) { abbauen(zx, zy); graben = null; }
        } else {
          graben = null;
          if (ziel === GRUNDGESTEIN && Math.random() < dt * 2) text('Zu hart!', zx * T + T / 2, zy * T, '#aaa');
        }
      } else {
        graben = null;
      }
    }
  }

  // Rekord-Tiefe
  const tiefe = Math.max(0, s.y - BODEN + 1);
  if (tiefe > rekordTiefe) rekordTiefe = tiefe;

  // Texte und Partikel bewegen
  texte.forEach(t => { t.y -= 40 * dt; t.leben -= dt; });
  texte = texte.filter(t => t.leben > 0);
  partikel.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.leben -= dt; });
  partikel = partikel.filter(p => p.leben > 0);

  // Kamera folgt dem Spieler
  const zielX = s.zx + T / 2 - canvas.width / 2;
  const zielY = s.zy + T / 2 - canvas.height / 2;
  kamera.x += (zielX - kamera.x) * Math.min(1, dt * 8);
  kamera.y += (zielY - kamera.y) * Math.min(1, dt * 8);
  kamera.x = Math.max(0, Math.min(W * T - canvas.width, kamera.x));
  kamera.y = Math.max(-T * 2, Math.min(H * T - canvas.height, kamera.y));
}

// ---------- Zeichnen ----------
function hash(x, y, n) {
  let h = (x * 374761393 + y * 668265263 + n * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function zeichneBlock(b, x, y, px, py) {
  if (b === LUFT) {
    if (y > BODEN) { ctx.fillStyle = '#2a1a0e'; ctx.fillRect(px, py, T, T); }
    return;
  }
  if (b === LEITER) {
    if (y > BODEN - 1) { ctx.fillStyle = '#2a1a0e'; ctx.fillRect(px, py, T, T); }
    ctx.fillStyle = '#b5833f';
    ctx.fillRect(px + 8, py, 5, T); ctx.fillRect(px + T - 13, py, 5, T);
    for (let i = 0; i < 3; i++) ctx.fillRect(px + 8, py + 6 + i * 13, T - 16, 4);
    return;
  }
  if (b === LAVA) {
    const w = Math.sin(performance.now() / 300 + x) * 3;
    ctx.fillStyle = '#ff5a1f'; ctx.fillRect(px, py, T, T);
    ctx.fillStyle = '#ffb02e'; ctx.fillRect(px + 6 + w, py + 8, 10, 6); ctx.fillRect(px + 22 - w, py + 24, 12, 6);
    return;
  }
  if (b === GRUNDGESTEIN) {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(px, py, T, T);
    ctx.fillStyle = '#333';
    for (let i = 0; i < 4; i++) ctx.fillRect(px + hash(x, y, i) * 30, py + hash(x, y, i + 9) * 30, 10, 10);
    return;
  }

  // Grundfarbe (Erze liegen in Stein/Erde)
  let grund = BLOECKE[b].farbe;
  if (ERZE.includes(b)) grund = y - BODEN > 45 ? BLOECKE[TIEFSTEIN].farbe : BLOECKE[STEIN].farbe;
  ctx.fillStyle = grund;
  ctx.fillRect(px, py, T, T);

  // Struktur
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 3; i++) ctx.fillRect(px + hash(x, y, i) * 32, py + hash(x, y, i + 5) * 32, 8, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 2; i++) ctx.fillRect(px + hash(x, y, i + 20) * 32, py + hash(x, y, i + 30) * 32, 6, 5);

  if (b === GRAS) {
    ctx.fillStyle = '#4caf50'; ctx.fillRect(px, py, T, 10);
    ctx.fillStyle = '#66d36e';
    for (let i = 0; i < 5; i++) ctx.fillRect(px + i * 8 + 2, py + 8, 4, 5);
  }

  if (ERZE.includes(b)) {
    const f = BLOECKE[b].farbe;
    for (let i = 0; i < 5; i++) {
      const ex = px + 5 + hash(x, y, i + 40) * 24, ey = py + 5 + hash(x, y, i + 50) * 24;
      ctx.fillStyle = f; ctx.fillRect(ex, ey, 9, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(ex + 1, ey + 1, 3, 2);
    }
  }
}

function zeichneLaden() {
  const px = LADEN_X[0] * T, py = (BODEN - 3) * T;
  ctx.fillStyle = '#a0522d'; ctx.fillRect(px, py + 20, T * 3, T * 3 - 20);
  ctx.fillStyle = '#d2691e';
  ctx.beginPath(); ctx.moveTo(px - 10, py + 22); ctx.lineTo(px + T * 1.5, py - 20); ctx.lineTo(px + T * 3 + 10, py + 22); ctx.fill();
  ctx.fillStyle = '#ffd166'; ctx.fillRect(px + 15, py + 30, T * 3 - 30, 22);
  ctx.fillStyle = '#5a3210'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('LADEN 💰', px + T * 1.5, py + 47);
  ctx.fillStyle = '#5a3210'; ctx.fillRect(px + T + 5, py + T * 2 - 5, T - 10, T + 5);
}

function zeichneSpieler() {
  const s = spieler;
  const px = s.zx, py = s.zy;
  const wackel = s.ziel && !s.ziel.fallen ? Math.sin(s.schritt) * 2 : 0;
  ctx.save();
  ctx.translate(px + T / 2, py);
  ctx.scale(s.blick, 1);
  // Beine
  ctx.fillStyle = '#2b4a8a';
  ctx.fillRect(-9, 28 + wackel, 7, 12 - wackel); ctx.fillRect(2, 28 - wackel, 7, 12 + wackel);
  // Körper
  ctx.fillStyle = '#e07a2f'; ctx.fillRect(-11, 14, 22, 16);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(-11, 20, 22, 3);
  // Kopf
  ctx.fillStyle = '#f5c99b'; ctx.fillRect(-8, 3, 16, 13);
  ctx.fillStyle = '#000'; ctx.fillRect(3, 7, 3, 3);
  // Helm mit Lampe
  ctx.fillStyle = '#f2c32e'; ctx.fillRect(-10, -1, 20, 7);
  ctx.fillStyle = '#fff6b0'; ctx.fillRect(7, 0, 5, 5);
  // Spitzhacke (schwingt beim Graben)
  const winkel = graben ? Math.sin(performance.now() / 60) * 0.8 : 0.3;
  ctx.translate(10, 22);
  ctx.rotate(winkel);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(0, -2, 16, 4);
  const hackFarben = ['#9a9a9a', '#e0a878', '#ffd700', '#5ff3ff', '#2ee86b'];
  ctx.fillStyle = hackFarben[stufen.hacke];
  ctx.beginPath(); ctx.moveTo(14, -10); ctx.quadraticCurveTo(22, 0, 14, 10); ctx.lineTo(17, 0); ctx.fill();
  ctx.restore();
}

let ladenKnoepfe = [];

function zeichneHUD() {
  const tiefe = Math.max(0, spieler.y - BODEN + 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(8, 8, 250, 112);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('💰 ' + geld + ' Münzen', 18, 32);
  ctx.fillText('⬇️ Tiefe: ' + tiefe + ' m  (Rekord ' + rekordTiefe + ')', 18, 56);
  const voll = rucksackVoll(), platz = rucksackPlatz();
  ctx.fillStyle = voll >= platz ? '#ff6b6b' : '#fff';
  ctx.fillText('🎒 Rucksack: ' + voll + ' / ' + platz, 18, 80);
  // Erze im Rucksack als kleine Quadrate
  let ix = 18;
  for (const e of ERZE) {
    if (!inventar[e]) continue;
    ctx.fillStyle = BLOECKE[e].farbe; ctx.fillRect(ix, 92, 14, 14);
    ctx.fillStyle = '#fff'; ctx.font = '14px system-ui'; ctx.fillText(inventar[e], ix + 17, 105);
    ix += 44;
  }

  if (voll >= platz && !imLaden) {
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Rucksack voll! Drück H, um zum Laden zu kommen 🏠', canvas.width / 2, canvas.height - 95);
  }

  // Laden-Fenster
  ladenKnoepfe = [];
  if (imLaden) {
    const bw = Math.min(560, canvas.width - 20), bx = (canvas.width - bw) / 2, by = canvas.height - 250;
    ctx.fillStyle = 'rgba(40,22,8,0.92)'; ctx.fillRect(bx, by, bw, 230);
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, 230);
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('🏪 Laden – drück 1, 2 oder 3 (oder tippe)', canvas.width / 2, by + 32);
    AUSRUESTUNG.forEach((a, i) => {
      const stufe = stufen[a.feld];
      const kx = bx + 15, ky = by + 48 + i * 58, kw = bw - 30, kh = 50;
      ladenKnoepfe.push({ x: kx, y: ky, w: kw, h: kh });
      const max = stufe >= a.werte.length - 1;
      const preis = max ? 0 : a.preise[stufe + 1];
      ctx.fillStyle = max ? '#3a5a3a' : geld >= preis ? '#6b4a1a' : '#4a3a2a';
      ctx.fillRect(kx, ky, kw, kh);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = 'bold 18px system-ui';
      ctx.fillText((i + 1) + ') ' + a.name + '  Stufe ' + (stufe + 1) + '/' + a.werte.length, kx + 10, ky + 22);
      ctx.font = '15px system-ui'; ctx.fillStyle = '#ddd';
      ctx.fillText(max ? 'Maximal ausgebaut! ⭐' : 'Jetzt ' + a.werte[stufe] + a.einheit + ' → ' + a.werte[stufe + 1] + a.einheit,
        kx + 10, ky + 42);
      if (!max) {
        ctx.textAlign = 'right'; ctx.font = 'bold 18px system-ui';
        ctx.fillStyle = geld >= preis ? '#ffd166' : '#ff6b6b';
        ctx.fillText(preis + ' 💰', kx + kw - 10, ky + 32);
      }
    });
  }
}

function zeichne() {
  const s = spieler;
  // Himmel
  const himmel = ctx.createLinearGradient(0, 0, 0, canvas.height);
  himmel.addColorStop(0, '#5cb8ff'); himmel.addColorStop(1, '#bfe6ff');
  ctx.fillStyle = himmel; ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-Math.round(kamera.x), -Math.round(kamera.y));

  // Sonne & Wolken
  ctx.fillStyle = '#ffe066';
  ctx.beginPath(); ctx.arc(W * T - 150, -20, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const t = performance.now() / 1000;
  for (let i = 0; i < 4; i++) {
    const wx = ((i * 330 + t * 15) % (W * T + 200)) - 100, wy = -40 + i * 30;
    ctx.beginPath(); ctx.arc(wx, wy, 22, 0, 7); ctx.arc(wx + 25, wy - 10, 26, 0, 7); ctx.arc(wx + 50, wy, 20, 0, 7); ctx.fill();
  }

  zeichneLaden();

  // Nur sichtbare Blöcke zeichnen
  const x0 = Math.max(0, Math.floor(kamera.x / T)), x1 = Math.min(W - 1, Math.ceil((kamera.x + canvas.width) / T));
  const y0 = Math.max(0, Math.floor(kamera.y / T)), y1 = Math.min(H - 1, Math.ceil((kamera.y + canvas.height) / T));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) zeichneBlock(block(x, y), x, y, x * T, y * T);
  }

  // Risse auf dem Block, an dem gegraben wird
  if (graben) {
    const gx = graben.x * T, gy = graben.y * T;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
    const risse = Math.floor(graben.fortschritt * 6);
    for (let i = 0; i < risse; i++) {
      ctx.beginPath();
      ctx.moveTo(gx + T / 2, gy + T / 2);
      ctx.lineTo(gx + hash(i, 1, 7) * T, gy + hash(i, 2, 7) * T);
      ctx.stroke();
    }
  }

  zeichneSpieler();

  partikel.forEach(p => { ctx.fillStyle = p.farbe; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); });

  ctx.restore();

  // Dunkelheit unter der Erde – die Lampe macht Licht
  const tiefe = s.y - BODEN;
  const dunkel = Math.max(0, Math.min(0.97, (tiefe - 2) / 14));
  if (dunkel > 0) {
    dctx.clearRect(0, 0, dunkelCanvas.width, dunkelCanvas.height);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = 'rgba(0,0,0,' + dunkel + ')';
    dctx.fillRect(0, 0, dunkelCanvas.width, dunkelCanvas.height);
    dctx.globalCompositeOperation = 'destination-out';
    const lx = s.zx + T / 2 - kamera.x, ly = s.zy + T / 2 - kamera.y;
    const radius = AUSRUESTUNG[2].werte[stufen.lampe] * T;
    const licht = dctx.createRadialGradient(lx, ly, radius * 0.2, lx, ly, radius);
    licht.addColorStop(0, 'rgba(0,0,0,1)'); licht.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = licht;
    dctx.beginPath(); dctx.arc(lx, ly, radius, 0, Math.PI * 2); dctx.fill();
    ctx.drawImage(dunkelCanvas, 0, 0);
  }

  // Fliegende Texte (über der Dunkelheit)
  ctx.textAlign = 'center'; ctx.font = 'bold 18px system-ui';
  texte.forEach(tx => {
    ctx.globalAlpha = Math.min(1, tx.leben);
    ctx.fillStyle = '#000'; ctx.fillText(tx.t, tx.x - kamera.x + 2, tx.y - kamera.y + 2);
    ctx.fillStyle = tx.farbe; ctx.fillText(tx.t, tx.x - kamera.x, tx.y - kamera.y);
  });
  ctx.globalAlpha = 1;

  zeichneHUD();

  // Kleine Anzeige, wenn gespeichert wurde
  if (gespeichertAnzeige > 0) {
    ctx.globalAlpha = Math.min(1, gespeichertAnzeige);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(canvas.width - 165, 10, 155, 32);
    ctx.fillStyle = '#7bd389'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'right';
    ctx.fillText('💾 Gespeichert', canvas.width - 20, 32);
    ctx.globalAlpha = 1;
  }
}

// ---------- Bildschirmgröße ----------
const dunkelCanvas = document.createElement('canvas');
const dctx = dunkelCanvas.getContext('2d');

function groesse() {
  canvas.width = Math.min(W * T, innerWidth);
  canvas.height = innerHeight;
  dunkelCanvas.width = canvas.width; dunkelCanvas.height = canvas.height;
}
addEventListener('resize', groesse);
groesse();

// ---------- Start ----------
let letzteZeit = performance.now();
let speicherUhr = 0;

function schleife(jetzt) {
  const dt = Math.min(0.05, (jetzt - letzteZeit) / 1000);
  letzteZeit = jetzt;
  if (laeuft) {
    update(dt);
    speicherUhr += dt;
    gespeichertAnzeige -= dt;
    if (speicherUhr > 5) { speicherUhr = 0; speichern(); }
  }
  zeichne();
  requestAnimationFrame(schleife);
}

const hatSpielstand = ladeSpielstand();
if (!hatSpielstand) neuesSpiel();
else {
  document.getElementById('startKnopf').textContent = 'Weiterspielen';
  document.getElementById('neuKnopf').classList.remove('versteckt');
}
kamera.x = spieler.zx - canvas.width / 2; kamera.y = spieler.zy - canvas.height / 2;

document.getElementById('startKnopf').onclick = () => {
  document.getElementById('start').classList.add('versteckt');
  laeuft = true;
  ton(440, 0.1, 'triangle', 0.08);
};
document.getElementById('neuKnopf').onclick = () => {
  if (!confirm('Wirklich ein neues Spiel starten? Dein Fortschritt ist dann weg!')) return;
  neuesSpiel();
  speichern();
  document.getElementById('start').classList.add('versteckt');
  laeuft = true;
};
addEventListener('beforeunload', () => { if (laeuft) speichern(); });
// Auch speichern, wenn man den Tab wechselt oder das Handy weglegt
document.addEventListener('visibilitychange', () => { if (laeuft && document.hidden) speichern(); });

requestAnimationFrame(schleife);
