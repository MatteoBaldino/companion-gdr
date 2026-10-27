/* =====================================================================
   js/battle/realtime.js
   Cosa fa:   Aggiornamento in tempo reale: quando qualcuno sposta un
              segnalino o il master cambia la scena, tutti lo vedono
              subito.
   Contiene:  rinviaRicarica, ricaricaBattle, unisciSegnalino,
              avviaRealtime
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- aggiornamento in tempo reale
// Supabase avvisa quando qualcosa cambia: i segnalini che si spostano arrivano subito, per il resto si rilegge tutto.
function rinviaRicarica() {
  clearTimeout(B.tRicarica);
  B.tRicarica = setTimeout(ricaricaBattle, 150);
}
function ricaricaBattle() {
  return caricaBattle().then(disegna, function (e) { toast(errText(e), true); });
}
// Un segnalino che arriva dal tempo reale sostituisce quello che abbiamo (tranne quello che stiamo trascinando).
function unisciSegnalino(riga) {
  if (B.drag && B.drag.id === riga.id) return;
  var i = -1;
  B.seg.forEach(function (s, k) { if (s.id === riga.id) i = k; });
  if (i < 0) B.seg.push(riga); else B.seg[i] = Object.assign(B.seg[i], riga);
}
function avviaRealtime() {
  var c = bCamp(), f = "campagna_id=eq." + c, ch = sb.channel("battle-" + c);
  ["battle_stato", "mappe", "segnalini_pf"].forEach(function (t) {
    ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: f }, rinviaRicarica);
  });
  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "segnalini", filter: f }, rinviaRicarica);
  // Le eliminazioni non si possono filtrare per campagna: se riguardano altri, la rilettura è innocua.
  ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "segnalini" }, rinviaRicarica);
  ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "segnalini", filter: f }, function (p) {
    if (p && p.new) { unisciSegnalino(p.new); disegna(); } else rinviaRicarica();
  });
  ch.subscribe();
  B.canale = ch;
  // Rete di sicurezza: se il tempo reale non fosse attivo, ogni 15 secondi si rilegge comunque.
  setInterval(function () { if (!B.drag && !document.querySelector("dialog[open]")) ricaricaBattle(); }, 15000);
}
