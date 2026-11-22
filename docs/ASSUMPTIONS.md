# Předpoklady a rozhodnutí (demo)

Neblokující nejasnosti jsou vyřešeny konzervativně. Před produkcí je třeba uzavřít otázky z kap. 19 specifikace.

## Zdroj a stav dat

- **Seed:** `Panattoni-Materials-Configurator.html` (8 kategorií, 31 variant, 12 fotek). Ceny, GWP, U-hodnoty, požární třídy a odkazy na EPD jsou převzaty beze změny; texty přeloženy do češtiny (`src/catalog/demo/cs-texts.ts`).
- **Význam cen:** ve zdroji odhad za m² nebo kus. Zobrazeno výslovně jako *orientační cena realizace, EUR bez DPH, nezávazná, DEMO*. Žádný nájem ani prodej, žádná měsíční cena, žádná DPH (zdrojový výpočet "navýšení nájmu" a "offset" nebyl převzat).
- **GWP a EPD:** uloženy ve volbách jako technický detail (zobrazí se v M2 u materiálu). Celkové emise stavby, kompenzace a tvrzení o úsporách nejsou součástí MVP.
- **Neúplný ceník:** zdroj nepokrývá zakládání, TZB, vnitřní příčky a vestavbu, zpevněné plochy ani zbylé otvory. Proto je celková cena vždy označena jako dílčí součet a ukazuje, co nezahrnuje.
- **Fotky:** pocházejí od výrobců (Ruukki, Kingspan, Hörmann a další). Před veřejným použitím je nutné ověřit licence.
- **Označení "Standard PNT":** převzato ze zdroje jako výchozí volba kategorie, není to potvrzený standard.

## Konfigurace

- Zastavěná plocha = L × W. Administrativa je vestavba uvnitř haly (viz [GEOMETRY.md](GEOMETRY.md)).
- Koncepty a jejich rozměry/pravidla jsou vymyšlené demo hodnoty. L-půdorys je mimo MVP.
- Konfigurace je připnutá k `catalogVersionId`. Neznámá verze → HTTP 409, žádný tichý přepočet.

## Zveřejnění cen

`meta.unit_rate_disclosure = "hidden"`: klient dostane položku, množství a mezisoučet, ne jednotkovou sazbu. Z množství a mezisoučtu lze sazbu odvodit; spec s tím počítá, kdo smí vidět sazby, je otevřená otázka č. 6.

## Technické volby

- TypeScript 5.9, protože 7.x je nový nativní překladač a projekt nepotřebuje riziko.
- ESLint zatím není nastaven (Next 16 už `next lint` neobsahuje). Doplnit v M5.
- Fonty ze `@fontsource` (samostatně hostované, žádné požadavky na Google).
- Rate limit `/api/price` je v paměti jedné instance; viz [OPERATIONS.md](OPERATIONS.md).
