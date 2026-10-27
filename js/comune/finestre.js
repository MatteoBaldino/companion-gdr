/* =====================================================================
   js/comune/finestre.js
   Cosa fa:   Finestre di dialogo e campi dei moduli (testo, area di testo,
              spunta, menu).
   Contiene:  modal, fld, area, chk, sel
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- finestre
function modal(titolo, corpo, onSubmit, okLabel) {
  var d = $("#dlg");
  d.innerHTML = '<form id="dlgForm" class="dlgform"><h2>' + esc(titolo) + "</h2>" + corpo +
    '<div class="dlgbar"><button type="button" class="ghost" data-close>Annulla</button><button class="primary" type="submit">' + esc(okLabel || "Salva") + "</button></div></form>";
  var f = $("#dlgForm", d);
  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var b = f.querySelector("button[type=submit]");
    b.disabled = true;
    Promise.resolve(onSubmit(new FormData(f), f)).then(function (ok) {
      if (ok === false) b.disabled = false; else d.close();
    });
  });
  $("[data-close]", d).addEventListener("click", function () { d.close(); });
  if (!d.open) d.showModal();
  return f;
}

function fld(name, label, val, extra, type) {
  return '<label class="f"><span>' + esc(label) + '</span><input type="' + (type || "text") + '" name="' + name + '" value="' + esc(val == null ? "" : val) + '" ' + (extra || "") + "></label>";
}
function area(name, label, val) {
  return '<label class="f"><span>' + esc(label) + '</span><textarea name="' + name + '">' + esc(val || "") + "</textarea></label>";
}
function chk(name, label, on) {
  return '<label class="c"><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + "><span>" + esc(label) + "</span></label>";
}
function sel(name, label, opts, val) {
  return '<label class="f"><span>' + esc(label) + '</span><select name="' + name + '">' +
    opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>";
}
