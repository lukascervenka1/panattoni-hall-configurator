# Geometrie a množství

Konstanty jsou v [src/configurator/calculations/constants.ts](../src/configurator/calculations/constants.ts) a jsou **demo**, ne schválené standardy. Výpočty jsou čisté funkce, pokryté testy ([calculations.test.ts](../src/configurator/calculations/calculations.test.ts)).

## Osy a fasády

Délka L podél osy x, šířka W podél z, střed půdorysu v počátku.

| Fasáda | Poloha | Obsahuje |
| --- | --- | --- |
| front | +z (dlouhá) | okna administrativy |
| rear | -z (dlouhá) | nakládací doky |
| left | -x (krátká) | okna administrativy |
| right | +x (krátká) | vjezdová vrata |

Administrativa je v levém předním rohu. Skupiny otvorů jsou na různých fasádách, takže spolu nekolidují; překryv uvnitř fasády hlídá `findOpeningProblems`.

## Výšky

Světlá vnitřní výška (zadává uživatel) a celková výška: **celková = světlá + 2,0 m** (střešní skladba a atika). Zjednodušený převod, ne statický návrh. Střešní deska je 1 m nad světlou výškou, zbytek je atika.

## Plochy

| Veličina | Definice |
| --- | --- |
| Zastavěná plocha | L × W |
| Administrativa, jedno podlaží | celková plocha administrativy / počet podlaží; **je uvnitř** zastavěné plochy |
| Podlahová plocha administrativy | součet přes podlaží |
| Celková podlahová plocha | zastavěná + (administrativa celkem − její přízemí) |
| Hrubá plocha fasády | obvod × celková výška |
| Čistá plocha fasády | hrubá − vrata − okna (každý otvor jednou) |
| Plocha střechy | zastavěná − světlíky (světlíky se účtují zvlášť) |
| Světlíky | 2 % plochy; v zóně doků (24 m od zadní fasády, jen když jsou doky) 5 % |

Množství se zaokrouhluje na 0,01, počty jsou celá čísla.

## Otvory

- Doky 3 × 3 m, práh 1,2 m, nejmenší osová rozteč 4,5 m (preferovaná 6 m), krajní rezerva 6 m. Kapacita = `floor((L - 12 - 3) / 4,5) + 1`.
- Vjezdová vrata 4 × 5 m, rozteč nejméně 6,5 m (preferovaná 9 m), krajní rezerva 6 m.
- Okna 1,5 × 1,5 m po 3 m, parapet 0,9 m nad podlahou podlaží. Na přední fasádě `floor(šířka_administrativy / 3)` a na boční 4 okna na podlaží.
- Skupiny se rozmísťují souměrně kolem středu fasády.

## Administrativa

Hloubka 12 m, výška podlaží 3,5 m. Musí se vejít do haly: délka nejvýše 40 % délky haly, zbývající hloubka haly nejméně 12 m, minimálně 6 m délky. Pod světlou výšku se vejde `n · 3,5 + 0,5 ≤ světlá výška`, tedy dvě podlaží od 7,5 m a tři od 11 m. Volit lze 1–3 podlaží včetně přízemí; při snížení haly normalizace počet podlaží omezí. Celková zadaná plocha administrativy se dělí počtem podlaží, přízemí se podruhé nepřičítá k zastavěné ploše.

## Okolí (ilustrativní)

Čistá funkce `layoutSurroundings`. Auta, lidé, kamiony a stromy mají **pevné rozměry**, mění se jejich počet a poloha. Parkoviště max. 72 m dlouhé před fasádou, manipulační plocha 38 m za doky, stromy na mřížce 12 m ukotvené ve světových souřadnicích (deterministické), vždy mimo budovu, zpevněné plochy a silnici (testováno).


## Půdorys L

Obdélník L × W s **výřezem v pravém předním rohu** (+x, +z) o rozměrech `notchLengthM` × `notchWidthM`. Dvorek ve výřezu je zpevněný a ilustrativní.

- **Fasády:** šest místo čtyř. `front` se zkrátí na L − výřez, `right` na W − výřez; přibývají vnitřní stěny `notchA` (směřuje +z, délka = délka výřezu) a `notchB` (směřuje +x, délka = šířka výřezu). Součet délek fasád je stále 2 · (L + W).
- **Plochy:** zastavěná plocha = L × W − výřez. Obvod obálky, hrubá plocha fasády a okna se nemění; plocha střechy, podlahy, světlíků a ceny podle zastavěné plochy klesá.
- **Otvory:** doky jsou na zadní fasádě (celé délce L), vjezdová vrata na kratší pravé fasádě (kapacita podle W − výřez), administrativa vlevo vpředu. Při fasádním prosvětlení mají horní okna i vnitřní stěny výřezu.
- **Meze (kód, ne Excel):** výřez nejméně 12 m a ramena po něm nejméně 24 m široká (`DEMO_GEOMETRY.notch`). Administrativa musí zůstat vedle výřezu (šířka nejvýše délka přední fasády − 6 m). Na příliš malé haly se L nenabídne.
- **Pravidla katalogu:** `notch_length_m` / `notch_width_m` (min 12, krok 6; používají se jen u L) a parametr `shape` (`rect`, `L`).
- **3D:** stěny, střecha, podlaha i obrubník atiky se stavějí z polygonu půdorysu; světlíky, střešní jednotky, regály, sloupy a svítidla se ve výřezu vynechávají. Při přepnutí tvaru výřez plynule vyroste z nuly (nebo se zmenší), v každém kroku platně.

## Prosvětlení haly

`daylight` má tři hodnoty: `roof` (výchozí, také při importu starší konfigurace), `facade` a `both`. Kombinace `both` zachovává plný rozsah světlíků varianty `roof` a současně přidává horní fasádní okna varianty `facade`; jejich plochy se obě promítají do souhrnu i serverové kalkulace. Fasádní varianta odstraní střešní světlíky i jejich skutečné otvory, obruby a světelné kužely. Horní fasádní okna (`hallWindow`) leží mezi sloupy, mimo administrativu a nad vraty. Horní hrana je 0,2 m pod světlou výškou; výška okna je nejvýše 1,5 m a u nízkých hal se zmenší, aby spodní hrana zůstala nad 5 m. Logo má stabilní kotvu nezávislou na `daylight` (`placeHallSigns` v `layout.ts`): kolidující horní okna se vynechají s 0,3m odstupem od loga. Ve fasádě pod logem nevzniknou otvory; počet a plocha vynechaných oken se nezapočítávají do množství ani ceny. Rozvržení je ilustrační, nejde o ekvivalentní světelný výkon ani výpočet denního osvětlení.

Okna administrativy (`window`) se oběma variantami nemění. Množství a souhrn vykazují okna haly a administrativy odděleně; ceníková báze `window_area` je součtem obou zasklených ploch a používá společnou vybranou variantu hliníkového okna. Při `facade` je `skylight_area` nula a plocha krytiny odpovídá celému půdorysu. Čistá plocha opláštění odečítá i nová fasádní okna.
