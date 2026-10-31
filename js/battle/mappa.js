/* =====================================================================
   js/battle/mappa.js
   Cosa fa:   Come si disegna la pagina: mappa, segnalini, barre dei PF e
              testi di aiuto.
   Contiene:  montaPagina, disegna, adattaScena, osservaSpazio, aggiornaScena, testoInfo, iniziali,
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
    // Tre colonne (20% · 60% · 20%): scheda NPC con l'iniziativa in basso a sinistra, mappa con gli strumenti al centro, scheda del giocatore e cronologia a destra.
    '<main class="battle3"><aside class="colsx"><section id="pannelloNpc" class="pannello" aria-label="Scheda NPC e mostri"></section><div id="iniz" class="iniz" aria-label="Iniziativa"></div></aside>' +
    // La mappa sta in #mapwrap: su schermi larghi la pagina non scorre, la mappa si adatta allo spazio che resta e la barra sotto scorre da sola se serve.
    '<section class="bcol"><div id="mapwrap" class="mapwrap"><div id="scena" class="scena"><div id="piano" class="piano"><img id="mappaImg" alt="Mappa" hidden><div id="griglia" class="griglia" hidden></div><div id="aree" class="aree"></div><div id="strato"></div><div id="linea" class="linea"></div><div id="marq" class="marq" hidden></div></div><div id="multibar" class="multibar" hidden></div><div id="vuoto" class="vuoto" hidden></div>' +
    '<div id="attrezzi" class="attrezzi" role="toolbar" aria-label="Strumenti della mappa"><button class="riduci" data-b="attrezziRiduci" aria-expanded="true" title="Riduci o estendi gli strumenti della mappa">Strumenti ▾</button><div class="rigaA">' +
      '<button data-b="zoomMeno" aria-label="Rimpicciolisci" title="Rimpicciolisci (o la rotella del mouse)">−</button><span id="zoomPct" class="pct">100%</span><button data-b="zoomPiu" aria-label="Ingrandisci" title="Ingrandisci (o la rotella del mouse)">+</button>' +
      '<button data-b="zoomAdatta" title="Mostra tutta la mappa">Adatta</button>' +
      '<button class="tg" data-b="mano" aria-pressed="false" title="Trascina per spostare la mappa ingrandita (anche con la barra spaziatrice o con due dita)">Mano</button>' +
      '<button data-b="centra" title="Ingrandisce sul segnalino scelto, o su quello di turno, o sul tuo">Centra</button>' +
      '<button class="tg" data-b="griglia" aria-pressed="false" title="Quadretti da 1,5 m (serve la scala)">Griglia</button>' +
      '<button class="tg" data-b="aggancia" aria-pressed="false" title="I segnalini si fermano al centro di un quadretto (serve la scala)">Aggancia</button>' +
      '<button class="tg" data-b="aree" aria-pressed="false" title="Disegna un cerchio, un cono, un quadrato o una linea (lo vedi solo tu)">Aree</button>' +
      '<button data-b="annulla" disabled title="Annulla l’ultimo spostamento (Ctrl+Z)">Annulla</button></div>' +
    '<div class="rigaB" hidden><button class="tg" data-b="areaForma" data-f="cerchio" aria-pressed="true">Cerchio</button><button class="tg" data-b="areaForma" data-f="cono" aria-pressed="false">Cono</button>' +
      '<button class="tg" data-b="areaForma" data-f="quadrato" aria-pressed="false">Quadrato</button><button class="tg" data-b="areaForma" data-f="linea" aria-pressed="false">Linea</button>' +
      '<label class="sl">Grandezza <input type="number" id="areaLen" min="0.5" step="0.5" value="6" aria-label="Grandezza dell’area"> <span id="unitaArea">m</span></label>' +
      '<button data-b="areaPulisci">Pulisci</button></div></div>' +
    '<div id="dadoMappa" class="dadomappa" hidden aria-live="polite"></div></div></div>' +
    '<div class="bassobar"><div id="barra"></div><p id="info" class="hint"></p></div></section>' +
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
  if (typeof aggiornaToken === "function") aggiornaToken();     // le strisce dei token nelle schede
}

// Larghezza della mappa. Sugli schermi larghi (tre colonne, pagina che non scorre) la mappa occupa il massimo spazio che resta
// senza uscirne; sugli schermi stretti la pagina scorre e la mappa non supera l'altezza dello schermo.
var SCHERMO_LARGO = window.matchMedia ? window.matchMedia("(min-width: 1200px)") : null;
function adattaScena(rapporto, proporzioni) {
  var sc = $("#scena"), w = $("#mapwrap");
  sc.style.aspectRatio = proporzioni;
  if (SCHERMO_LARGO && SCHERMO_LARGO.matches && w && w.clientWidth > 0 && w.clientHeight > 0) {
    sc.style.width = Math.floor(Math.min(w.clientWidth, w.clientHeight * rapporto)) + "px";
    return;
  }
  sc.style.width = "min(100%, calc((100vh - 250px) * " + rapporto + "))";
}
// Se lo spazio cambia (finestra, barra che va a capo, colonne) la mappa si adatta e i segnalini si ridisegnano.
function osservaSpazio() {
  var w = $("#mapwrap"); if (!w || !window.ResizeObserver) return;
  new ResizeObserver(function () {
    if (B.drag) return;
    var m = mappaVista();
    if (m) { adattaScena(m.larghezza_px / m.altezza_px, m.larghezza_px + " / " + m.altezza_px); disegnaSegnalini(m); }
    else adattaScena(16 / 9, "16 / 9");
  }).observe(w);
}

function aggiornaScena() {
  var m = mappaVista(), sc = $("#scena"), img = $("#mappaImg"), v = $("#vuoto");
  if (!m) {
    img.hidden = true; img.removeAttribute("data-percorso"); $("#strato").innerHTML = ""; $("#linea").innerHTML = ""; $("#aree").innerHTML = ""; $("#griglia").hidden = true;
    v.hidden = false; adattaScena(16 / 9, "16 / 9");
    v.textContent = bMaster() ? "Non c’è ancora nessuna mappa. Usa «Nuova mappa» per caricarne una." : "Il master non ha ancora mostrato una mappa.";
    $("#info").textContent = "";
    return;
  }
  v.hidden = true;
  // La mappa non deve uscire dallo spazio disponibile: si adatta alle proporzioni dell'immagine.
  adattaScena(m.larghezza_px / m.altezza_px, m.larghezza_px + " / " + m.altezza_px);
  if (img.getAttribute("data-percorso") !== m.percorso) {
    img.setAttribute("data-percorso", m.percorso); img.hidden = true;
    urlMappa(m).then(function (u) {
      if (img.getAttribute("data-percorso") === m.percorso) { img.src = u; img.hidden = false; }
    }, function (e) { toast(errText(e), true); });
  }
  disegnaSegnalini(m);
  aggiornaMultiBar();
  disegnaLinea();
  aggiornaStrumenti(m);
  $("#info").textContent = testoInfo(m);
}

function testoInfo(m) {
  if (B.modoMulti) return "Selezione multipla: tocca i segnalini per sceglierli, oppure trascina sulla mappa un rettangolo; poi trascina uno dei selezionati per spostarli tutti. Esc toglie la selezione.";
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
  var presenti = segnaliniDi(m);
  Object.keys(B.multi || {}).forEach(function (id) { if (!presenti.some(function (x) { return String(x.id) === id; })) delete B.multi[id]; });   // chi non c'è più non resta selezionato
  $("#strato").innerHTML = segnaliniDi(m).map(function (s) {
    var d = diametro(m, s), p = B.pf[s.id], turno = B.stato && B.stato.turno_segnalino_id === s.id;
    return '<div class="tk ' + (s.giocatore_id ? "pg" : "npc") + (s.nascosto ? " nasc" : "") + (B.sel === s.id ? " sel" : "") + (inMulti(s.id) ? " multi" : "") +
      (turno ? " turno" : "") + (possoMuovere(s) ? " mobile" : "") + '" data-id="' + s.id + '" style="left:' + Number(s.x) * 100 + "%;top:" + Number(s.y) * 100 +
      "%;width:" + d + "px;height:" + d + 'px"><span class="ini">' + esc(iniziali(s.nome)) + '</span><span class="nm">' + esc(s.nome) + "</span>" +
      (p && p.pf_max > 0 ? barraPf(p) : "") + "</div>";
  }).join("");
}
