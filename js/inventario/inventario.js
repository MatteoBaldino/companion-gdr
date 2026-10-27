/* =====================================================================
   js/inventario/inventario.js
   Cosa fa:   Sezioni del giocatore: il suo inventario con il peso
              trasportato, e le notifiche.
   Contiene:  htmlInventario, htmlNotifiche
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- inventario (giocatore)
function htmlInventario() {
  if (!S.inv.length) return '<div class="empty">Il tuo inventario è vuoto. Quando il master ti assegna qualcosa, lo trovi qui.</div>';
  var peso = S.inv.reduce(function (s, i) { return s + (Number(i.oggetti.peso) || 0) * i.quantita; }, 0);
  var out = '<p class="hint">Peso trasportato: ' + fmtPeso(peso) + "</p>";
  CATS.forEach(function (c) {
    var l = S.inv.filter(function (i) { return i.oggetti.categoria === c.id; })
      .sort(function (a, b) { return a.oggetti.nome.localeCompare(b.oggetti.nome, "it"); });
    if (!l.length) return;
    out += '<h2 class="sec">' + c.plurale + "</h2>" + l.map(function (i) {
      var eq = c.id !== "cibo"
        ? '<button class="small" data-act="equip" data-inv="' + i.id + '" data-v="' + (i.equipaggiato ? "0" : "1") + '">' + (i.equipaggiato ? "Rimetti nello zaino" : "Equipaggia") + "</button>" : "";
      return rigaOggetto(i.oggetti, {
        qta: i.quantita, equip: i.equipaggiato,
        azioni: eq + '<button class="small" data-act="dai" data-inv="' + i.id + '">Dai a un compagno</button>'
      });
    }).join("");
  });
  return out;
}

function htmlNotifiche() {
  if (!S.notif.length) return '<div class="empty">Nessuna notifica. Qui compaiono gli oggetti che ricevi o che dai.</div>';
  return S.notif.map(function (n) {
    return '<div class="notif' + (S.nuove[n.id] ? " nuova" : "") + '">' + esc(n.testo) + "<time>" + fmtData(n.created_at) + "</time></div>";
  }).join("");
}
