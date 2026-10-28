/* =====================================================================
   js/scheda/classi-scheda.js
   Cosa fa:   Più classi su una scheda (multiclasse) e gli slot incantesimo
              che ne derivano, secondo le regole 2024:
                - incantatori pieni (Bardo, Chierico, Druido, Stregone, Mago):
                  tutti i livelli;
                - Paladino e Ranger: metà dei livelli, per eccesso;
                - Ladro Mistificatore Arcano e Guerriero Cavaliere Mistico:
                  un terzo dei livelli, per difetto, dal livello 3;
                - con una sola classe incantatrice vale la tabella della sua
                  classe; con più classi si sommano i livelli e si legge la
                  tabella multiclasse;
                - Warlock: Magia del Patto separata, si recupera con il riposo
                  breve (se è l'unica classe incantatrice usa gli slot normali).
              Come sono salvate le classi: nel campo Classe, es. «Ladro 3 / Mago 2»
              (una sola classe: solo il nome); nel campo Sottoclasse, es.
              «Ladro: Mistificatore Arcano; Mago: Evocazione»; il Livello è il totale.
              Non serve cambiare il database.
   Contiene:  classiDi, classiScrivi, tipoInc, slotDaClassi, descriviClassi,
              risorsePatto, htmlClassiMulti, modulo delle classi nella modifica
              (clsRiga, clsLeggi, clsAggiorna), ACT cls-add, cls-del
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

var SEP_CLASSI = /\s*[\/+&;,]\s*|\s+e\s+/i;

// La sottoclasse dà incantesimi (come terzo di incantatore)?
function sottoMagica(nome, sub) {
  var t = String(sub || "").toLowerCase();
  return (nome === "Ladro" && t.indexOf("arcan") >= 0) || (nome === "Guerriero" && t.indexOf("mistic") >= 0);
}

// Le classi di una scheda: [{ n: nome, info: dati della classe o null, lv: livello, sub: sottoclasse }].
function classiDi(s) {
  var parti = String(s.classe || "").split(SEP_CLASSI).map(function (p) { return p.trim(); }).filter(Boolean);
  if (!parti.length) return [];
  var totale = Math.max(1, Number(s.livello) || 1), st = String(s.sottoclasse || "").trim(), subs = {};
  if (st.indexOf(":") >= 0) st.split(/\s*;\s*/).forEach(function (p) { var i = p.indexOf(":"); if (i > 0) subs[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim(); });
  var lista = parti.map(function (p) {
    var m = /(\d+)/.exec(p), nome = p.replace(/\d+/g, "").trim(), info = classeInfo(nome);
    return { n: info ? info.n : (nome || p), info: info, lv: m ? Math.min(20, Math.max(1, Number(m[1]))) : null, sub: "" };
  });
  var noti = lista.reduce(function (t, c) { return t + (c.lv || 0); }, 0), senza = lista.filter(function (c) { return !c.lv; });
  senza.forEach(function (c, k) { c.lv = k === 0 ? Math.max(1, totale - noti - (senza.length - 1)) : 1; });
  var haSub = Object.keys(subs).length > 0;
  lista.forEach(function (c, k) { c.sub = haSub ? (subs[c.n.toLowerCase()] || "") : (k === 0 ? st : ""); });
  return lista;
}

// Da una lista di classi ai tre campi della scheda.
function classiScrivi(lista) {
  var tot = Math.min(20, lista.reduce(function (t, c) { return t + c.lv; }, 0)) || 1;
  if (lista.length <= 1) return { classe: lista.length ? lista[0].n : "", sottoclasse: lista.length ? (lista[0].sub || "") : "", livello: tot };
  return {
    classe: lista.map(function (c) { return c.n + " " + c.lv; }).join(" / "),
    sottoclasse: lista.filter(function (c) { return c.sub; }).map(function (c) { return c.n + ": " + c.sub; }).join("; "),
    livello: tot
  };
}

// Come lancia incantesimi una classe: "pieno", "mezzo", "terzo" (sottoclasse magica dal livello 3), "patto" o null.
function tipoInc(c) {
  if (!c.info) return null;
  if (c.info.inc) return c.info.inc;
  return sottoMagica(c.info.n, c.sub) && c.lv >= 3 ? "terzo" : null;
}

// Slot incantesimo di una lista di classi.
// Risultato: { tot: [9 numeri], riposo, patto: {n, liv} o null, idx: livello da incantatore, parti: [testi], modo: "nessuna" | "singola" | "multi" }
function slotDaClassi(lista) {
  var r = { tot: [0, 0, 0, 0, 0, 0, 0, 0, 0], riposo: "lungo", patto: null, idx: 0, parti: [], modo: "nessuna" };
  var slot = lista.filter(function (c) { var t = tipoInc(c); return t === "pieno" || t === "mezzo" || t === "terzo"; });
  var w = lista.filter(function (c) { return tipoInc(c) === "patto"; })[0], tab = null;
  if (slot.length === 1) {
    var c = slot[0], t = tipoInc(c);
    tab = t === "pieno" ? PIENO[c.lv - 1] : t === "mezzo" ? MEZZO[c.lv - 1] : PIENO[Math.ceil(c.lv / 3) - 1];
    r.modo = "singola"; r.idx = t === "pieno" ? c.lv : t === "mezzo" ? Math.ceil(c.lv / 2) : Math.ceil(c.lv / 3);
  } else if (slot.length > 1) {
    var idx = 0;
    slot.forEach(function (c) {
      var t = tipoInc(c), v;
      if (t === "pieno") { v = c.lv; r.parti.push(c.n + " " + c.lv + " → " + v); }
      else if (t === "mezzo") { v = Math.ceil(c.lv / 2); r.parti.push(c.n + " " + c.lv + " → " + v + " (metà, per eccesso)"); }
      else { v = Math.floor(c.lv / 3); r.parti.push(c.n + " " + c.lv + " → " + v + " (un terzo, per difetto)"); }
      idx += v;
    });
    idx = Math.min(20, idx); tab = PIENO[idx - 1]; r.modo = "multi"; r.idx = idx;
  }
  if (tab) tab.forEach(function (n, i) { r.tot[i] = n; });
  if (w) {
    var p = PATTO[w.lv - 1];
    if (slot.length) r.patto = { n: p[0], liv: p[1] };
    else { r.tot[p[1] - 1] = p[0]; r.riposo = "breve"; r.modo = "singola"; }
  }
  return r;
}

function descriviClassi(s) {
  var l = classiDi(s);
  if (!l.length) return [s.classe, s.sottoclasse].filter(Boolean).join(" ");
  if (l.length === 1) return [l[0].n, l[0].sub].filter(Boolean).join(" ");
  return l.map(function (c) { return c.n + " " + c.lv + (c.sub ? " (" + c.sub + ")" : ""); }).join(" / ");
}

// Aggiunge, toglie o aggiorna la risorsa «Slot del Patto» (Warlock con altre classi incantatrici) in una lista di risorse.
function risorsePatto(risorse, patto) {
  var vecchia = (risorse || []).filter(function (r) { return /^slot del patto/i.test(r.nome); })[0];
  var altre = (risorse || []).filter(function (r) { return !/^slot del patto/i.test(r.nome); });
  if (patto) altre.push({ nome: "Slot del Patto (livello " + patto.liv + ")", max: patto.n, usati: Math.min(patto.n, vecchia ? vecchia.usati : 0), recupero: "breve" });
  return altre;
}

// Nella scheda, sezione Incantesimi: come si è arrivati agli slot, quando le classi incantatrici sono più d'una.
function htmlClassiMulti(s) {
  var l = classiDi(s), r = slotDaClassi(l), righe = [];
  l.forEach(function (c) {
    var t = tipoInc(c);
    if (!t || t === "patto") return;
    var car = c.info && c.info.car ? c.info.car : (t === "terzo" ? "int" : null), m = car ? mod(s[ABK[car][3]]) : null, bc = bonusComp(s.livello);
    righe.push("<strong>" + esc(c.n) + "</strong> · " + (car ? ABK[car][1] + " · CD " + (8 + bc + m) + " · attacco " + sgn(bc + m) : "caratteristica non definita"));
  });
  var w = l.filter(function (c) { return tipoInc(c) === "patto"; })[0];
  if (w) { var p = PATTO[w.lv - 1], m2 = mod(s[ABK[w.info.car][3]]), bc2 = bonusComp(s.livello); righe.push("<strong>Warlock</strong> · " + ABK[w.info.car][1] + " · CD " + (8 + bc2 + m2) + " · attacco " + sgn(bc2 + m2)); }
  var h = "";
  if (righe.length > 1) h += '<p class="hint">' + righe.join("<br>") + "</p>";
  if (r.modo === "multi") h += '<details class="tendina"><summary>Livello da incantatore multiclasse: ' + r.idx + "</summary><p class=\"hint\">Somma di: " + esc(r.parti.join(", ")) + ". Gli slot si leggono dalla tabella multiclasse.</p></details>";
  if (r.patto) h += '<p class="hint">Magia del Patto, separata dagli altri slot: ' + r.patto.n + " slot di " + r.patto.liv + "° livello (nelle Risorse), si recuperano con il riposo breve.</p>";
  return h;
}

// ---------------------------------------------------------------- modulo delle classi, nella modifica della scheda
function clsRiga(i, nome, lv, sub) {
  return '<div class="clsrigaed" data-ci="' + i + '"><label class="f"><span>Classe</span><input name="c_n_' + i + '" list="nomiclassi" value="' + esc(nome) + '" autocomplete="off"></label>' +
    '<label class="f"><span>Livello</span><input type="number" name="c_l_' + i + '" min="1" max="20" value="' + lv + '"></label>' +
    '<label class="f"><span>Sottoclasse</span><input name="c_s_' + i + '" value="' + esc(sub) + '" autocomplete="off"></label>' +
    '<button type="button" class="small" data-act="cls-del" data-i="' + i + '" aria-label="Togli questa classe">Togli</button></div>';
}
function htmlModuloClassi(d) {
  var l = classiDi(d);
  if (!l.length) l = [{ n: "", lv: Number(d.livello) || 1, sub: "" }];
  return '<h3>Classi e livello</h3><datalist id="nomiclassi">' + NOMI_CLASSI.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>" +
    '<div id="clsmodulo">' + l.map(function (c, i) { return clsRiga(i, c.n, c.lv, c.sub); }).join("") + "</div>" +
    '<p><button type="button" class="small" data-act="cls-add">Aggiungi una classe</button></p><p class="hint" id="clsTot"></p>';
}
// Legge le righe del modulo: [{ n, info, lv, sub }].
function clsLeggi(f) {
  var l = [];
  for (var i = 0; i < 40; i++) {
    var el = f.elements["c_n_" + i];
    if (!el) continue;
    var nome = String(el.value || "").trim(); if (!nome) continue;
    var info = classeInfo(nome);
    l.push({ n: info ? info.n : nome, info: info, lv: Math.min(20, Math.max(1, Math.floor(Number(f.elements["c_l_" + i].value) || 1))), sub: String(f.elements["c_s_" + i].value || "").trim() });
  }
  return l;
}
// Dopo una modifica: aggiorno il totale e ricalcolo slot, riposo, risorse e caratteristica da incantatore.
function clsAggiorna(f, soloTotale) {
  var l = clsLeggi(f), sc = classiScrivi(l), r = slotDaClassi(l);
  var tot = l.reduce(function (t, c) { return t + c.lv; }, 0), el = document.getElementById("clsTot");
  if (el) el.textContent = tot > 20 ? "Il livello totale è " + tot + ": il massimo è 20." : "Livello totale: " + sc.livello + ".";
  if (soloTotale) return;
  for (var k = 1; k <= 9; k++) if (f.elements["slot_" + k]) f.elements["slot_" + k].value = r.tot[k - 1];
  if (f.elements.slot_riposo) f.elements.slot_riposo.value = r.riposo;
  if (f.elements.risorse) {
    var ris = risorsePatto(f.elements.risorse.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
      var p = x.split("|").map(function (z) { return z.trim(); });
      return { nome: p[0], max: Number(p[1]) || 1, usati: 0, recupero: /^b/i.test(p[2] || "") ? "breve" : "lungo", riga: x };
    }), r.patto);
    f.elements.risorse.value = ris.map(function (x) { return x.riga || (x.nome + " | " + x.max + " | " + x.recupero); }).join("\n");
  }
  if (f.elements.car_incantesimi && !f.elements.car_incantesimi.value) {
    var car = "";
    l.some(function (c) { var t = tipoInc(c); if (!t) return false; car = (c.info && c.info.car) ? c.info.car : (t === "terzo" ? "int" : ""); return !!car; });
    if (car) f.elements.car_incantesimi.value = car;
  }
}

ACT["cls-add"] = function () {
  var f = $("#dlgForm"), box = $("#clsmodulo"); if (!f || !box) return;
  var i = 0; while (f.elements["c_n_" + i]) i++;
  var div = document.createElement("div"); div.innerHTML = clsRiga(i, "", 1, "");
  box.appendChild(div.firstChild);
  f.elements["c_n_" + i].focus(); clsAggiorna(f);
};
ACT["cls-del"] = function (b) {
  var f = $("#dlgForm"); if (!f) return;
  var righe = document.querySelectorAll("#clsmodulo .clsrigaed");
  if (righe.length <= 1) { toast("Serve almeno una classe.", true); return; }
  var r = b.closest(".clsrigaed"); if (r) r.parentNode.removeChild(r);
  clsAggiorna(f);
};
document.addEventListener("input", function (e) {
  var f = e.target && e.target.form;
  if (f && f.id === "dlgForm" && /^c_[nls]_\d+$/.test(e.target.name || "")) clsAggiorna(f);
});
