/* =====================================================================
   js/scheda/dadi.js
   Cosa fa:   I tiri di dado della scheda: prove di caratteristica e di
              abilità, tiri salvezza, iniziativa, attacchi e danni (armi e
              incantesimi). I dadi hanno la loro sagoma e girano; con
              vantaggio e svantaggio il d20 scartato resta barrato; sul 20
              di un attacco il danno successivo raddoppia i dadi.
              Il risultato compare in un riquadro dentro la scheda, sopra le
              due colonne. Un attacco con un'arma segna l'azione del turno.
   Contiene:  dieSvg, leggiDanno, htmlTiro, aggiornaVant, creaTiro,
              mostraTiro, ACT.dado, ACT.vant
   Per ora il tiro lo vede solo chi lo fa: la chat con i tiri condivisi
   e segreti verrà dopo.
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- sagome dei dadi
function dieSvg(s) {
  var sh = "", ln = "";
  if (s === 4) {
    sh = '<polygon class="sh" points="50,8 94,86 6,86"/>';
    ln = '<polyline class="ln" points="50,8 50,62 6,86"/><polyline class="ln" points="50,62 94,86"/>';
  } else if (s === 6) {
    sh = '<rect class="sh" x="10" y="10" width="80" height="80" rx="14"/>';
  } else if (s === 8) {
    sh = '<polygon class="sh" points="50,4 92,50 50,96 8,50"/>';
    ln = '<polyline class="ln" points="8,50 92,50"/><polyline class="ln" points="50,4 50,96"/>';
  } else if (s === 10) {
    sh = '<polygon class="sh" points="50,4 92,42 50,96 8,42"/>';
    ln = '<polyline class="ln" points="8,42 50,58 92,42"/><polyline class="ln" points="50,58 50,96"/>';
  } else if (s === 12) {
    sh = '<polygon class="sh" points="50,5 95,38 78,92 22,92 5,38"/>';
    ln = '<polygon class="ln" points="50,30 72,46 64,72 36,72 28,46"/><path class="ln" d="M50 5L50 30M95 38L72 46M78 92L64 72M22 92L36 72M5 38L28 46"/>';
  } else {
    sh = '<polygon class="sh" points="50,4 92,27 92,73 50,96 8,73 8,27"/>';
    ln = '<polygon class="ln" points="50,22 80,72 20,72"/><path class="ln" d="M50 22L8 27M50 22L92 27M80 72L92 73M80 72L50 96M20 72L8 73M20 72L50 96"/>';
  }
  return '<svg viewBox="0 0 100 100" aria-hidden="true">' + sh + ln + "</svg>";
}

// ---------------------------------------------------------------- lettura del danno
// "1d8+3 perforanti" -> { gruppi: [{n:1, s:8}], piatto: 3 }. Si ferma al primo carattere che non è parte del calcolo.
function leggiDanno(txt) {
  var t = String(txt || "").replace(/−/g, "-");
  var expr = /^[0-9d+\-\s]*/.exec(t)[0], re = /([+-]?)\s*(\d+)(?:d(\d+))?/g, m, g = [], piatto = 0, trovato = false;
  while ((m = re.exec(expr))) {
    if (!m[0].trim()) { re.lastIndex++; continue; }
    trovato = true;
    if (m[3]) g.push({ n: Number(m[2]), s: Number(m[3]) });
    else piatto += (m[1] === "-" ? -1 : 1) * Number(m[2]);
  }
  return trovato ? { gruppi: g, piatto: piatto } : null;
}

// ---------------------------------------------------------------- vantaggio e svantaggio, e riquadro del risultato
// Il riquadro sta nella scheda e si ridisegna con lei: l'ultimo risultato è salvato in S.tiroHtml.
function htmlTiro() {
  var v = S.vant || "n";
  return '<div class="tirosez"><div class="vantbar" role="group" aria-label="Tipo del prossimo tiro"><span class="hint">Prossimo tiro:</span>' +
    [["n", "Normale"], ["v", "Vantaggio"], ["s", "Svantaggio"]].map(function (x) {
      return '<button class="small' + (v === x[0] ? " on" : "") + '" data-act="vant" data-v="' + x[0] + '" aria-pressed="' + (v === x[0]) + '">' + x[1] + "</button>";
    }).join("") + '</div><div class="rbox" id="tiroBox" aria-live="polite">' +
    (S.tiroHtml || '<span class="hint">Tocca una caratteristica, un’abilità, un tiro salvezza o un attacco: i dadi compaiono qui.</span>') + "</div></div>";
}
function aggiornaVant() {
  var v = S.vant || "n";
  Array.prototype.forEach.call(document.querySelectorAll('[data-act="vant"]'), function (b) {
    var on = b.dataset.v === v;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

// ---------------------------------------------------------------- il tiro
function tiraN(n) { return Math.floor(Math.random() * n) + 1; }

// o = { nome, titolo, tipo ("prova" | "att" | "dan"), gruppi: [{n, s}], mod, fisso, vant, doppio }
function creaTiro(o) {
  var dadi = [], coppia = null;
  (o.gruppi || []).forEach(function (g) {
    var n = g.n * (o.doppio ? 2 : 1);
    for (var j = 0; j < n; j++) {
      if (g.s === 20 && o.vant !== "n" && !coppia) {
        var a = { s: 20, v: tiraN(20) }, b = { s: 20, v: tiraN(20) };
        coppia = [a, b]; dadi.push(a, b);
      } else dadi.push({ s: g.s, v: tiraN(g.s) });
    }
  });
  if (coppia) {
    var tieniPrimo = o.vant === "v" ? coppia[0].v >= coppia[1].v : coppia[0].v <= coppia[1].v;
    coppia[tieniPrimo ? 1 : 0].scarto = true;
  }
  var tot = (o.mod || 0) + (o.fisso || 0), scartato = null;
  dadi.forEach(function (d) { if (d.scarto) scartato = d.v; else tot += d.v; });
  var d20 = dadi.filter(function (d) { return d.s === 20 && !d.scarto; })[0] || null;
  if (d20) { d20.stato = d20.v === 20 ? "crit" : d20.v === 1 ? "uno" : ""; }
  return {
    nome: o.nome, titolo: o.titolo, tipo: o.tipo, vant: o.vant, doppio: !!o.doppio,
    dadi: dadi, mod: o.mod || 0, fisso: o.fisso || 0, tot: tot, scartato: scartato,
    esito: d20 && o.tipo === "att" ? (d20.v === 20 ? "crit" : d20.v === 1 ? "fail" : "") : "",
    chiave: o.chiave || null, dan: o.dan || null, d20: d20 ? d20.v : null
  };
}

// ---------------------------------------------------------------- riquadro del risultato
var TIRO_TIMER = null;
function testoVant(v) { return v === "v" ? " · vantaggio" : v === "s" ? " · svantaggio" : ""; }
function salvaTiro() { var box = document.getElementById("tiroBox"); if (box) S.tiroHtml = box.innerHTML; }

function mostraTiro(t) {
  clearInterval(TIRO_TIMER);
  var box = document.getElementById("tiroBox");
  if (!box) return;
  var h = '<div class="tiro-h"><div><strong>' + esc(t.nome) + '</strong> <span class="hint">· ' + esc(t.titolo) + testoVant(t.vant) + '</span></div></div><div class="tiro-dadi">';
  t.dadi.forEach(function (d, i) {
    h += '<div class="dwrap"><div class="dado spin" data-s="' + d.s + '" id="td' + i + '">' + dieSvg(d.s) + '<span class="num">' + tiraN(d.s) + '</span></div><div class="dado-cap">d' + d.s + "</div></div>";
  });
  if (t.mod) h += '<div class="tiro-mod">' + sgn(t.mod) + "</div>";
  if (t.fisso && !t.dadi.length) h += '<div class="tiro-mod">' + t.fisso + "</div>";
  else if (t.fisso) h += '<div class="tiro-mod">' + sgn(t.fisso) + "</div>";
  h += '</div><div class="tiro-tot" id="tiroTot"></div>';
  box.innerHTML = h;
  S.tiroHtml = h;
  // Se il riquadro non si vede (la scheda è lunga), lo porto in vista.
  var r = box.getBoundingClientRect();
  if (r.top < 0 || r.bottom > (window.innerHeight || 800)) box.scrollIntoView({ block: "center", behavior: "smooth" });

  var t0 = Date.now(), fatto = false;
  t.dadi.forEach(function (d, i) { d.ferma = 550 + i * 200; d.finito = false; });
  function fine() {
    var testo = t.dadi.filter(function (d) { return !d.scarto; }).map(function (d) { return d.v; }).join(" + ");
    var mm = (t.mod ? " " + sgn(t.mod) : "") + (t.fisso && t.dadi.length ? " " + sgn(t.fisso) : "");
    var el = document.getElementById("tiroTot");
    if (!el) return;
    el.innerHTML = (t.dadi.length ? "Dadi: " + esc(testo) + esc(mm) + (t.scartato != null ? " (scartato " + t.scartato + ")" : "") + " =" : "Totale") + " <b>" + t.tot + "</b>" +
      (t.esito === "crit" ? ' <span class="esito crit">Critico! Il prossimo danno raddoppia i dadi.</span>' : "") +
      (t.esito === "fail" ? ' <span class="esito fail">Fallimento critico</span>' : "") +
      (t.doppio ? ' <span class="esito crit">dadi raddoppiati</span>' : "");
    // Dopo un tiro per colpire: la CA del bersaglio (facoltativa) dice se ha colpito; se sì, si tira il danno.
    if (t.tipo === "att" && !document.getElementById("caBers")) {
      var box2 = document.getElementById("tiroBox");
      if (box2) box2.insertAdjacentHTML("beforeend", '<div class="tiro-az"><label class="f"><span>CA del bersaglio (facoltativa)</span><input type="number" id="caBers" min="0" inputmode="numeric" value="' + esc(S.caBers || "") + '"></label>' +
        '<span id="tiroEsito" class="esito"></span>' +
        (t.dan ? '<button class="small primary" id="btnDanno" data-act="dado" data-k="dan" data-id="' + t.dan.id + '" data-r="' + t.dan.r + '">Tira il danno</button>' : "") + "</div>");
      TIRO_ATT = t; esitoColpo();
    }
  }
  if (!t.dadi.length) { fine(); salvaTiro(); return; }
  TIRO_TIMER = setInterval(function () {
    var ora = Date.now() - t0, tutti = true;
    t.dadi.forEach(function (d, i) {
      var el = document.getElementById("td" + i);
      if (!el || d.finito) return;
      var num = el.querySelector(".num");
      if (ora < d.ferma) { num.textContent = tiraN(d.s); tutti = false; return; }
      d.finito = true; num.textContent = d.v;
      el.classList.remove("spin");
      if (d.stato) el.classList.add(d.stato);
    });
    if (tutti && !fatto) {
      fatto = true; clearInterval(TIRO_TIMER);
      t.dadi.forEach(function (d, i) {
        var el = document.getElementById("td" + i);
        if (el && d.scarto) { el.classList.remove("crit", "uno"); el.classList.add("scarto"); el.nextSibling.textContent = "scartato"; }
      });
      setTimeout(function () { fine(); salvaTiro(); finisciTiro(t); }, 250);
    }
  }, 70);
}
// Colpito o mancato: il 20 naturale colpisce sempre, l'1 manca sempre, altrimenti conta il totale contro la CA scritta.
var TIRO_ATT = null;
function esitoColpo() {
  var t = TIRO_ATT, el = document.getElementById("tiroEsito"), btn = document.getElementById("btnDanno");
  if (!t || !el) return;
  var ca = Number(S.caBers);
  if (!S.caBers || isNaN(ca)) { el.textContent = "Se il totale supera la CA del bersaglio, tira il danno."; el.className = "esito"; if (btn) btn.hidden = false; salvaTiro(); return; }
  var colpito = t.d20 === 20 ? true : t.d20 === 1 ? false : t.tot >= ca;
  el.textContent = (colpito ? "Colpito" : "Mancato") + (t.d20 === 20 ? " (20 naturale: critico)" : t.d20 === 1 ? " (1 naturale)" : ": " + t.tot + " contro CA " + ca);
  el.className = "esito " + (colpito ? "crit" : "fail");
  if (btn) btn.hidden = !colpito;
  salvaTiro();
}
document.addEventListener("input", function (e) {
  if (e.target && e.target.id === "caBers") { S.caBers = e.target.value; e.target.setAttribute("value", e.target.value); esitoColpo(); }
});

// Dopo un attacco: sul 20 il danno di quell'arma raddoppia i dadi, altrimenti si azzera. Il pulsante del danno si ridisegna.
function finisciTiro(t) {
  if (t.tipo !== "att" || !t.chiave) return;
  S.crit = S.crit || {};
  var era = !!S.crit[t.chiave], ora = t.esito === "crit";
  if (era !== ora) { S.crit[t.chiave] = ora; if (S.me) disegnaTab(); }
}

// ---------------------------------------------------------------- pulsanti
ACT.vant = function (b) { S.vant = b.dataset.v; aggiornaVant(); };

ACT.dado = function (b) {
  var s = schedaPerId(b.dataset.id); if (!s) return;
  var key = keyDiScheda(s), k = b.dataset.k, v = b.dataset.v, bc = bonusComp(s.livello);
  var o = { nome: nomeHolder(key), vant: S.vant || "n", gruppi: [{ n: 1, s: 20 }], tipo: "prova", mod: 0 };
  if (k === "abil") { o.titolo = "Prova di " + ABK[v][1]; o.mod = mod(s[ABK[v][3]]); }
  else if (k === "ts") { o.titolo = "Tiro salvezza " + ABK[v][1]; o.mod = mod(s[ABK[v][3]]) + ((s.competenze_ts || []).indexOf(v) >= 0 ? bc : 0); }
  else if (k === "skill") { o.titolo = SKILL[v][1] + " (" + ABK[SKILL[v][2]][2] + ")"; o.mod = totaleAbilita(s, v); }
  else if (k === "ini") { o.titolo = "Iniziativa"; o.mod = mod(s.destrezza); }
  else if (k === "att" || k === "dan") {
    var r = attacchi(s, key)[Number(b.dataset.r)];
    if (!r) return;
    var ck = s.id + ":" + r.n;
    S.crit = S.crit || {};
    if (k === "att") {
      if (r.b == null) return;
      o.titolo = "Attacco: " + r.n; o.tipo = "att"; o.mod = r.b; o.chiave = ck;
      o.dan = r.dd ? { id: s.id, r: Number(b.dataset.r) } : null;   // dopo il tiro per colpire, il pulsante per tirare il danno
      // Un attacco con un'arma usa l'azione del turno; per gli incantesimi l'azione l'ha già usata "Lancia".
      if (!r.inc) {
        var tu = s.turno || {};
        if (tu.azione) {
          toast("Non puoi: attacco con " + r.n + ". L’azione è già usata in questo turno" + (typeof tu.azione === "string" ? " (" + tu.azione + ")" : "") + ". Se il master lo permette, tocca la cella Azione per liberarla.", true);
          return;
        }
        var nt = copia(tu); nt.azione = "Attacco: " + r.n;
        gioco(s, { turno: nt });
      }
    }
    else {
      if (!r.dd) return;
      o.titolo = (r.cura ? "Cura: " : "Danno: ") + r.n; o.tipo = "dan"; o.gruppi = r.dd.gruppi; o.fisso = r.dd.piatto;
      if (S.crit[ck]) { o.doppio = true; o.titolo += " (critico)"; S.crit[ck] = false; setTimeout(function () { if (S.me) disegnaTab(); }, 0); }
    }
  }
  else return;
  var usaD20 = o.gruppi.some(function (g) { return g.s === 20; });
  if (!usaD20) o.vant = "n";
  var t = creaTiro(o);
  if (usaD20 && S.vant && S.vant !== "n") { S.vant = "n"; aggiornaVant(); }
  mostraTiro(t);
};

// Dalla tastiera: Invio o spazio su una casella che si può tirare.
document.addEventListener("keydown", function (e) {
  var el = e.target;
  if ((e.key === "Enter" || e.key === " ") && el && el.getAttribute && el.getAttribute("data-act") === "dado" && el.tagName !== "BUTTON") {
    e.preventDefault(); el.click();
  }
});

// Se il sito non sa con quale caratteristica lanci, il tocco su «attacco» apre la scelta e la salva nella scheda.
ACT["scegli-car"] = function (b) {
  var s = schedaPerId(b.dataset.id); if (!s) return;
  modal("Caratteristica da incantatore: " + nomeHolder(keyDiScheda(s)),
    "<p>Per calcolare l’attacco e la CD degli incantesimi serve la caratteristica con cui lanci (di solito Intelligenza per il Mago, Saggezza per il Chierico, Carisma per lo Stregone).</p>" +
    sel("car", "Caratteristica", ABIL.map(function (a) { return [a[0], a[1]]; }), "int"),
    function (fd) {
      var p = payloadDaScheda(s); p.car_incantesimi = fd.get("car");
      return salvaScheda(p, "Caratteristica da incantatore salvata").then(function (id) { return id != null; });
    }, "Salva");
};
