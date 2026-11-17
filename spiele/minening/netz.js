// 🌐 ONLINE-MEHRSPIELER für Minening
// Mit PeerJS verbinden sich die Computer direkt miteinander.
// Einer erstellt die Mine (der "Host"), die anderen treten mit dem Raum-Code bei.
// Der Host passt auf die Welt auf und erzählt allen, was passiert.

let netzRolle = 'solo';   // 'solo', 'host' oder 'gast'
let peer = null;
let hostVerbindung = null;   // nur für Gäste: die Verbindung zum Host
const gaeste = new Map();    // nur für den Host: alle Gäste
let andere = {};             // die anderen Spieler, die wir zeichnen
let meineNr = 1;
let raumCode = '';
let netzUhr = 0;

const SPIELER_FARBEN = ['#e07a2f', '#3fa7ff', '#e05fd0', '#5fd068', '#ffd34d', '#ff5f5f', '#9b7bff', '#40e0d0'];
const MAX_SPIELER = 8;

function netzInfo(t) { document.getElementById('netzInfo').textContent = t; }

function codeMachen() {
  const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += zeichen[Math.floor(Math.random() * zeichen.length)];
  return c;
}
function peerName(code) { return 'minening-raum-' + code.toLowerCase(); }

function peerDa() {
  if (typeof Peer === 'undefined') {
    netzInfo('😕 Online geht gerade nicht. Bist du mit dem Internet verbunden?');
    return false;
  }
  return true;
}

// ---------- Host: eine Mine erstellen ----------
function netzHosten() {
  if (!peerDa()) return;
  raumCode = codeMachen();
  netzInfo('⏳ Mine wird erstellt …');
  peer = new Peer(peerName(raumCode));

  peer.on('open', () => {
    netzRolle = 'host';
    meineNr = 1;
    spielStarten();
    text('Raum-Code: ' + raumCode, spieler.zx + T / 2, spieler.zy - 20, '#7bd389');
  });

  peer.on('connection', verbindung => {
    verbindung.on('open', () => {
      if (gaeste.size >= MAX_SPIELER - 1) {
        verbindung.send({ t: 'voll' });
        setTimeout(() => verbindung.close(), 500);
        return;
      }
      verbindung.nr = freieNummer();
      gaeste.set(verbindung.peer, verbindung);
      verbindung.send({ t: 'welt', welt: Array.from(welt), resetUhr, nr: verbindung.nr });
      text('👋 Spieler ' + verbindung.nr + ' ist da!', spieler.zx + T / 2, spieler.zy - 20, '#7bd389');
      ton(660, 0.1, 'triangle', 0.08);
    });
    verbindung.on('data', d => hostEmpfaengt(verbindung, d));
    verbindung.on('close', () => {
      if (!gaeste.has(verbindung.peer)) return;
      gaeste.delete(verbindung.peer);
      delete andere[verbindung.peer];
      text('Spieler ' + verbindung.nr + ' ist gegangen', spieler.zx + T / 2, spieler.zy - 20, '#aaa');
    });
  });

  // Falls die Verbindung zum Vermittlungs-Dienst abbricht: neu verbinden,
  // damit noch weitere Freunde beitreten können.
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });

  peer.on('error', e => {
    if (e.type === 'unavailable-id') { peer.destroy(); netzHosten(); return; } // Code schon vergeben → neuer Code
    if (netzRolle === 'solo') netzInfo('😕 Das hat nicht geklappt (' + e.type + '). Versuch es nochmal!');
  });
}

function freieNummer() {
  const belegt = new Set([1, ...[...gaeste.values()].map(g => g.nr)]);
  for (let n = 2; n <= MAX_SPIELER; n++) if (!belegt.has(n)) return n;
  return MAX_SPIELER;
}

function hostEmpfaengt(verbindung, d) {
  if (d.t === 'pos') {
    spielerMerken(verbindung.peer, { ...d, nr: verbindung.nr });
  } else if (d.t === 'block') {
    setzeBlock(d.x, d.y, d.b);
    // an alle anderen Gäste weitersagen
    for (const g of gaeste.values()) if (g !== verbindung) g.send(d);
  }
}

function anAlle(d) { for (const g of gaeste.values()) if (g.open) g.send(d); }

// ---------- Gast: einer Mine beitreten ----------
function netzBeitreten(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 4) { netzInfo('Der Raum-Code hat 4 Zeichen.'); return; }
  if (!peerDa()) return;
  netzInfo('⏳ Suche Raum ' + code + ' …');
  peer = new Peer();

  peer.on('open', () => {
    hostVerbindung = peer.connect(peerName(code), { reliable: true });
    hostVerbindung.on('data', gastEmpfaengt);
    hostVerbindung.on('close', () => {
      if (netzRolle !== 'gast') return;
      laeuft = false;
      alert('Die Verbindung zur Mine ist weg. 😕 Das Spiel startet neu.');
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
  if (d.t === 'welt') {
    welt = Uint8Array.from(d.welt);
    resetUhr = d.resetUhr;
    meineNr = d.nr;
    netzRolle = 'gast';
    spieler = neuerSpieler(5, BODEN - 1);
    spielStarten();
    text('Du bist Spieler ' + meineNr + '!', spieler.zx + T / 2, spieler.zy - 20, SPIELER_FARBEN[meineNr - 1]);
  } else if (d.t === 'block') {
    setzeBlock(d.x, d.y, d.b);
  } else if (d.t === 'spieler') {
    const jetzt = new Set();
    for (const s of d.liste) {
      if (s.nr === meineNr) continue;
      spielerMerken(s.nr, s);
      jetzt.add(String(s.nr));
    }
    for (const id in andere) if (!jetzt.has(id)) delete andere[id];
    resetUhr = d.resetUhr;
  } else if (d.t === 'reset') {
    mineReset(d.welt);
  } else if (d.t === 'voll') {
    netzInfo('😕 Die Mine ist voll (höchstens ' + MAX_SPIELER + ' Spieler).');
  }
}

// ---------- Für alle ----------
function spielerMerken(id, d) {
  const alt = andere[id];
  andere[id] = {
    nr: d.nr, blick: d.blick, gr: d.gr, hacke: d.hacke, laeuft: d.laeuft,
    zielX: d.zx, zielY: d.zy,
    zx: alt ? alt.zx : d.zx, zy: alt ? alt.zy : d.zy,
  };
}

function meinePosition() {
  return { zx: spieler.zx, zy: spieler.zy, blick: spieler.blick, gr: !!graben, hacke: stufen.hacke,
           laeuft: !!(spieler.ziel && !spieler.ziel.fallen) };
}

// Wird aufgerufen, wenn wir einen Block verändern (graben oder Leiter bauen)
function netzBlock(x, y, b) {
  const d = { t: 'block', x, y, b };
  if (netzRolle === 'host') anAlle(d);
  if (netzRolle === 'gast' && hostVerbindung && hostVerbindung.open) hostVerbindung.send(d);
}

// Wird aufgerufen, wenn der Host die Mine neu baut
function netzReset() {
  if (netzRolle === 'host') anAlle({ t: 'reset', welt: Array.from(welt) });
}

// Jedes Bild: andere Spieler weich bewegen, 10-mal pro Sekunde Positionen schicken
function netzTick(dt) {
  for (const id in andere) {
    const a = andere[id];
    a.zx += (a.zielX - a.zx) * Math.min(1, dt * 12);
    a.zy += (a.zielY - a.zy) * Math.min(1, dt * 12);
  }
  if (netzRolle === 'solo') return;
  netzUhr += dt;
  if (netzUhr < 0.1) return;
  netzUhr = 0;
  if (netzRolle === 'gast' && hostVerbindung && hostVerbindung.open) {
    hostVerbindung.send({ t: 'pos', ...meinePosition() });
  }
  if (netzRolle === 'host') {
    const liste = [{ nr: 1, ...meinePosition() }];
    for (const id in andere) {
      const a = andere[id];
      liste.push({ nr: a.nr, zx: a.zielX, zy: a.zielY, blick: a.blick, gr: a.gr, hacke: a.hacke, laeuft: a.laeuft });
    }
    anAlle({ t: 'spieler', liste, resetUhr });
  }
}

function spielerAnzahl() { return 1 + Object.keys(andere).length; }
