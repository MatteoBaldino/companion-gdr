(function () {
  "use strict";

  var CFG = window.CONFIG || {};
  var root = document.getElementById("app");

  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || /INCOLLA/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY)) {
    root.innerHTML =
      '<main class="narrow"><h1>Manca la configurazione</h1>' +
      "<p>Apri il file <code>config.js</code> e incolla l’URL e la chiave anon del tuo progetto Supabase. I passaggi sono nel file README.md.</p></main>";
    return;
  }
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  // ---------------------------------------------------------------- utilità
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var one = function (x) { return Array.isArray(x) ? x[0] || null : x || null; };
  var num = function (n) { return String(Math.round(Number(n) * 1000) / 1000).replace(".", ","); };
  // Unità di misura. Nel database: kg e metri. Qui si converte (D&D: 1 lb = 0,5 kg; 5 ft = 1,5 m).
  var U = { sys: "metric" };
  try { if (localStorage.getItem("gdr_unita") === "imperial") U.sys = "imperial"; } catch (e) {}
  var imp = function () { return U.sys === "imperial"; };
  var arr = function (x, d) { var k = Math.pow(10, d); return Math.round(x * k) / k; };
  var dec = function (x) { return String(x).replace(".", ","); };
  var pesoShow = function (kg) { return imp() ? arr(kg * 2, 2) : arr(kg, 3); };
  var pesoUnit = function () { return imp() ? "lb" : "kg"; };
  var pesoKg = function (v) { return v == null ? null : arr(imp() ? v / 2 : v, 3); };
  var distShow = function (m) { return arr(imp() ? m / 0.3 : m, 1); };
  var distUnit = function () { return imp() ? "ft" : "m"; };
  var distM = function (v) { return v == null ? null : arr(imp() ? v * 0.3 : v, 1); };
  var fmtPeso = function (kg) { return dec(pesoShow(kg)) + " " + pesoUnit(); };
  var labelUnita = function () { return imp() ? "Unità: americane (lb, ft)" : "Unità: internazionali (kg, m)"; };
  var fmtData = function (s) {
    return new Date(s).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  var CATS = [
    { id: "arma", plurale: "Armi", singolare: "Arma" },
    { id: "armatura", plurale: "Armature e scudi", singolare: "Armatura o scudo" },
    { id: "cibo", plurale: "Cibo", singolare: "Cibo" },
    { id: "vario", plurale: "Oggetti vari", singolare: "Oggetto vario" }
  ];
  var CAT = {};
  CATS.forEach(function (c) { CAT[c.id] = c; });
  var MOD = { mischia: "Mischia", lancio: "Lancio", distanza: "Distanza", assedio: "Assedio" };
  var ARMAT = { leggera: "Armatura leggera", media: "Armatura media", pesante: "Armatura pesante", scudo: "Scudo" };
  var TIPO_MOV = { assegnazione: "Assegnazione", trasferimento: "Passaggio", rimozione: "Rimozione", annullamento: "Annullamento" };
  var VALUTE = [["mr", "mr (rame)"], ["ma", "ma (argento)"], ["me", "me (electrum)"], ["mo", "mo (oro)"], ["mp", "mp (platino)"]];
  var OGG_SEL = "*, armi(*), cibo(*), oggetti_vari(*), armature(*), oggetti_segreti(*)";

  var toastTimer;
  function toast(msg, isErr) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "show" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ""; }, isErr ? 6000 : 2600);
  }

  var ERR_AUTH = {
    "Invalid login credentials": "Email o password non corrette.",
    "User already registered": "Esiste già un account con questa email.",
    "Email not confirmed": "Conferma prima l’email dal messaggio che ti abbiamo mandato.",
    "Password should be at least 6 characters.": "La password deve avere almeno 6 caratteri."
  };
  function errText(e) {
    var m = e && e.message ? e.message : "Qualcosa è andato storto. Riprova.";
    if (ERR_AUTH[m]) return ERR_AUTH[m];
    if (/duplicate key|violates unique/.test(m)) return "Questo elemento esiste già.";
    if (/violates check constraint/.test(m)) return "Un valore non è ammesso: controlla i campi numerici e quelli obbligatori.";
    if (/violates foreign key/.test(m)) return "Non si può farlo: l’elemento è collegato ad altri dati.";
    if (/row-level security/.test(m)) return "Non hai il permesso di farlo.";
    return m;
  }
  function call(name, args) {
    return sb.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  // Esegue un’azione mostrando l’esito; restituisce {v} se riuscita, null se fallita.
  function run(fn, okMsg) {
    return Promise.resolve().then(fn).then(function (v) {
      if (okMsg) toast(okMsg);
      return { v: v };
    }, function (e) {
      toast(errText(e), true);
      return null;
    });
  }

  // ---------------------------------------------------------------- stato
  var S = {
    user: null, me: null, tab: null,
    ogg: [], gioc: [], png: [], inv: [], notif: [], trasf: [],
    filtro: { cat: "", q: "" }, nuove: {}, timer: null
  };
  var isMaster = function () { return !!S.me && S.me.ruolo === "master"; };
  var campId = function () { return S.me.campagna_id; };

  // ---------------------------------------------------------------- avvio
  function boot() {
    sb.auth.getSession().then(function (r) {
      S.user = r.data.session ? r.data.session.user : null;
      sb.auth.onAuthStateChange(function (ev, s) {
        var u = s ? s.user : null;
        if ((u && u.id) !== (S.user && S.user.id)) { S.user = u; S.me = null; route(); }
      });
      route();
    });
  }
  function route() {
    clearInterval(S.timer);
    if (!S.user) return viewAuth("login");
    if (!S.me) return viewCampagne();
    return viewApp();
  }

  // ---------------------------------------------------------------- accesso
  function viewAuth(mode) {
    var login = mode === "login";
    root.innerHTML =
      '<main class="auth"><div class="auth-box"><h1>Companion GDR</h1>' +
      '<p class="lead">L’inventario del vostro gruppo: armi, armature, cibo e oggetti, con ogni passaggio di mano registrato.</p>' +
      '<form data-form="auth" data-mode="' + mode + '">' +
      '<label class="f"><span>Email</span><input name="email" type="email" required autocomplete="email"></label>' +
      '<label class="f"><span>Password</span><input name="password" type="password" required minlength="6" autocomplete="' + (login ? "current-password" : "new-password") + '"></label>' +
      '<p class="err" id="autherr" role="alert"></p>' +
      '<button class="primary" type="submit">' + (login ? "Accedi" : "Crea account") + "</button></form>" +
      '<p class="alt">' + (login
        ? 'Non hai un account? <button class="link" data-act="auth-mode" data-mode="signup">Registrati</button>'
        : 'Hai già un account? <button class="link" data-act="auth-mode" data-mode="login">Accedi</button>') +
      "</p></div></main>";
  }

  function viewCampagne() {
    root.innerHTML = '<main class="narrow"><p class="boot">Caricamento…</p></main>';
    sb.from("giocatori")
      .select("id, nome, ruolo, campagna_id, campagne(id, nome, codice_invito)")
      .eq("user_id", S.user.id).order("id")
      .then(function (r) {
        if (r.error) { toast(errText(r.error), true); return; }
        var mems = r.data || [];
        var lista = mems.length
          ? '<ul class="camp-list">' + mems.map(function (m) {
              var c = one(m.campagne) || {};
              return "<li><span><strong>" + esc(c.nome) + "</strong><br><span class=\"hint\">" +
                (m.ruolo === "master" ? "Sei il master" : "Giochi come " + esc(m.nome)) +
                '</span></span><button class="primary small" data-act="entra" data-id="' + m.id + '">Entra</button></li>';
            }).join("") + "</ul>"
          : '<p class="muted">Non fai ancora parte di nessuna campagna. Creane una come master oppure entra con il codice che ti ha dato il master.</p>';
        S.mems = mems;
        root.innerHTML =
          '<main class="narrow stack"><div class="row" style="justify-content:space-between;align-items:baseline"><h1>Le tue campagne</h1>' +
          '<button class="ghost small" data-act="esci">Esci</button></div>' + lista +
          '<form data-form="crea-campagna"><h2>Crea una campagna</h2>' +
          '<label class="f"><span>Nome della campagna</span><input name="nome" type="text" required></label>' +
          '<label class="f"><span>Il tuo nome (master)</span><input name="mio" type="text" required></label>' +
          '<button class="primary" type="submit">Crea campagna</button></form>' +
          '<form data-form="unisciti"><h2>Entra con un codice</h2>' +
          '<label class="f"><span>Codice invito</span><input name="codice" type="text" required autocapitalize="characters" maxlength="12"></label>' +
          '<label class="f"><span>Nome del tuo personaggio</span><input name="nome" type="text" required></label>' +
          '<button class="primary" type="submit">Entra nella campagna</button></form></main>';
      });
  }

  // ---------------------------------------------------------------- struttura
  function viewApp() {
    var c = one(S.me.campagne) || {};
    root.innerHTML =
      '<header class="top"><div class="top-in"><div><h1>' + esc(c.nome) + '</h1><div class="who">' +
      (isMaster() ? "Master" : esc(S.me.nome)) + "</div></div>" +
      '<div class="tools">' +
      (isMaster() ? '<span>Codice invito <code>' + esc(c.codice_invito) + "</code></span>" : "") +
      '<button id="btnUnita" data-act="unita">' + labelUnita() + '</button><button data-act="cambia">Cambia campagna</button><button data-act="esci">Esci</button></div></div>' +
      '<nav class="tabs" id="tabs" aria-label="Sezioni"></nav></header>' +
      '<main class="wrap" id="main"><p class="boot">Caricamento…</p></main>';
    S.tab = isMaster() ? "libreria" : "inventario";
    caricaDati().then(function () {
      disegnaTab();
      S.timer = setInterval(aggiorna, 20000);
    });
  }

  function tabsDef() {
    if (isMaster()) return [["libreria", "Libreria"], ["personaggi", "Personaggi"], ["storico", "Storico"]];
    var n = S.notif.filter(function (x) { return !x.letta; }).length;
    return [["inventario", "Inventario"], ["notifiche", "Notifiche" + (n && S.tab !== "notifiche" ? ' <span class="badge-n">' + n + "</span>" : "")]];
  }

  function caricaDati() {
    var c = campId();
    var q = [];
    if (isMaster()) {
      q.push(sb.from("oggetti").select(OGG_SEL).eq("campagna_id", c).eq("archiviato", false).order("nome"));
      q.push(sb.from("giocatori").select("id, nome, ruolo").eq("campagna_id", c).order("nome"));
      q.push(sb.from("png").select("*").eq("campagna_id", c).order("nome"));
      q.push(sb.from("inventari").select("*, oggetti(" + OGG_SEL + ")").eq("campagna_id", c));
      q.push(sb.from("trasferimenti").select("*, oggetti(nome)").eq("campagna_id", c).order("id", { ascending: false }).limit(150));
    } else {
      q.push(sb.from("giocatori").select("id, nome, ruolo").eq("campagna_id", c).order("nome"));
      q.push(sb.from("inventari").select("*, oggetti(" + OGG_SEL + ")").eq("campagna_id", c).eq("giocatore_id", S.me.id));
      q.push(sb.from("notifiche").select("*").eq("giocatore_id", S.me.id).order("id", { ascending: false }).limit(100));
    }
    return Promise.all(q).then(function (rs) {
      for (var i = 0; i < rs.length; i++) if (rs[i].error) throw rs[i].error;
      if (isMaster()) {
        S.ogg = rs[0].data; S.gioc = rs[1].data; S.png = rs[2].data; S.inv = rs[3].data; S.trasf = rs[4].data;
      } else {
        S.gioc = rs[0].data; S.inv = rs[1].data; S.notif = rs[2].data;
      }
    }).catch(function (e) { toast(errText(e), true); });
  }

  function aggiorna() {
    if (!S.me || document.querySelector("dialog[open]")) return;
    var a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && $("#main").contains(a)) return;
    caricaDati().then(disegnaTab);
  }

  function disegnaTab() {
    var main = $("#main");
    if (!main) return;
    if (S.tab === "notifiche") segnaLette();
    $("#tabs").innerHTML = tabsDef().map(function (t) {
      return '<button data-act="tab" data-tab="' + t[0] + '" aria-current="' + (S.tab === t[0]) + '">' + t[1] + "</button>";
    }).join("");
    var h = { libreria: htmlLibreria, personaggi: htmlPersonaggi, storico: htmlStorico, inventario: htmlInventario, notifiche: htmlNotifiche }[S.tab];
    main.innerHTML = h();
    var fq = $("#fq"), fc = $("#fcat");
    if (fq) fq.addEventListener("input", function () { S.filtro.q = fq.value; $("#lista").innerHTML = htmlListaLibreria(); });
    if (fc) fc.addEventListener("change", function () { S.filtro.cat = fc.value; $("#lista").innerHTML = htmlListaLibreria(); });
  }

  function segnaLette() {
    var nuove = S.notif.filter(function (n) { return !n.letta; });
    if (!nuove.length) return;
    nuove.forEach(function (n) { S.nuove[n.id] = true; n.letta = true; });
    call("segna_lette", { p_camp: campId() }).catch(function () {});
  }

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
      if (ar.categoria_armatura === "scudo") d.push("+" + ar.ca_base + " alla CA");
      else d.push("CA " + ar.ca_base + (ar.usa_destrezza ? (ar.max_destrezza != null ? " + Des (max " + ar.max_destrezza + ")" : " + Des") : ""));
      if (ar.forza_minima) d.push("Forza " + ar.forza_minima);
      if (ar.svantaggio_furtivita) d.push("svantaggio in Furtività");
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
    if (o.peso != null) meta.push(fmtPeso(o.peso));
    if (o.valore != null) meta.push(o.valore + " " + o.valuta);
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
      "<h3>" + esc(o.nome) +
      (opt.qta > 1 ? ' <span class="qta">×' + opt.qta + "</span>" : "") +
      ' <span class="cat">' + esc(CAT[o.categoria].singolare) + "</span>" +
      (opt.equip ? ' <span class="on">Equipaggiato</span>' : "") + "</h3>" +
      '<div class="stats">' + dettagli(o).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" +
      (meta.length ? '<div class="meta">' + meta.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" : "") +
      (o.effetto_condizionale ? '<p class="cond">' + esc(o.effetto_condizionale) + "</p>" : "") +
      (o.descrizione && !opt.compact ? '<p class="desc">' + esc(o.descrizione) + "</p>" : "") +
      segHtml +
      (opt.azioni ? '<div class="row">' + opt.azioni + "</div>" : "") +
      "</div></article>";
  }

  // ---------------------------------------------------------------- libreria (master)
  function htmlLibreria() {
    return '<div class="toolbar"><input type="search" id="fq" placeholder="Cerca per nome" aria-label="Cerca per nome" value="' + esc(S.filtro.q) + '">' +
      '<select id="fcat" aria-label="Filtra per categoria"><option value="">Tutte le categorie</option>' +
      CATS.map(function (c) { return '<option value="' + c.id + '"' + (S.filtro.cat === c.id ? " selected" : "") + ">" + c.plurale + "</option>"; }).join("") +
      '</select><button class="primary" data-act="nuovo">Nuovo oggetto</button></div><div id="lista">' + htmlListaLibreria() + "</div>";
  }
  function htmlListaLibreria() {
    if (!S.ogg.length) {
      return '<div class="empty"><p>La libreria è vuota. Crea il primo oggetto, oppure parti da qualche esempio (compresa un’arma con effetto di giorno, come FrangiAlba).</p>' +
        '<div class="row"><button class="primary" data-act="nuovo">Nuovo oggetto</button><button data-act="esempi">Carica oggetti di esempio</button></div></div>';
    }
    var q = S.filtro.q.trim().toLowerCase();
    var l = S.ogg.filter(function (o) {
      return (!S.filtro.cat || o.categoria === S.filtro.cat) && (!q || o.nome.toLowerCase().indexOf(q) >= 0);
    });
    if (!l.length) return '<div class="empty">Nessun oggetto corrisponde alla ricerca.</div>';
    return l.map(function (o) {
      return rigaOggetto(o, {
        azioni: '<button class="primary small" data-act="assegna" data-ogg="' + o.id + '">Assegna</button>' +
          '<button class="small" data-act="modifica" data-ogg="' + o.id + '">Modifica</button>' +
          '<button class="small danger" data-act="elimina" data-ogg="' + o.id + '">Elimina</button>'
      });
    }).join("");
  }

  // ---------------------------------------------------------------- personaggi (master)
  function holders() {
    var g = S.gioc.filter(function (x) { return x.ruolo === "giocatore"; }).map(function (x) { return { key: "g:" + x.id, nome: x.nome, tipo: "Giocatore" }; });
    var p = S.png.map(function (x) { return { key: "p:" + x.id, nome: x.nome, tipo: "PNG" }; });
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
    out += hs.map(function (h) {
      var inv = invDi(h.key);
      return '<section class="holder"><header><h2>' + esc(h.nome) + '</h2><span class="tag">' + h.tipo + "</span></header>" +
        (inv.length ? inv.map(function (i) {
          return rigaOggetto(i.oggetti, {
            qta: i.quantita, equip: i.equipaggiato, compact: true,
            azioni: '<button class="small" data-act="sposta" data-inv="' + i.id + '" data-key="' + h.key + '">Sposta</button>' +
              '<button class="small danger" data-act="togli" data-inv="' + i.id + '" data-key="' + h.key + '">Togli</button>'
          });
        }).join("") : '<p class="muted" style="margin-top:.6rem">Inventario vuoto. Assegna un oggetto dalla libreria.</p>') + "</section>";
    }).join("");
    out += '<form data-form="png" class="row" style="align-items:end;margin-top:1rem"><label class="f" style="margin:0;flex:1 1 220px"><span>Nuovo PNG (mercante, locandiere, forziere…)</span><input name="nome" type="text" required></label><button class="primary" type="submit">Aggiungi PNG</button></form>';
    return out;
  }

  // ---------------------------------------------------------------- storico (master)
  function nomeParte(g, p) {
    if (g) { var x = S.gioc.filter(function (z) { return z.id === g; })[0]; return x ? x.nome : "giocatore"; }
    if (p) { var y = S.png.filter(function (z) { return z.id === p; })[0]; return y ? y.nome : "PNG"; }
    return "nessuno";
  }
  function htmlStorico() {
    if (!S.trasf.length) return '<div class="empty">Ancora nessun movimento. Ogni assegnazione e ogni passaggio di mano comparirà qui.</div>';
    var annullati = {};
    S.trasf.forEach(function (t) { if (t.annulla_id) annullati[t.annulla_id] = true; });
    return '<p class="hint">Lo storico non si modifica: se c’è un errore, annulla il movimento e se ne crea uno di correzione.</p>' +
      S.trasf.map(function (t) {
        var ann = !!annullati[t.id];
        var nome = (one(t.oggetti) || {}).nome || "oggetto";
        return '<div class="mov' + (ann ? " annull" : "") + '"><div><span class="tipo">' + TIPO_MOV[t.tipo] + "</span>: " +
          (t.quantita > 1 ? t.quantita + "× " : "") + "<strong>" + esc(nome) + "</strong>, da " +
          esc(nomeParte(t.da_giocatore_id, t.da_png_id)) + " a " + esc(nomeParte(t.a_giocatore_id, t.a_png_id)) +
          (ann ? " (annullato)" : "") + "<br><time>" + fmtData(t.created_at) + "</time></div>" +
          (t.tipo !== "annullamento" && !ann ? '<button class="small" data-act="annulla" data-id="' + t.id + '">Annulla</button>' : "") + "</div>";
      }).join("");
  }

  // ---------------------------------------------------------------- inventario (giocatore)
  function htmlInventario() {
    if (!S.inv.length) return '<div class="empty">Il tuo inventario è vuoto. Quando il master ti assegna qualcosa, lo trovi qui.</div>';
    var peso = S.inv.reduce(function (s, i) { return s + (Number(i.oggetti.peso) || 0) * i.quantita; }, 0);
    var out = '<p class="hint">Peso trasportato: ' + fmtPeso(peso) + "</p>";
    CATS.forEach(function (c) {
      var l = S.inv.filter(function (i) { return i.oggetti.categoria === c.id; })
        .sort(function (a, b) { return a.oggetti.nome.localeCompare(b.oggetti.nome, "it"); });
      if (!l.length) return;
      out += '<h2 class="sec">' + c.plurale + "</h2>" + l.map(function (i) {
        var eq = c.id !== "cibo"
          ? '<button class="small" data-act="equip" data-inv="' + i.id + '" data-v="' + (i.equipaggiato ? "0" : "1") + '">' + (i.equipaggiato ? "Rimetti nello zaino" : "Equipaggia") + "</button>" : "";
        return rigaOggetto(i.oggetti, {
          qta: i.quantita, equip: i.equipaggiato,
          azioni: eq + '<button class="small" data-act="dai" data-inv="' + i.id + '">Dai a un compagno</button>'
        });
      }).join("");
    });
    return out;
  }

  function htmlNotifiche() {
    if (!S.notif.length) return '<div class="empty">Nessuna notifica. Qui compaiono gli oggetti che ricevi o che dai.</div>';
    return S.notif.map(function (n) {
      return '<div class="notif' + (S.nuove[n.id] ? " nuova" : "") + '">' + esc(n.testo) + "<time>" + fmtData(n.created_at) + "</time></div>";
    }).join("");
  }

  // ---------------------------------------------------------------- finestre
  function modal(titolo, corpo, onSubmit, okLabel) {
    var d = $("#dlg");
    d.innerHTML = '<form id="dlgForm" class="dlgform"><h2>' + esc(titolo) + "</h2>" + corpo +
      '<div class="dlgbar"><button type="button" class="ghost" data-close>Annulla</button><button class="primary" type="submit">' + esc(okLabel || "Salva") + "</button></div></form>";
    var f = $("#dlgForm", d);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var b = f.querySelector("button[type=submit]");
      b.disabled = true;
      Promise.resolve(onSubmit(new FormData(f), f)).then(function (ok) {
        if (ok === false) b.disabled = false; else d.close();
      });
    });
    $("[data-close]", d).addEventListener("click", function () { d.close(); });
    if (!d.open) d.showModal();
    return f;
  }

  function fld(name, label, val, extra, type) {
    return '<label class="f"><span>' + esc(label) + '</span><input type="' + (type || "text") + '" name="' + name + '" value="' + esc(val == null ? "" : val) + '" ' + (extra || "") + "></label>";
  }
  function area(name, label, val) {
    return '<label class="f"><span>' + esc(label) + '</span><textarea name="' + name + '">' + esc(val || "") + "</textarea></label>";
  }
  function chk(name, label, on) {
    return '<label class="c"><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + "><span>" + esc(label) + "</span></label>";
  }
  function sel(name, label, opts, val) {
    return '<label class="f"><span>' + esc(label) + '</span><select name="' + name + '">' +
      opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>";
  }

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
        sel("categoria_armatura", "Tipo", [["leggera", "Leggera"], ["media", "Media"], ["pesante", "Pesante"], ["scudo", "Scudo"]], ar.categoria_armatura || "leggera") +
        fld("ca_base", "CA (per lo scudo: il bonus)", ar.ca_base, 'min="0" required', "number") + "</div>" +
        chk("usa_destrezza", "Si somma il modificatore di Destrezza", ar.usa_destrezza) +
        '<div class="cols">' + fld("max_destrezza", "Tetto al modificatore Des", ar.max_destrezza, 'min="0"', "number") +
        fld("forza_minima", "Forza minima", ar.forza_minima, 'min="1"', "number") +
        fld("tempo_indossare", "Minuti per indossarla", ar.tempo_indossare, 'min="0"', "number") +
        fld("tempo_togliere", "Minuti per toglierla", ar.tempo_togliere, 'min="0"', "number") + "</div>" +
        chk("svantaggio_furtivita", "Svantaggio alle prove di Furtività", ar.svantaggio_furtivita) +
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
      area("descrizione", "Descrizione", o && o.descrizione) +
      '<div id="catcampi">' + campiCategoria(cat, o) + "</div>" +
      '<div class="cols">' + fld("peso", "Peso (" + pesoUnit() + ")", (o && o.peso != null) ? pesoShow(o.peso) : null, 'min="0" step="any"', "number") +
      fld("valore", "Valore", o && o.valore, 'min="0"', "number") +
      sel("valuta", "Valuta", VALUTE, (o && o.valuta) || "mo") + "</div>" +
      chk("impilabile", "Si impila (cibo, munizioni, pozioni)", o ? o.impilabile : false) +
      fld("bonus", "Bonus quando è equipaggiato (testo libero, es. +1 alla CA)", o && o.bonus) +
      fld("effetto_condizionale", "Effetto condizionale (es. Di giorno: +2 danni radianti)", o && o.effetto_condizionale) +
      area("segreto", "Proprietà nascosta: la vede solo il master finché non la riveli", seg && seg.testo);

    var f = modal(edit ? "Modifica oggetto" : "Nuovo oggetto", corpo, function (fd) {
      var p = payload(fd, cat, o && o.id);
      return run(function () { return call("salva_oggetto", { p: p }); }, edit ? "Oggetto aggiornato" : "Oggetto creato")
        .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
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
        requisiti: g("requisiti")
      };
    } else if (cat === "cibo") {
      d = { effetto: g("effetto"), razioni: n("razioni"), deperibile_giorni: n("deperibile_giorni") };
    } else {
      d = { effetto: g("effetto"), utilizzi: n("utilizzi"), requisiti: g("requisiti"), di_trama: b("di_trama") };
    }
    return {
      campagna_id: campId(), id: id || null, nome: g("nome"), categoria: cat, descrizione: g("descrizione"),
      peso: pesoKg(n("peso")), valore: n("valore"), valuta: g("valuta") || "mo", impilabile: b("impilabile"),
      bonus: g("bonus"), effetto_condizionale: g("effetto_condizionale"), segreto: g("segreto"), dettagli: d
    };
  }

  function optsDest(escludi) {
    var gs = S.gioc.filter(function (g) { return g.ruolo === "giocatore" && "g:" + g.id !== escludi; });
    var ps = S.png.filter(function (p) { return "p:" + p.id !== escludi; });
    return (gs.length ? '<optgroup label="Giocatori">' + gs.map(function (g) { return '<option value="g:' + g.id + '">' + esc(g.nome) + "</option>"; }).join("") + "</optgroup>" : "") +
      (ps.length ? '<optgroup label="PNG">' + ps.map(function (p) { return '<option value="p:' + p.id + '">' + esc(p.nome) + "</option>"; }).join("") + "</optgroup>" : "");
  }
  function parteDa(key) {
    var t = key.split(":"), id = Number(t[1]);
    return t[0] === "g" ? { g: id, p: null } : { g: null, p: id };
  }
  function campoQta(max, impilabile) {
    return '<label class="f"><span>Quantità' + (max > 1 ? " (al massimo " + max + ")" : "") + '</span><input type="number" name="qta" min="1" max="' + max + '" value="1" required' + (impilabile ? "" : " readonly") + "></label>" +
      (impilabile ? "" : '<p class="hint">Questo oggetto non si impila: si sposta uno alla volta.</p>');
  }
  function invPerId(id) { return S.inv.filter(function (i) { return String(i.id) === String(id); })[0]; }
  function oggPerId(id) { return S.ogg.filter(function (o) { return String(o.id) === String(id); })[0]; }

  // ---------------------------------------------------------------- azioni
  var ACT = {
    "auth-mode": function (b) { viewAuth(b.dataset.mode); },
    esci: function () { clearInterval(S.timer); sb.auth.signOut(); },
    cambia: function () { clearInterval(S.timer); S.me = null; route(); },
    entra: function (b) {
      var m = (S.mems || []).filter(function (x) { return String(x.id) === b.dataset.id; })[0];
      if (m) { S.me = m; S.filtro = { cat: "", q: "" }; S.nuove = {}; route(); }
    },
    unita: function () {
      U.sys = imp() ? "metric" : "imperial";
      try { localStorage.setItem("gdr_unita", U.sys); } catch (e) {}
      var b = $("#btnUnita"); if (b) b.textContent = labelUnita();
      disegnaTab();
    },
    tab: function (b) { S.tab = b.dataset.tab; disegnaTab(); },

    nuovo: function () { editor(null); },
    modifica: function (b) { var o = oggPerId(b.dataset.ogg); if (o) editor(o); },
    esempi: function () {
      run(function () { return call("carica_esempi", { p_camp: campId() }); }, "Esempi caricati")
        .then(function (r) { if (r) caricaDati().then(disegnaTab); });
    },
    elimina: function (b) {
      var o = oggPerId(b.dataset.ogg); if (!o) return;
      modal("Eliminare “" + o.nome + "”?", "<p>Se l’oggetto è già comparso nello storico non viene cancellato ma archiviato: sparisce dalla libreria, e lo storico resta intatto.</p>", function () {
        return run(function () { return call("elimina_oggetto", { p_id: o.id }); }).then(function (r) {
          if (!r) return false;
          toast(r.v === "archiviato" ? "Oggetto archiviato" : "Oggetto eliminato");
          return caricaDati().then(disegnaTab);
        });
      }, "Elimina");
    },
    rivela: function (b) {
      run(function () { return call("rivela_segreto", { p_ogg: Number(b.dataset.ogg), p_rivela: b.dataset.v === "1" }); },
        b.dataset.v === "1" ? "Proprietà rivelata ai giocatori che hanno l’oggetto" : "Proprietà di nuovo nascosta")
        .then(function (r) { if (r) caricaDati().then(disegnaTab); });
    },
    assegna: function (b) {
      var o = oggPerId(b.dataset.ogg); if (!o) return;
      var opts = optsDest("");
      if (!opts) { toast("Non c’è nessun destinatario: invita un giocatore o crea un PNG.", true); return; }
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
      var opts = optsDest(b.dataset.key);
      if (!opts) { toast("Non c’è nessun altro destinatario.", true); return; }
      modal("Sposta “" + i.oggetti.nome + "”",
        '<label class="f"><span>A chi</span><select name="dest">' + opts + "</select></label>" + campoQta(i.quantita, i.oggetti.impilabile),
        function (fd) {
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
      run(function () { return call("equipaggia", { p_inv: Number(b.dataset.inv), p_eq: b.dataset.v === "1" }); })
        .then(function (r) { if (r) caricaDati().then(disegnaTab); });
    },
    dai: function (b) {
      var i = invPerId(b.dataset.inv); if (!i) return;
      var altri = S.gioc.filter(function (g) { return g.ruolo === "giocatore" && g.id !== S.me.id; });
      if (!altri.length) { toast("Non ci sono altri giocatori nella campagna.", true); return; }
      modal("Dai “" + i.oggetti.nome + "”",
        '<label class="f"><span>A chi</span><select name="dest">' + altri.map(function (g) { return '<option value="' + g.id + '">' + esc(g.nome) + "</option>"; }).join("") + "</select></label>" +
        campoQta(i.quantita, i.oggetti.impilabile),
        function (fd) {
          return run(function () {
            return call("trasferisci", { p_camp: campId(), p_ogg: i.oggetto_id, p_qta: Number(fd.get("qta")), da_g: S.me.id, da_p: null, a_g: Number(fd.get("dest")), a_p: null });
          }, "Oggetto consegnato").then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
        }, "Dai");
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
      }, "PNG aggiunto").then(function (r) { if (r) caricaDati().then(disegnaTab); });
    }
  };

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b);
  });
  document.addEventListener("submit", function (e) {
    var f = e.target.closest("form[data-form]");
    if (f && FORMS[f.dataset.form]) { e.preventDefault(); FORMS[f.dataset.form](f); }
  });

  boot();
})();
