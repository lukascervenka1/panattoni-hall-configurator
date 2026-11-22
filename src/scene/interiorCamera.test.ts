import { describe, expect, it } from "vitest";
import { presetPose } from "./camera";
import { officeLayout, pointInFootprint } from "@/configurator/calculations/layout";
import { configFor, patch } from "@/tests/helpers";

describe("interior camera", () => {
  for (const product of ["logistics", "production", "city_logistics"] as const) {
    it(`keeps camera and viewing segment in the hall, outside the L courtyard and office (${product})`, () => {
      const base = configFor(product);
      const cases = [base, patch(base, { shape: "L", length_m: 174, width_m: 84, notch_length_m: 48, notch_width_m: 36 }), patch(base, { shape: "L", length_m: 72, width_m: 60, notch_length_m: 48, notch_width_m: 36 })];
      for (const config of cases) {
        const pose = presetPose("interior", config, 1.6);
        const office = officeLayout(config);
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const x = pose.position[0] + (pose.target[0] - pose.position[0]) * t;
          const z = pose.position[2] + (pose.target[2] - pose.position[2]) * t;
          expect(pointInFootprint(config.dimensions, x, z)).toBe(true);
          if (office) expect(x >= office.x0 && x <= office.x1 && z >= office.z0 && z <= office.z1).toBe(false);
        }
      }
    });
  }
});
