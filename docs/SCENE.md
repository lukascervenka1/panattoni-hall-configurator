# 3D scéna: přístup a omezení

**Přístup: hybrid.** Hlavní geometrie a detaily se generují z parametrů (aby se hala dala měnit bez deformace), vzhled dodává fyzikální osvětlení, jemné materiály a postprocessing. Žádné cizí 3D modely ani HDR soubory se nestahují (žádné licence, žádné požadavky na CDN).

## Co vytváří dojem kvality

| Vrstva | Jak | Kde |
| --- | --- | --- |
| Osvětlení | slunce se stíny, obloha (`Sky`), prostředí z lokálních světelných karet (`Environment` + `Lightformer`) pro odrazy na kovu a skle | `HallScene.tsx` |
| Postprocessing | ambient occlusion (N8AO), SMAA, tone mapping AGX, ve večerním režimu bloom | `HallScene.tsx` |
| Materiály | panely s procedurální normálovou mapou (spáry, žebrování), fólie střechy se švy, asfalt, beton s polem 6 × 6 m, tráva, parkovací čáry | `textures.ts`, `HallModel.tsx` |
| Architektonický detail | sokl, pás v barvě značky, okapové svody, sekční vrata s okénky, zárubně a nárazníky doků, svítidla, ochranné sloupky, okenní parapety, kopule světlíků na zárubních, VZT jednotky | `geometry.ts` |
| Interiér | rastr sloupů s konzolami, regály (sloupky, nosníky, palety, zboží), stropní svítidla, administrativa | `geometry.ts`, `layout.ts` |
| Okolí | auta s kabinou a koly, kamiony s koly, stylizované stromy, stožáry s osvětlením, příjezd, vrátnice, chodník, silnice s osou | `Surroundings.tsx`, `layout.ts` |

## Pravidla

- Rozměry mění geometrii, ne měřítko: textury mají UV ve světových metrech, takže se detail neroztahuje.
- Vše je sloučené podle materiálu nebo instancované (jednotky draw callů).
- Rozmístění je čisté a testované (`scene.test.ts`): nic uvnitř budovy, počet instancí regálů je omezený (při velké hale se detail zjednoduší).
- Při slabém výkonu `PerformanceMonitor` sníží rozlišení a vypne ambient occlusion jako první.
- Okolí a vybavení jsou ilustrativní a nepotvrzují kapacitu ani proveditelnost.

## Ladění a vizuální testy

`/?cam=x,y,z,tx,ty,tz` nastaví pevnou počáteční kameru (pozice a cíl v metrech), např. detail doků: `/?cam=-10,4.5,-64,-6,3,-42`. Hodí se pro stabilní screenshoty.

## Omezení

- FPS na reálných zařízeních zatím není změřené.
- Postavy jsou jen kapsle, kamiony a auta jednoduché tvary. Další krok, pokud bude potřeba ještě vyšší věrohodnost: optimalizované dekorativní GLB (auta, kamiony, stromy) přes `gltf-transform` (skill `threejs-asset-pipeline`) s ověřenou licencí.
- Dev režim (`npm run dev`) je při prvním vykreslení pomalý (kompilace shaderů); v produkčním buildu je model vidět do několika sekund.


## Stavba před očima (animace)

Zákazník vidí, jak hala vzniká a roste. Řídí to `useBuildAnimation.ts` (režisér) a čistá logika v `build.ts` (testováno).

| Situace | Co se děje |
| --- | --- |
| První načtení nebo změna konceptu | Přehraje se stavba: základ roste od středu, stěny rostou odspodu, střecha dosedne shora, vestavba vyroste, pak se ze země "vysadí" sloupy, regály a svítidla a nakonec okolí (stromy, auta, plot, stožáry). Trvá cca 6 s. |
| Změna délky, šířky nebo výšky | Hala plynule roste či se zmenšuje (doběh), plochy areálu se přizpůsobují, vybavení a okolí se po doběhu znovu vysadí. Kóty odpočítávají hodnoty. |
| Změna výbavy | Doky a vjezdová vrata přibývají po jednom, vestavba administrativy "vyroste". |
| Úspora pohybu (`prefers-reduced-motion`) nebo vypnuté "Provoz" | Žádné přehrávání ani pohyb; vše je okamžitě v cílovém stavu. |

### Jak je animace postavená (skill `threejs-animation`)

- **Časová osa stavby je skutečný `AnimationClip`** (`constructionClip.ts`): stopy `floor.scale`, `walls.scale[y]`, `roof.position[y]`, `office.scale[y]` a `reveal.position` (vybavení, okolí, plochy areálu) s Bézierovou interpolací. Klip animuje pomocný "rig" přes `AnimationMixer`; režisér po každém `mixer.update()` hodnoty přečte a předá modelu. Mixer dává přeskočení (`action.time`), přehrání znovu (`reset`) a konec (událost `finished`). Tlačítka **Přeskočit stavbu** a **Přehrát stavbu** jsou v panelu pohledu (jen bez úspory pohybu).
- **Změny z katalogu a konfigurátoru** jsou procedurální (`motion.tsx`, `MathUtils.damp`, nezávislé na snímkové frekvenci): barvy fasády, podlahy, střechy, oken, světlíků a rámů se plynule přelévají (`DampedStd`); fotovoltaika, příčky, vazníky, vytápění, tepelné čerpadlo a regály po výběru **vyrostou** (`useAppear`, `useGrowY`) místo aby naskočily. Vybavení čeká na dokončení úvodní stavby.
- **Ventilátory** na střešních jednotkách se otáčejí (`RoofFans.tsx`) jen při zapnutém "Provoz".

Zobrazená konfigurace je v každém okamžiku **platná** (doky se vejdou na fasádu, administrativa do haly): mezihodnoty se omezují stejnými pravidly jako validace, takže se otvory nikdy nepřekrývají (test prochází interpolaci mezi koncepty).

## Živé prostředí

- **Obloha a světlo:** fyzikální obloha, slunce níž nad obzorem (delší stíny), statická stínová mapa se přepočítává při změně scény. Pohyb kamionů u doků ji obnovuje nejvýš 12×/s; jejich objevení, zmizení, odebrání a konečná poloha po zastavení vyžádají okamžité obnovení, aby na ploše nezůstávaly prázdné stíny (`dynamicShadows.ts`). Večer hvězdy a bloom.
- **Krajina:** pole pěti plodin (pšenice, zelená plodina, orba, řepka, louka) po 150 × 110 m, meze se stromy, vzdálené kopce, mraky. Pole jsou ukotvená ve světových souřadnicích a při růstu haly se jen uvolní místo.
- **Areál:** plot s vjezdem, příjezd, vrátnice, chodník, parkoviště s čarami stání, stožáry osvětlení.
- **Doprava (`traffic.ts`, testováno):** auta, dodávky a kamiony jezdí v pravém pruhu po silnici. Část vozidel odbočí na příjezd, zajede do **volného** stání, postojí, vycouvá a odjede; pak přijede znovu. Poloha je čistou funkcí času (deterministická).
- **Výkon:** `PerformanceMonitor` při slabém výkonu sníží rozlišení a vypne ambient occlusion. Tlačítko "Provoz" vypne pohyb úplně (snímky se pak vykreslují jen při změně).

## Interiér: podlaha a světlo

- **Značení podlahy** (`layoutFloorMarkings`, testováno): žlutý obrys každé řady regálů a hranice překladiště u nakládacích doků. Ilustrativní, nejde o bezpečnostní dokumentaci ani o schválené dopravní schéma.
- **Denní světlo** (`layoutLightShafts`, `InteriorLight.tsx`): ze světlíků jdou šikmé sluneční paprsky ve směru slunce (`sun.ts`). Paprsek se zkracuje, aby nikdy neprosvítal ven ze stěn (testováno i pro tvar L). Přes den plynule naběhne po dokončení stavby, večer zhasne.
- **Osvětlení** (`LightPools`): pod svítidly jsou měkké světelné skvrny na podlaze, večer výrazné, přes den jen náznak. Varianta s denním řízením je tlumí. Nejde o světelně-technický výpočet (osvětlenost ani úspora se nepočítá).
- Interiér má pod popisky jemný podklad, aby byl text čitelný přes regály.

## Omezení

- Tvary: obdélník a L (výřez v pravém předním rohu, viz [GEOMETRY.md](GEOMETRY.md)). Další tvary (U, vícepodlažní objekty) jsou mimo MVP. Růst platí pro rozměry, tvar a výbavu (doky, vrata, administrativa), ne pro materiály (M2).
- Úvodní kompilace shaderů: v aktivním prohlížeči s GPU je scéna připravená za cca 1 s (naměřeno v Playwrightu s Metal). Na pomalejších GPU může trvat déle; po dobu příprav se zobrazuje "Připravuji staveniště…".
- Auta a kamiony jsou jednoduché tvary; stavba a doprava nejsou měřené na reálných zařízeních (FPS).

## Změna showroomu (20. 11. 2026)

Tato část nahrazuje výše popsané původní časování stavby. Výchozí prezentace používá neutrální studio; areál je volitelný v nastavení pohledu. Úvodní klip osazuje základ, sloupy, vazníky, opláštění, střechu a vybavení. Opláštění a střecha se odhalují ořezávací rovinou při zachování měřítka; nosná konstrukce se osazuje v prostorovém pořadí. Při úpravě rozměrů se vybavení a okolí znovu neschovávají. Kamera a 3D instance zůstávají zachovány při přepnutí mezi konfigurací a souhrnem.

Rozhraní má pět kroků: využití, velikost, logistika, zázemí, vybavení. Pokročilé kamerové volby jsou pod nastavením pohledu. Vizuální výsledek a výkon na reálném zařízení ještě vyžadují ověření; macOS v této relaci nepovolil spuštění testovacího Chromia.

## Minimalistické okolí a ostrost (další úprava)

Studiový pohled nově obsahuje neutrální komunikaci, příjezd, parkovací stání, stojící auta a animovaný příjezd/odjezd. Odhalení ploch následuje po střeše; auta se osadí následně a provoz se rozběhne po odhalení. Změny rozměrů nespuštějí celou sekvenci znovu. Zastavení provozu a systémové omezení pohybu zůstávají dostupné. Trasy a obsazenost používají stejný layout jako parkoviště, provoz je oříznut na hranicích prezentační komunikace.

Rozlišení plátna je stabilní do 2× podle hustoty displeje. PerformanceMonitor již nesnižuje DPR na 1×; při zátěži omezuje ambient occlusion. Postprocessing používá 4× MSAA místo dodatečného SMAA filtru. Perspektivní kamera počítá s rezervou na komunikaci a parkoviště. Reálnou ostrost a FPS je třeba potvrdit v běžícím prohlížeči.

## Stabilizace po zamrznutí stránky

Předchozí odstavec o MSAA v postprocessingu již neplatí. Postprocessing a dynamické přepínání ambient occlusion byly odstraněny; scéna používá přímé vykreslení s nativním antialiasingem, AGX a DPR do 2×. Render loop běží na vyžádání. Provoz invaliduje nejvýše 30× za sekundu a na skryté kartě neinvaliduje; stavba a ovládání kamery mají vlastní invalidaci. Časovač se při pozastavení provozu nebo odmontování uvolní. Jde o snížení GPU zátěže po hlášeném zamrznutí celé stránky; přesná příčina a odstranění problému ještě nejsou potvrzeny opakovaným browserovým měřením.

## Doky, vrata a parkoviště

Při úpravě počtu doků se kamera natočí k zadní fasádě; u vjezdových vrat k pravému boku. Jednotlivé sestavy se generují ze stejné geometrie jako otvory fasády a nově přidané kusy krátce dosednou do polohy. Počet postupně dobíhá rychlostí sedmi kusů za sekundu. Stávající kusy se při změně počtu znovu neodhalují.

Stání vynechávají celý průjezd v obou řadách s boční rezervou; parkovací místa a živý provoz sdílejí stejnou sadu stání. Vynechané zelené ostrůvky obsahují drobné instancované stromky. Přibývají dorazy u obsazených míst. Boční obslužný pás pro vjezdová vrata a přístup k zadní manipulační ploše neleží v parkovišti. Jde o ilustrativní uspořádání, nikoli ověřené dopravní řešení. Kontroly rezerv pro vjezd, ostrůvky a obslužnou komunikaci pokrývají všechny výchozí koncepty i velkou halu.

## Vizualizace obsluhy haly

Ve studiovém režimu je zadní manipulační plocha podmíněna alespoň jedním dokem; boční propojení s komunikací alespoň jedním dokem nebo vjezdovými vraty. Na skutečné pozice otvorů navazuje omezená ukázka provozu: nejvýše šest kamionů u doků a tři dodávky projíždějící vraty. U až tří doků je minimalistická animace manipulace s paletou. Kamiony respektují hloubku externího dock house.

Dodávky přijíždějí boční obslužnou komunikací, vrata se před průjezdem otevřou, vozidlo zajede dovnitř a po prodlevě vycouvá stejnou trasou. Rolety i vozidla čtou společný čas v build.operationTime; pozastavení provozu a systémové omezení pohybu zastaví oba současně. Úvodní stavba drží provoz skrytý až do dokončení okolí. Při odstranění otvorů zmizí odpovídající ukázka provozu.

Jde o názornou prezentaci činnosti, nikoli o ověřenou simulaci otáčení návěsu, dopravní kapacity nebo nakládacího cyklu. Testy ověřují vozidla mimo dokové prahy, včetně dock house, a průjezd obdélníkovou i L halou pouze při plně otevřených vratech.

## Střecha a energie

Katalogové volby střechy, světlíků a fotovoltaiky jsou soustředěné v samostatné sekci pátého kroku. Výběr zobrazí střechu z nadhledu, případně dřevěný podhled v interiéru; platí stávající dostupnost a kombinace katalogu. Kliknutí na střešní plochu otevře stejnou sekci.

Prohlížení nabízí nadhled, odkrytí nosné konstrukce a nadzvednutí střešní sestavy o 8 m (čistě prezentační odstup). Přechod nadzvednutí je tlumený, při sníženém pohybu okamžitý. Nemění produktovou konfiguraci, výpočet ploch ani cenu. Exteriér a interiér v hlavní liště vracejí sestavu do normální polohy.

Střešní deska i krytina mají skutečné otvory pro světlíky. Obruby jsou rámové; kopule jsou osazené na průhledné základně. Fotovoltaika má lokální texturu článků a rámu, bez externích assetů a nových renderovacích průchodů. Raycast testy ověřují průchod střechou v centrech světlíků u obdélníkového i L půdorysu a současně zachování krytiny mimo otvory. Rozložení nadále zachovává rezervy od světlíků a střešních technologií.

Nové konstrukční varianty, technické parametry ani energetická tvrzení nebyly přidávány.

## Stabilizace při střídání střechy, stěn a příček

Geometrie podlahového značení, světelných paprsků a světelných skvrn mají explicitní uvolnění při výměně nebo odmontování. Střecha a její technologie se přestavují pouze podle rozměrů a přítomnosti dokové zóny; změna materiálu ani jednotlivého počtu doků již nespouští novou triangulaci střechy. Příčky závisejí jen na rozměrech a počtu členění, administrativa na rozměrech a vlastní konfiguraci.

Odkrytí střechy mění viditelnost zachované sestavy; neruší materiály a instance, které by se při návratu znovu kompilovaly. Konfigurace pro scénu má omezení aktualizací na přibližně 120 ms, zatímco ovládací prvky a cena pracují s aktuálním vstupem. Rozměry a výřez se přestaví na cílovou hodnotu bez desítek interpolovaných geometrií a přepočtů stínů. Úvodní stavba, přechody barev a postupné osazování doků zůstávají animované. Tato úprava nahrazuje starší popis plynulého růstu rozměrů.

Regresní test ověřuje jedinou sadu rozměrů během přechodu, platné otvory a jejich postupné přibývání. Kontrola typů, 212 unit testů a produkční build prošly; odstranění hlášeného zamrzání zatím není potvrzené opakovaným měřením v uživatelově prohlížeči.

## Kamera interiéru u L půdorysu

Výchozí kamera nově vychází ze souvislého zadního ramene půdorysu, nikoli z pravého předního rohu, který může ležet ve výřezu L. Dívá se diagonálně do prostoru a zůstává za administrativní vestavbou. Interiérový záběr používá FOV 58° a near 0,15 m; ostatní pohledy se vracejí na původní hodnoty. Změna tvaru, výřezu nebo rozměrů v interiérovém režimu znovu ukotví kameru do platné polohy. Testy vzorkují celou úsečku mezi kamerou a cílem pro všechny koncepty a L varianty, aby neležela ve dvorku ani v administrativě.

## Výkon a odezva

- **Živý provoz** (doprava, vrata, ventilátory) překresluje scénu pravidelně, 30× za sekundu. Scéna má kolem 230 kreslicích volání a 130 tisíc trojúhelníků na snímek. Na zdravém zařízení (měřeno: Apple M2 Pro, Metal) je to jen malá zátěž, žádný zásek delší než 50 ms při změně příček, střechy, fotovoltaiky, rozměrů ani při přepínání pohledů.
- **Hlídač výkonu** ([src/scene/perf.ts](../src/scene/perf.ts), komponenta `LiveFrames` v `HallScene.tsx`): na pomalém zařízení (softwarové vykreslování měřeno 3 až 5 snímků/s) by stálá smyčka držela vykreslování pořád v plné zátěži a změny z panelu by se zařazovaly až za ni. Při dvou po sobě jdoucích 2s oknech s průměrem pod ~16 snímků/s se sníží frekvence na 12 snímků/s a dpr na 1,25, po dalších dvou oknech se živý provoz pozastaví a dpr klesne na 1. Změny a animace se dál vykreslují na vyžádání. Zapnutí tlačítka "Provoz" kvalitu vrátí. Měří se jen klidový provoz, ne stavbu ani přechody.
- **Reakce na volbu:** volba, která je vidět jen uvnitř (příčky, vazníky, podlaha, vytápění, osvětlení), přesune kameru do interiéru, stejně jako volby střechy přesouvají kameru na střechu. Pokud běží úvodní stavba, dokončí se hned, ať změna není skrytá.
- Neověřeno a známé: jednorázové zdržení kolem 0,4 s při prvním zapnutí areálu (kompilace shaderů nových materiálů). Geometrie se přestavuje do 20 ms i u největší haly.

## Detaily: sloupy a okna, střešní vzduchotechnika, skladoví roboti

- **Krajní sloupy a okna:** krajní řady sloupů dříve seděly osou přímo na líci fasády, vyčnívaly ven jako pilastry a procházely okny administrativy. Teď leží uvnitř obvodové stěny (`columnFrame`, odstup `COLUMN_EDGE_INSET_M` = tloušťka stěny + polovina konzoly), stejně jako vazníky nad nimi. Okna, kterých by se sloup dotýkal, se posunou o nejmenší nutnou vzdálenost (`clearOfColumns`, nejméně polovina okna + 0,55 m od osy sloupu). Počet ani plocha oken se nemění, protože vstupují do ceny. Testy: [windows.test.ts](../src/configurator/calculations/windows.test.ts).
- **Střešní vzduchotechnika** (`layoutRoofUnits`, `roofFanPoints`, `layoutRoofDucts` v `layout.ts`, geometrie v `buildRoofDetails`): jednotky VZT 8 × 3 m s žaluziemi, kondenzátory s dvěma ventilátory a odtahové ventilátory; počty rostou s plochou (1 až 6 jednotek VZT, až 3 kondenzátory, 3 až 20 odtahů). Od jednotky VZT vede potrubí na podpěrách k nejbližšímu odtahu. Vše je mimo světlíky, výřez a atiku a panely fotovoltaiky se jim vyhýbají. Ventilátory se točí v provozu s areálem. Ilustrace, ne návrh větrání ani chlazení.
- **Skladoví roboti** ([robots.ts](../src/scene/robots.ts), [RobotsView.tsx](../src/scene/RobotsView.tsx)): jezdí v uličkách mezi řadami regálů, jen tam, kde z obou stran stojí regály, takže nezajedou k administrativě, příčkám, vratům ani do výřezu L. V dlouhé uličce dva roboti ve vlastních pruzích, pruh se volí tak, aby míjel sloup stojící v uličce. Jízda tam s přepravkou, otočka, zpět prázdný; poloha je funkcí času. Nejvýše 36 robotů, tři instancované sítě. Jezdí v provozu bez ohledu na zobrazení areálu a vypnou se tlačítkem "Provoz". Ilustrace provozu, ne návrh automatizace ani výpočet propustnosti.

## Podle fotografií z katalogu: okna, vstup, doky

Podle fotografií z papírového katalogu Panattoni:

- **Okna administrativy:** tmavě modrý rám (`#0f1c3b`) v hluboké špaletě, dvě svislé tabule (pevná 62 % a otevíravá se vnitřním rámečkem), tmavší modré zasklení, vnější parapet. Rozměr okna (1,5 × 1,5 m) a rozteč zůstaly, aby se nezměnil počet ani plocha oken v množstvích a ceně.
- **Vstup do administrativy** (`entrance`, `OpeningKind`): prosklené dvoukřídlé dveře s nadsvětlíkem a svislými madly, tmavě modrá stříška na dvou stojkách a zábradlí po stranách nástupu. Stojí na čelní fasádě hned za koncem administrativy, mimo okna a sloupy. Je to ilustrativní prvek: do množství ani ceny nevstupuje (ruční výpočet množství v testech zůstává platný). Krok "Zázemí" i pohled kamery "Administrativa" ukazují širší, téměř čelní záběr všech oken, vstupu a parkoviště podle referenčního snímku. Kamera stojí za silnicí a jen 2,4 m nad atikou; cíl je posunutý o 5 m před fasádu, aby měl prostor i předpolí. Odstup odpovídá šířce administrativy, čelnímu ramenu půdorysu L a poměru stran plátna. Vstup do kroku funguje i s vypnutou administrativou; změny její velikosti zachovávají plynulé přerámování. Test projekce kontroluje okna, vstup a přední parkovací řadu u všech konceptů na úzkém i širokém plátně.
- **Nakládací doky a vjezdová vrata:** modrá sekční vrata (standard `#27499a`, ASSA tmavší, externí nakládací dům světlejší modrá), černošedé zateplení a zárubně (`#2a2d32`) a tmavě modré tabulky s bílým číslem vrat nad každým otvorem (doky 1 až 40, vjezdová vrata S1 až S8, atlas čísel v `textures.ts`).
- **Zábradlí u doků** (`layoutDockRailings`, `addRailing`): ocelové dvoumadlové zábradlí po obou stranách řady doků, 1,8 m před fasádou, úseky po 6 m s návratem k fasádě, nikdy před vraty. Ilustrace, do množství a ceny nevstupuje.
- Nezahrnuto (fotografie to ukazují): schody u osobních dveří, červený hlásič požáru, dlážděné plochy před doky.

## Blíž vizuálu z katalogu: řez halou, posezení a keře

- **Řez halou** (pohled `section`, tlačítko "Řez" vedle Exteriér, Interiér a Bez střechy): čelní stěna s okny a vstupem se přestane vykreslovat (ořezová rovina `sectionPlane` na skupině stěn v `HallModel`, počet ořezových rovin se nemění, takže se nepřekládají shadery). Střecha zůstává, vidět je do interiéru: řada sloupů, regály, roboti a vestavba administrativy s podlažími a minimálními stoly (`layoutOfficeDesks`). Kamera míří na levou část haly s administrativou. Pohled zůstává, dokud nezvolíte jiný; kamerou lze otáčet.
- **Areál** (jen v režimu "Zobrazit areál", studio zůstává čisté): dlážděné posezení se třemi stoly a lavicemi západně od parkoviště s chodníkem od chodníku u haly, nízké keře v pásu před halou a kolem posezení a několik barevných aut (modré, oranžové, červené) mezi neutrálními. Stromy na posezení ani chodníku nerostou. Vše je ilustrativní a bez vlivu na množství a cenu.
- **Les za areálem** (`layoutLandscape`, `FOREST`): pás hustých stromů za zadní a po bočních stranách pozemku, řídnoucí od areálu (nejvýše 900 stromů, jednodušší koruna). Přední strana u komunikace zůstává otevřená.
- **Vlajky u vjezdu** ([FlagsView.tsx](../src/scene/FlagsView.tsx)): tři stožáry s tmavě modrým praporem a bílým logem z brand manuálu (`/brand/logo-white.png`, proporce beze změny, jen otočené, čte se zdola nahoru). Logo se načítá bez Suspense, takže scéna na obrázek nečeká.
- Neřešeno: nápis na štítu haly a kontejner u doků.

## Kamiony Panattoni u doků

- [dockTrucks.ts](../src/scene/dockTrucks.ts), [DockTrucksView.tsx](../src/scene/DockTrucksView.tsx): soupravy přijedou po hlavní silnici, odbočí na účelovou komunikaci vedle haly, po vnějším pruhu manipulační plochy projedou kolem svého doku a couvají do něj (zadní světla svítí). Po vyložení popojedou dopředu, vnitřním pruhem vyjedou na silnici a odjedou. Poloha je funkcí času.
- Světlý návěs a tmavě modrý tahač, zaoblená kabina, boční zasklení, zrcátka, podvozek, disky kol a kování zadních vrat. [TruckBranding.tsx](../src/scene/TruckBranding.tsx) používá skutečné `/brand/logo-navy.png` na obou bocích i vzadu v původním poměru 900 : 145. Textura je sdílená a její načítání neodmontuje vozidla. Stejný vzhled mají projíždějící kamiony; původní rozměry soupravy i její trasy zůstaly zachované.
- Společný harmonogram: čas je rozdělen do úseků stejné délky a v každém se hýbe nejvýše jeden kamion (příjezd jednoho, o dva úseky později odjezd jiného); ostatní stojí u doků nebo nejsou na ploše. Soupravy jsou dlouhé 17 m, takže jen výlučný pohyb zaručuje, že se nepotkají na komunikaci ani při otáčení. Test (`dockTrucks.test.ts`) ověřuje, že se obdélníky souprav nikdy nepřekrývají, nezajedou do haly a pohyb je spojitý.
- Kamiony stojí nejméně 12 m od sebe (nejvýše 6, u doků rovnoměrně). Při vypnutém provozu nebo úspoře pohybu stojí všechny u doků. Vysokozdvižné vozíky u prvních tří kamionů jezdí, jen když kamion u doku stojí.
- Ilustrace provozu, ne harmonogram nakládky ani dopravní návrh; do množství a ceny nevstupuje. Sdílejí se hodiny provozu (`build.operationTime`) s vraty a dodávkami.

## Vybavení kanceláří v řezu

- [officeFurniture.ts](../src/scene/officeFurniture.ts), [OfficeFurnitureView.tsx](../src/scene/OfficeFurnitureView.tsx): stoly s nohami, monitory a klávesnicemi, pracovní židle, skříně s madly, zasedací stůl, koberce a květiny. Rozmístění se přepočítává podle plochy a počtu podlaží administrativy. Poslední místnost slouží jako zasedací, u jedné místnosti je menší společný stůl za pracovními místy. Jde o ilustrativní vybavení bez vlivu na cenu a množství.
- Nábytek i příčky sdílejí rozdělení místností. Zadní chodba zůstává volná a každá místnost má průchod široký 1,1 m. Testy ověřují vybavení uvnitř půdorysu i podlaží, odstup od příček a chodby a vypnutí administrativy.
- Horní strop administrativy je samostatná geometrie: v řezu a při skrytí střechy se nevykreslí. Mezistrop dvoupodlažní vestavby zůstává viditelný. Devět instancovaných dávek vybavení sdílí materiály a geometrii; nepřibývá další animační smyčka ani postprocessing.

## Malý park u haly

`PocketPark.tsx` doplňuje oba režimy okolí o klidný park na západní straně haly: organický rybník přibližně 14 × 11 m s úzkým břehem a pěší smyčkou, sedm střídmých stromů, dvě lavičky natočené k vodě a napojení na stávající chodník a posezení. V minimalistickém režimu doplňuje také stávající tři piknikové stoly. V plném režimu se stoly a dlažba používají ze `Surroundings`, aby se nekreslily dvakrát.

Čisté rozmístění je v `park.ts`. Park má vyhrazenou plochu uvnitř pozemku a oplocení, mimo halu, doky, obslužné komunikace a parkoviště. Náhodné stromy okolí tuto plochu vynechávají. Rozměry rybníku, mobiliáře a stromů zůstávají při změně haly pevné. Jemně lomené koruny, teplé neutrální dřevo, tlumená modrozelená voda a světlé pěšiny navazují na minimalistickou prezentaci. Voda nemá samostatnou animaci, zrcadlový render ani nové textury. Geometrie mobiliáře a vegetace se instancuje; park se odhaluje s plochami areálu a respektuje snížený pohyb.

`park.test.ts` ověřuje odstupy, trasu chodníků a laviček, neměnné velikosti, půdorys L a viditelnost rybníku z výchozí kamery.

## Společné řízení dopravy a značení komunikací

`trafficWorld.ts` propojuje běžný provoz, parkovací manévry, kamiony u doků i dodávky u vrat. `TrafficProvider` poskytuje stejný stav všem rendererům a vratům. Posuny hodin se schvalují v podkrocích nejvýše 1/30 s podle skutečně natočeného obdélníku celého vozidla včetně návěsu, zrcátek a odstupu. Testuje se průběh pohybu i krátký výhled dopředu. Projíždějící vozidla mají shodnou cestovní rychlost, při čekání se za sebe řadí. Vedlejší vjezdy používají rezervaci prostoru křižovatky a dávají přednost hlavní silnici; následovník ale nesmí blokovat odbočení vozidla před sebou.

Příjezd a odjezd mají oddělené pruhy na obou vjezdech. Parkovací manévry se střídají v jedné společné uličce a využívají vyhrazená volná stání se sousedními stáními bez odstavených aut. Dodávky používají vlastní příjezd, odjezd a krátké otočení v manipulačním prostoru, takže se nevracejí protisměrem po celé příjezdové trase. Vrata čtou jejich skutečný lokální čas a při čekání se nezavřou na vozidlo. Kamiony u doků zachovávají společný harmonogram: čekání jednoho zastaví čas celé dokové skupiny, aby nezačal další manévr na již obsazené ploše. Řízení neaktualizuje React state a při pozastavení provozu zůstává stát.

`roadMarkings.ts` a `RoadMarkingsView.tsx` vytvářejí značení pro oba režimy ze stejných souřadnic jako trasy: přerušovanou osu, vodicí čáry s přerušením u vjezdů, směrové šipky a čáry přednosti na výjezdech. Značení stání vychází ze skutečně rozmístěných parkovacích míst, nikoli opakované textury přes vjezd. Všechny čáry a šipky se sdílejí v jedné instancované síti. Pokud nejsou zvoleny doky ani vrata, obslužná silnice a její značení se nezobrazují.

`trafficWorld.test.ts` ověřuje společné kolize v šesti konfiguracích v obou režimech okolí, odstavená auta, otevření vrat při přejezdu fasády, souvislost pohybu, opakované přehrání, pozastavení a pokračování všech skupin během 800 s simulovaného provozu. Zvlášť kontroluje i vybočené rohy natočených vozidel. Jedná se o ilustrativní dopravní provoz, nikoli dopravně inženýrský návrh.

## Plastické označení haly Panattoni

`HallSignageView.tsx` přidává na čelní a pravou fasádu samostatná prostorová písmena a emblém podle fotografie papírového katalogu. Obrysy jsou přímo z vektorového loga na straně 3 lokálního `Brand manual Panattoni.pdf`, nikoli z náhradního fontu; jsou uloženy v `panattoniLogo.paths.json` a jako náhled `public/brand/logo-facade-navy.svg`. `hallSignage.ts` z nich vytváří skutečnou 10cm extruzi s 6mm zkosením, 3,5cm odsazením od opláštění, navy čelem a tmavšími boky. Materiál nevyužívá podkladovou ceduli ani svítící plochu, znaky vrhají stín na fasádu.

Umístění respektuje skutečné délky fasád včetně půdorysu L, podatikový pás, okna, vrata a svody. Při fasádním prosvětlení se nápis přesune pod pás oken nebo zmenší tak, aby zůstal na plném opláštění. Značení je součástí skupiny stěn, přebírá tedy průběh výstavby a rovinu řezu. Geometrie se přepočítává jen při změně šířky nápisu a po nahrazení se uvolňuje. Hlavička aplikace nadále používá samostatnou dříve zvolenou variantu s lístečkem.

`hallSignage.test.ts` kontroluje původní proporce, otvory v písmenech, skutečnou tloušťku, konečné souřadnice a kolize s otvory na malých i velkých halách, při obou variantách prosvětlení a u půdorysu L.

## Jemné architektonické a parkové detaily

`BuildingDetailsView.tsx` a `buildingDetails.ts` doplňují malá svítidla pod logem podle katalogu, květináče s nízkou zelení po stranách skutečného vstupu a vstupní rohož. Svítidla se vynechají při kolizi s otvorem; květináče stojí mimo dveřní křídla a zábradlí na existujícím chodníku. Díly se slučují podle materiálů a přebírají odhalení fasády i řez. Večer lehce svítí pouze čočky svítidel, bez přidání světel a stínových map.

Parkové koruny nyní tvoří tři střídmé shluky s drobnými větvemi; geometrie zůstává instancovaná a nepřekračuje dřívější rozměry korun. `ParkAmenitiesView.tsx` přidává tři stojany a dvě minimalistická jízdní kola na malé navazující dlažbě vedle posezení a tři nízká světla pěšiny. Koš s dřevěným obložením využívá stávající dávky mobiliáře. Kola, větve i koruny generuje jednou sdílená geometrie z `parkDetailGeometry.ts`. Nevznikl žádný nový režim ani další ovládací prvky.

## Sdílené modely aut a kombinované prosvětlení

`vehicleGeometry.ts` obsahuje společné modely osobního auta, dodávky a kamionu pro celý provoz. Osobní auto a dodávka mají tvarovanou zaoblenou karoserii se skutečnými výřezy podběhů, užší kabinu směrem ke střeše, skloněná čelní skla, samostatná boční okna s ponechanými sloupky, disky kol, světla, zrcátka, madla a nárazníky. `ParkedCarsView.tsx` používá stejný osobní vůz v instancovaných materiálových dávkách v obou režimech okolí, při zachování skutečných rozměrů a natočení. Minimalistické komunikace používají stejnou výšku povrchu jako podrobný areál, takže kola dosedají na vozovku. Kolizní obálky dopravy se nemění; `vehicleGeometry.test.ts` ověřuje, že uvnitř zůstávají i všechny přidané detaily.

V kroku Vybavení → Střecha lze vybrat také „Světlíky + fasádní okna“ (`daylight: both`). Obě soustavy otvorů zůstávají současně skutečně ve 3D geometrii. Provedení oken a světlíků lze volit nezávisle, souhrn a serverová kalkulace účtují obě skutečná množství. Konfigurace se stejným režimem se exportuje i přijímá zpět a předává do souhrnu poptávky. Dřívější konfigurace zůstávají kompatibilní.
