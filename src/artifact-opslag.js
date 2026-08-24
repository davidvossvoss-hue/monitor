/* Opslag voor de gedeelde versie: de pagina schrijft zichzelf weg.
   Elke wijziging gaat direct naar dit toestel (localStorage) en, zodra je
   even niets doet, naar de gedeelde link zelf. De nieuwste van de twee wint
   bij het openen, dus je kunt op je telefoon verder waar je laptop stopte. */
(function (root) {
  'use strict';

  var FONTS = '__FONTS__';
  var SCHIL = '__SCHIL__';
  var SLEUTEL_UI = 'monitor-ui';

  root.GEDEELDE_OPSLAG = true;

  var origLaden = root.Opslag.laden;
  var origBewaren = root.Opslag.bewaren;

  function ingebakken() {
    var e = document.getElementById('staat');
    if (!e) return null;
    try {
      var d = JSON.parse(e.textContent || 'null');
      return d && (d.transacties || d.instellingen) ? d : null;
    } catch (err) { return null; }
  }

  // De nieuwste van (deze link) en (dit toestel) wint.
  root.Opslag.laden = function () {
    var lokaal = null;
    try { lokaal = JSON.parse(localStorage.getItem(root.Opslag.SLEUTEL) || 'null'); } catch (e) { /* leeg */ }
    var link = ingebakken();
    var winnaar = link;
    if (lokaal && (!link || (lokaal.bewaardOp || 0) > (link.bewaardOp || 0))) winnaar = lokaal;
    if (winnaar) {
      try { localStorage.setItem(root.Opslag.SLEUTEL, JSON.stringify(winnaar)); } catch (e) { /* vol */ }
    }
    return origLaden.call(root.Opslag);
  };

  root.Opslag.bewaren = function (data) {
    data.bewaardOp = Date.now();
    origBewaren.call(root.Opslag, data);
    plan();
  };

  // ---------------------------------------------------------------- UI-staat
  try {
    var u = JSON.parse(localStorage.getItem(SLEUTEL_UI) || 'null');
    if (u && u.tab) root.beginUI = { tab: u.tab, maand: u.maand };
  } catch (e) { /* niks */ }

  function bewaarUI() {
    if (!root.App) return;
    try {
      localStorage.setItem(SLEUTEL_UI, JSON.stringify({
        tab: root.App.ui.tab, maand: root.App.ui.maand, scroll: window.scrollY
      }));
    } catch (e) { /* niks */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      try {
        var u = JSON.parse(localStorage.getItem(SLEUTEL_UI) || 'null');
        if (u && u.scroll) window.scrollTo(0, u.scroll);
      } catch (e) { /* niks */ }
    }, 0);
  });

  // ------------------------------------------------------------- indicator
  var lampje;
  function toon(klas, tekst, blijf) {
    if (!lampje) lampje = document.getElementById('opslag');
    if (!lampje) return;
    lampje.className = 'opslag zichtbaar ' + klas;
    lampje.lastChild.textContent = tekst;
    clearTimeout(toon.t);
    if (!blijf) toon.t = setTimeout(function () { lampje.className = 'opslag ' + klas; }, 2200);
  }

  // -------------------------------------------------------------- publiceren
  var artefact = null, gevraagd = false, bezig = false, vuil = false, klok = null;

  if (root.claude && root.claude.use) {
    gevraagd = true;
    root.claude.use('artifact').then(function (a) {
      artefact = a;
      if (!a) toon('mis', 'alleen op dit toestel');
      else if (vuil) plan();
    }).catch(function () { toon('mis', 'alleen op dit toestel'); });
  }

  function inVeld() {
    var a = document.activeElement;
    return !!a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
  }

  function plan() {
    vuil = true;
    bewaarUI();
    toon(gevraagd ? 'bezig' : 'mis', gevraagd ? 'opslaan…' : 'alleen op dit toestel');
    clearTimeout(klok);
    klok = setTimeout(probeer, 3000);
  }

  function probeer() {
    if (!vuil || bezig) return;
    if (!artefact) { if (gevraagd) { klok = setTimeout(probeer, 2000); } return; }
    if (inVeld()) { klok = setTimeout(probeer, 2500); return; } // niet midden in het typen
    bezig = true;
    bewaarUI();
    artefact.publish(bouwDocument()).then(function () {
      vuil = false; bezig = false;
      toon('klaar', 'opgeslagen op de link');
    }).catch(function (e) {
      bezig = false;
      var code = e && e.code;
      if (code === 'conflict') toon('mis', 'elders bijgewerkt', true);
      else if (code === 'not_granted' || code === 'not_writer') { artefact = null; toon('mis', 'alleen-lezen: bewaard op dit toestel', true); }
      else toon('mis', 'opslaan mislukt — staat wel op dit toestel', true);
    });
  }

  // Een gepubliceerde pagina kan geen bestand aanbieden via een gewone link:
  // dat loopt via de downloads-capability, met een bevestiging voor de viewer.
  // Daarom hier altijd de link-fallback vervangen, ook als downloads ontbreekt.
  var downloads = null;
  root.bewaarBestand = function (naam, inhoud) {
    if (!downloads) { toon('mis', 'downloaden kan hier niet — je gegevens staan in de link', true); return; }
    downloads.save({ filename: naam, data: inhoud }).then(function () {
      toon('klaar', 'bestand opgeslagen');
    }).catch(function (e) {
      var c = e && e.code;
      toon('mis', c === 'declined' ? 'download geannuleerd' : 'downloaden lukte niet', true);
    });
  };
  if (root.claude && root.claude.use) {
    root.claude.use('downloads').then(function (d) { downloads = d; })
      .catch(function () { /* blijft null */ });
  }

  window.addEventListener('pagehide', bewaarUI);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { bewaarUI(); }
    else if (vuil) { clearTimeout(klok); klok = setTimeout(probeer, 1200); }
  });

  // Tik op het lampje = nu opslaan.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#opslag')) { clearTimeout(klok); probeer(); }
  });

  // ------------------------------------------------------------ de pagina zelf
  // Wordt opgebouwd uit de bron van deze pagina (stijl + code, ongewijzigd)
  // plus de huidige gegevens. Nooit uit de getekende DOM.
  function bouwDocument() {
    function bron(id) {
      var e = document.getElementById(id);
      return e ? e.textContent : '';
    }
    var eind = '</' + 'script>';
    var data = JSON.stringify(root.App.state()).replace(/</g, '\\u003c');
    return '<!doctype html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<meta name="color-scheme" content="dark">\n<title>Geldmonitor</title>\n' +
      FONTS + '\n<style id="stijl">' + bron('stijl') + '</style>\n</head>\n<body>\n' +
      SCHIL + '\n' +
      '<script id="pdf-worker" type="text/plain">' + bron('pdf-worker') + eind + '\n' +
      '<script id="pdf-main" type="module">' + bron('pdf-main') + eind + '\n' +
      '<script id="staat" type="application/json">' + data + eind + '\n' +
      '<script id="code">' + bron('code') + eind + '\n</body>\n</html>';
  }
})(window);
