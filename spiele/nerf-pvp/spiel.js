// 🔫 NERF PvP – ein 3D-Shooter mit Schaumstoff-Darts
// Du siehst durch die Augen deiner Figur (Ego-Sicht) und kämpfst gegen Bots oder Freunde online.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ========== Einstellungen (hier kannst du herumprobieren!) ==========
const SIEG_PUNKTE = 10;          // so viele Gegner muss man ausschalten, um zu gewinnen
const MAX_LEBEN = 100;

// ========== Die Blaster ==========
// schaden/kopf = Schaden bei Treffer am Körper/Kopf · magazin = so viele Schüsse · pause = Sekunden zwischen Schüssen
// nachladen = Sekunden · tempo = so schnell fliegen die Darts · fallen = so stark fallen sie nach unten
// streuung = wie ungenau · darts = Darts pro Schuss · laufen = Lauftempo (1 = normal) · botAbstand = so weit weg bleiben Bots
const WAFFEN = {
  blitz:   { name: 'Blitz-Blaster',          emoji: '🔫', schaden: 20, kopf: 40,  magazin: 12, pause: 0.16,  nachladen: 1.4, tempo: 32, fallen: 3,   streuung: 0.012, darts: 1, laufen: 1,    botAbstand: 12 },
  schrot:  { name: 'Schrot-Blaster',         emoji: '💥', schaden: 11, kopf: 18,  magazin: 5,  pause: 0.75,  nachladen: 1.8, tempo: 26, fallen: 4,   streuung: 0.09,  darts: 7, laufen: 1,    botAbstand: 6 },
  sniper:  { name: 'Scharfschützen-Blaster', emoji: '🎯', schaden: 60, kopf: 100, magazin: 4,  pause: 1.0,   nachladen: 2.2, tempo: 70, fallen: 0.5, streuung: 0,     darts: 1, laufen: 0.9,  botAbstand: 22 },
  minigun: { name: 'Mini-Gun',               emoji: '⚡', schaden: 8,  kopf: 14,  magazin: 45, pause: 0.065, nachladen: 2.8, tempo: 30, fallen: 3,   streuung: 0.045, darts: 1, laufen: 0.75, botAbstand: 10 },
  // Dein echter Blaster als 3D-Modell! Nur 2 Schuss, aber die hauen rein. Nachladen: aufklappen, Darts rein, zuklappen.
  doppel:  { name: 'Doppel-Blaster',         emoji: '✌️', schaden: 50, kopf: 100, magazin: 2,  pause: 0.35,  nachladen: 2.4, tempo: 34, fallen: 3,   streuung: 0.006, darts: 1, laufen: 1,    botAbstand: 12 },
};
const WAFFEN_LISTE = ['blitz', 'schrot', 'sniper', 'minigun', 'doppel'];   // Taste 1, 2, 3, 4, 5
const DOPPEL_GROESSE = 1.8;      // so viel größer als in echt ist der Doppel-Blaster im Spiel (sonst sieht man ihn kaum)
const waffeVon = w => Object.hasOwn(WAFFEN, w) ? w : 'blitz';
const LAUF_TEMPO = 6, RENN_TEMPO = 9, SPRUNG_KRAFT = 6.5, SCHWERKRAFT = 18;
// ---------- Quake-Bewegung (nur für dich, nicht für Bots) ----------
// Leertaste gedrückt halten = Bunny-Hop (springt sofort weiter, ohne Schwung zu verlieren)
// In der Luft A oder D drücken und die Maus in dieselbe Richtung drehen = schneller werden (Strafe-Jumping)
const QUAKE_BEWEGUNG = true;     // false = wieder normales Laufen wie vorher
const BODEN_BESCHL = 10;         // wie schnell du am Boden losläufst
const REIBUNG = 6;               // wie schnell du am Boden abbremst
const STOPP_TEMPO = 2.5;         // unter diesem Tempo bremst die Reibung extra stark
const LUFT_BESCHL = 10;          // wie stark du in der Luft lenken kannst
const LUFT_MAX = 0.7;            // so klein ist der Schubs in der Luft (klein = Strafe-Jumping nötig)
const HOECHST_TEMPO = 22;        // schneller geht es nicht (Meter pro Sekunde)
const MIN_KAEMPFER = 4;          // Bots füllen auf so viele Kämpfer auf
const BOT_ZIELFEHLER = 0.07;     // kleiner = Bots zielen besser
const MAUS_EMPFINDLICH = 0.0022;

// ========== Spielmodi ==========
const MODI = {
  ffa:        { name: '🎯 Jeder gegen jeden',    text: 'Jeder kämpft für sich. Wer zuerst 10 Gegner erwischt, gewinnt!' },
  team:       { name: '🔴🔵 Team-Kampf',          text: 'Rot gegen Blau! Das Team, das zuerst 20 Punkte hat, gewinnt. Dein eigenes Team kannst du nicht treffen.' },
  einTreffer: { name: '⚡ Ein Treffer',           text: 'Jeder Treffer haut dich sofort raus! Aber jeder Blaster hat nur halb so viele Darts. Wer zuerst 10 hat, gewinnt.' },
  ueberleben: { name: '💀 Letzter Überlebender', text: 'Jeder hat nur 3 Leben. Wer alle verbraucht hat, schaut zu. Wer als Letzter übrig ist, gewinnt!' },
};
const TEAM_SIEG = 20;              // so viele Punkte braucht ein Team
const UEBERLEBEN_LEBEN = 3;        // so viele Leben im Modus "Letzter Überlebender"
const TEAM_FARBE = { rot: '#ff4040', blau: '#2f8cff' };
const TEAM_NAME = { rot: '🔴 Team Rot', blau: '🔵 Team Blau' };
let modus = 'ffa';
function magazinVon(w) { const m = WAFFEN[waffeVon(w)].magazin; return modus === 'einTreffer' ? Math.max(2, Math.ceil(m / 2)) : m; }
const RADIUS = 0.35, HOEHE = 1.75, AUGEN = 1.55;
const FARBEN = ['#ff7a1a', '#2f8cff', '#2fd05a', '#e04fd0', '#ffd21f', '#ff4040', '#8f6bff', '#20d0c0'];
const BOT_FARBEN = ['#9aa3b5', '#c9a26b', '#7fb3a0', '#b58fc4', '#d68a8a', '#8fa8d6', '#a3c46b'];
const BOT_NAMEN = ['Bot Blitz', 'Bot Schaumi', 'Bot Turbo', 'Bot Zack', 'Bot Wumms', 'Bot Flitz', 'Bot Pfeil'];

// ========== 3D-Grundlagen ==========
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const leinwand = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#8fd0ff');
scene.fog = new THREE.Fog('#8fd0ff', 45, 100);
const kamera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 200);
kamera.rotation.order = 'YXZ';
scene.add(kamera);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix();
});

const himmelLicht = new THREE.HemisphereLight('#ffffff', '#6a7a8a', 1.7);
scene.add(himmelLicht);
const sonne = new THREE.DirectionalLight('#ffffff', 2.2);
sonne.position.set(15, 30, 10);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 });
scene.add(sonne);

const mat = farbe => new THREE.MeshLambertMaterial({ color: farbe });

// Bilder (Texturen) selbst malen
function malTextur(groesse, malen) {
  const c = document.createElement('canvas'); c.width = c.height = groesse;
  malen(c.getContext('2d'), groesse);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const kistenTex = malTextur(128, (g, s) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,255,255,.3)';
  for (let i = -s; i < s; i += 32) { g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.lineTo(i + s + 12, 0); g.lineTo(i + 12, s); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.fillRect(0, 0, s, 8); g.fillRect(0, s - 8, s, 8); g.fillRect(0, 0, 8, s); g.fillRect(s - 8, 0, 8, s);
});


// ========== Die Karten (Maps) ==========
// Jede Karte hat: Größe G, Himmelsfarbe, Licht, Boden, Startpunkte und eine bauen()-Funktion.
// Eine neue Karte bauen? Einfach unten bei KARTEN eine dazuschreiben!
let G = 20;            // die Arena geht von -G bis +G Meter
let STARTPUNKTE = [];
let karte = 'arena';
let kartenUpdate = null;   // manche Karten bewegen etwas (z. B. Schneeflocken)
const kisten = [];   // alle Hindernisse als Kästen: x1..x2, y1..y2, z1..z2
const arena = new THREE.Group();   // alles, was zur Karte gehört
scene.add(arena);

function kollision(cx, cz, b, t, h, y0 = 0) {   // unsichtbares Hindernis
  kisten.push({ x1: cx - b / 2, x2: cx + b / 2, z1: cz - t / 2, z2: cz + t / 2, y1: y0, y2: y0 + h });
}
function kiste(cx, cz, b, t, h, farbe, y0 = 0, textur = kistenTex) {
  kollision(cx, cz, b, t, h, y0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), new THREE.MeshLambertMaterial({ color: farbe, map: textur }));
  m.position.set(cx, y0 + h / 2, cz);
  m.castShadow = m.receiveShadow = true;
  arena.add(m);
  return m;
}
// Deko = nur zum Anschauen, man kann durchlaufen (Hindernis extra mit kollision())
function deko(geo, farbe, x, y, z, leuchtet = false) {
  const m = new THREE.Mesh(geo, leuchtet ? new THREE.MeshBasicMaterial({ color: farbe }) : mat(farbe));
  m.position.set(x, y, z);
  m.castShadow = !leuchtet; m.receiveShadow = true;
  arena.add(m);
  return m;
}
// die 4 gespiegelten Punkte (damit die Karte für alle fair ist)
function vierPunkte(x, z) {
  const liste = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const p = [x * sx || 0, z * sz || 0];
    if (!liste.some(q => q[0] === p[0] && q[1] === p[1])) liste.push(p);
  }
  return liste;
}
// baut ein Hindernis in alle 4 Ecken gespiegelt
function viermal(cx, cz, b, t, h, farbe, y0 = 0, textur) {
  for (const [x, z] of vierPunkte(cx, cz)) kiste(x, z, b, t, h, farbe, y0, textur);
}
// noch mehr selbstgemalte Bilder
const heckenTex = malTextur(128, (g, s) => {
  g.fillStyle = '#2f7a34'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = ['#3f9a44', '#24632a', '#4fae4f', '#1e5223'][i % 4];
    g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 3 + Math.random() * 5, 0, Math.PI * 2); g.fill();
  }
});
const wuerfelTex = malTextur(128, (g, s) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#222';
  for (const [x, y] of [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]]) { g.beginPath(); g.arc(x * s, y * s, s * 0.09, 0, Math.PI * 2); g.fill(); }
});
wuerfelTex.wrapS = wuerfelTex.wrapT = THREE.ClampToEdgeWrapping;

// ----- Bausteine für die Karten -----
function regal(cx, cz, laenge) {   // Lagerhallen-Regal voller Pakete
  kiste(cx, cz, 1.4, laenge, 3.2, '#c8a165');
  for (const y of [0, 1.05, 2.1, 3.15]) deko(new THREE.BoxGeometry(1.6, 0.1, laenge + 0.2), '#ff7a1a', cx, y + 0.05, cz);
  for (const z of [-1, 1]) deko(new THREE.BoxGeometry(1.7, 3.3, 0.15), '#2b59c3', cx, 1.65, cz + z * (laenge / 2 + 0.1));
}
function schneemann(x, z) {
  kollision(x, z, 1.3, 1.3, 2.2);
  deko(new THREE.SphereGeometry(0.7, 16, 12), '#ffffff', x, 0.6, z);
  deko(new THREE.SphereGeometry(0.5, 16, 12), '#ffffff', x, 1.5, z);
  deko(new THREE.SphereGeometry(0.36, 16, 12), '#ffffff', x, 2.15, z);
  const nase = deko(new THREE.ConeGeometry(0.07, 0.35, 8), '#ff7a1a', x, 2.15, z + 0.45);
  nase.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) deko(new THREE.SphereGeometry(0.05, 6, 4), '#111', x + s * 0.13, 2.27, z + 0.3);
  deko(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 12), '#222', x, 2.6, z);
}
function tanne(x, z) {
  kollision(x, z, 1.2, 1.2, 4.5);
  deko(new THREE.CylinderGeometry(0.22, 0.28, 1, 8), '#6b4226', x, 0.5, z);
  [[1.5, 1.6], [1.15, 2.6], [0.75, 3.5]].forEach(([r, y]) => {
    deko(new THREE.ConeGeometry(r, 1.5, 10), '#1f6b3a', x, y, z);
    deko(new THREE.ConeGeometry(r * 0.55, 0.5, 10), '#ffffff', x, y + 0.55, z);
  });
}
function legostein(x, z, b, t, farbe, y0 = 0) {
  kiste(x, z, b, t, 1, farbe, y0, null);
  for (let i = 0.5; i < b; i += 1) for (let j = 0.5; j < t; j += 1)
    deko(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14), farbe, x - b / 2 + i, y0 + 1.1, z - t / 2 + j);
}
function spielzeugAuto(x, z, farbe) {
  kiste(x, z, 3.2, 1.6, 0.6, farbe, 0.3, null);
  kiste(x - 0.2, z, 1.6, 1.4, 0.7, '#bfe6ff', 0.9, null);
  kollision(x, z, 3.2, 1.6, 0.3);   // unter dem Auto kann man nicht durch
  for (const [dx, dz] of [[-1, -0.85], [1, -0.85], [-1, 0.85], [1, 0.85]]) {
    const rad = deko(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16), '#222', x + dx, 0.4, z + dz);
    rad.rotation.x = Math.PI / 2;
  }
}
function teddy(x, z) {
  kollision(x, z, 2.6, 2.6, 4);
  const fell = '#b07a4a', hell = '#e0b98a';
  deko(new THREE.SphereGeometry(1.3, 20, 14), fell, x, 1.3, z);
  deko(new THREE.SphereGeometry(0.85, 20, 14), hell, x * 0.97, 1.2, z * 0.97);
  deko(new THREE.SphereGeometry(0.9, 20, 14), fell, x, 3.0, z);
  const zur = Math.atan2(-x, -z);   // Teddy schaut zur Mitte
  const vx = Math.sin(zur), vz = Math.cos(zur), qx = Math.cos(zur), qz = -Math.sin(zur);
  deko(new THREE.SphereGeometry(0.35, 12, 8), hell, x + vx * 0.75, 2.85, z + vz * 0.75);
  deko(new THREE.SphereGeometry(0.12, 8, 6), '#222', x + vx * 1.05, 2.95, z + vz * 1.05);
  for (const s of [-1, 1]) {
    deko(new THREE.SphereGeometry(0.3, 12, 8), fell, x + qx * s * 0.65, 3.75, z + qz * s * 0.65);
    deko(new THREE.SphereGeometry(0.1, 8, 6), '#111', x + vx * 0.75 + qx * s * 0.3, 3.2, z + vz * 0.75 + qz * s * 0.3);
  }
}
function ball(x, z, r, farbe) {
  kollision(x, z, r * 1.6, r * 1.6, r * 2);
  deko(new THREE.SphereGeometry(r, 24, 16), farbe, x, r, z);
  const streifen = deko(new THREE.TorusGeometry(r * 1.005, r * 0.12, 8, 32), '#ffffff', x, r, z);
  streifen.rotation.y = x + z;
}
function hecke(cx, cz, b, t) { viermal(cx, cz, b, t, 2.6, '#ffffff', 0, heckenTex); }

const KARTEN = {
  arena: {
    name: '🏟️ Spiel-Arena', text: 'Die bunte Arena mit dem Turm in der Mitte. Gut für den Anfang!',
    G: 20, himmel: '#8fd0ff', nebel: [45, 100], licht: [1.7, 2.2], wand: ['#2b59c3', '#ff7a1a'], wandHoehe: 4,
    boden: (g, s) => { g.fillStyle = '#e4e8f0'; g.fillRect(0, 0, s, s); g.strokeStyle = '#c3cad8'; g.lineWidth = 8; g.strokeRect(0, 0, s, s); },
    start: [[18, 0], [0, 18], [18, 18], [8, 0], [0, 8]],
    bauen() {
      // Turm in der Mitte mit Stufen
      kiste(0, 0, 4, 4, 1.8, '#2f8cff');
      kiste(3, 0, 2, 2, 0.9, '#ff7a1a'); kiste(-3, 0, 2, 2, 0.9, '#ff7a1a');
      // L-Wände
      viermal(10, 12.5, 0.6, 5, 2.5, '#ffd21f'); viermal(12.5, 10, 5, 0.6, 2.5, '#ffd21f');
      // Kisten zum Verstecken und Draufspringen
      viermal(6, 6, 1.4, 1.4, 0.9, '#ff7a1a');
      viermal(16, 16, 1.6, 1.6, 0.9, '#2fd05a'); viermal(16, 16, 1.6, 1.6, 0.9, '#2f8cff', 0.9);
      viermal(15, 0, 0.6, 5, 1.1, '#e04fd0'); viermal(0, 15, 5, 0.6, 1.1, '#e04fd0');
      viermal(7, 15.5, 1.5, 1.5, 0.9, '#ff7a1a'); viermal(15.5, 7, 1.5, 1.5, 0.9, '#ff7a1a');
    },
  },
  lager: {
    name: '📦 Lagerhalle', text: 'Dunkle Halle mit hohen Regalen und langen Gängen. Oben auf den Laderampen kann man gut zielen!',
    G: 22, himmel: '#2c3038', nebel: [28, 75], licht: [1.2, 1.5], wand: ['#6b7280', '#5b6270'], wandHoehe: 7,
    boden: (g, s) => {
      g.fillStyle = '#8d939b'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? '#80868e' : '#9aa0a8'; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
      g.strokeStyle = '#767c84'; g.lineWidth = 4; g.strokeRect(0, 0, s, s);
    },
    start: [[19, 0], [10.5, 0], [0, 14], [19, 19], [10.5, 11], [3.5, 8]],
    bauen() {
      for (const [x, z] of vierPunkte(7, 11)) regal(x, z, 11);
      for (const [x, z] of vierPunkte(14, 11)) regal(x, z, 11);
      // Paletten-Pyramide in der Mitte
      kiste(0, 0, 3.4, 3.4, 0.9, '#c8a165'); kiste(0, 0, 1.8, 1.8, 0.9, '#a0784a', 0.9);
      viermal(10.5, 2, 1.3, 1.3, 0.9, '#c8a165'); viermal(4, 2.8, 1.2, 1.2, 0.9, '#a0784a');
      viermal(19, 11, 1.4, 1.4, 0.9, '#c8a165'); viermal(19, 11, 1.1, 1.1, 0.9, '#a0784a', 0.9);
      // Laderampen an beiden Enden mit Treppe
      viermal(0, 20, 10, 4, 1.8, '#7a828c'); viermal(0, 17, 3, 2, 0.9, '#ffd21f');
      // Lampen an der Decke
      for (const x of [-10.5, 0, 10.5]) for (const z of [-11, 0, 11]) deko(new THREE.BoxGeometry(2.2, 0.15, 0.6), '#fff6c9', x, 6.5, z, true);
    },
  },
  schnee: {
    name: '❄️ Schneefestung', text: 'Zwei Festungen aus Schnee! Super für Team-Kampf. Hinter Schneemännern und Tannen kann man sich verstecken.',
    G: 24, himmel: '#cfe0f0', nebel: [30, 90], licht: [1.9, 1.7], wand: ['#e8f4ff', '#d6ebff'], wandHoehe: 3,
    boden: (g, s) => {
      g.fillStyle = '#f4f8fc'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() < 0.5 ? '#e3edf7' : '#ffffff'; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 0, Math.PI * 2); g.fill(); }
    },
    start: [[0, 19], [5, 20], [16, 20], [20, 0], [10, 7], [0, 8]],
    bauen() {
      // die zwei Festungen (vorne mit Tor in der Mitte)
      viermal(5.5, 12, 7, 1, 1.4, '#ffffff');
      viermal(9.5, 17, 1, 11, 1.4, '#ffffff');
      viermal(9.5, 12, 2, 2, 1.8, '#dff0ff');            // Türme an den Ecken
      viermal(7.6, 13.8, 1.2, 1.2, 0.9, '#bfe3ff');      // Eisblock zum Hochklettern
      viermal(16, 17, 1.6, 1.6, 0.9, '#bfe3ff');
      // Mitte: Schneewall und Schneemänner
      kiste(0, 0, 6, 0.8, 1.1, '#ffffff');
      viermal(14, 5, 4, 0.8, 1.1, '#ffffff');
      for (const [x, z] of vierPunkte(6, 4)) schneemann(x, z);
      for (const [x, z] of vierPunkte(20, 5)) tanne(x, z);
      for (const [x, z] of vierPunkte(3, 7.5)) tanne(x, z);
      // Schneeflocken
      const anzahl = 1500, orte = new Float32Array(anzahl * 3);
      for (let i = 0; i < anzahl; i++) { orte[i * 3] = (Math.random() * 2 - 1) * G; orte[i * 3 + 1] = Math.random() * 20; orte[i * 3 + 2] = (Math.random() * 2 - 1) * G; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(orte, 3));
      const flocken = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.12 }));
      arena.add(flocken);
      kartenUpdate = dt => {
        for (let i = 0; i < anzahl; i++) {
          orte[i * 3 + 1] -= dt * 1.6;
          orte[i * 3] += Math.sin(orte[i * 3 + 1] + i) * dt * 0.3;
          if (orte[i * 3 + 1] < 0) orte[i * 3 + 1] += 20;
        }
        geo.attributes.position.needsUpdate = true;
      };
    },
  },
  zimmer: {
    name: '🧸 Riesen-Kinderzimmer', text: 'Oh nein, du bist geschrumpft! Kämpfe zwischen Riesen-Legosteinen, Würfeln, Spielzeugautos und Teddys. Klettere auf den Bücherturm!',
    G: 24, himmel: '#fbeed7', nebel: [55, 130], licht: [1.8, 1.6], sonnenFarbe: '#fff3dd', wand: ['#9fd3ff', '#ffb3c7'], wandHoehe: 12,
    boden: (g, s) => {
      g.fillStyle = '#c8915a'; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#b07a45'; g.lineWidth = 2;
      for (let i = 0; i < 60; i++) { const y = Math.random() * s; g.beginPath(); g.moveTo(Math.random() * s, y); g.lineTo(Math.random() * s, y + 2); g.stroke(); }
      g.fillStyle = '#9a6633';
      for (let i = 0; i < 4; i++) g.fillRect(0, i * s / 4, s, 4);
      g.fillRect(s / 2, 0, 4, s / 4); g.fillRect(s / 5, s / 4, 4, s / 4); g.fillRect(s * 0.7, s / 2, 4, s / 4); g.fillRect(s * 0.4, s * 0.75, 4, s / 4);
    },
    start: [[20, 0], [0, 20], [20, 14], [11, 4], [4, 11]],
    bauen() {
      // Bücherturm in der Mitte – jedes Buch ist eine Stufe
      [[6.5, 4.5, '#e63946'], [5.4, 3.8, '#2b59c3'], [4.3, 3.1, '#2fd05a'], [3.2, 2.4, '#ffd21f'], [2.2, 1.8, '#8f6bff']].forEach(([b, t, farbe], i) => {
        kiste(0, 0, b, t, 0.55, farbe, i * 0.55, null);
        deko(new THREE.BoxGeometry(b - 0.25, 0.4, t + 0.02), '#fffaf0', 0.1, i * 0.55 + 0.275, 0);   // Seiten
      });
      viermal(9, 9, 1.6, 1.6, 1.6, '#ffffff', 0, wuerfelTex);
      const farben = ['#e63946', '#ffd21f', '#2b59c3', '#2fd05a'];
      vierPunkte(15, 4).forEach(([x, z], i) => legostein(x, z, 4, 2, farben[i]));
      vierPunkte(15, 13).forEach(([x, z], i) => { legostein(x, z, 4, 2, farben[(i + 1) % 4]); legostein(x, z, 2, 2, farben[(i + 2) % 4], 1); });
      vierPunkte(6, 15).forEach(([x, z], i) => spielzeugAuto(x, z, farben[(i + 3) % 4]));
      for (const [x, z] of vierPunkte(20.5, 20.5)) teddy(x, z);
      ball(0, 12, 0.9, '#ff7a1a'); ball(0, -12, 0.9, '#e04fd0'); ball(12, 0, 0.9, '#20d0c0'); ball(-12, 0, 0.9, '#8f6bff');
    },
  },
  hecke: {
    name: '🌇 Hecken-Labyrinth', text: 'Ein Garten-Labyrinth im Abendlicht. Enge Gänge, überall Ecken – hier ist der Schrot-Blaster stark!',
    G: 20, himmel: '#ffb37a', nebel: [28, 80], licht: [1.4, 2.0], sonnenFarbe: '#ffcf99', wand: ['#2f7a34', '#2f7a34'], wandHoehe: 3,
    boden: (g, s) => {
      g.fillStyle = '#d9c7a3'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 500; i++) { g.fillStyle = ['#c9b590', '#e6d6b5', '#bfa982'][i % 3]; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
    },
    start: [[17.5, 0], [0, 17.5], [12.5, 0], [0, 12.5], [7.5, 7.5], [17.5, 14], [14, 17.5]],
    bauen() {
      hecke(3.3, 5, 4.2, 0.8); hecke(5, 3.3, 0.8, 4.2);         // innerer Ring, Tore in der Mitte
      hecke(0, 10, 15, 0.8); hecke(10, 0, 0.8, 15);             // mittlerer Ring, offen an den Ecken
      hecke(8.45, 15, 13.9, 0.8); hecke(15, 8.45, 0.8, 13.9);   // äußerer Ring, Tore in der Mitte
      hecke(11.7, 5, 2.6, 0.8); hecke(5, 11.7, 0.8, 2.6);       // Sackgassen
      hecke(16.7, 10, 2.6, 0.8); hecke(10, 16.7, 0.8, 2.6);
      viermal(17.5, 17.5, 1.4, 1.4, 0.9, '#c58b4a');
      // Springbrunnen in der Mitte
      kiste(0, 0, 2.6, 2.6, 0.7, '#b8b2a7', 0, null);
      deko(new THREE.BoxGeometry(2.2, 0.05, 2.2), '#4fb3ff', 0, 0.71, 0);
      kiste(0, 0, 0.5, 0.5, 1.6, '#b8b2a7', 0.7, null);
      // Laternen
      for (const [x, z] of vierPunkte(10, 10)) {
        deko(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), '#333', x, 1.3, z);
        deko(new THREE.SphereGeometry(0.22, 10, 8), '#fff1a8', x, 2.7, z, true);
      }
    },
  },
};
const KARTEN_LISTE = Object.keys(KARTEN);

const bodenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial());
bodenMesh.receiveShadow = true;
scene.add(bodenMesh);

function karteBauen(name) {
  karte = KARTEN[name] ? name : 'arena';
  const K = KARTEN[karte];
  // alte Karte wegräumen
  arena.traverse(o => {
    if (!o.geometry) return;
    o.geometry.dispose();
    if (o.material.map && o.material.map !== kistenTex && o.material.map !== heckenTex && o.material.map !== wuerfelTex) o.material.map.dispose();
    o.material.dispose();
  });
  arena.clear();
  kisten.length = 0;
  kartenUpdate = null;
  for (const d of darts) scene.remove(d.mesh);
  darts = [];
  // Himmel, Licht und Boden
  G = K.G;
  scene.background = new THREE.Color(K.himmel);
  scene.fog = new THREE.Fog(K.himmel, K.nebel[0], K.nebel[1]);
  himmelLicht.intensity = K.licht[0];
  sonne.intensity = K.licht[1];
  sonne.color.set(K.sonnenFarbe || '#ffffff');
  sonne.position.set(G * 0.75, 30, G * 0.5);
  Object.assign(sonne.shadow.camera, { left: -G - 5, right: G + 5, top: G + 5, bottom: -G - 5, far: 90 });
  sonne.shadow.camera.updateProjectionMatrix();
  if (bodenMesh.material.map) bodenMesh.material.map.dispose();
  bodenMesh.material.map = malTextur(256, K.boden);
  bodenMesh.material.map.repeat.set(G, G);
  bodenMesh.material.needsUpdate = true;
  bodenMesh.scale.set(G * 2 + 2, 1, G * 2 + 2);
  // Außenwände
  const [w1, w2] = K.wand, wh = K.wandHoehe;
  kiste(0, -G - 0.5, G * 2 + 2, 1, wh, w1); kiste(0, G + 0.5, G * 2 + 2, 1, wh, w1);
  kiste(-G - 0.5, 0, 1, G * 2, wh, w2); kiste(G + 0.5, 0, 1, G * 2, wh, w2);
  K.bauen();
  // Startpunkte (gespiegelt), aber nur die, wo kein Hindernis steht
  STARTPUNKTE = K.start.flatMap(([x, z]) => vierPunkte(x, z)).filter(([x, z]) => !stoesst({ x, y: 0, z }));
  rasterBauen();
}

// ---------- Wegfinden für Bots ----------
// Die Karte wird in 1-Meter-Felder aufgeteilt. Frei = Bots können da laufen (niedrige Kisten springen sie hoch).
let frei = new Uint8Array(0), rasterN = 0;
function rasterBauen() {
  rasterN = G * 2;
  frei = new Uint8Array(rasterN * rasterN);
  for (let i = 0; i < rasterN; i++) for (let j = 0; j < rasterN; j++) {
    const x = -G + i + 0.5, z = -G + j + 0.5;
    frei[i * rasterN + j] = kisten.some(q => x + 0.45 > q.x1 && x - 0.45 < q.x2 && z + 0.45 > q.z1 && z - 0.45 < q.z2 && q.y2 > 1 && q.y1 < HOEHE) ? 0 : 1;
  }
}
const feldVon = v => Math.max(0, Math.min(rasterN - 1, Math.floor(v + G)));
const istFrei = (x, z) => frei[feldVon(x) * rasterN + feldVon(z)] === 1;
function geradeFrei(ax, az, bx, bz) {   // kann man auf gerader Linie hinlaufen?
  const schritte = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3);
  for (let i = 1; i <= schritte; i++) {
    const x = ax + (bx - ax) * i / schritte, z = az + (bz - az) * i / schritte;
    if (!istFrei(x, z) || !istFrei(x + 0.3, z) || !istFrei(x - 0.3, z) || !istFrei(x, z + 0.3) || !istFrei(x, z - 0.3)) return false;
  }
  return true;
}
// Breitensuche: vom Bot zu einem zufälligen freien Feld
function wegSuchen(b) {
  const start = feldVon(b.x) * rasterN + feldVon(b.z);
  let ziel = -1;
  for (let i = 0; i < 30 && ziel < 0; i++) { const f = Math.floor(Math.random() * frei.length); if (frei[f]) ziel = f; }
  if (ziel < 0) return [];
  const von = new Int32Array(frei.length).fill(-1);
  von[start] = start;
  const schlange = [start];
  for (let k = 0; k < schlange.length && von[ziel] < 0; k++) {
    const f = schlange[k], i = Math.floor(f / rasterN), j = f % rasterN;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= rasterN || nj >= rasterN) continue;
      const n = ni * rasterN + nj;
      if (von[n] >= 0 || !frei[n]) continue;
      if (di && dj && (!frei[ni * rasterN + j] || !frei[i * rasterN + nj])) continue;   // nicht um Ecken schneiden
      von[n] = f; schlange.push(n);
    }
  }
  if (von[ziel] < 0) return [];
  const pfad = [];
  for (let f = ziel; f !== start; f = von[f]) pfad.unshift([Math.floor(f / rasterN) - G + 0.5, f % rasterN - G + 0.5]);
  return pfad;
}

function inKiste(p) {
  for (const k of kisten) if (p.x > k.x1 && p.x < k.x2 && p.y > k.y1 && p.y < k.y2 && p.z > k.z1 && p.z < k.z2) return true;
  return false;
}
// Kann man von a nach b gucken, ohne dass eine Kiste im Weg ist?
const hilfsPunkt = new THREE.Vector3();
function sichtlinie(a, b) {
  const schritte = Math.ceil(a.distanceTo(b) / 0.4);
  for (let i = 1; i < schritte; i++) if (inKiste(hilfsPunkt.copy(a).lerp(b, i / schritte))) return false;
  return true;
}

// ========== Laufen, Springen, Zusammenstoßen ==========
function ueber(k, q) { return k.x + RADIUS > q.x1 && k.x - RADIUS < q.x2 && k.z + RADIUS > q.z1 && k.z - RADIUS < q.z2; }
function stoesst(k) {
  for (const q of kisten) if (ueber(k, q) && k.y + 0.05 < q.y2 && k.y + HOEHE > q.y1) return true;
  return false;
}
function bewegen(k, dx, dz, dt) {
  k.x += dx; if (stoesst(k)) k.x -= dx;
  k.z += dz; if (stoesst(k)) k.z -= dz;
  k.vy -= SCHWERKRAFT * dt;
  let neuY = k.y + k.vy * dt;
  k.amBoden = false;
  if (k.vy <= 0) {
    let hoch = 0;   // worauf stehe ich? (Boden oder Kiste)
    for (const q of kisten) if (ueber(k, q) && q.y2 <= k.y + 0.05) hoch = Math.max(hoch, q.y2);
    if (neuY <= hoch) { neuY = hoch; k.vy = 0; k.amBoden = true; }
  } else {
    for (const q of kisten) if (ueber(k, q) && q.y1 >= k.y + HOEHE - 0.01 && q.y1 < neuY + HOEHE) { neuY = k.y; k.vy = 0; }
  }
  k.y = neuY;
}
function winkelDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function dreheZu(a, ziel, max) { const d = winkelDiff(a, ziel); return a + Math.max(-max, Math.min(max, d)); }

// ========== Figuren und Blaster ==========
const hautMat = mat('#f1c27d'), hoseMat = mat('#2d3142'), brilleMat = mat('#ffd21f'), glasMat = mat('#1a1a1a');
const blasterOrange = mat('#ff7a1a'), blasterBlau = mat('#2f8cff'), blasterGelb = mat('#ffd21f');
function klotz(b, h, t, m, x, y, z) {
  const k = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), m);
  k.position.set(x, y, z); k.castShadow = true; return k;
}
const dunkelMat = mat('#2a2f3a'), lilaMat = mat('#8f6bff'), gruenMat = mat('#2fd05a'), rotMat = mat('#ff4040');
function rohr(radius, laenge, m, x, y, z) {   // ein Zylinder, der nach vorne zeigt
  const k = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, laenge, 10).rotateX(Math.PI / 2), m);
  k.position.set(x, y, z); k.castShadow = true; return k;
}
// 3D-Modelle aus dem assets-Ordner laden (Doppel-Blaster und sein Dart)
const modelle = { blaster: null, dart: null };
const gltfLader = new GLTFLoader();
gltfLader.load('assets/blaster.glb', g => { modelle.blaster = g.scene; blasterModellGeladen(); }, undefined, () => console.warn('blaster.glb fehlt'));
gltfLader.load('assets/dart.glb', g => { modelle.dart = g.scene; blasterModellGeladen(); }, undefined, () => console.warn('dart.glb fehlt'));
function blasterModellGeladen() {   // Blaster neu bauen, damit das echte Modell statt der Klötzchen erscheint
  if (waffe === 'doppel') meinenBlasterBauen();
  if (werkWaffe === 'doppel') vorschauBauen();
  for (const k of andere.values()) if (k.modell) k.modell.userData.waffe = null;
}

// ========== Skins und Sticker für die Blaster ==========
// Ein Skin gibt dem Blaster neue Farben und Muster. teile = [Hauptteil, Akzent 1, Akzent 2].
// Jedes Teil kann haben: farbe, textur (ein gemaltes Muster), glanz (glänzt wie Metall),
// leuchten (leuchtet im Dunkeln) und durchsichtig (0 = unsichtbar, 1 = gar nicht durchsichtig).
// Dunkle Teile (Läufe, Griffe, Löcher) bleiben immer dunkel.
// Neuer Skin? Einfach unten einen Eintrag dazuschreiben – das Menü baut den Knopf von allein!
const zufall = (a, b) => a + Math.random() * (b - a);
function muster(grundfarbe, malen) {   // ein 128x128-Bild mit Grundfarbe und Muster drauf
  return malTextur(128, (g, s) => { g.fillStyle = grundfarbe; g.fillRect(0, 0, s, s); if (malen) malen(g, s); });
}
function rundum(s, malen) {   // auch über den Rand malen, damit das Muster ohne Naht weitergeht
  for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) malen(dx, dy);
}
function flecken(g, s, farben, anzahl, groesse) {
  for (let i = 0; i < anzahl; i++) {
    g.fillStyle = farben[i % farben.length];
    const x = zufall(0, s), y = zufall(0, s), r = zufall(groesse * 0.5, groesse), f = zufall(0.5, 1), w = zufall(0, 3);
    rundum(s, (dx, dy) => { g.beginPath(); g.ellipse(x + dx, y + dy, r, r * f, w, 0, Math.PI * 2); g.fill(); });
  }
}
function risse(g, s, farbe, anzahl, dicke) {   // Zickzack-Linien (für Lava und Eis)
  g.strokeStyle = farbe; g.lineWidth = dicke; g.lineCap = g.lineJoin = 'round';
  for (let i = 0; i < anzahl; i++) {
    const punkte = [[zufall(0, s), zufall(0, s)]];
    for (let j = 0; j < 5; j++) { const [x, y] = punkte[j]; punkte.push([x + zufall(-28, 28), y + zufall(-28, 28)]); }
    rundum(s, (dx, dy) => { g.beginPath(); punkte.forEach(([x, y], j) => j ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy)); g.stroke(); });
  }
}
function sterne(g, s, anzahl) {
  for (let i = 0; i < anzahl; i++) { g.fillStyle = `rgba(255,255,255,${zufall(0.5, 1)})`; g.fillRect(zufall(0, s), zufall(0, s), zufall(1, 3), zufall(1, 3)); }
}
const SKINS = {
  standard:   { name: '🎨 Standard' },
  gold:       { name: '🏆 Gold', teile: () => [
    { textur: muster('#e8b010', (g, s) => { for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(255,248,190,.3)'; g.fillRect(0, i * s / 8, s, s / 32); } }), glanz: '#fff2a8' },
    { farbe: '#b8860b', glanz: '#fff2a8' }, { farbe: '#fff3b0', glanz: '#ffffff' }] },
  tarnung:    { name: '🪖 Tarnung', teile: () => [
    { textur: muster('#5b6b3a', (g, s) => flecken(g, s, ['#3e4a28', '#8a7a4a', '#2b3320'], 16, 24)) },
    { farbe: '#4a3b2a' }, { farbe: '#7d8a55' }] },
  regenbogen: { name: '🌈 Regenbogen', teile: () => [
    { textur: muster('#fff', (g, s) => ['#ff4040', '#ff9a1a', '#ffe11f', '#2fd05a', '#2f8cff', '#8f6bff', '#ff4fd8', '#ff4040']
      .forEach((f, i, liste) => { g.fillStyle = f; g.fillRect(i * s / (liste.length), 0, s / liste.length + 1, s); })) },
    { farbe: '#ffffff' }, { farbe: '#ff4fd8' }] },
  lava:       { name: '🌋 Lava', teile: () => [
    { textur: muster('#2a0c04', (g, s) => { risse(g, s, '#ff5a00', 9, 5); risse(g, s, '#ffd21f', 5, 2); }), leuchten: '#ffffff' },
    { farbe: '#ff4400', leuchten: '#ff3300' }, { farbe: '#2a1208' }] },
  galaxie:    { name: '🌌 Galaxie', teile: () => [
    { textur: muster('#12052e', (g, s) => { flecken(g, s, ['rgba(160,60,255,.35)', 'rgba(255,60,200,.25)', 'rgba(40,160,255,.25)'], 10, 34); sterne(g, s, 70); }), leuchten: '#bbbbbb' },
    { farbe: '#8f4bff', leuchten: '#5a20c0' }, { farbe: '#22e5ff', leuchten: '#1090b0' }] },
  eis:        { name: '🧊 Eis', teile: () => [
    { textur: muster('#bfeeff', (g, s) => risse(g, s, '#ffffff', 10, 2)), glanz: '#ffffff', durchsichtig: 0.8 },
    { farbe: '#7fd8ff', glanz: '#ffffff', durchsichtig: 0.85 }, { farbe: '#ffffff', glanz: '#ffffff' }] },
  zebra:      { name: '🦓 Zebra', teile: () => [
    { textur: muster('#f4f4f4', (g, s) => {
      g.strokeStyle = '#111'; g.lineWidth = 9;
      for (let i = 0; i < 5; i++) { g.beginPath(); for (let x = 0; x <= s; x += 4) g.lineTo(x, i * s / 5 + 12 + Math.sin(x / s * Math.PI * 2) * 8); g.stroke(); }
    }) },
    { farbe: '#ffffff' }, { farbe: '#ff4fa0' }] },
  bonbon:     { name: '🍬 Bonbon', teile: () => [
    { textur: muster('#ff8fd0', (g, s) => { g.fillStyle = '#fff'; for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.beginPath(); g.arc(x * 32 + 16 + (y % 2) * 16, y * 32 + 16, 7, 0, Math.PI * 2); g.fill(); } }) },
    { farbe: '#8fe8ff' }, { farbe: '#fff27a' }] },
  neon:       { name: '💚 Neon', teile: () => [
    { textur: muster('#0d0d14', (g, s) => { g.strokeStyle = '#39ff14'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.strokeRect(i * s / 4, -5, 0, s + 10); g.strokeRect(-5, i * s / 4, s + 10, 0); } }), leuchten: '#ffffff' },
    { farbe: '#ff2bd6', leuchten: '#ff2bd6' }, { farbe: '#22e5ff', leuchten: '#22e5ff' }] },
};
const SKIN_LISTE = Object.keys(SKINS);
// Sticker: einfach ein Emoji dazuschreiben. '' = kein Sticker
const STICKER = ['', '⭐', '🔥', '💀', '😎', '🐉', '❤️', '⚡', '🦈', '👑', '🍕', '👾', '🐱', '🎯', '🚀', '🤖'];
const skinVon = s => Object.hasOwn(SKINS, s) ? s : 'standard';
const stickerVon = s => STICKER.includes(s) ? s : '';

function skinMaterialien(name) {   // die 3 Materialien eines Skins (werden nur einmal gebaut)
  const S = SKINS[skinVon(name)];
  if (!S.teile) return null;
  if (!S.mats) S.mats = S.teile().map(t => {
    const o = { color: t.textur ? '#ffffff' : t.farbe, map: t.textur || null };
    if (t.leuchten) { o.emissive = new THREE.Color(t.leuchten); o.emissiveMap = t.textur || null; }
    if (t.durchsichtig) { o.transparent = true; o.opacity = t.durchsichtig; }
    return t.glanz ? new THREE.MeshPhongMaterial({ ...o, specular: t.glanz, shininess: 90 }) : new THREE.MeshLambertMaterial(o);
  });
  return S.mats;
}
// Damit das Muster überall gleich groß ist, bekommt jedes Teil neue Bild-Koordinaten (UV):
// je nachdem, in welche Richtung eine Fläche zeigt, wird das Muster von vorne, oben oder der Seite draufgelegt.
function musterKoordinaten(geo, massstab) {
  if (geo.userData.skinUV) return;
  geo.userData.skinUV = true;
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * massstab; uv[i * 2 + 1] = v * massstab;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
const skinTmp = new THREE.Vector3(), skinBox = new THREE.Box3();
function skinAnziehen(g, skin) {
  const mats = skinMaterialien(skin);
  if (!mats) return;
  // Alle hellen Teile sammeln (dunkle Teile und Darts bleiben, wie sie sind)
  const netze = [], groesse = new Map(), hsl = {};
  g.updateMatrixWorld(true);
  (function sammeln(o) {
    if (o.userData.keinSkin) return;
    if (o.isMesh && o.material.color && o.material.color.getHSL(hsl).l > 0.36) {
      o.getWorldScale(skinTmp);
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      o.geometry.boundingBox.getSize(skinBox.min);
      const v = skinBox.min.x * skinBox.min.y * skinBox.min.z * skinTmp.x ** 3;
      groesse.set(o.material, (groesse.get(o.material) || 0) + v);
      netze.push([o, skinTmp.x]);
    }
    for (const k of o.children) sammeln(k);
  })(g);
  // Die Farbe mit den größten Teilen wird zum Hauptteil, die anderen zu Akzenten
  const reihe = [...groesse.keys()].sort((a, b) => groesse.get(b) - groesse.get(a));
  for (const [o, s] of netze) {
    musterKoordinaten(o.geometry, 4 * s);   // Muster wiederholt sich alle 25 cm
    o.material = mats[Math.min(reihe.indexOf(o.material), 2)];
  }
}
const stickerGeo = new THREE.PlaneGeometry(1, 1), stickerMats = {};
function stickerMaterial(emoji) {   // Emoji mit weißem Rand, wie ein echter Aufkleber
  if (stickerMats[emoji]) return stickerMats[emoji];
  const s = 128, bild = document.createElement('canvas'), c = document.createElement('canvas');
  bild.width = bild.height = c.width = c.height = s;
  const b = bild.getContext('2d'), g = c.getContext('2d');
  b.font = '80px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillText(emoji, s / 2, s / 2 + 6);
  for (let i = 0; i < 16; i++) g.drawImage(bild, Math.cos(i / 8 * Math.PI) * 9, Math.sin(i / 8 * Math.PI) * 9);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'source-over'; g.drawImage(bild, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return stickerMats[emoji] = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -4 });
}
function stickerAufkleben(g, emoji) {
  const platz = g.userData.stickerPlatz;
  if (!emoji || !platz) return;
  for (const [x, y, z, gr, seite] of platz.stellen) {   // seite: 1 = rechts, -1 = links
    const st = new THREE.Mesh(stickerGeo, stickerMaterial(emoji));
    st.position.set(x, y, z); st.scale.setScalar(gr); st.rotation.y = seite * Math.PI / 2;
    (platz.an || g).add(st);
  }
}
// Welcher Skin und Sticker auf welchem Blaster ist (wird im Browser gemerkt)
const aussehen = {};
for (const w of WAFFEN_LISTE) aussehen[w] = { s: 'standard', st: '' };
try {
  const gemerktesAussehen = JSON.parse(localStorage.getItem('nerf-pvp-aussehen') || '{}');
  for (const w of WAFFEN_LISTE) if (gemerktesAussehen[w]) aussehen[w] = { s: skinVon(gemerktesAussehen[w].s), st: stickerVon(gemerktesAussehen[w].st) };
} catch (e) { /* egal */ }

function baueDoppelBlaster(g) {
  const limette = mat('#b5f04f');
  if (!modelle.blaster) {   // Modell noch nicht geladen: Ersatz aus Klötzchen
    g.add(klotz(0.1, 0.16, 0.55, limette, 0, 0, -0.15));
    g.add(rohr(0.035, 0.1, blasterOrange, 0, 0.03, -0.45), rohr(0.035, 0.1, blasterOrange, 0, -0.04, -0.45));
    g.add(klotz(0.07, 0.2, 0.1, blasterBlau, 0, -0.15, 0.13));
    g.userData.muendung = -0.5;
    g.userData.stickerPlatz = { stellen: [[0.051, 0, -0.05, 0.12, 1], [-0.051, 0, -0.05, 0.12, -1]] };
    return;
  }
  const m = modelle.blaster.clone();
  m.scale.setScalar(DOPPEL_GROESSE);
  m.position.z = -0.3;
  m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(m);
  const teil = name => m.getObjectByName(name);
  const wurzel = teil('Blaster');
  // Darts, die in den Kammern stecken (sieht man nur, wenn der Blaster aufgeklappt ist)
  const kammer = ['ChamberTopMouth', 'ChamberBottomMouth'].map(name => {
    if (!modelle.dart) return null;
    const mund = teil(name).position;
    const d = modelle.dart.clone();
    d.userData.sitzZ = mund.z + 0.023;   // Spitze schaut ca. 2 cm heraus
    d.userData.startZ = mund.z - 0.07;   // von vorne hineinschieben
    d.position.set(mund.x, mund.y, d.userData.sitzZ);
    d.userData.keinSkin = true;   // die Darts bekommen keinen Skin
    wurzel.add(d);
    return d;
  });
  const abzug = teil('Trigger'), lauf = teil('Barrels'), pumpe = teil('Slide');
  g.userData.muendung = -0.65;
  g.userData.stickerPlatz = { an: wurzel, stellen: [[0.0297, 0.005, 0.09, 0.042, 1], [-0.0297, 0.005, 0.09, 0.042, -1]] };   // auf dem blauen Schild
  g.userData.doppel = {
    abzug, lauf, pumpe, kammer,
    muendungen: [teil('MuzzleTop'), teil('MuzzleBottom')],   // erst oben, dann unten
    ruhe: { abzug: abzug.rotation.x, pumpe: pumpe.position.z },
  };
}

function baueBlaster(w = 'blitz', skin = 'standard', sticker = '') {
  const g = new THREE.Group();
  g.userData = { muendung: -0.6, drehen: null };
  if (w === 'doppel') {
    baueDoppelBlaster(g);
  } else if (w === 'schrot') {          // kurz, breit, zwei Läufe
    g.add(klotz(0.16, 0.15, 0.45, gruenMat, 0, 0, 0));
    g.add(rohr(0.04, 0.4, dunkelMat, -0.04, 0.03, -0.38), rohr(0.04, 0.4, dunkelMat, 0.04, 0.03, -0.38));
    g.add(klotz(0.14, 0.08, 0.16, blasterOrange, 0, -0.06, -0.3));   // Pump-Griff
    g.add(klotz(0.08, 0.2, 0.1, dunkelMat, 0, -0.15, 0.13));
    g.userData.muendung = -0.58;
    g.userData.stickerPlatz = { stellen: [[0.081, 0, 0.08, 0.12, 1], [-0.081, 0, 0.08, 0.12, -1]] };
  } else if (w === 'sniper') {   // lang mit Zielfernrohr
    g.add(klotz(0.1, 0.13, 0.6, lilaMat, 0, 0, 0.05));
    g.add(rohr(0.03, 0.6, dunkelMat, 0, 0.02, -0.55));
    g.add(rohr(0.045, 0.3, dunkelMat, 0, 0.12, -0.02));               // Zielfernrohr
    g.add(rohr(0.05, 0.02, rotMat, 0, 0.12, -0.17));
    g.add(klotz(0.08, 0.2, 0.1, dunkelMat, 0, -0.15, 0.15));
    g.add(klotz(0.09, 0.16, 0.22, lilaMat, 0, -0.04, 0.42));           // Schulterstütze
    g.userData.muendung = -0.85;
    g.userData.stickerPlatz = { stellen: [[0.051, 0, 0.12, 0.11, 1], [-0.051, 0, 0.12, 0.11, -1]] };
  } else if (w === 'minigun') {  // viele Läufe, die sich drehen
    g.add(klotz(0.2, 0.2, 0.4, blasterGelb, 0, 0, 0.05));
    const trommel = new THREE.Group(); trommel.position.set(0, 0, -0.3);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; trommel.add(rohr(0.025, 0.5, dunkelMat, Math.cos(a) * 0.06, Math.sin(a) * 0.06, -0.1)); }
    trommel.add(rohr(0.09, 0.05, rotMat, 0, 0, 0.08));
    g.add(trommel);
    g.add(klotz(0.08, 0.2, 0.1, dunkelMat, 0, -0.18, 0.13));
    g.add(klotz(0.16, 0.18, 0.16, rotMat, 0.15, -0.05, 0.08));         // Munitionskiste
    g.userData.muendung = -0.62; g.userData.drehen = trommel;
    g.userData.stickerPlatz = { stellen: [[0.231, -0.05, 0.08, 0.13, 1], [-0.101, 0, 0.05, 0.16, -1]] };
  } else {                       // Blitz-Blaster
    g.add(klotz(0.12, 0.14, 0.5, blasterOrange, 0, 0, 0));       // Körper
    g.add(klotz(0.07, 0.07, 0.35, blasterBlau, 0, 0.02, -0.4));  // Lauf
    g.add(klotz(0.09, 0.09, 0.06, blasterGelb, 0, 0.02, -0.6));  // Mündung
    g.add(klotz(0.08, 0.2, 0.1, blasterBlau, 0, -0.15, 0.13));   // Griff
    g.add(klotz(0.1, 0.16, 0.12, blasterGelb, 0, -0.13, -0.12)); // Magazin
    g.add(klotz(0.05, 0.06, 0.16, blasterBlau, 0, 0.1, 0.05));   // Visier
    g.userData.stickerPlatz = { stellen: [[0.061, 0, 0.06, 0.12, 1], [-0.061, 0, 0.06, 0.12, -1]] };
  }
  skinAnziehen(g, skin);
  stickerAufkleben(g, sticker);
  return g;
}
function namensSchild(text, farbe) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(8, 8, 240, 48);
  g.font = 'bold 32px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = farbe; g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
  s.scale.set(1.2, 0.3, 1); s.position.y = 2.3;
  return s;
}
function baueFigur(farbe, name) {
  const g = new THREE.Group();
  const jacke = mat(farbe);
  const beinGeo = new THREE.BoxGeometry(0.2, 0.8, 0.22).translate(0, -0.4, 0);
  const b1 = new THREE.Mesh(beinGeo, hoseMat), b2 = new THREE.Mesh(beinGeo, hoseMat);
  b1.position.set(-0.13, 0.8, 0); b2.position.set(0.13, 0.8, 0); b1.castShadow = b2.castShadow = true;
  g.add(b1, b2);
  g.add(klotz(0.55, 0.7, 0.32, jacke, 0, 1.15, 0));            // Körper
  g.add(klotz(0.36, 0.36, 0.36, hautMat, 0, 1.68, 0));         // Kopf
  g.add(klotz(0.38, 0.1, 0.38, jacke, 0, 1.9, 0));             // Stirnband in Teamfarbe
  g.add(klotz(0.38, 0.12, 0.06, brilleMat, 0, 1.72, -0.19));   // Nerf-Schutzbrille
  g.add(klotz(0.3, 0.07, 0.02, glasMat, 0, 1.72, -0.225));
  g.add(klotz(0.13, 0.13, 0.45, jacke, -0.3, 1.32, -0.2), klotz(0.13, 0.13, 0.45, jacke, 0.3, 1.32, -0.2)); // Arme nach vorne
  const halter = new THREE.Group(); halter.position.set(0.05, 1.32, -0.55); g.add(halter);   // hier kommt der Blaster rein
  g.add(namensSchild(name, farbe));
  g.userData = { b1, b2, schritt: 0, halter, waffe: null };
  return g;
}

// Der Blaster, den DU in der Hand hältst (hängt an der Kamera)
let meinBlaster = baueBlaster();
kamera.add(meinBlaster);
function meinenBlasterBauen() {
  kamera.remove(meinBlaster);
  ich.skin = aussehen[waffe].s; ich.sticker = aussehen[waffe].st;
  meinBlaster = baueBlaster(waffe, ich.skin, ich.sticker);
  meinBlaster.traverse(m => { m.castShadow = false; });
  kamera.add(meinBlaster);
  doppelAnimieren(0);
}

// ========== Darts ==========
const dartKoerperGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8).translate(0, -0.04, 0);
const dartSpitzeGeo = new THREE.SphereGeometry(0.045, 8, 6).translate(0, 0.07, 0);
const dartBlau = mat('#2f8cff'), dartOrange = mat('#ff7a1a');
const OBEN = new THREE.Vector3(0, 1, 0);
let darts = [];
const dartMat = { blitz: dartBlau, schrot: mat('#2fd05a'), sniper: mat('#8f6bff'), minigun: mat('#ffd21f'), doppel: mat('#2a3f8f') };
const dartGroesse = { blitz: [1, 1], schrot: [0.75, 0.7], sniper: [1, 1.8], minigun: [0.7, 0.8], doppel: [1, 1] };   // [dicke, länge]
const DART_MODELL_GROESSE = 3.5;   // der echte Dart ist nur 7 cm lang – im Spiel größer, damit man ihn sieht
function neuerDart(von, w, o, r) {
  const mesh = new THREE.Group();
  if (w === 'doppel' && modelle.dart) {   // der Dart aus dem 3D-Modell
    const d = modelle.dart.clone();
    d.rotation.x = Math.PI / 2;            // Spitze zeigt im Modell nach vorne (-Z), hier nach oben (+Y)
    d.scale.setScalar(DART_MODELL_GROESSE);
    mesh.add(d);
  } else {
    mesh.add(new THREE.Mesh(dartKoerperGeo, dartMat[w]), new THREE.Mesh(dartSpitzeGeo, dartOrange));
    const [dicke, laenge] = dartGroesse[w];
    mesh.scale.set(dicke, laenge, dicke);
  }
  scene.add(mesh);
  const pos = new THREE.Vector3(o[0], o[1], o[2]);
  darts.push({ von, waffe: w, pos, alt: pos.clone(), vel: new THREE.Vector3(r[0], r[1], r[2]).normalize().multiplyScalar(WAFFEN[w].tempo), mesh, steckt: false, uhr: 3 });
  mesh.position.copy(pos);
}
function schussEmpfangen(von, w, o, liste) {   // ein Schuss kann mehrere Darts haben (Schrot-Blaster)
  w = waffeVon(w);
  for (const r of liste.slice(0, 8)) neuerDart(von, w, o, r);
  const weit = kamera.position.distanceTo(tmp.set(o[0], o[1], o[2]));   // Ton: je weiter weg, desto leiser
  pfumpSound(1 / (1 + weit / 8), w);
}

// Trifft ein Punkt p den Kämpfer k? (k.x/k.y/k.z = Füße)
function trifft(p, k) {
  const dx = p.x - k.x, dz = p.z - k.z, dy = p.y - k.y;
  if (dx * dx + (dy - 1.68) ** 2 + dz * dz < 0.25 * 0.25) return 'kopf';
  if (dy > 0 && dy < 1.55 && dx * dx + dz * dz < 0.38 * 0.38) return 'koerper';
  return null;
}

const tmp = new THREE.Vector3(), richtungTmp = new THREE.Vector3();
function dartsBewegen(dt) {
  for (const d of darts) {
    if (d.steckt) { d.uhr -= dt; if (d.uhr <= 0) d.weg = true; continue; }
    d.alt.copy(d.pos);
    d.vel.y -= WAFFEN[d.waffe].fallen * dt;
    d.pos.addScaledVector(d.vel, dt);
    d.uhr -= dt;
    if (d.uhr <= 0) d.weg = true;
    // Den Weg in kleinen Schritten prüfen, damit der Dart nicht durch etwas durchfliegt
    const schritte = Math.max(1, Math.ceil(d.alt.distanceTo(d.pos) / 0.08));
    suche: for (let i = 1; i <= schritte; i++) {
      const p = tmp.copy(d.alt).lerp(d.pos, i / schritte);
      for (const k of alleKaempfer()) {
        if (k.id === d.von || k.tot || gleichesTeam(k.id, d.von)) continue;   // eigenes Team: Dart fliegt durch
        const art = trifft(p, k);
        if (art) { treffer(d, k, art); d.weg = true; break suche; }
      }
      if (p.y <= 0.03 || inKiste(p)) {   // Wand oder Boden: Dart bleibt stecken
        d.pos.copy(p); d.steckt = true; d.uhr = 6;
        break;
      }
    }
    d.mesh.position.copy(d.pos);
    if (!d.steckt) d.mesh.quaternion.setFromUnitVectors(OBEN, richtungTmp.copy(d.vel).normalize());
  }
  for (const d of darts) if (d.weg) scene.remove(d.mesh);
  darts = darts.filter(d => !d.weg);
  while (darts.length > 160) scene.remove(darts.shift().mesh);   // nicht zu viele Darts auf einmal
}

function treffer(d, k, art) {
  const W = WAFFEN[d.waffe];
  const schaden = modus === 'einTreffer' ? MAX_LEBEN : art === 'kopf' ? W.kopf : W.schaden;
  if (k === ich) getroffen(schaden, d.von);
  else if (k.bot && istChef()) botGetroffen(k, schaden, d.von);
  if (d.von === ich.id) {   // DU hast getroffen!
    trefferAnzeige(art === 'kopf');
    ton(art === 'kopf' ? 1400 : 900, 0.08, 'square', 0.07);
  }
}

// ========== Kämpfer (du, Freunde und Bots) ==========
const ich = { id: 'p1', name: 'Spieler 1', farbe: FARBEN[0], x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, b: 0, n: 0, hp: MAX_LEBEN, tot: true, ruheUhr: 0 };
const andere = new Map();    // alle anderen Kämpfer: id -> Kämpfer
let punkte = {};             // id -> { name, farbe, kills, tode }
function alleKaempfer() { return [ich, ...andere.values()]; }
function nameVon(id) { return punkte[id] ? String(punkte[id].name) : '???'; }
const sicher = t => String(t).replace(/[&<>"']/g, z => '&#' + z.charCodeAt(0) + ';');   // Text sicher für HTML machen
function farbeVon(id) { return punkte[id] ? punkte[id].farbe : '#fff'; }
function teamVon(id) { return punkte[id] ? punkte[id].team : null; }
function gleichesTeam(a, b) { return modus === 'team' && !!teamVon(a) && teamVon(a) === teamVon(b); }
function teamGroesse(t) { return Object.values(punkte).filter(p => p.team === t).length; }
function teamPunkte(t) { return Object.values(punkte).filter(p => p.team === t).reduce((summe, p) => summe + p.kills, 0); }
function neuesTeam() { return modus !== 'team' ? null : teamGroesse('rot') <= teamGroesse('blau') ? 'rot' : 'blau'; }
function ausgeschieden(id) { return modus === 'ueberleben' && !!punkte[id] && punkte[id].tode >= UEBERLEBEN_LEBEN; }

function kaempferHinzu(k) {
  k.modell = baueFigur(k.farbe, k.name);
  scene.add(k.modell);
  andere.set(k.id, k);
}
function kaempferWeg(id) {
  const k = andere.get(id);
  if (k) scene.remove(k.modell);
  andere.delete(id);
}

function wiederbeleben(k) {
  // Startpunkt suchen, der möglichst weit weg von den Gegnern ist
  let bester = STARTPUNKTE[0], besteWeite = -1;
  for (const s of STARTPUNKTE) {
    let weite = 999;
    for (const o of alleKaempfer()) if (o !== k && !o.tot && !gleichesTeam(o.id, k.id)) weite = Math.min(weite, Math.hypot(o.x - s[0], o.z - s[1]));
    weite += Math.random() * 4;
    if (weite > besteWeite) { besteWeite = weite; bester = s; }
  }
  k.x = bester[0]; k.z = bester[1]; k.y = 0; k.vy = 0;
  k.hp = MAX_LEBEN; k.tot = false; k.ruheUhr = 0;
  k.b = Math.atan2(k.x, k.z); k.n = 0;   // schaut zur Mitte
  if (k.bot) {
    k.waffe = WAFFEN_LISTE[Math.floor(Math.random() * WAFFEN_LISTE.length)];   // Bots bekommen einen zufälligen Blaster
    k.skin = SKIN_LISTE[Math.floor(Math.random() * SKIN_LISTE.length)];   // ... und einen zufälligen Skin
    k.sticker = Math.random() < 0.6 ? STICKER[1 + Math.floor(Math.random() * (STICKER.length - 1))] : '';
    k.munition = magazinVon(k.waffe); k.nachladeUhr = 0; k.pfad = null; k.sehUhr = 0;
  }
  if (k === ich) { ich.vx = ich.vz = 0; for (const w of WAFFEN_LISTE) vorrat[w] = magazinVon(w); munition = vorrat[waffe]; nachladeUhr = 0; doppelLaden = null; }
}

function erholen(k, dt) {   // nach 4 Sekunden ohne Treffer kommen Leben zurück
  k.ruheUhr += dt;
  if (k.ruheUhr > 4 && k.hp < MAX_LEBEN) k.hp = Math.min(MAX_LEBEN, k.hp + 25 * dt);
}

// ---------- Du ----------
const tasten = {};
let maus = false, gesperrt = false, laeuft = false;
let munition = 12, nachladeUhr = 0, schussUhr = 0, rueckstoss = 0, laufPhase = 0, todHoehe = 0;
let waffe = 'blitz', wechselUhr = 0, zoom = false, rechtsMaus = false, nachladeDauer = 1;
let seitSchuss = 10, doppelLaden = null;   // für die Animation vom Doppel-Blaster
const vorrat = {};   // Munition für jeden Blaster

function waffeWechseln(w) {
  if (w === waffe || !WAFFEN[w]) return;
  vorrat[waffe] = munition;
  waffe = w; ich.waffe = w;
  munition = vorrat[w] ?? magazinVon(w);
  nachladeUhr = 0; wechselUhr = 0.35; doppelLaden = null; seitSchuss = 10;
  meinenBlasterBauen();
  waffenLeiste();
  ton(440, 0.05, 'square', 0.05);
}

function getroffen(schaden, von) {
  if (ich.tot) return;
  ich.hp -= schaden; ich.ruheUhr = 0;
  rotUhr = 0.4;
  ton(220, 0.2, 'sawtooth', 0.12, 90);
  if (ich.hp <= 0) {
    ich.hp = 0; ich.tot = true; ich.wiederUhr = 3; ich.killer = von;
    if (istChef()) raus(ich.id, von); else anHost({ t: 'raus', von });
  }
}

function nachladen() {
  if (nachladeUhr > 0 || munition === magazinVon(waffe) || ich.tot) return;
  if (waffe === 'doppel') { doppelNachladen(); return; }
  nachladeUhr = nachladeDauer = WAFFEN[waffe].nachladen;
  ton(300, 0.06, 'square', 0.06);
  setTimeout(() => ton(520, 0.08, 'square', 0.06), nachladeUhr * 800);
}

// ---------- Doppel-Blaster: Nachladen und Animation ----------
// Ablauf: aufklappen (0,4 s) → Darts gleiten in die Kammern → zuklappen (0,35 s)
const AUFKLAPPEN = 0.4, ZUKLAPPEN = 0.35, AUF_WINKEL = THREE.MathUtils.degToRad(95);
const DART_KLICK_ABSTAND = 1.07;   // im Nachlade-Sound klickt der 2. Dart nach 1,07 s
const KLICK_VERZOEGERUNG = 0.2;    // der Dart gleitet 0,2 s, dann klickt er ein
function doppelLauf() { return munition >= 2 ? 0 : 1; }   // 0 = oberer Lauf, 1 = unterer Lauf
function doppelNachladen() {
  // Geschossen wird erst oben, dann unten. Fehlt nur einer, ist es der obere.
  const fehlend = munition <= 0 ? [0, 1] : [0];
  const laden = (fehlend.length === 2 ? DART_KLICK_ABSTAND + 0.35 : 0.5) + KLICK_VERZOEGERUNG;
  doppelLaden = { fehlend, laden, zeit: 0, gespielt: new Set() };
  nachladeUhr = nachladeDauer = AUFKLAPPEN + laden + ZUKLAPPEN;
  sample('uncocked', 0.8);
}
const weich = t => 1 - Math.pow(1 - t, 3);
function doppelAnimieren(dt) {
  const D = meinBlaster.userData.doppel;
  seitSchuss += dt;
  if (doppelLaden) doppelLaden.zeit += dt;
  if (!D) return;
  // Abzug kippt kurz nach hinten, danach fährt der Pump-Schaft zurück und wieder vor
  const zug = seitSchuss < 0.15 ? Math.sin(seitSchuss / 0.15 * Math.PI) : 0;
  D.abzug.rotation.x = D.ruhe.abzug + zug * 0.45;
  const pt = seitSchuss - 0.12;
  const pump = pt > 0 && pt < 0.35 ? Math.sin(pt / 0.35 * Math.PI) : 0;
  D.pumpe.position.z = D.ruhe.pumpe + weich(pump) * 0.04;
  // Darts in den Kammern zeigen, wenn noch geladen
  if (D.kammer[0]) {
    D.kammer[0].visible = munition >= 2;
    D.kammer[1].visible = munition >= 1;
    for (const d of D.kammer) if (d) d.position.z = d.userData.sitzZ;
  }
  if (!doppelLaden) { D.lauf.rotation.x = 0; return; }
  const L = doppelLaden;
  const rt = L.zeit;
  const einmal = (name, machen) => { if (!L.gespielt.has(name)) { L.gespielt.add(name); machen(); } };
  let auf;
  if (rt < AUFKLAPPEN) auf = weich(rt / AUFKLAPPEN);
  else if (rt < AUFKLAPPEN + L.laden) auf = 1;
  else auf = 1 - weich(Math.min((rt - AUFKLAPPEN - L.laden) / ZUKLAPPEN, 1));
  D.lauf.rotation.x = -AUF_WINKEL * auf;
  if (rt > AUFKLAPPEN) {
    // fehlt ein Dart: nur der erste Klick vom Sound, fehlen zwei: beide Klicks
    if (rt > AUFKLAPPEN + KLICK_VERZOEGERUNG) einmal('laden', () => sample('reloading', 0.8, L.fehlend.length === 2 ? undefined : 0.45));
    L.fehlend.forEach((i, reihe) => {
      const d = D.kammer[i];
      if (!d) return;
      const k = Math.min((rt - AUFKLAPPEN - reihe * DART_KLICK_ABSTAND) / KLICK_VERZOEGERUNG, 1);
      d.visible = k > 0;
      d.position.z = THREE.MathUtils.lerp(d.userData.startZ, d.userData.sitzZ, Math.max(k, 0) ** 0.5);
    });
  }
  if (rt > AUFKLAPPEN + L.laden) einmal('zu', () => sample('cocked', 0.8));
}

function schiessen() {
  const W = WAFFEN[waffe];
  const D = meinBlaster.userData.doppel, lauf = doppelLauf();
  munition--; schussUhr = W.pause; rueckstoss = W.darts > 1 || waffe === 'sniper' || waffe === 'doppel' ? 2 : 1;
  const blick = new THREE.Vector3(); kamera.getWorldDirection(blick);
  const zielPunkt = kamera.position.clone().addScaledVector(blick, 40);
  let o = zoom ? kamera.position.clone().addScaledVector(blick, 0.5)   // mit Zoom kommt der Dart genau aus der Mitte
    : new THREE.Vector3(0.22, -0.2, -0.45 + meinBlaster.userData.muendung).applyQuaternion(kamera.quaternion).add(kamera.position);
  if (waffe === 'doppel') {
    seitSchuss = 0;
    naechsterDoppelLauf = lauf;
    if (D) { kamera.updateMatrixWorld(true); o = D.muendungen[lauf].getWorldPosition(new THREE.Vector3()); }   // Dart kommt genau aus dem Lauf
  }
  const mitte = zielPunkt.sub(o).normalize();
  const liste = [];
  for (let i = 0; i < W.darts; i++) {
    const r = mitte.clone();
    r.x += (Math.random() - 0.5) * W.streuung; r.y += (Math.random() - 0.5) * W.streuung; r.z += (Math.random() - 0.5) * W.streuung;
    liste.push(r.normalize());
  }
  feuern(ich.id, waffe, o, liste);
}

function feuern(von, w, o, liste) {
  const oa = [o.x, o.y, o.z], ra = liste.map(r => [r.x, r.y, r.z]);
  schussEmpfangen(von, w, oa, ra);
  if (rolle === 'host') anAlle({ t: 'schuss', von, w, o: oa, r: ra });
  if (rolle === 'gast') anHost({ t: 'schuss', w, o: oa, r: ra });
}

function spielerUpdate(dt) {
  if (ich.tot) {
    ich.wiederUhr -= dt;
    if (ausgeschieden(ich.id)) { mitte('👻 Keine Leben mehr – schau zu, wer gewinnt!', 0.1, '#ccc'); return; }
    mitte('💥 Getroffen von ' + nameVon(ich.killer) + '!  Zurück in ' + Math.ceil(ich.wiederUhr) + ' …', 0.1, farbeVon(ich.killer));
    if (ich.wiederUhr <= 0) wiederbeleben(ich);
    return;
  }
  erholen(ich, dt);
  let vor = 0, seit = 0;
  if (tasten.KeyW) vor += 1;
  if (tasten.KeyS) vor -= 1;
  if (tasten.KeyD) seit += 1;
  if (tasten.KeyA) seit -= 1;
  const laenge = Math.hypot(vor, seit) || 1;
  const maxTempo = (tasten.ShiftLeft || tasten.ShiftRight ? RENN_TEMPO : LAUF_TEMPO) * WAFFEN[waffe].laufen * (zoom ? 0.5 : 1);
  const fx = -Math.sin(ich.b), fz = -Math.cos(ich.b), rx = Math.cos(ich.b), rz = -Math.sin(ich.b);
  if (QUAKE_BEWEGUNG) {
    quakeBewegen(dt, (fx * vor + rx * seit) / laenge, (fz * vor + rz * seit) / laenge, vor || seit ? maxTempo : 0);
  } else {
    const tempo = maxTempo * dt / laenge;
    if (tasten.Space && ich.amBoden) ich.vy = SPRUNG_KRAFT;
    bewegen(ich, (fx * vor + rx * seit) * tempo, (fz * vor + rz * seit) * tempo, dt);
  }

  schussUhr -= dt;
  wechselUhr = Math.max(0, wechselUhr - dt);
  zoom = rechtsMaus && waffe === 'sniper' && nachladeUhr <= 0;
  if (nachladeUhr > 0) { nachladeUhr -= dt; if (nachladeUhr <= 0) { munition = magazinVon(waffe); doppelLaden = null; } }
  if (maus && gesperrt && schussUhr <= 0 && nachladeUhr <= 0 && wechselUhr <= 0) {
    if (munition > 0) schiessen();
    else { ton(1200, 0.03, 'square', 0.05); schussUhr = 0.25; nachladen(); }
  }
}

// So bewegt man sich in Quake: mit Schwung (vx, vz), Reibung am Boden und Lenken in der Luft
function beschleunigen(wx, wz, wunschTempo, beschl, dt, grenze = wunschTempo) {
  const jetzt = ich.vx * wx + ich.vz * wz;           // wie schnell bin ich schon in die gewünschte Richtung?
  const fehlt = grenze - jetzt;
  if (fehlt <= 0) return;
  const plus = Math.min(fehlt, beschl * wunschTempo * dt);
  ich.vx += wx * plus; ich.vz += wz * plus;
}
function quakeBewegen(dt, wx, wz, wunschTempo) {
  if (tasten.Space && ich.amBoden) {   // Springen bremst nicht = Bunny-Hop! (aber man darf noch Schwung holen)
    ich.vy = SPRUNG_KRAFT;
    beschleunigen(wx, wz, wunschTempo, BODEN_BESCHL, dt);
  } else if (ich.amBoden) {
    const tempo = Math.hypot(ich.vx, ich.vz);       // Reibung: am Boden langsamer werden
    if (tempo < 0.05) { ich.vx = ich.vz = 0; }
    else {
      const neu = Math.max(0, tempo - Math.max(tempo, STOPP_TEMPO) * REIBUNG * dt) / tempo;
      ich.vx *= neu; ich.vz *= neu;
    }
    beschleunigen(wx, wz, wunschTempo, BODEN_BESCHL, dt);
  } else {
    beschleunigen(wx, wz, wunschTempo, LUFT_BESCHL, dt, Math.min(wunschTempo, LUFT_MAX));
  }
  const tempo = Math.hypot(ich.vx, ich.vz);
  if (tempo > HOECHST_TEMPO) { ich.vx *= HOECHST_TEMPO / tempo; ich.vz *= HOECHST_TEMPO / tempo; }
  const altX = ich.x, altZ = ich.z;
  bewegen(ich, ich.vx * dt, ich.vz * dt, dt);
  if (ich.vx && ich.x === altX) ich.vx = 0;   // gegen eine Wand gelaufen: Schwung in diese Richtung ist weg
  if (ich.vz && ich.z === altZ) ich.vz = 0;
}

function zoomZeigen(an, dt) {
  const ziel = an ? 22 : 75;
  if (Math.abs(kamera.fov - ziel) > 0.1) { kamera.fov += (ziel - kamera.fov) * Math.min(1, dt * 15); kamera.updateProjectionMatrix(); }
  el('zielfernrohr').style.display = an && kamera.fov < 40 ? 'block' : 'none';
  el('fadenkreuz').style.display = an ? 'none' : 'block';
}
function kameraUpdate(dt) {
  if (ich.tot) {   // tot: Kamera schwebt nach oben
    todHoehe = Math.min(3, todHoehe + dt * 1.5);
    kamera.position.set(ich.x, ich.y + AUGEN + todHoehe, ich.z);
    kamera.rotation.set(-0.9, ich.b, 0);
    if (ausgeschieden(ich.id) && todHoehe >= 3) {   // Zuschauer: Kamera kreist über der Arena
      menuWinkel += dt * 0.2;
      kamera.position.set(Math.sin(menuWinkel) * 22, 15, Math.cos(menuWinkel) * 22);
      kamera.lookAt(0, 0, 0);
    }
    meinBlaster.visible = false; zoomZeigen(false, dt);
    return;
  }
  todHoehe = 0; meinBlaster.visible = !zoom;
  zoomZeigen(zoom, dt);
  if (meinBlaster.userData.drehen && maus && munition > 0 && nachladeUhr <= 0) meinBlaster.userData.drehen.rotation.z += dt * 25;
  const laufen = ich.amBoden && (tasten.KeyW || tasten.KeyA || tasten.KeyS || tasten.KeyD);
  if (laufen) laufPhase += dt * (tasten.ShiftLeft ? 13 : 9);
  const wippen = laufen ? Math.sin(laufPhase) * 0.035 : 0;
  kamera.position.set(ich.x, ich.y + AUGEN + Math.abs(wippen), ich.z);
  kamera.rotation.set(ich.n, ich.b, 0);
  rueckstoss = Math.max(0, rueckstoss - dt * 8);
  const wechsel = wechselUhr / 0.35;   // beim Wechseln kommt der neue Blaster von unten
  if (waffe === 'doppel') {
    // Beim Nachladen den Blaster zur Seite drehen, damit man das Aufklappen und die Darts sieht
    doppelAnimieren(dt);
    const L = doppelLaden;
    const dreh = L ? Math.min(1, L.zeit / 0.3, Math.max(0, nachladeUhr) / 0.3) : 0;
    const d = weich(dreh);
    meinBlaster.position.set(0.22 - d * 0.06 + wippen * 0.5, -0.22 + d * 0.04 - wechsel * 0.35 + Math.abs(wippen) * 0.3, -0.45 + rueckstoss * 0.08);
    meinBlaster.rotation.set(rueckstoss * 0.12 + d * 0.35, d * 0.9, d * 0.3);
    return;
  }
  const lade = nachladeUhr > 0 ? Math.sin((1 - nachladeUhr / nachladeDauer) * Math.PI) : 0;
  meinBlaster.position.set(0.22 + wippen * 0.5, -0.22 - lade * 0.15 - wechsel * 0.35 + Math.abs(wippen) * 0.3, -0.45 + rueckstoss * 0.08);
  meinBlaster.rotation.set(rueckstoss * 0.12 - lade * 0.7, 0, lade * 0.4);
}

// ---------- Bots (nur der Chef/Host steuert sie) ----------
let naechsteBotNr = 0;
function neuerBot() {
  const i = naechsteBotNr++, team = neuesTeam();
  const b = { id: 'b' + i, name: BOT_NAMEN[i % BOT_NAMEN.length], farbe: team ? TEAM_FARBE[team] : BOT_FARBEN[i % BOT_FARBEN.length], bot: true, team,
    x: 0, y: 0, z: 0, vy: 0, b: 0, n: 0, hp: MAX_LEBEN, tot: false, ruheUhr: 0,
    waffe: 'blitz', munition: 12, schussUhr: 1, nachladeUhr: 0, sehUhr: 0, seitwaerts: 0, seitUhr: 0, pfad: null, abkuerzUhr: 0, steckUhr: 0 };
  punkte[b.id] = { name: b.name, farbe: b.farbe, team, kills: 0, tode: 0 };
  kaempferHinzu(b);
  wiederbeleben(b);
}
function botsAnpassen() {   // Bots füllen auf MIN_KAEMPFER auf
  const soll = Math.max(0, MIN_KAEMPFER - 1 - gaeste.size);
  const bots = [...andere.values()].filter(k => k.bot);
  for (let i = bots.length; i < soll; i++) neuerBot();
  while (bots.length > soll) {
    let nr = bots.length - 1;
    if (modus === 'team') {   // aus dem größeren Team einen Bot wegnehmen, damit es fair bleibt
      const gross = teamGroesse('rot') >= teamGroesse('blau') ? 'rot' : 'blau';
      const i = bots.findIndex(b => b.team === gross);
      if (i >= 0) nr = i;
    }
    const weg = bots.splice(nr, 1)[0];
    kaempferWeg(weg.id); delete punkte[weg.id];
  }
}
function botGetroffen(b, schaden, von) {
  b.hp -= schaden; b.ruheUhr = 0;
  if (b.hp <= 0) { b.tot = true; b.wiederUhr = 3; raus(b.id, von); }
}

const auge = new THREE.Vector3(), zielAuge = new THREE.Vector3();
function botDenken(b, dt) {
  if (b.tot) { b.wiederUhr -= dt; if (b.wiederUhr <= 0 && !ausgeschieden(b.id)) wiederbeleben(b); return; }
  erholen(b, dt);
  b.schussUhr -= dt;
  if (b.nachladeUhr > 0) { b.nachladeUhr -= dt; if (b.nachladeUhr <= 0) b.munition = magazinVon(b.waffe); }

  // Den nächsten Gegner suchen, den der Bot sehen kann
  auge.set(b.x, b.y + AUGEN, b.z);
  let ziel = null, zielWeite = b.waffe === 'sniper' ? 45 : 35;
  for (const k of alleKaempfer()) {
    if (k === b || k.tot || gleichesTeam(k.id, b.id)) continue;
    const weite = Math.hypot(k.x - b.x, k.y - b.y, k.z - b.z);
    if (weite < zielWeite && sichtlinie(auge, zielAuge.set(k.x, k.y + 1.2, k.z))) { ziel = k; zielWeite = weite; }
  }

  let vor = 0, seit = 0;
  if (ziel) {
    b.sehUhr += dt;
    const dx = ziel.x - b.x, dz = ziel.z - b.z, flach = Math.hypot(dx, dz);
    const W = WAFFEN[b.waffe];
    const flugZeit = flach / W.tempo;
    const dy = ziel.y + 1.2 - (b.y + AUGEN) + 0.5 * W.fallen * flugZeit * flugZeit;  // etwas höher zielen, weil der Dart fällt
    const sollB = Math.atan2(-dx, -dz), sollN = Math.atan2(dy, flach);
    b.b = dreheZu(b.b, sollB, 5 * dt);
    b.n += (sollN - b.n) * Math.min(1, 8 * dt);
    // hin und her ausweichen
    b.seitUhr -= dt;
    if (b.seitUhr <= 0) {
      b.seitwaerts = [-1, 0, 1][Math.floor(Math.random() * 3)];
      b.seitUhr = 0.5 + Math.random();
      if (b.amBoden && Math.random() < 0.15) b.vy = SPRUNG_KRAFT;
    }
    seit = b.seitwaerts * 0.7;
    if (flach > W.botAbstand + 2) vor = 0.8; else if (flach < Math.max(3, W.botAbstand - 7)) vor = -0.6;   // jeder Blaster hat seinen Lieblings-Abstand
    // schießen
    if (b.sehUhr > 0.45 && Math.abs(winkelDiff(b.b, sollB)) < 0.12 && b.schussUhr <= 0 && b.nachladeUhr <= 0) {
      if (b.munition <= 0) b.nachladeUhr = W.nachladen + 0.6;
      else {
        b.munition--; b.schussUhr = W.pause * 1.5 + 0.1 + Math.random() * 0.25;
        const fehler = BOT_ZIELFEHLER * (b.waffe === 'sniper' ? 0.5 : 1);
        const bb = b.b + (Math.random() - 0.5) * fehler, nn = b.n + (Math.random() - 0.5) * fehler;
        const mitte = new THREE.Vector3(-Math.sin(bb) * Math.cos(nn), Math.sin(nn), -Math.cos(bb) * Math.cos(nn));
        const liste = [];
        for (let i = 0; i < W.darts; i++) {
          const r = mitte.clone();
          r.x += (Math.random() - 0.5) * W.streuung; r.y += (Math.random() - 0.5) * W.streuung; r.z += (Math.random() - 0.5) * W.streuung;
          liste.push(r.normalize());
        }
        feuern(b.id, b.waffe, auge.clone().addScaledVector(mitte, 0.7), liste);
      }
    }
  } else {
    // Niemand zu sehen: durch die Arena laufen
    b.sehUhr = 0;
    if (!b.pfad || !b.pfad.length) { b.pfad = wegSuchen(b); b.abkuerzUhr = 0; }
    // Abkürzen: wenn man den übernächsten Punkt schon gerade erreichen kann
    b.abkuerzUhr -= dt;
    if (b.abkuerzUhr <= 0) { b.abkuerzUhr = 0.25; while (b.pfad.length > 1 && geradeFrei(b.x, b.z, b.pfad[1][0], b.pfad[1][1])) b.pfad.shift(); }
    const wp = b.pfad[0];
    if (wp) {
      if (Math.hypot(wp[0] - b.x, wp[1] - b.z) < 0.6) b.pfad.shift();
      const soll = Math.atan2(-(wp[0] - b.x), -(wp[1] - b.z));
      b.b = dreheZu(b.b, soll, 7 * dt);
      vor = Math.abs(winkelDiff(b.b, soll)) > 0.9 ? 0.25 : 1;   // in engen Kurven langsamer
    }
    b.n *= 0.9;
  }

  const tempo = LAUF_TEMPO * 0.85 * dt;
  const fx = -Math.sin(b.b), fz = -Math.cos(b.b), rx = Math.cos(b.b), rz = -Math.sin(b.b);
  const mx = (fx * vor + rx * seit) * tempo, mz = (fz * vor + rz * seit) * tempo;
  const ax = b.x, az = b.z;
  bewegen(b, mx, mz, dt);
  // Steckt der Bot fest? Dann springen oder ein neues Ziel suchen
  const gewollt = Math.hypot(mx, mz), geschafft = Math.hypot(b.x - ax, b.z - az);
  if (gewollt > 0.001 && geschafft < gewollt * 0.3) {
    b.steckUhr += dt;
    if (b.steckUhr > 0.4 && b.amBoden) b.vy = SPRUNG_KRAFT;
    if (b.steckUhr > 1.2) { b.pfad = null; b.steckUhr = 0; }
  } else b.steckUhr = 0;
}

// ---------- Punkte, Ausscheiden und Sieg ----------
let siegPause = 0;
function raus(opfer, von) {   // nur beim Chef
  if (siegPause > 0) return;
  if (punkte[von]) punkte[von].kills++;
  if (punkte[opfer]) punkte[opfer].tode++;
  anAlle({ t: 'raus', opfer, von });
  zeigeRaus(opfer, von);
  if (modus === 'team') {
    const t = teamVon(von);
    if (t && teamPunkte(t) >= TEAM_SIEG) siegen('team-' + t);
  } else if (modus === 'ueberleben') {
    const uebrig = Object.keys(punkte).filter(id => !ausgeschieden(id));
    if (uebrig.length <= 1) siegen(uebrig[0] || von);
  } else if (punkte[von] && punkte[von].kills >= SIEG_PUNKTE) siegen(von);
}
function siegen(id) {
  siegPause = 5;
  anAlle({ t: 'sieg', id });
  zeigeSieg(id);
}
function neueRunde() {   // nur beim Chef
  if (kartenWechsel) karteBauen(KARTEN_LISTE[(KARTEN_LISTE.indexOf(karte) + 1) % KARTEN_LISTE.length]);
  for (const p of Object.values(punkte)) { p.kills = 0; p.tode = 0; }
  wiederbeleben(ich);
  for (const k of andere.values()) if (k.bot) wiederbeleben(k);
  anAlle({ t: 'neustart', karte });
  mitte('🔄 Neue Runde!' + (kartenWechsel ? '  Karte: ' + KARTEN[karte].name : ''), 2.5);
  codeZeigen();
}
function zeigeRaus(opfer, von) {
  feed(`<span style="color:${sicher(farbeVon(von))}">${sicher(nameVon(von))}</span> 🔫 <span style="color:${sicher(farbeVon(opfer))}">${sicher(nameVon(opfer))}</span>`);
  if (von === ich.id && opfer !== ich.id) {
    mitte('💥 Du hast ' + nameVon(opfer) + ' erwischt!', 1.5, '#ffd21f');
    ton(660, 0.1, 'triangle', 0.15); setTimeout(() => ton(990, 0.18, 'triangle', 0.15), 100);
  }
}
function zeigeSieg(id) {
  if (id.startsWith('team-')) {
    const t = id.slice(5);
    mitte('🏆 ' + TEAM_NAME[t] + ' gewinnt! 🏆' + (teamVon(ich.id) === t ? ' Das ist DEIN Team! 🎉' : ''), 5, TEAM_FARBE[t]);
  } else mitte(id === ich.id ? '🏆 DU HAST GEWONNEN! 🏆' : '🏆 ' + nameVon(id) + ' gewinnt! 🏆', 5, farbeVon(id));
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => ton(f, 0.25, 'triangle', 0.15), i * 150));
}

// ========== Online (PeerJS) ==========
// Einer erstellt den Raum (der "Host" = Chef). Der Chef steuert die Bots und zählt die Punkte.
// Jeder Spieler prüft selbst, ob ein Dart IHN getroffen hat.
let rolle = 'solo';           // 'solo', 'host' oder 'gast'
let peer = null, hostVerbindung = null, raumCode = '', netzUhr = 0;
const gaeste = new Map();
const istChef = () => rolle !== 'gast';
const netzInfo = t => { document.getElementById('netzInfo').textContent = t; };
const peerName = code => 'nerf-pvp-raum-' + code.toLowerCase();
function codeMachen() {
  const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += zeichen[Math.floor(Math.random() * zeichen.length)];
  return c;
}
function anAlle(d, ausser) { for (const g of gaeste.values()) if (g !== ausser && g.open) g.send(d); }
function anHost(d) { if (hostVerbindung && hostVerbindung.open) hostVerbindung.send(d); }

function raumErstellen() {
  if (typeof Peer === 'undefined') { netzInfo('😕 Online geht gerade nicht. Bist du mit dem Internet verbunden?'); return; }
  raumCode = codeMachen();
  netzInfo('⏳ Raum wird erstellt …');
  peer = new Peer(peerName(raumCode));
  peer.on('open', () => {
    rolle = 'host';
    spielStarten();
  });
  peer.on('connection', v => {
    v.on('open', () => {
      if (gaeste.size >= FARBEN.length - 1) { v.send({ t: 'voll' }); setTimeout(() => v.close(), 500); return; }
      v.nr = freieNummer(); v.id = 'p' + v.nr;
      gaeste.set(v.peer, v);
      const team = neuesTeam(), name = 'Spieler ' + v.nr, farbe = team ? TEAM_FARBE[team] : FARBEN[v.nr - 1];
      punkte[v.id] = { name, farbe, team, kills: 0, tode: 0 };
      kaempferHinzu({ id: v.id, name, farbe, x: 0, y: 0, z: 0, b: 0, n: 0, hp: MAX_LEBEN, tot: true });
      v.send({ t: 'hallo', nr: v.nr, modus, team, karte });
      botsAnpassen();
      feed(`👋 <span style="color:${farbe}">${name}</span> ist da!`);
      ton(660, 0.1, 'triangle', 0.1);
    });
    v.on('data', d => hostEmpfaengt(v, d));
    v.on('close', () => {
      if (!gaeste.has(v.peer)) return;
      gaeste.delete(v.peer);
      feed(sicher(nameVon(v.id)) + ' ist gegangen');
      kaempferWeg(v.id); delete punkte[v.id];
      botsAnpassen();
    });
  });
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { peer.destroy(); raumErstellen(); return; }   // Code schon vergeben -> neuer Code
    if (rolle === 'solo') netzInfo('😕 Das hat nicht geklappt (' + e.type + '). Versuch es nochmal!');
  });
}
function freieNummer() {
  const belegt = new Set([1, ...[...gaeste.values()].map(g => g.nr)]);
  for (let n = 2; n <= FARBEN.length; n++) if (!belegt.has(n)) return n;
  return FARBEN.length;
}
function positionUebernehmen(k, d) {
  if (k.tot && !d.tot) { k.x = d.x; k.y = d.y; k.z = d.z; k.b = d.b; }   // gerade wiederbelebt: hinspringen
  k.zx = d.x; k.zy = d.y; k.zz = d.z; k.zb = d.b; k.n = d.n; k.tot = d.tot; k.waffe = waffeVon(d.w);
  k.skin = skinVon(d.s); k.sticker = stickerVon(d.st);
}
function hostEmpfaengt(v, d) {
  if (d.t === 'pos') { const k = andere.get(v.id); if (k) positionUebernehmen(k, d); }
  else if (d.t === 'schuss') { const w = waffeVon(d.w); schussEmpfangen(v.id, w, d.o, d.r); anAlle({ t: 'schuss', von: v.id, w, o: d.o, r: d.r }, v); }
  else if (d.t === 'raus') raus(v.id, d.von);
}

function raumBeitreten(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 4) { netzInfo('Der Raum-Code hat 4 Zeichen.'); return; }
  if (typeof Peer === 'undefined') { netzInfo('😕 Online geht gerade nicht. Bist du mit dem Internet verbunden?'); return; }
  netzInfo('⏳ Suche Raum ' + code + ' …');
  peer = new Peer();
  peer.on('open', () => {
    hostVerbindung = peer.connect(peerName(code), { reliable: true });
    hostVerbindung.on('data', gastEmpfaengt);
    hostVerbindung.on('close', () => {
      if (rolle !== 'gast') return;
      alert('Die Verbindung zum Raum ist weg. 😕 Das Spiel startet neu.');
      location.reload();
    });
    raumCode = code;
  });
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') netzInfo('😕 Den Raum ' + code + ' gibt es nicht. Stimmt der Code?');
    else netzInfo('😕 Das hat nicht geklappt (' + e.type + '). Versuch es nochmal!');
  });
}
function gastEmpfaengt(d) {
  if (d.t === 'hallo') {
    rolle = 'gast';
    modus = MODI[d.modus] ? d.modus : 'ffa';
    karteBauen(d.karte);
    ich.id = 'p' + d.nr; ich.name = 'Spieler ' + d.nr; ich.team = d.team || null;
    ich.farbe = d.team ? TEAM_FARBE[d.team] : FARBEN[d.nr - 1];
    spielStarten();
  } else if (d.t === 'welt') {
    punkte = d.p;
    const da = new Set();
    for (const e of d.k) {
      if (e.id === ich.id) continue;
      da.add(e.id);
      let k = andere.get(e.id);
      if (!k) { k = { ...e }; kaempferHinzu(k); }
      k.bot = e.bot;
      positionUebernehmen(k, e);
    }
    for (const id of [...andere.keys()]) if (!da.has(id)) kaempferWeg(id);
  } else if (d.t === 'schuss') schussEmpfangen(d.von, d.w, d.o, d.r);
  else if (d.t === 'raus') zeigeRaus(d.opfer, d.von);
  else if (d.t === 'sieg') zeigeSieg(d.id);
  else if (d.t === 'neustart') {
    if (d.karte && d.karte !== karte) karteBauen(d.karte);
    for (const p of Object.values(punkte)) { p.kills = 0; p.tode = 0; }
    wiederbeleben(ich); mitte('🔄 Neue Runde!  Karte: ' + KARTEN[karte].name, 2.5); codeZeigen();
  }
  else if (d.t === 'voll') netzInfo('😕 Der Raum ist voll.');
}

const r2 = v => Math.round(v * 100) / 100;
function netzTick(dt) {
  if (rolle === 'solo') return;
  netzUhr -= dt;
  if (netzUhr > 0) return;
  netzUhr = 1 / 15;   // 15-mal pro Sekunde
  if (rolle === 'host') {
    const liste = alleKaempfer().map(k => ({ id: k.id, name: k.name, farbe: k.farbe, bot: !!k.bot,
      x: r2(k.x), y: r2(k.y), z: r2(k.z), b: r2(k.b), n: r2(k.n), tot: k.tot, w: k.waffe, s: k.skin, st: k.sticker }));
    anAlle({ t: 'welt', k: liste, p: punkte });
  } else {
    anHost({ t: 'pos', x: r2(ich.x), y: r2(ich.y), z: r2(ich.z), b: r2(ich.b), n: r2(ich.n), tot: ich.tot, w: waffe, s: ich.skin, st: ich.sticker });
  }
}

// Figuren der anderen bewegen und animieren
function modelleUpdate(dt) {
  const weich = Math.min(1, dt * 12);
  for (const k of andere.values()) {
    if (!(k.bot && istChef()) && k.zx !== undefined) {   // Positionen aus dem Netz weich angleichen
      k.x += (k.zx - k.x) * weich; k.y += (k.zy - k.y) * weich; k.z += (k.zz - k.z) * weich;
      k.b += winkelDiff(k.b, k.zb) * weich;
    }
    const m = k.modell, u = m.userData;
    const bewegt = Math.hypot(k.x - m.position.x, k.z - m.position.z);
    m.position.set(k.x, k.y, k.z);
    m.rotation.y = k.b;
    m.visible = !k.tot;
    const art = (k.waffe || 'blitz') + '|' + (k.skin || 'standard') + '|' + (k.sticker || '');
    if (u.waffe !== art) {   // anderer Blaster, Skin oder Sticker? Dann neu bauen
      u.waffe = art;
      u.halter.clear(); u.halter.add(baueBlaster(k.waffe || 'blitz', k.skin, k.sticker));
    }
    u.schritt += bewegt * 3;
    u.b1.rotation.x = Math.sin(u.schritt) * 0.7;
    u.b2.rotation.x = -Math.sin(u.schritt) * 0.7;
  }
}

// ========== Töne (Web Audio) ==========
let audio = null, rauschPuffer = null;
// Echte Spielzeug-Blaster-Geräusche (CC0, siehe assets/sounds/LIZENZ.txt)
const SAMPLES = {};
try {
  audio = new AudioContext();   // startet stumm, die Browser schalten Ton erst nach dem ersten Klick frei
  for (const name of ['left-trigger', 'right-trigger', 'uncocked', 'reloading', 'cocked']) {
    fetch('assets/sounds/' + name + '.mp3').then(r => r.arrayBuffer()).then(b => audio.decodeAudioData(b))
      .then(puffer => { SAMPLES[name] = puffer; }).catch(() => console.warn('Sound fehlt: ' + name));
  }
} catch (e) { /* kein Ton möglich */ }
function sample(name, laut = 1, dauer) {
  klang((a, t) => {
    if (!SAMPLES[name]) return;
    const q = a.createBufferSource(), v = a.createGain();
    q.buffer = SAMPLES[name]; v.gain.value = laut;
    q.connect(v); v.connect(a.destination);
    q.start(t, 0, dauer);
  });
}
let naechsterDoppelLauf = 0;
function klang(machen) {
  try {
    audio = audio || new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    machen(audio, audio.currentTime);
  } catch (e) { /* kein Ton möglich */ }
}
function ton(frequenz, dauer, typ = 'sine', laut = 0.2, ende) {
  klang((a, t) => {
    const o = a.createOscillator(), v = a.createGain();
    o.type = typ; o.frequency.setValueAtTime(frequenz, t);
    if (ende) o.frequency.exponentialRampToValueAtTime(ende, t + dauer);
    v.gain.setValueAtTime(laut, t); v.gain.exponentialRampToValueAtTime(0.001, t + dauer);
    o.connect(v); v.connect(a.destination); o.start(t); o.stop(t + dauer + 0.02);
  });
}
function pfumpSound(laut, w = 'blitz') {   // Luftstoß vom Blaster
  if (w === 'doppel') {   // echter Klick vom Spielzeug-Blaster: oberer Lauf links, unterer rechts
    sample(naechsterDoppelLauf === 0 ? 'left-trigger' : 'right-trigger', Math.min(1, laut * 1.3));
    naechsterDoppelLauf = Math.round(Math.random());
    laut *= 0.5;
  }
  const hoehe = { blitz: 1, schrot: 0.6, sniper: 1.5, minigun: 1.2, doppel: 0.8 }[w] || 1;
  if (w === 'schrot') laut *= 1.5;
  if (w === 'minigun') laut *= 0.6;
  klang((a, t) => {
    if (!rauschPuffer) {
      rauschPuffer = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate);
      const daten = rauschPuffer.getChannelData(0);
      for (let i = 0; i < daten.length; i++) daten[i] = Math.random() * 2 - 1;
    }
    const n = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
    n.buffer = rauschPuffer;
    f.type = 'bandpass'; f.frequency.setValueAtTime(1800 * hoehe, t); f.frequency.exponentialRampToValueAtTime(400 * hoehe, t + 0.12);
    v.gain.setValueAtTime(0.45 * laut, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    n.connect(f); f.connect(v); v.connect(a.destination); n.start(t); n.stop(t + 0.16);
  });
  ton(200 * hoehe, 0.1, 'sine', 0.35 * laut, 70 * hoehe);
  if (w === 'sniper') ton(1800, 0.15, 'triangle', 0.08 * laut, 600);   // Zisch!
}

// ========== Anzeige (HUD) ==========
const el = id => document.getElementById(id);
let rotUhr = 0, trefferUhr = 0, mitteUhr = 0, tabelleUhr = 0;
function mitte(text, sekunden, farbe = '#fff') { el('mitte').textContent = text; el('mitte').style.color = farbe; mitteUhr = sekunden; }
function trefferAnzeige(kopf) { trefferUhr = 0.25; el('trefferX').style.color = kopf ? '#ff4040' : '#fff'; }
function feed(html) {
  const zeile = document.createElement('div'); zeile.innerHTML = html;
  el('feed').prepend(zeile);
  while (el('feed').children.length > 5) el('feed').lastChild.remove();
  setTimeout(() => zeile.remove(), 6000);
}
function waffenLeiste() {
  el('waffen').innerHTML = WAFFEN_LISTE.map((w, i) =>
    `<div class="${w === waffe ? 'gewaehlt' : ''}"><small>${i + 1}</small> ${WAFFEN[w].emoji} ${WAFFEN[w].name}</div>`).join('');
}
function hudUpdate(dt) {
  el('lebenText').textContent = '❤️ ' + Math.ceil(ich.hp) + (modus === 'ueberleben' && punkte[ich.id] ? '   ·   💀 Leben übrig: ' + Math.max(0, UEBERLEBEN_LEBEN - punkte[ich.id].tode) : '');
  el('lebenFuell').style.width = ich.hp + '%';
  el('lebenFuell').style.background = ich.hp > 60 ? '#2fd05a' : ich.hp > 30 ? '#ffd21f' : '#ff4040';
  el('munition').textContent = nachladeUhr > 0 ? '🔄 Nachladen …' : WAFFEN[waffe].emoji + ' ' + munition + ' / ' + magazinVon(waffe);
  el('munition').style.color = munition === 0 ? '#ff4040' : '#fff';
  if (QUAKE_BEWEGUNG) {   // Tacho: wie schnell bist du gerade?
    const kmh = Math.round(Math.hypot(ich.vx, ich.vz) * 3.6);
    el('tacho').textContent = '💨 ' + kmh + ' km/h';
    el('tacho').style.color = kmh > 45 ? '#ff7a1a' : kmh > 33 ? '#ffd21f' : '#fff';
  }
  rotUhr = Math.max(0, rotUhr - dt); el('rot').style.opacity = rotUhr * 2;
  trefferUhr = Math.max(0, trefferUhr - dt); el('trefferX').style.opacity = trefferUhr * 4;
  mitteUhr -= dt; if (mitteUhr <= 0) el('mitte').textContent = '';
  tabelleUhr -= dt;
  if (tabelleUhr <= 0) {
    tabelleUhr = 0.25;
    const zeile = (id, p, wert) => `<div class="${id === ich.id ? 'ich' : ''}"><span style="color:${sicher(p.farbe)}">●</span> ${sicher(p.name)}${id === ich.id ? ' (Du)' : ''} <b>${sicher(wert)}</b></div>`;
    const liste = Object.entries(punkte).sort((a, b) => b[1].kills - a[1].kills);
    let html = '';
    if (modus === 'team') {
      html = `<div>🏆 Welches Team hat zuerst ${TEAM_SIEG}?</div>`;
      for (const t of ['rot', 'blau']) {
        html += `<div style="color:${TEAM_FARBE[t]};margin-top:4px">${TEAM_NAME[t]} <b>${teamPunkte(t)}</b></div>`;
        html += liste.filter(([, p]) => p.team === t).map(([id, p]) => zeile(id, p, p.kills)).join('');
      }
    } else if (modus === 'ueberleben') {
      html = '<div>💀 Wer bleibt übrig?</div>' + liste
        .sort((a, b) => a[1].tode - b[1].tode || b[1].kills - a[1].kills)
        .map(([id, p]) => zeile(id, p, ausgeschieden(id) ? '👻' : '❤️'.repeat(Math.max(0, UEBERLEBEN_LEBEN - p.tode)))).join('');
    } else {
      html = `<div>🏆 Wer zuerst ${SIEG_PUNKTE} hat</div>` + liste.map(([id, p]) => zeile(id, p, p.kills)).join('');
    }
    el('tabelle').innerHTML = html;
  }
}

// ========== Steuerung ==========
addEventListener('keydown', e => {
  tasten[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR' && laeuft) nachladen();
  const nr = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
  if (nr >= 0 && laeuft && !ich.tot) waffeWechseln(WAFFEN_LISTE[nr]);
});
addEventListener('keyup', e => { tasten[e.code] = false; });
addEventListener('mousemove', e => {
  if (!gesperrt) return;
  const empf = MAUS_EMPFINDLICH * kamera.fov / 75;   // mit Zoom langsamer drehen
  ich.b -= e.movementX * empf;
  ich.n = Math.max(-1.45, Math.min(1.45, ich.n - e.movementY * empf));
});
addEventListener('mousedown', e => { if (gesperrt && e.button === 0) maus = true; if (gesperrt && e.button === 2) rechtsMaus = true; });
addEventListener('mouseup', e => { if (e.button === 0) maus = false; if (e.button === 2) rechtsMaus = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => {   // Mausrad: Blaster wechseln
  if (!gesperrt || ich.tot) return;
  const i = WAFFEN_LISTE.indexOf(waffe) + (e.deltaY > 0 ? 1 : -1);
  waffeWechseln(WAFFEN_LISTE[(i + WAFFEN_LISTE.length) % WAFFEN_LISTE.length]);
});
function mausFangen() {
  try { const p = leinwand.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* geht nicht */ }
}
document.addEventListener('pointerlockchange', () => {
  gesperrt = document.pointerLockElement === leinwand;
  if (!gesperrt) { maus = false; rechtsMaus = false; for (const k in tasten) tasten[k] = false; }
  el('pause').classList.toggle('versteckt', !laeuft || gesperrt);
});
el('pause').onclick = mausFangen;

function spielStarten() {
  laeuft = true;
  el('menu').classList.add('versteckt');
  el('hud').classList.remove('versteckt');
  el('pause').classList.toggle('versteckt', gesperrt);
  if (istChef()) {
    ich.team = modus === 'team' ? 'rot' : null;
    if (ich.team) ich.farbe = TEAM_FARBE.rot;
    punkte[ich.id] = { name: ich.name, farbe: ich.farbe, team: ich.team, kills: 0, tode: 0 };
    botsAnpassen();
  }
  codeZeigen();
  if (ich.team) setTimeout(() => mitte('Du bist in ' + TEAM_NAME[ich.team] + '!', 2.5, TEAM_FARBE[ich.team]), 2600);
  ich.waffe = waffe;
  meinenBlasterBauen();
  waffenLeiste();
  wiederbeleben(ich);
  mitte('🔫 Los geht\'s! Triff die anderen!', 2.5, '#ffd21f');
}
function codeZeigen() {
  el('code').textContent = MODI[modus].name + '  ·  ' + KARTEN[karte].name +
    (rolle === 'host' ? '  ·  🌐 Raum-Code: ' + raumCode + ' – sag ihn deinen Freunden!' : rolle === 'gast' ? '  ·  🌐 Raum ' + raumCode : '');
}
// Karten-Auswahl im Menü (die Knöpfe werden aus KARTEN gebaut)
let kartenWechsel = false;   // true = nach jeder Runde kommt die nächste Karte
function karteWaehlen(name) {
  kartenWechsel = name === 'wechsel';
  if (!kartenWechsel) karteBauen(name);
  for (const k of document.querySelectorAll('.karteKnopf')) k.classList.toggle('gewaehlt', k.dataset.karte === name);
  el('karteText').textContent = kartenWechsel ? 'Nach jeder Runde geht es auf der nächsten Karte weiter!' : KARTEN[karte].text;
  try { localStorage.setItem('nerf-pvp-karte', name); } catch (e) { /* egal */ }
}
for (const name of [...KARTEN_LISTE, 'wechsel']) {
  const k = document.createElement('button');
  k.className = 'modusKnopf karteKnopf'; k.dataset.karte = name;
  const [emoji, ...rest] = (name === 'wechsel' ? '🔀 Jede Runde eine andere' : KARTEN[name].name).split(' ');
  k.innerHTML = emoji + '<br>' + rest.join(' ');
  k.onclick = () => karteWaehlen(name);
  el('karteKnoepfe').append(k);
}
let gemerkteKarte = 'arena';
try { gemerkteKarte = localStorage.getItem('nerf-pvp-karte') || 'arena'; } catch (e) { /* egal */ }
karteWaehlen(KARTEN[gemerkteKarte] || gemerkteKarte === 'wechsel' ? gemerkteKarte : 'arena');
if (kartenWechsel) karteBauen('arena');

// Spielmodus-Auswahl im Menü
function modusWaehlen(m) {
  modus = m;
  for (const k of document.querySelectorAll('[data-modus]')) k.classList.toggle('gewaehlt', k.dataset.modus === m);
  el('modusText').textContent = MODI[m].text;
  try { localStorage.setItem('nerf-pvp-modus', m); } catch (e) { /* egal */ }
}
for (const k of document.querySelectorAll('[data-modus]')) k.onclick = () => modusWaehlen(k.dataset.modus);
let gemerkt = 'ffa';
try { gemerkt = localStorage.getItem('nerf-pvp-modus') || 'ffa'; } catch (e) { /* egal */ }
modusWaehlen(MODI[gemerkt] ? gemerkt : 'ffa');
el('menuKnopf').onclick = e => { e.stopPropagation(); location.reload(); };

el('soloKnopf').onclick = () => { rolle = 'solo'; spielStarten(); mausFangen(); };
el('hostKnopf').onclick = raumErstellen;
el('beitretenKnopf').onclick = () => raumBeitreten(el('codeFeld').value);
el('codeFeld').addEventListener('keydown', e => { if (e.key === 'Enter') raumBeitreten(e.target.value); });

// ========== Blaster-Werkstatt (Skins und Sticker aussuchen) ==========
const vorschauRenderer = new THREE.WebGLRenderer({ canvas: el('vorschau'), antialias: true, alpha: true });
vorschauRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const vorschauSzene = new THREE.Scene();
vorschauSzene.add(new THREE.HemisphereLight('#ffffff', '#6a7a8a', 1.8));
const vorschauLicht = new THREE.DirectionalLight('#ffffff', 2.2);
vorschauLicht.position.set(-2, 3, 1.5);
vorschauSzene.add(vorschauLicht);
const vorschauKamera = new THREE.PerspectiveCamera(32, 1.8, 0.01, 10);
vorschauKamera.position.set(-1.65, 0.45, -0.25);
vorschauKamera.lookAt(0, 0, 0);
const vorschauDreher = new THREE.Group();   // dreht sich langsam hin und her
vorschauSzene.add(vorschauDreher);
let werkWaffe = 'blitz', vorschauZeit = 0;
function vorschauBauen() {
  const a = aussehen[werkWaffe];
  vorschauDreher.clear();
  const b = baueBlaster(werkWaffe, a.s, a.st);
  b.position.sub(new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3()));   // in die Mitte rücken
  vorschauDreher.add(b);
  for (const k of document.querySelectorAll('[data-werk]')) k.classList.toggle('gewaehlt', k.dataset.werk === werkWaffe);
  for (const k of document.querySelectorAll('[data-skin]')) k.classList.toggle('gewaehlt', k.dataset.skin === a.s);
  for (const k of document.querySelectorAll('[data-sticker]')) k.classList.toggle('gewaehlt', k.dataset.sticker === a.st);
}
function aussehenMerken() {
  try { localStorage.setItem('nerf-pvp-aussehen', JSON.stringify(aussehen)); } catch (e) { /* egal */ }
  vorschauBauen();
}
function knopf(box, html, daten, wert, klick) {
  const k = document.createElement('button');
  k.className = 'werkKnopf'; k.dataset[daten] = wert; k.innerHTML = html; k.onclick = klick;
  el(box).append(k);
  return k;
}
for (const w of WAFFEN_LISTE) knopf('werkWaffen', WAFFEN[w].emoji + ' ' + WAFFEN[w].name, 'werk', w, () => { werkWaffe = w; vorschauBauen(); });
for (const s of SKIN_LISTE) {
  const mats = skinMaterialien(s), m = mats && mats[0];
  const bild = !m ? 'linear-gradient(135deg, #ff7a1a 50%, #2f8cff 50%)' : m.map ? `url(${m.map.image.toDataURL()})` : '#' + m.color.getHexString();
  knopf('skinKnoepfe', `<span class="probe" style="background:${bild}"></span>${SKINS[s].name}`, 'skin', s, () => { aussehen[werkWaffe].s = s; aussehenMerken(); });
}
for (const st of STICKER) knopf('stickerKnoepfe', st || '🚫', 'sticker', st, () => { aussehen[werkWaffe].st = st; aussehenMerken(); });
el('alleKnopf').onclick = () => {
  for (const w of WAFFEN_LISTE) aussehen[w] = { ...aussehen[werkWaffe] };
  aussehenMerken();
  el('alleKnopf').textContent = '✅ Fertig!';
  setTimeout(() => { el('alleKnopf').textContent = '🔁 Auf alle Blaster kleben'; }, 1500);
};
vorschauBauen();
function vorschauZeichnen(dt) {
  const c = vorschauRenderer.domElement;
  if (c.width !== Math.round(c.clientWidth * vorschauRenderer.getPixelRatio())) vorschauRenderer.setSize(c.clientWidth, c.clientWidth / 1.8, false);
  vorschauZeit += dt;
  vorschauDreher.rotation.y = Math.sin(vorschauZeit * 0.7) * 0.7;
  vorschauRenderer.render(vorschauSzene, vorschauKamera);
}

// ========== Hauptschleife ==========
let letzteZeit = performance.now(), menuWinkel = 0;
function schleife(jetzt) {
  const dt = Math.min(0.05, (jetzt - letzteZeit) / 1000);
  letzteZeit = jetzt;
  if (laeuft) {
    spielerUpdate(dt);
    if (istChef()) {
      for (const k of andere.values()) if (k.bot) botDenken(k, dt);
      if (siegPause > 0) { siegPause -= dt; if (siegPause <= 0) neueRunde(); }
    }
    modelleUpdate(dt);
    dartsBewegen(dt);
    netzTick(dt);
    kameraUpdate(dt);
    hudUpdate(dt);
  } else {
    // Im Menü kreist die Kamera langsam über der Arena
    menuWinkel += dt * 0.15;
    meinBlaster.visible = false;
    kamera.position.set(Math.sin(menuWinkel) * G * 1.3, G * 0.65, Math.cos(menuWinkel) * G * 1.3);
    kamera.lookAt(0, 0, 0);
    vorschauZeichnen(dt);
  }
  if (kartenUpdate) kartenUpdate(dt);
  renderer.render(scene, kamera);
  requestAnimationFrame(schleife);
}
requestAnimationFrame(schleife);
