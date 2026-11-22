import { describe, expect, it } from "vitest";
import { COLUMN_EDGE_INSET_M, columnFrame, findOpeningProblems, placeOpenings } from "./layout";
import { DEMO_GEOMETRY as G } from "./constants";
import { configFor, patch } from "@/tests/helpers";

const CONFIGS = [
  configFor("logistics"),
  configFor("production"),
  configFor("city_logistics"),
  patch(configFor("logistics"), { length_m: 300, width_m: 150, clear_height_m: 14, office_area_m2: 1500 }),
  patch(configFor("logistics"), { length_m: 96, width_m: 60, office_area_m2: 900 }),
  patch(configFor("logistics"), { length_m: 120, width_m: 72, office_area_m2: 1200, office_floors: 2, clear_height_m: 12 }),
];

describe("okna administrativy a sloupy", () => {
  it("krajní sloupy leží uvnitř obvodové stěny, ne v její rovině", () => {
    for (const c of CONFIGS) {
      const { lengthM: L, widthM: W } = c.dimensions;
      const f = columnFrame(c.dimensions);
      expect(f.xs[0]).toBeCloseTo(-L / 2 + COLUMN_EDGE_INSET_M);
      expect(f.xs.at(-1)).toBeCloseTo(L / 2 - COLUMN_EDGE_INSET_M);
      expect(f.zs[0]).toBeCloseTo(-W / 2 + COLUMN_EDGE_INSET_M);
      expect(f.zs.at(-1)).toBeCloseTo(W / 2 - COLUMN_EDGE_INSET_M);
      // sloup 0,6 m a konzola 0,95 m se vejdou za líc stěny
      expect(COLUMN_EDGE_INSET_M - G.wallThicknessM).toBeGreaterThanOrEqual(0.475);
    }
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: žádné okno není před sloupem ani přes jiné okno", (_i, c) => {
    const { lengthM: L, widthM: W } = c.dimensions;
    const frame = columnFrame(c.dimensions);
    const windows = placeOpenings(c).filter((o) => o.kind === "window");
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      const cols = w.facade === "front" ? frame.xs.map((x) => x + L / 2) : frame.zs.map((z) => z + W / 2);
      for (const u of cols) expect(Math.abs(w.centerU - u)).toBeGreaterThanOrEqual(w.widthM / 2 + 0.3 - 1e-9);
    }
    expect(findOpeningProblems(c.dimensions, placeOpenings(c))).toEqual([]);
  });

  it("počet a plocha oken se posunem nemění (vstupují do ceny)", () => {
    for (const c of CONFIGS) {
      const office = c.office;
      const windows = placeOpenings(c).filter((o) => o.kind === "window");
      const perFloorFront = Math.floor(office.areaM2 / office.floors / G.office.depthM / G.window.pitchM);
      const perFloorSide = Math.floor(G.office.depthM / G.window.pitchM);
      expect(windows.length).toBe((perFloorFront + perFloorSide) * office.floors);
    }
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: vstup do administrativy stojí za jejím koncem, mimo okna a sloupy", (_i, c) => {
    const { lengthM: L } = c.dimensions;
    const frame = columnFrame(c.dimensions);
    const placed = placeOpenings(c);
    const entrance = placed.filter((o) => o.kind === "entrance");
    expect(entrance.length).toBeLessThanOrEqual(1);
    if (!c.office.enabled) {
      expect(entrance).toEqual([]);
      return;
    }
    expect(entrance.length).toBe(1);
    const e = entrance[0]!;
    expect(e.facade).toBe("front");
    expect(e.sillM).toBe(0);
    for (const w of placed.filter((o) => o.kind === "window" && o.facade === "front")) {
      expect(Math.abs(w.centerU - e.centerU)).toBeGreaterThanOrEqual((w.widthM + e.widthM) / 2);
    }
    for (const x of frame.xs) expect(Math.abs(e.centerU - (x + L / 2))).toBeGreaterThanOrEqual(e.widthM / 2 + 0.3 - 1e-9);
    expect(findOpeningProblems(c.dimensions, placed)).toEqual([]);
  });
});
