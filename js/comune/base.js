/* =====================================================================
   js/comune/base.js
   Cosa fa:   Controlla la configurazione (config.js), crea il collegamento
              a Supabase e contiene le funzioni di servizio: testo sicuro,
              conversioni kg/lb e m/ft, date.
   Contiene:  CFG, root, configOk, sb, esc, one, num, U, imp, arr, dec,
              pesoShow, pesoUnit, pesoKg, distShow, distUnit, distM,
              fmtPeso, labelUnita, fmtData
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

var CFG = window.CONFIG || {};
var root = document.getElementById("app");

// [ATTENZIONE] Se manca la configurazione il sito mostra questo avviso e non parte: avvia.js controlla configOk.
var configOk = !(!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || /INCOLLA/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY));
if (!configOk) {
  root.innerHTML =
    '<main class="narrow"><h1>Manca la configurazione</h1>' +
    "<p>Apri il file <code>config.js</code> e incolla l’URL e la chiave anon del tuo progetto Supabase. I passaggi sono nel file README.md.</p></main>";
}
var sb = configOk ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

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
