/* =====================================================================
   js/battle/selezione.js
   Cosa fa:   Selezionare più segnalini alla volta: Ctrl o Maiusc + tocco, il
              pulsante «Selezione multipla» (per il touch) oppure un rettangolo
              trascinato sulla mappa. I segnalini scelti si spostano insieme
              (trascina uno di loro). Il master li nasconde, li mostra o li toglie;
              un giocatore può selezionare, spostare e togliere solo i propri.
   Contiene:  inMulti, nMulti, segMulti, svuotaMulti, commutaMulti,
              aggiornaSelezione, disegnaMarquee, chiudiMarquee, aggiornaMultiBar,
              azioneMulti
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- chi è selezionato
function inMulti(id) { return !!(B.multi && B.multi[id]); }
function nMulti() { return B.multi ? Object.keys(B.multi).length : 0; }
function segMulti() { return Object.keys(B.multi || {}).map(segnalinoPerId).filter(Boolean); }
function svuotaMulti() { B.multi = {}; }
function commutaMulti(s) {
  B.multi = B.multi || {};
  if (B.multi[s.id]) delete B.multi[s.id]; else B.multi[s.id] = true;
}
// Ridisegna i segnalini (con il contorno dei selezionati) e la barra con i pulsanti del gruppo.
function aggiornaSelezione() {
  var m = mappaVista();
  if (m) disegnaSegnalini(m);
  aggiornaMultiBar();
}

// ---------------------------------------------------------------- il rettangolo di selezione
function disegnaMarquee() {
  var el = $("#marq"), b = B.box;
  if (!el) return;
  if (!b || !b.attiva) { el.hidden = true; return; }
  el.hidden = false;
  el.style.left = Math.min(b.x0, b.x1) * 100 + "%"; el.style.top = Math.min(b.y0, b.y1) * 100 + "%";
  el.style.width = Math.abs(b.x1 - b.x0) * 100 + "%"; el.style.height = Math.abs(b.y1 - b.y0) * 100 + "%";
}
// Finito il trascinamento: si scelgono i segnalini dentro il rettangolo (solo quelli che puoi muovere). Un semplice tocco sul vuoto toglie la selezione.
function chiudiMarquee() {
  var b = B.box, m = mappaVista(); B.box = null; disegnaMarquee();
  if (!b || !m) return;
  var r = $("#scena").getBoundingClientRect();
  if (Math.hypot((b.x1 - b.x0) * r.width, (b.y1 - b.y0) * r.height) < SOGLIA_PX) {
    if (!b.aggiungi && nMulti()) { svuotaMulti(); aggiornaSelezione(); }
    return;
  }
  var x1 = Math.min(b.x0, b.x1), x2 = Math.max(b.x0, b.x1), y1 = Math.min(b.y0, b.y1), y2 = Math.max(b.y0, b.y1);
  if (!b.aggiungi) svuotaMulti();
  B.multi = B.multi || {};
  segnaliniDi(m).forEach(function (s) {
    if (possoMuovere(s) && Number(s.x) >= x1 && Number(s.x) <= x2 && Number(s.y) >= y1 && Number(s.y) <= y2) B.multi[s.id] = true;
  });
  aggiornaSelezione();
}

// ---------------------------------------------------------------- pulsanti del gruppo
// I pulsanti stanno sopra la mappa, in alto a sinistra: così la barra in basso non cambia altezza e la mappa non si sposta.
function aggiornaMultiBar() {
  var el = $("#multibar"), n = nMulti();
  if (!el) return;
  if (!n) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML = '<strong>' + n + (n === 1 ? " segnalino selezionato" : " segnalini selezionati") + "</strong>" +
    (bMaster() ? '<button data-b="multiNasc">Nascondi</button><button data-b="multiMostra">Mostra</button>' : "") +
    '<button class="danger" data-b="multiTogli">Togli dalla mappa</button><button data-b="multiNo">Deseleziona</button>';
}
function eseguiInFila(passi) {
  return passi.reduce(function (prec, st) { return prec.then(function () { return call(st[0], st[1]); }); }, Promise.resolve());
}
// Restituisce vero se il pulsante era uno di questi.
function azioneMulti(a, b) {
  if (a === "multi") { B.modoMulti = !B.modoMulti; disegna(); return true; }
  if (a === "multiNo") { svuotaMulti(); aggiornaSelezione(); return true; }
  if ((a === "multiNasc" || a === "multiMostra") && bMaster()) {
    var nasc = a === "multiNasc", lista = segMulti().filter(function (s) { return !!s.nascosto !== nasc; });
    if (!lista.length) { toast(nasc ? "Sono già tutti nascosti." : "Sono già tutti visibili."); return true; }
    eseguiInFila(lista.map(function (s) { return ["imposta_segnalino", { p_id: s.id, p: { nascosto: nasc } }]; })).then(
      function () { toast(lista.length + (nasc ? " nascosti ai giocatori" : " mostrati ai giocatori")); return ricaricaBattle(); },
      function (e) { toast(errText(e), true); ricaricaBattle(); });
    return true;
  }
  if (a === "multiTogli") {
    var gruppo = segMulti();
    modal("Togliere " + gruppo.length + (gruppo.length === 1 ? " segnalino" : " segnalini") + " dalla mappa?",
      "<p>Spariscono dalla mappa. I personaggi restano come sono: li puoi rimettere in qualsiasi momento.</p>",
      function () {
        return eseguiInFila(gruppo.map(function (s) { return ["elimina_segnalino", { p_id: s.id }]; })).then(
          function () { toast("Segnalini tolti"); svuotaMulti(); B.sel = null; return ricaricaBattle(); },
          function (e) { toast(errText(e), true); ricaricaBattle(); return false; });
      }, "Togli");
    return true;
  }
  return false;
}

// Esc toglie la selezione.
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && nMulti() && !document.querySelector("dialog[open]")) { svuotaMulti(); aggiornaSelezione(); }
});
