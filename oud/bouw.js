/* Bouwt de repo tot één zelfstandig bestand voor de gedeelde link.
   Draaien met: node build/bouw.js   →   dist/salaris-monitor.html      */
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
  '    <div class="merk">Salaris Monitor <span>&mdash; jouw tempo, doorgetrokken</span></div>',
  '    <nav class="tabs">',
  '      <button data-actie="tab" data-tab="dashboard" class="actief">Dashboard</button>',
  '      <button data-actie="tab" data-tab="invoer">Invoer</button>',
  '      <button data-actie="tab" data-tab="instellingen">Instellingen</button>',
  '    </nav>',
  '  </div>',
  '</header>',
  '<main id="app"></main>',
  '<div class="opslag" id="opslag" title="Tik om nu op te slaan"><i></i><span>opgeslagen</span></div>'
].join('\n');

var opslag = lees('src/artifact-opslag.js')
  .replace("'__FONTS__'", JSON.stringify(FONTS))
  .replace("'__SCHIL__'", JSON.stringify(SCHIL));

var code = [
  '/* Salaris Monitor — alles in één bestand. Bron: github.com/davidvossvoss-hue/monitor */',
  lees('src/model.js'),
  lees('src/store.js'),
  lees('src/ui.js'),
  lees('src/dashboard.js'),
  lees('src/invoer.js'),
  lees('src/instellingen.js'),
  opslag,
  lees('src/app.js')
].join('\n\n');

if (code.indexOf('</scr' + 'ipt>') > -1) {
  throw new Error('De code bevat een letterlijke sluit-scripttag; die breekt het bestand.');
}

var uit = [
  '<title>Salaris Monitor</title>',
  FONTS,
  '<style id="stijl">',
  lees('src/styles.css'),
  '</style>',
  SCHIL,
  '<script id="staat" type="application/json">{}</scr' + 'ipt>',
  '<script id="code">',
  code,
  '</scr' + 'ipt>'
].join('\n');

fs.mkdirSync(path.join(wortel, 'dist'), { recursive: true });
fs.writeFileSync(path.join(wortel, 'dist/salaris-monitor.html'), uit);
console.log('dist/salaris-monitor.html geschreven — ' + Math.round(uit.length / 1024) + ' kB');
