import { describe, expect, it } from "vitest";
import { configFor, patch } from "@/tests/helpers";
import { layoutSurroundings } from "./layout";
import { TrafficWorld, bodiesOverlap } from "./trafficWorld";
import { gateCycle } from "./service";

const configs = [
  configFor("logistics"), configFor("production"), configFor("city_logistics"),
  patch(configFor("logistics"), { length_m: 300, width_m: 150, dock_count: 31, drive_in_count: 4 }),
  patch(configFor("city_logistics"), { length_m: 36, width_m: 24, dock_count: 2, drive_in_count: 3 }),
  patch(configFor("production"), { shape: "L", notch_length_m: 36, notch_width_m: 24, dock_count: 6, drive_in_count: 3 }),
];

describe("společné řízení dopravy", () => {
  it("hlídá i vybočené rohy diagonálně natočené karoserie", () => {
    const a = { x: 0, z: 0, rotY: Math.atan2(2.32, 1.03), kind: "car" as const, visible: true, moving: true };
    expect(bodiesOverlap(a, { ...a, x: 4.9 }, 0)).toBe(true);
    expect(bodiesOverlap(a, { ...a, x: 6 }, 0)).toBe(false);
  });

  it("pozastavení ani opakované přehrání nenechají rozjeté staré hodiny", () => {
    const config = configs[0]!;
    const world = new TrafficWorld(config, layoutSurroundings(config), false, true);
    const initial = world.agents.map((a) => ({ ...a.pose }));
    for (let i = 0; i < 500; i++) world.step(0.1);
    const paused = world.agents.map((a) => ({ ...a.pose }));
    world.step(0);
    expect(world.agents.map((a) => a.pose)).toEqual(paused);
    world.reset();
    expect(world.agents.map((a) => a.pose)).toEqual(initial);
    expect(world.agents.every((a) => a.travelled === 0)).toBe(true);
  });

  it.each(configs.flatMap((c, i) => [true, false].map((minimalist) => [i, minimalist, c] as const)))("#%i minimalist=%s: auta, kamiony a dodávky se nepřekrývají, ani s odstavenými auty", (_i, minimalist, config) => {
    const world = new TrafficWorld(config, layoutSurroundings(config), true, minimalist);
    const previous = new Map<string, ReturnType<TrafficWorld["pose"]>>();
    for (let step = 0; step < 3600; step++) {
      world.step(1 / 20);
      const bodies = world.agents.filter((a) => a.pose.visible).map((a) => ({ ...a.pose, kind: a.kind, key: a.key }));
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i]!;
        for (const b of bodies.slice(i + 1)) {
          if (bodiesOverlap(a, b, 0)) throw new Error(`collision ${a.key}/${b.key} at ${(step / 20).toFixed(2)}s`);
        }
        for (const b of world.stationary) {
          if (bodiesOverlap(a, b, 0)) throw new Error(`parked collision ${a.key} at ${(step / 20).toFixed(2)}s`);
        }
        const before = previous.get(a.key);
        if (before?.visible) expect(Math.hypot(a.x - before.x, a.z - before.z)).toBeLessThan(2.5);
      }
      for (const a of world.agents) previous.set(a.key, { ...a.pose });
      for (const op of world.operations) {
        const p = world.pose(`gate-${op.id}`);
        if (p.visible && Math.abs(p.x - config.dimensions.lengthM / 2) < 2.5) {
          expect(gateCycle(world.time(`gate-${op.id}`), Number(op.id.split("-").at(-1)) - 1).open).toBe(1);
        }
      }
    }
    const moved = world.agents.filter((a) => a.travelled > 20);
    expect(moved.some((a) => a.category === "through")).toBe(true);
    expect(moved.some((a) => a.category === "dock")).toBe(true);
    if (world.operations.length) expect(moved.some((a) => a.category === "gate")).toBe(true);
    if (world.vehicles.some((v) => v.mode === "parker")) expect(moved.some((a) => a.category === "parking")).toBe(true);
  }, 20000);

  it.each([true, false])("po delším provozu pokračují všechny skupiny, fronta nezamrzne (minimalist=%s)", (minimalist) => {
    const config = patch(configFor("production"), { drive_in_count: 3, dock_count: 6 });
    const world = new TrafficWorld(config, layoutSurroundings(config), false, minimalist);
    for (let i = 0; i < 4000; i++) world.step(0.1);
    const before = new Map(world.agents.map((a) => [a.key, a.travelled]));
    for (let i = 0; i < 4000; i++) world.step(0.1);
    const moved = world.agents.filter((a) => a.travelled - before.get(a.key)! > 10);

    for (const category of ["through", "parking", "dock", "gate"] as const) expect(moved.some((a) => a.category === category), category).toBe(true);
    for (const a of world.agents.filter((a) => a.category === "gate" || a.category === "parking")) expect(a.travelled, a.key).toBeGreaterThan(20);
  }, 20000);
});
