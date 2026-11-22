/**
 * Veřejná projekce katalogu pro klienta. Záměrně NEobsahuje tabulku cen, sazby ani cokoli z `prices`.
 * Pravidla, presety, volby a technické údaje jsou veřejné; cena se počítá výhradně na serveru.
 */
import type {
  Catalog,
  CatalogCategory,
  CatalogOption,
  CatalogProduct,
  CatalogRule,
} from "./schema";

export interface PublicCatalog {
  versionId: string;
  meta: {
    label_cs: string;
    is_demo: boolean;
    currency: string;
    price_basis_cs: string;
    vat: "excluded";
    unpriced_scope_cs: string[];
  };
  categories: CatalogCategory[];
  products: CatalogProduct[];
  options: CatalogOption[];
  presets: Catalog["presets"];
  rules: CatalogRule[];
}

/** Co potřebují pravidla a výchozí hodnoty. Splňuje ho veřejná projekce i plný katalog po `toPublicCatalog`. */
export type ConfigCatalog = Pick<PublicCatalog, "versionId" | "products" | "options" | "presets" | "rules">;

export function toPublicCatalog(catalog: Catalog): PublicCatalog {
  return {
    versionId: catalog.version_id,
    meta: {
      label_cs: catalog.meta.label_cs,
      is_demo: catalog.meta.is_demo,
      currency: catalog.meta.currency,
      price_basis_cs: catalog.meta.price_basis_cs,
      vat: catalog.meta.vat,
      unpriced_scope_cs: [...catalog.meta.unpriced_scope_cs],
    },
    categories: [...catalog.categories].sort((a, b) => a.sort_order - b.sort_order),
    products: catalog.products.filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order),
    options: catalog.options.filter((o) => o.active).sort((a, b) => a.sort_order - b.sort_order),
    presets: catalog.presets,
    rules: catalog.rules,
  };
}
