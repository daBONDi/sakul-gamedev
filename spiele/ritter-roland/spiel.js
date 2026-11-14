import * as THREE from 'three';

// =====================================================================
//  RITTER ROLAND – eine riesige 3D-Welt mit Aufträgen
// =====================================================================

const WELT = 300; // Die Welt geht von -300 bis +300 (600 x 600 Meter!)

// ---------- Grundgerüst: Szene, Kamera, Licht ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const szene = new THREE.Scene();
szene.background = new THREE.Color(0x87ceeb);
szene.fog = new THREE.Fog(0x87ceeb, 90, 260);

const kamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
addEventListener('resize', () => {
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

szene.add(new THREE.HemisphereLight(0xffffff, 0x446622, 0.9));
const sonne = new THREE.DirectionalLight(0xffffff, 1.2);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 200 });
szene.add(sonne, sonne.target);

// ---------- Hilfsfunktionen zum Bauen ----------
const mat = farbe => new THREE.MeshStandardMaterial({ color: farbe });
function klotz(b, h, t, farbe) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), mat(farbe));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function kugel(r, farbe) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(farbe));
  m.castShadow = true;
  return m;
}
function kegel(r, h, farbe, seiten = 8) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seiten), mat(farbe));
  m.castShadow = true;
  return m;
}
function walze(r1, r2, h, farbe, seiten = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seiten), mat(farbe));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// Flacher farbiger Kreis auf dem Boden (für Gebiete wie Sumpf, See …)
function bodenKreis(x, z, r, farbe, hoehe = 0.03) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat(farbe));
  m.rotation.x = -Math.PI / 2; m.position.set(x, hoehe, z); m.receiveShadow = true;
  szene.add(m);
  return m;
}
// Abstand von Punkt (px,pz) zur Strecke von (x1,z1) nach (x2,z2)
function abstandZuStrecke(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}
// Namensschild, das über einer Figur schwebt
function namensSchild(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.font = 'bold 42px system-ui, sans-serif';
  const w = x.measureText(text).width + 40;
  x.fillStyle = 'rgba(0,0,0,0.55)';
  x.beginPath();
  if (x.roundRect) x.roundRect((512 - w) / 2, 10, w, 76, 20); else x.rect((512 - w) / 2, 10, w, 76);
  x.fill();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(5, 0.94, 1);
  return s;
}

// ---------- Hindernisse (gegen die man nicht laufen kann) ----------
const hindernisse = []; // Rechtecke {minX, maxX, minZ, maxZ}
const kreise = [];      // Kreise {x, z, r} (Berge, Brunnen)
function hindernis(x, z, b, t) {
  const h = { minX: x - b / 2, maxX: x + b / 2, minZ: z - t / 2, maxZ: z + t / 2 };
  hindernisse.push(h);
  return h;
}

// Der See: Wasser ist überall zwischen Ufer und Insel – außer auf der Brücke
const SEE = { x: 190, z: 30, r: 65, insel: 18 };
function istWasser(x, z) {
  const d = Math.hypot(x - SEE.x, z - SEE.z);
  if (d > SEE.r || d < SEE.insel) return false;
  if (Math.abs(z - SEE.z) < 2.8 && x < SEE.x) return false; // Brücke
  return true;
}

function stoesst(x, z, r) {
  if (istWasser(x, z)) return true;
  for (const h of hindernisse) {
    if (x + r > h.minX && x - r < h.maxX && z + r > h.minZ && z - r < h.maxZ) return true;
  }
  for (const k of kreise) {
    if (Math.hypot(x - k.x, z - k.z) < k.r + r) return true;
  }
  return false;
}
// Bewegen mit Kollision: erst X, dann Z – so rutscht man an Wänden entlang
function bewegen(obj, dx, dz, r) {
  if (!stoesst(obj.position.x + dx, obj.position.z, r)) obj.position.x += dx;
  if (!stoesst(obj.position.x, obj.position.z + dz, r)) obj.position.z += dz;
}

// =====================================================================
//  DIE WELT
// =====================================================================
const boden = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat(0x5aa83a));
boden.rotation.x = -Math.PI / 2;
boden.receiveShadow = true;
szene.add(boden);

// Unsichtbarer Zaun am Weltrand
hindernis(0, -WELT, 2 * WELT, 2); hindernis(0, WELT, 2 * WELT, 2);
hindernis(-WELT, 0, 2, 2 * WELT); hindernis(WELT, 0, 2, 2 * WELT);

// Wichtige Orte
const DORF = { x: 0, z: 205 };
const HOF = { x: -140, z: 160 };
const SUMPF = { x: -205, z: 0 };
const TAL = { x: -190, z: -190 };   // Drachental in den Bergen
const BURG = { x: 0, z: -210 };

const gebiete = [
  { name: '🏘️ Dorf Rolandsheim', x: DORF.x, z: DORF.z, r: 45 },
  { name: '🌾 Hof von Bauer Hans', x: HOF.x, z: HOF.z, r: 40 },
  { name: '🍄 Hexensumpf', x: SUMPF.x, z: SUMPF.z, r: 60 },
  { name: '🌊 Glitzersee', x: SEE.x, z: SEE.z, r: 80 },
  { name: '🐉 Drachental', x: TAL.x, z: TAL.z, r: 45 },
  { name: '⛰️ Drachenberge', x: TAL.x, z: TAL.z, r: 125 },
  { name: '🏰 Koboldburg', x: BURG.x, z: BURG.z, r: 60 },
];

// ---------- Wege ----------
const wege = [
  [0, 195, 0, 0], [0, 0, 0, -186], [0, 0, -195, 0], [0, 0, 122, 30],
  [-5, 200, -112, 150], [0, -60, -106, -120],
];
wege.forEach(([x1, z1, x2, z2], i) => {
  const l = Math.hypot(x2 - x1, z2 - z1);
  const w = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, l + 6), mat(0xc8a165));
  w.position.set((x1 + x2) / 2, 0.04 + i * 0.003, (z1 + z2) / 2);
  w.rotation.y = Math.atan2(x2 - x1, z2 - z1);
  w.receiveShadow = true;
  szene.add(w);
});
const amWeg = (x, z, abstand) => wege.some(([x1, z1, x2, z2]) => abstandZuStrecke(x, z, x1, z1, x2, z2) < abstand);

// ---------- Dorf Rolandsheim ----------
function haus(x, z, wand = 0xf5e6c8, dach = 0xa0522d, g = 8, blickZu = DORF) {
  const h = new THREE.Group();
  const w = klotz(g, 5, g, wand); w.position.y = 2.5;
  const d = kegel(g * 0.78, 4, dach, 4); d.position.y = 7; d.rotation.y = Math.PI / 4;
  const tuer = klotz(1.6, 2.8, 0.2, 0x5d4037); tuer.position.set(0, 1.4, g / 2 + 0.05);
  h.add(w, d, tuer);
  for (const s of [-1, 1]) {
    const f = klotz(1.2, 1.2, 0.2, 0x90caf9); f.position.set(s * g * 0.28, 3, g / 2 + 0.05); h.add(f);
  }
  h.position.set(x, 0, z);
  h.rotation.y = Math.atan2(blickZu.x - x, blickZu.z - z);
  szene.add(h);
  hindernis(x, z, g * 1.2, g * 1.2);
}
haus(24, 212); haus(8, 230, 0xffe0b2, 0x8d4925); haus(-12, 228, 0xe1f5fe, 0xb03030);
haus(-28, 214, 0xfff9c4); haus(22, 170, 0xf8bbd0, 0x6d4c41);

// Brunnen (heilt!)
const brunnen = new THREE.Group();
const becken = walze(3, 3.2, 1, 0x9e9e9e, 20); becken.position.y = 0.5;
const wasser = walze(2.7, 2.7, 0.1, 0x42a5f5, 20); wasser.position.y = 0.97;
const saeule = walze(0.4, 0.5, 2.5, 0x9e9e9e); saeule.position.y = 1.25;
brunnen.add(becken, wasser, saeule);
brunnen.position.set(DORF.x, 0, DORF.z);
szene.add(brunnen);
kreise.push({ x: DORF.x, z: DORF.z, r: 3.2 });

// Stall
const STALL = { x: 22, z: 190 };
for (const [sx, sz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
  const p = klotz(0.5, 4.5, 0.5, 0x6d4c41); p.position.set(STALL.x + sx, 2.25, STALL.z + sz); szene.add(p);
  hindernis(STALL.x + sx, STALL.z + sz, 0.6, 0.6);
}
const stallDach = klotz(11.5, 0.4, 9.5, 0x8d4925); stallDach.position.set(STALL.x, 4.6, STALL.z); szene.add(stallDach);
const stallWand = klotz(10, 4.2, 0.4, 0xa1887f); stallWand.position.set(STALL.x + 5, 2.1, STALL.z); stallWand.rotation.y = Math.PI / 2; szene.add(stallWand);
hindernis(STALL.x + 5, STALL.z, 0.6, 9);
const heu = klotz(2, 1, 3, 0xe6c35c); heu.position.set(STALL.x + 3.5, 0.5, STALL.z); szene.add(heu);

// ---------- Hof von Bauer Hans ----------
haus(-150, 132, 0xb71c1c, 0x4e342e, 10, HOF);
const feld = new THREE.Mesh(new THREE.BoxGeometry(44, 0.12, 34), mat(0xe6c35c));
feld.position.set(HOF.x - 5, 0.06, HOF.z + 10); feld.receiveShadow = true; szene.add(feld);
for (let i = 0; i < 8; i++) {
  const reihe = klotz(42, 0.5, 1, 0xd4a83a); reihe.position.set(HOF.x - 5, 0.25, HOF.z - 4 + i * 4); szene.add(reihe);
}
for (const [hx, hz] of [[-115, 175], [-120, 182], [-170, 140]]) {
  const ballen = walze(1.5, 1.5, 2, 0xd4a83a); ballen.rotation.z = Math.PI / 2; ballen.position.set(hx, 1.5, hz); szene.add(ballen);
  hindernis(hx, hz, 2.2, 3);
}

// ---------- Hexensumpf ----------
bodenKreis(SUMPF.x, SUMPF.z, 58, 0x4b5320);
for (let i = 0; i < 8; i++) {
  const w = Math.random() * Math.PI * 2, d = 15 + Math.random() * 35;
  bodenKreis(SUMPF.x + Math.cos(w) * d, SUMPF.z + Math.sin(w) * d, 2 + Math.random() * 4, 0x2f3d1f, 0.04);
}
haus(-217, -4, 0x6d4c41, 0x4a148c, 8, { x: 0, z: 0 });
const kessel = walze(1.2, 0.8, 1.3, 0x222222); kessel.position.set(-206, 0.65, 8); szene.add(kessel);
const suppe = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), new THREE.MeshBasicMaterial({ color: 0x76ff03 }));
suppe.rotation.x = -Math.PI / 2; suppe.position.set(-206, 1.32, 8); szene.add(suppe);
hindernis(-206, 8, 2.4, 2.4);

const PILZ_ORTE = [[-245, -35], [-175, -42], [-232, 42], [-178, 36], [-258, 8]];
// Tote Bäume im Sumpf
for (let i = 0; i < 26; i++) {
  const w = Math.random() * Math.PI * 2, d = 12 + Math.random() * 44;
  const x = SUMPF.x + Math.cos(w) * d, z = SUMPF.z + Math.sin(w) * d;
  if (amWeg(x, z, 5) || PILZ_ORTE.some(([px, pz]) => Math.hypot(x - px, z - pz) < 6) || Math.hypot(x + 212, z) < 14) continue;
  const b = new THREE.Group();
  const stamm = walze(0.3, 0.5, 6, 0x4e3b2a, 6); stamm.position.y = 3;
  const ast1 = klotz(2, 0.25, 0.25, 0x4e3b2a); ast1.position.set(0.8, 4.5, 0); ast1.rotation.z = 0.6;
  const ast2 = klotz(1.6, 0.25, 0.25, 0x4e3b2a); ast2.position.set(-0.7, 3.6, 0); ast2.rotation.z = -0.5;
  b.add(stamm, ast1, ast2); b.position.set(x, 0, z); b.rotation.y = Math.random() * 6;
  szene.add(b); hindernis(x, z, 1, 1);
}

// ---------- Glitzersee ----------
bodenKreis(SEE.x, SEE.z, SEE.r + 4, 0xe0c98a, 0.03);  // Sandstrand
const seeWasser = bodenKreis(SEE.x, SEE.z, SEE.r, 0x2a7fd4, 0.05);
seeWasser.material.roughness = 0.15; seeWasser.material.metalness = 0.3;
bodenKreis(SEE.x, SEE.z, SEE.insel + 1.5, 0xe0c98a, 0.07);
bodenKreis(SEE.x, SEE.z, SEE.insel, 0x66bb44, 0.08);
const bruecke = klotz(SEE.x - SEE.insel - 118, 0.4, 6, 0x8d6e63);
bruecke.position.set((118 + SEE.x - SEE.insel) / 2 + 2, 0.2, SEE.z); szene.add(bruecke);
for (const s of [-1, 1]) {
  const gelaender = klotz(SEE.x - SEE.insel - 118, 0.2, 0.2, 0x5d4037);
  gelaender.position.set(bruecke.position.x, 1.2, SEE.z + s * 2.9); szene.add(gelaender);
}
haus(104, 52, 0x8d6e63, 0x795548, 7, SEE);
const boot = klotz(2.5, 0.8, 6, 0x6d4c41); boot.position.set(140, 0.3, 58); boot.rotation.y = 0.8; szene.add(boot);

// ---------- Drachenberge ----------
const bergMat = mat(0x8a8a8a), schneeMat = mat(0xffffff);
function berg(x, z, r, h, kollision = true) {
  const b = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), bergMat);
  b.position.set(x, h / 2, z); b.castShadow = kollision; b.receiveShadow = true;
  const s = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, h * 0.3, 9), schneeMat);
  s.position.set(x, h * 0.85 + 0.05, z);
  szene.add(b, s);
  if (kollision) kreise.push({ x, z, r: r * 0.85 });
}
bodenKreis(TAL.x, TAL.z, 46, 0x8d7b68);
const ZWERG = { x: -108, z: -120 };
const passWinkel = Math.atan2(ZWERG.z - TAL.z, ZWERG.x - TAL.x);
for (let i = 0; i < 60; i++) {
  const w = Math.random() * Math.PI * 2;
  let diff = Math.abs(w - passWinkel); diff = Math.min(diff, Math.PI * 2 - diff);
  const d = 58 + Math.random() * 60, r = 12 + Math.random() * 10;
  if (diff * d < r * 0.85 + 9) continue; // Hier ist der Pass ins Tal – frei lassen!
  const x = TAL.x + Math.cos(w) * d, z = TAL.z + Math.sin(w) * d;
  if (Math.hypot(x - ZWERG.x, z - ZWERG.z) < r + 8 || amWeg(x, z, r + 4)) continue;
  berg(x, z, r, 22 + Math.random() * 25);
}
// Knochen im Drachental
for (let i = 0; i < 8; i++) {
  const k = walze(0.25, 0.25, 2 + Math.random() * 2, 0xf5f5dc, 6);
  k.rotation.z = Math.PI / 2; k.rotation.y = Math.random() * 6;
  k.position.set(TAL.x + (Math.random() - 0.5) * 60, 0.25, TAL.z + (Math.random() - 0.5) * 60);
  szene.add(k);
}
const lore = klotz(2, 1.4, 3, 0x616161); lore.position.set(ZWERG.x + 4, 0.9, ZWERG.z - 5); szene.add(lore);
hindernis(lore.position.x, lore.position.z, 2.2, 3.2);

// Berge rund um die ganze Welt (nur zum Anschauen)
for (let i = -WELT; i <= WELT; i += 40) {
  for (const [x, z] of [[i, -WELT - 25], [i, WELT + 25], [-WELT - 25, i], [WELT + 25, i]]) {
    berg(x + (Math.random() - 0.5) * 15, z, 25 + Math.random() * 12, 40 + Math.random() * 35, false);
  }
}

// ---------- Koboldburg ----------
bodenKreis(BURG.x, BURG.z + 10, 58, 0x6b6b4a);
const steinFarbe = 0x7e7e7e;
function mauer(x, z, b, t) {
  const m = klotz(b, 8, t, steinFarbe);
  m.position.set(x, 4, z);
  szene.add(m);
  hindernis(x, z, b, t);
  const lang = Math.max(b, t), anzahl = Math.floor(lang / 2);
  for (let i = 0; i < anzahl; i += 2) {
    const zinne = klotz(b > t ? 1 : t, 1.2, b > t ? t : 1, steinFarbe);
    const off = -lang / 2 + i * 2 + 1;
    zinne.position.set(b > t ? x + off : x, 8.6, b > t ? z : z + off);
    szene.add(zinne);
  }
}
const BZ = BURG.z;
mauer(0, BZ - 20, 42, 2); mauer(-20, BZ, 2, 40); mauer(20, BZ, 2, 40);
mauer(-12, BZ + 20, 18, 2); mauer(12, BZ + 20, 18, 2);
for (const [x, z] of [[-20, BZ - 20], [20, BZ - 20], [-20, BZ + 20], [20, BZ + 20]]) {
  const turm = walze(3, 3, 12, 0x6e6e6e); turm.position.set(x, 6, z);
  const dach = kegel(3.6, 5, 0x4a148c, 12); dach.position.set(x, 14.5, z);
  szene.add(turm, dach);
  hindernis(x, z, 6, 6);
}
const tor = klotz(6, 7, 0.8, 0x4e342e);
tor.position.set(0, 3.5, BZ + 20);
szene.add(tor);
const torHindernis = hindernis(0, BZ + 20, 6, 2);
const mast = klotz(0.2, 6, 0.2, 0x444444); mast.position.set(0, 11, BZ - 20); szene.add(mast);
const fahne = klotz(2.5, 1.5, 0.1, 0x2e7d32); fahne.position.set(1.3, 13.2, BZ - 20); szene.add(fahne);
// Kobold-Zelte vor der Burg
for (const [x, z] of [[-18, BZ + 38], [16, BZ + 42], [-28, BZ + 30], [30, BZ + 30]]) {
  const zelt = kegel(3, 4, 0x558b2f, 6); zelt.position.set(x, 2, z); szene.add(zelt);
  kreise.push({ x, z, r: 2.6 });
}

// ---------- Königin Sisi im Käfig ----------
const sisi = new THREE.Group();
const kleid = kegel(1, 2.4, 0xff69b4, 16); kleid.position.y = 1.2;
const sisiKopf = kugel(0.45, 0xffd7b5); sisiKopf.position.y = 2.7;
const haare = kugel(0.5, 0x5d3a1a); haare.position.set(0, 2.8, -0.12);
const krone = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.35, 8, 1, true),
  new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide }));
krone.position.y = 3.25;
for (const s of [-1, 1]) { const auge = kugel(0.07, 0x000000); auge.position.set(s * 0.16, 2.75, 0.4); sisi.add(auge); }
sisi.add(kleid, haare, sisiKopf, krone);
sisi.position.set(0, 0, BZ - 5);
const sisiSchild = namensSchild('Königin Sisi 👑'); sisiSchild.position.y = 4; sisi.add(sisiSchild);
szene.add(sisi);

const kaefig = new THREE.Group();
for (let i = 0; i < 12; i++) {
  const w = (i / 12) * Math.PI * 2;
  const stab = klotz(0.15, 4.5, 0.15, 0x333333);
  stab.position.set(Math.cos(w) * 2, 2.25, Math.sin(w) * 2);
  kaefig.add(stab);
}
const kaefigDach = walze(2.2, 2.2, 0.3, 0x333333, 16); kaefigDach.position.y = 4.6; kaefig.add(kaefigDach);
kaefig.position.copy(sisi.position);
szene.add(kaefig);

// ---------- Großer Wald (viele Bäume auf einmal = "InstancedMesh", das ist schnell) ----------
const sperrZonen = [
  { x: DORF.x, z: DORF.z, r: 50 }, { x: HOF.x, z: HOF.z, r: 48 }, { x: SUMPF.x, z: SUMPF.z, r: 62 },
  { x: SEE.x, z: SEE.z, r: 78 }, { x: TAL.x, z: TAL.z, r: 128 }, { x: BURG.x, z: BURG.z, r: 62 },
  { x: 104, z: 52, r: 12 },
];
const baumOrte = [];
for (let i = 0; i < 2500 && baumOrte.length < 900; i++) {
  const x = (Math.random() * 2 - 1) * (WELT - 8), z = (Math.random() * 2 - 1) * (WELT - 8);
  if (sperrZonen.some(s => Math.hypot(x - s.x, z - s.z) < s.r)) continue;
  if (amWeg(x, z, 8)) continue;
  baumOrte.push([x, z, 0.8 + Math.random() * 0.6]);
}
const stammMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 6), mat(0x7a4b25), baumOrte.length);
const kroneMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(2, 5, 7), mat(0x2e7d32), baumOrte.length);
const hilfsObj = new THREE.Object3D();
baumOrte.forEach(([x, z, g], i) => {
  hilfsObj.scale.setScalar(g);
  hilfsObj.position.set(x, 1.5 * g, z); hilfsObj.updateMatrix(); stammMesh.setMatrixAt(i, hilfsObj.matrix);
  hilfsObj.position.set(x, 5 * g, z); hilfsObj.updateMatrix(); kroneMesh.setMatrixAt(i, hilfsObj.matrix);
  hindernis(x, z, 1.1 * g, 1.1 * g);
});
stammMesh.castShadow = kroneMesh.castShadow = true;
szene.add(stammMesh, kroneMesh);

// Ein paar Bäume auf der Insel
for (const [x, z] of [[SEE.x + 8, SEE.z - 8], [SEE.x - 6, SEE.z + 10], [SEE.x + 10, SEE.z + 6]]) {
  const st = walze(0.4, 0.5, 3, 0x7a4b25, 6); st.position.set(x, 1.5, z);
  const kr = kegel(2, 5, 0x2e7d32, 7); kr.position.set(x, 5, z);
  szene.add(st, kr); hindernis(x, z, 1.1, 1.1);
}

// =====================================================================
//  FIGUREN
// =====================================================================

// ---------- Ritter Roland ----------
const roland = new THREE.Group();
const figur = new THREE.Group(); // Rolands Körper – wird beim Reiten hochgehoben
roland.add(figur);
const silber = 0xc0c8d0;
{
  const koerper = klotz(1.2, 1.4, 0.7, silber); koerper.position.y = 1.9;
  const umhang = klotz(1.2, 1.8, 0.1, 0x1565c0); umhang.position.set(0, 1.7, -0.42);
  const kopf = kugel(0.5, silber); kopf.position.y = 3;
  const visier = klotz(0.6, 0.12, 0.1, 0x222222); visier.position.set(0, 3.05, 0.45);
  const feder = klotz(0.15, 0.6, 0.8, 0xe53935); feder.position.set(0, 3.6, -0.1);
  const schild = klotz(0.15, 1.3, 1, 0x1565c0); schild.position.set(-0.85, 1.9, 0.2);
  const wappen = klotz(0.05, 0.6, 0.3, 0xffd700); wappen.position.set(-0.94, 1.95, 0.2);
  figur.add(koerper, umhang, kopf, visier, feder, schild, wappen);
}
const beine = [];
for (const s of [-1, 1]) {
  const huefte = new THREE.Group(); huefte.position.set(s * 0.32, 1.2, 0);
  const bein = klotz(0.45, 1.2, 0.5, 0x8899aa); bein.position.y = -0.6;
  huefte.add(bein); figur.add(huefte); beine.push(huefte);
}
const schulter = new THREE.Group(); schulter.position.set(0.8, 2.4, 0);
{
  const arm = klotz(0.35, 1, 0.35, silber); arm.position.y = -0.5;
  const klinge = klotz(0.12, 0.12, 2, 0xeeeeee); klinge.position.set(0, -1, 1);
  klinge.material.metalness = 0.9; klinge.material.roughness = 0.2;
  const griff = klotz(0.6, 0.15, 0.15, 0xffd700); griff.position.set(0, -1, 0.05);
  schulter.add(arm, klinge, griff);
}
figur.add(schulter);
const START = new THREE.Vector3(0, 0, 180);
roland.position.copy(START);
szene.add(roland);

// ---------- Das Pferd ----------
const pferd = new THREE.Group();
const braun = 0x8d5524, dunkel = 0x3e2410;
const pRumpf = klotz(1.2, 1.1, 2.8, braun); pRumpf.position.y = 1.9;
const sattel = klotz(1.3, 0.25, 1, 0xc62828); sattel.position.set(0, 2.55, -0.1);
const decke = klotz(1.35, 0.8, 1.2, 0x1565c0); decke.position.set(0, 2.1, -0.1);
const hals = klotz(0.6, 1.4, 0.7, braun); hals.position.set(0, 2.7, 1.3); hals.rotation.x = 0.5;
const pKopf = klotz(0.55, 0.6, 1.2, braun); pKopf.position.set(0, 3.3, 1.9);
const maul = klotz(0.5, 0.45, 0.3, dunkel); maul.position.set(0, 3.2, 2.5);
const maehne = klotz(0.15, 1.4, 0.4, dunkel); maehne.position.set(0, 2.95, 1.05); maehne.rotation.x = 0.5;
for (const sx of [-1, 1]) {
  const ohr = klotz(0.12, 0.35, 0.12, braun); ohr.position.set(sx * 0.18, 3.75, 1.6); pferd.add(ohr);
  const auge = kugel(0.08, 0x000000); auge.position.set(sx * 0.29, 3.4, 2.1); pferd.add(auge);
}
const schweif = klotz(0.2, 1.3, 0.25, dunkel); schweif.position.set(0, 1.6, -1.55); schweif.rotation.x = -0.3;
pferd.add(pRumpf, decke, sattel, hals, pKopf, maul, maehne, schweif);
const pferdeBeine = [];
for (const [bx, bz] of [[-0.4, 1], [0.4, 1], [-0.4, -1], [0.4, -1]]) {
  const gelenk = new THREE.Group(); gelenk.position.set(bx, 1.4, bz);
  const bein = klotz(0.3, 1.2, 0.3, braun); bein.position.y = -0.6;
  const huf = klotz(0.34, 0.25, 0.36, dunkel); huf.position.y = -1.27;
  gelenk.add(bein, huf); pferd.add(gelenk); pferdeBeine.push(gelenk);
}
function pferdInDenStall() {
  pferd.position.set(STALL.x - 1, 0, STALL.z);
  pferd.rotation.y = -Math.PI / 2;
}
pferdInDenStall();
szene.add(pferd);

// ---------- Leute (NPCs) ----------
function mensch(o) {
  const g = new THREE.Group();
  const leib = walze(0.45, 0.7, 1.8, o.kleid); leib.position.y = 0.9;
  const kopf = kugel(0.45, 0xffd7b5); kopf.position.y = 2.2;
  g.add(leib, kopf);
  for (const s of [-1, 1]) {
    const auge = kugel(0.07, 0x000000); auge.position.set(s * 0.16, 2.28, 0.4); g.add(auge);
    const arm = klotz(0.25, 1, 0.25, o.kleid); arm.position.set(s * 0.62, 1.4, 0); arm.rotation.z = s * 0.2; g.add(arm);
  }
  if (o.haare) { const h = kugel(0.48, o.haare); h.position.set(0, 2.3, -0.1); g.add(h); }
  if (o.bart) { const b = kegel(0.35, 0.9, o.bart); b.rotation.x = Math.PI; b.position.set(0, 1.75, 0.3); g.add(b); }
  if (o.hut === 'spitz') {
    const k = kegel(0.6, 1.5, o.hutFarbe); k.position.y = 3.1; k.rotation.z = 0.15;
    const krempe = walze(1, 1, 0.08, o.hutFarbe, 16); krempe.position.y = 2.5; g.add(k, krempe);
  } else if (o.hut === 'zylinder') {
    const z = walze(0.38, 0.38, 0.8, o.hutFarbe); z.position.y = 2.95;
    const krempe = walze(0.65, 0.65, 0.06, o.hutFarbe, 16); krempe.position.y = 2.58; g.add(z, krempe);
  } else if (o.hut === 'stroh') {
    const krempe = walze(0.95, 0.95, 0.08, o.hutFarbe, 16); krempe.position.y = 2.6;
    const oben = walze(0.42, 0.45, 0.35, o.hutFarbe); oben.position.y = 2.8; g.add(krempe, oben);
  } else if (o.hut === 'zipfel') {
    const k = kegel(0.45, 1.1, o.hutFarbe); k.position.y = 2.95; k.rotation.x = -0.3; g.add(k);
  }
  if (o.kette) { const k = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 16), mat(0xffd700)); k.rotation.x = Math.PI / 2.4; k.position.set(0, 1.65, 0.1); g.add(k); }
  return g;
}
const npcs = {};
function neuerNPC(id, name, x, z, aussehen, sonst, groesse = 1) {
  const m = mensch(aussehen);
  m.scale.setScalar(groesse);
  m.position.set(x, 0, z);
  const schild = namensSchild(name); schild.position.y = 3.9; schild.scale.multiplyScalar(1 / groesse);
  m.add(schild);
  szene.add(m);
  hindernis(x, z, 1.2, 1.2);
  npcs[id] = { name, mesh: m, pos: m.position, sonst, zuletzt: -99 };
}
neuerNPC('bert', 'Bürgermeister Bert', 7, 192, { kleid: 0xc62828, hut: 'zylinder', hutFarbe: 0x222222, kette: true, bart: 0x9e9e9e },
  'Wenn du verletzt bist, trink vom Brunnen! 💧');
neuerNPC('hans', 'Bauer Hans', -112, 152, { kleid: 0x2e7d32, hut: 'stroh', hutFarbe: 0xe6c35c, haare: 0x8d5524 },
  'Mein Korn wächst und gedeiht! 🌾');
neuerNPC('hilda', 'Hexe Hilda', -203, 3, { kleid: 0x4a148c, hut: 'spitz', hutFarbe: 0x311b92, haare: 0x9e9e9e },
  'Hihihi! Blubber, blubber … 🧪');
neuerNPC('fritz', 'Fischer Fritz', 114, 38, { kleid: 0x1565c0, hut: 'stroh', hutFarbe: 0xffeb3b, bart: 0x6d4c41 },
  'Ahoi! Schönes Wetter zum Angeln! 🎣');
neuerNPC('zwerg', 'Zwerg Zacharias', ZWERG.x, ZWERG.z, { kleid: 0x795548, hut: 'zipfel', hutFarbe: 0xc62828, bart: 0xffffff },
  'Graben, graben, graben … ⛏️', 0.7);

// ---------- Kobolde ----------
const kobolde = [];
function neuerKobold(x, z, o = {}) {
  const groesse = o.groesse || 1;
  // Einen freien Platz suchen (nicht in einem Baum oder im Wasser)
  for (let i = 0; i < 20 && stoesst(x, z, 0.6 * groesse); i++) {
    x += (Math.random() - 0.5) * 8; z += (Math.random() - 0.5) * 8;
  }
  const g = new THREE.Group();
  const leib = klotz(0.9, 1, 0.6, 0x4caf50); leib.position.y = 1;
  const k = kugel(0.45, 0x66bb6a); k.position.y = 1.9;
  for (const s of [-1, 1]) {
    const ohr = kegel(0.15, 0.6, 0x66bb6a, 6); ohr.rotation.z = -s * Math.PI / 2; ohr.position.set(s * 0.6, 2, 0); g.add(ohr);
    const auge = kugel(0.09, 0xff0000); auge.position.set(s * 0.17, 2, 0.4); auge.material.emissive = new THREE.Color(0xaa0000); g.add(auge);
    const fuss = klotz(0.3, 0.5, 0.4, 0x2e7d32); fuss.position.set(s * 0.25, 0.25, 0); g.add(fuss);
  }
  const keule = klotz(0.25, 1.3, 0.25, 0x6d4c2f); keule.position.set(0.6, 1.2, 0.3); keule.rotation.x = 0.6;
  g.add(leib, k, keule);
  if (o.hauptmann) {
    const helm = kegel(0.5, 0.7, 0x757575); helm.position.y = 2.5;
    const anhaenger = klotz(0.25, 0.35, 0.1, 0xffd700); anhaenger.position.set(0, 1.2, 0.36);
    anhaenger.material.emissive = new THREE.Color(0x664400);
    g.add(helm, anhaenger);
  }
  g.scale.setScalar(groesse);
  g.position.set(x, 0, z);
  szene.add(g);
  const kobold = {
    mesh: g, start: new THREE.Vector3(x, 0, z), lebt: true, umfallen: 0, zufallsWinkel: Math.random() * 6,
    schlagPause: 0, trampelPause: 0, blink: 0, hp: o.hp || 1, maxHp: o.hp || 1, groesse,
    jagdRadius: o.jagd || 16, tempo: o.tempo || 5, beiTod: o.beiTod,
  };
  kobolde.push(kobold);
  return kobold;
}
// Feld-Kobolde (für Bauer Hans)
const feldKobolde = [];
for (let i = 0; i < 5; i++) feldKobolde.push(neuerKobold(HOF.x - 20 + i * 8, HOF.z + 5 + (i % 2) * 10, { jagd: 14 }));
// Sumpf
for (let i = 0; i < 4; i++) neuerKobold(SUMPF.x + (Math.random() - 0.5) * 70, SUMPF.z + (Math.random() - 0.5) * 70);
// Insel: Hauptmann und seine Wachen
let hauptmannSchluessel = null;
const hauptmann = neuerKobold(SEE.x + 2, SEE.z, {
  hauptmann: true, groesse: 1.8, hp: 6, jagd: 18, tempo: 4,
  beiTod: k => { hauptmannSchluessel = neuerSchluessel(k.mesh.position.x, k.mesh.position.z); nachricht('Der Hauptmann hat seinen Schlüssel verloren! 🔑'); },
});
for (let i = 0; i < 3; i++) neuerKobold(SEE.x + (Math.random() - 0.5) * 20, SEE.z + (Math.random() - 0.5) * 20);
// Am Weg zu den Bergen
for (let i = 0; i < 3; i++) neuerKobold(-40 - i * 22, -80 - i * 15);
// Lager vor der Burg und in der Burg
for (let i = 0; i < 7; i++) neuerKobold(BURG.x - 25 + i * 8, BZ + 32 + (i % 3) * 5);
for (const [x, z] of [[-8, BZ + 5], [8, BZ + 5], [0, BZ + 10], [-10, BZ - 10], [10, BZ - 10]]) neuerKobold(x, z);
// Wanderer im Großen Wald
for (let n = 0; n < 30; n++) {
  const x = (Math.random() * 2 - 1) * 270, z = (Math.random() * 2 - 1) * 270;
  if (Math.hypot(x - DORF.x, z - DORF.z) < 70 || sperrZonen.some(s => Math.hypot(x - s.x, z - s.z) < s.r)) continue;
  neuerKobold(x, z);
}

// ---------- Der Drache ----------
const drache = { lebt: true, hp: 12, maxHp: 12, schussPause: 3, beissPause: 0, blink: 0, umfallen: 0, aktiv: false };
{
  const g = new THREE.Group();
  const rot = 0xb71c1c, bauchFarbe = 0xffb74d;
  const koerper = klotz(3, 2.5, 6, rot); koerper.position.y = 3;
  const bauch = klotz(2.4, 1, 5, bauchFarbe); bauch.position.y = 1.9;
  const nacken = klotz(1.2, 1.2, 3.2, rot); nacken.position.set(0, 5, 3.6); nacken.rotation.x = -0.7;
  const kopf = new THREE.Group(); kopf.position.set(0, 6.3, 5.4);
  const schaedel = klotz(1.8, 1.3, 2.6, rot);
  const kiefer = klotz(1.5, 0.4, 2.2, bauchFarbe); kiefer.position.set(0, -0.8, 0.2);
  kopf.add(schaedel, kiefer);
  for (const s of [-1, 1]) {
    const horn = kegel(0.25, 1.2, 0xfff3e0, 6); horn.position.set(s * 0.6, 1, -0.8); horn.rotation.x = -0.6; kopf.add(horn);
    const auge = kugel(0.2, 0xffeb3b); auge.material.emissive = new THREE.Color(0xffaa00); auge.position.set(s * 0.6, 0.3, 1); kopf.add(auge);
    const bein = klotz(0.9, 2, 0.9, rot); bein.position.set(s * 1.2, 1, 1.8); g.add(bein);
    const bein2 = klotz(0.9, 2, 0.9, rot); bein2.position.set(s * 1.2, 1, -1.8); g.add(bein2);
  }
  const fluegel = [];
  for (const s of [-1, 1]) {
    const gelenk = new THREE.Group(); gelenk.position.set(s * 1.4, 4.2, 0.5);
    const f = klotz(6, 0.15, 3.5, 0x7f0000); f.position.x = s * 3;
    gelenk.add(f); g.add(gelenk); fluegel.push(gelenk);
  }
  const schwanz = klotz(1, 1, 6, rot); schwanz.position.set(0, 2.4, -5.5); schwanz.rotation.x = 0.15;
  const spitze = kegel(0.7, 1.5, rot, 4); spitze.position.set(0, 1.8, -8.8); spitze.rotation.x = -Math.PI / 2;
  g.add(koerper, bauch, nacken, kopf, schwanz, spitze);
  g.scale.setScalar(1.2);
  g.position.set(TAL.x, 0, TAL.z);
  szene.add(g);
  Object.assign(drache, { mesh: g, kopf, kiefer, fluegel, start: g.position.clone() });
}
const feuerbaelle = [];
const feuerGeo = new THREE.SphereGeometry(0.8, 12, 10);
const feuerMat = new THREE.MeshBasicMaterial({ color: 0xff6d00 });

// ---------- Schlüssel ----------
const schluessel = [];
function neuerSchluessel(x, z) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.25, emissive: 0x664400 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 8, 16), gold); ring.position.y = 0.9;
  const schaft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), gold); schaft.position.y = -0.2;
  const bart = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.2), gold); bart.position.set(0.25, -0.7, 0);
  g.add(ring, schaft, bart);
  g.position.set(x, 1.8, z);
  g.add(new THREE.PointLight(0xffd700, 2, 8));
  szene.add(g);
  const s = { mesh: g, gefunden: false };
  schluessel.push(s);
  return s;
}

// ---------- Zauberpilze ----------
const pilze = PILZ_ORTE.map(([x, z]) => {
  const g = new THREE.Group();
  const stiel = walze(0.25, 0.3, 0.8, 0xfff8e1); stiel.position.y = 0.4;
  const hut = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe53935, emissive: 0x550000 }));
  hut.position.y = 0.75; hut.castShadow = true;
  g.add(stiel, hut);
  for (let i = 0; i < 5; i++) {
    const p = kugel(0.1, 0xffffff); const w = i * 1.25;
    p.position.set(Math.cos(w) * 0.45, 1.15, Math.sin(w) * 0.45); g.add(p);
  }
  g.add(new THREE.PointLight(0xff5252, 1.5, 6));
  g.position.set(x, 0, z);
  g.scale.setScalar(1.3);
  szene.add(g);
  return { mesh: g, gefunden: false };
});

// ---------- Wegweiser: Lichtstrahl und Pfeil ----------
const strahl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 140, 16, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.35, depthWrite: false, fog: false, side: THREE.DoubleSide }));
szene.add(strahl);
const pfeil = new THREE.Group();
const pfeilSpitze = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 8),
  new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600 }));
pfeilSpitze.rotation.x = Math.PI / 2; // Spitze zeigt nach vorne (+z)
pfeil.add(pfeilSpitze);
szene.add(pfeil);

// =====================================================================
//  TÖNE
// =====================================================================
let audio;
function ton(freq, dauer, typ = 'square', lautstaerke = 0.1, freqEnde) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = typ; o.frequency.setValueAtTime(freq, audio.currentTime);
  if (freqEnde) o.frequency.exponentialRampToValueAtTime(freqEnde, audio.currentTime + dauer);
  g.gain.setValueAtTime(lautstaerke, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dauer);
  o.connect(g).connect(audio.destination);
  o.start(); o.stop(audio.currentTime + dauer);
}
const melodie = (noten, abstand = 140, typ = 'sine') => noten.forEach((f, i) => setTimeout(() => ton(f, 0.3, typ, 0.15), i * abstand));
const sounds = {
  schwung: () => ton(600, 0.15, 'sawtooth', 0.05, 150),
  treffer: () => ton(200, 0.25, 'square', 0.1, 60),
  autsch: () => ton(150, 0.4, 'triangle', 0.2, 80),
  schluessel: () => melodie([880, 1320]),
  pilz: () => melodie([660, 990], 90),
  heilen: () => melodie([523, 659, 784], 100),
  auftrag: () => melodie([523, 784, 1047], 150, 'triangle'),
  reden: () => ton(400 + Math.random() * 200, 0.08, 'triangle', 0.08),
  wiehern: () => ton(700, 0.6, 'sawtooth', 0.08, 300),
  trampel: () => ton(120, 0.3, 'square', 0.15, 50),
  feuer: () => ton(300, 0.6, 'sawtooth', 0.12, 60),
  brüllen: () => ton(90, 1, 'sawtooth', 0.2, 40),
  tor: () => ton(80, 1.5, 'sawtooth', 0.1, 40),
  sieg: () => melodie([523, 659, 784, 1047, 784, 1047], 180),
};

// =====================================================================
//  STEUERUNG
// =====================================================================
const tasten = {};
const tastenNamen = { KeyW: 'vor', ArrowUp: 'vor', KeyS: 'zurueck', ArrowDown: 'zurueck',
  KeyA: 'links', ArrowLeft: 'links', KeyD: 'rechts', ArrowRight: 'rechts', Space: 'schlag', KeyE: 'pferd' };
addEventListener('keydown', e => {
  if (dialog.offen) {
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) dialogWeiter();
    e.preventDefault();
    return;
  }
  if (tastenNamen[e.code]) { tasten[tastenNamen[e.code]] = true; e.preventDefault(); }
});
addEventListener('keyup', e => { if (tastenNamen[e.code]) tasten[tastenNamen[e.code]] = false; });
document.querySelectorAll('#touch button').forEach(b => {
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (dialog.offen) { dialogWeiter(); return; }
    tasten[b.dataset.taste] = true;
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => tasten[b.dataset.taste] = false);
});

// =====================================================================
//  SPIELZUSTAND
// =====================================================================
let leben = 5;
const MAX_LEBEN = 5;
let gefunden = 0;       // goldene Schlüssel
let pilzAnzahl = 0;
let unverwundbar = 0;
let schlagZeit = 0;
let schlagGetroffen = false;
let laeuft = false;
let gewonnen = false;
let siegZeit = 0;
let besiegt = 0;
let reitet = false;
let pferdTasteVorher = false;
let pferdHinweis = false;
let torOffen = false;
let torHoch = 0;
let startZeit = 0;
let aktuellesGebiet = '';
let heilPause = 0;

// ---------- Anzeigen ----------
const hud = document.getElementById('hud');
const auftragEl = document.getElementById('auftrag');
let hudAlt = '';
function hudZeigen() {
  let text = '❤️'.repeat(Math.max(0, leben)) + '🖤'.repeat(MAX_LEBEN - Math.max(0, leben)) +
    '\n🔑 ' + gefunden + '/3   👺 ' + besiegt + (pilzAnzahl > 0 && pilzAnzahl < 5 ? '   🍄 ' + pilzAnzahl + '/5' : '');
  if (drache.lebt && drache.aktiv) text += '\n🐉 ' + '🟥'.repeat(drache.hp) + '⬛'.repeat(drache.maxHp - drache.hp);
  else if (hauptmann.lebt && roland.position.distanceTo(hauptmann.mesh.position) < 28)
    text += '\n👹 ' + '🟥'.repeat(hauptmann.hp) + '⬛'.repeat(hauptmann.maxHp - hauptmann.hp);
  if (text !== hudAlt) { hud.textContent = text; hudAlt = text; }
  auftragEl.style.top = (text.split('\n').length * 30 + 22) + 'px';
}

const nachrichtEl = document.getElementById('nachricht');
let nachrichtTimer;
function nachricht(text, dauer = 3000) {
  nachrichtEl.textContent = text;
  nachrichtEl.style.opacity = 1;
  clearTimeout(nachrichtTimer);
  nachrichtTimer = setTimeout(() => nachrichtEl.style.opacity = 0, dauer);
}

// ---------- Dialoge (Gespräche mit den Leuten) ----------
const dialog = { offen: false, zeilen: [], nr: 0, danach: null };
const dialogEl = document.getElementById('dialog');
function dialogOeffnen(name, zeilen, danach) {
  Object.assign(dialog, { offen: true, zeilen, nr: 0, danach });
  for (const k in tasten) tasten[k] = false;
  document.getElementById('dialogName').textContent = name;
  document.getElementById('dialogText').textContent = zeilen[0];
  dialogEl.classList.remove('versteckt');
  sounds.reden();
}
function dialogWeiter() {
  dialog.nr++;
  if (dialog.nr < dialog.zeilen.length) {
    document.getElementById('dialogText').textContent = dialog.zeilen[dialog.nr];
    sounds.reden();
  } else {
    dialog.offen = false;
    dialogEl.classList.add('versteckt');
    if (dialog.danach) dialog.danach();
  }
}
dialogEl.addEventListener('click', dialogWeiter);

// =====================================================================
//  DIE AUFTRÄGE 📜
// =====================================================================
const anzahlTot = liste => liste.filter(k => !k.lebt).length;
const auftraege = [
  {
    titel: 'Sprich mit <b>Bürgermeister Bert</b> am Dorfbrunnen.', npc: 'bert',
    text: [
      'Ritter Roland! Gut, dass du da bist!',
      'Der böse Koboldkönig hat Königin Sisi entführt und in seine Burg im hohen Norden gesperrt! 😱',
      'Das Burgtor hat drei Schlösser. Du brauchst drei goldene Schlüssel 🔑🔑🔑.',
      'Das Königreich ist riesig – hol dir zuerst dein Pferd aus dem Stall! 🐴',
    ],
  },
  {
    titel: 'Hol dein <b>Pferd</b> aus dem Stall und steig auf (Taste E).',
    ort: () => reitet ? null : pferd.position,
    fertig: () => reitet,
  },
  {
    titel: 'Reite zum Hof von <b>Bauer Hans</b> im Westen.', npc: 'hans',
    text: [
      'Hilfe, Herr Ritter! Kobolde trampeln mein ganzes Korn platt! 🌾',
      'Bitte verjag die 5 Kobolde von meinem Feld!',
      'Tipp: Mit dem Pferd kannst du sie einfach umreiten! 🐴💨',
    ],
  },
  {
    titel: () => 'Verjage die Kobolde vom Feld: <b>' + anzahlTot(feldKobolde) + '/5</b> 👺',
    ort: () => feldKobolde.find(k => k.lebt)?.mesh.position,
    fertig: () => anzahlTot(feldKobolde) >= 5,
  },
  {
    titel: 'Erzähl <b>Bauer Hans</b>, dass sein Feld sicher ist.', npc: 'hans',
    text: [
      'Juhu, mein Feld ist gerettet! Danke, Ritter Roland! 🥳',
      'Hier, iss einen Apfel – der macht dich wieder gesund! 🍎',
      'Die Hexe Hilda im Sumpf hat einen der goldenen Schlüssel. Frag sie doch mal!',
    ],
    belohnung: () => { leben = MAX_LEBEN; sounds.heilen(); },
  },
  {
    titel: 'Besuche <b>Hexe Hilda</b> im Hexensumpf.', npc: 'hilda',
    text: [
      'Hihihi! Ein Ritter in meinem Sumpf! 🧙‍♀️',
      'Einen goldenen Schlüssel willst du? Den bekommst du nicht umsonst!',
      'Bring mir 5 leuchtende Zauberpilze 🍄 aus dem Sumpf, dann gehört er dir.',
    ],
  },
  {
    titel: () => 'Sammle Zauberpilze im Sumpf: <b>' + pilzAnzahl + '/5</b> 🍄',
    ort: () => naechsterPilz()?.mesh.position,
    fertig: () => pilzAnzahl >= 5,
  },
  {
    titel: 'Bring die Pilze zu <b>Hexe Hilda</b>.', npc: 'hilda',
    text: [
      'Oh, wie schön sie leuchten! Daraus koche ich eine Zaubersuppe! 🍲',
      'Hier ist dein erster goldener Schlüssel 🔑. Hihihi!',
      'Den zweiten Schlüssel hat der Kobold-Hauptmann. Fischer Fritz am See im Osten weiß mehr.',
    ],
    belohnung: () => { gefunden++; sounds.schluessel(); },
  },
  {
    titel: 'Besuche <b>Fischer Fritz</b> am Glitzersee im Osten.', npc: 'fritz',
    text: [
      'Ahoi, Ritter! 🎣',
      'Ein riesiger Kobold-Hauptmann wohnt jetzt auf der Insel im See. Seitdem beißt kein Fisch mehr an!',
      'Er trägt einen goldenen Schlüssel um den Hals. Geh über die Brücke und besiege ihn!',
      'Aber Vorsicht: Er ist stark. Du musst ihn oft treffen!',
    ],
  },
  {
    titel: 'Besiege den <b>Kobold-Hauptmann</b> auf der Insel und hol dir seinen Schlüssel! 🔑',
    ort: () => hauptmann.lebt ? hauptmann.mesh.position : hauptmannSchluessel?.mesh.position,
    fertig: () => gefunden >= 2,
  },
  {
    titel: 'Reite zu <b>Zwerg Zacharias</b> in den Drachenbergen im Nordwesten.', npc: 'zwerg',
    text: [
      'Wer stört mich beim Graben? ⛏️ Ach, ein Ritter!',
      'Im Tal hinter mir wohnt ein feuerspeiender Drache! 🐉 Er bewacht den letzten goldenen Schlüssel.',
      'Pass auf seine Feuerbälle auf! Lauf zur Seite, damit sie dich nicht treffen.',
      'Und wenn du nah dran bist: Hau ihm mit dem Schwert auf die Nase! Viel Glück!',
    ],
  },
  {
    titel: 'Besiege den <b>Drachen</b> im Drachental und hol den Schlüssel! 🐉',
    ort: () => drache.lebt ? drache.mesh.position : schluessel.find(s => !s.gefunden)?.mesh.position,
    fertig: () => gefunden >= 3,
  },
  {
    titel: 'Reite zur <b>Koboldburg</b> im Norden und öffne das Tor! 🏰',
    ort: () => tor.position,
    fertig: () => torOffen,
  },
  {
    titel: 'Befreie <b>Königin Sisi</b>! 👑',
    ort: () => sisi.position,
    fertig: () => gewonnen,
  },
];
let schritt = 0;

let auftragAlt = '';
function auftragZeigen() {
  const a = auftraege[schritt];
  const html = a ? '📜 ' + (typeof a.titel === 'function' ? a.titel() : a.titel) : '🎉 Alle Aufträge geschafft!';
  if (html !== auftragAlt) { auftragEl.innerHTML = html; auftragAlt = html; }
}
function naechsterAuftrag() {
  const a = auftraege[schritt];
  if (a.belohnung) a.belohnung();
  schritt++;
  if (schritt < auftraege.length) {
    sounds.auftrag();
    nachricht('📜 Neuer Auftrag!');
  }
  auftragZeigen();
}
function auftragsZiel() {
  const a = auftraege[schritt];
  if (!a) return null;
  if (a.npc) return npcs[a.npc].pos;
  return a.ort ? a.ort() : null;
}
function naechsterPilz() {
  let best = null, bestD = Infinity;
  for (const p of pilze) {
    if (p.gefunden) continue;
    const d = p.mesh.position.distanceTo(roland.position);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// =====================================================================
//  AKTIONEN
// =====================================================================
function aufAbsteigen() {
  if (!reitet) {
    if (roland.position.distanceTo(pferd.position) > 4) return;
    reitet = true;
    roland.position.x = pferd.position.x; roland.position.z = pferd.position.z;
    roland.rotation.y = pferd.rotation.y;
    pferd.position.set(0, 0, 0); pferd.rotation.y = 0;
    roland.add(pferd);
    figur.position.y = 1.3;
    beine[0].rotation.set(-0.3, 0, -0.5); beine[1].rotation.set(-0.3, 0, 0.5);
    sounds.wiehern();
    nachricht('Hü-hott! 🐴 (E zum Absteigen)');
  } else {
    reitet = false;
    roland.remove(pferd);
    pferd.position.set(roland.position.x, 0, roland.position.z);
    pferd.rotation.y = roland.rotation.y;
    szene.add(pferd);
    figur.position.y = 0;
    roland.position.y = 0;
    beine[0].rotation.set(0, 0, 0); beine[1].rotation.set(0, 0, 0);
    const seite = roland.rotation.y + Math.PI / 2;
    bewegen(roland, Math.sin(seite) * 2.2, Math.cos(seite) * 2.2, 0.7);
  }
}

function schaden() {
  if (unverwundbar > 0 || !laeuft) return;
  leben--;
  unverwundbar = 1.2;
  sounds.autsch();
  if (leben <= 0) ohnmacht();
}

// Wenn alle Herzen weg sind, wacht Roland im Dorf wieder auf
function ohnmacht() {
  if (reitet) aufAbsteigen();
  pferdInDenStall();
  roland.position.copy(START);
  roland.rotation.y = 0;
  kamera.position.set(START.x, 6, START.z - 10);
  leben = MAX_LEBEN;
  unverwundbar = 2;
  if (drache.lebt) { drache.hp = drache.maxHp; drache.mesh.position.copy(drache.start); }
  for (const f of feuerbaelle) szene.remove(f.mesh);
  feuerbaelle.length = 0;
  nachricht('💫 Roland ist umgekippt … und wacht im Dorf wieder auf!', 4000);
}

function koboldTreffen(k, richtung) {
  k.hp--;
  sounds.treffer();
  if (k.hp <= 0) {
    k.lebt = false;
    besiegt++;
    if (k.beiTod) k.beiTod(k);
  } else {
    k.blink = 0.3;
    bewegen(k.mesh, richtung.x * 3, richtung.z * 3, 0.5 * k.groesse);
  }
}

function ende() {
  laeuft = false;
  const minuten = Math.round((performance.now() - startZeit) / 60000);
  setTimeout(() => {
    document.getElementById('endeTitel').textContent = '🎉 Gewonnen! 🎉';
    document.getElementById('endeText').innerHTML =
      'Königin Sisi ist frei! 👑<br>„Danke, tapferer Ritter Roland! Du bist der Held des Königreichs!“<br><br>' +
      '👺 Besiegte Kobolde: ' + besiegt + '<br>⏱️ Spielzeit: ' + minuten + ' Minuten';
    document.getElementById('ende').classList.remove('versteckt');
  }, 3500);
}

document.getElementById('startKnopf').onclick = () => {
  audio = new (window.AudioContext || window.webkitAudioContext)();
  document.getElementById('start').classList.add('versteckt');
  laeuft = true;
  startZeit = performance.now();
  nachricht('🏘️ Dorf Rolandsheim');
};

// =====================================================================
//  MINI-KARTE 🗺️
// =====================================================================
const karte = document.getElementById('karte');
const kctx = karte.getContext('2d');
const KG = karte.width;
const aufKarte = (x, z) => [(x + WELT) / (2 * WELT) * KG, (z + WELT) / (2 * WELT) * KG];
const kartenBild = document.createElement('canvas');
kartenBild.width = kartenBild.height = KG;
{
  const c = kartenBild.getContext('2d');
  const s = KG / (2 * WELT);
  const kreis = (x, z, r, farbe) => { const [px, pz] = aufKarte(x, z); c.fillStyle = farbe; c.beginPath(); c.arc(px, pz, r * s, 0, Math.PI * 2); c.fill(); };
  c.fillStyle = '#3f7f2a'; c.fillRect(0, 0, KG, KG);
  c.strokeStyle = '#c8a165'; c.lineWidth = 2.5;
  for (const [x1, z1, x2, z2] of wege) { c.beginPath(); c.moveTo(...aufKarte(x1, z1)); c.lineTo(...aufKarte(x2, z2)); c.stroke(); }
  kreis(DORF.x, DORF.z, 30, '#a5d66f');
  kreis(SUMPF.x, SUMPF.z, 58, '#4b5320');
  kreis(SEE.x, SEE.z, SEE.r, '#2a7fd4'); kreis(SEE.x, SEE.z, SEE.insel, '#66bb44');
  c.fillStyle = '#e6c35c'; { const [fx, fz] = aufKarte(HOF.x - 27, HOF.z - 7); c.fillRect(fx, fz, 44 * s, 34 * s); }
  for (const k of kreise) if (k.r > 5) kreis(k.x, k.z, k.r, '#8a8a8a');
  kreis(TAL.x, TAL.z, 46, '#8d7b68');
  c.fillStyle = '#555'; { const [bx, bz] = aufKarte(BURG.x - 20, BURG.z - 20); c.fillRect(bx, bz, 40 * s, 40 * s); }
  c.font = '15px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const [e, x, z] of [['🏘️', DORF.x, DORF.z], ['🌾', HOF.x, HOF.z], ['🧙‍♀️', SUMPF.x, SUMPF.z], ['🎣', 110, 45],
    ['🐉', TAL.x, TAL.z], ['⛏️', ZWERG.x, ZWERG.z], ['🏰', BURG.x, BURG.z]]) c.fillText(e, ...aufKarte(x, z));
}
function karteZeichnen(zeit) {
  kctx.drawImage(kartenBild, 0, 0);
  // Pilze zeigen, wenn wir sie suchen
  if (schritt === 6) {
    kctx.fillStyle = '#ff5252';
    for (const p of pilze) if (!p.gefunden) { const [x, z] = aufKarte(p.mesh.position.x, p.mesh.position.z); kctx.beginPath(); kctx.arc(x, z, 3, 0, 7); kctx.fill(); }
  }
  // Pferd (wenn es irgendwo wartet)
  kctx.textAlign = 'center'; kctx.textBaseline = 'middle';
  if (!reitet) { const [x, z] = aufKarte(pferd.position.x, pferd.position.z); kctx.font = '12px system-ui'; kctx.fillText('🐴', x, z); }
  // Ziel des Auftrags (blinkender Stern)
  const ziel = auftragsZiel();
  if (ziel) {
    const [x, z] = aufKarte(ziel.x, ziel.z);
    kctx.font = (16 + Math.sin(zeit * 6) * 3) + 'px system-ui'; kctx.textAlign = 'center'; kctx.textBaseline = 'middle';
    kctx.fillText('⭐', x, z);
  }
  // Roland als Pfeil
  const [rx, rz] = aufKarte(roland.position.x, roland.position.z);
  const w = roland.rotation.y;
  kctx.save();
  kctx.translate(rx, rz);
  kctx.rotate(-w);
  kctx.fillStyle = '#fff'; kctx.strokeStyle = '#000'; kctx.lineWidth = 1.5;
  kctx.beginPath(); kctx.moveTo(0, 7); kctx.lineTo(-5, -5); kctx.lineTo(5, -5); kctx.closePath();
  kctx.fill(); kctx.stroke();
  kctx.restore();
}

// =====================================================================
//  SPIELSCHLEIFE
// =====================================================================
const uhr = new THREE.Clock();
let laufPhase = 0;
const kameraZiel = new THREE.Vector3();
const tmp = new THREE.Vector3();

function spielLogik(dt, zeit) {
  // --- Pferd: auf- und absteigen ---
  if (tasten.pferd && !pferdTasteVorher) aufAbsteigen();
  pferdTasteVorher = !!tasten.pferd;
  if (!reitet && !pferdHinweis && roland.position.distanceTo(pferd.position) < 4) {
    pferdHinweis = true;
    nachricht('Drücke E (oder 🐴), um aufs Pferd zu steigen!');
  }

  // --- Roland bewegen ---
  const drehTempo = reitet ? 2.4 : 2.8, laufTempo = reitet ? 20 : 9;
  if (tasten.links) roland.rotation.y += drehTempo * dt;
  if (tasten.rechts) roland.rotation.y -= drehTempo * dt;
  let vor = 0;
  if (tasten.vor) vor = 1;
  if (tasten.zurueck) vor = -0.6;
  const dx = Math.sin(roland.rotation.y) * vor * laufTempo * dt;
  const dz = Math.cos(roland.rotation.y) * vor * laufTempo * dt;
  bewegen(roland, dx, dz, reitet ? 1.3 : 0.7);

  // Nicht durch den Drachen hindurchlaufen
  if (drache.lebt) {
    tmp.subVectors(roland.position, drache.mesh.position); tmp.y = 0;
    if (tmp.length() < 5) { tmp.setLength(5 - tmp.length()); bewegen(roland, tmp.x, tmp.z, 0.7); }
  }

  if (vor !== 0) laufPhase += dt * (reitet ? 14 : 10); else laufPhase *= 0.8;
  if (reitet) {
    pferdeBeine[0].rotation.x = Math.sin(laufPhase) * 0.7;
    pferdeBeine[1].rotation.x = Math.sin(laufPhase + 0.5) * 0.7;
    pferdeBeine[2].rotation.x = -Math.sin(laufPhase) * 0.7;
    pferdeBeine[3].rotation.x = -Math.sin(laufPhase + 0.5) * 0.7;
    roland.position.y = Math.abs(Math.sin(laufPhase)) * 0.3;
    schweif.rotation.x = -0.3 - Math.abs(Math.sin(laufPhase)) * 0.5;
  } else {
    roland.position.y = 0;
    beine[0].rotation.x = Math.sin(laufPhase) * 0.6;
    beine[1].rotation.x = -Math.sin(laufPhase) * 0.6;
  }

  // --- Schwert schwingen ---
  if (tasten.schlag && schlagZeit <= 0) {
    schlagZeit = 0.35; schlagGetroffen = false;
    sounds.schwung();
  }
  if (schlagZeit > 0) {
    schlagZeit -= dt;
    const p = 1 - schlagZeit / 0.35;
    schulter.rotation.x = -2.8 + p * 2.5;
    schulter.rotation.y = Math.sin(p * Math.PI) * -0.8;
    if (!schlagGetroffen && p > 0.4) {
      schlagGetroffen = true;
      const vorne = new THREE.Vector3(Math.sin(roland.rotation.y), 0, Math.cos(roland.rotation.y));
      for (const k of kobolde) {
        if (!k.lebt) continue;
        const zuKobold = k.mesh.position.clone().sub(roland.position); zuKobold.y = 0;
        const reichweite = 3.3 + (k.groesse - 1) * 1.2 + (reitet ? 0.8 : 0);
        if (zuKobold.length() < reichweite && zuKobold.normalize().dot(vorne) > 0.3) koboldTreffen(k, zuKobold);
      }
      // Den Drachen treffen
      if (drache.lebt) {
        const zuDrache = drache.mesh.position.clone().sub(roland.position); zuDrache.y = 0;
        if (zuDrache.length() < 8.5 && zuDrache.normalize().dot(vorne) > 0.2) {
          drache.hp--;
          drache.blink = 0.3;
          sounds.treffer();
          if (drache.hp <= 0) {
            drache.lebt = false;
            sounds.brüllen();
            nachricht('Der Drache ist besiegt! 🐉💫 Hol dir den Schlüssel!');
            neuerSchluessel(drache.mesh.position.x + 6, drache.mesh.position.z);
            for (const f of feuerbaelle) szene.remove(f.mesh);
            feuerbaelle.length = 0;
          }
        }
      }
    }
  } else {
    schulter.rotation.x += (-0.5 - schulter.rotation.x) * 0.2;
    schulter.rotation.y *= 0.8;
  }

  // --- Zauberpilze sammeln ---
  for (const p of pilze) {
    if (p.gefunden) continue;
    if (Math.hypot(p.mesh.position.x - roland.position.x, p.mesh.position.z - roland.position.z) < 2.6) {
      p.gefunden = true;
      szene.remove(p.mesh);
      pilzAnzahl++;
      sounds.pilz();
      nachricht('Zauberpilz! 🍄 ' + pilzAnzahl + '/5');
    }
  }

  // --- Schlüssel einsammeln ---
  for (const s of schluessel) {
    if (s.gefunden) continue;
    if (Math.hypot(s.mesh.position.x - roland.position.x, s.mesh.position.z - roland.position.z) < 2.2) {
      s.gefunden = true;
      szene.remove(s.mesh);
      gefunden++;
      sounds.schluessel();
      nachricht('Goldener Schlüssel! 🔑 ' + gefunden + '/3');
    }
  }

  // --- Brunnen heilt ---
  heilPause -= dt;
  if (leben < MAX_LEBEN && heilPause <= 0 && Math.hypot(roland.position.x - DORF.x, roland.position.z - DORF.z) < 6.5) {
    leben = MAX_LEBEN;
    heilPause = 2;
    sounds.heilen();
    nachricht('Das Brunnenwasser heilt dich! 💧❤️');
  }

  // --- Burgtor ---
  if (!torOffen && roland.position.distanceTo(tor.position) < 9) {
    if (gefunden >= 3) {
      torOffen = true;
      sounds.tor();
      nachricht('Klick, klick, klick! Das Tor geht auf! 🏰');
      hindernisse.splice(hindernisse.indexOf(torHindernis), 1);
    } else if (Math.random() < 0.01) {
      nachricht('Das Tor ist verschlossen. Du brauchst 3 Schlüssel! 🔒');
    }
  }

  // --- Kobolde ---
  for (const k of kobolde) {
    if (!k.lebt) continue;
    const m = k.mesh;
    const zuRoland = roland.position.clone().sub(m.position); zuRoland.y = 0;
    const abstand = zuRoland.length();
    if (abstand > 90) continue; // weit weg: schlafen 💤
    let ziel;
    if (abstand < k.jagdRadius) {
      ziel = zuRoland.clone();
    } else {
      k.zufallsWinkel += (Math.random() - 0.5) * dt * 3;
      ziel = new THREE.Vector3(Math.sin(k.zufallsWinkel), 0, Math.cos(k.zufallsWinkel));
      if (m.position.distanceTo(k.start) > 10) ziel = k.start.clone().sub(m.position);
    }
    ziel.y = 0;
    if (ziel.length() > 0.01) {
      ziel.normalize();
      const tempo = abstand < k.jagdRadius ? k.tempo : 2;
      if (abstand > 1.5 * k.groesse) bewegen(m, ziel.x * tempo * dt, ziel.z * tempo * dt, 0.5 * k.groesse);
      m.rotation.y = Math.atan2(ziel.x, ziel.z);
    }
    m.position.y = Math.abs(Math.sin(zeit * 10 + k.zufallsWinkel)) * 0.2;

    k.schlagPause -= dt;
    k.trampelPause -= dt;
    // Im Galopp werden Kobolde umgeritten!
    if (reitet && vor > 0 && abstand < 2.2 * k.groesse && k.trampelPause <= 0) {
      k.trampelPause = 0.6;
      sounds.trampel();
      koboldTreffen(k, zuRoland.clone().normalize().negate());
      continue;
    }
    if (abstand < 1.8 * k.groesse && k.schlagPause <= 0 && unverwundbar <= 0) {
      k.schlagPause = 1;
      schaden();
      const stoss = zuRoland.clone().normalize().multiplyScalar(2.5);
      bewegen(roland, stoss.x, stoss.z, 0.7);
    }
  }

  // --- Der Drache ---
  if (drache.lebt) {
    const d = drache.mesh;
    const zuRoland = roland.position.clone().sub(d.position); zuRoland.y = 0;
    const abstand = zuRoland.length();
    const warAktiv = drache.aktiv;
    drache.aktiv = abstand < 60;
    if (drache.aktiv && !warAktiv) { sounds.brüllen(); nachricht('ROAAAR! 🐉🔥'); }
    if (drache.aktiv) {
      // Zum Ritter drehen
      const zielWinkel = Math.atan2(zuRoland.x, zuRoland.z);
      let diff = zielWinkel - d.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      d.rotation.y += diff * Math.min(1, dt * 2);
      // Langsam näher kommen, aber im Tal bleiben
      if (abstand > 9) {
        const r = zuRoland.clone().normalize().multiplyScalar(4 * dt);
        if (d.position.clone().add(r).distanceTo(drache.start) < 38) d.position.add(r);
      }
      // Feuer spucken!
      drache.schussPause -= dt;
      if (drache.schussPause <= 0 && abstand < 50) {
        drache.schussPause = drache.hp > 6 ? 2.4 : 1.5;
        const start = drache.kopf.getWorldPosition(new THREE.Vector3());
        const ziel = new THREE.Vector3(roland.position.x, 1.8 + figur.position.y, roland.position.z);
        const mesh = new THREE.Mesh(feuerGeo, feuerMat);
        mesh.position.copy(start);
        szene.add(mesh);
        feuerbaelle.push({ mesh, tempo: ziel.sub(start).normalize().multiplyScalar(22), zeit: 4 });
        sounds.feuer();
        drache.kiefer.rotation.x = 0.6;
      }
      // Beißen, wenn man zu nah ist
      drache.beissPause -= dt;
      if (abstand < 7 && drache.beissPause <= 0) { drache.beissPause = 1.3; schaden(); drache.kiefer.rotation.x = 0.6; }
    }
  }

  // --- Feuerbälle fliegen ---
  for (let i = feuerbaelle.length - 1; i >= 0; i--) {
    const f = feuerbaelle[i];
    f.mesh.position.addScaledVector(f.tempo, dt);
    f.zeit -= dt;
    f.mesh.scale.setScalar(1 + Math.sin(zeit * 30) * 0.15);
    tmp.set(roland.position.x, 1.8 + figur.position.y, roland.position.z);
    const treffer = f.mesh.position.distanceTo(tmp) < (reitet ? 2.3 : 1.8);
    if (treffer) schaden();
    if (treffer || f.zeit <= 0 || f.mesh.position.y < 0.2) {
      szene.remove(f.mesh);
      feuerbaelle.splice(i, 1);
    }
  }

  // --- Sisi befreien ---
  if (torOffen && !gewonnen && roland.position.distanceTo(sisi.position) < 4.5) {
    gewonnen = true;
    siegZeit = zeit;
    sounds.sieg();
    nachricht('Königin Sisi ist frei! 🎉👑', 5000);
    ende();
  }

  // --- Leute: Gespräche & Auftrag prüfen ---
  const a = auftraege[schritt];
  for (const id in npcs) {
    const n = npcs[id];
    const ab = n.pos.distanceTo(roland.position);
    if (ab < 15) n.mesh.rotation.y = Math.atan2(roland.position.x - n.pos.x, roland.position.z - n.pos.z);
    if (ab < 5) {
      if (a && a.npc === id) {
        dialogOeffnen(n.name, a.text, naechsterAuftrag);
        return;
      } else if (zeit - n.zuletzt > 12) {
        n.zuletzt = zeit;
        nachricht(n.name + ': „' + n.sonst + '“');
      }
    }
  }
  if (a && !a.npc && a.fertig()) naechsterAuftrag();
  else if (a && typeof a.titel === 'function') auftragZeigen();

  // --- Neues Gebiet? ---
  const g = gebiete.find(g => Math.hypot(roland.position.x - g.x, roland.position.z - g.z) < g.r);
  const name = g ? g.name : '🌲 Großer Wald';
  if (name !== aktuellesGebiet) {
    if (aktuellesGebiet) nachricht(name);
    aktuellesGebiet = name;
  }
}

function schleife() {
  requestAnimationFrame(schleife);
  const dt = Math.min(uhr.getDelta(), 0.05);
  const zeit = uhr.elapsedTime;

  if (laeuft && !dialog.offen) spielLogik(dt, zeit);

  // Umgefallene Kobolde verschwinden, getroffene blinken
  for (const k of kobolde) {
    if (!k.lebt && k.mesh.parent) {
      k.umfallen += dt * 4;
      k.mesh.rotation.x = Math.min(k.umfallen, Math.PI / 2);
      k.mesh.position.y = 0;
      k.mesh.visible = true;
      if (k.umfallen > 4) szene.remove(k.mesh);
    } else if (k.blink > 0) {
      k.blink -= dt;
      k.mesh.visible = Math.floor(k.blink * 20) % 2 === 0;
    } else k.mesh.visible = true;
  }

  // Drache: Flügel schlagen, blinken, umfallen
  if (drache.lebt) {
    const f = Math.sin(zeit * (drache.aktiv ? 6 : 2)) * 0.5;
    drache.fluegel[0].rotation.z = -f; drache.fluegel[1].rotation.z = f;
    drache.kiefer.rotation.x *= 0.92;
    if (drache.blink > 0) { drache.blink -= dt; drache.mesh.visible = Math.floor(drache.blink * 20) % 2 === 0; }
    else drache.mesh.visible = true;
  } else if (drache.umfallen < Math.PI / 2) {
    drache.mesh.visible = true;
    drache.umfallen += dt * 1.5;
    drache.mesh.rotation.z = Math.min(drache.umfallen, Math.PI / 2);
  }

  // Roland blinkt, wenn er getroffen wurde
  if (unverwundbar > 0) {
    unverwundbar -= dt;
    roland.visible = Math.floor(unverwundbar * 10) % 2 === 0;
  } else roland.visible = true;

  // Schlüssel und Pilze drehen sich und schweben
  for (const s of schluessel) if (!s.gefunden) { s.mesh.rotation.y += dt * 2; s.mesh.position.y = 1.8 + Math.sin(zeit * 3) * 0.3; }
  for (const p of pilze) if (!p.gefunden) p.mesh.position.y = Math.abs(Math.sin(zeit * 2)) * 0.3;

  // Tor fährt hoch
  if (torOffen && torHoch < 6.8) { torHoch += dt * 2; tor.position.y = 3.5 + torHoch; }

  // Sieg: Käfig hebt sich, Sisi hüpft vor Freude
  if (gewonnen) {
    kaefig.position.y = Math.min(kaefig.position.y + dt * 3, 8);
    sisi.position.y = Math.abs(Math.sin((zeit - siegZeit) * 6)) * 0.8;
    sisi.lookAt(roland.position.x, 0, roland.position.z);
  } else {
    sisi.rotation.y = Math.sin(zeit) * 0.5;
  }

  fahne.rotation.y = Math.sin(zeit * 2) * 0.2;
  suppe.material.color.setHSL(0.28, 1, 0.45 + Math.sin(zeit * 4) * 0.1);
  if (!reitet) { schweif.rotation.z = Math.sin(zeit * 2) * 0.4; pKopf.position.y = 3.3 + Math.sin(zeit) * 0.05; }

  // --- Wegweiser: Lichtstrahl & Pfeil zum Ziel ---
  const ziel = laeuft ? auftragsZiel() : null;
  if (ziel) {
    strahl.visible = true;
    strahl.position.set(ziel.x, 70, ziel.z);
    strahl.material.opacity = 0.25 + Math.sin(zeit * 3) * 0.1;
    const entfernung = Math.hypot(ziel.x - roland.position.x, ziel.z - roland.position.z);
    pfeil.visible = entfernung > 15;
    pfeil.position.set(roland.position.x, roland.position.y + figur.position.y + 4.6 + Math.sin(zeit * 4) * 0.15, roland.position.z);
    pfeil.lookAt(ziel.x, pfeil.position.y, ziel.z);
  } else {
    strahl.visible = pfeil.visible = false;
  }

  // --- Kamera folgt Roland von hinten ---
  const kAbstand = reitet ? 13 : 10, kHoehe = reitet ? 8 : 6;
  kameraZiel.set(
    roland.position.x - Math.sin(roland.rotation.y) * kAbstand,
    kHoehe,
    roland.position.z - Math.cos(roland.rotation.y) * kAbstand);
  kamera.position.lerp(kameraZiel, laeuft || gewonnen ? 0.08 : 1);
  kamera.lookAt(roland.position.x, roland.position.y + (reitet ? 3 : 2), roland.position.z);

  // Schatten-Licht wandert mit
  sonne.position.set(roland.position.x + 30, 60, roland.position.z + 20);
  sonne.target.position.copy(roland.position);

  hudZeigen();
  karteZeichnen(zeit);
  renderer.render(szene, kamera);
}

auftragZeigen();
schleife();
