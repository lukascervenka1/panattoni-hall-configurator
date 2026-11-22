import { describe, expect, it } from "vitest";
import { validateConfig } from "./validate";
import { normalizeConfig, snapToRange } from "./normalize";
import { createConfigFromProduct } from "../schema/defaults";
import { parseConfig, serializeConfig, parseParameterValue } from "../schema/config";
import { configFor, patch, publicCatalog } from "@/tests/helpers";
import type { ConfigCatalog } from "@/catalog/public";

const codes = (r: ReturnType<typeof validateConfig>) => r.issues.map((i) => i.code);

describe("validateConfig: předvolby konceptů", () => {
  it.each(["logistics", "production", "city_logistics"])("preset %s je platný", (id) => {
    expect(validateConfig(configFor(id), publicCatalog)).toEqual({ ok: true, issues: [] });
  });

  it("neznámý koncept", () => {
    const c = { ...configFor(), productId: "nope" };
    expect(codes(validateConfig(c, publicCatalog))).toEqual(["unknown_product"]);
  });
});

describe("validateConfig: pravidla z katalogu", () => {
  it("minimum a maximum", () => {
    expect(codes(validateConfig(patch(configFor(), { length_m: 54 }), publicCatalog))).toContain("min");
    expect(codes(validateConfig(patch(configFor(), { length_m: 306 }), publicCatalog))).toContain("max");
  });

  it("krok se měří od minima (60 + n·6)", () => {
    expect(codes(validateConfig(patch(configFor(), { length_m: 150 }), publicCatalog))).not.toContain("step");
    expect(codes(validateConfig(patch(configFor(), { length_m: 151 }), publicCatalog))).toContain("step");
    expect(codes(validateConfig(patch(configFor(), { clear_height_m: 10.5 }), publicCatalog))).not.toContain("step");
    expect(codes(validateConfig(patch(configFor(), { clear_height_m: 10.3 }), publicCatalog))).toContain("step");
  });

  it("povinná volba (výrobní hala vyžaduje administrativu)", () => {
    const r = validateConfig(patch(configFor("production"), { office_enabled: false }), publicCatalog);
    expect(codes(r)).toContain("required");
    expect(r.issues.find((i) => i.code === "required")?.message_cs).toMatch(/administrativ/);
  });

  it("dostupnost pro koncept: městská logistika nemá externí nakládací dům", () => {
    const r = validateConfig(patch(configFor("city_logistics"), { dock: "dock.vw" }), publicCatalog);
    expect(codes(r)).toContain("option_unavailable");
    expect(validateConfig(patch(configFor("city_logistics"), { dock: "dock.assa" }), publicCatalog).ok).toBe(true);
  });

  it("volba z jiné kategorie je neplatná", () => {
    expect(codes(validateConfig(patch(configFor(), { cladding: "roof.pnt" }), publicCatalog))).toContain("unknown_option");
  });

  it("zakázaná kombinace (syntetické pravidlo)", () => {
    const cat: ConfigCatalog = {
      ...publicCatalog,
      rules: [
        ...publicCatalog.rules,
        {
          rule_id: "R-X",
          product_id: "logistics",
          parameter_id: "roof",
          rule_type: "forbidden_combination",
          value: "roof=roof.v2&office_floors=2",
          message_cs: "PIR střecha se nesmí kombinovat s dvoupodlažní administrativou.",
        },
      ],
    };
    const ok = patch(configFor(), { roof: "roof.v2", office_floors: 1 });
    expect(validateConfig(ok, cat).ok).toBe(true);
    const bad = patch(configFor(), { roof: "roof.v2", office_floors: 2, office_area_m2: 800 });
    const r = validateConfig(bad, cat);
    expect(codes(r)).toContain("forbidden_combination");
  });

  it("chybně zapsané pravidlo se nehádá, ale ohlásí", () => {
    const cat: ConfigCatalog = {
      ...publicCatalog,
      rules: [
        ...publicCatalog.rules,
        { rule_id: "R-BAD", product_id: "logistics", parameter_id: "length_m", rule_type: "min", value: "60,5", message_cs: "x" },
      ],
    };
    expect(codes(validateConfig(configFor(), cat))).toContain("rule_malformed");
  });
});

describe("validateConfig: odvozená omezení", () => {
  it("počet doků omezený délkou fasády", () => {
    expect(codes(validateConfig(patch(configFor(), { dock_count: 32 }), publicCatalog))).toContain("dock_capacity");
    expect(validateConfig(patch(configFor(), { dock_count: 31 }), publicCatalog).ok).toBe(true);
  });

  it("dvě podlaží administrativy vyžadují dost vysokou halu", () => {
    const c = patch(configFor("production"), { clear_height_m: 7 });
    expect(codes(validateConfig(c, publicCatalog))).toContain("office_floors");
  });

  it("administrativa musí být v mezích plochy haly", () => {
    expect(codes(validateConfig(patch(configFor(), { office_area_m2: 5000 }), publicCatalog))).toContain("office_area");
    expect(codes(validateConfig(patch(configFor(), { office_area_m2: 10 }), publicCatalog))).toContain("office_area");
  });
});

describe("normalizeConfig", () => {
  it("ořízne a přichytí rozměry na mřížku pravidel", () => {
    const n = normalizeConfig(patch(configFor(), { length_m: 151, width_m: 400, clear_height_m: 3 }), publicCatalog);
    expect(n.dimensions).toMatchObject({ lengthM: 150, widthM: 150, clearHeightM: 8, shape: "rect", notchLengthM: 0, notchWidthM: 0 });
    expect(validateConfig(n, publicCatalog).ok).toBe(true);
  });

  it("zmenšení haly sníží počet doků na kapacitu fasády", () => {
    const n = normalizeConfig(patch(configFor(), { length_m: 60, dock_count: 14 }), publicCatalog);
    expect(n.openings.dockCount).toBe(Math.min(14, 11));
    expect(validateConfig(n, publicCatalog).ok).toBe(true);
  });

  it("snížení výšky sníží počet podlaží administrativy", () => {
    const n = normalizeConfig(patch(configFor("production"), { clear_height_m: 7 }), publicCatalog);
    expect(n.office.floors).toBe(1);
    expect(validateConfig(n, publicCatalog).ok).toBe(true);
  });

  it("nedostupná volba se nahradí výchozí", () => {
    const n = normalizeConfig(patch(configFor("city_logistics"), { dock: "dock.vw" }), publicCatalog);
    expect(n.selections.dock).toBe("dock.pnt");
  });

  it("snapToRange: nečíselná hodnota spadne na minimum", () => {
    expect(snapToRange(NaN, { min: 6, max: 20, step: 2 })).toBe(6);
    expect(snapToRange(7.2, { min: 6, max: 20, step: 2 })).toBe(8);
  });
});

describe("serializace a vstupy", () => {
  it("konfigurace přežije JSON round-trip", () => {
    const c = configFor();
    const r = parseConfig(JSON.parse(serializeConfig(c)));
    expect(r).toEqual({ ok: true, config: c });
  });

  it("odmítne nesmysly a přehnané hodnoty", () => {
    expect(parseConfig({}).ok).toBe(false);
    expect(parseConfig(patch(configFor(), { length_m: 1e9 })).ok).toBe(false);
    expect(parseConfig(patch(configFor(), { length_m: NaN })).ok).toBe(false);
  });

  it("neznámá pole konfigurace se zahodí", () => {
    const r = parseConfig({ ...configFor(), price: 1, quantities: { x: 1 } });
    expect(r.ok && "price" in r.config).toBe(false);
  });

  it("české desetinné zápisy v tabulkách se nehádají", () => {
    expect(() => parseParameterValue("clear_height_m", "10,5")).toThrow();
    expect(parseParameterValue("clear_height_m", "10.5")).toBe(10.5);
    expect(() => parseParameterValue("office_enabled", "ano")).toThrow();
  });

  it("preset nastaví jen existující parametry", () => {
    const c = createConfigFromProduct(publicCatalog, "city_logistics");
    expect(c.dimensions.lengthM).toBe(72);
    expect(c.catalogVersionId).toBe(publicCatalog.versionId);
    expect(Object.values(c.selections)).toHaveLength(13);
  });
});
