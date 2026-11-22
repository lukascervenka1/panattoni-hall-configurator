import type { ConfigCatalog } from "@/catalog/public";
import { CATEGORY_IDS, type ParameterId } from "@/catalog/ids";
import { availableOptionIds } from "../rules/validate";
import {
  CONFIG_SCHEMA_VERSION,
  parseParameterValue,
  withParameter,
  type HallConfig,
} from "./config";

/** Standardní (přednastavená) volba kategorie; omezená dostupností pro koncept. */
export function defaultOptionId(catalog: ConfigCatalog, productId: string, category: (typeof CATEGORY_IDS)[number]): string {
  const available = availableOptionIds(catalog, productId, category);
  const standard = catalog.options.find((o) => o.category_id === category && o.details.is_standard && available.includes(o.option_id));
  const chosen = standard?.option_id ?? available[0];
  if (!chosen) throw new Error(`Kategorie ${category} nemá pro koncept ${productId} žádnou dostupnou volbu.`);
  return chosen;
}

/** Nová konfigurace z presetu konceptu. Preset může nastavit jen existující parametry (spec kap. 9). */
export function createConfigFromProduct(catalog: ConfigCatalog, productId: string): HallConfig {
  const product = catalog.products.find((p) => p.product_id === productId);
  if (!product) throw new Error(`Neznámý koncept ${productId}`);

  let config: HallConfig = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    productId,
    catalogVersionId: catalog.versionId,
    daylight: "roof",
    dimensions: { lengthM: 100, widthM: 60, clearHeightM: 10, shape: "rect", notchLengthM: 0, notchWidthM: 0 },
    openings: { dockCount: 0, driveInCount: 0 },
    office: { enabled: false, areaM2: 0, floors: 1 },
    selections: Object.fromEntries(CATEGORY_IDS.map((c) => [c, defaultOptionId(catalog, productId, c)])) as HallConfig["selections"],
  };
  for (const row of catalog.presets.filter((p) => p.preset_id === product.preset_id)) {
    config = withParameter(config, row.parameter_id as ParameterId, parseParameterValue(row.parameter_id as ParameterId, row.value));
  }
  return config;
}
