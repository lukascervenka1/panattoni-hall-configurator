import { describe, expect, it } from "vitest";
import { configFor, patch, publicCatalog } from "@/tests/helpers";
import { DEMO_CATALOG } from "@/catalog/demo/build";
import { normalizeConfig } from "../rules/normalize";
import { validateConfig } from "../rules/validate";
import { parseConfig, parseParameterValue, serializeConfig } from "../schema/config";
import { computeQuantities } from "./quantities";
import { columnFrame, findOpeningProblems, maxOfficeFloors, officeLayout, placeOpenings } from "./layout";
import { computePrice } from "@/pricing/calculate";
import { layoutSkylights } from "@/scene/layout";

describe("tři podlaží administrativy", () => {
  const config = patch(configFor(), { office_floors: 3, office_area_m2: 900, clear_height_m: 11 });
  it("vejdou se od 11 m, mají tři řady oken a nezapočítají přízemí podruhé", () => {
    expect(maxOfficeFloors(10.5)).toBe(2);
    expect(maxOfficeFloors(11)).toBe(3);
    expect(maxOfficeFloors(60)).toBe(3);
    expect(validateConfig(config, publicCatalog).ok).toBe(true);
    expect(officeLayout(config)?.heightM).toBe(10.5);
    const windows = placeOpenings(config).filter((o) => o.kind === "window");
    expect(new Set(windows.map((o) => o.floor))).toEqual(new Set([0, 1, 2]));
    expect(findOpeningProblems(config.dimensions, placeOpenings(config))).toEqual([]);
    const q = computeQuantities(config);
    expect(q.officeFootprintM2).toBe(300);
    expect(q.officeFloorAreaM2).toBe(900);
    expect(q.totalFloorAreaM2).toBe(q.footprintAreaM2 + 600);
    expect(parseConfig(JSON.parse(serializeConfig(config))).ok).toBe(true);
  });
  it("při snížení haly sníží počet podlaží, import příliš vysoké vestavby odmítne", () => {
    const low = patch(config, { clear_height_m: 10 });
    const validation = validateConfig(low, publicCatalog);
    expect(validation.issues.find((i) => i.code === "office_floors")?.message_cs).toContain("Tři");
    const normalized = normalizeConfig(low, publicCatalog);
    expect(normalized.office.floors).toBe(2);
    expect(validateConfig(normalized, publicCatalog).ok).toBe(true);
    expect(normalizeConfig(patch(configFor("city_logistics"), { office_floors: 3, clear_height_m: 11 }), publicCatalog).office.floors).toBe(2);
  });
});

describe("denní světlo", () => {
  it.each(["logistics", "production", "city_logistics"])("%s: fasádní okna nahradí světlíky, kancelářská okna zůstanou", (product) => {
    const roof = configFor(product);
    const facade = patch(roof, { daylight: "facade" });
    const qr = computeQuantities(roof);
    const qf = computeQuantities(facade);
    expect(qf.hallWindowCount).toBeGreaterThan(0);
    expect(qf.officeWindowCount).toBe(qr.officeWindowCount);
    expect(qf.officeWindowAreaM2).toBe(qr.officeWindowAreaM2);
    expect(qf.windowCount).toBe(qf.officeWindowCount + qf.hallWindowCount);
    expect(qf.windowAreaM2).toBeCloseTo(qf.officeWindowAreaM2 + qf.hallWindowAreaM2, 2);
    expect(qf.skylightAreaM2).toBe(0);
    expect(qf.roofAreaM2).toBe(qf.footprintAreaM2);
    expect(layoutSkylights(facade)).toEqual([]);
    expect(layoutSkylights(roof).length).toBeGreaterThan(0);
    expect(qf.netFacadeAreaM2).toBeCloseTo(qr.netFacadeAreaM2 - qf.hallWindowAreaM2, 2);
    const price = computePrice(facade, DEMO_CATALOG);
    expect(price.status).toBe("ok");
    if (price.status !== "ok") return;
    expect(price.lines.find((l) => l.categoryId === "skylight")?.amountCents).toBe(0);
    expect(price.lines.find((l) => l.categoryId === "window")?.quantity).toBe(qf.windowAreaM2);
    expect(computeQuantities(patch(facade, { daylight: "roof" }))).toEqual(qr);
  });

  it("okna haly existují i bez administrativy a nepřekrývají vrata, sloupy ani kanceláře", () => {
    for (const product of ["logistics", "production", "city_logistics"]) {
      for (const shape of ["rect", "L"]) {
        for (const height of [6, 8, 11, 14]) {
          for (const office of [false, true]) {
            const config = normalizeConfig(patch(configFor(product), {
              daylight: "facade", shape, clear_height_m: height, office_enabled: office,
              office_floors: 3, dock_count: 500, drive_in_count: 500,
            }), publicCatalog);
            expect(findOpeningProblems(config.dimensions, placeOpenings(config))).toEqual([]);
            expect(validateConfig(config, publicCatalog).issues.filter((issue) => issue.code !== "required" || issue.parameterId !== "office_enabled")).toEqual([]);
            const windows = placeOpenings(config).filter((o) => o.kind === "hallWindow");
            expect(windows.length).toBeGreaterThan(0);
            if (!office) expect(computeQuantities(config).officeWindowCount).toBe(0);
            const frame = columnFrame(config.dimensions);
            for (const w of windows) {
              expect(w.sillM).toBeGreaterThan(5);
              expect(w.sillM + w.heightM).toBeLessThan(config.dimensions.clearHeightM);
              // Front and rear use the same structural x grid, seen from opposite directions.
              if (w.facade === "front" || w.facade === "rear") {
                for (const x of frame.xs) {
                  const u = w.facade === "front" ? x + config.dimensions.lengthM / 2 : config.dimensions.lengthM / 2 - x;
                  expect(Math.abs(w.centerU - u)).toBeGreaterThanOrEqual(w.widthM / 2 + 0.3 - 1e-6);
                }
              }
            }
          }
        }
      }
    }
  });

  it("starší exporty zachovají světlíky, neznámý režim import odmítne", () => {
    const legacy = JSON.parse(serializeConfig(configFor()));
    delete legacy.daylight;
    const parsed = parseConfig(legacy);
    expect(parsed.ok && parsed.config.daylight).toBe("roof");
    expect(parseConfig({ ...legacy, daylight: "unknown" }).ok).toBe(false);
    expect(() => parseParameterValue("daylight", "unknown")).toThrow();
  });
});

describe("kombinace světlíků a fasádních oken", () => {
  it.each(["logistics", "production", "city_logistics"])("%s: obě prosvětlení jsou současně v modelu, množstvích i kalkulaci", (product) => {
    const roof = configFor(product);
    const facade = patch(roof, { daylight: "facade" });
    const both = patch(roof, { daylight: "both" });
    expect(validateConfig(both, publicCatalog).ok).toBe(true);
    expect(parseParameterValue("daylight", "both")).toBe("both");
    const parsed = parseConfig(JSON.parse(serializeConfig(both)));
    expect(parsed.ok && parsed.config.daylight).toBe("both");
    const qr = computeQuantities(roof), qf = computeQuantities(facade), qb = computeQuantities(both);
    expect(qb.skylightAreaM2).toBe(qr.skylightAreaM2);
    expect(qb.roofAreaM2).toBe(qr.roofAreaM2);
    expect(qb.hallWindowAreaM2).toBe(qf.hallWindowAreaM2);
    expect(qb.hallWindowCount).toBe(qf.hallWindowCount);
    expect(qb.officeWindowAreaM2).toBe(qr.officeWindowAreaM2);
    expect(qb.netFacadeAreaM2).toBe(qf.netFacadeAreaM2);
    expect(layoutSkylights(both)).toEqual(layoutSkylights(roof));
    expect(placeOpenings(both).filter((o) => o.kind === "hallWindow")).toEqual(placeOpenings(facade).filter((o) => o.kind === "hallWindow"));
    const price = computePrice(both, DEMO_CATALOG);
    expect(price.status).toBe("ok");
    if (price.status === "ok") {
      expect(price.lines.find((l) => l.categoryId === "skylight" && l.priceMode === "base")?.quantity).toBe(qb.skylightAreaM2);
      expect(price.lines.find((l) => l.categoryId === "window" && l.priceMode === "base")?.quantity).toBe(qb.windowAreaM2);
    }
  });
});
