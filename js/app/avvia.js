/* =====================================================================
   js/app/avvia.js
   Cosa fa:   Ultimo file: collega i clic e l'invio dei moduli alle azioni
              e fa partire il sito (solo se config.js è a posto).
   Contiene:  (solo istruzioni che collegano le altre parti)
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

document.addEventListener("click", function (e) {
  var b = e.target.closest("[data-act]");
  if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b);
});
document.addEventListener("submit", function (e) {
  var f = e.target.closest("form[data-form]");
  if (f && FORMS[f.dataset.form]) { e.preventDefault(); FORMS[f.dataset.form](f); }
});

if (configOk) boot();
