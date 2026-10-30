/* =====================================================================
   js/battle/trascina.js
   Cosa fa:   Spostare i segnalini con il mouse o con il dito; un tocco
              apre la finestra del segnalino.
   Contiene:  SOGLIA_PX, fra01, bPosizione, bCattura, bGiu, spostaGruppo,
              bMuovi, bSu, bInvia
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
  var tk = e.target.closest(".tk"), p = bPosizione(e), tasto = e.ctrlKey || e.shiftKey || e.metaKey;
  if (tk) {
    var s = segnalinoPerId(tk.dataset.id); if (!s) return;
    // Selezione multipla: Ctrl o Maiusc + tocco, oppure il pulsante «Selezione multipla» acceso. Ogni tocco aggiunge o toglie il segnalino.
    if (tasto || B.modoMulti) {
      if (!possoMuovere(s)) { toast("Puoi selezionare solo il tuo segnalino.", true); return; }
      commutaMulti(s); aggiornaSelezione(); return;
    }
    B.sel = s.id;
    selezionaScheda(s);                     // si apre la scheda del segnalino toccato
    if (!possoMuovere(s)) { toast("Puoi muovere solo il tuo segnalino.", true); return; }
    // Se il segnalino fa parte di un gruppo selezionato, trascinandolo si spostano tutti insieme.
    var gruppo = null;
    if (inMulti(s.id) && nMulti() > 1) {
      gruppo = segMulti().filter(possoMuovere).map(function (x) { return { id: x.id, x0: Number(x.x), y0: Number(x.y) }; });
    } else if (nMulti()) {
      svuotaMulti(); aggiornaSelezione();
      tk = document.querySelector('.tk[data-id="' + s.id + '"]') || tk;      // la selezione ha ridisegnato i segnalini
    }
    B.drag = { id: s.id, el: tk, x0: p.x, y0: p.y, mosso: false, ultimo: 0, gruppo: gruppo };
    bCattura(e);
    return;
  }
  if (B.righello || B.calibra) {
    B.linea = { x1: p.x, y1: p.y, x2: p.x, y2: p.y, m: m, attiva: true };
    bCattura(e); disegnaLinea();
    return;
  }
  // Trascinando su un punto vuoto si disegna un rettangolo: i segnalini dentro vengono selezionati.
  B.box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, attiva: true, aggiungi: tasto };
  bCattura(e);
}

// Sposta tutto il gruppo dello stesso scarto; nessuno esce dalla mappa.
function spostaGruppo(p) {
  var g = B.drag.gruppo, dx = p.x - B.drag.x0, dy = p.y - B.drag.y0, mn = [1, 1], mx = [0, 0];
  g.forEach(function (t) { mn[0] = Math.min(mn[0], t.x0); mn[1] = Math.min(mn[1], t.y0); mx[0] = Math.max(mx[0], t.x0); mx[1] = Math.max(mx[1], t.y0); });
  dx = Math.max(-mn[0], Math.min(1 - mx[0], dx)); dy = Math.max(-mn[1], Math.min(1 - mx[1], dy));
  g.forEach(function (t) {
    var s = segnalinoPerId(t.id), el = document.querySelector('.tk[data-id="' + t.id + '"]');
    if (!s) return;
    s.x = t.x0 + dx; s.y = t.y0 + dy;
    if (el) { el.style.left = s.x * 100 + "%"; el.style.top = s.y * 100 + "%"; }
  });
}

function bMuovi(e) {
  var p = bPosizione(e);
  if (B.drag) {
    var s = segnalinoPerId(B.drag.id); if (!s) return;
    if (!B.drag.mosso && Math.hypot((p.x - B.drag.x0) * p.r.width, (p.y - B.drag.y0) * p.r.height) < SOGLIA_PX) return;
    B.drag.mosso = true;
    if (B.drag.gruppo) { spostaGruppo(p); return; }       // il gruppo si invia alla fine
    s.x = fra01(p.x); s.y = fra01(p.y);
    B.drag.el.style.left = s.x * 100 + "%"; B.drag.el.style.top = s.y * 100 + "%";
    // Mentre trascini gli altri ti vedono muovere: si manda la posizione ogni 150 millisecondi.
    if (Date.now() - B.drag.ultimo > 150) { B.drag.ultimo = Date.now(); bInvia(s); }
  } else if (B.linea && B.linea.attiva) {
    B.linea.x2 = p.x; B.linea.y2 = p.y; disegnaLinea();
  } else if (B.box && B.box.attiva) {
    B.box.x1 = fra01(p.x); B.box.y1 = fra01(p.y); disegnaMarquee();
  }
}

function bSu() {
  if (B.drag) {
    var d = B.drag, s = segnalinoPerId(d.id);
    B.drag = null;
    if (d.gruppo && d.mosso) d.gruppo.forEach(function (t) { var x = segnalinoPerId(t.id); if (x) bInvia(x); });
    else if (s && d.mosso) bInvia(s);
    else if (s) { if (d.gruppo) { svuotaMulti(); aggiornaSelezione(); } apriSegnalino(s); }
    if (B.rinvia) disegna();
  } else if (B.linea && B.linea.attiva) {
    B.linea.attiva = false;
    if (B.calibra) chiediCalibrazione();
  } else if (B.box && B.box.attiva) {
    B.box.attiva = false;
    chiudiMarquee();
  }
}

// Le posizioni partono una dopo l'altra, in fila: l'ultima ad arrivare è sempre quella finale.
function bInvia(s) {
  var x = Math.round(s.x * 1e6) / 1e6, y = Math.round(s.y * 1e6) / 1e6;
  B.coda = (B.coda || Promise.resolve()).then(function () { return call("muovi_segnalino", { p_id: s.id, p_x: x, p_y: y }); })
    .catch(function (e) { toast(errText(e), true); ricaricaBattle(); });
}
