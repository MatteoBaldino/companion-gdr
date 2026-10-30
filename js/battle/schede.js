/* =====================================================================
   js/battle/schede.js
   Cosa fa:   Le schede dentro la Battle map: a destra la scheda del PG
              (il master sceglie quale, un giocatore ha la sua), a sinistra
              la scheda dell'NPC scelto (solo master). Sono le stesse schede
              del sito principale, con gli stessi pulsanti per i dadi.
   Contiene:  chiaveSegnalino, selezionaScheda, iniziaSchede, disegnaTab,
              disegnaPannelli, aggiornaSchede, azioneSchede, htmlToken,
              aggiornaToken, aggiungiToken, nascondiToken, impostaIniziativaDaTiro,
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
  S.dadiSemplificata = true;   // anche gli NPC con scheda semplificata hanno i dadi, come i PG
  S.senzaRiquadro = true;      // il risultato dei dadi si vede sopra la mappa, non dentro la scheda
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

// Accanto al nome di ogni personaggio c'è «+»: mette un suo token sulla mappa (lo può fare solo il master; il giocatore ha il suo «+» nella striscia dei token).
function elencoTab(lista, sel, azione) {
  return '<div class="ptabs" role="group" aria-label="Scelta della scheda">' + lista.map(function (h) {
    return '<span class="ptab"><button type="button" data-b="' + azione + '" data-key="' + h.key + '" aria-pressed="' + (h.key === sel) + '">' + esc(h.nome) + "</button>" +
      '<button type="button" class="plus" data-b="tokAdd" data-key="' + h.key + '" aria-label="Aggiungi un token di ' + esc(h.nome) + ' alla mappa" title="Aggiungi un token alla mappa">+</button></span>';
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
    dx.innerHTML = '<h2 class="ptit">Scheda giocatori</h2>' + (pg.length ? elencoTab(pg, B.pgSel, "pgSel") + (B.pgSel ? '<div class="tokbox" data-key="' + B.pgSel + '"></div>' + htmlScheda(B.pgSel, false) : "") : '<p class="hint">Non ci sono ancora PG nella campagna.</p>');
    sx.innerHTML = '<h2 class="ptit">Scheda NPC / Mostri</h2>' + (np.length ? elencoTab(np, B.npcSel, "npcSel") + (B.npcSel ? '<div class="tokbox" data-key="' + B.npcSel + '"></div>' + htmlScheda(B.npcSel, false) : "")
      : '<p class="hint">Non ci sono NPC. Aggiungili dal sito principale, nella scheda Personaggi.</p>');
    sx.hidden = false;
  } else {
    dx.innerHTML = '<h2 class="ptit">La tua scheda</h2><div class="tokbox" data-key="g:' + B.me.id + '"></div>' + htmlScheda("g:" + B.me.id, false);
    if (sx) { sx.hidden = true; sx.innerHTML = ""; }
  }
  dx.scrollTop = sDx; if (sx) sx.scrollTop = sSx;
  aggiornaToken();
  if (typeof syncTenda === "function") syncTenda();     // il tiro libero di un giocatore dipende da come il master ha impostato la sua scheda
}

// ---------------------------------------------------------------- iniziativa dalla scheda
// Toccando «Iniziativa» nella scheda, il risultato entra nell'ordine dell'iniziativa: nei token di quel personaggio sulla mappa dell'elenco.
// Se hai selezionato uno dei suoi token vale per quello, altrimenti per tutti i suoi token (un giocatore può cambiare solo i propri).
function impostaIniziativaDaTiro(t) {
  var m = bMaster() ? mappaScena() : mappaVista(), nome = (t.ini && t.ini.nome) || "";
  if (!m || !t.ini) { toast("Iniziativa " + t.tot + ": per metterla nell’ordine serve una mappa in scena.", true); return; }
  var suoi = tokenDi(t.ini.key, m).filter(possoMuovere);
  if (!suoi.length) { toast("Iniziativa " + t.tot + ": " + nome + " non ha token sulla mappa, quindi non entra nell’ordine.", true); return; }
  var sel = suoi.filter(function (x) { return x.id === B.sel; })[0], bers = sel ? [sel] : suoi;
  bers.reduce(function (prec, x) { return prec.then(function () { return call("imposta_iniziativa", { p_id: x.id, p_valore: t.tot }); }); }, Promise.resolve())
    .then(function () { toast("Iniziativa " + t.tot + " segnata per " + (bers.length === 1 ? bers[0].nome : nome)); return ricaricaBattle(); },
          function (e) { toast(errText(e), true); });
}

// Aggiungere un token: se il database non ha ancora l'aggiornamento risponde «già sulla mappa» e lo spieghiamo.
function aggiungiSegnalinoDb(p) {
  return call("aggiungi_segnalino", { p: p }).catch(function (e) {
    if (e && /già sulla mappa/i.test(e.message || "")) throw { message: "Per mettere più token dello stesso personaggio esegui prima aggiornamento_token_multipli.sql in Supabase." };
    throw e;
  });
}

// ---------------------------------------------------------------- token del personaggio
// Un personaggio può avere più token sulla stessa mappa (Goblin, Goblin 2…): toccandone uno si apre sempre la stessa scheda.
// Aggiungerli: il master per chiunque, un giocatore solo per il proprio PG (gli NPC solo il master). Nasconderli: solo il master.
// Il database ricontrolla tutte queste regole (aggiornamento_token_multipli.sql).
var OCCHIO = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6S3.5 13.8 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
var OCCHIO_NO = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.2A9.8 9.8 0 0112 6c5 0 8.5 4.2 9.5 6-.5 1-1.6 2.6-3.2 3.9M6.6 7.6C4.6 9 3.3 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.4 0 2.7-.3 3.8-.8"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>';

function tokenDi(key, m) { return segnaliniDi(m).filter(function (s) { return chiaveSegnalino(s) === key; }); }
function possoAggiungereToken(key) { return bMaster() || key === "g:" + B.me.id; }
function possoTogliereToken(s) { return bMaster() || (s.giocatore_id != null && s.giocatore_id === B.me.id); }

// La striscia sopra la scheda: i token di quel personaggio sulla mappa che stai guardando.
function htmlToken(key) {
  var m = mappaVista(), lista = m ? tokenDi(key, m) : [];
  var h = '<div class="tokstrip" role="group" aria-label="Token sulla mappa"><span class="lbl">Token</span>';
  if (!lista.length) h += '<span class="hint">nessuno su questa mappa</span>';
  lista.forEach(function (s) {
    h += '<span class="tokchip' + (s.nascosto ? " nasc" : "") + (B.sel === s.id ? " sel" : "") + '"><button type="button" class="nm" data-b="tokSel" data-id="' + s.id + '" title="Evidenzia sulla mappa">' + esc(s.nome) + "</button>" +
      (bMaster() ? '<button type="button" class="eye" data-b="tokHide" data-id="' + s.id + '" aria-pressed="' + !!s.nascosto + '" aria-label="' + (s.nascosto ? "Mostra ai giocatori " : "Nascondi ai giocatori ") + esc(s.nome) + '" title="' + (s.nascosto ? "Nascosto ai giocatori: tocca per mostrarlo" : "Visibile ai giocatori: tocca per nasconderlo") + '">' + (s.nascosto ? OCCHIO_NO : OCCHIO) + "</button>" : "") +
      (possoTogliereToken(s) ? '<button type="button" class="del" data-b="tokDel" data-id="' + s.id + '" aria-label="Togli ' + esc(s.nome) + ' dalla mappa" title="Togli dalla mappa">×</button>' : "") + "</span>";
  });
  if (m && possoAggiungereToken(key)) h += '<button type="button" class="tokadd" data-b="tokAdd" data-key="' + key + '">+ Token</button>';
  return h + "</div>";
}
function aggiornaToken() {
  Array.prototype.forEach.call(document.querySelectorAll(".tokbox"), function (el) { el.innerHTML = htmlToken(el.dataset.key); });
}
function aggiungiToken(key) {
  var m = mappaVista();
  if (!m) { toast("Non c’è una mappa su cui mettere il token.", true); return; }
  if (!possoAggiungereToken(key)) { toast("Puoi aggiungere solo token del tuo personaggio.", true); return; }
  var p = { campagna_id: bCamp(), mappa_id: m.id, x: 0.5, y: 0.5 }, gia = tokenDi(key, m);
  if (gia.length) { var u = gia[gia.length - 1]; p.x = Math.min(0.97, Number(u.x) + 0.04); p.y = Math.min(0.97, Number(u.y) + 0.04); }   // accanto all'ultimo token di quel personaggio
  if (key.charAt(0) === "g") p.giocatore_id = Number(key.slice(2)); else p.png_id = Number(key.slice(2));
  run(function () { return aggiungiSegnalinoDb(p); }, "Token aggiunto").then(function (r) { if (r) ricaricaBattle(); });
}
function nascondiToken(id) {
  var s = segnalinoPerId(id); if (!s || !bMaster()) return;
  run(function () { return call("imposta_segnalino", { p_id: s.id, p: { nascosto: !s.nascosto } }); },
    s.nascosto ? "Token mostrato ai giocatori" : "Token nascosto ai giocatori").then(function (r) { if (r) ricaricaBattle(); });
}

// ---------------------------------------------------------------- pulsanti
// Restituisce vero se il pulsante era uno di questi (scelta della scheda).
function azioneSchede(a, b) {
  if (a === "tokAdd") { aggiungiToken(b.dataset.key); return true; }
  if (a === "tokHide") { nascondiToken(b.dataset.id); return true; }
  if (a === "tokDel") { var t = segnalinoPerId(b.dataset.id); if (t) eliminaSegnalinoDlg(t); return true; }
  if (a === "tokSel") { B.sel = Number(b.dataset.id); disegnaSegnalini(mappaVista()); return true; }
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
