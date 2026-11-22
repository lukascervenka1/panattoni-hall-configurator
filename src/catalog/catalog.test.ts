import { describe, expect, it } from "vitest";
import { CatalogSchema, CATEGORY_IDS, isUnitBasisCompatible, PriceSchema } from "./schema";
import { DEMO_CATALOG } from "./demo/build";
import { toPublicCatalog } from "./public";
import { cloneCatalog } from "@/tests/helpers";

describe("demo katalog", () => {
  it("projde validací schématu a je označen jako demo", () => {
    expect(CatalogSchema.safeParse(DEMO_CATALOG).success).toBe(true);
    expect(DEMO_CATALOG.meta.is_demo).toBe(true);
    expect(DEMO_CATALOG.meta.label_cs).toMatch(/DEMO/);
    expect(DEMO_CATALOG.meta.vat).toBe("excluded");
  });

  it("obsahuje 45 voleb ve 13 kategoriích; materiály mají cenu, alternativy technologií ne (individuální kalkulace)", () => {
    expect(CATEGORY_IDS).toHaveLength(13);
    expect(DEMO_CATALOG.options).toHaveLength(45);
    for (const c of CATEGORY_IDS) expect(DEMO_CATALOG.options.some((o) => o.category_id === c)).toBe(true);
    const technology = ["heating_hall", "heating_office", "lighting", "photovoltaics", "partition"];
    for (const o of DEMO_CATALOG.options) {
      const hasPrice = DEMO_CATALOG.prices.some((p) => p.option_id === o.option_id);
      if (technology.includes(o.category_id)) expect(hasPrice).toBe(o.details.is_standard);
      else expect(hasPrice).toBe(true);
    }
  });

  it("každá kategorie má právě jednu standardní volbu", () => {
    for (const c of CATEGORY_IDS) {
      expect(DEMO_CATALOG.options.filter((o) => o.category_id === c && o.details.is_standard)).toHaveLength(1);
    }
  });

  it("tři koncepty s předvolbami", () => {
    expect(DEMO_CATALOG.products.map((p) => p.product_id)).toEqual(["logistics", "production", "city_logistics"]);
    for (const p of DEMO_CATALOG.products) expect(DEMO_CATALOG.presets.some((r) => r.preset_id === p.preset_id)).toBe(true);
  });

  it("obrázky odkazují na existující lokální soubory", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    for (const o of DEMO_CATALOG.options) {
      if (!o.details.image) continue;
      expect(fs.existsSync(path.join(process.cwd(), "public", o.details.image))).toBe(true);
    }
  });
});

describe("veřejná projekce", () => {
  const pub = toPublicCatalog(DEMO_CATALOG);
  const text = JSON.stringify(pub);

  it("neobsahuje ceny, sazby ani identifikátory cen", () => {
    expect(pub).not.toHaveProperty("prices");
    expect(text).not.toMatch(/unit_price|price_id|price_mode|quantity_basis|unit_rate_disclosure/);
    // žádná ze zdrojových sazeb se nesmí objevit jako hodnota
    for (const p of DEMO_CATALOG.prices) expect(text).not.toContain(`"${p.unit_price}"`);
  });

  it("obsahuje jen aktivní koncepty a volby", () => {
    const hidden = cloneCatalog((c) => {
      c.products[2]!.active = false;
      c.options.find((o) => o.option_id === "cladding.eco")!.active = false;
    });
    const p = toPublicCatalog(hidden);
    expect(p.products.map((x) => x.product_id)).not.toContain("city_logistics");
    expect(p.options.map((o) => o.option_id)).not.toContain("cladding.eco");
  });
});

describe("schéma katalogu", () => {
  it("jednotka musí odpovídat míře množství", () => {
    expect(isUnitBasisCompatible("m2", "net_facade_area")).toBe(true);
    expect(isUnitBasisCompatible("m2", "dock_count")).toBe(false);
    expect(isUnitBasisCompatible("piece", "dock_count")).toBe(true);
    expect(isUnitBasisCompatible("flat", "one")).toBe(true);
    expect(isUnitBasisCompatible("flat", "footprint_area")).toBe(false);
  });

  it("cena s nekompatibilní jednotkou a českým zápisem se odmítne", () => {
    const base = { price_id: "p", option_id: "o", unit: "m2", unit_price: "1.00", currency: "EUR", quantity_basis: "net_facade_area", price_mode: "base" };
    expect(PriceSchema.safeParse(base).success).toBe(true);
    expect(PriceSchema.safeParse({ ...base, quantity_basis: "dock_count" }).success).toBe(false);
    expect(PriceSchema.safeParse({ ...base, unit_price: "1,00" }).success).toBe(false);
    expect(PriceSchema.safeParse({ ...base, unit_price: "-1.00" }).success).toBe(false);
  });

  it("odmítne duplicitní ID a odkazy na neexistující položky", () => {
    const dup = cloneCatalog((c) => c.options.push({ ...c.options[0]! }));
    expect(CatalogSchema.safeParse(dup).success).toBe(false);
    const dangling = cloneCatalog((c) => (c.prices[0]!.option_id = "neexistuje"));
    expect(CatalogSchema.safeParse(dangling).success).toBe(false);
  });

  it("jedna měna na katalog", () => {
    const mixed = cloneCatalog((c) => (c.prices[0]!.currency = "CZK"));
    expect(CatalogSchema.safeParse(mixed).success).toBe(false);
  });
});
