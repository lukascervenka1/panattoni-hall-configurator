import { describe, expect, it } from "vitest";
import {
  facadeLengthM,
  facadesOf,
  findOpeningProblems,
  footprintAreaM2,
  footprintPolygon,
  maxDriveInCount,
  notchLimits,
  officeAreaLimits,
  placeOpenings,
  pointInFootprint,
  rectHitsNotch,
} from "./layout";
import { computeQuantities } from "./quantities";
import { normalizeConfig } from "../rules/normalize";
import { validateConfig } from "../rules/validate";
import { computePrice } from "@/pricing/calculate";
import { DEMO_CATALOG } from "@/catalog/demo/build";
import { configFor, patch, publicCatalog } from "@/tests/helpers";

const area = (poly: Array<[number, number]>) => Math.abs(poly.reduce((s, [x, z], i) => s + (x * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * z), 0)) / 2;

/** Konfigurace L po normalizaci pravidly (jak ji vyrobí UI). */
const lConfig = (id = "logistics", changes: Parameters<typeof patch>[1] = {}) =>
  normalizeConfig(patch(configFor(id), { shape: "L", ...changes }), publicCatalog);

describe("půdorys L: geometrie obálky", () => {
  it("polygon má správnou plochu (obdélník i L) a po zmenšení o stěnu je menší", () => {
    const r = configFor().dimensions;
    expect(area(footprintPolygon(r))).toBeCloseTo(footprintAreaM2(r));
    const l = lConfig().dimensions;
    expect(l.shape).toBe("L");
    expect(l.notchLengthM).toBeGreaterThan(0);
    expect(area(footprintPolygon(l))).toBeCloseTo(l.lengthM * l.widthM - l.notchLengthM * l.notchWidthM);
    expect(area(footprintPolygon(l))).toBeCloseTo(footprintAreaM2(l));
    expect(area(footprintPolygon(l, 0.3))).toBeLessThan(area(footprintPolygon(l)));
    expect(footprintPolygon(l)).toHaveLength(6);
    expect(footprintPolygon(r)).toHaveLength(4);
  });

  it("šest fasád a jejich délky dávají obvod 2·(L+W) (stejný jako u obdélníku)", () => {
    const l = lConfig().dimensions;
    expect(facadesOf(l)).toHaveLength(6);
    expect(facadesOf(configFor().dimensions)).toHaveLength(4);
    const sum = facadesOf(l).reduce((s, f) => s + facadeLengthM(l, f), 0);
    expect(sum).toBeCloseTo(2 * (l.lengthM + l.widthM));
    expect(facadeLengthM(l, "front")).toBe(l.lengthM - l.notchLengthM);
    expect(facadeLengthM(l, "right")).toBe(l.widthM - l.notchWidthM);
  });

  it("bod a obdélník ve výřezu se poznají", () => {
    const l = lConfig().dimensions;
    const inNotch = { x: l.lengthM / 2 - 1, z: l.widthM / 2 - 1 };
    expect(pointInFootprint(l, inNotch.x, inNotch.z)).toBe(false);
    expect(pointInFootprint(l, -l.lengthM / 2 + 3, 0)).toBe(true);
    expect(rectHitsNotch(l, { x0: inNotch.x - 1, x1: inNotch.x + 1, z0: inNotch.z - 1, z1: inNotch.z + 1 })).toBe(true);
    expect(rectHitsNotch(l, { x0: -5, x1: 5, z0: -5, z1: 5 })).toBe(false);
    expect(pointInFootprint(configFor().dimensions, 74, 41)).toBe(true); // obdélník: žádný výřez
  });
});

describe("půdorys L: množství a cena", () => {
  const rect = patch(configFor(), {});
  const l = lConfig();
  const qr = computeQuantities(rect);
  const ql = computeQuantities(l);

  it("zastavěná plocha je o výřez menší, obvod i čistá plocha fasády zůstávají", () => {
    expect(ql.footprintAreaM2).toBeCloseTo(qr.footprintAreaM2 - l.dimensions.notchLengthM * l.dimensions.notchWidthM);
    expect(ql.perimeterM).toBe(qr.perimeterM);
    expect(ql.grossFacadeAreaM2).toBe(qr.grossFacadeAreaM2);
    // docky na zadní fasádě a okna administrativy se nemění; vjezdová vrata mají kratší fasádu, ale stejný počet
    expect(ql.dockCount).toBe(qr.dockCount);
    expect(ql.windowCount).toBe(qr.windowCount);
    expect(ql.netFacadeAreaM2).toBeCloseTo(qr.netFacadeAreaM2 - (ql.openingsAreaM2 - qr.openingsAreaM2));
  });

  it("administrativa se nepočítá podruhé ani v L", () => {
    expect(ql.hallGroundAreaM2).toBeCloseTo(ql.footprintAreaM2 - ql.officeFootprintM2);
    expect(ql.totalFloorAreaM2).toBeCloseTo(ql.footprintAreaM2 + (ql.officeFloorAreaM2 - ql.officeFootprintM2));
  });

  it("střecha a světlíky odpovídají menší ploše; cena L je nižší než obdélníku", () => {
    expect(ql.roofAreaM2 + ql.skylightAreaM2).toBeCloseTo(ql.footprintAreaM2);
    const pr = computePrice(rect, DEMO_CATALOG);
    const pl = computePrice(l, DEMO_CATALOG);
    if (pr.status !== "ok" || pl.status !== "ok") throw new Error("očekávána cena");
    expect(pl.subtotalCents).toBeLessThan(pr.subtotalCents);
    expect(pl.quantities.footprintAreaM2).toBe(ql.footprintAreaM2);
  });

  it("otvory v L se platně rozmístí (žádné kolize, vrata na kratší pravé fasádě)", () => {
    expect(findOpeningProblems(l.dimensions, placeOpenings(l))).toEqual([]);
    const right = placeOpenings(l).filter((o) => o.facade === "right");
    for (const o of right) expect(o.centerU + o.widthM / 2).toBeLessThanOrEqual(facadeLengthM(l.dimensions, "right") + 1e-9);
  });
});

describe("půdorys L: pravidla a normalizace", () => {
  it("přepnutí na L dosadí platný výřez na mřížce pravidel a konfigurace je platná", () => {
    for (const id of ["logistics", "production", "city_logistics"]) {
      const c = lConfig(id);
      expect(c.dimensions.shape).toBe("L");
      expect((c.dimensions.notchLengthM - 12) % 6).toBe(0);
      expect(validateConfig(c, publicCatalog)).toEqual({ ok: true, issues: [] });
    }
  });

  it("příliš velký výřez se zmenší tak, aby ramena zůstala 24 m široká", () => {
    const c = normalizeConfig(patch(lConfig(), { notch_length_m: 500, notch_width_m: 500 }), publicCatalog);
    const lim = notchLimits(c.dimensions);
    expect(c.dimensions.notchLengthM).toBeLessThanOrEqual(lim.maxLengthM);
    expect(c.dimensions.notchWidthM).toBeLessThanOrEqual(lim.maxWidthM);
    expect(validateConfig(c, publicCatalog).ok).toBe(true);
  });

  it("příliš malá hala se na L nepřepne (zůstane obdélník)", () => {
    const small = patch(configFor("city_logistics"), { length_m: 36, width_m: 24 });
    const c = normalizeConfig(patch(small, { shape: "L" }), publicCatalog);
    expect(c.dimensions.shape).toBe("rect");
    expect(c.dimensions.notchLengthM).toBe(0);
  });

  it("validace odmítne neplatný výřez i výřez u obdélníku", () => {
    const bad = patch(lConfig(), { notch_length_m: 500 });
    expect(validateConfig(bad, publicCatalog).issues.map((i) => i.code)).toContain("notch");
    const rectWithNotch = patch(configFor(), { notch_length_m: 12, notch_width_m: 12 });
    expect(validateConfig(rectWithNotch, publicCatalog).issues.map((i) => i.code)).toContain("notch");
  });

  it("zmenšení haly zmenší výřez; počet vrat omezuje kratší fasáda; administrativa se vejde vedle výřezu", () => {
    const c = normalizeConfig(patch(lConfig(), { length_m: 90, width_m: 48 }), publicCatalog);
    expect(c.dimensions.notchLengthM).toBeLessThanOrEqual(90 - 24);
    expect(c.openings.driveInCount).toBeLessThanOrEqual(maxDriveInCount(c.dimensions));
    const lim = officeAreaLimits(c.dimensions, c.office.floors);
    expect(c.office.areaM2).toBeLessThanOrEqual(lim.maxM2);
    expect(validateConfig(c, publicCatalog).ok).toBe(true);
  });

  it("návrat na obdélník vynuluje výřez", () => {
    const c = normalizeConfig(patch(lConfig(), { shape: "rect" }), publicCatalog);
    expect(c.dimensions).toMatchObject({ shape: "rect", notchLengthM: 0, notchWidthM: 0 });
  });
});
