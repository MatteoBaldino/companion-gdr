/* =====================================================================
   js/scheda/gioco.js
   Cosa fa:   Stato di gioco: aggiornamento immediato di slot, turno e
              concentrazione, con gli avvisi sul lancio.
   Contiene:  gioco, copia, avvisiLancio, applicaLancio
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- stato di gioco (aggiornamento immediato, poi salvataggio)
function gioco(s, patch, msg) {
  Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
  disegnaTab();
  return call("aggiorna_gioco", { p_id: s.id, p: patch }).then(function () { if (msg) toast(msg); }, function (e) {
    toast(errText(e), true);
    return caricaDati().then(disegnaTab);
  });
}
function copia(o) { return JSON.parse(JSON.stringify(o)); }
function avvisiLancio(s, i, rituale) {
  var t = s.turno || {}, a = [];
  if (!rituale) {
    if (i.tempo_lancio === "azione" && t.azione) a.push("Hai già usato l’azione in questo turno.");
    if (i.tempo_lancio === "azione_bonus" && t.bonus) a.push("Hai già usato l’azione bonus in questo turno.");
    if (i.tempo_lancio === "reazione" && t.reazione) a.push("Hai già usato la reazione.");
    if (i.tempo_lancio === "azione_bonus" && t.liv_azione) a.push("Hai già lanciato un incantesimo (non un trucchetto) con l’azione: dopo una magia a azione bonus puoi lanciare solo trucchetti.");
    if (i.tempo_lancio === "azione" && i.livello > 0 && t.inc_bonus) a.push("Hai già lanciato un incantesimo con l’azione bonus: puoi lanciare solo trucchetti con tempo di lancio di un’azione.");
  }
  if (i.concentrazione && s.concentrazione && s.concentrazione !== i.nome) a.push("Perderai la concentrazione su " + s.concentrazione + ".");
  return a;
}
function applicaLancio(s, i, lv) {   // lv: livello dello slot usato, oppure 0 per trucchetto, oppure "rituale"
  var patch = {}, t = copia(s.turno || {});
  if (typeof lv === "number" && lv > 0) { var us = (s.slot_usati || []).slice(); us[lv - 1] = (us[lv - 1] || 0) + 1; patch.slot_usati = us; }
  if (lv !== "rituale") {
    if (i.tempo_lancio === "azione") { t.azione = true; if (i.livello > 0) t.liv_azione = true; }
    if (i.tempo_lancio === "azione_bonus") { t.bonus = true; t.inc_bonus = true; }
    if (i.tempo_lancio === "reazione") t.reazione = true;
    patch.turno = t;
  }
  if (i.concentrazione) patch.concentrazione = i.nome;
  return gioco(s, patch, i.nome + (typeof lv === "number" && lv > 0 ? " lanciato con uno slot di " + lv + "° livello" : " lanciato"));
}
