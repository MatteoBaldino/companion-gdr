/* =====================================================================
   js/battle/righello.js
   Cosa fa:   Righello per misurare le distanze e calibrazione della scala
              della mappa.
   Contiene:  lunghezzaLinea, distanzaMetri, etichettaDistanza,
              disegnaLinea, chiediCalibrazione
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- righello e scala
// Senza griglia il sito non sa quanto è grande una stanza: il master "calibra" la mappa una volta,
// tracciando una linea di lunghezza nota. La scala è salvata come larghezza della mappa in metri.

// Lunghezza della linea, in «larghezze di mappa» (1 = quanto è larga tutta la mappa).
function lunghezzaLinea(l) {
  var dx = l.x2 - l.x1, dy = (l.y2 - l.y1) * (l.m.altezza_px / l.m.larghezza_px);
  return Math.sqrt(dx * dx + dy * dy);
}
function distanzaMetri(l) { return l.m.larghezza_m ? lunghezzaLinea(l) * Number(l.m.larghezza_m) : null; }
// Nell'unità che hai scelto, con l'altra tra parentesi: «6 m (20 ft)».
function etichettaDistanza(metri) {
  var prima = dec(distShow(metri)) + " " + distUnit();
  var altra = imp() ? dec(arr(metri, 1)) + " m" : dec(Math.round(metri / 0.3)) + " ft";
  return prima + " (" + altra + ")";
}
function disegnaLinea() {
  var box = $("#linea"), l = B.linea;
  if (!box) return;
  if (!l || (!B.righello && !B.calibra)) { box.innerHTML = ""; return; }
  var d = distanzaMetri(l), mx = (l.x1 + l.x2) / 2 * 100, my = (l.y1 + l.y2) / 2 * 100;
  var testo = B.calibra ? "" : (d == null ? "scala non calibrata" : etichettaDistanza(d));
  box.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="' + l.x1 * 100 + '" y1="' + l.y1 * 100 + '" x2="' + l.x2 * 100 + '" y2="' + l.y2 * 100 + '"/></svg>' +
    (testo ? '<span class="etichetta" style="left:' + mx + "%;top:" + my + '%">' + esc(testo) + "</span>" : "");
}

// Dopo aver tracciato la linea di calibrazione chiede quanto è lunga davvero e salva la scala.
function chiediCalibrazione() {
  var l = B.linea, m = l && l.m;
  if (!m) return;
  var lung = lunghezzaLinea(l);
  if (lung < 0.01) { B.calibra = false; B.linea = null; disegna(); toast("La linea è troppo corta: riprova.", true); return; }
  modal("Calibra la scala", "<p>Quanto è lunga, nel gioco, la linea che hai tracciato?</p>" +
    fld("reale", "Lunghezza (" + distUnit() + ")", "", 'min="0.1" step="any" required', "number") +
    '<p class="hint">Per esempio la distanza tra due colonne, o la larghezza di una porta. Più è lunga la linea, più la scala è precisa.</p>',
    function (fd) {
      var reale = Number(String(fd.get("reale")).replace(",", "."));
      if (!(reale > 0)) { toast("Scrivi un numero maggiore di zero.", true); return false; }
      var larg = Math.round(distM(reale) / lung * 100) / 100;
      return run(function () { return call("salva_mappa", { p: { campagna_id: bCamp(), id: m.id, nome: m.nome, larghezza_m: larg } }); },
        "Scala salvata: la mappa è larga " + dec(distShow(larg)) + " " + distUnit()).then(function (r) {
        if (!r) return false;
        B.calibra = false; B.linea = null;
        return ricaricaBattle();
      });
    }, "Salva la scala");
}
