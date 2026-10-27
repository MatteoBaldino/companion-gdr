/* =====================================================================
   js/comune/costanti.js
   Cosa fa:   Categorie degli oggetti, tipi di armatura, monete Drakos
              (conversione da e verso il rame) ed elenco dei dati letti con
              ogni oggetto.
   Contiene:  CATS, CAT, MOD, ARMAT, TIPO_MOV, MONETE, fmtRame, dividiRame,
              OGG_SEL
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

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
