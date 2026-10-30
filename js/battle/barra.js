/* =====================================================================
   js/battle/barra.js
   Cosa fa:   Barra del master (mappe, scena, segnalini, scala) e barra
              semplificata del giocatore.
   Contiene:  MAX_MAPPE, aggiornaBarra, azioneBarra, impostaScena,
              cambioBarra, digitoBarra, salvaScalaSegnalini,
              chiediNomeMappa, aggiungiDaMenu
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- barra degli strumenti
// Il master vede le mappe, la scena, i segnalini e la scala. Un giocatore vede solo il righello.
var MAX_MAPPE = 10;          // lo stesso limite è nel database (salva_mappa)

function aggiornaBarra() {
  var b = $("#barra"), m = mappaVista();
  var righello = '<button class="tg" data-b="righello" aria-pressed="' + B.righello + '">Righello</button>';
  var dadi = '<button class="tg" data-b="tenda" aria-pressed="' + TI.tenda + '" aria-controls="tenda">Dadi</button>';
  if (!bMaster()) {
    b.innerHTML = '<div class="bar">' + righello + dadi +
      (m && m.larghezza_m ? '<span class="hint">La mappa è larga ' + dec(distShow(Number(m.larghezza_m))) + " " + distUnit() + ".</span>" : "") + "</div>";
    return;
  }
  var inScena = B.stato ? B.stato.mappa_id : null, visibile = !!(B.stato && B.stato.visibile);
  var pieno = B.mappe.length >= MAX_MAPPE;
  var h = '<div class="bar">' + B.mappe.map(function (x) {
    return '<button class="tab" data-b="vista" data-id="' + x.id + '" aria-current="' + !!(m && m.id === x.id) + '">' + esc(x.nome) +
      (inScena === x.id ? '<span class="badge' + (visibile ? "" : " grigio") + '">' + (visibile ? "in scena" : "scelta") + "</span>" : "") + "</button>";
  }).join("") + '<label class="btn file' + (pieno ? " spento" : "") + '" title="' + (pieno ? "Hai già " + MAX_MAPPE + " mappe" : "Carica un’immagine") + '">Nuova mappa' +
    '<input type="file" id="fileMappa" accept="image/*" hidden' + (pieno ? " disabled" : "") + "></label>" + dadi + "</div>";
  if (!m) { b.innerHTML = h; return; }
  var opt = function (pref) { return function (x) { return '<option value="' + pref + x.id + '">' + esc(x.nome) + "</option>"; }; };
  h += '<div class="bar">' +
    (inScena === m.id && visibile ? '<button data-b="nascondi">Nascondi ai giocatori</button>' : '<button class="primary" data-b="scena">Mostra ai giocatori</button>') +
    '<select id="aggiungiSel" aria-label="Aggiungi un segnalino"><option value="">Aggiungi segnalino…</option>' +
    (B.pg.length ? '<optgroup label="PG">' + B.pg.map(opt("g:")).join("") + "</optgroup>" : "") +
    (B.npc.length ? '<optgroup label="NPC">' + B.npc.map(opt("p:")).join("") + "</optgroup>" : "") +
    '<option value="gen">Segnalino generico…</option></select>' +
    '<button data-b="tuttiPg">Aggiungi tutti i PG</button>' + righello +
    '<button class="tg" data-b="calibra" aria-pressed="' + B.calibra + '">Calibra scala</button>' +
    '<label class="sl">Dimensione <input type="range" id="scalaSeg" min="1" max="12" step="0.5" value="' + Math.round(Number(m.scala_segnalini) * 1000) / 10 + '" aria-label="Dimensione dei segnalini"></label>' +
    '<button data-b="mappa" data-id="' + m.id + '">Mappa…</button></div>';
  h += '<p class="hint">' + (m.larghezza_m ? "Scala: la mappa è larga " + dec(distShow(Number(m.larghezza_m))) + " " + distUnit() + "." : "Scala non calibrata: il righello non può ancora misurare.") + "</p>";
  b.innerHTML = h;
}

// Pulsanti della barra. Restituisce vero se il pulsante era uno dei suoi.
function azioneBarra(a, b) {
  var m = mappaVista();
  if (a === "vista") { B.vista = Number(b.dataset.id); B.sel = null; B.linea = null; disegna(); return true; }
  if (a === "scena" && m) { impostaScena(m.id, true); return true; }
  if (a === "nascondi" && m) { impostaScena(m.id, false); return true; }
  if (a === "tuttiPg" && m) {
    run(function () { return call("aggiungi_pg_alla_mappa", { p_camp: bCamp(), p_mappa: m.id }); }).then(function (r) {
      if (!r) return;
      toast(r.v ? r.v + (r.v === 1 ? " PG aggiunto" : " PG aggiunti") + " alla mappa" : "Tutti i PG sono già sulla mappa");
      ricaricaBattle();
    });
    return true;
  }
  if (a === "righello") { B.righello = !B.righello; B.calibra = false; B.linea = null; disegna(); return true; }
  if (a === "calibra") { B.calibra = !B.calibra; B.righello = false; B.linea = null; disegna(); return true; }
  if (a === "mappa" && m) { apriMappa(m); return true; }
  return false;
}
function impostaScena(id, visibile) {
  run(function () { return call("imposta_scena", { p_camp: bCamp(), p_mappa: id, p_visibile: visibile }); },
    visibile ? "I giocatori vedono questa mappa" : "Mappa nascosta ai giocatori").then(function (r) { if (r) ricaricaBattle(); });
}

// Cambiamenti di menu e file nella barra.
function cambioBarra(e) {
  var t = e.target;
  if (t.id === "fileMappa" && t.files && t.files[0]) { var f = t.files[0]; t.value = ""; chiediNomeMappa(f); return true; }
  if (t.id === "aggiungiSel") { var v = t.value; t.value = ""; if (v) aggiungiDaMenu(v); return true; }
  if (t.id === "scalaSeg") { salvaScalaSegnalini(Number(t.value) / 100); return true; }
  return false;
}
// Trascinando il cursore i segnalini cambiano subito; il salvataggio avviene quando lo lasci.
function digitoBarra(e) {
  if (e.target.id !== "scalaSeg") return false;
  var m = mappaVista();
  if (m) { m.scala_segnalini = Number(e.target.value) / 100; disegnaSegnalini(m); }
  return true;
}
function salvaScalaSegnalini(frazione) {
  var m = mappaVista(); if (!m) return;
  run(function () { return call("salva_mappa", { p: { campagna_id: bCamp(), id: m.id, nome: m.nome, scala_segnalini: frazione } }); })
    .then(function (r) { if (r) ricaricaBattle(); });
}

// Dopo aver scelto il file si chiede il nome, poi lo si riduce, si carica e si registra.
function chiediNomeMappa(file) {
  var base = file.name.replace(/\.[^.]+$/, "").slice(0, 60);
  modal("Nuova mappa", fld("nome", "Nome della mappa", base, 'required maxlength="60"') +
    '<p class="hint">L’immagine viene ridotta (lato massimo ' + LATO_MASSIMO + ' px) prima del caricamento: pesa circa mezzo MB.</p>',
    function (fd) {
      var nome = String(fd.get("nome") || "").trim();
      if (!nome) { toast("Scrivi un nome.", true); return false; }
      toast("Carico la mappa…");
      return caricaMappa(file, nome).then(function (id) {
        toast("Mappa caricata");
        B.vista = id;
        return ricaricaBattle();
      }, function (e) { toast(errText(e), true); return false; });
    }, "Carica");
}

// Aggiunge un segnalino scelto dal menu: «g:12» è un PG, «p:3» è un NPC, «gen» è un segnalino generico.
function aggiungiDaMenu(v) {
  var m = mappaVista(); if (!m) return;
  if (v === "gen") { nuovoGenerico(m); return; }
  var p = { campagna_id: bCamp(), mappa_id: m.id, x: 0.5, y: 0.5 };
  if (v.charAt(0) === "g") p.giocatore_id = Number(v.slice(2)); else p.png_id = Number(v.slice(2));
  run(function () { return call("aggiungi_segnalino", { p: p }); }, "Segnalino aggiunto").then(function (r) { if (r) ricaricaBattle(); });
}
