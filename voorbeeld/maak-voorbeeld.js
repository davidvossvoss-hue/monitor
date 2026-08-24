/* Maakt drie voorbeeld-uitdraaien in het formaat dat de lezer verwacht.
   Vervang ze door je echte exports; dit is alleen om de motor op te testen.
   Draaien met: node voorbeeld/maak-voorbeeld.js                              */
'use strict';
var fs = require('fs'), path = require('path');
var hier = __dirname;

// Kleine deterministische ruisgenerator, zodat de bedragen variëren maar het
// bestand elke keer hetzelfde is.
var zaad = 20260101;
function ruis(marge) {
  zaad = (zaad * 1103515245 + 12345) % 2147483648;
  return 1 + ((zaad / 2147483648) - 0.5) * 2 * marge;
}
function rond(n) { return Math.round(n * 100) / 100; }
function nl(n) { return rond(n).toFixed(2).replace('.', ','); }
function dd(j, m, d) { return String(d).padStart(2, '0') + '-' + String(m).padStart(2, '0') + '-' + j; }
function ymd(j, m, d) { return j + String(m).padStart(2, '0') + String(d).padStart(2, '0'); }
function iso(j, m, d) { return j + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }

var JAAR = 2026, MAANDEN = [1, 2, 3, 4, 5, 6, 7, 8];

var abn = [], revolut = [], amex = [];
var saldo = 4210.55;

function abnRegel(m, d, bedrag, oms) {
  saldo = rond(saldo + bedrag);
  abn.push([
    'NL91ABNA0417164300', 'EUR', ymd(JAAR, m, d),
    nl(rond(saldo - bedrag)), nl(saldo), ymd(JAAR, m, d), nl(bedrag), oms
  ].join('\t'));
}
function revRegel(m, d, bedrag, oms, type) {
  revolut.push([
    type || 'CARD_PAYMENT', 'Current',
    iso(JAAR, m, d) + ' 09:12:03', iso(JAAR, m, d) + ' 11:40:55',
    oms, rond(bedrag).toFixed(2), '0.00', 'EUR', 'COMPLETED', '412.90'
  ].map(function (v) { return /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','));
}
function amexRegel(m, d, bedrag, oms, plaats) {
  // Amex NL: puntkomma's, komma-decimalen, uitgaven positief.
  amex.push(['"' + dd(JAAR, m, d) + '"', '"' + oms + '"', '"' + nl(bedrag) + '"',
    '"' + (plaats || 'AMSTERDAM') + '"', '"NLD"'].join(';'));
}

MAANDEN.forEach(function (m) {
  var amexRekening = 0, revolutUit = 0;

  // ---- ABN AMRO: inkomen en vaste lasten -------------------------------
  abnRegel(m, 24, rond(5240 * ruis(0.02)),
    'SEPA OVERBOEKING                 NAAM: KLAVERBLAD TECHNOLOGIE BV                    OMSCHRIJVING: SALARIS ' + m + '/' + JAAR);
  abnRegel(m, 1, -1800, 'SEPA OVERBOEKING                 NAAM: J DE VRIES                 IBAN: NL22INGB0004567890  OMSCHRIJVING: GEZAMENLIJKE REKENING ' + m);
  abnRegel(m, 2, -rond(148.50 * ruis(0.06)), 'SEPA INCASSO ALGEMEEN DOORLOPEND  INCASSANT: VATTENFALL KLANTENSERVICE NV  OMSCHRIJVING: ENERGIE TERMIJNBEDRAG');
  abnRegel(m, 3, -rond(152.95), 'SEPA INCASSO ALGEMEEN DOORLOPEND  INCASSANT: ZILVEREN KRUIS ZORGVERZEKERINGEN  OMSCHRIJVING: ZORGPREMIE');
  abnRegel(m, 3, -rond(41.00), 'SEPA INCASSO ALGEMEEN DOORLOPEND  INCASSANT: ODIDO NETHERLANDS BV  OMSCHRIJVING: ABONNEMENT MOBIEL');
  abnRegel(m, 4, -rond(63.20), 'SEPA INCASSO ALGEMEEN DOORLOPEND  INCASSANT: CENTRAAL BEHEER  OMSCHRIJVING: AUTOVERZEKERING');
  abnRegel(m, 5, -rond(58.00), 'SEPA INCASSO ALGEMEEN DOORLOPEND  INCASSANT: BASIC FIT NEDERLAND BV  OMSCHRIJVING: ABONNEMENT');
  if (m % 3 === 1) abnRegel(m, 8, -rond(216.00), 'SEPA INCASSO ALGEMEEN DOORLOPEND  INCASSANT: BELASTINGDIENST  OMSCHRIJVING: MOTORRIJTUIGENBELASTING');

  // pinbetalingen
  [[6, 'ALBERT HEIJN 1533', 74], [11, 'JUMBO AMSTERDAM', 63], [17, 'ALBERT HEIJN 1533', 58],
   [19, 'SHELL AMSTERDAM ZUID', 82], [23, 'ALBERT HEIJN 1533', 47]].forEach(function (p) {
    abnRegel(m, p[0], -rond(p[2] * ruis(0.25)),
      'BEA, Betaalpas                   ' + p[1] + ',PAS345  NR:9A2B1C, ' +
      String(p[0]).padStart(2, '0') + '.' + String(m).padStart(2, '0') + '.' + String(JAAR).slice(2) + '/13:24 AMSTERDAM');
  });

  // ---- Revolut ---------------------------------------------------------
  var topup = m === 3 ? 450 : 300;
  abnRegel(m, 7, -topup, 'SEPA OVERBOEKING                 NAAM: REVOLUT BANK UAB           IBAN: LT12 3250 0000 0000 0001  OMSCHRIJVING: TOP-UP EIGEN REKENING');
  revRegel(m, 7, topup, 'Top-Up by *4821', 'TOPUP');
  [[9, 'Thuisbezorgd.nl', 32], [13, 'Starbucks', 6.4], [15, 'NS Groep', 24],
   [21, 'Restaurant De Kas', 78], [26, 'Etos', 18]].forEach(function (p) {
    var b = -rond(p[2] * ruis(0.3)); revolutUit += b;
    revRegel(m, p[0], b, p[1]);
  });
  if (m === 5) revRegel(m, 12, -640, 'Booking.com');
  if (m === 5) revRegel(m, 18, 95, 'Refund Booking.com', 'REFUND');

  // ---- Amex ------------------------------------------------------------
  var amexPosten = [[4, 'NETFLIX.COM', 15.99], [4, 'SPOTIFY AB', 11.99],
    [5, 'OPENAI *CHATGPT SUBSCR', 22.99], [5, 'ANTHROPIC CLAUDE', 21.60],
    [10, 'BOL.COM B.V.', 84], [14, 'COOLBLUE', 129], [20, 'ZALANDO PAYMENTS', 96],
    [22, 'ALBERT HEIJN 1533', 41], [27, 'PATHE BIOSCOPEN', 27]];
  if (m === 6) amexPosten.push([16, 'APPLE STORE AMSTERDAM', 1349]);
  if (m === 2) amexPosten.push([9, 'KLM ROYAL DUTCH AIRLINES', 412]);
  amexPosten.forEach(function (p) {
    var b = rond(p[2] * (p[2] > 200 ? 1 : ruis(0.18)));
    amexRekening += b;
    amexRegel(m, p[0], b, p[1]);
  });
  // Amex-afschrijving van de ABN, plus de bijschrijving op de Amex zelf.
  var vorige = rond(amexRekening);
  abnRegel(m, 28, -vorige, 'SEPA INCASSO ALGEMEEN DOORLOPEND  INCASSANT: AMERICAN EXPRESS SERVICES EUROPE  OMSCHRIJVING: KAARTREKENING ' + m);
  amexRegel(m, 28, -vorige, 'BETALING ONTVANGEN - HARTELIJK DANK', '');
});

fs.writeFileSync(path.join(hier, 'abnamro-2026.tab'), abn.join('\r\n') + '\r\n');
fs.writeFileSync(path.join(hier, 'revolut-2026.csv'),
  'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\r\n' +
  revolut.join('\r\n') + '\r\n');
fs.writeFileSync(path.join(hier, 'amex-2026.csv'),
  '"Datum";"Omschrijving";"Bedrag";"Plaats";"Land"\r\n' + amex.join('\r\n') + '\r\n');

console.log('Voorbeeldbestanden geschreven:');
console.log('  abnamro-2026.tab   ' + abn.length + ' regels (tab-gescheiden, geen kop)');
console.log('  revolut-2026.csv   ' + revolut.length + ' regels (komma, kop, punt-decimalen)');
console.log('  amex-2026.csv      ' + amex.length + ' regels (puntkomma, kop, komma-decimalen, uitgaven positief)');
