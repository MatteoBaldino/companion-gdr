/* =====================================================================
   js/app/avvio.js
   Cosa fa:   Avvio del sito, scelta della pagina da mostrare, accesso e
              registrazione, elenco delle campagne, ingresso in una
              campagna.
   Contiene:  boot, route, viewAuth, viewCampagne
   L'ordine di caricamento è in index.html: conta, non cambiarlo.
   ===================================================================== */
"use strict";

// ---------------------------------------------------------------- avvio
function boot() {
  sb.auth.getSession().then(function (r) {
    S.user = r.data.session ? r.data.session.user : null;
    sb.auth.onAuthStateChange(function (ev, s) {
      var u = s ? s.user : null;
      if ((u && u.id) !== (S.user && S.user.id)) { S.user = u; S.me = null; route(); }
    });
    route();
  });
}
function route() {
  clearInterval(S.timer);
  if (!S.user) return viewAuth("login");
  if (!S.me) return viewCampagne();
  return viewApp();
}

// ---------------------------------------------------------------- accesso
function viewAuth(mode) {
  var login = mode === "login";
  root.innerHTML =
    '<main class="auth"><div class="auth-box"><h1>Companion GDR</h1>' +
    '<p class="lead">L’inventario del vostro gruppo: armi, armature, cibo e oggetti, con ogni passaggio di mano registrato.</p>' +
    '<form data-form="auth" data-mode="' + mode + '">' +
    '<label class="f"><span>Email</span><input name="email" type="email" required autocomplete="email"></label>' +
    '<label class="f"><span>Password</span><input name="password" type="password" required minlength="6" autocomplete="' + (login ? "current-password" : "new-password") + '"></label>' +
    '<p class="err" id="autherr" role="alert"></p>' +
    '<button class="primary" type="submit">' + (login ? "Accedi" : "Crea account") + "</button></form>" +
    '<p class="alt">' + (login
      ? 'Non hai un account? <button class="link" data-act="auth-mode" data-mode="signup">Registrati</button>'
      : 'Hai già un account? <button class="link" data-act="auth-mode" data-mode="login">Accedi</button>') +
    "</p></div></main>";
}

function viewCampagne() {
  root.innerHTML = '<main class="narrow"><p class="boot">Caricamento…</p></main>';
  sb.from("giocatori")
    .select("id, nome, ruolo, campagna_id, campagne(id, nome, codice_invito)")
    .eq("user_id", S.user.id).order("id")
    .then(function (r) {
      if (r.error) { toast(errText(r.error), true); return; }
      var mems = r.data || [];
      // [REGOLA] Solo al caricamento della pagina: se hai premuto «Cambia campagna» l'elenco si mostra sempre.
      var tentaAuto = S.auto; S.auto = false;
      var ult = leggiUltima();
      if (tentaAuto && ult && ult.utente === S.user.id) {
        var m0 = mems.filter(function (m) { return m.id === ult.mem; })[0];
        if (m0) { S.mems = mems; S.me = m0; S.ripristino = ult; route(); return; }
      }
      var lista = mems.length
        ? '<ul class="camp-list">' + mems.map(function (m) {
            var c = one(m.campagne) || {};
            return "<li><span><strong>" + esc(c.nome) + "</strong><br><span class=\"hint\">" +
              (m.ruolo === "master" ? "Sei il master" : "Giochi come " + esc(m.nome)) +
              '</span></span><button class="primary small" data-act="entra" data-id="' + m.id + '">Entra</button></li>';
          }).join("") + "</ul>"
        : '<p class="muted">Non fai ancora parte di nessuna campagna. Creane una come master oppure entra con il codice che ti ha dato il master.</p>';
      S.mems = mems;
      root.innerHTML =
        '<main class="narrow stack"><div class="row" style="justify-content:space-between;align-items:baseline"><h1>Le tue campagne</h1>' +
        '<button class="ghost small" data-act="esci">Esci</button></div>' + lista +
        '<form data-form="crea-campagna"><h2>Crea una campagna</h2>' +
        '<label class="f"><span>Nome della campagna</span><input name="nome" type="text" required></label>' +
        '<label class="f"><span>Il tuo nome (master)</span><input name="mio" type="text" required></label>' +
        '<button class="primary" type="submit">Crea campagna</button></form>' +
        '<form data-form="unisciti"><h2>Entra con un codice</h2>' +
        '<label class="f"><span>Codice invito</span><input name="codice" type="text" required autocapitalize="characters" maxlength="12"></label>' +
        '<label class="f"><span>Nome del tuo personaggio</span><input name="nome" type="text" required></label>' +
        '<button class="primary" type="submit">Entra nella campagna</button></form></main>';
    });
}
