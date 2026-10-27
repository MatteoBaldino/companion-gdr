/* =====================================================================
   js/battle/immagini.js
   Cosa fa:   Caricamento delle mappe: riduzione dell'immagine, caricamento
              nell'archivio privato e registrazione nel database.
   Contiene:  LATO_MASSIMO, QUALITA, uuid, riduciImmagine, caricaMappa
   L'ordine di caricamento è in battle.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- caricamento delle mappe
// [MODIFICA QUI] Lato più lungo di una mappa dopo la riduzione, e qualità: con 2048 e 0,85 una mappa pesa circa mezzo MB.
var LATO_MASSIMO = 2048;
var QUALITA = 0.85;

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  var a = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
}

// Riduce l'immagine e la trasforma in WebP (o JPEG se il browser non sa farlo). Restituisce { blob, w, h, ext }.
function riduciImmagine(file) {
  return new Promise(function (ok, ko) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var k = Math.min(1, LATO_MASSIMO / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      var cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        if (b && b.type === "image/webp") return ok({ blob: b, w: w, h: h, ext: "webp" });
        cv.toBlob(function (j) { j ? ok({ blob: j, w: w, h: h, ext: "jpg" }) : ko(new Error("Non riesco a ridurre l’immagine")); }, "image/jpeg", QUALITA);
      }, "image/webp", QUALITA);
    };
    img.onerror = function () { URL.revokeObjectURL(url); ko(new Error("Questo file non sembra un’immagine")); };
    img.src = url;
  });
}

// Riduce, carica nell'archivio e registra la mappa. Se la registrazione fallisce, toglie il file appena caricato.
function caricaMappa(file, nome) {
  if (file.size > 40 * 1024 * 1024) return Promise.reject(new Error("Il file è troppo grande (massimo 40 MB)"));
  var percorso;
  return riduciImmagine(file).then(function (r) {
    percorso = bCamp() + "/" + uuid() + "." + r.ext;
    return sb.storage.from("mappe").upload(percorso, r.blob, { contentType: r.blob.type || "image/" + r.ext, upsert: false }).then(function (u) {
      if (u.error) throw u.error;
      return call("salva_mappa", { p: { campagna_id: bCamp(), nome: nome, percorso: percorso, larghezza_px: r.w, altezza_px: r.h } });
    });
  }).catch(function (e) {
    if (percorso) sb.storage.from("mappe").remove([percorso]);
    throw e;
  });
}
