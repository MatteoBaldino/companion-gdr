/* =====================================================================
   js/scheda/dettagli-scheda.js
   Cosa fa:   Nella sezione «Scheda»: la parte «descrittiva» del personaggio,
              in tre blocchi che si aprono toccandoli:
                - Personalità: Tratti caratteriali, Ideali, Legami, Difetti
                  (testi liberi, si salvano quando esci dalla casella);
                - Privilegi e tratti: un elenco di voci con nome, descrizione e,
                  se serve, un dado extra al danno (compare nella barra
                  «Prossimo danno», vedi danni-extra.js). Per il Ladro c'è
                  in automatico l'attacco furtivo;
                - Altre competenze e linguaggi: due elenchi di etichette, con
                  suggerimenti e, per il Ladro, le voci della classe.
   Contiene:  puoModificareDettagli, dettagliLista, htmlDettagli, ACT priv-add,
              priv-del, tag-add, tag-del
   Database:  colonna schede.dettagli (jsonb), funzione salva_dettagli_scheda
   Chi scrive: il proprietario della scheda e il master. Gli altri leggono.
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

var DETTAGLI_TESTI = [["caratteri", "Tratti caratteriali"], ["ideali", "Ideali"], ["legami", "Legami"], ["difetti", "Difetti"]];
// Voci che una classe dà in automatico (per ora solo il Ladro). Non si salvano: si calcolano.
var CLASSE_COMP = {
  Ladro: { competenze: ["Armature leggere", "Armi semplici", "Armi da guerra con Accurata o Leggera", "Arnesi da scasso"], linguaggi: ["Gergo ladresco"] }
};
var SUGG_COMP = ["Armature leggere", "Armature medie", "Armature pesanti", "Scudi", "Armi semplici", "Armi da guerra", "Arnesi da scasso", "Kit da erborista", "Kit da travestimento",
  "Strumenti da falsario", "Strumenti da navigatore", "Strumenti musicali", "Set da gioco", "Attrezzi da fabbro", "Strumenti da cuoco", "Veicoli (terrestri)", "Veicoli (acquatici)"];
var SUGG_LING = ["Comune", "Elfico", "Nanico", "Halfling", "Gnomesco", "Gigante", "Orchesco", "Goblin", "Draconico", "Sottocomune", "Silvano", "Primordiale", "Abissale", "Celestiale", "Infernale", "Gergo ladresco", "Gergo druidico"];

var COSTI = { azione: "Azione", bonus: "Azione bonus", reazione: "Reazione" };
// Il pulsante «Usa» delle voci che costano un'azione, un'azione bonus o una reazione.
function bottoneUsa(s, v) {
  if (!v.a || !COSTI[v.a]) return "";
  return '<button class="small usa" data-act="priv-usa" data-id="' + s.id + '" data-a="' + v.a + '" data-n="' + esc(v.n) + '">Usa</button>';
}
function puoModificareDettagli(s) { return isMaster() || (s.giocatore_id != null && s.giocatore_id === S.me.id); }
function dettagliLista(s, k) { var v = (s.dettagli || {})[k]; return Array.isArray(v) ? v : []; }
function autoVoci(s, tipo) {
  var r = [];
  classiDi(s).forEach(function (c) { var x = CLASSE_COMP[c.n]; if (x) (x[tipo] || []).forEach(function (t) { if (r.indexOf(t) < 0) r.push(t); }); });
  return r;
}

function gruppoDettagli(id, titolo, indicatore, corpo, aperti) {
  return '<details data-det-gruppo="' + id + '"' + (aperti[id] ? " open" : "") + '><summary><span class="l">' + titolo + '</span><span class="r">' + indicatore + '</span></summary><div class="body">' + corpo + "</div></details>";
}
function contaVoci(n) { return n ? n + (n === 1 ? " voce" : " voci") : "vuoto"; }

function htmlDettagli(s) {
  var det = s.dettagli || {}, mod = puoModificareDettagli(s), aperti = S.detAperti || {};
  // 1) Personalità
  var scritto = DETTAGLI_TESTI.some(function (c) { return String(det[c[0]] || "").trim() !== ""; });
  var persona = DETTAGLI_TESTI.map(function (c) {
    return '<label class="f"><span>' + c[1] + '</span><textarea data-det="' + c[0] + '" data-id="' + s.id + '" rows="3" maxlength="4000" aria-label="' + c[1] + '"' + (mod ? "" : " readonly") + ">" + esc(det[c[0]] || "") + "</textarea></label>";
  }).join("");
  // 2) Privilegi e tratti
  var fur = furtivoDadi(s), voci = dettagliLista(s, "privilegi"), auto = privilegiAuto(s), nAuto = 0;
  var priv = auto.map(function (g) {
    nAuto += g.voci.length;
    return '<h4 class="sotto">' + esc(g.titolo) + "</h4>" + g.voci.map(function (v) {
      return '<div class="voce"><div><strong>' + esc(v.n) + "</strong>" + (v.a ? ' <span class="tag">' + COSTI[v.a] + "</span>" : "") + (v.furtivo && fur ? ' <span class="tag">+' + fur + "d6 al danno</span>" : "") +
        "<small>" + esc(v.t) + "</small></div>" + bottoneUsa(s, v) + "</div>";
    }).join("");
  }).join("") +
    '<h4 class="sotto">I tuoi</h4>' +
    (voci.length ? "" : '<p class="hint">Aggiungi qui i privilegi e i tratti che non sono già nell’elenco (talenti, doni, oggetti…).</p>') +
    voci.map(function (v, i) {
      return '<div class="voce"><div><strong>' + esc(v.n) + "</strong>" + (v.a ? ' <span class="tag">' + COSTI[v.a] + "</span>" : "") + (v.d ? ' <span class="tag">+' + esc(String(v.d).replace(/^\+/, "")) + " al danno</span>" : "") + (v.t ? "<small>" + esc(v.t) + "</small>" : "") + "</div>" +
        '<div class="voce-az">' + bottoneUsa(s, v) + (mod ? '<button class="small" data-act="priv-del" data-id="' + s.id + '" data-i="' + i + '">Togli</button>' : "") + "</div></div>";
    }).join("") +
    (mod ? '<div class="privadd"><input type="text" id="priv-n" placeholder="Nome (es. Marchio del cacciatore)" maxlength="60" autocomplete="off">' +
      '<input type="text" id="priv-t" placeholder="Descrizione (facoltativa)" maxlength="400" autocomplete="off">' +
      '<input type="text" id="priv-d" placeholder="Dado extra (facoltativo, es. 1d6)" maxlength="12" autocomplete="off">' +
      '<label class="f"><span>Costa</span><select id="priv-a"><option value="">Niente (sempre attivo)</option><option value="azione">Azione</option><option value="bonus">Azione bonus</option><option value="reazione">Reazione</option></select></label>' +
      '<button class="small primary" data-act="priv-add" data-id="' + s.id + '">Aggiungi</button></div>' : "");
  // 3) Altre competenze e linguaggi
  var ncomp = autoVoci(s, "competenze").length + dettagliLista(s, "competenze").length, nling = autoVoci(s, "linguaggi").length + dettagliLista(s, "linguaggi").length;
  var comp = htmlEtichette(s, "competenze", "Competenze", SUGG_COMP, mod) + htmlEtichette(s, "linguaggi", "Linguaggi", SUGG_LING, mod);
  return '<div class="dettagli">' +
    gruppoDettagli("persona", "Personalità", scritto ? "scritto" : "vuoto", persona, aperti) +
    gruppoDettagli("privilegi", "Privilegi e tratti", contaVoci(nAuto + voci.length), priv, aperti) +
    gruppoDettagli("competenze", "Altre competenze e linguaggi", contaVoci(ncomp + nling), comp, aperti) + "</div>";
}

// Un elenco di etichette (competenze o linguaggi): quelle della classe (senza ×), le tue (con ×), e il campo per aggiungerne con i suggerimenti.
function htmlEtichette(s, k, titolo, sugg, mod) {
  var auto = autoVoci(s, k), mie = dettagliLista(s, k);
  return '<h4 class="sotto">' + titolo + '</h4><div class="etichette">' +
    auto.map(function (t) { return '<span class="chipt auto" title="Dalla classe">' + esc(t) + "</span>"; }).join("") +
    mie.map(function (t, i) { return '<span class="chipt">' + esc(t) + (mod ? '<button type="button" data-act="tag-del" data-id="' + s.id + '" data-l="' + k + '" data-i="' + i + '" aria-label="Togli ' + esc(t) + '">×</button>' : "") + "</span>"; }).join("") +
    (!auto.length && !mie.length ? '<span class="hint">Niente scelto.</span>' : "") + "</div>" +
    (mod ? '<div class="tagadd"><input type="text" id="tag-' + k + '" list="dl-' + k + '" placeholder="Aggiungi" maxlength="40" autocomplete="off"><button class="small primary" data-act="tag-add" data-id="' + s.id + '" data-l="' + k + '">Aggiungi</button></div>' +
      '<datalist id="dl-' + k + '">' + sugg.filter(function (t) { return auto.indexOf(t) < 0 && mie.indexOf(t) < 0; }).map(function (t) { return '<option value="' + esc(t) + '"></option>'; }).join("") + "</datalist>" : "");
}

function salvaDettagli(s, patch) {
  return run(function () { return call("salva_dettagli_scheda", { p_id: s.id, p_dettagli: patch }); }).then(function (r) {
    if (!r) return false;
    s.dettagli = Object.assign({}, s.dettagli || {}, patch);
    disegnaTab();
    return true;
  });
}
ACT["priv-add"] = function (b) {
  var s = schedaPerId(b.dataset.id); if (!s) return;
  var n = $("#priv-n").value.trim(), t = $("#priv-t").value.trim(), d = $("#priv-d").value.trim().replace(/\s+/g, ""), lista = dettagliLista(s, "privilegi").slice();
  if (!n) { toast("Scrivi il nome del privilegio o del tratto.", true); return; }
  if (d && !leggiDanno(d)) { toast("Il dado extra va scritto così: 1d6, 2d8 oppure 2d6+1.", true); return; }
  if (lista.length >= 40) { toast("Puoi avere al massimo 40 voci.", true); return; }
  var a = $("#priv-a").value;
  lista.push({ n: n, t: t, d: d, a: a });
  salvaDettagli(s, { privilegi: lista });
};
// «Usa»: in combattimento segna la cella del turno (azione, azione bonus o reazione); fuori dal combattimento non consuma niente.
ACT["priv-usa"] = function (b) {
  var s = schedaPerId(b.dataset.id); if (!s) return;
  var k = b.dataset.a, n = b.dataset.n, nome = { azione: "l’azione", bonus: "l’azione bonus", reazione: "la reazione" }[k];
  if (!inCombattimento(s)) { toast(n + ": fuori dal combattimento non consuma " + nome + "."); }
  else {
    var t = copia(s.turno || {});
    if (t[k]) { toast("Non puoi usare " + n + ": " + nome + " è già usata in questo turno" + (typeof t[k] === "string" ? " (" + t[k] + ")" : "") + ".", true); return; }
    t[k] = n;
    gioco(s, { turno: t });
    toast(n + ": " + nome + " è usata.");
  }
  // L'attacco di opportunità è un attacco fatto con la reazione: il prossimo attacco con un'arma non consuma l'azione.
  if (n === "Attacco di opportunità") { S.attaccoReaz = S.attaccoReaz || {}; S.attaccoReaz[s.id] = true; toast("Tira l’attacco dalla tabella: non consuma l’azione."); }
};
ACT["priv-del"] = function (b) {
  var s = schedaPerId(b.dataset.id); if (!s) return;
  var lista = dettagliLista(s, "privilegi").slice(); lista.splice(Number(b.dataset.i), 1);
  if (S.extraSel) S.extraSel[s.id] = {};
  salvaDettagli(s, { privilegi: lista });
};
ACT["tag-add"] = function (b) {
  var s = schedaPerId(b.dataset.id), k = b.dataset.l; if (!s) return;
  var inp = $("#tag-" + k), t = inp.value.trim(), lista = dettagliLista(s, k).slice();
  if (!t) { toast("Scrivi cosa aggiungere.", true); return; }
  if (lista.concat(autoVoci(s, k)).some(function (x) { return x.toLowerCase() === t.toLowerCase(); })) { toast("C’è già.", true); return; }
  if (lista.length >= (k === "competenze" ? 60 : 30)) { toast("Hai raggiunto il massimo.", true); return; }
  lista.push(t);
  var p = {}; p[k] = lista; salvaDettagli(s, p);
};
ACT["tag-del"] = function (b) {
  var s = schedaPerId(b.dataset.id), k = b.dataset.l; if (!s) return;
  var lista = dettagliLista(s, k).slice(); lista.splice(Number(b.dataset.i), 1);
  var p = {}; p[k] = lista; salvaDettagli(s, p);
};

// Ricordo quali blocchi sono aperti, così restano aperti quando la scheda si ridisegna.
document.addEventListener("toggle", function (e) {
  var d = e.target; if (!d || !d.matches || !d.matches("details[data-det-gruppo]")) return;
  S.detAperti = S.detAperti || {}; S.detAperti[d.getAttribute("data-det-gruppo")] = d.open;
}, true);

// Quando esci da una casella di testo cambiata, il testo si salva.
document.addEventListener("change", function (e) {
  var t = e.target; if (!t || !t.matches || !t.matches("textarea[data-det]")) return;
  var s = schedaPerId(t.getAttribute("data-id")); if (!s) return;
  var k = t.getAttribute("data-det"), dati = {}; dati[k] = t.value;
  run(function () { return call("salva_dettagli_scheda", { p_id: s.id, p_dettagli: dati }); }, "Salvato").then(function (r) {
    if (!r) return;
    s.dettagli = Object.assign({}, s.dettagli || {}, dati);
    var d = t.closest("details");
    if (d) d.querySelector(".r").textContent = DETTAGLI_TESTI.some(function (c) { return String((s.dettagli || {})[c[0]] || "").trim() !== ""; }) ? "scritto" : "vuoto";
  });
});
