/* =====================================================================
   js/libreria/riga-oggetto.js
   Cosa fa:   Come si disegna un oggetto: dettagli di armi, armature, cibo
              e oggetti vari, prezzo in Drakos, regole e proprietà
              nascoste.
   Contiene:  dettagli, rigaOggetto
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- righe oggetto
function dettagli(o) {
  var d = [];
  var a = one(o.armi), ar = one(o.armature), c = one(o.cibo), v = one(o.oggetti_vari);
  if (o.categoria === "arma" && a) {
    d.push(MOD[a.modalita]);
    d.push(a.danno + " " + a.tipo_danno + (a.danno_versatile ? ", versatile " + a.danno_versatile : ""));
    if (a.bonus_attacco) d.push((a.bonus_attacco > 0 ? "+" : "") + a.bonus_attacco + " per colpire");
    if (a.gittata_normale) d.push("gittata " + dec(distShow(a.gittata_normale)) + (a.gittata_massima ? "/" + dec(distShow(a.gittata_massima)) : "") + " " + distUnit());
    if (a.munizioni_tipo) d.push("munizioni: " + a.munizioni_tipo);
    if (a.equipaggio_richiesto) d.push("equipaggio: " + a.equipaggio_richiesto);
    if (a.ricarica_turni) d.push("ricarica: " + a.ricarica_turni + (a.ricarica_turni === 1 ? " turno" : " turni"));
    if (a.proprieta && a.proprieta.length) d.push(a.proprieta.join(", "));
    if (a.padronanza) d.push("padronanza: " + a.padronanza);
    if (a.requisiti) d.push(a.requisiti);
  } else if (o.categoria === "armatura" && ar) {
    d.push(ARMAT[ar.categoria_armatura]);
    if (ar.categoria_armatura === "scudo" || ar.categoria_armatura === "accessorio") d.push(ar.gruppo === "arti" ? "tre pezzi insieme: +1 alla CA" : "+" + ar.ca_base + " alla CA");
    else if (ar.categoria_armatura === "bardatura") d.push("CA " + ar.ca_base + " (della cavalcatura)");
    else d.push("CA " + ar.ca_base + (ar.usa_destrezza ? (ar.max_destrezza != null ? " + Des (max " + ar.max_destrezza + ")" : " + Des") : ""));
    if (ar.forza_minima) d.push("Forza " + ar.forza_minima);
    if (ar.svantaggio_furtivita) d.push("svantaggio in Furtività");
    if (ar.include_elmo) d.push("elmo incluso");
    if (ar.tempo_indossare) d.push("si indossa in " + ar.tempo_indossare + " min");
    if (ar.requisiti) d.push(ar.requisiti);
  } else if (o.categoria === "cibo" && c) {
    if (c.effetto) d.push(c.effetto);
    d.push(c.razioni + (c.razioni === 1 ? " razione" : " razioni"));
    if (c.deperibile_giorni != null) d.push("si conserva " + c.deperibile_giorni + (c.deperibile_giorni === 1 ? " giorno" : " giorni"));
  } else if (o.categoria === "vario" && v) {
    if (v.effetto) d.push(v.effetto);
    if (v.utilizzi) d.push(v.utilizzi + (v.utilizzi === 1 ? " utilizzo" : " utilizzi"));
    if (v.requisiti) d.push(v.requisiti);
    if (v.di_trama) d.push("oggetto di trama");
  }
  return d;
}

function rigaOggetto(o, opt) {
  opt = opt || {};
  var seg = one(o.oggetti_segreti);
  var meta = [];
  if (o.peso != null) meta.push(fmtPeso(o.peso) + (o.unita ? " per " + o.unita : ""));
  if (o.costo_rame != null) meta.push(fmtRame(o.costo_rame) + (o.unita ? " per " + o.unita : ""));
  else if (o.valore != null) meta.push("prezzo da definire (era " + o.valore + " " + o.valuta + ")");
  if (o.bonus) meta.push("equipaggiato: " + o.bonus);
  var segHtml = "";
  if (seg) {
    if (isMaster()) {
      segHtml = '<p class="secret"><strong>' + (seg.rivelato ? "Proprietà rivelata" : "Proprietà nascosta") + ":</strong> " + esc(seg.testo) +
        ' <button class="link" data-act="rivela" data-ogg="' + o.id + '" data-v="' + (seg.rivelato ? "0" : "1") + '">' + (seg.rivelato ? "Nascondi di nuovo" : "Rivela ai giocatori") + "</button></p>";
    } else if (seg.rivelato) {
      segHtml = '<p class="secret"><strong>Proprietà rivelata:</strong> ' + esc(seg.testo) + "</p>";
    }
  }
  return '<article class="item cat-' + o.categoria + (opt.compact ? " compact" : "") + '"><div>' +
    "<h3>" + esc(o.nome) + (o.nome_en ? ' <span class="en">' + esc(o.nome_en) + "</span>" : "") +
    (opt.qta > 1 ? ' <span class="qta">×' + opt.qta + "</span>" : "") +
    ' <span class="cat">' + esc(CAT[o.categoria].singolare + (o.tipologia ? " · " + o.tipologia : "")) + "</span>" +
    (opt.equip ? ' <span class="on">Equipaggiato</span>' : "") + "</h3>" +
    '<div class="stats">' + dettagli(o).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" +
    (o.regole_extra ? '<p class="regole">' + esc(o.regole_extra) + "</p>" : "") +
    (meta.length ? '<div class="meta">' + meta.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" : "") +
    (o.effetto_condizionale ? '<p class="cond">' + esc(o.effetto_condizionale) + "</p>" : "") +
    (o.descrizione && !opt.compact ? '<p class="desc">' + esc(o.descrizione) + "</p>" : "") +
    segHtml +
    (opt.azioni ? '<div class="row">' + opt.azioni + "</div>" : "") +
    "</div></article>";
}
