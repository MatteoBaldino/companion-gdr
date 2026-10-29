/* =====================================================================
   js/personaggi/personaggi.js
   Cosa fa:   Sezione Personaggi del master: PG e NPC con i loro inventari,
              e creazione di un NPC.
   Contiene:  holders, invDi, htmlPersonaggi
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- personaggi (master)
function holders() {
  var g = S.gioc.filter(function (x) { return x.ruolo === "giocatore"; }).map(function (x) { return { key: "g:" + x.id, nome: x.nome, tipo: "PG" }; });
  var p = S.png.map(function (x) { return { key: "p:" + x.id, nome: x.nome, tipo: "NPC" }; });
  return g.concat(p);
}
function invDi(key) {
  var t = key.split(":"), id = Number(t[1]);
  return S.inv.filter(function (i) { return t[0] === "g" ? i.giocatore_id === id : i.png_id === id; });
}
function htmlPersonaggi() {
  var c = one(S.me.campagne) || {};
  var hs = holders();
  var out = "";
  if (!S.gioc.some(function (x) { return x.ruolo === "giocatore"; })) {
    out += '<div class="empty" style="margin-bottom:1.5rem">Nessun giocatore è ancora entrato. Dai loro il codice invito <strong>' + esc(c.codice_invito) + "</strong>: lo inseriscono dopo aver creato l’account.</div>";
  }
  // Gli oggetti che i giocatori hanno dato al master (di solito per un NPC): «Dai» li passa a un NPC o a un PG, scelto da un elenco con ricerca.
  var ric = invDi("g:" + S.me.id);
  if (ric.length) {
    out += '<section class="holder"><header><h2>Ricevuti dai giocatori</h2><span class="tag">' + ric.length + (ric.length === 1 ? " oggetto" : " oggetti") + "</span></header>" +
      '<p class="hint">Passali a un NPC con «Dai», oppure toglili.</p>' +
      ric.map(function (i) {
        return rigaOggetto(i.oggetti, {
          qta: i.quantita, compact: true,
          azioni: '<button class="small" data-act="dai" data-inv="' + i.id + '" data-key="g:' + S.me.id + '">Dai</button>' +
            '<button class="small danger" data-act="togli" data-inv="' + i.id + '" data-key="g:' + S.me.id + '">Togli</button>'
        });
      }).join("") + "</section>";
  }
  out += hs.map(function (h) {
    var inv = invDi(h.key);
    return '<section class="holder"><header><h2>' + esc(h.nome) + '</h2><span class="tag">' + h.tipo + '</span><button class="small" style="margin-left:auto" data-act="vai-scheda" data-key="' + h.key + '">Scheda</button>' +
      (h.tipo === "NPC" ? '<button class="small danger" data-act="elimina-png" data-key="' + h.key + '">Elimina</button>' : "") + "</header>" +
      (inv.length ? inv.map(function (i) {
        return rigaOggetto(i.oggetti, {
          qta: i.quantita, equip: i.equipaggiato, compact: true,
          azioni: '<button class="small" data-act="sposta" data-inv="' + i.id + '" data-key="' + h.key + '">Sposta</button>' +
            '<button class="small danger" data-act="togli" data-inv="' + i.id + '" data-key="' + h.key + '">Togli</button>'
        });
      }).join("") : '<p class="muted" style="margin-top:.6rem">Inventario vuoto. Assegna un oggetto dalla libreria.</p>') + "</section>";
  }).join("");
  out += '<form data-form="png" class="row" style="align-items:end;margin-top:1rem"><label class="f" style="margin:0;flex:1 1 220px"><span>Nuovo NPC (mercante, locandiere, forziere…)</span><input name="nome" type="text" required></label><button class="primary" type="submit">Aggiungi NPC</button></form>';
  return out;
}
