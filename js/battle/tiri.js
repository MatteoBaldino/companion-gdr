/* =====================================================================
   js/battle/tiri.js
   Cosa fa:   I tiri condivisi nella Battle map: il dado che compare sopra
              la mappa (con la sagoma giusta), la cronologia degli eventi e
              la tenda «Dadi» per i tiri liberi.
   Contiene:  TI, nomeDado, valoreDado, testoVis, caricaTiri, unisciTiro,
              mostraSuMappa, disegnaDadoMappa, disegnaCron, montaTenda,
              syncTenda, tiraLibero, azioneTiri, avviaTiri, dopoTiro
   Chi vede un tiro lo decide il database (tabella «tiri»): questa pagina
   mostra solo quello che riceve.
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- stato dei tiri
var TI = {
  lista: [], mostrato: null, tenda: false, cron: false, attivo: true, errore: "",
  vis: "master", n: 1, die: "20", mod: 0, tn: false, tnv: 10,     // tenda «Dadi»; vis: come tira il master
  timer: null, canale: null
};
var TI_VIS = [["tutti", "Tutti"], ["master", "Master"], ["segreto", "Segreto"]];

function nomeDado(s) { return s === 3 ? "dF" : "d" + s; }
function valoreDado(d) { return d.s === 3 ? (d.v > 0 ? "+" : d.v < 0 ? "\u2212" : "0") : String(d.v); }
// Il tiro si vede a tutti, oppure è nascosto: «master» (lo vedono il master e chi ha tirato) o «segreto» (solo il master).
function tiroNascosto(r) { return r.vis !== "tutti" && !r.rivelato; }
function testoVis(r) {
  if (!tiroNascosto(r)) return "Visibile a tutti";
  if (r.vis === "segreto") return "Segreto · solo master";
  if (bMaster()) return r.da_master ? "Nascosto · solo master" : "Nascosto · richiesto dal master";
  return "Nascosto · lo vedete solo tu e il master";
}
// «14 + 6 (scartato 5) +6 = 20»
function testoTiro(r) {
  var tenuti = r.dadi.filter(function (d) { return !d.scarto; }), sc = r.dadi.filter(function (d) { return d.scarto; })[0];
  var mm = (r.bonus ? " " + sgn(r.bonus) : "") + (r.fisso ? (tenuti.length ? " " + sgn(r.fisso) : String(r.fisso)) : "");
  return (tenuti.length ? tenuti.map(valoreDado).join(" + ") : "") + mm + (sc ? " (scartato " + valoreDado(sc) + ")" : "") + " = " + r.totale;
}

// ---------------------------------------------------------------- lettura e tempo reale
function caricaTiri() {
  return sb.from("tiri").select("*").eq("campagna_id", bCamp()).order("id", { ascending: false }).limit(80).then(function (r) {
    if (r.error) { TI.attivo = false; TI.errore = errText(r.error); return null; }
    TI.attivo = true;
    return r.data || [];
  });
}
// Un tiro nuovo si mostra sopra la mappa; uno già noto si aggiorna soltanto (ma se il master lo rivela agli altri, compare).
function unisciTiro(riga, anima) {
  var i = -1;
  TI.lista.forEach(function (x, k) { if (x.id === riga.id) i = k; });
  if (i < 0) { TI.lista.push(riga); TI.lista.sort(function (a, b) { return b.id - a.id; }); }
  else {
    var prima = TI.lista[i]; TI.lista[i] = riga;
    anima = anima && !bMaster() && !prima.rivelato && riga.rivelato;
  }
  if (anima) mostraSuMappa(riga);
  else if (TI.mostrato && TI.mostrato.id === riga.id) { TI.mostrato = riga; disegnaDadoMappa(false); }
  disegnaCron();
}
// Dopo ogni rilettura: i tiri recenti che non conoscevamo sono nuovi (si animano), il resto si sostituisce in silenzio.
function riallinea(anima) {
  return caricaTiri().then(function (righe) {
    if (!righe) { disegnaCron(); return; }
    var noti = {}, ora = Date.now();
    TI.lista.forEach(function (x) { noti[x.id] = true; });
    var nuovi = righe.filter(function (r) { return !noti[r.id] && ora - new Date(r.creato).getTime() < 30000; }).sort(function (a, b) { return a.id - b.id; });
    TI.lista = righe;
    if (TI.mostrato) { var ancora = righe.filter(function (r) { return r.id === TI.mostrato.id; })[0]; TI.mostrato = ancora || null; }
    if (anima && nuovi.length) mostraSuMappa(nuovi[nuovi.length - 1]);
    else disegnaDadoMappa(false);
    disegnaCron();
  });
}
function dopoTiro() { riallinea(true); }           // chiamata da dadi.js dopo aver salvato un tiro dalla scheda
function avviaTiri() {
  var c = bCamp(), f = "campagna_id=eq." + c;
  riallinea(false);
  var ch = sb.channel("tiri-" + c);
  ["INSERT", "UPDATE"].forEach(function (ev) {
    ch.on("postgres_changes", { event: ev, schema: "public", table: "tiri", filter: f }, function (p) { if (p && p.new) unisciTiro(p.new, true); else riallinea(true); });
  });
  ch.subscribe();
  TI.canale = ch;
  // Rete di sicurezza: se il tempo reale non fosse attivo, ogni 15 secondi si rileggono i tiri.
  setInterval(function () { riallinea(true); }, 15000);
  montaTenda();
}

// ---------------------------------------------------------------- il dado sopra la mappa
function mostraSuMappa(r) { TI.mostrato = r; disegnaDadoMappa(true); }

function disegnaDadoMappa(animare) {
  var el = $("#dadoMappa"); if (!el) return;
  clearInterval(TI.timer);
  var r = TI.mostrato;
  if (!r) { el.hidden = true; el.innerHTML = ""; return; }
  var nasc = tiroNascosto(r);
  el.hidden = false;
  el.className = "dadomappa" + (nasc ? " nascosto" : "");
  var h = '<button type="button" class="chiudi" data-b="chiudiDado" aria-label="Chiudi il tiro">×</button>' +
    '<div class="tiro-h"><div><strong>' + esc(r.autore) + '</strong> <span class="hint">· ' + esc(r.titolo) + '</span></div></div><div class="tiro-dadi">';
  r.dadi.forEach(function (d, i) {
    var stato = animare ? " spin" : (d.scarto ? " scarto" : (d.s === 20 && d.v === 20 ? " crit" : d.s === 20 && d.v === 1 ? " uno" : ""));
    h += '<div class="dwrap"><div class="dado' + stato + '" data-s="' + d.s + '" id="dm' + i + '">' + dieSvg(d.s) + '<span class="num">' + (animare ? tiraN(d.s === 3 ? 6 : d.s) : valoreDado(d)) + '</span></div><div class="dado-cap">' + (d.scarto ? "scartato" : nomeDado(d.s)) + "</div></div>";
  });
  if (r.bonus) h += '<div class="tiro-mod">' + sgn(r.bonus) + "</div>";
  if (r.fisso) h += '<div class="tiro-mod">' + (r.dadi.length ? sgn(r.fisso) : r.fisso) + "</div>";
  h += '</div><div class="tiro-tot" id="dmTot"></div><div class="vis' + (nasc ? " nasc" : "") + '">' + esc(testoVis(r)) + "</div>" +
    (nasc && bMaster() ? '<button type="button" class="small" data-b="mostraTiro" data-id="' + r.id + '">Mostra a tutti</button>' : "");
  el.innerHTML = h;

  function fine() {
    var tot = $("#dmTot"); if (!tot) return;
    tot.innerHTML = (r.dadi.length ? esc(testoTiro(r).replace(/ = -?\d+$/, "")) + " =" : "Totale") + " <b>" + r.totale + "</b>" +
      (r.esito === "crit" ? ' <span class="esito crit">Critico!</span>' : "") +
      (r.esito === "fail" ? ' <span class="esito fail">Fallimento critico</span>' : "") +
      (r.doppio ? ' <span class="esito crit">dadi raddoppiati</span>' : "");
  }
  if (!animare || !r.dadi.length) { fine(); return; }
  var t0 = Date.now();
  TI.timer = setInterval(function () {
    var ora = Date.now() - t0, tutti = true;
    r.dadi.forEach(function (d, i) {
      var dd = $("#dm" + i); if (!dd || dd.dataset.fermo) return;
      var num = dd.querySelector(".num");
      if (ora < 550 + i * 200) { num.textContent = tiraN(d.s === 3 ? 6 : d.s); tutti = false; return; }
      dd.dataset.fermo = "1"; num.textContent = valoreDado(d); dd.classList.remove("spin");
      if (d.scarto) dd.classList.add("scarto"); else if (d.s === 20 && d.v === 20) dd.classList.add("crit"); else if (d.s === 20 && d.v === 1) dd.classList.add("uno");
    });
    if (tutti) { clearInterval(TI.timer); fine(); }
  }, 70);
}

// ---------------------------------------------------------------- cronologia degli eventi
function disegnaCron() {
  var c = $("#cron"); if (!c) return;
  var righe = "";
  if (!TI.attivo) righe = '<p class="hint">I tiri condivisi non sono ancora attivi: esegui aggiornamento_tiri.sql in Supabase. (' + esc(TI.errore) + ")</p>";
  else if (!TI.lista.length) righe = '<p class="hint">Ancora nessun tiro.</p>';
  else righe = '<ol class="cl">' + TI.lista.map(function (r) {
    var nasc = tiroNascosto(r);
    return "<li" + (nasc ? ' class="nasc"' : "") + '><span class="t"><strong>' + esc(r.autore) + "</strong> · " + esc(r.titolo) + " — " + esc(testoTiro(r)) + "</span>" +
      (nasc ? '<span class="vis nasc">' + esc(testoVis(r)) + "</span>" + (bMaster() ? '<button type="button" class="small" data-b="mostraTiro" data-id="' + r.id + '">Mostra</button>' : "") : "") + "</li>";
  }).join("") + "</ol>";
  c.innerHTML = '<button type="button" class="cb" data-b="cron" aria-expanded="' + TI.cron + '"><span>Cronologia eventi</span><span aria-hidden="true">' + (TI.cron ? "▾" : "▴") + "</span></button>" +
    (TI.cron ? righe + (bMaster() && TI.lista.length ? '<div class="row"><button type="button" class="small" data-b="svuotaTiri">Svuota la cronologia</button></div>' : "") : "");
}

// ---------------------------------------------------------------- tenda «Dadi» (tiri liberi)
var DADI_TENDA = [[4, "D4"], [6, "D6"], [8, "D8"], [10, "D10"], [12, "D12"], [20, "D20"], [100, "D100"], [3, "Fudge"]];
function montaTenda() {
  var t = $("#tenda"); if (!t) return;
  t.innerHTML = '<div class="tenda-h"><h2>Dadi</h2><button type="button" class="chiudi" data-b="tenda" aria-label="Chiudi i dadi">×</button></div>' +
    (bMaster() ? '<div class="seg" id="tVis" role="group" aria-label="Chi vede il tiro">' + TI_VIS.map(function (x) {
      return '<button type="button" data-b="tvis" data-v="' + x[0] + '">' + x[1] + "</button>";
    }).join("") + "</div>" : "") +
    '<p class="hint" id="tHint"></p><h3>Tiro di base</h3><div class="dg">' + DADI_TENDA.map(function (x) {
      return '<button type="button" data-b="tbase" data-d="' + x[0] + '" aria-label="Tira ' + x[1] + '"><span class="dado ico" data-s="' + x[0] + '">' + dieSvg(x[0]) + "</span><span>" + x[1] + "</span></button>";
    }).join("") + '</div><h3>Tiro avanzato</h3><div class="avanzato">' +
    '<label class="sr" for="tN">Quanti dadi</label><input type="number" id="tN" min="1" max="20" value="1">' +
    '<label class="sr" for="tDie">Che dado</label><select id="tDie">' + DADI_TENDA.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === 20 ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select>" +
    '<span aria-hidden="true">+</span><label class="sr" for="tMod">Modificatore</label><input type="number" id="tMod" min="-20" max="20" value="0"></div>' +
    '<div class="avanzato"><label class="chk"><input type="checkbox" id="tTn"> Numero bersaglio?</label><label class="sr" for="tTnv">Numero bersaglio</label><input type="number" id="tTnv" min="1" max="60" value="10" hidden></div>' +
    '<button type="button" class="primary" data-b="tira">Tira</button>';
  t.addEventListener("change", function (e) { if (e.target.id === "tTn") $("#tTnv").hidden = !e.target.checked; });
  syncTenda();
}
// Come tira chi apre la tenda: il master sceglie lui; un giocatore tira come ha deciso il master per lui (di solito «tutti»).
function visLibera() {
  if (bMaster()) return TI.vis;
  var sc = typeof schedaDi === "function" ? schedaDi("g:" + B.me.id) : null;
  return (sc && sc.turno && sc.turno.vis) || "tutti";
}
function syncTenda() {
  var t = $("#tenda"); if (!t) return;
  t.hidden = !TI.tenda;
  Array.prototype.forEach.call(t.querySelectorAll("#tVis button"), function (b) { b.className = b.dataset.v === TI.vis ? "on" : ""; b.setAttribute("aria-pressed", b.dataset.v === TI.vis); });
  var v = visLibera();
  $("#tHint").textContent = v === "tutti" ? "Il tiro compare sulla mappa per tutti."
    : v === "segreto" ? "Solo il master vede il risultato." : bMaster() ? "Solo il master vede il tiro, finché non lo mostri a tutti." : "Tiro nascosto richiesto dal master: lo vedete solo tu e il master.";
  var bt = document.querySelector('[data-b="tenda"][aria-pressed]');
  if (bt) bt.setAttribute("aria-pressed", TI.tenda);
}
var clampN = function (v, a, b, d) { v = Math.round(Number(v)); return isNaN(v) ? d : Math.min(b, Math.max(a, v)); };
function tiraLibero(s, n, mod, tn) {
  var dadi = [], tot = mod, i;
  for (i = 0; i < n; i++) { var v = s === 3 ? Math.floor(Math.random() * 3) - 1 : tiraN(s); dadi.push({ s: s, v: v }); tot += v; }
  var titolo = "Tiro libero · " + (n > 1 ? n : "") + nomeDado(s) + (mod ? sgn(mod) : "") + (tn ? " · bersaglio " + tn + ": " + (tot >= tn ? "successo" : "fallimento") : "");
  var vis = visLibera();
  registraTiro({ titolo: titolo, dadi: dadi, mod: mod, fisso: 0, esito: "", vant: "n", doppio: false }, vis, bMaster() ? "Master" : "").then(function () {
    if (vis === "segreto" && !bMaster()) toast("Tiro segreto: il risultato lo vede solo il master.");
  });
}

// ---------------------------------------------------------------- pulsanti
// Restituisce vero se il pulsante era uno di questi.
function azioneTiri(a, b) {
  if (a === "tenda") { TI.tenda = !TI.tenda; syncTenda(); return true; }
  if (a === "tvis") { TI.vis = b.dataset.v; syncTenda(); return true; }
  if (a === "tbase") { tiraLibero(Number(b.dataset.d), 1, 0, null); return true; }
  if (a === "tira") {
    var n = clampN($("#tN").value, 1, 20, 1), s = Number($("#tDie").value), m = clampN($("#tMod").value, -20, 20, 0);
    tiraLibero(s, n, m, $("#tTn").checked ? clampN($("#tTnv").value, 1, 60, 10) : null);
    return true;
  }
  if (a === "cron") { TI.cron = !TI.cron; disegnaCron(); return true; }
  if (a === "chiudiDado") { clearInterval(TI.timer); TI.mostrato = null; disegnaDadoMappa(false); return true; }
  if (a === "mostraTiro") {
    run(function () { return call("mostra_tiro", { p_id: Number(b.dataset.id) }); }, "Tiro mostrato a tutti").then(function (r) { if (r) riallinea(false); });
    return true;
  }
  if (a === "svuotaTiri") {
    modal("Svuotare la cronologia?", "<p>Tutti i tiri salvati per questa campagna verranno cancellati, per tutti.</p>", function () {
      return run(function () { return call("cancella_tiri", { p_camp: bCamp() }); }, "Cronologia svuotata").then(function (r) { if (!r) return false; TI.mostrato = null; return riallinea(false); });
    }, "Svuota");
    return true;
  }
  return false;
}
