# Datový slovník katalogu

Zdroj pravdy: [src/catalog/schema.ts](../src/catalog/schema.ts). Tabulky odpovídají listům sešitu z kap. 9 specifikace, aby je M3 mohl importovat bez přemodelování. Excel šablona zatím není (M3).

Identifikátory jsou neměnné, nezávislé na názvu; `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`. Preferuje se deaktivace před smazáním.

## Products
`product_id`, `name_cs`, `description_cs`, `preset_id`, `active`, `sort_order`

## Options
`option_id` (`<kategorie>.<varianta>`), `category_id`, `name_cs`, `description_cs`, `renderer_key`, `material_key`, `color_hex`, `active`, `sort_order`

Rozšíření oproti spec: `details` (list `OptionDetails` v Excelu): `supplier`, `type_cs`, `is_standard` (právě jedna aktivní standardní volba v kategorii), `image`, `image_fit`, `gwp_kg_co2e`, `u_value`, `mass`, `service_life`, `fire`, `thickness`, `note_cs`, `epd_url`.

Kategorie: `cladding`, `structure`, `floor`, `roof`, `dock`, `drive_in`, `skylight`, `window` (materiály, ceny ze seedu) a `heating_hall`, `heating_office`, `lighting`, `photovoltaics`, `partition` (M2: technologie a dispozice, standardní volba cena 0, alternativy bez sazby = individuální kalkulace). Jejich názvy jsou v tabulce `Categories` (`category_id`, `name_cs`, `description_cs`, `sort_order`); nová kategorie vyžaduje vývoj.

## Prices
`price_id`, `option_id`, `unit` (`m2`, `m`, `piece`, `flat`), `unit_price` (`123.45`), `currency`, `quantity_basis`, `price_mode` (`base`, `surcharge`)

`quantity_basis`: `footprint_area`, `net_facade_area`, `roof_area` (bez světlíků), `skylight_area`, `window_area`, `office_floor_area`, `perimeter_length`, `dock_count`, `drive_in_count`, `opening_count`, `one`.

## Presets
`preset_id`, `parameter_id`, `value` (řetězec; číslo s tečkou, `true`/`false`, nebo `option_id`)

## Rules
`rule_id`, `product_id`, `parameter_id`, `rule_type`, `value`, `message_cs`

| `rule_type` | `value` | Význam |
| --- | --- | --- |
| `min`, `max` | číslo | číselný parametr |
| `step` | číslo | mřížka kroku; počátek = pravidlo `min` téhož parametru, jinak 0 |
| `required` | hodnota | parametr musí mít přesně tuto hodnotu |
| `forbidden_combination` | `p1=v1&p2=v2` | zakázáno, platí-li všechny podmínky |
| `available_for_concept` | `option_id` | existuje-li pro kategorii a produkt aspoň jedno, jsou povoleny jen uvedené volby |

Parametry (`parameter_id`): `length_m`, `width_m`, `clear_height_m`, `dock_count`, `drive_in_count`, `office_area_m2`, `office_floors`, `office_enabled`, `notch_length_m`, `notch_width_m` (rozměry výřezu u půdorysu L), `shape` (`rect` nebo `L`) a ID kategorií pro volby. Jiné zápisy hodnot (např. `10,5`) se odmítají.

Co **nepatří** do Excelu a drží kód: kapacita fasády pro vrata, rozměry a výška administrativy, kolize otvorů.

## Meta
`schema_version`, `template_version`, `currency`, `is_demo`, `label_cs`, `price_basis_cs`, `vat` (`excluded`), `unit_rate_disclosure`, `unpriced_scope_cs[]`, `source_note_cs`.
