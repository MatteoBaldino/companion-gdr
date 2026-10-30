/* =====================================================================
   js/battle/iniziativa.js
   Cosa fa:   Pannello dell'iniziativa: ordine dei turni, round e pulsanti
              del master. L'elenco si riduce e si estende; «Nuovo scontro» lo svuota.
   Contiene:  aggiornaIniziativa, azioneIniziativa, cambioIniziativa
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- ordine di iniziativa
// Riguarda la mappa in scena. I giocatori vedono i segnalini non nascosti e impostano solo la propria iniziativa.
function aggiornaIniziativa() {
  var box = $("#iniz"), m = bMaster() ? mappaScena() : mappaVista();
  // L'intestazione ha il pulsante che riduce o estende l'elenco.
  var testa = function (extra) {
    return '<div class="inizh"><h2>Iniziativa</h2><button type="button" class="small" data-b="iniz" aria-expanded="' + !B.inizChiusa + '" aria-label="' + (B.inizChiusa ? "Estendi" : "Riduci") + ' l’elenco dell’iniziativa">' +
      (B.inizChiusa ? "Estendi ▴" : "Riduci ▾") + "</button></div>" + (extra || "");
  };
  if (!m) {
    box.innerHTML = testa('<p class="hint">' + (bMaster() ? "Metti una mappa in scena per usare l’iniziativa." : "Nessuno scontro in corso.") + "</p>");
    return;
  }
  // Nell'elenco ci sono solo i segnalini con un'iniziativa (si tira dalla scheda, o si scrive dalla finestra del segnalino).
  var con = ordineIniziativa(segnaliniDi(m)), attivo = B.stato ? B.stato.turno_segnalino_id : null;
  var riga = function (s) {
    var p = B.pf[s.id];
    return '<li class="riga' + (s.id === attivo ? " turno" : "") + (s.nascosto ? " nasc" : "") + '"><span class="n">' + esc(s.nome) + "</span>" +
      (p && p.pf_max > 0 ? '<span class="pfm">' + p.pf_att + "/" + p.pf_max + "</span>" : "") +
      '<input class="ini-in" type="number" min="-20" max="99" data-ini="' + s.id + '" value="' + (s.iniziativa == null ? "" : s.iniziativa) +
      '" aria-label="Iniziativa di ' + esc(s.nome) + '"' + (possoMuovere(s) ? "" : " disabled") + "></li>";
  };
  var round = '<p class="round">' + (attivo ? "Round " + (B.stato.round || 1) : "Scontro non iniziato") + "</p>";
  if (B.inizChiusa) {
    var chi = attivo ? segnalinoPerId(attivo) : null;
    box.innerHTML = testa(round.replace("</p>", (chi ? " · turno di " + esc(chi.nome) : "") + "</p>"));
    return;
  }
  var h = testa(round +
    (con.length ? '<ol class="elenco">' + con.map(riga).join("") + "</ol>" : '<p class="hint">Nessuno ha ancora l’iniziativa. Tocca «Iniziativa» nella scheda per tirarla: entra qui da sola.</p>'));
  if (bMaster()) {
    h += '<div class="row"><button class="primary" data-b="turno"' + (con.length ? "" : " disabled") + '>Turno successivo</button>' +
      '<button data-b="nuovo">Nuovo scontro</button></div>';
  }
  box.innerHTML = h;
}

function azioneIniziativa(a) {
  if (a === "iniz") { B.inizChiusa = !B.inizChiusa; aggiornaIniziativa(); return true; }
  if (a === "turno") {
    run(function () { return call("prossimo_turno", { p_camp: bCamp() }); }).then(function (r) { if (r) ricaricaBattle(); });
    return true;
  }
  if (a === "nuovo") {
    modal("Nuovo scontro?", "<p>Si azzerano il round, il turno e tutto l’elenco dell’iniziativa: i segnalini restano sulla mappa.</p>", function () {
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
