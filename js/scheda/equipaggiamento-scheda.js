/* =====================================================================
   js/scheda/equipaggiamento-scheda.js
   Cosa fa:   Nella scheda: la zona Equipaggiamento. Nove caselle sempre
              visibili (Elmo, Mantello, Torace, Guanti, Pantaloni, Scarpe,
              Mano destra, Mano sinistra, A due mani) e, in «Altri slot»,
              barda e altri oggetti. Ogni casella si tocca per scegliere,
              tra gli oggetti dell'inventario, cosa equipaggiare o per
              rimetterlo nello zaino. CA e attacchi usano ciò che è
              equipaggiato, in qualunque casella stia.
   Contiene:  slotDi, maniDi, posizioni, postoAuto, eqBox,
              htmlEquipaggiamento, ACT["eq-scegli"]
   Database:  inventari.posto (la casella di ogni oggetto equipaggiato),
              funzioni equipaggia_posto ed equipaggia. Il database controlla
              da solo che non ci siano due armature, due scudi o due elmi, e
              libera da solo la casella (o le mani) che l'oggetto occupa.
   Regole:    un oggetto a due mani occupa entrambe le mani; cambiare ciò
              che hai in mano costa l'Azione, ma solo in combattimento.
   Come si decide dove va un oggetto: dalla sua categoria (armi e scudi
   nelle mani; armature leggere, medie e pesanti sul torace; elmi sulla
   testa) e, per le protezioni degli arti e i mantelli, dal nome.
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// Le nove caselle, nell'ordine in cui compaiono: [codice nel database, nome].
var CASELLE = [["elmo", "Elmo"], ["mantello", "Mantello"], ["torace", "Torace"], ["guanti", "Guanti"], ["pantaloni", "Pantaloni"], ["scarpe", "Scarpe"],
  ["mano_dx", "Mano destra"], ["mano_sx", "Mano sinistra"], ["due_mani", "A due mani"]];
var EQ_ETICHETTE = { barda: "Barda", altro: "Altro oggetto" };
CASELLE.forEach(function (c) { EQ_ETICHETTE[c[0]] = c[1]; });

function eqCasella(posto) { return CASELLE.some(function (c) { return c[0] === posto; }); }
function eqNome(i, re) { return re.test((i.oggetti.nome || "").toLowerCase()); }

// Che tipo di oggetto è, per decidere in quale casella va:
// "elmo", "mantello", "torace", "guanti", "pantaloni", "scarpe", "mano", "barda", "altro"; null se non si equipaggia (cibo).
function slotDi(i) {
  var o = i.oggetti;
  if (o.categoria === "cibo") return null;
  if (o.categoria === "arma") return "mano";
  if (o.categoria === "armatura") {
    var a = one(o.armature);
    if (!a) return "altro";
    var c = a.categoria_armatura;
    if (c === "scudo") return "mano";
    if (c === "bardatura") return "barda";
    if (c === "leggera" || c === "media" || c === "pesante") return "torace";
    if (a.gruppo === "arti") {
      if (eqNome(i, /guant/)) return "guanti";
      if (eqNome(i, /pantalon|gambal|schinier/)) return "pantaloni";
      if (eqNome(i, /scarp|stival|calzatur/)) return "scarpe";
      return "altro";
    }
    return eqNome(i, /mantell|cappa/) ? "mantello" : "elmo";
  }
  return eqNome(i, /mantell|cappa/) ? "mantello" : "altro";
}

// Quante mani occupa. Nell'ordine: la proprietà «A due mani» → 2; la proprietà «A una mano» → 1; «a due mani» nel nome → 2;
// archi e balestre (da nome o munizioni) → 2, a meno che il nome dica «a mano», «a una mano», «da mano» (o sia una cerbottana)
// o l'arma sia leggera (balestra a mano) → 1; tutto il resto → 1.
function maniDi(i) {
  var a = i.oggetti.categoria === "arma" ? one(i.oggetti.armi) : null;
  if (!a) return 1;
  var prop = (a.proprieta || []).map(function (p) { return String(p).toLowerCase(); });
  if (prop.indexOf("a due mani") >= 0) return 2;
  if (prop.some(function (p) { return /una mano/.test(p); })) return 1;
  var nome = String(i.oggetti.nome || "").toLowerCase(), mun = String(a.munizioni_tipo || "").toLowerCase();
  if (/\bdue mani\b/.test(nome)) return 2;
  var adistanza = /\barc[oh]i?\b|balestr/.test(nome) || /frecc|quadrell/.test(mun);
  if (adistanza && !/\bmano\b|cerbottan/.test(nome) && prop.indexOf("leggera") < 0) return 2;
  return 1;
}

// Cosa sta in ogni casella: { elmo: oggetto, ..., due_mani: oggetto }.
function posizioni(key) {
  var r = {};
  invDi(key).forEach(function (i) { if (i.equipaggiato && eqCasella(i.posto)) r[i.posto] = i; });
  return r;
}

// Dove va un oggetto quando lo si equipaggia dall'inventario, senza scegliere la casella.
// null = si equipaggia come prima (barda e altri oggetti non hanno una casella).
function postoAuto(i) {
  var sl = slotDi(i);
  if (!sl || sl === "barda" || sl === "altro") return null;
  if (sl !== "mano") return sl;
  if (maniDi(i) === 2) return "due_mani";
  var p = posizioni(i.png_id ? "p:" + i.png_id : "g:" + i.giocatore_id);
  if (!p.due_mani && !p.mano_dx) return "mano_dx";
  if (!p.due_mani && !p.mano_sx) return "mano_sx";
  return "mano_dx";
}

function eqBox(s, posto, i, etichetta, classi, nota) {
  return '<button class="eqb' + (i ? " pieno" : "") + (classi ? " " + classi : "") + '" data-act="eq-scegli" data-id="' + s.id + '" data-posto="' + posto + '"' + (i ? ' data-inv="' + i.id + '"' : "") +
    ' aria-label="' + esc(etichetta) + (i ? ": " + esc(i.oggetti.nome) : ": " + (nota || "vuoto")) + '"><span class="lbl">' + esc(etichetta) + '</span><span class="eqv">' +
    (i ? esc(i.oggetti.nome) : (nota || "—")) + "</span></button>";
}

function htmlEquipaggiamento(s, key) {
  var p = posizioni(key), due = p.due_mani, main = "";
  CASELLE.forEach(function (c) {
    if (c[0] === "due_mani") main += eqBox(s, c[0], due, c[1], "largo");
    else if (c[0] === "mano_dx" || c[0] === "mano_sx") main += eqBox(s, c[0], p[c[0]], c[1], due ? "occupata" : "", due ? "Occupata" : null);
    else main += eqBox(s, c[0], p[c[0]], c[1]);
  });
  // Altri slot: la barda e gli oggetti equipaggiati che non hanno una casella.
  var barda = null, altro = [];
  invDi(key).forEach(function (i) {
    if (!i.equipaggiato || eqCasella(i.posto)) return;
    var sl = slotDi(i); if (!sl) return;
    if (sl === "barda" && !barda) barda = i; else altro.push(i);
  });
  var altri = eqBox(s, "barda", barda, "Barda");
  altro.forEach(function (i) { altri += eqBox(s, "altro", i, "Altro oggetto"); });
  altri += eqBox(s, "altro", null, "Altro oggetto");
  var nAltri = (barda ? 1 : 0) + altro.length;
  return "<h3>Equipaggiamento</h3>" +
    '<div class="eqgrid nove">' + main + "</div>" +
    '<details class="eqmore"><summary>Altri slot' + (nAltri ? " (" + nAltri + ")" : "") + '</summary><div class="eqgrid">' + altri + "</div></details>";
}

// Tocco su una casella: scelgo cosa metterci (o lo rimetto nello zaino).
ACT["eq-scegli"] = function (b) {
  var s = schedaPerId(b.dataset.id); if (!s) return;
  var key = keyDiScheda(s), posto = b.dataset.posto, vecchio = b.dataset.inv ? invPerId(b.dataset.inv) : null;
  var mano = posto === "mano_dx" || posto === "mano_sx" || posto === "due_mani";
  var costaAzione = mano && inCombattimento(s);   // fuori dal combattimento non costa niente
  if (costaAzione && (s.turno || {}).azione) {
    var gia = s.turno.azione;
    toast("Non puoi cambiare ciò che hai in mano: l’azione è già usata in questo turno" + (typeof gia === "string" ? " (" + gia + ")" : "") + ". Se il master lo permette, tocca la cella Azione per liberarla.", true);
    return;
  }
  var slot = mano ? "mano" : posto;
  var cand = invDi(key).filter(function (i) {
    if (i.equipaggiato || slotDi(i) !== slot) return false;
    if (!mano) return true;
    return posto === "due_mani" ? maniDi(i) === 2 : maniDi(i) === 1;   // a una mano solo oggetti a una mano; «a due mani» solo oggetti a due mani
  });
  if (!cand.length && !vecchio) { toast(posto === "due_mani" ? "Nell’inventario non c’è nulla da tenere a due mani." : "Nell’inventario non c’è nulla da equipaggiare qui.", true); return; }
  var opz = cand.map(function (i) { return [String(i.id), i.oggetti.nome + (i.quantita > 1 ? " ×" + i.quantita : "")]; });
  if (vecchio) opz.unshift(["", "Nessuno: rimetti " + vecchio.oggetti.nome + " nello zaino"]);
  modal(EQ_ETICHETTE[posto] + (vecchio ? ": " + vecchio.oggetti.nome : ""),
    sel("inv", vecchio ? "Cosa equipaggi al suo posto" : "Cosa equipaggi", opz, opz[0][0]) +
    (costaAzione ? '<p class="hint">Costa l’azione del turno.</p>' : ""),
    function (fd) {
      var nuovo = fd.get("inv") ? invPerId(fd.get("inv")) : null;
      if (!nuovo && !vecchio) return;
      // Cosa torna nello zaino da solo: chi sta già nelle mani o nella casella che sto occupando.
      var tornano = [];
      if (nuovo && mano) {
        var p = posizioni(key), occupanti = posto === "due_mani" ? [p.mano_dx, p.mano_sx, p.due_mani] : [p[posto], p.due_mani];
        occupanti.forEach(function (x) { if (x && x !== vecchio && x !== nuovo && tornano.indexOf(x.oggetti.nome) < 0) tornano.push(x.oggetti.nome); });
      }
      return run(function () {
        var q = Promise.resolve();
        if (vecchio) q = q.then(function () { return call("equipaggia", { p_inv: vecchio.id, p_eq: false }); });
        if (nuovo) q = q.then(function () { return eqCasella(posto) ? call("equipaggia_posto", { p_inv: nuovo.id, p_posto: posto }) : call("equipaggia", { p_inv: nuovo.id, p_eq: true }); });
        return q;
      }).then(function (r) {
        if (!r) return false;
        var segna = Promise.resolve();
        if (costaAzione) {
          var t = copia(s.turno || {});
          t.azione = nuovo ? "Equipaggi " + nuovo.oggetti.nome : "Rimetti " + vecchio.oggetti.nome;
          segna = gioco(s, { turno: t });
        }
        return segna.then(function () { return caricaDati(); }).then(disegnaTab).then(function () {
          if (tornano.length) toast(tornano.join(", ") + (tornano.length > 1 ? " rimessi" : " rimesso") + " nello zaino.");
        });
      });
    }, "Equipaggia");
};
