/* Het rekenwerk dat losstaat van je transacties: de auto-ladder, rente op
   rente, mijlpalen. Puur, zonder DOM.                                      */
(function (root) {
  'use strict';

  var STANDAARD_LADDER = [
    { naam: 'Huidige auto houden', vanaf: 1500 },
    { naam: 'Honda Civic 2011', vanaf: 6000 },
    { naam: 'Lexus CT 200h', vanaf: 14000 },
    { naam: 'Hyundai Tucson 2020', vanaf: 19000 },
    { naam: 'Volkswagen Tiguan 2020', vanaf: 29000 },
    { naam: 'Porsche Cayman', vanaf: 35000 },
    { naam: 'Lexus RX450h', vanaf: 49000 },
    { naam: 'Volvo XC90', vanaf: 60000 },
    { naam: 'Land Rover Defender 2024', vanaf: 90000 }
  ];

  function getal(x) {
    var n = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : x;
    return typeof n === 'number' && isFinite(n) ? n : 0;
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
  function datumOverMaanden(n, vanaf) {
    var d = vanaf ? new Date(vanaf) : new Date();
    d.setMonth(d.getMonth() + Math.round(n));
    return d;
  }

  // Op welke trede sta je met dit bedrag, en hoe ver naar de volgende?
  function ladderPositie(bedrag, ladder) {
    var tredes = (ladder || STANDAARD_LADDER).slice().sort(function (a, b) {
      return getal(a.vanaf) - getal(b.vanaf);
    });
    var huidige = null, index = -1;
    for (var k = 0; k < tredes.length; k++) {
      if (bedrag >= getal(tredes[k].vanaf)) { huidige = tredes[k]; index = k; }
    }
    var volgende = index + 1 < tredes.length ? tredes[index + 1] : null;
    var onder = huidige ? getal(huidige.vanaf) : 0;
    var boven = volgende ? getal(volgende.vanaf) : null;
    return {
      bedrag: bedrag, huidige: huidige, index: index, volgende: volgende,
      tekort: volgende ? getal(volgende.vanaf) - bedrag : 0,
      voortgang: boven != null && boven > onder
        ? Math.max(0, Math.min(1, (bedrag - onder) / (boven - onder))) : 1,
      tredes: tredes
    };
  }

  function projecteer(start, inlegPerMaand, rendementPct, jaren) {
    var r = Math.pow(1 + getal(rendementPct) / 100, 1 / 12) - 1;
    var saldo = getal(start), ingelegd = getal(start);
    var punten = [{ maand: 0, jaar: 0, waarde: saldo, ingelegd: ingelegd }];
    var totaal = Math.round(getal(jaren) * 12);
    for (var m = 1; m <= totaal; m++) {
      saldo = saldo * (1 + r) + getal(inlegPerMaand);
      ingelegd += getal(inlegPerMaand);
      punten.push({ maand: m, jaar: m / 12, waarde: saldo, ingelegd: ingelegd });
    }
    return punten;
  }

  function maandenTot(start, inlegPerMaand, rendementPct, doel, maxMaanden) {
    var r = Math.pow(1 + getal(rendementPct) / 100, 1 / 12) - 1;
    var saldo = getal(start), limiet = maxMaanden || 12 * 60;
    if (saldo >= doel) return 0;
    if (getal(inlegPerMaand) <= 0 && r <= 0) return null;
    for (var m = 1; m <= limiet; m++) {
      saldo = saldo * (1 + r) + getal(inlegPerMaand);
      if (saldo >= doel) return m;
    }
    return null;
  }

  function vrijheidsBedrag(gewenstMaandinkomen, opnamePct) {
    return getal(gewenstMaandinkomen) * 12 / (getal(opnamePct) / 100);
  }
  function honderdEuroOver(jaren, rendementPct) {
    return 100 * Math.pow(1 + getal(rendementPct) / 100, getal(jaren));
  }

  // Hoe ver ben je in de lopende maand, en lig je voor of achter?
  function maandTempo(ruimte, uitgegeven, datum) {
    var d = datum ? new Date(datum) : new Date();
    var dagenInMaand = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var dag = d.getDate();
    var verwacht = ruimte * (dag / dagenInMaand);
    var over = ruimte - uitgegeven;
    var rest = dagenInMaand - dag;
    return {
      dag: dag, dagenInMaand: dagenInMaand, dagenRestend: rest,
      verwachtOpSchema: verwacht, uitgegeven: uitgegeven, over: over,
      verschilMetSchema: verwacht - uitgegeven,
      opSchema: uitgegeven <= verwacht,
      perResterendeDag: rest > 0 ? over / rest : over,
      aandeelOp: ruimte > 0 ? uitgegeven / ruimte : (uitgegeven > 0 ? 1 : 0)
    };
  }

  var Rekenen = {
    STANDAARD_LADDER: STANDAARD_LADDER,
    getal: getal, maandSleutel: maandSleutel, maandPlus: maandPlus,
    datumOverMaanden: datumOverMaanden, ladderPositie: ladderPositie,
    projecteer: projecteer, maandenTot: maandenTot,
    vrijheidsBedrag: vrijheidsBedrag, honderdEuroOver: honderdEuroOver,
    maandTempo: maandTempo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Rekenen;
  root.Rekenen = Rekenen;
})(typeof globalThis !== 'undefined' ? globalThis : this);
