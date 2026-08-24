/* Bouwt de app tot één zelfstandig bestand voor de gedeelde link.
   node build/bouw.js  →  dist/monitor.html                                  */
'use strict';
var fs = require('fs'), path = require('path');
var wortel = path.join(__dirname, '..');
var lees = function (f) { return fs.readFileSync(path.join(wortel, f), 'utf8'); };

var FONTS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap">'
].join('\n');

var SCHIL = [
  '<header class="top">',
  '  <div class="top-in">',
  '    <div class="merk">Geldmonitor <span>&mdash; je eigen tempo, doorgetrokken</span></div>',
  '    <nav class="tabs">',
  '      <button data-actie="tab" data-tab="inlezen" class="actief">Inlezen</button>',
  '      <button data-actie="tab" data-tab="indelen">Indelen<span class="teller"></span></button>',
  '      <button data-actie="tab" data-tab="analyse">Analyse</button>',
  '      <button data-actie="tab" data-tab="planner">Planner</button>',
  '      <button data-actie="tab" data-tab="instellingen">Instellingen</button>',
  '    </nav>',
  '  </div>',
  '</header>',
  '<main id="app"></main>',
  '<div class="opslag" id="opslag" title="Tik om nu op te slaan"><i></i><span>opgeslagen</span></div>'
].join('\n');

var opslagLaag = lees('src/artifact-opslag.js')
  .replace("'__FONTS__'", JSON.stringify(FONTS))
  .replace("'__SCHIL__'", JSON.stringify(SCHIL));

var code = [
  '/* Monitor — alles in één bestand. Bron: github.com/davidvossvoss-hue/monitor */',
  lees('src/rekenen.js'), lees('src/lezen.js'), lees('src/lezen-pdf.js'),
  lees('src/categorie.js'), lees('src/analyse.js'), lees('src/planner.js'),
  lees('src/opslag.js'), lees('src/ui.js'), lees('src/pdf-inlezen.js'),
  lees('src/schermen.js'), lees('src/planner-ui.js'),
  opslagLaag,
  lees('src/app.js')
].join('\n\n');

var sluit = '</scr' + 'ipt>';
[code, lees('src/styles.css')].forEach(function (stuk) {
  if (stuk.indexOf('</scr' + 'ipt>') > -1) throw new Error('Een bronbestand bevat een letterlijke sluit-scripttag.');
});

// pdf.js gaat mee het bestand in: zonder werkende internetverbinding moet het
// inlezen van een PDF op de telefoon net zo goed werken.
var pdfMain = lees('vendor/pdf.min.mjs');
var pdfWorker = lees('vendor/pdf.worker.min.mjs')
  // De worker heeft één export-regel aan het eind. Zonder die regel is het
  // gewoon een script, en kan hij als klassieke worker uit een blob starten.
  .replace(/export\s*\{[^}]*\}\s*;?\s*$/, '');

// De geminificeerde pdf.js exporteert onder verkorte namen. In een inline
// module kun je die niet bij naam aanroepen, dus zetten we de export-lijst om
// in een toewijzing aan window.
var exportRegel = /export\s*\{([^}]*)\}\s*;?\s*$/;
var treffer = pdfMain.match(exportRegel);
if (!treffer) throw new Error('Kan de export-lijst van pdf.js niet vinden.');
var paren = treffer[1].split(',').map(function (deel) {
  var stukken = deel.trim().split(/\s+as\s+/);
  var lokaal = stukken[0].trim();
  var naam = (stukken[1] || stukken[0]).trim();
  return JSON.stringify(naam) + ':' + lokaal;
}).join(',');
pdfMain = pdfMain.replace(exportRegel, 'window.pdfjsLib={' + paren + '};');

var uit = [
  '<title>Geldmonitor</title>',
  FONTS,
  '<style id="stijl">', lees('src/styles.css'), '</style>',
  SCHIL,
  '<script id="pdf-worker" type="text/plain">', pdfWorker, sluit,
  '<script id="pdf-main" type="module">',
  pdfMain.replace(/\/\/# sourceMappingURL=.*$/m, ''),
  sluit,
  '<script id="staat" type="application/json">{}' + sluit,
  '<script id="code">', code, sluit
].join('\n');

fs.mkdirSync(path.join(wortel, 'dist'), { recursive: true });
fs.writeFileSync(path.join(wortel, 'dist/monitor.html'), uit);
console.log('dist/monitor.html — ' + Math.round(uit.length / 1024) + ' kB');
