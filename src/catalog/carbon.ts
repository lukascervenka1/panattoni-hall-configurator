import type { CategoryId } from "./ids";
import type { CatalogOption } from "./schema";

/** Compare published A1–A3 values within one category, never across different material/quantity bases. */
export function lowestCarbonOptionIds(options: readonly CatalogOption[], category: CategoryId, unavailable: ReadonlySet<string> = new Set()): Set<string> {
  const comparable = options.filter((option) => option.active && option.category_id === category && !unavailable.has(option.option_id)
    && typeof option.details.gwp_kg_co2e === "number" && Number.isFinite(option.details.gwp_kg_co2e) && option.details.gwp_kg_co2e >= 0);
  if (comparable.length < 2) return new Set();
  const values = comparable.map((option) => option.details.gwp_kg_co2e!);
  const minimum = Math.min(...values);
  // A badge should distinguish a lower-impact alternative, rather than label every identical value.
  if (minimum === Math.max(...values)) return new Set();
  return new Set(comparable.filter((option) => option.details.gwp_kg_co2e === minimum).map((option) => option.option_id));
}
