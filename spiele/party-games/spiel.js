// 🎲 PARTY GAMES – ein 3D-Brettspiel mit Minispielen für bis zu 4 Spieler
// Am selben Computer (jeder hat eigene Tasten) oder online mit Raum-Code. Fehlende Spieler sind Bots.
import * as THREE from 'three';

// ========== Einstellungen (hier kannst du herumprobieren!) ==========
// Das Brett: jeder Buchstabe ist ein Feld (im Kreis herum).
// S = Start, b = blau (+3), r = rot (−3), ? = Ereignis, L = Laden 🛒, g = Klau-Geist 👻, t = Teleporter 🌀
const BRETT = 'SbbrbL?bbgbrbb?btbrbbL?bgbrbb?bt';
// Abkürzungen quer über die Insel: von welchem Feld, zu welchem Feld, und welche Felder dazwischen liegen
const ABKUERZUNGEN = [
  { von: 28, nach: 4, felder: 'r?gr' },
  { von: 12, nach: 20, felder: '?rtr' },
];
// Gegenstände aus dem Laden 🛒
const GEGENSTAENDE = {
  turbo: { name: 'Turbo-Würfel', emoji: '🎲', preis: 5, text: 'Würfle einmal mit 3 Würfeln statt mit 2!' },
  falle: { name: 'Falle', emoji: '🪤', preis: 4, text: 'Versteck sie auf deinem Feld. Wer drüberhüpft, gibt dir Münzen!' },
  ruf: { name: 'Pokal-Ruf', emoji: '📯', preis: 8, text: 'Der Pokal fliegt ganz nah zu dir!' },
};
const TASCHE_PLATZ = 3;               // so viele Gegenstände passen in die Tasche 🎒
const FALLE_MUENZEN = 4;              // so viele Münzen kostet es, in eine Falle zu tappen
const KLAU_MUENZEN = 5;               // so viele Münzen klaut der Geist 👻
const FELDER = BRETT.length;          // so viele Felder hat der große Kreis
const START_MUENZEN = 10;
const POKAL_PREIS = 10;               // so viel kostet ein Pokal 🏆
const BLAU_MUENZEN = 3;               // blaues Feld: so viele Münzen bekommst du
const ROT_MUENZEN = 3;                // rotes Feld: so viele Münzen verlierst du
const MINISPIEL_PREIS = [10, 5, 3, 0];   // Münzen für Platz 1, 2, 3 und 4 im Minispiel
const HUEPF_ZEIT = 0.3;               // so lange dauert ein Hüpfer von Feld zu Feld (Sekunden)
const FARBEN = ['#ff4d4d', '#3d8bff', '#2ecc71', '#ffcc00', '#ff7ac8', '#a259ff', '#ff9a1f', '#22d3c5'];   // Farben zum Aussuchen
const NAME_LAENGE = 12;               // so lang darf ein Name sein
const BOT_NAMEN = ['Bot Hüpfi', 'Bot Wuschel', 'Bot Zappel', 'Bot Knuddel'];
const RUNDEN_WAHL = [5, 10, 15];

// Tasten: Wer spielt mit welchen Tasten? ('solo' = wenn nur einer an diesem Computer spielt)
const STEUERUNG = {
  solo: { name: 'WASD oder Pfeile + Leertaste', aktionName: 'Leertaste', hoch: ['KeyW', 'ArrowUp'], runter: ['KeyS', 'ArrowDown'], links: ['KeyA', 'ArrowLeft'], rechts: ['KeyD', 'ArrowRight'], aktion: ['Space', 'Enter'] },
  0: { name: 'WASD + Leertaste', aktionName: 'Leertaste', hoch: ['KeyW'], runter: ['KeyS'], links: ['KeyA'], rechts: ['KeyD'], aktion: ['Space'] },
  1: { name: 'Pfeiltasten + Enter', aktionName: 'Enter', hoch: ['ArrowUp'], runter: ['ArrowDown'], links: ['ArrowLeft'], rechts: ['ArrowRight'], aktion: ['Enter'] },
  2: { name: 'I J K L + U', aktionName: 'U', hoch: ['KeyI'], runter: ['KeyK'], links: ['KeyJ'], rechts: ['KeyL'], aktion: ['KeyU'] },
  3: { name: 'Ziffernblock 8 4 5 6 + 0', aktionName: '0 (Ziffernblock)', hoch: ['Numpad8'], runter: ['Numpad5'], links: ['Numpad4'], rechts: ['Numpad6'], aktion: ['Numpad0', 'NumpadEnter'] },
};

// ========== 3D-Grundlagen ==========
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const leinwand = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#6cc6ff');
scene.fog = new THREE.Fog('#6cc6ff', 60, 130);
const kamera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
const kameraZiel = new THREE.Vector3();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix();
});
scene.add(new THREE.HemisphereLight('#ffffff', '#5a8a5a', 1.6));
const sonne = new THREE.DirectionalLight('#fff6e0', 2.3);
sonne.position.set(12, 30, 14);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
scene.add(sonne);

const mat = farbe => new THREE.MeshLambertMaterial({ color: farbe });
const glanz = farbe => new THREE.MeshPhongMaterial({ color: farbe, shininess: 90, specular: '#ffffff' });
function teil(geo, material, x = 0, y = 0, z = 0, gruppe) {   // ein 3D-Teil bauen und hinstellen
  const m = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  if (gruppe) gruppe.add(m);
  return m;
}
// Zufall, der auf jedem Computer gleich ist (damit alle dieselben Bäume sehen)
function zufallMitSamen(samen) {
  return () => { samen |= 0; samen = samen + 0x6D2B79F5 | 0; let t = Math.imul(samen ^ samen >>> 15, 1 | samen); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const zufall = (a, b) => a + Math.random() * (b - a);
const zufallsZahl = n => Math.floor(Math.random() * n);
const sicher = t => String(t).replace(/[&<>"']/g, z => '&#' + z.charCodeAt(0) + ';');

// Bilder selbst malen
function malen(breite, hoehe, maler) {
  const c = document.createElement('canvas'); c.width = breite; c.height = hoehe;
  maler(c.getContext('2d'), breite, hoehe);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function textBild(text, farbe = '#fff', groesse = 70) {
  return malen(512, 128, (g, b, h) => {
    g.font = `bold ${groesse}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = groesse / 6; g.strokeStyle = '#000'; g.strokeText(text, b / 2, h / 2);
    g.fillStyle = farbe; g.fillText(text, b / 2, h / 2);
  });
}
function textSchild(text, farbe, hoehe = 0.5) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textBild(text, farbe), depthWrite: false }));
  s.scale.set(hoehe * 4, hoehe, 1);
  return s;
}

// Wasser und Wolken sind immer da
teil(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#2f9bdc' }), 0, -0.5, 0, scene).castShadow = false;
const wolken = [];
{
  const r = zufallMitSamen(7);
  for (let i = 0; i < 14; i++) {
    const w = new THREE.Group();
    for (let j = 0; j < 4; j++) teil(new THREE.SphereGeometry(1.5 + r() * 1.5, 12, 8), '#ffffff', j * 2 - 3, r(), r() * 1.5, w).castShadow = false;
    const winkel = r() * Math.PI * 2, weite = 35 + r() * 40;
    w.position.set(Math.cos(winkel) * weite, 14 + r() * 10, Math.sin(winkel) * weite);
    w.scale.y = 0.6;
    scene.add(w); wolken.push(w);
  }
}

// ========== Das Spielbrett ==========
const brett = new THREE.Group();
scene.add(brett);
const FELD_Y = 0.22;   // so hoch ist die Oberseite der Felder
const feldPos = [], feldArt = [], feldNext = [];   // feldNext: zu welchen Feldern man von hier aus hüpfen kann
const FELD_INFO = {
  start: { farbe: '#2ecc71', text: 'START' },
  blau: { farbe: '#3d8bff', text: '+' + BLAU_MUENZEN },
  rot: { farbe: '#ff4d4d', text: '−' + ROT_MUENZEN },
  ereignis: { farbe: '#a259ff', text: '?' },
  laden: { farbe: '#ff9a1f', text: '🛒' },
  klau: { farbe: '#4a4a6a', text: '👻' },
  teleport: { farbe: '#22d3c5', text: '🌀' },
};
const BUCHSTABE = { S: 'start', b: 'blau', r: 'rot', '?': 'ereignis', L: 'laden', g: 'klau', t: 'teleport' };
{
  // Der Weg: ein Rechteck mit runden Ecken. Die Felder werden gleichmäßig verteilt.
  const N = 2000, punkte = [], laenge = [0];
  for (let i = 0; i <= N; i++) {
    const t = i / N * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    punkte.push([15 * Math.sign(c) * Math.abs(c) ** 0.55, 10 * Math.sign(s) * Math.abs(s) ** 0.55]);
    if (i > 0) laenge.push(laenge[i - 1] + Math.hypot(punkte[i][0] - punkte[i - 1][0], punkte[i][1] - punkte[i - 1][1]));
  }
  let j = 0;
  for (let f = 0; f < FELDER; f++) {
    while (laenge[j] < f / FELDER * laenge[N]) j++;
    feldPos.push({ x: punkte[j][0], z: punkte[j][1] });
    feldArt.push(BUCHSTABE[BRETT[f]] || 'blau');
    feldNext.push([(f + 1) % FELDER]);
  }
  // Abkürzungen: neue Felder auf einem Bogen quer über die Insel
  for (const a of ABKUERZUNGEN) {
    const A = feldPos[a.von], B = feldPos[a.nach], C = { x: (A.x + B.x) * 0.3, z: (A.z + B.z) * 0.3 }, k = a.felder.length;
    let vorher = a.von;
    a.weg = [A];
    for (let i = 1; i <= k; i++) {
      const t = i / (k + 1), u = 1 - t, nr = feldPos.length;
      feldPos.push({ x: u * u * A.x + 2 * u * t * C.x + t * t * B.x, z: u * u * A.z + 2 * u * t * C.z + t * t * B.z });
      feldArt.push(BUCHSTABE[a.felder[i - 1]] || 'blau');
      feldNext.push([]);
      feldNext[vorher].push(nr);
      vorher = nr;
      a.weg.push(feldPos[nr]);
    }
    feldNext[vorher].push(a.nach);
    a.weg.push(B);
  }
  // Insel mit Sandstrand
  teil(new THREE.CylinderGeometry(1, 1.03, 1, 64), '#f1dca0', 0, -0.55, 0, brett).scale.set(22.5, 1, 16.5);
  teil(new THREE.CylinderGeometry(1, 1, 1, 64), '#6cc24a', 0, -0.5, 0, brett).scale.set(21, 1, 15);
  // Weg zwischen den Feldern
  const kurve = new THREE.CatmullRomCurve3(feldPos.slice(0, FELDER).map(p => new THREE.Vector3(p.x, 0.02, p.z)), true);
  teil(new THREE.TubeGeometry(kurve, 256, 0.45, 6, true), '#f3d9a4', 0, 0, 0, brett).scale.y = 0.12;
  for (const a of ABKUERZUNGEN) {
    const k = new THREE.CatmullRomCurve3(a.weg.map(p => new THREE.Vector3(p.x, 0.02, p.z)));
    teil(new THREE.TubeGeometry(k, 64, 0.4, 6, false), '#e8c98a', 0, 0, 0, brett).scale.y = 0.12;
  }
  // Felder
  const feldBilder = {};
  for (const [art, info] of Object.entries(FELD_INFO)) feldBilder[art] = malen(128, 128, (g, s) => {
    g.fillStyle = info.farbe; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.font = `bold ${info.text.length > 2 ? 30 : 56}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(info.text, s / 2, s / 2 + 3);
  });
  feldPos.forEach((p, f) => {
    teil(new THREE.CylinderGeometry(0.95, 1.02, 0.2, 28), '#ffffff', p.x, 0.1, p.z, brett);
    const oben = teil(new THREE.CircleGeometry(0.88, 28).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: feldBilder[feldArt[f]] }), p.x, 0.205, p.z, brett);
    oben.rotation.y = Math.atan2(-p.x, -p.z) + Math.PI;   // Schrift zeigt nach außen
    oben.castShadow = false;
  });
  // Bäume (nicht auf dem Weg)
  const r = zufallMitSamen(42);
  for (let i = 0; i < 160; i++) {
    const w = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.93, x = Math.cos(w) * d * 21, z = Math.sin(w) * d * 15;
    if (feldPos.some(p => Math.hypot(p.x - x, p.z - z) < 2.3) || Math.hypot(x / 6, z / 4) < 1.2) continue;
    const h = 0.8 + r() * 0.8;
    teil(new THREE.CylinderGeometry(0.15, 0.2, h, 6), '#8b5a2b', x, h / 2, z, brett);
    const krone = teil(new THREE.SphereGeometry(0.7 + r() * 0.4, 10, 8), r() < 0.5 ? '#2e9e3e' : '#3cb44a', x, h + 0.5, z, brett);
    krone.scale.y = 1.2;
  }
  // In der Mitte: ein Hügel mit einem Riesen-Geschenk
  teil(new THREE.SphereGeometry(5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), '#5db53f', 0, -0.1, 0, brett).scale.set(1.2, 0.45, 0.8);
  teil(new THREE.BoxGeometry(2.4, 2.4, 2.4), '#e0398b', 0, 3.2, 0, brett);
  teil(new THREE.BoxGeometry(2.5, 2.5, 0.5), '#ffcc00', 0, 3.2, 0, brett);
  teil(new THREE.BoxGeometry(0.5, 2.5, 2.5), '#ffcc00', 0, 3.2, 0, brett);
  for (const s of [-1, 1]) teil(new THREE.TorusGeometry(0.5, 0.15, 8, 16), '#ffcc00', s * 0.45, 4.6, 0, brett).rotation.y = Math.PI / 2;
}
// Luftballons, die über dem Brett schweben
const ballons = [];
['#ff4d4d', '#3d8bff', '#ffcc00', '#2ecc71', '#e0398b', '#a259ff'].forEach((farbe, i) => {
  const b = new THREE.Group();
  teil(new THREE.SphereGeometry(0.5, 14, 10), glanz(farbe), 0, 0, 0, b).scale.y = 1.2;
  teil(new THREE.CylinderGeometry(0.01, 0.01, 2), '#ffffff', 0, -1.6, 0, b);
  const w = i / 6 * Math.PI * 2;
  b.position.set(Math.cos(w) * 7, 6, Math.sin(w) * 4.5);
  b.userData.w = w;
  brett.add(b); ballons.push(b);
});

// Der Pokal 🏆
const pokal = new THREE.Group();
{
  const gold = glanz('#ffcc00');
  const profil = [[0, 0], [0.45, 0], [0.45, 0.1], [0.15, 0.2], [0.1, 0.55], [0.2, 0.65], [0.5, 0.9], [0.55, 1.4], [0.5, 1.42], [0.42, 0.95], [0, 0.85]].map(([x, y]) => new THREE.Vector2(x, y));
  teil(new THREE.LatheGeometry(profil, 24), gold, 0, 0, 0, pokal);
  for (const s of [-1, 1]) { const h = teil(new THREE.TorusGeometry(0.22, 0.05, 8, 16, Math.PI), gold, s * 0.55, 1.12, 0, pokal); h.rotation.z = -s * Math.PI / 2; }
  const stern = teil(new THREE.OctahedronGeometry(0.15), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 0, 1.75, 0, pokal);
  stern.castShadow = false;
  pokal.scale.setScalar(0.9);
  brett.add(pokal);
}
const pokalSchild = textSchild(POKAL_PREIS + ' 🪙', '#ffcc00', 0.45);
pokalSchild.position.y = 2.2;
pokal.add(pokalSchild);

// Der Würfel 🎲 und die Zahl, wie weit man noch laufen muss
const wuerfelBilder = [];
const AUGEN = { 1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]],
  5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.25, .25], [.75, .25], [.25, .5], [.75, .5], [.25, .75], [.75, .75]] };
for (const zahl of [1, 6, 2, 5, 3, 4]) wuerfelBilder.push(new THREE.MeshLambertMaterial({ map: malen(128, 128, (g, s) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); g.strokeStyle = '#ddd'; g.lineWidth = 8; g.strokeRect(0, 0, s, s);
  g.fillStyle = zahl === 1 ? '#e0398b' : '#222';
  for (const [x, y] of AUGEN[zahl]) { g.beginPath(); g.arc(x * s, y * s, s * 0.1, 0, Math.PI * 2); g.fill(); }
}) }));
const wuerfel = new THREE.Group();
for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), wuerfelBilder); w.castShadow = true; wuerfel.add(w); }   // der 3. ist für den Turbo-Würfel
scene.add(wuerfel);
const zahlBilder = [];
for (let i = 0; i <= 20; i++) zahlBilder.push(textBild(String(i), '#ffcc00', 110));

// Wegweiser-Pfeile an einer Abzweigung
const pfeile = [0, 1].map(() => {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true });
  teil(new THREE.ConeGeometry(0.35, 0.7, 12).rotateX(Math.PI / 2), m, 0, 0, 0.35, g);
  teil(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 8).rotateX(Math.PI / 2), m, 0, 0, -0.25, g);
  g.visible = false;
  scene.add(g);
  return g;
});
// Fallen 🪤 auf dem Brett
const fallenBilder = [];
function baueFalle() {
  const g = new THREE.Group();
  teil(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16), '#555555', 0, 0.04, 0, g);
  const ring = teil(new THREE.TorusGeometry(0.5, 0.06, 6, 20).rotateX(Math.PI / 2), '#ffffff', 0, 0.08, 0, g);
  for (let i = 0; i < 8; i++) { const w = i / 8 * Math.PI * 2; teil(new THREE.ConeGeometry(0.07, 0.22, 4), '#cccccc', Math.cos(w) * 0.42, 0.16, Math.sin(w) * 0.42, g); }
  g.userData.ring = ring;
  brett.add(g); fallenBilder.push(g);
}
const zahlSchild = new THREE.Sprite(new THREE.SpriteMaterial({ map: zahlBilder[0], depthWrite: false }));
zahlSchild.scale.set(4, 1, 1);
scene.add(zahlSchild);

// ========== Die Spielfiguren ==========
function baueFigur(farbe, name) {
  const g = new THREE.Group();
  const koerper = new THREE.Group();
  g.add(koerper);
  teil(new THREE.CapsuleGeometry(0.38, 0.45, 6, 14), glanz(farbe), 0, 0.62, 0, koerper);
  teil(new THREE.SphereGeometry(0.26, 14, 10), '#ffffff', 0, 0.5, 0.2, koerper).scale.set(1, 1.1, 0.6);   // Bauch
  for (const s of [-1, 1]) {
    teil(new THREE.SphereGeometry(0.11, 12, 8), '#ffffff', s * 0.14, 0.95, 0.3, koerper);
    teil(new THREE.SphereGeometry(0.055, 8, 6), '#111111', s * 0.14, 0.96, 0.4, koerper);
    teil(new THREE.SphereGeometry(0.13, 10, 8), '#333333', s * 0.18, 0.08, 0.06, g).scale.set(1, 0.6, 1.4);   // Füße
  }
  const krone = new THREE.Group();
  teil(new THREE.CylinderGeometry(0.22, 0.2, 0.15, 10, 1, true), glanz('#ffcc00'), 0, 0, 0, krone);
  for (let i = 0; i < 5; i++) { const w = i / 5 * Math.PI * 2; teil(new THREE.ConeGeometry(0.06, 0.16, 6), glanz('#ffcc00'), Math.cos(w) * 0.2, 0.14, Math.sin(w) * 0.2, krone); }
  krone.position.y = 1.32;
  koerper.add(krone);
  const schild = textSchild(name, farbe, 0.4);
  schild.position.y = 1.85;
  g.add(schild);
  g.userData = { koerper, krone, schild };
  return g;
}
let figuren = [], figurenSchluessel = '';

// ========== Der Spielstand ==========
// Z ist der ganze Spielstand. Der Chef (lokal oder Host) rechnet alles aus, Gäste bekommen Z übers Netz.
let Z = null;
const eingaben = [{}, {}, {}, {}];     // was jeder Spieler gerade drückt: { x, z, n } (n = wie oft Aktion gedrückt)
const verbraucht = [0, 0, 0, 0];      // so viele Aktions-Drücke wurden schon benutzt
const botE = [0, 1, 2, 3].map(() => ({ x: 0, z: 0, n: 0 }));

function neuerZustand(liste, runden) {
  return {
    phase: 'brett', runde: 1, maxRunden: runden, dran: 0, schritt: 'start', uhr: 2, wurf: 0, wuerfe: [1, 1], rest: 0, hopT: 0, weiter: null,
    pokalFeld: 10 + zufallsZahl(14), meldung: '', meldungUhr: 0, effekte: [], effektNr: 0, spiel: null, ergebnis: null, beutel: [], sieger: null,
    ziel: 1, turbo: false, auswahl: null, fallen: [], teleZiel: -1, pokalNoch: false,
    spieler: liste.map(s => ({ ...s, feld: 0, muenzen: START_MUENZEN, pokale: 0, tasche: [], x: feldPos[0].x, y: FELD_Y, z: feldPos[0].z, r: 0, weg: false })),
  };
}
function meldung(text, sekunden = 2) { Z.meldung = text; Z.meldungUhr = sekunden; }
function effekt(name) { Z.effekte.push([++Z.effektNr, name]); if (Z.effekte.length > 20) Z.effekte.shift(); }
function drueckeAnzahl(i) { const n = (eingaben[i] && eingaben[i].n) || 0, neu = Math.max(0, n - verbraucht[i]); verbraucht[i] = Math.max(verbraucht[i], n); return neu; }
const gedrueckt = i => drueckeAnzahl(i) > 0;
function druckReset() { for (let i = 0; i < 4; i++) verbraucht[i] = (eingaben[i] && eingaben[i].n) || 0; }
function richtung(e) {
  let x = +e.x || 0, z = +e.z || 0;
  const l = Math.hypot(x, z);
  if (l > 1) { x /= l; z /= l; }
  return { x, z };
}
function laufen(sp, e, tempo, dt, grenze) {
  const r = richtung(e);
  sp.x = Math.max(-grenze, Math.min(grenze, sp.x + r.x * tempo * dt));
  sp.z = Math.max(-grenze, Math.min(grenze, sp.z + r.z * tempo * dt));
  if (r.x || r.z) sp.r = Math.atan2(r.x, r.z);
}
function winkel(w) { w %= Math.PI * 2; if (w > Math.PI) w -= Math.PI * 2; if (w < -Math.PI) w += Math.PI * 2; return w; }

// ========== Auf dem Brett ==========
const VERSATZ = [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]];   // damit Figuren auf einem Feld nicht ineinander stehen
function brettPositionen() {
  Z.spieler.forEach((sp, i) => {
    sp.weg = false;
    if (i === Z.dran && Z.schritt === 'laufen') {
      const a = feldPos[sp.feld], b = feldPos[Z.ziel], t = Math.min(1, Z.hopT);
      sp.x = a.x + (b.x - a.x) * t; sp.z = a.z + (b.z - a.z) * t;
      sp.y = FELD_Y + Math.sin(Math.PI * t) * 0.9;
      sp.r = Math.atan2(b.x - a.x, b.z - a.z);
    } else if (i === Z.dran && Z.schritt === 'teleport') {   // hoch in die Luft, rüber, wieder runter
      const f = feldPos[sp.feld];
      sp.x = f.x; sp.z = f.z; sp.y = FELD_Y + (0.6 - Math.abs(Z.uhr - 0.6)) * 9; sp.r = Z.uhr * 25;
    } else {
      const f = feldPos[sp.feld], o = VERSATZ[i];
      sp.x = f.x + o[0]; sp.z = f.z + o[1]; sp.y = FELD_Y; sp.r = 0;
    }
  });
}
const EREIGNISSE = [
  s => { Z.rest = 3; Z.weiter = 'laufen'; return `🚀 Rakete! ${s.name} fliegt 3 Felder weiter!`; },
  () => { for (const x of Z.spieler) x.muenzen += 3; return '🎁 Geschenke für alle! Jeder bekommt 3 Münzen.'; },
  s => {
    const andere = Z.spieler.filter(x => x !== s && x.muenzen > 0);
    if (!andere.length) return '🦝 Der Münzdieb findet nichts zum Klauen …';
    const opfer = andere[zufallsZahl(andere.length)], n = Math.min(4, opfer.muenzen);
    opfer.muenzen -= n; s.muenzen += n;
    return `🦝 Münzdieb! ${s.name} klaut ${n} Münzen von ${opfer.name}!`;
  },
  s => {
    const andere = Z.spieler.filter(x => x !== s);
    const o = andere[zufallsZahl(andere.length)];
    [s.feld, o.feld] = [o.feld, s.feld];
    return `🔄 Platztausch! ${s.name} und ${o.name} tauschen die Felder!`;
  },
  s => { const n = Math.min(5, s.muenzen); s.muenzen -= n; return `🌪️ Wirbelsturm! ${s.name} verliert ${n} Münzen.`; },
  s => { s.muenzen += 8; return `🍀 Glückspilz! ${s.name} findet 8 Münzen.`; },
  () => { pokalUmziehen(); return '🏆 Huch! Der Pokal ist auf ein anderes Feld gesprungen!'; },
];
function pokalUmziehen() {
  const frei = feldPos.map((p, f) => f).filter(f => feldArt[f] !== 'start' && f !== Z.pokalFeld
    && !Z.spieler.some(sp => sp.feld === f) && !Z.fallen.some(x => x.feld === f));
  Z.pokalFeld = frei[zufallsZahl(frei.length)];
}
function pokalPruefen(s) {
  if (s.muenzen >= POKAL_PREIS) {
    s.muenzen -= POKAL_PREIS; s.pokale++;
    meldung(`🏆 ${s.name} kauft einen Pokal! 🎉`, 2.4);
    effekt('pokal');
    pokalUmziehen();
  } else {
    meldung(`🏆 Der Pokal kostet ${POKAL_PREIS} Münzen – ${s.name} hat nur ${s.muenzen}. 😕`, 2.2);
    effekt('minus');
  }
  Z.schritt = 'zwischen'; Z.uhr = 2.4;
}
// Wie viele Hüpfer sind es von einem Feld zu einem anderen? (für die Bots)
function abstand(von, ziel) {
  const weit = new Map([[von, 0]]), liste = [von];
  while (liste.length) {
    const f = liste.shift();
    if (f === ziel) return weit.get(f);
    for (const n of feldNext[f]) if (!weit.has(n)) { weit.set(n, weit.get(f) + 1); liste.push(n); }
  }
  return 99;
}

// ----- Auswahl-Menü (Weg aussuchen, Laden, Gegenstand benutzen) -----
const richtungVorher = [0, 0, 0, 0];
let klickWahl = null;   // wenn jemand eine Auswahl angeklickt / angetippt hat: { i, k }
function richtungVon(e) {
  const x = +(e && e.x) || 0, z = +(e && e.z) || 0;
  return z > 0.5 || x > 0.5 ? 1 : z < -0.5 || x < -0.5 ? -1 : 0;
}
function auswahlStarten(art, titel, optionen, botWahl) {
  Z.auswahl = { art, titel, optionen, wahl: 0, botWahl: Math.max(0, botWahl) };
  Z.schritt = 'auswahl'; Z.uhr = zufall(1.2, 2);
  druckReset();
  richtungVorher[Z.dran] = richtungVon(eingaben[Z.dran]);   // erst loslassen, dann geht's
  klickWahl = null;
}
function auswahlLogik(s) {
  const A = Z.auswahl, n = A.optionen.length;
  let fertig = false;
  if (s.art === 'bot') {
    if (Z.uhr < 0.6) A.wahl = A.botWahl;
    if (Z.uhr <= 0) fertig = true;
  } else {
    const r = richtungVon(eingaben[Z.dran]);
    if (r && r !== richtungVorher[Z.dran]) { A.wahl = (A.wahl + r + n) % n; effekt('klick'); }
    richtungVorher[Z.dran] = r;
    if (klickWahl && klickWahl.i === Z.dran && klickWahl.k >= 0 && klickWahl.k < n) { A.wahl = klickWahl.k; fertig = true; }
    if (gedrueckt(Z.dran)) fertig = true;
  }
  klickWahl = null;
  if (!fertig) return;
  Z.auswahl = null;
  effekt('klick');
  const wert = A.optionen[A.wahl].wert;
  if (A.art === 'weg') { Z.ziel = feldNext[s.feld][wert]; Z.schritt = 'laufen'; Z.hopT = 0; }
  else if (A.art === 'gegenstand') { if (wert === 'nix') wuerfelnStarten(); else gegenstandBenutzen(s, wert); }
  else if (A.art === 'laden') {
    if (wert === 'nix') meldung(`👋 ${s.name} kauft nichts. Tschüss!`, 1.5);
    else {
      const g = GEGENSTAENDE[wert];
      s.muenzen -= g.preis; s.tasche.push(wert);
      meldung(`🛒 ${s.name} kauft: ${g.emoji} ${g.name}!`, 2);
      effekt('kasse');
    }
    Z.schritt = 'feld'; Z.uhr = 1.8;
  }
}

// ----- Hüpfen -----
function hopStarten(s) {   // ein Feld weiterhüpfen – an einer Abzweigung erst fragen, wohin
  const wege = feldNext[s.feld];
  if (wege.length > 1) {
    let bot = zufallsZahl(2);
    if (s.muenzen >= POKAL_PREIS - 3) bot = abstand(wege[1], Z.pokalFeld) < abstand(wege[0], Z.pokalFeld) ? 1 : 0;   // Bot will zum Pokal
    auswahlStarten('weg', '🛤️ Welchen Weg nimmst du?', [
      { text: '🛤️ Normaler Weg', info: 'Länger, aber sicherer' },
      { text: '✂️ Abkürzung', info: 'Kürzer, aber gefährlich!' },
    ].map((o, wert) => ({ ...o, wert })), bot);
    return;
  }
  Z.ziel = wege[0]; Z.schritt = 'laufen'; Z.hopT = 0;
}
function ankommen(s) {   // nach jedem Hüpfer: Falle? Pokal? Fertig?
  const nr = Z.fallen.findIndex(f => f.feld === s.feld && f.von !== Z.dran);
  if (nr >= 0) {
    const besitzer = Z.spieler[Z.fallen[nr].von], n = Math.min(FALLE_MUENZEN, s.muenzen);
    s.muenzen -= n; besitzer.muenzen += n;
    Z.fallen.splice(nr, 1);
    meldung(`🪤 Schnapp! ${s.name} tappt in die Falle von ${besitzer.name} und verliert ${n} Münzen!`, 2.4);
    effekt('schnapp');
    Z.pokalNoch = s.feld === Z.pokalFeld;
    Z.schritt = 'zwischen'; Z.uhr = 2.4;
    return;
  }
  if (s.feld === Z.pokalFeld) pokalPruefen(s);
  else if (Z.rest <= 0) feldAktion(s);
  else hopStarten(s);
}

// ----- Würfeln und Gegenstände -----
function wuerfelnStarten() { Z.schritt = 'wuerfeln'; Z.uhr = zufall(0.8, 1.6); druckReset(); }
function zugStarten(s) {
  Z.turbo = false;
  effekt('dran');
  if (!s.tasche.length) { wuerfelnStarten(); return; }
  const optionen = [{ text: '🎲 Einfach würfeln', wert: 'nix' }];
  for (const k of new Set(s.tasche)) {
    const g = GEGENSTAENDE[k], anzahl = s.tasche.filter(x => x === k).length;
    optionen.push({ text: `${g.emoji} ${g.name} benutzen` + (anzahl > 1 ? ` (${anzahl}×)` : ''), info: g.text, wert: k });
  }
  // Was macht ein Bot?
  const hat = k => s.tasche.includes(k);
  let bot = 'nix';
  if (hat('ruf') && s.muenzen >= POKAL_PREIS) bot = 'ruf';
  else if (hat('turbo') && s.muenzen >= POKAL_PREIS && abstand(s.feld, Z.pokalFeld) > 7) bot = 'turbo';
  else if (hat('falle') && Math.random() < 0.5) bot = 'falle';
  else if (hat('turbo') && Math.random() < 0.25) bot = 'turbo';
  auswahlStarten('gegenstand', `🎒 ${s.name}: Gegenstand benutzen?`, optionen, optionen.findIndex(o => o.wert === bot));
}
function gegenstandBenutzen(s, k) {
  if (k === 'falle' && (Z.fallen.some(f => f.feld === s.feld) || s.feld === Z.pokalFeld || feldArt[s.feld] === 'start')) {
    meldung(`🪤 Hier geht keine Falle hin. ${s.name} behält sie.`, 1.8);
    Z.schritt = 'benutzt'; Z.uhr = 1.8;
    return;
  }
  s.tasche.splice(s.tasche.indexOf(k), 1);
  if (k === 'turbo') { Z.turbo = true; meldung(`🎲 Turbo! ${s.name} würfelt mit 3 Würfeln!`, 1.6); effekt('turbo'); }
  else if (k === 'falle') { Z.fallen.push({ feld: s.feld, von: Z.dran }); meldung(`🪤 ${s.name} versteckt eine Falle! Psst …`, 1.8); effekt('falleHin'); }
  else if (k === 'ruf') {
    // Der Pokal fliegt 3 bis 8 Felder vor den Spieler
    let f = s.feld, n = 3 + zufallsZahl(6);
    for (let i = 0; i < 30 && (n > 0 || f === s.feld || Z.spieler.some(x => x.feld === f) || Z.fallen.some(x => x.feld === f)); i++) {
      const wege = feldNext[f];
      f = wege[zufallsZahl(wege.length)]; n--;
    }
    Z.pokalFeld = f;
    meldung(`📯 ${s.name} ruft den Pokal – und er kommt angeflogen!`, 2);
    effekt('ruf');
  }
  Z.schritt = 'benutzt'; Z.uhr = 1.8;
}

// ----- Was passiert auf einem Feld? -----
function feldAktion(s) {
  const art = feldArt[s.feld];
  Z.schritt = 'feld'; Z.uhr = 1.8;
  if (art === 'blau' || art === 'start') { s.muenzen += BLAU_MUENZEN; meldung(`🔵 ${s.name} bekommt ${BLAU_MUENZEN} Münzen!`, 1.8); effekt('muenze'); }
  else if (art === 'rot') { const n = Math.min(ROT_MUENZEN, s.muenzen); s.muenzen -= n; meldung(`🔴 Oh nein! ${s.name} verliert ${n} Münzen.`, 1.8); effekt('minus'); }
  else if (art === 'ereignis') { meldung(EREIGNISSE[zufallsZahl(EREIGNISSE.length)](s), 2.8); effekt('ereignis'); Z.uhr = 2.8; }
  else if (art === 'klau') {
    const andere = Z.spieler.filter(x => x !== s && x.muenzen > 0).sort((a, b) => b.muenzen - a.muenzen);
    if (!andere.length) meldung('👻 Buuuh! Der Geist findet keine Münzen …', 2.4);
    else {
      const opfer = andere[0], n = Math.min(KLAU_MUENZEN, opfer.muenzen);
      opfer.muenzen -= n; s.muenzen += n;
      meldung(`👻 Buuuh! Der Geist klaut ${n} Münzen von ${opfer.name} für ${s.name}!`, 2.6);
    }
    effekt('geist'); Z.uhr = 2.6;
  } else if (art === 'teleport') {
    let f;
    do f = zufallsZahl(feldPos.length); while (f === s.feld);
    Z.teleZiel = f; Z.schritt = 'teleport'; Z.uhr = 1.2;
    meldung(`🌀 Teleporter! ${s.name} wird weggebeamt!`, 2);
    effekt('teleport');
  } else if (art === 'laden') {
    const leisten = Object.entries(GEGENSTAENDE).filter(([, g]) => g.preis <= s.muenzen);
    if (s.tasche.length >= TASCHE_PLATZ) meldung(`🛒 Laden! Aber die Tasche von ${s.name} ist schon voll. 🎒`, 2.2);
    else if (!leisten.length) meldung(`🛒 Laden! Aber ${s.name} hat zu wenig Münzen. 😕`, 2.2);
    else {
      const optionen = leisten.map(([k, g]) => ({ text: `${g.emoji} ${g.name} – ${g.preis} 🪙`, info: g.text, wert: k }));
      optionen.push({ text: '👋 Nichts kaufen', wert: 'nix' });
      let bot = 'nix';
      if (s.muenzen >= GEGENSTAENDE.ruf.preis + POKAL_PREIS && leisten.some(([k]) => k === 'ruf')) bot = 'ruf';
      else if (Math.random() < 0.7) { const g = leisten.filter(([, g]) => s.muenzen - g.preis >= 3); if (g.length) bot = g[zufallsZahl(g.length)][0]; }
      auswahlStarten('laden', `🛒 Willkommen im Laden, ${s.name}!`, optionen, optionen.findIndex(o => o.wert === bot));
      effekt('kasse');
    }
    Z.uhr = Z.schritt === 'auswahl' ? Z.uhr : 2.2;
  }
}
function brettLogik(dt) {
  const s = Z.spieler[Z.dran];
  Z.uhr -= dt;
  if (Z.schritt === 'start') {
    if (Z.uhr <= 0) zugStarten(s);
  } else if (Z.schritt === 'auswahl') {
    auswahlLogik(s);
  } else if (Z.schritt === 'benutzt') {
    if (Z.uhr <= 0) wuerfelnStarten();
  } else if (Z.schritt === 'wuerfeln') {
    if (s.art === 'bot' ? Z.uhr <= 0 : gedrueckt(Z.dran)) {
      Z.wuerfe = [];
      for (let i = 0; i < (Z.turbo ? 3 : 2); i++) Z.wuerfe.push(1 + zufallsZahl(6));
      Z.wurf = Z.wuerfe.reduce((a, b) => a + b, 0); Z.rest = Z.wurf;
      Z.schritt = 'zeigen'; Z.uhr = 1;
      meldung(`🎲 ${Z.wuerfe.join(' + ')} = ${Z.wurf}!`, 1.2);
      effekt('wuerfel');
    }
  } else if (Z.schritt === 'zeigen') {
    if (Z.uhr <= 0) hopStarten(s);
  } else if (Z.schritt === 'laufen') {
    Z.hopT += dt / HUEPF_ZEIT;
    if (Z.hopT >= 1) {
      s.feld = Z.ziel; Z.rest--; Z.hopT = 0;
      effekt('hopp');
      ankommen(s);
    }
  } else if (Z.schritt === 'zwischen') {   // kurze Pause (Pokal, Falle), dann geht's weiter
    if (Z.uhr <= 0) {
      if (Z.pokalNoch) { Z.pokalNoch = false; pokalPruefen(s); }
      else if (Z.rest > 0) hopStarten(s);
      else feldAktion(s);
    }
  } else if (Z.schritt === 'teleport') {
    if (Z.uhr <= 0.6 && Z.teleZiel >= 0) { s.feld = Z.teleZiel; Z.teleZiel = -1; }
    if (Z.uhr <= 0) naechsterSpieler();
  } else if (Z.schritt === 'feld') {
    if (Z.uhr <= 0) {
      if (Z.weiter === 'laufen') { Z.weiter = null; hopStarten(s); }
      else naechsterSpieler();
    }
  }
  if (Z.phase === 'brett') brettPositionen();   // (nicht mehr, wenn gerade ein Minispiel angefangen hat)
}
function naechsterSpieler() {
  Z.dran++;
  if (Z.dran >= Z.spieler.length) { minispielStarten(); return; }
  Z.schritt = 'start'; Z.uhr = 1.2;
  meldung(`🎲 ${Z.spieler[Z.dran].name} ist dran!`, 1.2);
}

// ========== Minispiele ==========
function minispielStarten() {
  if (!Z.beutel.length) {   // alle Minispiele gemischt in einen Beutel – aber nicht zweimal dasselbe hintereinander
    Z.beutel = Object.keys(MINISPIELE).sort(() => Math.random() - 0.5);
    if (Z.beutel.length > 1 && Z.beutel[Z.beutel.length - 1] === Z.letztesSpiel) Z.beutel.unshift(Z.beutel.pop());
  }
  const typ = Z.beutel.pop();
  Z.letztesSpiel = typ;
  Z.spiel = { typ, zeit: 0 };
  for (const e of botE) { for (const k in e) if (k !== 'n') delete e[k]; e.x = 0; e.z = 0; }
  MINISPIELE[typ].start(Z.spiel);
  Z.phase = 'info'; Z.uhr = 6; Z.meldung = '';
  effekt('minispiel');
}
function spielEnde() {
  const werte = MINISPIELE[Z.spiel.typ].rangliste(Z.spiel);   // höherer Wert = besser
  Z.ergebnis = werte.map((w, i) => {
    const platz = 1 + werte.filter(v => v > w).length, plus = MINISPIEL_PREIS[platz - 1];
    Z.spieler[i].muenzen += plus;
    return { platz, plus };
  });
  Z.phase = 'ergebnis'; Z.uhr = 5;
  effekt('sieg');
}
function nachErgebnis() {
  if (Z.runde >= Z.maxRunden) { endeStarten(); return; }
  Z.runde++;
  Z.phase = 'brett'; Z.dran = 0; Z.schritt = 'start'; Z.uhr = 2.2; Z.spiel = null;
  meldung(Z.runde === Z.maxRunden ? '🔥 Letzte Runde! 🔥' : `Runde ${Z.runde}! ${Z.spieler[0].name} fängt an.`, 2.2);
  brettPositionen();
}
function endeStarten() {
  const reihe = Z.spieler.map((s, i) => i).sort((a, b) => Z.spieler[b].pokale - Z.spieler[a].pokale || Z.spieler[b].muenzen - Z.spieler[a].muenzen);
  Z.sieger = reihe;
  const PODEST = [[0, 1.6], [-2.2, 1.1], [2.2, 0.7], [-4.4, 0]];
  reihe.forEach((i, platz) => Object.assign(Z.spieler[i], { x: PODEST[platz][0], y: PODEST[platz][1], z: 0, r: 0, weg: false }));
  Z.phase = 'ende'; Z.meldung = '';
  effekt('sieg');
}

const MINISPIELE = {
  // ---------- 🪙 Münzregen ----------
  muenzregen: {
    name: 'Münzregen', emoji: '🪙', dauer: 25,
    text: 'Münzen fallen vom Himmel! Sammle so viele du kannst. Goldene Münzen zählen 3. Achtung vor den Bomben 💣 – die machen dich schwindelig!',
    steuerung: 'Laufen 🏃',
    kamera: [[0, 15, 12.5], [0, 0, 0.8]],
    start(s) {
      s.o = []; s.spawn = 0; s.knall = null;
      s.p = Z.spieler.map((sp, i) => {
        const [x, z] = [[-4, -4], [4, -4], [-4, 4], [4, 4]][i];
        Object.assign(sp, { x, y: 0, z, r: 0, weg: false });
        return { punkte: 0, schwindel: 0 };
      });
    },
    update(s, dt) {
      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = 0.28;
        const w = Math.random();
        s.o.push({ x: zufall(-7.3, 7.3), y: 11, z: zufall(-7.3, 7.3), a: w < 0.13 ? 2 : w < 0.22 ? 1 : 0 });   // a: 0 Münze, 1 Gold, 2 Bombe
      }
      Z.spieler.forEach((sp, i) => {
        const p = s.p[i];
        p.schwindel = Math.max(0, p.schwindel - dt);
        if (p.schwindel > 0) sp.r += dt * 12; else laufen(sp, eingaben[i], 6.5, dt, 7.8);
      });
      for (const o of s.o) {
        o.y -= dt * (o.a === 2 ? 5.5 : 4.5);
        if (o.y < 1.6 && o.a !== 2) {
          for (let i = 0; i < Z.spieler.length; i++) {
            const sp = Z.spieler[i];
            if (s.p[i].schwindel <= 0 && Math.hypot(sp.x - o.x, sp.z - o.z) < 0.95) { s.p[i].punkte += o.a === 1 ? 3 : 1; o.weg = true; effekt(o.a === 1 ? 'gold' : 'muenze'); break; }
          }
        }
        if (o.y <= 0 && !o.weg) {
          o.weg = true;
          if (o.a === 2) {
            effekt('boom'); s.knall = [o.x, o.z, s.zeit];
            Z.spieler.forEach((sp, i) => { if (Math.hypot(sp.x - o.x, sp.z - o.z) < 1.8) s.p[i].schwindel = 1.6; });
          }
        }
      }
      s.o = s.o.filter(o => !o.weg);
      return false;
    },
    rangliste: s => s.p.map(p => p.punkte),
    anzeige: (s, i) => '🪙 ' + s.p[i].punkte + (s.p[i].schwindel > 0 ? ' 😵' : ''),
    bot(s, i, e, dt) {
      const sp = Z.spieler[i];
      e.uhr = (e.uhr || 0) - dt;
      if (e.uhr <= 0) {
        e.uhr = zufall(0.3, 0.55);
        const bombe = s.o.find(o => o.a === 2 && o.y < 4 && Math.hypot(o.x - sp.x, o.z - sp.z) < 2.3);
        if (bombe) { e.tx = sp.x + (sp.x - bombe.x) * 2; e.tz = sp.z + (sp.z - bombe.z) * 2; }
        else {
          // eine Münze suchen, die man noch erreichen kann
          const gute = s.o.filter(o => o.a !== 2 && Math.hypot(o.x - sp.x, o.z - sp.z) / 6.5 < o.y / 4.5 + 0.2)
            .sort((a, b) => Math.hypot(a.x - sp.x, a.z - sp.z) - Math.hypot(b.x - sp.x, b.z - sp.z));
          const ziel = gute[Math.random() < 0.7 ? 0 : 1] || gute[0];
          if (ziel) { e.tx = ziel.x; e.tz = ziel.z; } else { e.tx = zufall(-3, 3); e.tz = zufall(-3, 3); }
        }
      }
      const dx = (e.tx ?? sp.x) - sp.x, dz = (e.tz ?? sp.z) - sp.z, d = Math.hypot(dx, dz);
      e.x = d > 0.25 ? dx / d : 0; e.z = d > 0.25 ? dz / d : 0;
    },
    bauen(g) {
      const boden = malen(256, 256, (c, s) => {
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#ffe38a' : '#ffd24d'; c.fillRect(i * s / 8, j * s / 8, s / 8, s / 8); }
      });
      teil(new THREE.BoxGeometry(17, 1, 17), new THREE.MeshLambertMaterial({ map: boden }), 0, -0.5, 0, g);
      for (const [x, z, b, t] of [[0, -8.7, 17.8, 0.4], [0, 8.7, 17.8, 0.4], [-8.7, 0, 0.4, 17], [8.7, 0, 0.4, 17]]) teil(new THREE.BoxGeometry(b, 0.5, t), '#e0398b', x, 0.25, z, g);
      const bild = { teile: [], schatten: [], knall: teil(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: '#ff9a1f', transparent: true, opacity: 0.7 }), 0, 0, 0, g) };
      bild.knall.visible = false;
      const muenzGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 20).rotateX(Math.PI / 2);
      bild.neu = () => {
        const m = new THREE.Group();
        teil(muenzGeo, glanz('#ffcc00'), 0, 0, 0, m);
        teil(muenzGeo, glanz('#ffe680'), 0, 0, 0, m).scale.setScalar(1.6);
        const b = new THREE.Group();
        teil(new THREE.SphereGeometry(0.4, 14, 10), '#222222', 0, 0, 0, b);
        teil(new THREE.CylinderGeometry(0.04, 0.04, 0.3), '#c9a26b', 0, 0.45, 0, b);
        m.add(b);
        g.add(m);
        const sch = teil(new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25 }), 0, 0.02, 0, g);
        sch.castShadow = false;
        bild.teile.push(m); bild.schatten.push(sch);
      };
      return bild;
    },
    zeichnen(s, bild, dt) {
      while (bild.teile.length < s.o.length) bild.neu();
      bild.teile.forEach((m, i) => {
        const o = s.o[i], sch = bild.schatten[i];
        m.visible = sch.visible = !!o;
        if (!o) return;
        m.position.set(o.x, o.y, o.z);
        m.rotation.y += dt * 4;
        m.children.forEach((c, j) => { c.visible = j === o.a; });
        sch.position.set(o.x, 0.02, o.z);
        sch.scale.setScalar(0.4 + (1 - o.y / 11) * (o.a === 2 ? 3 : 0.8));
        sch.material.color.set(o.a === 2 ? '#ff0000' : '#000000');
      });
      const k = s.knall, alter = k ? s.zeit - k[2] : 9;
      bild.knall.visible = alter < 0.4;
      if (k && alter < 0.4) { bild.knall.position.set(k[0], 0.3, k[1]); bild.knall.scale.setScalar(0.5 + alter * 5); }
    },
  },

  // ---------- 🏝️ Schubs-Insel ----------
  schubsen: {
    name: 'Schubs-Insel', emoji: '🏝️', dauer: 45,
    text: 'Schubs die anderen ins Wasser! Mit der Aktionstaste machst du einen Rempler. Die Insel wird immer kleiner. Wer zuletzt übrig ist, gewinnt!',
    steuerung: 'Laufen 🏃 + Aktion = Rempler 💥',
    kamera: [[0, 15, 12], [0, 0, 0.5]],
    start(s) {
      s.r = 7; s.raus = 0;
      s.p = Z.spieler.map((sp, i) => {
        const w = i * Math.PI / 2 + Math.PI / 4;
        Object.assign(sp, { x: Math.cos(w) * 4, y: 0, z: Math.sin(w) * 4, weg: false });
        sp.r = Math.atan2(-sp.x, -sp.z);
        return { vx: 0, vz: 0, vy: 0, rempel: 0, pause: 0, raus: false, platz: 0 };
      });
    },
    update(s, dt) {
      s.r = 7 - 3 * Math.min(1, Math.max(0, (s.zeit - 12) / 20));
      Z.spieler.forEach((sp, i) => {
        const p = s.p[i], druck = gedrueckt(i);
        if (p.raus) {   // fällt ins Wasser
          p.vy -= 20 * dt; sp.y += p.vy * dt; sp.x += p.vx * dt; sp.z += p.vz * dt;
          if (sp.y < -4) sp.weg = true;
          return;
        }
        const r = richtung(eingaben[i]);
        p.vx += r.x * 22 * dt; p.vz += r.z * 22 * dt;
        if (r.x || r.z) sp.r = Math.atan2(r.x, r.z);
        p.pause -= dt; p.rempel -= dt;
        if (druck && p.pause <= 0) {
          const dx = Math.sin(sp.r), dz = Math.cos(sp.r);
          p.vx = dx * 14; p.vz = dz * 14; p.rempel = 0.3; p.pause = 1.1;
          effekt('wusch');
        }
        const reibung = Math.exp(-(p.rempel > 0 ? 1 : 3.2) * dt);
        p.vx *= reibung; p.vz *= reibung;
        const v = Math.hypot(p.vx, p.vz);
        if (p.rempel <= 0 && v > 6.5) { p.vx *= 6.5 / v; p.vz *= 6.5 / v; }
        sp.x += p.vx * dt; sp.z += p.vz * dt;
      });
      // Zusammenstöße
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        const A = Z.spieler[a], B = Z.spieler[b], pa = s.p[a], pb = s.p[b];
        if (pa.raus || pb.raus) continue;
        let dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
        if (d >= 1 || d < 0.001) continue;
        dx /= d; dz /= d;
        const ueber = (1 - d) / 2;
        A.x -= dx * ueber; A.z -= dz * ueber; B.x += dx * ueber; B.z += dz * ueber;
        const va = pa.vx * dx + pa.vz * dz, vb = pb.vx * dx + pb.vz * dz;
        if (va - vb > 0) {
          const ma = pa.rempel > 0 ? 3 : 1, mb = pb.rempel > 0 ? 3 : 1;
          const j = 1.7 * (va - vb) / (1 / ma + 1 / mb);
          pa.vx -= j / ma * dx; pa.vz -= j / ma * dz; pb.vx += j / mb * dx; pb.vz += j / mb * dz;
          effekt('bums');
        }
      }
      // Runtergefallen?
      Z.spieler.forEach((sp, i) => {
        const p = s.p[i];
        if (!p.raus && Math.hypot(sp.x, sp.z) > s.r + 0.15) { p.raus = true; p.vy = 3; p.platz = ++s.raus; effekt('platsch'); }
      });
      return s.p.filter(p => !p.raus).length <= 1;
    },
    rangliste: s => s.p.map(p => p.raus ? p.platz : 99),
    anzeige: (s, i) => s.p[i].raus ? '💦 im Wasser' : '💪 noch dabei',
    bot(s, i, e, dt) {
      const sp = Z.spieler[i], p = s.p[i];
      if (p.raus) return;
      const mitte = Math.hypot(sp.x, sp.z);
      if (mitte > s.r - 1.7) { e.x = -sp.x / mitte; e.z = -sp.z / mitte; return; }   // zu nah am Rand
      let ziel = null, weite = 99;
      Z.spieler.forEach((o, j) => { if (j !== i && !s.p[j].raus) { const d = Math.hypot(o.x - sp.x, o.z - sp.z); if (d < weite) { weite = d; ziel = o; } } });
      if (!ziel) { e.x = e.z = 0; return; }
      e.wackel = (e.wackel || 0) + dt * zufall(1, 3);
      const dx = ziel.x - sp.x, dz = ziel.z - sp.z;
      e.x = dx / weite + Math.sin(e.wackel) * 0.4; e.z = dz / weite + Math.cos(e.wackel) * 0.4;
      if (weite < 2.3 && p.pause <= 0 && Math.random() < dt * 3) e.n++;
    },
    bauen(g) {
      const bild = {};
      bild.insel = new THREE.Group();
      teil(new THREE.CylinderGeometry(1, 0.85, 1.4, 48), '#f1dca0', 0, -0.7, 0, bild.insel);
      teil(new THREE.CylinderGeometry(0.96, 0.96, 0.05, 48), '#7bd15a', 0, 0.005, 0, bild.insel);
      g.add(bild.insel);
      return bild;
    },
    zeichnen(s, bild) { bild.insel.scale.set(s.r, 1, s.r); },
  },

  // ---------- ⚡ Turbo-Tippen ----------
  tippen: {
    name: 'Turbo-Tippen', emoji: '⚡', dauer: 25,
    text: 'Drück so schnell du kannst immer wieder auf deine Aktionstaste! Jeder Druck bringt dich ein Stück weiter. Wer zuerst im Ziel ist, gewinnt!',
    steuerung: 'Aktionstaste gaaanz schnell drücken! ⚡',
    kamera: [[0, 12, 17], [0, 0, -1]],
    start(s) {
      s.fertig = 0;
      s.p = Z.spieler.map((sp, i) => {
        Object.assign(sp, { x: -3 + 2 * i, y: 0, z: 10, r: Math.PI, weg: false });
        return { weg: 0, platz: 0 };
      });
    },
    update(s) {
      Z.spieler.forEach((sp, i) => {
        const p = s.p[i], n = drueckeAnzahl(i);
        if (p.platz) return;
        if (n) { p.weg = Math.min(20, p.weg + n * 0.45); effekt('tipp'); }
        sp.z = 10 - p.weg;
        sp.y = Math.abs(Math.sin(p.weg * 3)) * 0.3;
        if (p.weg >= 20) { p.platz = ++s.fertig; sp.y = 0; effekt('ziel'); }
      });
      return s.fertig >= 4;
    },
    rangliste: s => s.p.map(p => p.platz ? 100 - p.platz : p.weg),
    anzeige: (s, i) => s.p[i].platz ? '🏁 Platz ' + s.p[i].platz : '⚡ ' + Math.round(s.p[i].weg / 20 * 100) + ' %',
    bot(s, i, e, dt) {
      e.tempo ||= zufall(5.2, 7.2);   // so oft drückt der Bot pro Sekunde
      e.t = (e.t || 0) + dt * e.tempo * zufall(0.7, 1.3);
      while (e.t >= 1) { e.t--; e.n++; }
    },
    bauen(g) {
      teil(new THREE.BoxGeometry(12, 1, 28), '#6cc24a', 0, -0.5, -1, g);
      Z.spieler.forEach((sp, i) => teil(new THREE.BoxGeometry(1.6, 0.04, 22), mat(sp.farbe), -3 + 2 * i, 0.02, -0.5, g).material.color.multiplyScalar(0.85));
      const ziel = malen(128, 32, (c, b, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#111'; c.fillRect(i * b / 16, j * h / 4, b / 16, h / 4); } });
      teil(new THREE.BoxGeometry(8, 0.06, 1), new THREE.MeshLambertMaterial({ map: ziel }), 0, 0.05, -10.3, g);
      teil(new THREE.BoxGeometry(8, 0.06, 0.3), '#ffffff', 0, 0.05, 10.6, g);
      for (const s of [-1, 1]) teil(new THREE.CylinderGeometry(0.15, 0.15, 4), '#ffffff', s * 4.5, 2, -10.3, g);
      const band = textSchild('🏁 ZIEL 🏁', '#ffcc00', 1.2);
      band.position.set(0, 4, -10.3);
      g.add(band);
      return {};
    },
    zeichnen() {},
  },

  // ---------- 🌀 Spring-Balken ----------
  drehbalken: {
    name: 'Spring-Balken', emoji: '🌀', dauer: 50,
    text: 'Ein langer Balken dreht sich im Kreis. Spring mit der Aktionstaste drüber! Wer getroffen wird, fliegt raus. Der Balken wird immer schneller!',
    steuerung: 'Aktionstaste = springen 🦘',
    kamera: [[0, 11, 10], [0, 0, 0]],
    start(s) {
      s.w = Math.random() * Math.PI * 2; s.ws = 1.7; s.raus = 0;
      s.p = Z.spieler.map((sp, i) => {
        const a = i * Math.PI / 2 + Math.PI / 4;
        Object.assign(sp, { x: Math.cos(a) * 4, y: 0, z: -Math.sin(a) * 4, weg: false });
        sp.r = Math.atan2(-sp.x, -sp.z);
        return { a, vy: 0, vx: 0, vz: 0, raus: false, platz: 0 };
      });
    },
    update(s, dt) {
      s.ws = 1.7 + s.zeit * 0.055;
      s.w = (s.w + s.ws * dt) % (Math.PI * 2);
      Z.spieler.forEach((sp, i) => {
        const p = s.p[i], druck = gedrueckt(i);
        if (p.raus) {   // fliegt durch die Luft
          p.vy -= 20 * dt; sp.x += p.vx * dt; sp.z += p.vz * dt; sp.y += p.vy * dt; sp.r += dt * 12;
          if (sp.y < -6) sp.weg = true;
          return;
        }
        if (druck && sp.y <= 0) { p.vy = 7.5; effekt('sprung'); }
        p.vy -= 22 * dt;
        sp.y += p.vy * dt;
        if (sp.y <= 0) { sp.y = 0; p.vy = 0; }
        if (Math.abs(winkel(p.a - s.w)) < 0.17 && sp.y < 0.5) {   // vom Balken erwischt!
          p.raus = true; p.platz = ++s.raus;
          p.vx = -Math.sin(p.a) * 8 + Math.cos(p.a) * 4; p.vz = -Math.cos(p.a) * 8 - Math.sin(p.a) * 4; p.vy = 7;
          effekt('autsch');
        }
      });
      return s.raus >= 3;
    },
    rangliste: s => s.p.map(p => p.raus ? p.platz : 99),
    anzeige: (s, i) => s.p[i].raus ? '💥 raus' : '🦘 noch dabei',
    bot(s, i, e) {
      const p = s.p[i];
      if (p.raus) return;
      const rest = ((p.a - s.w) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);   // so weit ist der Balken noch weg
      const zeit = rest / s.ws;
      if (zeit > 1.3) e.plan = null;
      else if (!e.plan) e.plan = Math.random() < 0.035 + s.zeit * 0.003 ? zufall(0.65, 0.9) : zufall(0.2, 0.42);   // manchmal patzt der Bot
      if (e.plan && zeit < e.plan) { e.n++; e.plan = -1; }
    },
    bauen(g) {
      teil(new THREE.CylinderGeometry(5.5, 5.2, 1, 48), '#a259ff', 0, -0.5, 0, g);
      teil(new THREE.CylinderGeometry(5.3, 5.3, 0.04, 48), '#c9a2ff', 0, 0.01, 0, g);
      teil(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 16), '#333333', 0, 0.6, 0, g);
      const balken = new THREE.Group();
      const streifen = malen(256, 32, (c, b, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff' : '#ff4d4d'; c.fillRect(i * b / 8, 0, b / 8, h); } });
      teil(new THREE.BoxGeometry(6.2, 0.3, 0.3), new THREE.MeshLambertMaterial({ map: streifen }), 3.1, 0.45, 0, balken);
      teil(new THREE.SphereGeometry(0.3, 12, 8), '#ffcc00', 6.2, 0.45, 0, balken);
      g.add(balken);
      return { balken };
    },
    zeichnen(s, bild) { bild.balken.rotation.y = s.w; },
  },

  // ---------- 🔥 Heißer Boden ----------
  boden: {
    name: 'Heißer Boden', emoji: '🔥', dauer: 45,
    text: 'Die Platten fangen an zu wackeln und fallen dann in die Lava! Lauf schnell auf eine feste Platte. Wer runterfällt, ist raus. Wer am längsten oben bleibt, gewinnt!',
    steuerung: 'Laufen 🏃',
    kamera: [[0, 14, 10.5], [0, 0, 0.6]],
    start(s) {
      s.k = new Array(BODEN_N * BODEN_N).fill(0);   // jede Platte: 0 = fest, mehr als 0 = wackelt (noch so lange), −1 = weg
      s.takt = 1.5; s.uhr = 2; s.raus = 0;
      s.p = Z.spieler.map((sp, i) => {
        const [x, z] = [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]][i];
        Object.assign(sp, { x, y: 0, z, r: 0, weg: false });
        return { raus: false, platz: 0, vy: 0 };
      });
    },
    update(s, dt) {
      s.uhr -= dt;
      if (s.uhr <= 0) {   // neue Platten fangen an zu wackeln – immer schneller
        s.takt = Math.max(0.35, s.takt * 0.93); s.uhr = s.takt;
        const feste = [];
        s.k.forEach((k, i) => { if (k === 0) feste.push(i); });
        const unterSpielern = feste.filter(i => Z.spieler.some((sp, j) => !s.p[j].raus && bodenPlatte(sp) === i));
        const liste = unterSpielern.length && Math.random() < 0.35 ? unterSpielern : feste;
        for (let n = 0; n < (s.zeit > 15 ? 2 : 1) && liste.length; n++) s.k[liste.splice(zufallsZahl(liste.length), 1)[0]] = 1.3;
        effekt('knirsch');
      }
      s.k.forEach((k, i) => { if (k > 0) s.k[i] = k - dt > 0 ? k - dt : -1; });
      Z.spieler.forEach((sp, i) => {
        const p = s.p[i];
        if (p.raus) { p.vy -= 20 * dt; sp.y += p.vy * dt; if (sp.y < -8) sp.weg = true; return; }
        laufen(sp, eingaben[i], 5.5, dt, BODEN_N * BODEN_P / 2 - 0.2);
      });
      auseinander(s.p, 0.9);
      Z.spieler.forEach((sp, i) => {
        const p = s.p[i];
        if (!p.raus && s.k[bodenPlatte(sp)] === -1) { p.raus = true; p.platz = ++s.raus; effekt('fall'); }
      });
      return s.raus >= 3;
    },
    rangliste: s => s.p.map(p => p.raus ? p.platz : 99),
    anzeige: (s, i) => s.p[i].raus ? '🔥 runtergefallen' : '🦶 noch oben',
    bot(s, i, e, dt) {
      const sp = Z.spieler[i];
      if (s.p[i].raus) return;
      if (s.k[e.ziel] !== 0 && e.warte === undefined) e.warte = zufall(0.05, 0.7);   // Bots merken es nicht sofort
      if (e.warte !== undefined) { e.warte -= dt; if (e.warte <= 0) { e.warte = undefined; e.uhr = 0; } }
      e.uhr = (e.uhr ?? 0) - dt;
      if (e.uhr <= 0 && e.warte === undefined) {
        e.uhr = zufall(0.5, 1);
        let wert = -99;
        s.k.forEach((k, j) => {
          if (k !== 0) return;
          const m = plattenMitte(j), d = Math.hypot(m.x - sp.x, m.z - sp.z);
          const x = j % BODEN_N, z = Math.floor(j / BODEN_N);
          let nachbarn = 0;
          for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (x + a >= 0 && x + a < BODEN_N && z + b >= 0 && z + b < BODEN_N && s.k[(z + b) * BODEN_N + x + a] === 0) nachbarn++;
          const w = nachbarn * 0.8 - d * 0.6 + Math.random() * 1.2;
          if (w > wert) { wert = w; e.ziel = j; }
        });
      }
      if (e.ziel === undefined) { e.x = e.z = 0; return; }
      const m = plattenMitte(e.ziel), dx = m.x - sp.x, dz = m.z - sp.z, d = Math.hypot(dx, dz);
      e.x = d > 0.15 ? dx / d : 0; e.z = d > 0.15 ? dz / d : 0;
    },
    bauen(g) {
      const lava = teil(new THREE.CircleGeometry(16, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5a1f' }), 0, -0.4, 0, g);
      lava.castShadow = false;
      const bild = { platten: [], fall: [], lava };
      for (let i = 0; i < BODEN_N * BODEN_N; i++) {
        const m = plattenMitte(i), farbe = (i + Math.floor(i / BODEN_N)) % 2 ? '#ffd24d' : '#ffe38a';
        const p = teil(new THREE.BoxGeometry(BODEN_P - 0.12, 0.5, BODEN_P - 0.12), farbe, m.x, -0.25, m.z, g);
        p.userData.farbe = new THREE.Color(farbe);
        bild.platten.push(p); bild.fall.push(0);
      }
      return bild;
    },
    zeichnen(s, bild, dt) {
      bild.lava.material.color.setHSL(0.04 + Math.sin(uhrzeit * 3) * 0.015, 1, 0.55);
      bild.platten.forEach((p, i) => {
        const k = s.k[i], m = plattenMitte(i);
        if (k === -1) { bild.fall[i] += dt; p.position.y = -0.25 - bild.fall[i] ** 2 * 6; p.visible = p.position.y > -6; return; }
        bild.fall[i] = 0; p.visible = true; p.position.y = -0.25;
        const wackel = k > 0 ? Math.sin(uhrzeit * 45) * 0.07 * (1.5 - k) : 0;
        p.position.x = m.x + wackel; p.position.z = m.z;
        p.material.color.copy(p.userData.farbe);
        if (k > 0) p.material.color.lerp(tmpFarbe.set('#ff2a00'), Math.min(1, 1.3 - k + 0.3));
      });
    },
  },

  // ---------- 💣 Bomben-Pass ----------
  bombe: {
    name: 'Bomben-Pass', emoji: '💣', dauer: 75,
    text: 'Eine Bombe tickt! Wer sie hat, muss schnell jemand anderen berühren, um sie loszuwerden. Wer die Bombe beim Knall hat, fliegt raus!',
    steuerung: 'Laufen 🏃 (mit der Bombe bist du ein bisschen schneller!)',
    kamera: [[0, 14, 10.5], [0, 0, 0.6]],
    start(s) {
      s.raus = 0; s.halter = -1; s.pause = 1.5; s.zuender = 0; s.sperre = 0; s.knall = null; s.tick = 0;
      s.p = Z.spieler.map((sp, i) => {
        const w = i * Math.PI / 2 + Math.PI / 4;
        Object.assign(sp, { x: Math.cos(w) * 4, y: 0, z: Math.sin(w) * 4, weg: false });
        sp.r = Math.atan2(-sp.x, -sp.z);
        return { raus: false, platz: 0, vx: 0, vy: 0, vz: 0 };
      });
    },
    update(s, dt) {
      if (s.halter < 0) {   // kurze Pause, dann bekommt jemand die Bombe
        s.pause -= dt;
        if (s.pause <= 0) {
          const drin = s.p.map((p, i) => i).filter(i => !s.p[i].raus);
          s.halter = drin[zufallsZahl(drin.length)]; s.zuender = zufall(7, 12); s.sperre = 1;
          effekt('zisch');
        }
      } else {
        s.zuender -= dt; s.sperre -= dt; s.tick -= dt;
        if (s.tick <= 0) { s.tick = Math.max(0.12, Math.min(0.6, s.zuender / 8)); effekt('tick'); }
        if (s.zuender <= 0) {   // BUMM!
          const sp = Z.spieler[s.halter], p = s.p[s.halter], d = Math.hypot(sp.x, sp.z) || 1;
          p.raus = true; p.platz = ++s.raus; p.vy = 10; p.vx = sp.x / d * 5; p.vz = sp.z / d * 5;
          s.knall = [sp.x, sp.z, s.zeit];
          s.halter = -1; s.pause = 2;
          effekt('boom');
        }
      }
      Z.spieler.forEach((sp, i) => {
        const p = s.p[i];
        if (p.raus) { p.vy -= 20 * dt; sp.x += p.vx * dt; sp.z += p.vz * dt; sp.y += p.vy * dt; sp.r += dt * 12; if (sp.y < -6) sp.weg = true; return; }
        laufen(sp, eingaben[i], i === s.halter ? 6.3 : 5.6, dt, 99);
        const d = Math.hypot(sp.x, sp.z);
        if (d > BOMBE_RAND) { sp.x *= BOMBE_RAND / d; sp.z *= BOMBE_RAND / d; }
      });
      auseinander(s.p, 0.9);
      // Bombe weitergeben, wenn man jemanden berührt
      if (s.halter >= 0 && s.sperre <= 0) {
        const h = Z.spieler[s.halter];
        for (let j = 0; j < 4; j++) {
          if (j === s.halter || s.p[j].raus) continue;
          if (Math.hypot(Z.spieler[j].x - h.x, Z.spieler[j].z - h.z) < 1.05) { s.halter = j; s.sperre = 0.7; effekt('pass'); break; }
        }
      }
      return s.raus >= 3;
    },
    rangliste: s => s.p.map(p => p.raus ? p.platz : 99),
    anzeige: (s, i) => s.p[i].raus ? '💥 raus' : s.halter === i ? '💣 HAT DIE BOMBE!' : '🏃 noch dabei',
    bot(s, i, e, dt) {
      const sp = Z.spieler[i];
      if (s.p[i].raus) return;
      e.wackel = (e.wackel ?? zufall(0, 6)) + dt * 1.5;
      let dx = 0, dz = 0;
      if (s.halter === i) {   // ich hab die Bombe: den Nächsten jagen!
        let weite = 99;
        Z.spieler.forEach((o, j) => {
          if (j === i || s.p[j].raus) return;
          const d = Math.hypot(o.x - sp.x, o.z - sp.z);
          if (d < weite) { weite = d; dx = (o.x - sp.x) / d; dz = (o.z - sp.z) / d; }
        });
      } else if (s.halter >= 0) {   // weglaufen vom Bomben-Halter
        const h = Z.spieler[s.halter], d = Math.hypot(sp.x - h.x, sp.z - h.z) || 1;
        if (d < 5) { dx = (sp.x - h.x) / d; dz = (sp.z - h.z) / d; }
        const mitte = Math.hypot(sp.x, sp.z) / BOMBE_RAND;   // nicht in die Ecke drängen lassen
        dx -= sp.x / BOMBE_RAND * mitte * 1.6; dz -= sp.z / BOMBE_RAND * mitte * 1.6;
      }
      dx += Math.sin(e.wackel) * 0.45; dz += Math.cos(e.wackel * 1.3) * 0.45;
      const l = Math.hypot(dx, dz);
      e.x = l > 0.2 ? dx / l : 0; e.z = l > 0.2 ? dz / l : 0;
    },
    bauen(g) {
      teil(new THREE.CylinderGeometry(BOMBE_RAND + 0.5, BOMBE_RAND + 0.2, 1, 48), '#ff9a1f', 0, -0.5, 0, g);
      const boden = malen(256, 256, (c, s) => {
        for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#ffe38a' : '#ffd27a'; c.beginPath(); c.moveTo(s / 2, s / 2); c.arc(s / 2, s / 2, s / 2, i / 12 * Math.PI * 2, (i + 1) / 12 * Math.PI * 2); c.fill(); }
      });
      teil(new THREE.CircleGeometry(BOMBE_RAND + 0.4, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: boden }), 0, 0.01, 0, g).castShadow = false;
      teil(new THREE.TorusGeometry(BOMBE_RAND + 0.5, 0.2, 8, 48).rotateX(Math.PI / 2), '#e0398b', 0, 0.1, 0, g);
      const bombe = new THREE.Group();
      teil(new THREE.SphereGeometry(0.38, 16, 12), glanz('#222222'), 0, 0, 0, bombe);
      teil(new THREE.CylinderGeometry(0.04, 0.04, 0.3), '#c9a26b', 0, 0.45, 0, bombe);
      const funke = teil(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcc00' }), 0, 0.62, 0, bombe);
      g.add(bombe);
      const knall = teil(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: '#ff9a1f', transparent: true, opacity: 0.7 }), 0, 0, 0, g);
      knall.visible = false;
      return { bombe, funke, knall };
    },
    zeichnen(s, bild) {
      const h = s.halter >= 0 ? figuren[s.halter] : null;
      bild.bombe.visible = !!h;
      if (h) {
        bild.bombe.position.set(h.position.x, h.position.y + 1.75, h.position.z);
        bild.bombe.scale.setScalar(1 + Math.max(0, Math.sin(uhrzeit * (6 + 30 / Math.max(1, s.zuender)))) * 0.15);
        bild.funke.scale.setScalar(0.6 + Math.random() * 0.8);
      }
      const k = s.knall, alter = k ? s.zeit - k[2] : 9;
      bild.knall.visible = alter < 0.5;
      if (k && alter < 0.5) { bild.knall.position.set(k[0], 0.8, k[1]); bild.knall.scale.setScalar(0.5 + alter * 6); }
    },
  },
};

// Helfer für die Minispiele
const BODEN_N = 7, BODEN_P = 1.7;   // Heißer Boden: 7 × 7 Platten, jede 1,7 groß
const BOMBE_RAND = 6.3;             // Bomben-Pass: so groß ist die Arena
const tmpFarbe = new THREE.Color();
function bodenPlatte(sp) {   // auf welcher Platte steht jemand?
  const h = BODEN_N * BODEN_P / 2, eng = v => Math.max(0, Math.min(BODEN_N - 1, Math.floor((v + h) / BODEN_P)));
  return eng(sp.z) * BODEN_N + eng(sp.x);
}
function plattenMitte(i) {
  const h = BODEN_N * BODEN_P / 2;
  return { x: (i % BODEN_N + 0.5) * BODEN_P - h, z: (Math.floor(i / BODEN_N) + 0.5) * BODEN_P - h };
}
function auseinander(p, abstand) {   // Figuren schieben sich gegenseitig weg, damit sie nicht ineinander stehen
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    if (p[a].raus || p[b].raus) continue;
    const A = Z.spieler[a], B = Z.spieler[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d >= abstand || d < 0.001) continue;
    const u = (abstand - d) / 2 / d;
    A.x -= dx * u; A.z -= dz * u; B.x += dx * u; B.z += dz * u;
  }
}

// Das Ende: Siegertreppchen
function endeBauen(g) {
  teil(new THREE.CylinderGeometry(7, 7.3, 1, 40), '#6cc24a', 0, -0.5, 0, g);
  [[0, 1.6, '#ffcc00', '1'], [-2.2, 1.1, '#c0c8d0', '2'], [2.2, 0.7, '#d9894a', '3']].forEach(([x, h, farbe, zahl]) => {
    teil(new THREE.BoxGeometry(2, h, 2), farbe, x, h / 2, 0, g);
    const s = textSchild(zahl, '#ffffff', 0.9);
    s.position.set(x, h / 2, 1.1);
    g.add(s);
  });
  const anzahl = 400, orte = new Float32Array(anzahl * 3), farben = new Float32Array(anzahl * 3), farbe = new THREE.Color();
  for (let i = 0; i < anzahl; i++) {
    orte.set([zufall(-8, 8), zufall(0, 12), zufall(-5, 5)], i * 3);
    farbe.set(FARBEN[i % 4]); farben.set([farbe.r, farbe.g, farbe.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(orte, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.18, vertexColors: true })));
  return { konfetti: orte, geo };
}

// ========== Bots ==========
function botsDenken(dt) {
  Z.spieler.forEach((sp, i) => {
    if (sp.art !== 'bot') return;
    const e = botE[i];
    if (Z.phase === 'spiel') MINISPIELE[Z.spiel.typ].bot(Z.spiel, i, e, dt);
    else { e.x = 0; e.z = 0; }
  });
}

// ========== Der Chef rechnet das Spiel aus ==========
function logik(dt) {
  Z.spieler.forEach((sp, i) => {
    if (sp.art === 'lokal') eingaben[i] = lokaleEingabe(sp.schema, sp.pad);
    else if (sp.art === 'bot') eingaben[i] = botE[i];
  });
  botsDenken(dt);
  if (Z.meldungUhr > 0) { Z.meldungUhr -= dt; if (Z.meldungUhr <= 0) Z.meldung = ''; }
  if (Z.phase === 'brett') brettLogik(dt);
  else if (Z.phase === 'info') {
    Z.uhr -= dt;
    if (Z.uhr <= 0) { Z.phase = 'spiel'; druckReset(); effekt('los'); }
  } else if (Z.phase === 'spiel') {
    const M = MINISPIELE[Z.spiel.typ];
    Z.spiel.zeit += dt;
    if (M.update(Z.spiel, dt) || Z.spiel.zeit >= M.dauer) spielEnde();
  } else if (Z.phase === 'ergebnis') {
    Z.uhr -= dt;
    if (Z.uhr <= 0) nachErgebnis();
  }
}

// ========== Tasten und Gamepads ==========
const tasten = {}, zaehler = {}, padZaehler = [0, 0, 0, 0], padVorher = [false, false, false, false];
const SPIELTASTEN = new Set(Object.values(STEUERUNG).flatMap(s => [...s.hoch, ...s.runter, ...s.links, ...s.rechts, ...s.aktion]));
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (SPIELTASTEN.has(e.code) && Z) e.preventDefault();
  tasten[e.code] = true;
  if (!e.repeat) for (const [name, s] of Object.entries(STEUERUNG)) if (s.aktion.includes(e.code)) zaehler[name] = (zaehler[name] || 0) + 1;
});
addEventListener('keyup', e => { tasten[e.code] = false; });
addEventListener('blur', () => { for (const k in tasten) tasten[k] = false; });
const irgendeine = liste => liste.some(k => tasten[k]);
function gamepadsLesen() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < 4; i++) {
    const p = pads[i], an = !!(p && p.buttons[0] && p.buttons[0].pressed);
    if (an && !padVorher[i]) padZaehler[i]++;
    padVorher[i] = an;
  }
}
function lokaleEingabe(schema, pad) {
  const s = STEUERUNG[schema];
  let x = (irgendeine(s.rechts) ? 1 : 0) - (irgendeine(s.links) ? 1 : 0);
  let z = (irgendeine(s.runter) ? 1 : 0) - (irgendeine(s.hoch) ? 1 : 0);
  const p = navigator.getGamepads ? navigator.getGamepads()[pad] : null;
  if (p) {
    const ax = p.axes[0] || 0, az = p.axes[1] || 0;
    if (Math.abs(ax) > 0.3) x = ax;
    if (Math.abs(az) > 0.3) z = az;
    const knopf = n => p.buttons[n] && p.buttons[n].pressed;
    if (knopf(14)) x = -1; if (knopf(15)) x = 1; if (knopf(12)) z = -1; if (knopf(13)) z = 1;
  }
  return { x, z, n: (zaehler[schema] || 0) + (padZaehler[pad] || 0) };
}
// Klicken = würfeln (für den, der gerade dran ist)
leinwand.addEventListener('pointerdown', () => {
  if (!Z || Z.phase !== 'brett' || Z.schritt !== 'wuerfeln') return;
  const sp = Z.spieler[Z.dran];
  if (rolle === 'gast') { if (Z.dran === meinIndex) zaehler.solo = (zaehler.solo || 0) + 1; }
  else if (sp.art === 'lokal') zaehler[sp.schema] = (zaehler[sp.schema] || 0) + 1;
});

// ========== Geräusche (selbst gemacht mit Web Audio) ==========
let audio = null;
function audioStart() {
  try { if (!audio) audio = new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* kein Ton */ }
}
addEventListener('pointerdown', audioStart);
addEventListener('keydown', audioStart);
function ton(frequenz, dauer, typ = 'sine', laut = 0.15, ende = frequenz, spaeter = 0) {
  if (!audio || audio.state !== 'running') return;
  const t = audio.currentTime + spaeter, o = audio.createOscillator(), g = audio.createGain();
  o.type = typ; o.frequency.setValueAtTime(frequenz, t); o.frequency.exponentialRampToValueAtTime(ende, t + dauer);
  g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
  o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dauer);
}
function rauschen(dauer, laut = 0.3) {
  if (!audio || audio.state !== 'running') return;
  const puffer = audio.createBuffer(1, audio.sampleRate * dauer, audio.sampleRate), d = puffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const q = audio.createBufferSource(), g = audio.createGain();
  q.buffer = puffer; g.gain.value = laut; q.connect(g).connect(audio.destination); q.start();
}
const melodie = (noten, abstand = 0.12, typ = 'triangle') => noten.forEach((f, i) => ton(f, 0.22, typ, 0.13, f, i * abstand));
const KLAENGE = {
  dran: () => ton(660, 0.12, 'triangle', 0.1),
  wuerfel: () => { for (let i = 0; i < 5; i++) ton(300 + Math.random() * 400, 0.05, 'square', 0.05, 200, i * 0.06); },
  hopp: () => ton(400, 0.12, 'sine', 0.12, 800),
  muenze: () => melodie([988, 1319], 0.07, 'square'),
  gold: () => melodie([988, 1319, 1760], 0.06, 'square'),
  minus: () => ton(400, 0.35, 'sawtooth', 0.08, 150),
  pokal: () => melodie([523, 659, 784, 1047, 784, 1047], 0.11),
  ereignis: () => { ton(300, 0.5, 'sine', 0.12, 900); ton(900, 0.5, 'sine', 0.08, 300, 0.25); },
  minispiel: () => melodie([392, 523, 659, 784], 0.1),
  los: () => { ton(880, 0.15, 'square', 0.1); ton(1320, 0.3, 'square', 0.1, 1320, 0.15); },
  sieg: () => melodie([523, 659, 784, 1047], 0.13),
  boom: () => { rauschen(0.5, 0.4); ton(120, 0.4, 'sine', 0.25, 40); },
  wusch: () => ton(200, 0.15, 'sawtooth', 0.06, 600),
  bums: () => ton(150, 0.12, 'sine', 0.2, 80),
  platsch: () => { rauschen(0.4, 0.25); ton(500, 0.3, 'sine', 0.1, 100); },
  tipp: () => ton(700 + Math.random() * 200, 0.04, 'square', 0.03),
  ziel: () => melodie([784, 1047], 0.08),
  sprung: () => ton(300, 0.15, 'sine', 0.1, 700),
  autsch: () => { ton(600, 0.4, 'sawtooth', 0.1, 100); rauschen(0.2, 0.15); },
};
let gespielt = -1;
function effekteAbspielen() {
  if (gespielt < 0) gespielt = Z.effektNr;   // gerade erst dazugekommen: alte Geräusche nicht nachspielen
  for (const [nr, name] of Z.effekte) if (nr > gespielt) { gespielt = nr; if (KLAENGE[name]) KLAENGE[name](); }
}

// ========== Alles zeichnen ==========
const spielGruppe = new THREE.Group();
scene.add(spielGruppe);
let szene = '', bild = null, snap = true, uhrzeit = 0, menuWinkel = 0;
function szeneWechseln(typ) {
  szene = typ;
  spielGruppe.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  spielGruppe.clear();
  brett.visible = typ === 'brett';
  bild = typ === 'ende' ? endeBauen(spielGruppe) : MINISPIELE[typ] ? MINISPIELE[typ].bauen(spielGruppe) : null;
  snap = true;
}
function figurenAnpassen() {
  const schluessel = Z.spieler.map(s => s.name + s.farbe).join();
  if (schluessel === figurenSchluessel) return;
  for (const f of figuren) scene.remove(f);
  figuren = Z.spieler.map(s => baueFigur(s.farbe, s.name));
  for (const f of figuren) scene.add(f);
  figurenSchluessel = schluessel;
  snap = true;
}
const tmpV = new THREE.Vector3();
function kameraHin(x, y, z, zx, zy, zz, dt, tempo = 3) {
  const f = snap ? 1 : Math.min(1, dt * tempo);
  kamera.position.lerp(tmpV.set(x, y, z), f);
  kameraZiel.lerp(tmpV.set(zx, zy, zz), f);
  kamera.lookAt(kameraZiel);
}
function darstellen(dt) {
  uhrzeit += dt;
  for (const w of wolken) { w.position.x += dt * 0.6; if (w.position.x > 80) w.position.x = -80; }
  if (!Z) {   // im Menü: Kamera kreist über dem Brett
    menuWinkel += dt * 0.12;
    if (szene !== 'brett') szeneWechseln('brett');
    kamera.position.set(Math.sin(menuWinkel) * 30, 18, Math.cos(menuWinkel) * 24);
    kamera.lookAt(0, 0, 0);
    wuerfel.visible = zahlSchild.visible = false;
    pokal.position.set(feldPos[12].x, 1.6 + Math.sin(uhrzeit * 2) * 0.2, feldPos[12].z);
    pokal.rotation.y += dt;
    ballonsBewegen();
    return;
  }
  const imSpiel = Z.phase === 'info' || Z.phase === 'spiel' || Z.phase === 'ergebnis';
  const typ = imSpiel && Z.spiel ? Z.spiel.typ : Z.phase === 'ende' ? 'ende' : 'brett';
  if (typ !== szene) szeneWechseln(typ);
  figurenAnpassen();
  effekteAbspielen();

  // Figuren
  const fuehrend = Z.spieler.reduce((best, s, i) => (s.pokale * 1000 + s.muenzen > Z.spieler[best].pokale * 1000 + Z.spieler[best].muenzen ? i : best), 0);
  const einzigerFuehrender = Z.spieler.filter(s => s.pokale * 1000 + s.muenzen === Z.spieler[fuehrend].pokale * 1000 + Z.spieler[fuehrend].muenzen).length === 1;
  Z.spieler.forEach((sp, i) => {
    const f = figuren[i], u = f.userData, weich = snap ? 1 : Math.min(1, dt * 16);
    const vorher = f.position.clone();
    f.position.lerp(tmpV.set(sp.x, sp.y, sp.z), weich);
    f.rotation.y += winkel(sp.r - f.rotation.y) * (snap ? 1 : Math.min(1, dt * 12));
    f.visible = !sp.weg;
    const bewegt = Math.hypot(f.position.x - vorher.x, f.position.z - vorher.z) / Math.max(dt, 0.001);
    u.koerper.rotation.z = bewegt > 0.5 ? Math.sin(uhrzeit * 18) * 0.12 : 0;
    u.koerper.scale.y = 1 + Math.sin(uhrzeit * 3 + i) * 0.03;
    u.krone.visible = einzigerFuehrender && i === fuehrend && Z.phase !== 'ende';
    u.schild.visible = typ !== 'tippen';
  });

  if (typ === 'brett') {
    const sp = Z.spieler[Z.dran] || Z.spieler[0];
    kameraHin(sp.x, 9, sp.z + 10.5, sp.x, 0.5, sp.z, dt);
    const pf = feldPos[Z.pokalFeld];
    pokal.position.lerp(tmpV.set(pf.x, 1.6 + Math.sin(uhrzeit * 2) * 0.2, pf.z), snap ? 1 : Math.min(1, dt * 3));
    pokal.rotation.y += dt;
    wuerfel.visible = Z.schritt === 'wuerfeln';
    wuerfel.position.set(sp.x, sp.y + 2.7 + Math.sin(uhrzeit * 5) * 0.1, sp.z);
    wuerfel.lookAt(kamera.position.x, wuerfel.position.y, kamera.position.z);
    wuerfel.children.forEach((w, i) => { w.rotation.x += dt * (7 + i); w.rotation.y += dt * (9 - i); });
    zahlSchild.visible = Z.schritt === 'zeigen' || (Z.schritt === 'laufen' && Z.rest > 0) || (Z.schritt === 'pokal' && Z.rest > 0);
    zahlSchild.material.map = zahlBilder[Math.max(0, Math.min(15, Z.rest))];
    zahlSchild.position.set(sp.x, sp.y + 2.6, sp.z);
    ballonsBewegen();
  } else {
    wuerfel.visible = zahlSchild.visible = false;
    if (typ === 'ende') {
      kameraHin(0, 3.8, 9.5, 0, 1.6, 0, dt);
      for (let i = 0; i < bild.konfetti.length; i += 3) {
        bild.konfetti[i + 1] -= dt * 2;
        bild.konfetti[i] += Math.sin(uhrzeit * 2 + i) * dt * 0.5;
        if (bild.konfetti[i + 1] < 0) bild.konfetti[i + 1] += 12;
      }
      bild.geo.attributes.position.needsUpdate = true;
    } else {
      const M = MINISPIELE[typ], [p, ziel] = M.kamera;
      kameraHin(p[0], p[1], p[2], ziel[0], ziel[1], ziel[2], dt);
      M.zeichnen(Z.spiel, bild, dt);
    }
  }
  snap = false;
  hudZeichnen();
}
function ballonsBewegen() {
  for (const b of ballons) { b.userData.w += 0.002; b.position.set(Math.cos(b.userData.w) * 7, 6 + Math.sin(uhrzeit + b.userData.w * 5) * 0.4, Math.sin(b.userData.w) * 4.5); }
}

// ========== Anzeige (HUD) ==========
const el = id => document.getElementById(id);
function setze(id, html) { const e = el(id); if (e._html !== html) { e.innerHTML = html; e._html = html; } }
function zeige(id, an) { el(id).classList.toggle('versteckt', !an); }
const MEDAILLEN = ['🥇', '🥈', '🥉', '4️⃣'];
const farbName = sp => `<span style="color:${sp.farbe}">${sicher(sp.name)}</span>`;
function wer(i) {   // wie heißt der Spieler i aus meiner Sicht?
  const sp = Z.spieler[i];
  return rolle === 'gast' && i === meinIndex ? 'Du' : sp.name;
}
function hudZeichnen() {
  zeige('hud', true);
  const M = Z.spiel && MINISPIELE[Z.spiel.typ];
  if (Z.phase === 'brett') setze('oben', `🎲 Runde ${Z.runde} / ${Z.maxRunden}`);
  else if (M && Z.phase === 'spiel') setze('oben', `${M.emoji} ${M.name} · ⏱️ ${Math.max(0, Math.ceil(M.dauer - Z.spiel.zeit))}`);
  else if (M) setze('oben', `${M.emoji} ${M.name}`);
  else setze('oben', '🎉 Ende!');
  Z.spieler.forEach((sp, i) => {
    let tasten = sp.art === 'bot' ? '🤖 Bot' : sp.art === 'online' ? '🌐 online' : '⌨️ ' + STEUERUNG[sp.schema].name;
    if (rolle === 'gast') tasten = i === meinIndex ? '⭐ Das bist du!' : sp.art === 'bot' ? '🤖 Bot' : '🌐 online';
    if (rolle === 'host' && i === 0) tasten = '⭐ Das bist du! (' + STEUERUNG.solo.name + ')';
    const extra = M && (Z.phase === 'spiel' || Z.phase === 'ergebnis') ? `<div>${M.anzeige(Z.spiel, i)}</div>` : '';
    setze('k' + i, `<div class="name" style="color:${sp.farbe}">${FARB_NAMEN[i]} ${sicher(sp.name)}</div>
      <div class="werte">🏆 ${sp.pokale} &nbsp; 🪙 ${sp.muenzen}</div>${extra}<div class="tasten">${sicher(tasten)}</div>`);
    el('k' + i).style.borderColor = Z.phase === 'brett' && i === Z.dran ? sp.farbe : 'transparent';
    el('k' + i).classList.toggle('dran', Z.phase === 'brett' && i === Z.dran);
  });
  setze('meldung', sicher(Z.meldung));
  // Hinweis unten: wer muss was drücken?
  let hinweis = '';
  if (Z.phase === 'brett' && Z.schritt === 'wuerfeln') {
    const sp = Z.spieler[Z.dran];
    if (sp.art === 'bot') hinweis = `🤖 ${sp.name} würfelt …`;
    else if (rolle === 'gast') hinweis = Z.dran === meinIndex ? '🎲 Du bist dran! Drücke Leertaste oder klicke zum Würfeln!' : `🎲 ${sp.name} würfelt …`;
    else if (sp.art === 'online') hinweis = `🎲 ${sp.name} würfelt …`;
    else hinweis = `🎲 ${sp.name}: drücke ${STEUERUNG[sp.schema].aktionName} oder klicke zum Würfeln!`;
  } else if (Z.phase === 'brett' && Z.schritt === 'laufen') hinweis = `${Z.spieler[Z.dran].name} hüpft noch ${Z.rest} ${Z.rest === 1 ? 'Feld' : 'Felder'} …`;
  setze('hinweis', sicher(hinweis));
  // Fenster
  zeige('infoBox', Z.phase === 'info');
  if (Z.phase === 'info') {
    setze('infoEmoji', M.emoji); setze('infoName', sicher(M.name)); setze('infoText', sicher(M.text));
    setze('infoSteuerung', '🎮 Steuerung: ' + sicher(M.steuerung) + '<br>' + Z.spieler.map((sp, i) => sp.art === 'lokal' && rolle !== 'host'
      ? `${farbName(sp)}: ${sicher(STEUERUNG[sp.schema].name)}` : '').filter(Boolean).join(' · '));
    setze('infoZahl', Z.uhr > 4 ? 'Mach dich bereit …' : String(Math.ceil(Z.uhr)));
  }
  zeige('ergebnisBox', Z.phase === 'ergebnis');
  if (Z.phase === 'ergebnis' && Z.ergebnis) {
    const reihe = Z.ergebnis.map((e, i) => ({ ...e, i })).sort((a, b) => a.platz - b.platz);
    setze('ergebnisListe', reihe.map(e => `${MEDAILLEN[e.platz - 1]} ${farbName(Z.spieler[e.i])} ${e.plus ? '+' + e.plus + ' 🪙' : ''}`).join('<br>'));
  }
  zeige('endeBox', Z.phase === 'ende');
  if (Z.phase === 'ende' && Z.sieger) {
    const sieger = Z.spieler[Z.sieger[0]];
    setze('endeTitel', `🏆 ${sicher(wer(Z.sieger[0]))} ${rolle === 'gast' && Z.sieger[0] === meinIndex ? 'hast' : 'hat'} gewonnen! 🎉`);
    el('endeTitel').style.color = sieger.farbe;
    setze('endeListe', Z.sieger.map((i, platz) => `${MEDAILLEN[platz]} ${farbName(Z.spieler[i])} – 🏆 ${Z.spieler[i].pokale} · 🪙 ${Z.spieler[i].muenzen}`).join('<br>'));
  }
}

// ========== Online (PeerJS) ==========
// Einer erstellt den Raum (der "Host"). Der Host rechnet das ganze Spiel aus und schickt es an alle.
// Die Gäste schicken nur, welche Tasten sie drücken.
let rolle = 'lokal';    // 'lokal', 'host' oder 'gast'
let peer = null, hostVerbindung = null, raumCode = '', meinIndex = 0, netzUhr = 0, eingabeUhr = 0, letzteEingabe = '';
const gaeste = new Map();
const peerName = code => 'party-games-raum-' + code.toLowerCase();
const netzInfo = t => { el('netzInfo').textContent = t; };
function codeMachen() {
  const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += zeichen[zufallsZahl(zeichen.length)];
  return c;
}
function anAlle(d) { for (const v of gaeste.values()) if (v.open) v.send(d); }
function lobbyNamen() {
  const namen = ['Spieler 1'];
  for (const v of gaeste.values()) namen.push('Spieler ' + (namen.length + 1));
  return namen;
}
function lobbyZeigen(namen, binHost) {
  zeige('menu', false); zeige('lobby', true);
  setze('lobbyCode', `Raum-Code: <b style="font-size:2rem;color:#ffcc00;letter-spacing:.3rem">${sicher(raumCode)}</b>` + (binHost ? '<br>Sag den Code deinen Freunden!' : ''));
  const zeilen = [];
  for (let i = 0; i < 4; i++) zeilen.push(`${FARB_NAMEN[i]} ` + (namen[i] ? sicher(namen[i]) + (binHost && i === 0 ? ' (du)' : '') : '🤖 Bot (wenn keiner mehr kommt)'));
  setze('lobbyListe', zeilen.join('<br>'));
  zeige('lobbyStart', binHost); zeige('lobbyRunden', binHost);
  setze('lobbyText', binHost ? '' : '⏳ Warte, bis der Raum-Ersteller das Spiel startet …');
}
function raumErstellen() {
  if (typeof Peer === 'undefined') { netzInfo('😕 Online geht gerade nicht. Bist du mit dem Internet verbunden?'); return; }
  raumCode = codeMachen();
  netzInfo('⏳ Raum wird erstellt …');
  peer = new Peer(peerName(raumCode));
  peer.on('open', () => { rolle = 'host'; lobbyZeigen(lobbyNamen(), true); });
  peer.on('connection', v => {
    v.on('open', () => {
      if (Z) { v.send({ t: 'nein', grund: 'Das Spiel hat schon angefangen.' }); setTimeout(() => v.close(), 500); return; }
      if (gaeste.size >= 3) { v.send({ t: 'nein', grund: 'Der Raum ist schon voll (4 Spieler).' }); setTimeout(() => v.close(), 500); return; }
      gaeste.set(v.peer, v);
      lobbyZeigen(lobbyNamen(), true);
      anAlle({ t: 'lobby', namen: lobbyNamen() });
      ton(660, 0.1, 'triangle', 0.1);
    });
    v.on('data', d => {
      if (!Z || !d || d.t !== 'e') return;
      const i = Z.spieler.findIndex(s => s.peer === v.peer);
      if (i < 0) return;
      const zahl = (w, a, b) => Math.max(a, Math.min(b, Number(w) || 0));
      eingaben[i] = { x: zahl(d.x, -1, 1), z: zahl(d.z, -1, 1), n: zahl(d.n, 0, 1e9) };
    });
    v.on('close', () => {
      if (!gaeste.has(v.peer)) return;
      gaeste.delete(v.peer);
      if (!Z) { lobbyZeigen(lobbyNamen(), true); anAlle({ t: 'lobby', namen: lobbyNamen() }); return; }
      const sp = Z.spieler.find(s => s.peer === v.peer);
      if (sp) { sp.art = 'bot'; meldung(`👋 ${sp.name} ist weg – ein Bot spielt für ${sp.name} weiter.`, 3); }
    });
  });
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { peer.destroy(); raumErstellen(); return; }   // Code schon vergeben -> neuer Code
    if (rolle === 'lokal') netzInfo('😕 Das hat nicht geklappt (' + e.type + '). Versuch es nochmal!');
  });
}
function onlineStarten() {
  const liste = [{ name: 'Spieler 1', art: 'lokal', schema: 'solo', pad: 0 }];
  for (const v of gaeste.values()) liste.push({ name: 'Spieler ' + (liste.length + 1), art: 'online', peer: v.peer });
  while (liste.length < 4) liste.push({ name: BOT_NAMEN[liste.length], art: 'bot' });
  spielStarten(liste);
  liste.forEach((s, i) => { if (s.peer) gaeste.get(s.peer).send({ t: 'start', index: i }); });
}
function raumBeitreten(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 4) { netzInfo('Der Raum-Code hat 4 Zeichen.'); return; }
  if (typeof Peer === 'undefined') { netzInfo('😕 Online geht gerade nicht. Bist du mit dem Internet verbunden?'); return; }
  netzInfo('⏳ Suche Raum ' + code + ' …');
  peer = new Peer();
  peer.on('open', () => {
    raumCode = code;
    hostVerbindung = peer.connect(peerName(code), { reliable: true });
    hostVerbindung.on('data', gastEmpfaengt);
    hostVerbindung.on('close', () => {
      if (rolle !== 'gast') return;
      alert('Die Verbindung zum Raum ist weg. 😕 Das Spiel startet neu.');
      location.reload();
    });
  });
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') netzInfo('😕 Den Raum ' + code + ' gibt es nicht. Stimmt der Code?');
    else netzInfo('😕 Das hat nicht geklappt (' + e.type + '). Versuch es nochmal!');
  });
}
function gastEmpfaengt(d) {
  if (!d) return;
  if (d.t === 'lobby') { rolle = 'gast'; lobbyZeigen(d.namen || [], false); }
  else if (d.t === 'start') { rolle = 'gast'; meinIndex = d.index; zeige('lobby', false); }
  else if (d.t === 'z' && rolle === 'gast') Z = d.z;
  else if (d.t === 'nein') netzInfo('😕 ' + d.grund);
}
function netzSenden(dt) {
  if (rolle === 'host') {
    netzUhr -= dt;
    if (netzUhr <= 0) { netzUhr = 1 / 20; anAlle({ t: 'z', z: Z }); }
  } else if (rolle === 'gast' && hostVerbindung && hostVerbindung.open) {
    const e = lokaleEingabe('solo', 0), text = JSON.stringify(e);
    eingabeUhr -= dt;
    if (text !== letzteEingabe || eingabeUhr <= 0) { hostVerbindung.send({ t: 'e', ...e }); letzteEingabe = text; eingabeUhr = 0.2; }
  }
}

// ========== Menü ==========
let menschen = 1, runden = 10;
try { menschen = Number(localStorage.getItem('party-menschen')) || 1; runden = Number(localStorage.getItem('party-runden')) || 10; } catch (e) { /* egal */ }
if (!(menschen >= 1 && menschen <= 4)) menschen = 1;
if (!RUNDEN_WAHL.includes(runden)) runden = 10;
function knoepfe(id, werte, aktuell, text, waehlen) {
  const box = el(id);
  box.innerHTML = '';
  for (const w of werte) {
    const k = document.createElement('button');
    k.textContent = text(w);
    k.classList.toggle('gewaehlt', w === aktuell);
    k.onclick = () => waehlen(w);
    box.append(k);
  }
}
function menuAufbauen() {
  knoepfe('anzahlKnoepfe', [1, 2, 3, 4], menschen, n => n === 1 ? '1 🙂' : n + ' ' + '🙂'.repeat(n), n => {
    menschen = n; try { localStorage.setItem('party-menschen', n); } catch (e) { /* egal */ }
    menuAufbauen();
  });
  const rundenWaehlen = n => { runden = n; try { localStorage.setItem('party-runden', n); } catch (e) { /* egal */ } menuAufbauen(); };
  knoepfe('rundenKnoepfe', RUNDEN_WAHL, runden, n => n + ' Runden', rundenWaehlen);
  knoepfe('rundenKnoepfe2', RUNDEN_WAHL, runden, n => n + ' Runden', rundenWaehlen);
  const zeilen = [];
  for (let i = 0; i < 4; i++) {
    const schema = menschen === 1 ? 'solo' : i;
    zeilen.push(`<span style="color:${FARBEN[i]}">${FARB_NAMEN[i]} Spieler ${i + 1}</span>: ` + (i < menschen ? sicher(STEUERUNG[schema].name) : '🤖 Bot'));
  }
  setze('tastenListe', zeilen.join('<br>') + '<br>🎮 Gamepads gehen auch (Knopf A = Aktion)!');
}
function lokalStarten() {
  const liste = [];
  for (let i = 0; i < 4; i++) liste.push(i < menschen
    ? { name: 'Spieler ' + (i + 1), art: 'lokal', schema: menschen === 1 ? 'solo' : String(i), pad: i }
    : { name: BOT_NAMEN[i], art: 'bot' });
  spielStarten(liste);
}
function spielStarten(liste) {
  Z = neuerZustand(liste, runden);
  meldung(`🎉 Los geht's! ${Z.spieler[0].name} fängt an.`, 2);
  zeige('menu', false); zeige('lobby', false);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // sonst drückt die Leertaste den Knopf nochmal
  druckReset();
  brettPositionen();
  snap = true;
}
el('startKnopf').onclick = () => { rolle = 'lokal'; lokalStarten(); };
el('hostKnopf').onclick = raumErstellen;
el('beitretenKnopf').onclick = () => raumBeitreten(el('codeFeld').value);
el('codeFeld').addEventListener('keydown', e => { if (e.key === 'Enter') raumBeitreten(e.target.value); });
el('lobbyStart').onclick = onlineStarten;
el('nochmalKnopf').onclick = () => location.reload();
menuAufbauen();

// ========== Hauptschleife ==========
let letzteZeit = performance.now();
function schleife(jetzt) {
  const dt = Math.min(0.05, (jetzt - letzteZeit) / 1000);
  letzteZeit = jetzt;
  gamepadsLesen();
  if (Z && rolle !== 'gast') logik(dt);
  if (Z || rolle === 'gast') netzSenden(dt);
  darstellen(dt);
  renderer.render(scene, kamera);
  requestAnimationFrame(schleife);
}
requestAnimationFrame(schleife);
