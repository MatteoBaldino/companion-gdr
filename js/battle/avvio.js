/* =====================================================================
   js/battle/avvio.js
   Cosa fa:   Avvio della pagina Battle: accesso, scelta della campagna e
              collegamento dei pulsanti.
   Contiene:  messaggioBattle, collega, entraInCampagna, avviaBattle
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- avvio della pagina Battle
function messaggioBattle(testo) {
  root.innerHTML = '<main class="narrow stack"><h1>Battle map</h1><p>' + testo + '</p><p><a class="btn" href="index.html">Torna al sito</a></p></main>';
}

// Collega i clic, i cambiamenti e il trascinamento. Si fa una volta sola: la pagina si aggiorna a pezzi.
function collega() {
  var sc = $("#scena");
  sc.addEventListener("pointerdown", bGiu);
  sc.addEventListener("pointermove", bMuovi);
  sc.addEventListener("pointerup", bSu);
  sc.addEventListener("pointercancel", bSu);
  // Il dado sopra la mappa ha i suoi pulsanti: un tocco lì non deve far partire il righello o il trascinamento.
  $("#dadoMappa").addEventListener("pointerdown", function (e) { e.stopPropagation(); });
  $("#multibar").addEventListener("pointerdown", function (e) { e.stopPropagation(); });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-b]"); if (!b) return;
    var a = b.dataset.b;
    if (a === "unita") { U.sys = imp() ? "metric" : "imperial"; try { localStorage.setItem("gdr_unita", U.sys); } catch (x) {} b.textContent = labelUnita(); disegna(); return; }
    if (!azioneBarra(a, b) && !azioneTiri(a, b) && !azioneSchede(a, b) && !azioneMulti(a, b)) azioneIniziativa(a);
  });
  root.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "campSel") { try { localStorage.setItem("gdr_battle_mem", t.value); } catch (x) {} location.reload(); return; }
    if (!cambioBarra(e)) cambioIniziativa(e);
  });
  root.addEventListener("input", digitoBarra);
  // Pulsanti dentro le finestre (duplica, elimina…)
  $("#dlg").addEventListener("click", function (e) {
    var b = e.target.closest("[data-seg]"); if (!b) return;
    var s = segnalinoPerId(b.dataset.id), m = B.mappe.filter(function (x) { return x.id === Number(b.dataset.id); })[0];
    $("#dlg").close();
    if (b.dataset.seg === "duplica" && s) duplicaSegnalino(s);
    if (b.dataset.seg === "elimina" && s) eliminaSegnalinoDlg(s);
    if (b.dataset.seg === "eliminaMappa" && m) eliminaMappaDlg(m);
  });
  // Chiudendo una finestra: se la calibrazione era in corso si annulla, e si ridisegna ciò che era stato rimandato.
  $("#dlg").addEventListener("close", function () {
    if (B.calibra) { B.calibra = false; B.linea = null; }
    disegna();
  });
  window.addEventListener("resize", function () { var m = mappaVista(); if (m && !B.drag) disegnaSegnalini(m); });
  osservaSpazio();
}

function entraInCampagna() {
  montaPagina();
  collega();
  return caricaBattle().then(function () { disegna(); avviaRealtime(); avviaTiri(); return iniziaSchede(); },
    function (e) { toast(errText(e), true); });
}

function avviaBattle() {
  if (!configOk) return;
  sb.auth.getSession().then(function (r) {
    B.user = r.data && r.data.session ? r.data.session.user : null;
    if (!B.user) return messaggioBattle("Per usare la Battle map devi aver fatto l’accesso. Apri il sito, accedi, poi torna qui.");
    return sb.from("giocatori").select("id, nome, ruolo, campagna_id, campagne(id, nome, codice_invito, peso_moneta_kg)").eq("user_id", B.user.id).order("id").then(function (q) {
      if (q.error) return messaggioBattle("Errore: " + esc(q.error.message));
      B.mems = q.data || [];
      if (!B.mems.length) return messaggioBattle("Non fai ancora parte di nessuna campagna.");
      // Si riparte dalla campagna scelta l'ultima volta (qui o nel sito principale).
      var qui = null, sito = null;
      try { qui = localStorage.getItem("gdr_battle_mem"); var u = JSON.parse(localStorage.getItem("gdr_ultima") || "null"); sito = u && u.mem; } catch (x) {}
      B.me = B.mems.filter(function (m) { return String(m.id) === qui; })[0] || B.mems.filter(function (m) { return m.id === sito; })[0] || B.mems[0];
      return entraInCampagna();
    });
  });
}

avviaBattle();
