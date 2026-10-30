/* =====================================================================
   js/battle/trascina.js
   Cosa fa:   Spostare i segnalini con il mouse o con il dito; un tocco
              apre la finestra del segnalino.
   Contiene:  SOGLIA_PX, fra01, bPosizione, bCattura, bGiu, bMuovi, bSu,
              bInvia
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- spostare i segnalini
// Un tocco senza muoversi apre la finestra del segnalino; trascinare lo sposta.
var SOGLIA_PX = 5;           // [MODIFICA QUI] di quanto bisogna muoversi perché sia un trascinamento e non un tocco
var fra01 = function (v) { return Math.min(1, Math.max(0, v)); };

function bPosizione(e) {
  var r = $("#scena").getBoundingClientRect();
  return { x: (e.clientX - r.left) / (r.width || 1), y: (e.clientY - r.top) / (r.height || 1), r: r };
}
function bCattura(e) { var sc = $("#scena"); if (sc.setPointerCapture && e.pointerId != null) { try { sc.setPointerCapture(e.pointerId); } catch (x) {} } }

function bGiu(e) {
  var m = mappaVista(); if (!m) return;
  var tk = e.target.closest(".tk"), p = bPosizione(e);
  if (tk) {
    var s = segnalinoPerId(tk.dataset.id); if (!s) return;
    B.sel = s.id;
    selezionaScheda(s);                     // si apre la scheda del segnalino toccato
    if (!possoMuovere(s)) { toast("Puoi muovere solo il tuo segnalino.", true); return; }
    B.drag = { id: s.id, el: tk, x0: p.x, y0: p.y, mosso: false, ultimo: 0 };
    bCattura(e);
    return;
  }
  if (B.righello || B.calibra) {
    B.linea = { x1: p.x, y1: p.y, x2: p.x, y2: p.y, m: m, attiva: true };
    bCattura(e); disegnaLinea();
  }
}

function bMuovi(e) {
  var p = bPosizione(e);
  if (B.drag) {
    var s = segnalinoPerId(B.drag.id); if (!s) return;
    if (!B.drag.mosso && Math.hypot((p.x - B.drag.x0) * p.r.width, (p.y - B.drag.y0) * p.r.height) < SOGLIA_PX) return;
    B.drag.mosso = true;
    s.x = fra01(p.x); s.y = fra01(p.y);
    B.drag.el.style.left = s.x * 100 + "%"; B.drag.el.style.top = s.y * 100 + "%";
    // Mentre trascini gli altri ti vedono muovere: si manda la posizione ogni 150 millisecondi.
    if (Date.now() - B.drag.ultimo > 150) { B.drag.ultimo = Date.now(); bInvia(s); }
  } else if (B.linea && B.linea.attiva) {
    B.linea.x2 = p.x; B.linea.y2 = p.y; disegnaLinea();
  }
}

function bSu() {
  if (B.drag) {
    var d = B.drag, s = segnalinoPerId(d.id);
    B.drag = null;
    if (s && d.mosso) bInvia(s); else if (s) apriSegnalino(s);
    if (B.rinvia) disegna();
  } else if (B.linea && B.linea.attiva) {
    B.linea.attiva = false;
    if (B.calibra) chiediCalibrazione();
  }
}

// Le posizioni partono una dopo l'altra, in fila: l'ultima ad arrivare è sempre quella finale.
function bInvia(s) {
  var x = Math.round(s.x * 1e6) / 1e6, y = Math.round(s.y * 1e6) / 1e6;
  B.coda = (B.coda || Promise.resolve()).then(function () { return call("muovi_segnalino", { p_id: s.id, p_x: x, p_y: y }); })
    .catch(function (e) { toast(errText(e), true); ricaricaBattle(); });
}
