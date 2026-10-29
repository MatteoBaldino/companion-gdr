/* =====================================================================
   js/scheda/equipaggiamento-scheda.js
   Cosa fa:   Nella scheda: la zona Equipaggiamento, con quello che il
              personaggio ha addosso (armatura, scudo, elmo, armi, protezioni
              degli arti, barda, altri oggetti). Ogni casella si tocca per
              scegliere, tra gli oggetti dell'inventario, cosa equipaggiare
              o per rimetterlo nello zaino. CA e attacchi usano ciò che
              è equipaggiato.
   Contiene:  postoDi, equipDi, eqBox, htmlEquipaggiamento, ACT["eq-scegli"]
   Database:  funzione equipaggia (il database controlla da solo che non ci
              siano due armature, due scudi o due elmi).
   Regola:    cambiare un'arma o lo scudo costa l'Azione del turno.
   Non c'è ancora: mano destra, mano sinistra, schiena e «a due mani» (serve
   registrare dove sta ogni oggetto: modifica del database).
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

var EQ_ETICHETTE = { corpo: "Armatura", scudo: "Scudo", elmo: "Elmo", arti: "Protezione arti", barda: "Barda", arma: "Arma", altro: "Altro oggetto" };

// Dove va un oggetto dell'inventario: "corpo", "scudo", "elmo", "arti", "barda", "arma", "altro"; null se non si equipaggia (cibo).
function postoDi(i) {
  var o = i.oggetti;
  if (o.categoria === "cibo") return null;
  if (o.categoria === "armatura") { var a = one(o.armature); return a ? postoArm(a) : "altro"; }
  if (o.categoria === "arma") return "arma";
  return "altro";
}

// Cosa ha addosso il personaggio, diviso per posto.
function equipDi(key) {
  var r = { corpo: null, scudo: null, elmo: null, barda: null, arti: [], arma: [], altro: [] };
  invDi(key).forEach(function (i) {
    if (!i.equipaggiato) return;
    var p = postoDi(i); if (!p) return;
    if (p === "arti" || p === "arma" || p === "altro") r[p].push(i); else if (!r[p]) r[p] = i;
  });
  return r;
}

function eqBox(s, posto, i, etichetta) {
  return '<button class="eqb' + (i ? " pieno" : "") + '" data-act="eq-scegli" data-id="' + s.id + '" data-posto="' + posto + '"' + (i ? ' data-inv="' + i.id + '"' : "") +
    ' aria-label="' + esc(etichetta) + (i ? ": " + esc(i.oggetti.nome) : ": vuoto") + '"><span class="lbl">' + esc(etichetta) + '</span><span class="eqv">' +
    (i ? esc(i.oggetti.nome) : "—") + "</span></button>";
}

function htmlEquipaggiamento(s, key) {
  var e = equipDi(key);
  var main = eqBox(s, "corpo", e.corpo, "Armatura") + eqBox(s, "scudo", e.scudo, "Scudo") + eqBox(s, "elmo", e.elmo, "Elmo");
  e.arma.forEach(function (i) { main += eqBox(s, "arma", i, "Arma"); });
  main += eqBox(s, "arma", null, "Arma");
  var altri = eqBox(s, "barda", e.barda, "Barda");
  e.arti.forEach(function (i) { altri += eqBox(s, "arti", i, "Protezione arti"); });
  altri += eqBox(s, "arti", null, "Protezione arti");
  e.altro.forEach(function (i) { altri += eqBox(s, "altro", i, "Altro oggetto"); });
  altri += eqBox(s, "altro", null, "Altro oggetto");
  var nAltri = (e.barda ? 1 : 0) + e.arti.length + e.altro.length;
  return "<h3>Equipaggiamento</h3>" +
    '<div class="eqgrid">' + main + "</div>" +
    '<details class="eqmore"><summary>Altri slot' + (nAltri ? " (" + nAltri + ")" : "") + '</summary><div class="eqgrid">' + altri + "</div></details>";
}

// Tocco su una casella: scelgo cosa metterci (o lo rimetto nello zaino).
ACT["eq-scegli"] = function (b) {
  var s = schedaPerId(b.dataset.id); if (!s) return;
  var key = keyDiScheda(s), posto = b.dataset.posto, vecchio = b.dataset.inv ? invPerId(b.dataset.inv) : null;
  var costaAzione = (posto === "arma" || posto === "scudo") && inCombattimento(s);   // fuori dal combattimento non costa niente
  if (costaAzione && (s.turno || {}).azione) {
    var gia = s.turno.azione;
    toast("Non puoi cambiare " + (posto === "scudo" ? "lo scudo" : "arma") + ": l’azione è già usata in questo turno" + (typeof gia === "string" ? " (" + gia + ")" : "") + ". Se il master lo permette, tocca la cella Azione per liberarla.", true);
    return;
  }
  var cand = invDi(key).filter(function (i) { return !i.equipaggiato && postoDi(i) === posto; });
  if (!cand.length && !vecchio) { toast("Nell’inventario non c’è nulla da equipaggiare qui.", true); return; }
  var opz = cand.map(function (i) { return [String(i.id), i.oggetti.nome + (i.quantita > 1 ? " ×" + i.quantita : "")]; });
  if (vecchio) opz.unshift(["", "Nessuno: rimetti " + vecchio.oggetti.nome + " nello zaino"]);
  modal(EQ_ETICHETTE[posto] + (vecchio ? ": " + vecchio.oggetti.nome : ""),
    sel("inv", vecchio ? "Cosa equipaggi al suo posto" : "Cosa equipaggi", opz, opz[0][0]) +
    (costaAzione ? '<p class="hint">Costa l’azione del turno.</p>' : ""),
    function (fd) {
      var nuovo = fd.get("inv") ? invPerId(fd.get("inv")) : null;
      if (!nuovo && !vecchio) return;
      return run(function () {
        var p = Promise.resolve();
        if (vecchio) p = p.then(function () { return call("equipaggia", { p_inv: vecchio.id, p_eq: false }); });
        if (nuovo) p = p.then(function () { return call("equipaggia", { p_inv: nuovo.id, p_eq: true }); });
        return p;
      }).then(function (r) {
        if (!r) return false;
        var segna = Promise.resolve();
        if (costaAzione) {
          var t = copia(s.turno || {});
          t.azione = nuovo ? "Equipaggi " + nuovo.oggetti.nome : "Rimetti " + vecchio.oggetti.nome;
          segna = gioco(s, { turno: t });
        }
        return segna.then(function () { return caricaDati(); }).then(disegnaTab);
      });
    }, "Equipaggia");
};
