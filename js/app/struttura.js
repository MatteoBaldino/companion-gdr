/* =====================================================================
   js/app/struttura.js
   Cosa fa:   Struttura della pagina (testata e schede in alto),
              caricamento di tutti i dati da Supabase, aggiornamento ogni
              20 secondi e disegno della sezione scelta.
   Contiene:  viewApp, tabsDef, tuttiOggetti, caricaDati, aggiorna,
              disegnaTab, segnaLette
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- struttura
function viewApp() {
  var c = one(S.me.campagne) || {};
  root.innerHTML =
    '<header class="top"><div class="top-in"><div><h1>' + esc(c.nome) + '</h1><div class="who">' +
    (isMaster() ? "Master" : esc(S.me.nome)) + "</div></div>" +
    '<div class="tools">' +
    (isMaster() ? '<span>Codice invito <code>' + esc(c.codice_invito) + "</code></span>" : "") +
    '<a class="btn" href="battle.html">Battle map</a>' +
      '<button id="btnUnita" data-act="unita">' + labelUnita() + '</button><button data-act="cambia">Cambia campagna</button><button data-act="esci">Esci</button></div></div>' +
    '<nav class="tabs" id="tabs" aria-label="Sezioni"></nav></header>' +
    '<main class="wrap" id="main"><p class="boot">Caricamento…</p></main>';
  S.tab = isMaster() ? "libreria" : "scheda";
  var rp = S.ripristino; S.ripristino = null;
  if (rp && rp.mem === S.me.id && tabsDef().some(function (t) { return t[0] === rp.tab; })) {
    S.tab = rp.tab;
    if (isMaster() && rp.tab === "schede" && rp.scheda) S.schedaAperta = rp.scheda;
  }
  S.oggOk = false;                       // cambiando campagna gli oggetti si rileggono da capo
  caricaDati().then(function () {
    disegnaTab();
    S.timer = setInterval(aggiorna, 20000);
  });
}

function tabsDef() {
  if (isMaster()) return [["libreria", "Libreria"], ["personaggi", "Personaggi"], ["schede", "Schede"], ["incantesimi", "Incantesimi"], ["storico", "Storico"], ["listino", "Listino prezzi"]];
  var n = S.notif.filter(function (x) { return !x.letta; }).length;
  return [["scheda", "Scheda"], ["inventario", "Inventario"], ["notifiche", "Notifiche" + (n && S.tab !== "notifiche" ? ' <span class="badge-n">' + n + "</span>" : "")]];
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
  // Listino dei servizi: lo legge solo il master (per i giocatori il database non lo mostra: non lo si chiede nemmeno)
  // (se l'aggiornamento SQL manca, la lista resta vuota)
  var qs = isMaster()
    ? sb.from("servizi").select("*").eq("campagna_id", c).order("tipologia").order("nome").limit(300)
    : Promise.resolve({ data: [], error: null });
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
  if (document.querySelector("#main details[open]")) return;   // una tendina aperta (monete, peso): non la chiudo ridisegnando
  caricaDati().then(disegnaTab);
}

function disegnaTab() {
  var main = $("#main");
  if (!main) return;
  salvaUltima();
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
