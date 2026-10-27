/* =====================================================================
   js/scheda/attacchi.js
   Cosa fa:   Tabella degli attacchi: armi equipaggiate e incantesimi, con
              bonus per colpire e danno.
   Contiene:  attacchi, htmlAttacchi
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- attacchi
function attacchi(s, key) {
  var righe = [], bc = bonusComp(s.livello), st = statInc(s);
  if (s.tipo === "completa") {
    var fo = mod(s.forza), de = mod(s.destrezza);
    invDi(key).forEach(function (i) {
      var o = i.oggetti, a = one(o.armi);
      if (!i.equipaggiato || o.categoria !== "arma" || !a || a.modalita === "assedio") return;
      var prop = (a.proprieta || []).map(function (x) { return String(x).toLowerCase(); });
      var fin = prop.indexOf("accurata") >= 0 || prop.indexOf("finesse") >= 0;
      var m = a.modalita === "distanza" ? de : (fin ? Math.max(fo, de) : fo);
      var comp = competenteArma(s, a, prop), mag = a.bonus_attacco || 0;
      var colpo = m + (comp ? bc : 0) + mag, dm = m + mag;
      var d = a.danno + (dm ? sgn(dm) : "") + " " + a.tipo_danno;
      if (a.danno_versatile) d += " (a due mani " + a.danno_versatile + (dm ? sgn(dm) : "") + ")";
      var note = [];
      if (!comp) note.push("senza competenza");
      if (o.effetto_condizionale) note.push(o.effetto_condizionale);
      righe.push({ n: o.nome, tiro: sgn(colpo), danno: d, gitt: a.gittata_normale ? fmtDist(a.gittata_normale) + (a.gittata_massima ? "/" + dec(distShow(a.gittata_massima)) : "") : fmtDist(1.5), note: note.join("; ") });
    });
    righe.push({ n: "Colpo senza armi", tiro: sgn(fo + bc), danno: Math.max(0, 1 + fo) + " contundenti", gitt: fmtDist(1.5), note: "" });
  }
  incDiScheda(s.id).forEach(function (x) {
    var i = x.i;
    if (i.livello > 0 && x.r.stato === "non_preparato") return;
    if (i.effetto === "automatico" && !i.danno) return;
    var tiro = "—";
    if (i.effetto === "attacco") tiro = st.att != null ? sgn(st.att) : "attacco";
    if (i.effetto === "salvezza") tiro = (st.cd != null ? "CD " + st.cd + " " : "") + ABK[i.tiro_salvezza][2];
    righe.push({ n: i.nome, tiro: tiro, danno: dannoInc(s, i, st), gitt: gittataInc(i), note: i.livello === 0 ? "trucchetto" : i.livello + "° livello" });
  });
  return righe;
}
function htmlAttacchi(s, key) {
  var r = attacchi(s, key);
  if (!r.length) return "";
  var h = '<h3>Attacchi</h3><div class="scroll"><table class="att"><thead><tr><th>Nome</th><th>Tiro</th><th>Danno</th><th>Gittata</th><th>Note</th></tr></thead><tbody>' +
    r.map(function (x) { return "<tr><td>" + esc(x.n) + "</td><td>" + esc(x.tiro) + "</td><td>" + esc(x.danno) + "</td><td>" + esc(x.gitt) + "</td><td>" + esc(x.note) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  if (s.tipo === "completa") h += '<p class="hint">Le armi compaiono quando le equipaggi nell’inventario. Bonus e danno usano la caratteristica giusta, la competenza e il bonus per colpire dell’oggetto.</p>';
  return h;
}
