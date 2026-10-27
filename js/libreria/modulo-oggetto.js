/* =====================================================================
   js/libreria/modulo-oggetto.js
   Cosa fa:   Modulo per creare e modificare un oggetto: campi per
              categoria, prezzo in Drakos e preparazione dei dati da
              salvare.
   Contiene:  campiCategoria, aggiornaModalita, editor, bindModalita,
              costoRame, payload
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

function campiCategoria(cat, o) {
  var a = o && one(o.armi) || {}, ar = o && one(o.armature) || {}, c = o && one(o.cibo) || {}, v = o && one(o.oggetti_vari) || {};
  if (cat === "arma") {
    return '<div class="cols">' +
      sel("modalita", "Tipo di arma", [["mischia", "Mischia"], ["lancio", "Da lancio"], ["distanza", "A distanza"], ["assedio", "D’assedio"]], a.modalita || "mischia") +
      sel("categoria_arma", "Categoria", [["semplice", "Semplice"], ["da_guerra", "Da guerra"], ["altro", "Altro (magica, speciale)"]], a.categoria_arma || "semplice") + "</div>" +
      '<div class="cols">' + fld("danno", "Danno (es. 1d8)", a.danno, "required") +
      fld("tipo_danno", "Tipo di danno", a.tipo_danno, 'required list="tipidanno"') +
      fld("danno_versatile", "Danno a due mani", a.danno_versatile) +
      fld("bonus_attacco", "Bonus per colpire", a.bonus_attacco || 0, 'step="1"', "number") + "</div>" +
      '<datalist id="tipidanno"><option>taglienti</option><option>perforanti</option><option>contundenti</option><option>acido</option><option>freddo</option><option>fulmine</option><option>fuoco</option><option>forza</option><option>necrotici</option><option>psichici</option><option>radianti</option><option>tuono</option><option>veleno</option></datalist>' +
      fld("proprieta", "Proprietà, separate da virgola", (a.proprieta || []).join(", ")) +
      fld("padronanza", "Padronanza", a.padronanza) +
      '<div class="cols" data-mod="lancio distanza assedio">' +
      fld("gittata_normale", "Gittata normale (" + distUnit() + ")", a.gittata_normale != null ? distShow(a.gittata_normale) : null, 'min="0.1" step="any"', "number") +
      fld("gittata_massima", "Gittata massima (" + distUnit() + ")", a.gittata_massima != null ? distShow(a.gittata_massima) : null, 'min="0.1" step="any"', "number") +
      fld("munizioni_tipo", "Tipo di munizioni", a.munizioni_tipo) + "</div>" +
      '<div class="cols" data-mod="assedio">' +
      fld("equipaggio_richiesto", "Equipaggio richiesto", a.equipaggio_richiesto, 'min="1"', "number") +
      fld("ricarica_turni", "Ricarica (turni)", a.ricarica_turni, 'min="0"', "number") + "</div>" +
      fld("requisiti", "Requisiti", a.requisiti);
  }
  if (cat === "armatura") {
    return '<div class="cols">' +
      sel("categoria_armatura", "Tipo", [["leggera", "Leggera"], ["media", "Media"], ["pesante", "Pesante"], ["scudo", "Scudo"], ["accessorio", "Elmo o protezione"], ["bardatura", "Barda (cavalcatura)"]], ar.categoria_armatura || "leggera") +
      fld("ca_base", "CA (per scudi ed elmi: il bonus; per la barda: la CA della cavalcatura)", ar.ca_base, 'min="0" required', "number") + "</div>" +
      chk("usa_destrezza", "Si somma il modificatore di Destrezza", ar.usa_destrezza) +
      '<div class="cols">' + fld("max_destrezza", "Tetto al modificatore Des", ar.max_destrezza, 'min="0"', "number") +
      fld("forza_minima", "Forza minima", ar.forza_minima, 'min="1"', "number") +
      fld("tempo_indossare", "Minuti per indossarla", ar.tempo_indossare, 'min="0"', "number") +
      fld("tempo_togliere", "Minuti per toglierla", ar.tempo_togliere, 'min="0"', "number") + "</div>" +
      chk("svantaggio_furtivita", "Svantaggio alle prove di Furtività", ar.svantaggio_furtivita) +
      chk("include_elmo", "Include già l’elmo (un elmo separato non aggiunge CA)", ar.include_elmo) +
      sel("gruppo", "Gruppo (solo per elmi e protezioni)", [["", "Nessuno"], ["arti", "Protezione degli arti: tre pezzi insieme danno +1 CA"]], ar.gruppo || "") +
      fld("requisiti", "Requisiti", ar.requisiti);
  }
  if (cat === "cibo") {
    return fld("effetto", "Effetto", c.effetto) +
      '<div class="cols">' + fld("razioni", "Razioni", c.razioni == null ? 1 : c.razioni, 'min="0"', "number") +
      fld("deperibile_giorni", "Si conserva (giorni)", c.deperibile_giorni, 'min="0"', "number") + "</div>";
  }
  return fld("effetto", "Effetto", v.effetto) +
    '<div class="cols">' + fld("utilizzi", "Utilizzi", v.utilizzi, 'min="1"', "number") + fld("requisiti", "Requisiti", v.requisiti) + "</div>" +
    chk("di_trama", "Oggetto di trama", v.di_trama);
}

function aggiornaModalita(f) {
  var m = f.elements.modalita ? f.elements.modalita.value : null;
  f.querySelectorAll("[data-mod]").forEach(function (el) {
    el.hidden = !(m && el.getAttribute("data-mod").split(" ").indexOf(m) >= 0);
  });
}

function editor(o) {
  var edit = !!o;
  var cat = o ? o.categoria : "arma";
  var seg = o && one(o.oggetti_segreti);
  var corpo =
    (edit ? '<input type="hidden" name="categoria" value="' + cat + '"><p class="hint">Categoria: ' + CAT[cat].singolare + "</p>"
          : sel("categoria", "Categoria", CATS.map(function (c) { return [c.id, c.singolare]; }), cat)) +
    fld("nome", "Nome", o && o.nome, "required") +
    '<div class="cols">' + fld("nome_en", "Nome inglese (facoltativo)", o && o.nome_en) +
    fld("tipologia", "Tipologia (es. Spade, Pane e Cereali)", o && o.tipologia) +
    fld("unita", "Unità di prezzo e peso (es. pagnotta)", o && o.unita) + "</div>" +
    area("descrizione", "Descrizione", o && o.descrizione) +
    '<div id="catcampi">' + campiCategoria(cat, o) + "</div>" +
    '<div class="cols">' + fld("peso", "Peso (" + pesoUnit() + ")", (o && o.peso != null) ? pesoShow(o.peso) : null, 'min="0" step="any"', "number") +
    "</div>" +
    '<p class="hint">Prezzo in Drakos' + (o && o.costo_rame == null && o.valore != null ? " (prezzo vecchio: " + o.valore + " " + o.valuta + ")" : "") + "</p>" +
    '<div class="cols">' + MONETE.map(function (m) {
      return fld("p_" + m[0], m[1], dividiRame(o && o.costo_rame)[m[0]], 'min="0" step="1"', "number");
    }).join("") + "</div>" +
    chk("impilabile", "Si impila (cibo, munizioni, pozioni)", o ? o.impilabile : false) +
    area("regole_extra", "Regole particolari (vantaggio e svantaggio, note)", o && o.regole_extra) +
    fld("bonus", "Bonus quando è equipaggiato (testo libero, es. +1 alla CA)", o && o.bonus) +
    fld("effetto_condizionale", "Effetto condizionale (es. Di giorno: +2 danni radianti)", o && o.effetto_condizionale) +
    area("segreto", "Proprietà nascosta: la vede solo il master finché non la riveli", seg && seg.testo);

  var f = modal(edit ? "Modifica oggetto" : "Nuovo oggetto", corpo, function (fd) {
    var p = payload(fd, cat, o && o.id);
    return run(function () { return call("salva_oggetto", { p: p }); }, edit ? "Oggetto aggiornato" : "Oggetto creato")
      .then(function (r) { if (!r) return false; return caricaDati(true).then(disegnaTab); });
  });

  var c = f.elements.categoria;
  if (!edit && c && c.tagName === "SELECT") {
    f.elements.impilabile.checked = false;
    c.addEventListener("change", function () {
      cat = c.value;
      $("#catcampi", f).innerHTML = campiCategoria(cat, null);
      f.elements.impilabile.checked = cat === "cibo";
      bindModalita(f);
    });
  }
  bindModalita(f);
}
function bindModalita(f) {
  var m = f.elements.modalita;
  if (m) m.addEventListener("change", function () { aggiornaModalita(f); });
  aggiornaModalita(f);
}

// Somma i quattro campi del prezzo (Pt, Or, Ar, Ra) e restituisce il totale in rame, o null se sono tutti vuoti.
function costoRame(fd) {
  var q = function (k) { var v = fd.get(k) == null ? "" : String(fd.get(k)).trim().replace(",", "."); return v === "" ? null : Number(v); };
  var v = MONETE.map(function (m) { return q("p_" + m[0]); });
  if (v.every(function (x) { return x == null; })) return null;
  var tot = 0;
  MONETE.forEach(function (m, i) { tot += (v[i] || 0) * m[2]; });
  return Math.round(tot);
}

function payload(fd, cat, id) {
  var g = function (k) { return (fd.get(k) == null ? "" : String(fd.get(k))).trim(); };
  var n = function (k) { var s = g(k).replace(",", "."); return s === "" ? null : Number(s); };
  var b = function (k) { return fd.get(k) === "on"; };
  var d = {};
  if (cat === "arma") {
    d = {
      categoria_arma: g("categoria_arma"), modalita: g("modalita"), danno: g("danno"), tipo_danno: g("tipo_danno"),
      danno_versatile: g("danno_versatile"),
      proprieta: g("proprieta").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      padronanza: g("padronanza"), bonus_attacco: n("bonus_attacco") || 0, requisiti: g("requisiti"),
      gittata_normale: null, gittata_massima: null, munizioni_tipo: "", equipaggio_richiesto: null, ricarica_turni: null
    };
    if (d.modalita !== "mischia") {
      d.gittata_normale = distM(n("gittata_normale")); d.gittata_massima = distM(n("gittata_massima")); d.munizioni_tipo = g("munizioni_tipo");
    }
    if (d.modalita === "assedio") { d.equipaggio_richiesto = n("equipaggio_richiesto"); d.ricarica_turni = n("ricarica_turni"); }
  } else if (cat === "armatura") {
    d = {
      categoria_armatura: g("categoria_armatura"), ca_base: n("ca_base"), usa_destrezza: b("usa_destrezza"),
      max_destrezza: b("usa_destrezza") ? n("max_destrezza") : null, forza_minima: n("forza_minima"),
      svantaggio_furtivita: b("svantaggio_furtivita"), tempo_indossare: n("tempo_indossare"), tempo_togliere: n("tempo_togliere"),
      gruppo: g("gruppo"), include_elmo: b("include_elmo"),
      requisiti: g("requisiti")
    };
  } else if (cat === "cibo") {
    d = { effetto: g("effetto"), razioni: n("razioni"), deperibile_giorni: n("deperibile_giorni") };
  } else {
    d = { effetto: g("effetto"), utilizzi: n("utilizzi"), requisiti: g("requisiti"), di_trama: b("di_trama") };
  }
  return {
    campagna_id: campId(), id: id || null, nome: g("nome"), categoria: cat, descrizione: g("descrizione"),
    nome_en: g("nome_en"), tipologia: g("tipologia"), unita: g("unita"), regole_extra: g("regole_extra"),
    peso: pesoKg(n("peso")), costo_rame: costoRame(fd), impilabile: b("impilabile"),
    bonus: g("bonus"), effetto_condizionale: g("effetto_condizionale"), segreto: g("segreto"), dettagli: d
  };
}
