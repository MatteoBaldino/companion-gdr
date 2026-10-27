/* =====================================================================
   js/azioni/azioni-schede.js
   Cosa fa:   Pulsanti delle schede: aprire, creare, salire di livello,
              eliminare, danni e cure.
   Contiene:  rapido, ACT_SCHEDE
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- azioni sulle schede
function rapido(id, pf, temp, isp) {
  run(function () { return call("aggiorna_scheda_rapida", { p_id: Number(id), p_pf: pf, p_temp: temp, p_isp: isp }); })
    .then(function (r) { if (r) caricaDati().then(disegnaTab); });
}
var ACT_SCHEDE = {
  "apri-scheda": function (b) { S.schedaAperta = b.dataset.key; disegnaTab(); },
  "chiudi-scheda": function () { S.schedaAperta = null; disegnaTab(); },
  "vai-scheda": function (b) { S.tab = "schede"; S.schedaAperta = b.dataset.key; disegnaTab(); },
  "crea-scheda": function (b) {
    var key = b.dataset.key;
    if (key.charAt(0) === "g") { wizard(key); return; }
    modal("Scheda per " + nomeHolder(key), '<p>Come vuoi descrivere questo NPC?</p>' +
      sel("tipo", "Tipo di scheda", [["semplificata", "Semplificata: CA, PF, azioni (come un mostro)"], ["completa", "Completa: caratteristiche, tiri salvezza e abilità"]], "semplificata"),
      function (fd) {
        var t = fd.get("tipo");
        setTimeout(function () { if (t === "semplificata") editorScheda(key, null, "semplificata"); else wizard(key); }, 0);
      }, "Continua");
  },
  "crea-manuale": function (b) { editorScheda(b.dataset.key, null, "completa"); },
  "wiz-manuale": function () { var k = WZ.key; $("#dlg").close(); editorScheda(k, null, "completa"); },
  "wiz-prev": function () { wzLeggi(); WZ.step--; wzDisegna(); },
  "wiz-tira": function () { wzLeggi(); ABIL.forEach(function (a) { WZ.base[a[0]] = tira4d6(); }); wzDisegna(); },
  "modifica-scheda": function (b) { var s = schedaPerId(b.dataset.id); if (s) editorScheda(keyDiScheda(s), s); },
  "sali-livello": function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    var info = classeInfo(s.classe), dado = info ? info.dado : 8, guad = Math.max(1, Math.floor(dado / 2) + 1 + mod(s.costituzione));
    modal("Sali di livello: " + nomeHolder(keyDiScheda(s)),
      "<p>Da livello " + s.livello + " a livello <strong>" + (s.livello + 1) + "</strong>. Il bonus competenza passa a " + sgn(bonusComp(s.livello + 1)) + ".</p>" +
      fld("guadagno", "Punti ferita in più" + (info ? " (media del d" + dado + " più Costituzione)" : " (stima con un d8)"), guad, 'min="0" required', "number") +
      '<p class="hint">Controlla sul manuale se a questo livello la tua classe dà un aumento di caratteristica o un talento: in quel caso modifica le caratteristiche dalla scheda.</p>',
      function (fd) {
        var g = Number(fd.get("guadagno")) || 0, p = payloadDaScheda(s);
        p.livello = s.livello + 1; p.pf_max = s.pf_max + g; p.pf_attuali = s.pf_attuali + g;
        if (info && info.inc && uguali(s.slot_totali, slotSuggeriti(info, s.livello).tot)) { var sn = slotSuggeriti(info, p.livello); p.slot_totali = sn.tot; p.slot_riposo = sn.riposo; }
        return salvaScheda(p, "Sei salito al livello " + p.livello).then(function (id) { return id != null; });
      }, "Sali di livello");
  },
  "elimina-scheda": function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    modal("Eliminare la scheda?", "<p>La scheda di " + esc(nomeHolder(keyDiScheda(s))) + " viene cancellata. L’inventario e lo storico non cambiano.</p>", function () {
      return run(function () { return call("elimina_scheda", { p_id: s.id }); }, "Scheda eliminata").then(function (r) {
        if (!r) return false;
        S.schedaAperta = null;
        return caricaDati().then(disegnaTab);
      });
    }, "Elimina");
  },
  "pf-danno": function (b) {
    var s = schedaPerId(b.dataset.id), v = Math.floor(Number($("#pfn").value) || 0); if (!s || v <= 0) return;
    var ass = Math.min(s.pf_temp, v), temp = s.pf_temp - ass, resto = v - ass;
    rapido(s.id, Math.max(0, s.pf_attuali - resto), temp, null);
  },
  "pf-cura": function (b) {
    var s = schedaPerId(b.dataset.id), v = Math.floor(Number($("#pfn").value) || 0); if (!s || v <= 0) return;
    rapido(s.id, Math.min(s.pf_max, s.pf_attuali + v), null, null);
  },
  "pf-temp": function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    rapido(s.id, null, Math.max(0, Math.floor(Number($("#pft").value) || 0)), null);
  },
  ispirazione: function (b) { var s = schedaPerId(b.dataset.id); if (s) rapido(s.id, null, null, !s.ispirazione); }
};
Object.keys(ACT_SCHEDE).forEach(function (k) { ACT[k] = ACT_SCHEDE[k]; });
FORMS.wz = function () { wzAvanti(); };
