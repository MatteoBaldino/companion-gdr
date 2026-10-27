/* =====================================================================
   js/storico/storico.js
   Cosa fa:   Storico dei movimenti (solo master): chi ha dato cosa a chi,
              con possibilità di annullare.
   Contiene:  nomeParte, htmlStorico
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- storico (master)
function nomeParte(g, p) {
  if (g) { var x = S.gioc.filter(function (z) { return z.id === g; })[0]; return x ? x.nome : "giocatore"; }
  if (p) { var y = S.pngAll.filter(function (z) { return z.id === p; })[0]; return y ? y.nome : "NPC"; }
  return "nessuno";
}
function htmlStorico() {
  if (!S.trasf.length) return '<div class="empty">Ancora nessun movimento. Ogni assegnazione e ogni passaggio di mano comparirà qui.</div>';
  var annullati = {};
  S.trasf.forEach(function (t) { if (t.annulla_id) annullati[t.annulla_id] = true; });
  return '<p class="hint">Lo storico non si modifica: se c’è un errore, annulla il movimento e se ne crea uno di correzione.</p>' +
    S.trasf.map(function (t) {
      var ann = !!annullati[t.id];
      var nome = (one(t.oggetti) || {}).nome || "oggetto";
      return '<div class="mov' + (ann ? " annull" : "") + '"><div><span class="tipo">' + TIPO_MOV[t.tipo] + "</span>: " +
        (t.quantita > 1 ? t.quantita + "× " : "") + "<strong>" + esc(nome) + "</strong>, da " +
        esc(nomeParte(t.da_giocatore_id, t.da_png_id)) + " a " + esc(nomeParte(t.a_giocatore_id, t.a_png_id)) +
        (ann ? " (annullato)" : "") + "<br><time>" + fmtData(t.created_at) + "</time></div>" +
        (t.tipo !== "annullamento" && !ann ? '<button class="small" data-act="annulla" data-id="' + t.id + '">Annulla</button>' : "") + "</div>";
    }).join("");
}
