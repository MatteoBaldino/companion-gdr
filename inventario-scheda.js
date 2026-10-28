/* =====================================================================
   js/scheda/inventario-scheda.js
   Cosa fa:   Nella scheda: la barra delle monete (quattro caselle che si
              scrivono e si salvano da sole), l'inventario con le note di
              ogni oggetto e l'etichetta del peso (Leggero, Normale,
              Appesantito, Molto appesantito) con la tendina delle soglie.
   Contiene:  pesoMoneta, moneteDi, rameTotali, dividiMonete, testoMonete,
              contaMonete, pesoTrasportato, statoCarico, notaOggetto,
              htmlMonete, htmlInventarioScheda
   Database:  funzione aggiorna_monete, colonna schede.monete,
              colonna campagne.peso_moneta_kg
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- monete
// Ordine dalla più preziosa alla meno preziosa. Il valore è in rame (Ra).
var MON = [["pt", "Platino", "Pt", 1000000], ["or", "Oro", "Or", 10000], ["ar", "Argento", "Ar", 100], ["ra", "Rame", "Ra", 1]];

// [MODIFICA QUI] Peso di una moneta in kg: viene dalla campagna (colonna peso_moneta_kg), 0,01 se manca.
function pesoMoneta() {
  var c = one(S.me.campagne) || {};
  var p = Number(c.peso_moneta_kg);
  return isNaN(p) || c.peso_moneta_kg == null ? 0.01 : p;
}
function moneteDi(s) {
  var m = s.monete || {}, r = {};
  MON.forEach(function (x) { r[x[0]] = Math.max(0, Math.floor(Number(m[x[0]]) || 0)); });
  return r;
}
function rameTotali(m) {
  var t = 0;
  MON.forEach(function (x) { t += (m[x[0]] || 0) * x[3]; });
  return t;
}
function dividiMonete(t) {
  var r = {}, resto = t;
  MON.forEach(function (x) { r[x[0]] = Math.floor(resto / x[3]); resto -= r[x[0]] * x[3]; });
  return r;
}
function testoMonete(m) {
  var p = [];
  MON.forEach(function (x) { if (m[x[0]] > 0) p.push(m[x[0]] + " " + x[2]); });
  return p.length ? p.join(" ") : "0 Ra";
}
function contaMonete(m) {
  var n = 0;
  MON.forEach(function (x) { n += m[x[0]] || 0; });
  return n;
}

// ---------------------------------------------------------------- peso trasportato
function pesoTrasportato(s, key) {
  var og = invDi(key).reduce(function (t, i) { return t + (Number(i.oggetti.peso) || 0) * i.quantita; }, 0);
  var nm = contaMonete(moneteDi(s));
  return { oggetti: og, monete: nm * pesoMoneta(), nMonete: nm, tot: og + nm * pesoMoneta() };
}
// [REGOLA] Capacità = Forza × 7,5 kg. Le soglie degli stati sono una regola della casa: il manuale 2024 ha solo il limite massimo.
// Leggero fino a metà della soglia di Appesantito (scelta di questa scheda); Appesantito oltre Forza × 2,5; Molto appesantito oltre Forza × 5.
function statoCarico(s, tot) {
  var f = Number(s.forza) || 10;
  var L = f * 1.25, N = f * 2.5, H = f * 5, M = f * 7.5;
  var nome, cl;
  if (tot <= L) { nome = "Leggero"; cl = "c-leg"; }
  else if (tot <= N) { nome = "Normale"; cl = "c-nor"; }
  else if (tot <= H) { nome = "Appesantito"; cl = "c-app"; }
  else { nome = "Molto appesantito"; cl = "c-mol"; }
  return { nome: nome, cl: cl, L: L, N: N, H: H, M: M, oltre: tot > M };
}

// ---------------------------------------------------------------- barra delle monete
function htmlMonete(s) {
  var m = moneteDi(s), t = rameTotali(m);
  // Le caselle sono campi: scrivi il numero e premi Invio (o esci dal campo) per salvarlo.
  var casella = function (x) {
    return '<label class="vit mon"><span class="lbl">' + x[1] + " (" + x[2] + ')</span><input type="number" min="0" step="1" id="mc_' + x[0] + '" value="' + m[x[0]] +
      '" data-id="' + s.id + '" aria-label="' + x[1] + '"></label>';
  };
  return '<h3>Monete</h3><div class="monete">' + MON.map(casella).join("") + "</div>" +
    '<p class="hint">Totale: <strong>' + esc(testoMonete(dividiMonete(t))) + "</strong> · " + t.toLocaleString("it-IT") + " Ra. " +
    "Per cambiare una moneta scrivi il numero nella sua casella e premi Invio.</p>";
}

// ---------------------------------------------------------------- inventario nella scheda
// Le note di un oggetto: i suoi dettagli (danno, proprietà, CA, effetto...), le regole speciali, l'effetto condizionale,
// il bonus da equipaggiato e, se c'è, la proprietà nascosta (ai giocatori solo quando è stata rivelata).
function notaOggetto(o) {
  var n = dettagli(o).slice();
  if (o.regole_extra) n.push(o.regole_extra);
  if (o.effetto_condizionale) n.push(o.effetto_condizionale);
  if (o.bonus) n.push("equipaggiato: " + o.bonus);
  var seg = one(o.oggetti_segreti);
  if (seg && (isMaster() || seg.rivelato)) n.push((seg.rivelato ? "proprietà rivelata: " : "proprietà nascosta: ") + seg.testo);
  return n.filter(Boolean).join(" · ");
}
function htmlInventarioScheda(s, key) {
  var righe = invDi(key).slice().sort(function (a, b) { return a.oggetti.nome.localeCompare(b.oggetti.nome, "it"); });
  var p = pesoTrasportato(s, key), st = statoCarico(s, p.tot);
  var tab = function (nome, a, b) { return "<tr><td>" + nome + "</td><td>" + a + "</td></tr>"; };
  var h = '<h3>Inventario</h3><details class="tendina carico"><summary class="stato-c"><span class="badge-c ' + st.cl + '">' + st.nome + "</span>" +
    "<span>" + dec(pesoShow(p.tot)) + "/" + fmtPeso(st.M) + "</span></summary>" +
    '<table class="soglie">' +
    tab("Leggero", "fino a " + fmtPeso(st.L) + " (FOR × 1,25)") +
    tab("Normale", "oltre " + fmtPeso(st.L) + ", fino a " + fmtPeso(st.N) + " (FOR × 2,5)") +
    tab("Appesantito", "oltre " + fmtPeso(st.N) + ", fino a " + fmtPeso(st.H) + " (FOR × 5). Velocità ridotta di 3 m") +
    tab("Molto appesantito", "oltre " + fmtPeso(st.H) + ", fino a " + fmtPeso(st.M) + " (FOR × 7,5). Velocità ridotta di 6 m e svantaggio a prove, attacchi e tiri salvezza di FOR, DES e COS") +
    "</table>" +
    '<p class="hint">Peso massimo trasportabile: FOR ' + (Number(s.forza) || 10) + " × 7,5 = " + fmtPeso(st.M) + ". Oltre non puoi portare altro. " +
    "La soglia del Leggero e gli effetti sono regole della casa di questa scheda: per ora il sito non li applica da solo.</p></details>";
  if (st.oltre) h += '<p class="avviso">Superi la capacità di carico di ' + fmtPeso(st.M) + ".</p>";
  if (!righe.length && !p.nMonete) return h + '<p class="hint">Inventario vuoto.</p>';
  h += '<ul class="plain invs">' + righe.map(function (i) {
    var o = i.oggetti, eq = o.categoria !== "cibo"
      ? '<button class="small" data-act="equip" data-inv="' + i.id + '" data-v="' + (i.equipaggiato ? "0" : "1") + '">' + (i.equipaggiato ? "Rimetti nello zaino" : "Equipaggia") + "</button>" : "";
    var nota = notaOggetto(o), extra = (nota ? "<p>" + esc(nota) + "</p>" : "") + (o.descrizione ? "<p>" + esc(o.descrizione) + "</p>" : "");
    return "<li><span class=\"n\">" + esc(o.nome) + (i.quantita > 1 ? " ×" + i.quantita : "") +
      (i.equipaggiato ? ' <span class="tag">equipaggiato</span>' : "") + '</span><span class="w">' + fmtPeso((Number(o.peso) || 0) * i.quantita) + "</span>" + eq +
      (extra ? '<details class="notebtn nota-i"><summary>Note</summary>' + extra + "</details>" : "") + "</li>";
  }).join("") +
    (p.nMonete ? '<li><span class="n">Monete <span class="tag">' + p.nMonete + '</span></span><span class="w">' + fmtPeso(p.monete) + "</span></li>" : "") + "</ul>";
  return h;
}

// Una casella delle monete è stata cambiata: salvo tutte e quattro.
document.addEventListener("change", function (e) {
  var el = e.target;
  if (el && el.matches && el.matches(".monete input") && el.dataset.id) cambiaMonete(el.dataset.id);
});
