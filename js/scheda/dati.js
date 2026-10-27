/* =====================================================================
   js/scheda/dati.js
   Cosa fa:   Dati fissi della scheda: caratteristiche, abilità e le dodici
              classi (dado vita, tiri salvezza, abilità). Da controllare
              sul manuale.
   Contiene:  ABIL, SKILLS, SKILL, ABK, CLASSI
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

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
