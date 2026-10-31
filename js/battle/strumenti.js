/* =====================================================================
   js/battle/strumenti.js
   Cosa fa:   Gli strumenti della mappa, per il master e per i giocatori:
                · zoom e spostamento (rotella, pizzico con due dita, pulsanti, «Mano»)
                · griglia a quadretti e aggancio dei segnalini ai quadretti
                · aree d'effetto (cerchio, cono, quadrato, linea) che si vedono solo a te
                · annulla l'ultimo spostamento (anche Ctrl+Z)
                · centra la mappa su un segnalino
              La distanza tra due segnalini selezionati è in selezione.js.
   Contiene:  CELLA_M, ZOOM_MAX, applicaZoom, zoomA, disegnaGriglia,
              agganciaSeg, disegnaAree, avviaArea, registraAnnulla,
              annullaSpostamento, centraSu, aggiornaStrumenti,
              aggiornaAttrezzi, azioneStrumenti, iniziaStrumenti
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

var CELLA_M = 1.5;           // [MODIFICA QUI] lato di un quadretto della griglia, in metri (1,5 m = 5 piedi)
var ZOOM_MAX = 5;            // [MODIFICA QUI] ingrandimento massimo
var MAX_AREE = 6;            // [MODIFICA QUI] quante aree restano disegnate insieme
var MAX_ANNULLA = 20;        // [MODIFICA QUI] quanti spostamenti si possono annullare

function limita(v, a, b) { return Math.max(a, Math.min(b, v)); }
function azzeraStrumenti() {
  B.zoom = { z: 1, x: 0, y: 0 }; B.aree = []; B.annulla = []; B.areaDraw = null; B.pan = null; B.pinch = null; B.tocchi = {};
}

// ---------------------------------------------------------------- zoom e spostamento
// Lo zoom sta sul livello #piano (mappa, segnalini, griglia, aree): i pulsanti sopra la mappa restano fermi.
// B.zoom = { z: ingrandimento, x, y: spostamento in pixel }. La mappa ingrandita copre sempre tutta la finestra.
function applicaZoom() {
  var p = $("#piano"), sc = $("#scena");
  if (!p || !sc) return;
  var W = sc.clientWidth, H = sc.clientHeight, z = B.zoom.z;
  B.zoom.x = limita(B.zoom.x, W - W * z, 0); B.zoom.y = limita(B.zoom.y, H - H * z, 0);
  p.style.transform = z === 1 ? "" : "translate(" + B.zoom.x + "px," + B.zoom.y + "px) scale(" + z + ")";
}
// Cambia l'ingrandimento tenendo fermo il punto (cx, cy), in pixel dentro la scena.
function zoomA(z1, cx, cy) {
  var z0 = B.zoom.z; z1 = limita(z1, 1, ZOOM_MAX);
  if (z1 === z0) return;
  B.zoom.x = cx - (cx - B.zoom.x) * z1 / z0; B.zoom.y = cy - (cy - B.zoom.y) * z1 / z0; B.zoom.z = z1;
  applicaZoom(); aggiornaAttrezzi();
}
function zoomCentro(z1) { var sc = $("#scena"); zoomA(z1, sc.clientWidth / 2, sc.clientHeight / 2); }

// Si sposta la mappa con «Mano», con la barra spaziatrice premuta o con il tasto centrale del mouse (solo se è ingrandita).
function inizioPan(e) {
  var si = B.mano || ((B.spazio || e.button === 1) && B.zoom.z > 1);
  if (!si) return false;
  B.pan = { x0: e.clientX, y0: e.clientY, tx: B.zoom.x, ty: B.zoom.y };
  bCattura(e); $("#scena").classList.add("trascinando");
  return true;
}
function muoviPan(e) { B.zoom.x = B.pan.tx + (e.clientX - B.pan.x0); B.zoom.y = B.pan.ty + (e.clientY - B.pan.y0); applicaZoom(); }
function finePan() { B.pan = null; $("#scena").classList.remove("trascinando"); }

// Pizzico con due dita: ingrandisce e sposta insieme. Il primo dito aveva già iniziato un trascinamento: si annulla.
function iniziaPinch() {
  var id = Object.keys(B.tocchi), a = B.tocchi[id[0]], b = B.tocchi[id[1]], r = $("#scena").getBoundingClientRect();
  if (B.drag) { (B.drag.prima || []).forEach(function (t) { var s = segnalinoPerId(t.id); if (s) { s.x = t.x; s.y = t.y; } }); B.drag = null; }
  B.box = null; B.areaDraw = null; B.linea = null; disegnaMarquee();
  var m = mappaVista(); if (m) { disegnaSegnalini(m); disegnaAree(m); disegnaLinea(); }
  B.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: B.zoom.z, tx0: B.zoom.x, ty0: B.zoom.y, cx0: (a.x + b.x) / 2 - r.left, cy0: (a.y + b.y) / 2 - r.top };
}
function muoviPinch() {
  var id = Object.keys(B.tocchi), a = B.tocchi[id[0]], b = B.tocchi[id[1]], r = $("#scena").getBoundingClientRect(), P = B.pinch;
  var cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top, z1 = limita(P.z0 * Math.hypot(a.x - b.x, a.y - b.y) / P.d0, 1, ZOOM_MAX);
  B.zoom.z = z1;
  B.zoom.x = cx - (P.cx0 - P.tx0) * z1 / P.z0; B.zoom.y = cy - (P.cy0 - P.ty0) * z1 / P.z0;
  applicaZoom(); aggiornaAttrezzi();
}
function collegaTocchi() {
  var sc = $("#scena");
  sc.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "touch") return;
    B.tocchi[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(B.tocchi).length === 2) { iniziaPinch(); e.stopImmediatePropagation(); }
    else if (B.pinch) e.stopImmediatePropagation();
  }, true);
  sc.addEventListener("pointermove", function (e) {
    if (!B.tocchi[e.pointerId]) return;
    B.tocchi[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (B.pinch) { muoviPinch(); e.stopImmediatePropagation(); }
  }, true);
  var su = function (e) {
    if (!B.tocchi[e.pointerId]) return;
    delete B.tocchi[e.pointerId];
    if (B.pinch) { if (Object.keys(B.tocchi).length < 2) B.pinch = null; e.stopImmediatePropagation(); }
  };
  sc.addEventListener("pointerup", su, true); sc.addEventListener("pointercancel", su, true);
  sc.addEventListener("wheel", function (e) {
    if (!mappaVista()) return;
    e.preventDefault();
    var r = sc.getBoundingClientRect();
    zoomA(B.zoom.z * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
}

// ---------------------------------------------------------------- griglia e aggancio
// Servono la scala calibrata: un quadretto è CELLA_M metri.
function disegnaGriglia(m) {
  var g = $("#griglia");
  if (!g) return;
  if (!B.griglia || !m || !m.larghezza_m) { g.hidden = true; return; }
  var cella = $("#scena").clientWidth * CELLA_M / Number(m.larghezza_m);
  g.hidden = false; g.style.backgroundSize = cella + "px " + cella + "px";
}
// Porta un segnalino al centro del quadretto più vicino (una creatura di dimensione pari, come «Grande», si aggancia agli incroci).
function agganciaSeg(s, m) {
  if (!B.aggancia || !m || !m.larghezza_m) return;
  var cx = CELLA_M / Number(m.larghezza_m), cy = cx * m.larghezza_px / m.altezza_px, pari = Math.round(Number(s.taglia)) % 2 === 0 && Number(s.taglia) >= 2;
  var snap = function (v, c) { return pari ? Math.round(v / c) * c : (Math.floor(v / c) + 0.5) * c; };
  s.x = limita(snap(Number(s.x), cx), 0, 1); s.y = limita(snap(Number(s.y), cy), 0, 1);
  var el = document.querySelector('.tk[data-id="' + s.id + '"]');
  if (el) { el.style.left = s.x * 100 + "%"; el.style.top = s.y * 100 + "%"; }
}

// ---------------------------------------------------------------- aree d'effetto
// Si vedono solo a te e non si salvano: servono per vedere chi sta dentro un cono o una palla di fuoco. Esc le toglie.
var NOMI_AREA = { cerchio: "Cerchio", cono: "Cono", quadrato: "Quadrato", linea: "Linea" };
function svgArea(a, Wp, Hp, ppm) {
  var x = a.x * Wp, y = a.y * Hp, L = a.len * ppm, c = Math.cos(a.ang), s = Math.sin(a.ang), nx = -s, ny = c, forma, tx = x, ty = y;
  var pt = function (px, py) { return Math.round(px * 10) / 10 + "," + Math.round(py * 10) / 10; };
  if (a.f === "cerchio") forma = '<circle cx="' + x + '" cy="' + y + '" r="' + L + '"/>';
  else if (a.f === "quadrato") forma = '<rect x="' + (x - L / 2) + '" y="' + (y - L / 2) + '" width="' + L + '" height="' + L + '"/>';
  else if (a.f === "cono") {          // alla fine è largo quanto è lungo
    var ex = x + c * L, ey = y + s * L; tx = (x + ex) / 2; ty = (y + ey) / 2;
    forma = '<polygon points="' + pt(x, y) + " " + pt(ex + nx * L / 2, ey + ny * L / 2) + " " + pt(ex - nx * L / 2, ey - ny * L / 2) + '"/>';
  } else {                            // linea: larga CELLA_M
    var h = CELLA_M * ppm / 2, ex2 = x + c * L, ey2 = y + s * L; tx = (x + ex2) / 2; ty = (y + ey2) / 2;
    forma = '<polygon points="' + pt(x + nx * h, y + ny * h) + " " + pt(ex2 + nx * h, ey2 + ny * h) + " " + pt(ex2 - nx * h, ey2 - ny * h) + " " + pt(x - nx * h, y - ny * h) + '"/>';
  }
  return '<g class="area">' + forma + '<text x="' + tx + '" y="' + ty + '" font-size="' + Wp * 0.02 + '">' + esc(NOMI_AREA[a.f] + " " + etichettaDistanza(a.len)) + "</text></g>";
}
function disegnaAree(m) {
  var g = $("#aree");
  if (!g) return;
  var lista = (B.aree || []).concat(B.areaDraw ? [B.areaDraw.area] : []);
  if (!m || !m.larghezza_m || !lista.length) { g.innerHTML = ""; return; }
  var ppm = m.larghezza_px / Number(m.larghezza_m);
  g.innerHTML = '<svg viewBox="0 0 ' + m.larghezza_px + " " + m.altezza_px + '" preserveAspectRatio="none">' + lista.map(function (a) { return svgArea(a, m.larghezza_px, m.altezza_px, ppm); }).join("") + "</svg>";
}
function avviaArea(e, p, m) {
  if (!m.larghezza_m) { toast("Per le aree serve la scala della mappa: il master deve calibrarla.", true); return; }
  B.areaDraw = { area: { f: B.area.forma, x: limita(p.x, 0, 1), y: limita(p.y, 0, 1), ang: 0, len: B.area.len }, x0: p.x, y0: p.y };
  bCattura(e); disegnaAree(m);
}
// Cerchio e quadrato: trascinando si sposta il centro. Cono e linea: il punto di partenza resta fermo e trascinando si gira.
function muoviArea(p, m) {
  var a = B.areaDraw.area;
  if (a.f === "cerchio" || a.f === "quadrato") { a.x = limita(p.x, 0, 1); a.y = limita(p.y, 0, 1); }
  else {
    var dx = (p.x - B.areaDraw.x0) * m.larghezza_px, dy = (p.y - B.areaDraw.y0) * m.altezza_px;
    if (Math.hypot(dx, dy) > 4) a.ang = Math.atan2(dy, dx);
  }
  disegnaAree(m);
}
function finisciArea() {
  var d = B.areaDraw; B.areaDraw = null;
  if (d) { B.aree.push(d.area); if (B.aree.length > MAX_AREE) B.aree.shift(); }
  disegnaAree(mappaVista()); aggiornaAttrezzi();
}

// ---------------------------------------------------------------- annulla l'ultimo spostamento
function registraAnnulla(voce) {
  B.annulla.push(voce);
  if (B.annulla.length > MAX_ANNULLA) B.annulla.shift();
  aggiornaAttrezzi();
}
function annullaSpostamento() {
  var m = mappaVista(), voce = B.annulla.pop();
  if (!voce || !m) { aggiornaAttrezzi(); return; }
  voce.forEach(function (t) {
    var s = segnalinoPerId(t.id);
    if (!s || !possoMuovere(s)) return;
    s.x = t.x; s.y = t.y; bInvia(s);
  });
  disegnaSegnalini(m); aggiornaAttrezzi(); toast("Spostamento annullato");
}

// ---------------------------------------------------------------- centra
function centraSu(s) {
  var sc = $("#scena"), W = sc.clientWidth, H = sc.clientHeight, z = Math.max(B.zoom.z, 2);
  B.zoom.z = z; B.zoom.x = W / 2 - Number(s.x) * W * z; B.zoom.y = H / 2 - Number(s.y) * H * z;
  applicaZoom(); aggiornaAttrezzi();
}
function segnalinoDaCentrare(m) {
  var s = B.sel ? segnalinoPerId(B.sel) : null;
  if (s && s.mappa_id === m.id) return s;
  s = B.stato && B.stato.turno_segnalino_id ? segnalinoPerId(B.stato.turno_segnalino_id) : null;
  if (s && s.mappa_id === m.id) return s;
  return segnaliniDi(m).filter(possoMuovere)[0] || null;      // un giocatore: il suo
}

// ---------------------------------------------------------------- pulsanti
function aggiornaAttrezzi() {
  var t = $("#attrezzi");
  if (!t) return;
  var pr = function (sel, on) { var e = t.querySelector(sel); if (e) e.setAttribute("aria-pressed", on ? "true" : "false"); };
  pr('[data-b="mano"]', B.mano); pr('[data-b="griglia"]', B.griglia); pr('[data-b="aggancia"]', B.aggancia); pr('[data-b="aree"]', B.area.attiva);
  $("#zoomPct").textContent = Math.round(B.zoom.z * 100) + "%";
  t.querySelector('[data-b="annulla"]').disabled = !B.annulla.length;
  t.querySelector(".rigaB").hidden = !B.area.attiva || B.attrezziChiusi;
  t.querySelector(".rigaA").hidden = !!B.attrezziChiusi;
  var rid = t.querySelector(".riduci"); rid.setAttribute("aria-expanded", B.attrezziChiusi ? "false" : "true"); rid.textContent = B.attrezziChiusi ? "Strumenti ▴" : "Strumenti ▾";
  Array.prototype.forEach.call(t.querySelectorAll('[data-b="areaForma"]'), function (b) { b.setAttribute("aria-pressed", b.dataset.f === B.area.forma ? "true" : "false"); });
  var inp = $("#areaLen");
  if (inp && document.activeElement !== inp) inp.value = String(Math.round(distShow(B.area.len) * 10) / 10);
  $("#unitaArea").textContent = distUnit();
  $("#scena").classList.toggle("mano", !!B.mano || (!!B.spazio && B.zoom.z > 1));
}
// Dopo ogni ridisegno della scena. Cambiando mappa gli strumenti ripartono da capo.
function aggiornaStrumenti(m) {
  if (m && B.ultimaMappa !== m.id) { B.ultimaMappa = m.id; azzeraStrumenti(); B.griglia = B.aggancia = false; B.area.attiva = false; }
  applicaZoom(); disegnaGriglia(m); disegnaAree(m); aggiornaAttrezzi();
}
function nonServeScala(m) {
  if (m && m.larghezza_m) return false;
  toast(bMaster() ? "Prima calibra la scala della mappa (pulsante «Calibra scala»)." : "Il master non ha ancora calibrato la scala di questa mappa.", true);
  return true;
}
function azioneStrumenti(a, b) {
  var m = mappaVista();
  if (a === "attrezziRiduci") { B.attrezziChiusi = !B.attrezziChiusi; aggiornaAttrezzi(); return true; }
  if (a === "zoomPiu") { zoomCentro(B.zoom.z * 1.4); return true; }
  if (a === "zoomMeno") { zoomCentro(B.zoom.z / 1.4); return true; }
  if (a === "zoomAdatta") { B.zoom = { z: 1, x: 0, y: 0 }; applicaZoom(); aggiornaAttrezzi(); return true; }
  if (a === "mano") { B.mano = !B.mano; aggiornaAttrezzi(); return true; }
  if (a === "centra") {
    var s = m ? segnalinoDaCentrare(m) : null;
    if (!s) toast("Seleziona un segnalino da centrare.", true); else centraSu(s);
    return true;
  }
  if (a === "griglia") {
    if (!B.griglia && nonServeScala(m)) return true;
    B.griglia = !B.griglia; disegnaGriglia(m); aggiornaAttrezzi(); return true;
  }
  if (a === "aggancia") {
    if (!B.aggancia && nonServeScala(m)) return true;
    B.aggancia = !B.aggancia; aggiornaAttrezzi(); return true;
  }
  if (a === "aree") {
    if (!B.area.attiva && nonServeScala(m)) return true;
    B.area.attiva = !B.area.attiva;
    if (B.area.attiva) { B.righello = false; B.calibra = false; B.linea = null; disegna(); }
    aggiornaAttrezzi(); return true;
  }
  if (a === "areaForma") { B.area.forma = b.dataset.f; aggiornaAttrezzi(); return true; }
  if (a === "areaPulisci") { B.aree = []; disegnaAree(m); return true; }
  if (a === "annulla") { annullaSpostamento(); return true; }
  return false;
}

function iniziaStrumenti() {
  collegaTocchi();
  var t = $("#attrezzi");
  ["pointerdown", "wheel"].forEach(function (ev) { t.addEventListener(ev, function (e) { e.stopPropagation(); }); });
  document.addEventListener("input", function (e) {
    if (e.target.id !== "areaLen") return;
    var v = Number(String(e.target.value).replace(",", "."));
    if (v > 0) B.area.len = distM(v);
  });
  var scrivo = function () { var a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT"); };
  document.addEventListener("keydown", function (e) {
    if (document.querySelector("dialog[open]")) return;
    if (e.code === "Space" && !scrivo() && !e.repeat) { B.spazio = true; aggiornaAttrezzi(); if (B.zoom.z > 1) e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !scrivo()) { e.preventDefault(); annullaSpostamento(); }
    if (e.key === "Escape" && !e.__gestito && (B.aree.length || B.area.attiva)) {      // Esc: prima la selezione (selezione.js), poi le aree
      B.aree = []; B.area.attiva = false; B.areaDraw = null; disegnaAree(mappaVista()); aggiornaAttrezzi();
    }
  });
  document.addEventListener("keyup", function (e) { if (e.code === "Space") { B.spazio = false; aggiornaAttrezzi(); } });
  window.addEventListener("blur", function () { B.spazio = false; });
}
