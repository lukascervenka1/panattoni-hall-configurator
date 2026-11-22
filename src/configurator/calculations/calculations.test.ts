import { describe, expect, it } from "vitest";
import { computeQuantities } from "./quantities";
import {
  columnGrid,
  findOpeningProblems,
  maxDockCount,
  maxDriveInCount,
  maxOfficeFloors,
  officeAreaLimits,
  officeLayout,
  placeOpenings,
  totalHeightM,
} from "./layout";
import { configFor, patch } from "@/tests/helpers";

describe("množství pro přednastavenou logistickou halu (ruční výpočet)", () => {
  // L=150, W=84, světlá 10 m → celková 12 m; 14 doků, 2 vjezdová vrata, administrativa 600 m² na 1 podlaží.
  const q = computeQuantities(configFor("logistics"));

  it("zastavěná plocha, obvod a výšky", () => {
    expect(q.footprintAreaM2).toBe(12_600);
    expect(q.perimeterM).toBe(468);
    expect(q.totalHeightM).toBe(12);
    expect(totalHeightM(10)).toBe(12);
  });

  it("administrativa se nezapočítá podruhé do zastavěné plochy", () => {
    expect(q.officeFootprintM2).toBe(600);
    expect(q.officeFloorAreaM2).toBe(600);
    expect(q.hallGroundAreaM2).toBe(12_000);
    expect(q.totalFloorAreaM2).toBe(12_600); // jedno podlaží administrativy = žádná plocha navíc
  });

  it("okna: 16 na přední a 4 na boční fasádě, 1,5 × 1,5 m", () => {
    expect(q.windowCount).toBe(20);
    expect(q.windowAreaM2).toBe(45);
  });

  it("čistá plocha fasády = hrubá − vrata − okna (každý otvor jednou)", () => {
    expect(q.grossFacadeAreaM2).toBe(5_616);
    expect(q.openingsAreaM2).toBe(14 * 9 + 2 * 20 + 45);
    expect(q.netFacadeAreaM2).toBe(5_616 - 211);
    expect(q.openingCount).toBe(14 + 2 + 20);
  });

  it("světlíky: 5 % v zóně doků 24 m, jinde 2 %; střecha je bez světlíků", () => {
    expect(q.skylightAreaM2).toBe(360);
    expect(q.roofAreaM2).toBe(12_240);
  });
});

describe("administrativa", () => {
  it("dvě podlaží přidají plochu nad přízemím, zastavěná plocha zůstane stejná", () => {
    const q = computeQuantities(configFor("production")); // 800 m², 2 podlaží
    expect(q.officeFootprintM2).toBe(400);
    expect(q.officeFloorAreaM2).toBe(800);
    expect(q.footprintAreaM2).toBe(96 * 60);
    expect(q.totalFloorAreaM2).toBe(96 * 60 + 400);
    expect(q.windowCount).toBe(2 * (Math.floor(400 / 12 / 3) + 4));
  });

  it("vypnutá administrativa nemá okna ani plochu", () => {
    const q = computeQuantities(patch(configFor(), { office_enabled: false }));
    expect(q.windowCount).toBe(0);
    expect(q.officeFloorAreaM2).toBe(0);
  });

  it("limit výšky: dvě podlaží se vejdou až od světlé výšky 7,5 m", () => {
    expect(maxOfficeFloors(7.4)).toBe(1);
    expect(maxOfficeFloors(7.5)).toBe(2);
    expect(maxOfficeFloors(3.9)).toBe(0);
    expect(maxOfficeFloors(4)).toBe(1);
  });

  it("administrativa se musí vejít do haly (podíl délky a zbývající hloubka)", () => {
    const lim = officeAreaLimits({ lengthM: 100, widthM: 60, clearHeightM: 10 }, 1);
    expect(lim.maxM2).toBe(0.4 * 100 * 12);
    expect(officeAreaLimits({ lengthM: 100, widthM: 20, clearHeightM: 10 }, 1).maxM2).toBe(0); // 20 − 12 < 12
  });

  it("vrací null, když není zapnutá", () => {
    expect(officeLayout(patch(configFor(), { office_enabled: false }))).toBeNull();
  });
});

describe("rozmístění otvorů", () => {
  it("kapacita fasády se odvozuje z její délky", () => {
    expect(maxDockCount({ lengthM: 150, widthM: 84, clearHeightM: 10 })).toBe(31);
    expect(maxDockCount({ lengthM: 36, widthM: 24, clearHeightM: 8 })).toBe(5);
    expect(maxDockCount({ lengthM: 10, widthM: 24, clearHeightM: 8 })).toBe(0);
    expect(maxDriveInCount({ lengthM: 72, widthM: 24, clearHeightM: 8 })).toBe(2);
  });

  it("předvolená konfigurace nemá žádné kolize ani přesahy", () => {
    for (const id of ["logistics", "production", "city_logistics"]) {
      const c = configFor(id);
      expect(findOpeningProblems(c.dimensions, placeOpenings(c))).toEqual([]);
    }
  });

  it("maximální počet doků se vejde bez kolizí", () => {
    const c = configFor();
    const max = maxDockCount(c.dimensions);
    const full = patch(c, { dock_count: max });
    expect(findOpeningProblems(full.dimensions, placeOpenings(full))).toEqual([]);
  });

  it("detekuje překryv otvorů na stejné fasádě", () => {
    const c = configFor();
    const [a] = placeOpenings(patch(c, { dock_count: 1 }));
    const dup = { ...a!, id: "dock-x", centerU: a!.centerU + 1 };
    const problems = findOpeningProblems(c.dimensions, [a!, dup]);
    expect(problems).toEqual([{ a: "dock-1", b: "dock-x", reason: "collision" }]);
  });

  it("okna v různých podlažích spolu nekolidují", () => {
    const c = configFor("production");
    expect(findOpeningProblems(c.dimensions, placeOpenings(c))).toEqual([]);
  });

  it("detekuje otvor přesahující fasádu", () => {
    const c = configFor();
    const [a] = placeOpenings(patch(c, { dock_count: 1 }));
    const bad = { ...a!, centerU: 0.5 };
    expect(findOpeningProblems(c.dimensions, [bad]).map((p) => p.reason)).toContain("outside_facade");
  });

  it("změna délky haly mění počet segmentů, ne rozměr otvorů", () => {
    const small = placeOpenings(patch(configFor(), { length_m: 96 }));
    const large = placeOpenings(patch(configFor(), { length_m: 240 }));
    const sizes = (list: ReturnType<typeof placeOpenings>) => new Set(list.map((o) => `${o.kind}:${o.widthM}x${o.heightM}`));
    expect(sizes(small)).toEqual(sizes(large));
    expect(large.filter((o) => o.kind === "dock")).toHaveLength(small.filter((o) => o.kind === "dock").length);
  });

  it("rastr sloupů přidává sloupy při větší hale místo roztahování", () => {
    const a = columnGrid({ lengthM: 72, widthM: 36, clearHeightM: 8 });
    const b = columnGrid({ lengthM: 144, widthM: 72, clearHeightM: 8 });
    expect(b.xs.length).toBeGreaterThan(a.xs.length);
    expect(b.zs.length).toBeGreaterThan(a.zs.length);
    expect(Math.max(...b.zs.slice(1).map((z, i) => z - b.zs[i]!))).toBeLessThanOrEqual(24);
  });
});

describe("stabilita výpočtu", () => {
  it("stejná konfigurace dává identické výsledky", () => {
    const c = configFor();
    expect(computeQuantities(c)).toEqual(computeQuantities(structuredClone(c)));
  });

  it("neplatné rozmístění nevyrobí zavádějící množství", () => {
    const c = patch(configFor(), { length_m: 36, dock_count: 40 }); // doky se nevejdou
    // 40 doků na 36 m: roztáhnou se na rozteč 0 a překryjí se
    expect(() => computeQuantities(c)).toThrow();
  });
});
