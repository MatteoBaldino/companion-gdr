/* =====================================================================
   js/battle/mappa.js
   Cosa fa:   Come si disegna la pagina: mappa, segnalini, barre dei PF e
              testi di aiuto.
   Contiene:  montaPagina, disegna, aggiornaScena, testoInfo, iniziali,
              barraPf, diametro, disegnaSegnalini
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- disegno della pagina
// La pagina si costruisce una volta (montaPagina) e poi si aggiorna a pezzi (disegna).
function montaPagina() {
  var c = one(B.me.campagne) || {};
  var scelta = B.mems.length > 1
    ? '<select id="campSel" aria-label="Campagna">' + B.mems.map(function (m) {
        var n = one(m.campagne) || {};
        return '<option value="' + m.id + '"' + (m.id === B.me.id ? " selected" : "") + ">" + esc(n.nome) + "</option>";
      }).join("") + "</select>" : "";
  root.innerHTML =
    '<header class="top"><div class="top-in"><div><h1>Battle map</h1><div class="who">' + esc(c.nome) + " · " + (bMaster() ? "Master" : esc(B.me.nome)) + "</div></div>" +
    '<div class="tools">' + scelta + '<button id="btnUnita" data-b="unita">' + labelUnita() + '</button><a class="btn" href="index.html">Torna al sito</a></div></div></header>' +
    // Tre colonne: iniziativa e NPC a sinistra, mappa con gli strumenti al centro, scheda del giocatore e cronologia a destra.
    '<main class="battle3"><aside class="colsx"><div id="iniz" class="iniz" aria-label="Iniziativa"></div><section id="pannelloNpc" class="pannello" aria-label="Scheda NPC e mostri"></section></aside>' +
    '<section class="bcol"><div id="scena" class="scena"><img id="mappaImg" alt="Mappa" hidden><div id="strato"></div><div id="linea" class="linea"></div><div id="vuoto" class="vuoto" hidden></div>' +
    '<div id="dadoMappa" class="dadomappa" hidden aria-live="polite"></div></div>' +
    '<div id="barra"></div><p id="info" class="hint"></p></section>' +
    '<aside class="coldx"><section id="pannelloPg" class="pannello" aria-label="Scheda giocatori"></section><section id="cron" class="cron" aria-label="Cronologia eventi"></section></aside></main>' +
    '<section id="tenda" class="tenda" aria-label="Dadi" hidden></section>';
}

// Ridisegna tutto. Se stai trascinando un segnalino o hai una finestra aperta aspetta: il ridisegno si rimanda a dopo.
function disegna() {
  var attivo = document.activeElement;
  if (B.drag || document.querySelector("dialog[open]") || (attivo && attivo.id === "scalaSeg")) { B.rinvia = true; return; }
  B.rinvia = false;
  aggiornaBarra();
  aggiornaScena();
  aggiornaIniziativa();
}

function aggiornaScena() {
  var m = mappaVista(), sc = $("#scena"), img = $("#mappaImg"), v = $("#vuoto");
  if (!m) {
    img.hidden = true; img.removeAttribute("data-percorso"); $("#strato").innerHTML = ""; $("#linea").innerHTML = "";
    v.hidden = false; sc.style.aspectRatio = "16 / 9"; sc.style.width = "";
    v.textContent = bMaster() ? "Non c’è ancora nessuna mappa. Usa «Nuova mappa» per caricarne una." : "Il master non ha ancora mostrato una mappa.";
    $("#info").textContent = "";
    return;
  }
  v.hidden = true;
  // La mappa non deve essere più alta dello schermo: si limita la larghezza in base alle proporzioni dell'immagine.
  var rapporto = m.larghezza_px / m.altezza_px;
  sc.style.aspectRatio = m.larghezza_px + " / " + m.altezza_px;
  sc.style.width = "min(100%, calc((100vh - 250px) * " + rapporto + "))";
  if (img.getAttribute("data-percorso") !== m.percorso) {
    img.setAttribute("data-percorso", m.percorso); img.hidden = true;
    urlMappa(m).then(function (u) {
      if (img.getAttribute("data-percorso") === m.percorso) { img.src = u; img.hidden = false; }
    }, function (e) { toast(errText(e), true); });
  }
  disegnaSegnalini(m);
  disegnaLinea();
  $("#info").textContent = testoInfo(m);
}

function testoInfo(m) {
  if (B.calibra) return "Traccia sulla mappa una linea tra due punti di cui conosci la distanza.";
  if (B.righello && !m.larghezza_m) return bMaster() ? "Per misurare le distanze calibra prima la scala (pulsante «Calibra scala»)." : "Il master non ha ancora calibrato la scala di questa mappa.";
  if (B.righello) return "Trascina sulla mappa per misurare una distanza.";
  if (!bMaster()) return "Trascina il tuo segnalino per muoverti. Tocca il tuo segnalino per cambiare nome, PF e iniziativa.";
  var s = B.stato;
  if (s && s.visibile && s.mappa_id === m.id) return "I giocatori vedono questa mappa. I segnalini tratteggiati li vedi solo tu. Tocca un segnalino per modificarlo.";
  if (s && s.visibile) return "I giocatori vedono un’altra mappa («" + ((mappaScena() || {}).nome || "") + "»). Questa la stai preparando.";
  return "Nessuna mappa è visibile ai giocatori: puoi prepararla con calma.";
}

// Le iniziali che si leggono dentro il segnalino: «Goblin 2» diventa G2, «Aldo» diventa AL.
function iniziali(nome) {
  var p = String(nome).trim().split(/\s+/);
  return (p.length > 1 ? p[0].charAt(0) + p[1].charAt(0) : String(nome).trim().slice(0, 2)).toUpperCase();
}
function barraPf(p) {
  var r = p.pf_max > 0 ? Math.min(1, p.pf_att / p.pf_max) : 0;
  return '<span class="pf ' + (r > 0.5 ? "ok" : r > 0.25 ? "medio" : "basso") + '"><i style="width:' + Math.round(r * 100) + '%"></i></span>' +
    '<span class="pfn">' + p.pf_att + "/" + p.pf_max + "</span>";
}
// Il diametro di un segnalino è una frazione della larghezza della mappa, così cresce e cala con lo schermo.
function diametro(m, s) { return Math.max(22, Math.round(($("#scena").clientWidth || 800) * Number(m.scala_segnalini) * Number(s.taglia))); }

function disegnaSegnalini(m) {
  $("#strato").innerHTML = segnaliniDi(m).map(function (s) {
    var d = diametro(m, s), p = B.pf[s.id], turno = B.stato && B.stato.turno_segnalino_id === s.id;
    return '<div class="tk ' + (s.giocatore_id ? "pg" : "npc") + (s.nascosto ? " nasc" : "") + (B.sel === s.id ? " sel" : "") +
      (turno ? " turno" : "") + (possoMuovere(s) ? " mobile" : "") + '" data-id="' + s.id + '" style="left:' + Number(s.x) * 100 + "%;top:" + Number(s.y) * 100 +
      "%;width:" + d + "px;height:" + d + 'px"><span class="ini">' + esc(iniziali(s.nome)) + '</span><span class="nm">' + esc(s.nome) + "</span>" +
      (p && p.pf_max > 0 ? barraPf(p) : "") + "</div>";
  }).join("");
}
