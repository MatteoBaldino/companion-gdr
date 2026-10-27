/* =====================================================================
   js/scheda/modifica.js
   Cosa fa:   Modulo per modificare la scheda a mano (completa o
              semplificata).
   Contiene:  editorScheda
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- modifica a mano
function editorScheda(key, s, tipo) {
  var nuova = !s;
  var semp = (s ? s.tipo : tipo) === "semplificata";
  var d = s || { livello: 1, forza: 10, destrezza: 10, costituzione: 10, intelligenza: 10, saggezza: 10, carisma: 10, pf_max: semp ? 4 : 10, pf_attuali: semp ? 4 : 10, pf_temp: 0, ca_manuale: semp ? 10 : null, ca_bonus: 0, velocita: 9, competenze_ts: [], abilita: {}, azioni: [] };
  var corpo = "";
  if (!semp) {
    corpo += '<div class="cols">' + campoOpz("specie", "Specie", SPECIE, d.specie) + campoOpz("background", "Background", BACKGROUND, d.background) + "</div>" +
      '<div class="cols">' + campoOpz("classe", "Classe", NOMI_CLASSI, d.classe) + fld("sottoclasse", "Sottoclasse", d.sottoclasse) +
      fld("livello", "Livello", d.livello, 'min="1" max="20" required', "number") + "</div>";
  } else {
    corpo += fld("sfida", "Grado di sfida (es. 1/4)", d.sfida);
  }
  corpo += "<h3>Caratteristiche</h3><div class=\"cols\">" + ABIL.map(function (a) {
    return fld("a_" + a[0], a[1], d[a[3]], 'min="1" max="30" required', "number");
  }).join("") + "</div><h3>Combattimento</h3>" +
    '<div class="cols">' + fld("pf_max", "PF massimi", d.pf_max, 'min="0" required', "number") + fld("pf_attuali", "PF attuali", d.pf_attuali, 'min="0" required', "number") +
    fld("pf_temp", "PF temporanei", d.pf_temp, 'min="0"', "number") + "</div>" +
    '<div class="cols">' + fld("ca_manuale", semp ? "Classe armatura" : "CA fissa (vuota = calcolata)", d.ca_manuale, 'min="0"' + (semp ? " required" : ""), "number") +
    (semp ? "" : fld("ca_bonus", "Bonus alla CA", d.ca_bonus, 'step="1"', "number")) +
    fld("velocita", "Velocità (" + distUnit() + ")", distShow(d.velocita), 'min="0" step="any" required', "number") + "</div>";
  if (!semp) {
    corpo += "<h3>Tiri salvezza con competenza</h3><div class=\"cols\">" + ABIL.map(function (a) {
      return chk("ts_" + a[0], a[1], (d.competenze_ts || []).indexOf(a[0]) >= 0);
    }).join("") + "</div><h3>Abilità</h3><div class=\"cols\">" + SKILLS.map(function (k) {
      return sel("sk_" + k[0], k[1] + " (" + ABK[k[2]][2] + ")", [["0", "Nessuna"], ["1", "Competenza"], ["2", "Maestria"]], String((d.abilita || {})[k[0]] || 0));
    }).join("") + "</div>" + chk("ispirazione", "Ispirazione", d.ispirazione);
  } else {
    corpo += area("tratti", "Tratti", d.tratti) +
      area("azioni", "Azioni (una per riga, nel formato  Nome | descrizione)", (d.azioni || []).map(function (a) { return a.nome + " | " + a.testo; }).join("\n"));
  }
  corpo += camposGioco(d, semp) + area("note", "Note", d.note);
  modal((nuova ? "Nuova scheda: " : "Modifica scheda: ") + nomeHolder(key), corpo, function (fd) {
    var x = leggi(fd), t = parteDa(key);
    var p = { campagna_id: campId(), id: s ? s.id : null, giocatore_id: t.g, png_id: t.p, tipo: semp ? "semplificata" : "completa",
      specie: semp ? "" : x.o("specie"), background: semp ? "" : x.o("background"), classe: semp ? "" : x.o("classe"), sottoclasse: semp ? "" : x.g("sottoclasse"),
      livello: semp ? 1 : (x.n("livello") || 1), pf_max: x.n("pf_max") || 0, pf_attuali: x.n("pf_attuali") || 0, pf_temp: x.n("pf_temp") || 0,
      ca_manuale: x.n("ca_manuale"), ca_bonus: x.n("ca_bonus") || 0, velocita: distM(x.n("velocita")), note: x.g("note"),
      competenze_ts: [], abilita: {}, ispirazione: false, sfida: semp ? x.g("sfida") : "", tratti: semp ? x.g("tratti") : "", azioni: [] };
    ABIL.forEach(function (a) { p[a[3]] = x.n("a_" + a[0]) || 10; });
    Object.assign(p, leggiGioco(x, semp, s));
    if (!semp) {
      p.competenze_ts = ABIL.filter(function (a) { return x.b("ts_" + a[0]); }).map(function (a) { return a[0]; });
      SKILLS.forEach(function (k) { var v = Number(x.g("sk_" + k[0])); if (v) p.abilita[k[0]] = v; });
      p.ispirazione = x.b("ispirazione");
    } else {
      p.azioni = x.g("azioni").split("\n").map(function (r) { return r.trim(); }).filter(Boolean).map(function (r) {
        var i = r.indexOf("|");
        return i < 0 ? { nome: r, testo: "" } : { nome: r.slice(0, i).trim(), testo: r.slice(i + 1).trim() };
      });
    }
    return salvaScheda(p, nuova ? "Scheda creata" : "Scheda salvata").then(function (id) {
      if (id == null) return false;
      if (nuova) apriDopo(key);
    });
  });
}
