# Salaris Monitor

Eén gebruiker, één browser. Geen inlog, geen accounts, geen cloud, geen bankkoppeling.
Alles staat in `localStorage`; exporteer af en toe een JSON-back-up via Instellingen.

**Openen:** dubbelklik `index.html`. Dat is alles — geen build, geen dependencies.
(Wil je het via een servertje: `npm start`.)

**Op je telefoon, via een vast linkje:**
<https://claude.ai/code/artifact/519e9ff8-8883-4f50-b633-b1f9bd69facf>

Die pagina is dezelfde app, in één bestand, en schrijft zichzelf weg: elke
wijziging gaat direct naar het toestel waar je op zit, en zodra je even niets
doet ook naar de link zelf. Open je hem later op een ander toestel, dan wordt
de nieuwste van die twee gebruikt. Het lampje onderin toont wat er gebeurt;
tik erop om meteen op te slaan.

Bouwen na een wijziging in `src/`: `npm run bouw` schrijft
`dist/salaris-monitor.html`. Publiceer dat bestand naar dezelfde link, dan
blijft de repo de enige bron van waarheid.

**Rekenmodel controleren:** `npm test` (of `node src/model.test.js`) rekent drie
voorbeeldmaanden door en print elke stap plus de controles.

---

## Het rekenmodel

Op salarisdag, in deze volgorde:

```
salaris
  − vaste lasten wonen & eten      (mijn deel van de gezamenlijke pas)
  − vaste lasten overig            (AI-abo's, tanken, telefoon, ...)
  − inleg reserveringen deze maand
  = SURPLUS
        ├── 70% → investeren   ┐
        └── 30% → besteedbaar  ┘  (percentages instelbaar)
```

Het investeringsdeel gaat in strikte volgorde in de bakken:

```
investeren
  1. oorlogskas   tot het doel bereikt is, daarna niets meer
  2. autopot      60% van wat er na de oorlogskas overblijft (instelbaar)
  3. beleggen     alles wat dan nog over is
```

**Oorlogskasdoel** = 6 × de totale maandelijkse burn rate, en burn rate is
*alles*: mijn deel van de gezamenlijke pas + vaste lasten overig + wat ik echt
uitgeef. Niet alleen de abonnementen. Het aantal maanden is instelbaar, en je
kunt een vast doelbedrag opgeven als je de berekening wilt overrulen.

### Uitgaven

Welke kaart je gebruikt maakt niet uit; er is geen logica per kaart en geen
categorie-indeling. Twee bedragen per maand:

| Wat | Effect |
|---|---|
| Gezamenlijke pas, totaal | × mijn deel (default 50%) → vaste last wonen & eten, gaat vóór het surplus eraf |
| Mijn eigen uitgaven, alle kaarten samen | komt volledig uit het besteedbare deel |

> **Eén keuze die je even moet controleren:** het bedrag naar de gezamenlijke pas
> wordt op één plek in het model verwerkt — als vaste last, vóór de
> surplusberekening. Het telt daarna *niet* nog eens mee als uitgave uit je
> besteedbare geld, want dan zou je hetzelfde geld twee keer aftrekken. Vul bij
> "gezamenlijke pas totaal" dus in wat er in totaal van die rekening af ging;
> het percentage in Instellingen maakt er jouw deel van. Deel je fiftyfifty en
> gaat er samen € 3.600 af, dan is jouw vaste last € 1.800.

Ga je over je besteedbare bedrag heen, dan wordt exact getoond hoeveel eroverheen
en waar het vandaan komt: eerst uit wat je in eerdere maanden overhield
(besteedbaar-buffer), daarna autopot, dan beleggen, dan oorlogskas. Geen
waarschuwing, geen oordeel — alleen het getal.

### Reserveringen

Geld dat binnen is maar al vergeven aan een bekende komende betaling.

* Naam, bedrag, inlegmaand, verwachte betaalmaand.
* Het bedrag gaat **vóór** de surplusberekening van het salaris af.
* Vink je hem af in de maand dat je betaalt, dan wordt dat bedrag van je uitgaven
  van die maand afgetrokken — het telt dus niet nóg een keer.

Zonder deze bak ziet een maand waarin je € 5.000 parkeert eruit als een rampmaand.

### Voorgeschoten

Zelfde logica, kleinere bak: geld dat je voorschiet en terugkrijgt
(werkdeclaraties, dingen die je met je broer deelt). Telt voor nul mee in je
budget — het gaat van je uitgaven af zodra je het invult. De lijst laat zien wat
er nog openstaat.

### Jaarruimte

Optioneel en standaard uit. Zet je in Instellingen een percentage > 0, dan gaat
dat deel van je beleggingsinleg naar een apart jaarruimte-potje met een eigen
jaardoel.

---

## Schermen

**Dashboard** — auto-ladder bovenaan (waar staat je autopot over 12 maanden op je
*gemeten* tempo, welke trede is dat, hoeveel nog tot de volgende), daaronder de
sturing voor deze maand (wat mag je uitgeven, per week, hoeveel al op, voor of
achter op schema), dan de potjes, dan de projectie over 20 jaar met twee lijnen
en de mijlpalen met geschatte datum.

**Invoer** — per maand: salaris, gezamenlijke pas totaal, eigen uitgaven (meerdere
regels die optellen tot één getal), notitie. Plus reserveringen en voorschotten
toevoegen en afvinken. Rechts zie je meteen wat het model ervan maakt.

**Instellingen** — vaste lasten, percentages, oorlogskasdoel, auto-ladder,
rendement, beginstanden, export/import. Niets in het model is hardcoded.

---

## Eerlijkheid

Elk getal komt uit wat je zelf hebt ingevuld. Is er nog geen maand ingevuld, dan
zegt het scherm dat, in plaats van voorbeeldcijfers te tonen. Gemiddelden zijn
gemeten over je ingevulde maanden, nooit een aanname over je gedrag.

## Bestanden

```
index.html            de app
build/bouw.js         bouwt src/ tot één bestand voor de gedeelde link
dist/salaris-monitor.html  het gebouwde bestand (niet met de hand bewerken)
src/model.js          het rekenmodel — puur, zonder DOM, los testbaar
src/model.test.js     drie voorbeeldmaanden + controles (npm test)
src/store.js          localStorage
src/ui.js             opmaak, valuta, SVG-grafiek
src/dashboard.js      scherm A
src/invoer.js         scherm B
src/instellingen.js   scherm C
src/app.js            routing, databinding, acties
src/artifact-opslag.js alleen in de gedeelde versie: schrijft de pagina weg
src/styles.css        vormgeving
```
