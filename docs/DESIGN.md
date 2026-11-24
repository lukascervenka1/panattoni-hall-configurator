# Panattoni showroom — směr úpravy

Publikum a účel potvrzené uživatelem: klienti Panattoni vybírají několik možností nové haly a okamžitě sledují kultivovanou 3D prezentaci. Prioritou je vizuální zážitek, jednoduchost a korporátní důvěryhodnost.

## Vizuální systém

- Bílé rozhraní #ffffff, neutrální studio #edf0ed, text #20292c, sekundární text #616b70. Navy #001844 pro hlavní tlačítka, aktivní přepínače, navigaci a logo; hover #001b75. Limetkový akcent #93d50a pro stav výběru a drobné detaily.
- Bai Jamjuree pro nadpisy a čísla, Helvetica Neue / Arial pro ovládání. Jedno výrazné místo: model haly.
- Výchozí opláštění haly je bílé (`#f5f5f5`) podle upřesněného standardu Panattoni. Barva je shodně v katalogové standardní variantě Ruukki SPA E 100 i ve výchozím vzhledu rendereru pro všechny tři koncepty; ostatní materiálové varianty zachovávají své odstíny.
- Hlavička používá `public/brand/logo-leaf-navy.svg`: původní vektorové cesty loga s lístečkem z [oficiální publikace Panattoni / HFW, European Logistics & Supply Chain Sustainability Report 2022](https://panattonieurope.com/media/1536/download/004068-European-Logistics-and-Supply-Chain-Sustainability-Report-2022%5B1%5D.pdf?v=1), PDF strana 4. Geometrie a proporce jsou zachované; tiskové spot barvy Pantone 289 C a 375 C jsou převedené na webové hodnoty #001844 a #93d50a podle lokálního Brand guidelines VER 2.0. Tato lokální verze manuálu obsahuje pouze logo bez lístečku.
- Stabilní rozvržení v obou režimech. Levý panel s postupem po pěti krocích, pravý dominantní náhled. Na mobilu náhled nad obsahem a kompaktní navigace kroků.
- Každý krok ukazuje pouze relevantní rozhodnutí. Cenový rozpis, technické materiály a ovládání kamery jsou druhá úroveň.

## Stavba a 3D

- Základ → sloupy → vazníky → opláštění → střecha → administrativa a vybavení.
- Konstrukční díly se osazují při zachování proporcí. Opláštění a střecha se odhalují podél budovy pomocí ořezávací roviny, celá fasáda se nenatahuje.
- Při běžné úpravě se okolí a vybavení znovu neschovávají. Zachovat kameru a změnit příslušnou geometrii.
- Výchozí neutrální studio s materiály a stíny. Volitelný ilustrační areál. Zachovat půdorys L, fallback 2D, snížený pohyb a serverovou cenu.

## Ověření

Kontrola typů, jednotkové testy se skutečným AnimationMixer a testem pořadí konstrukce, produkční build. Browserové scénáře přizpůsobit pěti krokům a ověřit desktop, mobil a fallback, pokud prostředí dovolí spustit server. Screenshoty a výkon nelze vydávat za ověřené bez běžícího browserového náhledu.

## Doplněk

Impeccable 4.10.0 je dostupný projektově pro Claude Code v `.claude/skills/impeccable`. Odkazuje na upstream checkout v `.claude/vendor/impeccable`, včetně referencí a launcheru. Instalace neaktivuje hooky ani režim live. Nejde o instalaci do osobního katalogu ChatGPT.

## Výsledek kontrol

- TypeScript a 196 jednotkových testů prošly.
- Produkční build prošel.
- E2E: serverový test prošel; dalších 11 scénářů nebylo možné provést, protože macOS odmítl spuštění Chromia (MachPortRendezvous bootstrap permission denied). Nejde o výsledek jejich aplikačních asercí.
- Vizuální kontrola v browseru a měření výkonu zůstávají neověřené.


## Orientace ve vybavení a uhlíková stopa

Krok Vybavení má pět viditelných částí (Konstrukce, Střecha, Vrata a okna, Technologie, Dispozice) a vždy jednu rozbalenou kategorii s aktuální volbou v záhlaví. Na mobilu se navigace drží pod 3D náhledem; při nízkém displeji náhled odroluje, aby nezakryl ovládání. Cenový blok při editaci používá kompaktní sazbu a zachovává označení dílčího součtu, DPH i individuální kalkulace.

Zelený SVG lísteček a štítek „Nejnižší uhlíková stopa“ porovnávají uvedené hodnoty GWP A1–A3 dostupných aktivních variant v jedné kategorii (`src/catalog/carbon.ts`). Nejde o porovnání rozdílných materiálových kategorií ani emise celé stavby. Při shodném minimu se označí všechny nejnižší varianty. Chybějící údaj není nula; bez alespoň dvou platných různých hodnot se štítek nevytvoří. U vybrané varianty je lísteček viditelný i ve sbaleném záhlaví. Tooltip uvádí hodnotu a rozsah porovnání, popisek pod nabídkou vysvětluje, že jde o nejnižší uvedené GWP mezi dostupnými variantami kategorie.
