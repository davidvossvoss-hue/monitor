/* De hele keten op de voorbeeldbestanden: inlezen → ontdubbelen → eigen geld
   eruit → categoriseren → vaste lasten vinden → per maand → planner.
   Draaien met: node src/analyse.test.js                                    */
'use strict';
global.Categorie = require('./categorie.js');
global.Rekenen = require('./rekenen.js');
global.Analyse = require('./analyse.js');
var Lezen = require('./lezen.js');
var Planner = require('./planner.js');
var fs = require('fs'), path = require('path');

var A = global.Analyse, C = global.Categorie;
var map = path.join(__dirname, '..', 'voorbeeld');

function eur(n, d) {
  var v = Math.abs(n).toLocaleString('nl-NL', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  return (n < 0 ? '-' : '') + '€ ' + v;
}
function vul(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s + ' '.repeat(n - s.length); }
function rechts(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }
function kop(t) {
  console.log('\n' + '='.repeat(78));
  console.log('  ' + t);
  console.log('='.repeat(78));
}

// ---------------------------------------------------------------- 1. inlezen
kop('1. INLEZEN — drie uitdraaien, drie formaten');
var lijsten = [];
['abnamro-2026.tab', 'revolut-2026.csv', 'amex-2026.csv'].forEach(function (naam) {
  var r = Lezen.lees(fs.readFileSync(path.join(map, naam), 'utf8'));
  if (r.fout) { console.log('  ' + naam + ': ' + r.fout); return; }
  console.log('  ' + vul(naam, 20) + vul(r.bron, 10) +
    'scheiding: ' + vul(r.scheidingsteken === '\t' ? 'tab' : r.scheidingsteken, 5) +
    'kop: ' + vul(r.heeftKop ? 'ja' : 'nee', 5) +
    rechts(r.transacties.length, 4) + ' regels   ' + r.periode.van + ' t/m ' + r.periode.tot);
  r.waarschuwingen.forEach(function (w) { console.log('      ' + w); });
  lijsten.push(r.transacties);
});

// Nog een keer hetzelfde bestand erbij, om te controleren dat ontdubbelen werkt.
lijsten.push(Lezen.lees(fs.readFileSync(path.join(map, 'amex-2026.csv'), 'utf8')).transacties);

var analyse = A.analyseer(lijsten);
console.log('\n  Amex-bestand expres twee keer ingeladen → ' + analyse.dubbelOvergeslagen +
  ' dubbele regels overgeslagen. Totaal ' + analyse.transacties.length + ' unieke transacties.');

// ------------------------------------------------------- 2. eigen geld heen en weer
kop('2. EIGEN GELD HEEN EN WEER — telt niet als uitgave');
console.log('  ' + analyse.interneParen.length + ' paren gekoppeld. Zonder dit zou je je Amex-afrekening');
console.log('  én je Amex-uitgaven allebei tellen, en je Revolut-storting bovendien.\n');
analyse.interneParen.slice(0, 4).forEach(function (p) {
  console.log('   ' + vul(p.uit.datum, 12) + vul(p.uit.bron + ' → ' + p.in.bron, 22) +
    rechts(eur(p.bedrag), 10) + '   ' + vul(p.uit.tegenpartij, 30));
});
var internTotaal = analyse.interneParen.reduce(function (t, p) { return t + p.bedrag; }, 0);
console.log('\n   Samen ' + eur(internTotaal) + ' die géén uitgave is.');

// --------------------------------------------------------------- 3. per maand
kop('3. PER MAAND');
console.log('  ' + vul('maand', 10) + rechts('inkomen', 10) + rechts('vast', 10) +
  rechts('variabel', 10) + rechts('uitgaven', 10) + rechts('over', 10));
console.log('  ' + '-'.repeat(60));
analyse.maanden.forEach(function (m) {
  console.log('  ' + vul(m.maand, 10) + rechts(eur(m.inkomen), 10) + rechts(eur(m.vast), 10) +
    rechts(eur(m.variabel), 10) + rechts(eur(m.uitgaven), 10) +
    rechts(eur(m.netto), 10));
});
console.log('  ' + '-'.repeat(60));
console.log('  ' + vul('gemiddeld', 10) + rechts(eur(analyse.gemiddeld.inkomen), 10) +
  rechts(eur(analyse.gemiddeld.vast), 10) + rechts(eur(analyse.gemiddeld.variabel), 10) +
  rechts(eur(analyse.gemiddeld.uitgaven), 10) + rechts(eur(analyse.gemiddeld.netto), 10));

// ------------------------------------------------------------- 4. categorieën
kop('4. WAAR HET HEEN GAAT — hele periode, en gemiddeld per maand');
var uitgaven = analyse.categorieen.filter(function (c) { return c.totaal < 0; });
var totaalUit = uitgaven.reduce(function (t, c) { return t + Math.abs(c.totaal); }, 0);
uitgaven.forEach(function (c) {
  var deel = Math.abs(c.totaal) / totaalUit;
  var breedte = Math.max(1, Math.round(deel * 34));
  console.log('  ' + vul(c.naam, 24) + vul(c.soort, 10) +
    rechts(eur(Math.abs(c.totaal)), 10) + rechts(eur(Math.abs(c.perMaand)) + '/m', 12) +
    '  ' + '█'.repeat(breedte) + ' ' + Math.round(deel * 100) + '%');
});
console.log('\n  ' + vul('TOTAAL UITGEGEVEN', 24) + vul('', 10) + rechts(eur(totaalUit), 10));
var inkomsten = analyse.categorieen.filter(function (c) { return c.totaal > 0; });
inkomsten.forEach(function (c) {
  console.log('  ' + vul(c.naam, 24) + vul(c.soort, 10) + rechts(eur(c.totaal), 10) +
    rechts(eur(c.perMaand) + '/m', 12));
});
if (analyse.onbekend.length) {
  console.log('\n  Nog niet ingedeeld (' + analyse.onbekend.length + '): ' +
    analyse.onbekend.slice(0, 6).map(function (t) { return t.tegenpartij; }).join(', '));
  console.log('  Die deel je zelf één keer in; daarna onthoudt hij het.');
}

// ------------------------------------------------------------ 5. vaste lasten
kop('5. VASTE LASTEN — zelf herkend, niet door jou opgegeven');
analyse.vasteLasten.forEach(function (v) {
  console.log('  ' + vul(v.naam, 34) + vul(C.categorieVan(v.categorie).naam, 22) +
    vul(v.ritme, 13) + 'rond de ' + rechts(v.rondDeDag, 2) + 'e' +
    rechts(eur(v.typischBedrag, 2), 12) + rechts(eur(v.perMaand, 2) + '/m', 14));
});
console.log('\n  Samen ' + eur(analyse.vasteLastenPerMaand, 2) + ' per maand vast.');
console.log('  Ter controle: gemeten vaste lasten ' + eur(analyse.gemiddeld.vast, 2) +
  ' per maand (verschil = kwartaal- en jaarposten die over de maanden verdeeld zijn).');

// ------------------------------------------------------------ 6. uitschieters
kop('6. DE UITSCHIETERS PER MAAND');
analyse.maanden.forEach(function (m) {
  var top = A.uitschieters(analyse.transacties, m.maand, 1)[0];
  if (!top) return;
  console.log('  ' + vul(m.maand, 10) + rechts(eur(Math.abs(top.bedrag)), 10) + '   ' +
    vul(top.tegenpartij, 34) + '(' + C.categorieVan(top.categorie).naam + ')');
});

// ---------------------------------------------------------------- 7. planner
kop('7. DE PLANNER — huidig tempo');
var beginstanden = { oorlogskas: 8000, autopot: 2500, beleggen: 6000 };
var p = Planner.plan(analyse, { startSaldi: beginstanden });
console.log('  Gebaseerd op ' + p.maandenGebruikt + ' ingelezen maanden (' + p.periode.van + ' t/m ' + p.periode.tot + ')\n');
console.log('   Inkomen per maand (mediaan)      ' + rechts(eur(p.inkomen), 12));
console.log('   Vaste lasten                     ' + rechts('-' + eur(p.vasteLasten), 12));
console.log('   Stuurbare uitgaven               ' + rechts('-' + eur(p.variabelGemeten), 12));
console.log('   ' + '-'.repeat(45));
console.log('   Ruimte per maand                 ' + rechts(eur(p.ruimteNu), 12));
console.log('\n   Oorlogskasdoel (6 × burn ' + eur(p.burnNu) + ')  ' + rechts(eur(p.oorlogskasDoel), 12));
console.log('   Daarvan nu                       ' + rechts(eur(p.standen.oorlogskas), 12));
console.log('\n   Verdeling van je ruimte deze maand:');
console.log('     1. oorlogskas                  ' + rechts(eur(p.verdelingNu.oorlogskas), 12));
console.log('     2. autopot                     ' + rechts(eur(p.verdelingNu.autopot), 12));
console.log('     3. beleggen                    ' + rechts(eur(p.verdelingNu.beleggen), 12));
console.log('\n   Autopot over 12 maanden          ' + rechts(eur(p.autopot12Nu), 12) +
  '   → ' + (p.ladderNu.huidige ? p.ladderNu.huidige.naam : 'nog onder de eerste trede'));
if (p.ladderNu.volgende) console.log('   Nog ' + eur(p.ladderNu.tekort) + ' tot ' + p.ladderNu.volgende.naam + '.');

// ---- streefscenario
kop('8. DE PLANNER — met streefbedragen');
var streef = {};
p.stuurbaar.forEach(function (c) {
  if (c.id === 'ueten') streef[c.id] = Math.round(c.gemeten * 0.5);
  if (c.id === 'spullen') streef[c.id] = Math.round(c.gemeten * 0.6);
});
var q = Planner.plan(analyse, { startSaldi: beginstanden, streef: streef });
console.log('  ' + vul('categorie', 24) + rechts('gemeten', 11) + rechts('streef', 11) + rechts('verschil', 11));
console.log('  ' + '-'.repeat(57));
q.stuurbaar.forEach(function (c) {
  console.log('  ' + vul(c.naam, 24) + rechts(eur(c.gemeten), 11) + rechts(eur(c.streef), 11) +
    rechts(c.verschil ? eur(c.verschil) : '—', 11));
});
console.log('  ' + '-'.repeat(57));
console.log('  ' + vul('samen', 24) + rechts(eur(q.variabelGemeten), 11) + rechts(eur(q.variabelStreef), 11) +
  rechts(eur(q.winstPerMaand), 11));

console.log('\n   Dat levert op: ' + eur(q.winstPerMaand) + ' per maand, ' + eur(q.winstPerJaar) + ' per jaar.');
console.log('   Autopot over 12 maanden: ' + eur(p.autopot12Nu) + '  →  ' + eur(q.autopot12Plan));
console.log('   Trede:                   ' + (p.ladderNu.huidige ? p.ladderNu.huidige.naam : '—') +
  '  →  ' + (q.ladderPlan.huidige ? q.ladderPlan.huidige.naam : '—'));
console.log('   Vermogen over ' + q.instellingen.projectieJaren + ' jaar:   ' + eur(p.eindNu) + '  →  ' + eur(q.eindPlan) +
  '   (' + eur(q.eindPlan - p.eindNu) + ' verschil)');

kop('9. MIJLPALEN');
console.log('  ' + vul('mijlpaal', 26) + rechts('doel', 11) + rechts('dit tempo', 16) + rechts('met streef', 16) + '   sneller');
q.mijlpalen.forEach(function (m) {
  function wanneer(d, n) {
    if (n === 0) return 'gehaald';
    if (n == null) return 'niet op dit tempo';
    return d.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
  }
  var sneller = m.sneller && m.sneller > 0 ? m.sneller + ' mnd eerder' : '';
  console.log('  ' + vul(m.naam, 26) + rechts(eur(m.doel), 11) +
    rechts(wanneer(m.datum, m.maanden), 16) + rechts(wanneer(m.datumPlan, m.maandenPlan), 16) + '   ' + sneller);
});

// ------------------------------------------------------------- 10. controles
kop('10. CONTROLES');
var fouten = [];
function check(naam, a, b, marge) {
  if (Math.abs(a - b) > (marge || 0.02)) fouten.push(naam + ': ' + eur(a, 2) + ' ≠ ' + eur(b, 2));
}
analyse.maanden.forEach(function (m) {
  check(m.maand + ' netto', m.netto, m.inkomen - m.uitgaven);
  check(m.maand + ' uitgaven opgedeeld', m.uitgaven, m.vast + m.variabel);
  var uitCat = Object.keys(m.perCategorie).reduce(function (t, k) {
    return t + (m.perCategorie[k] < 0 ? Math.abs(m.perCategorie[k]) : 0);
  }, 0);
  check(m.maand + ' categorieën tellen op', m.uitgaven, uitCat);
});
check('ruimte = inkomen - vast - variabel', p.ruimteNu, p.inkomen - p.vasteLasten - p.variabelGemeten);
check('verdeling telt op tot de ruimte', p.ruimteNu,
  p.verdelingNu.oorlogskas + p.verdelingNu.autopot + p.verdelingNu.beleggen);
var dubbelTest = A.ontdubbel([analyse.transacties, analyse.transacties]);
if (dubbelTest.transacties.length !== analyse.transacties.length) fouten.push('ontdubbelen laat dubbele regels door');

if (fouten.length) { fouten.forEach(function (f) { console.log('  x ' + f); }); process.exitCode = 1; }
else {
  console.log('  Alles telt op: netto = inkomen − uitgaven, uitgaven = vast + variabel,');
  console.log('  de categorieën tellen op tot de maanduitgaven, de verdeling tot je ruimte,');
  console.log('  en hetzelfde bestand twee keer inlezen verandert niets.');
}
console.log('');
