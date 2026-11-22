# Panattoni: interaktivni 3D konfigurator hal

> Implementační zadání pro Claude Code. Tento dokument je hlavním produktovým a technickým zadáním projektu. Obsahuje cílové chování, rozsah MVP, datový model, správu katalogu, doporučené skills a podmínky dokončení.

## 1. Pokyny pro implementujícího agenta

Pracuj jako seniorní full-stack vývojář se zkušeností s produktovým UX a parametrickou 3D grafikou. Nezůstaň u architektury: postupně implementuj spustitelnou aplikaci.

1. Nejprve prohlédni repozitář, existující konvence, závislosti a dostupné prostředí. Nepřepisuj funkční projekt bez důvodu.
2. Zaznamenej plán a předpoklady do projektové dokumentace. Tento dokument má přednost před obecnými doporučeními skills.
3. Implementuj po malých ověřitelných vertikálních řezech. Každý dokončený celek musí fungovat od ovládání přes výpočty až po zobrazení.
4. Nevyžaduj rozhodnutí u každého detailu. Pro neblokující nejasnosti zvol konzervativní výchozí řešení a zdokumentuj je.
5. Neodhaduj skutečné stavební standardy, ceny, certifikace, úspory ani dostupnost Panattoni. Demo data označ jako demo.
6. Nepublikuj produkční deployment, neprováděj destruktivní migrace a neposílej skutečné poptávky bez výslovného schválení.
7. Neprohlašuj testy za úspěšné, pokud nebyly spuštěny. Uveď skutečné výsledky a omezení.
8. Žádná nefunkční tlačítka vydávaná za hotové funkce. Nedokončené funkce jasně označ nebo nezobrazuj.

## 2. Produktová vize

Vybuduj novou generaci katalogu průmyslových a logistických hal Panattoni. Nejde o klasický e-shop s velkým množstvím produktů ani o CAD/BIM editor. Jde o interaktivní 3D showroom s několika výchozími koncepty, které zákazník upravuje podle svých potřeb.

Zákazník vybírá parametry v levém panelu a v pravé části okamžitě sleduje změny skutečného 3D modelu: hala se zvětšuje, zmenšuje, mění opláštění, okna, vrata a další podporované prvky. Vidí také jednoduché okolí a může nahlédnout dovnitř.

Cíl: přiblížit zákazníka produktu, vysvětlit jeho možnosti a převést zájem do strukturované poptávky. Výstup není závazná objednávka stavby.

**Zásada: malý katalog, mnoho řízených konfigurací.**

### Uživatelé

- Zákazník: vybírá koncept, konfiguruje, sleduje orientační cenu a vytváří poptávku.
- Editor dceřiné firmy: upravuje položky a ceny ve sdíleném Excelu.
- Administrátor: importuje, kontroluje, prohlíží náhled a publikuje katalog.
- Obchodník: dostává srozumitelný souhrn požadavků a cenový snímek.

## 3. Závazné předpoklady a hranice

- Primární platforma je web, hosting Vercel.
- Primární jazyk je čeština; texty a formátování připrav pro pozdější angličtinu.
- Veřejný konfigurátor bez povinného přihlášení zákazníka.
- Administrace musí mít skutečnou serverově ověřovanou autentizaci a autorizaci.
- Konfigurujeme koncept nové haly, nikoliv automaticky dostupnou nemovitost.
- Okolí je ilustrativní, nikoliv skutečný pozemek nebo ověřený dopravní návrh.
- Cena je orientační, nezávazná a založená na schváleném ceníku. Demo ceny musí být viditelně označené.
- Dokud není potvrzeno, zda jde o prodej, nájem nebo cenu realizace, demo používá pouze výslovně označenou orientační cenu realizace. Nekombinuj jednorázové a měsíční ceny.
- Rozměry a technická pravidla v demo datech nejsou schválené standardy Panattoni.
- Vizualizace nepotvrzuje stavební, požární, statickou ani provozní proveditelnost.
- Nepoužívej vymyšlené oficiální logo, certifikace ani tvrzení o energetických úsporách.
- Bez dodaného brand manuálu použij střídmý dočasný design a vyměnitelné designové tokeny.

## 4. Rozsah MVP

### Součást první verze

- Tři datově definované pracovní koncepty: logistická hala, výrobní hala, městská logistika.
- Obdélníkový parametrický půdorys.
- Délka, šířka a výška, odvozené plochy.
- Fasádní materiálové varianty a barvy.
- Okna administrativy a střešní světlíky.
- Vrata a nakládací doky s automatickým rozmístěním.
- Volitelná administrativa s jedním nebo dvěma podlažími.
- Jednoduché vnitřní příčky podle podporovaných presetů.
- Pohled bez střechy, základní interiérové vybavení.
- Základní volby osvětlení a vytápění; denní a večerní režim.
- Jednoduchá volitelná fotovoltaika v rámci podporované střešní varianty.
- Ilustrativní komunikace, manipulační plocha, parkování a zeleň.
- Serverová orientační kalkulace s rozpisem.
- Lokální uložení, undo/redo, export/import konfigurace a obrázek modelu.
- Souhrn a poptávkový tok.
- Import katalogu z XLSX, validace, rozdíly, neveřejný náhled, publikování a rollback.
- Responzivní rozhraní a fallback bez 3D.

### Další etapa

Půdorys L, vícepodlažní průmyslové objekty, ruční přesouvání prvků, porovnání variant, trvalé sdílené odkazy, reálné lokality, párování s dostupnými halami, ověřené energetické výpočty, CRM/BlueHub integrace a pokročilé administrační editory.

### Mimo MVP

CAD/BIM editor, statické a požární posouzení, závazná nabídka, platební brána, automatické potvrzení realizovatelnosti a fotorealistická simulace celého areálu.

## 5. Uživatelský tok a layout

### Začátek

Nabídni krátký volitelný vstup: účel prostoru, přibližná velikost a potřeba administrativy. Z odpovědí vyber vhodný preset. Uživatel musí mít možnost tento krok přeskočit.

### Desktop

- Levý panel přibližně 30–35 % šířky, vlastní scroll.
- Pravá část: dominantní stabilní 3D viewport.
- Výběr konceptu, postupně odkrývané sekce, krátké nápovědy, průběžný souhrn a cena.
- Primární akce „Poptat tuto konfiguraci“.
- Vizuální karty, materiálové vzorky, přepínače a posuvníky doplněné číselným vstupem.
- Nepřetěžuj uživatele všemi pokročilými volbami najednou.

### Mobil

3D náhled nahoře, konfigurace pod ním nebo v přístupném výsuvném panelu. Dotyková manipulace s modelem nesmí zablokovat scroll celé stránky. Umožni návrat k modelu a použití textového souhrnu bez 3D.

### Vizuální směr

Kultivovaný architektonický showroom, nikoliv generický SaaS dashboard. Model je hlavní vizuální prvek. Klidné rozhraní, čitelná typografie, jemné stíny a materiály. Animace vysvětlují změny; nepoužívej samoúčelné efekty.

## 6. Konfigurace haly a pravidla geometrie

### Geometrie

- Rozměry mění skutečnou parametrickou geometrii, ne měřítko kompletního modelu.
- Dveře, okna, auta a lidé se při změně délky haly nesmějí roztahovat.
- Opakující se fasádní a konstrukční segmenty přidávej nebo přerozděluj.
- Rozlišuj světlou vnitřní výšku a celkovou výšku. Zjednodušený převod musí být zdokumentovaný.
- Rozlišuj zastavěnou plochu, podlahovou plochu administrativy a další účtované plochy. Administrativní vestavbu nezapočítej automaticky podruhé do zastavěné plochy.

### Fasáda, okna a otvory

- Odděl vizuální materiál a barvu od technické skladby a ceny.
- Okna a vrata musí respektovat podporované fasády, hranice a rozestupy.
- Automaticky odvozuj maximální počet vrat od dostupné délky fasády.
- Neodečítej překrývající se otvory dvakrát; nepovoluj jejich kolizi.
- Světlíky, fotovoltaika a střešní technologie musí respektovat prostorové rezervy.

### Administrativa a interiér

- Administrativa má vlastní půdorys a počet podlaží; musí se vejít do haly.
- Dvě podlaží administrativy nejsou dvě podlaží celé haly.
- Pohled bez střechy musí skutečně odhalit vestavbu a příčky.
- Ilustrační regály a výrobní zóny nezaručují skladovací nebo výrobní kapacitu.
- Rozlišuj podporované konfigurovatelné prvky a dekorativní vybavení.

### Technologie

Vytápění haly a administrativy řeš odděleně. Neviditelnou změnu vysvětli hotspotem, popisem nebo interiérovým pohledem. Nepředstírej fyzikální simulaci ani energetický výpočet pomocí dekorativní tepelné mapy.

### Okolí

Okolí přepočítej při změně rozměrů. Auta, stromy a komunikace nesmějí zůstat uvnitř zvětšené budovy. Udržuj jasné upozornění, že jde o ilustrativní situaci.

## 7. 3D implementace a interakce

- Hybridní parametrický model: generovaná hlavní geometrie, opakované komponenty, optimalizované externí dekorativní assety.
- Otáčení, zoom a omezený posun kamery.
- Přednastavené pohledy: perspektiva, zepředu, zezadu, shora a interiér.
- Návrat na výchozí pohled, přepnutí den/večer, rozměry a skrytí střechy.
- Změna materiálu nesmí resetovat kameru.
- Kameru automaticky přizpůsobuj jen při potřebě udržet model v záběru.
- Zvýrazni právě upravovanou část; kliknutí na podporovaný prvek otevře odpovídající sekci.
- Respektuj prefers-reduced-motion.
- Při běžných změnách nevytvářej znovu celou scénu.
- Sdílej geometrie a materiály, vhodně instancuj opakované prvky, uvolňuj GPU prostředky.
- Používej omezený počet světel, adaptivní rozlišení a střídmý postprocessing.
- Ošetři načítání assetů, chyby, ztrátu grafického kontextu a nepodporované 3D.
- Nezačínej fyzikálním enginem, WebGPU migrací nebo vlastními shadery bez skutečné potřeby.

## 8. Technický stack

Pro nový projekt použij jako výchozí návrh:

- Next.js a TypeScript; serverová a klientská část v jednom projektu.
- React Three Fiber, Three.js a Drei pro 3D.
- Zustand pro klientský stav konfigurace.
- Zod pro validaci dat na hranicích systému.
- Tailwind CSS a přístupné UI komponenty.
- Spravovaný PostgreSQL pro katalog, publikování a poptávky.
- Vitest pro deterministickou logiku a Playwright pro browserové scénáře.
- Serverová XLSX knihovna vybraná podle údržby, licence a bezpečnosti; výběr zdokumentuj.

Před instalací ověř vzájemnou kompatibilitu verzí a ulož lockfile. Neupgraduj závislosti pouze proto, že příklad ve skillu používá jinou verzi.

### Architektonické zásady

- Jeden serializovatelný objekt produktové konfigurace.
- Oddělený prezentační stav kamery, otevřených panelů a denního režimu.
- Kontaktní údaje mimo konfiguraci a veřejné URL.
- Čisté výpočetní funkce nezávislé na Reactu a Three.js.
- Pravidlová vrstva oddělená od UI a renderování.
- Veřejný katalog oddělený od neveřejných cenových podkladů.
- Server je autoritou pro cenu, publikování a oprávnění.
- Databázové přihlašovací údaje a servisní klíče nikdy neposílej do prohlížeče.

Doporučené členění: `app`, `catalog`, `configurator/schema`, `configurator/state`, `configurator/rules`, `configurator/calculations`, `scene`, `pricing`, `imports`, `persistence`, `integrations`, `ui`, `tests`.

## 9. Správa katalogu přes Excel

### Základní tok

Sdílený Excel na SharePointu → administrátor stáhne XLSX → nahraje do administrace → serverová validace → přehled rozdílů → neveřejný náhled → explicitní publikování.

Excel je redakční prostředí, nikoliv živá produkční databáze. Veřejný web nikdy nečte rozpracovaný sešit. MVP nevyžaduje přímé připojení k Microsoft Graph ani Google Sheets.

### Struktura sešitu

#### `Instructions`

Verze šablony, popis sloupců, jednotek, povolených hodnot a postup publikování. Připrav vzorový sešit a datový slovník. Vstupní buňky odliš od vysvětlivek; používej datové validace a přehledné tabulky.

#### `Products`

`product_id`, `name_cs`, `description_cs`, `preset_id`, `active`, `sort_order`.

#### `Options`

`option_id`, `category_id`, `name_cs`, `description_cs`, `renderer_key`, `material_key`, `color_hex`, `active`, `sort_order`.

#### `Prices`

`price_id`, `option_id`, `unit`, `unit_price`, `currency`, `quantity_basis`, `price_mode`.

- Jednotky: `m2`, `m`, `piece`, `flat`.
- `quantity_basis` vybírá z podporovaných měr, například `footprint_area`, `net_facade_area`, `roof_area`, `office_floor_area`, `opening_count`, `one`.
- `price_mode` rozlišuje základní cenu a příplatek. Přesná pravidla skládání cen musí být explicitní a otestovaná.
- MVP podporuje jednu měnu na katalog. Žádné tiché měnové konverze.

#### `Presets`

`preset_id`, `parameter_id`, `value`.

#### `Rules`

`rule_id`, `product_id`, `parameter_id`, `rule_type`, `value`, `message_cs`.

Podporuj pouze předem implementované typy: minimum, maximum, krok, povinná volba, zakázaná kombinace a dostupnost pro koncept. Strukturované hodnoty musí mít jednoznačný formát popsaný v šabloně; složitější pravidla v MVP raději drž v kódu než v ručně psaných výrazech.

### Stabilní identifikátory

ID jsou neměnná a nezávislá na názvu. Přejmenování není nová položka. Preferuj deaktivaci před smazáním. Chybějící dříve existující ID zobraz jako rizikovou změnu; neodstraňuj historii konfigurací.

### Co může editor změnit bez vývoje

Ceny, názvy, popisy, pořadí, aktivitu, barvy, varianty existujících materiálů, podporované příplatky a presety v rámci existujících parametrů.

### Co vyžaduje vývoj

Nový typ geometrie, nepodporovaný stavební prvek, nový výpočet množství, nový typ pravidla nebo zásadně jiná interakce. Excel nemůže sám naučit renderer vykreslovat podzemní podlaží nebo nový tvar haly.

## 10. Import, validace a publikování

### Validace

- Verze šablony, povinné listy a sloupce.
- Typy, povinné hodnoty, duplicity ID a referenční integrita.
- Známé kategorie, komponenty, materiály, jednotky a pravidla.
- Číselné rozsahy, konečné hodnoty, nepovolené záporné ceny a konzistence měny.
- Konzistence presetů a dostupných možností.
- České desetinné zápisy řeš jednoznačně; nehádej nejasné kombinace oddělovačů.
- Nepovoluj makra, spustitelný kód ani libovolné výrazy.
- Cenové a řídicí buňky se vzorci odmítni s konkrétní chybou; nespoléhej na uložené výsledky vzorců.
- Nastav limity velikosti souboru, počtu řádků a rozbaleného obsahu XLSX. Ošetři poškozené soubory a škodlivé vstupy.
- Chyby uváděj s listem, řádkem, sloupcem, důvodem a návodem k opravě.

### Náhled a publikace

- Nahrání není publikování.
- Neplatný import nesmí změnit veřejný katalog.
- Zobraz přidané, změněné, deaktivované a chybějící položky včetně změn cen.
- Náhled musí být autentizovaný, nesmí být veřejně cachovaný ani indexovaný.
- Publikuj celou verzi atomicky. Nesmí existovat stav s částí nových a částí starých cen.
- Při publikaci ověř, že mezitím jiný administrátor nezměnil aktivní verzi; konflikt neřeš tichým přepsáním.
- Zaznamenej autora, čas, hash importu, výchozí a cílovou verzi.
- Rollback aktivuje předchozí snapshot a vytvoří nový auditní záznam.
- Cache klíčuj verzí katalogu. Po publikaci invaliduj veřejný ukazatel aktivní verze.
- Běžící konfigurace zůstává připnutá k původní verzi. Přepočet novým ceníkem vyžaduje viditelnou akci uživatele.

## 11. MVP databáze

Použij malé relační jádro a validované JSONB snapshoty katalogu. Není nutné ihned normalizovat každý list do desítek tabulek.

### `catalog_versions`

ID, verze schématu, validovaný katalog JSONB, neveřejná cenová data, hash importu, autor a čas vytvoření. Obsah verzí je neměnný. Veřejná API vracejí pouze explicitně vybranou veřejnou projekci.

### `catalog_publications`

Neměnná historie aktivací: ID, katalogová verze, předchozí verze, autor, čas a důvod. Jednoznačný aktuální ukazatel může být v malé pomocné tabulce `catalog_state`; aktualizuj jej ve stejné transakci jako auditní záznam.

### `saved_configurations`

ID, verze schématu konfigurace, produktová konfigurace JSONB, ID katalogové verze a časy. Serverové ukládání je volitelné pro první řez; lokální ukládání je povinné. Pokud přidáš veřejné sdílení, použij neuhodnutelný token a odděl kontaktní údaje.

### `inquiries`

ID, konfigurace, ID katalogové verze, serverový cenový snímek, kontakt, poznámka, stav a čas. Přístup pouze oprávněným uživatelům. Definuj retenční pravidla před produkcí.

Pokud použiješ Supabase, navrhni a otestuj RLS. Pokud jiný PostgreSQL, zajisti odpovídající oprávnění a serverovou autorizaci. Nezaváděj Supabase pouze kvůli doporučenému skillu.

## 12. Cenotvorba

- Výpočet probíhá na serveru ze schválené katalogové verze.
- Klient posílá volby a rozměry, nikoliv důvěryhodnou cenu nebo množství.
- Server znovu validuje konfiguraci a sám vypočítá účtované množství.
- Vrať položkový rozpis: položka, množství, jednotka, sazba podle pravidel zveřejnění, mezisoučet, měna, katalogová verze a cenové výhrady.
- Peníze počítej pomocí přesného desetinného typu nebo definovaných celočíselných jednotek; zdokumentuj zaokrouhlování.
- Zamez dvojímu započítání standardu a jeho náhrady příplatkovou variantou.
- Rozlišuj cenu bez DPH a s DPH. Bez schváleného daňového režimu zobraz pouze jasně označenou cenu bez DPH; nevymýšlej sazbu.
- Neúplný ceník nesmí vytvořit zdánlivě kompletní celkovou cenu. Ukaž „vyžaduje individuální kalkulaci“ a případně jasně označený dílčí součet.
- Neposílej interní náklady a marže do veřejného katalogu ani bundle.
- Počítej s tím, že veřejně zobrazovanou prodejní sazbu lze někdy odvodit z opakovaných kalkulací.
- Debounce klientských požadavků, ruš nebo ignoruj zastaralé odpovědi a zobraz stav přepočtu.
- Omez zneužívání cenového endpointu. Při chybě serveru nevydávej poslední cenu za cenu aktuální konfigurace.

## 13. Ukládání a poptávka

- Lokální automatické ukládání, obnovení, undo/redo a reset s potvrzením.
- Export/import JSON s verzí schématu, validací a limity velikosti.
- Export obrázku aktuálního modelu; ošetři CORS a neúspěšný export.
- Souhrn konfigurace v lidsky čitelné podobě.
- Kontaktní formulář: firma, kontaktní osoba, e-mail, volitelný telefon a poznámka; sbírej jen potřebná data.
- Demo režim používá jasně označený mock adaptér a nikdy netvrdí skutečné odeslání.
- Produkční adaptér ukládá poptávku serverově, ověří cenu a používá idempotenci proti duplicitám.
- Bez schváleného CRM kontraktu neimplementuj fiktivní BlueHub integraci.
- Lokální uložení není sdílení mezi zařízeními; tuto funkci neslibuj bez serverového řešení.

## 14. Bezpečnost a provoz

- Oprávnění kontroluj u každé serverové administrační operace, nejen skrytím tlačítek.
- Chraň upload, preview, publikování a rollback. Zvaž CSRF ochranu podle zvolené autentizace.
- Vstupy validuj serverově; texty bezpečně vykresluj bez neověřeného HTML.
- Tajemství ukládej do prostředí, připrav `.env.example` bez skutečných hodnot.
- Produkční a preview prostředí nesmějí omylem sdílet zápis do produkčních dat.
- Na Vercelu nepoužívej lokální filesystem jako trvalé úložiště uploadů nebo katalogu.
- Zvol databázový connection pooling vhodný pro serverless provoz.
- Omez a zdokumentuj logování osobních a cenových dat.
- Před produkcí potvrď firemní schválení hostingu, regionu dat, zpracovatelů, přístupů a retenčních pravidel.
- Připrav migrace, zálohovací/obnovovací postup a stručný provozní runbook.

## 15. Skills pro Claude Code

Následující výběr vychází z posouzení veřejné dokumentace repozitářů. Není to záruka bezpečnosti ani prakticky otestovaná kombinace. Před instalací zkontroluj aktuální obsah, licence, skripty a kompatibilitu. Preferuj projektovou instalaci, eviduj použitou revizi a neposkytuj instalačním skriptům produkční klíče.

### A. Three.js a React Three Fiber

[CloudAI-X / threejs-skills](https://github.com/CloudAI-X/threejs-skills/tree/main/)

Prioritní skills:

- `threejs-react-three-fiber`: React a 3D scéna.
- `threejs-geometry`: parametrická geometrie a opakované prvky.
- `threejs-materials`: opláštění, sklo a beton.
- `threejs-lighting`: čitelné architektonické osvětlení.
- `threejs-interaction`: kamera a výběr prvků.
- `threejs-performance`: měření a optimalizace scény.
- `threejs-asset-pipeline`: optimalizace externích modelů.

Instalační příkaz uvedený v dokumentaci repozitáře:

```bash
npx skills add cloudai-x/threejs-skills
```

Sada je komunitní. Její příklady cílí na konkrétní verze knihoven; nejprve porovnej s projektem. Neinstaluj paralelně další překrývající se sadu bez důvodu.

Alternativa, nikoliv povinný doplněk: [EnzeD / r3f-skills](https://github.com/enzed/r3f-skills?ref=explainx).

### B. Vizuální návrh

[Anthropic / frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)

Použij při návrhu a úpravách rozhraní. Zadání pro tento skill: architektonický showroom, dominantní hala, klidný levý panel, materiálové vzorky, srozumitelné změny a respektování dodaného brandu. Nepřeváděj produkt na generický dashboard.

### C. React, Next.js a UX audit

[Vercel Labs / agent-skills](https://github.com/vercel-labs/agent-skills)

Vyber:

- `vercel-react-best-practices`: výkon Reactu/Next.js, načítání dat, oddělené načítání 3D a velikost bundle. Složka v repozitáři je `react-best-practices`.
- `web-design-guidelines`: přístupnost, formuláře, focus, dotykové ovládání, animace a lokalizace.
- `vercel-optimize`: volitelně až po nasazení, při auditu skutečných provozních metrik.

### D. Browserové ověřování

[Anthropic / webapp-testing](https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md)

Použij pro ovládání aplikace, screenshoty a browserové logy. Dokumentovaný workflow používá Python Playwright. Pokud projekt již má TypeScript Playwright, nezaváděj duplicitní infrastrukturu jen kvůli skillu; využij jeho principy a respektuj projektový testovací stack.

Browserový test ovládání ani screenshot sám o sobě nepotvrzuje správnost geometrie nebo ceny. Ty testuj samostatně.

### E. PostgreSQL

[Supabase / agent-skills](https://github.com/supabase/agent-skills)

Použij `supabase-postgres-best-practices` pro schéma, migrace, dotazy, připojení, oprávnění a případně RLS. Je použitelný i pro PostgreSQL mimo Supabase.

```bash
npx skills add supabase/agent-skills --skill supabase-postgres-best-practices
```

### F. Excel jako volitelná vývojová pomůcka

[Anthropic / skills](https://github.com/anthropics/skills)

Skill `xlsx` může pomoci při tvorbě a kontrole šablony. Není náhradou produkčního importéru. Produkční import musí být deterministický, testovaný a nesmí záviset na LLM.

### Pravidla použití skills

1. Přečti konkrétní `SKILL.md` před použitím a načítej jen relevantní instrukce.
2. Při rozporu má přednost toto zadání, bezpečnost a skutečné verze závislostí.
3. Neinstaluj vše globálně a neaktivuj překrývající se balíky bez důvodu.
4. Instalace skills není souhlas k produkčnímu deploymentu ani k přístupu k tajemstvím.
5. Pokud skill není dostupný, pokračuj s oficiální dokumentací a uveď omezení.
6. Projektová obchodní pravidla, jednotky a cenové výpočty drž v testované dokumentaci a kódu, ne pouze v obecných skills.

## 16. Testovací strategie

### Jednotkové testy

- Plochy, objemy používané v logice a převody jednotek.
- Kapacita fasád pro vrata a kolize otvorů.
- Administrativa a limity výšky.
- Výpočty účtovaných množství, příplatků a zaokrouhlení.
- Neúplný ceník a nepodporované kombinace.
- Importní validace a serializace konfigurace.

### Integrační testy

- Neplatný import nemění publikovaná data.
- Publikace a rollback jsou atomické a auditované.
- Konflikt dvou administrátorů nezpůsobí tiché přepsání.
- Neautorizovaný uživatel nemůže importovat, prohlížet draft ani publikovat.
- Cenový endpoint ignoruje podvrženou cenu klienta.
- Veřejné API nevrací neveřejné cenové podklady.

### End-to-end a vizuální kontrola

- Změna rozměrů → model → množství → cena → souhrn.
- Fasáda, okna, administrativa, interiér a kamera.
- Export/import a obnovení konfigurace.
- Mobil, klávesnice, reduced motion a fallback bez 3D.
- Upload → chyby → oprava → preview → publikace → rollback.
- Cenová verze zůstává stabilní během práce zákazníka.
- Screenshoty reprezentativních konfigurací, včetně hraničních rozměrů.

U vizuálních testů stabilizuj kameru, osvětlení, assety a animace. Měř výkon na popsaném zařízení a konfiguraci. Neslibuj univerzální FPS bez měření.

## 17. Implementační milníky

### M0: základ projektu

Repo audit, plán, závislosti, datové kontrakty, demo předpoklady, testovací infrastruktura a skeleton layoutu.

### M1: první funkční vertikální řez

Jeden koncept, délka/šířka/výška, parametrický model, výpočty množství, serverová demo cena a souhrn. Žádné rozšiřování efektů před dokončením tohoto toku.

### M2: produktová konfigurace

Tři presety, materiály, otvory, administrativa, interiér, technologie, okolí a validace.

### M3: správa katalogu

Excel šablona, import, databázové snapshoty, diff, chráněný preview, publikování, audit a rollback.

### M4: dokončení zákaznického toku

Ukládání, exporty, cenové verze, poptávka, mobil a přístupnost.

### M5: hardening a předání

Bezpečnostní kontroly, výkon, testy, preview deployment po schválení a provozní dokumentace.

Po každém milníku uveď: co funguje, jak to spustit a ověřit, výsledky kontrol, známá omezení a další krok.

## 18. Definition of Done

- Změny parametrů konzistentně ovlivňují model, souhrn a cenu.
- Okna, vrata a okolí se nedeformují a nekolidují s budovou.
- Podporované limity jsou validované na klientu i serveru tam, kde jsou autoritativní.
- Každá volba má viditelný dopad nebo srozumitelné vysvětlení.
- Import a publikování jsou oddělené, zabezpečené a auditované.
- Nový katalog lze publikovat bez nového nasazení aplikace.
- Starší konfigurace se tiše nepřecení.
- Cena je serverová, přesná podle definovaných pravidel a jasně nezávazná.
- Demo data a mock odeslání nelze zaměnit za skutečnou nabídku nebo odeslání.
- Veřejný klient neobsahuje interní náklady, marže ani tajemství.
- Aplikace má použitelný mobilní a ne-3D režim.
- Build, typová kontrola a implementované testy mají zdokumentovaný skutečný výsledek.
- README, datový slovník, Excel šablona, migrace a provozní runbook jsou součástí předání.

## 19. Rozhodnutí před produkcí

Tyto otázky neblokují demo s označenými předpoklady, ale musí být uzavřeny před produkčním spuštěním:

1. Která dceřiná firma je vlastníkem katalogu a kdo schvaluje ceny?
2. Jde o cenu realizace, prodejní cenu, nebo nájem? Co je zahrnuto a v jaké měně?
3. Jaké jsou schválené limity rozměrů, technické varianty a pravidla kompatibility?
4. Jaký brand manuál a licencované assety použít?
5. Jaký poskytovatel databáze, region a autentizace administrace jsou schválené?
6. Kdo smí vidět rozpis prodejních cen a které údaje jsou neveřejné?
7. Kam se mají skutečně odesílat poptávky a jaká je retence osobních údajů?
8. Které reprezentativní mobily a počítače budou akceptační testovací zařízení?

## 20. Startovací instrukce

Začni auditem repozitáře a milníkem M0. Poté implementuj M1 jako funkční celek. Použij označená demo data, pokud nejsou dodána skutečná. Při chybějících přístupech připrav adaptéry a lokální demo režim, ale nevydávej je za produkční integraci. Udržuj rozsah MVP a průběžně aktualizuj seznam hotových funkcí a omezení.

---

### Zdroje technických doporučení

- [Vercel Functions: runtimes a filesystem](https://vercel.com/docs/functions/runtimes)
- [Vercel Storage overview](https://vercel.com/docs/storage)
- [CloudAI-X Three.js Skills](https://github.com/CloudAI-X/threejs-skills/tree/main/)
- [Anthropic Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills)
- [Vercel React Best Practices](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md?plain=1)
- [Anthropic Webapp Testing](https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md)
- [Supabase Agent Skills](https://github.com/supabase/agent-skills)
- [Supabase Postgres Best Practices](https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/SKILL.md)

Odkazy jsou zdroje pro další ověření, nikoliv záruka neměnnosti obsahu. Při implementaci zaznamenej konkrétní použité revize a verze.
