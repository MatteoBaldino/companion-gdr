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
  var ARMAT = { leggera: "Armatura leggera", media: "Armatura media", pesante: "Armatura pesante", scudo: "Scudo",
    accessorio: "Elmo o protezione", bardatura: "Barda (cavalcatura)" };
  var TIPO_MOV = { assegnazione: "Assegnazione", trasferimento: "Passaggio", rimozione: "Rimozione", annullamento: "Annullamento" };
  // [REGOLA] Le monete sono i Drakos: ogni prezzo è salvato in rame. 1 Ar = 100 Ra, 1 Or = 100 Ar, 1 Pt = 100 Or.
  var MONETE = [["pt", "Pt", 1000000], ["or", "Or", 10000], ["ar", "Ar", 100], ["ra", "Ra", 1]];
  // 350 -> "3 Ar 50 Ra"
  function fmtRame(n) {
    if (n == null) return "";
    if (Number(n) === 0) return "0 Ra";
    var resto = Number(n), out = [];
    MONETE.forEach(function (m) {
      var q = Math.floor(resto / m[2]);
      if (q) { out.push(q + " " + m[1]); resto -= q * m[2]; }
    });
    return out.join(" ");
  }
  // 350 -> { pt: 0, or: 0, ar: 3, ra: 50 } (per i campi del modulo)
  function dividiRame(n) {
    var r = { pt: "", or: "", ar: "", ra: "" };
    if (n == null) return r;
    var resto = Number(n);
    MONETE.forEach(function (m) { var q = Math.floor(resto / m[2]); r[m[0]] = q || ""; resto -= q * m[2]; });
    if (Number(n) === 0) r.ra = 0;
    return r;
  }
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
    ogg: [], oggOk: false, serv: [], pngAll: [], gioc: [], png: [], inv: [], notif: [], trasf: [], sch: [], inc: [], si: [], incOk: false, schedaAperta: null,
    filtro: { cat: "", q: "", tip: "", n: 100, qs: "" }, nuove: {}, timer: null
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
    S.tab = isMaster() ? "libreria" : "scheda";
    S.oggOk = false;                       // cambiando campagna gli oggetti si rileggono da capo
    caricaDati().then(function () {
      disegnaTab();
      S.timer = setInterval(aggiorna, 20000);
    });
  }

  function tabsDef() {
    if (isMaster()) return [["libreria", "Libreria"], ["personaggi", "Personaggi"], ["schede", "Schede"], ["incantesimi", "Incantesimi"], ["storico", "Storico"], ["listino", "Listino prezzi"]];
    var n = S.notif.filter(function (x) { return !x.letta; }).length;
    return [["scheda", "Scheda"], ["inventario", "Inventario"], ["listino", "Listino prezzi"], ["notifiche", "Notifiche" + (n && S.tab !== "notifiche" ? ' <span class="badge-n">' + n + "</span>" : "")]];
  }

  // [ATTENZIONE] Supabase restituisce al massimo 1000 righe per richiesta: gli oggetti si leggono a pagine da 500.
  function tuttiOggetti(c) {
    var tot = [], PAG = 500;
    function pagina(da) {
      return sb.from("oggetti").select(OGG_SEL).eq("campagna_id", c).eq("archiviato", false)
        .order("nome").order("id").range(da, da + PAG - 1).then(function (r) {
          if (r.error) return { data: null, error: r.error };
          tot = tot.concat(r.data || []);
          return (r.data || []).length < PAG ? { data: tot, error: null } : pagina(da + PAG);
        });
    }
    return pagina(0);
  }

  // ricaricaOggetti: vero dopo aver creato, modificato o eliminato oggetti.
  // Il controllo automatico ogni 20 secondi NON rilegge la libreria (con 1000 oggetti pesa circa 1,5 MB):
  // la rilegge solo la prima volta e quando serve.
  function caricaDati(ricaricaOggetti) {
    var c = campId();
    var q = [];
    if (isMaster()) {
      q.push((ricaricaOggetti || !S.oggOk) ? tuttiOggetti(c) : Promise.resolve({ data: S.ogg, error: null }));
      q.push(sb.from("giocatori").select("id, nome, ruolo").eq("campagna_id", c).order("nome"));
      q.push(sb.from("png").select("*").eq("campagna_id", c).order("nome"));
      q.push(sb.from("inventari").select("*, oggetti(" + OGG_SEL + ")").eq("campagna_id", c));
      q.push(sb.from("trasferimenti").select("*, oggetti(nome)").eq("campagna_id", c).order("id", { ascending: false }).limit(150));
      q.push(sb.from("schede").select("*").eq("campagna_id", c));
      q.push(sb.from("incantesimi").select("*").eq("campagna_id", c));
      q.push(sb.from("scheda_incantesimi").select("*"));
    } else {
      q.push(sb.from("giocatori").select("id, nome, ruolo").eq("campagna_id", c).order("nome"));
      q.push(sb.from("inventari").select("*, oggetti(" + OGG_SEL + ")").eq("campagna_id", c).eq("giocatore_id", S.me.id));
      q.push(sb.from("notifiche").select("*").eq("giocatore_id", S.me.id).order("id", { ascending: false }).limit(100));
      q.push(sb.from("schede").select("*").eq("campagna_id", c));
      q.push(sb.from("incantesimi").select("*").eq("campagna_id", c));
      q.push(sb.from("scheda_incantesimi").select("*"));
    }
    // Listino dei servizi: lo leggono tutti i membri (se l'aggiornamento SQL manca, la lista resta vuota)
    var qs = sb.from("servizi").select("*").eq("campagna_id", c).order("tipologia").order("nome").limit(300);
    return Promise.all([Promise.all(q), qs]).then(function (tot) {
      var rs = tot[0];
      S.serv = tot[1].error ? [] : (tot[1].data || []);
      for (var i = 0; i < rs.length - 2; i++) if (rs[i].error) throw rs[i].error;
      var ie = rs[rs.length - 2], se = rs[rs.length - 1];
      S.incOk = !ie.error && !se.error;
      S.inc = S.incOk ? (ie.data || []) : [];
      S.si = S.incOk ? (se.data || []) : [];
      if (isMaster()) {
        S.ogg = rs[0].data; S.oggOk = true; S.gioc = rs[1].data; S.pngAll = rs[2].data || []; S.png = S.pngAll.filter(function (p) { return !p.archiviato; }); S.inv = rs[3].data; S.trasf = rs[4].data; S.sch = rs[5].data || [];
      } else {
        S.gioc = rs[0].data; S.inv = rs[1].data; S.notif = rs[2].data; S.sch = rs[3].data || [];
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
    var h = { libreria: htmlLibreria, personaggi: htmlPersonaggi, schede: htmlSchede, incantesimi: htmlLibInc, storico: htmlStorico, listino: htmlListino,
      scheda: function () { return htmlScheda("g:" + S.me.id, false); }, inventario: htmlInventario, notifiche: htmlNotifiche }[S.tab];
    main.innerHTML = h();
    bindLibInc();
    var fq = $("#fq"), fc = $("#fcat"), ft = $("#ftip"), fs = $("#fqs");
    if (fq) fq.addEventListener("input", function () { S.filtro.q = fq.value; S.filtro.n = 100; $("#lista").innerHTML = htmlListaLibreria(); });
    // Cambiando categoria cambiano anche le tipologie tra cui scegliere: si ridisegna tutta la pagina.
    if (fc) fc.addEventListener("change", function () { S.filtro.cat = fc.value; S.filtro.tip = ""; S.filtro.n = 100; disegnaTab(); });
    if (ft) ft.addEventListener("change", function () { S.filtro.tip = ft.value; S.filtro.n = 100; $("#lista").innerHTML = htmlListaLibreria(); });
    if (fs) fs.addEventListener("input", function () { S.filtro.qs = fs.value; $("#listaServ").innerHTML = htmlListaServizi(); });
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

  // ---------------------------------------------------------------- libreria (master)
  function tipologieDi(cat) {
    var m = {};
    S.ogg.forEach(function (o) { if ((!cat || o.categoria === cat) && o.tipologia) m[o.tipologia] = 1; });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, "it"); });
  }
  function htmlLibreria() {
    var tips = tipologieDi(S.filtro.cat);
    return '<div class="toolbar"><input type="search" id="fq" placeholder="Cerca per nome" aria-label="Cerca per nome" value="' + esc(S.filtro.q) + '">' +
      '<select id="fcat" aria-label="Filtra per categoria"><option value="">Tutte le categorie</option>' +
      CATS.map(function (c) { return '<option value="' + c.id + '"' + (S.filtro.cat === c.id ? " selected" : "") + ">" + c.plurale + "</option>"; }).join("") + "</select>" +
      (tips.length ? '<select id="ftip" aria-label="Filtra per tipologia"><option value="">Tutte le tipologie</option>' +
        tips.map(function (t) { return '<option value="' + esc(t) + '"' + (S.filtro.tip === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>" : "") +
      '<button class="primary" data-act="nuovo">Nuovo oggetto</button><a class="btn" href="importa.html">Importa da Excel</a></div>' +
      '<div id="lista">' + htmlListaLibreria() + "</div>";
  }
  function htmlListaLibreria() {
    if (!S.ogg.length) {
      return '<div class="empty"><p>La libreria è vuota. Crea il primo oggetto, oppure importa i tuoi listini Excel.</p>' +
        '<div class="row"><button class="primary" data-act="nuovo">Nuovo oggetto</button><a class="btn" href="importa.html">Importa da Excel</a></div></div>';
    }
    var q = S.filtro.q.trim().toLowerCase();
    var l = S.ogg.filter(function (o) {
      return (!S.filtro.cat || o.categoria === S.filtro.cat) && (!S.filtro.tip || o.tipologia === S.filtro.tip) &&
        (!q || (o.nome + " " + (o.nome_en || "") + " " + (o.tipologia || "")).toLowerCase().indexOf(q) >= 0);
    });
    if (!l.length) return '<div class="empty">Nessun oggetto corrisponde alla ricerca.</div>';
    // [MODIFICA QUI] Si mostrano 100 oggetti alla volta: con più di mille voci la pagina sarebbe lentissima.
    var mostrati = l.slice(0, S.filtro.n);
    return '<p class="hint">' + (mostrati.length < l.length ? "Mostro " + mostrati.length + " di " + l.length + " oggetti." : l.length + (l.length === 1 ? " oggetto." : " oggetti.")) + "</p>" +
      mostrati.map(function (o) {
        return rigaOggetto(o, {
          azioni: '<button class="primary small" data-act="assegna" data-ogg="' + o.id + '">Assegna</button>' +
            '<button class="small" data-act="modifica" data-ogg="' + o.id + '">Modifica</button>' +
            '<button class="small danger" data-act="elimina" data-ogg="' + o.id + '">Elimina</button>'
        });
      }).join("") +
      (mostrati.length < l.length ? '<p class="altri"><button data-act="altri">Mostra altri 100</button></p>' : "");
  }

  // ---------------------------------------------------------------- listino prezzi (taverne, alloggi, viaggi, svaghi)
  function htmlListino() {
    if (!S.serv.length) {
      return '<div class="empty"><p>Il listino dei servizi è vuoto.</p>' +
        (isMaster() ? '<div class="row"><a class="btn" href="importa.html">Importa da Excel</a></div>' : "") + "</div>";
    }
    return '<div class="toolbar"><input type="search" id="fqs" placeholder="Cerca un servizio" aria-label="Cerca un servizio" value="' + esc(S.filtro.qs) + '"></div>' +
      '<div id="listaServ">' + htmlListaServizi() + "</div>";
  }
  function htmlListaServizi() {
    var q = S.filtro.qs.trim().toLowerCase(), gr = {}, ord = [];
    S.serv.forEach(function (v) {
      if (q && (v.nome + " " + (v.nome_en || "") + " " + (v.tipologia || "")).toLowerCase().indexOf(q) < 0) return;
      var k = v.tipologia || "Altro";
      if (!gr[k]) { gr[k] = []; ord.push(k); }
      gr[k].push(v);
    });
    if (!ord.length) return '<div class="empty">Nessun servizio corrisponde alla ricerca.</div>';
    return ord.map(function (k) {
      return '<h2 class="sec">' + esc(k) + "</h2>" + gr[k].map(function (v) {
        return '<article class="item compact cat-vario"><div><h3>' + esc(v.nome) +
          (v.nome_en ? ' <span class="en">' + esc(v.nome_en) + "</span>" : "") +
          ' <span class="qta">' + esc(fmtRame(v.costo_rame)) + "</span>" +
          (v.unita ? ' <span class="cat">' + esc(v.unita) + "</span>" : "") + "</h3>" +
          (v.descrizione ? '<p class="desc">' + esc(v.descrizione) + "</p>" : "") + "</div></article>";
      }).join("");
    }).join("");
  }

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

  // ---------------------------------------------------------------- storico (master)
  function nomeParte(g, p) {
    if (g) { var x = S.gioc.filter(function (z) { return z.id === g; })[0]; return x ? x.nome : "giocatore"; }
    if (p) { var y = S.pngAll.filter(function (z) { return z.id === p; })[0]; return y ? y.nome : "NPC"; }
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

  function optsDest(escludi) {
    var gs = S.gioc.filter(function (g) { return g.ruolo === "giocatore" && "g:" + g.id !== escludi; });
    var ps = S.png.filter(function (p) { return "p:" + p.id !== escludi; });
    return (gs.length ? '<optgroup label="PG">' + gs.map(function (g) { return '<option value="g:' + g.id + '">' + esc(g.nome) + "</option>"; }).join("") + "</optgroup>" : "") +
      (ps.length ? '<optgroup label="NPC">' + ps.map(function (p) { return '<option value="p:' + p.id + '">' + esc(p.nome) + "</option>"; }).join("") + "</optgroup>" : "");
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
      }, "NPC aggiunto").then(function (r) { if (r) caricaDati().then(disegnaTab); });
    }
  };


  // ================================================================ SCHEDE PERSONAGGIO
  var ABIL = [
    ["for", "Forza", "FOR", "forza"], ["des", "Destrezza", "DES", "destrezza"], ["cos", "Costituzione", "COS", "costituzione"],
    ["int", "Intelligenza", "INT", "intelligenza"], ["sag", "Saggezza", "SAG", "saggezza"], ["car", "Carisma", "CAR", "carisma"]
  ];
  var SKILLS = [
    ["acrobazia", "Acrobazia", "des"], ["addestrare_animali", "Addestrare Animali", "sag"], ["arcano", "Arcano", "int"],
    ["atletica", "Atletica", "for"], ["furtivita", "Furtività", "des"], ["indagare", "Indagare", "int"],
    ["inganno", "Inganno", "car"], ["intimidire", "Intimidire", "car"], ["intrattenere", "Intrattenere", "car"],
    ["intuizione", "Intuizione", "sag"], ["medicina", "Medicina", "sag"], ["natura", "Natura", "int"],
    ["percezione", "Percezione", "sag"], ["persuasione", "Persuasione", "car"], ["rapidita_di_mano", "Rapidità di mano", "des"],
    ["religione", "Religione", "int"], ["sopravvivenza", "Sopravvivenza", "sag"], ["storia", "Storia", "int"]
  ];
  var SKILL = {}; SKILLS.forEach(function (k) { SKILL[k[0]] = k; });
  var ABK = {}; ABIL.forEach(function (a) { ABK[a[0]] = a; });
  // Dati delle dodici classi del manuale base (dado vita, tiri salvezza, abilità tra cui scegliere).
  // Sono solo suggerimenti per la creazione guidata: controllali sul tuo manuale, tutto è modificabile.
  var CLASSI = {
    barbaro: { n: "Barbaro", dado: 12, ts: ["for", "cos"], sc: 2, ab: ["addestrare_animali", "atletica", "intimidire", "natura", "percezione", "sopravvivenza"] },
    bardo: { n: "Bardo", dado: 8, ts: ["des", "car"], sc: 3, ab: null },
    chierico: { n: "Chierico", dado: 8, ts: ["sag", "car"], sc: 2, ab: ["intuizione", "medicina", "persuasione", "religione", "storia"] },
    druido: { n: "Druido", dado: 8, ts: ["int", "sag"], sc: 2, ab: ["addestrare_animali", "arcano", "intuizione", "medicina", "natura", "percezione", "religione", "sopravvivenza"] },
    guerriero: { n: "Guerriero", dado: 10, ts: ["for", "cos"], sc: 2, ab: ["acrobazia", "addestrare_animali", "atletica", "intimidire", "intuizione", "percezione", "persuasione", "sopravvivenza", "storia"] },
    monaco: { n: "Monaco", dado: 8, ts: ["for", "des"], sc: 2, ab: ["acrobazia", "atletica", "furtivita", "intuizione", "religione", "storia"] },
    paladino: { n: "Paladino", dado: 10, ts: ["sag", "car"], sc: 2, ab: ["atletica", "intimidire", "intuizione", "medicina", "persuasione", "religione"] },
    ranger: { n: "Ranger", dado: 10, ts: ["for", "des"], sc: 3, ab: ["addestrare_animali", "atletica", "furtivita", "indagare", "intuizione", "natura", "percezione", "sopravvivenza"] },
    ladro: { n: "Ladro", dado: 8, ts: ["des", "int"], sc: 4, ab: ["acrobazia", "atletica", "furtivita", "indagare", "inganno", "intimidire", "intuizione", "percezione", "persuasione", "rapidita_di_mano"] },
    stregone: { n: "Stregone", dado: 6, ts: ["cos", "car"], sc: 2, ab: ["arcano", "inganno", "intimidire", "intuizione", "persuasione", "religione"] },
    warlock: { n: "Warlock", dado: 8, ts: ["sag", "car"], sc: 2, ab: ["arcano", "inganno", "indagare", "intimidire", "natura", "religione", "storia"] },
    mago: { n: "Mago", dado: 6, ts: ["int", "sag"], sc: 2, ab: ["arcano", "indagare", "intuizione", "medicina", "natura", "religione", "storia"] }
  };
  var mod = function (v) { return Math.floor((v - 10) / 2); };
  var sgn = function (n) { return (n >= 0 ? "+" : "−") + Math.abs(n); };
  var bonusComp = function (liv) { return 2 + Math.floor((liv - 1) / 4); };
  var fmtVel = function (m) { return dec(distShow(m)) + " " + distUnit(); };
  function classeInfo(testo) {
    var k = String(testo || "").trim().toLowerCase();
    if (!k) return null;
    for (var id in CLASSI) if (id === k || CLASSI[id].n.toLowerCase() === k) return CLASSI[id];
    return null;
  }
  function schedaDi(key) {
    var t = key.split(":"), id = Number(t[1]);
    return S.sch.filter(function (s) { return t[0] === "g" ? s.giocatore_id === id : s.png_id === id; })[0] || null;
  }
  function schedaPerId(id) { return S.sch.filter(function (s) { return String(s.id) === String(id); })[0] || null; }
  function nomeHolder(key) {
    var t = key.split(":"), id = Number(t[1]);
    var l = t[0] === "g" ? S.gioc : S.png;
    var x = l.filter(function (z) { return z.id === id; })[0];
    return x ? x.nome : "Personaggio";
  }
  function keyDiScheda(s) { return s.giocatore_id ? "g:" + s.giocatore_id : "p:" + s.png_id; }

  // CA: calcolata da armatura e scudo equipaggiati, oppure fissa se impostata a mano.
  // A quale "posto" appartiene un pezzo di armatura. Stesse regole del database (funzione _posto_armatura).
  function postoArm(a) {
    if (a.categoria_armatura === "scudo") return "scudo";
    if (a.categoria_armatura === "bardatura") return "barda";
    if (a.categoria_armatura === "accessorio") return a.gruppo === "arti" ? "arti" : "elmo";
    return "corpo";
  }
  function calcCA(s, key) {
    if (s.ca_manuale != null) return { tot: s.ca_manuale, desc: s.tipo === "semplificata" ? "" : "valore fisso" };
    var des = mod(s.destrezza), arm = null, scudo = null, elmo = null, arti = 0;
    invDi(key).forEach(function (i) {
      if (!i.equipaggiato || i.oggetti.categoria !== "armatura") return;
      var a = one(i.oggetti.armature);
      if (!a) return;
      var p = postoArm(a);
      if (p === "scudo") scudo = scudo || { o: i.oggetti, a: a };
      else if (p === "corpo") arm = arm || { o: i.oggetti, a: a };
      else if (p === "elmo") elmo = elmo || { o: i.oggetti, a: a };
      else if (p === "arti") arti++;
      // La barda ("barda") è della cavalcatura: non conta per chi la monta.
    });
    var tot, parts = [];
    if (arm) {
      var d = arm.a.usa_destrezza ? (arm.a.max_destrezza != null ? Math.min(des, arm.a.max_destrezza) : des) : 0;
      tot = arm.a.ca_base + d;
      parts.push(arm.o.nome + " " + arm.a.ca_base);
      if (arm.a.usa_destrezza) parts.push("Des " + sgn(d));
    } else { tot = 10 + des; parts.push("10", "Des " + sgn(des)); }
    if (scudo) { tot += scudo.a.ca_base; parts.push(scudo.o.nome + " +" + scudo.a.ca_base); }
    // [REGOLA] L'armatura completa include già l'elmo: un elmo separato non aggiunge CA.
    if (elmo) {
      if (arm && arm.a.include_elmo) parts.push(elmo.o.nome + " (già incluso nell’armatura)");
      else { tot += elmo.a.ca_base; parts.push(elmo.o.nome + " +" + elmo.a.ca_base); }
    }
    // [REGOLA] Tre protezioni degli arti indossate insieme (anche di tipo diverso) danno +1 CA in totale.
    if (arti >= 3) { tot += 1; parts.push("protezioni degli arti +1"); }
    if (s.ca_bonus) { tot += s.ca_bonus; parts.push("bonus " + sgn(s.ca_bonus)); }
    return { tot: tot, desc: parts.join(", ") };
  }
  function totaleAbilita(s, k) {
    var lv = (s.abilita || {})[k] || 0;
    return mod(s[ABK[SKILL[k][2]][3]]) + lv * bonusComp(s.livello);
  }
  function riassunto(s, key) {
    var ca = calcCA(s, key).tot;
    if (s.tipo === "semplificata") return "Scheda semplificata" + (s.sfida ? ", grado di sfida " + s.sfida : "") + ", CA " + ca + ", PF " + s.pf_attuali + "/" + s.pf_max;
    return [s.classe, "livello " + s.livello].filter(Boolean).join(" ") + ", CA " + ca + ", PF " + s.pf_attuali + "/" + s.pf_max;
  }

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
      : [s.specie, s.background, [s.classe, s.sottoclasse].filter(Boolean).join(" "), "livello " + s.livello].filter(Boolean).join(", ");
    var tile = function (lbl, val, small) {
      return '<div class="vit"><span class="lbl">' + lbl + "</span><strong>" + val + "</strong>" + (small ? "<small>" + esc(small) + "</small>" : "") + "</div>";
    };
    var h = back + '<section class="scheda"><header class="sh-head"><h2>' + esc(nome) + '</h2><p class="hint">' + esc(sub) + "</p></header>";
    h += '<div class="vitali">' + tile("CA", ca.tot, ca.desc) +
      tile("PF", s.pf_attuali + "/" + s.pf_max + (s.pf_temp ? ' <span class="tmp">+' + s.pf_temp + "</span>" : "")) +
      tile("Velocità", esc(fmtVel(s.velocita)));
    if (!semp) {
      var pas = 10 + totaleAbilita(s, "percezione");
      h += tile("Iniziativa", sgn(mod(s.destrezza))) + tile("Bonus competenza", sgn(bc)) + tile("Percezione passiva", pas);
    }
    h += "</div>";
    h += '<div class="pfctrl"><label class="f"><span>Punti ferita</span><input type="number" id="pfn" min="1" value="1"></label>' +
      '<button data-act="pf-danno" data-id="' + s.id + '">Danno</button><button data-act="pf-cura" data-id="' + s.id + '">Cura</button>' +
      '<label class="f"><span>PF temporanei</span><input type="number" id="pft" min="0" value="' + s.pf_temp + '"></label>' +
      '<button data-act="pf-temp" data-id="' + s.id + '">Imposta</button>' +
      (!semp ? '<button data-act="ispirazione" data-id="' + s.id + '" aria-pressed="' + s.ispirazione + '">' + (s.ispirazione ? "Ispirazione: sì" : "Ispirazione: no") + "</button>" : "") + "</div>";
    h += htmlTurno(s);
    h += '<div class="abils">' + ABIL.map(function (a) {
      return '<div class="ab"><span class="lbl">' + a[2] + "</span><strong>" + sgn(mod(s[a[3]])) + "</strong><small>" + s[a[3]] + "</small></div>";
    }).join("") + "</div>";
    if (!semp) {
      h += '<div class="duecol"><div><h3>Tiri salvezza</h3><ul class="plain sk">' + ABIL.map(function (a) {
        var p = (s.competenze_ts || []).indexOf(a[0]) >= 0;
        return '<li><span class="dot" title="' + (p ? "competente" : "non competente") + '">' + (p ? "●" : "○") + "</span> " + a[1] + "<b>" + sgn(mod(s[a[3]]) + (p ? bc : 0)) + "</b></li>";
      }).join("") + '</ul></div><div><h3>Abilità</h3><ul class="plain sk">' + SKILLS.map(function (k) {
        var lv = (s.abilita || {})[k[0]] || 0;
        return '<li><span class="dot" title="' + ["non competente", "competente", "maestria"][lv] + '">' + ["○", "●", "◆"][lv] + "</span> " + esc(k[1]) +
          ' <small>' + ABK[k[2]][2] + "</small><b>" + sgn(totaleAbilita(s, k[0])) + "</b></li>";
      }).join("") + "</ul></div></div>";
      h += '<p class="hint">● competenza, ◆ maestria. La CA si calcola dall’armatura e dallo scudo equipaggiati nell’inventario.</p>';
    } else {
      if (s.tratti) h += "<h3>Tratti</h3><p class=\"pre\">" + esc(s.tratti) + "</p>";
      if ((s.azioni || []).length) {
        h += "<h3>Azioni</h3><ul class=\"plain\">" + s.azioni.map(function (a) {
          return '<li class="az"><strong>' + esc(a.nome) + ".</strong> " + esc(a.testo) + "</li>";
        }).join("") + "</ul>";
      }
    }
    h += htmlCombattimento(s, key);
    if (s.note) h += "<h3>Note</h3><p class=\"pre\">" + esc(s.note) + "</p>";
    h += '<div class="row" style="margin-top:1.2rem"><button class="primary" data-act="modifica-scheda" data-id="' + s.id + '">Modifica scheda</button>' +
      (!semp && s.livello < 20 ? '<button data-act="sali-livello" data-id="' + s.id + '">Sali di livello</button>' : "") +
      (isMaster() ? '<button class="danger" data-act="elimina-scheda" data-id="' + s.id + '">Elimina scheda</button>' : "") + "</div></section>";
    return h;
  }

  // ---------------------------------------------------------------- salvataggio
  var SCHEDA_CAMPI = ["tipo", "specie", "background", "classe", "sottoclasse", "livello", "forza", "destrezza", "costituzione", "intelligenza", "saggezza", "carisma",
    "pf_max", "pf_attuali", "pf_temp", "ca_manuale", "ca_bonus", "velocita", "competenze_ts", "abilita", "ispirazione", "sfida", "tratti", "azioni", "note",
    "car_incantesimi", "cd_incantesimi", "att_incantesimi", "competenze_armi", "slot_totali", "slot_riposo", "risorse"];
  function payloadDaScheda(s) {
    var p = { campagna_id: s.campagna_id, id: s.id, giocatore_id: s.giocatore_id, png_id: s.png_id };
    SCHEDA_CAMPI.forEach(function (c) { p[c] = s[c]; });
    return p;
  }
  function salvaScheda(p, okMsg) {
    return run(function () { return call("salva_scheda", { p: p }); }, okMsg).then(function (r) {
      if (!r) return null;
      return caricaDati().then(function () { disegnaTab(); return r.v; });
    });
  }
  function leggi(fd) {
    return {
      g: function (k) { return (fd.get(k) == null ? "" : String(fd.get(k))).trim(); },
      n: function (k) { var s = (fd.get(k) == null ? "" : String(fd.get(k))).trim().replace(",", "."); return s === "" ? null : Number(s); },
      b: function (k) { return fd.get(k) === "on"; }
    };
  }
  function apriDopo(key) {
    if (isMaster()) { S.tab = "schede"; S.schedaAperta = key; } else { S.tab = "scheda"; }
    disegnaTab();
  }

  // ---------------------------------------------------------------- modifica a mano
  function editorScheda(key, s, tipo) {
    var nuova = !s;
    var semp = (s ? s.tipo : tipo) === "semplificata";
    var d = s || { livello: 1, forza: 10, destrezza: 10, costituzione: 10, intelligenza: 10, saggezza: 10, carisma: 10, pf_max: semp ? 4 : 10, pf_attuali: semp ? 4 : 10, pf_temp: 0, ca_manuale: semp ? 10 : null, ca_bonus: 0, velocita: 9, competenze_ts: [], abilita: {}, azioni: [] };
    var corpo = "";
    if (!semp) {
      corpo += fld("specie", "Specie", d.specie) + fld("background", "Background", d.background) +
        '<div class="cols">' + fld("classe", "Classe", d.classe, 'list="listaclassi"') + fld("sottoclasse", "Sottoclasse", d.sottoclasse) +
        fld("livello", "Livello", d.livello, 'min="1" max="20" required', "number") + "</div>" + datalistClassi();
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
        specie: semp ? "" : x.g("specie"), background: semp ? "" : x.g("background"), classe: semp ? "" : x.g("classe"), sottoclasse: semp ? "" : x.g("sottoclasse"),
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
  function datalistClassi() {
    return '<datalist id="listaclassi">' + Object.keys(CLASSI).map(function (k) { return '<option value="' + CLASSI[k].n + '">'; }).join("") + "</datalist>";
  }

  // ---------------------------------------------------------------- creazione guidata
  var WZ = null;
  var ARRAY_STD = [15, 14, 13, 12, 10, 8];
  var COSTO_PUNTI = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  function d6() {
    var a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= 4294967292);
    return a[0] % 6 + 1;
  }
  function tira4d6() {
    var r = [d6(), d6(), d6(), d6()].sort(function (x, y) { return x - y; });
    return r[1] + r[2] + r[3];
  }
  function wizard(key) {
    WZ = { key: key, step: 1, specie: "", background: "", classe: "", livello: 1, metodo: "standard",
      base: { "for": 15, des: 14, cos: 13, "int": 12, sag: 10, car: 8 }, bonus: { "for": 0, des: 0, cos: 0, "int": 0, sag: 0, car: 0 },
      ts: null, sk: {}, pf: null, vel: null };
    wzDisegna();
    var d = $("#dlg");
    if (!d.open) d.showModal();
  }
  function wzLeggi() {
    var f = $("#wzForm");
    if (!f || !WZ) return;
    var x = leggi(new FormData(f));
    if (WZ.step === 1) { WZ.specie = x.g("specie"); WZ.background = x.g("background"); WZ.classe = x.g("classe"); WZ.livello = Math.min(20, Math.max(1, x.n("livello") || 1)); }
    if (WZ.step === 2) {
      ABIL.forEach(function (a) { WZ.base[a[0]] = x.n("b_" + a[0]) || 0; WZ.bonus[a[0]] = x.n("bn_" + a[0]) || 0; });
      WZ.metodo = x.g("metodo") || WZ.metodo;
    }
    if (WZ.step === 3) {
      WZ.ts = {}; ABIL.forEach(function (a) { if (x.b("ts_" + a[0])) WZ.ts[a[0]] = true; });
      WZ.sk = {}; SKILLS.forEach(function (k) { if (x.b("sk_" + k[0])) WZ.sk[k[0]] = 1; });
    }
    if (WZ.step === 4) { WZ.pf = x.n("pf"); WZ.vel = x.n("vel"); }
  }
  function wzTotali() {
    var t = {};
    ABIL.forEach(function (a) { t[a[0]] = (WZ.base[a[0]] || 0) + (WZ.bonus[a[0]] || 0); });
    return t;
  }
  function wzStato() {
    var v = ABIL.map(function (a) { return WZ.base[a[0]]; });
    if (WZ.metodo === "standard") {
      var ok = v.slice().sort(function (a, b) { return b - a; }).join() === ARRAY_STD.join();
      return ok ? "I valori sono quelli dell’array standard." : "Questi valori non sono quelli dell’array standard (15, 14, 13, 12, 10, 8): va bene lo stesso, ma controlla.";
    }
    if (WZ.metodo === "punti") {
      var tot = 0, fuori = false;
      v.forEach(function (x) { if (COSTO_PUNTI[x] == null) fuori = true; else tot += COSTO_PUNTI[x]; });
      if (fuori) return "Con l’acquisto punti ogni valore va da 8 a 15.";
      return "Punti usati: " + tot + " su 27" + (tot > 27 ? " (troppi)" : tot < 27 ? " (te ne restano " + (27 - tot) + ")" : ".");
    }
    if (WZ.metodo === "tiro") return "Premi «Tira i dadi»: 4d6 per ogni caratteristica, scartando il dado più basso. Poi puoi scambiare i valori a mano.";
    return "Scrivi i valori che vuoi.";
  }
  function wzBarra(indietro, avanti) {
    return '<div class="dlgbar">' + (indietro ? '<button type="button" class="ghost" data-act="wiz-prev">Indietro</button>' : '<button type="button" class="ghost" data-close>Annulla</button>') +
      '<button type="submit" class="primary">' + avanti + "</button></div>";
  }
  function wzDisegna() {
    var info = classeInfo(WZ.classe), h = '<form id="wzForm" class="dlgform" data-form="wz"><h2>Nuovo personaggio: ' + esc(nomeHolder(WZ.key)) + '</h2><p class="hint">Passo ' + WZ.step + " di 4</p>";
    if (WZ.step === 1) {
      h += fld("specie", "Specie", WZ.specie) + fld("background", "Background", WZ.background) +
        '<div class="cols">' + fld("classe", "Classe", WZ.classe, 'list="listaclassi"') + fld("livello", "Livello", WZ.livello, 'min="1" max="20" required', "number") + "</div>" + datalistClassi() +
        '<p class="hint">Se la classe è una delle dodici del manuale base, i passi successivi propongono tiri salvezza, abilità e punti ferita. Altrimenti compili tu.</p>' +
        '<p><button type="button" class="link" data-act="wiz-manuale">Preferisco compilare tutto a mano</button></p>' + wzBarra(false, "Avanti");
    } else if (WZ.step === 2) {
      var tot = wzTotali();
      h += sel("metodo", "Come determini le caratteristiche", [["standard", "Array standard (15, 14, 13, 12, 10, 8)"], ["punti", "Acquisto punti (27 punti)"], ["tiro", "Tiro (4d6, scarta il più basso)"], ["manuale", "Valori a mano"]], WZ.metodo) +
        (WZ.metodo === "tiro" ? '<p><button type="button" data-act="wiz-tira">Tira i dadi</button></p>' : "") +
        '<div class="wzab"><span class="lbl"></span><span class="lbl">Base</span><span class="lbl">Bonus background</span><span class="lbl">Totale</span>' + ABIL.map(function (a) {
          return "<label for=\"b_" + a[0] + "\">" + a[1] + '</label><input type="number" id="b_' + a[0] + '" name="b_' + a[0] + '" min="1" max="30" value="' + WZ.base[a[0]] + '">' +
            '<input type="number" name="bn_' + a[0] + '" min="0" max="3" value="' + WZ.bonus[a[0]] + '" aria-label="Bonus background ' + a[1] + '"><output id="tot_' + a[0] + '">' + tot[a[0]] + " (" + sgn(mod(tot[a[0]])) + ")</output>";
        }).join("") + '</div><p class="hint" id="wzstato" aria-live="polite">' + esc(wzStato()) + "</p>" +
        '<p class="hint">Il background di solito dà +2 a una caratteristica e +1 a un’altra (oppure +1 a tre): scrivilo nella colonna Bonus.</p>' + wzBarra(true, "Avanti");
    } else if (WZ.step === 3) {
      if (WZ.ts == null) { WZ.ts = {}; if (info) info.ts.forEach(function (k) { WZ.ts[k] = true; }); }
      h += (info ? '<p class="hint">' + info.n + ": dado vita d" + info.dado + ". Dalla classe scegli " + info.sc + " abilità tra quelle evidenziate" + (info.ab ? "" : " (qualsiasi)") + '; il background ne aggiunge altre.</p>' : '<p class="hint">Classe non riconosciuta: scegli tu le competenze.</p>') +
        "<h3>Tiri salvezza</h3><div class=\"cols\">" + ABIL.map(function (a) { return chk("ts_" + a[0], a[1], WZ.ts[a[0]]); }).join("") + "</div>" +
        "<h3>Abilità</h3><div class=\"cols\">" + SKILLS.map(function (k) {
          var inClasse = info && (!info.ab || info.ab.indexOf(k[0]) >= 0);
          return '<label class="c' + (inClasse ? " cl" : "") + '"><input type="checkbox" name="sk_' + k[0] + '"' + (WZ.sk[k[0]] ? " checked" : "") + "><span>" + esc(k[1]) + " <small>" + ABK[k[2]][2] + "</small></span></label>";
        }).join("") + '</div><p class="hint" id="wzconta" aria-live="polite">' + esc(wzConta()) + "</p>" + wzBarra(true, "Avanti");
    } else {
      var t = wzTotali(), cm = mod(t.cos), dado = info ? info.dado : 8, L = WZ.livello;
      if (WZ.pf == null) WZ.pf = Math.max(L, dado + cm + (L - 1) * (Math.floor(dado / 2) + 1 + cm));
      if (WZ.vel == null) WZ.vel = distShow(9);
      var skl = Object.keys(WZ.sk).map(function (k) { return SKILL[k][1]; }).join(", ") || "nessuna";
      h += "<p><strong>" + esc(info ? info.n : (WZ.classe || "Classe da definire")) + "</strong>, livello " + L + (WZ.specie ? ", " + esc(WZ.specie) : "") + (WZ.background ? ", " + esc(WZ.background) : "") + "</p>" +
        "<p class=\"hint\">Caratteristiche: " + ABIL.map(function (a) { return a[2] + " " + t[a[0]]; }).join(", ") + "<br>Tiri salvezza: " +
        (ABIL.filter(function (a) { return WZ.ts[a[0]]; }).map(function (a) { return a[1]; }).join(", ") || "nessuno") + "<br>Abilità: " + esc(skl) + "</p>" +
        '<div class="cols">' + fld("pf", "Punti ferita massimi", WZ.pf, 'min="1" required', "number") + fld("vel", "Velocità (" + distUnit() + ")", WZ.vel, 'min="0" step="any" required', "number") + "</div>" +
        '<p class="hint">' + (info ? "PF calcolati con d" + dado + " al primo livello e la media dei dadi vita dopo (più il modificatore di Costituzione)." : "Classe non riconosciuta: PF stimati con un d8, correggili.") +
        " La CA si calcola dall’armatura che equipaggi: senza armatura è 10 + Destrezza (" + (10 + mod(t.des)) + ").</p>" + wzSlotRiassunto() + wzBarra(true, "Crea scheda");
    }
    h += "</form>";
    $("#dlg").innerHTML = h;
  }
  function wzConta() {
    var info = classeInfo(WZ.classe);
    var n = SKILLS.filter(function (k) { return WZ.sk[k[0]] && info && (!info.ab || info.ab.indexOf(k[0]) >= 0); }).length;
    var tot = Object.keys(WZ.sk).length;
    return info ? "Dalla classe: " + n + " su " + info.sc + ". Abilità scelte in totale: " + tot + "." : "Abilità scelte: " + tot + ".";
  }
  function wzAvanti() {
    wzLeggi();
    if (WZ.step < 4) { WZ.step++; wzDisegna(); return; }
    var info = classeInfo(WZ.classe), t = wzTotali(), key = WZ.key, pk = parteDa(key);
    var p = { campagna_id: campId(), id: null, giocatore_id: pk.g, png_id: pk.p, tipo: "completa", specie: WZ.specie, background: WZ.background,
      classe: info ? info.n : WZ.classe, sottoclasse: "", livello: WZ.livello, pf_max: WZ.pf || 1, pf_attuali: WZ.pf || 1, pf_temp: 0,
      ca_manuale: null, ca_bonus: 0, velocita: distM(WZ.vel) == null ? 9 : distM(WZ.vel), ispirazione: false, note: "",
      competenze_ts: ABIL.filter(function (a) { return WZ.ts[a[0]]; }).map(function (a) { return a[0]; }), abilita: {} };
    ABIL.forEach(function (a) { p[a[3]] = Math.min(30, Math.max(1, t[a[0]] || 10)); });
    var sg = slotSuggeriti(info, WZ.livello);
    p.car_incantesimi = info && info.car ? info.car : ""; p.competenze_armi = info ? info.armi.slice() : [];
    p.slot_totali = sg.tot; p.slot_riposo = sg.riposo; p.risorse = [];
    Object.keys(WZ.sk).forEach(function (k) { p.abilita[k] = 1; });
    salvaScheda(p, "Scheda creata").then(function (id) {
      if (id == null) return;
      $("#dlg").close();
      apriDopo(key);
    });
  }
  document.addEventListener("input", function (e) {
    if (!WZ || !e.target.closest || !e.target.closest("#wzForm")) return;
    wzLeggi();
    if (WZ.step === 2) {
      var tot = wzTotali();
      ABIL.forEach(function (a) { var o = $("#tot_" + a[0]); if (o) o.textContent = tot[a[0]] + " (" + sgn(mod(tot[a[0]])) + ")"; });
      $("#wzstato").textContent = wzStato();
    }
    if (WZ.step === 3) $("#wzconta").textContent = wzConta();
  });
  document.addEventListener("change", function (e) {
    if (!WZ || !e.target || e.target.name !== "metodo") return;
    wzLeggi();
    WZ.metodo = e.target.value;
    if (WZ.metodo === "standard") ABIL.forEach(function (a, i) { WZ.base[a[0]] = ARRAY_STD[i]; });
    if (WZ.metodo === "punti") ABIL.forEach(function (a) { WZ.base[a[0]] = 8; });
    wzDisegna();
  });
  $("#dlg").addEventListener("close", function () { WZ = null; });

  // ---------------------------------------------------------------- azioni sulle schede
  function rapido(id, pf, temp, isp) {
    run(function () { return call("aggiorna_scheda_rapida", { p_id: Number(id), p_pf: pf, p_temp: temp, p_isp: isp }); })
      .then(function (r) { if (r) caricaDati().then(disegnaTab); });
  }
  var ACT_SCHEDE = {
    "apri-scheda": function (b) { S.schedaAperta = b.dataset.key; disegnaTab(); },
    "chiudi-scheda": function () { S.schedaAperta = null; disegnaTab(); },
    "vai-scheda": function (b) { S.tab = "schede"; S.schedaAperta = b.dataset.key; disegnaTab(); },
    "crea-scheda": function (b) {
      var key = b.dataset.key;
      if (key.charAt(0) === "g") { wizard(key); return; }
      modal("Scheda per " + nomeHolder(key), '<p>Come vuoi descrivere questo NPC?</p>' +
        sel("tipo", "Tipo di scheda", [["semplificata", "Semplificata: CA, PF, azioni (come un mostro)"], ["completa", "Completa: caratteristiche, tiri salvezza e abilità"]], "semplificata"),
        function (fd) {
          var t = fd.get("tipo");
          setTimeout(function () { if (t === "semplificata") editorScheda(key, null, "semplificata"); else wizard(key); }, 0);
        }, "Continua");
    },
    "crea-manuale": function (b) { editorScheda(b.dataset.key, null, "completa"); },
    "wiz-manuale": function () { var k = WZ.key; $("#dlg").close(); editorScheda(k, null, "completa"); },
    "wiz-prev": function () { wzLeggi(); WZ.step--; wzDisegna(); },
    "wiz-tira": function () { wzLeggi(); ABIL.forEach(function (a) { WZ.base[a[0]] = tira4d6(); }); wzDisegna(); },
    "modifica-scheda": function (b) { var s = schedaPerId(b.dataset.id); if (s) editorScheda(keyDiScheda(s), s); },
    "sali-livello": function (b) {
      var s = schedaPerId(b.dataset.id); if (!s) return;
      var info = classeInfo(s.classe), dado = info ? info.dado : 8, guad = Math.max(1, Math.floor(dado / 2) + 1 + mod(s.costituzione));
      modal("Sali di livello: " + nomeHolder(keyDiScheda(s)),
        "<p>Da livello " + s.livello + " a livello <strong>" + (s.livello + 1) + "</strong>. Il bonus competenza passa a " + sgn(bonusComp(s.livello + 1)) + ".</p>" +
        fld("guadagno", "Punti ferita in più" + (info ? " (media del d" + dado + " più Costituzione)" : " (stima con un d8)"), guad, 'min="0" required', "number") +
        '<p class="hint">Controlla sul manuale se a questo livello la tua classe dà un aumento di caratteristica o un talento: in quel caso modifica le caratteristiche dalla scheda.</p>',
        function (fd) {
          var g = Number(fd.get("guadagno")) || 0, p = payloadDaScheda(s);
          p.livello = s.livello + 1; p.pf_max = s.pf_max + g; p.pf_attuali = s.pf_attuali + g;
          if (info && info.inc && uguali(s.slot_totali, slotSuggeriti(info, s.livello).tot)) { var sn = slotSuggeriti(info, p.livello); p.slot_totali = sn.tot; p.slot_riposo = sn.riposo; }
          return salvaScheda(p, "Sei salito al livello " + p.livello).then(function (id) { return id != null; });
        }, "Sali di livello");
    },
    "elimina-scheda": function (b) {
      var s = schedaPerId(b.dataset.id); if (!s) return;
      modal("Eliminare la scheda?", "<p>La scheda di " + esc(nomeHolder(keyDiScheda(s))) + " viene cancellata. L’inventario e lo storico non cambiano.</p>", function () {
        return run(function () { return call("elimina_scheda", { p_id: s.id }); }, "Scheda eliminata").then(function (r) {
          if (!r) return false;
          S.schedaAperta = null;
          return caricaDati().then(disegnaTab);
        });
      }, "Elimina");
    },
    "pf-danno": function (b) {
      var s = schedaPerId(b.dataset.id), v = Math.floor(Number($("#pfn").value) || 0); if (!s || v <= 0) return;
      var ass = Math.min(s.pf_temp, v), temp = s.pf_temp - ass, resto = v - ass;
      rapido(s.id, Math.max(0, s.pf_attuali - resto), temp, null);
    },
    "pf-cura": function (b) {
      var s = schedaPerId(b.dataset.id), v = Math.floor(Number($("#pfn").value) || 0); if (!s || v <= 0) return;
      rapido(s.id, Math.min(s.pf_max, s.pf_attuali + v), null, null);
    },
    "pf-temp": function (b) {
      var s = schedaPerId(b.dataset.id); if (!s) return;
      rapido(s.id, null, Math.max(0, Math.floor(Number($("#pft").value) || 0)), null);
    },
    ispirazione: function (b) { var s = schedaPerId(b.dataset.id); if (s) rapido(s.id, null, null, !s.ispirazione); }
  };
  Object.keys(ACT_SCHEDE).forEach(function (k) { ACT[k] = ACT_SCHEDE[k]; });
  FORMS.wz = function () { wzAvanti(); };


  // ================================================================ ATTACCHI, INCANTESIMI, SLOT, TURNO
  // Tabelle degli slot per livello di classe (controllale sul tuo manuale; tutto è modificabile dalla scheda).
  var PIENO = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
  var MEZZO = [[2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
    [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]];
  var PATTO = [[1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5]];
  var CLASSI_EXTRA = {
    barbaro: { armi: ["semplici", "da_guerra"] },
    bardo: { armi: ["semplici"], inc: "pieno", car: "car" },
    chierico: { armi: ["semplici"], inc: "pieno", car: "sag" },
    druido: { armi: ["semplici"], inc: "pieno", car: "sag" },
    guerriero: { armi: ["semplici", "da_guerra"] },
    monaco: { armi: ["semplici", "da_guerra_leggere"] },
    paladino: { armi: ["semplici", "da_guerra"], inc: "mezzo", car: "car" },
    ranger: { armi: ["semplici", "da_guerra"], inc: "mezzo", car: "sag" },
    ladro: { armi: ["semplici", "da_guerra_leggere"] },
    stregone: { armi: ["semplici"], inc: "pieno", car: "car" },
    warlock: { armi: ["semplici"], inc: "patto", car: "car" },
    mago: { armi: ["semplici"], inc: "pieno", car: "int" }
  };
  Object.keys(CLASSI_EXTRA).forEach(function (k) { Object.assign(CLASSI[k], CLASSI_EXTRA[k]); });
  var TEMPI = { azione: "Azione", azione_bonus: "Azione bonus", reazione: "Reazione", lungo: "Più di un minuto" };
  var LIV_INC = ["Trucchetti", "1° livello", "2° livello", "3° livello", "4° livello", "5° livello", "6° livello", "7° livello", "8° livello", "9° livello"];
  var fmtDist = function (m) { return dec(distShow(m)) + " " + distUnit(); };
  var uguali = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  function slotSuggeriti(info, lv) {
    var tot = [0, 0, 0, 0, 0, 0, 0, 0, 0], riposo = "lungo";
    if (info && info.inc) {
      if (info.inc === "patto") { var p = PATTO[lv - 1]; tot[p[1] - 1] = p[0]; riposo = "breve"; }
      else (info.inc === "pieno" ? PIENO : MEZZO)[lv - 1].forEach(function (n, i) { tot[i] = n; });
    }
    return { tot: tot, riposo: riposo };
  }
  function incPerId(id) { return S.inc.filter(function (i) { return String(i.id) === String(id); })[0] || null; }
  function incDiScheda(sid) {
    return S.si.filter(function (r) { return r.scheda_id === sid; }).map(function (r) { return { r: r, i: incPerId(r.incantesimo_id) }; })
      .filter(function (x) { return x.i; });
  }
  function statInc(s) {
    var bc = bonusComp(s.livello), m = (s.tipo === "completa" && s.car_incantesimi) ? mod(s[ABK[s.car_incantesimi][3]]) : null;
    return {
      car: s.car_incantesimi, mod: m,
      cd: s.cd_incantesimi != null ? s.cd_incantesimi : (m != null ? 8 + bc + m : null),
      att: s.att_incantesimi != null ? s.att_incantesimi : (m != null ? bc + m : null)
    };
  }
  function scalaDadi(txt, liv) {
    var tier = 1 + (liv >= 5 ? 1 : 0) + (liv >= 11 ? 1 : 0) + (liv >= 17 ? 1 : 0);
    var m = /^(\d+)d(\d+)(.*)$/.exec(String(txt || "").trim());
    return m ? (Number(m[1]) * tier) + "d" + m[2] + m[3] : txt;
  }
  function dannoInc(s, i, st) {
    if (!i.danno) return "—";
    var d = i.livello === 0 ? scalaDadi(i.danno, s.livello) : i.danno;
    if (i.aggiunge_mod && st.mod != null && st.mod !== 0) d += sgn(st.mod);
    return d + (i.tipo_danno ? " " + i.tipo_danno : "");
  }
  function gittataInc(i) { return i.gittata_speciale || (i.gittata_m != null ? fmtDist(i.gittata_m) : "—"); }
  function competenteArma(s, a, prop) {
    var c = s.competenze_armi || [], leg = prop.indexOf("accurata") >= 0 || prop.indexOf("finesse") >= 0 || prop.indexOf("leggera") >= 0;
    if (a.categoria_arma === "altro") return true;
    if (a.categoria_arma === "semplice") return c.indexOf("semplici") >= 0 || c.indexOf("da_guerra") >= 0;
    return c.indexOf("da_guerra") >= 0 || (c.indexOf("da_guerra_leggere") >= 0 && leg);
  }

  // ---------------------------------------------------------------- attacchi
  function attacchi(s, key) {
    var righe = [], bc = bonusComp(s.livello), st = statInc(s);
    if (s.tipo === "completa") {
      var fo = mod(s.forza), de = mod(s.destrezza);
      invDi(key).forEach(function (i) {
        var o = i.oggetti, a = one(o.armi);
        if (!i.equipaggiato || o.categoria !== "arma" || !a || a.modalita === "assedio") return;
        var prop = (a.proprieta || []).map(function (x) { return String(x).toLowerCase(); });
        var fin = prop.indexOf("accurata") >= 0 || prop.indexOf("finesse") >= 0;
        var m = a.modalita === "distanza" ? de : (fin ? Math.max(fo, de) : fo);
        var comp = competenteArma(s, a, prop), mag = a.bonus_attacco || 0;
        var colpo = m + (comp ? bc : 0) + mag, dm = m + mag;
        var d = a.danno + (dm ? sgn(dm) : "") + " " + a.tipo_danno;
        if (a.danno_versatile) d += " (a due mani " + a.danno_versatile + (dm ? sgn(dm) : "") + ")";
        var note = [];
        if (!comp) note.push("senza competenza");
        if (o.effetto_condizionale) note.push(o.effetto_condizionale);
        righe.push({ n: o.nome, tiro: sgn(colpo), danno: d, gitt: a.gittata_normale ? fmtDist(a.gittata_normale) + (a.gittata_massima ? "/" + dec(distShow(a.gittata_massima)) : "") : fmtDist(1.5), note: note.join("; ") });
      });
      righe.push({ n: "Colpo senza armi", tiro: sgn(fo + bc), danno: Math.max(0, 1 + fo) + " contundenti", gitt: fmtDist(1.5), note: "" });
    }
    incDiScheda(s.id).forEach(function (x) {
      var i = x.i;
      if (i.livello > 0 && x.r.stato === "non_preparato") return;
      if (i.effetto === "automatico" && !i.danno) return;
      var tiro = "—";
      if (i.effetto === "attacco") tiro = st.att != null ? sgn(st.att) : "attacco";
      if (i.effetto === "salvezza") tiro = (st.cd != null ? "CD " + st.cd + " " : "") + ABK[i.tiro_salvezza][2];
      righe.push({ n: i.nome, tiro: tiro, danno: dannoInc(s, i, st), gitt: gittataInc(i), note: i.livello === 0 ? "trucchetto" : i.livello + "° livello" });
    });
    return righe;
  }
  function htmlAttacchi(s, key) {
    var r = attacchi(s, key);
    if (!r.length) return "";
    var h = '<h3>Attacchi</h3><div class="scroll"><table class="att"><thead><tr><th>Nome</th><th>Tiro</th><th>Danno</th><th>Gittata</th><th>Note</th></tr></thead><tbody>' +
      r.map(function (x) { return "<tr><td>" + esc(x.n) + "</td><td>" + esc(x.tiro) + "</td><td>" + esc(x.danno) + "</td><td>" + esc(x.gitt) + "</td><td>" + esc(x.note) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    if (s.tipo === "completa") h += '<p class="hint">Le armi compaiono quando le equipaggi nell’inventario. Bonus e danno usano la caratteristica giusta, la competenza e il bonus per colpire dell’oggetto.</p>';
    return h;
  }

  // ---------------------------------------------------------------- turno, concentrazione, riposi
  function htmlTurno(s) {
    if (!S.incOk) return "";
    var t = s.turno || {};
    var bt = function (k, l) { var u = !!t[k]; return '<button class="tg' + (u ? " usato" : "") + '" data-act="turno" data-id="' + s.id + '" data-k="' + k + '" aria-pressed="' + u + '">' + l + "</button>"; };
    return '<div class="gioco"><div class="row turno" role="group" aria-label="Turno">' + bt("azione", "Azione") + bt("bonus", "Azione bonus") + bt("reazione", "Reazione") + bt("movimento", "Movimento") +
      '<button class="small" data-act="nuovo-turno" data-id="' + s.id + '">Nuovo turno</button></div>' +
      '<div class="row"><button class="small" data-act="riposo-breve" data-id="' + s.id + '">Riposo breve</button><button class="small" data-act="riposo-lungo" data-id="' + s.id + '">Riposo lungo</button></div>' +
      (s.concentrazione ? '<p class="conc"><strong>In concentrazione:</strong> ' + esc(s.concentrazione) + ' <button class="link" data-act="conc-fine" data-id="' + s.id + '">Termina</button></p>' : "") + "</div>";
  }

  // ---------------------------------------------------------------- slot e risorse
  function htmlSlot(s) {
    var tot = s.slot_totali || [], us = s.slot_usati || [];
    if (!tot.some(function (n) { return n > 0; })) return "";
    var h = "<h3>Slot incantesimo" + (s.slot_riposo === "breve" ? " (si recuperano con il riposo breve)" : "") + '</h3><div class="slots">';
    tot.forEach(function (n, lv) {
      if (n <= 0) return;
      var pips = "";
      for (var i = 0; i < n; i++) {
        var u = i < (us[lv] || 0);
        pips += '<button class="pip' + (u ? " usato" : "") + '" data-act="slot" data-id="' + s.id + '" data-lv="' + lv + '" data-i="' + i + '" aria-pressed="' + u + '" aria-label="Slot di livello ' + (lv + 1) + ", numero " + (i + 1) + (u ? ", usato" : ", disponibile") + '"></button>';
      }
      h += '<div class="slotriga"><span class="slotlv">' + (lv + 1) + '°</span><span class="pips">' + pips + "</span><small>" + (n - (us[lv] || 0)) + " di " + n + "</small></div>";
    });
    return h + "</div>";
  }
  function htmlRisorse(s) {
    var r = s.risorse || [];
    if (!r.length) return "";
    return "<h3>Risorse</h3><div class=\"slots\">" + r.map(function (x, k) {
      var pips = "";
      if (x.max <= 10) for (var i = 0; i < x.max; i++) {
        var u = i < x.usati;
        pips += '<button class="pip' + (u ? " usato" : "") + '" data-act="risorsa" data-id="' + s.id + '" data-k="' + k + '" data-i="' + i + '" aria-pressed="' + u + '" aria-label="' + esc(x.nome) + ", uso " + (i + 1) + (u ? ", usato" : ", disponibile") + '"></button>';
      }
      else pips = '<button class="small" data-act="risorsa-meno" data-id="' + s.id + '" data-k="' + k + '">−</button> <strong>' + (x.max - x.usati) + "</strong> " +
        '<button class="small" data-act="risorsa-piu" data-id="' + s.id + '" data-k="' + k + '">+</button>';
      return '<div class="slotriga"><span class="slotlv nome">' + esc(x.nome) + '</span><span class="pips">' + pips + "</span><small>" + (x.max - x.usati) + " di " + x.max + ", riposo " + (x.recupero === "breve" ? "breve" : "lungo") + "</small></div>";
    }).join("") + "</div>";
  }

  // ---------------------------------------------------------------- incantesimi sulla scheda
  function puoModificareInc(i) { return isMaster() || (S.me && i.creato_da === S.me.id); }
  function htmlIncantesimi(s) {
    if (!S.incOk) return "";
    var st = statInc(s), lista = incDiScheda(s.id);
    var h = '<h3>Incantesimi</h3><p class="hint">' + (st.car ? "Caratteristica: " + ABK[st.car][1] + ". " : "") + (st.cd != null ? "CD " + st.cd + ". " : "") + (st.att != null ? "Attacco " + sgn(st.att) + "." : "") +
      "</p><p><button class=\"small primary\" data-act=\"inc-aggiungi\" data-id=\"" + s.id + "\">Aggiungi incantesimo</button></p>";
    if (!lista.length) return h + '<p class="hint">Nessun incantesimo sulla scheda.</p>';
    for (var lv = 0; lv <= 9; lv++) {
      var l = lista.filter(function (x) { return x.i.livello === lv; }).sort(function (a, b) { return a.i.nome.localeCompare(b.i.nome, "it"); });
      if (!l.length) continue;
      h += "<h4>" + LIV_INC[lv] + "</h4>" + l.map(function (x) { return rigaInc(s, x.r, x.i, st); }).join("");
    }
    return h;
  }
  function rigaInc(s, r, i, st) {
    var tempo = i.tempo_note && i.tempo_lancio !== "lungo" ? i.tempo_note : (i.tempo_lancio === "lungo" ? (i.tempo_note || TEMPI.lungo) : TEMPI[i.tempo_lancio]);
    var tag = [];
    if (i.concentrazione) tag.push("Concentrazione");
    if (i.rituale) tag.push("Rituale");
    var dim = r.stato === "non_preparato";
    var det = [];
    if (i.scuola) det.push("Scuola: " + i.scuola);
    if (i.durata) det.push("Durata: " + i.durata);
    if (i.componenti) det.push("Componenti: " + i.componenti);
    if (i.classi) det.push("Classi: " + i.classi);
    if (r.fonte) det.push("Fonte: " + r.fonte);
    var h = '<div class="inc' + (dim ? " dim" : "") + '"><div class="inc-top"><strong>' + esc(i.nome) + "</strong>" +
      '<span class="inc-meta">' + [tempo, gittataInc(i)].concat(tag).map(esc).join(", ") + (r.stato === "sempre" ? ", sempre preparato" : dim ? ", non preparato" : "") + "</span></div>" +
      '<div class="row">';
    if (!dim || i.rituale) h += '<button class="small primary" data-act="lancia" data-id="' + s.id + '" data-inc="' + i.id + '">Lancia</button>';
    if (i.livello > 0 && r.stato !== "sempre") h += '<button class="small" data-act="inc-prepara" data-id="' + s.id + '" data-inc="' + i.id + '">' + (dim ? "Prepara" : "Non preparare") + "</button>";
    h += '<button class="small" data-act="inc-rimuovi" data-id="' + s.id + '" data-inc="' + i.id + '">Rimuovi</button></div>' +
      "<details><summary>Dettagli</summary>" + (i.riassunto ? '<p class="pre">' + esc(i.riassunto) + "</p>" : "") +
      (i.livelli_superiori ? "<p>A livelli superiori: " + esc(i.livelli_superiori) + "</p>" : "") +
      (det.length ? '<p class="hint">' + det.map(esc).join(". ") + ".</p>" : "") +
      (puoModificareInc(i) ? '<button class="link" data-act="modifica-inc" data-inc="' + i.id + '">Modifica incantesimo</button>' : "") + "</details></div>";
    return h;
  }
  function htmlCombattimento(s, key) {
    var h = htmlAttacchi(s, key) + htmlSlot(s) + htmlRisorse(s) + htmlIncantesimi(s);
    if (!S.incOk) h += '<p class="hint">Per attivare incantesimi, slot e turno esegui <code>aggiornamento_incantesimi.sql</code> nello SQL Editor di Supabase.</p>';
    return h;
  }

  // ---------------------------------------------------------------- stato di gioco (aggiornamento immediato, poi salvataggio)
  function gioco(s, patch, msg) {
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    disegnaTab();
    return call("aggiorna_gioco", { p_id: s.id, p: patch }).then(function () { if (msg) toast(msg); }, function (e) {
      toast(errText(e), true);
      return caricaDati().then(disegnaTab);
    });
  }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function avvisiLancio(s, i, rituale) {
    var t = s.turno || {}, a = [];
    if (!rituale) {
      if (i.tempo_lancio === "azione" && t.azione) a.push("Hai già usato l’azione in questo turno.");
      if (i.tempo_lancio === "azione_bonus" && t.bonus) a.push("Hai già usato l’azione bonus in questo turno.");
      if (i.tempo_lancio === "reazione" && t.reazione) a.push("Hai già usato la reazione.");
      if (i.tempo_lancio === "azione_bonus" && t.liv_azione) a.push("Hai già lanciato un incantesimo (non un trucchetto) con l’azione: dopo una magia a azione bonus puoi lanciare solo trucchetti.");
      if (i.tempo_lancio === "azione" && i.livello > 0 && t.inc_bonus) a.push("Hai già lanciato un incantesimo con l’azione bonus: puoi lanciare solo trucchetti con tempo di lancio di un’azione.");
    }
    if (i.concentrazione && s.concentrazione && s.concentrazione !== i.nome) a.push("Perderai la concentrazione su " + s.concentrazione + ".");
    return a;
  }
  function applicaLancio(s, i, lv) {   // lv: livello dello slot usato, oppure 0 per trucchetto, oppure "rituale"
    var patch = {}, t = copia(s.turno || {});
    if (typeof lv === "number" && lv > 0) { var us = (s.slot_usati || []).slice(); us[lv - 1] = (us[lv - 1] || 0) + 1; patch.slot_usati = us; }
    if (lv !== "rituale") {
      if (i.tempo_lancio === "azione") { t.azione = true; if (i.livello > 0) t.liv_azione = true; }
      if (i.tempo_lancio === "azione_bonus") { t.bonus = true; t.inc_bonus = true; }
      if (i.tempo_lancio === "reazione") t.reazione = true;
      patch.turno = t;
    }
    if (i.concentrazione) patch.concentrazione = i.nome;
    return gioco(s, patch, i.nome + (typeof lv === "number" && lv > 0 ? " lanciato con uno slot di " + lv + "° livello" : " lanciato"));
  }

  // ---------------------------------------------------------------- editor degli incantesimi
  var filtroInc = { q: "", liv: "" };
  function editorInc(i, perScheda) {
    var d = i || { livello: 0, tempo_lancio: "azione", effetto: "automatico" };
    var corpo = fld("nome", "Nome", d.nome, "required") +
      '<div class="cols">' + sel("livello", "Livello", LIV_INC.map(function (n, k) { return [String(k), k === 0 ? "Trucchetto" : n]; }), String(d.livello)) +
      fld("scuola", "Scuola", d.scuola, 'list="listascuole"') + "</div>" +
      '<datalist id="listascuole"><option>Abiurazione</option><option>Divinazione</option><option>Ammaliamento</option><option>Evocazione</option><option>Illusione</option><option>Necromanzia</option><option>Invocazione</option><option>Trasmutazione</option></datalist>' +
      '<div class="cols">' + sel("tempo_lancio", "Tempo di lancio", [["azione", "Azione"], ["azione_bonus", "Azione bonus"], ["reazione", "Reazione"], ["lungo", "Più di un minuto"]], d.tempo_lancio) +
      fld("tempo_note", "Nota sul tempo (es. 1 minuto)", d.tempo_note) + "</div>" +
      '<div class="cols">' + fld("gittata", "Gittata (" + distUnit() + ")", d.gittata_m != null ? distShow(d.gittata_m) : null, 'min="0" step="any"', "number") +
      fld("gittata_speciale", "Oppure: Contatto, Se stessi…", d.gittata_speciale) + fld("componenti", "Componenti (V, S, M)", d.componenti) +
      fld("durata", "Durata", d.durata) + "</div>" +
      chk("concentrazione", "Richiede concentrazione", d.concentrazione) + chk("rituale", "Si può lanciare come rituale", d.rituale) +
      '<div class="cols">' + sel("effetto", "Effetto", [["automatico", "Nessun tiro (automatico)"], ["attacco", "Attacco con incantesimo"], ["salvezza", "Tiro salvezza del bersaglio"]], d.effetto) +
      sel("tiro_salvezza", "Se tiro salvezza: caratteristica", [["", "—"]].concat(ABIL.map(function (a) { return [a[0], a[1]]; })), d.tiro_salvezza || "") + "</div>" +
      '<div class="cols">' + fld("danno", "Danno o cura (es. 1d10)", d.danno) + fld("tipo_danno", "Tipo (fuoco, radianti, cura…)", d.tipo_danno) + "</div>" +
      chk("aggiunge_mod", "Aggiunge il modificatore da incantatore (tipico delle cure)", d.aggiunge_mod) +
      fld("livelli_superiori", "A livelli superiori", d.livelli_superiori) + fld("classi", "Classi che lo hanno", d.classi) +
      area("riassunto", "Riassunto con parole tue (non incollare il testo del manuale)", d.riassunto);
    modal(i ? "Modifica incantesimo" : "Nuovo incantesimo", corpo, function (fd) {
      var x = leggi(fd), ef = x.g("effetto");
      var p = { campagna_id: campId(), id: i ? i.id : null, nome: x.g("nome"), livello: Number(x.g("livello")) || 0, scuola: x.g("scuola"),
        tempo_lancio: x.g("tempo_lancio"), tempo_note: x.g("tempo_note"), gittata_m: distM(x.n("gittata")), gittata_speciale: x.g("gittata_speciale"),
        componenti: x.g("componenti"), durata: x.g("durata"), concentrazione: x.b("concentrazione"), rituale: x.b("rituale"), effetto: ef,
        tiro_salvezza: ef === "salvezza" ? x.g("tiro_salvezza") : "", danno: x.g("danno"), tipo_danno: x.g("tipo_danno"), aggiunge_mod: x.b("aggiunge_mod"),
        livelli_superiori: x.g("livelli_superiori"), classi: x.g("classi"), riassunto: x.g("riassunto") };
      return run(function () { return call("salva_incantesimo", { p: p }); }, i ? "Incantesimo aggiornato" : "Incantesimo creato").then(function (r) {
        if (!r) return false;
        var nuovo = r.v;
        var dopo = perScheda && !i ? call("imposta_incantesimo_scheda", { p_scheda: Number(perScheda), p_inc: nuovo, p_stato: "preparato", p_fonte: null }) : Promise.resolve();
        return dopo.then(function () { return caricaDati().then(disegnaTab); }, function (e) { toast(errText(e), true); });
      });
    });
  }
  function htmlLibInc() {
    if (!S.incOk) return '<div class="empty">Per usare gli incantesimi esegui <code>aggiornamento_incantesimi.sql</code> nello SQL Editor di Supabase.</div>';
    return '<div class="toolbar"><input type="search" id="fqi" placeholder="Cerca per nome" aria-label="Cerca incantesimo" value="' + esc(filtroInc.q) + '">' +
      '<select id="fli" aria-label="Filtra per livello"><option value="">Tutti i livelli</option>' + LIV_INC.map(function (n, k) { return '<option value="' + k + '"' + (filtroInc.liv === String(k) ? " selected" : "") + ">" + (k === 0 ? "Trucchetti" : n) + "</option>"; }).join("") +
      '</select><button class="primary" data-act="nuovo-inc">Nuovo incantesimo</button></div><div id="listainc">' + htmlListaInc() + "</div>";
  }
  function htmlListaInc() {
    if (!S.inc.length) return '<div class="empty"><p>La libreria degli incantesimi è vuota. Aggiungine uno, oppure parti dai 14 di esempio (quelli di una scheda di Chierico di livello 2).</p><div class="row"><button class="primary" data-act="nuovo-inc">Nuovo incantesimo</button><button data-act="esempi-inc">Carica incantesimi di esempio</button></div></div>';
    var q = filtroInc.q.trim().toLowerCase();
    var l = S.inc.filter(function (i) { return (filtroInc.liv === "" || String(i.livello) === filtroInc.liv) && (!q || i.nome.toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return a.livello - b.livello || a.nome.localeCompare(b.nome, "it"); });
    if (!l.length) return '<div class="empty">Nessun incantesimo corrisponde alla ricerca.</div>';
    return l.map(function (i) {
      var meta = [i.livello === 0 ? "Trucchetto" : i.livello + "° livello", i.tempo_note || TEMPI[i.tempo_lancio], gittataInc(i)];
      if (i.concentrazione) meta.push("Concentrazione");
      if (i.rituale) meta.push("Rituale");
      return '<div class="inc"><div class="inc-top"><strong>' + esc(i.nome) + '</strong><span class="inc-meta">' + meta.map(esc).join(", ") + "</span></div>" +
        (i.riassunto ? '<p class="desc">' + esc(i.riassunto) + "</p>" : "") +
        '<div class="row"><button class="small" data-act="modifica-inc" data-inc="' + i.id + '">Modifica</button><button class="small danger" data-act="elimina-inc" data-inc="' + i.id + '">Elimina</button></div></div>';
    }).join("");
  }
  function bindLibInc() {
    var fq = $("#fqi"), fl = $("#fli");
    if (fq) fq.addEventListener("input", function () { filtroInc.q = fq.value; $("#listainc").innerHTML = htmlListaInc(); });
    if (fl) fl.addEventListener("change", function () { filtroInc.liv = fl.value; $("#listainc").innerHTML = htmlListaInc(); });
  }

  // ---------------------------------------------------------------- campi in più nel modulo della scheda
  function camposGioco(d, semp) {
    var tot = d.slot_totali || [0, 0, 0, 0, 0, 0, 0, 0, 0], c = d.competenze_armi || [];
    var h = "<h3>Incantesimi, slot e risorse</h3>";
    if (!semp) h += sel("car_incantesimi", "Caratteristica da incantatore", [["", "Nessuna"]].concat(ABIL.map(function (a) { return [a[0], a[1]]; })), d.car_incantesimi || "");
    h += '<div class="cols">' + fld("cd_incantesimi", semp ? "CD degli incantesimi" : "CD fissa (vuota = calcolata)", d.cd_incantesimi, 'min="0"', "number") +
      fld("att_incantesimi", semp ? "Bonus per colpire con incantesimi" : "Attacco fisso (vuoto = calcolato)", d.att_incantesimi, 'step="1"', "number") + "</div>" +
      '<p class="hint">Slot totali per livello</p><div class="cols slotin">';
    for (var lv = 1; lv <= 9; lv++) h += fld("slot_" + lv, lv + "° livello", tot[lv - 1] || 0, 'min="0" max="9"', "number");
    h += "</div>" + sel("slot_riposo", "Gli slot si recuperano con", [["lungo", "Riposo lungo"], ["breve", "Riposo breve (patto del Warlock)"]], d.slot_riposo || "lungo");
    if (!semp) h += '<p><button type="button" class="small" data-act="suggerisci-slot">Suggerisci da classe e livello</button></p>' +
      "<h3>Competenza con le armi</h3>" + chk("arm_semplici", "Armi semplici", c.indexOf("semplici") >= 0) + chk("arm_guerra", "Armi da guerra", c.indexOf("da_guerra") >= 0) +
      chk("arm_guerra_leggere", "Armi da guerra con Accurata o Leggera", c.indexOf("da_guerra_leggere") >= 0);
    h += area("risorse", "Risorse (una per riga: Nome | usi | recupero breve o lungo)", (d.risorse || []).map(function (r) { return r.nome + " | " + r.max + " | " + r.recupero; }).join("\n"));
    return h;
  }
  function leggiGioco(x, semp, s) {
    var tot = [];
    for (var lv = 1; lv <= 9; lv++) tot.push(Math.max(0, Math.min(9, Math.floor(x.n("slot_" + lv) || 0))));
    var vecchie = (s && s.risorse) || [];
    var ris = x.g("risorse").split("\n").map(function (r) { return r.trim(); }).filter(Boolean).map(function (r) {
      var p = r.split("|").map(function (z) { return z.trim(); }), nome = p[0], max = Math.max(1, Math.floor(Number(p[1])) || 1);
      var old = vecchie.filter(function (o) { return o.nome.toLowerCase() === nome.toLowerCase(); })[0];
      return { nome: nome, max: max, usati: Math.min(max, old ? old.usati : 0), recupero: /^b/i.test(p[2] || "") ? "breve" : "lungo" };
    });
    var arm = [];
    if (!semp) { if (x.b("arm_semplici")) arm.push("semplici"); if (x.b("arm_guerra")) arm.push("da_guerra"); if (x.b("arm_guerra_leggere")) arm.push("da_guerra_leggere"); }
    return { car_incantesimi: semp ? "" : x.g("car_incantesimi"), cd_incantesimi: x.n("cd_incantesimi"), att_incantesimi: x.n("att_incantesimi"),
      competenze_armi: arm, slot_totali: tot, slot_riposo: x.g("slot_riposo") || "lungo", risorse: ris };
  }
  function wzSlotRiassunto() {
    var info = classeInfo(WZ.classe), sl = slotSuggeriti(info, WZ.livello);
    if (!info) return '<p class="hint">Classe non riconosciuta: gli slot incantesimo li imposti dopo, dalla scheda.</p>';
    var txt = sl.tot.map(function (n, i) { return n ? n + " di " + (i + 1) + "° livello" : ""; }).filter(Boolean).join(", ");
    return '<p class="hint">' + (txt ? "Slot incantesimo: " + txt + (sl.riposo === "breve" ? " (si recuperano con il riposo breve)" : "") + ". Caratteristica da incantatore: " + ABK[info.car][1] + "." : "Questa classe non ha slot incantesimo al livello " + WZ.livello + ".") + "</p>";
  }

  // ---------------------------------------------------------------- azioni
  var ACT_INC = {
    turno: function (b) { var s = schedaPerId(b.dataset.id); if (!s) return; var t = copia(s.turno || {}); t[b.dataset.k] = !t[b.dataset.k]; gioco(s, { turno: t }); },
    "nuovo-turno": function (b) { var s = schedaPerId(b.dataset.id); if (s) gioco(s, { turno: {} }); },
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
      var disp = S.inc.filter(function (i) { return !gia[i.id]; }).sort(function (a, c) { return a.livello - c.livello || a.nome.localeCompare(c.nome, "it"); });
      modal("Aggiungi incantesimo", fld("inc", "Nome dell’incantesimo (scrivi per cercare)", "", 'list="listainc2" required autocomplete="off"') +
        '<datalist id="listainc2">' + disp.map(function (i) { return '<option value="' + esc(i.nome) + '">' + (i.livello === 0 ? "Trucchetto" : i.livello + "° livello") + "</option>"; }).join("") + "</datalist>" +
        sel("stato", "Stato", [["preparato", "Preparato"], ["sempre", "Sempre preparato (da un talento o una specie)"], ["non_preparato", "Non preparato"]], "preparato") +
        fld("fonte", "Fonte (es. Chierico, Magic Initiate)", "") +
        '<p><button type="button" class="link" data-act="nuovo-inc-scheda" data-id="' + s.id + '">Non è in elenco? Creane uno nuovo</button></p>', function (fd) {
        var nome = String(fd.get("inc") || "").trim().toLowerCase();
        var i = S.inc.filter(function (z) { return z.nome.trim().toLowerCase() === nome; })[0];
        if (!i) { toast("Non trovo questo incantesimo nella libreria: crealo con il link qui sotto.", true); return false; }
        return run(function () { return call("imposta_incantesimo_scheda", { p_scheda: s.id, p_inc: i.id, p_stato: fd.get("stato"), p_fonte: String(fd.get("fonte") || "") }); }, i.nome + " aggiunto")
          .then(function (r) { if (!r) return false; return caricaDati().then(disegnaTab); });
      }, "Aggiungi");
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
      var info = classeInfo(f.elements.classe.value), lv = Math.min(20, Math.max(1, Number(f.elements.livello.value) || 1));
      if (!info) { toast("Classe non riconosciuta: scrivi una delle dodici classi del manuale base.", true); return; }
      var sl = slotSuggeriti(info, lv);
      sl.tot.forEach(function (n, k) { f.elements["slot_" + (k + 1)].value = n; });
      f.elements.slot_riposo.value = sl.riposo;
      if (info.car && !f.elements.car_incantesimi.value) f.elements.car_incantesimi.value = info.car;
      if (!f.elements.arm_semplici.checked && !f.elements.arm_guerra.checked && !f.elements.arm_guerra_leggere.checked) {
        f.elements.arm_semplici.checked = info.armi.indexOf("semplici") >= 0; f.elements.arm_guerra.checked = info.armi.indexOf("da_guerra") >= 0; f.elements.arm_guerra_leggere.checked = info.armi.indexOf("da_guerra_leggere") >= 0;
      }
      toast("Valori proposti per " + info.n + " di livello " + lv + ": controllali.");
    }
  };
  Object.keys(ACT_INC).forEach(function (k) { ACT[k] = ACT_INC[k]; });

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
