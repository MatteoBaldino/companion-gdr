/* =====================================================================
   js/incantesimi/libreria-incantesimi.js
   Cosa fa:   Libreria degli incantesimi del master e modulo per crearli e
              modificarli.
   Contiene:  filtroInc, editorInc, htmlLibInc, htmlListaInc, bindLibInc
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- editor degli incantesimi
var filtroInc = { q: "", liv: "" };
function editorInc(i, perScheda) {
  var d = i || { livello: 0, tempo_lancio: "azione", effetto: "automatico" };
  var corpo = fld("nome", "Nome", d.nome, "required") +
    '<div class="cols">' + sel("livello", "Livello", LIV_INC.map(function (n, k) { return [String(k), k === 0 ? "Trucchetto" : n]; }), String(d.livello)) +
    fld("scuola", "Scuola", d.scuola, 'list="listascuole"') + "</div>" +
    '<datalist id="listascuole"><option>Abiurazione</option><option>Divinazione</option><option>Ammaliamento</option><option>Evocazione</option><option>Illusione</option><option>Necromanzia</option><option>Invocazione</option><option>Trasmutazione</option></datalist>' +
    '<div class="cols">' + sel("tempo_lancio", "Tempo di lancio", [["azione", "Azione"], ["azione_bonus", "Azione bonus"], ["reazione", "Reazione"], ["lungo", "Più di un minuto"]], d.tempo_lancio) +
    fld("tempo_note", "Nota sul tempo (es. 1 minuto)", d.tempo_note) + "</div>" +
    '<div class="cols">' + fld("gittata", "Gittata (" + distUnit() + ")", d.gittata_m != null ? distShow(d.gittata_m) : null, 'min="0" step="any"', "number") +
    fld("gittata_speciale", "Oppure: Contatto, Se stessi…", d.gittata_speciale) + fld("componenti", "Componenti (V, S, M)", d.componenti) +
    fld("durata", "Durata", d.durata) + "</div>" +
    chk("concentrazione", "Richiede concentrazione", d.concentrazione) + chk("rituale", "Si può lanciare come rituale", d.rituale) +
    '<div class="cols">' + sel("effetto", "Effetto", [["automatico", "Nessun tiro (automatico)"], ["attacco", "Attacco con incantesimo"], ["salvezza", "Tiro salvezza del bersaglio"]], d.effetto) +
    sel("tiro_salvezza", "Se tiro salvezza: caratteristica", [["", "—"]].concat(ABIL.map(function (a) { return [a[0], a[1]]; })), d.tiro_salvezza || "") + "</div>" +
    '<div class="cols">' + fld("danno", "Danno o cura (es. 1d10)", d.danno) + fld("tipo_danno", "Tipo (fuoco, radianti, cura…)", d.tipo_danno) + "</div>" +
    chk("aggiunge_mod", "Aggiunge il modificatore da incantatore (tipico delle cure)", d.aggiunge_mod) +
    fld("livelli_superiori", "A livelli superiori", d.livelli_superiori) + fld("classi", "Classi che lo hanno", d.classi) +
    area("riassunto", "Riassunto con parole tue (non incollare il testo del manuale)", d.riassunto);
  modal(i ? "Modifica incantesimo" : "Nuovo incantesimo", corpo, function (fd) {
    var x = leggi(fd), ef = x.g("effetto");
    var p = { campagna_id: campId(), id: i ? i.id : null, nome: x.g("nome"), livello: Number(x.g("livello")) || 0, scuola: x.g("scuola"),
      tempo_lancio: x.g("tempo_lancio"), tempo_note: x.g("tempo_note"), gittata_m: distM(x.n("gittata")), gittata_speciale: x.g("gittata_speciale"),
      componenti: x.g("componenti"), durata: x.g("durata"), concentrazione: x.b("concentrazione"), rituale: x.b("rituale"), effetto: ef,
      tiro_salvezza: ef === "salvezza" ? x.g("tiro_salvezza") : "", danno: x.g("danno"), tipo_danno: x.g("tipo_danno"), aggiunge_mod: x.b("aggiunge_mod"),
      livelli_superiori: x.g("livelli_superiori"), classi: x.g("classi"), riassunto: x.g("riassunto") };
    return run(function () { return call("salva_incantesimo", { p: p }); }, i ? "Incantesimo aggiornato" : "Incantesimo creato").then(function (r) {
      if (!r) return false;
      var nuovo = r.v;
      var dopo = perScheda && !i ? call("imposta_incantesimo_scheda", { p_scheda: Number(perScheda), p_inc: nuovo, p_stato: "preparato", p_fonte: null }) : Promise.resolve();
      return dopo.then(function () { return caricaDati().then(disegnaTab); }, function (e) { toast(errText(e), true); });
    });
  });
}
function htmlLibInc() {
  if (!S.incOk) return '<div class="empty">Per usare gli incantesimi esegui <code>aggiornamento_incantesimi.sql</code> nello SQL Editor di Supabase.</div>';
  return '<div class="toolbar"><input type="search" id="fqi" placeholder="Cerca per nome" aria-label="Cerca incantesimo" value="' + esc(filtroInc.q) + '">' +
    '<select id="fli" aria-label="Filtra per livello"><option value="">Tutti i livelli</option>' + LIV_INC.map(function (n, k) { return '<option value="' + k + '"' + (filtroInc.liv === String(k) ? " selected" : "") + ">" + (k === 0 ? "Trucchetti" : n) + "</option>"; }).join("") +
    '</select><button class="primary" data-act="nuovo-inc">Nuovo incantesimo</button></div><div id="listainc">' + htmlListaInc() + "</div>";
}
function htmlListaInc() {
  if (!S.inc.length) return '<div class="empty"><p>La libreria degli incantesimi è vuota. Aggiungine uno, oppure parti dai 14 di esempio (quelli di una scheda di Chierico di livello 2).</p><div class="row"><button class="primary" data-act="nuovo-inc">Nuovo incantesimo</button><button data-act="esempi-inc">Carica incantesimi di esempio</button></div></div>';
  var q = filtroInc.q.trim().toLowerCase();
  var l = S.inc.filter(function (i) { return (filtroInc.liv === "" || String(i.livello) === filtroInc.liv) && (!q || i.nome.toLowerCase().indexOf(q) >= 0); })
    .sort(function (a, b) { return a.livello - b.livello || a.nome.localeCompare(b.nome, "it"); });
  if (!l.length) return '<div class="empty">Nessun incantesimo corrisponde alla ricerca.</div>';
  return l.map(function (i) {
    var meta = [i.livello === 0 ? "Trucchetto" : i.livello + "° livello", i.tempo_note || TEMPI[i.tempo_lancio], gittataInc(i)];
    if (i.concentrazione) meta.push("Concentrazione");
    if (i.rituale) meta.push("Rituale");
    return '<div class="inc"><div class="inc-top"><strong>' + esc(i.nome) + '</strong><span class="inc-meta">' + meta.map(esc).join(", ") + "</span></div>" +
      (i.riassunto ? '<p class="desc">' + esc(i.riassunto) + "</p>" : "") +
      '<div class="row"><button class="small" data-act="modifica-inc" data-inc="' + i.id + '">Modifica</button><button class="small danger" data-act="elimina-inc" data-inc="' + i.id + '">Elimina</button></div></div>';
  }).join("");
}
function bindLibInc() {
  var fq = $("#fqi"), fl = $("#fli");
  if (fq) fq.addEventListener("input", function () { filtroInc.q = fq.value; $("#listainc").innerHTML = htmlListaInc(); });
  if (fl) fl.addEventListener("change", function () { filtroInc.liv = fl.value; $("#listainc").innerHTML = htmlListaInc(); });
}
