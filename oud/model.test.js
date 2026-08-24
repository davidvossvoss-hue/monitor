/* Drie voorbeeldmaanden door het model. Draaien met: node src/model.test.js */
'use strict';
var M = require('./model.js');

var eur = function (n) {
  return (n < 0 ? '-' : '') + '€ ' + Math.abs(n).toLocaleString('nl-NL', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
};
var pad = function (s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); };
var regel = function (label, waarde, teken) {
  console.log('  ' + (teken || ' ') + ' ' + pad(label, 38) + pad(eur(waarde), 14).padStart(14));
};

// ---------------------------------------------------------------------------
// Testdata
// ---------------------------------------------------------------------------
var data = {
  instellingen: {
    gezamenlijkePasMijnDeelPct: 50,
    vasteLastenOverig: [
      { naam: 'AI-abonnementen', bedrag: 60 },
      { naam: 'Telefoon', bedrag: 25 },
      { naam: 'Tanken', bedrag: 150 },
      { naam: 'Verzekeringen', bedrag: 165 }
    ],
    surplusInvesterenPct: 70,
    autopotPctNaOorlogskas: 60,
    oorlogskasMaanden: 6,
    rendementPct: 7,
    startSaldi: { oorlogskas: 19000, autopot: 2500, beleggen: 8000, jaarruimte: 0, besteedbaar: 0 }
  },
  reserveringen: [
    { id: 'r1', naam: 'Vakantie Italië', bedrag: 900, inlegMaand: '2026-05', verwachteMaand: '2026-07', betaaldMaand: '2026-07' },
    { id: 'r2', naam: 'Aanslag belasting', bedrag: 1200, inlegMaand: '2026-06', verwachteMaand: '2026-11', betaaldMaand: null }
  ],
  voorschotten: [
    { id: 'v1', naam: 'Hotel werkreis (declaratie)', bedrag: 400, maand: '2026-07', terugbetaaldMaand: null }
  ],
  maanden: [
    {
      maand: '2026-05', salaris: 5200, gezamenlijkePasTotaal: 3600,
      eigenUitgaven: [{ omschrijving: 'Revolut', bedrag: 260 }, { omschrijving: 'ABN', bedrag: 180 }, { omschrijving: 'Amex', bedrag: 120 }],
      notitie: 'Rustige maand.'
    },
    {
      maand: '2026-06', salaris: 5200, gezamenlijkePasTotaal: 3800,
      eigenUitgaven: [{ omschrijving: 'Revolut', bedrag: 520 }, { omschrijving: 'ABN', bedrag: 180 }, { omschrijving: 'Amex', bedrag: 950 }],
      notitie: 'Nieuwe laptop op de Amex.'
    },
    {
      maand: '2026-07', salaris: 5600, gezamenlijkePasTotaal: 3600,
      eigenUitgaven: [{ omschrijving: 'Revolut', bedrag: 480 }, { omschrijving: 'ABN', bedrag: 180 }, { omschrijving: 'Amex', bedrag: 1640 }],
      notitie: 'Vakantie betaald (was gereserveerd) + hotel voorgeschoten.'
    }
  ]
};

var a = M.berekenAlles(data);

console.log('');
console.log('==========================================================================');
console.log('  SALARIS MONITOR — controle van het rekenmodel op drie maanden');
console.log('==========================================================================');
console.log('');
console.log('  Gemeten burn rate (gem.)      ' + eur(a.gemiddeldeBurn));
console.log('  Oorlogskasdoel (6 x burn)     ' + eur(a.oorlogskasDoel) +
            (a.oorlogskasDoelIsSchatting ? '   [schatting]' : '   [gemeten]'));
console.log('  Beginstanden                  oorlogskas ' + eur(19000) +
            ' | autopot ' + eur(2500) + ' | beleggen ' + eur(8000));

var fouten = [];
function check(naam, links, rechts) {
  if (Math.abs(links - rechts) > 0.005) {
    fouten.push(naam + ': ' + eur(links) + ' != ' + eur(rechts));
  }
}

a.maanden.forEach(function (r) {
  console.log('');
  console.log('--------------------------------------------------------------------------');
  console.log('  ' + r.maand + '   ' + (r.notitie || ''));
  console.log('--------------------------------------------------------------------------');
  regel('Salaris', r.salaris);
  regel('Gezamenlijke pas totaal ' + eur(r.gezamenlijkePasTotaal) + ', mijn deel', -r.mijnDeelGezamenlijk, '-');
  regel('Vaste lasten overig', -r.vasteLastenOverig, '-');
  regel('Inleg reserveringen deze maand', -r.reserveringInleg, '-');
  regel('SURPLUS', r.surplus, '=');
  console.log('');
  regel('  70% investeren', r.investeren);
  regel('    1. oorlogskas', r.naarOorlogskas);
  regel('    2. autopot', r.naarAutopot);
  regel('    3. beleggen', r.naarBeleggen);
  if (r.naarJaarruimte) regel('    3b. jaarruimte', r.naarJaarruimte);
  regel('  30% besteedbaar', r.besteedbaar);
  regel('     waarvan per week', r.weekbedrag);
  console.log('');
  regel('Eigen uitgaven (alle kaarten)', r.uitgavenBruto);
  if (r.voorgeschoten) regel('  af: voorgeschoten (krijg ik terug)', -r.voorgeschoten, '-');
  if (r.reserveringVrijgevallen) regel('  af: al gereserveerd, valt vrij', -r.reserveringVrijgevallen, '-');
  regel('Telt mee als uitgave', r.uitgaven, '=');

  if (r.overschrijding > 0) {
    console.log('');
    console.log('  ! ' + eur(r.overschrijding) + ' over je besteedbare bedrag heen.');
    var d = r.dekking;
    if (d.buffer) console.log('      uit buffer besteedbaar   ' + eur(d.buffer));
    if (d.autopot) console.log('      kost je autopot          ' + eur(d.autopot));
    if (d.jaarruimte) console.log('      kost je jaarruimte       ' + eur(d.jaarruimte));
    if (d.beleggen) console.log('      kost je beleggen         ' + eur(d.beleggen));
    if (d.oorlogskas) console.log('      kost je oorlogskas       ' + eur(d.oorlogskas));
    if (d.ongedekt) console.log('      ONGEDEKT                 ' + eur(d.ongedekt));
  } else {
    console.log('');
    console.log('  ' + eur(r.onderschrijding) + ' onder je besteedbare bedrag gebleven.');
  }

  console.log('');
  console.log('  Standen na deze maand:');
  regel('  oorlogskas', r.standNa.oorlogskas);
  regel('  autopot', r.standNa.autopot);
  regel('  beleggen', r.standNa.beleggen);
  regel('  besteedbaar (buffer)', r.standNa.besteedbaar);
  regel('  gereserveerd', r.standNa.reserveringen);
  regel('  burn rate deze maand', r.burn);

  // --- controles -----------------------------------------------------------
  check(r.maand + ' salaris verdeeld',
    r.salaris,
    r.mijnDeelGezamenlijk + r.vasteLastenOverig + r.reserveringInleg + r.investeren + r.besteedbaar);
  check(r.maand + ' investeren verdeeld',
    r.investeren,
    r.naarOorlogskas + r.naarAutopot + r.naarBeleggen + r.naarJaarruimte);
  check(r.maand + ' overschrijding gedekt',
    r.overschrijding,
    r.dekking.buffer + r.dekking.autopot + r.dekking.jaarruimte + r.dekking.beleggen +
    r.dekking.oorlogskas + r.dekking.ongedekt);
  check(r.maand + ' investeren = 70% van surplus',
    r.investeren, Math.max(0, r.surplus) * 0.70);
});

// ---------------------------------------------------------------------------
console.log('');
console.log('==========================================================================');
console.log('  GEMETEN GEMIDDELDEN PER MAAND (geen aannames)');
console.log('==========================================================================');
regel('naar oorlogskas', a.gemiddelden.oorlogskas);
regel('naar autopot', a.gemiddelden.autopot);
regel('naar beleggen', a.gemiddelden.beleggen);
regel('burn rate', a.gemiddelden.burn);

var over12 = M.autopotOverMaanden(a, 12);
var pos = M.ladderPositie(over12, M.STANDAARD_INSTELLINGEN.autoLadder);
console.log('');
console.log('  Autopot nu                    ' + eur(a.standen.autopot));
console.log('  Autopot over 12 maanden       ' + eur(over12));
console.log('  Trede                         ' + (pos.huidige ? pos.huidige.naam : 'nog geen trede'));
if (pos.volgende) {
  console.log('  Nog ' + eur(pos.tekort) + ' en je zit in de ' + pos.volgende.naam +
              '   (' + Math.round(pos.voortgang * 100) + '% onderweg)');
}

var belegdInleg = a.gemiddelden.belegdTotaal;
var p20 = M.projecteer(a.standen.beleggen + a.standen.jaarruimte, belegdInleg, 7, 20);
var p20s = M.projecteer(a.standen.beleggen + a.standen.jaarruimte, belegdInleg + 250, 7, 20);
console.log('');
console.log('  Belegd vermogen over 20 jaar  ' + eur(p20[p20.length - 1].waarde));
console.log('  ... met 250 p/m strenger      ' + eur(p20s[p20s.length - 1].waarde));
console.log('  Verschil                      ' + eur(p20s[p20s.length - 1].waarde - p20[p20.length - 1].waarde));
console.log('  Elke 100 euro nu niet uitgeven is over 10 jaar ' + eur(M.honderdEuroOver(10, 7)) + ' waard.');

console.log('');
console.log('  Openstaande reserveringen:');
a.openReserveringen.forEach(function (r) {
  console.log('    - ' + pad(r.naam, 28) + eur(r.bedrag) + '   verwacht ' + r.verwachteMaand);
});
console.log('  Openstaand voorgeschoten:');
a.openVoorschotten.forEach(function (v) {
  console.log('    - ' + pad(v.naam, 28) + eur(v.bedrag) + '   ' + v.maand);
});

console.log('');
console.log('==========================================================================');
if (fouten.length) {
  console.log('  CONTROLES MISLUKT:');
  fouten.forEach(function (f) { console.log('    x ' + f); });
  process.exitCode = 1;
} else {
  console.log('  Alle controles geslaagd: de bakken tellen precies op tot het salaris,');
  console.log('  het investeringsdeel telt op tot de drie potjes, en elke euro');
  console.log('  overschrijding is toegewezen aan een potje.');
}
console.log('==========================================================================');
console.log('');
