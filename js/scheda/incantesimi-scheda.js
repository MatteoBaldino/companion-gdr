/* =====================================================================
   js/scheda/incantesimi-scheda.js
   Cosa fa:   Incantesimi sulla scheda: elenco per livello, preparati e
              lancio.
   Contiene:  puoModificareInc, htmlIncantesimi, rigaInc, htmlCombattimento
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- incantesimi sulla scheda
function puoModificareInc(i) { return isMaster() || (S.me && i.creato_da === S.me.id); }
function htmlIncantesimi(s) {
  if (!S.incOk) return "";
  var st = statInc(s), lista = incDiScheda(s.id);
  var h = '<h3>Incantesimi</h3><p class="hint">' + (st.car ? "Caratteristica: " + ABK[st.car][1] + ". " : "") + (st.cd != null ? "CD " + st.cd + ". " : "") + (st.att != null ? "Attacco " + sgn(st.att) + "." : "") +
    "</p><p><button class=\"small primary\" data-act=\"inc-aggiungi\" data-id=\"" + s.id + "\">Aggiungi incantesimo</button></p>";
  if (!lista.length) return h + '<p class="hint">Nessun incantesimo sulla scheda.</p>';
  for (var lv = 0; lv <= 9; lv++) {
    var l = lista.filter(function (x) { return x.i.livello === lv; }).sort(function (a, b) { return a.i.nome.localeCompare(b.i.nome, "it"); });
    if (!l.length) continue;
    h += "<h4>" + LIV_INC[lv] + "</h4>" + l.map(function (x) { return rigaInc(s, x.r, x.i, st); }).join("");
  }
  return h;
}
function rigaInc(s, r, i, st) {
  var tempo = i.tempo_note && i.tempo_lancio !== "lungo" ? i.tempo_note : (i.tempo_lancio === "lungo" ? (i.tempo_note || TEMPI.lungo) : TEMPI[i.tempo_lancio]);
  var tag = [];
  if (i.concentrazione) tag.push("Concentrazione");
  if (i.rituale) tag.push("Rituale");
  var dim = r.stato === "non_preparato";
  var det = [];
  if (i.scuola) det.push("Scuola: " + i.scuola);
  if (i.durata) det.push("Durata: " + i.durata);
  if (i.componenti) det.push("Componenti: " + i.componenti);
  if (i.classi) det.push("Classi: " + i.classi);
  if (r.fonte) det.push("Fonte: " + r.fonte);
  var h = '<div class="inc' + (dim ? " dim" : "") + '"><div class="inc-top"><strong>' + esc(i.nome) + "</strong>" +
    '<span class="inc-meta">' + [tempo, gittataInc(i)].concat(tag).map(esc).join(", ") + (r.stato === "sempre" ? ", sempre preparato" : dim ? ", non preparato" : "") + "</span></div>" +
    '<div class="row">';
  if (!dim || i.rituale) h += '<button class="small primary" data-act="lancia" data-id="' + s.id + '" data-inc="' + i.id + '">Lancia</button>';
  if (i.livello > 0 && r.stato !== "sempre") h += '<button class="small" data-act="inc-prepara" data-id="' + s.id + '" data-inc="' + i.id + '">' + (dim ? "Prepara" : "Non preparare") + "</button>";
  h += '<button class="small" data-act="inc-rimuovi" data-id="' + s.id + '" data-inc="' + i.id + '">Rimuovi</button></div>' +
    "<details><summary>Dettagli</summary>" + (i.riassunto ? '<p class="pre">' + esc(i.riassunto) + "</p>" : "") +
    (i.livelli_superiori ? "<p>A livelli superiori: " + esc(i.livelli_superiori) + "</p>" : "") +
    (det.length ? '<p class="hint">' + det.map(esc).join(". ") + ".</p>" : "") +
    (puoModificareInc(i) ? '<button class="link" data-act="modifica-inc" data-inc="' + i.id + '">Modifica incantesimo</button>' : "") + "</details></div>";
  return h;
}
function htmlCombattimento(s, key) {
  var h = htmlAttacchi(s, key) + htmlSlot(s) + htmlRisorse(s) + htmlIncantesimi(s);
  if (!S.incOk) h += '<p class="hint">Per attivare incantesimi, slot e turno esegui <code>aggiornamento_incantesimi.sql</code> nello SQL Editor di Supabase.</p>';
  return h;
}
