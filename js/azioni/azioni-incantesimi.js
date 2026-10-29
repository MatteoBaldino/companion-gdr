/* =====================================================================
   js/azioni/azioni-incantesimi.js
   Cosa fa:   Pulsanti di turno, slot, riposi, lancio, incantesimi e
              suggerimento degli slot.
   Contiene:  ACT_INC
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- azioni
var ACT_INC = {
  turno: function (b) { var s = schedaPerId(b.dataset.id); if (!s) return; var t = copia(s.turno || {}); t[b.dataset.k] = !t[b.dataset.k]; gioco(s, { turno: t }); },
  "nuovo-turno": function (b) { var s = schedaPerId(b.dataset.id); if (!s) return; var t = {}; if ((s.turno || {}).morte) t.morte = copia(s.turno.morte); if (inCombattimento(s)) t.combat = true; gioco(s, { turno: t }); },
  // Interruttore del combattimento: entrando o uscendo il turno riparte da zero (azioni libere, movimento intero).
  combat: function (b) { var s = schedaPerId(b.dataset.id); if (!s) return; var t = {}; if ((s.turno || {}).morte) t.morte = copia(s.turno.morte); if (!inCombattimento(s)) t.combat = true; gioco(s, { turno: t }); },
  "sez-scheda": function (b) { S.sezScheda = b.dataset.v; disegnaTab(); },
  "morte-pip": function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    var m = morteDi(s), k = b.dataset.k, n = Number(b.dataset.n);
    m[k] = m[k] === n ? n - 1 : n;
    scriviMorte(s, m);
  },
  "morte-azzera": function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    scriviMorte(s, { s: 0, f: 0 });
  },
  "conc-fine": function (b) { var s = schedaPerId(b.dataset.id); if (s) gioco(s, { concentrazione: null }); },
  slot: function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    var lv = Number(b.dataset.lv), i = Number(b.dataset.i), us = (s.slot_usati || []).slice();
    us[lv] = i < (us[lv] || 0) ? i : i + 1;
    gioco(s, { slot_usati: us });
  },
  risorsa: function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    var r = copia(s.risorse), k = Number(b.dataset.k), i = Number(b.dataset.i);
    r[k].usati = i < r[k].usati ? i : i + 1;
    gioco(s, { risorse: r });
  },
  "risorsa-meno": function (b) { var s = schedaPerId(b.dataset.id); if (!s) return; var r = copia(s.risorse), k = Number(b.dataset.k); r[k].usati = Math.min(r[k].max, r[k].usati + 1); gioco(s, { risorse: r }); },
  "risorsa-piu": function (b) { var s = schedaPerId(b.dataset.id); if (!s) return; var r = copia(s.risorse), k = Number(b.dataset.k); r[k].usati = Math.max(0, r[k].usati - 1); gioco(s, { risorse: r }); },
  "riposo-breve": function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    var patch = { risorse: copia(s.risorse || []).map(function (r) { if (r.recupero === "breve") r.usati = 0; return r; }) };
    if (s.slot_riposo === "breve") patch.slot_usati = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    gioco(s, patch, "Riposo breve: recuperato quello che si recupera con un riposo breve");
  },
  "riposo-lungo": function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    modal("Riposo lungo", "<p>I punti ferita tornano al massimo, gli slot e le risorse si ripristinano e il turno si azzera. I PF temporanei e la concentrazione finiscono.</p>", function () {
      gioco(s, { pf_attuali: s.pf_max, pf_temp: 0, slot_usati: [0, 0, 0, 0, 0, 0, 0, 0, 0], concentrazione: null, turno: {},
        risorse: copia(s.risorse || []).map(function (r) { r.usati = 0; return r; }) }, "Riposo lungo completato");
    }, "Riposa");
  },
  "pf-danno": function (b) {
    var s = schedaPerId(b.dataset.id), v = Math.floor(Number($("#pfn").value) || 0); if (!s || v <= 0) return;
    var ass = Math.min(s.pf_temp, v), temp = s.pf_temp - ass, pf = Math.max(0, s.pf_attuali - (v - ass));
    var conc = s.concentrazione;
    gioco(s, { pf_attuali: pf, pf_temp: temp }).then(function () {
      if (conc && pf > 0) toast("Concentrazione su " + conc + ": tiro salvezza su Costituzione, CD " + Math.min(30, Math.max(10, Math.floor(v / 2))));
      else if (conc && pf === 0) toast("A 0 PF la concentrazione su " + conc + " finisce: usa «Termina».", true);
    });
  },
  "pf-cura": function (b) {
    var s = schedaPerId(b.dataset.id), v = Math.floor(Number($("#pfn").value) || 0); if (!s || v <= 0) return;
    gioco(s, { pf_attuali: Math.min(s.pf_max, s.pf_attuali + v) });
  },
  "pf-temp": function (b) { var s = schedaPerId(b.dataset.id); if (s) gioco(s, { pf_temp: Math.max(0, Math.floor(Number($("#pft").value) || 0)) }); },
  lancia: function (b) {
    var s = schedaPerId(b.dataset.id), i = incPerId(b.dataset.inc); if (!s || !i) return;
    var tot = s.slot_totali || [], us = s.slot_usati || [];
    if (i.livello === 0) {
      var av0 = avvisiLancio(s, i, false);
      if (!av0.length) { applicaLancio(s, i, 0); return; }
      modal("Lancia " + i.nome, '<p class="err">' + av0.map(esc).join("<br>") + "</p><p>Vuoi lanciarlo comunque?</p>", function () { applicaLancio(s, i, 0); }, "Lancia comunque");
      return;
    }
    var opz = [];
    for (var lv = i.livello; lv <= 9; lv++) if ((tot[lv - 1] || 0) - (us[lv - 1] || 0) > 0) opz.push([String(lv), lv + "° livello (" + ((tot[lv - 1] || 0) - (us[lv - 1] || 0)) + " di " + tot[lv - 1] + " disponibili)"]);
    if (i.rituale) opz.push(["rituale", "Come rituale, senza slot (richiede 10 minuti in più)"]);
    if (!opz.length) { toast("Non hai slot disponibili per " + i.nome + ".", true); return; }
    var av = avvisiLancio(s, i, false);
    modal("Lancia " + i.nome, (av.length ? '<p class="err">' + av.map(esc).join("<br>") + "</p>" : "") + sel("slot", "Come lo lanci", opz, opz[0][0]) +
      (i.livelli_superiori ? '<p class="hint">A livelli superiori: ' + esc(i.livelli_superiori) + "</p>" : ""), function (fd) {
      var v = fd.get("slot");
      applicaLancio(s, i, v === "rituale" ? "rituale" : Number(v));
    }, av.length ? "Lancia comunque" : "Lancia");
  },
  "inc-aggiungi": function (b) {
    var s = schedaPerId(b.dataset.id); if (!s) return;
    var gia = {}; incDiScheda(s.id).forEach(function (x) { gia[x.i.id] = true; });
    var tutti = S.inc.filter(function (i) { return !gia[i.id]; }).sort(function (a, c) { return a.livello - c.livello || a.nome.localeCompare(c.nome, "it"); });
    // L'elenco è quello delle classi del personaggio (tutte, se ne ha più di una). Se la classe non ha incantesimi in libreria, mostro tutto.
    var cl = classiIncantatore(s), mie = cl.length ? tutti.filter(function (i) { return fonteAuto(s, i); }) : tutti;
    var soloMie = cl.length > 0 && mie.length > 0;
    // L'elenco è una tendina con gli incantesimi divisi per livello: si sceglie, non si scrive.
    var opzioni = function (lista) {
      var h = '<option value="">— scegli un incantesimo —</option>';
      for (var lv = 0; lv <= 9; lv++) {
        var g = lista.filter(function (i) { return i.livello === lv; });
        if (!g.length) continue;
        h += '<optgroup label="' + LIV_INC[lv] + '">' + g.map(function (i) { return '<option value="' + i.id + '">' + esc(i.nome) + "</option>"; }).join("") + "</optgroup>";
      }
      return h;
    };
    var nota = soloMie ? "Ti mostro gli incantesimi di: " + cl.join(", ") + " (" + mie.length + ")."
      : cl.length ? "Nella libreria non c’è nessun incantesimo di " + cl.join(", ") + ": ti mostro tutti."
      : "La classe della scheda non ha incantesimi o non è riconosciuta: ti mostro tutti.";
    var f = modal("Aggiungi incantesimo",
      '<label class="f"><span>Incantesimo</span><select name="inc" required>' + opzioni(soloMie ? mie : tutti) + "</select></label>" +
      '<p class="hint">' + esc(nota) + "</p>" +
      (soloMie ? chk("tutti", "Mostra anche gli incantesimi di altre classi", false) : "") +
      sel("stato", "Stato", [["preparato", "Preparato"], ["sempre", "Sempre preparato (da un talento o una specie)"], ["non_preparato", "Non preparato"]], "preparato") +
      fld("fonte", "Fonte (si compila da sola: puoi cambiarla, es. Magic Initiate)", "", 'autocomplete="off"') +
      '<p><button type="button" class="link" data-act="nuovo-inc-scheda" data-id="' + s.id + '">Non è in elenco? Creane uno nuovo</button></p>', function (fd) {
      var i = incPerId(fd.get("inc"));
      if (!i) { toast("Scegli un incantesimo dall’elenco.", true); return false; }
      return run(function () { return call("imposta_incantesimo_scheda", { p_scheda: s.id, p_inc: i.id, p_stato: fd.get("stato"), p_fonte: String(fd.get("fonte") || "") }); }, i.nome + " aggiunto")
        .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
    }, "Aggiungi");
    // La fonte si compila da sola quando scegli l'incantesimo, finché non la scrivi tu.
    var scrittaAMano = false;
    f.elements.fonte.addEventListener("input", function () { scrittaAMano = true; });
    f.elements.inc.addEventListener("change", function () {
      if (scrittaAMano) return;
      var i = incPerId(f.elements.inc.value);
      f.elements.fonte.value = i ? fonteAuto(s, i) : "";
    });
    if (f.elements.tutti) f.elements.tutti.addEventListener("change", function () {
      f.elements.inc.innerHTML = opzioni(f.elements.tutti.checked ? tutti : mie);
      if (!scrittaAMano) f.elements.fonte.value = "";
    });
  },
  "nuovo-inc-scheda": function (b) { var id = b.dataset.id; $("#dlg").close(); editorInc(null, id); },
  "inc-prepara": function (b) {
    var s = schedaPerId(b.dataset.id), r = S.si.filter(function (z) { return z.scheda_id === s.id && String(z.incantesimo_id) === b.dataset.inc; })[0]; if (!r) return;
    var nuovo = r.stato === "non_preparato" ? "preparato" : "non_preparato";
    run(function () { return call("imposta_incantesimo_scheda", { p_scheda: s.id, p_inc: r.incantesimo_id, p_stato: nuovo, p_fonte: null }); })
      .then(function (x) { if (x) caricaDati().then(disegnaTab); });
  },
  "inc-rimuovi": function (b) {
    var s = schedaPerId(b.dataset.id), i = incPerId(b.dataset.inc); if (!s || !i) return;
    modal("Togliere " + i.nome + "?", "<p>L’incantesimo esce dalla scheda. Resta nella libreria.</p>", function () {
      return run(function () { return call("rimuovi_incantesimo_scheda", { p_scheda: s.id, p_inc: i.id }); }, "Incantesimo tolto")
        .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
    }, "Togli");
  },
  "nuovo-inc": function () { editorInc(null, null); },
  "modifica-inc": function (b) { var i = incPerId(b.dataset.inc); if (i) editorInc(i, null); },
  "elimina-inc": function (b) {
    var i = incPerId(b.dataset.inc); if (!i) return;
    modal("Eliminare " + i.nome + "?", "<p>Sparisce dalla libreria e da tutte le schede che lo hanno.</p>", function () {
      return run(function () { return call("elimina_incantesimo", { p_id: i.id }); }, "Incantesimo eliminato")
        .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
    }, "Elimina");
  },
  "esempi-inc": function () {
    run(function () { return call("carica_incantesimi_esempio", { p_camp: campId() }); }, "Incantesimi di esempio caricati")
      .then(function (r) { if (r) caricaDati().then(disegnaTab); });
  },
  "suggerisci-slot": function () {
    var f = $("#dlgForm"); if (!f) return;
    var l = clsLeggi(f), prima = l.filter(function (c) { return c.info; })[0];
    if (!prima) { toast("Classe non riconosciuta: scrivi una delle dodici classi del manuale base.", true); return; }
    clsAggiorna(f);
    var info = prima.info;
    if (!f.elements.arm_semplici.checked && !f.elements.arm_guerra.checked && !f.elements.arm_guerra_leggere.checked) {
      f.elements.arm_semplici.checked = info.armi.indexOf("semplici") >= 0; f.elements.arm_guerra.checked = info.armi.indexOf("da_guerra") >= 0; f.elements.arm_guerra_leggere.checked = info.armi.indexOf("da_guerra_leggere") >= 0;
    }
    toast("Slot e caratteristica proposti da classe e livello (" + descriviClassi({ classe: classiScrivi(l).classe, sottoclasse: classiScrivi(l).sottoclasse, livello: classiScrivi(l).livello }) + "): controllali.");
  }
};
Object.keys(ACT_INC).forEach(function (k) { ACT[k] = ACT_INC[k]; });
