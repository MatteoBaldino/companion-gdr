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
// ---------------------------------------------------------------- monete
// Legge i quattro campi (platino, oro, argento, rame) con il prefisso dato: "mp" per spendere/incassare, "mc" per correggere.
function leggiMonete(pre) {
  var r = {};
  MON.forEach(function (x) { var el = $("#" + pre + "_" + x[0]); r[x[0]] = Math.max(0, Math.floor(Number(el && el.value) || 0)); });
  return r;
}
function salvaMonete(id, nuove, ok) {
  run(function () { return call("aggiorna_monete", { p_id: Number(id), p: nuove }); }, ok)
    .then(function (r) { if (r) caricaDati().then(disegnaTab); });
}
function cambiaMonete(id, modo) {
  var s = schedaPerId(id); if (!s) return;
  var m = moneteDi(s);
  if (modo === "imposta") { salvaMonete(id, leggiMonete("mc"), "Monete corrette"); return; }
  var imp = leggiMonete("mp"), valore = rameTotali(imp);
  if (valore <= 0) { toast("Scrivi quanto " + (modo === "spendi" ? "spendere" : "incassare") + ".", true); return; }
  if (modo === "incassa") {
    var n = {}; MON.forEach(function (x) { n[x[0]] = m[x[0]] + imp[x[0]]; });
    salvaMonete(id, n, "Incassati " + testoMonete(dividiMonete(valore)));
    return;
  }
  var r = spendiMonete(m, valore);
  if (r.errore) { toast(r.errore, true); return; }
  salvaMonete(id, r.m, "Spesi " + testoMonete(dividiMonete(valore)) + (r.cambio ? ". " + r.cambio : ""));
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
  ispirazione: function (b) { var s = schedaPerId(b.dataset.id); if (s) rapido(s.id, null, null, !s.ispirazione); },
  // Movimento: toglie o ridà la distanza scritta nel campo (nell'unità che usi: metri o piedi).
  mov: function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    var el = $("#mv_" + s.id), v = parseFloat(String(el ? el.value : "").replace(",", "."));
    if (isNaN(v) || v <= 0) { toast("Scrivi quanta distanza vuoi togliere o ridare.", true); return; }
    var d = distM(v), t = copia(s.turno || {}), tot = Number(s.velocita) || 0, usati = Math.min(tot, Number(t.mov) || 0);
    if (b.dataset.d === "-") {
      if (d > tot - usati + 0.001) { toast("Non puoi muoverti di " + fmtVel(d) + ": ne restano " + fmtVel(tot - usati) + ".", true); return; }
      t.mov = Math.round((usati + d) * 100) / 100;
    } else t.mov = Math.max(0, Math.round((usati - d) * 100) / 100);
    gioco(s, { turno: t });
  },
  "monete-spendi": function (b) { cambiaMonete(b.dataset.id, "spendi"); },
  "monete-incassa": function (b) { cambiaMonete(b.dataset.id, "incassa"); },
  "monete-imposta": function (b) { cambiaMonete(b.dataset.id, "imposta"); }
};
Object.keys(ACT_SCHEDE).forEach(function (k) { ACT[k] = ACT_SCHEDE[k]; });
FORMS.wz = function () { wzAvanti(); };
