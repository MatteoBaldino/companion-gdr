/* =====================================================================
   js/import/pagina.js
   Cosa fa:   la schermata di importazione (importa.html): sceglie la campagna,
              legge i file Excel, mostra un'anteprima con gli avvisi e,
              dopo la conferma, manda tutto al database a gruppi di 100.
   Usa:       js/import/listino.js (la lettura dei listini), config.js, Supabase, SheetJS
   Funzioni del database usate: importa_oggetti, importa_servizi, svuota_libreria
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.CONFIG || {};
  var root = document.getElementById("app");
  var GRUPPO = 100;                       // [MODIFICA QUI] voci per ogni richiesta (con 100 ogni gruppo impiega meno di un secondo)

  var NOMI_TIPO = { armi: "Armi", armature: "Armature", cibi: "Cibi e alcolici", oggetti: "Oggetti vari", servizi: "Servizi (taverne, viaggi…)" };
  var NOMI_CAT = { arma: "Armi", armatura: "Armature e protezioni", cibo: "Cibi e bevande", vario: "Oggetti vari" };

  var esc = function (v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var S = { sb: null, user: null, camps: [], camp: null, esistenti: 0, rapporto: null, occupato: false };

  function messaggio(testo) {
    root.innerHTML = '<main class="narrow stack"><h1>Importa listini</h1><p>' + testo + '</p><p><a class="btn" href="index.html">Torna al sito</a></p></main>';
  }

  // ------------------------------------------------------------------ avvio
  function avvia() {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase) return messaggio("Manca la configurazione: apri <code>config.js</code>.");
    if (!window.XLSX) return messaggio("Non riesco a caricare il lettore di file Excel. Controlla la connessione e ricarica la pagina.");
    S.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    S.sb.auth.getSession().then(function (r) {
      S.user = r.data && r.data.session ? r.data.session.user : null;
      if (!S.user) return messaggio("Per importare devi aver fatto l’accesso. Apri il sito, accedi, poi torna qui.");
      return S.sb.from("giocatori").select("id, nome, ruolo, campagna_id, campagne(id, nome)")
        .eq("user_id", S.user.id).eq("ruolo", "master").order("id").then(function (q) {
          if (q.error) return messaggio("Errore: " + esc(q.error.message));
          S.camps = q.data || [];
          if (!S.camps.length) return messaggio("Non sei il master di nessuna campagna: solo il master può importare.");
          var ultima = null;
          try { ultima = localStorage.getItem("gdr_camp_import"); } catch (e) {}
          var scelta = S.camps.filter(function (m) { return String(m.campagna_id) === ultima; })[0] || S.camps[0];
          S.camp = scelta.campagna_id;
          return contaEsistenti().then(disegna);
        });
    });
  }

  function contaEsistenti() {
    return S.sb.from("oggetti").select("id", { count: "exact", head: true }).eq("campagna_id", S.camp).eq("archiviato", false)
      .then(function (r) { S.esistenti = r.count || 0; });
  }

  // ------------------------------------------------------------------ schermata
  function disegna() {
    var c = S.camps.filter(function (m) { return m.campagna_id === S.camp; })[0];
    var campi = S.camps.length > 1
      ? '<label class="f"><span>Campagna</span><select id="camp">' + S.camps.map(function (m) {
          var nome = (Array.isArray(m.campagne) ? m.campagne[0] : m.campagne) || {};
          return '<option value="' + m.campagna_id + '"' + (m.campagna_id === S.camp ? " selected" : "") + ">" + esc(nome.nome) + "</option>";
        }).join("") + "</select></label>"
      : '<p class="hint">Campagna: <strong>' + esc(((Array.isArray(c.campagne) ? c.campagne[0] : c.campagne) || {}).nome) + "</strong></p>";

    root.innerHTML =
      '<main class="wrap stack"><div class="row" style="justify-content:space-between;align-items:baseline"><h1>Importa listini</h1><a class="btn" href="index.html">Torna al sito</a></div>' +
      "<p>Scegli i file Excel dei listini (armi, armature, cibi, oggetti, taverne e servizi). Si leggono nel tuo browser: prima vedi un’anteprima, e solo dopo la conferma si salvano. " +
      "Il tipo di ogni file si riconosce dalle colonne, quindi il nome del file non conta.</p>" + campi +
      '<label class="f"><span>File Excel (anche più di uno)</span><input type="file" id="files" accept=".xlsx,.xls" multiple></label>' +
      '<div id="rapporto"></div></main>';

    var sel = document.getElementById("camp");
    if (sel) sel.addEventListener("change", function () {
      S.camp = Number(sel.value); S.rapporto = null;
      try { localStorage.setItem("gdr_camp_import", String(S.camp)); } catch (e) {}
      contaEsistenti().then(disegna);
    });
    document.getElementById("files").addEventListener("change", function (ev) { leggiFile(Array.prototype.slice.call(ev.target.files)); });
  }

  // ------------------------------------------------------------------ lettura dei file
  function leggiBuffer(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(r.result); };
      r.onerror = function () { ko(r.error); };
      r.readAsArrayBuffer(file);
    });
  }

  function leggiFile(files) {
    var box = document.getElementById("rapporto");
    if (!files.length) { box.innerHTML = ""; return; }
    box.innerHTML = '<p class="boot">Leggo i file…</p>';
    Promise.all(files.map(function (f) {
      return leggiBuffer(f).then(function (buf) {
        var wb = window.XLSX.read(buf, { type: "array" });
        var ws = wb.Sheets[wb.SheetNames[0]];
        return { nome: f.name, righe: window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) };
      }).catch(function () { return { nome: f.name, righe: [] }; });
    })).then(function (lette) {
      S.rapporto = window.Listino.converti(lette);
      disegnaRapporto();
    });
  }

  // ------------------------------------------------------------------ anteprima
  function disegnaRapporto() {
    var r = S.rapporto, box = document.getElementById("rapporto");
    var per = {};
    r.oggetti.forEach(function (o) { per[o.categoria] = (per[o.categoria] || 0) + 1; });

    var righeFile = r.file.map(function (f) {
      return "<tr><td>" + esc(f.nome) + "</td><td>" + (f.tipo ? esc(NOMI_TIPO[f.tipo]) : '<span class="err">non riconosciuto</span>') +
        "</td><td>" + (f.tipo ? f.voci + (f.lette != null && f.lette !== f.voci ? " su " + f.lette : "") : "—") + "</td></tr>";
    }).join("");

    var cat = Object.keys(NOMI_CAT).filter(function (k) { return per[k]; }).map(function (k) {
      return "<tr><td>" + NOMI_CAT[k] + "</td><td>" + per[k] + "</td></tr>";
    }).join("") + (r.servizi.length ? "<tr><td>Servizi (listino prezzi)</td><td>" + r.servizi.length + "</td></tr>" : "");

    // Gli avvisi si raggruppano per messaggio, con l'elenco dei nomi.
    var gruppi = {}, ordine = [];
    r.avvisi.forEach(function (a) {
      var k = a.livello + "|" + a.messaggio.replace(/«.*?»/g, "«…»");
      if (!gruppi[k]) { gruppi[k] = { livello: a.livello, msg: a.messaggio.replace(/«.*?»/g, "«…»"), nomi: [] }; ordine.push(k); }
      gruppi[k].nomi.push(a.nome + (a.file ? "" : ""));
    });
    var peso = { errore: 0, attenzione: 1, info: 2 };
    ordine.sort(function (a, b) { return peso[gruppi[a].livello] - peso[gruppi[b].livello]; });
    var avvisi = ordine.map(function (k) {
      var g = gruppi[k], etichetta = { errore: "Errore", attenzione: "Da controllare", info: "Nota" }[g.livello];
      return '<details class="avvisi"' + (g.livello !== "info" ? " open" : "") + "><summary><strong>" + etichetta + ":</strong> " + esc(g.msg) + " (" + g.nomi.length + ")</summary>" +
        '<p class="hint">' + g.nomi.map(esc).join(", ") + "</p></details>";
    }).join("");

    var tot = r.oggetti.length + r.servizi.length;
    var svuota = S.esistenti > 0
      ? '<div class="empty" style="text-align:left"><p>In questa campagna ci sono già <strong>' + S.esistenti + "</strong> oggetti.</p>" +
        '<p class="hint">Le voci con lo stesso nome vengono saltate, non duplicate. Se quelli che ci sono sono solo di prova, puoi toglierli prima.</p>' +
        '<label class="c"><input type="checkbox" id="svuota"><span>Prima di importare, svuota la libreria (gli oggetti di prova spariscono anche dagli inventari)</span></label></div>'
      : "";

    box.innerHTML =
      "<h2>Anteprima</h2>" +
      '<table class="rapporto"><thead><tr><th>File</th><th>Riconosciuto come</th><th>Voci</th></tr></thead><tbody>' + righeFile + "</tbody></table>" +
      (tot ? '<table class="rapporto"><thead><tr><th>Cosa verrà salvato</th><th>Voci</th></tr></thead><tbody>' + cat + "</tbody></table>" : "") +
      (avvisi ? "<h2>Avvisi</h2>" + avvisi : "") + svuota +
      '<div class="row"><button class="primary" id="vai"' + (tot ? "" : " disabled") + ">Importa " + r.oggetti.length + " oggetti e " + r.servizi.length + " servizi</button></div>" +
      '<div class="barra" id="barra" hidden><span></span></div><div id="esito" role="status" aria-live="polite"></div>';
    var vai = document.getElementById("vai");
    if (vai) vai.addEventListener("click", importa);
  }

  // ------------------------------------------------------------------ importazione
  function chiama(nome, args) {
    return S.sb.rpc(nome, args).then(function (r) { if (r.error) throw r.error; return r.data; });
  }

  function importa() {
    if (S.occupato || !S.rapporto) return;
    var svuota = document.getElementById("svuota");
    if (svuota && svuota.checked && !window.confirm("Svuotare la libreria di questa campagna? Gli oggetti attuali spariranno dagli inventari.")) return;
    S.occupato = true;
    document.getElementById("vai").disabled = true;
    var barra = document.getElementById("barra"), esito = document.getElementById("esito");
    barra.hidden = false;

    var oggetti = S.rapporto.oggetti, servizi = S.rapporto.servizi;
    var totale = oggetti.length + servizi.length, fatti = 0;
    var somma = { creati: 0, saltati: 0, errori: [] };
    var passi = [];
    for (var i = 0; i < oggetti.length; i += GRUPPO) passi.push({ fn: "importa_oggetti", lista: oggetti.slice(i, i + GRUPPO) });
    for (var j = 0; j < servizi.length; j += GRUPPO) passi.push({ fn: "importa_servizi", lista: servizi.slice(j, j + GRUPPO) });

    function avanza() {
      barra.firstElementChild.style.width = Math.round(totale ? (fatti / totale) * 100 : 100) + "%";
      esito.textContent = "Importo… " + fatti + " di " + totale;
    }
    var inizio = Promise.resolve();
    if (svuota && svuota.checked) inizio = chiama("svuota_libreria", { p_camp: S.camp });
    avanza();

    passi.reduce(function (prec, p) {
      return prec.then(function () {
        return chiama(p.fn, { p_camp: S.camp, p_lista: p.lista }).then(function (r) {
          somma.creati += r.creati || 0; somma.saltati += r.saltati || 0;
          (r.errori || []).forEach(function (e) { somma.errori.push(e); });
          fatti += p.lista.length; avanza();
        });
      });
    }, inizio).then(function () {
      S.occupato = false;
      var html = '<div class="empty" style="text-align:left"><p><strong>Fatto.</strong> Salvate ' + somma.creati + " voci, " + somma.saltati + " saltate perché già presenti, " +
        somma.errori.length + " con errore.</p>" +
        '<div class="row"><a class="btn" href="index.html">Vai alla libreria</a></div></div>';
      if (somma.errori.length) {
        html += "<h2>Voci non salvate</h2><ul class=\"plain\">" + somma.errori.map(function (e) {
          return "<li><strong>" + esc(e.nome) + ":</strong> " + esc(e.errore) + "</li>";
        }).join("") + "</ul>";
      }
      esito.innerHTML = html;
      contaEsistenti();
    }).catch(function (e) {
      S.occupato = false;
      document.getElementById("vai").disabled = false;
      esito.innerHTML = '<p class="err">Importazione interrotta: ' + esc((e && e.message) || e) +
        ". Quello che era già stato salvato resta. Puoi rilanciarla: le voci già presenti vengono saltate.</p>";
    });
  }

  avvia();
})();
