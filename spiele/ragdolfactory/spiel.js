import * as THREE from 'three';

// ================= EINSTELLUNGEN (hier kannst du rumprobieren!) =================
const G = 2;                 // Größe eines Bau-Feldes in Metern
const WELT = 28;             // so viele Felder geht die Welt von der Mitte bis zum Rand
const SCHWERKRAFT = 22;
const LAUF_TEMPO = 6, RENN_TEMPO = 10, SPRUNG_KRAFT = 8.5;
const BAND_TEMPO = 1.5;      // Felder pro Sekunde auf dem Förderband
const BOHR_ZEIT = 2.2;       // Sekunden pro Erz
const SCHMELZ_ZEIT = 2;      // Sekunden pro Barren
const ERSTE_WELLE = 90;      // Sekunden bis die ersten Roboter kommen
const WELLEN_PAUSE = 60;     // Sekunden zwischen den Wellen
const BALL_TEMPO = 30;
const SPIELER_LEBEN = 100;
const START_LAGER = { eisen: 20, kupfer: 10 };
const SPEICHER_NAME = 'ragdolfactory-spielstand';
const DT = 1 / 60;           // Physik rechnet 60 Mal pro Sekunde

// Gebäude: Kosten in Barren. "sperre" = welcher Meilenstein geschafft sein muss
const GEBAEUDE = {
  bohrer:    { name: 'Bohrer',     emoji: '⛏️', kosten: { eisen: 6 },            hoehe: 3.0, halb: 0.9 },
  band:      { name: 'Band',       emoji: '➡️', kosten: { eisen: 1 },            hoehe: 0.35, halb: 1.0 },
  schmelze:  { name: 'Schmelze',   emoji: '🔥', kosten: { eisen: 5, kupfer: 3 }, hoehe: 2.6, halb: 0.9 },
  schleuder: { name: 'Schleuder',  emoji: '🚀', kosten: { eisen: 4, kupfer: 2 }, hoehe: 0.3, halb: 0.95, sperre: 2 },
  turm:      { name: 'Ball-Turm',  emoji: '🗼', kosten: { eisen: 10, kupfer: 8 }, hoehe: 2.7, halb: 0.9, sperre: 1 },
  hub:       { name: 'HUB',        emoji: '🏠', kosten: {},                      hoehe: 2.8, halb: 0.9 },
};
const WERKZEUGE = ['hand', 'bohrer', 'band', 'schmelze', 'schleuder', 'turm', 'abriss'];

const MEILENSTEINE = [
  { text: 'Liefere 10 Eisenbarren zum HUB', zahl: () => stand.geliefert.eisen, ziel: 10, belohnung: 'Ball-Turm freigeschaltet! (Taste 5)' },
  { text: 'Liefere 10 Kupferbarren zum HUB', zahl: () => stand.geliefert.kupfer, ziel: 10, belohnung: 'Schleuder freigeschaltet! (Taste 4)' },
  { text: 'Haue 10 Roboter kaputt', zahl: () => stand.kills, ziel: 10, belohnung: 'Deine Kanone schießt jetzt 3 Bälle!' },
  { text: 'Liefere 100 Eisenbarren zum HUB', zahl: () => stand.geliefert.eisen, ziel: 100, belohnung: '🏆 Du bist FABRIK-CHEF! 🏆' },
];

// Erz-Felsen: [Art, Feld-x, Feld-z]
const ERZ_ORTE = [
  ['eisen', 3, 1], ['eisen', -4, 3], ['eisen', 5, -5], ['eisen', -7, -6], ['eisen', 9, 7], ['eisen', -12, 5], ['eisen', 14, -2],
  ['kupfer', 2, -4], ['kupfer', -6, -1], ['kupfer', -3, 8], ['kupfer', 11, -9], ['kupfer', -14, -10],
];

// Richtungen: 0 = +x, 1 = +z, 2 = -x, 3 = -z
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const DIR_WINKEL = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];

// ================= SPIELSTAND =================
function neuerStand() {
  return {
    lager: { ...START_LAGER }, erz: { eisen: 0, kupfer: 0 }, geliefert: { eisen: 0, kupfer: 0 },
    kills: 0, meilenstein: 0, welle: 0, welleT: ERSTE_WELLE, gegnerAn: true, bauten: [],
  };
}
let stand = neuerStand();
try {
  const s = JSON.parse(localStorage.getItem(SPEICHER_NAME));
  if (s && s.lager) stand = Object.assign(neuerStand(), s);
} catch (e) { /* kein Spielstand */ }

// ================= SZENE =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const szene = new THREE.Scene();
szene.background = new THREE.Color(0x9fd3ff);
szene.fog = new THREE.Fog(0x9fd3ff, 55, 140);
const kamera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 300);

szene.add(new THREE.HemisphereLight(0xffffff, 0x557744, 1.3));
const sonne = new THREE.DirectionalLight(0xffffff, 2.2);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 120 });
szene.add(sonne, sonne.target);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
});

function leinwand(b, h) { const c = document.createElement('canvas'); c.width = b; c.height = h; return [c, c.getContext('2d')]; }

// Gras-Boden mit Kästchen (ein Kästchen = ein Bau-Feld)
const RAND = WELT * G + 20;
{
  const [c, g] = leinwand(128, 128);
  g.fillStyle = '#6fbf4f'; g.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 300; k++) { g.fillStyle = Math.random() < 0.5 ? '#66b347' : '#7acb5a'; g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
  g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.repeat.set(RAND, RAND); t.offset.set(0.5, 0.5);
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(RAND * 2, RAND * 2), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
  boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true;
  szene.add(boden);
}

// Förderband-Textur mit Pfeilen (bewegt sich!)
const bandTextur = (() => {
  const [c, g] = leinwand(64, 64);
  g.fillStyle = '#2b2b30'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#f2b705'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(12, 18); g.lineTo(32, 42); g.lineTo(52, 18); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1, 2);
  return t;
})();

// ================= MATERIALIEN =================
const mat = (farbe, extra = {}) => new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.7, ...extra });
const MAT = {
  grau: mat(0x6c7380), dunkel: mat(0x33363d), gelb: mat(0xf2b705), rot: mat(0xd6402e), blau: mat(0x2a6fdb),
  ziegel: mat(0x9b3b2b), metall: mat(0xb8c0c8, { metalness: 0.7, roughness: 0.3 }), gruen: mat(0x3ddc84, { emissive: 0x1a8a4a, emissiveIntensity: 0.6 }),
  fels: mat(0x7d7a76, { flatShading: true }), band: new THREE.MeshStandardMaterial({ map: bandTextur, roughness: 0.9 }),
  holz: mat(0x7a5232), blatt: mat(0x2f8f3a, { flatShading: true }),
};
const ITEMS = {
  eisenerz:     { mat: mat(0x8a4b3a, { flatShading: true }), barren: false, metall: 'eisen' },
  kupfererz:    { mat: mat(0xc0702b, { flatShading: true }), barren: false, metall: 'kupfer' },
  eisenbarren:  { mat: mat(0xd0d6dc, { metalness: 0.8, roughness: 0.3 }), barren: true, metall: 'eisen' },
  kupferbarren: { mat: mat(0xe8894a, { metalness: 0.8, roughness: 0.3 }), barren: true, metall: 'kupfer' },
};
const ERZ_GEO = new THREE.DodecahedronGeometry(0.22);
const BARREN_GEO = new THREE.BoxGeometry(0.5, 0.18, 0.28);
function itemMesh(art) {
  const m = new THREE.Mesh(ITEMS[art].barren ? BARREN_GEO : ERZ_GEO, ITEMS[art].mat);
  m.castShadow = true; szene.add(m); return m;
}

function kasten(b, h, t, m, x = 0, y = 0, z = 0) {
  const k = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), m);
  k.position.set(x, y, z); k.castShadow = k.receiveShadow = true; return k;
}
function rohr(r1, r2, h, m, x = 0, y = 0, z = 0, seg = 14) {
  const k = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
  k.position.set(x, y, z); k.castShadow = k.receiveShadow = true; return k;
}
function schild(text, farbe = '#ffd166') {
  const [c, g] = leinwand(256, 96);
  g.fillStyle = 'rgba(20,25,45,0.85)'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = farbe; g.font = 'bold 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t }));
  s.scale.set(2.4, 0.9, 1); return s;
}

// ================= WELT: Erz-Felsen + Deko =================
const zellen = new Map();          // "i,j" -> Gebäude
const erzFelsen = new Map();       // "i,j" -> { art, schlaege }
const key = (i, j) => i + ',' + j;
const zelleVon = x => Math.round(x / G);

for (const [art, i, j] of ERZ_ORTE) {
  const grp = new THREE.Group();
  grp.position.set(i * G, 0, j * G);
  const fels = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9), MAT.fels);
  fels.scale.set(1.1, 0.35, 1.1); fels.position.y = 0.1; fels.receiveShadow = true; grp.add(fels);
  const kmat = mat(art === 'eisen' ? 0xb5553a : 0xff8c3a, { emissive: art === 'eisen' ? 0x401008 : 0x6a2c00, flatShading: true });
  for (let k = 0; k < 6; k++) {
    const kr = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + Math.random() * 0.15), kmat);
    const w = k / 6 * Math.PI * 2;
    kr.position.set(Math.cos(w) * 0.5, 0.35, Math.sin(w) * 0.5); kr.rotation.set(Math.random(), Math.random(), Math.random());
    kr.scale.y = 1.8; kr.castShadow = true; grp.add(kr);
  }
  szene.add(grp);
  erzFelsen.set(key(i, j), { art, schlaege: 0 });
}
// Bäume und Steine am Rand (nur Deko)
for (let k = 0; k < 90; k++) {
  const w = Math.random() * Math.PI * 2, r = WELT * G * (0.75 + Math.random() * 0.45);
  const x = Math.cos(w) * r, z = Math.sin(w) * r;
  if (Math.random() < 0.7) {
    const s = 0.8 + Math.random() * 0.8;
    szene.add(rohr(0.2 * s, 0.3 * s, 2 * s, MAT.holz, x, s, z, 7));
    const krone = new THREE.Mesh(new THREE.ConeGeometry(1.4 * s, 3 * s, 7), MAT.blatt);
    krone.position.set(x, 3.2 * s, z); krone.castShadow = true; szene.add(krone);
  } else {
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random()), MAT.fels);
    st.position.set(x, 0.2, z); st.castShadow = true; szene.add(st);
  }
}

// ================= GEBÄUDE-MODELLE =================
function bauModell(typ) {
  const g = new THREE.Group();
  if (typ === 'bohrer') {
    g.add(kasten(1.8, 0.5, 1.8, MAT.grau, 0, 0.25, 0));
    g.add(kasten(1.1, 2.2, 1.1, MAT.gelb, 0, 1.5, 0));
    g.add(kasten(1.3, 0.3, 1.3, MAT.dunkel, 0, 2.75, 0));
    g.add(kasten(0.6, 0.35, 0.5, MAT.dunkel, 0, 0.6, 0.85)); // Ausgang
    const d = new THREE.Group(); d.position.y = 3.0;
    d.add(kasten(1.0, 0.15, 0.2, MAT.rot)); d.add(kasten(0.2, 0.15, 1.0, MAT.rot));
    g.add(d); g.userData.dreh = d;
  } else if (typ === 'band') {
    g.add(kasten(1.4, 0.2, 2, MAT.dunkel, 0, 0.1, 0));
    const oben = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2), MAT.band);
    oben.rotation.x = -Math.PI / 2; oben.position.y = 0.21; oben.receiveShadow = true;
    g.add(oben);
    g.add(kasten(0.1, 0.3, 2, MAT.gelb, 0.66, 0.2, 0)); g.add(kasten(0.1, 0.3, 2, MAT.gelb, -0.66, 0.2, 0));
  } else if (typ === 'schmelze') {
    g.add(kasten(1.8, 1.8, 1.8, MAT.ziegel, 0, 0.9, 0));
    g.add(kasten(1.9, 0.2, 1.9, MAT.dunkel, 0, 1.9, 0));
    g.add(rohr(0.25, 0.3, 1.4, MAT.dunkel, 0.45, 2.6, -0.45));
    const glut = mat(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 0.3 });
    g.add(kasten(0.9, 0.5, 0.06, glut, 0, 1.15, 0.91));
    g.add(kasten(0.6, 0.35, 0.5, MAT.dunkel, 0, 0.3, 0.95)); // Ausgang
    g.userData.glut = glut;
  } else if (typ === 'hub') {
    g.add(kasten(1.9, 2.6, 1.9, MAT.blau, 0, 1.3, 0));
    g.add(kasten(2.1, 0.2, 2.1, MAT.gelb, 0, 2.7, 0));
    g.add(rohr(0.05, 0.05, 1.2, MAT.metall, 0, 3.4, 0));
    const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.15), mat(0xff3030, { emissive: 0xff0000, emissiveIntensity: 1 }));
    lampe.position.y = 4.05; g.add(lampe);
    for (let k = 0; k < 4; k++) { // Einwurf-Klappen
      const kl = kasten(0.8, 0.5, 0.08, MAT.dunkel, 0, 0.5, 0.96);
      const h = new THREE.Group(); h.rotation.y = k * Math.PI / 2; h.add(kl); g.add(h);
    }
    const s = schild('HUB'); s.position.y = 4.8; g.add(s);
  } else if (typ === 'schleuder') {
    g.add(rohr(0.85, 0.95, 0.3, MAT.dunkel, 0, 0.15, 0));
    g.add(rohr(0.72, 0.72, 0.06, MAT.gruen, 0, 0.31, 0));
    const pfeil = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 3), MAT.gelb);
    pfeil.rotation.x = Math.PI / 2; pfeil.position.set(0, 0.38, 0.25); pfeil.scale.z = 0.2; g.add(pfeil);
  } else if (typ === 'turm') {
    g.add(rohr(0.7, 0.8, 0.5, MAT.grau, 0, 0.25, 0));
    g.add(rohr(0.2, 0.2, 1.8, MAT.metall, 0, 1.4, 0));
    const kopf = new THREE.Group(); kopf.position.y = 2.4;
    kopf.add(kasten(0.8, 0.6, 0.8, MAT.rot));
    const lauf = rohr(0.14, 0.14, 0.9, MAT.dunkel, 0, 0, 0.6); lauf.rotation.x = Math.PI / 2; kopf.add(lauf);
    g.add(kopf); g.userData.kopf = kopf;
  }
  return g;
}

// ================= GEBÄUDE: bauen, abreißen, Logik =================
let gebaeude = [];
const nachbarZelle = b => zellen.get(key(b.i + DIRS[b.dir][0], b.j + DIRS[b.dir][1]));

function bauen(typ, i, j, dir) {
  const info = GEBAEUDE[typ];
  const b = {
    typ, i, j, dir, hp: 10, t: 0, puffer: [], ein: [], items: [], cd: 0, wackel: 0,
    x: i * G, z: j * G, hoehe: info.hoehe,
    box: { x1: i * G - info.halb, x2: i * G + info.halb, z1: j * G - info.halb, z2: j * G + info.halb, y2: info.hoehe },
  };
  b.gruppe = bauModell(typ);
  b.gruppe.position.set(b.x, 0, b.z);
  b.gruppe.rotation.y = DIR_WINKEL[dir];
  szene.add(b.gruppe);
  zellen.set(key(i, j), b);
  gebaeude.push(b);
  if (typ === 'bohrer') b.erz = erzFelsen.get(key(i, j)).art + 'erz';
  return b;
}

function abreissen(b, zurueckgeben) {
  for (const it of b.items) szene.remove(it.mesh);
  szene.remove(b.gruppe);
  zellen.delete(key(b.i, b.j));
  gebaeude = gebaeude.filter(x => x !== b);
  if (zurueckgeben) for (const [m, n] of Object.entries(GEBAEUDE[b.typ].kosten)) stand.lager[m] += n;
  puff(b.x, 1, b.z, 0x888888, 14);
}

// Kann das Gebäude "ziel" das Item "art" annehmen? richtung = in welche Richtung das Item fährt
function nimm(ziel, art, richtung) {
  if (ziel.typ === 'band') {
    if (ziel.dir === (richtung + 2) % 4) return false;          // Band zeigt genau zurück
    const letztes = ziel.items[ziel.items.length - 1];
    if (letztes && letztes.p < 0.34) return false;              // kein Platz
    ziel.items.push({ art, p: 0, mesh: itemMesh(art) });
    return true;
  }
  if (ziel.typ === 'schmelze') {
    if (ITEMS[art].barren || ziel.ein.length >= 4) return false;
    ziel.ein.push(art); return true;
  }
  if (ziel.typ === 'hub') { liefern(art); return true; }
  return false;
}

function ausgeben(b) {
  if (!b.puffer.length) return;
  const z = nachbarZelle(b);
  if (z && nimm(z, b.puffer[0], b.dir)) b.puffer.shift();
}

let plingT = 0;
function liefern(art) {
  const m = ITEMS[art].metall;
  if (ITEMS[art].barren) { stand.lager[m]++; stand.geliefert[m]++; }
  else {
    stand.erz[m]++;
    if (stand.erz[m] >= 3) { stand.erz[m] -= 3; stand.lager[m]++; stand.geliefert[m]++; }
  }
  if (plingT <= 0) { SOUND.pling(); plingT = 0.15; }
}

function gebaeudeUpdate(b, dt) {
  if (b.wackel > 0) b.wackel -= dt;
  if (b.typ === 'band') {
    const [dx, dz] = DIRS[b.dir];
    for (let k = 0; k < b.items.length; k++) {
      const it = b.items[k];
      const grenze = k === 0 ? 1 : b.items[k - 1].p - 0.34;
      it.p = Math.min(it.p + BAND_TEMPO * dt, Math.max(it.p, grenze));
      it.mesh.position.set(b.x + dx * (it.p - 0.5) * G, 0.42, b.z + dz * (it.p - 0.5) * G);
    }
    const vorne = b.items[0];
    if (vorne && vorne.p >= 1) {
      const z = nachbarZelle(b);
      if (z && nimm(z, vorne.art, b.dir)) { szene.remove(vorne.mesh); b.items.shift(); }
    }
  } else if (b.typ === 'bohrer') {
    b.arbeitet = b.puffer.length < 3;
    if (b.arbeitet) { b.t += dt; if (b.t >= BOHR_ZEIT) { b.t = 0; b.puffer.push(b.erz); } }
    ausgeben(b);
  } else if (b.typ === 'schmelze') {
    b.arbeitet = b.ein.length > 0 && b.puffer.length < 4;
    if (b.arbeitet) {
      b.t += dt;
      if (b.t >= SCHMELZ_ZEIT) { b.t = 0; b.puffer.push(b.ein.shift() === 'eisenerz' ? 'eisenbarren' : 'kupferbarren'); }
    }
    ausgeben(b);
  } else if (b.typ === 'turm') {
    b.cd -= dt;
    let bester = null, bd = 22;
    for (const g of gegner) {
      if (g.tot) continue;
      const d = Math.hypot(g.pos.x - b.x, g.pos.z - b.z);
      if (d < bd) { bd = d; bester = g; }
    }
    if (bester) {
      const start = new THREE.Vector3(b.x, 2.4, b.z);
      const zielP = bester.mitte();
      const flug = start.distanceTo(zielP) / BALL_TEMPO;
      zielP.y += 0.5 * BALL_SCHWERKRAFT * flug * flug;          // etwas höher zielen, weil der Ball runterfällt
      const richtung = zielP.sub(start).normalize();
      b.gruppe.userData.kopf.rotation.y = Math.atan2(richtung.x, richtung.z) - b.gruppe.rotation.y;
      if (b.cd <= 0) { b.cd = 0.9; ballSchiessen(start.addScaledVector(richtung, 0.9), richtung); }
    }
  }
}

// ================= RAGDOLL-FIGUR =================
// Jede Figur hat 13 Punkte. Beim Laufen setzen wir die Punkte selbst (Animation),
// beim Ragdoll rechnet die Physik: Punkte fallen, und "Knochen" halten sie zusammen.
const TEILE = ['kopf', 'lS', 'rS', 'lH', 'rH', 'lE', 'lHa', 'rE', 'rHa', 'lK', 'lF', 'rK', 'rF'];
const I = Object.fromEntries(TEILE.map((n, k) => [n, k]));
const RUHE = { // [seitlich, hoch, vorne]
  kopf: [0, 1.68, 0], lS: [-0.22, 1.42, 0], rS: [0.22, 1.42, 0], lH: [-0.13, 0.92, 0], rH: [0.13, 0.92, 0],
  lE: [-0.3, 1.14, 0], lHa: [-0.32, 0.86, 0.04], rE: [0.3, 1.14, 0], rHa: [0.32, 0.86, 0.04],
  lK: [-0.13, 0.5, 0.03], lF: [-0.13, 0.09, 0], rK: [0.13, 0.5, 0.03], rF: [0.13, 0.09, 0],
};
const KNOCHEN = [['kopf', 'lS'], ['kopf', 'rS'], ['lS', 'rS'], ['lH', 'rH'], ['lS', 'lH'], ['rS', 'rH'], ['lS', 'rH'], ['rS', 'lH'],
  ['lS', 'lE'], ['lE', 'lHa'], ['rS', 'rE'], ['rE', 'rHa'], ['lH', 'lK'], ['lK', 'lF'], ['rH', 'rK'], ['rK', 'rF']];
const MINDEST = [['lS', 'lHa', 0.22], ['rS', 'rHa', 0.22], ['lH', 'lF', 0.32], ['rH', 'rF', 0.32], ['lK', 'rK', 0.16],
  ['lF', 'rF', 0.14], ['kopf', 'lH', 0.62], ['kopf', 'rH', 0.62]];
const ruheAbstand = (a, b) => Math.hypot(RUHE[a][0] - RUHE[b][0], RUHE[a][1] - RUHE[b][1], RUHE[a][2] - RUHE[b][2]);

const AUSSEHEN = {
  spieler: { anzug: 0xff8c1a, hose: 0x34456b, haut: 0xf1c27d, helm: 0xffd23f, kopf: 'mensch' },
  roboter: { anzug: 0x8a8f99, hose: 0x5a5f69, haut: 0x6a6f79, helm: 0xff3030, kopf: 'roboter' },
  boss:    { anzug: 0x7d3fbf, hose: 0x3d2060, haut: 0x5a2d8a, helm: 0x39ff6a, kopf: 'roboter' },
};

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), Y_ACHSE = new THREE.Vector3(0, 1, 0);

class Figur {
  constructor(aussehen, s = 1) {
    this.s = s;
    this.p = TEILE.map(() => new THREE.Vector3());   // Punkte jetzt
    this.a = TEILE.map(() => new THREE.Vector3());   // Punkte vorher (daraus kommt das Tempo)
    this.rag = TEILE.map(() => new THREE.Vector3());
    this.rad = TEILE.map(n => (n === 'kopf' ? 0.22 : 0.1) * s);
    this.knochen = KNOCHEN.map(([a, b]) => [I[a], I[b], ruheAbstand(a, b) * s]);
    this.mindest = MINDEST.map(([a, b, m]) => [I[a], I[b], m * s]);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.phase = 0; this.amt = 0; this.aufBoden = true;
    this.modus = 'steht'; this.t = 0; this.blend = 0; this.arme = ''; this.schlag = 0; this.unverwundbar = 0;

    this.gruppe = new THREE.Group(); szene.add(this.gruppe);
    const mA = mat(aussehen.anzug), mH = mat(aussehen.hose), mK = mat(aussehen.haut), mHelm = mat(aussehen.helm, aussehen.kopf === 'roboter' ? { emissive: aussehen.helm, emissiveIntensity: 1 } : {});
    this.glieder = [];
    const glied = (a, b, r, m) => {
      const len = ruheAbstand(a, b) * s;
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r * s, len, 3, 8), m);
      mesh.castShadow = true; this.gruppe.add(mesh); this.glieder.push([I[a], I[b], mesh, len]);
    };
    glied('lS', 'lE', 0.075, mA); glied('lE', 'lHa', 0.07, mA); glied('rS', 'rE', 0.075, mA); glied('rE', 'rHa', 0.07, mA);
    glied('lH', 'lK', 0.1, mH); glied('lK', 'lF', 0.09, mH); glied('rH', 'rK', 0.1, mH); glied('rK', 'rF', 0.09, mH);
    this.kugeln = [];
    const kugel = (n, r, m) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r * s, 10, 8), m);
      mesh.castShadow = true; this.gruppe.add(mesh); this.kugeln.push([I[n], mesh]);
    };
    kugel('lHa', 0.09, mK); kugel('rHa', 0.09, mK); kugel('lF', 0.12, MAT.dunkel); kugel('rF', 0.12, MAT.dunkel);

    this.koerper = new THREE.Group();
    this.koerper.add(kasten(0.5 * s, 0.62 * s, 0.3 * s, mA));
    this.koerper.add(kasten(0.52 * s, 0.1 * s, 0.32 * s, mH, 0, -0.22 * s, 0)); // Gürtel
    if (aussehen.kopf === 'mensch') this.koerper.add(kasten(0.36 * s, 0.4 * s, 0.16 * s, mat(0x556b2f), 0, 0.02 * s, -0.22 * s)); // Rucksack
    this.kopf = new THREE.Group();
    if (aussehen.kopf === 'mensch') {
      this.kopf.add(new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 16, 12), mK));
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.23 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mHelm);
      helm.position.y = 0.03 * s; this.kopf.add(helm);
      this.kopf.add(rohr(0.27 * s, 0.27 * s, 0.03 * s, mHelm, 0, 0.03 * s, 0.03 * s, 16));
      for (const x of [-0.07, 0.07]) {
        const auge = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 8, 6), MAT.dunkel);
        auge.position.set(x * s, -0.02 * s, 0.18 * s); this.kopf.add(auge);
      }
    } else {
      this.kopf.add(kasten(0.38 * s, 0.32 * s, 0.34 * s, mK));
      this.kopf.add(kasten(0.3 * s, 0.08 * s, 0.03 * s, mHelm, 0, 0.02 * s, 0.17 * s)); // leuchtende Augen
      this.kopf.add(rohr(0.02 * s, 0.02 * s, 0.25 * s, MAT.metall, 0, 0.28 * s, 0, 6));
      const spitze = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s), mHelm); spitze.position.y = 0.42 * s; this.kopf.add(spitze);
    }
    for (const t of [this.koerper, this.kopf]) { t.traverse(o => { o.castShadow = true; }); this.gruppe.add(t); }
  }

  mitte() { // Mitte vom Bauch
    return new THREE.Vector3().add(this.p[I.lS]).add(this.p[I.rS]).add(this.p[I.lH]).add(this.p[I.rH]).multiplyScalar(0.25);
  }
  tempo() { // wie schnell fliegt der Bauch (m/s)
    return _a.copy(this.p[I.lS]).add(this.p[I.rH]).sub(this.a[I.lS]).sub(this.a[I.rH]).multiplyScalar(0.5 / DT);
  }

  // Animation: Punkte aus Position, Blickrichtung und Lauf-Schritt ausrechnen
  pose() {
    const L = {}; for (const n of TEILE) L[n] = RUHE[n].slice();
    const amt = this.amt, sw = Math.sin(this.phase) * amt, cw = Math.cos(this.phase);
    L.lF[2] += sw * 0.42; L.lF[1] += Math.max(0, cw) * 0.16 * amt;
    L.rF[2] -= sw * 0.42; L.rF[1] += Math.max(0, -cw) * 0.16 * amt;
    L.lK[2] += sw * 0.22 + 0.05 * amt; L.rK[2] += -sw * 0.22 + 0.05 * amt;
    L.lHa[2] -= sw * 0.3; L.lE[2] -= sw * 0.12; L.rHa[2] += sw * 0.3; L.rE[2] += sw * 0.12;
    if (!this.aufBoden) {
      L.lK[2] += 0.2; L.lK[1] += 0.1; L.lF[1] += 0.15; L.rK[2] += 0.15; L.rF[1] += 0.2;
      L.lHa[1] += 0.35; L.rHa[1] += 0.35; L.lE[1] += 0.15; L.rE[1] += 0.15;
    }
    if (this.arme === 'vor') { L.lE = [-0.24, 1.36, 0.28]; L.lHa = [-0.2, 1.38, 0.56]; L.rE = [0.24, 1.36, 0.28]; L.rHa = [0.2, 1.38, 0.56]; }
    if (this.arme === 'hoch') { L.lE = [-0.28, 1.68, 0.05]; L.lHa = [-0.22, 1.95, 0.12]; L.rE = [0.28, 1.68, 0.05]; L.rHa = [0.22, 1.95, 0.12]; }
    if (this.arme === 'zielen') { L.rE = [0.26, 1.34, 0.28]; L.rHa = [0.22, 1.38, 0.56]; }
    if (this.schlag > 0) { const k = this.schlag; L.rE = [0.2, 1.4, 0.28 + 0.12 * k]; L.rHa = [0.14, 1.42, 0.56 + 0.15 * k]; }
    const s = this.s, rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw), fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    TEILE.forEach((n, k) => {
      const [x, y, z] = L[n];
      this.p[k].set(this.pos.x + (rx * x + fx * z) * s, this.pos.y + y * s, this.pos.z + (rz * x + fz * z) * s);
    });
  }

  umfallen(vx, vy, vz) {
    if (this.modus !== 'ragdoll') { this.modus = 'ragdoll'; this.t = 0; }
    for (let k = 0; k < 13; k++) {
      const extra = k === I.kopf ? 1.4 : (k >= I.lK ? 0.6 : 1);   // Kopf fliegt mehr als die Füße -> Salto!
      this.a[k].x -= (vx * extra + (Math.random() - 0.5) * 2) * DT;
      this.a[k].y -= (vy + (Math.random() - 0.5) * 2) * DT;
      this.a[k].z -= (vz * extra + (Math.random() - 0.5) * 2) * DT;
    }
  }

  simulieren() {
    const p = this.p, a = this.a, grenze = WELT * G + 8;
    for (let k = 0; k < 13; k++) {
      const vx = (p[k].x - a[k].x) * 0.995, vy = (p[k].y - a[k].y) * 0.995 - SCHWERKRAFT * DT * DT, vz = (p[k].z - a[k].z) * 0.995;
      a[k].copy(p[k]);
      p[k].x += vx; p[k].y += vy; p[k].z += vz;
      const r = this.rad[k];
      if (p[k].y < r) { // Boden: abprallen + bremsen
        p[k].y = r;
        a[k].y = r + vy * 0.4;
        a[k].x = p[k].x - vx * 0.82; a[k].z = p[k].z - vz * 0.82;
      }
    }
    const m = this.mitte(), boxen = boxenNahe(m.x, m.z);
    for (let it = 0; it < 8; it++) {
      for (const [i, j, len] of this.knochen) abstandHalten(p[i], p[j], len, false);
      for (const [i, j, min] of this.mindest) abstandHalten(p[i], p[j], min, true);
      for (let k = 0; k < 13; k++) {
        const q = p[k], r = this.rad[k];
        if (q.y < r) q.y = r;
        q.x = Math.max(-grenze, Math.min(grenze, q.x)); q.z = Math.max(-grenze, Math.min(grenze, q.z));
        for (const bx of boxen) {
          if (q.x < bx.x1 - r || q.x > bx.x2 + r || q.z < bx.z1 - r || q.z > bx.z2 + r || q.y > bx.y2 + r) continue;
          const d = [q.x - (bx.x1 - r), bx.x2 + r - q.x, q.z - (bx.z1 - r), bx.z2 + r - q.z, bx.y2 + r - q.y];
          const min = Math.min(...d);
          if (min === d[0]) q.x -= d[0]; else if (min === d[1]) q.x += d[1];
          else if (min === d[2]) q.z -= d[2]; else if (min === d[3]) q.z += d[3];
          else { q.y += d[4]; a[k].x += (q.x - a[k].x) * 0.1; a[k].z += (q.z - a[k].z) * 0.1; }
        }
      }
    }
  }

  update(dt) {
    if (this.unverwundbar > 0) this.unverwundbar -= dt;
    this.schlag = Math.max(0, this.schlag - dt * 4);
    if (this.modus === 'ragdoll') {
      this.simulieren();
      this.t += dt;
      if (this.tot) return;
      let ruhig = true;
      for (let k = 0; k < 13; k++) if (this.p[k].distanceToSquared(this.a[k]) > 0.0009) { ruhig = false; break; }
      if ((this.t > 1.6 && ruhig) || this.t > 6) this.aufstehen();
      return;
    }
    for (let k = 0; k < 13; k++) this.a[k].copy(this.p[k]);
    const tempo = Math.hypot(this.vel.x, this.vel.z);
    this.phase += tempo * dt * 2.8 / this.s;
    this.amt += (Math.min(1, tempo / 4) - this.amt) * Math.min(1, dt * 10);
    if (this.modus === 'aufstehen') {
      this.blend += dt / 0.45;
      this.pose();
      const e = Math.min(1, this.blend), w = e * e * (3 - 2 * e);
      for (let k = 0; k < 13; k++) this.p[k].lerpVectors(this.rag[k], this.p[k], w);
      if (this.blend >= 1) this.modus = 'steht';
    } else this.pose();
  }

  aufstehen() {
    const mx = (this.p[I.lH].x + this.p[I.rH].x) / 2, mz = (this.p[I.lH].z + this.p[I.rH].z) / 2;
    const r = _b.subVectors(this.p[I.rS], this.p[I.lS]);
    if (Math.hypot(r.x, r.z) > 0.05) this.yaw = Math.atan2(r.z, -r.x);
    this.pos.set(mx, 0, mz);
    this.pos.y = bodenHoehe(mx, mz, 3);
    this.vel.set(0, 0, 0); this.aufBoden = true;
    for (let k = 0; k < 13; k++) this.rag[k].copy(this.p[k]);
    this.modus = 'aufstehen'; this.blend = 0; this.unverwundbar = 1.2;
  }

  sofortStehen() {
    this.modus = 'steht'; this.vel.set(0, 0, 0); this.pose();
    for (let k = 0; k < 13; k++) this.a[k].copy(this.p[k]);
  }

  zeichnen() {
    const p = this.p;
    for (const [i, j, mesh, len] of this.glieder) {
      mesh.position.addVectors(p[i], p[j]).multiplyScalar(0.5);
      _a.subVectors(p[j], p[i]);
      const l = _a.length();
      if (l > 1e-4) mesh.quaternion.setFromUnitVectors(Y_ACHSE, _a.divideScalar(l));
      mesh.scale.y = Math.max(0.3, l / len);
    }
    for (const [i, mesh] of this.kugeln) mesh.position.copy(p[i]);
    const mS = _a.addVectors(p[I.lS], p[I.rS]).multiplyScalar(0.5), mH = _b.addVectors(p[I.lH], p[I.rH]).multiplyScalar(0.5);
    const oben = _c.subVectors(mS, mH).normalize();
    const rechts = _d.subVectors(p[I.rS], p[I.lS]); rechts.addScaledVector(oben, -rechts.dot(oben)).normalize();
    const vorn = _e.crossVectors(oben, rechts);
    _m4.makeBasis(rechts.negate(), oben, vorn);
    this.koerper.quaternion.setFromRotationMatrix(_m4);
    this.koerper.position.addVectors(mS, mH).multiplyScalar(0.5);
    this.kopf.quaternion.copy(this.koerper.quaternion);
    this.kopf.position.copy(p[I.kopf]);
  }

  entfernen() { szene.remove(this.gruppe); }
}

function abstandHalten(p, q, soll, nurMindest) {
  const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
  if (nurMindest && d >= soll) return;
  const k = (d - soll) / d * 0.5;
  p.x += dx * k; p.y += dy * k; p.z += dz * k;
  q.x -= dx * k; q.y -= dy * k; q.z -= dz * k;
}

// ================= LAUFEN + ZUSAMMENSTÖSSE =================
function boxenNahe(x, z) {
  const ci = zelleVon(x), cj = zelleVon(z), liste = [];
  for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
    const b = zellen.get(key(i, j)); if (b) liste.push(b.box);
  }
  return liste;
}
function bodenHoehe(x, z, y) {
  const b = zellen.get(key(zelleVon(x), zelleVon(z)));
  if (b && x > b.box.x1 && x < b.box.x2 && z > b.box.z1 && z < b.box.z2 && b.box.y2 <= y + 0.45) return b.box.y2;
  return 0;
}

function koerperBewegen(f, wx, wz, dt, springen) {
  const k = f.aufBoden ? 12 : 3;
  f.vel.x += (wx - f.vel.x) * Math.min(1, k * dt);
  f.vel.z += (wz - f.vel.z) * Math.min(1, k * dt);
  if (springen && f.aufBoden) { f.vel.y = SPRUNG_KRAFT; f.aufBoden = false; }
  f.vel.y -= SCHWERKRAFT * dt;
  // Förderbänder nehmen dich mit!
  let bx = 0, bz = 0;
  const unter = zellen.get(key(zelleVon(f.pos.x), zelleVon(f.pos.z)));
  if (f.aufBoden && unter && unter.typ === 'band' && f.pos.y > 0.2) {
    bx = DIRS[unter.dir][0] * BAND_TEMPO * G; bz = DIRS[unter.dir][1] * BAND_TEMPO * G;
  }
  f.pos.x += (f.vel.x + bx) * dt; f.pos.z += (f.vel.z + bz) * dt; f.pos.y += f.vel.y * dt;
  // Wände von Gebäuden
  const r = 0.35 * f.s;
  for (const bx2 of boxenNahe(f.pos.x, f.pos.z)) {
    if (bx2.y2 <= f.pos.y + 0.45) continue;
    const cx = Math.max(bx2.x1, Math.min(bx2.x2, f.pos.x)), cz = Math.max(bx2.z1, Math.min(bx2.z2, f.pos.z));
    let dx = f.pos.x - cx, dz = f.pos.z - cz, d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 1e-5) { // ganz drin: zur nächsten Seite raus
      const w = [f.pos.x - bx2.x1, bx2.x2 - f.pos.x, f.pos.z - bx2.z1, bx2.z2 - f.pos.z], m = Math.min(...w);
      if (m === w[0]) f.pos.x = bx2.x1 - r; else if (m === w[1]) f.pos.x = bx2.x2 + r;
      else if (m === w[2]) f.pos.z = bx2.z1 - r; else f.pos.z = bx2.z2 + r;
    } else { f.pos.x += dx / d * (r - d); f.pos.z += dz / d * (r - d); }
  }
  const grenze = WELT * G;
  f.pos.x = Math.max(-grenze, Math.min(grenze, f.pos.x)); f.pos.z = Math.max(-grenze, Math.min(grenze, f.pos.z));
  const boden = bodenHoehe(f.pos.x, f.pos.z, f.pos.y);
  if (f.pos.y <= boden) { f.pos.y = boden; if (f.vel.y < 0) f.vel.y = 0; f.aufBoden = true; }
  else f.aufBoden = false;
}

function schleuderCheck(f) {
  if (!f.aufBoden || f.modus !== 'steht') return;
  const b = zellen.get(key(zelleVon(f.pos.x), zelleVon(f.pos.z)));
  if (!b || b.typ !== 'schleuder' || f.pos.y < 0.2 || b.cd > zeit) return;
  b.cd = zeit + 0.4;
  f.pos.y += 0.3;
  f.sofortStehen();
  f.umfallen(DIRS[b.dir][0] * 11, 19, DIRS[b.dir][1] * 11);
  SOUND.wusch();
}

// ================= SPIELER =================
const spieler = new Figur(AUSSEHEN.spieler, 1);
spieler.hp = SPIELER_LEBEN;
spieler.pos.set(0, 0, G * 1.5);
spieler.sofortStehen();
let kamYaw = 0, kamPitch = -0.25, schussCD = 0, zeit = 0, getroffenT = 0;

function spielerUpdate(dt) {
  const f = spieler;
  schussCD -= dt; getroffenT -= dt;
  if (f.modus === 'steht') {
    const fx = Math.sin(kamYaw), fz = Math.cos(kamYaw), rx = -Math.cos(kamYaw), rz = Math.sin(kamYaw);
    const vor = (taste.KeyW ? 1 : 0) - (taste.KeyS ? 1 : 0), seit = (taste.KeyD ? 1 : 0) - (taste.KeyA ? 1 : 0);
    let wx = fx * vor + rx * seit, wz = fz * vor + rz * seit;
    const l = Math.hypot(wx, wz), tempo = (taste.ShiftLeft || taste.ShiftRight) ? RENN_TEMPO : LAUF_TEMPO;
    if (l > 0) { wx = wx / l * tempo; wz = wz / l * tempo; }
    koerperBewegen(f, wx, wz, dt, taste.Space);
    f.yaw = winkelNaeher(f.yaw, kamYaw, dt * 14);
    f.arme = werkzeug === 'hand' ? 'zielen' : '';
    schleuderCheck(f);
  }
  f.update(dt);
  if (f.hp <= 0 && (f.modus !== 'ragdoll' || f.t > 2.5)) { // umgehauen -> am HUB wieder aufwachen
    f.hp = SPIELER_LEBEN; f.pos.set(0, 0, G * 1.5); f.yaw = 0; f.sofortStehen(); f.unverwundbar = 2;
    meldung('💫 Du wachst am HUB wieder auf');
  }
  if (f.hp > 0 && getroffenT < -4) f.hp = Math.min(SPIELER_LEBEN, f.hp + 4 * dt);
}

function spielerGetroffen(von, schaden, staerke) {
  const f = spieler;
  if (f.modus !== 'steht' || f.unverwundbar > 0 || f.hp <= 0) return;
  let dx = f.pos.x - von.x, dz = f.pos.z - von.z; const d = Math.hypot(dx, dz) || 1;
  f.hp = Math.max(0, f.hp - schaden);
  f.umfallen(dx / d * staerke, 6 + staerke * 0.3, dz / d * staerke);
  getroffenT = 0;
  SOUND.boing();
  rotBlitz();
  if (f.hp <= 0) meldung('😵 UMGEHAUEN!');
}

// ================= BÄLLE + SCHLAGEN =================
const BALL_SCHWERKRAFT = 12;
const BALL_GEO = new THREE.SphereGeometry(0.18, 12, 8);
const BALL_MATS = [0xff4fa3, 0xffe14f, 0x4fd8ff, 0x8aff4f].map(c => mat(c, { roughness: 0.3, emissive: c, emissiveIntensity: 0.25 }));
let baelle = [];

function ballSchiessen(start, richtung) {
  const m = new THREE.Mesh(BALL_GEO, BALL_MATS[Math.floor(Math.random() * 4)]);
  m.castShadow = true; szene.add(m);
  baelle.push({ mesh: m, pos: start.clone(), vel: richtung.clone().multiplyScalar(BALL_TEMPO), t: 2.5, verbraucht: false });
}

function trifft(g, pos, r) {
  const m = g.mitte();
  if (m.distanceTo(pos) < 0.4 * g.s + r) return true;
  for (const q of g.p) if (q.distanceTo(pos) < 0.15 * g.s + r) return true;
  return false;
}

function baelleUpdate(dt) {
  for (const b of baelle) {
    b.vel.y -= BALL_SCHWERKRAFT * dt;
    b.pos.addScaledVector(b.vel, dt);
    if (b.pos.y < 0.18) { b.pos.y = 0.18; b.vel.y *= -0.6; b.vel.x *= 0.85; b.vel.z *= 0.85; }
    const geb = zellen.get(key(zelleVon(b.pos.x), zelleVon(b.pos.z)));
    if (geb && b.pos.y < geb.box.y2 && b.pos.x > geb.box.x1 && b.pos.x < geb.box.x2 && b.pos.z > geb.box.z1 && b.pos.z < geb.box.z2) {
      b.pos.addScaledVector(b.vel, -dt); b.vel.multiplyScalar(-0.4);
    }
    if (!b.verbraucht) {
      for (const g of gegner) {
        if (!trifft(g, b.pos, 0.18)) continue;
        const n = b.vel.clone().normalize();
        g.umfallen(n.x * 11, 5, n.z * 11);
        gegnerSchaden(g, 1);
        b.verbraucht = true; b.vel.multiplyScalar(-0.25);
        SOUND.klong();
        break;
      }
    }
    b.t -= dt;
    b.mesh.position.copy(b.pos);
    if (b.t <= 0) szene.remove(b.mesh);
  }
  baelle = baelle.filter(b => b.t > 0);
}

function schiessen() {
  if (schussCD > 0 || spieler.modus !== 'steht') return;
  schussCD = 0.28;
  const f = spieler, fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
  const start = new THREE.Vector3(f.pos.x + fx * 0.5 - Math.cos(f.yaw) * 0.25, f.pos.y + 1.4, f.pos.z + fz * 0.5 + Math.sin(f.yaw) * 0.25);
  const ziel = zielPunkt(80) || kamera.position.clone().addScaledVector(blickRichtung(), 80);
  const richtung = ziel.sub(start).normalize();
  richtung.y += 0.04; // ein bisschen hoch, weil Bälle fallen
  ballSchiessen(start, richtung.normalize());
  if (stand.meilenstein >= 3) { // Belohnung: 3 Bälle
    for (const w of [-0.08, 0.08]) ballSchiessen(start, richtung.clone().applyAxisAngle(Y_ACHSE, w));
  }
  SOUND.plopp();
}

function schlagen() {
  const f = spieler;
  if (f.modus !== 'steht' || f.schlag > 0.3) return;
  f.schlag = 1;
  const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
  let traf = false;
  for (const g of gegner) {
    const dx = g.pos.x - f.pos.x, dz = g.pos.z - f.pos.z, d = Math.hypot(dx, dz);
    const m = g.mitte();
    const dm = Math.hypot(m.x - f.pos.x, m.z - f.pos.z);
    if (Math.min(d, dm) > 2.3 || (dx * fx + dz * fz) / (d || 1) < 0.2) continue;
    g.umfallen(fx * 14, 8, fz * 14);
    gegnerSchaden(g, 2);
    traf = true;
  }
  // Erz mit der Faust abbauen
  const zi = zelleVon(f.pos.x + fx * 1.4), zj = zelleVon(f.pos.z + fz * 1.4);
  const erz = erzFelsen.get(key(zi, zj));
  if (!traf && erz && !zellen.get(key(zi, zj))) {
    erz.schlaege++;
    puff(zi * G, 0.5, zj * G, erz.art === 'eisen' ? 0xb5553a : 0xff8c3a, 5);
    if (erz.schlaege >= 3) {
      erz.schlaege = 0; stand.lager[erz.art]++;
      meldung(`+1 ${erz.art === 'eisen' ? 'Eisenbarren' : 'Kupferbarren'} (mit der Faust!)`, 1.2);
    }
    traf = true;
  }
  if (traf) SOUND.klong(); else SOUND.wusch();
}

// ================= GEGNER (Roboter) =================
let gegner = [];

function gegnerSpawnen(boss) {
  const w = (stand.welleWinkel ?? Math.random() * 6.28) + (Math.random() - 0.5) * 1.2, r = WELT * G - 3;
  const g = new Figur(boss ? AUSSEHEN.boss : AUSSEHEN.roboter, boss ? 1.6 : 1);
  g.boss = boss; g.hp = boss ? 12 : 3; g.tempo = boss ? 2.6 : 3.4; g.schaden = boss ? 30 : 12; g.staerke = boss ? 16 : 10;
  g.angriffT = -0.5;
  g.pos.set(Math.cos(w) * r, 0, Math.sin(w) * r);
  g.yaw = Math.atan2(-g.pos.x, -g.pos.z);
  g.sofortStehen();
  gegner.push(g);
}

function gegnerSchaden(g, n) {
  if (g.tot) return;
  g.hp -= n;
  if (g.hp > 0) return;
  g.tot = true; g.totT = 4;
  stand.kills++;
  const eisen = g.boss ? 6 : 1, kupfer = g.boss ? 4 : 1;
  stand.lager.eisen += eisen; stand.lager.kupfer += kupfer;
  meldung(`💥 Roboter kaputt! +${eisen} Eisen +${kupfer} Kupfer`, 1.5);
}

function gegnerUpdate(g, dt) {
  if (g.tot) {
    g.update(dt);
    g.totT -= dt;
    if (g.totT < 1) g.gruppe.position.y -= dt * 1.5;   // im Boden versinken
    if (g.totT <= 0) { puff(g.mitte().x, 0.5, g.mitte().z, 0x8a8f99, 10); g.entfernen(); g.weg = true; }
    return;
  }
  if (g.modus === 'steht') {
    const sp = spieler;
    let zx, zz, zielGeb = null, reichweite;
    const ds = Math.hypot(sp.pos.x - g.pos.x, sp.pos.z - g.pos.z);
    if (sp.hp > 0 && ds < 28) { zx = sp.pos.x; zz = sp.pos.z; reichweite = 1.3 * g.s; }
    else {
      let bd = Infinity;
      for (const b of gebaeude) {
        if (b.typ === 'band') continue;
        const cx = Math.max(b.box.x1, Math.min(b.box.x2, g.pos.x)), cz = Math.max(b.box.z1, Math.min(b.box.z2, g.pos.z));
        const d = Math.hypot(cx - g.pos.x, cz - g.pos.z);
        if (d < bd) { bd = d; zielGeb = b; zx = cx; zz = cz; }
      }
      reichweite = 0.55 * g.s + 0.4;
    }
    let wx = 0, wz = 0;
    if (zx !== undefined) {
      const dx = zx - g.pos.x, dz = zz - g.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.01) g.yaw = winkelNaeher(g.yaw, Math.atan2(dx, dz), dt * 6);
      if (d > reichweite) { wx = dx / d * g.tempo; wz = dz / d * g.tempo; g.angriffT = Math.min(g.angriffT, 0); }
      else g.angriffT += dt;
      if (g.angriffT >= 0.55) { // zuhauen!
        g.angriffT = -0.9;
        if (zielGeb) gebaeudeGetroffen(zielGeb);
        else if (d < reichweite + 0.5) spielerGetroffen(g.pos, g.schaden, g.staerke);
      }
    }
    g.arme = g.angriffT > 0 ? 'hoch' : 'vor';
    // Roboter schubsen sich gegenseitig weg
    for (const h of gegner) {
      if (h === g || h.tot || h.modus !== 'steht') continue;
      const dx = g.pos.x - h.pos.x, dz = g.pos.z - h.pos.z, d = Math.hypot(dx, dz), min = 0.4 * (g.s + h.s);
      if (d < min && d > 1e-4) { wx += dx / d * 3; wz += dz / d * 3; }
    }
    koerperBewegen(g, wx, wz, dt, false);
    schleuderCheck(g);
  }
  g.update(dt);
}

function gebaeudeGetroffen(b) {
  b.wackel = 0.3;
  SOUND.klong();
  if (b.typ === 'hub') { // der HUB geht nicht kaputt, aber Roboter klauen Barren
    if (stand.lager.eisen > 0) stand.lager.eisen--;
    meldung('⚠️ Roboter klauen am HUB!', 1);
    return;
  }
  b.hp--;
  if (b.hp <= 0) { meldung(`💥 Dein ${GEBAEUDE[b.typ].name} wurde kaputt gemacht!`); abreissen(b, false); speichern(); }
}

// Fliegende Ragdolls werfen andere um – wie Bowling!
function bowling() {
  const alle = [spieler, ...gegner];
  for (const f of alle) {
    if (f.modus !== 'ragdoll') continue;
    const v = f.tempo().clone();
    if (v.length() < 6) continue;
    const m = f.mitte();
    for (const h of alle) {
      if (h === f || h.modus !== 'steht' || h.tot) continue;
      if (Math.hypot(h.pos.x - m.x, h.pos.z - m.z) > 0.6 * (f.s + h.s) || m.y > h.pos.y + 2.2 * h.s) continue;
      if (h === spieler) { spielerGetroffen(m, 5, 8); continue; }
      h.umfallen(v.x * 0.7, 5, v.z * 0.7);
      gegnerSchaden(h, 1);
      SOUND.klong();
    }
  }
}

function wellenUpdate(dt) {
  if (!stand.gegnerAn) return;
  stand.welleT -= dt;
  if (stand.welleT > 0) return;
  stand.welle++;
  stand.welleT = WELLEN_PAUSE;
  stand.welleWinkel = Math.random() * Math.PI * 2;
  const anzahl = Math.min(2 + stand.welle, 14);
  for (let k = 0; k < anzahl && gegner.length < 25; k++) gegnerSpawnen(false);
  if (stand.welle % 5 === 0) gegnerSpawnen(true);
  meldung(`🤖 Welle ${stand.welle} kommt!${stand.welle % 5 === 0 ? ' Mit BOSS!' : ''}`, 3);
  SOUND.alarm();
}

// ================= PARTIKEL =================
const PUFF_GEO = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const puffMats = {};
let partikel = [];
function puff(x, y, z, farbe, n) {
  const m = puffMats[farbe] || (puffMats[farbe] = mat(farbe));
  for (let k = 0; k < n; k++) {
    const p = new THREE.Mesh(PUFF_GEO, m);
    p.position.set(x, y, z); szene.add(p);
    partikel.push({ mesh: p, v: new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 5, (Math.random() - 0.5) * 6), t: 0.8 });
  }
}
function partikelUpdate(dt) {
  for (const p of partikel) {
    p.v.y -= 15 * dt; p.mesh.position.addScaledVector(p.v, dt); p.t -= dt;
    p.mesh.rotation.x += dt * 8;
    if (p.t <= 0) szene.remove(p.mesh);
  }
  partikel = partikel.filter(p => p.t > 0);
}

// ================= BAUEN =================
let werkzeug = 'hand', drehung = 0, mausUnten = false, letzteZelle = null, letztesBand = null;

const geistGruen = new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.45, depthWrite: false });
const geistRot = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.45, depthWrite: false });
let geist = null, geistTyp = null;
const geistPfeil = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 4), geistGruen);
geistPfeil.rotation.x = Math.PI / 2;
const geistPfeilGruppe = new THREE.Group(); geistPfeilGruppe.add(geistPfeil); szene.add(geistPfeilGruppe);
const abrissKasten = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1, 2.05), geistRot); szene.add(abrissKasten);

function blickRichtung() {
  return new THREE.Vector3(Math.sin(kamYaw) * Math.cos(kamPitch), Math.sin(kamPitch), Math.cos(kamYaw) * Math.cos(kamPitch));
}
function zielPunkt(maxWeit) { // wo trifft der Blick (Fadenkreuz) den Boden?
  const d = blickRichtung();
  if (d.y > -0.01) return null;
  const t = -kamera.position.y / d.y;
  if (t > maxWeit) return null;
  return kamera.position.clone().addScaledVector(d, t);
}
function zielZelle() {
  const p = zielPunkt(60);
  if (!p || Math.hypot(p.x - spieler.pos.x, p.z - spieler.pos.z) > 24) return null;
  return [zelleVon(p.x), zelleVon(p.z)];
}
function bauRichtung() {
  const fx = Math.sin(kamYaw), fz = Math.cos(kamYaw);
  const d = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3);
  return (d + drehung) % 4;
}
function freigeschaltet(typ) { return stand.meilenstein >= (GEBAEUDE[typ].sperre || 0); }
function genugGeld(typ) { return Object.entries(GEBAEUDE[typ].kosten).every(([m, n]) => stand.lager[m] >= n); }
function kostenText(typ) {
  return Object.entries(GEBAEUDE[typ].kosten).map(([m, n]) => `${n} ${m === 'eisen' ? '⬜' : '🟧'}`).join(' ');
}

function bauProblem(typ, i, j) {
  if (!freigeschaltet(typ)) return `🔒 Erst Meilenstein ${GEBAEUDE[typ].sperre} schaffen`;
  if (Math.abs(i) > WELT - 2 || Math.abs(j) > WELT - 2) return 'Zu weit draußen';
  if (zellen.get(key(i, j))) return 'Da steht schon was';
  const erz = erzFelsen.get(key(i, j));
  if (typ === 'bohrer' && !erz) return 'Bohrer nur auf Erz-Felsen!';
  if (typ !== 'bohrer' && erz) return 'Hier ist ein Erz-Felsen – nur für Bohrer';
  if (GEBAEUDE[typ].hoehe > 1 && zelleVon(spieler.pos.x) === i && zelleVon(spieler.pos.z) === j) return 'Du stehst im Weg';
  if (!genugGeld(typ)) return 'Zu wenig Barren';
  return '';
}

function platzieren(typ, i, j, dir) {
  const problem = bauProblem(typ, i, j);
  if (problem) return problem;
  for (const [m, n] of Object.entries(GEBAEUDE[typ].kosten)) stand.lager[m] -= n;
  const b = bauen(typ, i, j, dir);
  puff(i * G, 0.3, j * G, 0xdddddd, 6);
  SOUND.bau();
  speicherT = 4;
  return b;
}

function bandZiehen() { // Band: Maus halten und ziehen = viele Bänder hintereinander
  const z = zielZelle();
  if (!z || (letzteZelle && z[0] === letzteZelle[0] && z[1] === letzteZelle[1])) return;
  let dir = bauRichtung();
  if (letzteZelle) {
    const di = z[0] - letzteZelle[0], dj = z[1] - letzteZelle[1];
    if (Math.abs(di) + Math.abs(dj) === 1) {
      dir = DIRS.findIndex(([a, b]) => a === di && b === dj);
      if (letztesBand && zellen.get(key(letzteZelle[0], letzteZelle[1])) === letztesBand) {
        letztesBand.dir = dir; letztesBand.gruppe.rotation.y = DIR_WINKEL[dir];
      }
    }
  }
  letzteZelle = z;
  const b = platzieren('band', z[0], z[1], dir);
  letztesBand = typeof b === 'object' ? b : null;
  if (typeof b === 'string' && b !== 'Da steht schon was') meldung(b, 1);
}

function klick() {
  if (werkzeug === 'hand') { schiessen(); return; }
  const z = zielZelle();
  if (!z) return;
  if (werkzeug === 'abriss') {
    const b = zellen.get(key(z[0], z[1]));
    if (!b) return;
    if (b.typ === 'hub') { meldung('Den HUB kann man nicht abreißen', 1.2); return; }
    abreissen(b, true); SOUND.klong(); speicherT = 4;
    return;
  }
  if (werkzeug === 'band') { letzteZelle = null; letztesBand = null; bandZiehen(); return; }
  const b = platzieren(werkzeug, z[0], z[1], bauRichtung());
  if (typeof b === 'string') meldung(b, 1.2);
}

function geistUpdate() {
  const typ = GEBAEUDE[werkzeug] ? werkzeug : null;
  if (typ !== geistTyp) {
    if (geist) szene.remove(geist);
    geist = typ ? bauModell(typ) : null;
    if (geist) { geist.traverse(o => { if (o.isMesh) { o.material = geistGruen; o.castShadow = false; } }); szene.add(geist); }
    geistTyp = typ;
  }
  const z = (typ || werkzeug === 'abriss') ? zielZelle() : null;
  abrissKasten.visible = false; geistPfeilGruppe.visible = false;
  let tipp = '';
  if (werkzeug === 'hand') {
    const fx = Math.sin(spieler.yaw), fz = Math.cos(spieler.yaw);
    const zi = zelleVon(spieler.pos.x + fx * 1.4), zj = zelleVon(spieler.pos.z + fz * 1.4);
    if (erzFelsen.get(key(zi, zj)) && !zellen.get(key(zi, zj))) tipp = 'F = Erz mit der Faust abbauen 👊';
  }
  if (werkzeug === 'abriss' && z) {
    const b = zellen.get(key(z[0], z[1]));
    if (b) {
      abrissKasten.visible = true;
      abrissKasten.scale.y = b.hoehe + 0.2; abrissKasten.position.set(b.x, (b.hoehe + 0.2) / 2, b.z);
      tipp = b.typ === 'hub' ? 'Den HUB kann man nicht abreißen' : `Klick = ${GEBAEUDE[b.typ].name} abreißen (du bekommst ${kostenText(b.typ)} zurück)`;
    }
  }
  if (geist) {
    geist.visible = !!z;
    if (z) {
      const dir = bauRichtung(), problem = bauProblem(typ, z[0], z[1]);
      const m = problem ? geistRot : geistGruen;
      geist.traverse(o => { if (o.isMesh) o.material = m; });
      geistPfeil.material = m;
      geist.position.set(z[0] * G, 0, z[1] * G); geist.rotation.y = DIR_WINKEL[dir];
      if (typ !== 'turm' && typ !== 'hub') {
        geistPfeilGruppe.visible = true;
        geistPfeilGruppe.position.set(z[0] * G, GEBAEUDE[typ].hoehe + 0.8, z[1] * G);
        geistPfeilGruppe.rotation.y = DIR_WINKEL[dir];
      }
      tipp = `${GEBAEUDE[typ].emoji} ${GEBAEUDE[typ].name} (${kostenText(typ)}) · R = drehen`;
      if (problem) tipp += ` · <span class="nein">${problem}</span>`;
    }
  }
  setHTML(el.tipp, tipp);
}

// ================= SPEICHERN =================
let speicherT = 0;
function speichern() {
  speicherT = 0;
  stand.bauten = gebaeude.filter(b => b.typ !== 'hub').map(b => ({ t: b.typ, i: b.i, j: b.j, d: b.dir }));
  try { localStorage.setItem(SPEICHER_NAME, JSON.stringify(stand)); } catch (e) { /* egal */ }
}

bauen('hub', 0, 0, 1);
for (const b of stand.bauten || []) {
  if (!GEBAEUDE[b.t] || zellen.get(key(b.i, b.j))) continue;
  if (b.t === 'bohrer' && !erzFelsen.get(key(b.i, b.j))) continue;
  bauen(b.t, b.i, b.j, b.d);
}

// ================= SOUND =================
let audio = null;
function ton(f1, f2, dauer, typ = 'sine', laut = 0.15, spaeter = 0) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + spaeter;
  o.type = typ;
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dauer);
  g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
  o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dauer + 0.05);
}
const SOUND = {
  plopp: () => ton(600, 250, 0.12, 'square', 0.05),
  boing: () => { ton(150, 700, 0.22, 'sine', 0.25); ton(700, 180, 0.3, 'sine', 0.2, 0.2); },
  bau: () => ton(220, 440, 0.1, 'triangle', 0.15),
  klong: () => ton(180, 80, 0.15, 'square', 0.08),
  pling: () => ton(900, 1400, 0.08, 'sine', 0.04),
  wusch: () => ton(200, 1200, 0.35, 'sawtooth', 0.05),
  alarm: () => { for (let k = 0; k < 3; k++) ton(440, 660, 0.25, 'square', 0.06, k * 0.3); },
  tada: () => [523, 659, 784, 1047].forEach((f, k) => ton(f, f, 0.3, 'triangle', 0.15, k * 0.12)),
};

// ================= HUD =================
const el = Object.fromEntries(['lager', 'lebenBalken', 'meilenstein', 'welle', 'tipp', 'meldung', 'leiste', 'rot', 'menue', 'menueText', 'gegnerAn', 'los', 'neu']
  .map(id => [id, document.getElementById(id)]));
const altesHTML = new Map();
function setHTML(e, html) { if (altesHTML.get(e) !== html) { altesHTML.set(e, html); e.innerHTML = html; } }

let meldungT = 0;
function meldung(text, dauer = 2.5) { el.meldung.textContent = text; el.meldung.style.opacity = 1; meldungT = dauer; }
function rotBlitz() { el.rot.style.opacity = 1; setTimeout(() => { el.rot.style.opacity = 0; }, 250); }

const slots = WERKZEUGE.map((w, k) => {
  const d = document.createElement('div');
  d.className = 'slot';
  const info = GEBAEUDE[w];
  const emo = w === 'hand' ? '🔫' : w === 'abriss' ? '🧨' : info.emoji;
  const name = w === 'hand' ? 'Ball-Kanone' : w === 'abriss' ? 'Abreißen' : info.name;
  d.innerHTML = `<span class="taste">${w === 'abriss' ? 'X' : k}</span><span class="emo">${emo}</span>${name}<div class="preis"></div>`;
  d.addEventListener('mousedown', e => { e.stopPropagation(); werkzeugWaehlen(w); });
  el.leiste.appendChild(d);
  return d;
});

function hudUpdate() {
  setHTML(el.lager, `⬜ Eisenbarren: <b>${stand.lager.eisen}</b><br>🟧 Kupferbarren: <b>${stand.lager.kupfer}</b>` +
    `<br><small>Erz im HUB: ${stand.erz.eisen}/3 Eisen · ${stand.erz.kupfer}/3 Kupfer</small>`);
  el.lebenBalken.style.width = Math.max(0, spieler.hp / SPIELER_LEBEN * 100) + '%';
  const ms = MEILENSTEINE[stand.meilenstein];
  setHTML(el.meilenstein, ms
    ? `🎯 <b>Meilenstein ${stand.meilenstein + 1}/${MEILENSTEINE.length}</b><br>${ms.text}<br>Fortschritt: <b>${Math.min(ms.zahl(), ms.ziel)} / ${ms.ziel}</b>`
    : '🏆 <b>Alle Meilensteine geschafft!</b><br>Du bist Fabrik-Chef!');
  const lebend = gegner.filter(g => !g.tot).length;
  setHTML(el.welle, stand.gegnerAn
    ? `🤖 Welle ${stand.welle + 1} in <b>${Math.ceil(stand.welleT)} s</b>${lebend ? `<br>Roboter unterwegs: <b>${lebend}</b>` : ''}`
    : '🕊️ Friedlich (keine Roboter)');
  WERKZEUGE.forEach((w, k) => {
    const s = slots[k];
    s.classList.toggle('aktiv', w === werkzeug);
    if (GEBAEUDE[w]) {
      s.classList.toggle('zu', !freigeschaltet(w));
      s.classList.toggle('teuer', !genugGeld(w));
      setHTML(s.lastChild, freigeschaltet(w) ? kostenText(w) : '🔒');
    }
  });
}

function meilensteinPruefen() {
  const ms = MEILENSTEINE[stand.meilenstein];
  if (!ms || ms.zahl() < ms.ziel) return;
  stand.meilenstein++;
  meldung(`🎉 Meilenstein geschafft! ${ms.belohnung}`, 4);
  SOUND.tada();
  puff(0, 4, 0, 0xffd166, 30);
  speichern();
}

// ================= EINGABE =================
const taste = {};
let pausiert = true;

function werkzeugWaehlen(w) {
  werkzeug = w;
  letzteZelle = null;
}

addEventListener('keydown', e => {
  taste[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (pausiert) return;
  const zahl = /^Digit([0-5])$/.exec(e.code);
  if (zahl) werkzeugWaehlen(WERKZEUGE[+zahl[1]]);
  if (e.code === 'KeyQ') werkzeugWaehlen('hand');
  if (e.code === 'KeyX') werkzeugWaehlen(werkzeug === 'abriss' ? 'hand' : 'abriss');
  if (e.code === 'KeyR') drehung = (drehung + 1) % 4;
  if (e.code === 'KeyF') schlagen();
  if (e.code === 'KeyG' && spieler.modus === 'steht') {
    const fx = Math.sin(spieler.yaw), fz = Math.cos(spieler.yaw);
    spieler.umfallen(-fx * 3, 3, -fz * 3); SOUND.boing();
  }
});
addEventListener('keyup', e => { taste[e.code] = false; });
addEventListener('blur', () => { for (const k in taste) taste[k] = false; mausUnten = false; });

const leinwandEl = renderer.domElement;
leinwandEl.addEventListener('mousedown', e => {
  if (pausiert) return;
  if (document.pointerLockElement !== leinwandEl) { sperreMaus(); return; }
  if (e.button === 0) { mausUnten = true; klick(); }
  if (e.button === 2) werkzeugWaehlen('hand');
});
addEventListener('mouseup', e => { if (e.button === 0) { mausUnten = false; letzteZelle = null; letztesBand = null; } });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== leinwandEl) return;
  kamYaw -= e.movementX * 0.0025;
  kamPitch = Math.max(-1.25, Math.min(0.9, kamPitch - e.movementY * 0.0025));
});
addEventListener('wheel', e => {
  if (pausiert) return;
  const k = WERKZEUGE.indexOf(werkzeug) + (e.deltaY > 0 ? 1 : -1);
  werkzeugWaehlen(WERKZEUGE[(k + WERKZEUGE.length) % WERKZEUGE.length]);
});

function sperreMaus() {
  try { const r = leinwandEl.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* geht nicht */ }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== leinwandEl && !pausiert) pause(true);
});
function pause(an) {
  pausiert = an;
  el.menue.style.display = an ? 'flex' : 'none';
  mausUnten = false;
  if (an) { el.los.textContent = '▶ Weiterspielen'; speichern(); }
}

el.gegnerAn.checked = stand.gegnerAn;
el.gegnerAn.addEventListener('change', () => {
  stand.gegnerAn = el.gegnerAn.checked;
  if (!stand.gegnerAn) { for (const g of gegner) g.entfernen(); gegner = []; }
});
el.los.addEventListener('click', () => {
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* kein Ton */ } }
  if (audio && audio.state === 'suspended') audio.resume();
  pause(false);
  sperreMaus();
});
el.neu.addEventListener('click', () => {
  if (!confirm('Wirklich eine neue Fabrik anfangen? Deine jetzige Fabrik ist dann weg.')) return;
  try { localStorage.removeItem(SPEICHER_NAME); } catch (e) { /* egal */ }
  location.reload();
});
if (stand.bauten && stand.bauten.length) el.los.textContent = '▶ Weiterspielen';

// ================= HAUPT-SCHLEIFE =================
function winkelNaeher(a, b, k) { return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, k); }

function update(dt) {
  zeit += dt; plingT -= dt;
  spielerUpdate(dt);
  for (const g of gegner) gegnerUpdate(g, dt);
  gegner = gegner.filter(g => !g.weg);
  for (const b of [...gebaeude]) gebaeudeUpdate(b, dt);
  baelleUpdate(dt);
  bowling();
  wellenUpdate(dt);
  partikelUpdate(dt);
  bandTextur.offset.y += BAND_TEMPO * G * dt;   // Pfeile laufen mit dem Band mit
  if (mausUnten && werkzeug === 'band') bandZiehen();
  meilensteinPruefen();
  speicherT += dt;
  if (speicherT > 5) speichern();
}

function kameraUpdate() {
  const f = spieler;
  const ziel = f.modus === 'steht' ? _a.set(f.pos.x, f.pos.y + 1.7, f.pos.z) : _a.copy(f.mitte()).add(_b.set(0, 0.6, 0));
  const d = blickRichtung();
  kamera.position.set(ziel.x - Math.cos(kamYaw) * 0.7, ziel.y, ziel.z + Math.sin(kamYaw) * 0.7).addScaledVector(d, -4.5);
  if (kamera.position.y < 0.4) kamera.position.y = 0.4;
  kamera.lookAt(_c.copy(kamera.position).add(d));
  sonne.position.set(f.pos.x + 20, 40, f.pos.z + 12);
  sonne.target.position.set(f.pos.x, 0, f.pos.z);
}

function zeichnen(echtDt) {
  spieler.zeichnen();
  for (const g of gegner) g.zeichnen();
  for (const b of gebaeude) {
    const u = b.gruppe.userData;
    if (u.dreh && b.arbeitet) u.dreh.rotation.y += echtDt * 8;
    if (u.glut) u.glut.emissiveIntensity = b.arbeitet ? 1.5 + Math.sin(zeit * 10) * 0.3 : 0.3;
    b.gruppe.position.x = b.x + (b.wackel > 0 ? (Math.random() - 0.5) * 0.2 : 0);
  }
  kameraUpdate();
  geistUpdate();
  hudUpdate();
  if (meldungT > 0) { meldungT -= echtDt; if (meldungT <= 0) el.meldung.style.opacity = 0; }
  renderer.render(szene, kamera);
}

let akku = 0, letzte = performance.now();
function schleife(jetzt) {
  requestAnimationFrame(schleife);
  let dt = (jetzt - letzte) / 1000; letzte = jetzt;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 0.1);
  if (!pausiert) {
    akku += dt;
    let n = 0;
    while (akku >= DT && n < 6) { update(DT); akku -= DT; n++; }
    if (n === 6) akku = 0;
  }
  zeichnen(dt);
}
requestAnimationFrame(schleife);

// zum Testen
window.__spiel = { update, stand, spieler, gegner: () => gegner, gebaeude: () => gebaeude, platzieren, gegnerSpawnen, bauen, zellen, pause, schlagen, schiessen, setKam: (y, p) => { kamYaw = y; kamPitch = p; } };
