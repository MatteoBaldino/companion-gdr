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
  var h = back + '<section class="scheda"><header class="sh-head"><h2>' + esc(nome) + '</h2><p class="hint">' + esc(sub) + "</p></header>";
  // Schede complete: prima le caratteristiche, poi CA/PF e il resto (come nel disegno della scheda). Gli NPC semplificati restano come prima.
  var h0 = h; h = "";
  h += '<div class="vitali">' + tile("CA", ca.tot, ca.desc) +
    tile("PF", s.pf_attuali + "/" + s.pf_max + (s.pf_temp ? ' <span class="tmp">+' + s.pf_temp + "</span>" : "")) +
    tile("Velocità", esc(fmtVel(s.velocita)));
  if (!semp) {
    var pas = 10 + totaleAbilita(s, "percezione");
    h += tile("Iniziativa", sgn(mod(s.destrezza)), "", ' data-act="dado" data-k="ini" data-id="' + s.id + '" role="button" tabindex="0" title="Tira l’iniziativa"') + tile("Bonus competenza", sgn(bc)) + tile("Percezione passiva", pas);
  }
  h += "</div>";
  h += '<div class="pfctrl"><label class="f"><span>Punti ferita</span><input type="number" id="pfn" min="1" value="1"></label>' +
    '<button data-act="pf-danno" data-id="' + s.id + '">Danno</button><button data-act="pf-cura" data-id="' + s.id + '">Cura</button>' +
    '<label class="f"><span>PF temporanei</span><input type="number" id="pft" min="0" value="' + s.pf_temp + '"></label>' +
    '<button data-act="pf-temp" data-id="' + s.id + '">Imposta</button>' +
    (!semp ? '<button data-act="ispirazione" data-id="' + s.id + '" aria-pressed="' + s.ispirazione + '">' + (s.ispirazione ? "Ispirazione: sì" : "Ispirazione: no") + "</button>" : "") + "</div>";
  h += htmlTurno(s);
  if (!semp) h += htmlTiro();
  var corpo = h; h = h0;
  var abil = '<div class="abils">' + ABIL.map(function (a) {
    return '<div class="ab"' + (semp ? "" : ' data-act="dado" data-k="abil" data-v="' + a[0] + '" data-id="' + s.id + '" role="button" tabindex="0" title="Tira una prova di ' + a[1] + '"') + '><span class="lbl">' + a[2] + "</span><strong>" + sgn(mod(s[a[3]])) + "</strong><small>" + s[a[3]] + "</small></div>";
  }).join("") + "</div>";
  if (!semp) h += abil + corpo; else h += corpo + abil;
  if (!semp) {
    var tsH = '<h3>Tiri salvezza</h3><ul class="plain sk">' + ABIL.map(function (a) {
      var p = (s.competenze_ts || []).indexOf(a[0]) >= 0;
      return '<li data-act="dado" data-k="ts" data-v="' + a[0] + '" data-id="' + s.id + '" role="button" tabindex="0"><span class="dot" title="' + (p ? "competente" : "non competente") + '">' + (p ? "●" : "○") + "</span> " + a[1] + "<b>" + sgn(mod(s[a[3]]) + (p ? bc : 0)) + "</b></li>";
    }).join("") + '</ul>';
    var abH = '<h3>Abilità</h3><ul class="plain sk">' + SKILLS.map(function (k) {
      var lv = (s.abilita || {})[k[0]] || 0;
      return '<li data-act="dado" data-k="skill" data-v="' + k[0] + '" data-id="' + s.id + '" role="button" tabindex="0"><span class="dot" title="' + ["non competente", "competente", "maestria"][lv] + '">' + ["○", "●", "◆"][lv] + "</span> " + esc(k[1]) +
        ' <small>' + ABK[k[2]][2] + "</small><b>" + sgn(totaleAbilita(s, k[0])) + "</b></li>";
    }).join("") + "</ul>";
    h += '<div class="duecol"><div>' + abH + htmlEquipaggiamento(s, key) + htmlMonete(s) + htmlInventarioScheda(s, key) + "</div><div>" + tsH + htmlCombattimento(s, key) + "</div></div>";
    h += '<p class="hint">● competenza, ◆ maestria. La CA si calcola dall’armatura e dallo scudo equipaggiati nell’inventario.</p>';
  } else {
    if (s.tratti) h += "<h3>Tratti</h3><p class=\"pre\">" + esc(s.tratti) + "</p>";
    if ((s.azioni || []).length) {
      h += "<h3>Azioni</h3><ul class=\"plain\">" + s.azioni.map(function (a) {
        return '<li class="az"><strong>' + esc(a.nome) + ".</strong> " + esc(a.testo) + "</li>";
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
