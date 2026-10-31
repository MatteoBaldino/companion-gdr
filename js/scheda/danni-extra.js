/* =====================================================================
   js/scheda/danni-extra.js
   Cosa fa:   Danni extra che si aggiungono al danno di un'arma, scelti dalla
              barra «Prossimo danno» (accanto a «Prossimo tiro»): l'attacco
              furtivo del Ladro (automatico, in base al livello) e i privilegi
              dell'elenco «Privilegi e tratti» che hanno un dado extra.
              Si accendono prima di tirare il danno e, dopo il tiro, si
              spengono. Nel danno critico i dadi si raddoppiano. Nel risultato
              si legge da cosa è formato il danno («Danno: FrangiAlba + Attacco furtivo»).
              L'attacco furtivo si può usare una volta per turno: in
              combattimento, dopo l'uso, resta segnato «usato» fino a «Nuovo
              turno» (si può comunque riaccendere).
   Controlli:  vedi extraAttivi: arma adatta, svantaggio dell'ultimo attacco, tiro per colpire (incantesimi), uso una volta per turno.
   Contiene:  furtivoDadi, EXTRA_INCANTESIMI, extraConcentrazione, extraDi, htmlBarraExtra, extraAttivi, extraAzzera, ACT extra-tog
   Database:  nessuno di nuovo: i privilegi stanno in schede.dettagli.privilegi,
              l'uso del furtivo nel campo «turno».
   Regole:    attacco furtivo = ceil(livello da Ladro / 2) d6, solo con armi
              accurate o a distanza.
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// Quanti d6 di attacco furtivo ha la scheda (0 se non è un Ladro).
function furtivoDadi(s) {
  var l = 0;
  classiDi(s).forEach(function (c) { if (c.n === "Ladro") l += c.lv || 0; });
  return l ? Math.ceil(l / 2) : 0;
}
// Incantesimi a concentrazione che aggiungono danni a ogni colpo mentre durano (si riconoscono dal nome). Compaiono nella barra da soli
// quando lanci l'incantesimo, restano accesi a ogni colpo e spariscono quando la concentrazione finisce.
var EXTRA_INCANTESIMI = [
  { re: /marchio del cacciatore|hunter'?s mark/i, n: "Marchio del cacciatore", d: "1d6" }
];
function extraConcentrazione(s) {
  var c = String(s.concentrazione || ""); if (!c) return null;
  return EXTRA_INCANTESIMI.filter(function (x) { return x.re.test(c); })[0] || null;
}
// Tutti i danni extra della scheda: [{ k, n, d, furt, fisso }]. «fisso» = resta acceso dopo il tiro (vale a ogni colpo).
function extraDi(s) {
  if (s.tipo !== "completa") return [];
  var r = [], f = furtivoDadi(s), cx = extraConcentrazione(s);
  if (f) r.push({ k: "auto:furtivo", n: "Attacco furtivo", d: f + "d6", furt: true });
  if (cx) r.push({ k: "conc:" + cx.n, n: cx.n, d: cx.d, furt: false, fisso: true });
  dettagliLista(s, "privilegi").forEach(function (v, i) {
    if (v && v.n && v.d && leggiDanno(v.d)) r.push({ k: "p:" + i, n: v.n, d: String(v.d).trim(), furt: false });
  });
  return r;
}
function htmlBarraExtra(s) {
  var l = extraDi(s); if (!l.length) return "";
  var sel = (S.extraSel || {})[s.id] || {}, usato = !!(s.turno || {}).furtivo;
  // Se la concentrazione è finita, il pulsante del Marchio sparisce e, quando lo rilanci, riparte spento.
  Object.keys(sel).forEach(function (k) { if (/^conc:/.test(k) && !l.some(function (e) { return e.k === k; })) delete sel[k]; });
  return '<div class="extrabar" role="group" aria-label="Extra al prossimo danno"><span class="hint">Prossimo danno:</span>' + l.map(function (e) {
    var u = e.furt && usato;
    var tip = u ? "Già usato in questo turno" : e.furt ? "Una volta per turno, se hai vantaggio o un alleato è vicino al bersaglio" : e.fisso ? "Vale a ogni colpo finché dura la concentrazione" : "";
    return '<button type="button" class="small extrachip' + (u ? " usato" : "") + '" data-act="extra-tog" data-id="' + s.id + '" data-k="' + e.k + '" aria-pressed="' + !!sel[e.k] + '"' +
      (tip ? ' title="' + tip + '"' : "") + ">+" + esc(e.d.replace(/^\+/, "")) + " " + esc(e.n) + (u ? " (usato)" : "") + "</button>";
  }).join("") + "</div>";
}
// Gli extra accesi, divisi tra quelli che valgono per questa riga d'attacco (ok) e quelli che non valgono (no, con il motivo).
// I controlli che il sito può fare:
//   - attacco furtivo: serve un'arma accurata o a distanza; non vale se l'ultimo attacco con quell'arma era con svantaggio;
//     se l'attacco era con vantaggio va bene; senza vantaggio il sito ricorda che serve un alleato vicino al bersaglio (avviso);
//   - extra a concentrazione (Marchio): vale con le armi e con gli incantesimi che richiedono un tiro per colpire, non con le cure;
//   - i tuoi extra: valgono con le armi.
// Che il colpo sia andato a segno, e che l'alleato sia davvero vicino, lo decidi tu: il sito non conosce il bersaglio.
function extraAttivi(s, x) {
  var sel = (S.extraSel || {})[s.id] || {}, ok = [], no = [], avviso = false;
  var ult = (S.ultimoAtt || {})[s.id + ":" + x.n];
  extraDi(s).forEach(function (e) {
    if (!sel[e.k]) return;
    if (x.inc) {   // incantesimi: solo gli extra «fissi» e solo con un tiro per colpire
      if (e.fisso && x.b != null && !x.cura) ok.push(e); else if (!e.fisso) no.push({ e: e, m: "vale solo con le armi" });
      return;
    }
    if (e.furt) {
      if (!x.furt) no.push({ e: e, m: "non vale con " + x.n + " (serve un’arma accurata o a distanza)" });
      else if (ult && ult.v === "s") no.push({ e: e, m: "l’ultimo attacco con " + x.n + " era con svantaggio" });
      else { ok.push(e); if (!ult || ult.v !== "v") avviso = true; }
    } else ok.push(e);
  });
  return { ok: ok, no: no, avviso: avviso };
}
// Dopo il tiro i pulsanti si spengono, tranne quelli «fissi» (il Marchio, che vale a ogni colpo).
function extraAzzera(s) {
  var tieni = {};
  extraDi(s).forEach(function (e) { if (e.fisso && S.extraSel && S.extraSel[s.id] && S.extraSel[s.id][e.k]) tieni[e.k] = true; });
  if (S.extraSel) S.extraSel[s.id] = tieni;
  document.querySelectorAll('[data-act="extra-tog"][data-id="' + s.id + '"]').forEach(function (e) { e.setAttribute("aria-pressed", tieni[e.dataset.k] ? "true" : "false"); });
}
ACT["extra-tog"] = function (b) {
  S.extraSel = S.extraSel || {};
  var s = schedaPerId(b.dataset.id), m = S.extraSel[b.dataset.id] = S.extraSel[b.dataset.id] || {}, k = b.dataset.k;
  m[k] = !m[k];
  if (m[k] && k === "auto:furtivo" && s && (s.turno || {}).furtivo) toast("L’attacco furtivo è già stato usato in questo turno.");
  document.querySelectorAll('[data-act="extra-tog"][data-id="' + b.dataset.id + '"][data-k="' + k + '"]').forEach(function (e) { e.setAttribute("aria-pressed", m[k] ? "true" : "false"); });
};
