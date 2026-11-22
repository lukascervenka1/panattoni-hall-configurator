import { describe, expect, it } from "vitest";
import { displayConfig, isSettled, stepSceneValues, stepValues, valuesOf } from "./build";
import { findOpeningProblems, officeLayout, placeOpenings } from "@/configurator/calculations/layout";
import { configFor, patch } from "@/tests/helpers";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

describe("scene updates without intermediate topology", () => {
  it("rebuilds dimensions only once while retaining sequential openings", () => {
    const from = configFor("city_logistics");
    const target = patch(configFor("logistics"), { length_m: 300, width_m: 150, dock_count: 31 });
    const goal = valuesOf(target);
    let current = valuesOf(from);
    const dimensions = new Set<string>();
    const docks = new Set<number>();
    for (let frame = 0; frame < 300; frame++) {
      current = stepSceneValues(current, goal, 1 / 60);
      const shown = displayConfig(target, current);
      dimensions.add(JSON.stringify(shown.dimensions));
      docks.add(shown.openings.dockCount);
      expect(findOpeningProblems(shown.dimensions, placeOpenings(shown))).toEqual([]);
    }
    expect(dimensions.size).toBe(1);
    expect(isSettled(current, goal)).toBe(true);
    expect(docks.size).toBeGreaterThan(5);
  });
});

describe("růst haly: zobrazená konfigurace je vždy platná", () => {
  it("mezihodnoty mezi koncepty nevyrobí překrývající se otvory ani administrativu mimo halu", () => {
    const pairs = [
      [configFor("city_logistics"), configFor("logistics")],
      [configFor("logistics"), configFor("city_logistics")],
      [configFor("production"), configFor("logistics")],
      [patch(configFor(), { length_m: 300, width_m: 150, dock_count: 31 }), configFor("city_logistics")],
    ] as const;
    for (const [from, to] of pairs) {
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const v = {
          lengthM: lerp(from.dimensions.lengthM, to.dimensions.lengthM, t),
          widthM: lerp(from.dimensions.widthM, to.dimensions.widthM, t),
          clearHeightM: lerp(from.dimensions.clearHeightM, to.dimensions.clearHeightM, t),
          notchL: lerp(from.dimensions.notchLengthM, to.dimensions.notchLengthM, t),
          notchW: lerp(from.dimensions.notchWidthM, to.dimensions.notchWidthM, t),
          dock: lerp(from.openings.dockCount, to.openings.dockCount, t),
          driveIn: lerp(from.openings.driveInCount, to.openings.driveInCount, t),
          officeArea: lerp(from.office.areaM2, to.office.areaM2, t),
        };
        const shown = displayConfig(to, v);
        expect(findOpeningProblems(shown.dimensions, placeOpenings(shown))).toEqual([]);
        const o = officeLayout(shown);
        if (o) {
          expect(o.x1).toBeLessThanOrEqual(shown.dimensions.lengthM / 2 + 1e-6);
          expect(o.z0).toBeGreaterThanOrEqual(-shown.dimensions.widthM / 2);
          expect(o.heightM + 0.5).toBeLessThanOrEqual(shown.dimensions.clearHeightM + 1e-6);
        }
      }
    }
  });

  it("doběh dosáhne cíle a doky přibývají po jednom", () => {
    const from = patch(configFor(), { dock_count: 2 });
    const to = patch(configFor(), { length_m: 210, dock_count: 12 });
    let cur = valuesOf(from);
    const tgt = valuesOf(to);
    const seen = new Set<number>();
    let steps = 0;
    while (!isSettled(cur, tgt) && steps < 600) {
      cur = stepValues(cur, tgt, 1 / 60);
      seen.add(displayConfig(to, cur).openings.dockCount);
      steps++;
    }
    expect(isSettled(cur, tgt)).toBe(true);
    expect(steps).toBeLessThan(300); // do pěti sekund
    expect([...seen].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((n) => seen.has(n)));
    expect(seen.size).toBeGreaterThan(5);
  });

  it("zmenšování je monotónní (nepřestřelí cíl)", () => {
    let cur = valuesOf(configFor());
    const tgt = valuesOf(patch(configFor(), { length_m: 90 }));
    let prev = cur.lengthM;
    for (let i = 0; i < 400; i++) {
      cur = stepValues(cur, tgt, 1 / 60);
      expect(cur.lengthM).toBeLessThanOrEqual(prev + 1e-9);
      expect(cur.lengthM).toBeGreaterThanOrEqual(90 - 1e-9);
      prev = cur.lengthM;
    }
  });
});
