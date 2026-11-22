/**
 * Sestavení DEMO katalogu z extrahovaného seedu (materials.source.json) a ručně psaných tabulek
 * Products / Presets / Rules. Všechna data jsou demo: nejde o schválený ceník ani schválené standardy.
 *
 * Tento modul obsahuje neveřejné cenové podklady. Smí ho importovat jen src/catalog/server.ts
 * (označeno "server-only"); klient dostává pouze veřejnou projekci z public.ts.
 */
import source from "./materials.source.json";
import { CATEGORY_TEXTS, OPTION_TEXTS, csDisplay } from "./cs-texts";
import {
  CatalogSchema,
  type Catalog,
  type CatalogOption,
  type CatalogPrice,
  type CategoryId,
  type QuantityBasis,
  type Unit,
} from "../schema";

/** Mapování ID kategorií zdrojového HTML na ID katalogu a výchozí jednotku/míru množství. */
const CATEGORY_MAP: Record<
  string,
  { id: CategoryId; unit: Unit; basis: QuantityBasis; sort: number }
> = {
  cladding: { id: "cladding", unit: "m2", basis: "net_facade_area", sort: 10 },
  structure: { id: "structure", unit: "m2", basis: "footprint_area", sort: 20 },
  floor: { id: "floor", unit: "m2", basis: "footprint_area", sort: 30 },
  roof: { id: "roof", unit: "m2", basis: "roof_area", sort: 40 },
  dock: { id: "dock", unit: "piece", basis: "dock_count", sort: 50 },
  drive: { id: "drive_in", unit: "piece", basis: "drive_in_count", sort: 60 },
  sky: { id: "skylight", unit: "m2", basis: "skylight_area", sort: 70 },
  win: { id: "window", unit: "m2", basis: "window_area", sort: 80 },
};

interface SourceVariant {
  id: string;
  pnt: boolean;
  image: string | null;
  imageFit: string | null;
  name: string;
  supplier: string;
  gwp_kg_co2e: number;
  u_value: string;
  mass: string;
  unit_price: number;
  service_life: string;
  fire: string;
  thickness: string;
  note_en: string | null;
  epd_url: string;
}

const categories = Object.entries(CATEGORY_MAP).map(([srcId, m]) => ({
  category_id: m.id,
  name_cs: CATEGORY_TEXTS[m.id]!.name_cs,
  description_cs: CATEGORY_TEXTS[m.id]!.description_cs,
  sort_order: m.sort,
  _src: srcId,
}));

const options: CatalogOption[] = [];
const prices: CatalogPrice[] = [];

for (const cat of categories) {
  const m = CATEGORY_MAP[cat._src]!;
  const srcCat = (source.categories as Record<string, { variants: SourceVariant[] }>)[cat._src]!;
  srcCat.variants.forEach((v, idx) => {
    const optionId = `${m.id}.${v.id}`;
    const t = OPTION_TEXTS[optionId];
    if (!t) throw new Error(`Chybí český text pro ${optionId}`);
    options.push({
      option_id: optionId,
      category_id: m.id,
      name_cs: t.name_cs,
      description_cs: t.type_cs,
      renderer_key: `${m.id}.default`,
      material_key: `${m.id}-${v.id}`,
      color_hex: (t.color_hex as `#${string}` | undefined) ?? null,
      active: true,
      sort_order: (idx + 1) * 10,
      details: {
        supplier: v.supplier,
        type_cs: t.type_cs,
        is_standard: v.pnt,
        image: v.image,
        image_fit: v.imageFit === "cover" ? "cover" : "contain",
        gwp_kg_co2e: v.gwp_kg_co2e,
        u_value: csDisplay(v.u_value),
        mass: csDisplay(v.mass),
        service_life: csDisplay(v.service_life),
        fire: csDisplay(v.fire),
        thickness: csDisplay(v.thickness),
        note_cs: t.note_cs ?? null,
        epd_url: v.epd_url,
      },
    });
    prices.push({
      price_id: `P-${optionId}`,
      option_id: optionId,
      unit: m.unit,
      unit_price: v.unit_price.toFixed(2),
      currency: "EUR",
      quantity_basis: m.basis,
      price_mode: "base",
    });
  });
}

/**
 * Technologie a příčky (M2). Seed z HTML je neobsahuje, proto jsou to ručně psané DEMO volby:
 * standardní volba má cenu 0 (technologie je v nepokrytém rozsahu TZB), ostatní nemají sazbu
 * a cena "vyžaduje individuální kalkulaci". Žádné vymyšlené ceny.
 */
const EXTRA: Array<{
  category: CategoryId;
  name_cs: string;
  description_cs: string;
  sort: number;
  options: Array<{ id: string; name_cs: string; type_cs: string; standard?: boolean; note_cs?: string }>;
}> = [
  {
    category: "heating_hall",
    name_cs: "Vytápění haly",
    description_cs: "Temperování nebo vytápění hlavního prostoru haly. Vytápění administrativy se volí samostatně.",
    sort: 90,
    options: [
      { id: "std", name_cs: "Temperování (standard)", type_cs: "Hala je temperována na ochranu proti zamrznutí", standard: true },
      { id: "warm_air", name_cs: "Teplovzdušné jednotky", type_cs: "Závěsné jednotky pod střechou" },
      { id: "radiant", name_cs: "Sálavé panely", type_cs: "Závěsné sálavé panely nad zónami", note_cs: "Kombinace s PIR izolací střechy vyžaduje požární posouzení." },
    ],
  },
  {
    category: "heating_office",
    name_cs: "Vytápění administrativy",
    description_cs: "Vytápění a chlazení kancelářské vestavby; nezávislé na vytápění haly.",
    sort: 100,
    options: [
      { id: "std", name_cs: "Standardní vytápění", type_cs: "Podle standardu administrativy", standard: true },
      { id: "heat_pump", name_cs: "Tepelné čerpadlo vzduch–voda", type_cs: "Venkovní jednotka u administrativy" },
      { id: "electric", name_cs: "Elektrické vytápění", type_cs: "Přímotopné prvky" },
    ],
  },
  {
    category: "lighting",
    name_cs: "Osvětlení haly",
    description_cs: "Umělé osvětlení interiéru haly.",
    sort: 110,
    options: [
      { id: "std", name_cs: "LED svítidla (standard)", type_cs: "Lineární LED svítidla v rastru", standard: true },
      { id: "sensors", name_cs: "LED s denním řízením", type_cs: "LED svítidla se senzory denního světla a pohybu" },
    ],
  },
  {
    category: "photovoltaics",
    name_cs: "Fotovoltaika",
    description_cs: "Fotovoltaické panely na střeše v rámci podporované varianty. Nejde o výpočet výroby energie.",
    sort: 120,
    options: [
      { id: "none", name_cs: "Bez fotovoltaiky", type_cs: "Střecha s rezervou pro pozdější instalaci", standard: true },
      { id: "p30", name_cs: "Fotovoltaika na 30 % střechy", type_cs: "Panely na volné ploše střechy", note_cs: "Rozsah je ilustrativní. Statika střechy se posuzuje individuálně (zatížení 25 kg/m²)." },
      { id: "p60", name_cs: "Fotovoltaika na 60 % střechy", type_cs: "Panely na většině volné plochy střechy", note_cs: "Rozsah je ilustrativní. Statika střechy se posuzuje individuálně (zatížení 25 kg/m²)." },
    ],
  },
  {
    category: "partition",
    name_cs: "Vnitřní příčky",
    description_cs: "Jednoduché dělení haly na zóny. Dispoziční řešení, ne projekt požárních úseků.",
    sort: 130,
    options: [
      { id: "none", name_cs: "Bez příček", type_cs: "Jeden volný prostor", standard: true },
      { id: "split2", name_cs: "Jedna příčka (2 zóny)", type_cs: "Příčka napříč halou s průchodem" },
      { id: "split3", name_cs: "Dvě příčky (3 zóny)", type_cs: "Dvě příčky napříč halou s průchody" },
    ],
  },
];

for (const group of EXTRA) {
  categories.push({
    category_id: group.category,
    name_cs: group.name_cs,
    description_cs: group.description_cs,
    sort_order: group.sort,
    _src: "",
  });
  group.options.forEach((o, idx) => {
    const optionId = `${group.category}.${o.id}`;
    options.push({
      option_id: optionId,
      category_id: group.category,
      name_cs: o.name_cs,
      description_cs: o.type_cs,
      renderer_key: `${group.category}.tech`,
      material_key: `${group.category}-${o.id}`,
      color_hex: null,
      active: true,
      sort_order: (idx + 1) * 10,
      details: {
        supplier: null,
        type_cs: o.type_cs,
        is_standard: Boolean(o.standard),
        image: null,
        image_fit: null,
        gwp_kg_co2e: null,
        u_value: null,
        mass: null,
        service_life: null,
        fire: null,
        thickness: null,
        note_cs: o.note_cs ?? null,
        epd_url: null,
      },
    });
    if (o.standard) {
      prices.push({ price_id: `P-${optionId}`, option_id: optionId, unit: "flat", unit_price: "0.00", currency: "EUR", quantity_basis: "one", price_mode: "base" });
    }
  });
}

const preset = (preset_id: string, rows: Record<string, string>) =>
  Object.entries(rows).map(([parameter_id, value]) => ({ preset_id, parameter_id: parameter_id as never, value }));

const rule = (
  rule_id: string,
  product_id: string,
  parameter_id: string,
  rule_type: Catalog["rules"][number]["rule_type"],
  value: string,
  message_cs: string,
) => ({ rule_id, product_id, parameter_id: parameter_id as never, rule_type, value, message_cs });

const rules = [
  // Logistická hala
  rule("R-LOG-LEN-MIN", "logistics", "length_m", "min", "60", "Délka logistické haly musí být nejméně 60 m (demo pravidlo)."),
  rule("R-LOG-LEN-MAX", "logistics", "length_m", "max", "300", "Délka logistické haly může být nejvýše 300 m (demo pravidlo)."),
  rule("R-LOG-LEN-STEP", "logistics", "length_m", "step", "6", "Délka haly se mění po 6 m podle konstrukčního modulu (demo pravidlo)."),
  rule("R-LOG-WID-MIN", "logistics", "width_m", "min", "36", "Šířka logistické haly musí být nejméně 36 m (demo pravidlo)."),
  rule("R-LOG-WID-MAX", "logistics", "width_m", "max", "150", "Šířka logistické haly může být nejvýše 150 m (demo pravidlo)."),
  rule("R-LOG-WID-STEP", "logistics", "width_m", "step", "6", "Šířka haly se mění po 6 m podle konstrukčního modulu (demo pravidlo)."),
  rule("R-LOG-H-MIN", "logistics", "clear_height_m", "min", "8", "Světlá výška logistické haly musí být nejméně 8 m (demo pravidlo)."),
  rule("R-LOG-H-MAX", "logistics", "clear_height_m", "max", "14", "Světlá výška logistické haly může být nejvýše 14 m (demo pravidlo)."),
  rule("R-LOG-H-STEP", "logistics", "clear_height_m", "step", "0.5", "Světlá výška se mění po 0,5 m (demo pravidlo)."),
  // Výrobní hala
  rule("R-PRD-LEN-MIN", "production", "length_m", "min", "48", "Délka výrobní haly musí být nejméně 48 m (demo pravidlo)."),
  rule("R-PRD-LEN-MAX", "production", "length_m", "max", "180", "Délka výrobní haly může být nejvýše 180 m (demo pravidlo)."),
  rule("R-PRD-LEN-STEP", "production", "length_m", "step", "6", "Délka haly se mění po 6 m podle konstrukčního modulu (demo pravidlo)."),
  rule("R-PRD-WID-MIN", "production", "width_m", "min", "36", "Šířka výrobní haly musí být nejméně 36 m (demo pravidlo)."),
  rule("R-PRD-WID-MAX", "production", "width_m", "max", "96", "Šířka výrobní haly může být nejvýše 96 m (demo pravidlo)."),
  rule("R-PRD-WID-STEP", "production", "width_m", "step", "6", "Šířka haly se mění po 6 m podle konstrukčního modulu (demo pravidlo)."),
  rule("R-PRD-H-MIN", "production", "clear_height_m", "min", "6", "Světlá výška výrobní haly musí být nejméně 6 m (demo pravidlo)."),
  rule("R-PRD-H-MAX", "production", "clear_height_m", "max", "12", "Světlá výška výrobní haly může být nejvýše 12 m (demo pravidlo)."),
  rule("R-PRD-H-STEP", "production", "clear_height_m", "step", "0.5", "Světlá výška se mění po 0,5 m (demo pravidlo)."),
  rule("R-PRD-OFFICE", "production", "office_enabled", "required", "true", "Výrobní hala vyžaduje administrativní část (demo pravidlo)."),
  // Městská logistika
  rule("R-CTY-LEN-MIN", "city_logistics", "length_m", "min", "36", "Délka městské haly musí být nejméně 36 m (demo pravidlo)."),
  rule("R-CTY-LEN-MAX", "city_logistics", "length_m", "max", "120", "Délka městské haly může být nejvýše 120 m (demo pravidlo)."),
  rule("R-CTY-LEN-STEP", "city_logistics", "length_m", "step", "6", "Délka haly se mění po 6 m podle konstrukčního modulu (demo pravidlo)."),
  rule("R-CTY-WID-MIN", "city_logistics", "width_m", "min", "24", "Šířka městské haly musí být nejméně 24 m (demo pravidlo)."),
  rule("R-CTY-WID-MAX", "city_logistics", "width_m", "max", "60", "Šířka městské haly může být nejvýše 60 m (demo pravidlo)."),
  rule("R-CTY-WID-STEP", "city_logistics", "width_m", "step", "6", "Šířka haly se mění po 6 m podle konstrukčního modulu (demo pravidlo)."),
  rule("R-CTY-H-MIN", "city_logistics", "clear_height_m", "min", "6", "Světlá výška městské haly musí být nejméně 6 m (demo pravidlo)."),
  rule("R-CTY-H-MAX", "city_logistics", "clear_height_m", "max", "9", "V městské lokalitě je výška omezena na 9 m světlé výšky (demo pravidlo)."),
  rule("R-CTY-H-STEP", "city_logistics", "clear_height_m", "step", "0.5", "Světlá výška se mění po 0,5 m (demo pravidlo)."),
  rule("R-CTY-DOCK-A", "city_logistics", "dock", "available_for_concept", "dock.pnt", "Standardní nakládací doky jsou dostupné pro městskou logistiku."),
  rule("R-CTY-DOCK-B", "city_logistics", "dock", "available_for_concept", "dock.assa", "Doky ASSA ABLOY jsou dostupné pro městskou logistiku."),
];

// Dostupnost a kombinace voleb (demo pravidla).
rules.push(
  rule("R-CTY-PV-A", "city_logistics", "photovoltaics", "available_for_concept", "photovoltaics.none", "V městské lokalitě je fotovoltaika omezena na 30 % střechy (demo pravidlo)."),
  rule("R-CTY-PV-B", "city_logistics", "photovoltaics", "available_for_concept", "photovoltaics.p30", "V městské lokalitě je fotovoltaika omezena na 30 % střechy (demo pravidlo)."),
  rule("R-LOG-PV-ROOF", "logistics", "roof", "forbidden_combination", "roof=roof.v4&photovoltaics=photovoltaics.p60", "Dřevěná střešní konstrukce nenese 60 % fotovoltaiky (demo pravidlo)."),
  rule("R-PRD-PV-ROOF", "production", "roof", "forbidden_combination", "roof=roof.v4&photovoltaics=photovoltaics.p60", "Dřevěná střešní konstrukce nenese 60 % fotovoltaiky (demo pravidlo)."),
  rule("R-CTY-PV-ROOF", "city_logistics", "roof", "forbidden_combination", "roof=roof.v4&photovoltaics=photovoltaics.p30", "Dřevěná střešní konstrukce vyžaduje samostatné statické posouzení fotovoltaiky (demo pravidlo)."),
  rule("R-LOG-RAD-PIR", "logistics", "roof", "forbidden_combination", "roof=roof.v2&heating_hall=heating_hall.radiant", "Sálavé panely nelze kombinovat s PIR izolací střechy bez požárního posouzení (demo pravidlo)."),
  rule("R-PRD-RAD-PIR", "production", "roof", "forbidden_combination", "roof=roof.v2&heating_hall=heating_hall.radiant", "Sálavé panely nelze kombinovat s PIR izolací střechy bez požárního posouzení (demo pravidlo)."),
  rule("R-CTY-RAD-PIR", "city_logistics", "roof", "forbidden_combination", "roof=roof.v2&heating_hall=heating_hall.radiant", "Sálavé panely nelze kombinovat s PIR izolací střechy bez požárního posouzení (demo pravidlo)."),
);

// Půdorys L: rozměry výřezu (demo meze); ramena haly navíc hlídá kód (nejméně 24 m).
for (const [pid, code] of [["logistics", "LOG"], ["production", "PRD"], ["city_logistics", "CTY"]] as const) {
  rules.push(
    rule(`R-${code}-NL-MIN`, pid, "notch_length_m", "min", "12", "Výřez musí být dlouhý nejméně 12 m (demo pravidlo)."),
    rule(`R-${code}-NL-STEP`, pid, "notch_length_m", "step", "6", "Délka výřezu se mění po 6 m (demo pravidlo)."),
    rule(`R-${code}-NW-MIN`, pid, "notch_width_m", "min", "12", "Výřez musí být široký nejméně 12 m (demo pravidlo)."),
    rule(`R-${code}-NW-STEP`, pid, "notch_width_m", "step", "6", "Šířka výřezu se mění po 6 m (demo pravidlo)."),
  );
}

const catalogCandidate = {
  version_id: "demo-2026-11-20",
  meta: {
    schema_version: 1 as const,
    template_version: "0.1-demo",
    currency: "EUR",
    is_demo: true,
    label_cs: "DEMO katalog – ceny a parametry nejsou schválené",
    price_basis_cs: "Orientační cena realizace, nezávazná, v EUR bez DPH",
    vat: "excluded" as const,
    unit_rate_disclosure: "hidden" as const,
    unpriced_scope_cs: [
      "zakládání, piloty a zemní práce",
      "technická zařízení budov (vytápění, vzduchotechnika, elektro, voda)",
      "vnitřní příčky a vestavba administrativy",
      "zpevněné plochy, komunikace a venkovní úpravy",
      "ostatní otvory fasády a doplňky",
    ],
    source_note_cs:
      "Seed z dodaného HTML katalogu materiálů (Panattoni-Materials-Configurator.html). Ceny jsou odhady za m² nebo kus ze zdrojového souboru, nikoli schválený ceník.",
  },
  categories: categories.map(({ _src: _omit, ...c }) => c),
  products: [
    {
      product_id: "logistics",
      name_cs: "Logistická hala",
      description_cs: "Velká hala s nakládacími doky pro sklady a distribuci.",
      preset_id: "preset-logistics",
      active: true,
      sort_order: 10,
    },
    {
      product_id: "production",
      name_cs: "Výrobní hala",
      description_cs: "Hala pro výrobu a montáž s větší administrativou a vjezdovými vraty.",
      preset_id: "preset-production",
      active: true,
      sort_order: 20,
    },
    {
      product_id: "city_logistics",
      name_cs: "Městská logistika",
      description_cs: "Kompaktní hala pro rozvoz zboží v blízkosti města.",
      preset_id: "preset-city",
      active: true,
      sort_order: 30,
    },
  ],
  options,
  prices,
  presets: [
    ...preset("preset-logistics", { length_m: "150", width_m: "84", clear_height_m: "10", dock_count: "14", drive_in_count: "2", office_enabled: "true", office_area_m2: "600", office_floors: "1" }),
    ...preset("preset-production", { length_m: "96", width_m: "60", clear_height_m: "8", dock_count: "4", drive_in_count: "4", office_enabled: "true", office_area_m2: "800", office_floors: "2" }),
    ...preset("preset-city", { length_m: "72", width_m: "36", clear_height_m: "8", dock_count: "8", drive_in_count: "2", office_enabled: "true", office_area_m2: "300", office_floors: "1" }),
  ],
  rules,
};

/** Validovaný demo katalog. Případná chyba v datech spadne při načtení, ne za běhu zákazníka. */
export const DEMO_CATALOG: Catalog = CatalogSchema.parse(catalogCandidate);
