/* =====================================================================
   js/scheda/attacchi.js
   Cosa fa:   Tabella degli attacchi: armi equipaggiate e incantesimi, con
              bonus per colpire e danno.
   Contiene:  attacchi, htmlAttacchi
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- attacchi
// Dadi del danno di un'arma: i dadi dell'arma più il modificatore (caratteristica e bonus magico).
function ddArma(a, dm) {
  var d = leggiDanno(a.danno);
  return d ? { gruppi: d.gruppi, piatto: d.piatto + dm } : null;
}
// Dadi del danno di un incantesimo: i trucchetti crescono con il livello; si aggiunge il modificatore se previsto.
function ddInc(s, i, st) {
  if (!i.danno) return null;
  var d = leggiDanno(i.livello === 0 ? scalaDadi(i.danno, s.livello) : i.danno);
  if (!d) return null;
  if (i.aggiunge_mod && st.mod != null) d.piatto += st.mod;
  return d;
}
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
      righe.push({ n: o.nome, b: colpo, dd: ddArma(a, dm), tiro: sgn(colpo), danno: d, gitt: a.gittata_normale ? fmtDist(a.gittata_normale) + (a.gittata_massima ? "/" + dec(distShow(a.gittata_massima)) : "") : fmtDist(1.5), note: note.join("; ") });
    });
    righe.push({ n: "Colpo senza armi", b: fo + bc, dd: { gruppi: [], piatto: Math.max(0, 1 + fo) }, tiro: sgn(fo + bc), danno: Math.max(0, 1 + fo) + " contundenti", gitt: fmtDist(1.5), note: "" });
  }
  incDiScheda(s.id).forEach(function (x) {
    var i = x.i;
    if (i.livello > 0 && x.r.stato === "non_preparato") return;
    if (i.effetto === "automatico" && !i.danno) return;
    var tiro = "—";
    if (i.effetto === "attacco") tiro = st.att != null ? sgn(st.att) : "attacco";
    if (i.effetto === "salvezza") tiro = (st.cd != null ? "CD " + st.cd + " " : "") + ABK[i.tiro_salvezza][2];
    righe.push({ n: i.nome, inc: true, b: (i.effetto === "attacco" && st.att != null) ? st.att : null, dd: ddInc(s, i, st), tiro: tiro, danno: dannoInc(s, i, st), gitt: gittataInc(i), note: i.livello === 0 ? "trucchetto" : i.livello + "° livello" });
  });
  return righe;
}
// Celle della tabella: il bonus per colpire e il danno sono pulsanti che tirano i dadi.
function celTiro(s, x, n) {
  if (x.b == null) return esc(x.tiro);
  return '<button class="small dadobtn" data-act="dado" data-k="att" data-id="' + s.id + '" data-r="' + n + '" aria-label="Tira per colpire: ' + esc(x.n) + '">' + esc(x.tiro) + "</button>";
}
function celDanno(s, x, n) {
  if (!x.dd) return esc(x.danno);
  var crit = !!(S.crit && S.crit[s.id + ":" + x.n]);
  return '<button class="small dadobtn' + (crit ? " crit" : "") + '" data-act="dado" data-k="dan" data-id="' + s.id + '" data-r="' + n + '" aria-label="Tira il danno: ' + esc(x.n) + '">' +
    (crit ? "Danno critico " : "") + esc(x.danno) + "</button>";
}
function htmlAttacchi(s, key) {
  var r = attacchi(s, key);
  if (!r.length) return "";
  var h = '<h3>Attacchi</h3><div class="scroll"><table class="att"><thead><tr><th>Nome</th><th>Tiro</th><th>Danno</th><th>Gittata</th><th>Note</th></tr></thead><tbody>' +
    r.map(function (x, n) { return "<tr><td>" + esc(x.n) + "</td><td>" + celTiro(s, x, n) + "</td><td>" + celDanno(s, x, n) + "</td><td>" + esc(x.gitt) + "</td><td>" + esc(x.note) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  if (s.tipo === "completa") h += '<p class="hint">Le armi compaiono quando le equipaggi nell’inventario. Bonus e danno usano la caratteristica giusta, la competenza e il bonus per colpire dell’oggetto.</p>';
  return h;
}
