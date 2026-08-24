/* Categorieën en de regels die transacties eraan koppelen.
   Regels zijn gewone tekstpatronen; je kunt ze aanpassen en aanvullen.
   Eerste passende regel wint, dus specifiek boven algemeen.               */
(function (root) {
  'use strict';

  // soort bepaalt hoe de planner ermee rekent:
  //   inkomen  telt op    | vast     vaste last  | variabel  stuurbaar
  //   sparen   gaat opzij | intern   telt niet mee (eigen geld heen en weer)
  var CATEGORIEEN = [
    { id: 'salaris',      naam: 'Salaris',              soort: 'inkomen',  kleur: '#35c48b' },
    { id: 'inkomen-ov',   naam: 'Overig inkomen',       soort: 'inkomen',  kleur: '#5fd3a4' },
    { id: 'intern',       naam: 'Interne overboeking',  soort: 'intern',   kleur: '#4c5c68' },
    { id: 'creditcard',   naam: 'Creditcard-afrekening',soort: 'intern',   kleur: '#4c5c68' },
    { id: 'gezamenlijk',  naam: 'Gezamenlijke rekening',soort: 'vast',     kleur: '#f5a524' },
    { id: 'wonen',        naam: 'Wonen',                soort: 'vast',     kleur: '#e0913a' },
    { id: 'energie',      naam: 'Energie & water',      soort: 'vast',     kleur: '#d9a441' },
    { id: 'zorgpremie',   naam: 'Zorgverzekering',      soort: 'vast',     kleur: '#c98b6b' },
    { id: 'verzekering',  naam: 'Verzekeringen',        soort: 'vast',     kleur: '#b8836f' },
    { id: 'telecom',      naam: 'Telefoon & internet',  soort: 'vast',     kleur: '#8f8fd6' },
    { id: 'abonnement',   naam: 'Abonnementen',         soort: 'vast',     kleur: '#a07fd0' },
    { id: 'sport',        naam: 'Sport',                soort: 'vast',     kleur: '#6fbf9f' },
    { id: 'autovast',     naam: 'Auto — vaste lasten',  soort: 'vast',     kleur: '#c2703f' },
    { id: 'belasting',    naam: 'Belasting & overheid', soort: 'vast',     kleur: '#9a6b52' },
    { id: 'boodschappen', naam: 'Boodschappen',         soort: 'variabel', kleur: '#5ea8e0' },
    { id: 'ueten',        naam: 'Uit eten & bezorgen',  soort: 'variabel', kleur: '#7bbcea' },
    { id: 'vervoer',      naam: 'Vervoer & brandstof',  soort: 'variabel', kleur: '#4f93c8' },
    { id: 'spullen',      naam: 'Kleding & spullen',    soort: 'variabel', kleur: '#6f7fe0' },
    { id: 'vrijetijd',    naam: 'Vrije tijd',           soort: 'variabel', kleur: '#9d8ae8' },
    { id: 'reizen',       naam: 'Reizen',               soort: 'variabel', kleur: '#54c1c9' },
    { id: 'zorg',         naam: 'Zorg overig',          soort: 'variabel', kleur: '#c98b9c' },
    { id: 'contant',      naam: 'Contant opgenomen',    soort: 'variabel', kleur: '#7d8b96' },
    { id: 'personen',     naam: 'Naar personen',        soort: 'variabel', kleur: '#8fa3b0' },
    { id: 'studie',       naam: 'Studieschuld',         soort: 'vast',     kleur: '#a8794f' },
    { id: 'sparen',       naam: 'Sparen & beleggen',    soort: 'sparen',   kleur: '#35c48b' },
    { id: 'overig',       naam: 'Overig',               soort: 'variabel', kleur: '#6e8291' }
  ];

  // Patronen worden hoofdletterongevoelig getoetst op tegenpartij + omschrijving.
  var REGELS = [
    ['creditcard',   'american express|amex.*kaartrekening|hartelijk bedankt voor uw betaling'],
    ['sparen',       '\\b(to|from)\\b.*(flexible cash|savings|vault|pocket|robo portfolio|carta|investment account)|flexible cash funds|robo portfolio|degiro|meesman|brand new day|bitvavo|kraken|coinbase'],
    ['intern',       'open banking top.?up|top.?up by|eigen rekening|overboeking naar eigen|naar eigen rekening'],
    ['salaris',      'salaris|loon|wedde|periodenr'],
    ['inkomen-ov',   'toeslag|teruggaaf|belastingdienst.*teruggave|declaratie|vakantiegeld|refund|terugbetaling'],
    ['gezamenlijk',  'gezamenlijke rekening|gezamenlijke pas|huishoudpot'],
    ['wonen',        '\\bhuur\\b|huurtoeslag|hypotheek|\\bvve\\b|woningstichting|makelaar|vereniging van eigenaren'],
    ['energie',      'vattenfall|eneco|essent|greenchoice|budget energie|vandebron|oxxio|nuts|vitens|waternet|pwn|dunea|evides|waterschap'],
    ['zorgpremie',   'zilveren kruis|zorgverzekering|cz groep|vgz|menzis|ohra|fbto|dsw|achmea zorg'],
    ['verzekering',  'centraal beheer|univ[eé]|interpolis|nationale.?nederlanden|a\\.?s\\.?r|aegon|allianz|reaal|inboedel|aansprakelijkheid'],
    ['telecom',      'kpn|ziggo|odido|t.?mobile|vodafone|simyo|tele2|delta fiber|caiway|hollandsnieuwe'],
    ['abonnement',   'netflix|spotify|disney|videoland|hbo|max\\b|apple\\.com|apple store.*abo|icloud|itunes|google (one|storage|play)|youtube|openai|anthropic|claude|microsoft|adobe|dropbox|notion|github|steam.*abo|patreon|krant|nrc|volkskrant|telegraaf|fd\\b'],
    ['sport',        'basic.?fit|trainmore|sportschool|fit for free|anytime fitness|zwembad|hockey|voetbalvereniging'],
    ['autovast',     'motorrijtuigenbelasting|wegenbelasting|autoverzekering|apk|rdw|anwb|leas'],
    ['studie',       '\\bduo\\b|dienst uitvoering onderwijs|studiefinanciering|studieschuld'],
    ['belasting',    'belastingdienst|openbaar lichaam belasting|gemeente|cjib|waterschapsbelasting|omgevingsdienst|rijksoverheid'],
    ['boodschappen', 'albert heijn|jumbo|lidl|aldi|plus supermarkt|dirk van den broek|picnic|coop|spar|vomar|hoogvliet|ekoplaza|marqt|kruidvat|etos|slager|bakker'],
    ['ueten',        'thuisbezorgd|uber ?eats|deliveroo|dominos|new york pizza|mcdonald|burger king|kfc|starbucks|coffee|caf[eé]|restaurant|brasserie|bistro|eetcafe|snackbar|febo|subway'],
    ['vervoer',      'motorfiets|shell|bp |esso|tango|tinq|total ?energies|total |q8|ns groep|ns-|nederlandse spoorwegen|ov.?chip|gvb|ret\\b|htm|arriva|connexxion|q.?park|parkeer|parkmobile|yellowbrick|greenwheels|uber\\b|bolt\\.eu|taxi'],
    ['spullen',      'vinted|bol\\.com|coolblue|amazon|zalando|about you|h&m|zara|uniqlo|primark|decathlon|hema|action|ikea|gamma|praxis|karwei|mediamarkt|blokker|wehkamp|marktplaats'],
    ['vrijetijd',    'path[eé]|kinepolis|ticketmaster|steam|playstation|nintendo|xbox|bioscoop|museum|concert|festival|boekhandel|libris'],
    ['reizen',       'twisted road|booking\\.com|airbnb|klm|transavia|ryanair|easyjet|tui|expedia|hotel|hostel|schiphol|rentalcars|sunweb'],
    ['zorg',         'apotheek|tandarts|huisarts|fysio|ziekenhuis|opticien|hans anders|specsavers|pearle'],
    ['contant',      'geldautomaat|geldmaat|gea,'],
    ['personen',     'via tikkie|betaalverzoek|\\btikkie\\b'],
    ['sparen',       'degiro|meesman|brand new day|bux|trading ?212|bitvavo|kraken|coinbase|beleggen|vermogensopbouw|spaarrekening']
  ].map(function (r, i) {
    return { id: 'r' + i, categorie: r[0], patroon: r[1], bron: 'standaard' };
  });

  function categorieVan(id) {
    for (var i = 0; i < CATEGORIEEN.length; i++) if (CATEGORIEEN[i].id === id) return CATEGORIEEN[i];
    return { id: id || 'overig', naam: id || 'Overig', soort: 'variabel', kleur: '#6e8291' };
  }
  function soortVan(id) { return categorieVan(id).soort; }

  function bouwToetser(regels) {
    return regels.map(function (r) {
      var re;
      try { re = new RegExp(r.patroon, 'i'); }
      catch (e) { re = null; }
      return { regel: r, re: re };
    }).filter(function (r) { return r.re; });
  }

  /* Kent aan elke transactie een categorie toe.
     - handmatig: {transactieId: categorieId} wint altijd
     - geleerd:   {sleutel: categorieId} van eerdere handmatige keuzes
     - regels:    standaardregels plus je eigen regels                      */
  function categoriseer(transacties, opties) {
    opties = opties || {};
    var regels = (opties.regels || []).concat(REGELS);
    var toetsers = bouwToetser(regels);
    var handmatig = opties.handmatig || {};
    var geleerd = opties.geleerd || {};
    // Je eigen rekeningen: geld daarheen is geen uitgave, geld vandaan geen inkomen.
    var eigen = (opties.eigenRekeningen || []).map(function (x) {
      return String(x).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }).filter(function (x) { return x.length >= 8; });

    transacties.forEach(function (t) {
      if (handmatig[t.id]) {
        t.categorie = handmatig[t.id]; t.toegekendDoor = 'handmatig'; return;
      }
      if (geleerd[t.sleutel]) {
        t.categorie = geleerd[t.sleutel]; t.toegekendDoor = 'geleerd'; return;
      }
      var tekst = t.tegenpartij + ' ' + t.omschrijving;
      if (eigen.length) {
        var kaal = tekst.toUpperCase().replace(/[^A-Z0-9]/g, '');
        for (var e = 0; e < eigen.length; e++) {
          if (kaal.indexOf(eigen[e]) > -1) {
            t.categorie = 'intern'; t.toegekendDoor = 'eigen rekening'; return;
          }
        }
      }
      for (var i = 0; i < toetsers.length; i++) {
        if (toetsers[i].re.test(tekst)) {
          t.categorie = toetsers[i].regel.categorie;
          t.toegekendDoor = toetsers[i].regel.id;
          return;
        }
      }
      // Niets gevonden: inkomend geld is inkomen, uitgaand is overig.
      t.categorie = t.bedrag > 0 ? 'inkomen-ov' : 'overig';
      t.toegekendDoor = null;
    });
    return transacties;
  }

  var Categorie = {
    CATEGORIEEN: CATEGORIEEN,
    REGELS: REGELS,
    categorieVan: categorieVan,
    soortVan: soortVan,
    categoriseer: categoriseer
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Categorie;
  root.Categorie = Categorie;
})(typeof globalThis !== 'undefined' ? globalThis : this);
