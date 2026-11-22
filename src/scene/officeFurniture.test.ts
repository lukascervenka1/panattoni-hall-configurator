import { describe, expect, it } from "vitest";
import { configFor, patch } from "@/tests/helpers";
import { officeLayout } from "@/configurator/calculations/layout";
import { DEMO_GEOMETRY as G } from "@/configurator/calculations/constants";
import { layoutOfficePartitions } from "./layout";
import { layoutOfficeFurniture, officeRoomEdges } from "./officeFurniture";
import { buildOffice } from "./geometry";

describe("illustrative office rooms", () => {
  const configs = [
    patch(configFor("production"), { office_area_m2: 72, office_floors: 1 }),
    patch(configFor("production"), { office_area_m2: 120, office_floors: 1 }),
    patch(configFor("logistics"), { office_area_m2: 600, office_floors: 2 }),
    patch(configFor("logistics"), { length_m: 300, width_m: 150, office_area_m2: 2880, office_floors: 2 }),
    patch(configFor("logistics"), { office_area_m2: 900, office_floors: 3, clear_height_m: 11 }),
  ];

  it.each(configs.map((c, i) => [i, c] as const))("furniture stays in its room, above the floor and clear of the corridor #%i", (_, c) => {
    const o = officeLayout(c)!;
    const furniture = layoutOfficeFurniture(c);
    const edges = officeRoomEdges(c);
    expect(furniture.screen.length).toBeGreaterThan(0);
    expect(furniture.upholstery.length).toBeGreaterThan(0);
    const partitions = layoutOfficePartitions(c);
    for (const item of Object.values(furniture).flat()) {
      const dx = (item.sx ?? 1) / 2, dy = (item.sy ?? 1) / 2, dz = (item.sz ?? 1) / 2;
      const f = Math.floor(item.y / G.office.floorHeightM);
      const floor = f === 0 ? 0.12 : f * G.office.floorHeightM;
      expect(f).toBeLessThan(o.floors);
      expect(item.y - dy).toBeGreaterThanOrEqual(floor - 1e-8);
      expect(item.y + dy).toBeLessThan((f + 1) * G.office.floorHeightM - 0.3);
      expect(item.x - dx).toBeGreaterThanOrEqual(o.x0 + 0.2);
      expect(item.x + dx).toBeLessThanOrEqual(o.x1 - 0.2);
      expect(item.z - dz).toBeGreaterThan(o.z0 + 3.4 + 0.06);
      expect(item.z + dz).toBeLessThan(o.z1 - 0.2);
      for (const edge of edges.slice(1, -1)) {
        expect(item.x + dx < edge - 0.06 || item.x - dx > edge + 0.06).toBe(true);
      }
    }
    // Every room has a 1.1 m entrance opening connected to the same rear corridor.
    for (let r = 0; r < edges.length - 1; r++) {
      const door = edges[r + 1]! - 1.3;
      const walls = partitions.filter((p) => p.axis === "x");
      expect(walls.some((p) => door > p.x - p.lengthM / 2 && door < p.x + p.lengthM / 2)).toBe(false);
    }
    expect(layoutOfficeFurniture(structuredClone(c))).toEqual(furniture);
  });

  it("places equipment on both floors and separates the removable top ceiling", () => {
    const c = configs[2]!;
    const furniture = layoutOfficeFurniture(c);
    expect(furniture.screen.some((v) => v.y < 3.5)).toBe(true);
    expect(furniture.screen.some((v) => v.y > 3.5)).toBe(true);
    const office = buildOffice(c)!;
    office.ceiling.computeBoundingBox();
    office.slabs.computeBoundingBox();
    expect(office.slabs.boundingBox!.max.y).toBeCloseTo(3.5);
    expect(office.ceiling.boundingBox!.max.y).toBeCloseTo(7);
    Object.values(office).forEach((g) => g?.dispose());
  });

  it("removes the furnishing together with the office", () => {
    const c = patch(configFor(), { office_enabled: false });
    expect(Object.values(layoutOfficeFurniture(c)).flat()).toEqual([]);
    expect(officeRoomEdges(c)).toEqual([]);
  });

  it("builds the third floor with its slab, furniture, partitions and a separate ceiling", () => {
    const c = configs[4]!;
    const office = buildOffice(c)!;
    try {
      office.slabs.computeBoundingBox();
      office.ceiling.computeBoundingBox();
      office.walls!.computeBoundingBox();
      expect(office.slabs.boundingBox!.max.y).toBeCloseTo(7);
      expect(office.ceiling.boundingBox!.max.y).toBeCloseTo(10.5);
      expect(office.walls!.boundingBox!.max.y).toBeCloseTo(10.5);
      const floors = new Set(layoutOfficeFurniture(c).screen.map((v) => Math.floor(v.y / G.office.floorHeightM)));
      expect(floors).toEqual(new Set([0, 1, 2]));
      expect(layoutOfficePartitions(c).some((p) => p.y0 >= 7)).toBe(true);
    } finally {
      Object.values(office).forEach((g) => g?.dispose());
    }
  });
});
