# Konfigurátor hal (demo): M0 + M1

Interaktivní 3D konfigurátor průmyslových a logistických hal. Zadání: [PANATTONI_CONFIGURATOR_SPEC.md](PANATTONI_CONFIGURATOR_SPEC.md).

> **Všechna data jsou DEMO.** Ceny, rozměry, pravidla i parametry jsou seed z dodaného HTML katalogu materiálů a nejsou schválený ceník ani standardy Panattoni. Cena je orientační, nezávazná, v EUR bez DPH, a protože ceník nepokrývá celou stavbu, jde o **dílčí součet**. Okolí je ilustrativní situace.

## Spuštění

```bash
npm install
npm run dev          # http://localhost:3000
```

| Příkaz | Co dělá |
| --- | --- |
| `npm run typecheck` | kontrola typů (TypeScript, `strict`) |
| `npm test` | jednotkové a integrační testy (Vitest) |
| `npm run build` | produkční build |
| `npm run test:e2e` | browserové scénáře (Playwright; sám postaví a spustí produkční build na portu 3300) |
| `npm run catalog:extract` | znovu vytáhne demo seed z `Panattoni-Materials-Configurator.html` |

Při prvním spuštění e2e je potřeba `npx playwright install chromium`.

## Co funguje (M1)

- Tři koncepty (logistická hala, výrobní hala, městská logistika) jako **data**: předvolby a pravidla jsou v katalogu.
- Tvar půdorysu obdélník nebo **L** (výřez v rohu se dvorkem), délka, šířka, světlá výška; nakládací doky, vjezdová vrata, volitelná administrativa (1 nebo 2 podlaží). Parametrická geometrie, ne měřítko: okna a vrata se nedeformují, přibývají segmenty fasády.
- **Hala vzniká a roste před očima:** stavba se přehraje při načtení, při změně metráže plynule roste, doky a vestavba přibývají. Živé prostředí (pole, kopce, mraky, plot, doprava, která zajíždí na parkoviště). Viz [docs/SCENE.md](docs/SCENE.md).
- **Materiály a technologie (M2):** 13 kategorií s pravidly dostupnosti, viditelným dopadem na model nebo vysvětlením, proč se nemění. Fotovoltaika, vytápění, osvětlení a příčky jsou ilustrativní.
- Dva režimy se stálou kamerou: **Stavba** (panel + 3D) a **Náhled** (čistá prezentace, cena, rozpis, souhrn).
- Pohledy perspektiva / zepředu / zezadu / shora / interiér, bez střechy, kóty, den a večer, zvýraznění upravované části, kliknutí na vrata, okna nebo administrativu otevře sekci.
- Serverová cena (`POST /api/price`): server znovu validuje konfiguraci, sám spočítá množství a cenu, ignoruje podvržené hodnoty od klienta, rozpis po položkách, celá čísla v centech.
- Fallback bez 3D (půdorys z týchž výpočtů), ztráta WebGL kontextu, `prefers-reduced-motion`, světlý i tmavý vzhled podle systému.

## Co zatím NEfunguje (a není zobrazeno jako hotové)

Uložení a undo/redo, export a import JSON, export obrázku, poptávka, správa katalogu z Excelu, databáze, autentizace administrace. Viz [docs/PLAN.md](docs/PLAN.md).

## Struktura

```
src/app                 Next.js: stránka (server), /api/price
src/catalog             schéma katalogu (Zod), veřejná projekce, serverový přístup, demo data
src/configurator        schema (konfigurace), rules (validace, normalizace), calculations (plochy, otvory), state (Zustand)
src/pricing             peníze v centech, kalkulace, obsluha endpointu, limit požadavků
src/scene               čistá rozvržení + Three.js geometrie + React Three Fiber komponenty
src/ui                  rozhraní
src/tests               sdílené pomůcky testů
tests-e2e               Playwright
docs                    plán, předpoklady, geometrie, ceník, datový slovník, skills, provoz
```

Zásady: čisté výpočty nezávisí na Reactu ani Three.js; pravidla jsou oddělená od UI i vykreslování; veřejný katalog neobsahuje ceny (`src/catalog/public.ts`), neveřejné podklady importuje jen `src/catalog/server.ts` (`server-only`).
