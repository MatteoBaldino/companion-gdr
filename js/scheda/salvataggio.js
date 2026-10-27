/* =====================================================================
   js/scheda/salvataggio.js
   Cosa fa:   Salvataggio della scheda: preparazione dei dati e chiamata al
              database.
   Contiene:  SCHEDA_CAMPI, payloadDaScheda, salvaScheda, leggi, apriDopo
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- salvataggio
var SCHEDA_CAMPI = ["tipo", "specie", "background", "classe", "sottoclasse", "livello", "forza", "destrezza", "costituzione", "intelligenza", "saggezza", "carisma",
  "pf_max", "pf_attuali", "pf_temp", "ca_manuale", "ca_bonus", "velocita", "competenze_ts", "abilita", "ispirazione", "sfida", "tratti", "azioni", "note",
  "car_incantesimi", "cd_incantesimi", "att_incantesimi", "competenze_armi", "slot_totali", "slot_riposo", "risorse"];
function payloadDaScheda(s) {
  var p = { campagna_id: s.campagna_id, id: s.id, giocatore_id: s.giocatore_id, png_id: s.png_id };
  SCHEDA_CAMPI.forEach(function (c) { p[c] = s[c]; });
  return p;
}
function salvaScheda(p, okMsg) {
  return run(function () { return call("salva_scheda", { p: p }); }, okMsg).then(function (r) {
    if (!r) return null;
    return caricaDati().then(function () { disegnaTab(); return r.v; });
  });
}
function leggi(fd) {
  return {
    g: function (k) { return (fd.get(k) == null ? "" : String(fd.get(k))).trim(); },
    // menu a tendina con «Altro…»: vale la voce scelta, oppure il testo scritto
    o: function (k) { var v = (fd.get(k) == null ? "" : String(fd.get(k))).trim(); return v === ALTRO ? (fd.get(k + "_altro") == null ? "" : String(fd.get(k + "_altro"))).trim() : v; },
    n: function (k) { var s = (fd.get(k) == null ? "" : String(fd.get(k))).trim().replace(",", "."); return s === "" ? null : Number(s); },
    b: function (k) { return fd.get(k) === "on"; }
  };
}
function apriDopo(key) {
  if (isMaster()) { S.tab = "schede"; S.schedaAperta = key; } else { S.tab = "scheda"; }
  disegnaTab();
}
