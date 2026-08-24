/* De planner. Rekent niet met een verzonnen budget maar met wat je gemeten
   uitgeeft. De enige knop is een streefbedrag per categorie; het verschil
   tussen gemeten en streef is precies wat je aan je doelen toevoegt.       */
(function (root) {
  'use strict';
  var R = root.Rekenen || (typeof require === 'function' ? require('./rekenen.js') : null);
  var C = root.Categorie || (typeof require === 'function' ? require('./categorie.js') : null);
  var A = root.Analyse || (typeof require === 'function' ? require('./analyse.js') : null);

  var STANDAARD = {
    oorlogskasMaanden: 6,
    oorlogskasDoelHandmatig: null,
    autopotPctNaOorlogskas: 60,
    rendementPct: 7,
    projectieJaren: 20,
    gewenstMaandinkomen: 3000,
    opnamePct: 4,
    wekenPerMaand: 4.33,
    startSaldi: { oorlogskas: 0, autopot: 0, beleggen: 0 },
    autoLadder: R.STANDAARD_LADDER,
    streef: {},              // {categorieId: bedrag per maand}
    negeerMaanden: []        // half ingelezen maanden tellen niet mee
  };

  function rond(n) { return Math.round(n * 100) / 100; }

  // Geld dat overblijft verdeelt zich in strikte volgorde over de potjes.
  function verdeel(ruimte, standOorlogskas, doelOorlogskas, inst) {
    var over = Math.max(0, ruimte);
    var tekort = Math.max(0, doelOorlogskas - standOorlogskas);
    var naarOorlogskas = Math.min(over, tekort);
    var rest = over - naarOorlogskas;
    var naarAutopot = rest * R.getal(inst.autopotPctNaOorlogskas) / 100;
    return {
      oorlogskas: rond(naarOorlogskas),
      autopot: rond(naarAutopot),
      beleggen: rond(rest - naarAutopot),
      tekort: ruimte < 0 ? rond(-ruimte) : 0
    };
  }

  function plan(analyse, instellingen) {
    var inst = Object.assign({}, STANDAARD, instellingen || {});
    inst.startSaldi = Object.assign({}, STANDAARD.startSaldi, (instellingen || {}).startSaldi || {});

    var maanden = analyse.maanden.filter(function (m) {
      return (inst.negeerMaanden || []).indexOf(m.maand) < 0;
    });
    if (!maanden.length) {
      return { leeg: true, reden: 'Nog geen volledige maand ingelezen.' };
    }

    function gemiddeld(veld) {
      return rond(maanden.reduce(function (t, m) { return t + m[veld]; }, 0) / maanden.length);
    }

    // Bij een wisselend inkomen zeggen twee getallen iets anders: het
    // gemiddelde is wat er over de hele periode binnenkwam, de mediaan is wat
    // een doorsnee maand oplevert. We rekenen met het gemiddelde en tonen
    // allebei.
    var inkomen = gemiddeld('inkomen');
    var inkomenMediaan = rond(A.mediaan(maanden.map(function (m) { return m.inkomen; })));
    var inkomenLaagste = Math.min.apply(null, maanden.map(function (m) { return m.inkomen; }));
    var inkomenHoogste = Math.max.apply(null, maanden.map(function (m) { return m.inkomen; }));

    // Vaste lasten: alles wat gemeten in een vaste categorie viel. De
    // automatisch herkende abonnementen zijn daar een deelverzameling van en
    // dienen om te laten zien wáár het heen gaat.
    var vast = gemiddeld('vast');

    // Stuurbare uitgaven per categorie: gemeten en gewenst.
    var stuurbaar = [];
    analyse.categorieen.forEach(function (c) {
      if (c.soort !== 'variabel') return;
      // Alleen de maanden die meetellen, niet de halve maand aan het begin
      // of het eind van je uitdraai.
      var somMaanden = 0;
      maanden.forEach(function (m) { somMaanden += Math.abs(c.maanden[m.maand] || 0); });
      var gemeten = rond(somMaanden / maanden.length);
      if (gemeten < 1) return;
      var streef = inst.streef[c.id] == null ? gemeten : R.getal(inst.streef[c.id]);
      stuurbaar.push({
        id: c.id, naam: c.naam, kleur: c.kleur,
        gemeten: gemeten, streef: rond(streef), verschil: rond(gemeten - streef),
        aandeel: 0, perMaanden: c.maanden
      });
    });
    var variabelGemeten = rond(stuurbaar.reduce(function (t, c) { return t + c.gemeten; }, 0));
    var variabelStreef = rond(stuurbaar.reduce(function (t, c) { return t + c.streef; }, 0));
    stuurbaar.forEach(function (c) {
      c.aandeel = variabelGemeten ? c.gemeten / variabelGemeten : 0;
    });
    stuurbaar.sort(function (a, b) { return b.gemeten - a.gemeten; });

    var sparenGemeten = gemiddeld('sparen');

    var burnNu = rond(vast + variabelGemeten);
    var burnPlan = rond(vast + variabelStreef);
    var ruimteNu = rond(inkomen - burnNu);
    var ruimtePlan = rond(inkomen - burnPlan);
    var winst = rond(ruimtePlan - ruimteNu);

    // Oorlogskas: zoveel maanden van je hele leven, niet alleen je abonnementen.
    var doel = inst.oorlogskasDoelHandmatig != null && R.getal(inst.oorlogskasDoelHandmatig) > 0
      ? R.getal(inst.oorlogskasDoelHandmatig)
      : rond(R.getal(inst.oorlogskasMaanden) * burnNu);

    var standen = {
      oorlogskas: R.getal(inst.startSaldi.oorlogskas),
      autopot: R.getal(inst.startSaldi.autopot),
      beleggen: R.getal(inst.startSaldi.beleggen) + sparenGemeten * maanden.length
    };

    var nu = verdeel(ruimteNu, standen.oorlogskas, doel, inst);
    var straks = verdeel(ruimtePlan, standen.oorlogskas, doel, inst);

    // Waar sta je over twaalf maanden met de autopot?
    function autopotOver(maandenVooruit, verdeling) {
      // Zolang de oorlogskas nog niet vol is loopt er niets naar de autopot;
      // daarna loopt het volledige tempo door.
      var stand = standen.oorlogskas, pot = standen.autopot, ruimte = verdeling === nu ? ruimteNu : ruimtePlan;
      for (var m = 0; m < maandenVooruit; m++) {
        var v = verdeel(ruimte, stand, doel, inst);
        stand += v.oorlogskas; pot += v.autopot;
      }
      return rond(pot);
    }

    var autopot12Nu = autopotOver(12, nu);
    var autopot12Plan = autopotOver(12, straks);
    var ladderNu = R.ladderPositie(autopot12Nu, inst.autoLadder);
    var ladderPlan = R.ladderPositie(autopot12Plan, inst.autoLadder);

    // Beleggen: het tempo zodra de oorlogskas vol is.
    function beleggenTempo(ruimte) {
      var v = verdeel(ruimte, doel, doel, inst); // oorlogskas als vol beschouwd
      return v.beleggen;
    }
    var beleggenNu = beleggenTempo(ruimteNu);
    var beleggenPlan = beleggenTempo(ruimtePlan);

    var jaren = R.getal(inst.projectieJaren);
    var lijnNu = R.projecteer(standen.beleggen, beleggenNu, inst.rendementPct, jaren);
    var lijnPlan = R.projecteer(standen.beleggen, beleggenPlan, inst.rendementPct, jaren);
    var eindNu = lijnNu[lijnNu.length - 1].waarde;
    var eindPlan = lijnPlan[lijnPlan.length - 1].waarde;

    var vrijheid = R.vrijheidsBedrag(inst.gewenstMaandinkomen, inst.opnamePct);
    var mijlpalen = [
      { naam: 'Oorlogskas vol', doel: doel, start: standen.oorlogskas, inleg: nu.oorlogskas, rendement: 0 },
      { naam: 'Eerste € 50.000 belegd', doel: 50000, start: standen.beleggen, inleg: beleggenNu, rendement: inst.rendementPct },
      { naam: '€ 100.000', doel: 100000, start: standen.beleggen, inleg: beleggenNu, rendement: inst.rendementPct },
      { naam: '€ 250.000', doel: 250000, start: standen.beleggen, inleg: beleggenNu, rendement: inst.rendementPct },
      { naam: '€ 500.000', doel: 500000, start: standen.beleggen, inleg: beleggenNu, rendement: inst.rendementPct },
      { naam: 'Financiële vrijheid', doel: vrijheid, start: standen.beleggen, inleg: beleggenNu, rendement: inst.rendementPct }
    ].map(function (m) {
      var n = R.maandenTot(m.start, m.inleg, m.rendement, m.doel, 12 * 70);
      var nPlan = R.maandenTot(m.start, m.naam === 'Oorlogskas vol' ? straks.oorlogskas : beleggenPlan,
        m.rendement, m.doel, 12 * 70);
      m.maanden = n;
      m.datum = n == null ? null : R.datumOverMaanden(n);
      m.maandenPlan = nPlan;
      m.datumPlan = nPlan == null ? null : R.datumOverMaanden(nPlan);
      m.sneller = (n != null && nPlan != null) ? n - nPlan : null;
      return m;
    });

    return {
      leeg: false,
      instellingen: inst,
      maandenGebruikt: maanden.length,
      periode: analyse.periode,
      inkomen: inkomen,
      inkomenMediaan: inkomenMediaan,
      inkomenLaagste: rond(inkomenLaagste),
      inkomenHoogste: rond(inkomenHoogste),
      inkomenWisselt: inkomenHoogste > inkomenLaagste * 1.5,
      vasteLasten: rond(vast),
      vasteLastenHerkend: analyse.vasteLastenPerMaand,
      variabelGemeten: variabelGemeten,
      variabelStreef: variabelStreef,
      sparenGemeten: sparenGemeten,
      stuurbaar: stuurbaar,
      burnNu: burnNu,
      burnPlan: burnPlan,
      ruimteNu: ruimteNu,
      ruimtePlan: ruimtePlan,
      winstPerMaand: winst,
      winstPerJaar: rond(winst * 12),
      oorlogskasDoel: doel,
      standen: standen,
      verdelingNu: nu,
      verdelingPlan: straks,
      autopot12Nu: autopot12Nu,
      autopot12Plan: autopot12Plan,
      ladderNu: ladderNu,
      ladderPlan: ladderPlan,
      beleggenNu: beleggenNu,
      beleggenPlan: beleggenPlan,
      lijnNu: lijnNu,
      lijnPlan: lijnPlan,
      eindNu: eindNu,
      eindPlan: eindPlan,
      verschilEind: eindPlan - eindNu,
      vrijheidsBedrag: vrijheid,
      mijlpalen: mijlpalen,
      weekbedrag: rond(variabelStreef / R.getal(inst.wekenPerMaand))
    };
  }

  var Planner = { STANDAARD: STANDAARD, plan: plan, verdeel: verdeel };
  if (typeof module !== 'undefined' && module.exports) module.exports = Planner;
  root.Planner = Planner;
})(typeof globalThis !== 'undefined' ? globalThis : this);
