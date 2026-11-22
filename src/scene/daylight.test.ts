import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { configFor, patch } from "@/tests/helpers";
import { placeOpenings } from "@/configurator/calculations/layout";
import { buildOffice, buildRoof, buildRoofDetails, buildShell, facadeMatrix } from "./geometry";
import { layoutSkylights } from "./layout";

describe("geometrie podlaží a prosvětlení", () => {
  it.each(["rect", "L"] as const)("kombinace zachová skutečné otvory ve střeše i ve fasádách (%s)", (shape) => {
    const config = patch(configFor(), { shape, notch_length_m: 24, notch_width_m: 18, daylight: "both" });
    const panels = layoutSkylights(config);
    const shell = buildShell(config, { omitOpeningDetails: true });
    const roof = buildRoof(config.dimensions, 1.5, panels);
    const details = buildRoofDetails(config);
    expect(panels.length).toBeGreaterThan(0);
    expect(details.domes).not.toBeNull();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const ray = new THREE.Raycaster();
    const walls = new THREE.Mesh(shell.walls, material);
    ray.far = 5;
    for (const w of placeOpenings(config).filter((o) => o.kind === "hallWindow")) {
      const matrix = facadeMatrix(config.dimensions, w.facade);
      ray.set(new THREE.Vector3(w.centerU, w.sillM + w.heightM / 2, 3).applyMatrix4(matrix), new THREE.Vector3(0, 0, -1).transformDirection(matrix));
      expect(ray.intersectObject(walls)).toHaveLength(0);
    }
    const roofMesh = new THREE.Mesh(roof.slab, material);
    for (const p of panels) {
      ray.set(new THREE.Vector3(p.x, config.dimensions.clearHeightM + 3, p.z), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(roofMesh)).toHaveLength(0);
    }
    for (const g of [shell, roof, details]) Object.values(g).forEach((part) => part?.dispose());
    material.dispose();
  });

  it("třetí podlaží má druhou stropní desku a strop ve výšce 10,5 m", () => {
    const config = patch(configFor(), { office_floors: 3, clear_height_m: 11, office_area_m2: 900 });
    const geometry = buildOffice(config)!;
    geometry.slabs.computeBoundingBox();
    geometry.ceiling.computeBoundingBox();
    expect(geometry.slabs.boundingBox!.max.y).toBeCloseTo(7);
    expect(geometry.ceiling.boundingBox!.max.y).toBeCloseTo(10.5);
    Object.values(geometry).forEach((g) => g?.dispose());
  });

  it.each(["rect", "L"] as const)("fasádní varianta má skutečné otvory ve všech stěnách a celistvou střechu (%s)", (shape) => {
    const config = patch(configFor(), { shape, notch_length_m: 24, notch_width_m: 18, daylight: "facade" });
    const shell = buildShell(config, { omitOpeningDetails: true });
    const roof = buildRoof(config.dimensions, 1.5, layoutSkylights(config));
    const details = buildRoofDetails(config);
    expect(details.domes).toBeNull();
    expect(details.curbs).toBeNull();
    expect(shell.glass).not.toBeNull();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const walls = new THREE.Mesh(shell.walls, material);
    const ray = new THREE.Raycaster();
    ray.far = 5;
    for (const w of placeOpenings(config).filter((o) => o.kind === "hallWindow")) {
      const matrix = facadeMatrix(config.dimensions, w.facade);
      const origin = new THREE.Vector3(w.centerU, w.sillM + w.heightM / 2, 3).applyMatrix4(matrix);
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(matrix);
      ray.set(origin, direction);
      expect(ray.intersectObject(walls)).toHaveLength(0);
    }
    ray.far = Infinity;
    ray.set(new THREE.Vector3(0, config.dimensions.clearHeightM + 10, 0), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(new THREE.Mesh(roof.slab, material)).length).toBeGreaterThan(0);
    for (const value of [shell, roof, details]) Object.values(value).forEach((g) => g?.dispose());
    material.dispose();
  });
});
