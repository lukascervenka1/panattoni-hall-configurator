# Cenotvorba

Implementace: [src/pricing/calculate.ts](../src/pricing/calculate.ts), [money.ts](../src/pricing/money.ts), [handler.ts](../src/pricing/handler.ts). Testy: [pricing.test.ts](../src/pricing/pricing.test.ts), [handler.test.ts](../src/pricing/handler.test.ts).

## Autorita

Cenu počítá výhradně server z neměnné verze katalogu. Klient posílá jen konfiguraci (volby a rozměry). Tělo je parsováno Zod schématem, takže jakákoli podvržená pole (cena, množství) se zahodí. Server konfiguraci znovu validuje podle pravidel katalogu a sám spočítá množství.

## Skládání

1. V každé kategorii je vybrána právě jedna volba. Počítá se jen ona, takže se **standard a jeho náhrada nikdy nesečtou**.
2. Cena volby = její řádky `base` + řádky `surcharge`. Každý řádek = sazba × množství podle `quantity_basis`.
3. Volba bez řádku `base` (i když má jen příplatek) je **"vyžaduje individuální kalkulaci"**: nepřispívá do součtu a součet není kompletní.
4. Katalog může vyjmenovat nepokryté části stavby (`meta.unpriced_scope_cs`). Je-li seznam neprázdný, je výsledek vždy dílčí součet.
5. Jednotka musí odpovídat míře množství (`m2` ↔ plochy, `piece` ↔ počty, `flat` ↔ `one`); schéma jiné kombinace odmítne.

## Peníze a zaokrouhlení

- Sazby se v katalogu zapisují jako řetězec `123.45` (tečka, nejvýše 2 desetinná místa). Jiné zápisy (čárka, mezery, záporné) jsou chyba; nehádá se.
- Počítá se v celých centech. Množství → tisíciny. Mezisoučet řádku = sazba v centech × množství, zaokrouhleno **half-up** na cent (BigInt, bez ztráty přesnosti). Celek = součet zaokrouhlených řádků.
- Jedna měna na katalog, žádné konverze.
- DPH: ukazuje se jen cena **bez DPH**; sazba se nevymýšlí.

## Odpověď a chyby

`200` výsledek s rozpisem, výhradami, verzí katalogu a množstvími. `400` neplatný JSON/konfigurace, `409` neznámá verze katalogu, `413` příliš velké tělo (8 kB), `422` porušení pravidel (s důvody), `429` limit (s `Retry-After`), `500` selhání výpočtu. Klient při chybě **nezobrazuje poslední cenu**; během přepočtu ji označí jako zastaralou. Odpovědi mají `Cache-Control: no-store`.

## Zveřejnění sazeb

`unit_rate_disclosure`: `hidden` (výchozí) nebo `visible`. Interní náklady a marže v katalogu nejsou a do klienta se nikdy neposílají.
