/* =====================================================================
   js/libreria/elenco.js
   Cosa fa:   Libreria del master: ricerca, filtri per categoria e
              tipologia, elenco a pagine da 100 oggetti.
   Contiene:  tipologieDi, htmlLibreria, htmlListaLibreria
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- libreria (master)
function tipologieDi(cat) {
  var m = {};
  S.ogg.forEach(function (o) { if ((!cat || o.categoria === cat) && o.tipologia) m[o.tipologia] = 1; });
  return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, "it"); });
}
function htmlLibreria() {
  var tips = tipologieDi(S.filtro.cat);
  return '<div class="toolbar"><input type="search" id="fq" placeholder="Cerca per nome" aria-label="Cerca per nome" value="' + esc(S.filtro.q) + '">' +
    '<select id="fcat" aria-label="Filtra per categoria"><option value="">Tutte le categorie</option>' +
    CATS.map(function (c) { return '<option value="' + c.id + '"' + (S.filtro.cat === c.id ? " selected" : "") + ">" + c.plurale + "</option>"; }).join("") + "</select>" +
    (tips.length ? '<select id="ftip" aria-label="Filtra per tipologia"><option value="">Tutte le tipologie</option>' +
      tips.map(function (t) { return '<option value="' + esc(t) + '"' + (S.filtro.tip === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>" : "") +
    '<button class="primary" data-act="nuovo">Nuovo oggetto</button><a class="btn" href="importa.html">Importa da Excel</a></div>' +
    '<div id="lista">' + htmlListaLibreria() + "</div>";
}
function htmlListaLibreria() {
  if (!S.ogg.length) {
    return '<div class="empty"><p>La libreria è vuota. Crea il primo oggetto, oppure importa i tuoi listini Excel.</p>' +
      '<div class="row"><button class="primary" data-act="nuovo">Nuovo oggetto</button><a class="btn" href="importa.html">Importa da Excel</a></div></div>';
  }
  var q = S.filtro.q.trim().toLowerCase();
  var l = S.ogg.filter(function (o) {
    return (!S.filtro.cat || o.categoria === S.filtro.cat) && (!S.filtro.tip || o.tipologia === S.filtro.tip) &&
      (!q || (o.nome + " " + (o.nome_en || "") + " " + (o.tipologia || "")).toLowerCase().indexOf(q) >= 0);
  });
  if (!l.length) return '<div class="empty">Nessun oggetto corrisponde alla ricerca.</div>';
  // [MODIFICA QUI] Si mostrano 100 oggetti alla volta: con più di mille voci la pagina sarebbe lentissima.
  var mostrati = l.slice(0, S.filtro.n);
  return '<p class="hint">' + (mostrati.length < l.length ? "Mostro " + mostrati.length + " di " + l.length + " oggetti." : l.length + (l.length === 1 ? " oggetto." : " oggetti.")) + "</p>" +
    mostrati.map(function (o) {
      return rigaOggetto(o, {
        azioni: '<button class="primary small" data-act="assegna" data-ogg="' + o.id + '">Assegna</button>' +
          '<button class="small" data-act="modifica" data-ogg="' + o.id + '">Modifica</button>' +
          '<button class="small danger" data-act="elimina" data-ogg="' + o.id + '">Elimina</button>'
      });
    }).join("") +
    (mostrati.length < l.length ? '<p class="altri"><button data-act="altri">Mostra altri 100</button></p>' : "");
}
