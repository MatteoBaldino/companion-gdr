/* =====================================================================
   js/scheda/menu-opzioni.js
   Cosa fa:   Menu a tendina con «Altro…» per specie, background e classe,
              con i relativi elenchi.
   Contiene:  SPECIE, BACKGROUND, NOMI_CLASSI, ALTRO, campoOpz, valOpz
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- menu a tendina per specie, background e classe
// [MODIFICA QUI] Gli elenchi di specie e background: sono i nomi del manuale 2024 in italiano, scritti da me.
// Se nella tua campagna si chiamano in un altro modo, o ne usi di inventate, cambiali qui oppure usa «Altro…» nel menu.
var SPECIE = ["Aasimar", "Dragonide", "Elfo", "Gnomo", "Goliath", "Halfling", "Nano", "Orco", "Tiefling", "Umano"];
var BACKGROUND = ["Accolito", "Artigiano", "Ciarlatano", "Contadino", "Criminale", "Eremita", "Guardia", "Guida", "Intrattenitore",
  "Marinaio", "Mercante", "Nobile", "Sapiente", "Scriba", "Soldato", "Viandante"];
var NOMI_CLASSI = Object.keys(CLASSI).map(function (k) { return CLASSI[k].n; }).sort(function (a, b) { return a.localeCompare(b, "it"); });
var ALTRO = "__altro__";
// Menu a tendina con la voce «Altro…»: scegliendola compare un campo dove scrivere. Un valore già salvato che non è
// in elenco (per esempio una classe inventata) riapre il menu su «Altro…» con il testo al suo posto.
function campoOpz(name, label, lista, val) {
  var v = val == null ? "" : String(val).trim();
  var trovato = lista.filter(function (o) { return o.toLowerCase() === v.toLowerCase(); })[0];
  var altro = v !== "" && !trovato;
  return '<label class="f"><span>' + esc(label) + '</span><select name="' + name + '" data-altro="1">' +
    '<option value="">— scegli —</option>' +
    lista.map(function (o) { return '<option value="' + esc(o) + '"' + (o === trovato ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") +
    '<option value="' + ALTRO + '"' + (altro ? " selected" : "") + ">Altro…</option></select>" +
    '<input type="text" name="' + name + '_altro" value="' + esc(altro ? v : "") + '" placeholder="Scrivi qui" aria-label="' + esc(label) + ' (altro)"' + (altro ? "" : " hidden") + "></label>";
}
// Valore scelto in un modulo già aperto (se è «Altro…» vale il testo scritto).
function valOpz(f, name) {
  var sl = f.elements[name];
  if (!sl) return "";
  return sl.value === ALTRO ? String((f.elements[name + "_altro"] || {}).value || "").trim() : sl.value;
}
// Scegliendo «Altro…» compare il campo di testo; scegliendo altro sparisce.
document.addEventListener("change", function (e) {
  var t = e.target;
  if (!t || !t.getAttribute || !t.getAttribute("data-altro") || !t.form) return;
  var inp = t.form.elements[t.name + "_altro"];
  if (inp) { inp.hidden = t.value !== ALTRO; if (t.value === ALTRO) inp.focus(); }
});
