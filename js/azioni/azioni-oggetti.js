/* =====================================================================
   js/azioni/azioni-oggetti.js
   Cosa fa:   Cosa succede premendo un pulsante: accesso, campagne,
              libreria, assegnazioni, passaggi, storico, eliminazione di un
              NPC. Contiene anche i moduli di accesso e di creazione
              campagna.
   Contiene:  ACT, FORMS
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- azioni
var ACT = {
  "auth-mode": function (b) { viewAuth(b.dataset.mode); },
  esci: function () { clearInterval(S.timer); scordaUltima(); sb.auth.signOut(); },
  cambia: function () { clearInterval(S.timer); S.me = null; route(); },
  entra: function (b) {
    var m = (S.mems || []).filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (m) { S.me = m; S.filtro = { cat: "", q: "", tip: "", n: 100, qs: "" }; S.nuove = {}; S.schedaAperta = null; route(); }
  },
  unita: function () {
    U.sys = imp() ? "metric" : "imperial";
    try { localStorage.setItem("gdr_unita", U.sys); } catch (e) {}
    var b = $("#btnUnita"); if (b) b.textContent = labelUnita();
    disegnaTab();
  },
  tab: function (b) { S.tab = b.dataset.tab; if (S.tab === "schede") S.schedaAperta = null; disegnaTab(); },

  nuovo: function () { editor(null); },
  // Elimina un NPC (solo master). Se è già nello storico il database lo archivia invece di cancellarlo.
  "elimina-png": function (b) {
    var id = Number(b.dataset.key.split(":")[1]);
    var p = S.png.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var n = invDi(b.dataset.key).length;
    modal("Eliminare “" + p.nome + "”?",
      "<p>Spariscono la sua scheda" + (n ? " e il suo inventario (" + n + (n === 1 ? " oggetto" : " oggetti") + ": restano nella libreria e li puoi riassegnare)" : "") + ".</p>" +
      '<p class="hint">Se l’NPC è già comparso nello storico non viene cancellato ma archiviato: sparisce dalle liste e lo storico resta intatto.</p>',
      function () {
        return run(function () { return call("elimina_png", { p_id: id }); }).then(function (r) {
          if (!r) return false;
          toast(r.v === "archiviato" ? "NPC archiviato" : "NPC eliminato");
          S.schedaAperta = null;
          return caricaDati().then(disegnaTab);
        });
      }, "Elimina");
  },
  // Copia nella campagna del master gli oggetti e i servizi del listino standard (le voci già presenti restano com'erano).
  "copia-standard": function () {
    modal("Copiare il listino standard?",
      "<p>Copio nella tua campagna gli oggetti e i servizi del listino standard.</p>" +
      '<p class="hint">Le voci che hai già (stesso nome) restano come sono. Quello che modifichi dopo vale solo per la tua campagna. Puoi rifarlo quando il listino standard riceve voci nuove: arrivano solo quelle.</p>',
      function () {
        return run(function () { return call("copia_listino_standard", { p_camp: campId() }); }).then(function (r) {
          if (!r) return false;
          var x = r.v || {};
          toast("Copiati " + (x.oggetti_creati || 0) + " oggetti e " + (x.servizi_creati || 0) + " servizi" +
            ((x.oggetti_saltati || x.servizi_saltati) ? " (già presenti: " + ((x.oggetti_saltati || 0) + (x.servizi_saltati || 0)) + ")" : ""));
          return caricaDati(true).then(disegnaTab);
        });
      }, "Copia");
  },
  altri: function () { S.filtro.n += 100; $("#lista").innerHTML = htmlListaLibreria(); },
  modifica: function (b) { var o = oggPerId(b.dataset.ogg); if (o) editor(o); },
  esempi: function () {
    run(function () { return call("carica_esempi", { p_camp: campId() }); }, "Esempi caricati")
      .then(function (r) { if (r) caricaDati(true).then(disegnaTab); });
  },
  elimina: function (b) {
    var o = oggPerId(b.dataset.ogg); if (!o) return;
    modal("Eliminare “" + o.nome + "”?", "<p>Se l’oggetto è già comparso nello storico non viene cancellato ma archiviato: sparisce dalla libreria, e lo storico resta intatto.</p>", function () {
      return run(function () { return call("elimina_oggetto", { p_id: o.id }); }).then(function (r) {
        if (!r) return false;
        toast(r.v === "archiviato" ? "Oggetto archiviato" : "Oggetto eliminato");
        return caricaDati(true).then(disegnaTab);
      });
    }, "Elimina");
  },
  rivela: function (b) {
    run(function () { return call("rivela_segreto", { p_ogg: Number(b.dataset.ogg), p_rivela: b.dataset.v === "1" }); },
      b.dataset.v === "1" ? "Proprietà rivelata ai giocatori che hanno l’oggetto" : "Proprietà di nuovo nascosta")
      .then(function (r) { if (r) caricaDati(true).then(disegnaTab); });
  },
  assegna: function (b) {
    var o = oggPerId(b.dataset.ogg); if (!o) return;
    var opts = optsDest("");
    if (!opts) { toast("Non c’è nessun destinatario: invita un giocatore o crea un NPC.", true); return; }
    modal("Assegna “" + o.nome + "”",
      '<label class="f"><span>A chi</span><select name="dest">' + opts + "</select></label>" + campoQta(999, o.impilabile),
      function (fd) {
        var d = parteDa(fd.get("dest"));
        return run(function () { return call("assegna", { p_camp: campId(), p_ogg: o.id, p_qta: Number(fd.get("qta")), p_g: d.g, p_p: d.p }); }, "Oggetto assegnato")
          .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
      }, "Assegna");
  },
  sposta: function (b) {
    var i = invPerId(b.dataset.inv); if (!i) return;
    var lista = htmlListaDest(b.dataset.key);
    if (!lista) { toast("Non c’è nessun altro destinatario.", true); return; }
    modal("Sposta “" + i.oggetti.nome + "”",
      lista + campoQta(i.quantita, i.oggetti.impilabile),
      function (fd) {
        if (!fd.get("dest")) { toast("Scegli a chi darlo.", true); return false; }
        var da = parteDa(b.dataset.key), a = parteDa(fd.get("dest"));
        return run(function () {
          return call("trasferisci", { p_camp: campId(), p_ogg: i.oggetto_id, p_qta: Number(fd.get("qta")), da_g: da.g, da_p: da.p, a_g: a.g, a_p: a.p });
        }, "Oggetto spostato").then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
      }, "Sposta");
  },
  togli: function (b) {
    var i = invPerId(b.dataset.inv); if (!i) return;
    modal("Togli “" + i.oggetti.nome + "”", "<p>L’oggetto esce dall’inventario e il movimento resta nello storico.</p>" + campoQta(i.quantita, i.oggetti.impilabile),
      function (fd) {
        var da = parteDa(b.dataset.key);
        return run(function () { return call("rimuovi", { p_camp: campId(), p_ogg: i.oggetto_id, p_qta: Number(fd.get("qta")), p_g: da.g, p_p: da.p }); }, "Oggetto tolto")
          .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
      }, "Togli");
  },
  annulla: function (b) {
    modal("Annullare questo movimento?", "<p>L’oggetto torna a chi lo aveva. Se nel frattempo è stato spostato altrove, l’annullamento non riesce. Il movimento originale resta nello storico, segnato come annullato.</p>",
      function () {
        return run(function () { return call("annulla_trasferimento", { p_id: Number(b.dataset.id) }); }, "Movimento annullato")
          .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
      }, "Annulla il movimento");
  },

  equip: function (b) {
    var i = invPerId(b.dataset.inv); if (!i) return;
    var eq = b.dataset.v === "1", posto = eq ? postoAuto(i) : null;   // la casella la sceglie il sito; il database libera da solo quella già occupata
    run(function () { return posto ? call("equipaggia_posto", { p_inv: i.id, p_posto: posto }) : call("equipaggia", { p_inv: i.id, p_eq: eq }); })
      .then(function (r) { if (r) caricaDati().then(disegnaTab); });
  },
  // Dai: il master sceglie tra PG e NPC in un elenco con ricerca; il giocatore dà ad altri giocatori o al master (che poi lo passa a un NPC), dal proprio inventario.
  dai: function (b) {
    var i = invPerId(b.dataset.inv); if (!i) return;
    var key = b.dataset.key || "g:" + S.me.id, da = parteDa(key), scelta;
    if (isMaster()) scelta = htmlListaDest(key);
    else {
      var altri = S.gioc.filter(function (g) { return g.id !== S.me.id; });
      scelta = altri.length ? '<label class="f"><span>A chi</span><select name="dest">' + altri.map(function (g) { return '<option value="g:' + g.id + '">' + esc(g.nome) + (g.ruolo === "master" ? " (master)" : "") + "</option>"; }).join("") + "</select></label>" +
        (altri.some(function (g) { return g.ruolo === "master"; }) ? '<p class="hint">Per darlo a un NPC, daglielo al master: lo passa lui.</p>' : "") : "";
    }
    if (!scelta) { toast(isMaster() ? "Non c’è nessun altro destinatario." : "Non ci sono altri giocatori nella campagna.", true); return; }
    modal("Dai “" + i.oggetti.nome + "”",
      scelta + campoQta(i.quantita, i.oggetti.impilabile),
      function (fd) {
        if (!fd.get("dest")) { toast("Scegli a chi darlo.", true); return false; }
        var a = parteDa(fd.get("dest"));
        return run(function () {
          return call("trasferisci", { p_camp: campId(), p_ogg: i.oggetto_id, p_qta: Number(fd.get("qta")), da_g: da.g, da_p: da.p, a_g: a.g, a_p: a.p });
        }, "Oggetto consegnato").then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
      }, "Dai");
  },
  // Scarta: l'oggetto resta a terra. Esce dall'inventario e il movimento resta nello storico.
  scarta: function (b) {
    var i = invPerId(b.dataset.inv); if (!i) return;
    var key = b.dataset.key || "g:" + S.me.id, da = parteDa(key);
    modal("Scarta “" + i.oggetti.nome + "”",
      "<p>L’oggetto resta a terra: esce dall’inventario e il movimento resta nello storico.</p>" + campoQta(i.quantita, i.oggetti.impilabile),
      function (fd) {
        return run(function () { return call("scarta", { p_camp: campId(), p_ogg: i.oggetto_id, p_qta: Number(fd.get("qta")), p_g: da.g, p_p: da.p }); }, "Oggetto scartato")
          .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
      }, "Scarta");
  }
};

var FORMS = {
  auth: function (f) {
    var mode = f.dataset.mode, email = f.elements.email.value.trim(), password = f.elements.password.value;
    var err = $("#autherr"); err.textContent = "";
    var p = mode === "login" ? sb.auth.signInWithPassword({ email: email, password: password }) : sb.auth.signUp({ email: email, password: password });
    p.then(function (r) {
      if (r.error) { err.textContent = errText(r.error); return; }
      if (mode === "signup" && !r.data.session) {
        err.style.color = "inherit";
        err.textContent = "Account creato. Controlla la posta per confermare l’email, poi accedi.";
      }
    });
  },
  "crea-campagna": function (f) {
    run(function () { return call("creare_campagna", { p_nome: f.elements.nome.value, p_mio_nome: f.elements.mio.value }); }, "Campagna creata")
      .then(function (r) { if (r) viewCampagne(); });
  },
  unisciti: function (f) {
    run(function () { return call("unisciti_campagna", { p_codice: f.elements.codice.value, p_nome: f.elements.nome.value }); }, "Sei dentro")
      .then(function (r) { if (r) viewCampagne(); });
  },
  png: function (f) {
    var nome = f.elements.nome.value.trim();
    run(function () {
      return sb.from("png").insert({ campagna_id: campId(), nome: nome }).then(function (r) { if (r.error) throw r.error; });
    }, "NPC aggiunto").then(function (r) { if (r) caricaDati().then(disegnaTab); });
  }
};
