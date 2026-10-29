/* =====================================================================
   js/scheda/calcoli.js
   Cosa fa:   Calcoli della scheda: modificatori, bonus competenza, CA con
              armatura, scudo, elmo e protezioni, abilità.
   Contiene:  mod, sgn, bonusComp, fmtVel, classeInfo, schedaDi,
              schedaPerId, nomeHolder, keyDiScheda, postoArm, calcCA,
              totaleAbilita, riassunto
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

var mod = function (v) { return Math.floor((v - 10) / 2); };
var sgn = function (n) { return (n >= 0 ? "+" : "−") + Math.abs(n); };
var bonusComp = function (liv) { return 2 + Math.floor((liv - 1) / 4); };
var fmtVel = function (m) { return dec(distShow(m)) + " " + distUnit(); };
// Nomi inglesi delle classi, per le schede scritte come sul manuale in inglese.
var CLASSI_EN = { wizard: "mago", sorcerer: "stregone", warlock: "warlock", cleric: "chierico", druid: "druido", bard: "bardo", paladin: "paladino",
  ranger: "ranger", rogue: "ladro", fighter: "guerriero", barbarian: "barbaro", monk: "monaco" };
// Riconosce la classe dal testo scritto nella scheda: il nome esatto, il nome inglese, oppure una parola del testo
// (per esempio «Mago evocatore», «Stregone draconico», «Wizard»).
function classeInfo(testo) {
  var k = String(testo || "").trim().toLowerCase();
  if (!k) return null;
  for (var id in CLASSI) if (id === k || CLASSI[id].n.toLowerCase() === k) return CLASSI[id];
  if (CLASSI_EN[k]) return CLASSI[CLASSI_EN[k]];
  var parole = k.split(/[^a-zà-ÿ]+/);
  for (var i = 0; i < parole.length; i++) {
    if (CLASSI[parole[i]]) return CLASSI[parole[i]];
    if (CLASSI_EN[parole[i]]) return CLASSI[CLASSI_EN[parole[i]]];
  }
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
  if (s.ca_manuale != null) return { tot: s.ca_manuale, desc: s.tipo === "semplificata" ? "" : "valore fisso", parts: s.tipo === "semplificata" ? [] : ["Valore fisso, scritto a mano nella scheda"] };
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
  return { tot: tot, desc: parts.join(", "), parts: parts };
}
function totaleAbilita(s, k) {
  var lv = (s.abilita || {})[k] || 0;
  return mod(s[ABK[SKILL[k][2]][3]]) + lv * bonusComp(s.livello);
}
function riassunto(s, key) {
  var ca = calcCA(s, key).tot;
  if (s.tipo === "semplificata") return "Scheda semplificata" + (s.sfida ? ", grado di sfida " + s.sfida : "") + ", CA " + ca + ", PF " + s.pf_attuali + "/" + s.pf_max;
  return [descriviClassi(s), "livello " + s.livello].filter(Boolean).join(" ") + ", CA " + ca + ", PF " + s.pf_attuali + "/" + s.pf_max;
}
