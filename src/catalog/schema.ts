/**
 * Datový kontrakt katalogu. Tabulky odpovídají listům sešitu z kapitoly 9 specifikace:
 * Products, Options, Prices, Presets, Rules (+ Categories a OptionDetails jako rozšíření, viz docs/DATA_DICTIONARY.md).
 *
 * Katalog je neměnný snapshot jedné verze. Veřejný klient nikdy nedostane tabulku `prices`
 * (viz public.ts); server je autoritou pro cenu.
 */
import { z } from "zod";

import {
  BOOLEAN_PARAMETER_IDS,
  CATEGORY_IDS,
  CHOICE_PARAMETER_IDS,
  NUMERIC_PARAMETER_IDS,
  PARAMETER_IDS,
  type BooleanParameterId,
  type ChoiceParameterId,
  type CategoryId,
  type NumericParameterId,
  type ParameterId,
} from "./ids";

export { BOOLEAN_PARAMETER_IDS, CATEGORY_IDS, CHOICE_PARAMETER_IDS, NUMERIC_PARAMETER_IDS, PARAMETER_IDS };
export type { BooleanParameterId, CategoryId, ChoiceParameterId, NumericParameterId, ParameterId };

export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export const ParameterIdSchema = z.enum(PARAMETER_IDS);

export const UNITS = ["m2", "m", "piece", "flat"] as const;
export const QUANTITY_BASES = [
  "footprint_area",
  "net_facade_area",
  "roof_area",
  "skylight_area",
  "window_area",
  "office_floor_area",
  "perimeter_length",
  "dock_count",
  "drive_in_count",
  "opening_count",
  "one",
] as const;
export type Unit = (typeof UNITS)[number];
export type QuantityBasis = (typeof QUANTITY_BASES)[number];

const AREA_BASES: readonly QuantityBasis[] = [
  "footprint_area",
  "net_facade_area",
  "roof_area",
  "skylight_area",
  "window_area",
  "office_floor_area",
];
const COUNT_BASES: readonly QuantityBasis[] = ["dock_count", "drive_in_count", "opening_count"];

/** Kompatibilita jednotky a míry množství (spec: "quantity_basis vybírá z podporovaných měr"). */
export function isUnitBasisCompatible(unit: Unit, basis: QuantityBasis): boolean {
  switch (unit) {
    case "m2":
      return AREA_BASES.includes(basis);
    case "m":
      return basis === "perimeter_length";
    case "piece":
      return COUNT_BASES.includes(basis);
    case "flat":
      return basis === "one";
  }
}

export const RULE_TYPES = [
  "min",
  "max",
  "step",
  "required",
  "forbidden_combination",
  "available_for_concept",
] as const;
export type RuleType = (typeof RULE_TYPES)[number];

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, "ID smí obsahovat jen písmena, číslice, tečku, podtržítko a pomlčku.");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const decimalString = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Cena musí být nezáporné číslo s tečkou a nejvýše 2 desetinnými místy.");

export const CategorySchema = z.object({
  category_id: CategoryIdSchema,
  name_cs: z.string().min(1),
  description_cs: z.string(),
  sort_order: z.number().int(),
});

export const ProductSchema = z.object({
  product_id: id,
  name_cs: z.string().min(1),
  description_cs: z.string(),
  preset_id: id,
  active: z.boolean(),
  sort_order: z.number().int(),
});

export const OptionDetailsSchema = z.object({
  supplier: z.string().nullable(),
  type_cs: z.string().nullable(),
  /** Standard Panattoni v dané kategorii (zdroj: sloupec "pnt" v demo seedu). Přednastavená volba. */
  is_standard: z.boolean(),
  image: z.string().startsWith("/").nullable(),
  image_fit: z.enum(["cover", "contain"]).nullable(),
  gwp_kg_co2e: z.number().nonnegative().nullable(),
  u_value: z.string().nullable(),
  mass: z.string().nullable(),
  service_life: z.string().nullable(),
  fire: z.string().nullable(),
  thickness: z.string().nullable(),
  note_cs: z.string().nullable(),
  epd_url: z.string().url().nullable(),
});

export const OptionSchema = z.object({
  option_id: id,
  category_id: CategoryIdSchema,
  name_cs: z.string().min(1),
  description_cs: z.string(),
  renderer_key: z.string().min(1),
  material_key: z.string().min(1),
  color_hex: hex.nullable(),
  active: z.boolean(),
  sort_order: z.number().int(),
  details: OptionDetailsSchema,
});

export const PriceSchema = z
  .object({
    price_id: id,
    option_id: id,
    unit: z.enum(UNITS),
    unit_price: decimalString,
    currency: z.string().length(3),
    quantity_basis: z.enum(QUANTITY_BASES),
    price_mode: z.enum(["base", "surcharge"]),
  })
  .superRefine((p, ctx) => {
    if (!isUnitBasisCompatible(p.unit, p.quantity_basis)) {
      ctx.addIssue({
        code: "custom",
        message: `Jednotka "${p.unit}" není kompatibilní s mírou "${p.quantity_basis}".`,
        path: ["quantity_basis"],
      });
    }
  });

export const PresetRowSchema = z.object({
  preset_id: id,
  parameter_id: ParameterIdSchema,
  value: z.string().min(1),
});

export const RuleSchema = z.object({
  rule_id: id,
  product_id: id,
  parameter_id: ParameterIdSchema,
  rule_type: z.enum(RULE_TYPES),
  value: z.string().min(1),
  message_cs: z.string().min(1),
});

export const CatalogMetaSchema = z.object({
  schema_version: z.literal(1),
  template_version: z.string(),
  currency: z.string().length(3),
  /** DEMO data nejsou schválený ceník ani schválené standardy. UI musí označení zobrazit. */
  is_demo: z.boolean(),
  label_cs: z.string(),
  /** Co cena vyjadřuje. Demo = výslovně orientační cena realizace (viz spec kap. 3). */
  price_basis_cs: z.string(),
  vat: z.literal("excluded"),
  /** Pravidlo zveřejnění sazeb: "hidden" = klient dostane položku, množství a mezisoučet, ale ne jednotkovou sazbu. */
  unit_rate_disclosure: z.enum(["hidden", "visible"]),
  /** Části stavby, které ceník nepokrývá. Neprázdné pole znamená, že celková cena není kompletní. */
  unpriced_scope_cs: z.array(z.string()),
  source_note_cs: z.string(),
});

export const CatalogSchema = z
  .object({
    version_id: id,
    meta: CatalogMetaSchema,
    categories: z.array(CategorySchema),
    products: z.array(ProductSchema),
    options: z.array(OptionSchema),
    prices: z.array(PriceSchema),
    presets: z.array(PresetRowSchema),
    rules: z.array(RuleSchema),
  })
  .superRefine((c, ctx) => {
    const dup = (label: string, ids: string[]) => {
      const seen = new Set<string>();
      for (const x of ids) {
        if (seen.has(x)) ctx.addIssue({ code: "custom", message: `Duplicitní ${label}: ${x}` });
        seen.add(x);
      }
    };
    dup("product_id", c.products.map((p) => p.product_id));
    dup("option_id", c.options.map((o) => o.option_id));
    dup("price_id", c.prices.map((p) => p.price_id));
    dup("rule_id", c.rules.map((r) => r.rule_id));

    const optionIds = new Set(c.options.map((o) => o.option_id));
    const productIds = new Set(c.products.map((p) => p.product_id));
    const presetIds = new Set(c.presets.map((p) => p.preset_id));
    for (const p of c.prices) {
      if (!optionIds.has(p.option_id)) ctx.addIssue({ code: "custom", message: `Cena ${p.price_id} odkazuje na neexistující option_id ${p.option_id}.` });
      if (p.currency !== c.meta.currency) ctx.addIssue({ code: "custom", message: `Cena ${p.price_id} má měnu ${p.currency}, katalog má ${c.meta.currency} (jedna měna na katalog).` });
    }
    for (const p of c.products) {
      if (!presetIds.has(p.preset_id)) ctx.addIssue({ code: "custom", message: `Produkt ${p.product_id} odkazuje na neexistující preset ${p.preset_id}.` });
    }
    for (const r of c.rules) {
      if (!productIds.has(r.product_id)) ctx.addIssue({ code: "custom", message: `Pravidlo ${r.rule_id} odkazuje na neexistující produkt ${r.product_id}.` });
    }
    // Každá kategorie musí mít právě jednu standardní aktivní volbu (výchozí výběr).
    for (const cat of CATEGORY_IDS) {
      const std = c.options.filter((o) => o.category_id === cat && o.active && o.details.is_standard);
      if (std.length !== 1) ctx.addIssue({ code: "custom", message: `Kategorie ${cat} musí mít právě jednu aktivní standardní volbu (nalezeno ${std.length}).` });
    }
  });

export type Catalog = z.infer<typeof CatalogSchema>;
export type CatalogOption = z.infer<typeof OptionSchema>;
export type CatalogProduct = z.infer<typeof ProductSchema>;
export type CatalogPrice = z.infer<typeof PriceSchema>;
export type CatalogRule = z.infer<typeof RuleSchema>;
export type CatalogCategory = z.infer<typeof CategorySchema>;
