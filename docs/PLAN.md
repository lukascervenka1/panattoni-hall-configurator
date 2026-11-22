# Plán a stav milníků

Podle kap. 17 specifikace. Po každém milníku: co funguje, jak to ověřit, výsledky kontrol, omezení, další krok.

## M0: základ projektu (hotovo)

- Prázdný repozitář, jen zadání, HTML se seed daty a brand manuál. Bez git repozitáře.
- Stack: Next.js 16.4.6, React 19.3.1, TypeScript 5.9 (záměrně ne 7.x), Three.js 0.187, React Three Fiber 9.8.2, drei 10.7.9, Zustand 5, Zod 4, Tailwind 4, Vitest 5, Playwright 1.65. Zamčeno v `package-lock.json`.
- Datové kontrakty: [src/catalog/schema.ts](../src/catalog/schema.ts), [src/configurator/schema/config.ts](../src/configurator/schema/config.ts).
- Demo předpoklady: [ASSUMPTIONS.md](ASSUMPTIONS.md). Skills: [SKILLS.md](SKILLS.md).
- Brand: tokeny v [src/app/globals.css](../src/app/globals.css). Podle úpravy z 2026-11-21 zůstávají plochy bílé a betonové, hlavní tlačítka a aktivní přepínače používají firemní navy `#001844` s hoverem `#001b75`. Písmo Bai Jamjuree + Helvetica Neue/Arial a limetková `#93d50a` doplňují branding drobnými akcenty. Logo zachovává původní proporce.

## M1: první vertikální řez (hotovo)

Rozměry → geometrie → množství → serverová cena → souhrn. Viz README. Ověření:

```bash
npm run typecheck && npm test && npm run build && npm run test:e2e
```

## M2: produktová konfigurace (hotovo)

Volba materiálů (data i cenový model už jsou), okna a vrata s kolizemi (hotovo), příčky, interiér, technologie (vytápění odděleně pro halu a administrativu, vysvětlení neviditelných změn), fotovoltaika, rozšíření okolí, doladění tří konceptů.

## M3: správa katalogu

Excel šablona a datový slovník, import a validace (limity, makra, vzorce), snapshoty do PostgreSQL (`catalog_versions`, `catalog_publications`, `catalog_state`), diff, chráněný náhled, atomické publikování s kontrolou konfliktu, rollback, audit, autentizace administrace. Rozhraní `src/catalog/server.ts` zůstane, vymění se zdroj.

## M4: dokončení zákaznického toku

Lokální uložení, undo/redo, export a import JSON, export obrázku, poptávka (hotový vertikální řez s mock adaptérem a připraveným adaptérem Dynamics 365, viz [INQUIRY.md](INQUIRY.md); čeká na kontrakt CRM, BlueHub a schválení), mobil a přístupnost (audit podle `web-design-guidelines`).

## M5: hardening a předání

Bezpečnostní kontroly, výkon (měření na popsaném zařízení), preview deployment po schválení, provozní runbook, sdílený rate limit.


### Co přinesl M2

- **Volba materiálů a technologií** v panelu: 13 kategorií, 45 voleb. Každá karta má větu o dopadu na model ("Viditelná změna." / "Bez změny vzhledu." s důvodem), tlačítko "Ukázat v modelu" (přepne pohled), detail (dodavatel, U, hmotnost, životnost, požární třída, GWP, EPD) a poznámku.
- **Pravidla voleb:** dostupnost pro koncept (`available_for_concept`) a zakázané kombinace (`forbidden_combination`) se čtou z katalogu; nedostupná volba je zakázaná s důvodem z pravidla.
- **Viditelný dopad v 3D** (mapování `material_key` → vzhled v `src/scene/options.ts`): barva fasády, sloupy a vazníky (prefabrikát / lepené dřevo / ocel), podlaha, střecha (včetně dřevěného stropu), externí nakládací dům, vrata, světlíky, okna, fotovoltaika, závěsné vytápění haly, tepelné čerpadlo u administrativy, osvětlení, vnitřní příčky.
- **Technologie ilustrativně:** žádná tepelná mapa ani výpočet spotřeby či výroby. Vytápění haly a administrativy je oddělené.
- **Ceny:** materiály mají sazby ze seedu; technologie a příčky ne (standardní volba 0, alternativy "vyžaduje individuální kalkulaci").
