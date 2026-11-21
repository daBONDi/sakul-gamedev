// ===== 300 Tage im Wald – 3D =====
// Überlebe 300 Tage! Sammle Holz, Steine und Beeren, trinke am See,
// mach Lagerfeuer gegen Kälte und Monster, bau dir eine Hütte.
// Die 3D-Grafik macht Three.js. Die Balken und Texte werden in 2D darübergemalt.
import * as THREE from 'three';

const canvas = document.getElementById('hud');
const ctx = canvas.getContext('2d');
let B = 0, H = 0;
function groesse() { B = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', groesse); groesse();

// ---------- Einstellungen ----------
const ZIEL_TAGE = 300;
const TAG_LAENGE = 90;      // Sekunden pro Tag (Tag + Nacht)
const NACHT_ANTEIL = 0.35;  // so viel vom Tag ist Nacht
const WELT = 3000;          // Größe der Welt in Pixeln
const SPEICHER = 'wald300-3d-spielstand';

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
let spieler, inv, feuer, huetten, woelfe, hasen, zeit, tag, nachrichten, zustand, speer, angriffPause, schadenBlitz;
let naechsteId = 1;   // jedes Tier, Feuer und jede Hütte bekommt eine Nummer (wichtig für Mehrspieler)
let bissPause = 0;

function neuesSpiel() {
  spieler = { x: 1500, y: 1300, leben: 100, hunger: 100, durst: 100, waerme: 100, blick: 0 };
  inv = { holz: 0, stein: 0, beeren: 0, fleisch: 0, gebraten: 0 };
  feuer = []; huetten = []; woelfe = []; hasen = [];
  naechsteId = 1; bissPause = 0;
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
      spieler, inv, feuer, huetten, tag, speer,
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
    feuer = d.feuer || []; huetten = d.huetten || (d.huette ? [{ ...d.huette, nr: 1 }] : []);
    for (const o of [...feuer, ...huetten]) o.id = naechsteId++;
    tag = d.tag; speer = d.speer;
    d.baeume.forEach((w, i) => { baeume[i].hp = w[0]; baeume[i].weg = w[1]; });
    d.steine.forEach((w, i) => { steine[i].hp = w[0]; steine[i].weg = w[1]; });
    d.buesche.forEach((w, i) => { buesche[i].beeren = w[0]; buesche[i].nachwachsen = w[1]; });
    zeit = 0;
    return true;
  } catch (e) { return false; }
}

function hatSpielstand() { try { return !!localStorage.getItem(SPEICHER); } catch (e) { return false; } }
function rekord() { try { return +localStorage.getItem('wald300-3d-rekord') || 0; } catch (e) { return 0; } }
function setzeRekord(t) { try { if (t > rekord()) localStorage.setItem('wald300-3d-rekord', t); } catch (e) {} }

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
    if (e.code === 'KeyM') netzHosten();
    if (e.code === 'KeyB') {
      tasten.KeyB = false;
      const code = prompt('Gib den Raum-Code von deinem Freund ein (4 Zeichen):');
      if (code) netzBeitreten(code);
    }
    return;
  }
  if (zustand === 'tot' || zustand === 'gewonnen') {
    if (e.code === 'Enter') zustand = 'start';
    return;
  }
  if (e.code === 'KeyP') {
    if (netzRolle !== 'solo') sag('Mit Freunden gibt es keine Pause 😉');
    else zustand = zustand === 'pause' ? 'spiel' : 'pause';
  }
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
    neuesFeuer(spieler.x + Math.cos(spieler.blick) * 40, spieler.y + Math.sin(spieler.blick) * 40);
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
  return huetten.some(h => Math.abs(o.x - h.x) < HUETTE_GROESSE && Math.abs(o.y - h.y) < HUETTE_GROESSE);
}

function bauHuette() {
  if (huetten.some(h => h.nr === meineNr)) return sag('Du hast schon eine Hütte! 🛖');
  if (inv.holz < 15 || inv.stein < 5) return sag('Hütte braucht 15 Holz + 5 Steine', '#ff8080');
  const x = spieler.x + Math.cos(spieler.blick) * 70, y = spieler.y + Math.sin(spieler.blick) * 70;
  const imWeg = imSee(x, y, 70) || x < 80 || y < 80 || x > WELT - 80 || y > WELT - 80 ||
    baeume.some(b => !b.weg && Math.hypot(x - b.x, y - b.y) < 70) ||
    steine.some(s => !s.weg && Math.hypot(x - s.x, y - s.y) < 65) ||
    huetten.some(h => Math.hypot(x - h.x, y - h.y) < 110);
  if (imWeg) return sag('Hier ist kein Platz! Such eine freie Stelle.', '#ff8080');
  inv.holz -= 15; inv.stein -= 5;
  neueHuette(x, y);
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
      anHost({ t: 'treffer', art: 'wolf', id: w.id, schaden });
      const d = abstand(p, w) || 1; w.x += (w.x - p.x) / d * 30; w.y += (w.y - p.y) / d * 30;
      if (w.hp <= 0) { inv.fleisch += 2; sag('👹 Monster besiegt! +2 Fleisch', '#ffd166'); }
      return;
    }
  }
  for (const h of hasen) {
    if (h.hp > 0 && abstand(p, h) < reichweite) {
      anHost({ t: 'treffer', art: 'hase', id: h.id });
      h.hp = 0; inv.fleisch++; angriffPause = 0.35; sag('🐇 +1 Fleisch');
      return;
    }
  }
  // 2. Feuer: Fleisch braten oder Holz nachlegen
  for (const f of feuer) {
    if (abstand(p, f) < 60) {
      angriffPause = 0.3;
      if (inv.fleisch > 0) { inv.fleisch--; inv.gebraten++; sag('🍖 Fleisch gebraten!'); }
      else if (inv.holz > 0) { inv.holz--; f.brennstoff = Math.min(150, f.brennstoff + 30); anHost({ t: 'feuerHolz', id: f.id }); sag('🪵 Holz ins Feuer gelegt'); }
      else sag('Kein Holz zum Nachlegen!', '#ff8080');
      return;
    }
  }
  // 3. Busch, Baum, Stein
  for (const b of buesche) {
    if (abstand(p, b) < 45 && b.beeren > 0) {
      b.beeren--; inv.beeren++; angriffPause = 0.25;
      if (b.beeren === 0) b.nachwachsen = 2;
      weltGeaendert('busch', buesche.indexOf(b));
      return;
    }
  }
  for (const b of baeume) {
    if (!b.weg && abstand(p, b) < b.r + 30) {
      b.hp -= schaden; angriffPause = 0.35; b.wackeln = 0.2;
      if (b.hp <= 0) { b.weg = 4; inv.holz += 3; sag('🪵 +3 Holz'); }
      weltGeaendert('baum', baeume.indexOf(b));
      return;
    }
  }
  for (const s of steine) {
    if (!s.weg && abstand(p, s) < s.r + 30) {
      s.hp -= schaden; angriffPause = 0.4; s.wackeln = 0.2;
      if (s.hp <= 0) { s.weg = 6; inv.stein += 2; sag('🪨 +2 Steine'); }
      weltGeaendert('stein', steine.indexOf(s));
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
  if (tag > ZIEL_TAGE) { zustand = 'gewonnen'; anAlle({ t: 'gewonnen' }); try { localStorage.removeItem(SPEICHER); } catch (e) {} return; }
  for (const b of baeume) if (b.weg && --b.weg === 0) b.hp = 3;
  for (const s of steine) if (s.weg && --s.weg === 0) s.hp = 4;
  for (const b of buesche) {
    if (b.beeren === 0 && --b.nachwachsen <= 0 && !istWinter()) b.beeren = 3;
  }
  sag('☀️ Tag ' + tag + ' beginnt!', '#ffd166');
  if ((tag - 1) % 30 === 0) sag('Die Jahreszeit wechselt: ' + jahreszeit(), istWinter() ? '#bfe6ff' : '#9be37b');
  speichern();
  anAlle(weltPaket());   // Mehrspieler: nachgewachsene Bäume usw. allen schicken
}

// ---------- Tiere ----------
function spawnWeitWeg(min, max, um = spieler) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min);
    const x = um.x + Math.cos(a) * d, y = um.y + Math.sin(a) * d;
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
  hasen = hasen.filter(h => h.hp > 0 && naechsterSpieler(h).d < 1400);
  while (hasen.length < Math.min(30, (istWinter() ? 6 : 14) * alleSpieler().length)) {
    const pos = spawnWeitWeg(500, 1200, zufallsSpieler()); if (!pos) break;
    hasen.push({ ...pos, id: naechsteId++, hp: 1, ziel: Math.random() * 6.28, t: 0, hopp: 0 });
  }
  for (const h of hasen) {
    h.t -= dt; h.hopp += dt * 10;
    let tempo = 40;
    const n = naechsterSpieler(h);
    if (n.d < 150) { h.ziel = Math.atan2(h.y - n.s.y, h.x - n.s.x); tempo = 170; }
    else if (h.t <= 0) { h.ziel = Math.random() * 6.28; h.t = 1 + Math.random() * 2; }
    const dx = Math.cos(h.ziel) * tempo * dt, dy = Math.sin(h.ziel) * tempo * dt;
    if (!imSee(h.x + dx, h.y + dy)) bewegeMitKollision(h, dx, dy); else h.ziel += Math.PI;
  }

  // Wölfe: kommen in der Nacht. Je später im Spiel, desto mehr.
  const maxWoelfe = istNacht() ? Math.min(8, 1 + Math.floor(tag / 30) + (istWinter() ? 1 : 0)) : 0;
  if (woelfe.length < maxWoelfe && Math.random() < dt * 0.4) {
    const pos = spawnWeitWeg(600, 800, zufallsSpieler());
    if (pos) { woelfe.push({ ...pos, id: naechsteId++, hp: 3 + Math.floor(tag / 60), biss: 0 }); sag('👹 Ein Monster brüllt in der Dunkelheit...', '#ff8080'); }
  }
  for (const w of woelfe) {
    w.biss -= dt;
    const n = naechsterSpieler(w);   // der Wolf jagt den Spieler, der am nächsten ist
    let zx = n.s.x, zy = n.s.y, tempo = 135, flucht = false;
    // Angst vor Feuer
    for (const f of feuer) {
      if (abstand(w, f) < 170) { zx = w.x * 2 - f.x; zy = w.y * 2 - f.y; tempo = 160; flucht = true; }
    }
    for (const h of huetten) if (abstand(w, h) < 130) { zx = w.x * 2 - h.x; zy = w.y * 2 - h.y; tempo = 160; flucht = true; }
    if (!istNacht()) { zx = w.x * 2 - n.s.x; zy = w.y * 2 - n.s.y; flucht = true; }
    const a = Math.atan2(zy - w.y, zx - w.x);
    w.blick = a;
    if (flucht || n.d > 30) bewegeMitKollision(w, Math.cos(a) * tempo * dt, Math.sin(a) * tempo * dt);
  }
  woelfe = woelfe.filter(w => w.hp > 0 && (istNacht() || naechsterSpieler(w).d < 900));
}

// Beißt dich ein Wolf? Das prüft jeder Spieler selbst für sich.
function wolfHatAngst(w) { return feuer.some(f => abstand(w, f) < 170) || huetten.some(h => abstand(w, h) < 130); }
function wolfBisse(dt) {
  bissPause -= dt;
  if (bissPause > 0 || inHuette() || !istNacht()) return;
  for (const w of woelfe) {
    if (w.hp > 0 && abstand(w, spieler) < 34 && !wolfHatAngst(w)) {
      spieler.leben -= 12; schadenBlitz = 0.3; bissPause = 1;
      return;
    }
  }
}

// ---------- Update ----------
function update(dt) {
  const p = spieler;
  // Bewegung
  // In 3D läuft "W" immer dahin, wohin die Kamera schaut
  let vor = 0, seit = 0;
  if (tasten.KeyA || tasten.ArrowLeft) seit--;
  if (tasten.KeyD || tasten.ArrowRight) seit++;
  if (tasten.KeyW || tasten.ArrowUp) vor++;
  if (tasten.KeyS || tasten.ArrowDown) vor--;
  if (tasten.KeyQ) kamWinkel -= dt * 2;
  if (tasten.KeyE) kamWinkel += dt * 2;
  const dx = Math.cos(kamWinkel) * vor - Math.sin(kamWinkel) * seit;
  const dy = Math.sin(kamWinkel) * vor + Math.cos(kamWinkel) * seit;
  if (vor || seit) {
    const l = Math.hypot(dx, dy);
    p.blick = Math.atan2(dy, dx);
    const tempo = (tasten.ShiftLeft ? 230 : 160) * dt;
    const nx = p.x + dx / l * tempo, ny = p.y + dy / l * tempo;
    // Nicht in den See laufen
    if (!imSee(nx, p.y)) bewegeMitKollision(p, dx / l * tempo, 0);
    if (!imSee(p.x, ny)) bewegeMitKollision(p, 0, dy / l * tempo);
    if (tasten.ShiftLeft) p.durst -= dt * 0.3;
    p.laufen = (p.laufen || 0) + dt * 12;
  }

  angriffPause -= dt; schadenBlitz -= dt;
  if (tasten.Space) interagieren();

  // Zeit (beim Schlafen in der Hütte vergeht die Nacht 4x so schnell)
  const schlaeft = inHuette() && istNacht();
  // Mit Freunden geht die Nacht nur schneller vorbei, wenn ALLE in einer Hütte sind
  const alleSchlafen = schlaeft && Object.values(andere).every(a => a.inH);
  zeit += alleSchlafen ? dt * 4 : dt;
  if (schlaeft && !p.schlief) sag(netzRolle === 'solo' ? '💤 Du schläfst in der Hütte... Zzz'
    : '💤 Zzz... Die Nacht geht schneller, wenn alle in einer Hütte sind', '#bfe6ff');
  p.schlief = schlaeft;
  if (zeit >= TAG_LAENGE) {
    zeit -= TAG_LAENGE;
    if (netzRolle !== 'gast') { neuerTag(); if (zustand !== 'spiel') return; }   // beim Gast sagt der Host, wann ein neuer Tag ist
  }

  // Feuer brennen ab
  for (const f of feuer) f.brennstoff -= dt;
  feuer = feuer.filter(f => f.brennstoff > 0);
  const amFeuer = feuer.some(f => abstand(p, f) < 130);

  // Körperwerte
  // Kleinere Zahl = Hunger und Durst gehen langsamer weg
  p.hunger -= dt * 0.4;
  p.durst -= dt * (jahreszeit() === 'Sommer' ? 0.65 : 0.5);
  let kaelte = 0;
  if (istNacht()) kaelte = istWinter() ? 1.6 : 0.9;   // die Nacht ist länger, deshalb wird es langsamer kalt
  else kaelte = istWinter() ? 0.6 : -3;
  if (amFeuer) kaelte = -10;
  else if (inHuette()) kaelte = -6;
  p.waerme -= dt * kaelte;
  p.hunger = Math.max(0, p.hunger); p.durst = Math.max(0, p.durst);
  p.waerme = Math.max(0, Math.min(100, p.waerme));

  if (p.hunger <= 0 || p.durst <= 0 || p.waerme <= 0) { p.leben -= dt * 3; schadenBlitz = Math.max(schadenBlitz, 0.05); }
  else if (p.hunger > 40 && p.durst > 40 && p.waerme > 40) p.leben = Math.min(100, p.leben + dt * (schlaeft ? 4 : 0.8));

  if (netzRolle !== 'gast') tiereUpdate(dt);   // die Tiere steuert nur der Host
  wolfBisse(dt);

  for (const b of baeume) if (b.wackeln > 0) b.wackeln -= dt;
  for (const s of steine) if (s.wackeln > 0) s.wackeln -= dt;
  for (const n of nachrichten) n.zeit -= dt;
  nachrichten = nachrichten.filter(n => n.zeit > 0);

  if (p.leben <= 0 && netzRolle !== 'solo') wiederbeleben();
  else if (p.leben <= 0) {
    zustand = 'tot';
    try { localStorage.removeItem(SPEICHER); } catch (e) {}
  }
}

// Wie dunkel ist es gerade? (0 = Tag, 0.85 = Nacht)
function dunkelheit() {
  const t = zeit / TAG_LAENGE;
  const start = 1 - NACHT_ANTEIL;
  if (t < 0.08) return 0.85 * (1 - t / 0.08);                  // Morgendämmerung
  if (t < start - 0.08) return 0;
  if (t < start) return 0.85 * ((t - (start - 0.08)) / 0.08);  // Abenddämmerung
  return 0.85;
}

// ---------- 3D-Welt (Three.js) ----------
// In 3D ist "x" links/rechts, "y" oben/unten und "z" vorne/hinten.
// Die Spiel-Logik benutzt noch x und y wie in 2D -> in 3D wird daraus x und z.

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'welt3d';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#8fc8ff');
scene.fog = new THREE.Fog('#8fc8ff', 450, 1300);

const kamera = new THREE.PerspectiveCamera(55, 1, 2, 1500);
let kamWinkel = -Math.PI / 2;   // in welche Richtung die Kamera schaut
let kamAbstand = 230;           // wie weit die Kamera weg ist (Mausrad)

function groesse3d() {
  renderer.setSize(innerWidth, innerHeight);
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
}
addEventListener('resize', groesse3d); groesse3d();

// Kamera mit der Maus drehen und zoomen
renderer.domElement.addEventListener('pointerdown', e => renderer.domElement.setPointerCapture(e.pointerId));
renderer.domElement.addEventListener('pointermove', e => { if (e.buttons) kamWinkel += e.movementX * 0.006; });
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  kamAbstand = Math.max(110, Math.min(480, kamAbstand + e.deltaY * 0.3));
}, { passive: false });

// ---------- Licht ----------
const himmelLicht = new THREE.HemisphereLight('#dff1ff', '#4a5a30', 1.5);
const sonne = new THREE.DirectionalLight('#fff4dd', 2.2);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -450, right: 450, top: 450, bottom: -450, near: 10, far: 1200 });
sonne.shadow.bias = -0.0005;
scene.add(himmelLicht, sonne, sonne.target);

const spielerLicht = new THREE.PointLight('#ffe0b0', 0, 230, 0);   // kleines Licht um dich in der Nacht
scene.add(spielerLicht);
const feuerLichter = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ff9a3c', 0, 340, 0); scene.add(l); return l; });

// ---------- Materialien (Farben) ----------
const mat = (farbe, extra = {}) => new THREE.MeshLambertMaterial({ color: farbe, ...extra });
const durchsichtig = m => { const k = m.clone(); k.transparent = true; k.opacity = 0.22; k.depthWrite = false; return k; };

const bodenMat = mat('#4f8a3a'), grasMat = mat('#3b6e2b');
const seeMat = new THREE.MeshStandardMaterial({ color: '#2f78b8', roughness: 0.15, metalness: 0.1 });
const uferMat = mat('#c9b27a');
const holzMat = mat('#6b4a2b'), stumpfMat = mat('#a8875a');
const kroneDunkel = mat('#2e6b2a'), kroneHell = mat('#3f8a37');
const kroneDunkelDurch = durchsichtig(kroneDunkel), kroneHellDurch = durchsichtig(kroneHell);
const steinMat = new THREE.MeshStandardMaterial({ color: '#8d949a', flatShading: true, roughness: 1 });
const buschMat = mat('#2d7d3a'), buschMat2 = mat('#3a9447'), beerenMat = mat('#d42a5a', { emissive: '#3a0010' });
const hasenMat = mat('#a58a6a'), weissMat = mat('#ffffff');
const wolfMat = mat('#4b2a63'), wolfMat2 = mat('#6b3d8a'), wolfAugen = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
const hornMat = mat('#e8dcc0'), maulMat = new THREE.MeshBasicMaterial({ color: '#1a0008' });
const dachMat = mat('#7a3b22', { transparent: true });
const wandMat = mat('#7a5232'), dielenMat = mat('#a07a4e');
const flammeMat1 = new THREE.MeshBasicMaterial({ color: '#ff7b00' }), flammeMat2 = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
const grauMat = mat('#888888'), schwarzMat = mat('#222222');

// Farben je Jahreszeit
const JAHRESFARBEN = {
  'Frühling': { boden: '#4f8a3a', gras: '#3b6e2b', dunkel: '#2e6b2a', hell: '#3f8a37', busch: '#2d7d3a', busch2: '#3a9447', see: '#2f78b8', ufer: '#c9b27a', hase: '#a58a6a', dach: '#7a3b22', himmel: '#8fc8ff' },
  'Sommer':   { boden: '#5f8f2f', gras: '#4a7a22', dunkel: '#245c22', hell: '#2f7a2b', busch: '#2d7d3a', busch2: '#3a9447', see: '#2f78b8', ufer: '#d8c084', hase: '#a58a6a', dach: '#7a3b22', himmel: '#7cc0ff' },
  'Herbst':   { boden: '#7a7a35', gras: '#6a5a28', dunkel: '#b35a1f', hell: '#d98a2b', busch: '#6b6a2a', busch2: '#8a7a30', see: '#2c6a9e', ufer: '#b8a070', hase: '#a58a6a', dach: '#7a3b22', himmel: '#a8c4d8' },
  'Winter':   { boden: '#dfe8ee', gras: '#c7d3db', dunkel: '#2f5a3a', hell: '#e9f2f7', busch: '#5d7a5d', busch2: '#728f72', see: '#8fc3dd', ufer: '#b8c8d0', hase: '#ffffff', dach: '#e9f2f7', himmel: '#c9d6e2' },
};
let letzteJahreszeit = '';
function jahreszeitFarben() {
  const j = jahreszeit();
  if (j === letzteJahreszeit) return;
  letzteJahreszeit = j;
  const f = JAHRESFARBEN[j];
  bodenMat.color.set(f.boden); grasMat.color.set(f.gras);
  kroneDunkel.color.set(f.dunkel); kroneDunkelDurch.color.set(f.dunkel);
  kroneHell.color.set(f.hell); kroneHellDurch.color.set(f.hell);
  buschMat.color.set(f.busch); buschMat2.color.set(f.busch2);
  seeMat.color.set(f.see); uferMat.color.set(f.ufer);
  hasenMat.color.set(f.hase); dachMat.color.set(f.dach);
  tagHimmel.set(f.himmel);
  seeMat.roughness = j === 'Winter' ? 0.6 : 0.15;   // im Winter ist der See zugefroren
}
const tagHimmel = new THREE.Color('#8fc8ff'), nachtHimmel = new THREE.Color('#070b1c');

// ---------- Boden, Gras, Seen ----------
const boden = new THREE.Mesh(new THREE.PlaneGeometry(WELT + 2400, WELT + 2400), bodenMat);
boden.rotation.x = -Math.PI / 2; boden.position.set(WELT / 2, 0, WELT / 2);
boden.receiveShadow = true;
scene.add(boden);

const grasMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(2.5, 10, 3).translate(0, 5, 0), grasMat, gras.length);
const m4 = new THREE.Matrix4();
gras.forEach((g, i) => { m4.makeTranslation(g.x, 0, g.y); grasMesh.setMatrixAt(i, m4); });
scene.add(grasMesh);

for (const s of seen) {
  const ufer = new THREE.Mesh(new THREE.CircleGeometry(s.r + 10, 48), uferMat);
  ufer.rotation.x = -Math.PI / 2; ufer.position.set(s.x, 0.4, s.y); ufer.receiveShadow = true;
  const wasser = new THREE.Mesh(new THREE.CircleGeometry(s.r, 48), seeMat);
  wasser.rotation.x = -Math.PI / 2; wasser.position.set(s.x, 0.9, s.y);
  scene.add(ufer, wasser);
}

// ---------- Bäume ----------
const baumGeo = {
  stamm: new THREE.CylinderGeometry(5, 7, 50, 7).translate(0, 25, 0),
  unten: new THREE.ConeGeometry(28, 50, 8).translate(0, 70, 0),
  oben: new THREE.ConeGeometry(20, 40, 8).translate(0, 100, 0),
  stumpf: new THREE.CylinderGeometry(8, 9, 8, 8).translate(0, 4, 0),
};
const baumTeile = baeume.map(b => {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.y); g.scale.setScalar(b.r / 28); g.rotation.y = Math.random() * 6;
  const stamm = new THREE.Mesh(baumGeo.stamm, holzMat);
  const unten = new THREE.Mesh(baumGeo.unten, kroneDunkel);
  const oben = new THREE.Mesh(baumGeo.oben, kroneHell);
  const stumpf = new THREE.Mesh(baumGeo.stumpf, stumpfMat);
  for (const m of [stamm, unten, oben]) { m.castShadow = true; m.receiveShadow = true; }
  stumpf.visible = false;
  g.add(stamm, unten, oben, stumpf);
  scene.add(g);
  return { g, stamm, unten, oben, stumpf, durch: false };
});

// ---------- Steine ----------
const steinGeo = new THREE.DodecahedronGeometry(1, 0);
const steinTeile = steine.map(s => {
  const m = new THREE.Mesh(steinGeo, steinMat);
  m.scale.set(s.r, s.r * 0.75, s.r * 0.9);
  m.position.set(s.x, s.r * 0.35, s.y); m.rotation.y = Math.random() * 6;
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
});

// ---------- Büsche mit Beeren ----------
const buschGeo = new THREE.SphereGeometry(16, 10, 8), beereGeo = new THREE.SphereGeometry(3.2, 6, 5);
const buschTeile = buesche.map(b => {
  const g = new THREE.Group(); g.position.set(b.x, 0, b.y);
  const k1 = new THREE.Mesh(buschGeo, buschMat); k1.scale.set(1, 0.75, 1); k1.position.y = 10;
  const k2 = new THREE.Mesh(buschGeo, buschMat2); k2.scale.set(0.65, 0.55, 0.65); k2.position.set(-5, 17, -4);
  k1.castShadow = true;
  g.add(k1, k2);
  const beeren = [0, 1, 2].map(i => {
    const a = i * 2.1 + 0.4;
    const m = new THREE.Mesh(beereGeo, beerenMat);
    m.position.set(Math.cos(a) * 13, 13 + (i % 2) * 4, Math.sin(a) * 13);
    g.add(m); return m;
  });
  scene.add(g);
  return { g, beeren };
});

// ---------- Hilfsfunktion: 3D-Objekte zu Spiel-Objekten passend halten ----------
// Für jedes Ding in der Liste gibt es ein 3D-Modell. Neue bekommen eins, weg ist weg.
function abgleichen(liste, karte, baue) {
  for (const o of liste) if (!karte.has(o)) { const m = baue(o); scene.add(m); karte.set(o, m); }
  for (const [o, m] of karte) if (!liste.includes(o)) { scene.remove(m); karte.delete(o); }
}
const feuerModelle = new Map(), huettenModelle = new Map(), wolfModelle = new Map(), hasenModelle = new Map();

// ---------- Lagerfeuer ----------
const kleinerStein = new THREE.DodecahedronGeometry(5, 0);
const scheitGeo = new THREE.CylinderGeometry(2.5, 2.5, 30, 6).rotateZ(Math.PI / 2).translate(0, 3, 0);
const flammeGeo1 = new THREE.ConeGeometry(9, 26, 7).translate(0, 13, 0);
const flammeGeo2 = new THREE.ConeGeometry(5.5, 18, 6).translate(0, 9, 0);
function baueFeuer() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const s = new THREE.Mesh(kleinerStein, steinMat); s.position.set(Math.cos(a) * 16, 2, Math.sin(a) * 16); g.add(s);
  }
  const s1 = new THREE.Mesh(scheitGeo, holzMat); s1.rotation.y = 0.6;
  const s2 = new THREE.Mesh(scheitGeo, holzMat); s2.rotation.y = -0.6;
  const f1 = new THREE.Mesh(flammeGeo1, flammeMat1), f2 = new THREE.Mesh(flammeGeo2, flammeMat2);
  f1.position.y = 3; f2.position.y = 4;
  g.add(s1, s2, f1, f2);
  g.userData = { f1, f2 };
  return g;
}

// ---------- Hütte ----------
function baueHuette(h) {
  const g = new THREE.Group();
  const G = HUETTE_GROESSE, hoch = 45, d = 6;
  const kiste = (b, h, t, x, y, z, m) => {
    const k = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), m);
    k.position.set(x, y, z); k.castShadow = true; k.receiveShadow = true; g.add(k); return k;
  };
  kiste(G * 2, 2, G * 2, 0, 1, 0, dielenMat);                       // Boden
  kiste(G * 2, hoch, d, 0, hoch / 2, -G, wandMat);                  // Wand hinten
  kiste(d, hoch, G * 2, -G, hoch / 2, 0, wandMat);                  // Wand links
  kiste(d, hoch, G * 2, G, hoch / 2, 0, wandMat);                   // Wand rechts
  const tuer = 30, stueck = (G * 2 - tuer) / 2;
  kiste(stueck, hoch, d, -(tuer / 2 + stueck / 2), hoch / 2, G, wandMat);   // Wand vorne mit Tür
  kiste(stueck, hoch, d, tuer / 2 + stueck / 2, hoch / 2, G, wandMat);
  kiste(tuer, 12, d, 0, hoch - 6, G, wandMat);
  // Bett
  kiste(26, 8, 40, -G + 17, 5, -G + 26, holzMat);
  kiste(22, 3, 26, -G + 17, 10, -G + 32, mat('#c0392b'));
  kiste(18, 4, 9, -G + 17, 10, -G + 12, weissMat);
  // Dach (Pyramide)
  const dach = new THREE.Mesh(new THREE.ConeGeometry((G + 12) * Math.SQRT2, 42, 4), dachMat);
  dach.rotation.y = Math.PI / 4; dach.position.y = hoch + 21; dach.castShadow = true;
  g.add(dach);
  g.position.set(h.x, 0, h.y);
  return g;
}

// ---------- Monster (im Code heißt es noch "Wolf") ----------
const kugel = new THREE.SphereGeometry(1, 12, 9);
function teil(geo, m, x, y, z, sx = 1, sy = sx, sz = sx) {
  const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.scale.set(sx, sy, sz); k.castShadow = true; return k;
}
const beinGeo = new THREE.CylinderGeometry(2.5, 2, 14, 6).translate(0, -7, 0);
function baueWolf() {
  // Das Monster: läuft auf zwei Beinen, hat ein großes leuchtendes Auge, Hörner und Zähne
  const g = new THREE.Group();
  g.add(teil(kugel, wolfMat, 0, 38, 0, 16, 22, 18));                 // dicker Körper
  g.add(teil(kugel, wolfMat2, 6, 34, 0, 12, 15, 14));                // heller Bauch
  g.add(teil(kugel, wolfMat, 4, 62, 0, 13, 12, 13));                 // Kopf
  g.add(teil(kugel, weissMat, 15, 66, 0, 5.5));                      // großes Auge
  g.add(teil(kugel, wolfAugen, 19.5, 66, 0, 2.8));                   // rote Pupille (leuchtet)
  g.add(teil(new THREE.BoxGeometry(4, 6, 16), maulMat, 15, 55, 0));  // Maul
  const zahn = new THREE.ConeGeometry(1.4, 4, 4);
  for (const z of [-5, -1.7, 1.7, 5]) { const t = teil(zahn, weissMat, 17.5, 56.5, z); t.rotation.x = Math.PI; g.add(t); }
  const horn = new THREE.ConeGeometry(3, 14, 6);
  const h1 = teil(horn, hornMat, 0, 75, -8); h1.rotation.x = -0.5; g.add(h1);
  const h2 = teil(horn, hornMat, 0, 75, 8); h2.rotation.x = 0.5; g.add(h2);
  for (let i = 0; i < 4; i++) g.add(teil(new THREE.ConeGeometry(3, 8, 4), wolfMat2, -15, 50 - i * 9, 0)); // Stacheln am Rücken
  const armGeo = new THREE.CylinderGeometry(3.5, 2.5, 26, 6).translate(0, -13, 0);
  const arme = [-19, 19].map(z => { const a = teil(armGeo, wolfMat, 2, 50, z); g.add(a); return a; });
  for (const a of arme) for (const z of [-2.5, 0, 2.5]) { const k = teil(new THREE.ConeGeometry(0.8, 5, 4), hornMat, 2, -27, z); k.rotation.z = Math.PI; a.add(k); } // Krallen
  const monsterBein = new THREE.CylinderGeometry(5, 4, 20, 6).translate(0, -10, 0);
  const beine = [-8, 8].map(z => { const b = teil(monsterBein, wolfMat, 0, 20, z); g.add(b); return b; });
  g.userData = { beine, arme, schritt: 0 };
  return g;
}

// ---------- Hase ----------
const ohrGeo = new THREE.CapsuleGeometry(1.6, 7, 3, 6);
function baueHase() {
  const g = new THREE.Group();
  g.add(teil(kugel, hasenMat, 0, 9, 0, 11, 8, 8));
  g.add(teil(kugel, hasenMat, 9, 14, 0, 6));
  g.add(teil(ohrGeo, hasenMat, 7, 23, -2.5), teil(ohrGeo, hasenMat, 7, 23, 2.5));
  g.add(teil(kugel, weissMat, -11, 10, 0, 3.5));
  g.add(teil(kugel, schwarzMat, 14, 15, -2.5, 1.2), teil(kugel, schwarzMat, 14, 15, 2.5, 1.2));
  return g;
}

// ---------- Spieler (du und deine Freunde) ----------
const SPIELER_FARBEN = ['#c0392b', '#2f7fd8', '#d05fc0', '#3fae4f', '#e6b800', '#e67e22', '#8e6bff', '#20b2aa'];
const hautMat = mat('#f2c49b'), haarMat = mat('#5a3a1a'), hoseMat = mat('#2c3e66');
const heldBeinGeo = new THREE.CylinderGeometry(3.5, 3.5, 12, 7).translate(0, -6, 0);
const jackeGeo = new THREE.CapsuleGeometry(9, 12, 4, 10);
const haarGeo = new THREE.SphereGeometry(8.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const speerStock = new THREE.CylinderGeometry(1.3, 1.3, 55, 6).translate(0, 12.5, 0), speerSpitze = new THREE.ConeGeometry(2.8, 9, 6).translate(0, 44, 0);
const speerHolz = mat('#8a5a2b'), speerMetall = mat('#99aaaa');
function baueHeld(farbe) {
  const g = new THREE.Group();
  const jacke = mat(farbe);
  const bein1 = teil(heldBeinGeo, hoseMat, 0, 12, -4), bein2 = teil(heldBeinGeo, hoseMat, 0, 12, 4);
  g.add(bein1, bein2);
  g.add(teil(jackeGeo, jacke, 0, 22, 0));                                    // Jacke
  g.add(teil(kugel, hautMat, 0, 41, 0, 8));                                  // Kopf
  g.add(teil(haarGeo, haarMat, -1, 42, 0));                                  // Haare
  g.add(teil(kugel, schwarzMat, 7.2, 40.5, -3, 1.4), teil(kugel, schwarzMat, 7.2, 40.5, 3, 1.4)); // Augen
  // Speer (zeigt nach vorne)
  const speerG = new THREE.Group();
  const innen = new THREE.Group(); innen.rotation.z = -Math.PI / 2;
  innen.add(new THREE.Mesh(speerStock, speerHolz), new THREE.Mesh(speerSpitze, speerMetall));
  speerG.add(innen); speerG.position.set(4, 24, 12);
  g.add(speerG);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  g.userData = { jacke, bein1, bein2, speerG };
  return g;
}
// Ein Spieler-Modell an die Daten anpassen (Position, Blick, Beine, Speer)
function stelleHeld(g, d, stoss) {
  const wipp = Math.abs(Math.sin(d.laufen || 0)) * 2;
  g.position.set(d.x, wipp, d.y);
  g.rotation.y = -(d.blick || 0);
  g.userData.bein1.rotation.z = Math.sin(d.laufen || 0) * 0.6;
  g.userData.bein2.rotation.z = -Math.sin(d.laufen || 0) * 0.6;
  g.userData.speerG.visible = !!d.speer;
  g.userData.speerG.position.x = 4 + (stoss ? 15 : 0);
}
const held = baueHeld(SPIELER_FARBEN[0]);
scene.add(held);
const andereModelle = new Map();

// ---------- Schnee im Winter ----------
const SCHNEE = 1500;
const schneePos = new Float32Array(SCHNEE * 3);
for (let i = 0; i < SCHNEE; i++) {
  schneePos[i * 3] = (Math.random() - 0.5) * 900;
  schneePos[i * 3 + 1] = Math.random() * 400;
  schneePos[i * 3 + 2] = (Math.random() - 0.5) * 900;
}
const schneeGeo = new THREE.BufferGeometry();
schneeGeo.setAttribute('position', new THREE.BufferAttribute(schneePos, 3));
const schnee = new THREE.Points(schneeGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 3.5 }));
scene.add(schnee);

// ---------- Jedes Bild: 3D-Welt an den Spielzustand anpassen ----------
const kamZiel = new THREE.Vector3();
function welt3d(dt) {
  const p = spieler;
  const jetzt = performance.now();
  jahreszeitFarben();

  // Bäume: gefällt = Baumstumpf, wackeln beim Hacken
  baeume.forEach((b, i) => {
    const t = baumTeile[i];
    const da = !b.weg;
    t.stamm.visible = t.unten.visible = t.oben.visible = da;
    t.stumpf.visible = !da;
    t.g.position.x = b.x + (b.wackeln > 0 ? Math.sin(b.wackeln * 60) * 3 : 0);
  });
  steine.forEach((s, i) => {
    steinTeile[i].visible = !s.weg;
    steinTeile[i].position.x = s.x + (s.wackeln > 0 ? Math.sin(s.wackeln * 60) * 2 : 0);
  });
  buesche.forEach((b, i) => buschTeile[i].beeren.forEach((m, k) => { m.visible = k < b.beeren; }));

  // Feuer
  abgleichen(feuer, feuerModelle, baueFeuer);
  for (const [f, m] of feuerModelle) {
    m.position.set(f.x, 0, f.y);
    const g = 0.5 + Math.min(1, f.brennstoff / 40) * 0.5;
    m.userData.f1.scale.set(g, g * (1 + Math.sin(jetzt / 90) * 0.15), g);
    m.userData.f2.scale.set(g, g * (1 + Math.cos(jetzt / 70) * 0.2), g);
    m.userData.f1.rotation.y += dt * 2;
  }
  // Die 3 nächsten Feuer bekommen ein Licht
  const naheFeuer = [...feuer].sort((a, b) => abstand(a, p) - abstand(b, p));
  feuerLichter.forEach((l, i) => {
    const f = naheFeuer[i];
    if (!f) { l.intensity = 0; return; }
    l.position.set(f.x, 30, f.y);
    l.intensity = (2.4 + Math.sin(jetzt / 110) * 0.3) * (0.4 + Math.min(1, f.brennstoff / 40) * 0.6);
  });

  // Hütte
  abgleichen(huetten, huettenModelle, baueHuette);
  dachMat.opacity = inHuette() ? 0.2 : 1;
  dachMat.depthWrite = !inHuette();

  // Wölfe
  abgleichen(woelfe, wolfModelle, baueWolf);
  for (const [w, m] of wolfModelle) {
    const alt = m.position.clone();
    m.position.set(w.x, 0, w.y);
    m.rotation.y = -(w.blick || 0);
    const bewegt = alt.distanceTo(m.position);
    m.userData.schritt += bewegt * 0.12;
    m.userData.beine.forEach((b, i) => { b.rotation.z = Math.sin(m.userData.schritt + i * Math.PI) * 0.6; });
    m.userData.arme.forEach((a, i) => { a.rotation.z = Math.sin(m.userData.schritt + i * Math.PI + Math.PI) * 0.4 + 0.6; }); // Arme greifen nach vorne
  }
  // Hasen
  abgleichen(hasen, hasenModelle, baueHase);
  for (const [h, m] of hasenModelle) {
    m.position.set(h.x, Math.abs(Math.sin(h.hopp)) * 6, h.y);
    m.rotation.y = -h.ziel;
  }

  // Spieler
  held.userData.jacke.color.set(SPIELER_FARBEN[meineNr - 1]);
  stelleHeld(held, { ...p, speer }, angriffPause > 0.15);
  // Deine Freunde
  abgleichen(Object.values(andere), andereModelle, a => baueHeld(SPIELER_FARBEN[(a.nr - 1) % 8]));
  for (const [a, m] of andereModelle) stelleHeld(m, a, false);

  // Tag und Nacht
  const n = dunkelheit() / 0.85;     // 0 = hell, 1 = ganz dunkel
  himmelLicht.intensity = 1.5 * (1 - n) + 0.18;
  himmelLicht.color.set('#dff1ff').lerp(new THREE.Color('#6a7fc0'), n);
  sonne.intensity = 2.2 * (1 - n);
  spielerLicht.intensity = 1.1 * n;
  spielerLicht.position.set(p.x, 50, p.y);
  scene.background.copy(tagHimmel).lerp(nachtHimmel, n);
  scene.fog.color.copy(scene.background);
  scene.fog.near = 450 - n * 300; scene.fog.far = 1300 - n * 600;
  sonne.position.set(p.x + 250, 450, p.y + 180);
  sonne.target.position.set(p.x, 0, p.y);

  // Schnee
  schnee.visible = istWinter();
  if (schnee.visible) {
    for (let i = 0; i < SCHNEE; i++) {
      schneePos[i * 3 + 1] -= dt * 70;
      schneePos[i * 3] += Math.sin(jetzt / 900 + i) * dt * 10;
      if (schneePos[i * 3 + 1] < 0) schneePos[i * 3 + 1] += 400;
    }
    schneeGeo.attributes.position.needsUpdate = true;
    schnee.position.set(p.x, 0, p.y);
  }

  // Kamera hinter dem Helden
  kamera.position.set(p.x - Math.cos(kamWinkel) * kamAbstand, kamAbstand * 0.75, p.y - Math.sin(kamWinkel) * kamAbstand);
  kamZiel.set(p.x, 25, p.y);
  kamera.lookAt(kamZiel);

  // Bäume zwischen Kamera und Held werden durchsichtig, damit du dich immer siehst
  const cx = kamera.position.x, cz = kamera.position.z;
  const vx = p.x - cx, vz = p.y - cz, l2 = vx * vx + vz * vz;
  baeume.forEach((b, i) => {
    let durch = false;
    if (!b.weg) {
      const t = ((b.x - cx) * vx + (b.y - cz) * vz) / l2;
      if (t > 0 && t < 1.08) {
        const qx = cx + vx * t - b.x, qz = cz + vz * t - b.y;
        durch = qx * qx + qz * qz < (b.r + 20) ** 2;
      }
    }
    const teile = baumTeile[i];
    if (teile.durch !== durch) {
      teile.durch = durch;
      teile.unten.material = durch ? kroneDunkelDurch : kroneDunkel;
      teile.oben.material = durch ? kroneHellDurch : kroneHell;
    }
  });

  renderer.render(scene, kamera);
}


// ---------- 👫 Mehrspieler (mit PeerJS) ----------
// Die Computer verbinden sich direkt miteinander.
// Einer erstellt den Raum (der "Host"), die anderen treten mit dem Raum-Code bei.
// Der Host passt auf die Welt auf: Zeit, Tiere, Feuer, Hütten.
// Jeder Spieler hat seinen eigenen Hunger, Durst, Wärme und seine eigenen Sachen.

let netzRolle = 'solo';      // 'solo', 'host' oder 'gast'
let peer = null;
let hostVerbindung = null;   // nur für Gäste: die Verbindung zum Host
const gaeste = new Map();    // nur für den Host: alle Gäste
let andere = {};             // die anderen Spieler
let meineNr = 1;
let raumCode = '';
let netzText = '';           // Info-Text im Startbildschirm
let netzUhr = 0;
const MAX_SPIELER = 8;

function codeMachen() {
  const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += zeichen[Math.floor(Math.random() * zeichen.length)];
  return c;
}
const peerName = code => 'wald300-raum-' + code.toLowerCase();

function peerDa() {
  if (typeof Peer === 'undefined') { netzText = '😕 Online geht gerade nicht. Bist du mit dem Internet verbunden?'; return false; }
  return true;
}

// ---------- Hilfen für die Spiel-Logik ----------
function alleSpieler() { return [spieler, ...Object.values(andere)]; }
function zufallsSpieler() { const a = alleSpieler(); return a[Math.floor(Math.random() * a.length)]; }
function naechsterSpieler(o) {
  let s = spieler, d = abstand(o, spieler);
  for (const a of Object.values(andere)) { const da = abstand(o, a); if (da < d) { d = da; s = a; } }
  return { s, d };
}

// Nur Gäste schicken etwas an den Host
function anHost(d) { if (netzRolle === 'gast' && hostVerbindung && hostVerbindung.open) hostVerbindung.send(d); }
// Nur der Host schickt etwas an alle Gäste
function anAlle(d, ausser) { if (netzRolle === 'host') for (const g of gaeste.values()) if (g !== ausser && g.open) g.send(d); }

function neuesFeuer(x, y) {
  if (netzRolle === 'gast') anHost({ t: 'feuer+', x, y });
  else feuer.push({ id: naechsteId++, x, y, brennstoff: 60 });
}
function neueHuette(x, y, nr = meineNr) {
  if (netzRolle === 'gast') anHost({ t: 'huette+', x, y, nr });
  else if (!huetten.some(h => h.nr === nr)) huetten.push({ id: naechsteId++, x, y, nr });
}

// Ein Baum, Stein oder Busch hat sich verändert -> den anderen erzählen
const WELT_LISTEN = { baum: baeume, stein: steine, busch: buesche };
function weltWerte(art, o) { return art === 'busch' ? [o.beeren, o.nachwachsen] : [o.hp, o.weg]; }
function weltSetzen(art, i, w) {
  const o = WELT_LISTEN[art][i]; if (!o) return;
  if (art === 'busch') { o.beeren = w[0]; o.nachwachsen = w[1]; } else { o.hp = w[0]; o.weg = w[1]; }
}
function weltGeaendert(art, i) {
  const d = { t: 'welt1', art, i, w: weltWerte(art, WELT_LISTEN[art][i]) };
  anAlle(d); anHost(d);
}
function weltPaket() {
  return { t: 'welt', baeume: baeume.map(b => [b.hp, b.weg]), steine: steine.map(s => [s.hp, s.weg]), buesche: buesche.map(b => [b.beeren, b.nachwachsen]) };
}
function weltAnwenden(d) {
  d.baeume.forEach((w, i) => weltSetzen('baum', i, w));
  d.steine.forEach((w, i) => weltSetzen('stein', i, w));
  d.buesche.forEach((w, i) => weltSetzen('busch', i, w));
}

// Wenn du im Mehrspieler umkippst: bei deiner Hütte (oder am Start) wieder aufwachen
function wiederbeleben() {
  const h = huetten.find(h => h.nr === meineNr);
  Object.assign(spieler, { x: h ? h.x : 1500, y: h ? h.y : 1300, leben: 100, hunger: 80, durst: 80, waerme: 80 });
  inv = { holz: 0, stein: 0, beeren: 0, fleisch: 0, gebraten: 0 };
  sag('💫 Du bist umgekippt! Du wachst wieder auf, aber deine Sachen sind weg.', '#ff8080');
}

// ---------- Host: einen Raum erstellen ----------
function netzHosten() {
  if (!peerDa() || peer) return;
  const weiter = hatSpielstand() && confirm('Willst du dein gespeichertes Spiel mit Freunden weiterspielen?\n\nOK = weiterspielen\nAbbrechen = neues Spiel');
  raumCode = codeMachen();
  netzText = '⏳ Raum wird erstellt …';
  peer = new Peer(peerName(raumCode));

  peer.on('open', () => {
    netzRolle = 'host'; meineNr = 1;
    if (!(weiter && laden())) neuesSpiel();
    zustand = 'spiel';
    sag('👫 Dein Raum-Code ist ' + raumCode + ' – sag ihn deinen Freunden!', '#7bd389');
  });

  peer.on('connection', v => {
    v.on('open', () => {
      if (gaeste.size >= MAX_SPIELER - 1) { v.send({ t: 'voll' }); setTimeout(() => v.close(), 500); return; }
      v.nr = freieNummer();
      gaeste.set(v.peer, v);
      v.send({ ...weltPaket(), t: 'start', nr: v.nr, tag, zeit, feuer, huetten });
      sag('👋 Spieler ' + v.nr + ' ist da!', SPIELER_FARBEN[v.nr - 1]);
    });
    v.on('data', d => hostEmpfaengt(v, d));
    v.on('close', () => {
      if (!gaeste.has(v.peer)) return;
      gaeste.delete(v.peer);
      delete andere[v.peer];
      sag('Spieler ' + v.nr + ' ist gegangen', '#aaa');
    });
  });

  // Falls die Verbindung zum Vermittlungs-Dienst abbricht: neu verbinden
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { peer.destroy(); peer = null; netzHosten(); return; } // Code schon vergeben -> neuer Code
    if (netzRolle === 'solo') { netzText = '😕 Das hat nicht geklappt (' + e.type + '). Versuch es nochmal!'; peer = null; }
  });
}

function freieNummer() {
  const belegt = new Set([1, ...[...gaeste.values()].map(g => g.nr)]);
  for (let n = 2; n <= MAX_SPIELER; n++) if (!belegt.has(n)) return n;
  return MAX_SPIELER;
}

function hostEmpfaengt(v, d) {
  if (d.t === 'pos') spielerMerken(v.peer, { ...d, nr: v.nr });
  else if (d.t === 'welt1') { weltSetzen(d.art, d.i, d.w); anAlle(d, v); }
  else if (d.t === 'feuer+') neuesFeuer(d.x, d.y);
  else if (d.t === 'huette+') neueHuette(d.x, d.y, v.nr);
  else if (d.t === 'feuerHolz') { const f = feuer.find(f => f.id === d.id); if (f) f.brennstoff = Math.min(150, f.brennstoff + 30); }
  else if (d.t === 'treffer') {
    if (d.art === 'hase') { const h = hasen.find(h => h.id === d.id); if (h) h.hp = 0; }
    if (d.art === 'wolf') {
      const w = woelfe.find(w => w.id === d.id), a = andere[v.peer];
      if (!w) return;
      w.hp -= d.schaden;
      if (a) { const l = abstand(a, w) || 1; w.x += (w.x - a.x) / l * 30; w.y += (w.y - a.y) / l * 30; }
    }
  }
}

// ---------- Gast: bei einem Freund mitspielen ----------
function netzBeitreten(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 4) { netzText = 'Der Raum-Code hat 4 Zeichen.'; return; }
  if (!peerDa() || peer) return;
  netzText = '⏳ Suche Raum ' + code + ' …';
  peer = new Peer();

  peer.on('open', () => {
    hostVerbindung = peer.connect(peerName(code), { reliable: true });
    hostVerbindung.on('data', gastEmpfaengt);
    hostVerbindung.on('close', () => {
      if (netzRolle !== 'gast') return;
      alert('Die Verbindung zu deinem Freund ist weg. 😕 Das Spiel startet neu.');
      location.reload();
    });
    raumCode = code;
  });
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') netzText = '😕 Den Raum ' + code + ' gibt es nicht. Stimmt der Code?';
    else netzText = '😕 Das hat nicht geklappt (' + e.type + '). Versuch es nochmal!';
    if (netzRolle === 'solo') { peer.destroy(); peer = null; }
  });
}

// Liste mit Tieren/Feuern vom Host übernehmen. Dinge mit gleicher Nummer bleiben dieselben,
// damit die 3D-Modelle nicht jedes Mal neu gebaut werden.
function uebernehmen(liste, neu) {
  const alt = new Map(liste.map(o => [o.id, o]));
  return neu.map(n => {
    const o = alt.get(n.id);
    if (!o) return { ...n, zx: n.x, zy: n.y };
    Object.assign(o, n, { x: o.x, y: o.y, zx: n.x, zy: n.y });
    return o;
  });
}

function gastEmpfaengt(d) {
  if (d.t === 'start') {
    neuesSpiel();
    weltAnwenden(d);
    feuer = d.feuer; huetten = d.huetten; tag = d.tag; zeit = d.zeit;
    meineNr = d.nr;
    netzRolle = 'gast';
    zustand = 'spiel';
    sag('👫 Du bist Spieler ' + meineNr + '! Viel Spaß im Wald!', SPIELER_FARBEN[meineNr - 1]);
  } else if (d.t === 'welt') weltAnwenden(d);
  else if (d.t === 'welt1') weltSetzen(d.art, d.i, d.w);
  else if (d.t === 'lage') {
    zeit = d.zeit;
    if (d.tag !== tag) {
      tag = d.tag;
      sag('☀️ Tag ' + tag + ' beginnt!', '#ffd166');
      if ((tag - 1) % 30 === 0) sag('Die Jahreszeit wechselt: ' + jahreszeit(), istWinter() ? '#bfe6ff' : '#9be37b');
    }
    const da = new Set();
    for (const s of d.spieler) {
      if (s.nr === meineNr) continue;
      spielerMerken(s.nr, s); da.add(String(s.nr));
    }
    for (const id in andere) if (!da.has(id)) delete andere[id];
    woelfe = uebernehmen(woelfe, d.woelfe);
    hasen = uebernehmen(hasen, d.hasen);
    feuer = uebernehmen(feuer, d.feuer);
    huetten = uebernehmen(huetten, d.huetten);
  } else if (d.t === 'gewonnen') zustand = 'gewonnen';
  else if (d.t === 'voll') netzText = '😕 Der Raum ist voll (höchstens ' + MAX_SPIELER + ' Spieler).';
}

// ---------- Für alle ----------
function spielerMerken(id, d) {
  const a = andere[id] ||= { x: d.x, y: d.y };
  Object.assign(a, { nr: d.nr, zx: d.x, zy: d.y, blick: d.blick, laufen: d.laufen, speer: d.speer, inH: d.inH });
}

function meinePosition() {
  return { x: Math.round(spieler.x), y: Math.round(spieler.y), blick: +spieler.blick.toFixed(2),
           laufen: +(spieler.laufen || 0).toFixed(2), speer, inH: inHuette() };
}
const rund = o => ({ ...o, x: Math.round(o.x), y: Math.round(o.y) });

// Jedes Bild: andere weich bewegen und 10-mal pro Sekunde Daten schicken
function netzTick(dt) {
  const weich = o => { if (o.zx === undefined) return; o.x += (o.zx - o.x) * Math.min(1, dt * 12); o.y += (o.zy - o.y) * Math.min(1, dt * 12); };
  for (const a of Object.values(andere)) weich(a);
  if (netzRolle === 'gast') {
    for (const w of woelfe) weich(w);
    for (const h of hasen) { weich(h); h.hopp = (h.hopp || 0) + dt * 10; }
  }
  if (netzRolle === 'solo' || zustand !== 'spiel') return;
  netzUhr += dt;
  if (netzUhr < 0.1) return;
  netzUhr = 0;
  if (netzRolle === 'gast') anHost({ t: 'pos', ...meinePosition() });
  if (netzRolle === 'host') {
    const liste = [{ nr: 1, ...meinePosition() }];
    for (const a of Object.values(andere)) liste.push({ nr: a.nr, x: a.zx, y: a.zy, blick: a.blick, laufen: a.laufen, speer: a.speer, inH: a.inH });
    anAlle({
      t: 'lage', zeit, tag, spieler: liste,
      woelfe: woelfe.map(w => rund({ id: w.id, x: w.x, y: w.y, blick: +(w.blick || 0).toFixed(2), hp: w.hp })),
      hasen: hasen.map(h => rund({ id: h.id, x: h.x, y: h.y, ziel: +h.ziel.toFixed(2), hp: h.hp })),
      feuer: feuer.map(f => rund({ id: f.id, x: f.x, y: f.y, brennstoff: Math.round(f.brennstoff) })),
      huetten,
    });
  }
}

// Raum-Code und Namen über den Köpfen anzeigen
const kopfPunkt = new THREE.Vector3();
function zeichneNetzHUD() {
  if (netzRolle === 'solo') return;
  ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
  for (const a of Object.values(andere)) {
    kopfPunkt.set(a.x, 64, a.y).project(kamera);
    if (kopfPunkt.z > 1) continue;   // hinter der Kamera
    const sx = (kopfPunkt.x + 1) / 2 * B, sy = (1 - kopfPunkt.y) / 2 * H;
    const name = 'Spieler ' + a.nr + (a.inH ? ' 🛖' : '');
    const w = ctx.measureText(name).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(sx - w / 2, sy - 16, w, 20);
    ctx.fillStyle = SPIELER_FARBEN[(a.nr - 1) % 8]; ctx.fillText(name, sx, sy - 1);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(B - 230, 96, 220, 48);
  ctx.fillStyle = '#7bd389'; ctx.font = 'bold 16px system-ui';
  ctx.fillText('👫 Raum-Code: ' + raumCode, B - 22, 116);
  ctx.fillStyle = SPIELER_FARBEN[meineNr - 1]; ctx.font = '14px system-ui';
  ctx.fillText('Du: Spieler ' + meineNr + ' · ' + alleSpieler().length + ' im Wald', B - 22, 136);
}

// ---------- Anzeige (HUD) ----------
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
  const hilfe = ['WASD: laufen (W = nach vorne, Shift: rennen)', 'Q/E oder Maus ziehen: Kamera drehen · Mausrad: Zoom', 'Leertaste: hacken, sammeln, trinken, angreifen', 'F: essen · P: Pause',
    '1: Lagerfeuer (5🪵 2🪨)', '2: Speer (3🪵 3🪨)', '3: Hütte (15🪵 5🪨)'];
  hilfe.forEach((t, i) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(10, H - 36 - (hilfe.length - 1) * 21 + i * 21, ctx.measureText(t).width + 12, 19);
    ctx.fillStyle = '#fff'; ctx.fillText(t, 16, H - 21 - (hilfe.length - 1) * 21 + i * 21);
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
  netzTick(dt);
  if (zustand === 'start') kamWinkel += dt * 0.15;   // Kamera kreist langsam im Startbildschirm

  welt3d(dt);

  ctx.clearRect(0, 0, B, H);
  if (zustand === 'spiel' || zustand === 'pause') { zeichneHUD(); zeichneNetzHUD(); }
  if (zustand === 'start') {
    const z = ['Kannst du 300 Tage im Wald überleben?', 'Sammle Holz 🪵, Steine 🪨 und Beeren 🫐.',
      'Trink am See 💧, baue Lagerfeuer 🔥 und eine Hütte 🛖 gegen Kälte und Monster 👹.', '', '▶ ENTER = Allein spielen'];
    if (hatSpielstand()) z.push('▶ L = Weiterspielen (gespeichert)');
    z.push('👫 M = Mit Freunden spielen (Raum erstellen)', '👫 B = Bei einem Freund mitspielen (Code eingeben)');
    if (netzText) z.push(netzText);
    if (rekord() > 1) z.push('🏆 Dein Rekord: Tag ' + rekord());
    bildschirm('🌲 300 Tage im Wald 3D 🌲', z);
  }
  if (zustand === 'tot') bildschirm('💀 Du hast nicht überlebt', ['Du hast bis Tag ' + tag + ' durchgehalten.', '🏆 Rekord: Tag ' + rekord(), '', 'ENTER = Nochmal versuchen']);
  if (zustand === 'gewonnen') bildschirm('🏆 GESCHAFFT! 🏆', ['Du hast 300 Tage im Wald überlebt!', 'Du bist ein echter Survival-Profi!', '', 'ENTER = Zurück zum Start']);

  requestAnimationFrame(schleife);
}
requestAnimationFrame(schleife);
