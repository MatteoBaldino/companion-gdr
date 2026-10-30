/* =====================================================================
   js/battle/schede.js
   Cosa fa:   Le schede dentro la Battle map: a destra la scheda del PG
              (il master sceglie quale, un giocatore ha la sua), a sinistra
              la scheda dell'NPC scelto (solo master). Sono le stesse schede
              del sito principale, con gli stessi pulsanti per i dadi.
   Contiene:  chiaveSegnalino, selezionaScheda, iniziaSchede, disegnaTab,
              disegnaPannelli, aggiornaSchede, azioneSchede
   Le schede del sito usano lo stato «S» e la funzione disegnaTab: qui S si
   riempie con i dati della campagna e disegnaTab ridisegna i due pannelli.
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- quale scheda
// Un segnalino collegato a un PG o a un NPC ha la sua scheda: «g:12» è un PG, «p:3» è un NPC (come nel sito principale).
function chiaveSegnalino(s) {
  if (s.giocatore_id != null) return "g:" + s.giocatore_id;
  if (s.png_id != null) return "p:" + s.png_id;
  return null;
}
// Toccando un segnalino si apre la sua scheda (il master sceglie così, un giocatore ha comunque solo la propria).
function selezionaScheda(s) {
  var k = chiaveSegnalino(s); if (!k) return;
  if (k.charAt(0) === "g") B.pgSel = k; else B.npcSel = k;
  disegnaPannelli();
}

// ---------------------------------------------------------------- dati
function iniziaSchede() {
  S.user = B.user; S.me = B.me; S.mems = B.mems; S.oggOk = false;
  return caricaDati().then(function () {
    disegnaPannelli();
    setInterval(aggiornaSchede, 20000);
  });
}
// Come nel sito principale: ogni 20 secondi si rileggono i dati, ma non mentre stai scrivendo o hai una tendina aperta.
function aggiornaSchede() {
  if (!S.me || document.querySelector("dialog[open]")) return;
  var a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest(".pannello")) return;
  if (document.querySelector(".pannello details[open]")) return;
  caricaDati().then(disegnaPannelli);
}

// ---------------------------------------------------------------- disegno
// Le schede del sito chiamano disegnaTab() ogni volta che qualcosa cambia: qui ridisegna i due pannelli.
function disegnaTab() { disegnaPannelli(); }

function elencoTab(lista, sel, azione) {
  return '<div class="ptabs" role="group" aria-label="Scelta della scheda">' + lista.map(function (h) {
    return '<button type="button" data-b="' + azione + '" data-key="' + h.key + '" aria-pressed="' + (h.key === sel) + '">' + esc(h.nome) + "</button>";
  }).join("") + "</div>";
}
function disegnaPannelli() {
  var dx = $("#pannelloPg"), sx = $("#pannelloNpc");
  if (!dx || !S.me) return;
  var tengo = function (el) { return el ? el.scrollTop : 0; }, sDx = tengo(dx), sSx = tengo(sx);
  if (bMaster()) {
    var hs = holders(), pg = hs.filter(function (h) { return h.key.charAt(0) === "g"; }), np = hs.filter(function (h) { return h.key.charAt(0) === "p"; });
    if (!pg.some(function (h) { return h.key === B.pgSel; })) B.pgSel = pg.length ? pg[0].key : null;
    if (!np.some(function (h) { return h.key === B.npcSel; })) B.npcSel = np.length ? np[0].key : null;
    dx.innerHTML = '<h2 class="ptit">Scheda giocatori</h2>' + (pg.length ? elencoTab(pg, B.pgSel, "pgSel") + (B.pgSel ? htmlScheda(B.pgSel, false) : "") : '<p class="hint">Non ci sono ancora PG nella campagna.</p>');
    sx.innerHTML = '<h2 class="ptit">Scheda NPC / Mostri</h2>' + (np.length ? elencoTab(np, B.npcSel, "npcSel") + (B.npcSel ? htmlScheda(B.npcSel, false) : "")
      : '<p class="hint">Non ci sono NPC. Aggiungili dal sito principale, nella scheda Personaggi.</p>');
    sx.hidden = false;
  } else {
    dx.innerHTML = '<h2 class="ptit">La tua scheda</h2>' + htmlScheda("g:" + B.me.id, false);
    if (sx) { sx.hidden = true; sx.innerHTML = ""; }
  }
  dx.scrollTop = sDx; if (sx) sx.scrollTop = sSx;
  if (typeof syncTenda === "function") syncTenda();     // il tiro libero di un giocatore dipende da come il master ha impostato la sua scheda
}

// ---------------------------------------------------------------- pulsanti
// Restituisce vero se il pulsante era uno di questi (scelta della scheda).
function azioneSchede(a, b) {
  if (a === "pgSel") { B.pgSel = b.dataset.key; disegnaPannelli(); return true; }
  if (a === "npcSel") { B.npcSel = b.dataset.key; disegnaPannelli(); return true; }
  return false;
}

// I pulsanti delle schede usano data-act (come nel sito principale); quelli della Battle map usano data-b.
document.addEventListener("click", function (e) {
  var b = e.target.closest("[data-act]");
  if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b);
});
document.addEventListener("submit", function (e) {
  var f = e.target.closest("form[data-form]");
  if (f && FORMS[f.dataset.form]) { e.preventDefault(); FORMS[f.dataset.form](f); }
});
// Dalla tastiera: Invio o spazio su una casella che si può tirare (come nel sito principale lo fa dadi.js: qui non serve ripeterlo).
