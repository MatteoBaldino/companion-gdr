/* =====================================================================
   js/personaggi/destinatari.js
   Cosa fa:   Aiuti per assegnare, spostare e dare oggetti: elenco dei
              destinatari, quantità, ricerca nell'inventario e nella
              libreria.
   Contiene:  senzaAccenti, htmlListaDest, optsDest, parteDa, campoQta, invPerId, oggPerId
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// Elenco dei destinatari con ricerca (per il master, che può avere tanti NPC): scrivi un nome e restano solo quelli che combaciano.
// Se resta un solo nome, viene scelto da solo. Il valore scelto è «g:ID» (giocatore) o «p:ID» (NPC): si legge con fd.get("dest").
function senzaAccenti(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function htmlListaDest(escludi) {
  var gs = S.gioc.filter(function (g) { return g.ruolo === "giocatore" && "g:" + g.id !== escludi; });
  var ps = S.png.filter(function (p) { return "p:" + p.id !== escludi; });
  if (!gs.length && !ps.length) return "";
  var riga = function (k, nome, tipo) {
    return '<label class="dest" data-nome="' + esc(senzaAccenti(nome)) + '"><input type="radio" name="dest" value="' + k + '"><span>' + esc(nome) + "</span><small>" + tipo + "</small></label>";
  };
  return '<label class="f"><span>A chi</span><input type="search" data-filtra="dest" placeholder="Cerca un nome" autocomplete="off"></label>' +
    '<div class="dlista" role="radiogroup" aria-label="Destinatari">' + gs.map(function (g) { return riga("g:" + g.id, g.nome, "PG"); }).join("") +
    ps.map(function (p) { return riga("p:" + p.id, p.nome, "NPC"); }).join("") + "</div>" +
    '<p class="hint dnessuno" hidden>Nessun nome combacia.</p>';
}
document.addEventListener("input", function (e) {
  var t = e.target; if (!t || !t.matches || !t.matches("[data-filtra]")) return;
  var q = senzaAccenti(t.value.trim()), form = t.closest("form") || document, n = 0, primo = null;
  form.querySelectorAll(".dlista .dest").forEach(function (l) {
    var ok = !q || l.dataset.nome.indexOf(q) >= 0;
    l.hidden = !ok;
    if (ok) { n++; if (!primo) primo = l; }
  });
  var vuoto = form.querySelector(".dnessuno"); if (vuoto) vuoto.hidden = n > 0;
  if (n === 1 && primo) primo.querySelector("input").checked = true;
});

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
