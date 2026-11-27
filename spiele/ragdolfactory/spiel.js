import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ================= EINSTELLUNGEN (hier kannst du rumprobieren!) =================
const G = 2;                 // Größe eines Bau-Feldes in Metern
const WELT = 80;             // so viele Felder geht die Welt von der Mitte bis zum Rand (1 Feld = 2 m)
const SCHWERKRAFT = 22;
const LAUF_TEMPO = 6, RENN_TEMPO = 10, SPRUNG_KRAFT = 8.5;
const BAND_TEMPO = 1.5;      // Felder pro Sekunde auf dem Förderband
const BOHR_ZEIT = 2.2;       // Sekunden pro Erz
const SCHMELZ_ZEIT = 2;      // Sekunden pro Barren
const ERSTE_WELLE = 180;     // Sekunden bis die ersten Roboter kommen (3 Minuten)
const WELLEN_PAUSE = 150;    // Sekunden zwischen den Überfällen (2,5 Minuten)
const HUB_NAEHE = 30;        // so nah (Meter) musst du am HUB sein, damit ein Überfall losgeht
const BALL_TEMPO = 30;
const SPIELER_LEBEN = 100;
const START_LAGER = { eisen: 30, kupfer: 10 };
const SPEICHER_NAME = 'ragdolfactory-spielstand';
const DT = 1 / 60;           // Physik rechnet 60 Mal pro Sekunde

// Gebäude: Kosten in Barren. "sperre" = welcher Meilenstein geschafft sein muss
const GEBAEUDE = {
  bohrer:    { name: 'Bohrer',     emoji: '⛏️', kosten: { eisen: 6 },            hoehe: 3.0, halb: 0.9 },
  band:      { name: 'Band',       emoji: '➡️', kosten: { eisen: 1 },            hoehe: 0.35, halb: 1.0 },
  schmelze:  { name: 'Schmelze',   emoji: '🔥', kosten: { eisen: 5, kupfer: 3 }, hoehe: 2.6, halb: 0.9 },
  schleuder: { name: 'Schleuder',  emoji: '🚀', kosten: { eisen: 4, kupfer: 2 }, hoehe: 0.3, halb: 0.95, sperre: 'kupfer10' },
  turm:      { name: 'Ball-Turm',  emoji: '🗼', kosten: { eisen: 10, kupfer: 8 }, hoehe: 2.7, halb: 0.9, sperre: 'eisen10' },
  hub:       { name: 'HUB',        emoji: '🏠', kosten: {},                      hoehe: 2.8, halb: 0.9 },
};
const WERKZEUGE = ['hand', 'bohrer', 'band', 'schmelze', 'schleuder', 'turm', 'abriss'];

// Meilensteine: einer nach dem anderen. bonus = Extra-Barren als Belohnung
const anzahlGebaut = typ => gebaeude.filter(b => b.typ === typ).length;
const MEILENSTEINE = [
  { id: 'eisen10',   text: 'Liefere 10 Eisenbarren zum HUB',   zahl: () => stand.geliefert.eisen, ziel: 10, belohnung: '🗼 Ball-Turm freigeschaltet! (Taste 5)' },
  { id: 'kupfer10',  text: 'Liefere 10 Kupferbarren zum HUB',  zahl: () => stand.geliefert.kupfer, ziel: 10, belohnung: '🚀 Schleuder freigeschaltet! (Taste 4)' },
  { id: 'schmelze',  text: 'Baue 2 Schmelzen',                 zahl: () => anzahlGebaut('schmelze'), ziel: 2, belohnung: '💥 Neue Waffe: Plopp-Schrot! (Q = Waffe wechseln)' },
  { id: 'robo10',    text: 'Haue 10 Roboter kaputt',           zahl: () => stand.kills, ziel: 10, belohnung: '🔫 Deine Ball-Kanone schießt jetzt 3 Bälle!' },
  { id: 'boss1',     text: 'Besiege einen Boss',               zahl: () => stand.bossKills || 0, ziel: 1, belohnung: '🚀 Neue Waffe: RAKETENWERFER!' },
  { id: 'baender',   text: 'Baue 30 Förderbänder',             zahl: () => anzahlGebaut('band'), ziel: 30, belohnung: '🌀 Neue Waffe: Ball-Minigun!' },
  { id: 'rein',      text: 'Baue einen Bohrer auf ⭐ reinem Erz', zahl: () => gebaeude.filter(b => b.typ === 'bohrer' && b.rein).length, ziel: 1, belohnung: '🎳 Neue Waffe: Bowling-Werfer!' },
  { id: 'eisen100',  text: 'Liefere 100 Eisenbarren zum HUB',  zahl: () => stand.geliefert.eisen, ziel: 100, belohnung: '🏆 Du bist FABRIK-CHEF! +30 Kupfer', bonus: { kupfer: 30 } },
  { id: 'boss3',     text: 'Besiege 3 Bosse',                  zahl: () => stand.bossKills || 0, ziel: 3, belohnung: '💪 Alle Waffen machen DOPPELTEN Schaden!' },
  { id: 'kupfer100', text: 'Liefere 100 Kupferbarren zum HUB', zahl: () => stand.geliefert.kupfer, ziel: 100, belohnung: '⚡ Neue Waffe: Blitz-Werfer!' },
  { id: 'tuerme',    text: 'Baue 5 Ball-Türme',                zahl: () => anzahlGebaut('turm'), ziel: 5, belohnung: '🗼 Türme schießen jetzt doppelt so schnell!' },
  { id: 'robo100',   text: 'Haue 100 Roboter kaputt',          zahl: () => stand.kills, ziel: 100, belohnung: '👊 MEGA-FAUST: F haut jetzt alles weg!' },
  { id: 'riese',     text: 'Besiege den 👑 RIESEN-ROBO',       zahl: () => stand.rieseKills || 0, ziel: 1, belohnung: '🚀🚀 Raketenwerfer schießt 2 Raketen!' },
  { id: 'eisen500',  text: 'Liefere 500 Eisenbarren zum HUB',  zahl: () => stand.geliefert.eisen, ziel: 500, belohnung: '🌟 Du bist eine RAGDOL-LEGENDE! +200 Eisen +200 Kupfer', bonus: { eisen: 200, kupfer: 200 } },
];
const ALTE_MEILENSTEINE = ['eisen10', 'kupfer10', 'robo10', 'eisen100', 'boss3'];  // Reihenfolge von früher (für alte Spielstände)
const hat = id => stand.erledigt.includes(id);
const aktuellerMeilenstein = () => MEILENSTEINE.find(m => !hat(m.id));

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
    kills: 0, bossKills: 0, rieseKills: 0, erledigt: [], welle: 0, welleT: ERSTE_WELLE, gegnerAn: true, bauten: [],
  };
}
let stand = neuerStand();
try {
  const s = JSON.parse(localStorage.getItem(SPEICHER_NAME));
  if (s && s.lager) {
    if (!s.erledigt) s.erledigt = ALTE_MEILENSTEINE.slice(0, s.meilenstein || 0);  // alten Spielstand umbauen
    stand = Object.assign(neuerStand(), s);
  }
} catch (e) { /* kein Spielstand */ }

// ================= SZENE =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const HORIZONT = 0xc4e3fa;
const szene = new THREE.Scene();
szene.background = new THREE.Color(HORIZONT);
szene.fog = new THREE.Fog(HORIZONT, 90, 520);
const kamera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1100);

const SONNEN_RICHTUNG = new THREE.Vector3(30, 38, 16).normalize();
szene.add(new THREE.HemisphereLight(0xcfe8ff, 0x5b7a3a, 1.1));
const sonne = new THREE.DirectionalLight(0xfff0d8, 2.8);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
sonne.shadow.bias = -0.0004; sonne.shadow.normalBias = 0.03;
Object.assign(sonne.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 150 });
szene.add(sonne, sonne.target);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
});

const HOCH = new THREE.Vector3(0, 1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const mat = (farbe, extra = {}) => new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.7, ...extra });
const BALL_FARBEN = [0xff4fa3, 0xffe14f, 0x4fd8ff, 0x8aff4f];
const wahl = liste => liste[Math.floor(Math.random() * liste.length)];
function leinwand(b, h) { const c = document.createElement('canvas'); c.width = b; c.height = h; return [c, c.getContext('2d')]; }
function textur(b, h, malen, rx = 1, ry = 1) {
  const [c, g] = leinwand(b, h);
  malen(g, b, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(rx, ry);
  return t;
}
function kruemel(g, b, h, farben, n, groesse, alpha = [0.2, 0.6]) {
  for (let k = 0; k < n; k++) {
    g.globalAlpha = rnd(alpha[0], alpha[1]); g.fillStyle = wahl(farben);
    g.fillRect(rnd(0, b), rnd(0, h), rnd(1, groesse), rnd(1, groesse));
  }
  g.globalAlpha = 1;
}
function nieten(g, b, h, abstand, farbe = 'rgba(255,255,255,0.35)') {
  g.fillStyle = farbe;
  for (let x = abstand / 2; x < b; x += abstand) for (const y of [5, h - 5]) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
}

// ---------- Texturen (alle selbst gemalt!) ----------
const TEX = {
  gras: textur(256, 256, (g) => {
    g.fillStyle = '#6cb84a'; g.fillRect(0, 0, 256, 256);
    kruemel(g, 256, 256, ['#5aa33d', '#7fcc5c', '#4f9435', '#8fd66a'], 2500, 4);
    g.lineWidth = 1;
    for (let k = 0; k < 900; k++) {
      const x = rnd(0, 256), y = rnd(0, 256);
      g.globalAlpha = 0.5; g.strokeStyle = Math.random() < 0.5 ? '#3f852a' : '#9be27a';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-3, 3), y - rnd(4, 10)); g.stroke();
    }
    g.globalAlpha = 1; g.strokeStyle = 'rgba(30,60,20,0.22)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254);
  }),
  beton: textur(128, 128, (g) => {
    g.fillStyle = '#b4b2aa'; g.fillRect(0, 0, 128, 128);
    kruemel(g, 128, 128, ['#9c9a92', '#c8c6be', '#8a8880'], 900, 3);
    g.strokeStyle = 'rgba(60,60,60,0.35)'; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { g.beginPath(); let x = rnd(0, 128), y = rnd(0, 128); g.moveTo(x, y); for (let s = 0; s < 5; s++) { x += rnd(-12, 12); y += rnd(-12, 12); g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(40,40,40,0.5)'; g.lineWidth = 3; g.strokeRect(1, 1, 126, 126);
  }),
  warn: textur(64, 64, (g) => {
    g.fillStyle = '#f2b705'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1d1d1f';
    for (let x = -64; x < 128; x += 32) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 16, 64); g.lineTo(x + 80, 0); g.lineTo(x + 64, 0); g.fill(); }
    kruemel(g, 64, 64, ['#000', '#fff'], 80, 2, [0.05, 0.15]);
  }),
  metall: textur(128, 128, (g) => {
    g.fillStyle = '#7d848f'; g.fillRect(0, 0, 128, 128);
    kruemel(g, 128, 128, ['#6d747f', '#8d949f', '#5d646f'], 600, 3);
    g.strokeStyle = 'rgba(20,20,30,0.45)'; g.lineWidth = 2; g.strokeRect(2, 2, 124, 124); g.beginPath(); g.moveTo(64, 2); g.lineTo(64, 126); g.stroke();
    nieten(g, 128, 128, 16);
  }),
  dunkelMetall: textur(64, 64, (g) => {
    g.fillStyle = '#3a3e46'; g.fillRect(0, 0, 64, 64);
    kruemel(g, 64, 64, ['#2c3038', '#4a4e56'], 300, 2);
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.strokeRect(1, 1, 62, 62);
  }),
  ziegel: textur(128, 128, (g) => {
    g.fillStyle = '#5b4a40'; g.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 8; r++) for (let s = -1; s < 4; s++) {
      g.fillStyle = wahl(['#9b3b2b', '#a84632', '#8a3224', '#b0503a', '#93402c']);
      g.fillRect(s * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14);
    }
    kruemel(g, 128, 128, ['#000', '#fff'], 500, 2, [0.05, 0.15]);
  }),
  gitter: textur(64, 64, (g) => {
    g.fillStyle = '#4a4f57'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1b1d21';
    for (let x = 0; x < 64; x += 8) for (let y = 0; y < 64; y += 8) g.fillRect(x + 2, y + 2, 4, 4);
  }, 2, 2),
  gummi: textur(64, 64, (g) => {
    g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#3b3b41';
    for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 3);
    g.strokeStyle = 'rgba(242,183,5,0.75)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(20, 22); g.lineTo(32, 38); g.lineTo(44, 22); g.stroke();
  }, 1, 2),
  hubWand: textur(128, 128, (g) => {
    g.fillStyle = '#2a6fdb'; g.fillRect(0, 0, 128, 128);
    kruemel(g, 128, 128, ['#2463c4', '#3a7fe8'], 400, 3);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    for (const x of [2, 64]) g.strokeRect(x, 2, 62, 124);
    nieten(g, 128, 128, 21);
  }),
  holz: textur(64, 64, (g) => {
    g.fillStyle = '#8a5d36'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(60,35,15,0.45)';
    for (let y = 2; y < 64; y += 5) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(20, y + rnd(-2, 2), 40, y + rnd(-2, 2), 64, y); g.stroke(); }
  }),
  pfeil: textur(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = '#eaffef'; g.lineWidth = 7; g.lineCap = 'round';
    for (const y of [16, 36]) { g.beginPath(); g.moveTo(14, y + 14); g.lineTo(32, y); g.lineTo(50, y + 14); g.stroke(); }
  }),
  rauch: textur(64, 64, (g) => {
    const v = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.5, 'rgba(255,255,255,0.5)'); v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v; g.fillRect(0, 0, 64, 64);
  }),
};
function stoffTextur(farbe) {
  return textur(64, 64, (g) => {
    g.fillStyle = farbe; g.fillRect(0, 0, 64, 64);
    g.globalAlpha = 0.12; g.strokeStyle = '#000';
    for (let k = 0; k < 64; k += 3) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 64); g.stroke(); }
    g.globalAlpha = 1;
    kruemel(g, 64, 64, ['#000', '#fff'], 200, 2, [0.04, 0.12]);
  });
}
function roboterTextur(farbe, rost) {
  return textur(128, 128, (g) => {
    g.fillStyle = farbe; g.fillRect(0, 0, 128, 128);
    kruemel(g, 128, 128, ['#000', '#fff'], 700, 3, [0.04, 0.14]);
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2;
    g.strokeRect(3, 3, 122, 58); g.strokeRect(3, 67, 58, 58); g.strokeRect(67, 67, 58, 58);
    nieten(g, 128, 128, 18, 'rgba(255,255,255,0.4)');
    for (let k = 0; k < 7; k++) { // Rost-Flecken
      const x = rnd(0, 128), y = rnd(0, 128), r = rnd(4, 12);
      const v = g.createRadialGradient(x, y, 0, x, y, r);
      v.addColorStop(0, rost); v.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = v; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
    for (let k = 0; k < 10; k++) { const x = rnd(0, 128), y = rnd(0, 128); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-10, 10), y + rnd(-4, 4)); g.stroke(); }
  });
}

// ---------- Himmel, Berge, Wolken ----------
const himmel = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    oben: { value: new THREE.Color(0x2f7fe0) }, mitte: { value: new THREE.Color(HORIZONT) },
    unten: { value: new THREE.Color(0xe6f3ff) }, sonnenRichtung: { value: SONNEN_RICHTUNG },
  },
  vertexShader: 'varying vec3 vR; void main(){ vR = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 oben; uniform vec3 mitte; uniform vec3 unten; uniform vec3 sonnenRichtung; varying vec3 vR;
    void main(){
      float h = vR.y;
      vec3 c = h > 0.0 ? mix(mitte, oben, pow(h, 0.55)) : mix(mitte, unten, min(1.0, -h * 4.0));
      float s = max(dot(vR, sonnenRichtung), 0.0);
      c += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 4.0 + pow(s, 12.0) * 0.25);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
himmel.frustumCulled = false;
szene.add(himmel);

{ // Berge in der Ferne
  const bergMat = mat(0x7f8fa6, { flatShading: true, roughness: 1 }), schneeMat = mat(0xf4f8ff, { flatShading: true, roughness: 0.9 });
  for (let k = 0; k < 40; k++) {
    const w = k / 40 * Math.PI * 2 + rnd(-0.05, 0.05), r = WELT * G + rnd(200, 290);
    const br = rnd(70, 130), h = rnd(60, 150), seg = Math.floor(rnd(5, 8));
    const berg = new THREE.Mesh(new THREE.ConeGeometry(br, h, seg), bergMat);
    berg.position.set(Math.cos(w) * r, h / 2 - 2, Math.sin(w) * r); berg.rotation.y = rnd(0, 6);
    const schnee = new THREE.Mesh(new THREE.ConeGeometry(br * 0.31, h * 0.3, seg), schneeMat);
    schnee.position.y = h * 0.35 + 0.3; berg.add(schnee);
    szene.add(berg);
  }
}
const wolken = [];
{
  const wolkenMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8899aa, flatShading: true });
  const geo = new THREE.IcosahedronGeometry(1, 1);
  for (let k = 0; k < 45; k++) {
    const w = new THREE.Group();
    const n = Math.floor(rnd(5, 9));
    for (let s = 0; s < n; s++) {
      const kugel = new THREE.Mesh(geo, wolkenMat);
      const gr = rnd(4, 9);
      kugel.scale.set(gr * 1.3, gr * 0.7, gr);
      kugel.position.set(rnd(-12, 12), rnd(-2, 3), rnd(-6, 6));
      w.add(kugel);
    }
    w.position.set(rnd(-650, 650), rnd(90, 150), rnd(-650, 650)); w.scale.setScalar(rnd(1.2, 2));
    szene.add(w); wolken.push(w);
  }
}

// ---------- Geometrien wiederverwenden (spart Speicher) ----------
const geoSpeicher = new Map();
function geo(name, machen) { if (!geoSpeicher.has(name)) geoSpeicher.set(name, machen()); return geoSpeicher.get(name); }
const boxGeo = (b, h, t) => geo(`b${b},${h},${t}`, () => new THREE.BoxGeometry(b, h, t));
const zylGeo = (r1, r2, h, seg) => geo(`z${r1},${r2},${h},${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
const kugelGeo = (r, a = 12, b = 8) => geo(`k${r},${a},${b}`, () => new THREE.SphereGeometry(r, a, b));
const ebeneGeo = (b, h) => geo(`e${b},${h}`, () => new THREE.PlaneGeometry(b, h));

// ================= MATERIALIEN =================
const MAT = {
  grau: mat(0xffffff, { map: TEX.metall, roughness: 0.55, metalness: 0.4 }),
  dunkel: mat(0x33363d), schwarz: mat(0x16171a, { roughness: 0.9 }),
  dunkelMetall: mat(0xffffff, { map: TEX.dunkelMetall, roughness: 0.5, metalness: 0.6 }),
  gelb: mat(0xf2b705, { roughness: 0.45 }), rot: mat(0xd6402e, { roughness: 0.45 }), rotRohr: mat(0xb83a2a, { roughness: 0.4, metalness: 0.3 }),
  blau: mat(0x2a6fdb), weiss: mat(0xeef2f6, { roughness: 0.4, side: THREE.DoubleSide }),
  hubWand: mat(0xffffff, { map: TEX.hubWand, roughness: 0.5, metalness: 0.2 }),
  ziegel: mat(0xffffff, { map: TEX.ziegel, roughness: 0.95 }),
  beton: mat(0xffffff, { map: TEX.beton, roughness: 0.95 }),
  warn: mat(0xffffff, { map: TEX.warn, roughness: 0.6 }),
  gitter: mat(0xffffff, { map: TEX.gitter, roughness: 0.6, metalness: 0.5 }),
  metall: mat(0xb8c0c8, { metalness: 0.7, roughness: 0.3 }),
  chrom: mat(0xe8eef4, { metalness: 0.95, roughness: 0.15 }),
  gruen: mat(0x3ddc84, { emissive: 0x1a8a4a, emissiveIntensity: 0.6 }),
  fels: mat(0x7d7a76, { flatShading: true, roughness: 1 }),
  band: new THREE.MeshStandardMaterial({ map: TEX.gummi, roughness: 0.9 }),
  gummi: mat(0x222226, { roughness: 1 }),
  holz: mat(0xffffff, { map: TEX.holz, roughness: 0.9 }),
  rinde: mat(0x6b4a2e, { roughness: 1 }),
  blatt: mat(0xffffff, { flatShading: true, roughness: 0.9 }),
  oliv: mat(0x5a6b2f, { roughness: 0.8 }),
  reflex: mat(0xdfe6ea, { emissive: 0x666666, emissiveIntensity: 0.4, roughness: 0.3 }),
  gold: mat(0xffc94a, { metalness: 0.9, roughness: 0.25 }),
};
const bandTextur = TEX.gummi;

// Items auf dem Band: Erz = zackige Brocken, Barren = Trapez-Barren
function zackig(g, staerke) {
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const f = 1 + staerke * (Math.abs(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5) % 1 - 0.5);
    p.setXYZ(k, x * f, y * f, z * f);
  }
  g.computeVertexNormals();
  return g;
}
const ERZ_GEO = zackig(new THREE.DodecahedronGeometry(0.22, 1), 0.45);
const BARREN_GEO = (() => { const g = new THREE.CylinderGeometry(0.17, 0.24, 0.14, 4); g.rotateY(Math.PI / 4); g.scale(1.3, 1, 0.75); return g; })();
const ITEMS = {
  eisenerz:     { mat: mat(0x7a4535, { flatShading: true, roughness: 0.9 }), barren: false, metall: 'eisen' },
  kupfererz:    { mat: mat(0xb5652a, { flatShading: true, roughness: 0.8 }), barren: false, metall: 'kupfer' },
  eisenbarren:  { mat: mat(0xd0d6dc, { metalness: 0.9, roughness: 0.25 }), barren: true, metall: 'eisen' },
  kupferbarren: { mat: mat(0xf08a4a, { metalness: 0.9, roughness: 0.25 }), barren: true, metall: 'kupfer' },
};
function itemMesh(art) {
  const m = new THREE.Mesh(ITEMS[art].barren ? BARREN_GEO : ERZ_GEO, ITEMS[art].mat);
  m.castShadow = true; m.rotation.y = rnd(0, 6); szene.add(m); return m;
}

function kasten(b, h, t, m, x = 0, y = 0, z = 0) {
  const k = new THREE.Mesh(boxGeo(b, h, t), m);
  k.position.set(x, y, z); k.castShadow = k.receiveShadow = true; return k;
}
function rohr(r1, r2, h, m, x = 0, y = 0, z = 0, seg = 14) {
  const k = new THREE.Mesh(zylGeo(r1, r2, h, seg), m);
  k.position.set(x, y, z); k.castShadow = k.receiveShadow = true; return k;
}
function kugel(r, m, x = 0, y = 0, z = 0) {
  const k = new THREE.Mesh(kugelGeo(r), m);
  k.position.set(x, y, z); k.castShadow = true; return k;
}
function schild(text, farbe = '#ffd166') {
  const [c, g] = leinwand(256, 96);
  g.fillStyle = 'rgba(20,25,45,0.9)'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 248, 88, 18) : g.rect(4, 4, 248, 88); g.fill();
  g.strokeStyle = farbe; g.lineWidth = 5; g.stroke();
  g.fillStyle = farbe; g.font = 'bold 60px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t }));
  s.scale.set(2.4, 0.9, 1); return s;
}

// ================= WELT: Boden, Gras, Bäume, Zaun, Erz-Felsen =================
const zellen = new Map();          // "i,j" -> Gebäude
const erzFelsen = new Map();       // "i,j" -> { art, schlaege, gruppe }
const key = (i, j) => i + ',' + j;
const zelleVon = x => Math.round(x / G);
const RAND = WELT * G + 320;   // Boden geht bis unter die Berge

{ // Boden: Gras-Textur + große hellere/dunklere Flecken
  TEX.gras.repeat.set(RAND, RAND); TEX.gras.offset.set(0.5, 0.5);
  const bodenGeo = new THREE.PlaneGeometry(RAND * 2, RAND * 2, 90, 90);
  const p = bodenGeo.attributes.position, farben = [];
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k);
    const n = 0.5 + 0.22 * Math.sin(x * 0.07 + 1.3) * Math.cos(y * 0.06) + 0.14 * Math.sin(x * 0.21 + y * 0.17) + 0.08 * Math.cos(x * 0.45 - y * 0.38);
    const v = 0.78 + 0.32 * n;
    farben.push(v * (0.95 + 0.1 * (n - 0.5)), v, v * 0.88);
  }
  bodenGeo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  const boden = new THREE.Mesh(bodenGeo, new THREE.MeshStandardMaterial({ map: TEX.gras, vertexColors: true, roughness: 1 }));
  boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true;
  szene.add(boden);
}
const PLATTE = 5; // Beton-Platz um den HUB (halbe Breite in Metern)
{
  const beton = mat(0xffffff, { map: TEX.beton.clone(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
  beton.map.repeat.set(PLATTE, PLATTE); beton.map.needsUpdate = true;
  const platte = new THREE.Mesh(new THREE.PlaneGeometry(PLATTE * 2, PLATTE * 2), beton);
  platte.rotation.x = -Math.PI / 2; platte.position.y = 0.012; platte.receiveShadow = true;
  szene.add(platte);
  for (let k = 0; k < 4; k++) { // Warnstreifen am Rand
    const h = new THREE.Group(); h.rotation.y = k * Math.PI / 2; szene.add(h);
    const streifen = new THREE.Mesh(new THREE.PlaneGeometry(PLATTE * 2, 0.3), MAT.warn);
    streifen.rotation.x = -Math.PI / 2; streifen.position.set(0, 0.02, PLATTE - 0.15); streifen.receiveShadow = true;
    h.add(streifen);
  }
}

// ---------- Die große Welt: Seen, Wälder und Erz weiter draußen ----------
// Mit "festem Zufall": die Welt sieht jedes Mal gleich aus, damit dein Spielstand passt.
function festerZufall(samen) {
  return () => {
    samen = (samen + 0x6D2B79F5) | 0;
    let t = Math.imul(samen ^ (samen >>> 15), 1 | samen);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wz = festerZufall(20261127);
const wr = (a, b) => a + wz() * (b - a);
const ALTE_WELT = 29;            // so weit ging die Welt früher (in Feldern) – da drin bleibt alles wie es war
const besetzt = new Map();       // "i,j" -> 'baum' oder 'wasser' (da kann man nicht bauen)
const hindernisse = new Map();   // "i,j" -> Kiste zum Dagegenlaufen (Baumstämme)
const SEEN = [];                 // [x, z, radius] in Metern
const WALDBAEUME = [];           // [x, z, größe, tanne?]
const weitDraussen = (i, j) => Math.max(Math.abs(i), Math.abs(j)) > ALTE_WELT;
const imSee = (x, z, rand = 0) => SEEN.some(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) < sr + rand);

for (let n = 0, versuch = 0; n < 9 && versuch < 800; versuch++) { // Seen
  const r = wr(7, 16), x = wr(-WELT * G + r + 6, WELT * G - r - 6), z = wr(-WELT * G + r + 6, WELT * G - r - 6);
  if (Math.max(Math.abs(x), Math.abs(z)) - r < ALTE_WELT * G + 4) continue;
  if (SEEN.some(([sx, sz, sr]) => Math.hypot(sx - x, sz - z) < sr + r + 10)) continue;
  SEEN.push([x, z, r]); n++;
  for (let i = zelleVon(x - r) - 1; i <= zelleVon(x + r) + 1; i++) for (let j = zelleVon(z - r) - 1; j <= zelleVon(z + r) + 1; j++) {
    if (Math.hypot(i * G - x, j * G - z) < r + 1) besetzt.set(key(i, j), 'wasser');
  }
}
for (let n = 0, versuch = 0; n < 70 && versuch < 4000; versuch++) { // Erz-Felsen weiter draußen
  const i = Math.round(wr(-WELT + 3, WELT - 3)), j = Math.round(wr(-WELT + 3, WELT - 3));
  if (!weitDraussen(i, j) || besetzt.has(key(i, j))) continue;
  if (ERZ_ORTE.some(([, a, b]) => Math.hypot(a - i, b - j) < 5)) continue;
  const rein = Math.hypot(i, j) > WELT * 0.75 && wz() < 0.6;   // ganz weit draußen: reines Erz!
  ERZ_ORTE.push([wz() < 0.55 ? 'eisen' : 'kupfer', i, j, rein]); n++;
}
for (let n = 0; n < 18; n++) { // Wälder
  let cx, cz, versuch = 0;
  do { cx = wr(-WELT * G + 10, WELT * G - 10); cz = wr(-WELT * G + 10, WELT * G - 10); versuch++; }
  while ((Math.max(Math.abs(cx), Math.abs(cz)) < ALTE_WELT * G + 10 || imSee(cx, cz, 8)) && versuch < 200);
  const r = wr(10, 22), anzahl = Math.floor(r * wr(1.8, 2.6)), tannenWald = wz() < 0.6;
  for (let k = 0; k < anzahl; k++) {
    const w = wr(0, Math.PI * 2), d = Math.sqrt(wz()) * r;
    const i = zelleVon(cx + Math.cos(w) * d), j = zelleVon(cz + Math.sin(w) * d), kk = key(i, j);
    if (!weitDraussen(i, j) || Math.abs(i) > WELT - 1 || Math.abs(j) > WELT - 1 || besetzt.has(kk)) continue;
    if (ERZ_ORTE.some(([, a, b]) => Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1)) continue;
    const x = i * G + wr(-0.4, 0.4), z = j * G + wr(-0.4, 0.4);
    besetzt.set(kk, 'baum');
    hindernisse.set(kk, { x1: x - 0.3, x2: x + 0.3, z1: z - 0.3, z2: z + 0.3, y2: 6 });
    WALDBAEUME.push([x, z, wr(0.9, 1.7), wz() < (tannenWald ? 0.85 : 0.2)]);
  }
}

{ // Seen zeichnen: Sand-Ufer, Wasser, Seerosen
  const sandMat = mat(0xd9c38f, { roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
  const wasserMat = new THREE.MeshStandardMaterial({ color: 0x2f86c9, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.88, emissive: 0x0a2a44 });
  const tiefMat = new THREE.MeshBasicMaterial({ color: 0x14507f, transparent: true, opacity: 0.45, depthWrite: false });
  const blattMat = mat(0x3f9a40, { side: THREE.DoubleSide }), bluteMat = mat(0xff8ad0, { emissive: 0x552244 });
  const flach = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; szene.add(o); return o; };
  for (const [x, z, r] of SEEN) {
    flach(new THREE.CircleGeometry(r + 1.8, 48), sandMat, x, 0.02, z);
    flach(new THREE.CircleGeometry(r, 48), wasserMat, x, 0.07, z);
    flach(new THREE.CircleGeometry(r * 0.6, 40), tiefMat, x, 0.075, z);
    for (let k = 0; k < 7; k++) {
      const w = rnd(0, 6.28), d = rnd(0.3, 0.85) * r;
      const b = flach(new THREE.CircleGeometry(rnd(0.3, 0.55), 10, 0.4, 5.6), blattMat, x + Math.cos(w) * d, 0.09, z + Math.sin(w) * d);
      if (Math.random() < 0.5) { const bl = new THREE.Mesh(kugelGeo(0.12), bluteMat); bl.position.z = 0.08; b.add(bl); }
    }
  }
  MAT.wasser = wasserMat;
}

// Deko mit "Instanzen": tausende Grashalme, Blumen, Steinchen – aber schnell
const dekoProZelle = new Map();
const NULL_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
function deko(geometrie, material, anzahl, platz, schatten = false, farben = null) {
  const im = new THREE.InstancedMesh(geometrie, material, anzahl);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  for (let k = 0; k < anzahl; k++) {
    const [x, z, gr, y = 0] = platz();
    p.set(x, y, z); q.setFromAxisAngle(HOCH, rnd(0, Math.PI * 2)); s.setScalar(gr);
    m4.compose(p, q, s); im.setMatrixAt(k, m4);
    if (farben) im.setColorAt(k, c.set(wahl(farben)).offsetHSL(rnd(-0.02, 0.02), 0, rnd(-0.06, 0.06)));
    const kk = key(zelleVon(x), zelleVon(z));
    if (!dekoProZelle.has(kk)) dekoProZelle.set(kk, []);
    dekoProZelle.get(kk).push({ im, k, m: m4.clone() });
  }
  im.receiveShadow = true; im.castShadow = schatten;
  szene.add(im); return im;
}
function dekoZeigen(i, j, zeigen) {
  for (const d of dekoProZelle.get(key(i, j)) || []) {
    d.im.setMatrixAt(d.k, zeigen ? d.m : NULL_MATRIX);
    d.im.instanceMatrix.needsUpdate = true;
  }
}
const aufPlatte = (x, z) => Math.abs(x) < PLATTE + 0.3 && Math.abs(z) < PLATTE + 0.3;
const nahErz = (x, z) => imSee(x, z, 1.9) || besetzt.get(key(zelleVon(x), zelleVon(z))) === 'baum' && Math.random() < 0.7 || ERZ_ORTE.some(([, i, j]) => Math.abs(x - i * G) < 1.6 && Math.abs(z - j * G) < 1.6);
function freierPlatz(weit) {
  for (;;) { const x = rnd(-weit, weit), z = rnd(-weit, weit); if (!aufPlatte(x, z) && !nahErz(x, z)) return [x, z]; }
}
{
  // Grashalme
  const pos = [], col = [], nor = [];
  for (let k = 0; k < 6; k++) {
    const w = rnd(0, Math.PI * 2), r = rnd(0, 0.1), x = Math.cos(w) * r, z = Math.sin(w) * r;
    const h = rnd(0.2, 0.42), b = 0.035, lx = rnd(-0.1, 0.1), lz = rnd(-0.1, 0.1);
    const qx = Math.cos(w + 1.57) * b, qz = Math.sin(w + 1.57) * b;
    pos.push(x - qx, 0, z - qz, x + qx, 0, z + qz, x + lx, h, z + lz);
    col.push(0.22, 0.42, 0.13, 0.22, 0.42, 0.13, 0.62, 0.88, 0.4);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const halm = new THREE.BufferGeometry();
  halm.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  halm.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  halm.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const halmMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
  deko(halm, halmMat, 9000, () => [...freierPlatz(70), rnd(0.7, 1.4)]);
  deko(halm, halmMat, 18000, () => [...freierPlatz(WELT * G + 30), rnd(0.8, 1.5)]);
  // Blumen
  const blume = new THREE.IcosahedronGeometry(0.07, 0); blume.translate(0, 0.25, 0);
  deko(blume, mat(0xffffff, { roughness: 0.6, emissive: 0x222222 }), 2600, () => [...freierPlatz(WELT * G + 30), rnd(0.8, 1.3)], false,
    [0xffffff, 0xffe14f, 0xc77dff, 0xff5d73, 0x7ec8ff]);
  // Steinchen
  deko(zackig(new THREE.DodecahedronGeometry(0.12, 0), 0.5), MAT.fels, 1300, () => [...freierPlatz(WELT * G + 30), rnd(0.6, 2.2), 0.02], true);
}

{ // Bäume + Büsche rund um das Gelände
  const tanneGeo = (() => {
    const teile = [[1.7, 2.2, 1.6], [1.3, 1.9, 2.6], [0.9, 1.6, 3.5], [0.5, 1.2, 4.3]].map(([r, h, y]) => {
      const c = new THREE.ConeGeometry(r, h, 8); c.translate(0, y, 0); return c;
    });
    return mergeGeometries(teile);
  })();
  const laubGeo = mergeGeometries([[0, 3.4, 0, 1.5], [0.9, 3.0, 0.3, 1.1], [-0.8, 3.1, -0.4, 1.15], [0.2, 4.2, -0.2, 1.0], [-0.3, 2.9, 0.9, 1.0]]
    .map(([x, y, z, r]) => { const g = new THREE.IcosahedronGeometry(r, 0); g.translate(x, y, z); return g; }));
  const buschGeo = mergeGeometries([[0, 0.4, 0, 0.6], [0.5, 0.35, 0.2, 0.45], [-0.4, 0.35, -0.2, 0.5]]
    .map(([x, y, z, r]) => { const g = new THREE.IcosahedronGeometry(r, 0); g.translate(x, y, z); return g; }));
  const stammGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.4, 7); stammGeo.translate(0, 1.2, 0);
  const ring = (rMin, rMax) => () => { const w = rnd(0, Math.PI * 2), r = rnd(rMin, rMax); return [Math.cos(w) * r, Math.sin(w) * r, rnd(0.8, 1.6)]; };
  const orteT = Array.from({ length: 260 }, ring(WELT * G + 6, WELT * G + 60));
  const orteL = Array.from({ length: 160 }, ring(WELT * G + 6, WELT * G + 60));
  for (const [x, z, gr, tanne] of WALDBAEUME) (tanne ? orteT : orteL).push([x, z, gr]);
  const waldBuesche = WALDBAEUME.filter(() => Math.random() < 0.4).map(([x, z]) => [x + rnd(-1.5, 1.5), z + rnd(-1.5, 1.5), rnd(0.6, 1.2)]);
  for (const [x, z, r] of SEEN) for (let n = 0; n < 6; n++) { const w = rnd(0, 6.28); waldBuesche.push([x + Math.cos(w) * (r + 2.3), z + Math.sin(w) * (r + 2.3), rnd(0.5, 0.9)]); }
  let wb = 0;
  deko(buschGeo, MAT.blatt, waldBuesche.length, () => waldBuesche[wb++], true, [0x3f9a40, 0x4caf50, 0x2f8a3a]);
  let k = 0;
  deko(stammGeo, MAT.rinde, orteT.length + orteL.length, () => { const o = k < orteT.length ? orteT[k] : orteL[k - orteT.length]; k++; return o; }, true);
  k = 0; deko(tanneGeo, MAT.blatt, orteT.length, () => orteT[k++], true, [0x2f7a3a, 0x2a6e35, 0x3a8a42]);
  k = 0; deko(laubGeo, MAT.blatt, orteL.length, () => orteL[k++], true, [0x4caf50, 0x5cbf4a, 0x8bc34a, 0xd4a03a]);
  deko(buschGeo, MAT.blatt, 250, ring(WELT * G + 3, WELT * G + 40), true, [0x3f9a40, 0x4caf50, 0x2f8a3a]);
  // große Felsen
  deko(zackig(new THREE.DodecahedronGeometry(1, 0), 0.4), MAT.fels, 140, ring(WELT * G + 4, WELT * G + 55), true);
}

{ // Holzzaun um das Gelände
  const z = WELT * G + 1.5, pfosten = [];
  for (let s = -z; s <= z; s += 3) pfosten.push([s, -z], [s, z], [-z, s], [z, s]);
  let k = 0;
  const pfostenGeo = new THREE.BoxGeometry(0.18, 1.3, 0.18); pfostenGeo.translate(0, 0.65, 0);
  deko(pfostenGeo, MAT.holz, pfosten.length, () => [...pfosten[k++], 1], true);
  for (let s = 0; s < 4; s++) for (const y of [0.45, 0.95]) {
    const latte = kasten(z * 2, 0.12, 0.06, MAT.holz, 0, y, 0);
    const h = new THREE.Group(); h.rotation.y = s * Math.PI / 2; latte.position.z = z; h.add(latte); szene.add(h);
  }
}

// Erz-Felsen mit leuchtenden Kristallen
const ERZ_MAT = {
  eisen: mat(0xc0583a, { emissive: 0x5a1408, emissiveIntensity: 0.6, flatShading: true, roughness: 0.35, metalness: 0.3 }),
  kupfer: mat(0xff8c3a, { emissive: 0x7a3400, emissiveIntensity: 0.6, flatShading: true, roughness: 0.35, metalness: 0.3 }),
};
const KRISTALL_GEO = (() => {
  const saeule = new THREE.CylinderGeometry(0.1, 0.12, 0.5, 6); saeule.translate(0, 0.25, 0);
  const spitze = new THREE.ConeGeometry(0.1, 0.22, 6); spitze.translate(0, 0.61, 0);
  return mergeGeometries([saeule, spitze]);
})();
const FELS_GEO = zackig(new THREE.DodecahedronGeometry(0.6, 1), 0.35);
for (const [art, i, j, rein] of ERZ_ORTE) {
  const grp = new THREE.Group();
  grp.position.set(i * G, 0, j * G);
  for (let k = 0; k < 4; k++) {
    const f = new THREE.Mesh(FELS_GEO, MAT.fels);
    f.position.set(rnd(-0.45, 0.45), 0.05, rnd(-0.45, 0.45)); f.scale.set(rnd(0.8, 1.3), rnd(0.3, 0.55), rnd(0.8, 1.3));
    f.rotation.y = rnd(0, 6); f.castShadow = f.receiveShadow = true; grp.add(f);
  }
  for (let k = 0; k < (rein ? 15 : 9); k++) {
    const kr = new THREE.Mesh(KRISTALL_GEO, ERZ_MAT[art]);
    const w = rnd(0, Math.PI * 2), r = rnd(0.1, 0.65);
    kr.position.set(Math.cos(w) * r, 0.15, Math.sin(w) * r);
    kr.rotation.set(Math.sin(w) * rnd(0.2, 0.6), rnd(0, 6), -Math.cos(w) * rnd(0.2, 0.6));
    kr.scale.setScalar(rnd(0.7, 1.5) * (rein ? 1.35 : 1)); kr.castShadow = true; grp.add(kr);
  }
  for (let k = 0; k < 6; k++) { // Brocken drumherum
    const b = new THREE.Mesh(ERZ_GEO, ITEMS[art + 'erz'].mat);
    const w = rnd(0, Math.PI * 2), r = rnd(0.7, 1.0);
    b.position.set(Math.cos(w) * r, 0.06, Math.sin(w) * r); b.scale.setScalar(rnd(0.5, 0.9)); b.castShadow = true; grp.add(b);
  }
  szene.add(grp);
  if (rein) { // goldener Ring = reines Erz
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 6, 32), mat(0xffd84a, { emissive: 0xffb000, emissiveIntensity: 1.2 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; grp.add(ring);
  }
  erzFelsen.set(key(i, j), { art, schlaege: 0, gruppe: grp, rein: !!rein });
}

// ================= GEBÄUDE-MODELLE =================
function bauModell(typ, erzArt) {
  const g = new THREE.Group(), u = g.userData;
  const add = (...teile) => { for (const t of teile) g.add(t); return teile[0]; };
  const dreh = (obj, rx, ry, rz) => { obj.rotation.set(rx, ry, rz); return obj; };

  if (typ === 'bohrer') {
    add(kasten(1.9, 0.2, 1.9, MAT.beton, 0, 0.1, 0));
    add(kasten(1.92, 0.06, 0.12, MAT.warn, 0, 0.2, 0.9), kasten(1.92, 0.06, 0.12, MAT.warn, 0, 0.2, -0.9),
      kasten(0.12, 0.06, 1.92, MAT.warn, 0.9, 0.2, 0), kasten(0.12, 0.06, 1.92, MAT.warn, -0.9, 0.2, 0));
    for (const [x, z] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]]) {
      add(kasten(0.14, 2.5, 0.14, MAT.dunkelMetall, x, 1.45, z));
      add(kasten(0.26, 0.08, 0.26, MAT.dunkelMetall, x, 0.24, z)); // Fußplatte
    }
    for (const x of [-0.72, 0.72]) { // Kreuz-Streben an den Seiten
      add(dreh(kasten(0.07, 0.07, 1.9, MAT.dunkelMetall, x, 1.05, 0), 0.75, 0, 0), dreh(kasten(0.07, 0.07, 1.9, MAT.dunkelMetall, x, 1.05, 0), -0.75, 0, 0));
    }
    add(kasten(1.62, 0.16, 1.62, MAT.gelb, 0, 2.72, 0));
    add(kasten(1.0, 1.0, 1.0, MAT.gelb, 0, 2.05, 0));
    add(kasten(0.7, 0.45, 0.04, MAT.gitter, 0, 2.1, 0.51), kasten(0.04, 0.45, 0.7, MAT.gitter, 0.51, 2.1, 0));
    add(kasten(1.04, 0.1, 1.04, MAT.dunkelMetall, 0, 1.58, 0));
    add(kasten(0.5, 0.12, 0.02, MAT.warn, 0, 2.42, 0.51));
    add(rohr(0.36, 0.36, 0.5, MAT.dunkelMetall, 0, 3.05, 0, 16));
    for (let k = 0; k < 4; k++) add(rohr(0.42, 0.42, 0.035, MAT.metall, 0, 2.88 + k * 0.11, 0, 16));
    const rotor = new THREE.Group(); rotor.position.y = 3.36; add(rotor);
    rotor.add(rohr(0.1, 0.1, 0.14, MAT.chrom, 0, 0, 0, 10));
    for (let k = 0; k < 3; k++) { const a = new THREE.Group(); a.rotation.y = k * Math.PI * 2 / 3; a.add(dreh(kasten(0.6, 0.03, 0.14, MAT.rot, 0.32, 0, 0), 0.3, 0, 0)); rotor.add(a); }
    u.dreh = rotor;
    const bohr = new THREE.Group(); add(bohr);
    bohr.add(rohr(0.08, 0.08, 1.0, MAT.chrom, 0, 1.05, 0, 10));
    bohr.add(dreh(rohr(0.001, 0.26, 0.55, MAT.metall, 0, 0.4, 0, 12), Math.PI, 0, 0));
    for (let k = 0; k < 6; k++) { // Spiral-Schneiden
      const s = new THREE.Group(); s.rotation.y = k * 1.1; s.position.y = 0.3 + k * 0.1;
      s.add(dreh(kasten(0.36 - k * 0.04, 0.03, 0.08, MAT.dunkelMetall, 0.12, 0, 0), 0, 0, 0.4)); bohr.add(s);
    }
    u.bohr = bohr;
    if (erzArt) { // leuchtender Erz-Ring im Bohrloch
      const ring = new THREE.Mesh(geo('bohrring', () => new THREE.TorusGeometry(0.34, 0.06, 6, 20)), ERZ_MAT[erzArt]);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.21; add(ring);
    }
    add(dreh(kasten(0.6, 0.05, 0.75, MAT.metall, 0, 0.62, 0.72), 0.3, 0, 0));
    add(dreh(kasten(0.05, 0.22, 0.75, MAT.gelb, 0.31, 0.72, 0.72), 0.3, 0, 0), dreh(kasten(0.05, 0.22, 0.75, MAT.gelb, -0.31, 0.72, 0.72), 0.3, 0, 0));
    add(rohr(0.06, 0.06, 1.5, MAT.rotRohr, -0.5, 0.95, -0.55, 8), rohr(0.09, 0.09, 0.08, MAT.dunkelMetall, -0.5, 1.7, -0.55, 8));
    add(dreh(rohr(0.06, 0.06, 0.25, MAT.rotRohr, -0.5, 1.72, -0.42, 8), Math.PI / 2, 0, 0));
    const lampe = kugel(0.09, mat(0xff9a00, { emissive: 0xff7a00, emissiveIntensity: 0 }), 0.62, 2.9, 0.62);
    add(lampe, rohr(0.07, 0.08, 0.08, MAT.dunkel, 0.62, 2.82, 0.62, 8));
    u.lampe = lampe.material;
  } else if (typ === 'band') {
    for (const x of [-0.68, 0.68]) {
      add(kasten(0.1, 0.24, 2, MAT.dunkelMetall, x, 0.24, 0));
      add(kasten(0.12, 0.05, 2, MAT.gelb, x, 0.38, 0));
    }
    for (const z of [-0.75, 0.75]) {
      for (const x of [-0.62, 0.62]) add(kasten(0.08, 0.16, 0.08, MAT.dunkel, x, 0.08, z));
      add(kasten(1.3, 0.04, 0.06, MAT.dunkel, 0, 0.06, z));
    }
    for (const z of [-0.92, 0.92]) add(dreh(rohr(0.1, 0.1, 1.26, MAT.chrom, 0, 0.24, z, 10), 0, 0, Math.PI / 2));
    add(kasten(1.24, 0.1, 1.84, MAT.gummi, 0, 0.27, 0));
    const oben = new THREE.Mesh(ebeneGeo(1.24, 1.9), MAT.band);
    oben.rotation.x = -Math.PI / 2; oben.position.y = 0.335; oben.receiveShadow = true;
    add(oben);
  } else if (typ === 'schmelze') {
    add(kasten(1.9, 0.2, 1.9, MAT.beton, 0, 0.1, 0));
    add(kasten(1.6, 1.5, 1.6, MAT.ziegel, 0, 0.95, 0));
    for (const [x, z] of [[-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78]]) add(kasten(0.14, 1.6, 0.14, MAT.dunkelMetall, x, 0.98, z));
    for (const y of [0.45, 1.45]) add(kasten(1.64, 0.08, 1.64, MAT.dunkelMetall, 0, y, 0));
    add(kasten(1.8, 0.14, 1.8, MAT.dunkelMetall, 0, 1.77, 0));
    add(dreh(rohr(0.001, 1.2, 0.5, MAT.dunkelMetall, 0, 2.09, 0, 4), 0, Math.PI / 4, 0));
    add(kasten(0.46, 1.5, 0.46, MAT.ziegel, 0.45, 2.45, -0.45));
    add(kasten(0.56, 0.12, 0.56, MAT.dunkelMetall, 0.45, 3.2, -0.45), kasten(0.52, 0.06, 0.52, MAT.dunkelMetall, 0.45, 2.6, -0.45));
    u.rauch = [0.45, 3.35, -0.45];
    const glut = mat(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 0.3 });
    add(kasten(0.8, 0.6, 0.05, glut, 0, 0.95, 0.81));
    for (let k = 0; k < 5; k++) add(kasten(0.04, 0.6, 0.06, MAT.schwarz, -0.32 + k * 0.16, 0.95, 0.835));
    add(kasten(0.96, 0.08, 0.1, MAT.dunkelMetall, 0, 1.29, 0.83), kasten(0.96, 0.08, 0.1, MAT.dunkelMetall, 0, 0.61, 0.83));
    const leuchten = new THREE.Mesh(ebeneGeo(1.4, 1.0), new THREE.MeshBasicMaterial({ color: 0xff7a1a, map: TEX.rauch, transparent: true, opacity: 0.3, depthWrite: false }));
    leuchten.rotation.x = -Math.PI / 2; leuchten.position.set(0, 0.21, 1.05); add(leuchten);
    u.glut = glut; u.glutBoden = leuchten.material;
    add(dreh(rohr(0.45, 0.2, 0.45, MAT.metall, -0.45, 2.3, -0.45, 4), 0, Math.PI / 4, 0)); // Einfüll-Trichter
    add(rohr(0.07, 0.07, 1.3, MAT.rotRohr, 0.86, 1.0, 0.35, 8), rohr(0.07, 0.07, 1.3, MAT.rotRohr, 0.86, 1.0, -0.1, 8));
    add(rohr(0.11, 0.11, 0.06, MAT.dunkelMetall, 0.86, 0.6, 0.35, 8), rohr(0.11, 0.11, 0.06, MAT.dunkelMetall, 0.86, 1.4, -0.1, 8));
    add(dreh(kasten(0.55, 0.05, 0.6, MAT.metall, 0, 0.4, 1.0), 0.25, 0, 0));
    add(dreh(kasten(0.05, 0.18, 0.6, MAT.gelb, 0.28, 0.48, 1.0), 0.25, 0, 0), dreh(kasten(0.05, 0.18, 0.6, MAT.gelb, -0.28, 0.48, 1.0), 0.25, 0, 0));
  } else if (typ === 'hub') {
    add(kasten(1.98, 0.25, 1.98, MAT.gitter, 0, 0.125, 0));
    add(kasten(1.7, 2.2, 1.7, MAT.hubWand, 0, 1.35, 0));
    for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) add(kasten(0.12, 2.3, 0.12, MAT.gelb, x, 1.4, z));
    const fenster = mat(0x9fe0ff, { emissive: 0x3aa0ff, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3 });
    const [c, gx] = leinwand(256, 128);
    const anzeigeTex = new THREE.CanvasTexture(c); anzeigeTex.colorSpace = THREE.SRGBColorSpace;
    const anzeigeMat = new THREE.MeshBasicMaterial({ map: anzeigeTex });
    for (let k = 0; k < 4; k++) {
      const h = new THREE.Group(); h.rotation.y = k * Math.PI / 2; add(h);
      h.add(kasten(1.2, 0.32, 0.04, fenster, 0, 2.15, 0.86));
      h.add(kasten(0.8, 0.42, 0.05, MAT.schwarz, 0, 0.62, 0.86));
      h.add(kasten(0.96, 0.07, 0.07, MAT.warn, 0, 0.87, 0.87), kasten(0.96, 0.07, 0.07, MAT.warn, 0, 0.38, 0.87));
      const bild = new THREE.Mesh(ebeneGeo(1.0, 0.5), anzeigeMat); bild.position.set(0, 1.45, 0.875); h.add(bild);
      h.add(kasten(1.1, 0.6, 0.03, MAT.dunkel, 0, 1.45, 0.86));
    }
    u.anzeige = { gx, tex: anzeigeTex, text: '' };
    add(kasten(1.98, 0.15, 1.98, MAT.dunkelMetall, 0, 2.52, 0));
    for (let k = 0; k < 4; k++) { // Geländer
      const h = new THREE.Group(); h.rotation.y = k * Math.PI / 2; add(h);
      h.add(kasten(1.9, 0.05, 0.05, MAT.gelb, 0, 2.95, 0.93));
      for (const x of [-0.93, 0, 0.93]) h.add(kasten(0.05, 0.4, 0.05, MAT.gelb, x, 2.78, 0.93));
    }
    const schuessel = new THREE.Group(); schuessel.position.set(0.45, 2.6, 0.45); add(schuessel);
    schuessel.add(rohr(0.04, 0.05, 0.5, MAT.metall, 0, 0.25, 0, 8));
    const teller = new THREE.Mesh(geo('teller', () => new THREE.SphereGeometry(0.38, 18, 8, 0, Math.PI * 2, 0, 0.9)), MAT.weiss);
    teller.position.y = 0.6; teller.rotation.x = 2.2; teller.castShadow = true; schuessel.add(teller);
    schuessel.add(dreh(rohr(0.015, 0.015, 0.4, MAT.metall, 0, 0.72, 0.12, 4), 0.9, 0, 0));
    u.schuessel = schuessel;
    add(rohr(0.04, 0.06, 1.4, MAT.metall, -0.5, 3.3, -0.5, 6));
    const blink = kugel(0.1, mat(0xff3030, { emissive: 0xff0000, emissiveIntensity: 1 }), -0.5, 4.05, -0.5);
    add(blink); u.blink = blink.material;
    const s = schild('HUB'); s.position.y = 4.9; add(s);
  } else if (typ === 'schleuder') {
    add(rohr(0.92, 0.97, 0.12, MAT.dunkelMetall, 0, 0.06, 0, 8));
    add(rohr(0.95, 0.95, 0.03, MAT.warn, 0, 0.135, 0, 8));
    const federGeo = geo('feder', () => new THREE.TorusGeometry(0.1, 0.02, 5, 12));
    for (const [x, z] of [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]]) for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(federGeo, MAT.chrom); f.rotation.x = Math.PI / 2; f.position.set(x, 0.15 + k * 0.035, z); add(f);
    }
    const pad = new THREE.Group(); pad.position.y = 0.26; add(pad);
    pad.add(rohr(0.8, 0.82, 0.07, MAT.gruen, 0, 0, 0, 24));
    const pfeile = new THREE.Mesh(ebeneGeo(0.9, 0.9), new THREE.MeshBasicMaterial({ map: TEX.pfeil, transparent: true, depthWrite: false }));
    pfeile.rotation.x = -Math.PI / 2; pfeile.rotation.z = Math.PI; pfeile.position.y = 0.04; pad.add(pfeile);
    const ring = new THREE.Mesh(geo('schleuderring', () => new THREE.TorusGeometry(0.8, 0.035, 6, 32)), mat(0x9dffc4, { emissive: 0x3dff8a, emissiveIntensity: 1 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; pad.add(ring);
    u.pad = pad; u.ring = ring.material;
  } else if (typ === 'turm') {
    add(rohr(0.75, 0.85, 0.15, MAT.dunkelMetall, 0, 0.075, 0, 8));
    for (let k = 0; k < 3; k++) {
      const h = new THREE.Group(); h.rotation.y = k * Math.PI * 2 / 3; add(h);
      h.add(dreh(kasten(0.1, 1.5, 0.1, MAT.dunkelMetall, 0, 0.75, 0.38), -0.42, 0, 0));
    }
    add(rohr(0.15, 0.2, 2.0, MAT.metall, 0, 1.1, 0, 10));
    add(rohr(0.28, 0.28, 0.12, MAT.dunkelMetall, 0, 1.98, 0, 12));
    add(kasten(0.5, 0.3, 0.4, MAT.oliv, 0.55, 0.3, 0.3), kasten(0.52, 0.04, 0.42, MAT.dunkel, 0.55, 0.46, 0.3));
    BALL_FARBEN.forEach((c, k) => add(kugel(0.09, mat(c, { roughness: 0.3 }), 0.43 + (k % 2) * 0.22, 0.53, 0.22 + Math.floor(k / 2) * 0.17)));
    const kopf = new THREE.Group(); kopf.position.y = 2.3; add(kopf);
    const koerper = kugel(0.4, MAT.rot); koerper.scale.set(1, 0.72, 1.15); kopf.add(koerper);
    const guertel = new THREE.Mesh(geo('turmring', () => new THREE.TorusGeometry(0.4, 0.04, 6, 20)), MAT.dunkelMetall);
    guertel.rotation.x = Math.PI / 2; kopf.add(guertel);
    const laeufe = new THREE.Group(); kopf.add(laeufe);
    for (const x of [-0.15, 0.15]) {
      laeufe.add(dreh(rohr(0.075, 0.075, 0.8, MAT.dunkelMetall, x, 0, 0.55, 10), Math.PI / 2, 0, 0));
      laeufe.add(dreh(rohr(0.1, 0.1, 0.1, MAT.chrom, x, 0, 0.95, 10), Math.PI / 2, 0, 0));
    }
    kopf.add(kugel(0.08, mat(0xff2020, { emissive: 0xff0000, emissiveIntensity: 1.5 }), 0, 0.17, 0.38));
    kopf.add(rohr(0.02, 0.02, 0.3, MAT.metall, -0.2, 0.38, -0.1, 4));
    u.kopf = kopf; u.laeufe = laeufe;
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
  const erz = erzFelsen.get(key(i, j));
  b.gruppe = bauModell(typ, typ === 'bohrer' && erz ? erz.art : null);
  b.bauT = 0;
  dekoZeigen(i, j, false);
  if (typ === 'bohrer' && erz) erz.gruppe.visible = false;
  b.gruppe.position.set(b.x, 0, b.z);
  b.gruppe.rotation.y = DIR_WINKEL[dir];
  szene.add(b.gruppe);
  zellen.set(key(i, j), b);
  gebaeude.push(b);
  if (typ === 'bohrer') { b.erz = erz.art + 'erz'; b.rein = erz.rein; }
  return b;
}

function abreissen(b, zurueckgeben) {
  for (const it of b.items) szene.remove(it.mesh);
  szene.remove(b.gruppe);
  zellen.delete(key(b.i, b.j));
  gebaeude = gebaeude.filter(x => x !== b);
  dekoZeigen(b.i, b.j, true);
  anAlle({ t: 'weg', i: b.i, j: b.j });
  const erz = erzFelsen.get(key(b.i, b.j));
  if (erz) erz.gruppe.visible = true;
  for (let k = 0; k < 8; k++) rauch(b.x + rnd(-0.8, 0.8), rnd(0.3, 1.5), b.z + rnd(-0.8, 0.8), 0x777777, 1.2, 2, 1.5, 0.8);
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
  if (istGast()) return;   // das Lager zählt nur der Chef
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
      it.mesh.position.set(b.x + dx * (it.p - 0.5) * G, ITEMS[it.art].barren ? 0.41 : 0.5, b.z + dz * (it.p - 0.5) * G);
      it.mesh.rotation.y = DIR_WINKEL[b.dir];
    }
    const vorne = b.items[0];
    if (vorne && vorne.p >= 1) {
      const z = nachbarZelle(b);
      if (z && nimm(z, vorne.art, b.dir)) { szene.remove(vorne.mesh); b.items.shift(); }
    }
  } else if (b.typ === 'bohrer') {
    b.arbeitet = b.puffer.length < 3;
    if (b.arbeitet) {
      b.t += dt;
      if (b.t >= BOHR_ZEIT / (b.rein ? 2 : 1)) { b.t = 0; b.puffer.push(b.erz); }
      b.effektT = (b.effektT || 0) - dt;
      if (b.effektT <= 0) {
        b.effektT = rnd(0.25, 0.5);
        staub(b.x + rnd(-0.4, 0.4), b.z + rnd(-0.4, 0.4), 1);
        puff(b.x, 0.35, b.z, b.erz === 'eisenerz' ? 0xff7a40 : 0xffb050, 2, { leucht: true, groesse: 0.35, leben: 0.35, tempo: 0.6 });
      }
    }
    ausgeben(b);
  } else if (b.typ === 'schmelze') {
    b.arbeitet = b.ein.length > 0 && b.puffer.length < 4;
    if (b.arbeitet) {
      b.t += dt;
      if (b.t >= SCHMELZ_ZEIT) { b.t = 0; b.puffer.push(b.ein.shift() === 'eisenerz' ? 'eisenbarren' : 'kupferbarren'); }
      b.effektT = (b.effektT || 0) - dt;
      if (b.effektT <= 0) {
        b.effektT = 0.22;
        const [x, y, z] = gebaeudePunkt(b, b.gruppe.userData.rauch);
        rauch(x, y, z, 0x5a5a5e, 0.5, 2.2, 2.6, 1.4, 0.6);
        if (Math.random() < 0.3) { const [fx, fy, fz] = gebaeudePunkt(b, [0, 0.95, 0.9]); puff(fx, fy, fz, 0xffa030, 2, { leucht: true, groesse: 0.25, leben: 0.4, tempo: 0.5 }); }
      }
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
      if (b.cd <= 0) { b.cd = hat('tuerme') ? 0.45 : 0.9; b.rueckstoss = 1; ballSchiessen(start.addScaledVector(richtung, 1.0), richtung, 2, { deko: istGast() }); rauch(start.x, start.y, start.z, 0xffffff, 0.3, 0.8, 0.5, 0.3, 0.5); }
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
  boss:    { anzug: 0x7d3fbf, hose: 0x3d2060, haut: 0x5a2d8a, helm: 0x39ff6a, kopf: 'roboter', extra: ['stacheln', 'hoerner'] },
  kanone:  { anzug: 0x30343f, hose: 0x1e2028, haut: 0x454a55, helm: 0xff2a2a, kopf: 'roboter', extra: ['kanone'] },
  huepfer: { anzug: 0x2fa84f, hose: 0x1d6b33, haut: 0x3c8f50, helm: 0xffee33, kopf: 'roboter', extra: ['duesen'] },
  blitz:   { anzug: 0x1e7fd8, hose: 0x174f8a, haut: 0x2a6bb0, helm: 0x66ffff, kopf: 'roboter', extra: ['blitz'] },
  riese:   { anzug: 0x8a1c1c, hose: 0x4a0e0e, haut: 0x6a1515, helm: 0xffaa00, kopf: 'roboter', extra: ['stacheln', 'krone'] },
};
const alsText = c => '#' + new THREE.Color(c).getHexString();
function figurMaterialien(a) { // Materialien nur einmal pro Aussehen bauen
  if (a._m) return a._m;
  const robo = a.kopf === 'roboter';
  const dunkler = new THREE.Color(a.anzug).multiplyScalar(0.6);
  a._m = {
    anzug: robo ? mat(0xffffff, { map: roboterTextur(alsText(a.anzug), 'rgba(140,70,20,0.7)'), metalness: 0.5, roughness: 0.5 })
                : mat(0xffffff, { map: stoffTextur(alsText(a.anzug)), roughness: 0.85 }),
    bein: robo ? mat(0xffffff, { map: roboterTextur(alsText(a.hose), 'rgba(120,60,20,0.6)'), metalness: 0.5, roughness: 0.55 })
               : mat(0xffffff, { map: stoffTextur(alsText(a.hose)), roughness: 0.9 }),
    kopf: robo ? mat(0xffffff, { map: roboterTextur(alsText(a.haut), 'rgba(140,70,20,0.6)'), metalness: 0.5, roughness: 0.45 }) : null,
    haut: mat(a.haut, { roughness: 0.6 }),
    helm: mat(a.helm, { roughness: 0.35 }),
    leucht: mat(a.helm, { emissive: a.helm, emissiveIntensity: 2.2 }),
    panzer: mat(dunkler.clone().multiplyScalar(1.3), { metalness: 0.6, roughness: 0.4 }),
    dunkler: mat(dunkler, { roughness: 0.8 }),
    handschuh: mat(0x3d3f44, { roughness: 0.9 }), stiefel: mat(0x5a3b22, { roughness: 0.85 }), guertel: mat(0x4a3020, { roughness: 0.7 }),
    dunkelOliv: mat(0x434f22), haare: mat(0x5a3a1a), backen: mat(0xff9a8a, { roughness: 0.8 }), mund: mat(0x8a3a3a),
    lampe: mat(0xffffee, { emissive: 0xffffcc, emissiveIntensity: 2 }), antenne: mat(0xff3030, { emissive: 0xff0000, emissiveIntensity: 1.5 }),
    horn: mat(0xe8e0c8, { roughness: 0.5 }),
  };
  return a._m;
}

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
    this.staubZeit = 0;
    const M = figurMaterialien(aussehen), robo = aussehen.kopf === 'roboter', extra = aussehen.extra || [];
    const K = (b, h, t, m, x = 0, y = 0, z = 0) => kasten(b * s, h * s, t * s, m, x * s, y * s, z * s);
    const Z = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 10) => rohr(r1 * s, r2 * s, h * s, m, x * s, y * s, z * s, seg);
    const Ku = (r, m, x = 0, y = 0, z = 0) => kugel(r * s, m, x * s, y * s, z * s);
    const dreh = (o, rx, ry, rz) => { o.rotation.set(rx, ry, rz); return o; };

    // Arme und Beine
    this.glieder = [];
    const glied = (a, b, r, m) => {
      const len = ruheAbstand(a, b) * s;
      const mesh = new THREE.Mesh(geo(`kap${r * s},${len}`, () => new THREE.CapsuleGeometry(r * s, len, 4, 10)), m);
      mesh.castShadow = true; this.gruppe.add(mesh); this.glieder.push([I[a], I[b], mesh, len]);
    };
    const R = robo ? 1.15 : 1;
    glied('lS', 'lE', 0.075 * R, M.anzug); glied('lE', 'lHa', 0.068 * R, M.anzug);
    glied('rS', 'rE', 0.075 * R, M.anzug); glied('rE', 'rHa', 0.068 * R, M.anzug);
    glied('lH', 'lK', 0.1 * R, M.bein); glied('lK', 'lF', 0.088 * R, M.bein);
    glied('rH', 'rK', 0.1 * R, M.bein); glied('rK', 'rF', 0.088 * R, M.bein);
    // Gelenke: Knieschoner / Roboter-Gelenke
    this.kugeln = [];
    const gelenk = (n, r, m) => { const k = Ku(r, m); this.gruppe.add(k); this.kugeln.push([I[n], k]); };
    if (robo) for (const n of ['lE', 'rE', 'lK', 'rK']) gelenk(n, 0.1, MAT.dunkelMetall);
    else for (const n of ['lK', 'rK']) gelenk(n, 0.105, M.dunkler);
    if (robo) for (const n of ['lS', 'rS', 'lH', 'rH']) gelenk(n, 0.095, MAT.dunkelMetall);

    // Hände und Füße drehen sich mit dem Körper mit
    this.enden = [];
    const ende = (n, obj) => { obj.traverse(o => { o.castShadow = true; }); this.gruppe.add(obj); this.enden.push([I[n], obj]); };
    for (const n of ['lHa', 'rHa']) {
      const h = new THREE.Group();
      if (robo) {
        h.add(K(0.15, 0.1, 0.13, MAT.dunkelMetall));
        for (const x of [-0.045, 0, 0.045]) h.add(dreh(K(0.03, 0.11, 0.03, MAT.metall, x, -0.08, 0.04), 0.4, 0, 0));
      } else {
        h.add(Ku(0.085, M.handschuh));
        h.add(K(0.05, 0.05, 0.08, M.handschuh, (n === 'lHa' ? -0.06 : 0.06), 0.02, 0.04));
      }
      ende(n, h);
    }
    for (const n of ['lF', 'rF']) {
      const f = new THREE.Group();
      if (robo) {
        f.add(K(0.21, 0.12, 0.33, MAT.dunkelMetall, 0, -0.02, 0.06));
        f.add(K(0.22, 0.06, 0.1, MAT.warn, 0, 0.0, 0.2));
      } else {
        f.add(K(0.17, 0.13, 0.3, M.stiefel, 0, -0.02, 0.05));
        f.add(K(0.18, 0.04, 0.31, MAT.schwarz, 0, -0.08, 0.05));
        f.add(K(0.175, 0.04, 0.05, MAT.gelb, 0, 0.03, -0.08));
      }
      ende(n, f);
    }

    // Körper
    const k = this.koerper = new THREE.Group();
    if (robo) {
      k.add(K(0.52, 0.62, 0.32, M.anzug));
      k.add(K(0.4, 0.3, 0.04, MAT.dunkelMetall, 0, 0.1, 0.17));
      k.add(dreh(Z(0.085, 0.085, 0.04, M.leucht, 0, 0.1, 0.2, 14), Math.PI / 2, 0, 0));
      k.add(dreh(new THREE.Mesh(geo(`kern${s}`, () => new THREE.TorusGeometry(0.1 * s, 0.018 * s, 6, 16)), MAT.chrom), 0, 0, 0));
      k.children[k.children.length - 1].position.set(0, 0.1 * s, 0.2 * s);
      for (const y of [-0.1, -0.16]) k.add(K(0.3, 0.035, 0.02, MAT.schwarz, 0, y, 0.165));
      for (const x of [-0.3, 0.3]) {
        k.add(dreh(K(0.22, 0.12, 0.32, M.panzer, x, 0.3, 0), 0, 0, x > 0 ? -0.3 : 0.3));
        k.add(Z(0.045, 0.05, 0.3, MAT.dunkelMetall, x * 0.4, 0.2, -0.19, 8));
        k.add(Z(0.055, 0.055, 0.04, MAT.schwarz, x * 0.4, 0.36, -0.19, 8));
      }
      k.add(K(0.44, 0.1, 0.28, MAT.dunkelMetall, 0, -0.27, 0));
      if (extra.includes('stacheln')) {
        for (const x of [-0.32, 0.32]) for (const z of [-0.08, 0.08]) k.add(dreh(Z(0.001, 0.06, 0.28, M.horn, x, 0.48, z, 6), 0, 0, x > 0 ? -0.3 : 0.3));
        for (const y of [0.2, 0.0, -0.2]) k.add(dreh(Z(0.001, 0.06, 0.22, M.horn, 0, y, -0.25, 6), -Math.PI / 2, 0, 0));
      }
      if (extra.includes('kanone')) for (const x of [-0.3, 0.3]) { // zwei Schulter-Kanonen
        k.add(K(0.2, 0.2, 0.26, MAT.dunkelMetall, x, 0.46, 0));
        k.add(dreh(Z(0.08, 0.1, 0.6, MAT.dunkelMetall, x, 0.5, 0.25, 10), Math.PI / 2, 0, 0));
        k.add(dreh(Z(0.11, 0.11, 0.08, MAT.warn, x, 0.5, 0.05, 10), Math.PI / 2, 0, 0));
        k.add(dreh(Z(0.07, 0.07, 0.03, M.leucht, x, 0.5, 0.56, 10), Math.PI / 2, 0, 0));
      }
      if (extra.includes('duesen')) for (const x of [-0.13, 0.13]) { // Sprung-Düsen
        k.add(Z(0.08, 0.06, 0.28, MAT.dunkelMetall, x, -0.02, -0.25, 10));
        k.add(Ku(0.065, M.leucht, x, -0.19, -0.25));
      }
      if (extra.includes('blitz')) for (let n = 0; n < 3; n++) { // Blitz-Zacken
        k.add(dreh(K(0.04, 0.24, 0.14, M.leucht, 0, 0.22 - n * 0.18, -0.23), (n % 2 ? 0.5 : -0.5), 0, 0));
      }
    } else {
      k.add(K(0.5, 0.62, 0.3, M.anzug));
      for (const y of [0.12, -0.02]) k.add(K(0.51, 0.05, 0.31, MAT.reflex, 0, y, 0));
      k.add(K(0.03, 0.5, 0.01, MAT.dunkel, 0, 0.02, 0.155));
      k.add(K(0.32, 0.07, 0.24, M.dunkler, 0, 0.33, 0));
      for (const x of [-0.24, 0.24]) k.add(K(0.14, 0.06, 0.22, M.dunkler, x, 0.29, 0));
      k.add(K(0.52, 0.08, 0.32, M.guertel, 0, -0.24, 0));
      k.add(K(0.08, 0.06, 0.02, MAT.gold, 0, -0.24, 0.165));
      for (const x of [-0.19, 0.19]) k.add(K(0.1, 0.12, 0.08, MAT.oliv, x, -0.27, 0.14));
      k.add(K(0.1, 0.06, 0.01, MAT.weiss, -0.13, 0.2, 0.155));
      // Rucksack mit Tank und Antenne
      k.add(K(0.36, 0.42, 0.16, MAT.oliv, 0, 0.03, -0.23));
      k.add(K(0.37, 0.12, 0.17, M.dunkelOliv, 0, 0.2, -0.235));
      k.add(Z(0.07, 0.07, 0.42, MAT.chrom, 0.2, 0.03, -0.3, 10), Z(0.04, 0.04, 0.06, MAT.rot, 0.2, 0.27, -0.3, 8));
      k.add(Z(0.01, 0.01, 0.35, MAT.dunkel, -0.13, 0.38, -0.26, 4));
      k.add(Ku(0.028, M.antenne, -0.13, 0.56, -0.26));
    }

    // Kopf
    const h = this.kopf = new THREE.Group();
    if (robo) {
      h.add(K(0.38, 0.32, 0.34, M.kopf));
      h.add(K(0.32, 0.12, 0.02, MAT.schwarz, 0, 0.03, 0.17));
      for (const x of [-0.08, 0.08]) h.add(K(0.09, 0.05, 0.02, M.leucht, x, 0.03, 0.18));
      h.add(K(0.24, 0.08, 0.02, MAT.gitter, 0, -0.09, 0.172));
      for (const x of [-0.2, 0.2]) h.add(dreh(Z(0.06, 0.06, 0.04, MAT.dunkelMetall, x, 0, 0, 10), 0, 0, Math.PI / 2));
      h.add(Z(0.015, 0.015, 0.25, MAT.metall, 0.1, 0.28, -0.05, 4));
      h.add(Ku(0.04, M.leucht, 0.1, 0.42, -0.05));
      if (extra.includes('hoerner')) for (const x of [-0.16, 0.16]) h.add(dreh(Z(0.001, 0.07, 0.3, M.horn, x, 0.27, 0, 6), 0, 0, x > 0 ? -0.5 : 0.5));
      if (extra.includes('krone')) {
        h.add(K(0.4, 0.06, 0.36, MAT.gold, 0, 0.19, 0));
        for (const [x, z] of [[-0.15, -0.13], [0.15, -0.13], [-0.15, 0.13], [0.15, 0.13], [0, 0.15]]) h.add(Z(0.001, 0.045, 0.16, MAT.gold, x, 0.3, z, 4));
        h.add(Ku(0.04, M.leucht, 0, 0.24, 0.19));
      }
      if (extra.includes('kanone')) h.add(K(0.4, 0.06, 0.06, MAT.warn, 0, 0.13, 0.15));
      if (extra.includes('blitz')) h.add(dreh(K(0.04, 0.2, 0.2, M.leucht, 0, 0.25, 0), 0.3, 0, 0));
    } else {
      h.add(Ku(0.2, M.haut));
      for (const x of [-0.075, 0.075]) {
        h.add(Ku(0.045, MAT.weiss, x, 0.0, 0.16));
        h.add(Ku(0.025, MAT.schwarz, x, 0.0, 0.2));
        h.add(K(0.07, 0.015, 0.02, M.haare, x, 0.07, 0.18));
        h.add(Ku(0.03, M.backen, x * 1.6, -0.06, 0.15));
      }
      h.add(Ku(0.03, M.haut, 0, -0.04, 0.2));
      h.add(K(0.08, 0.015, 0.02, M.mund, 0, -0.1, 0.18));
      const helm = new THREE.Mesh(geo(`helm${s}`, () => new THREE.SphereGeometry(0.235 * s, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)), M.helm);
      helm.position.y = 0.03 * s; h.add(helm);
      h.add(Z(0.275, 0.275, 0.025, M.helm, 0, 0.03, 0.03, 20));
      h.add(K(0.05, 0.05, 0.4, M.helm, 0, 0.25, 0));
      h.add(dreh(Z(0.045, 0.045, 0.06, MAT.dunkel, 0, 0.13, 0.22, 10), Math.PI / 2, 0, 0));
      h.add(Ku(0.035, M.lampe, 0, 0.13, 0.25));
    }
    for (const t of [k, h]) { t.traverse(o => { o.castShadow = true; }); this.gruppe.add(t); }
  }

  mitte() { // Mitte vom Bauch
    return new THREE.Vector3().add(this.p[I.lS]).add(this.p[I.rS]).add(this.p[I.lH]).add(this.p[I.rH]).multiplyScalar(0.25);
  }
  flugTempo() { // wie schnell fliegt der Bauch (m/s)
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
        if (vy < -0.12 && zeit - this.staubZeit > 0.25) { this.staubZeit = zeit; staub(p[k].x, p[k].z, 5 * this.s); }
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
    if (this.modus === 'netz') return;   // Punkte kommen übers Internet
    if (this.modus === 'ragdoll') {
      this.simulieren();
      this.t += dt;
      if (this.tot) return;
      let ruhig = true;
      for (let k = 0; k < 13; k++) if (this.p[k].distanceToSquared(this.a[k]) > 0.0009) { ruhig = false; break; }
      if ((this.t > (this.aufstehZeit || 1.6) && ruhig) || this.t > 6) this.aufstehen();
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
    const blick = Math.atan2(vorn.x, vorn.z);
    _m4.makeBasis(rechts.negate(), oben, vorn);
    this.koerper.quaternion.setFromRotationMatrix(_m4);
    this.koerper.position.addVectors(mS, mH).multiplyScalar(0.5);
    this.kopf.quaternion.copy(this.koerper.quaternion);
    this.kopf.position.copy(p[I.kopf]);
    for (const [i, obj] of this.enden) { obj.position.copy(p[i]); obj.rotation.set(0, blick, 0); }
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
    const h = hindernisse.get(key(i, j)); if (h) liste.push(h);
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
  const imWasser = f.pos.y < 0.3 && imSee(f.pos.x, f.pos.z);
  if (imWasser) { // im Wasser geht's langsamer – und es spritzt!
    f.vel.x *= 1 - 5 * dt; f.vel.z *= 1 - 5 * dt;
    if (Math.hypot(f.vel.x, f.vel.z) > 1 && Math.random() < dt * 10) rauch(f.pos.x + rnd(-0.3, 0.3), 0.2, f.pos.z + rnd(-0.3, 0.3), 0xd8f0ff, 0.4, 0.9, 0.6, 1.2, 0.7);
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
  b.knall = 1;
  staub(b.x, b.z, 8);
  puff(b.x, 0.4, b.z, 0x3dff8a, 12, { leucht: true, groesse: 0.4, leben: 0.6 });
  SOUND.wusch();
}

// ================= SPIELER =================
const spieler = new Figur(AUSSEHEN.spieler, 1);
spieler.hp = SPIELER_LEBEN;
spieler.pos.set(0, 0, G * 1.5);
spieler.sofortStehen();
let kamYaw = 0, kamPitch = -0.25, schussCD = 0, zeit = 0, getroffenT = 0;

function spielerUpdate(dt) {
  const taste = pausiert ? {} : TASTEN;
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
    f.staubLauf = (f.staubLauf || 0) - dt;
    if (f.aufBoden && Math.hypot(f.vel.x, f.vel.z) > 8 && f.staubLauf <= 0) { f.staubLauf = 0.12; staub(f.pos.x, f.pos.z, 1); }
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
const BALL_MATS = BALL_FARBEN.map(c => mat(c, { roughness: 0.3, emissive: c, emissiveIntensity: 0.25 }));
const BOWLING_MAT = mat(0x6a2bd8, { roughness: 0.15, metalness: 0.3, emissive: 0x2a0a60, emissiveIntensity: 0.5 });
let baelle = [], raketen = [], blitze = [];

// ================= WAFFEN =================
// cd = Wartezeit zwischen zwei Schüssen (Sekunden). sperre = welcher Meilenstein sie freischaltet
const WAFFEN = [
  { id: 'ball',    name: 'Ball-Kanone',    emoji: '🔫', cd: 0.28, info: 'Bunte Gummibälle' },
  { id: 'schrot',  name: 'Plopp-Schrot',   emoji: '💥', cd: 0.8,  info: '8 Bälle auf einmal', sperre: 'schmelze' },
  { id: 'rakete',  name: 'Raketenwerfer',  emoji: '🚀', cd: 1.2,  info: 'BUMM! Auch Raketen-Sprung möglich', sperre: 'boss1' },
  { id: 'minigun', name: 'Ball-Minigun',   emoji: '🌀', cd: 0.07, info: 'Maus gedrückt halten!', sperre: 'baender' },
  { id: 'bowling', name: 'Bowling-Werfer', emoji: '🎳', cd: 0.9,  info: 'Rollt durch alle Roboter durch', sperre: 'rein' },
  { id: 'blitz',   name: 'Blitz-Werfer',   emoji: '⚡', cd: 0.8,  info: 'Springt von Roboter zu Roboter', sperre: 'kupfer100' },
];
let waffeNr = 0;
const waffeFrei = w => !w.sperre || hat(w.sperre);
function waffeWechseln(schritt = 1) {
  for (let k = 1; k <= WAFFEN.length; k++) {
    const n = (waffeNr + k * schritt + WAFFEN.length * 2) % WAFFEN.length;
    if (waffeFrei(WAFFEN[n])) { waffeNr = n; break; }
  }
  werkzeugWaehlen('hand');
  waffenModellZeigen();
  meldung(`${WAFFEN[waffeNr].emoji} ${WAFFEN[waffeNr].name}`, 1);
}
const schadenMal = () => (hat('boss3') ? 2 : 1);

// Waffen-Modelle in der rechten Hand
const waffenModelle = {};
function waffenModelleBauen(hand) {
  const D = (o, rx, ry, rz) => { o.rotation.set(rx, ry, rz); return o; };
  const lauf = (r, l, m, x, y, z) => D(rohr(r, r, l, m, x, y, z, 10), Math.PI / 2, 0, 0);
  const neu = id => { const g = new THREE.Group(); g.position.set(0, 0.02, 0.12); hand.add(g); waffenModelle[id] = g; return g; };
  let g = neu('ball');
  g.add(kasten(0.12, 0.14, 0.34, mat(0xff8c1a), 0, 0, 0.1), lauf(0.05, 0.3, MAT.dunkelMetall, 0, 0.02, 0.38));
  g.add(kasten(0.06, 0.14, 0.08, MAT.dunkel, 0, -0.12, 0.02), kugel(0.07, BALL_MATS[0], 0, 0.12, 0.08));
  g = neu('schrot');
  g.add(kasten(0.2, 0.12, 0.3, mat(0x2a9df4), 0, 0, 0.08));
  for (const x of [-0.06, 0, 0.06]) g.add(lauf(0.035, 0.32, MAT.dunkelMetall, x, 0.02, 0.36));
  g.add(kasten(0.06, 0.14, 0.08, MAT.dunkel, 0, -0.12, 0.0));
  g = neu('rakete');
  g.add(lauf(0.1, 0.9, mat(0x4f7a2a), 0, 0.12, 0.15), lauf(0.11, 0.06, MAT.gelb, 0, 0.12, 0.58));
  g.add(D(rohr(0.001, 0.09, 0.16, MAT.rot, 0, 0.12, 0.66, 10), Math.PI / 2, 0, 0));
  g.add(kasten(0.05, 0.14, 0.06, MAT.dunkel, 0, -0.02, 0.05), kasten(0.08, 0.06, 0.12, MAT.dunkel, 0.08, 0.22, 0.1));
  g = neu('minigun');
  g.add(kasten(0.18, 0.18, 0.3, MAT.dunkelMetall, 0, 0, 0.05), kasten(0.06, 0.14, 0.08, MAT.dunkel, 0, -0.14, 0));
  const dreh = new THREE.Group(); dreh.position.z = 0.4; g.add(dreh); g.userData.dreh = dreh;
  for (let k = 0; k < 6; k++) { const w = k / 6 * Math.PI * 2; dreh.add(lauf(0.025, 0.45, MAT.chrom, Math.cos(w) * 0.06, Math.sin(w) * 0.06, 0)); }
  dreh.add(lauf(0.1, 0.04, MAT.gelb, 0, 0, 0.18));
  g = neu('bowling');
  g.add(kasten(0.22, 0.2, 0.36, mat(0x8a2be2), 0, 0, 0.1), D(rohr(0.17, 0.17, 0.1, MAT.dunkelMetall, 0, 0, 0.32, 16), Math.PI / 2, 0, 0));
  g.add(kugel(0.14, BOWLING_MAT, 0, 0, 0.34), kasten(0.06, 0.14, 0.08, MAT.dunkel, 0, -0.16, 0));
  g = neu('blitz');
  g.add(kasten(0.12, 0.12, 0.3, MAT.dunkelMetall, 0, 0, 0.05), kasten(0.06, 0.14, 0.08, MAT.dunkel, 0, -0.12, 0));
  const spule = mat(0xc87533, { metalness: 0.8, roughness: 0.3 });
  for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(geo('spule', () => new THREE.TorusGeometry(0.07, 0.02, 6, 14)), spule); t.position.z = 0.24 + k * 0.06; g.add(t); }
  g.add(kugel(0.06, mat(0x9ff7ff, { emissive: 0x33ddff, emissiveIntensity: 2 }), 0, 0, 0.48));
  for (const m of Object.values(waffenModelle)) m.traverse(o => { o.castShadow = true; });
}
function waffenModellZeigen() {
  for (const [id, m] of Object.entries(waffenModelle)) m.visible = werkzeug === 'hand' && id === WAFFEN[waffeNr].id;
}

function ballSchiessen(start, richtung, schaden = 1, { tempo = BALL_TEMPO, leben = 2.5, groesse = 1, durch = false, stoss = 1, matr = null, deko = false } = {}) {
  const m = new THREE.Mesh(BALL_GEO, matr || BALL_MATS[Math.floor(Math.random() * 4)]);
  m.scale.setScalar(groesse); m.castShadow = true; szene.add(m);
  baelle.push({ mesh: m, pos: start.clone(), vel: richtung.clone().multiplyScalar(tempo), t: leben, verbraucht: false,
    schaden: schaden * schadenMal(), r: 0.18 * groesse, durch, stoss, deko, getroffen: new Set() });
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
    if (b.pos.y < b.r) {
      b.pos.y = b.r;
      if (b.durch) { b.vel.y = Math.abs(b.vel.y) > 3 ? -b.vel.y * 0.3 : 0; b.vel.x *= 0.995; b.vel.z *= 0.995; } // Bowlingkugel rollt
      else { b.vel.y *= -0.6; b.vel.x *= 0.85; b.vel.z *= 0.85; }
    }
    if (b.durch) b.mesh.rotation.x += Math.hypot(b.vel.x, b.vel.z) * dt / b.r;
    const geb = zellen.get(key(zelleVon(b.pos.x), zelleVon(b.pos.z)));
    if (geb && b.pos.y < geb.box.y2 && b.pos.x > geb.box.x1 && b.pos.x < geb.box.x2 && b.pos.z > geb.box.z1 && b.pos.z < geb.box.z2) {
      b.pos.addScaledVector(b.vel, -dt); b.vel.multiplyScalar(-0.4);
    }
    if (!b.verbraucht && !b.deko) {
      for (const g of gegner) {
        if (b.getroffen.has(g) || !trifft(g, b.pos, b.r)) continue;
        const n = b.vel.clone().normalize();
        gegnerTreffen(g, n.x * 11 * b.stoss / g.s, 5 * b.stoss / g.s, n.z * 11 * b.stoss / g.s, b.schaden);
        puff(b.pos.x, b.pos.y, b.pos.z, 0xffe14f, 8, { leucht: true, groesse: 0.6, leben: 0.4 });
        SOUND.klong();
        if (b.durch) { b.getroffen.add(g); continue; }   // Bowlingkugel rollt weiter!
        b.verbraucht = true; b.vel.multiplyScalar(-0.25);
        break;
      }
    }
    b.t -= dt;
    b.mesh.position.copy(b.pos);
    if (b.t <= 0) szene.remove(b.mesh);
  }
  baelle = baelle.filter(b => b.t > 0);
}

// ---------- Raketen ----------
const RAKETE_GEO = (() => {
  const k = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 10); k.rotateX(Math.PI / 2);
  const s = new THREE.ConeGeometry(0.09, 0.22, 10); s.rotateX(Math.PI / 2); s.translate(0, 0, 0.41);
  const f = new THREE.BoxGeometry(0.34, 0.03, 0.14); f.translate(0, 0, -0.24);
  const f2 = new THREE.BoxGeometry(0.03, 0.34, 0.14); f2.translate(0, 0, -0.24);
  return mergeGeometries([k.toNonIndexed(), s.toNonIndexed(), f.toNonIndexed(), f2.toNonIndexed()]);
})();
const RAKETE_MAT = mat(0xe8e8e8, { roughness: 0.4, metalness: 0.4, emissive: 0x330000 });
function raketeSchiessen(start, richtung, deko = false) {
  const m = new THREE.Mesh(RAKETE_GEO, RAKETE_MAT);
  m.position.copy(start); m.lookAt(start.clone().add(richtung)); m.castShadow = true; szene.add(m);
  raketen.push({ mesh: m, pos: start.clone(), vel: richtung.clone().multiplyScalar(34), t: 3, deko });
}
function raketenUpdate(dt) {
  for (const r of raketen) {
    r.pos.addScaledVector(r.vel, dt); r.t -= dt;
    r.mesh.position.copy(r.pos);
    rauch(r.pos.x, r.pos.y, r.pos.z, wahl([0xdddddd, 0xbbbbbb, 0xffa040]), 0.35, 1.2, 0.9, 0.2, 0.6);
    let knall = r.t <= 0 || r.pos.y < 0.15;
    const kk = key(zelleVon(r.pos.x), zelleVon(r.pos.z)), box = zellen.get(kk)?.box || hindernisse.get(kk);
    if (box && r.pos.y < box.y2 && r.pos.x > box.x1 && r.pos.x < box.x2 && r.pos.z > box.z1 && r.pos.z < box.z2) knall = true;
    if (!knall) for (const g of gegner) if (!g.tot && trifft(g, r.pos, 0.25)) { knall = true; break; }
    if (knall) { explosion(r.pos, 4.5, 6, r.deko); r.t = 0; szene.remove(r.mesh); }
  }
  raketen = raketen.filter(r => r.t > 0);
}
// Explosion: Roboter fliegen weg (und du auch, wenn du zu nah dran bist – Raketen-Sprung!)
function explosion(pos, radius, schaden, deko = false) {
  const p = pos.clone();
  SOUND.bumm(0.3);
  const ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = Math.PI / 2; ring.position.set(p.x, Math.max(0.25, p.y), p.z); szene.add(ring);
  ringe.push({ mesh: ring, t: 0, max: radius });
  puff(p.x, p.y, p.z, 0xffb030, 22, { leucht: true, groesse: 0.9, tempo: 1.4, leben: 0.6 });
  puff(p.x, p.y, p.z, 0xff4a1a, 12, { leucht: true, groesse: 0.6, tempo: 1.8, leben: 0.5 });
  for (let k = 0; k < 10; k++) rauch(p.x + rnd(-1, 1), p.y + rnd(0, 1), p.z + rnd(-1, 1), wahl([0x444444, 0x666666, 0xff8a30]), 1.2, 2.5, 1.4, 1, 0.75);
  const ds = spieler.pos.distanceTo(p);
  if (ds < 30) kameraWackeln = Math.max(kameraWackeln, 0.45 * (1 - ds / 30));
  if (deko) return;   // nur zum Anschauen (Rakete von einem Freund)
  for (const g of gegner) {
    const m = g.mitte(), d = m.distanceTo(p);
    if (d > radius + 0.5 * g.s) continue;
    const dir = m.sub(p); dir.y = 0; dir.normalize();
    const k = 1 - Math.min(1, d / (radius + 0.5 * g.s)) * 0.6;
    gegnerTreffen(g, dir.x * 14 * k / g.s, 10 * k / g.s, dir.z * 14 * k / g.s, Math.ceil(schaden * k * schadenMal()));
  }
  const sm = spieler.mitte(), dsp = sm.distanceTo(p);
  if (dsp < radius * 0.55) { // Raketen-Sprung: kein Schaden, aber du fliegst!
    const dir = sm.sub(p).normalize(), k = 1 - dsp / (radius * 0.55);
    if (spieler.modus === 'steht') spieler.sofortStehen();
    spieler.umfallen(dir.x * 12 * k, 8 + 14 * k, dir.z * 12 * k);
  }
}

// ---------- Blitz ----------
const BLITZ_MAT = new THREE.LineBasicMaterial({ color: 0x9ff7ff });
function blitzLinie(a, b) {
  const punkte = [a.clone()];
  for (let k = 1; k < 8; k++) {
    const p = a.clone().lerp(b, k / 8);
    p.x += rnd(-0.35, 0.35); p.y += rnd(-0.35, 0.35); p.z += rnd(-0.35, 0.35);
    punkte.push(p);
  }
  punkte.push(b.clone());
  const linie = new THREE.Line(new THREE.BufferGeometry().setFromPoints(punkte), BLITZ_MAT);
  szene.add(linie);
  blitze.push({ linie, t: 0.18 });
  puff(b.x, b.y, b.z, 0x9ff7ff, 6, { leucht: true, groesse: 0.4, leben: 0.3 });
}
function blitzSchiessen(start) {
  const d = blickRichtung(), auge = kamera.position;
  let ziel = null, bester = 0.3;
  for (const g of gegner) { // wer ist am nächsten am Fadenkreuz?
    if (g.tot) continue;
    const m = g.mitte(), zu = m.clone().sub(auge), weit = zu.length();
    if (weit > 40) continue;
    const winkel = zu.normalize().angleTo(d);
    if (winkel < bester) { bester = winkel; ziel = g; }
  }
  if (!ziel) { blitzLinie(start, start.clone().addScaledVector(d, 15)); return; }
  const schon = new Set();
  let von = start;
  for (let n = 0; n < 6 && ziel; n++) {
    const m = ziel.mitte();
    blitzLinie(von, m);
    schon.add(ziel);
    gegnerTreffen(ziel, rnd(-3, 3), 7 / ziel.s, rnd(-3, 3), 3 * schadenMal());
    von = m;
    let naechster = null, nd = 11;
    for (const g of gegner) {
      if (g.tot || schon.has(g)) continue;
      const dd = g.mitte().distanceTo(m);
      if (dd < nd) { nd = dd; naechster = g; }
    }
    ziel = naechster;
  }
}
function blitzeUpdate(dt) {
  for (const b of blitze) { b.t -= dt; if (b.t <= 0) { szene.remove(b.linie); b.linie.geometry.dispose(); } }
  blitze = blitze.filter(b => b.t > 0);
}

function streuen(r, s) { return r.clone().add(new THREE.Vector3(rnd(-s, s), rnd(-s, s), rnd(-s, s))).normalize(); }

let waffeRueck = 0;
function schiessen() {
  if (schussCD > 0 || spieler.modus !== 'steht') return;
  const w = WAFFEN[waffeNr];
  schussCD = w.cd;
  waffeRueck = 1;
  const f = spieler, fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
  const start = new THREE.Vector3(f.pos.x + fx * 0.8 - Math.cos(f.yaw) * 0.25, f.pos.y + 1.4, f.pos.z + fz * 0.8 + Math.sin(f.yaw) * 0.25);
  const ziel = zielPunkt(80) || kamera.position.clone().addScaledVector(blickRichtung(), 80);
  const richtung = ziel.sub(start).normalize();
  if (w.id === 'ball') {
    richtung.y += 0.04; richtung.normalize();
    ballSchiessen(start, richtung);
    if (hat('robo10')) for (const a of [-0.08, 0.08]) ballSchiessen(start, richtung.clone().applyAxisAngle(Y_ACHSE, a));
    SOUND.plopp();
    schussMelden('ball', start, richtung);
  } else if (w.id === 'schrot') {
    richtung.y += 0.03;
    for (let k = 0; k < 8; k++) ballSchiessen(start, streuen(richtung, 0.13), 1, { tempo: 26, leben: 0.9, stoss: 1.3 });
    SOUND.schrot();
    schussMelden('schrot', start, richtung);
  } else if (w.id === 'minigun') {
    richtung.y += 0.03;
    const r = streuen(richtung, 0.035);
    ballSchiessen(start, r, 1, { tempo: 38, leben: 1.6, groesse: 0.7 });
    SOUND.tack();
    schussMelden('minigun', start, r);
  } else if (w.id === 'bowling') {
    richtung.y = Math.max(richtung.y, -0.15) + 0.06; richtung.normalize();
    ballSchiessen(start, richtung, 4, { tempo: 22, leben: 4, groesse: 2.4, durch: true, stoss: 1.8, matr: BOWLING_MAT });
    SOUND.bowling();
    schussMelden('bowling', start, richtung);
  } else if (w.id === 'rakete') {
    raketeSchiessen(start, richtung);
    schussMelden('rakete', start, richtung);
    if (hat('riese')) raketeSchiessen(start.clone().addScaledVector(Y_ACHSE, 0.4), richtung.clone().applyAxisAngle(Y_ACHSE, 0.06));
    SOUND.rakete();
  } else if (w.id === 'blitz') {
    blitzSchiessen(start);
    SOUND.blitz();
  }
}

function schlagen() {
  const f = spieler;
  if (f.modus !== 'steht' || f.schlag > 0.3) return;
  f.schlag = 1;
  const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
  const mega = hat('robo100');   // Mega-Faust: viel weiter und stärker
  let traf = false;
  for (const g of gegner) {
    const dx = g.pos.x - f.pos.x, dz = g.pos.z - f.pos.z, d = Math.hypot(dx, dz);
    const m = g.mitte();
    const dm = Math.hypot(m.x - f.pos.x, m.z - f.pos.z);
    if (Math.min(d, dm) > (mega ? 5 : 2.3) || (dx * fx + dz * fz) / (d || 1) < 0.2) continue;
    const k = mega ? 1.8 : 1;
    gegnerTreffen(g, fx * 14 * k / g.s, 8 * k / g.s, fz * 14 * k / g.s, (mega ? 5 : 2) * schadenMal());
    traf = true;
  }
  if (mega) {
    const p = new THREE.Vector3(f.pos.x + fx * 1.5, 0.3, f.pos.z + fz * 1.5);
    const ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: 0xffe14f, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.copy(p); szene.add(ring); ringe.push({ mesh: ring, t: 0, max: 3 });
  }
  // Erz mit der Faust abbauen
  const zi = zelleVon(f.pos.x + fx * 1.4), zj = zelleVon(f.pos.z + fz * 1.4);
  const erz = erzFelsen.get(key(zi, zj));
  if (!traf && erz && !zellen.get(key(zi, zj))) {
    erz.schlaege++;
    puff(zi * G, 0.5, zj * G, erz.art === 'eisen' ? 0xb5553a : 0xff8c3a, 5);
    if (erz.schlaege >= (mega ? 1 : 3)) {
      erz.schlaege = 0; lagerPlus(erz.art, 1);
      meldung(`+1 ${erz.art === 'eisen' ? 'Eisenbarren' : 'Kupferbarren'} (mit der Faust!)`, 1.2);
    }
    traf = true;
  }
  if (traf) SOUND.klong(); else SOUND.wusch();
}

// ================= GEGNER (Roboter + Bosse) =================
// hp = Leben, tempo = Lauf-Tempo, schaden = wie viel Leben sie dir abziehen, staerke = wie weit du fliegst
// beute = [Eisen, Kupfer], die du bekommst, wenn du ihn kaputt machst
const GEGNER_ARTEN = {
  roboter: { name: 'Roboter',          aus: 'roboter', s: 1,   hp: 5,  tempo: 4.4, schaden: 18, staerke: 13, beute: [1, 1] },
  brecher: { name: '💪 Brecher',        aus: 'boss',    s: 1.7, hp: 30, tempo: 3.4, schaden: 35, staerke: 24, beute: [8, 5],  boss: true, gebSchaden: 3, info: 'haut extrem fest zu' },
  kanone:  { name: '💣 Kanonen-König',  aus: 'kanone',  s: 1.5, hp: 22, tempo: 2.8, schaden: 22, staerke: 16, beute: [8, 6],  boss: true, fern: true, info: 'schießt Feuerbälle' },
  huepfer: { name: '🦘 Hüpf-Hammer',    aus: 'huepfer', s: 1.4, hp: 20, tempo: 3.8, schaden: 25, staerke: 18, beute: [7, 7],  boss: true, springt: true, info: 'springt dich an – Schockwelle!' },
  blitz:   { name: '⚡ Blitz-Bot',       aus: 'blitz',   s: 1.3, hp: 16, tempo: 5.2, schaden: 22, staerke: 22, beute: [6, 8],  boss: true, rennt: true, info: 'rast blitzschnell auf dich zu' },
  riese:   { name: '👑 RIESEN-ROBO',    aus: 'riese',   s: 2.6, hp: 90, tempo: 2.4, schaden: 40, staerke: 30, beute: [30, 20], boss: true, stampft: true, helfer: true, gebSchaden: 5, info: 'stampft und ruft Helfer' },
};
const NORMALE_BOSSE = ['brecher', 'kanone', 'huepfer', 'blitz'];
const MAX_GEGNER = 32;
let gegner = [], gegnerSchuesse = [], ringe = [], kameraWackeln = 0;

function gegnerSpawnen(art = 'roboter', x, z) {
  if (art === true) art = 'brecher';
  if (!GEGNER_ARTEN[art]) art = 'roboter';
  const a = GEGNER_ARTEN[art];
  if (x === undefined) {
    const w = (stand.welleWinkel ?? Math.random() * 6.28) + (Math.random() - 0.5) * 1.2, r = rnd(42, 58), rand = WELT * G - 3;
    const um = wahl(alleSpieler().filter(f => Math.hypot(f.pos.x, f.pos.z) < HUB_NAEHE)) || spieler;
    x = Math.max(-rand, Math.min(rand, um.pos.x + Math.cos(w) * r));
    z = Math.max(-rand, Math.min(rand, um.pos.z + Math.sin(w) * r));
  }
  const g = new Figur(AUSSEHEN[a.aus], a.s);
  const staerker = 1 + stand.welle * 0.08;   // jede Welle werden sie etwas stärker
  Object.assign(g, { art, info: a, boss: !!a.boss, tempo: a.tempo, schaden: a.schaden, staerke: a.staerke });
  g.hp = g.maxHp = Math.ceil(a.hp * staerker);
  g.aufstehZeit = a.boss ? 0.7 : 1.0;   // Roboter stehen schneller wieder auf als du!
  g.angriffT = -0.5; g.spezialT = rnd(1.5, 3); g.helferT = 8; g.id = ++gegnerZaehler;
  g.pos.set(x, 0, z);
  g.yaw = Math.atan2(spieler.pos.x - g.pos.x, spieler.pos.z - g.pos.z);
  g.sofortStehen();
  gegner.push(g);
  for (let k = 0; k < (a.boss ? 14 : 6); k++) {
    rauch(g.pos.x + rnd(-0.6, 0.6) * g.s, rnd(0.3, 1.8) * g.s, g.pos.z + rnd(-0.6, 0.6) * g.s, a.boss ? AUSSEHEN[a.aus].helm : 0x777777, g.s, 1.8 * g.s, 1.2, 0.6);
  }
  return g;
}

function gegnerSchaden(g, n) {
  if (g.tot) return;
  g.hp -= n;
  g.blitzT = 0.12;
  if (g.hp > 0) return;
  g.tot = true; g.totT = g.boss ? 5 : 4;
  const m = g.mitte();
  puff(m.x, m.y, m.z, 0x8a8f99, g.boss ? 30 : 10, { groesse: 1.2 * g.s });
  puff(m.x, m.y, m.z, 0xffd060, g.boss ? 40 : 12, { leucht: true, groesse: 0.5 * g.s, leben: 0.6 });
  for (let k = 0; k < (g.boss ? 20 : 6); k++) rauch(m.x + rnd(-0.4, 0.4) * g.s, m.y + rnd(0, 0.6), m.z + rnd(-0.4, 0.4) * g.s, 0x333333, 0.8 * g.s, 2 * g.s, 1.8, 0.8, 0.7);
  stand.kills++;
  const [eisen, kupfer] = g.info.beute;
  stand.lager.eisen += eisen; stand.lager.kupfer += kupfer;
  if (g.boss) {
    stand.bossKills = (stand.bossKills || 0) + 1;
    if (g.art === 'riese') stand.rieseKills = (stand.rieseKills || 0) + 1;
    allenMelden(`🏆 ${g.info.name} besiegt! +${eisen} Eisen +${kupfer} Kupfer`, 4, 'tada');
    kameraWackeln = 0.6;
  } else meldung(`💥 Roboter kaputt! +${eisen} Eisen +${kupfer} Kupfer`, 1.5);
}

// Boss-Spezialattacken. Gibt [wx, wz] zurück, wenn der Boss gerade selbst bestimmt, wohin er läuft
function bossSpezial(g, dt) {
  const a = g.info, sp = g.zielFigur || spieler;
  const dx = sp.pos.x - g.pos.x, dz = sp.pos.z - g.pos.z, d = Math.hypot(dx, dz) || 1;
  g.spezialT -= dt;
  if (g.sprung) { // Hüpf-Hammer fliegt gerade
    g.sprungZeit += dt;
    g.arme = 'hoch';
    if (g.aufBoden && g.sprungZeit > 0.2) {
      g.sprung = null;
      schockwelle(g.pos, 4.5 * g.s / 1.4, g.staerke, g.schaden, g);
      return [0, 0];
    }
    return [g.sprung.x, g.sprung.z];
  }
  if (g.ansturm) { // Blitz-Bot rast los
    const an = g.ansturm;
    an.t -= dt;
    if (an.t > 0.8) { g.arme = 'hoch'; g.yaw = Math.atan2(dx, dz); an.x = dx / d * 17; an.z = dz / d * 17; return [0, 0]; }
    if (an.t <= 0) { g.ansturm = null; return [0, 0]; }
    g.arme = 'vor'; g.yaw = Math.atan2(an.x, an.z);
    puff(g.pos.x, 0.8 * g.s, g.pos.z, 0x66ffff, 1, { leucht: true, groesse: 0.6, leben: 0.3, tempo: 0.3 });
    if (d < 1.4 * g.s) { treffeSpieler(sp, g.pos, g.schaden, g.staerke); an.t = Math.min(an.t, 0.1); }
    return [an.x, an.z];
  }
  if (g.stampf > 0) { // Riese holt zum Stampfen aus
    g.stampf -= dt; g.arme = 'hoch';
    if (g.stampf <= 0) schockwelle(g.pos, 7, g.staerke, g.schaden, g);
    return [0, 0];
  }
  const kannAngreifen = sp.modus === 'steht' && sp.hp > 0;
  if (g.spezialT <= 0 && kannAngreifen) {
    if (a.fern && d < 32) { g.spezialT = 1.5; energieSchuss(g); }
    else if (a.springt && d < 20 && d > 3) {
      const flug = 1.2;
      g.vel.set(dx / flug, SCHWERKRAFT * flug / 2, dz / flug); g.aufBoden = false; g.pos.y += 0.05;
      g.sprung = { x: dx / flug, z: dz / flug }; g.sprungZeit = 0; g.spezialT = 4;
      staub(g.pos.x, g.pos.z, 8); SOUND.wusch();
      return [g.sprung.x, g.sprung.z];
    } else if (a.rennt && d < 24 && d > 3) {
      g.ansturm = { t: 1.4, x: 0, z: 0 }; g.spezialT = 3.2; SOUND.zisch();
      return [0, 0];
    } else if (a.stampft && d < 9) { g.stampf = 0.9; g.spezialT = 4.5; return [0, 0]; }
  }
  if (a.fern && d < 32 && sp.hp > 0) { // Kanonen-König hält Abstand und zielt
    g.yaw = winkelNaeher(g.yaw, Math.atan2(dx, dz), dt * 6);
    g.arme = 'vor';
    const k = d > 13 ? 1 : d < 8 ? -1 : 0;
    return [dx / d * g.tempo * k, dz / d * g.tempo * k];
  }
  return null;
}

// Feuerball vom Kanonen-König
const FEUER_GEO = new THREE.SphereGeometry(0.32, 14, 10);
const FEUER_MAT = new THREE.MeshBasicMaterial({ color: 0xff4a1a });
function energieSchuss(g) {
  const start = g.mitte(); start.y += 0.45 * g.s;
  const opfer = g.zielFigur || spieler;
  const ziel = opfer.mitte();
  const flug = start.distanceTo(ziel) / 20;
  ziel.addScaledVector(opfer.vel, flug * 0.7);
  ziel.y += 0.5 * 6 * flug * flug;
  const v = ziel.sub(start).normalize().multiplyScalar(20);
  start.addScaledVector(v, 0.05);
  feuerballZeigen(start, v, false);
  anAlle({ t: 'feuer', a: [r2(start.x), r2(start.y), r2(start.z)], v: [r2(v.x), r2(v.y), r2(v.z)] });
}
function feuerballZeigen(start, v, deko = true) {
  const mesh = new THREE.Mesh(FEUER_GEO, FEUER_MAT); mesh.position.copy(start); szene.add(mesh);
  gegnerSchuesse.push({ mesh, pos: start, vel: v, t: 3, deko });
  rauch(start.x, start.y, start.z, 0xff7a30, 0.8, 1.2, 0.5, 0.5, 0.8);
  SOUND.peng();
}
function gegnerSchuesseUpdate(dt) {
  for (const s of gegnerSchuesse) {
    s.vel.y -= 6 * dt;
    s.pos.addScaledVector(s.vel, dt);
    s.t -= dt;
    s.mesh.position.copy(s.pos);
    s.mesh.scale.setScalar(1 + Math.sin(zeit * 30) * 0.15);
    if (Math.random() < 0.6) rauch(s.pos.x, s.pos.y, s.pos.z, wahl([0xff7a30, 0xffc040, 0x555555]), 0.35, 0.6, 0.4, 0.2, 0.7);
    const geb = zellen.get(key(zelleVon(s.pos.x), zelleVon(s.pos.z)));
    const inGeb = geb && s.pos.y < geb.box.y2 && s.pos.x > geb.box.x1 && s.pos.x < geb.box.x2 && s.pos.z > geb.box.z1 && s.pos.z < geb.box.z2;
    const trifftSpieler = !s.deko && alleSpieler().some(f => f.modus === 'steht' && f.hp > 0 && s.pos.distanceTo(f.mitte()) < 0.9);
    if (trifftSpieler || inGeb || s.pos.y < 0.3 || s.t <= 0) {
      if (inGeb) gebaeudeGetroffen(geb, 2);
      schockwelle(s.pos, 2.8, 15, 20, null, true);
      s.t = 0; szene.remove(s.mesh);
    }
  }
  gegnerSchuesse = gegnerSchuesse.filter(s => s.t > 0);
}

// Schockwelle: alles in der Nähe fliegt durch die Luft – auch andere Roboter!
const RING_GEO = new THREE.TorusGeometry(1, 0.12, 6, 40);
function schockwelle(pos, radius, staerke, schaden, von, klein = false) {
  const p = pos.clone();
  if (klein) SOUND.bumm(0.15); else SOUND.bumm(0.35);
  const ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: klein ? 0xff8a3a : 0xfff0c0, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = Math.PI / 2; ring.position.set(p.x, 0.25, p.z); szene.add(ring);
  ringe.push({ mesh: ring, t: 0, max: radius });
  for (let k = 0; k < (klein ? 8 : 20); k++) {
    const w = k / (klein ? 8 : 20) * Math.PI * 2;
    rauch(p.x + Math.cos(w) * radius * 0.5, 0.3, p.z + Math.sin(w) * radius * 0.5, klein ? 0xff9a50 : 0xc9b48a, 0.8, 2, 0.9, 0.6, 0.7);
  }
  puff(p.x, 0.4, p.z, klein ? 0xffa030 : 0x8a7a5a, klein ? 10 : 18, { leucht: klein, groesse: 0.8, tempo: 1.3 });
  const ds = Math.hypot(spieler.pos.x - p.x, spieler.pos.z - p.z);
  if (ds < 30) kameraWackeln = Math.max(kameraWackeln, (klein ? 0.25 : 0.7) * (1 - ds / 30));
  if (istGast()) return;   // beim Gast nur zum Anschauen – der Chef rechnet
  if (!klein) anAlle({ t: 'welle', x: r2(p.x), z: r2(p.z), r: radius });
  for (const f of alleSpieler()) {
    const d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z);
    if (d < radius && f.pos.y < p.y + 2) treffeSpieler(f, p, schaden * (1 - d / radius * 0.5), staerke);
  }
  for (const h of gegner) {
    if (h === von || h.tot || h.modus !== 'steht') continue;
    const dx = h.pos.x - p.x, dz = h.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (d < radius) h.umfallen(dx / d * 8 / h.s, 7 / h.s, dz / d * 8 / h.s);
  }
}
function ringeUpdate(dt) {
  for (const r of ringe) {
    r.t += dt / 0.45;
    const sk = 0.3 + r.t * r.max;
    r.mesh.scale.set(sk, sk, 1 + r.t * 2);
    r.mesh.material.opacity = 0.8 * (1 - r.t);
    if (r.t >= 1) { szene.remove(r.mesh); r.mesh.material.dispose(); }
  }
  ringe = ringe.filter(r => r.t < 1);
}

function gegnerUpdate(g, dt) {
  if (g.tot) {
    g.update(dt);
    g.totT -= dt;
    if (g.totT < 1) g.gruppe.position.y -= dt * 1.5 * g.s;   // im Boden versinken
    if (g.totT <= 0) { puff(g.mitte().x, 0.5, g.mitte().z, 0x8a8f99, 10); g.entfernen(); g.weg = true; }
    return;
  }
  if (g.blitzT > 0) g.blitzT -= dt;
  if (g.modus !== 'steht') { g.sprung = null; g.ansturm = null; g.stampf = 0; }
  if (g.modus === 'steht') {
    let sp = spieler, ds = Infinity;   // der nächste Spieler ist das Ziel
    for (const f of alleSpieler()) {
      if (f.hp <= 0) continue;
      const d = Math.hypot(f.pos.x - g.pos.x, f.pos.z - g.pos.z);
      if (d < ds) { ds = d; sp = f; }
    }
    g.zielFigur = sp;
    let zx, zz, zielGeb = null, reichweite;
    if (sp.hp > 0 && ds < (g.boss ? 40 : 30)) { zx = sp.pos.x; zz = sp.pos.z; reichweite = 1.3 * g.s; }
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
    // Der Riese ruft Helfer
    if (g.info.helfer) {
      g.helferT -= dt;
      if (g.helferT <= 0) {
        g.helferT = 12;
        for (let k = 0; k < 3 && gegner.length < MAX_GEGNER; k++) gegnerSpawnen('roboter', g.pos.x + rnd(-4, 4), g.pos.z + rnd(-4, 4));
        allenMelden('👑 Der Riesen-Robo ruft Helfer!', 1.5);
      }
    }
    let wx = 0, wz = 0;
    const spezial = g.boss && !zielGeb ? bossSpezial(g, dt) : null;
    if (spezial) [wx, wz] = spezial;
    else if (zx !== undefined) {
      const dx = zx - g.pos.x, dz = zz - g.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.01) g.yaw = winkelNaeher(g.yaw, Math.atan2(dx, dz), dt * 6);
      if (d > reichweite) { wx = dx / d * g.tempo; wz = dz / d * g.tempo; g.angriffT = Math.min(g.angriffT, 0); }
      else g.angriffT += dt;
      if (g.angriffT >= 0.45) { // zuhauen!
        g.angriffT = -0.6;
        if (zielGeb) gebaeudeGetroffen(zielGeb, g.info.gebSchaden || 1);
        else if (d < reichweite + 0.5 && sp.modus === 'steht') treffeSpieler(sp, g.pos, g.schaden, g.staerke);
      }
      g.arme = g.angriffT > 0 ? 'hoch' : 'vor';
    }
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
  // Roboter können nichts kaputt machen – das Gebäude wackelt nur
  b.wackel = 0.3;
  SOUND.klong();
}

// Fliegende Ragdolls werfen andere um – wie Bowling!
function bowling() {
  const alle = [spieler, ...gegner];
  for (const f of alle) {
    if (f.modus !== 'ragdoll') continue;
    const v = f.flugTempo().clone();
    if (v.length() < 6) continue;
    const m = f.mitte();
    for (const h of alle) {
      if (h === f || h.modus !== 'steht' || h.tot) continue;
      if (Math.hypot(h.pos.x - m.x, h.pos.z - m.z) > 0.6 * (f.s + h.s) || m.y > h.pos.y + 2.2 * h.s) continue;
      if (h === spieler) { spielerGetroffen(m, 8, 10); continue; }
      h.umfallen(v.x * 0.7 / h.s, 5 / h.s, v.z * 0.7 / h.s);
      gegnerSchaden(h, 1);
      SOUND.klong();
    }
  }
}

const amHub = () => Math.hypot(spieler.pos.x, spieler.pos.z) < HUB_NAEHE;

function wellenUpdate(dt) {
  if (!stand.gegnerAn) return;
  stand.welleT -= dt;
  if (stand.welleT > 0) return;
  stand.welleT = 0;
  if (!alleSpieler().some(f => Math.hypot(f.pos.x, f.pos.z) < HUB_NAEHE)) return;   // Roboter greifen erst an, wenn jemand beim HUB ist
  stand.welle++;
  stand.welleT = WELLEN_PAUSE;
  stand.welleWinkel = Math.random() * Math.PI * 2;
  const w = stand.welle;
  const bosse = [];
  if (w >= 2 && w % 2 === 0) bosse.push(wahl(NORMALE_BOSSE));   // jede 2. Welle ein Boss
  if (w >= 7) bosse.push(wahl(NORMALE_BOSSE));                    // ab Welle 7 in jeder Welle noch einer
  if (w >= 12 && w % 2 === 1) bosse.push(wahl(NORMALE_BOSSE));
  if (w % 10 === 0) bosse.push('riese');                         // jede 10. Welle der RIESE
  const anzahl = Math.min(3 + Math.floor(w * 1.5), 22);
  for (const b of bosse) gegnerSpawnen(b);   // Bosse kommen immer!
  for (let k = 0; k < anzahl && gegner.length < MAX_GEGNER; k++) gegnerSpawnen('roboter');
  const namen = bosse.map(b => GEGNER_ARTEN[b].name).join(' + ');
  allenMelden(`🤖 Welle ${w} kommt!${bosse.length ? `\n⚠️ BOSS: ${namen}` : ''}`, 4, bosse.length ? 'boss' : 'alarm');
}

// ================= PARTIKEL: Splitter, Funken, Rauch, Staub =================
const PUFF_GEO = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const puffMats = {};
let partikel = [];
function puff(x, y, z, farbe, n, { leucht = false, groesse = 1, leben = 0.8, tempo = 1 } = {}) {
  const name = farbe + (leucht ? 'L' : '');
  const m = puffMats[name] || (puffMats[name] = leucht ? new THREE.MeshBasicMaterial({ color: farbe }) : mat(farbe));
  for (let k = 0; k < n && partikel.length < 400; k++) {
    const p = new THREE.Mesh(PUFF_GEO, m);
    p.position.set(x, y, z); p.scale.setScalar(groesse * rnd(0.6, 1.2)); p.castShadow = !leucht; szene.add(p);
    partikel.push({ mesh: p, v: new THREE.Vector3(rnd(-3, 3) * tempo, rnd(3, 8) * tempo, rnd(-3, 3) * tempo), t: leben * rnd(0.7, 1.2) });
  }
}
let rauchListe = [];
function rauch(x, y, z, farbe = 0xdddddd, groesse = 0.6, wachsen = 1.5, leben = 2, hoch = 1.2, deckkraft = 0.55) {
  if (rauchListe.length > 260) return;
  const m = new THREE.SpriteMaterial({ map: TEX.rauch, color: farbe, transparent: true, depthWrite: false, opacity: deckkraft });
  const sp = new THREE.Sprite(m);
  sp.position.set(x, y, z); sp.scale.setScalar(groesse); szene.add(sp);
  rauchListe.push({ sp, v: new THREE.Vector3(rnd(-0.3, 0.3), hoch, rnd(-0.3, 0.3)), t: leben, max: leben, g: groesse, w: wachsen, o: deckkraft });
}
function staub(x, z, n = 5) {
  for (let k = 0; k < n; k++) rauch(x + rnd(-0.3, 0.3), 0.15, z + rnd(-0.3, 0.3), 0xc9b48a, 0.5, 1.4, 0.9, rnd(0.3, 0.9), 0.5);
}
function partikelUpdate(dt) {
  for (const p of partikel) {
    p.v.y -= 15 * dt; p.mesh.position.addScaledVector(p.v, dt); p.t -= dt;
    if (p.mesh.position.y < 0.07) { p.mesh.position.y = 0.07; p.v.set(p.v.x * 0.5, -p.v.y * 0.3, p.v.z * 0.5); }
    p.mesh.rotation.x += dt * 8; p.mesh.rotation.z += dt * 5;
    if (p.t <= 0) szene.remove(p.mesh);
  }
  partikel = partikel.filter(p => p.t > 0);
  for (const r of rauchListe) {
    r.t -= dt;
    r.sp.position.addScaledVector(r.v, dt);
    r.v.x += 0.4 * dt; // ein bisschen Wind
    const f = 1 - r.t / r.max;
    r.sp.scale.setScalar(r.g + r.w * f);
    r.sp.material.opacity = r.o * (1 - f) * Math.min(1, f * 6);
    if (r.t <= 0) { szene.remove(r.sp); r.sp.material.dispose(); }
  }
  rauchListe = rauchListe.filter(r => r.t > 0);
}
// Punkt am Gebäude (gedreht wie das Gebäude) in Welt-Koordinaten
function gebaeudePunkt(b, [lx, ly, lz]) {
  const w = b.gruppe.rotation.y, c = Math.cos(w), si = Math.sin(w);
  return [b.x + lx * c + lz * si, ly, b.z - lx * si + lz * c];
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
function freigeschaltet(typ) { return !GEBAEUDE[typ].sperre || hat(GEBAEUDE[typ].sperre); }
function genugGeld(typ) { return Object.entries(GEBAEUDE[typ].kosten).every(([m, n]) => stand.lager[m] >= n); }
function kostenText(typ) {
  return Object.entries(GEBAEUDE[typ].kosten).map(([m, n]) => `${n} ${m === 'eisen' ? '⬜' : '🟧'}`).join(' ');
}

function bauProblem(typ, i, j, wer = spieler) {
  if (!freigeschaltet(typ)) return `🔒 Erst Meilenstein „${MEILENSTEINE.find(m => m.id === GEBAEUDE[typ].sperre).text}“ schaffen`;
  if (Math.abs(i) > WELT - 2 || Math.abs(j) > WELT - 2) return 'Zu weit draußen';
  if (zellen.get(key(i, j))) return 'Da steht schon was';
  const frei = besetzt.get(key(i, j));
  if (frei) return frei === 'baum' ? 'Hier steht ein Baum 🌲' : 'Hier ist Wasser 💧';
  const erz = erzFelsen.get(key(i, j));
  if (typ === 'bohrer' && !erz) return 'Bohrer nur auf Erz-Felsen!';
  if (typ !== 'bohrer' && erz) return 'Hier ist ein Erz-Felsen – nur für Bohrer';
  if (GEBAEUDE[typ].hoehe > 1 && zelleVon(wer.pos.x) === i && zelleVon(wer.pos.z) === j) return 'Du stehst im Weg';
  if (!genugGeld(typ)) return 'Zu wenig Barren';
  return '';
}

function platzieren(typ, i, j, dir, wer = spieler) {
  const problem = bauProblem(typ, i, j, wer);
  if (problem) return problem;
  if (istGast()) { anChef({ t: 'bauen', typ, i, j, d: dir }); return null; }   // der Chef baut es für alle
  for (const [m, n] of Object.entries(GEBAEUDE[typ].kosten)) stand.lager[m] -= n;
  const b = bauen(typ, i, j, dir);
  puff(i * G, 0.3, j * G, 0xdddddd, 6);
  for (let k = 0; k < 8; k++) { const w = k / 8 * Math.PI * 2; rauch(i * G + Math.cos(w) * 1.1, 0.2, j * G + Math.sin(w) * 1.1, 0xd8d0c0, 0.5, 1.2, 0.8, 0.4, 0.6); }
  SOUND.bau();
  speicherT = 4;
  anAlle({ t: 'gebaut', typ, i, j, d: dir });
  return b;
}

function bandDrehenLokal(i, j, dir) {
  const b = zellen.get(key(i, j));
  if (b && b.typ === 'band') { b.dir = dir; b.gruppe.rotation.y = DIR_WINKEL[dir]; }
}
function bandDrehen(i, j, dir) {
  if (istGast()) { anChef({ t: 'drehen', i, j, d: dir }); return; }
  bandDrehenLokal(i, j, dir);
  anAlle({ t: 'gedreht', i, j, d: dir });
}

function bandZiehen() { // Band: Maus halten und ziehen = viele Bänder hintereinander
  const z = zielZelle();
  if (!z || (letzteZelle && z[0] === letzteZelle[0] && z[1] === letzteZelle[1])) return;
  let dir = bauRichtung();
  if (letzteZelle) {
    const di = z[0] - letzteZelle[0], dj = z[1] - letzteZelle[1];
    if (Math.abs(di) + Math.abs(dj) === 1) {
      dir = DIRS.findIndex(([a, b]) => a === di && b === dj);
      if (letztesBand) bandDrehen(letzteZelle[0], letzteZelle[1], dir);
    }
  }
  letzteZelle = z;
  const b = platzieren('band', z[0], z[1], dir);
  letztesBand = typeof b !== 'string';
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
    if (istGast()) { anChef({ t: 'abriss', i: b.i, j: b.j }); SOUND.klong(); return; }
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
      else if (typ === 'bohrer' && erzFelsen.get(key(z[0], z[1]))?.rein) tipp += ' · ⭐ Reines Erz: doppelt so schnell!';
    }
  }
  setHTML(el.tipp, tipp);
}

// ================= KARTE (Minikarte unten rechts + große Karte mit M) =================
const KARTE_M = WELT * G * 2 + 8;          // so viele Meter zeigt die große Karte
const KARTE_PX = 800;
const KARTEN_FARBE = { bohrer: '#f2b705', band: '#555a66', schmelze: '#c0503a', hub: '#2a6fdb', schleuder: '#3ddc84', turm: '#ff4040' };
const karteHintergrund = (() => {
  const [c, g] = leinwand(KARTE_PX, KARTE_PX);
  const s = KARTE_PX / KARTE_M;
  g.scale(s, s); g.translate(KARTE_M / 2, KARTE_M / 2);
  g.fillStyle = '#5fae45'; g.fillRect(-KARTE_M / 2, -KARTE_M / 2, KARTE_M, KARTE_M);
  g.fillStyle = '#b4b2aa'; g.fillRect(-PLATTE, -PLATTE, PLATTE * 2, PLATTE * 2);
  for (const [x, z, r] of SEEN) {
    g.fillStyle = '#d9c38f'; g.beginPath(); g.arc(x, z, r + 1.8, 0, 7); g.fill();
    g.fillStyle = '#2f86c9'; g.beginPath(); g.arc(x, z, r, 0, 7); g.fill();
  }
  g.fillStyle = '#2d6b2f';
  for (const [x, z, gr] of WALDBAEUME) { g.beginPath(); g.arc(x, z, 1.5 * gr, 0, 7); g.fill(); }
  for (const [art, i, j, rein] of ERZ_ORTE) {
    g.fillStyle = art === 'eisen' ? '#c0583a' : '#ff8c3a';
    g.beginPath(); g.arc(i * G, j * G, 1.6, 0, 7); g.fill();
    if (rein) { g.strokeStyle = '#ffe14f'; g.lineWidth = 0.8; g.stroke(); }
  }
  g.strokeStyle = '#8a5d36'; g.lineWidth = 1.5;
  const z = WELT * G + 1.5; g.strokeRect(-z, -z, z * 2, z * 2);
  return c;
})();

function karteMalen(g, px, mx, mz, meter, drehung, rund) {
  const s = px / meter;
  g.save();
  g.clearRect(0, 0, px, px);
  if (rund) { g.beginPath(); g.arc(px / 2, px / 2, px / 2, 0, 7); g.clip(); g.fillStyle = '#2f5a24'; g.fillRect(0, 0, px, px); }
  g.translate(px / 2, px / 2); g.rotate(drehung); g.scale(s, s); g.translate(-mx, -mz);
  g.drawImage(karteHintergrund, -KARTE_M / 2, -KARTE_M / 2, KARTE_M, KARTE_M);
  for (const b of gebaeude) {
    const h = b.typ === 'band' ? 0.7 : b.typ === 'hub' ? 1.6 : 1;
    g.fillStyle = KARTEN_FARBE[b.typ]; g.fillRect(b.x - h, b.z - h, h * 2, h * 2);
  }
  const gr = Math.max(1, meter / 110);
  for (const e of gegner) {
    if (e.tot) continue;
    g.fillStyle = e.boss ? alsText(AUSSEHEN[e.info.aus].helm) : '#ff3030';
    g.beginPath(); g.arc(e.pos.x, e.pos.z, (e.boss ? 2.6 : 1.3) * gr, 0, 7); g.fill();
    if (e.boss) { g.strokeStyle = '#fff'; g.lineWidth = 0.6 * gr; g.stroke(); }
  }
  for (const f of fremde.values()) { // Freunde
    g.fillStyle = alsText(SPIELER_FARBEN[f.nr] || 0xffffff); g.strokeStyle = '#fff'; g.lineWidth = 0.6 * gr;
    g.beginPath(); g.arc(f.pos.x, f.pos.z, 2.2 * gr, 0, 7); g.fill(); g.stroke();
  }
  // Spieler-Pfeil
  const fx = Math.sin(kamYaw), fz = Math.cos(kamYaw), rx = -fz, rz = fx, p = spieler.pos, a = 3 * gr;
  g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 0.5 * gr;
  g.beginPath(); g.moveTo(p.x + fx * a, p.z + fz * a);
  g.lineTo(p.x - fx * a * 0.6 + rx * a * 0.7, p.z - fz * a * 0.6 + rz * a * 0.7);
  g.lineTo(p.x - fx * a * 0.6 - rx * a * 0.7, p.z - fz * a * 0.6 - rz * a * 0.7);
  g.closePath(); g.fill(); g.stroke();
  g.restore();
  if (rund) { // Norden-Zeichen
    const nx = Math.sin(drehung), nz = -Math.cos(drehung), r = px / 2 - 11;
    g.fillStyle = '#fff'; g.font = 'bold 14px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', px / 2 + nx * r, px / 2 + nz * r);
  }
}
let karteT = 0, grosseKarteAuf = false;
function karteUpdate(dt) {
  karteT -= dt;
  if (karteT > 0) return;
  karteT = 0.1;
  const mini = el.minikarte, g = mini.getContext('2d');
  const drehung = -Math.PI / 2 - Math.atan2(Math.cos(kamYaw), Math.sin(kamYaw));
  if (g) karteMalen(g, mini.width, spieler.pos.x, spieler.pos.z, 110, drehung, true);
  const weg = Math.round(Math.hypot(spieler.pos.x, spieler.pos.z));
  setHTML(el.hubWeg, weg > 12 ? `🏠 HUB: ${weg} m` : '🏠 beim HUB');
  if (grosseKarteAuf) {
    const gg = el.karteGross.getContext('2d');
    if (gg) karteMalen(gg, el.karteGross.width, 0, 0, KARTE_M, 0, false);
  }
}
function grosseKarte(auf) {
  grosseKarteAuf = auf;
  el.grosseKarte.style.display = auf ? 'flex' : 'none';
  karteT = 0;
}

// ================= SPEICHERN =================
let speicherT = 0;
function speichern() {
  if (istGast()) return;   // Gäste speichern die Welt vom Chef nicht
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
  boss: () => { ton(90, 45, 1.0, 'sawtooth', 0.18); ton(135, 60, 1.0, 'square', 0.08, 0.1); for (let k = 0; k < 4; k++) ton(660, 440, 0.2, 'square', 0.06, 0.3 + k * 0.25); },
  bumm: (laut = 0.3) => { ton(140, 30, 0.6, 'sawtooth', laut); ton(80, 25, 0.7, 'sine', laut); },
  peng: () => ton(500, 90, 0.3, 'sawtooth', 0.1),
  zisch: () => ton(300, 2400, 0.6, 'sawtooth', 0.06),
  schrot: () => { ton(400, 120, 0.2, 'square', 0.1); ton(900, 200, 0.12, 'sawtooth', 0.05); },
  tack: () => ton(700, 350, 0.05, 'square', 0.035),
  bowling: () => { ton(160, 60, 0.4, 'triangle', 0.2); ton(90, 50, 0.6, 'sine', 0.15, 0.05); },
  rakete: () => { ton(120, 600, 0.35, 'sawtooth', 0.08); ton(200, 80, 0.5, 'square', 0.05); },
  blitz: () => { for (let k = 0; k < 4; k++) ton(rnd(1200, 3000), rnd(200, 600), 0.08, 'sawtooth', 0.06, k * 0.03); },
  tada: () => [523, 659, 784, 1047].forEach((f, k) => ton(f, f, 0.3, 'triangle', 0.15, k * 0.12)),
};

// ================= HUD =================
const el = Object.fromEntries(['netzStatus', 'raumAuf', 'raumCode', 'beitreten', 'waffen', 'meilensteinListe', 'minikarte', 'hubWeg', 'grosseKarte', 'karteGross', 'bossLeiste', 'lager', 'lebenBalken', 'meilenstein', 'welle', 'tipp', 'meldung', 'leiste', 'rot', 'menue', 'menueText', 'gegnerAn', 'los', 'neu']
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
  d.innerHTML = `<span class="taste">${w === 'abriss' ? 'X' : k}</span><span class="emo">${emo}</span><span class="nm">${name}</span><div class="preis"></div>`;
  d.addEventListener('mousedown', e => { e.stopPropagation(); werkzeugWaehlen(w); });
  el.leiste.appendChild(d);
  return d;
});

function hudUpdate() {
  setHTML(el.lager, `⬜ Eisenbarren: <b>${stand.lager.eisen}</b><br>🟧 Kupferbarren: <b>${stand.lager.kupfer}</b>` +
    `<br><small>Erz im HUB: ${stand.erz.eisen}/3 Eisen · ${stand.erz.kupfer}/3 Kupfer</small>` +
    (netz.modus !== 'solo' ? `<br>🌐 Raum <b>${netz.code}</b> · ${fremde.size + 1} Spieler${istGast() ? '' : ' · du bist Chef'}` : ''));
  el.lebenBalken.style.width = Math.max(0, spieler.hp / SPIELER_LEBEN * 100) + '%';
  const ms = aktuellerMeilenstein();
  setHTML(el.meilenstein, ms
    ? `🎯 <b>Meilenstein ${stand.erledigt.length + 1}/${MEILENSTEINE.length}</b><br>${ms.text}<br>Fortschritt: <b>${Math.min(ms.zahl(), ms.ziel)} / ${ms.ziel}</b><br><small>🎁 ${ms.belohnung}</small>`
    : '🌟 <b>Alle Meilensteine geschafft!</b><br>Du bist eine RAGDOL-LEGENDE!');
  setHTML(el.waffen, WAFFEN.map((w, k) => `<div class="waffe${k === waffeNr ? ' aktiv' : ''}${waffeFrei(w) ? '' : ' zu'}" data-nr="${k}" title="${w.info}">${waffeFrei(w) ? w.emoji : '🔒'}</div>`).join('')
    + `<div class="waffenName">${WAFFEN[waffeNr].name}<br><small>Q = wechseln</small></div>`);
  setHTML(slots[0].querySelector('.emo'), WAFFEN[waffeNr].emoji);
  setHTML(slots[0].querySelector('.nm'), WAFFEN[waffeNr].name);
  const lebend = gegner.filter(g => !g.tot).length;
  setHTML(el.bossLeiste, gegner.filter(g => g.boss && !g.tot).slice(0, 4).map(g =>
    `<div class="boss"><span>${g.info.name}</span> <small>${g.info.info}</small><div class="bossBalken"><div style="width:${Math.max(0, g.hp / g.maxHp * 100)}%"></div></div></div>`).join(''));
  setHTML(el.welle, stand.gegnerAn
    ? (stand.welleT > 0
        ? `🤖 Überfall ${stand.welle + 1} in <b>${Math.floor(Math.ceil(stand.welleT) / 60)}:${String(Math.ceil(stand.welleT) % 60).padStart(2, '0')}</b>`
        : `⚠️ <b>Überfall ${stand.welle + 1} wartet!</b><br>Er kommt, sobald du am HUB bist.`)
      + (amHub() ? '' : '<br><small>🌲 Du bist unterwegs – hier draußen kommt kein Überfall</small>')
      + (lebend ? `<br>Roboter unterwegs: <b>${lebend}</b>` : '')
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
  const ms = aktuellerMeilenstein();
  if (!ms || ms.zahl() < ms.ziel) return;
  stand.erledigt.push(ms.id);
  for (const [m, n] of Object.entries(ms.bonus || {})) stand.lager[m] += n;
  const neueWaffe = WAFFEN.findIndex(w => w.sperre === ms.id);
  if (neueWaffe >= 0) { waffeNr = neueWaffe; werkzeugWaehlen('hand'); }
  allenMelden(`🎉 Meilenstein geschafft! ${ms.belohnung}`, 4, 'tada');
  puff(0, 4, 0, 0xffd166, 30);
  speichern();
}

// ================= EINGABE =================
const taste = {}, TASTEN = taste;
let pausiert = true;

function werkzeugWaehlen(w) {
  werkzeug = w;
  letzteZelle = null;
  waffenModellZeigen();
}
waffenModelleBauen(spieler.enden.find(([i]) => i === I.rHa)[1]);
waffenModellZeigen();
setTimeout(() => meilensteinListeMalen(), 0);
el.waffen.addEventListener('mousedown', e => {
  const nr = e.target.closest('[data-nr]')?.dataset.nr;
  if (nr === undefined || !waffeFrei(WAFFEN[+nr])) return;
  e.stopPropagation(); waffeNr = +nr; werkzeugWaehlen('hand');
});
function meilensteinListeMalen() { // Liste im Pause-Menü
  const aktuell = aktuellerMeilenstein();
  el.meilensteinListe.innerHTML = MEILENSTEINE.map((m, k) => {
    const fertig = hat(m.id), jetzt = m === aktuell;
    return `<div class="${fertig ? 'fertig' : jetzt ? 'jetzt' : 'spaeter'}">${fertig ? '✅' : jetzt ? '🎯' : '🔒'} <b>${k + 1}.</b> ${m.text}${jetzt ? ` (${Math.min(m.zahl(), m.ziel)}/${m.ziel})` : ''}<br><small>🎁 ${m.belohnung}</small></div>`;
  }).join('');
}

addEventListener('keydown', e => {
  taste[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (pausiert) return;
  const zahl = /^Digit([0-5])$/.exec(e.code);
  if (zahl) werkzeugWaehlen(WERKZEUGE[+zahl[1]]);
  if (e.code === 'KeyQ') waffeWechseln(e.shiftKey ? -1 : 1);
  if (e.code === 'KeyX') werkzeugWaehlen(werkzeug === 'abriss' ? 'hand' : 'abriss');
  if (e.code === 'KeyR') drehung = (drehung + 1) % 4;
  if (e.code === 'KeyM') grosseKarte(!grosseKarteAuf);
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
  if (an) { el.los.textContent = '▶ Weiterspielen'; speichern(); meilensteinListeMalen(); }
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
el.raumAuf.addEventListener('click', () => raumOeffnen());
el.beitreten.addEventListener('click', () => raumBeitreten(el.raumCode.value));
el.raumCode.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') raumBeitreten(el.raumCode.value); });
el.raumCode.addEventListener('input', () => { el.raumCode.value = el.raumCode.value.toUpperCase().replace(/[^A-Z]/g, ''); });
el.neu.addEventListener('click', () => {
  if (!confirm('Wirklich eine neue Fabrik anfangen? Deine jetzige Fabrik ist dann weg.')) return;
  try { localStorage.removeItem(SPEICHER_NAME); } catch (e) { /* egal */ }
  location.reload();
});
if (stand.bauten && stand.bauten.length) el.los.textContent = '▶ Weiterspielen';

// ================= ONLINE MIT FREUNDEN =================
// Einer ist der "Chef" (macht den Raum auf). Der Chef rechnet die Welt: Roboter, Fabrik, Lager, Meilensteine.
// Die Freunde ("Gäste") steuern nur ihre eigene Figur und schicken dem Chef, was sie tun.
const RAUM_VORSILBE = 'ragdolfactory-raum-';
const MAX_SPIELER = 4;
const SPIELER_FARBEN = [0xff8c1a, 0x2a9df4, 0x3ddc84, 0xc77dff];
const SPIELER_NAMEN = ['Spieler 1', 'Spieler 2', 'Spieler 3', 'Spieler 4'];
SPIELER_FARBEN.forEach((c, k) => { AUSSEHEN['spieler' + k] = { ...AUSSEHEN.spieler, anzug: c, _m: undefined }; });
const ARME = ['', 'vor', 'hoch', 'zielen'];
const netz = { modus: 'solo', peer: null, code: '', ich: 'chef', nr: 0, gaeste: new Map(), chef: null, sendeT: 0, standT: 0 };
const fremde = new Map();   // andere Spieler: id -> Figur
let gegnerZaehler = 0;
const istGast = () => netz.modus === 'gast';
const alleSpieler = () => [spieler, ...fremde.values()];
const r2 = v => Math.round(v * 100) / 100;

function anAlle(nachricht, ausser) { // Chef schickt an alle Gäste
  if (netz.modus !== 'chef') return;
  for (const [id, g] of netz.gaeste) if (id !== ausser && g.conn.open) g.conn.send(nachricht);
}
function anChef(nachricht) { if (netz.chef?.open) netz.chef.send(nachricht); }
function allenMelden(text, dauer = 2.5, ton) {
  meldung(text, dauer);
  if (ton) SOUND[ton]?.();
  anAlle({ t: 'meldung', text, d: dauer, ton });
}

// Wenn ein Spieler getroffen wird: bei mir selbst direkt, bei Freunden per Nachricht
function treffeSpieler(f, von, schaden, staerke) {
  if (f === spieler) { spielerGetroffen(von, schaden, staerke); return; }
  for (const g of netz.gaeste.values()) if (g.figur === f && g.conn.open) g.conn.send({ t: 'getroffen', v: [r2(von.x), r2(von.z)], s: schaden, k: staerke });
}
// Wenn ich einen Roboter treffe: als Chef direkt, als Gast dem Chef sagen
function gegnerTreffen(g, vx, vy, vz, schaden) {
  if (istGast()) { anChef({ t: 'treffer', id: g.id, v: [r2(vx), r2(vy), r2(vz)], s: schaden }); return; }
  g.umfallen(vx, vy, vz);
  gegnerSchaden(g, schaden);
}
function lagerPlus(m, n) { if (istGast()) anChef({ t: 'lager', m, n }); else stand.lager[m] += n; }

// ---------- Figuren als Zahlen-Listen verschicken ----------
function figurDaten(f, id, extra) {
  const zustand = f.tot ? 2 : f.modus === 'steht' || f.modus === 'aufstehen' && f.blend > 0.5 ? 0 : 1;
  const d = [id, r2(f.pos.x), r2(f.pos.y), r2(f.pos.z), r2(f.yaw), zustand, Math.max(0, ARME.indexOf(f.arme)), f.aufBoden ? 1 : 0, ...extra];
  if (zustand !== 0) for (const p of f.p) d.push(r2(p.x), r2(p.y), r2(p.z));
  return d;
}
function zielSetzen(f, d, start) { // empfangene Zahlen merken – die Figur gleitet dann sanft dorthin
  const z = f.ziel || (f.ziel = { punkte: TEILE.map(() => new THREE.Vector3()), neu: true });
  [, z.x, z.y, z.z, z.yaw, z.zustand, z.arme, z.boden] = d;
  if (z.zustand !== 0) for (let k = 0; k < 13; k++) z.punkte[k].set(d[start + k * 3], d[start + k * 3 + 1], d[start + k * 3 + 2]);
}
function figurFolgen(f, dt) {
  const z = f.ziel;
  if (!z) return;
  const k = 1 - Math.exp(-14 * dt);
  if (z.zustand === 0) {
    if (f.modus !== 'steht' || z.neu) { f.modus = 'steht'; f.pos.set(z.x, z.y, z.z); f.yaw = z.yaw; }
    const ax = f.pos.x, az = f.pos.z;
    f.pos.x += (z.x - f.pos.x) * k; f.pos.y += (z.y - f.pos.y) * k; f.pos.z += (z.z - f.pos.z) * k;
    f.vel.set((f.pos.x - ax) / dt, 0, (f.pos.z - az) / dt);
    f.yaw = winkelNaeher(f.yaw, z.yaw, k);
    f.arme = ARME[z.arme] || ''; f.aufBoden = !!z.boden;
    f.update(dt);
  } else {
    if (f.modus !== 'netz' || z.neu) { for (let n = 0; n < 13; n++) f.p[n].copy(z.punkte[n]); }
    f.modus = 'netz';
    for (let n = 0; n < 13; n++) { f.a[n].copy(f.p[n]); f.p[n].lerp(z.punkte[n], k); }
    f.pos.set(z.x, z.y, z.z);
  }
  z.neu = false;
}

// ---------- andere Spieler ----------
function fremdenSpieler(id, nr) {
  let f = fremde.get(id);
  if (f) return f;
  f = new Figur(AUSSEHEN['spieler' + nr] || AUSSEHEN.spieler1, 1);
  f.hp = SPIELER_LEBEN; f.nr = nr; f.id = id;
  f.namensSchild = schild(SPIELER_NAMEN[nr] || 'Freund', alsText(SPIELER_FARBEN[nr] || 0xffffff));
  f.namensSchild.scale.set(1.3, 0.5, 1); szene.add(f.namensSchild);
  fremde.set(id, f);
  return f;
}
function fremdenEntfernen(id) {
  const f = fremde.get(id);
  if (!f) return;
  f.entfernen(); szene.remove(f.namensSchild);
  fremde.delete(id);
}
function meineFarbe(nr) { // meinen Anzug in meiner Spieler-Farbe färben
  const m = figurMaterialien(AUSSEHEN.spieler);
  m.anzug.map = stoffTextur(alsText(SPIELER_FARBEN[nr])); m.anzug.needsUpdate = true;
  m.dunkler.color.set(SPIELER_FARBEN[nr]).multiplyScalar(0.6);
}

// ---------- Schüsse der anderen sehen (nur zum Anschauen) ----------
function schussZeigen(d) {
  const start = new THREE.Vector3(...d.a), r = new THREE.Vector3(...d.r);
  if (d.w === 'rakete') raketeSchiessen(start, r, true);
  else if (d.w === 'bowling') ballSchiessen(start, r, 0, { tempo: 22, leben: 4, groesse: 2.4, durch: true, matr: BOWLING_MAT, deko: true });
  else for (let k = 0; k < (d.w === 'schrot' ? 8 : 1); k++) {
    ballSchiessen(start, d.w === 'schrot' ? streuen(r, 0.13) : r, 0, { tempo: d.w === 'minigun' ? 38 : d.w === 'schrot' ? 26 : BALL_TEMPO, leben: d.w === 'schrot' ? 0.9 : 2, groesse: d.w === 'minigun' ? 0.7 : 1, deko: true });
  }
}
function schussMelden(w, start, r) {
  const d = { t: 'schuss', w, a: [r2(start.x), r2(start.y), r2(start.z)], r: [r2(r.x), r2(r.y), r2(r.z)] };
  if (istGast()) anChef(d); else anAlle(d);
}

// ---------- Chef ----------
function raumOeffnen() {
  if (netz.peer || typeof Peer === 'undefined') { netzStatus('❌ Online geht gerade nicht (keine Internet-Verbindung?)'); return; }
  const buchstaben = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  netz.code = Array.from({ length: 4 }, () => wahl([...buchstaben])).join('');
  netzStatus('⏳ Raum wird geöffnet …');
  const peer = netz.peer = new Peer(RAUM_VORSILBE + netz.code);
  peer.on('open', () => {
    netz.modus = 'chef'; netz.ich = 'chef'; netz.nr = 0;
    netzStatus(`✅ Raum offen! Code für deine Freunde: <b class="code">${netz.code}</b>`);
  });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { netz.peer = null; peer.destroy(); raumOeffnen(); return; } // Code schon vergeben -> neuer Code
    netzStatus('❌ Fehler: ' + e.type);
  });
  peer.on('connection', conn => {
    conn.on('open', () => {
      const belegt = new Set([0, ...[...netz.gaeste.values()].map(g => g.nr)]);
      const nr = [1, 2, 3].find(n => !belegt.has(n));
      if (nr === undefined || netz.gaeste.size >= MAX_SPIELER - 1) { conn.send({ t: 'voll' }); setTimeout(() => conn.close(), 500); return; }
      const id = 'g' + nr + '-' + Math.floor(Math.random() * 1e6);
      const figur = fremdenSpieler(id, nr);
      figur.pos.set(rnd(-2, 2), 0, G * 1.5 + rnd(0, 2)); figur.sofortStehen();
      netz.gaeste.set(id, { conn, figur, nr });
      conn.send({ t: 'welt', id, nr, stand: standOhneBauten(), bauten: bautenListe() });
      allenMelden(`🎉 ${SPIELER_NAMEN[nr]} ist dabei!`, 3, 'tada');
    });
    conn.on('data', d => { for (const [id, g] of netz.gaeste) if (g.conn === conn) chefEmpfang(id, d); });
    conn.on('close', () => {
      for (const [id, g] of netz.gaeste) if (g.conn === conn) {
        netz.gaeste.delete(id); fremdenEntfernen(id);
        allenMelden(`👋 ${SPIELER_NAMEN[g.nr]} ist gegangen`, 2.5);
      }
    });
  });
}
const bautenListe = () => gebaeude.filter(b => b.typ !== 'hub').map(b => ({ t: b.typ, i: b.i, j: b.j, d: b.dir }));
const standOhneBauten = () => { const s = { ...stand }; delete s.bauten; return s; };

function chefEmpfang(id, d) {
  const gast = netz.gaeste.get(id);
  if (!gast) return;
  if (d.t === 'ich') {
    zielSetzen(gast.figur, d.f, 11);
    gast.figur.hp = d.f[9]; gast.figur.waffe = d.f[10];
  } else if (d.t === 'bauen') {
    if (!GEBAEUDE[d.typ] || d.typ === 'hub') return;
    const r = platzieren(d.typ, d.i, d.j, d.d, gast.figur);
    if (typeof r === 'string' && r !== 'Da steht schon was') gast.conn.send({ t: 'meldung', text: r, d: 1.2 });
  } else if (d.t === 'abriss') {
    const b = zellen.get(key(d.i, d.j));
    if (b && b.typ !== 'hub') { abreissen(b, true); speicherT = 4; }
  } else if (d.t === 'drehen') bandDrehen(d.i, d.j, d.d);
  else if (d.t === 'treffer') {
    const g = gegner.find(x => x.id === d.id);
    if (g) { g.umfallen(...d.v); gegnerSchaden(g, Math.min(20, d.s)); }
  } else if (d.t === 'lager') { if (ITEMS[d.m + 'erz'] && d.n === 1) stand.lager[d.m] += 1; }
  else if (d.t === 'schuss') { schussZeigen(d); anAlle(d, id); }
}

// ---------- Gast ----------
function raumBeitreten(code) {
  code = (code || '').trim().toUpperCase();
  if (code.length !== 4) { netzStatus('Der Code hat 4 Buchstaben'); return; }
  if (netz.peer || typeof Peer === 'undefined') { netzStatus('❌ Online geht gerade nicht'); return; }
  netzStatus('⏳ Verbinde …');
  const peer = netz.peer = new Peer();
  peer.on('open', () => {
    const conn = peer.connect(RAUM_VORSILBE + code, { reliable: true });
    netz.chef = conn;
    conn.on('data', gastEmpfang);
    conn.on('close', () => {
      if (netz.modus !== 'gast') return;
      meldung('👋 Der Chef hat das Spiel verlassen', 5);
      netzStatus('Verbindung weg – lade die Seite neu');
      setTimeout(() => location.reload(), 4000);
    });
  });
  peer.on('error', e => {
    netzStatus(e.type === 'peer-unavailable' ? '❌ Raum nicht gefunden – stimmt der Code?' : '❌ Fehler: ' + e.type);
    peer.destroy(); netz.peer = null;
  });
  netz.code = code;
}
function gastEmpfang(d) {
  if (d.t === 'welt') {
    netz.modus = 'gast'; netz.ich = d.id; netz.nr = d.nr;
    meineFarbe(d.nr);
    for (const b of [...gebaeude]) if (b.typ !== 'hub') { for (const it of b.items) szene.remove(it.mesh); szene.remove(b.gruppe); zellen.delete(key(b.i, b.j)); dekoZeigen(b.i, b.j, true); const e = erzFelsen.get(key(b.i, b.j)); if (e) e.gruppe.visible = true; }
    gebaeude = gebaeude.filter(b => b.typ === 'hub');
    for (const g of gegner) g.entfernen();
    gegner = [];
    Object.assign(stand, d.stand);
    for (const b of d.bauten) if (GEBAEUDE[b.t] && !zellen.get(key(b.i, b.j))) bauen(b.t, b.i, b.j, b.d);
    spieler.pos.set(rnd(-2, 2), 0, G * 1.5 + rnd(0, 2)); spieler.sofortStehen();
    el.gegnerAn.disabled = true;
    netzStatus(`✅ Du bist im Raum <b class="code">${netz.code}</b> als ${SPIELER_NAMEN[d.nr]}`);
    meldung(`🎉 Du spielst jetzt mit deinen Freunden!`, 3);
  } else if (d.t === 'voll') netzStatus('❌ Der Raum ist voll (höchstens 4 Spieler)');
  else if (netz.modus !== 'gast') return;
  else if (d.t === 'schnapp') schnappschussLesen(d);
  else if (d.t === 'stand') Object.assign(stand, d.s);
  else if (d.t === 'gebaut') { if (!zellen.get(key(d.i, d.j))) { bauen(d.typ, d.i, d.j, d.d); puff(d.i * G, 0.3, d.j * G, 0xdddddd, 6); SOUND.bau(); } }
  else if (d.t === 'weg') { const b = zellen.get(key(d.i, d.j)); if (b) abreissen(b, false); }
  else if (d.t === 'gedreht') bandDrehenLokal(d.i, d.j, d.d);
  else if (d.t === 'getroffen') spielerGetroffen(new THREE.Vector3(d.v[0], 0, d.v[1]), d.s, d.k);
  else if (d.t === 'meldung') { meldung(d.text, d.d); if (d.ton) SOUND[d.ton]?.(); }
  else if (d.t === 'welle') schockwelle(new THREE.Vector3(d.x, 0, d.z), d.r, 0, 0, null, false);
  else if (d.t === 'feuer') feuerballZeigen(new THREE.Vector3(...d.a), new THREE.Vector3(...d.v));
  else if (d.t === 'schuss') schussZeigen(d);
}

// Schnappschuss: Chef schickt alle Roboter und alle Spieler
const ARTEN_LISTE = Object.keys(GEGNER_ARTEN);
function schnappschussMachen() {
  const g = gegner.map(e => figurDaten(e, e.id, [ARTEN_LISTE.indexOf(e.art), Math.max(0, e.hp), e.maxHp]));
  const p = [figurDaten(spieler, 'chef', [0, Math.round(spieler.hp), waffeNr])];
  for (const [id, gast] of netz.gaeste) p.push(figurDaten(gast.figur, id, [gast.nr, Math.round(gast.figur.hp || 0), gast.figur.waffe || 0]));
  return { t: 'schnapp', g, p };
}
function schnappschussLesen(d) {
  const da = new Set();
  for (const e of d.g) {
    const id = e[0];
    da.add(id);
    let g = gegner.find(x => x.id === id);
    if (!g) {
      const art = ARTEN_LISTE[e[8]] || 'roboter', a = GEGNER_ARTEN[art];
      g = new Figur(AUSSEHEN[a.aus], a.s);
      Object.assign(g, { id, art, info: a, boss: !!a.boss });
      gegner.push(g);
      for (let k = 0; k < (a.boss ? 14 : 6); k++) rauch(e[1] + rnd(-0.6, 0.6) * g.s, rnd(0.3, 1.8) * g.s, e[3] + rnd(-0.6, 0.6) * g.s, a.boss ? AUSSEHEN[a.aus].helm : 0x777777, g.s, 1.8 * g.s, 1.2, 0.6);
    }
    if (g.hp !== undefined && e[9] < g.hp) g.blitzT = 0.12;
    g.hp = e[9]; g.maxHp = e[10];
    zielSetzen(g, e, 11);
    if (e[5] === 2 && !g.tot) { // gerade kaputt gegangen
      g.tot = true;
      for (let k = 0; k < 13; k++) g.p[k].copy(g.ziel.punkte[k]);
      const m = g.mitte();
      puff(m.x, m.y, m.z, 0x8a8f99, g.boss ? 30 : 10, { groesse: 1.2 * g.s });
      puff(m.x, m.y, m.z, 0xffd060, g.boss ? 40 : 12, { leucht: true, groesse: 0.5 * g.s, leben: 0.6 });
    }
  }
  for (const g of gegner) if (!da.has(g.id)) { g.entfernen(); g.weg = true; }
  gegner = gegner.filter(g => !g.weg);
  const sp = new Set();
  for (const s of d.p) {
    if (s[0] === netz.ich) continue;
    sp.add(s[0]);
    const f = fremdenSpieler(s[0], s[8]);
    f.hp = s[9]; f.waffe = s[10];
    zielSetzen(f, s, 11);
  }
  for (const id of [...fremde.keys()]) if (!sp.has(id)) fremdenEntfernen(id);
}

function netzUpdate(dt) {
  if (netz.modus === 'solo') return;
  for (const f of fremde.values()) {
    figurFolgen(f, dt);
    f.namensSchild.position.copy(f.modus === 'steht' ? f.pos : f.mitte()).y += f.modus === 'steht' ? 2.3 : 1;
  }
  if (istGast()) for (const g of gegner) figurFolgen(g, dt);
  netz.sendeT -= dt; netz.standT -= dt;
  if (netz.sendeT <= 0) {
    netz.sendeT = 1 / 15;
    if (netz.modus === 'chef' && netz.gaeste.size) anAlle(schnappschussMachen());
    if (istGast()) anChef({ t: 'ich', f: figurDaten(spieler, netz.ich, [netz.nr, Math.round(spieler.hp), waffeNr]) });
  }
  if (netz.modus === 'chef' && netz.standT <= 0) { netz.standT = 0.5; anAlle({ t: 'stand', s: standOhneBauten() }); }
}

function netzStatus(html) { el.netzStatus.innerHTML = html; }

// ================= HAUPT-SCHLEIFE =================
function winkelNaeher(a, b, k) { return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, k); }

function update(dt) {
  zeit += dt; plingT -= dt;
  spielerUpdate(dt);
  if (!istGast()) {   // Roboter rechnet nur der Chef (oder du allein)
    for (const g of gegner) gegnerUpdate(g, dt);
    gegner = gegner.filter(g => !g.weg);
  }
  for (const b of [...gebaeude]) gebaeudeUpdate(b, dt);
  baelleUpdate(dt);
  gegnerSchuesseUpdate(dt);
  ringeUpdate(dt);
  if (!istGast()) { bowling(); wellenUpdate(dt); }
  partikelUpdate(dt);
  bandTextur.offset.y += BAND_TEMPO * G * dt;   // Pfeile laufen mit dem Band mit
  if (mausUnten && werkzeug === 'band') bandZiehen();
  if (mausUnten && werkzeug === 'hand' && !pausiert) schiessen();   // Maus gedrückt halten = Dauerfeuer
  raketenUpdate(dt);
  blitzeUpdate(dt);
  if (!istGast()) meilensteinPruefen();
  netzUpdate(dt);
  speicherT += dt;
  if (speicherT > 5) speichern();
}

function kameraUpdate() {
  const f = spieler;
  const ziel = f.modus === 'steht' ? _a.set(f.pos.x, f.pos.y + 1.7, f.pos.z) : _a.copy(f.mitte()).add(_b.set(0, 0.6, 0));
  const d = blickRichtung();
  kamera.position.set(ziel.x - Math.cos(kamYaw) * 0.7, ziel.y, ziel.z + Math.sin(kamYaw) * 0.7).addScaledVector(d, -4.5);
  if (kameraWackeln > 0) {
    kamera.position.x += rnd(-1, 1) * kameraWackeln * 0.4; kamera.position.y += rnd(-1, 1) * kameraWackeln * 0.4;
    kameraWackeln = Math.max(0, kameraWackeln - 1 / 60 * 1.5);
  }
  if (kamera.position.y < 0.4) kamera.position.y = 0.4;
  kamera.lookAt(_c.copy(kamera.position).add(d));
  sonne.position.set(f.pos.x, 0, f.pos.z).addScaledVector(SONNEN_RICHTUNG, 60);
  sonne.target.position.set(f.pos.x, 0, f.pos.z);
}

let anzeigeT = 0;
function hubAnzeige(a) { // Bildschirm am HUB zeigt das Lager
  const text = stand.lager.eisen + '|' + stand.lager.kupfer;
  if (text === a.text) return;
  a.text = text;
  const g = a.gx;
  g.fillStyle = '#0c1a2e'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#3aa0ff'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 120);
  g.font = 'bold 26px system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#7fd0ff'; g.fillText('LAGER', 16, 26);
  g.fillStyle = '#d0d6dc'; g.fillRect(18, 54, 26, 20); g.fillStyle = '#fff'; g.fillText('Eisen: ' + stand.lager.eisen, 56, 64);
  g.fillStyle = '#f08a4a'; g.fillRect(18, 90, 26, 20); g.fillStyle = '#fff'; g.fillText('Kupfer: ' + stand.lager.kupfer, 56, 100);
  a.tex.needsUpdate = true;
}

function zeichnen(echtDt) {
  spieler.zeichnen();
  for (const f of fremde.values()) f.zeichnen();
  for (const g of gegner) { g.zeichnen(); g.gruppe.visible = !(g.blitzT > 0 && Math.floor(zeit * 40) % 2); }
  for (const b of gebaeude) {
    const u = b.gruppe.userData;
    if (u.dreh && b.arbeitet) u.dreh.rotation.y += echtDt * 14;
    if (u.bohr && b.arbeitet) { u.bohr.rotation.y -= echtDt * 10; u.bohr.position.y = Math.sin(zeit * 6) * 0.04; }
    if (u.lampe) u.lampe.emissiveIntensity = b.arbeitet ? (Math.sin(zeit * 8) > 0 ? 3 : 0.2) : 0;
    if (u.glut) {
      u.glut.emissiveIntensity = b.arbeitet ? 1.8 + Math.sin(zeit * 13) * 0.3 + Math.sin(zeit * 7.3) * 0.2 : 0.3;
      u.glutBoden.opacity = b.arbeitet ? 0.35 + Math.sin(zeit * 11) * 0.06 : 0.05;
    }
    if (u.schuessel) u.schuessel.rotation.y += echtDt * 0.5;
    if (u.blink) u.blink.emissiveIntensity = (zeit % 1.2) < 0.15 ? 4 : 0.3;
    if (u.anzeige) hubAnzeige(u.anzeige);
    if (u.pad) {
      b.knall = Math.max(0, (b.knall || 0) - echtDt * 3);
      u.pad.position.y = 0.26 + b.knall * 0.3;
      u.ring.emissiveIntensity = 0.8 + Math.sin(zeit * 4) * 0.5 + b.knall * 3;
    }
    if (u.laeufe) { b.rueckstoss = Math.max(0, (b.rueckstoss || 0) - echtDt * 5); u.laeufe.position.z = -b.rueckstoss * 0.18; }
    // Aufplopp-Animation beim Bauen
    if (b.bauT < 1) {
      b.bauT = Math.min(1, b.bauT + echtDt / 0.35);
      const t = b.bauT, k = 1.70158;
      const sk = 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);
      b.gruppe.scale.set(sk, sk, sk);
    }
    b.gruppe.position.x = b.x + (b.wackel > 0 ? (Math.random() - 0.5) * 0.2 : 0);
  }
  for (const m of Object.values(ERZ_MAT)) m.emissiveIntensity = 0.5 + Math.sin(zeit * 2.2) * 0.3;
  for (const w of wolken) { w.position.x += echtDt * 2; if (w.position.x > 680) w.position.x = -680; }
  himmel.position.copy(kamera.position);
  waffeRueck = Math.max(0, waffeRueck - echtDt * 8);
  const wm = waffenModelle[WAFFEN[waffeNr].id];
  if (wm) {
    wm.position.z = 0.12 - waffeRueck * 0.1;
    if (wm.userData.dreh && mausUnten && werkzeug === 'hand') wm.userData.dreh.rotation.z += echtDt * 30;
  }
  if (MAT.wasser) MAT.wasser.emissiveIntensity = 1 + Math.sin(zeit * 1.5) * 0.3;
  kameraUpdate();
  geistUpdate();
  hudUpdate();
  karteUpdate(echtDt);
  if (meldungT > 0) { meldungT -= echtDt; if (meldungT <= 0) el.meldung.style.opacity = 0; }
  renderer.render(szene, kamera);
}

let akku = 0, letzte = performance.now();
function schleife(jetzt) {
  requestAnimationFrame(schleife);
  let dt = (jetzt - letzte) / 1000; letzte = jetzt;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 0.1);
  if (!pausiert || netz.modus !== 'solo') {   // online läuft das Spiel auch im Menü weiter
    akku += dt;
    let n = 0;
    while (akku >= DT && n < 6) { update(DT); akku -= DT; n++; }
    if (n === 6) akku = 0;
  }
  zeichnen(dt);
}
requestAnimationFrame(schleife);

// zum Testen
window.__spiel = { update, zeichnen, stand, spieler, gegner: () => gegner, gebaeude: () => gebaeude, platzieren, gegnerSpawnen, bauen, zellen, pause, schlagen, schiessen, setKam: (y, p) => { kamYaw = y; kamPitch = p; } };
