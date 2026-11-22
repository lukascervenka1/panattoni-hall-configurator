import type { ConfigCatalog } from "@/catalog/public";
import { DEMO_GEOMETRY as G } from "../calculations/constants";
import { HARD_LIMITS, type HallConfig } from "../schema/config";
import { normalizeConfig } from "./normalize";
import { ruleRange } from "./validate";

/** Volba podlaží a případné zvýšení haly tvoří jednu změnu. null znamená, že ji koncept neumožňuje. */
export function configForOfficeFloors(config: HallConfig, catalog: ConfigCatalog, floors: HallConfig["office"]["floors"]): HallConfig | null {
  if (!config.office.enabled) return null;
  const range = ruleRange(catalog, config.productId, "clear_height_m");
  const required = floors * G.office.floorHeightM + G.office.headroomM;
  const anchor = range.min ?? HARD_LIMITS.clearHeightM.min;
  // Zaokrouhlit nahoru: nejbližší nižší krok by podlaží opět odstranil při normalizaci.
  const height = range.step && range.step > 0
    ? anchor + Math.ceil((required - anchor) / range.step - 1e-9) * range.step
    : required;
  const next = normalizeConfig({
    ...config,
    dimensions: { ...config.dimensions, clearHeightM: Math.max(config.dimensions.clearHeightM, height) },
    office: { ...config.office, floors },
  }, catalog);
  return next.office.enabled && next.office.floors === floors ? next : null;
}
