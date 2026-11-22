import { describe, expect, it } from "vitest";
import { computePrice, quantityForBasis, type PriceResult } from "./calculate";
import { formatCentsAsDecimal, formatMoney, multiplyCents, parseDecimalToCents, quantityToMilli } from "./money";
import { DEMO_CATALOG } from "@/catalog/demo/build";
import { computeQuantities } from "@/configurator/calculations/quantities";
import { cloneCatalog, configFor, patch } from "@/tests/helpers";

const ok = (r: ReturnType<typeof computePrice>): PriceResult => {
  if (r.status !== "ok") throw new Error("očekáván platný výsledek: " + JSON.stringify(r));
  return r;
};

describe("peníze v centech", () => {
  it("parsuje jen jednoznačné zápisy", () => {
    expect(parseDecimalToCents("51.86")).toBe(5186);
    expect(parseDecimalToCents("10000")).toBe(1_000_000);
    expect(parseDecimalToCents("0.5")).toBe(50);
    for (const bad of ["51,86", "1 000", "-5", "5.123", "", "1e3", " 5", "1.000,50"]) {
      expect(() => parseDecimalToCents(bad)).toThrow();
    }
  });

  it("násobení se zaokrouhluje half-up na celý cent", () => {
    expect(multiplyCents(5186, quantityToMilli(100))).toBe(518_600);
    expect(multiplyCents(1, quantityToMilli(0.5))).toBe(1); // 0,5 centu → 1 cent
    expect(multiplyCents(1, quantityToMilli(0.4))).toBe(0);
    expect(multiplyCents(3333, quantityToMilli(1.5))).toBe(5000); // 4999,5 → 5000
  });

  it("velké částky nepřetečou přesnost, nepodporovaný rozsah se odmítne", () => {
    expect(multiplyCents(99_999_999, quantityToMilli(1_000_000))).toBe(99_999_999 * 1_000_000);
    expect(() => multiplyCents(99_999_999_999, quantityToMilli(1_000_000))).toThrow(/rozsah/);
  });

  it("odmítne záporné a nekonečné množství", () => {
    expect(() => quantityToMilli(-1)).toThrow();
    expect(() => quantityToMilli(Infinity)).toThrow();
  });

  it("formátování", () => {
    expect(formatCentsAsDecimal(5186)).toBe("51.86");
    expect(formatCentsAsDecimal(5)).toBe("0.05");
    expect(formatMoney(123_456_700, "EUR")).toMatch(/1\s?234\s?567/);
  });
});

describe("computePrice: demo logistická hala (ruční výpočet ze seedu)", () => {
  const result = ok(computePrice(configFor("logistics"), DEMO_CATALOG));
  const q = computeQuantities(configFor("logistics"));

  it("řádek každé kategorie odpovídá množství × sazbě", () => {
    // Sazby standardních voleb ze zdrojového HTML: 51,86 / 52,5 / 32 / 52,5 / 10 000 / 6 000 / 325 / 350
    const expected =
      Math.round(51.86 * q.netFacadeAreaM2 * 100) +
      Math.round(52.5 * q.footprintAreaM2 * 100) +
      Math.round(32 * q.footprintAreaM2 * 100) +
      Math.round(52.5 * q.roofAreaM2 * 100) +
      10_000 * 14 * 100 +
      6_000 * 2 * 100 +
      Math.round(325 * q.skylightAreaM2 * 100) +
      Math.round(350 * q.windowAreaM2 * 100);
    expect(result.subtotalCents).toBe(expected);
    expect(result.lines).toHaveLength(13);
    expect(result.lines.every((l) => l.status === "priced")).toBe(true);
  });

  it("součet řádků = mezisoučet (žádné další zaokrouhlení)", () => {
    expect(result.lines.reduce((s, l) => s + (l.amountCents ?? 0), 0)).toBe(result.subtotalCents);
  });

  it("neúplný ceník nevydává dílčí součet za celkovou cenu", () => {
    expect(result.isComplete).toBe(false);
    expect(result.incompleteReasons.join(" ")).toMatch(/nezahrnuje/);
    expect(result.reservations.join(" ")).toMatch(/dílčí součet/);
    expect(result.vat).toBe("excluded");
    expect(result.catalogVersion.isDemo).toBe(true);
    expect(result.reservations.join(" ")).toMatch(/DEMO/);
  });

  it("jednotkové sazby se podle pravidla zveřejnění neposílají", () => {
    expect(result.lines.every((l) => l.unitRate === null)).toBe(true);
    const visible = cloneCatalog((c) => (c.meta.unit_rate_disclosure = "visible"));
    const r2 = ok(computePrice(configFor(), visible));
    expect(r2.lines.find((l) => l.categoryId === "cladding")?.unitRate).toBe("51.86");
  });

  it("odpověď neobsahuje interní data katalogu", () => {
    const text = JSON.stringify(result);
    expect(text).not.toMatch(/unit_price|price_id|"prices"/);
  });
});

describe("skládání cen", () => {
  it("výměna volby nahradí cenu standardu (nesčítá se standard a alternativa)", () => {
    const std = ok(computePrice(configFor(), DEMO_CATALOG));
    const alt = ok(computePrice(patch(configFor(), { cladding: "cladding.ks" }), DEMO_CATALOG));
    const q = computeQuantities(configFor());
    const delta = alt.subtotalCents - std.subtotalCents;
    expect(delta).toBe(Math.round(31.5 * q.netFacadeAreaM2 * 100) - Math.round(51.86 * q.netFacadeAreaM2 * 100));
    expect(alt.lines.filter((l) => l.categoryId === "cladding")).toHaveLength(1);
  });

  it("příplatek se přičte k základní ceně vybrané volby", () => {
    const cat = cloneCatalog((c) => {
      c.prices.push({
        price_id: "P-SURCH",
        option_id: "floor.heavy",
        unit: "m2",
        unit_price: "2.00",
        currency: "EUR",
        quantity_basis: "footprint_area",
        price_mode: "surcharge",
      });
    });
    const q = computeQuantities(configFor());
    const base = ok(computePrice(patch(configFor(), { floor: "floor.heavy" }), cloneCatalog(() => {})));
    const withSurcharge = ok(computePrice(patch(configFor(), { floor: "floor.heavy" }), cat));
    expect(withSurcharge.subtotalCents - base.subtotalCents).toBe(200 * q.footprintAreaM2);
    // příplatek se nepočítá, pokud je vybraný standard
    const std1 = ok(computePrice(configFor(), cat));
    const std2 = ok(computePrice(configFor(), cloneCatalog(() => {})));
    expect(std1.subtotalCents).toBe(std2.subtotalCents);
  });

  it("volba bez sazby vyžaduje individuální kalkulaci a nepřispívá do součtu", () => {
    const cat = cloneCatalog((c) => {
      c.prices = c.prices.filter((p) => p.option_id !== "roof.pnt");
    });
    const r = ok(computePrice(configFor(), cat));
    const roofLine = r.lines.find((l) => l.categoryId === "roof")!;
    expect(roofLine.status).toBe("individual");
    expect(roofLine.amountCents).toBeNull();
    expect(r.isComplete).toBe(false);
    expect(r.incompleteReasons.join(" ")).toMatch(/individuální kalkulaci/);
    const full = ok(computePrice(configFor(), DEMO_CATALOG));
    const q = computeQuantities(configFor());
    expect(full.subtotalCents - r.subtotalCents).toBe(Math.round(52.5 * q.roofAreaM2 * 100));
  });

  it("příplatek bez základní ceny je neúplný, ne zdarma", () => {
    const cat = cloneCatalog((c) => {
      c.prices = c.prices.filter((p) => p.option_id !== "floor.v1");
      c.prices.push({
        price_id: "P-ONLY-SURCH", option_id: "floor.v1", unit: "m2", unit_price: "1.00", currency: "EUR",
        quantity_basis: "footprint_area", price_mode: "surcharge",
      });
    });
    const r = ok(computePrice(patch(configFor(), { floor: "floor.v1" }), cat));
    expect(r.lines.find((l) => l.categoryId === "floor")?.status).toBe("individual");
  });

  it("kompletní katalog bez nepokrytého rozsahu je kompletní", () => {
    const cat = cloneCatalog((c) => (c.meta.unpriced_scope_cs = []));
    const r = ok(computePrice(configFor(), cat));
    expect(r.isComplete).toBe(true);
    expect(r.incompleteReasons).toEqual([]);
  });
});

describe("computePrice: odolnost", () => {
  it("neplatná konfigurace vrací problémy místo ceny", () => {
    const r = computePrice(patch(configFor(), { length_m: 12 }), DEMO_CATALOG);
    expect(r.status).toBe("invalid");
  });

  it("konfigurace z jiné verze katalogu se nepřepočítá potichu", () => {
    const other = { ...configFor(), catalogVersionId: "stara-verze" };
    expect(() => computePrice(other, DEMO_CATALOG)).toThrow(/jiné verzi/);
  });

  it("míra množství 'one' a ostatní jsou pokryty", () => {
    const q = computeQuantities(configFor());
    expect(quantityForBasis(q, "one")).toBe(1);
    expect(quantityForBasis(q, "opening_count")).toBe(q.openingCount);
    expect(quantityForBasis(q, "perimeter_length")).toBe(q.perimeterM);
  });

  it("cena roste s délkou a výškou (změna rozměrů → množství → cena)", () => {
    const base = ok(computePrice(configFor(), DEMO_CATALOG)).subtotalCents;
    const longer = ok(computePrice(patch(configFor(), { length_m: 204 }), DEMO_CATALOG)).subtotalCents;
    const higher = ok(computePrice(patch(configFor(), { clear_height_m: 12 }), DEMO_CATALOG)).subtotalCents;
    expect(longer).toBeGreaterThan(base);
    expect(higher).toBeGreaterThan(base);
  });
});
