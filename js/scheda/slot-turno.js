/* =====================================================================
   js/scheda/slot-turno.js
   Cosa fa:   Turno (azione, bonus, reazione, movimento), riposi,
              concentrazione, slot incantesimo e risorse.
   Contiene:  htmlTurno, htmlSlot, htmlRisorse
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- turno, concentrazione, riposi
function htmlTurno(s) {
  if (!S.incOk) return "";
  var t = s.turno || {};
  // Una cella del turno: verde se libera, tratteggiata se usata (con scritto cosa l'ha usata).
  var cella = function (k, l) {
    var u = t[k], det = typeof u === "string" ? u : (u ? "segnata a mano" : "");
    return '<button class="cella ' + (u ? "usata" : "libera") + '" data-act="turno" data-id="' + s.id + '" data-k="' + k + '" aria-pressed="' + !!u + '">' +
      '<span class="lbl">' + l + "</span><strong>" + (u ? "Usata" : "Disponibile") + "</strong><small>" + (det ? esc(det) : "&nbsp;") + "</small></button>";
  };
  // Movimento: metri rimasti, con un campo per scrivere quanti ne togli o ne ridai.
  var tot = Number(s.velocita) || 0, usati = Math.min(tot, Number(t.mov) || 0), resta = Math.max(0, tot - usati);
  var mov = '<div class="cella ' + (resta > 0 ? "libera" : "usata") + '"><span class="lbl">Movimento</span><strong>' + fmtVel(resta) + "</strong><small>su " + fmtVel(tot) + "</small>" +
    '<div class="mv"><button class="small" data-act="mov" data-id="' + s.id + '" data-d="-" aria-label="Togli distanza">−</button>' +
    '<input type="text" inputmode="decimal" id="mv_' + s.id + '" value="' + dec(distShow(1.5)) + '" aria-label="Distanza da togliere o ridare">' +
    '<button class="small" data-act="mov" data-id="' + s.id + '" data-d="+" aria-label="Ridai distanza">+</button></div></div>';
  return '<div class="gioco"><div class="turnocelle" role="group" aria-label="Turno">' + cella("azione", "Azione") + cella("bonus", "Azione bonus") + cella("reazione", "Reazione") + mov + "</div>" +
    '<div class="row"><button class="small" data-act="nuovo-turno" data-id="' + s.id + '">Nuovo turno</button>' +
    '<button class="small" data-act="riposo-breve" data-id="' + s.id + '">Riposo breve</button><button class="small" data-act="riposo-lungo" data-id="' + s.id + '">Riposo lungo</button></div>' +
    (s.concentrazione ? '<p class="conc"><strong>In concentrazione:</strong> ' + esc(s.concentrazione) + ' <button class="link" data-act="conc-fine" data-id="' + s.id + '">Termina</button></p>' : "") + "</div>";
}

// ---------------------------------------------------------------- slot e risorse
function htmlSlot(s) {
  var tot = s.slot_totali || [], us = s.slot_usati || [];
  if (!tot.some(function (n) { return n > 0; })) return "";
  var h = "<h3>Slot incantesimo" + (s.slot_riposo === "breve" ? " (si recuperano con il riposo breve)" : "") + '</h3><div class="slots">';
  tot.forEach(function (n, lv) {
    if (n <= 0) return;
    var pips = "";
    for (var i = 0; i < n; i++) {
      var u = i < (us[lv] || 0);
      pips += '<button class="pip' + (u ? " usato" : "") + '" data-act="slot" data-id="' + s.id + '" data-lv="' + lv + '" data-i="' + i + '" aria-pressed="' + u + '" aria-label="Slot di livello ' + (lv + 1) + ", numero " + (i + 1) + (u ? ", usato" : ", disponibile") + '"></button>';
    }
    h += '<div class="slotriga"><span class="slotlv">' + (lv + 1) + '°</span><span class="pips">' + pips + "</span><small>" + (n - (us[lv] || 0)) + " di " + n + "</small></div>";
  });
  return h + "</div>";
}
function htmlRisorse(s) {
  var r = s.risorse || [];
  if (!r.length) return "";
  return "<h3>Risorse</h3><div class=\"slots\">" + r.map(function (x, k) {
    var pips = "";
    if (x.max <= 10) for (var i = 0; i < x.max; i++) {
      var u = i < x.usati;
      pips += '<button class="pip' + (u ? " usato" : "") + '" data-act="risorsa" data-id="' + s.id + '" data-k="' + k + '" data-i="' + i + '" aria-pressed="' + u + '" aria-label="' + esc(x.nome) + ", uso " + (i + 1) + (u ? ", usato" : ", disponibile") + '"></button>';
    }
    else pips = '<button class="small" data-act="risorsa-meno" data-id="' + s.id + '" data-k="' + k + '">−</button> <strong>' + (x.max - x.usati) + "</strong> " +
      '<button class="small" data-act="risorsa-piu" data-id="' + s.id + '" data-k="' + k + '">+</button>';
    return '<div class="slotriga"><span class="slotlv nome">' + esc(x.nome) + '</span><span class="pips">' + pips + "</span><small>" + (x.max - x.usati) + " di " + x.max + ", riposo " + (x.recupero === "breve" ? "breve" : "lungo") + "</small></div>";
  }).join("") + "</div>";
}
