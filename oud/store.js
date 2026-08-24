/* Opslag. Alles lokaal in de browser. Geen account, geen cloud. */
(function (root) {
  'use strict';
  var SLEUTEL = 'salaris-monitor-v1';

  function leeg() {
    return {
      instellingen: JSON.parse(JSON.stringify(root.Model.STANDAARD_INSTELLINGEN)),
      maanden: [],
      reserveringen: [],
      voorschotten: []
    };
  }

  function laden() {
    try {
      var ruw = localStorage.getItem(SLEUTEL);
      if (!ruw) return leeg();
      var d = JSON.parse(ruw);
      var basis = leeg();
      d.instellingen = Object.assign({}, basis.instellingen, d.instellingen || {});
      d.instellingen.startSaldi = Object.assign({}, basis.instellingen.startSaldi, d.instellingen.startSaldi || {});
      d.maanden = d.maanden || [];
      d.reserveringen = d.reserveringen || [];
      d.voorschotten = d.voorschotten || [];
      return d;
    } catch (e) {
      console.warn('Opslag onleesbaar, opnieuw begonnen.', e);
      return leeg();
    }
  }

  function bewaren(data) {
    try { localStorage.setItem(SLEUTEL, JSON.stringify(data)); }
    catch (e) { console.warn('Kon niet opslaan.', e); }
  }

  function wissen() { localStorage.removeItem(SLEUTEL); }

  function id() {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  root.Store = { laden: laden, bewaren: bewaren, wissen: wissen, leeg: leeg, id: id, SLEUTEL: SLEUTEL };
})(window);
