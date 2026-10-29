/* =====================================================================
   js/scheda/gioco.js
   Cosa fa:   Stato di gioco: aggiornamento immediato di slot, turno e
              concentrazione, con gli avvisi sul lancio.
   Contiene:  gioco, copia, morteDi, scriviMorte, inCombattimento, avvisiLancio, applicaLancio
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- stato di gioco (aggiornamento immediato, poi salvataggio)
function gioco(s, patch, msg) {
  // Se i PF tornano sopra 0 (una cura, un riposo), i tiri contro morte si azzerano.
  var tu0 = patch.turno || s.turno || {};
  if (patch.pf_attuali > 0 && tu0.morte) { tu0 = copia(tu0); delete tu0.morte; patch.turno = tu0; }
  Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
  disegnaTab();
  return call("aggiorna_gioco", { p_id: s.id, p: patch }).then(function () { if (msg) toast(msg); }, function (e) {
    toast(errText(e), true);
    return caricaDati().then(disegnaTab);
  });
}
function copia(o) { return JSON.parse(JSON.stringify(o)); }
// Tiri contro morte: successi (s) e fallimenti (f), da 0 a 3. Stanno dentro il campo «turno» della scheda ({ morte: { s, f } }),
// quindi non serve cambiare il database. «Nuovo turno» li lascia com'è; si azzerano quando i PF tornano sopra 0 o con «Azzera».
function morteDi(s) {
  var m = (s.turno || {}).morte || {};
  return { s: Math.min(3, Math.max(0, Number(m.s) || 0)), f: Math.min(3, Math.max(0, Number(m.f) || 0)) };
}
function scriviMorte(s, m) {
  var t = copia(s.turno || {});
  if (m.s || m.f) t.morte = { s: m.s, f: m.f }; else delete t.morte;
  return gioco(s, { turno: t });
}
// In combattimento (interruttore nella scheda, salvato dentro «turno»): solo allora azione, azione bonus e reazione si consumano da sole.
function inCombattimento(s) { return !!(s.turno || {}).combat; }
function avvisiLancio(s, i, rituale) {
  var t = s.turno || {}, a = [];
  if (!rituale && inCombattimento(s)) {
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
  if (lv !== "rituale" && inCombattimento(s)) {
    if (i.tempo_lancio === "azione") { t.azione = true; if (i.livello > 0) t.liv_azione = true; }
    if (i.tempo_lancio === "azione_bonus") { t.bonus = true; t.inc_bonus = true; }
    if (i.tempo_lancio === "reazione") t.reazione = true;
    patch.turno = t;
  }
  if (i.concentrazione) patch.concentrazione = i.nome;
  return gioco(s, patch, i.nome + (typeof lv === "number" && lv > 0 ? " lanciato con uno slot di " + lv + "° livello" : " lanciato"));
}
