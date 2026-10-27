/* =====================================================================
   js/scheda/campi-gioco.js
   Cosa fa:   Campi in più nel modulo della scheda (slot, risorse, armi) e
              riassunto degli slot nella creazione guidata.
   Contiene:  camposGioco, leggiGioco, wzSlotRiassunto
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- campi in più nel modulo della scheda
function camposGioco(d, semp) {
  var tot = d.slot_totali || [0, 0, 0, 0, 0, 0, 0, 0, 0], c = d.competenze_armi || [];
  var h = "<h3>Incantesimi, slot e risorse</h3>";
  if (!semp) h += sel("car_incantesimi", "Caratteristica da incantatore", [["", "Nessuna"]].concat(ABIL.map(function (a) { return [a[0], a[1]]; })), d.car_incantesimi || "");
  h += '<div class="cols">' + fld("cd_incantesimi", semp ? "CD degli incantesimi" : "CD fissa (vuota = calcolata)", d.cd_incantesimi, 'min="0"', "number") +
    fld("att_incantesimi", semp ? "Bonus per colpire con incantesimi" : "Attacco fisso (vuoto = calcolato)", d.att_incantesimi, 'step="1"', "number") + "</div>" +
    '<p class="hint">Slot totali per livello</p><div class="cols slotin">';
  for (var lv = 1; lv <= 9; lv++) h += fld("slot_" + lv, lv + "° livello", tot[lv - 1] || 0, 'min="0" max="9"', "number");
  h += "</div>" + sel("slot_riposo", "Gli slot si recuperano con", [["lungo", "Riposo lungo"], ["breve", "Riposo breve (patto del Warlock)"]], d.slot_riposo || "lungo");
  if (!semp) h += '<p><button type="button" class="small" data-act="suggerisci-slot">Suggerisci da classe e livello</button></p>' +
    "<h3>Competenza con le armi</h3>" + chk("arm_semplici", "Armi semplici", c.indexOf("semplici") >= 0) + chk("arm_guerra", "Armi da guerra", c.indexOf("da_guerra") >= 0) +
    chk("arm_guerra_leggere", "Armi da guerra con Accurata o Leggera", c.indexOf("da_guerra_leggere") >= 0);
  h += area("risorse", "Risorse (una per riga: Nome | usi | recupero breve o lungo)", (d.risorse || []).map(function (r) { return r.nome + " | " + r.max + " | " + r.recupero; }).join("\n"));
  return h;
}
function leggiGioco(x, semp, s) {
  var tot = [];
  for (var lv = 1; lv <= 9; lv++) tot.push(Math.max(0, Math.min(9, Math.floor(x.n("slot_" + lv) || 0))));
  var vecchie = (s && s.risorse) || [];
  var ris = x.g("risorse").split("\n").map(function (r) { return r.trim(); }).filter(Boolean).map(function (r) {
    var p = r.split("|").map(function (z) { return z.trim(); }), nome = p[0], max = Math.max(1, Math.floor(Number(p[1])) || 1);
    var old = vecchie.filter(function (o) { return o.nome.toLowerCase() === nome.toLowerCase(); })[0];
    return { nome: nome, max: max, usati: Math.min(max, old ? old.usati : 0), recupero: /^b/i.test(p[2] || "") ? "breve" : "lungo" };
  });
  var arm = [];
  if (!semp) { if (x.b("arm_semplici")) arm.push("semplici"); if (x.b("arm_guerra")) arm.push("da_guerra"); if (x.b("arm_guerra_leggere")) arm.push("da_guerra_leggere"); }
  return { car_incantesimi: semp ? "" : x.g("car_incantesimi"), cd_incantesimi: x.n("cd_incantesimi"), att_incantesimi: x.n("att_incantesimi"),
    competenze_armi: arm, slot_totali: tot, slot_riposo: x.g("slot_riposo") || "lungo", risorse: ris };
}
function wzSlotRiassunto() {
  var info = classeInfo(WZ.classe), sl = slotSuggeriti(info, WZ.livello);
  if (!info) return '<p class="hint">Classe non riconosciuta: gli slot incantesimo li imposti dopo, dalla scheda.</p>';
  var txt = sl.tot.map(function (n, i) { return n ? n + " di " + (i + 1) + "° livello" : ""; }).filter(Boolean).join(", ");
  return '<p class="hint">' + (txt ? "Slot incantesimo: " + txt + (sl.riposo === "breve" ? " (si recuperano con il riposo breve)" : "") + ". Caratteristica da incantatore: " + ABK[info.car][1] + "." : "Questa classe non ha slot incantesimo al livello " + WZ.livello + ".") + "</p>";
}
