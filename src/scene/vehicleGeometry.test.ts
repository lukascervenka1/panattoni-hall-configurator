import { describe, expect, it } from "vitest";
import { buildParts, disposeParts } from "./vehicleGeometry";
import { VEHICLE_BODY } from "./trafficWorld";

// Traffic collision envelopes must remain valid when a visual model gains mirrors, bumpers and a longer cabin.
describe("uvěřitelné modely vozidel", () => {
  it.each(["car", "van", "truck"] as const)("%s: celá karoserie včetně detailů zůstává uvnitř řízeného kolizního obalu", (kind) => {
    const parts = buildParts(kind);
    const envelope = VEHICLE_BODY[kind];
    let triangles = 0;
    for (const geometry of Object.values(parts)) {
      if (!geometry) continue;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThanOrEqual(envelope.halfWidth + 1e-5);
      expect(Math.max(Math.abs(box.min.z), Math.abs(box.max.z))).toBeLessThanOrEqual(envelope.halfLength + 1e-5);
      expect(box.min.y).toBeGreaterThanOrEqual(-0.001);
      for (const n of geometry.getAttribute("position").array) expect(Number.isFinite(n)).toBe(true);
      triangles += (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
    }
    // A fleet remains light enough for instancing; no imported, very dense car meshes.
    expect(triangles).toBeLessThan(18000);
    expect(parts.cabin).not.toBeNull();
    expect(parts.metal).toBeDefined();
    disposeParts(parts);
  });
});
