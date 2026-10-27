/* =====================================================================
   js/comune/messaggi.js
   Cosa fa:   Messaggi a schermo, traduzione degli errori in italiano,
              chiamata alle funzioni del database ed esecuzione protetta
              delle azioni.
   Contiene:  toastTimer, toast, ERR_AUTH, errText, call, run
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

var toastTimer;
function toast(msg, isErr) {
  var t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (isErr ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.className = ""; }, isErr ? 6000 : 2600);
}

var ERR_AUTH = {
  "Invalid login credentials": "Email o password non corrette.",
  "User already registered": "Esiste già un account con questa email.",
  "Email not confirmed": "Conferma prima l’email dal messaggio che ti abbiamo mandato.",
  "Password should be at least 6 characters.": "La password deve avere almeno 6 caratteri."
};
function errText(e) {
  var m = e && e.message ? e.message : "Qualcosa è andato storto. Riprova.";
  if (ERR_AUTH[m]) return ERR_AUTH[m];
  if (/duplicate key|violates unique/.test(m)) return "Questo elemento esiste già.";
  if (/violates check constraint/.test(m)) return "Un valore non è ammesso: controlla i campi numerici e quelli obbligatori.";
  if (/violates foreign key/.test(m)) return "Non si può farlo: l’elemento è collegato ad altri dati.";
  if (/row-level security/.test(m)) return "Non hai il permesso di farlo.";
  return m;
}
function call(name, args) {
  return sb.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; });
}
// Esegue un’azione mostrando l’esito; restituisce {v} se riuscita, null se fallita.
function run(fn, okMsg) {
  return Promise.resolve().then(fn).then(function (v) {
    if (okMsg) toast(okMsg);
    return { v: v };
  }, function (e) {
    toast(errText(e), true);
    return null;
  });
}
