/* =====================================================================
   js/personaggi/destinatari.js
   Cosa fa:   Aiuti per assegnare, spostare e dare oggetti: elenco dei
              destinatari, quantità, ricerca nell'inventario e nella
              libreria.
   Contiene:  optsDest, parteDa, campoQta, invPerId, oggPerId
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

function optsDest(escludi) {
  var gs = S.gioc.filter(function (g) { return g.ruolo === "giocatore" && "g:" + g.id !== escludi; });
  var ps = S.png.filter(function (p) { return "p:" + p.id !== escludi; });
  return (gs.length ? '<optgroup label="PG">' + gs.map(function (g) { return '<option value="g:' + g.id + '">' + esc(g.nome) + "</option>"; }).join("") + "</optgroup>" : "") +
    (ps.length ? '<optgroup label="NPC">' + ps.map(function (p) { return '<option value="p:' + p.id + '">' + esc(p.nome) + "</option>"; }).join("") + "</optgroup>" : "");
}
function parteDa(key) {
  var t = key.split(":"), id = Number(t[1]);
  return t[0] === "g" ? { g: id, p: null } : { g: null, p: id };
}
function campoQta(max, impilabile) {
  return '<label class="f"><span>Quantità' + (max > 1 ? " (al massimo " + max + ")" : "") + '</span><input type="number" name="qta" min="1" max="' + max + '" value="1" required' + (impilabile ? "" : " readonly") + "></label>" +
    (impilabile ? "" : '<p class="hint">Questo oggetto non si impila: si sposta uno alla volta.</p>');
}
function invPerId(id) { return S.inv.filter(function (i) { return String(i.id) === String(id); })[0]; }
function oggPerId(id) { return S.ogg.filter(function (o) { return String(o.id) === String(id); })[0]; }
