// ===== 300 Tage im Wald =====
// Überlebe 300 Tage! Sammle Holz, Steine und Beeren, trinke am See,
// mach Lagerfeuer gegen Kälte und Wölfe.

const canvas = document.getElementById('spiel');
const ctx = canvas.getContext('2d');
let B = 0, H = 0;
function groesse() { B = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', groesse); groesse();

// ---------- Einstellungen ----------
const ZIEL_TAGE = 300;
const TAG_LAENGE = 40;      // Sekunden pro Tag (Tag + Nacht)
const NACHT_ANTEIL = 0.35;  // so viel vom Tag ist Nacht
const WELT = 3000;          // Größe der Welt in Pixeln
const SPEICHER = 'wald300-spielstand';

// Zufall mit festem Startwert -> der Wald sieht immer gleich aus
let seed = 12345;
function zufall() {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
const abstand = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- Welt bauen ----------
const seen = [
  { x: 1500, y: 1500, r: 160 },
  { x: 600, y: 900, r: 120 },
  { x: 2400, y: 2300, r: 140 },
];
function imSee(x, y, extra = 0) { return seen.some(s => Math.hypot(x - s.x, y - s.y) < s.r + extra); }

function freierPlatz() {
  let x, y;
  do { x = 60 + zufall() * (WELT - 120); y = 60 + zufall() * (WELT - 120); }
  while (imSee(x, y, 40) || Math.hypot(x - 1500, y - 1300) < 100);
  return { x, y };
}

const baeume = [], steine = [], buesche = [];
for (let i = 0; i < 260; i++) baeume.push({ ...freierPlatz(), r: 22 + zufall() * 14, hp: 3, weg: 0 });
for (let i = 0; i < 70; i++) steine.push({ ...freierPlatz(), r: 14 + zufall() * 8, hp: 4, weg: 0 });
for (let i = 0; i < 90; i++) buesche.push({ ...freierPlatz(), r: 16, beeren: 3, nachwachsen: 0 });

// Gras-Tupfer zur Deko
const gras = [];
for (let i = 0; i < 900; i++) gras.push(freierPlatz());

// ---------- Spielzustand ----------
let spieler, inv, feuer, huette, woelfe, hasen, zeit, tag, nachrichten, zustand, speer, angriffPause, schadenBlitz;

function neuesSpiel() {
  spieler = { x: 1500, y: 1300, leben: 100, hunger: 100, durst: 100, waerme: 100, blick: 0 };
  inv = { holz: 0, stein: 0, beeren: 0, fleisch: 0, gebraten: 0 };
  feuer = []; huette = null; woelfe = []; hasen = [];
  zeit = 0; tag = 1; speer = false;
  angriffPause = 0; schadenBlitz = 0;
  nachrichten = [];
  for (const b of baeume) { b.hp = 3; b.weg = 0; }
  for (const s of steine) { s.hp = 4; s.weg = 0; }
  for (const b of buesche) { b.beeren = 3; b.nachwachsen = 0; }
}

function speichern() {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify({
      spieler, inv, feuer, huette, tag, speer,
      baeume: baeume.map(b => [b.hp, b.weg]),
      steine: steine.map(s => [s.hp, s.weg]),
      buesche: buesche.map(b => [b.beeren, b.nachwachsen]),
    }));
  } catch (e) {}
}

function laden() {
  try {
    const d = JSON.parse(localStorage.getItem(SPEICHER));
    if (!d) return false;
    neuesSpiel();
    Object.assign(spieler, d.spieler); Object.assign(inv, d.inv);
    feuer = d.feuer || []; huette = d.huette || null; tag = d.tag; speer = d.speer;
    d.baeume.forEach((w, i) => { baeume[i].hp = w[0]; baeume[i].weg = w[1]; });
    d.steine.forEach((w, i) => { steine[i].hp = w[0]; steine[i].weg = w[1]; });
    d.buesche.forEach((w, i) => { buesche[i].beeren = w[0]; buesche[i].nachwachsen = w[1]; });
    zeit = 0;
    return true;
  } catch (e) { return false; }
}

function hatSpielstand() { try { return !!localStorage.getItem(SPEICHER); } catch (e) { return false; } }
function rekord() { try { return +localStorage.getItem('wald300-rekord') || 0; } catch (e) { return 0; } }
function setzeRekord(t) { try { if (t > rekord()) localStorage.setItem('wald300-rekord', t); } catch (e) {} }

function sag(text, farbe = '#fff') {
  nachrichten.push({ text, farbe, zeit: 4 });
  if (nachrichten.length > 5) nachrichten.shift();
}

// ---------- Jahreszeiten ----------
function jahreszeit() {
  const j = Math.floor(((tag - 1) % 120) / 30);   // alle 30 Tage wechselt sie
  return ['Frühling', 'Sommer', 'Herbst', 'Winter'][j];
}
const istWinter = () => jahreszeit() === 'Winter';
function istNacht() { return zeit / TAG_LAENGE > 1 - NACHT_ANTEIL; }

// ---------- Tastatur ----------
const tasten = {};
addEventListener('keydown', e => {
  tasten[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (zustand === 'start') {
    if (e.code === 'Enter') { neuesSpiel(); zustand = 'spiel'; sag('Überlebe 300 Tage im Wald! Viel Glück!', '#ffd166'); }
    if (e.code === 'KeyL' && hatSpielstand() && laden()) { zustand = 'spiel'; sag('Spielstand geladen: Tag ' + tag, '#ffd166'); }
    return;
  }
  if (zustand === 'tot' || zustand === 'gewonnen') {
    if (e.code === 'Enter') zustand = 'start';
    return;
  }
  if (e.code === 'KeyP') zustand = zustand === 'pause' ? 'spiel' : 'pause';
  if (zustand !== 'spiel') return;
  if (e.code === 'Digit1') bauFeuer();
  if (e.code === 'Digit2') bauSpeer();
  if (e.code === 'Digit3') bauHuette();
  if (e.code === 'KeyF') essen();
});
addEventListener('keyup', e => { tasten[e.code] = false; });

// ---------- Aktionen ----------
function bauFeuer() {
  if (inv.holz >= 5 && inv.stein >= 2) {
    inv.holz -= 5; inv.stein -= 2;
    feuer.push({ x: spieler.x + Math.cos(spieler.blick) * 40, y: spieler.y + Math.sin(spieler.blick) * 40, brennstoff: 60 });
    sag('🔥 Lagerfeuer gebaut!', '#ffb347');
  } else sag('Feuer braucht 5 Holz + 2 Steine', '#ff8080');
}

function bauSpeer() {
  if (speer) return sag('Du hast schon einen Speer.');
  if (inv.holz >= 3 && inv.stein >= 3) {
    inv.holz -= 3; inv.stein -= 3; speer = true;
    sag('🗡️ Speer gebaut! Du haust jetzt doppelt so stark zu.', '#ffd166');
  } else sag('Speer braucht 3 Holz + 3 Steine', '#ff8080');
}

// Hütte: drinnen ist es warm, Wölfe können nicht beißen, nachts schläfst du
const HUETTE_GROESSE = 46;   // halbe Breite der Hütte
function inHuette(o = spieler) {
  return !!huette && Math.abs(o.x - huette.x) < HUETTE_GROESSE && Math.abs(o.y - huette.y) < HUETTE_GROESSE;
}

function bauHuette() {
  if (huette) return sag('Du hast schon eine Hütte! 🛖');
  if (inv.holz < 15 || inv.stein < 5) return sag('Hütte braucht 15 Holz + 5 Steine', '#ff8080');
  const x = spieler.x + Math.cos(spieler.blick) * 70, y = spieler.y + Math.sin(spieler.blick) * 70;
  const imWeg = imSee(x, y, 70) || x < 80 || y < 80 || x > WELT - 80 || y > WELT - 80 ||
    baeume.some(b => !b.weg && Math.hypot(x - b.x, y - b.y) < 70) ||
    steine.some(s => !s.weg && Math.hypot(x - s.x, y - s.y) < 65);
  if (imWeg) return sag('Hier ist kein Platz! Such eine freie Stelle.', '#ff8080');
  inv.holz -= 15; inv.stein -= 5;
  huette = { x, y };
  sag('🛖 Hütte gebaut! Geh nachts rein zum Schlafen.', '#ffd166');
}

function essen() {
  if (inv.gebraten > 0) { inv.gebraten--; spieler.hunger = Math.min(100, spieler.hunger + 45); sag('🍖 Lecker, gebratenes Fleisch!'); }
  else if (inv.beeren > 0) { inv.beeren--; spieler.hunger = Math.min(100, spieler.hunger + 12); sag('🫐 Mmh, Beeren.'); }
  else if (inv.fleisch > 0) { inv.fleisch--; spieler.hunger = Math.min(100, spieler.hunger + 20); spieler.leben -= 5; sag('🥩 Rohes Fleisch... Bauchweh! (am Feuer braten mit Leertaste)', '#ff8080'); }
  else sag('Du hast nichts zu essen!', '#ff8080');
}

function interagieren() {
  if (angriffPause > 0) return;
  const p = spieler;
  const schaden = speer ? 2 : 1;
  const reichweite = speer ? 70 : 55;

  // 1. Tiere angreifen
  for (const w of woelfe) {
    if (abstand(p, w) < reichweite + 10) {
      w.hp -= schaden; angriffPause = 0.35;
      const d = abstand(p, w) || 1; w.x += (w.x - p.x) / d * 30; w.y += (w.y - p.y) / d * 30;
      if (w.hp <= 0) { inv.fleisch += 2; sag('🐺 Wolf besiegt! +2 Fleisch', '#ffd166'); }
      return;
    }
  }
  for (const h of hasen) {
    if (abstand(p, h) < reichweite) {
      h.hp = 0; inv.fleisch++; angriffPause = 0.35; sag('🐇 +1 Fleisch');
      return;
    }
  }
  // 2. Feuer: Fleisch braten oder Holz nachlegen
  for (const f of feuer) {
    if (abstand(p, f) < 60) {
      angriffPause = 0.3;
      if (inv.fleisch > 0) { inv.fleisch--; inv.gebraten++; sag('🍖 Fleisch gebraten!'); }
      else if (inv.holz > 0) { inv.holz--; f.brennstoff = Math.min(150, f.brennstoff + 30); sag('🪵 Holz ins Feuer gelegt'); }
      else sag('Kein Holz zum Nachlegen!', '#ff8080');
      return;
    }
  }
  // 3. Busch, Baum, Stein
  for (const b of buesche) {
    if (abstand(p, b) < 45 && b.beeren > 0) {
      b.beeren--; inv.beeren++; angriffPause = 0.25;
      if (b.beeren === 0) b.nachwachsen = 2;
      return;
    }
  }
  for (const b of baeume) {
    if (!b.weg && abstand(p, b) < b.r + 30) {
      b.hp -= schaden; angriffPause = 0.35; b.wackeln = 0.2;
      if (b.hp <= 0) { b.weg = 4; inv.holz += 3; sag('🪵 +3 Holz'); }
      return;
    }
  }
  for (const s of steine) {
    if (!s.weg && abstand(p, s) < s.r + 30) {
      s.hp -= schaden; angriffPause = 0.4; s.wackeln = 0.2;
      if (s.hp <= 0) { s.weg = 6; inv.stein += 2; sag('🪨 +2 Steine'); }
      return;
    }
  }
  // 4. Trinken am See
  if (imSee(p.x, p.y, 40)) {
    spieler.durst = Math.min(100, spieler.durst + 25); angriffPause = 0.4;
    sag('💧 Schluck! Wasser getrunken.', '#7ec8ff');
    return;
  }
}

// ---------- Neuer Tag ----------
function neuerTag() {
  tag++;
  setzeRekord(tag);
  if (tag > ZIEL_TAGE) { zustand = 'gewonnen'; try { localStorage.removeItem(SPEICHER); } catch (e) {} return; }
  for (const b of baeume) if (b.weg && --b.weg === 0) b.hp = 3;
  for (const s of steine) if (s.weg && --s.weg === 0) s.hp = 4;
  for (const b of buesche) {
    if (b.beeren === 0 && --b.nachwachsen <= 0 && !istWinter()) b.beeren = 3;
  }
  sag('☀️ Tag ' + tag + ' beginnt!', '#ffd166');
  if ((tag - 1) % 30 === 0) sag('Die Jahreszeit wechselt: ' + jahreszeit(), istWinter() ? '#bfe6ff' : '#9be37b');
  speichern();
}

// ---------- Tiere ----------
function spawnWeitWeg(min, max) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min);
    const x = spieler.x + Math.cos(a) * d, y = spieler.y + Math.sin(a) * d;
    if (x > 20 && y > 20 && x < WELT - 20 && y < WELT - 20 && !imSee(x, y, 10)) return { x, y };
  }
  return null;
}

function bewegeMitKollision(obj, dx, dy) {
  const nx = Math.max(15, Math.min(WELT - 15, obj.x + dx));
  const ny = Math.max(15, Math.min(WELT - 15, obj.y + dy));
  const blockiert = (x, y) =>
    baeume.some(b => !b.weg && Math.hypot(x - b.x, y - b.y) < b.r * 0.55 + 12) ||
    steine.some(s => !s.weg && Math.hypot(x - s.x, y - s.y) < s.r + 10);
  if (!blockiert(nx, obj.y)) obj.x = nx;
  if (!blockiert(obj.x, ny)) obj.y = ny;
}

function tiereUpdate(dt) {
  // Hasen: immer ca. 14 in der Nähe
  hasen = hasen.filter(h => h.hp > 0 && abstand(h, spieler) < 1400);
  while (hasen.length < (istWinter() ? 6 : 14)) {
    const pos = spawnWeitWeg(500, 1200); if (!pos) break;
    hasen.push({ ...pos, hp: 1, ziel: Math.random() * 6.28, t: 0, hopp: 0 });
  }
  for (const h of hasen) {
    h.t -= dt; h.hopp += dt * 10;
    let tempo = 40;
    if (abstand(h, spieler) < 150) { h.ziel = Math.atan2(h.y - spieler.y, h.x - spieler.x); tempo = 170; }
    else if (h.t <= 0) { h.ziel = Math.random() * 6.28; h.t = 1 + Math.random() * 2; }
    const dx = Math.cos(h.ziel) * tempo * dt, dy = Math.sin(h.ziel) * tempo * dt;
    if (!imSee(h.x + dx, h.y + dy)) bewegeMitKollision(h, dx, dy); else h.ziel += Math.PI;
  }

  // Wölfe: kommen in der Nacht. Je später im Spiel, desto mehr.
  const maxWoelfe = istNacht() ? Math.min(8, 1 + Math.floor(tag / 30) + (istWinter() ? 1 : 0)) : 0;
  if (woelfe.length < maxWoelfe && Math.random() < dt * 0.4) {
    const pos = spawnWeitWeg(600, 800);
    if (pos) { woelfe.push({ ...pos, hp: 3 + Math.floor(tag / 60), biss: 0 }); sag('🐺 Ein Wolf heult in der Dunkelheit...', '#ff8080'); }
  }
  for (const w of woelfe) {
    w.biss -= dt;
    let zx = spieler.x, zy = spieler.y, tempo = 135, flucht = false;
    // Angst vor Feuer
    for (const f of feuer) {
      if (abstand(w, f) < 170) { zx = w.x * 2 - f.x; zy = w.y * 2 - f.y; tempo = 160; flucht = true; }
    }
    if (huette && abstand(w, huette) < 130) { zx = w.x * 2 - huette.x; zy = w.y * 2 - huette.y; tempo = 160; flucht = true; }
    if (!istNacht()) { zx = w.x * 2 - spieler.x; zy = w.y * 2 - spieler.y; flucht = true; }
    const a = Math.atan2(zy - w.y, zx - w.x);
    w.blick = a;
    if (flucht || abstand(w, spieler) > 30) bewegeMitKollision(w, Math.cos(a) * tempo * dt, Math.sin(a) * tempo * dt);
    if (!flucht && !inHuette() && abstand(w, spieler) < 34 && w.biss <= 0) {
      spieler.leben -= 12; w.biss = 1; schadenBlitz = 0.3;
    }
  }
  woelfe = woelfe.filter(w => w.hp > 0 && (istNacht() || abstand(w, spieler) < 900));
}

// ---------- Update ----------
function update(dt) {
  const p = spieler;
  // Bewegung
  let dx = 0, dy = 0;
  if (tasten.KeyA || tasten.ArrowLeft) dx--;
  if (tasten.KeyD || tasten.ArrowRight) dx++;
  if (tasten.KeyW || tasten.ArrowUp) dy--;
  if (tasten.KeyS || tasten.ArrowDown) dy++;
  if (dx || dy) {
    const l = Math.hypot(dx, dy);
    p.blick = Math.atan2(dy, dx);
    const tempo = (tasten.ShiftLeft ? 230 : 160) * dt;
    const nx = p.x + dx / l * tempo, ny = p.y + dy / l * tempo;
    // Nicht in den See laufen
    if (!imSee(nx, p.y)) bewegeMitKollision(p, dx / l * tempo, 0);
    if (!imSee(p.x, ny)) bewegeMitKollision(p, 0, dy / l * tempo);
    if (tasten.ShiftLeft) p.durst -= dt * 0.6;
    p.laufen = (p.laufen || 0) + dt * 12;
  }

  angriffPause -= dt; schadenBlitz -= dt;
  if (tasten.Space) interagieren();

  // Zeit (beim Schlafen in der Hütte vergeht die Nacht 4x so schnell)
  const schlaeft = inHuette() && istNacht();
  zeit += schlaeft ? dt * 4 : dt;
  if (schlaeft && !p.schlief) sag('💤 Du schläfst in der Hütte... Zzz', '#bfe6ff');
  p.schlief = schlaeft;
  if (zeit >= TAG_LAENGE) { zeit -= TAG_LAENGE; neuerTag(); if (zustand !== 'spiel') return; }

  // Feuer brennen ab
  for (const f of feuer) f.brennstoff -= dt;
  feuer = feuer.filter(f => f.brennstoff > 0);
  const amFeuer = feuer.some(f => abstand(p, f) < 130);

  // Körperwerte
  p.hunger -= dt * 0.9;
  p.durst -= dt * (jahreszeit() === 'Sommer' ? 1.5 : 1.2);
  let kaelte = 0;
  if (istNacht()) kaelte = istWinter() ? 3.5 : 2;
  else kaelte = istWinter() ? 1.2 : -3;
  if (amFeuer) kaelte = -10;
  else if (inHuette()) kaelte = -6;
  p.waerme -= dt * kaelte;
  p.hunger = Math.max(0, p.hunger); p.durst = Math.max(0, p.durst);
  p.waerme = Math.max(0, Math.min(100, p.waerme));

  if (p.hunger <= 0 || p.durst <= 0 || p.waerme <= 0) { p.leben -= dt * 3; schadenBlitz = Math.max(schadenBlitz, 0.05); }
  else if (p.hunger > 40 && p.durst > 40 && p.waerme > 40) p.leben = Math.min(100, p.leben + dt * (schlaeft ? 4 : 0.8));

  tiereUpdate(dt);

  for (const b of baeume) if (b.wackeln > 0) b.wackeln -= dt;
  for (const s of steine) if (s.wackeln > 0) s.wackeln -= dt;
  for (const n of nachrichten) n.zeit -= dt;
  nachrichten = nachrichten.filter(n => n.zeit > 0);

  if (p.leben <= 0) {
    zustand = 'tot';
    try { localStorage.removeItem(SPEICHER); } catch (e) {}
  }
}

// ---------- Zeichnen ----------
const farbenBoden = { 'Frühling': '#4f8a3a', 'Sommer': '#5f8f2f', 'Herbst': '#7a7a35', 'Winter': '#dfe8ee' };
const farbenBaum = { 'Frühling': ['#2e6b2a', '#3f8a37'], 'Sommer': ['#245c22', '#2f7a2b'], 'Herbst': ['#b35a1f', '#d98a2b'], 'Winter': ['#2f5a3a', '#e9f2f7'] };

function kreis(x, y, r, farbe) { ctx.fillStyle = farbe; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

function zeichneWelt() {
  const j = jahreszeit();
  const kx = Math.round(spieler.x - B / 2), ky = Math.round(spieler.y - H / 2);
  const sichtbar = (o, rand = 80) => o.x > kx - rand && o.x < kx + B + rand && o.y > ky - rand && o.y < ky + H + rand;

  ctx.fillStyle = '#1a2e14'; ctx.fillRect(0, 0, B, H);
  ctx.save();
  ctx.translate(-kx, -ky);
  ctx.fillStyle = farbenBoden[j]; ctx.fillRect(0, 0, WELT, WELT);

  // Gras
  ctx.fillStyle = j === 'Winter' ? '#c7d3db' : 'rgba(0,0,0,0.12)';
  for (const g of gras) if (sichtbar(g)) ctx.fillRect(g.x, g.y, 3, 7);

  // Seen
  for (const s of seen) {
    kreis(s.x, s.y, s.r + 8, j === 'Winter' ? '#b8c8d0' : '#c9b27a');
    kreis(s.x, s.y, s.r, j === 'Winter' ? '#6fa8c9' : '#2f78b8');
    kreis(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.25, 'rgba(255,255,255,0.15)');
  }

  // Büsche
  for (const b of buesche) {
    if (!sichtbar(b)) continue;
    kreis(b.x, b.y, b.r, j === 'Winter' ? '#5d7a5d' : '#2d7d3a');
    kreis(b.x - 6, b.y - 5, b.r * 0.7, j === 'Winter' ? '#728f72' : '#3a9447');
    for (let i = 0; i < b.beeren; i++) kreis(b.x - 7 + i * 7, b.y + 2 - (i % 2) * 8, 3.5, '#d42a5a');
  }

  // Steine
  for (const s of steine) {
    if (!sichtbar(s) || s.weg) continue;
    const w = s.wackeln > 0 ? Math.sin(s.wackeln * 60) * 2 : 0;
    kreis(s.x + w, s.y + 3, s.r, '#555b60');
    kreis(s.x + w, s.y, s.r, '#8d949a');
    kreis(s.x + w - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.35, '#a9b0b5');
  }

  // Feuer (Boden)
  for (const f of feuer) {
    kreis(f.x, f.y, 18, '#5a4a3a');
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; kreis(f.x + Math.cos(a) * 16, f.y + Math.sin(a) * 16, 5, '#888'); }
  }

  // Hütte (Boden und Wände)
  if (huette) zeichneHuetteUnten();

  // Tiere
  for (const h of hasen) {
    if (!sichtbar(h)) continue;
    const hop = Math.abs(Math.sin(h.hopp)) * 3;
    kreis(h.x, h.y - hop, 9, j === 'Winter' ? '#ffffff' : '#a58a6a');
    kreis(h.x + Math.cos(h.ziel) * 8, h.y - hop + Math.sin(h.ziel) * 8, 6, j === 'Winter' ? '#f0f0f0' : '#b89b7a');
    kreis(h.x - Math.cos(h.ziel) * 9, h.y - hop - Math.sin(h.ziel) * 9, 3.5, '#fff');
  }
  for (const w of woelfe) {
    const a = w.blick || 0;
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(a);
    ctx.fillStyle = '#4a4f55'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, 6.28); ctx.fill();
    kreis(-24, 0, 6, '#5d636a');
    kreis(18, 0, 10, '#5d636a');
    kreis(22, -5, 2.5, '#ffdd33'); kreis(22, 5, 2.5, '#ffdd33');
    ctx.restore();
  }

  // Spieler
  zeichneSpieler();

  // Baumkronen (über allem, damit man "unter" Bäumen durchläuft)
  const [dunkel, hell] = farbenBaum[j];
  for (const b of baeume) {
    if (!sichtbar(b)) continue;
    if (b.weg) { kreis(b.x, b.y, b.r * 0.35, '#8a6a42'); kreis(b.x, b.y, b.r * 0.22, '#a8875a'); continue; }
    const w = b.wackeln > 0 ? Math.sin(b.wackeln * 60) * 3 : 0;
    kreis(b.x + 4, b.y + 6, b.r, 'rgba(0,0,0,0.25)');
    kreis(b.x, b.y, b.r * 0.35, '#6b4a2b');
    kreis(b.x + w, b.y - 10, b.r, dunkel);
    kreis(b.x + w - b.r * 0.3, b.y - 10 - b.r * 0.3, b.r * 0.6, hell);
  }

  // Hütten-Dach (durchsichtig, wenn du drin bist)
  if (huette) zeichneHuetteDach();

  // Flammen
  for (const f of feuer) {
    const t = performance.now() / 100;
    const g = Math.min(1, f.brennstoff / 40);
    kreis(f.x, f.y, (12 + Math.sin(t) * 2) * (0.5 + g * 0.5), '#ff7b00');
    kreis(f.x, f.y - 4, (8 + Math.cos(t * 1.3) * 2) * (0.5 + g * 0.5), '#ffd23f');
  }

  ctx.restore();
  zeichneDunkelheit(kx, ky);
}

function zeichneHuetteUnten() {
  const { x, y } = huette, g = HUETTE_GROESSE;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - g + 6, y - g + 8, g * 2, g * 2);   // Schatten
  ctx.fillStyle = '#a07a4e'; ctx.fillRect(x - g, y - g, g * 2, g * 2);                     // Holzboden
  ctx.strokeStyle = '#8a6640'; ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - g, y - g + i * g / 3); ctx.lineTo(x + g, y - g + i * g / 3); ctx.stroke(); }
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 7; ctx.strokeRect(x - g, y - g, g * 2, g * 2); // Wände
  ctx.fillStyle = '#a07a4e'; ctx.fillRect(x - 14, y + g - 5, 28, 10);                      // Tür
  // Bett
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x - g + 8, y - g + 8, 26, 40);
  ctx.fillStyle = '#c0392b'; ctx.fillRect(x - g + 10, y - g + 22, 22, 24);
  ctx.fillStyle = '#eee'; ctx.fillRect(x - g + 11, y - g + 10, 20, 10);
}

function zeichneHuetteDach() {
  const { x, y } = huette, g = HUETTE_GROESSE + 6;
  ctx.globalAlpha = inHuette() ? 0.25 : 1;
  ctx.fillStyle = istWinter() ? '#e9f2f7' : '#7a3b22';
  ctx.beginPath(); ctx.moveTo(x - g, y - g); ctx.lineTo(x + g, y - g); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = istWinter() ? '#d5e2ea' : '#8e4a2b';
  ctx.beginPath(); ctx.moveTo(x - g, y + g); ctx.lineTo(x + g, y + g); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = istWinter() ? '#c7d6e0' : '#6a3019';
  ctx.beginPath(); ctx.moveTo(x - g, y - g); ctx.lineTo(x - g, y + g); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + g, y - g); ctx.lineTo(x + g, y + g); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - g, y - g); ctx.lineTo(x + g, y + g); ctx.moveTo(x + g, y - g); ctx.lineTo(x - g, y + g); ctx.stroke();
  ctx.globalAlpha = 1;
}

function zeichneSpieler() {
  const p = spieler;
  const wipp = Math.sin(p.laufen || 0) * 2;
  kreis(p.x, p.y + 10, 12, 'rgba(0,0,0,0.25)');
  // Speer
  if (speer) {
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 4; ctx.beginPath();
    const hx = p.x + Math.cos(p.blick + 0.6) * 12, hy = p.y + Math.sin(p.blick + 0.6) * 12;
    const stoss = angriffPause > 0.15 ? 15 : 0;
    const sx = hx + Math.cos(p.blick) * (40 + stoss), sy = hy + Math.sin(p.blick) * (40 + stoss);
    ctx.moveTo(hx - Math.cos(p.blick) * 15, hy - Math.sin(p.blick) * 15); ctx.lineTo(sx, sy); ctx.stroke();
    kreis(sx, sy, 4, '#9aa');
  }
  kreis(p.x, p.y + wipp * 0.3, 15, '#c0392b');           // Körper (rote Jacke)
  kreis(p.x, p.y - 6 + wipp * 0.3, 10, '#f2c49b');       // Kopf
  kreis(p.x, p.y - 11 + wipp * 0.3, 8, '#5a3a1a');       // Haare
  const ax = Math.cos(p.blick) * 4, ay = Math.sin(p.blick) * 3;
  kreis(p.x - 3 + ax, p.y - 5 + ay, 1.8, '#222');
  kreis(p.x + 3 + ax, p.y - 5 + ay, 1.8, '#222');
}

// Nacht: Dunkelheit mit Lichtkreisen um Feuer und Spieler
const nachtCanvas = document.createElement('canvas');
const nctx = nachtCanvas.getContext('2d');
function dunkelheit() {
  const t = zeit / TAG_LAENGE;
  const start = 1 - NACHT_ANTEIL;
  if (t < 0.08) return 0.85 * (1 - t / 0.08);                  // Morgendämmerung
  if (t < start - 0.08) return 0;
  if (t < start) return 0.85 * ((t - (start - 0.08)) / 0.08);  // Abenddämmerung
  return 0.85;
}
function zeichneDunkelheit(kx, ky) {
  const d = dunkelheit();
  if (d <= 0) return;
  if (nachtCanvas.width !== B || nachtCanvas.height !== H) { nachtCanvas.width = B; nachtCanvas.height = H; }
  nctx.globalCompositeOperation = 'source-over';
  nctx.clearRect(0, 0, B, H);
  nctx.fillStyle = `rgba(5,8,25,${d})`;
  nctx.fillRect(0, 0, B, H);
  nctx.globalCompositeOperation = 'destination-out';
  const licht = (x, y, r) => {
    const g = nctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = g; nctx.beginPath(); nctx.arc(x, y, r, 0, 6.28); nctx.fill();
  };
  licht(spieler.x - kx, spieler.y - ky, 110);
  for (const f of feuer) licht(f.x - kx, f.y - ky, 150 + Math.sin(performance.now() / 120) * 8 + Math.min(80, f.brennstoff));
  ctx.drawImage(nachtCanvas, 0, 0);
}

function balken(x, y, wert, farbe, symbol, name) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, 180, 20);
  ctx.fillStyle = wert < 25 && Math.floor(performance.now() / 300) % 2 ? '#ff3030' : farbe;
  ctx.fillRect(x + 2, y + 2, 176 * Math.max(0, wert) / 100, 16);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(symbol + ' ' + name + ' ' + Math.ceil(Math.max(0, wert)), x + 6, y + 15);
}

function zeichneHUD() {
  const p = spieler;
  // Schaden: roter Rand
  if (schadenBlitz > 0) { ctx.fillStyle = `rgba(255,0,0,${Math.min(0.35, schadenBlitz)})`; ctx.fillRect(0, 0, B, H); }

  // Balken links oben
  balken(12, 12, p.leben, '#e74c3c', '❤️', 'Leben');
  balken(12, 36, p.hunger, '#e67e22', '🍗', 'Hunger');
  balken(12, 60, p.durst, '#3498db', '💧', 'Durst');
  balken(12, 84, p.waerme, '#f1c40f', '🔥', 'Wärme');

  // Tag rechts oben
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(B - 230, 10, 220, 80);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 26px system-ui';
  ctx.fillText('Tag ' + tag + ' / ' + ZIEL_TAGE, B - 22, 42);
  ctx.fillStyle = '#fff'; ctx.font = '15px system-ui';
  ctx.fillText((istNacht() ? '🌙 Nacht' : '☀️ Tag') + ' · ' + jahreszeit(), B - 22, 64);
  // Fortschritt
  ctx.fillStyle = '#333'; ctx.fillRect(B - 220, 74, 200, 8);
  ctx.fillStyle = '#9be37b'; ctx.fillRect(B - 220, 74, 200 * (tag - 1) / ZIEL_TAGE, 8);

  // Inventar unten
  const items = [['🪵', inv.holz], ['🪨', inv.stein], ['🫐', inv.beeren], ['🥩', inv.fleisch], ['🍖', inv.gebraten], ['🗡️', speer ? '✓' : '–']];
  const bx = B / 2 - items.length * 31;
  for (let i = 0; i < items.length; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx + i * 62, H - 70, 56, 56);
    ctx.textAlign = 'center'; ctx.font = '24px system-ui'; ctx.fillStyle = '#fff';
    ctx.fillText(items[i][0], bx + i * 62 + 28, H - 38);
    ctx.font = 'bold 14px system-ui'; ctx.fillText(items[i][1], bx + i * 62 + 28, H - 20);
  }

  // Hilfe unten links
  ctx.textAlign = 'left'; ctx.font = '13px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const hilfe = ['WASD/Pfeile: laufen (Shift: rennen)', 'Leertaste: hacken, sammeln, trinken, angreifen', 'F: essen · P: Pause',
    '1: Lagerfeuer (5🪵 2🪨)', '2: Speer (3🪵 3🪨)', '3: Hütte (15🪵 5🪨)'];
  hilfe.forEach((t, i) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(10, H - 141 + i * 21, ctx.measureText(t).width + 12, 19);
    ctx.fillStyle = '#fff'; ctx.fillText(t, 16, H - 126 + i * 21);
  });

  // Nachrichten
  ctx.textAlign = 'center'; ctx.font = 'bold 18px system-ui';
  nachrichten.forEach((n, i) => {
    ctx.globalAlpha = Math.min(1, n.zeit);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const w = ctx.measureText(n.text).width + 20;
    ctx.fillRect(B / 2 - w / 2, 110 + i * 30, w, 26);
    ctx.fillStyle = n.farbe; ctx.fillText(n.text, B / 2, 129 + i * 30);
  });
  ctx.globalAlpha = 1;

  // Warnungen
  const warn = [];
  if (p.durst < 25) warn.push('Du hast Durst! Geh zum See 💧');
  if (p.hunger < 25) warn.push('Du hast Hunger! Drück F 🍗');
  if (p.waerme < 25) warn.push('Dir ist kalt! Mach ein Feuer 🔥 oder geh in die Hütte 🛖');
  ctx.font = 'bold 16px system-ui'; ctx.fillStyle = '#ff8080';
  warn.forEach((t, i) => ctx.fillText(t, B / 2, H - 90 - i * 22));

  if (zustand === 'pause') bildschirm('⏸️ Pause', ['Drück P zum Weiterspielen']);
}

function bildschirm(titel, zeilen) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, B, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166'; ctx.font = 'bold 48px system-ui';
  ctx.fillText(titel, B / 2, H / 2 - 80);
  ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
  zeilen.forEach((z, i) => ctx.fillText(z, B / 2, H / 2 - 20 + i * 32));
}

// ---------- Hauptschleife ----------
zustand = 'start';
neuesSpiel();
let letzte = performance.now();
function schleife(jetzt) {
  const dt = Math.min(0.05, (jetzt - letzte) / 1000);
  letzte = jetzt;
  if (zustand === 'spiel') update(dt);

  zeichneWelt();
  if (zustand === 'spiel' || zustand === 'pause') zeichneHUD();
  if (zustand === 'start') {
    const z = ['Kannst du 300 Tage im Wald überleben?', '', 'Sammle Holz 🪵, Steine 🪨 und Beeren 🫐.',
      'Trink am See 💧, baue Lagerfeuer 🔥 gegen Kälte und Wölfe 🐺.', '', '▶ ENTER = Neues Spiel'];
    if (hatSpielstand()) z.push('▶ L = Weiterspielen (gespeichert)');
    if (rekord() > 1) z.push('🏆 Dein Rekord: Tag ' + rekord());
    bildschirm('🌲 300 Tage im Wald 🌲', z);
  }
  if (zustand === 'tot') bildschirm('💀 Du hast nicht überlebt', ['Du hast bis Tag ' + tag + ' durchgehalten.', '🏆 Rekord: Tag ' + rekord(), '', 'ENTER = Nochmal versuchen']);
  if (zustand === 'gewonnen') bildschirm('🏆 GESCHAFFT! 🏆', ['Du hast 300 Tage im Wald überlebt!', 'Du bist ein echter Survival-Profi!', '', 'ENTER = Zurück zum Start']);

  requestAnimationFrame(schleife);
}
requestAnimationFrame(schleife);
