/* =====================================================================
   js/battle/segnalino.js
   Cosa fa:   Finestre del segnalino e della mappa: nome, PF, iniziativa,
              dimensione, nascosto, duplica ed elimina.
   Contiene:  apriSegnalino, salvaSegnalino, nomeSuccessivo,
              duplicaSegnalino, eliminaSegnalinoDlg, nuovoGenerico,
              apriMappa, eliminaMappaDlg
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- finestre del segnalino e della mappa
// Il giocatore cambia nome, PF attuali e iniziativa del proprio segnalino; il master tutto il resto.
function apriSegnalino(s) {
  var p = B.pf[s.id] || null, master = bMaster();
  var corpo = fld("nome", "Nome", s.nome, 'required maxlength="60"');
  if (p || master) {
    corpo += '<div class="cols">' + fld("pf_att", "PF attuali", p ? p.pf_att : "", 'min="0"', "number") +
      (master ? fld("pf_max", "PF massimi", p ? p.pf_max : "", 'min="0"', "number") : "") + "</div>";
  }
  corpo += fld("iniziativa", "Iniziativa", s.iniziativa == null ? "" : s.iniziativa, 'min="-20" max="99"', "number");
  if (master) {
    corpo += sel("taglia", "Dimensione", [["0.5", "Piccola"], ["1", "Media"], ["2", "Grande"], ["3", "Enorme"]], String(Number(s.taglia))) +
      chk("nascosto", "Nascosto ai giocatori", s.nascosto) +
      (p ? chk("pf_vis", "Mostra i PF ai giocatori", p.visibile_giocatori) : "") +
      '<div class="row"><button type="button" data-seg="duplica" data-id="' + s.id + '">Duplica</button>' +
      '<button type="button" class="danger" data-seg="elimina" data-id="' + s.id + '">Elimina dalla mappa</button></div>';
  }
  modal(s.nome, corpo, function (fd) { return salvaSegnalino(s, p, fd); }, "Salva");
}

// Confronta i campi con quello che c'era e manda al database solo le differenze.
function salvaSegnalino(s, p, fd) {
  var g = function (k) { return String(fd.get(k) == null ? "" : fd.get(k)).trim(); };
  var n = function (k) { var v = g(k).replace(",", "."); return v === "" ? null : Number(v); };
  var master = bMaster(), passi = [];
  if (!g("nome")) { toast("Il nome non può essere vuoto.", true); return false; }
  if (g("nome") !== s.nome) passi.push(["rinomina_segnalino", { p_id: s.id, p_nome: g("nome") }]);

  var att = n("pf_att"), max = master ? n("pf_max") : null;
  if (master && max != null && att == null) att = p ? p.pf_att : max;
  if (att != null && (!p || att !== p.pf_att || (max != null && max !== p.pf_max))) {
    passi.push(["imposta_pf_segnalino", { p_id: s.id, p_att: att, p_max: max }]);
  }
  var ini = n("iniziativa");
  if (ini !== (s.iniziativa == null ? null : Number(s.iniziativa))) passi.push(["imposta_iniziativa", { p_id: s.id, p_valore: ini }]);
  if (master) {
    var cambi = {}, nasc = fd.get("nascosto") === "on", vis = fd.get("pf_vis") === "on";
    if (Number(g("taglia")) !== Number(s.taglia)) cambi.taglia = Number(g("taglia"));
    if (nasc !== !!s.nascosto) cambi.nascosto = nasc;
    if (p && vis !== !!p.visibile_giocatori) cambi.visibile_pf = vis;
    if (Object.keys(cambi).length) passi.push(["imposta_segnalino", { p_id: s.id, p: cambi }]);
  }
  if (!passi.length) return true;
  return passi.reduce(function (prec, st) { return prec.then(function () { return call(st[0], st[1]); }); }, Promise.resolve())
    .then(function () { toast("Salvato"); return ricaricaBattle(); },
          function (e) { toast(errText(e), true); ricaricaBattle(); return false; });
}

// «Goblin» diventa «Goblin 2», poi «Goblin 3»…: il numero successivo libero su quella mappa.
function nomeSuccessivo(nome, mappaId) {
  var base = String(nome).replace(/\s+\d+$/, ""), max = 1;
  B.seg.forEach(function (x) {
    if (x.mappa_id !== mappaId) return;
    var r = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?: (\\d+))?$").exec(x.nome);
    if (r) max = Math.max(max, r[1] ? Number(r[1]) : 1);
  });
  return base + " " + (max + 1);
}
function duplicaSegnalino(s) {
  var p = B.pf[s.id];
  run(function () {
    return call("aggiungi_segnalino", { p: { campagna_id: bCamp(), mappa_id: s.mappa_id, nome: nomeSuccessivo(s.nome, s.mappa_id),
      x: Math.min(1, Number(s.x) + 0.03), y: Math.min(1, Number(s.y) + 0.03), taglia: s.taglia, pf_max: p ? p.pf_max : null } });
  }, "Segnalino duplicato").then(function (r) { if (r) ricaricaBattle(); });
}
function eliminaSegnalinoDlg(s) {
  modal("Togliere “" + s.nome + "” dalla mappa?",
    "<p>Il segnalino sparisce dalla mappa" + (s.giocatore_id || s.png_id ? ". Il personaggio resta com’è: lo puoi rimettere in qualsiasi momento." : ".") + "</p>",
    function () {
      return run(function () { return call("elimina_segnalino", { p_id: s.id }); }, "Segnalino tolto").then(function (r) {
        if (!r) return false;
        B.sel = null;
        return ricaricaBattle();
      });
    }, "Togli");
}
// Segnalino senza personaggio collegato, per mostri ripetuti o comparse.
function nuovoGenerico(m) {
  modal("Segnalino generico", fld("nome", "Nome", "", 'required maxlength="60"') +
    '<div class="cols">' + fld("pf_max", "PF (facoltativi)", "", 'min="1"', "number") +
    sel("taglia", "Dimensione", [["0.5", "Piccola"], ["1", "Media"], ["2", "Grande"], ["3", "Enorme"]], "1") + "</div>" +
    '<p class="hint">Un segnalino generico esiste solo sulla mappa: non ha una scheda. I suoi PF li vede solo il master, finché non li mostri.</p>',
    function (fd) {
      var pf = String(fd.get("pf_max") || "").trim();
      return run(function () {
        return call("aggiungi_segnalino", { p: { campagna_id: bCamp(), mappa_id: m.id, nome: String(fd.get("nome") || "").trim(), x: 0.5, y: 0.5,
          taglia: Number(fd.get("taglia")), pf_max: pf === "" ? null : Number(pf) } });
      }, "Segnalino aggiunto").then(function (r) { if (!r) return false; return ricaricaBattle(); });
    }, "Aggiungi");
}

// Nome della mappa e, volendo, eliminarla.
function apriMappa(m) {
  modal("Mappa", fld("nome", "Nome", m.nome, 'required maxlength="60"') +
    '<p class="hint">' + (m.larghezza_m ? "Scala: larga " + dec(distShow(Number(m.larghezza_m))) + " " + distUnit() + "." : "Scala non calibrata.") + "</p>" +
    '<div class="row"><button type="button" class="danger" data-seg="eliminaMappa" data-id="' + m.id + '">Elimina la mappa</button></div>',
    function (fd) {
      var nome = String(fd.get("nome") || "").trim();
      if (!nome) { toast("Scrivi un nome.", true); return false; }
      if (nome === m.nome) return true;
      return run(function () { return call("salva_mappa", { p: { campagna_id: bCamp(), id: m.id, nome: nome } }); }, "Mappa rinominata")
        .then(function (r) { if (!r) return false; return ricaricaBattle(); });
    }, "Salva");
}
function eliminaMappaDlg(m) {
  modal("Eliminare “" + m.nome + "”?", "<p>Spariscono la mappa e tutti i suoi segnalini. I personaggi non cambiano.</p>", function () {
    return run(function () { return call("elimina_mappa", { p_id: m.id }); }, "Mappa eliminata").then(function (r) {
      if (!r) return false;
      sb.storage.from("mappe").remove([r.v]);        // il file nell'archivio si toglie dal sito: il database non può farlo
      B.vista = null; B.sel = null;
      return ricaricaBattle();
    });
  }, "Elimina");
}
