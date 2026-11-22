import { describe, expect, it } from "vitest";
import { configFor, patch } from "@/tests/helpers";
import { buildServiceOperations, gateCycle, servicePose } from "./service";
// Kamiony u doků: viz dockTrucks.test.ts.

describe("illustrative loading and gate operations", () => {
  it("removes service vehicles when openings are removed", () => {
    expect(buildServiceOperations(patch(configFor(), { dock_count: 0, drive_in_count: 0 }), false)).toEqual([]);
  });

  it.each(["rect", "L"] as const)("vehicles cross the %s hall wall only through a fully open gate", (shape) => {
    const config = patch(configFor(), { shape, drive_in_count: 3 });
    const vans = buildServiceOperations(config, false).filter((o) => o.kind === "van");
    expect(vans.length).toBeGreaterThan(0);
    for (const van of vans) {
      const index = Number(van.id.split("-").at(-1)) - 1;
      let entered = false;
      let exited = false;
      for (let t = 0; t < 56; t += 0.05) {
        const pose = servicePose(van, t);
        expect([pose.x, pose.z, pose.rotY].every(Number.isFinite)).toBe(true);
        if (Math.abs(pose.x - config.dimensions.lengthM / 2) < 2.5) {
          expect(gateCycle(t, index).open).toBe(1);
          expect(pose.z).toBeCloseTo(van.z);
        }
        if (pose.x < config.dimensions.lengthM / 2 - 3) entered = true;
        if (entered && pose.x > config.dimensions.lengthM / 2 + 3) exited = true;
      }
      expect(entered && exited).toBe(true);
    }
  });
});
