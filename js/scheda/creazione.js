/* =====================================================================
   js/scheda/creazione.js
   Cosa fa:   Creazione guidata del personaggio in 4 passi: identità,
              caratteristiche, competenze, riepilogo.
   Contiene:  WZ, ARRAY_STD, COSTO_PUNTI, d6, tira4d6, wizard, wzLeggi,
              wzTotali, wzStato, wzBarra, wzDisegna, wzConta, wzAvanti
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- creazione guidata
var WZ = null;
var ARRAY_STD = [15, 14, 13, 12, 10, 8];
var COSTO_PUNTI = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
function d6() {
  var a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= 4294967292);
  return a[0] % 6 + 1;
}
function tira4d6() {
  var r = [d6(), d6(), d6(), d6()].sort(function (x, y) { return x - y; });
  return r[1] + r[2] + r[3];
}
function wizard(key) {
  WZ = { key: key, step: 1, specie: "", background: "", classe: "", livello: 1, metodo: "standard",
    base: { "for": 15, des: 14, cos: 13, "int": 12, sag: 10, car: 8 }, bonus: { "for": 0, des: 0, cos: 0, "int": 0, sag: 0, car: 0 },
    ts: null, sk: {}, pf: null, vel: null };
  wzDisegna();
  var d = $("#dlg");
  if (!d.open) d.showModal();
}
function wzLeggi() {
  var f = $("#wzForm");
  if (!f || !WZ) return;
  var x = leggi(new FormData(f));
  if (WZ.step === 1) { WZ.specie = x.o("specie"); WZ.background = x.o("background"); WZ.classe = x.o("classe"); WZ.livello = Math.min(20, Math.max(1, x.n("livello") || 1)); }
  if (WZ.step === 2) {
    ABIL.forEach(function (a) { WZ.base[a[0]] = x.n("b_" + a[0]) || 0; WZ.bonus[a[0]] = x.n("bn_" + a[0]) || 0; });
    WZ.metodo = x.g("metodo") || WZ.metodo;
  }
  if (WZ.step === 3) {
    WZ.ts = {}; ABIL.forEach(function (a) { if (x.b("ts_" + a[0])) WZ.ts[a[0]] = true; });
    WZ.sk = {}; SKILLS.forEach(function (k) { if (x.b("sk_" + k[0])) WZ.sk[k[0]] = 1; });
  }
  if (WZ.step === 4) { WZ.pf = x.n("pf"); WZ.vel = x.n("vel"); }
}
function wzTotali() {
  var t = {};
  ABIL.forEach(function (a) { t[a[0]] = (WZ.base[a[0]] || 0) + (WZ.bonus[a[0]] || 0); });
  return t;
}
function wzStato() {
  var v = ABIL.map(function (a) { return WZ.base[a[0]]; });
  if (WZ.metodo === "standard") {
    var ok = v.slice().sort(function (a, b) { return b - a; }).join() === ARRAY_STD.join();
    return ok ? "I valori sono quelli dell’array standard." : "Questi valori non sono quelli dell’array standard (15, 14, 13, 12, 10, 8): va bene lo stesso, ma controlla.";
  }
  if (WZ.metodo === "punti") {
    var tot = 0, fuori = false;
    v.forEach(function (x) { if (COSTO_PUNTI[x] == null) fuori = true; else tot += COSTO_PUNTI[x]; });
    if (fuori) return "Con l’acquisto punti ogni valore va da 8 a 15.";
    return "Punti usati: " + tot + " su 27" + (tot > 27 ? " (troppi)" : tot < 27 ? " (te ne restano " + (27 - tot) + ")" : ".");
  }
  if (WZ.metodo === "tiro") return "Premi «Tira i dadi»: 4d6 per ogni caratteristica, scartando il dado più basso. Poi puoi scambiare i valori a mano.";
  return "Scrivi i valori che vuoi.";
}
function wzBarra(indietro, avanti) {
  return '<div class="dlgbar">' + (indietro ? '<button type="button" class="ghost" data-act="wiz-prev">Indietro</button>' : '<button type="button" class="ghost" data-close>Annulla</button>') +
    '<button type="submit" class="primary">' + avanti + "</button></div>";
}
function wzDisegna() {
  var info = classeInfo(WZ.classe), h = '<form id="wzForm" class="dlgform" data-form="wz"><h2>Nuovo personaggio: ' + esc(nomeHolder(WZ.key)) + '</h2><p class="hint">Passo ' + WZ.step + " di 4</p>";
  if (WZ.step === 1) {
    h += '<div class="cols">' + campoOpz("specie", "Specie", SPECIE, WZ.specie) + campoOpz("background", "Background", BACKGROUND, WZ.background) + "</div>" +
      '<div class="cols">' + campoOpz("classe", "Classe", NOMI_CLASSI, WZ.classe) + fld("livello", "Livello", WZ.livello, 'min="1" max="20" required', "number") + "</div>" +
      '<p class="hint">Non trovi la specie, il background o la classe? Scegli «Altro…» e scrivila.</p>' +
      '<p class="hint">Se la classe è una delle dodici del manuale base, i passi successivi propongono tiri salvezza, abilità e punti ferita. Altrimenti compili tu.</p>' +
      '<p><button type="button" class="link" data-act="wiz-manuale">Preferisco compilare tutto a mano</button></p>' + wzBarra(false, "Avanti");
  } else if (WZ.step === 2) {
    var tot = wzTotali();
    h += sel("metodo", "Come determini le caratteristiche", [["standard", "Array standard (15, 14, 13, 12, 10, 8)"], ["punti", "Acquisto punti (27 punti)"], ["tiro", "Tiro (4d6, scarta il più basso)"], ["manuale", "Valori a mano"]], WZ.metodo) +
      (WZ.metodo === "tiro" ? '<p><button type="button" data-act="wiz-tira">Tira i dadi</button></p>' : "") +
      '<div class="wzab"><span class="lbl"></span><span class="lbl">Base</span><span class="lbl">Bonus background</span><span class="lbl">Totale</span>' + ABIL.map(function (a) {
        return "<label for=\"b_" + a[0] + "\">" + a[1] + '</label><input type="number" id="b_' + a[0] + '" name="b_' + a[0] + '" min="1" max="30" value="' + WZ.base[a[0]] + '">' +
          '<input type="number" name="bn_' + a[0] + '" min="0" max="3" value="' + WZ.bonus[a[0]] + '" aria-label="Bonus background ' + a[1] + '"><output id="tot_' + a[0] + '">' + tot[a[0]] + " (" + sgn(mod(tot[a[0]])) + ")</output>";
      }).join("") + '</div><p class="hint" id="wzstato" aria-live="polite">' + esc(wzStato()) + "</p>" +
      '<p class="hint">Il background di solito dà +2 a una caratteristica e +1 a un’altra (oppure +1 a tre): scrivilo nella colonna Bonus.</p>' + wzBarra(true, "Avanti");
  } else if (WZ.step === 3) {
    if (WZ.ts == null) { WZ.ts = {}; if (info) info.ts.forEach(function (k) { WZ.ts[k] = true; }); }
    h += (info ? '<p class="hint">' + info.n + ": dado vita d" + info.dado + ". Dalla classe scegli " + info.sc + " abilità tra quelle evidenziate" + (info.ab ? "" : " (qualsiasi)") + '; il background ne aggiunge altre.</p>' : '<p class="hint">Classe non riconosciuta: scegli tu le competenze.</p>') +
      "<h3>Tiri salvezza</h3><div class=\"cols\">" + ABIL.map(function (a) { return chk("ts_" + a[0], a[1], WZ.ts[a[0]]); }).join("") + "</div>" +
      "<h3>Abilità</h3><div class=\"cols\">" + SKILLS.map(function (k) {
        var inClasse = info && (!info.ab || info.ab.indexOf(k[0]) >= 0);
        return '<label class="c' + (inClasse ? " cl" : "") + '"><input type="checkbox" name="sk_' + k[0] + '"' + (WZ.sk[k[0]] ? " checked" : "") + "><span>" + esc(k[1]) + " <small>" + ABK[k[2]][2] + "</small></span></label>";
      }).join("") + '</div><p class="hint" id="wzconta" aria-live="polite">' + esc(wzConta()) + "</p>" + wzBarra(true, "Avanti");
  } else {
    var t = wzTotali(), cm = mod(t.cos), dado = info ? info.dado : 8, L = WZ.livello;
    if (WZ.pf == null) WZ.pf = Math.max(L, dado + cm + (L - 1) * (Math.floor(dado / 2) + 1 + cm));
    if (WZ.vel == null) WZ.vel = distShow(9);
    var skl = Object.keys(WZ.sk).map(function (k) { return SKILL[k][1]; }).join(", ") || "nessuna";
    h += "<p><strong>" + esc(info ? info.n : (WZ.classe || "Classe da definire")) + "</strong>, livello " + L + (WZ.specie ? ", " + esc(WZ.specie) : "") + (WZ.background ? ", " + esc(WZ.background) : "") + "</p>" +
      "<p class=\"hint\">Caratteristiche: " + ABIL.map(function (a) { return a[2] + " " + t[a[0]]; }).join(", ") + "<br>Tiri salvezza: " +
      (ABIL.filter(function (a) { return WZ.ts[a[0]]; }).map(function (a) { return a[1]; }).join(", ") || "nessuno") + "<br>Abilità: " + esc(skl) + "</p>" +
      '<div class="cols">' + fld("pf", "Punti ferita massimi", WZ.pf, 'min="1" required', "number") + fld("vel", "Velocità (" + distUnit() + ")", WZ.vel, 'min="0" step="any" required', "number") + "</div>" +
      '<p class="hint">' + (info ? "PF calcolati con d" + dado + " al primo livello e la media dei dadi vita dopo (più il modificatore di Costituzione)." : "Classe non riconosciuta: PF stimati con un d8, correggili.") +
      " La CA si calcola dall’armatura che equipaggi: senza armatura è 10 + Destrezza (" + (10 + mod(t.des)) + ").</p>" + wzSlotRiassunto() + wzBarra(true, "Crea scheda");
  }
  h += "</form>";
  $("#dlg").innerHTML = h;
}
function wzConta() {
  var info = classeInfo(WZ.classe);
  var n = SKILLS.filter(function (k) { return WZ.sk[k[0]] && info && (!info.ab || info.ab.indexOf(k[0]) >= 0); }).length;
  var tot = Object.keys(WZ.sk).length;
  return info ? "Dalla classe: " + n + " su " + info.sc + ". Abilità scelte in totale: " + tot + "." : "Abilità scelte: " + tot + ".";
}
function wzAvanti() {
  wzLeggi();
  if (WZ.step < 4) { WZ.step++; wzDisegna(); return; }
  var info = classeInfo(WZ.classe), t = wzTotali(), key = WZ.key, pk = parteDa(key);
  var p = { campagna_id: campId(), id: null, giocatore_id: pk.g, png_id: pk.p, tipo: "completa", specie: WZ.specie, background: WZ.background,
    classe: info ? info.n : WZ.classe, sottoclasse: "", livello: WZ.livello, pf_max: WZ.pf || 1, pf_attuali: WZ.pf || 1, pf_temp: 0,
    ca_manuale: null, ca_bonus: 0, velocita: distM(WZ.vel) == null ? 9 : distM(WZ.vel), ispirazione: false, note: "",
    competenze_ts: ABIL.filter(function (a) { return WZ.ts[a[0]]; }).map(function (a) { return a[0]; }), abilita: {} };
  ABIL.forEach(function (a) { p[a[3]] = Math.min(30, Math.max(1, t[a[0]] || 10)); });
  var sg = slotSuggeriti(info, WZ.livello);
  p.car_incantesimi = info && info.car ? info.car : ""; p.competenze_armi = info ? info.armi.slice() : [];
  p.slot_totali = sg.tot; p.slot_riposo = sg.riposo; p.risorse = [];
  Object.keys(WZ.sk).forEach(function (k) { p.abilita[k] = 1; });
  salvaScheda(p, "Scheda creata").then(function (id) {
    if (id == null) return;
    $("#dlg").close();
    apriDopo(key);
  });
}
document.addEventListener("input", function (e) {
  if (!WZ || !e.target.closest || !e.target.closest("#wzForm")) return;
  wzLeggi();
  if (WZ.step === 2) {
    var tot = wzTotali();
    ABIL.forEach(function (a) { var o = $("#tot_" + a[0]); if (o) o.textContent = tot[a[0]] + " (" + sgn(mod(tot[a[0]])) + ")"; });
    $("#wzstato").textContent = wzStato();
  }
  if (WZ.step === 3) $("#wzconta").textContent = wzConta();
});
document.addEventListener("change", function (e) {
  if (!WZ || !e.target || e.target.name !== "metodo") return;
  wzLeggi();
  WZ.metodo = e.target.value;
  if (WZ.metodo === "standard") ABIL.forEach(function (a, i) { WZ.base[a[0]] = ARRAY_STD[i]; });
  if (WZ.metodo === "punti") ABIL.forEach(function (a) { WZ.base[a[0]] = 8; });
  wzDisegna();
});
$("#dlg").addEventListener("close", function () { WZ = null; });
