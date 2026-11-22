import { DEMO_CATALOG } from "@/catalog/demo/build";
import { toPublicCatalog } from "@/catalog/public";
import type { Catalog } from "@/catalog/schema";
import { createConfigFromProduct } from "@/configurator/schema/defaults";
import { withParameter, type HallConfig } from "@/configurator/schema/config";
import type { ParameterId } from "@/catalog/schema";

export const publicCatalog = toPublicCatalog(DEMO_CATALOG);

export function configFor(productId = "logistics"): HallConfig {
  return createConfigFromProduct(publicCatalog, productId);
}

export function patch(config: HallConfig, changes: Partial<Record<ParameterId, number | boolean | string>>): HallConfig {
  let c = config;
  for (const [k, v] of Object.entries(changes)) c = withParameter(c, k as ParameterId, v as number | boolean | string);
  return c;
}

export function cloneCatalog(mutate: (c: Catalog) => void): Catalog {
  const c = structuredClone(DEMO_CATALOG);
  mutate(c);
  return c;
}
