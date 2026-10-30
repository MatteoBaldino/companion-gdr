/* =====================================================================
   js/scheda/dadi.js
   Cosa fa:   I tiri di dado della scheda: prove di caratteristica e di
              abilità, tiri salvezza, iniziativa, attacchi e danni (armi e
              incantesimi). I dadi hanno la loro sagoma e girano; con
              vantaggio e svantaggio il d20 scartato resta barrato; sul 20
              di un attacco il danno successivo raddoppia i dadi.
              Il risultato compare in un riquadro dentro la scheda, sopra le
              due colonne. Un attacco con un'arma segna l'azione del turno.
              Ogni tiro viene anche salvato nel database (tabella «tiri»):
              nella Battle map compare sopra la mappa e nella cronologia.
   Contiene:  dieSvg, leggiDanno, htmlVisTiro, htmlTiro, aggiornaVant, visTiro,
              registraTiro, esitoColpo, htmlColpo, creaTiro, mostraTiro, testoMorte, applicaMorte,
              ACT.dado, ACT.vant, ACT["vis-master"], ACT["vis-pg"]
   Chi vede un tiro: «tutti», «master» (il master e chi ha tirato) o «segreto»
   (solo il master). Un giocatore tira come ha deciso il master per lui; il
   master, quando tira per un NPC, sceglie lui (di solito resta nascosto).
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- sagome dei dadi
function dieSvg(s) {
  var sh = "", ln = "";
  if (s === 4) {
    sh = '<polygon class="sh" points="50,8 94,86 6,86"/>';
    ln = '<polyline class="ln" points="50,8 50,62 6,86"/><polyline class="ln" points="50,62 94,86"/>';
  } else if (s === 6 || s === 3) {
    sh = '<rect class="sh" x="10" y="10" width="80" height="80" rx="14"/>';
  } else if (s === 8) {
    sh = '<polygon class="sh" points="50,4 92,50 50,96 8,50"/>';
    ln = '<polyline class="ln" points="8,50 92,50"/><polyline class="ln" points="50,4 50,96"/>';
  } else if (s === 10 || s === 100) {
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
// Chi vede i tiri di questa scheda. Il master sceglie per sé (NPC) o per un giocatore; il giocatore vede solo cosa ha deciso il master.
function htmlVisTiro(s, key) {
  var gruppo = function (cur, act, id, lista, nome) {
    return '<div class="vantbar" role="group" aria-label="' + nome + '"><span class="hint">' + nome + ':</span>' + lista.map(function (x) {
      return '<button class="small' + (cur === x[0] ? " on" : "") + '" data-act="' + act + '" data-v="' + x[0] + '"' + (id ? ' data-id="' + id + '"' : "") + ' aria-pressed="' + (cur === x[0]) + '">' + x[1] + "</button>";
    }).join("") + "</div>";
  };
  if (isMaster() && key.charAt(0) === "p")
    return gruppo(S.visMaster || "master", "vis-master", "", [["tutti", "Tutti"], ["master", "Solo master"], ["segreto", "Segreto"]], "Chi vede i tuoi tiri");
  if (isMaster())
    return gruppo((s.turno || {}).vis || "tutti", "vis-pg", s.id, [["tutti", "Tutti"], ["master", "Nascosti"], ["segreto", "Segreti"]], "Tiri di questo giocatore");
  var v = (s.turno || {}).vis || "tutti";
  if (v === "tutti") return "";
  return '<p class="hint">' + (v === "segreto" ? "Il master ha chiesto tiri segreti: il risultato lo vede solo lui." : "Il master ha chiesto tiri nascosti: li vedete solo tu e il master.") + "</p>";
}
function htmlTiro(s, key) {
  var v = S.vant || "n";
  return '<div class="tirosez"><div class="vantbar" role="group" aria-label="Tipo del prossimo tiro"><span class="hint">Prossimo tiro:</span>' +
    [["n", "Normale"], ["v", "Vantaggio"], ["s", "Svantaggio"]].map(function (x) {
      return '<button class="small' + (v === x[0] ? " on" : "") + '" data-act="vant" data-v="' + x[0] + '" aria-pressed="' + (v === x[0]) + '">' + x[1] + "</button>";
    }).join("") + "</div>" + (s ? htmlVisTiro(s, key || "") : "") + '<div class="rbox" id="tiroBox" aria-live="polite">' +
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

// ---------------------------------------------------------------- condividere il tiro
// Chi vede il tiro di questa scheda: il master, quando tira per un NPC, decide lui (di solito resta nascosto);
// per un PG vale quello che il master ha chiesto per quel giocatore (di solito «tutti»).
function visTiro(s, key) {
  if (isMaster() && key.charAt(0) === "p") return S.visMaster || "master";
  return (s.turno || {}).vis || "tutti";
}
// Salva il tiro nel database. t: { titolo, dadi:[{s,v,scarto}], mod, fisso, esito, vant, doppio }.
// Se l'aggiornamento SQL dei tiri non è stato eseguito il tiro resta solo sulla tua scheda, e te lo dico una volta.
function registraTiro(t, vis, nome) {
  if (!S.me || typeof call !== "function") return Promise.resolve(null);
  var p = {
    campagna_id: campId(), nome: nome || "", titolo: t.titolo + (typeof testoVant === "function" ? testoVant(t.vant) : ""), vis: vis,
    dadi: t.dadi.map(function (d) { return { s: d.s, v: d.v, scarto: !!d.scarto }; }),
    bonus: t.mod || 0, fisso: t.fisso || 0, esito: t.esito || "", vant: t.vant || "n", doppio: !!t.doppio
  };
  return call("registra_tiro", { p: p }).then(function (id) {
    if (typeof dopoTiro === "function") dopoTiro(id);   // la Battle map rilegge subito i tiri
    return id;
  }, function (e) {
    if (!S.tiriAvviso) { S.tiriAvviso = true; toast("Il tiro non è stato condiviso: " + errText(e) + " (serve aggiornamento_tiri.sql)", true); }
    return null;
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
    chiave: o.chiave || null, dan: o.dan || null, d20: d20 ? d20.v : null, sid: o.sid || null
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
      (t.doppio ? ' <span class="esito crit">dadi raddoppiati</span>' : "") +
      (t.tipo === "morte" ? ' <span class="esito ' + (t.d20 >= 10 ? "crit" : "fail") + '">' + testoMorte(t.d20) + "</span>" : "") +
      htmlColpo(t);
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
// Dopo un attacco: sul 20 il danno di quell'arma raddoppia i dadi, altrimenti si azzera. Il pulsante del danno si ridisegna.
// Cosa dice il dado in un tiro contro morte.
function testoMorte(v) {
  return v === 20 ? "20 naturale: torni a 1 PF e riprendi i sensi" : v === 1 ? "1 naturale: due fallimenti" : v >= 10 ? "Successo" : "Fallimento";
}
// Segna da solo il risultato sulla scheda quando i dadi si sono fermati.
function applicaMorte(t) {
  var s = schedaPerId(t.sid); if (!s) return;
  var v = t.d20, m = morteDi(s);
  if (v === 20) { gioco(s, { pf_attuali: 1 }, "20 naturale: torni a 1 PF e riprendi i sensi"); return; }   // gioco() azzera i tiri contro morte
  if (v === 1) m.f = Math.min(3, m.f + 2); else if (v >= 10) m.s = Math.min(3, m.s + 1); else m.f = Math.min(3, m.f + 1);
  scriviMorte(s, m).then(function () {
    if (m.f >= 3) toast("Tre fallimenti: il personaggio è morto.", true);
    else if (m.s >= 3) toast("Tre successi: sei stabilizzato.");
  });
}
function finisciTiro(t) {
  if (t.tipo === "morte") { applicaMorte(t); return; }
  if (t.tipo !== "att" || !t.chiave) return;
  S.crit = S.crit || {};
  var era = !!S.crit[t.chiave], ora = t.esito === "crit";
  if (era !== ora) { S.crit[t.chiave] = ora; if (S.me) disegnaTab(); }
}

// ---------------------------------------------------------------- colpito o mancato
// Sotto un attacco: la CA del bersaglio (facoltativa) e il pulsante del danno. Il 20 naturale colpisce sempre e l'1 manca sempre;
// altrimenti conta il totale contro la CA scritta. Se non scrivi la CA il pulsante c'è comunque.
function esitoColpo(d20, tot, ca) {
  if (d20 === 20) return { miss: false, testo: "20 naturale: colpisce sempre" };
  if (d20 === 1) return { miss: true, testo: "1 naturale: manca" };
  if (ca === "" || isNaN(Number(ca))) return { miss: false, testo: "Scrivi la CA per vedere se colpisci" };
  return Number(tot) >= Number(ca) ? { miss: false, testo: "Colpito" } : { miss: true, testo: "Mancato" };
}
function htmlColpo(t) {
  if (t.tipo !== "att" || !t.dan) return "";
  var e = esitoColpo(t.d20, t.tot, "");
  return '<div class="colpo" data-d20="' + t.d20 + '" data-tot="' + t.tot + '"><label class="hint" for="tiroCa">CA del bersaglio (facoltativa)</label> ' +
    '<input type="number" id="tiroCa" class="ca-in" min="0" max="40" inputmode="numeric"> <span class="esito" id="tiroColpo">' + esc(e.testo) + "</span> " +
    '<button class="small primary" id="tiroDanno" data-act="dado" data-k="dan" data-id="' + t.dan.id + '" data-r="' + t.dan.r + '"' + (e.miss ? " hidden" : "") + ">Tira il danno</button></div>";
}
// Scrivendo la CA il risultato cambia subito. Si salva anche nell'HTML, così il riquadro ridisegnato ricorda cosa avevi scritto.
document.addEventListener("input", function (ev) {
  var i = ev.target;
  if (!i || i.id !== "tiroCa") return;
  var c = i.closest(".colpo"); if (!c) return;
  var e = esitoColpo(Number(c.dataset.d20), Number(c.dataset.tot), i.value);
  i.setAttribute("value", i.value);
  var r = document.getElementById("tiroColpo"), b = document.getElementById("tiroDanno");
  if (r) { r.textContent = e.testo; r.className = "esito" + (e.miss ? " fail" : (i.value !== "" || Number(c.dataset.d20) === 20 ? " crit" : "")); }
  if (b) b.hidden = e.miss;
  salvaTiro();
});

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
  else if (k === "morte") {
    var md = morteDi(s);
    if (Number(s.pf_attuali) > 0) { toast("Hai più di 0 PF: non serve un tiro contro morte."); return; }
    if (md.s >= 3 || md.f >= 3) return;
    o.titolo = "Tiro contro morte"; o.tipo = "morte"; o.vant = "n"; o.sid = s.id;   // nessun vantaggio né svantaggio, nessun modificatore
  }
  else if (k === "att" || k === "dan") {
    var r = attacchi(s, key)[Number(b.dataset.r)];
    if (!r) return;
    var ck = s.id + ":" + r.n;
    S.crit = S.crit || {};
    if (k === "att") {
      if (r.b == null) return;
      o.titolo = "Attacco: " + r.n; o.tipo = "att"; o.mod = r.b; o.chiave = ck;
      o.dan = r.dd ? { id: s.id, r: Number(b.dataset.r) } : null;   // dopo il tiro per colpire, il pulsante per tirare il danno
      // In combattimento, un attacco con un'arma usa l'azione del turno; per gli incantesimi l'azione l'ha già usata "Lancia". Fuori dal combattimento non si consuma nulla.
      if (!r.inc && inCombattimento(s)) {
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
  if (usaD20 && o.tipo !== "morte" && S.vant && S.vant !== "n") { S.vant = "n"; aggiornaVant(); }
  var vis = visTiro(s, key);
  registraTiro(t, vis, o.nome);
  // Tiro segreto di un giocatore: parte per il master, a te non compare niente (né il risultato né i suoi effetti sulla scheda).
  if (vis === "segreto" && !isMaster()) { toast("Tiro segreto: il risultato lo vede solo il master."); return; }
  mostraTiro(t);
};

// Chi vede i tiri: scelta del master (per i suoi NPC oppure per un giocatore).
ACT["vis-master"] = function (b) { S.visMaster = b.dataset.v; disegnaTab(); };
ACT["vis-pg"] = function (b) {
  var s = schedaPerId(b.dataset.id); if (!s) return;
  var t = copia(s.turno || {});
  if (b.dataset.v === "tutti") delete t.vis; else t.vis = b.dataset.v;
  gioco(s, { turno: t });
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
