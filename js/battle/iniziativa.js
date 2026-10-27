/* =====================================================================
   js/battle/iniziativa.js
   Cosa fa:   Pannello dell'iniziativa: ordine dei turni, round e pulsanti
              del master.
   Contiene:  aggiornaIniziativa, azioneIniziativa, cambioIniziativa
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- ordine di iniziativa
// Riguarda la mappa in scena. I giocatori vedono i segnalini non nascosti e impostano solo la propria iniziativa.
function aggiornaIniziativa() {
  var box = $("#iniz"), m = bMaster() ? mappaScena() : mappaVista();
  if (!m) {
    box.innerHTML = "<h2>Iniziativa</h2><p class=\"hint\">" + (bMaster() ? "Metti una mappa in scena per usare l’iniziativa." : "Nessuno scontro in corso.") + "</p>";
    return;
  }
  var tutti = segnaliniDi(m), con = ordineIniziativa(tutti), attivo = B.stato ? B.stato.turno_segnalino_id : null;
  var riga = function (s) {
    var p = B.pf[s.id];
    return '<li class="riga' + (s.id === attivo ? " turno" : "") + (s.nascosto ? " nasc" : "") + '"><span class="n">' + esc(s.nome) + "</span>" +
      (p && p.pf_max > 0 ? '<span class="pfm">' + p.pf_att + "/" + p.pf_max + "</span>" : "") +
      '<input class="ini-in" type="number" min="-20" max="99" data-ini="' + s.id + '" value="' + (s.iniziativa == null ? "" : s.iniziativa) +
      '" aria-label="Iniziativa di ' + esc(s.nome) + '"' + (possoMuovere(s) ? "" : " disabled") + "></li>";
  };
  // Chi non ha l'iniziativa compare sotto: il master li vede tutti, un giocatore solo il proprio.
  var senza = tutti.filter(function (s) { return s.iniziativa == null && possoMuovere(s); });
  var h = "<h2>Iniziativa</h2>" + '<p class="round">' + (attivo ? "Round " + (B.stato.round || 1) : "Scontro non iniziato") + "</p>" +
    (con.length ? '<ol class="elenco">' + con.map(riga).join("") + "</ol>" : '<p class="hint">Nessuno ha ancora l’iniziativa.</p>') +
    (senza.length ? '<h3>Senza iniziativa</h3><ul class="elenco">' + senza.map(riga).join("") + "</ul>" : "");
  if (bMaster()) {
    h += '<div class="row"><button class="primary" data-b="turno"' + (con.length ? "" : " disabled") + '>Turno successivo</button>' +
      '<button data-b="nuovo">Nuovo scontro</button></div>';
  }
  box.innerHTML = h;
}

function azioneIniziativa(a) {
  if (a === "turno") {
    run(function () { return call("prossimo_turno", { p_camp: bCamp() }); }).then(function (r) { if (r) ricaricaBattle(); });
    return true;
  }
  if (a === "nuovo") {
    modal("Nuovo scontro?", "<p>Si azzerano il round, il turno e le iniziative di tutti i segnalini della mappa in scena.</p>", function () {
      return run(function () { return call("nuovo_combattimento", { p_camp: bCamp() }); }, "Scontro azzerato").then(function (r) {
        if (!r) return false;
        return ricaricaBattle();
      });
    }, "Azzera");
    return true;
  }
  return false;
}
// Scrivendo un'iniziativa nell'elenco si salva subito.
function cambioIniziativa(e) {
  var t = e.target;
  if (!t.classList || !t.classList.contains("ini-in")) return false;
  var v = t.value.trim();
  run(function () { return call("imposta_iniziativa", { p_id: Number(t.dataset.ini), p_valore: v === "" ? null : Number(v) }); })
    .then(function (r) { if (r) ricaricaBattle(); else ricaricaBattle(); });
  return true;
}
