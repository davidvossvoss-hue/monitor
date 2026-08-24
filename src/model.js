/* ============================================================================
   Salaris Monitor — rekenmodel
   Puur rekenwerk. Geen DOM, geen opslag, geen aannames over gedrag.
   Draait in de browser (window.Model) en in node (module.exports).
   ========================================================================= */
(function (root) {
  'use strict';

  // --------------------------------------------------------------------------
  // Standaardinstellingen. Alles hier is aanpasbaar in het instellingenscherm.
  // --------------------------------------------------------------------------
  var STANDAARD_INSTELLINGEN = {
    // Vaste lasten wonen & eten lopen via de gezamenlijke pas.
    // Van het totaal dat daar afgaat is dit mijn deel:
    gezamenlijkePasMijnDeelPct: 50,
    // Gepland maandbedrag naar de gezamenlijke pas. Alleen gebruikt zolang er
    // nog geen maand is ingevuld — daarna rekent alles met gemeten cijfers.
    gezamenlijkePasPlan: 1800,

    // Vaste lasten overig: vrije lijst.
    vasteLastenOverig: [
      { naam: 'AI-abonnementen', bedrag: 60 },
      { naam: 'Telefoon', bedrag: 25 },
      { naam: 'Tanken', bedrag: 150 },
      { naam: 'Verzekeringen', bedrag: 165 }
    ],

    // Verdeling van het surplus.
    surplusInvesterenPct: 70,

    // Binnen het investeringsdeel, na de oorlogskas:
    autopotPctNaOorlogskas: 60,

    // Oorlogskas: doel = maanden x totale burn rate (incl. gezamenlijke pas
    // en dagelijkse uitgaven). Handmatig doel overschrijft de berekening.
    oorlogskasMaanden: 6,
    oorlogskasDoelHandmatig: null,

    // Jaarruimte: deel van de beleggingsinleg dat je apart zet voor je
    // jaarruimte. 0 = uit.
    jaarruimteDeelVanBeleggenPct: 0,
    jaarruimteDoelPerJaar: 0,

    // Projectie.
    rendementPct: 7,
    strengerExtraPerMaand: 250,
    projectieJaren: 20,

    // Financiële vrijheid = gewenst maandinkomen x 12 / opnamepercentage.
    gewenstMaandinkomen: 3000,
    opnamePct: 4,

    // Weekbedrag = maandbedrag / dit getal.
    wekenPerMaand: 4.33,

    // Beginstanden van de potjes (wat er al stond voordat je begon te loggen).
    startSaldi: {
      oorlogskas: 0,
      autopot: 0,
      beleggen: 0,
      jaarruimte: 0,
      besteedbaar: 0
    },

    autoLadder: [
      { naam: 'Huidige auto houden', vanaf: 1500 },
      { naam: 'Honda Civic 2011', vanaf: 6000 },
      { naam: 'Lexus CT 200h', vanaf: 14000 },
      { naam: 'Hyundai Tucson 2020', vanaf: 19000 },
      { naam: 'Volkswagen Tiguan 2020', vanaf: 29000 },
      { naam: 'Porsche Cayman', vanaf: 35000 },
      { naam: 'Lexus RX450h', vanaf: 49000 },
      { naam: 'Volvo XC90', vanaf: 60000 },
      { naam: 'Land Rover Defender 2024', vanaf: 90000 }
    ]
  };

  // --------------------------------------------------------------------------
  // Hulpjes
  // --------------------------------------------------------------------------
  function getal(x) {
    var n = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : x;
    return typeof n === 'number' && isFinite(n) ? n : 0;
  }

  function som(lijst, veld) {
    return (lijst || []).reduce(function (t, r) {
      return t + getal(veld ? r[veld] : r);
    }, 0);
  }

  function maandSleutel(datum) {
    var d = datum ? new Date(datum) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function maandPlus(sleutel, n) {
    var p = String(sleutel).split('-');
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1 + n, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function maandenPerJaar() { return 12; }

  function vasteLastenOverigTotaal(instellingen) {
    return som(instellingen.vasteLastenOverig, 'bedrag');
  }

  function eigenUitgavenTotaal(maand) {
    if (!maand) return 0;
    if (Array.isArray(maand.eigenUitgaven)) return som(maand.eigenUitgaven, 'bedrag');
    return getal(maand.eigenUitgaven);
  }

  // --------------------------------------------------------------------------
  // Burn rate: wat mijn leven per maand kost.
  // Gezamenlijke pas (mijn deel) + vaste lasten overig + wat ik echt uitgeef.
  // Reserveringen en voorgeschoten geld tellen NIET mee: dat is geen verbruik.
  // --------------------------------------------------------------------------
  function burnVanMaand(maand, instellingen, reserveringen, voorschotten) {
    var mijnDeel = getal(maand.gezamenlijkePasTotaal) *
      getal(instellingen.gezamenlijkePasMijnDeelPct) / 100;
    return mijnDeel +
      vasteLastenOverigTotaal(instellingen) +
      effectieveUitgaven(maand, reserveringen, voorschotten);
  }

  // Wat er echt uit mijn besteedbare geld ging.
  // Eraf: voorgeschoten geld (krijg ik terug) en betalingen die al gereserveerd
  // waren (die zijn eerder al van het salaris af gegaan).
  function effectieveUitgaven(maand, reserveringen, voorschotten) {
    var bruto = eigenUitgavenTotaal(maand);
    var voorgeschoten = som((voorschotten || []).filter(function (v) {
      return v.maand === maand.maand;
    }), 'bedrag');
    var gereserveerdBetaald = som((reserveringen || []).filter(function (r) {
      return r.betaaldMaand === maand.maand;
    }), 'bedrag');
    return bruto - voorgeschoten - gereserveerdBetaald;
  }

  // --------------------------------------------------------------------------
  // Oorlogskasdoel
  // --------------------------------------------------------------------------
  function oorlogskasDoel(instellingen, gemiddeldeBurn) {
    if (instellingen.oorlogskasDoelHandmatig != null &&
        getal(instellingen.oorlogskasDoelHandmatig) > 0) {
      return { bedrag: getal(instellingen.oorlogskasDoelHandmatig), schatting: false };
    }
    if (gemiddeldeBurn != null) {
      return {
        bedrag: getal(instellingen.oorlogskasMaanden) * gemiddeldeBurn,
        schatting: false
      };
    }
    // Nog geen maand ingevuld: dan is dit een plan, geen meting.
    var planBurn = getal(instellingen.gezamenlijkePasPlan) +
      vasteLastenOverigTotaal(instellingen);
    return {
      bedrag: getal(instellingen.oorlogskasMaanden) * planBurn,
      schatting: true
    };
  }

  // --------------------------------------------------------------------------
  // Eén maand doorrekenen, gegeven de stand van de potjes aan het begin.
  // --------------------------------------------------------------------------
  function berekenMaand(maand, instellingen, stand, doelOorlogskas, reserveringen, voorschotten) {
    var i = instellingen;

    var salaris = getal(maand.salaris);
    var gezamenlijkTotaal = getal(maand.gezamenlijkePasTotaal);
    var mijnDeelGezamenlijk = gezamenlijkTotaal * getal(i.gezamenlijkePasMijnDeelPct) / 100;
    var vasteOverig = vasteLastenOverigTotaal(i);

    var reserveringInleg = som((reserveringen || []).filter(function (r) {
      return r.inlegMaand === maand.maand;
    }), 'bedrag');
    var reserveringVrijgevallen = som((reserveringen || []).filter(function (r) {
      return r.betaaldMaand === maand.maand;
    }), 'bedrag');

    // ---- Volgorde van verdeling -------------------------------------------
    var surplus = salaris - mijnDeelGezamenlijk - vasteOverig - reserveringInleg;

    var investeren = surplus > 0 ? surplus * getal(i.surplusInvesterenPct) / 100 : 0;
    var besteedbaar = surplus - investeren; // bij negatief surplus: negatief

    // ---- Investeringsdeel in strikte volgorde ------------------------------
    var tekortOorlogskas = Math.max(0, doelOorlogskas - stand.oorlogskas);
    var naarOorlogskas = Math.min(investeren, tekortOorlogskas);
    var naOorlogskas = investeren - naarOorlogskas;
    var naarAutopot = naOorlogskas * getal(i.autopotPctNaOorlogskas) / 100;
    var naarBeleggenBruto = naOorlogskas - naarAutopot;
    var naarJaarruimte = naarBeleggenBruto * getal(i.jaarruimteDeelVanBeleggenPct) / 100;
    var naarBeleggen = naarBeleggenBruto - naarJaarruimte;

    // ---- Uitgaven ----------------------------------------------------------
    var uitgavenBruto = eigenUitgavenTotaal(maand);
    var voorgeschoten = som((voorschotten || []).filter(function (v) {
      return v.maand === maand.maand;
    }), 'bedrag');
    var uitgaven = uitgavenBruto - voorgeschoten - reserveringVrijgevallen;

    var overschrijding = Math.max(0, uitgaven - besteedbaar);
    var onderschrijding = Math.max(0, besteedbaar - uitgaven);

    // Te veel uitgegeven? Dat komt ergens vandaan. Eerst uit wat er in het
    // besteedbaar-potje over was van eerdere maanden, daarna uit de autopot,
    // daarna beleggen, daarna de oorlogskas.
    var rest = overschrijding;
    var uitBuffer = Math.min(rest, Math.max(0, stand.besteedbaar)); rest -= uitBuffer;
    var uitAutopot = Math.min(rest, naarAutopot); rest -= uitAutopot;
    var uitJaarruimte = Math.min(rest, naarJaarruimte); rest -= uitJaarruimte;
    var uitBeleggen = Math.min(rest, naarBeleggen); rest -= uitBeleggen;
    var uitOorlogskas = Math.min(rest, naarOorlogskas + Math.max(0, stand.oorlogskas)); rest -= uitOorlogskas;
    var ongedekt = rest;

    var nettoOorlogskas = naarOorlogskas - uitOorlogskas;
    var nettoAutopot = naarAutopot - uitAutopot;
    var nettoBeleggen = naarBeleggen - uitBeleggen;
    var nettoJaarruimte = naarJaarruimte - uitJaarruimte;
    var nettoBesteedbaar = onderschrijding - uitBuffer;

    var nieuweStand = {
      oorlogskas: stand.oorlogskas + nettoOorlogskas,
      autopot: stand.autopot + nettoAutopot,
      beleggen: stand.beleggen + nettoBeleggen,
      jaarruimte: stand.jaarruimte + nettoJaarruimte,
      besteedbaar: stand.besteedbaar + nettoBesteedbaar,
      reserveringen: stand.reserveringen + reserveringInleg - reserveringVrijgevallen
    };

    return {
      maand: maand.maand,
      salaris: salaris,
      gezamenlijkePasTotaal: gezamenlijkTotaal,
      mijnDeelGezamenlijk: mijnDeelGezamenlijk,
      vasteLastenOverig: vasteOverig,
      reserveringInleg: reserveringInleg,
      reserveringVrijgevallen: reserveringVrijgevallen,
      surplus: surplus,
      investeren: investeren,
      besteedbaar: besteedbaar,
      weekbedrag: besteedbaar / getal(i.wekenPerMaand),

      naarOorlogskas: naarOorlogskas,
      naarAutopot: naarAutopot,
      naarBeleggen: naarBeleggen,
      naarJaarruimte: naarJaarruimte,

      uitgavenBruto: uitgavenBruto,
      voorgeschoten: voorgeschoten,
      uitgaven: uitgaven,
      overschrijding: overschrijding,
      onderschrijding: onderschrijding,
      dekking: {
        buffer: uitBuffer,
        autopot: uitAutopot,
        jaarruimte: uitJaarruimte,
        beleggen: uitBeleggen,
        oorlogskas: uitOorlogskas,
        ongedekt: ongedekt
      },

      netto: {
        oorlogskas: nettoOorlogskas,
        autopot: nettoAutopot,
        beleggen: nettoBeleggen,
        jaarruimte: nettoJaarruimte,
        besteedbaar: nettoBesteedbaar
      },

      burn: mijnDeelGezamenlijk + vasteOverig + uitgaven,
      standNa: nieuweStand,
      notitie: maand.notitie || ''
    };
  }

  // --------------------------------------------------------------------------
  // Alle maanden achter elkaar. De oorlogskas loopt vol, dus de volgorde telt.
  // --------------------------------------------------------------------------
  function berekenAlles(data) {
    var instellingen = Object.assign({}, STANDAARD_INSTELLINGEN, data.instellingen || {});
    var reserveringen = data.reserveringen || [];
    var voorschotten = data.voorschotten || [];

    var maanden = (data.maanden || []).slice().sort(function (a, b) {
      return a.maand < b.maand ? -1 : a.maand > b.maand ? 1 : 0;
    });
    var ingevuld = maanden.filter(function (m) { return getal(m.salaris) > 0; });

    // Pas 1: burn rate meten (hangt niet af van de verdeling).
    var burns = ingevuld.map(function (m) {
      return burnVanMaand(m, instellingen, reserveringen, voorschotten);
    });
    var gemiddeldeBurn = burns.length
      ? burns.reduce(function (a, b) { return a + b; }, 0) / burns.length
      : null;

    var doel = oorlogskasDoel(instellingen, gemiddeldeBurn);

    // Pas 2: maand voor maand verdelen.
    var start = Object.assign({
      oorlogskas: 0, autopot: 0, beleggen: 0, jaarruimte: 0, besteedbaar: 0
    }, instellingen.startSaldi || {});
    var stand = {
      oorlogskas: getal(start.oorlogskas),
      autopot: getal(start.autopot),
      beleggen: getal(start.beleggen),
      jaarruimte: getal(start.jaarruimte),
      besteedbaar: getal(start.besteedbaar),
      reserveringen: 0
    };

    var resultaten = ingevuld.map(function (m) {
      var r = berekenMaand(m, instellingen, stand, doel.bedrag, reserveringen, voorschotten);
      stand = r.standNa;
      return r;
    });

    // Gemeten gemiddelden — nooit een aanname.
    function gem(veld) {
      if (!resultaten.length) return null;
      return resultaten.reduce(function (t, r) { return t + r.netto[veld]; }, 0) / resultaten.length;
    }

    var gemiddelden = resultaten.length ? {
      oorlogskas: gem('oorlogskas'),
      autopot: gem('autopot'),
      beleggen: gem('beleggen'),
      jaarruimte: gem('jaarruimte'),
      besteedbaar: gem('besteedbaar'),
      belegdTotaal: gem('beleggen') + gem('jaarruimte'),
      burn: gemiddeldeBurn,
      salaris: resultaten.reduce(function (t, r) { return t + r.salaris; }, 0) / resultaten.length,
      uitgaven: resultaten.reduce(function (t, r) { return t + r.uitgaven; }, 0) / resultaten.length,
      besteedbaarRuimte: resultaten.reduce(function (t, r) { return t + r.besteedbaar; }, 0) / resultaten.length
    } : null;

    // Openstaande posten.
    var openReserveringen = reserveringen.filter(function (r) { return !r.betaaldMaand; });
    var openVoorschotten = voorschotten.filter(function (v) { return !v.terugbetaaldMaand; });

    return {
      instellingen: instellingen,
      maanden: resultaten,
      laatste: resultaten.length ? resultaten[resultaten.length - 1] : null,
      standen: {
        oorlogskas: stand.oorlogskas,
        autopot: stand.autopot,
        beleggen: stand.beleggen,
        jaarruimte: stand.jaarruimte,
        besteedbaar: stand.besteedbaar,
        reserveringen: som(openReserveringen, 'bedrag'),
        voorgeschoten: som(openVoorschotten, 'bedrag')
      },
      oorlogskasDoel: doel.bedrag,
      oorlogskasDoelIsSchatting: doel.schatting,
      gemiddeldeBurn: gemiddeldeBurn,
      gemiddelden: gemiddelden,
      openReserveringen: openReserveringen,
      openVoorschotten: openVoorschotten,
      heeftData: resultaten.length > 0
    };
  }

  // --------------------------------------------------------------------------
  // Auto-ladder
  // --------------------------------------------------------------------------
  function ladderPositie(bedrag, ladder) {
    var tredes = (ladder || []).slice().sort(function (a, b) {
      return getal(a.vanaf) - getal(b.vanaf);
    });
    var huidige = null, index = -1;
    for (var k = 0; k < tredes.length; k++) {
      if (bedrag >= getal(tredes[k].vanaf)) { huidige = tredes[k]; index = k; }
    }
    var volgende = index + 1 < tredes.length ? tredes[index + 1] : null;
    var onder = huidige ? getal(huidige.vanaf) : 0;
    var boven = volgende ? getal(volgende.vanaf) : null;
    var voortgang = boven != null && boven > onder
      ? Math.max(0, Math.min(1, (bedrag - onder) / (boven - onder)))
      : 1;
    return {
      bedrag: bedrag,
      huidige: huidige,
      index: index,
      volgende: volgende,
      tekort: volgende ? getal(volgende.vanaf) - bedrag : 0,
      voortgang: voortgang,
      tredes: tredes
    };
  }

  // Waar staat de autopot over n maanden, op basis van het gemeten tempo?
  function autopotOverMaanden(analyse, maanden) {
    if (!analyse.gemiddelden) return null;
    return analyse.standen.autopot + analyse.gemiddelden.autopot * maanden;
  }

  // --------------------------------------------------------------------------
  // Projectie
  // --------------------------------------------------------------------------
  function projecteer(startBedrag, inlegPerMaand, rendementPct, jaren) {
    var r = Math.pow(1 + getal(rendementPct) / 100, 1 / 12) - 1;
    var saldo = getal(startBedrag);
    var punten = [{ maand: 0, jaar: 0, waarde: saldo, ingelegd: getal(startBedrag) }];
    var ingelegd = getal(startBedrag);
    var totaal = Math.round(getal(jaren) * 12);
    for (var m = 1; m <= totaal; m++) {
      saldo = saldo * (1 + r) + getal(inlegPerMaand);
      ingelegd += getal(inlegPerMaand);
      punten.push({ maand: m, jaar: m / 12, waarde: saldo, ingelegd: ingelegd });
    }
    return punten;
  }

  function maandenTot(startBedrag, inlegPerMaand, rendementPct, doel, maxMaanden) {
    var r = Math.pow(1 + getal(rendementPct) / 100, 1 / 12) - 1;
    var saldo = getal(startBedrag);
    var limiet = maxMaanden || 12 * 60;
    if (saldo >= doel) return 0;
    if (getal(inlegPerMaand) <= 0 && r <= 0) return null;
    for (var m = 1; m <= limiet; m++) {
      saldo = saldo * (1 + r) + getal(inlegPerMaand);
      if (saldo >= doel) return m;
    }
    return null;
  }

  function datumOverMaanden(n, vanaf) {
    var d = vanaf ? new Date(vanaf) : new Date();
    d.setMonth(d.getMonth() + Math.round(n));
    return d;
  }

  function vrijheidsBedrag(instellingen) {
    return getal(instellingen.gewenstMaandinkomen) * 12 / (getal(instellingen.opnamePct) / 100);
  }

  // "Elke €100 die je nu niet uitgeeft, is over 10 jaar € X waard"
  function honderdEuroOver(jaren, rendementPct) {
    return 100 * Math.pow(1 + getal(rendementPct) / 100, getal(jaren));
  }

  // --------------------------------------------------------------------------
  // Tempo binnen de lopende maand
  // --------------------------------------------------------------------------
  function maandTempo(besteedbaar, uitgegeven, datum) {
    var d = datum ? new Date(datum) : new Date();
    var dagenInMaand = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var dag = d.getDate();
    var verwacht = besteedbaar * (dag / dagenInMaand);
    var over = besteedbaar - uitgegeven;
    var dagenRestend = dagenInMaand - dag;
    return {
      dag: dag,
      dagenInMaand: dagenInMaand,
      dagenRestend: dagenRestend,
      verwachtOpSchema: verwacht,
      uitgegeven: uitgegeven,
      over: over,
      verschilMetSchema: verwacht - uitgegeven, // positief = voor op schema
      opSchema: uitgegeven <= verwacht,
      perResterendeDag: dagenRestend > 0 ? over / dagenRestend : over,
      aandeelOp: besteedbaar > 0 ? uitgegeven / besteedbaar : (uitgegeven > 0 ? 1 : 0)
    };
  }

  var Model = {
    STANDAARD_INSTELLINGEN: STANDAARD_INSTELLINGEN,
    getal: getal,
    som: som,
    maandSleutel: maandSleutel,
    maandPlus: maandPlus,
    maandenPerJaar: maandenPerJaar,
    vasteLastenOverigTotaal: vasteLastenOverigTotaal,
    eigenUitgavenTotaal: eigenUitgavenTotaal,
    effectieveUitgaven: effectieveUitgaven,
    burnVanMaand: burnVanMaand,
    oorlogskasDoel: oorlogskasDoel,
    berekenMaand: berekenMaand,
    berekenAlles: berekenAlles,
    ladderPositie: ladderPositie,
    autopotOverMaanden: autopotOverMaanden,
    projecteer: projecteer,
    maandenTot: maandenTot,
    datumOverMaanden: datumOverMaanden,
    vrijheidsBedrag: vrijheidsBedrag,
    honderdEuroOver: honderdEuroOver,
    maandTempo: maandTempo
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Model;
  root.Model = Model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
