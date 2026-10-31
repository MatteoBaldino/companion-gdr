/* =====================================================================
   js/scheda/vista.js
   Cosa fa:   Come si disegna la scheda personaggio e l'elenco delle schede
              del master.
   Contiene:  htmlSchede, htmlScheda
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- visualizzazione
function htmlSchede() {
  if (S.schedaAperta) return htmlScheda(S.schedaAperta, true);
  var hs = holders();
  if (!hs.length) return '<div class="empty">Non ci sono ancora PG né NPC. Dalla scheda Personaggi puoi aggiungere un NPC.</div>';
  return '<p class="hint">Ogni PG ha una scheda completa. Per gli NPC scegli tu: semplificata (CA, PF, azioni) o completa.</p>' +
    hs.map(function (h) {
      var s = schedaDi(h.key);
      return '<div class="mov"><div><strong>' + esc(h.nome) + '</strong> <span class="tag">' + h.tipo + '</span><br><span class="hint">' +
        (s ? esc(riassunto(s, h.key)) : "Nessuna scheda") + "</span></div><div>" +
        (s ? '<button class="small primary" data-act="apri-scheda" data-key="' + h.key + '">Apri</button>'
           : '<button class="small primary" data-act="crea-scheda" data-key="' + h.key + '">Crea scheda</button>') + "</div></div>";
    }).join("");
}

function htmlScheda(key, indietro) {
  var s = schedaDi(key), nome = nomeHolder(key);
  var back = indietro ? '<p><button class="link" data-act="chiudi-scheda">← Tutte le schede</button></p>' : "";
  if (!s) {
    return back + '<div class="empty"><p>' + (indietro ? esc(nome) + " non ha ancora una scheda." : "Non hai ancora una scheda personaggio.") + '</p><div class="row">' +
      '<button class="primary" data-act="crea-scheda" data-key="' + key + '">' + (key.charAt(0) === "g" ? "Creazione guidata" : "Crea scheda") + "</button>" +
      (key.charAt(0) === "g" ? '<button data-act="crea-manuale" data-key="' + key + '">Compila a mano</button>' : "") + "</div></div>";
  }
  var semp = s.tipo === "semplificata";
  var ca = calcCA(s, key);
  var bc = bonusComp(s.livello);
  var sub = semp ? (s.sfida ? "Grado di sfida " + s.sfida : "NPC")
    : [s.specie, s.background, descriviClassi(s), "livello " + s.livello].filter(Boolean).join(", ");
  var tile = function (lbl, val, small, attr) {
    return '<div class="vit"' + (attr || "") + '><span class="lbl">' + lbl + "</span><strong>" + val + "</strong>" + (small ? "<small>" + esc(small) + "</small>" : "") + "</div>";
  };
  // Schede complete: tre sezioni, che si cambiano in alto a destra. Caratteristiche, PF, turno e tiri restano sempre sopra.
  var sez = S.sezScheda || "scheda";
  var tabSez = semp ? "" : '<nav class="sezioni" aria-label="Sezioni della scheda">' + [["scheda", "Scheda"], ["incantesimi", "Incantesimi"], ["equip", "Equipaggiamento"]].map(function (x) {
    return '<button data-act="sez-scheda" data-v="' + x[0] + '" aria-current="' + (sez === x[0]) + '">' + x[1] + "</button>";
  }).join("") + "</nav>";
  // CA: niente testo sotto il numero, ma un piccolo pulsante «i» che apre la spiegazione del calcolo.
  var tileCA = '<div class="vit vit-ca"><span class="lbl">CA</span><strong>' + ca.tot + "</strong>" + ((ca.parts || []).length
    ? '<details class="cainfo"><summary aria-label="Come si calcola la CA" title="Come si calcola la CA">i</summary><div class="cainfo-box"><strong>Come si calcola la CA</strong><ul>' +
      ca.parts.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul><p>Totale: <b>" + ca.tot + "</b></p></div></details>"
    : "") + "</div>";
  var h = back + '<section class="scheda"><header class="sh-head"><div class="sh-tit"><h2>' + esc(nome) + '</h2><p class="hint">' + esc(sub) + "</p></div>" + tabSez + "</header>";
  // Schede complete: prima le caratteristiche, poi CA/PF e il resto (come nel disegno della scheda). Gli NPC semplificati restano come prima.
  var h0 = h; h = "";
  h += '<div class="vitali">' + tileCA +
    tile("PF", s.pf_attuali + "/" + s.pf_max + (s.pf_temp ? ' <span class="tmp">+' + s.pf_temp + "</span>" : "")) +
    tile("Velocità", esc(fmtVel(s.velocita)));
  var rolla = !semp || !!S.dadiSemplificata;       // la Battle map dà i dadi anche agli NPC semplificati: stessa logica dei PG
  if (semp && rolla) h += tile("Iniziativa", sgn(mod(s.destrezza)), "", ' data-act="dado" data-k="ini" data-id="' + s.id + '" role="button" tabindex="0" title="Tira l’iniziativa"');
  if (!semp) {
    var pas = 10 + totaleAbilita(s, "percezione");
    h += tile("Iniziativa", sgn(mod(s.destrezza)), "", ' data-act="dado" data-k="ini" data-id="' + s.id + '" role="button" tabindex="0" title="Tira l’iniziativa"') + tile("Bonus competenza", sgn(bc)) + tile("Percezione passiva", pas);
  }
  h += "</div>";
  // Una riga sola: Danno · Punti ferita · Cura · Dai · PF temporanei. Il danno consuma prima i PF temporanei; i riposi li tolgono.
  h += '<div class="pfctrl"><div class="pfriga"><button data-act="pf-danno" data-id="' + s.id + '">Danno</button>' +
    '<label class="f"><span>Punti ferita</span><input type="number" id="pfn" min="1" value="1"></label>' +
    '<button data-act="pf-cura" data-id="' + s.id + '">Cura</button>' +
    '<button data-act="pf-temp-dai" data-id="' + s.id + '">Dai</button>' +
    '<label class="f"><span>PF temp.</span><input type="number" id="pft" min="1" value="1"></label></div>' +
    (!semp ? '<button data-act="ispirazione" data-id="' + s.id + '" aria-pressed="' + s.ispirazione + '">' + (s.ispirazione ? "Ispirazione: sì" : "Ispirazione: no") + "</button>" : "") + "</div>";
  if (!semp) h += htmlMorte(s);
  h += htmlTurno(s);
  if (rolla) h += htmlTiro(s, key);
  var corpo = h; h = h0;
  var abil = '<div class="abils">' + ABIL.map(function (a) {
    return '<div class="ab"' + (!rolla ? "" : ' data-act="dado" data-k="abil" data-v="' + a[0] + '" data-id="' + s.id + '" role="button" tabindex="0" title="Tira una prova di ' + a[1] + '"') + '><span class="lbl">' + a[2] + "</span><strong>" + sgn(mod(s[a[3]])) + "</strong><small>" + s[a[3]] + "</small></div>";
  }).join("") + "</div>";
  if (!semp) h += abil + corpo; else h += corpo + abil;
  if (semp && rolla) {
    var bc2 = bonusComp(s.livello);
    h += '<h3>Tiri salvezza</h3><ul class="plain sk">' + ABIL.map(function (a) {
      var p = (s.competenze_ts || []).indexOf(a[0]) >= 0;
      return '<li data-act="dado" data-k="ts" data-v="' + a[0] + '" data-id="' + s.id + '" role="button" tabindex="0"><span class="dot" title="' + (p ? "competente" : "non competente") + '">' + (p ? "●" : "○") + '</span><span class="nm">' + a[1] + "</span><b>" + sgn(mod(s[a[3]]) + (p ? bc2 : 0)) + "</b></li>";
    }).join("") + "</ul>";
  }
  if (!semp) {
    var tsH = '<h3>Tiri salvezza</h3><ul class="plain sk">' + ABIL.map(function (a) {
      var p = (s.competenze_ts || []).indexOf(a[0]) >= 0;
      return '<li data-act="dado" data-k="ts" data-v="' + a[0] + '" data-id="' + s.id + '" role="button" tabindex="0"><span class="dot" title="' + (p ? "competente" : "non competente") + '">' + (p ? "●" : "○") + "</span><span class=\"nm\">" + a[1] + "</span><b>" + sgn(mod(s[a[3]]) + (p ? bc : 0)) + "</b></li>";
    }).join("") + '</ul>';
    var abH = '<h3>Abilità</h3><ul class="plain sk">' + SKILLS.map(function (k) {
      var lv = (s.abilita || {})[k[0]] || 0;
      return '<li data-act="dado" data-k="skill" data-v="' + k[0] + '" data-id="' + s.id + '" role="button" tabindex="0"><span class="dot" title="' + ["non competente", "competente", "maestria"][lv] + '">' + ["○", "●", "◆"][lv] + "</span><span class=\"nm\">" + esc(k[1]) + "</span><b>" + sgn(totaleAbilita(s, k[0])) + "</b><small>(" + ABK[k[2]][2] + ")</small></li>";
    }).join("") + "</ul>";
    if (sez === "incantesimi") {
      h += '<div class="sezione">' + htmlSezIncantesimi(s) + "</div>";
    } else if (sez === "equip") {
      h += '<div class="sezione">' + htmlEquipaggiamento(s, key) + htmlMonete(s) + htmlInventarioScheda(s, key) +
        '<p class="hint">La CA si calcola dall’armatura e dallo scudo equipaggiati nell’inventario.</p></div>';
    } else {
      h += '<div class="duecol"><div>' + abH + "</div><div>" + tsH + htmlAttacchi(s, key) + htmlSlot(s) + htmlIncantesimi(s, "trucchetti") + "</div></div>" +
        '<p class="hint">● competenza, ◆ maestria.</p>' + htmlDettagli(s);
    }
  } else {
    if (s.tratti) h += "<h3>Tratti</h3><p class=\"pre\">" + esc(s.tratti) + "</p>";
    if ((s.azioni || []).length) {
      h += "<h3>Azioni</h3><ul class=\"plain\">" + s.azioni.map(function (a, i) {
        return '<li class="az"><strong>' + esc(a.nome) + ".</strong> " + esc(a.testo) + (S.dadiSemplificata ? htmlAzioneDadi(s, a, i) : "") + "</li>";
      }).join("") + "</ul>";
    }
  }
  if (semp) h += htmlCombattimento(s, key);
  if (s.note) h += "<h3>Note</h3><p class=\"pre\">" + esc(s.note) + "</p>";
  h += '<div class="row" style="margin-top:1.2rem"><button class="primary" data-act="modifica-scheda" data-id="' + s.id + '">Modifica scheda</button>' +
    (!semp && s.livello < 20 ? '<button data-act="sali-livello" data-id="' + s.id + '">Sali di livello</button>' : "") +
    (isMaster() ? '<button class="danger" data-act="elimina-scheda" data-id="' + s.id + '">Elimina scheda</button>' : "") + "</div></section>";
  return h;
}

// Il riquadro della CA si chiude toccando fuori.
document.addEventListener("click", function (e) {
  document.querySelectorAll("details.cainfo[open]").forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute("open"); });
});
