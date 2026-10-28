/* =====================================================================
   js/scheda/dati-incantesimi.js
   Cosa fa:   Tabelle degli slot per livello, dati extra delle classi e
              calcoli per incantesimi e attacchi. Da controllare sul
              manuale.
   Contiene:  PIENO, MEZZO, PATTO, CLASSI_EXTRA, TEMPI, LIV_INC, fmtDist,
              uguali, slotSuggeriti, incPerId, incDiScheda, statInc,
              scalaDadi, dannoInc, gittataInc, competenteArma
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

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
// Se nella scheda non è scelta la caratteristica da incantatore, la ricavo dalla classe (anche per il Ladro Mistificatore Arcano
// e il Guerriero Cavaliere Mistico, che lanciano con Intelligenza): così attacco e CD si calcolano comunque.
function carInferita(s) {
  var nomi = classiIncantatore(s);
  for (var k = 0; k < nomi.length; k++) { var info = classeInfo(nomi[k]); if (info && info.car) return info.car; }
  return null;
}
function statInc(s) {
  var car = s.car_incantesimi || carInferita(s);
  var bc = bonusComp(s.livello), m = (s.tipo === "completa" && car && ABK[car]) ? mod(s[ABK[car][3]]) : null;
  return {
    car: car, mod: m,
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
// Le liste di incantesimi da cui può scegliere una scheda: le classi scritte nel campo Classe (anche più di una, separate da / , + & o "e"),
// più la lista del Mago per il Ladro Mistificatore Arcano e il Guerriero Cavaliere Mistico. Restituisce i nomi delle classi, es. ["Mago", "Chierico"].
function classiIncantatore(s) {
  var nomi = [], sotto = String(s.sottoclasse || "").toLowerCase();
  String(s.classe || "").split(/\s*[\/,+&;]\s*|\s+e\s+/i).forEach(function (p) {
    var info = classeInfo(p.replace(/\d+/g, "").trim());
    if (!info) return;
    if (info.inc) nomi.push(info.n);
    else if (info.n === "Ladro" && sotto.indexOf("arcan") >= 0) nomi.push("Mago");
    else if (info.n === "Guerriero" && sotto.indexOf("mistic") >= 0) nomi.push("Mago");
  });
  return nomi.filter(function (n, k) { return nomi.indexOf(n) === k; });
}
// Le classi che hanno questo incantesimo nella propria lista (dal campo Classi dell'incantesimo).
function classiDiInc(i) {
  return String(i.classi || "").split(/\s*[,;\/]\s*|\s+e\s+/i).map(function (x) { return x.trim(); }).filter(Boolean);
}
// La fonte dell'incantesimo per questa scheda: la prima delle sue classi che ha l'incantesimo in lista ("" se nessuna).
function fonteAuto(s, i) {
  var sue = classiDiInc(i).map(function (x) { return x.toLowerCase(); });
  return classiIncantatore(s).filter(function (n) { return sue.indexOf(n.toLowerCase()) >= 0; })[0] || "";
}
function gittataInc(i) { return i.gittata_speciale || (i.gittata_m != null ? fmtDist(i.gittata_m) : "—"); }
function competenteArma(s, a, prop) {
  var c = s.competenze_armi || [], leg = prop.indexOf("accurata") >= 0 || prop.indexOf("finesse") >= 0 || prop.indexOf("leggera") >= 0;
  if (a.categoria_arma === "altro") return true;
  if (a.categoria_arma === "semplice") return c.indexOf("semplici") >= 0 || c.indexOf("da_guerra") >= 0;
  return c.indexOf("da_guerra") >= 0 || (c.indexOf("da_guerra_leggere") >= 0 && leg);
}
