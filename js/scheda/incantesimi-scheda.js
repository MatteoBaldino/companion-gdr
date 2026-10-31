/* =====================================================================
   js/scheda/incantesimi-scheda.js
   Cosa fa:   Incantesimi sulla scheda: elenco per livello, preparati e
              lancio.
   Contiene:  puoModificareInc, htmlIncantesimi, rigaInc, htmlSezIncantesimi, htmlCombattimento
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- incantesimi sulla scheda
function puoModificareInc(i) { return isMaster() || (S.me && i.creato_da === S.me.id); }
// solo = "trucchetti": solo i trucchetti (livello 0), per la sezione Scheda. Senza: tutti gli incantesimi, per la sezione Incantesimi.
function htmlIncantesimi(s, solo) {
  if (!S.incOk) return "";
  var st = statInc(s), lista = incDiScheda(s.id), righe = attacchi(s, keyDiScheda(s)), perInc = {};
  righe.forEach(function (x, n) { if (x.incId) perInc[x.incId] = { x: x, n: n }; });
  var soloTr = solo === "trucchetti";
  var attesi = trucchettiAttesi(s), conosciuti = lista.filter(function (x) { return x.i.livello === 0; }).length;
  var contaTr = attesi ? '<p class="hint">Trucchetti conosciuti: <strong>' + conosciuti + "</strong> di " + attesi + (conosciuti > attesi ? " (ne hai più del previsto)" : "") + ".</p>" : "";
  var h = soloTr ? "<h3>Trucchetti</h3>" + contaTr :
    '<h3>Incantesimi</h3><p class="hint">' + (st.car ? "Caratteristica: " + ABK[st.car][1] + ". " : "") + (st.cd != null ? "CD " + st.cd + ". " : "") + (st.att != null ? "Attacco " + sgn(st.att) + "." : "") +
    (!st.car && s.tipo === "completa" ? "Per calcolare attacco e CD scegli la caratteristica da incantatore in «Modifica scheda»." : "") +
    "</p>" + contaTr + htmlClassiMulti(s) + "<p><button class=\"small primary\" data-act=\"inc-aggiungi\" data-id=\"" + s.id + "\">Aggiungi incantesimo</button></p>";
  if (!lista.length || (soloTr && !lista.some(function (x) { return x.i.livello === 0; }))) return h + '<p class="hint">Nessun ' + (soloTr ? "trucchetto" : "incantesimo") + " sulla scheda.</p>";
  for (var lv = 0; lv <= (soloTr ? 0 : 9); lv++) {
    var l = lista.filter(function (x) { return x.i.livello === lv; }).sort(function (a, b) { return a.i.nome.localeCompare(b.i.nome, "it"); });
    if (!l.length) continue;
    // Accanto al titolo del livello ci sono i suoi slot: si toccano per segnarli usati.
    h += '<h4 class="inc-liv">' + LIV_INC[lv] + (lv > 0 ? htmlPipsLivello(s, lv) : "") + "</h4>" + l.map(function (x) { return rigaInc(s, x.r, x.i, st, perInc[x.i.id]); }).join("");
  }
  return h;
}
// Una riga per incantesimo: nome e dati, poi tiro per colpire, danno o cura, gittata, Prepara e Note.
function rigaInc(s, r, i, st, ra) {
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
  var lancia = (!dim || i.rituale) ? '<button class="small primary" data-act="lancia" data-id="' + s.id + '" data-inc="' + i.id + '">Lancia</button>' : "";
  var prepara = (i.livello > 0 && r.stato !== "sempre") ? '<button class="small" data-act="inc-prepara" data-id="' + s.id + '" data-inc="' + i.id + '">' + (dim ? "Prepara" : "Non preparare") + "</button>" : "";
  var note = '<details class="notebtn"><summary>Note</summary>' + (i.riassunto ? '<p class="pre">' + esc(i.riassunto) + "</p>" : "") +
    (i.livelli_superiori ? "<p>A livelli superiori: " + esc(i.livelli_superiori) + "</p>" : "") +
    (det.length ? "<p>" + det.map(esc).join(". ") + ".</p>" : "") +
    '<p class="row"><button class="small" data-act="inc-rimuovi" data-id="' + s.id + '" data-inc="' + i.id + '">Togli dalla scheda</button>' +
    (puoModificareInc(i) ? '<button class="small" data-act="modifica-inc" data-inc="' + i.id + '">Modifica incantesimo</button>' : "") + "</p></details>";
  return '<div class="inc' + (dim ? " dim" : "") + '"><div class="inc-top"><strong>' + esc(i.nome) + "</strong>" +
    '<span class="inc-meta">' + [tempo, gittataInc(i)].concat(tag).filter(function (t) { return t && t !== "—"; }).map(esc).join(", ") + (r.stato === "sempre" ? ", sempre preparato" : dim ? ", non preparato" : "") + "</span>" + lancia + "</div>" +
    '<div class="inc-riga"><span class="ic-t">' + (ra ? celTiro(s, ra.x, ra.n) : "—") + '</span><span class="ic-d">' + (ra ? celDanno(s, ra.x, ra.n) : "—") + '</span>' +
    '<span class="ic-g">' + esc(gittataInc(i)) + "</span>" + prepara + note + "</div></div>";
}
// La sezione «Incantesimi» della scheda completa: risorse, trucchetti e incantesimi (gli slot stanno nella sezione Scheda).
function htmlSezIncantesimi(s) {
  var h = htmlRisorse(s) + htmlIncantesimi(s);
  if (!S.incOk) h += '<p class="hint">Per attivare incantesimi, slot e turno esegui <code>aggiornamento_incantesimi.sql</code> nello SQL Editor di Supabase.</p>';
  return h;
}
function htmlCombattimento(s, key) {
  var h = htmlAttacchi(s, key) + htmlSlot(s) + htmlRisorse(s) + htmlIncantesimi(s);
  if (!S.incOk) h += '<p class="hint">Per attivare incantesimi, slot e turno esegui <code>aggiornamento_incantesimi.sql</code> nello SQL Editor di Supabase.</p>';
  return h;
}
