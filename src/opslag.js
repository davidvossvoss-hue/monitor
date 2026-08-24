/* Alles blijft op dit toestel. Geen account, geen bankkoppeling. */
(function (root) {
  'use strict';
  var SLEUTEL = 'monitor-v2';

  function leeg() {
    return {
      transacties: [],
      bestanden: [],
      handmatig: {},          // {transactieId: categorie} — jouw keuze wint altijd
      geleerd: {},            // {tegenpartij: categorie} — één keer indelen, daarna onthouden
      instellingen: {
        rekeningen: [],       // {patroon, naam, rol: 'eigen'|'gezamenlijk'|'zakelijk'}
        startSaldi: { oorlogskas: 0, autopot: 0, beleggen: 0 },
        oorlogskasMaanden: 6,
        oorlogskasDoelHandmatig: null,
        autopotPctNaOorlogskas: 60,
        autopotNaastOorlogskas: false,
        autopotDeelNaast: 30,
        rendementPct: 7,
        projectieJaren: 20,
        strengerExtraPerMaand: 250,
        gewenstMaandinkomen: 3000,
        opnamePct: 4,
        wekenPerMaand: 4.33,
        negeerMaanden: [],
        autoLadder: JSON.parse(JSON.stringify(root.Rekenen.STANDAARD_LADDER)),
        streef: {}
      }
    };
  }

  function laden() {
    try {
      var ruw = localStorage.getItem(SLEUTEL);
      if (!ruw) return leeg();
      var d = JSON.parse(ruw), basis = leeg();
      d.instellingen = Object.assign({}, basis.instellingen, d.instellingen || {});
      d.instellingen.startSaldi = Object.assign({}, basis.instellingen.startSaldi, d.instellingen.startSaldi || {});
      d.transacties = d.transacties || [];
      d.bestanden = d.bestanden || [];
      d.handmatig = d.handmatig || {};
      d.geleerd = d.geleerd || {};
      return d;
    } catch (e) {
      console.warn('Opslag onleesbaar, opnieuw begonnen.', e);
      return leeg();
    }
  }

  function bewaren(d) {
    try { localStorage.setItem(SLEUTEL, JSON.stringify(d)); }
    catch (e) { console.warn('Kon niet opslaan.', e); }
  }
  function wissen() { localStorage.removeItem(SLEUTEL); }

  root.Opslag = { laden: laden, bewaren: bewaren, wissen: wissen, leeg: leeg, SLEUTEL: SLEUTEL };
})(window);
