/* =====================================================================
   js/listino/listino.js
   Cosa fa:   Listino prezzi di taverne, alloggi, viaggi e svaghi, visibile
              solo al master.
   Contiene:  htmlListino, htmlListaServizi
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- listino prezzi (taverne, alloggi, viaggi, svaghi)
function htmlListino() {
  if (!S.serv.length) {
    return '<div class="empty"><p>Il listino dei servizi è vuoto.</p>' +
      (isMaster() ? '<div class="row"><button class="primary" data-act="copia-standard">Copia listino standard</button><a class="btn" href="importa.html">Importa da Excel</a></div>' : "") + "</div>";
  }
  return '<div class="toolbar"><input type="search" id="fqs" placeholder="Cerca un servizio" aria-label="Cerca un servizio" value="' + esc(S.filtro.qs) + '"></div>' +
    '<div id="listaServ">' + htmlListaServizi() + "</div>";
}
function htmlListaServizi() {
  var q = S.filtro.qs.trim().toLowerCase(), gr = {}, ord = [];
  S.serv.forEach(function (v) {
    if (q && (v.nome + " " + (v.nome_en || "") + " " + (v.tipologia || "")).toLowerCase().indexOf(q) < 0) return;
    var k = v.tipologia || "Altro";
    if (!gr[k]) { gr[k] = []; ord.push(k); }
    gr[k].push(v);
  });
  if (!ord.length) return '<div class="empty">Nessun servizio corrisponde alla ricerca.</div>';
  return ord.map(function (k) {
    return '<h2 class="sec">' + esc(k) + "</h2>" + gr[k].map(function (v) {
      return '<article class="item compact cat-vario"><div><h3>' + esc(v.nome) +
        (v.nome_en ? ' <span class="en">' + esc(v.nome_en) + "</span>" : "") +
        ' <span class="qta">' + esc(fmtRame(v.costo_rame)) + "</span>" +
        (v.unita ? ' <span class="cat">' + esc(v.unita) + "</span>" : "") + "</h3>" +
        (v.descrizione ? '<p class="desc">' + esc(v.descrizione) + "</p>" : "") + "</div></article>";
    }).join("");
  }).join("");
}
