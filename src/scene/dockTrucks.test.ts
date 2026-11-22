import { describe, expect, it } from "vitest";
import { DOCK_TRUCK, buildDockTrucks, dockTruckCycle, dockTruckPose } from "./dockTrucks";
import { buildingRect, layoutSurroundings, rectContains } from "./layout";
import { configFor, patch } from "@/tests/helpers";

const CONFIGS = [
  configFor("logistics"),
  configFor("production"),
  configFor("city_logistics"),
  patch(configFor("logistics"), { length_m: 300, width_m: 150, clear_height_m: 14, dock_count: 31 }),
  patch(configFor("logistics"), { dock_count: 3 }),
  patch(configFor("logistics"), { shape: "L", notch_length_m: 48, notch_width_m: 30 }),
];

type Pose = ReturnType<typeof dockTruckPose>;

/** Rohy otočeného obdélníku soupravy v rovině x–z. */
function corners(p: Pose): Array<[number, number]> {
  const fx = Math.sin(p.rotY);
  const fz = Math.cos(p.rotY);
  const rx = fz;
  const rz = -fx;
  const out: Array<[number, number]> = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) out.push([p.x + fx * a * DOCK_TRUCK.halfLengthM + rx * b * DOCK_TRUCK.halfWidthM, p.z + fz * a * DOCK_TRUCK.halfLengthM + rz * b * DOCK_TRUCK.halfWidthM]);
  return out;
}

/** Překrývají se dva otočené obdélníky? (věta o oddělující ose) */
function overlap(a: Pose, b: Pose): boolean {
  const axes = [a, b].flatMap((p) => [[Math.sin(p.rotY), Math.cos(p.rotY)], [Math.cos(p.rotY), -Math.sin(p.rotY)]] as Array<[number, number]>);
  const ca = corners(a);
  const cb = corners(b);
  return axes.every(([ax, az]) => {
    const pa = ca.map(([x, z]) => x * ax + z * az);
    const pb = cb.map(([x, z]) => x * ax + z * az);
    return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
  });
}

describe("kamiony u doků: příjezd, couvání, odjezd", () => {
  it("bez doků žádné kamiony", () => {
    const c = patch(configFor("logistics"), { dock_count: 0 });
    expect(buildDockTrucks(layoutSurroundings(c), c.dimensions.widthM, false)).toEqual([]);
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: zaparkovaný kamion končí zadkem u doku, i u nakládacího domu", (_i, c) => {
    for (const dockHouse of [false, true]) {
      for (const truck of buildDockTrucks(layoutSurroundings(c), c.dimensions.widthM, dockHouse)) {
        const pose = dockTruckPose(truck, 0, false);
        expect(pose.z + DOCK_TRUCK.halfLengthM).toBeLessThan(-c.dimensions.widthM / 2 - (dockHouse ? 3.4 : 0.5));
        expect(pose.rotY).toBe(Math.PI);
        expect(pose.visible).toBe(true);
      }
    }
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: kamiony nikdy nezajedou do haly ani se nesrazí a pohyb je spojitý", (_i, c) => {
    const trucks = buildDockTrucks(layoutSurroundings(c), c.dimensions.widthM, false);
    expect(trucks.length).toBeGreaterThan(0);
    const hall = buildingRect(c);
    const horizon = Math.max(...trucks.map(dockTruckCycle)) * 1.5;
    const prev: Array<Pose | null> = trucks.map(() => null);
    for (let t = 0; t < horizon; t += 0.25) {
      const poses = trucks.map((v) => dockTruckPose(v, t));
      poses.forEach((p, i) => {
        if (!p.visible) {
          prev[i] = null;
          return;
        }
        expect([p.x, p.z, p.rotY].every(Number.isFinite)).toBe(true);
        for (const [x, z] of corners(p)) expect(rectContains(hall, x, z, -0.05)).toBe(false);
        const before = prev[i];
        if (before) expect(Math.hypot(p.x - before.x, p.z - before.z)).toBeLessThan(1.05 * DOCK_TRUCK.approachSpeed * 0.25 + 1e-6);
        prev[i] = p;
      });
      for (let i = 0; i < poses.length; i++) {
        for (let j = i + 1; j < poses.length; j++) {
          if (poses[i]!.visible && poses[j]!.visible) expect(overlap(poses[i]!, poses[j]!)).toBe(false);
        }
      }
    }
  });

  it("v každém okamžiku se hýbe nejvýše jeden kamion a v cyklu jsou všechny fáze", () => {
    const c = configFor("logistics");
    const trucks = buildDockTrucks(layoutSurroundings(c), c.dimensions.widthM, false);
    expect(trucks.length).toBeGreaterThan(1);
    const seen = new Set<string>();
    for (let t = 0; t < trucks[0]!.cycle + 1; t += 0.2) {
      const poses = trucks.map((v) => dockTruckPose(v, t));
      expect(poses.filter((p) => p.moving).length).toBeLessThanOrEqual(1);
      for (const p of poses) seen.add(!p.visible ? "pryč" : p.reversing ? "couvá" : p.moving ? "jede" : "stojí");
    }
    expect([...seen].sort()).toEqual(["couvá", "jede", "pryč", "stojí"]);
  });

  it("jediný kamion přijede, odstaví se a odjede", () => {
    const c = patch(configFor("logistics"), { dock_count: 1 });
    const trucks = buildDockTrucks(layoutSurroundings(c), c.dimensions.widthM, false);
    expect(trucks).toHaveLength(1);
    const seen = new Set<string>();
    for (let t = 0; t < trucks[0]!.cycle + 1; t += 0.2) {
      const p = dockTruckPose(trucks[0]!, t);
      seen.add(!p.visible ? "pryč" : p.reversing ? "couvá" : p.moving ? "jede" : "stojí");
    }
    expect([...seen].sort()).toEqual(["couvá", "jede", "stojí"].concat(seen.has("pryč") ? ["pryč"] : []).sort());
  });

  it("na začátku stojí u doků aspoň jeden kamion a při úspoře pohybu všechny", () => {
    const c = configFor("logistics");
    const trucks = buildDockTrucks(layoutSurroundings(c), c.dimensions.widthM, false);
    expect(trucks.some((v) => dockTruckPose(v, 0).visible && !dockTruckPose(v, 0).moving)).toBe(true);
    for (const v of trucks) expect(dockTruckPose(v, 123, false)).toMatchObject({ moving: false, x: v.dockX, z: v.dockZ });
  });
});
