import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildRoof } from "./geometry";
import { layoutSkylights } from "./layout";
import { configFor, patch } from "@/tests/helpers";

describe("roof apertures", () => {
  it.each(["rect", "L"] as const)("leaves a real opening through both roof layers for every skylight (%s)", (shape) => {
    const config = patch(configFor(), { shape, notch_length_m: shape === "L" ? 24 : 0, notch_width_m: shape === "L" ? 18 : 0 });
    const skylights = layoutSkylights(config);
    const roof = buildRoof(config.dimensions, 1.5, skylights);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const meshes = [roof.slab, roof.surface].map((geometry) => new THREE.Mesh(geometry, material));
    const ray = new THREE.Raycaster();
    const hits = (x: number, z: number) => {
      ray.set(new THREE.Vector3(x, config.dimensions.clearHeightM + 10, z), new THREE.Vector3(0, -1, 0));
      return ray.intersectObjects(meshes).length;
    };
    expect(skylights.length).toBeGreaterThan(0);
    for (const skylight of skylights) expect(hits(skylight.x, skylight.z)).toBe(0);
    expect(hits(-config.dimensions.lengthM / 2 + 1, -config.dimensions.widthM / 2 + 1)).toBeGreaterThan(0);
    Object.values(roof).forEach((geometry) => geometry.dispose());
    material.dispose();
  });
});
