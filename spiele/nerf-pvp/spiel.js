// 🔫 NERF PvP – ein 3D-Shooter mit Schaumstoff-Darts
// Du siehst durch die Augen deiner Figur (Ego-Sicht) und kämpfst gegen Bots oder Freunde online.
import * as THREE from 'three';

// ========== Einstellungen (hier kannst du herumprobieren!) ==========
const SIEG_PUNKTE = 10;          // so viele Gegner muss man ausschalten, um zu gewinnen
const MAX_LEBEN = 100;
const SCHADEN = 20;              // Treffer am Körper
const KOPF_SCHADEN = 40;         // Treffer am Kopf
const MAGAZIN = 12;              // so viele Darts passen in den Blaster
const NACHLADE_ZEIT = 1.4;       // Sekunden
const SCHUSS_PAUSE = 0.16;       // Sekunden zwischen zwei Schüssen
const DART_TEMPO = 32;           // Meter pro Sekunde
const DART_SCHWERKRAFT = 3;      // so stark fallen Darts nach unten
const LAUF_TEMPO = 6, RENN_TEMPO = 9, SPRUNG_KRAFT = 6.5, SCHWERKRAFT = 18;
const MIN_KAEMPFER = 4;          // Bots füllen auf so viele Kämpfer auf
const BOT_ZIELFEHLER = 0.07;     // kleiner = Bots zielen besser
const MAUS_EMPFINDLICH = 0.0022;
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

scene.add(new THREE.HemisphereLight('#ffffff', '#6a7a8a', 1.7));
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
const bodenTex = malTextur(256, (g, s) => {
  g.fillStyle = '#e4e8f0'; g.fillRect(0, 0, s, s);
  g.strokeStyle = '#c3cad8'; g.lineWidth = 8; g.strokeRect(0, 0, s, s);
});
bodenTex.repeat.set(20, 20);
const kistenTex = malTextur(128, (g, s) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,255,255,.3)';
  for (let i = -s; i < s; i += 32) { g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.lineTo(i + s + 12, 0); g.lineTo(i + 12, s); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.fillRect(0, 0, s, 8); g.fillRect(0, s - 8, s, 8); g.fillRect(0, 0, 8, s); g.fillRect(s - 8, 0, 8, s);
});

// ========== Die Arena ==========
const G = 20;   // die Arena geht von -20 bis +20 Meter
const boden = new THREE.Mesh(new THREE.PlaneGeometry(G * 2 + 2, G * 2 + 2).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ map: bodenTex }));
boden.receiveShadow = true;
scene.add(boden);

const kisten = [];   // alle Hindernisse als Kästen: x1..x2, y1..y2, z1..z2
function kiste(cx, cz, b, t, h, farbe, y0 = 0) {
  kisten.push({ x1: cx - b / 2, x2: cx + b / 2, z1: cz - t / 2, z2: cz + t / 2, y1: y0, y2: y0 + h });
  const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), new THREE.MeshLambertMaterial({ color: farbe, map: kistenTex }));
  m.position.set(cx, y0 + h / 2, cz);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
// baut ein Hindernis in alle 4 Ecken gespiegelt (damit die Arena fair ist)
const schonGebaut = new Set();
function viermal(cx, cz, b, t, h, farbe, y0 = 0) {
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const schluessel = [cx * sx, cz * sz, b, t, y0].join();
    if (schonGebaut.has(schluessel)) continue;
    schonGebaut.add(schluessel);
    kiste(cx * sx, cz * sz, b, t, h, farbe, y0);
  }
}
// Außenwände
kiste(0, -G - 0.5, G * 2 + 2, 1, 4, '#2b59c3'); kiste(0, G + 0.5, G * 2 + 2, 1, 4, '#2b59c3');
kiste(-G - 0.5, 0, 1, G * 2, 4, '#ff7a1a'); kiste(G + 0.5, 0, 1, G * 2, 4, '#ff7a1a');
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

const STARTPUNKTE = [[18, 0], [-18, 0], [0, 18], [0, -18], [18, 18], [-18, 18], [18, -18], [-18, -18], [8, 0], [-8, 0], [0, 8], [0, -8]];

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
function baueBlaster() {
  const g = new THREE.Group();
  g.add(klotz(0.12, 0.14, 0.5, blasterOrange, 0, 0, 0));       // Körper
  g.add(klotz(0.07, 0.07, 0.35, blasterBlau, 0, 0.02, -0.4));  // Lauf
  g.add(klotz(0.09, 0.09, 0.06, blasterGelb, 0, 0.02, -0.6));  // Mündung
  g.add(klotz(0.08, 0.2, 0.1, blasterBlau, 0, -0.15, 0.13));   // Griff
  g.add(klotz(0.1, 0.16, 0.12, blasterGelb, 0, -0.13, -0.12)); // Magazin
  g.add(klotz(0.05, 0.06, 0.16, blasterBlau, 0, 0.1, 0.05));   // Visier
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
  const blaster = baueBlaster(); blaster.position.set(0.05, 1.32, -0.55); g.add(blaster);
  g.add(namensSchild(name, farbe));
  g.userData = { b1, b2, schritt: 0 };
  return g;
}

// Der Blaster, den DU in der Hand hältst (hängt an der Kamera)
const meinBlaster = baueBlaster();
meinBlaster.traverse(m => { m.castShadow = false; });
kamera.add(meinBlaster);

// ========== Darts ==========
const dartKoerperGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8).translate(0, -0.04, 0);
const dartSpitzeGeo = new THREE.SphereGeometry(0.045, 8, 6).translate(0, 0.07, 0);
const dartBlau = mat('#2f8cff'), dartOrange = mat('#ff7a1a');
const OBEN = new THREE.Vector3(0, 1, 0);
let darts = [];
function neuerDart(von, o, r) {
  const mesh = new THREE.Group();
  mesh.add(new THREE.Mesh(dartKoerperGeo, dartBlau), new THREE.Mesh(dartSpitzeGeo, dartOrange));
  scene.add(mesh);
  const pos = new THREE.Vector3(o[0], o[1], o[2]);
  darts.push({ von, pos, alt: pos.clone(), vel: new THREE.Vector3(r[0], r[1], r[2]).multiplyScalar(DART_TEMPO), mesh, steckt: false, uhr: 3 });
  mesh.position.copy(pos);
  // Ton: je weiter weg, desto leiser
  const weit = kamera.position.distanceTo(pos);
  pfumpSound(1 / (1 + weit / 8));
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
    d.vel.y -= DART_SCHWERKRAFT * dt;
    d.pos.addScaledVector(d.vel, dt);
    d.uhr -= dt;
    if (d.uhr <= 0) d.weg = true;
    // Den Weg in kleinen Schritten prüfen, damit der Dart nicht durch etwas durchfliegt
    const schritte = Math.max(1, Math.ceil(d.alt.distanceTo(d.pos) / 0.08));
    suche: for (let i = 1; i <= schritte; i++) {
      const p = tmp.copy(d.alt).lerp(d.pos, i / schritte);
      for (const k of alleKaempfer()) {
        if (k.id === d.von || k.tot) continue;
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
  const schaden = art === 'kopf' ? KOPF_SCHADEN : SCHADEN;
  if (k === ich) getroffen(schaden, d.von);
  else if (k.bot && istChef()) botGetroffen(k, schaden, d.von);
  if (d.von === ich.id) {   // DU hast getroffen!
    trefferAnzeige(art === 'kopf');
    ton(art === 'kopf' ? 1400 : 900, 0.08, 'square', 0.07);
  }
}

// ========== Kämpfer (du, Freunde und Bots) ==========
const ich = { id: 'p1', name: 'Spieler 1', farbe: FARBEN[0], x: 0, y: 0, z: 0, vy: 0, b: 0, n: 0, hp: MAX_LEBEN, tot: true, ruheUhr: 0 };
const andere = new Map();    // alle anderen Kämpfer: id -> Kämpfer
let punkte = {};             // id -> { name, farbe, kills, tode }
function alleKaempfer() { return [ich, ...andere.values()]; }
function nameVon(id) { return punkte[id] ? String(punkte[id].name) : '???'; }
const sicher = t => String(t).replace(/[&<>"']/g, z => '&#' + z.charCodeAt(0) + ';');   // Text sicher für HTML machen
function farbeVon(id) { return punkte[id] ? punkte[id].farbe : '#fff'; }

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
    for (const o of alleKaempfer()) if (o !== k && !o.tot) weite = Math.min(weite, Math.hypot(o.x - s[0], o.z - s[1]));
    weite += Math.random() * 4;
    if (weite > besteWeite) { besteWeite = weite; bester = s; }
  }
  k.x = bester[0]; k.z = bester[1]; k.y = 0; k.vy = 0;
  k.hp = MAX_LEBEN; k.tot = false; k.ruheUhr = 0;
  k.b = Math.atan2(k.x, k.z); k.n = 0;   // schaut zur Mitte
  if (k.bot) { k.munition = MAGAZIN; k.nachladeUhr = 0; k.wegpunkt = null; k.sehUhr = 0; }
  if (k === ich) { munition = MAGAZIN; nachladeUhr = 0; }
}

function erholen(k, dt) {   // nach 4 Sekunden ohne Treffer kommen Leben zurück
  k.ruheUhr += dt;
  if (k.ruheUhr > 4 && k.hp < MAX_LEBEN) k.hp = Math.min(MAX_LEBEN, k.hp + 25 * dt);
}

// ---------- Du ----------
const tasten = {};
let maus = false, gesperrt = false, laeuft = false;
let munition = MAGAZIN, nachladeUhr = 0, schussUhr = 0, rueckstoss = 0, laufPhase = 0, todHoehe = 0;

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
  if (nachladeUhr > 0 || munition === MAGAZIN || ich.tot) return;
  nachladeUhr = NACHLADE_ZEIT;
  ton(300, 0.06, 'square', 0.06);
  setTimeout(() => ton(520, 0.08, 'square', 0.06), NACHLADE_ZEIT * 800);
}

function schiessen() {
  munition--; schussUhr = SCHUSS_PAUSE; rueckstoss = 1;
  const blick = new THREE.Vector3(); kamera.getWorldDirection(blick);
  const zielPunkt = kamera.position.clone().addScaledVector(blick, 30);
  const o = new THREE.Vector3(0.2, -0.2, -0.95).applyQuaternion(kamera.quaternion).add(kamera.position);  // vorne am Blaster
  const r = zielPunkt.sub(o).normalize();
  r.x += (Math.random() - 0.5) * 0.012; r.y += (Math.random() - 0.5) * 0.012; r.z += (Math.random() - 0.5) * 0.012;
  r.normalize();
  feuern(ich.id, o, r);
}

function feuern(von, o, r) {
  const oa = [o.x, o.y, o.z], ra = [r.x, r.y, r.z];
  neuerDart(von, oa, ra);
  if (rolle === 'host') anAlle({ t: 'schuss', von, o: oa, r: ra });
  if (rolle === 'gast') anHost({ t: 'schuss', o: oa, r: ra });
}

function spielerUpdate(dt) {
  if (ich.tot) {
    ich.wiederUhr -= dt;
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
  const tempo = (tasten.ShiftLeft || tasten.ShiftRight ? RENN_TEMPO : LAUF_TEMPO) * dt / laenge;
  const fx = -Math.sin(ich.b), fz = -Math.cos(ich.b), rx = Math.cos(ich.b), rz = -Math.sin(ich.b);
  if (tasten.Space && ich.amBoden) ich.vy = SPRUNG_KRAFT;
  bewegen(ich, (fx * vor + rx * seit) * tempo, (fz * vor + rz * seit) * tempo, dt);

  schussUhr -= dt;
  if (nachladeUhr > 0) { nachladeUhr -= dt; if (nachladeUhr <= 0) munition = MAGAZIN; }
  if (maus && gesperrt && schussUhr <= 0 && nachladeUhr <= 0) {
    if (munition > 0) schiessen();
    else { ton(1200, 0.03, 'square', 0.05); schussUhr = 0.25; nachladen(); }
  }
}

function kameraUpdate(dt) {
  if (ich.tot) {   // tot: Kamera schwebt nach oben
    todHoehe = Math.min(3, todHoehe + dt * 1.5);
    kamera.position.set(ich.x, ich.y + AUGEN + todHoehe, ich.z);
    kamera.rotation.set(-0.9, ich.b, 0);
    meinBlaster.visible = false;
    return;
  }
  todHoehe = 0; meinBlaster.visible = true;
  const laufen = ich.amBoden && (tasten.KeyW || tasten.KeyA || tasten.KeyS || tasten.KeyD);
  if (laufen) laufPhase += dt * (tasten.ShiftLeft ? 13 : 9);
  const wippen = laufen ? Math.sin(laufPhase) * 0.035 : 0;
  kamera.position.set(ich.x, ich.y + AUGEN + Math.abs(wippen), ich.z);
  kamera.rotation.set(ich.n, ich.b, 0);
  rueckstoss = Math.max(0, rueckstoss - dt * 8);
  const lade = nachladeUhr > 0 ? Math.sin((1 - nachladeUhr / NACHLADE_ZEIT) * Math.PI) : 0;
  meinBlaster.position.set(0.22 + wippen * 0.5, -0.22 - lade * 0.15 + Math.abs(wippen) * 0.3, -0.45 + rueckstoss * 0.08);
  meinBlaster.rotation.set(rueckstoss * 0.12 - lade * 0.7, 0, lade * 0.4);
}

// ---------- Bots (nur der Chef/Host steuert sie) ----------
let naechsteBotNr = 0;
function neuerBot() {
  const i = naechsteBotNr++;
  const b = { id: 'b' + i, name: BOT_NAMEN[i % BOT_NAMEN.length], farbe: BOT_FARBEN[i % BOT_FARBEN.length], bot: true,
    x: 0, y: 0, z: 0, vy: 0, b: 0, n: 0, hp: MAX_LEBEN, tot: false, ruheUhr: 0,
    munition: MAGAZIN, schussUhr: 1, nachladeUhr: 0, sehUhr: 0, seitwaerts: 0, seitUhr: 0, wegpunkt: null, steckUhr: 0 };
  punkte[b.id] = { name: b.name, farbe: b.farbe, kills: 0, tode: 0 };
  kaempferHinzu(b);
  wiederbeleben(b);
}
function botsAnpassen() {   // Bots füllen auf MIN_KAEMPFER auf
  const soll = Math.max(0, MIN_KAEMPFER - 1 - gaeste.size);
  const bots = [...andere.values()].filter(k => k.bot);
  for (let i = bots.length; i < soll; i++) neuerBot();
  for (let i = bots.length - 1; i >= soll; i--) { kaempferWeg(bots[i].id); delete punkte[bots[i].id]; }
}
function zufallsPunkt() {
  for (let i = 0; i < 40; i++) {
    const p = { x: (Math.random() * 2 - 1) * 18, y: 0, z: (Math.random() * 2 - 1) * 18 };
    if (!stoesst(p)) return p;
  }
  return { x: 0, y: 0, z: 8 };
}
function botGetroffen(b, schaden, von) {
  b.hp -= schaden; b.ruheUhr = 0;
  if (b.hp <= 0) { b.tot = true; b.wiederUhr = 3; raus(b.id, von); }
}

const auge = new THREE.Vector3(), zielAuge = new THREE.Vector3();
function botDenken(b, dt) {
  if (b.tot) { b.wiederUhr -= dt; if (b.wiederUhr <= 0) wiederbeleben(b); return; }
  erholen(b, dt);
  b.schussUhr -= dt;
  if (b.nachladeUhr > 0) { b.nachladeUhr -= dt; if (b.nachladeUhr <= 0) b.munition = MAGAZIN; }

  // Den nächsten Gegner suchen, den der Bot sehen kann
  auge.set(b.x, b.y + AUGEN, b.z);
  let ziel = null, zielWeite = 35;
  for (const k of alleKaempfer()) {
    if (k === b || k.tot) continue;
    const weite = Math.hypot(k.x - b.x, k.y - b.y, k.z - b.z);
    if (weite < zielWeite && sichtlinie(auge, zielAuge.set(k.x, k.y + 1.2, k.z))) { ziel = k; zielWeite = weite; }
  }

  let vor = 0, seit = 0;
  if (ziel) {
    b.sehUhr += dt;
    const dx = ziel.x - b.x, dz = ziel.z - b.z, flach = Math.hypot(dx, dz);
    const flugZeit = flach / DART_TEMPO;
    const dy = ziel.y + 1.2 - (b.y + AUGEN) + 0.5 * DART_SCHWERKRAFT * flugZeit * flugZeit;  // etwas höher zielen, weil der Dart fällt
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
    if (flach > 14) vor = 0.8; else if (flach < 5) vor = -0.6;
    // schießen
    if (b.sehUhr > 0.45 && Math.abs(winkelDiff(b.b, sollB)) < 0.12 && b.schussUhr <= 0 && b.nachladeUhr <= 0) {
      if (b.munition <= 0) b.nachladeUhr = NACHLADE_ZEIT + 0.6;
      else {
        b.munition--; b.schussUhr = 0.3 + Math.random() * 0.35;
        const bb = b.b + (Math.random() - 0.5) * BOT_ZIELFEHLER, nn = b.n + (Math.random() - 0.5) * BOT_ZIELFEHLER;
        const r = new THREE.Vector3(-Math.sin(bb) * Math.cos(nn), Math.sin(nn), -Math.cos(bb) * Math.cos(nn));
        feuern(b.id, auge.clone().addScaledVector(r, 0.7), r);
      }
    }
  } else {
    // Niemand zu sehen: durch die Arena laufen
    b.sehUhr = 0;
    if (!b.wegpunkt || Math.hypot(b.wegpunkt.x - b.x, b.wegpunkt.z - b.z) < 1.5) b.wegpunkt = zufallsPunkt();
    b.b = dreheZu(b.b, Math.atan2(-(b.wegpunkt.x - b.x), -(b.wegpunkt.z - b.z)), 4 * dt);
    b.n *= 0.9;
    vor = 1;
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
    if (b.steckUhr > 1.2) { b.wegpunkt = zufallsPunkt(); b.steckUhr = 0; }
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
  if (punkte[von] && punkte[von].kills >= SIEG_PUNKTE) {
    siegPause = 5;
    anAlle({ t: 'sieg', id: von });
    zeigeSieg(von);
  }
}
function neueRunde() {   // nur beim Chef
  for (const p of Object.values(punkte)) { p.kills = 0; p.tode = 0; }
  wiederbeleben(ich);
  for (const k of andere.values()) if (k.bot) wiederbeleben(k);
  anAlle({ t: 'neustart' });
  mitte('🔄 Neue Runde!', 2);
}
function zeigeRaus(opfer, von) {
  feed(`<span style="color:${sicher(farbeVon(von))}">${sicher(nameVon(von))}</span> 🔫 <span style="color:${sicher(farbeVon(opfer))}">${sicher(nameVon(opfer))}</span>`);
  if (von === ich.id && opfer !== ich.id) {
    mitte('💥 Du hast ' + nameVon(opfer) + ' erwischt!', 1.5, '#ffd21f');
    ton(660, 0.1, 'triangle', 0.15); setTimeout(() => ton(990, 0.18, 'triangle', 0.15), 100);
  }
}
function zeigeSieg(id) {
  mitte(id === ich.id ? '🏆 DU HAST GEWONNEN! 🏆' : '🏆 ' + nameVon(id) + ' gewinnt! 🏆', 5, farbeVon(id));
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
    document.getElementById('code').textContent = '🌐 Raum-Code: ' + raumCode + ' – sag ihn deinen Freunden!';
    spielStarten();
  });
  peer.on('connection', v => {
    v.on('open', () => {
      if (gaeste.size >= FARBEN.length - 1) { v.send({ t: 'voll' }); setTimeout(() => v.close(), 500); return; }
      v.nr = freieNummer(); v.id = 'p' + v.nr;
      gaeste.set(v.peer, v);
      const name = 'Spieler ' + v.nr, farbe = FARBEN[v.nr - 1];
      punkte[v.id] = { name, farbe, kills: 0, tode: 0 };
      kaempferHinzu({ id: v.id, name, farbe, x: 0, y: 0, z: 0, b: 0, n: 0, hp: MAX_LEBEN, tot: true });
      v.send({ t: 'hallo', nr: v.nr });
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
  k.zx = d.x; k.zy = d.y; k.zz = d.z; k.zb = d.b; k.n = d.n; k.tot = d.tot;
}
function hostEmpfaengt(v, d) {
  if (d.t === 'pos') { const k = andere.get(v.id); if (k) positionUebernehmen(k, d); }
  else if (d.t === 'schuss') { neuerDart(v.id, d.o, d.r); anAlle({ t: 'schuss', von: v.id, o: d.o, r: d.r }, v); }
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
    ich.id = 'p' + d.nr; ich.name = 'Spieler ' + d.nr; ich.farbe = FARBEN[d.nr - 1];
    document.getElementById('code').textContent = '🌐 Raum ' + raumCode;
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
  } else if (d.t === 'schuss') neuerDart(d.von, d.o, d.r);
  else if (d.t === 'raus') zeigeRaus(d.opfer, d.von);
  else if (d.t === 'sieg') zeigeSieg(d.id);
  else if (d.t === 'neustart') { wiederbeleben(ich); mitte('🔄 Neue Runde!', 2); }
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
      x: r2(k.x), y: r2(k.y), z: r2(k.z), b: r2(k.b), n: r2(k.n), tot: k.tot }));
    anAlle({ t: 'welt', k: liste, p: punkte });
  } else {
    anHost({ t: 'pos', x: r2(ich.x), y: r2(ich.y), z: r2(ich.z), b: r2(ich.b), n: r2(ich.n), tot: ich.tot });
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
    u.schritt += bewegt * 3;
    u.b1.rotation.x = Math.sin(u.schritt) * 0.7;
    u.b2.rotation.x = -Math.sin(u.schritt) * 0.7;
  }
}

// ========== Töne (Web Audio) ==========
let audio = null, rauschPuffer = null;
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
function pfumpSound(laut) {   // Luftstoß vom Blaster
  klang((a, t) => {
    if (!rauschPuffer) {
      rauschPuffer = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate);
      const daten = rauschPuffer.getChannelData(0);
      for (let i = 0; i < daten.length; i++) daten[i] = Math.random() * 2 - 1;
    }
    const n = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
    n.buffer = rauschPuffer;
    f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.12);
    v.gain.setValueAtTime(0.45 * laut, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    n.connect(f); f.connect(v); v.connect(a.destination); n.start(t); n.stop(t + 0.16);
  });
  ton(200, 0.1, 'sine', 0.35 * laut, 70);
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
function hudUpdate(dt) {
  el('lebenText').textContent = '❤️ ' + Math.ceil(ich.hp);
  el('lebenFuell').style.width = ich.hp + '%';
  el('lebenFuell').style.background = ich.hp > 60 ? '#2fd05a' : ich.hp > 30 ? '#ffd21f' : '#ff4040';
  el('munition').textContent = nachladeUhr > 0 ? '🔄 Nachladen …' : '🎯 ' + munition + ' / ' + MAGAZIN;
  el('munition').style.color = munition === 0 ? '#ff4040' : '#fff';
  rotUhr = Math.max(0, rotUhr - dt); el('rot').style.opacity = rotUhr * 2;
  trefferUhr = Math.max(0, trefferUhr - dt); el('trefferX').style.opacity = trefferUhr * 4;
  mitteUhr -= dt; if (mitteUhr <= 0) el('mitte').textContent = '';
  tabelleUhr -= dt;
  if (tabelleUhr <= 0) {
    tabelleUhr = 0.25;
    const liste = Object.entries(punkte).sort((a, b) => b[1].kills - a[1].kills);
    el('tabelle').innerHTML = `<div>🏆 Wer zuerst ${SIEG_PUNKTE} hat</div>` + liste.map(([id, p]) =>
      `<div class="${id === ich.id ? 'ich' : ''}"><span style="color:${sicher(p.farbe)}">●</span> ${sicher(p.name)}${id === ich.id ? ' (Du)' : ''} <b>${sicher(p.kills)}</b></div>`).join('');
  }
}

// ========== Steuerung ==========
addEventListener('keydown', e => {
  tasten[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR' && laeuft) nachladen();
});
addEventListener('keyup', e => { tasten[e.code] = false; });
addEventListener('mousemove', e => {
  if (!gesperrt) return;
  ich.b -= e.movementX * MAUS_EMPFINDLICH;
  ich.n = Math.max(-1.45, Math.min(1.45, ich.n - e.movementY * MAUS_EMPFINDLICH));
});
addEventListener('mousedown', e => { if (gesperrt && e.button === 0) maus = true; });
addEventListener('mouseup', e => { if (e.button === 0) maus = false; });
function mausFangen() {
  try { const p = leinwand.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* geht nicht */ }
}
document.addEventListener('pointerlockchange', () => {
  gesperrt = document.pointerLockElement === leinwand;
  if (!gesperrt) { maus = false; for (const k in tasten) tasten[k] = false; }
  el('pause').classList.toggle('versteckt', !laeuft || gesperrt);
});
el('pause').onclick = mausFangen;

function spielStarten() {
  laeuft = true;
  el('menu').classList.add('versteckt');
  el('hud').classList.remove('versteckt');
  el('pause').classList.toggle('versteckt', gesperrt);
  if (istChef()) {
    punkte[ich.id] = { name: ich.name, farbe: ich.farbe, kills: 0, tode: 0 };
    botsAnpassen();
  }
  wiederbeleben(ich);
  mitte('🔫 Los geht\'s! Triff die anderen!', 2.5, '#ffd21f');
}
el('soloKnopf').onclick = () => { rolle = 'solo'; spielStarten(); mausFangen(); };
el('hostKnopf').onclick = raumErstellen;
el('beitretenKnopf').onclick = () => raumBeitreten(el('codeFeld').value);
el('codeFeld').addEventListener('keydown', e => { if (e.key === 'Enter') raumBeitreten(e.target.value); });

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
    kamera.position.set(Math.sin(menuWinkel) * 26, 13, Math.cos(menuWinkel) * 26);
    kamera.lookAt(0, 0, 0);
  }
  renderer.render(scene, kamera);
  requestAnimationFrame(schleife);
}
requestAnimationFrame(schleife);
