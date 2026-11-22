/**
 * Serverová orientační kalkulace. Vstupem je pouze konfigurace (volby a rozměry) a neměnná verze katalogu.
 * Množství i ceny si server počítá sám; cokoli, co by klient přidal (cena, množství), se ignoruje.
 *
 * Skládání cen (docs/PRICING.md):
 * - v každé kategorii je vybrána právě jedna volba; cena = její řádky "base" + řádky "surcharge".
 *   Standard a jeho náhrada se tak nikdy nesečtou (nepřevybraná volba se nepočítá).
 * - volba bez řádku "base" je "vyžaduje individuální kalkulaci": nepřispívá do součtu a součet není kompletní.
 * - katalog může vyjmenovat nepokryté části stavby; pak je celek vždy jen dílčí součet.
 */
import { toPublicCatalog } from "@/catalog/public";
import { CATEGORY_IDS, type Catalog, type CategoryId, type QuantityBasis, type Unit } from "@/catalog/schema";
import type { HallConfig } from "@/configurator/schema/config";
import { computeQuantities, type Quantities } from "@/configurator/calculations/quantities";
import { validateConfig, type ValidationIssue } from "@/configurator/rules/validate";
import { multiplyCents, parseDecimalToCents, quantityToMilli } from "./money";

export interface PriceLine {
  categoryId: CategoryId;
  categoryName: string;
  optionId: string;
  optionName: string;
  priceMode: "base" | "surcharge" | "none";
  status: "priced" | "individual";
  quantity: number;
  unit: Unit | null;
  basis: QuantityBasis | null;
  /** Jednotková sazba jen pokud to katalog dovoluje (meta.unit_rate_disclosure === "visible"). */
  unitRate: string | null;
  amountCents: number | null;
}

export interface PriceResult {
  status: "ok";
  catalogVersion: { id: string; label: string; isDemo: boolean };
  currency: string;
  vat: "excluded";
  priceBasis: string;
  lines: PriceLine[];
  /** Součet oceněných položek. Pokud isComplete === false, jde o dílčí součet, nikoli cenu celé stavby. */
  subtotalCents: number;
  isComplete: boolean;
  incompleteReasons: string[];
  reservations: string[];
  quantities: Quantities;
}

export interface PriceInvalid {
  status: "invalid";
  issues: ValidationIssue[];
}

export function quantityForBasis(q: Quantities, basis: QuantityBasis): number {
  switch (basis) {
    case "footprint_area":
      return q.footprintAreaM2;
    case "net_facade_area":
      return q.netFacadeAreaM2;
    case "roof_area":
      return q.roofAreaM2;
    case "skylight_area":
      return q.skylightAreaM2;
    case "window_area":
      return q.windowAreaM2;
    case "office_floor_area":
      return q.officeFloorAreaM2;
    case "perimeter_length":
      return q.perimeterM;
    case "dock_count":
      return q.dockCount;
    case "drive_in_count":
      return q.driveInCount;
    case "opening_count":
      return q.openingCount;
    case "one":
      return 1;
  }
}

export function computePrice(config: HallConfig, catalog: Catalog): PriceResult | PriceInvalid {
  if (config.catalogVersionId !== catalog.version_id) {
    throw new Error("Konfigurace patří jiné verzi katalogu, než je předaná.");
  }
  // Validace běží nad veřejnou projekcí: pravidla nepotřebují a nesmějí vidět ceny.
  const validation = validateConfig(config, toPublicCatalog(catalog));
  if (!validation.ok) return { status: "invalid", issues: validation.issues };

  const quantities = computeQuantities(config);
  const disclose = catalog.meta.unit_rate_disclosure === "visible";
  const lines: PriceLine[] = [];
  const incompleteReasons: string[] = [];
  let subtotal = 0;

  const categories = [...catalog.categories].sort((a, b) => a.sort_order - b.sort_order);
  for (const categoryId of CATEGORY_IDS) {
    const category = categories.find((c) => c.category_id === categoryId)!;
    const option = catalog.options.find((o) => o.option_id === config.selections[categoryId])!;
    const rows = catalog.prices.filter((p) => p.option_id === option.option_id);
    const base = rows.filter((p) => p.price_mode === "base");
    const surcharges = rows.filter((p) => p.price_mode === "surcharge");

    if (base.length === 0) {
      lines.push({
        categoryId,
        categoryName: category.name_cs,
        optionId: option.option_id,
        optionName: option.name_cs,
        priceMode: "none",
        status: "individual",
        quantity: 0,
        unit: null,
        basis: null,
        unitRate: null,
        amountCents: null,
      });
      incompleteReasons.push(`„${option.name_cs}“ (${category.name_cs}) nemá v ceníku sazbu, vyžaduje individuální kalkulaci.`);
      continue;
    }

    for (const row of [...base, ...surcharges]) {
      const qty = quantityForBasis(quantities, row.quantity_basis);
      const unitCents = parseDecimalToCents(row.unit_price);
      const amount = multiplyCents(unitCents, quantityToMilli(qty));
      subtotal += amount;
      lines.push({
        categoryId,
        categoryName: category.name_cs,
        optionId: option.option_id,
        optionName: option.name_cs,
        priceMode: row.price_mode,
        status: "priced",
        quantity: qty,
        unit: row.unit,
        basis: row.quantity_basis,
        unitRate: disclose ? row.unit_price : null,
        amountCents: amount,
      });
    }
  }

  const scope = catalog.meta.unpriced_scope_cs;
  if (scope.length > 0) {
    incompleteReasons.push(`Cena nezahrnuje: ${scope.join("; ")}.`);
  }
  const isComplete = incompleteReasons.length === 0;

  const reservations = [
    `${catalog.meta.price_basis_cs}.`,
    ...(catalog.meta.is_demo ? ["DEMO data: ceny a parametry nejsou schválený ceník ani standardy Panattoni."] : []),
    ...(isComplete ? [] : ["Jde o dílčí součet vybraných stavebních částí; celkovou cenu stanoví individuální kalkulace."]),
    "Vizualizace nepotvrzuje stavební, požární, statickou ani provozní proveditelnost.",
  ];

  return {
    status: "ok",
    catalogVersion: { id: catalog.version_id, label: catalog.meta.label_cs, isDemo: catalog.meta.is_demo },
    currency: catalog.meta.currency,
    vat: catalog.meta.vat,
    priceBasis: catalog.meta.price_basis_cs,
    lines,
    subtotalCents: subtotal,
    isComplete,
    incompleteReasons,
    reservations,
    quantities,
  };
}
