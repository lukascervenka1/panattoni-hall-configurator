import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { configFor, patch } from "@/tests/helpers";
import { facadeLengthM, placeOpenings, pointInFootprint } from "@/configurator/calculations/layout";
import { buildShell, facadeMatrix } from "./geometry";
import { DEMO_GEOMETRY } from "@/configurator/calculations/constants";
import { buildHallSignGeometry, layoutHallSigns, logoShapes, SIGNAGE } from "./hallSignage";
import { layoutSignLamps } from "./buildingDetails";
import { computeQuantities } from "@/configurator/calculations/quantities";

const configs = [
  configFor("logistics"), configFor("production"), configFor("city_logistics"),
  patch(configFor("city_logistics"), { length_m: 36, width_m: 24, clear_height_m: 6 }),
  patch(configFor("logistics"), { length_m: 300, width_m: 150, clear_height_m: 14, dock_count: 31, drive_in_count: 4 }),
  patch(configFor("production"), { shape: "L", notch_length_m: 36, notch_width_m: 24 }),
];

describe("plastické logo na fasádě", () => {
  it.each(configs.map((c, i) => [i, c] as const))("#%i: přední i menší boční logo mají společnou výškovou osu", (_i, config) => {
    for (const daylight of ["roof", "facade", "both"] as const) {
      const selected = { ...config, daylight };
      const signs = layoutHallSigns(selected);
      expect(signs.map((sign) => sign.facade)).toEqual(["front", "right"]);
      expect(signs[0]!.centerY).toBeCloseTo(signs[1]!.centerY, 8);
      // Ověřit i skutečné světové kotvy na obou různě orientovaných stěnách.
      const mounts = signs.map((sign) => new THREE.Vector3(sign.centerU, sign.centerY, DEMO_GEOMETRY.wallThicknessM).applyMatrix4(facadeMatrix(config.dimensions, sign.facade)));
      expect(mounts[0]!.y).toBeCloseTo(mounts[1]!.y, 8);
    }
  });

  it.each(configs.map((c, i) => [i, c] as const))("#%i: přední logo končí u kraje fasády stejně jako boční začíná u rohu", (_i, config) => {
    for (const sign of layoutHallSigns(config)) {
      const length = facadeLengthM(config.dimensions, sign.facade);
      const edge = sign.facade === "front" ? length - sign.centerU - sign.widthM / 2 : sign.centerU - sign.widthM / 2;
      expect(edge).toBeCloseTo(Math.min(3, length * 0.08), 5);
    }
  });

  it.each(configs.map((c, i) => [i, c] as const))("#%i: fasádní a kombinované prosvětlení zachovají polohu i velikost loga", (_i, config) => {
    const roof = { ...config, daylight: "roof" as const };
    const baseline = layoutHallSigns(roof);
    expect(baseline.length).toBeGreaterThan(0);
    for (const daylight of ["facade", "both"] as const) {
      const selected = { ...config, daylight };
      expect(layoutHallSigns(selected)).toEqual(baseline);
      const windows = placeOpenings(selected).filter((o) => o.kind === "hallWindow");
      expect(windows.length).toBeGreaterThan(0);
      for (const window of windows) for (const sign of baseline) {
        if (sign.facade !== window.facade) continue;
        const pad = DEMO_GEOMETRY.facadeSign.windowClearanceM;
        const overlaps = Math.abs(sign.centerU - window.centerU) < (sign.widthM + window.widthM) / 2 + pad
          && sign.centerY + sign.heightM / 2 + pad > window.sillM
          && sign.centerY - sign.heightM / 2 - pad < window.sillM + window.heightM;
        expect(overlaps, `${sign.facade}/${window.id}`).toBe(false);
      }
      const quantities = computeQuantities(selected);
      expect(quantities.hallWindowCount).toBe(windows.length);
      expect(quantities.hallWindowAreaM2).toBeCloseTo(windows.reduce((area, w) => area + w.widthM * w.heightM, 0), 2);
    }
  });

  it("pod logem zůstane skutečná plná fasáda a okna vedle něj zůstanou průhledná", () => {
    const config = { ...configs[0]!, daylight: "both" as const };
    const shell = buildShell(config, { omitOpeningDetails: true });
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const walls = new THREE.Mesh(shell.walls, material);
    const ray = new THREE.Raycaster();
    ray.far = 5;
    for (const sign of layoutHallSigns(config)) {
      const matrix = facadeMatrix(config.dimensions, sign.facade);
      for (const offset of [-0.4, 0, 0.4]) {
        ray.set(new THREE.Vector3(sign.centerU + sign.widthM * offset, sign.centerY, 3).applyMatrix4(matrix), new THREE.Vector3(0, 0, -1).transformDirection(matrix));
        expect(ray.intersectObject(walls).length).toBeGreaterThan(0);
      }
    }
    for (const window of placeOpenings(config).filter((o) => o.kind === "hallWindow")) {
      const matrix = facadeMatrix(config.dimensions, window.facade);
      ray.set(new THREE.Vector3(window.centerU, window.sillM + window.heightM / 2, 3).applyMatrix4(matrix), new THREE.Vector3(0, 0, -1).transformDirection(matrix));
      expect(ray.intersectObject(walls)).toHaveLength(0);
    }
    Object.values(shell).forEach((g) => g?.dispose());
    material.dispose();
  });

  it("svítidla pod logem nezasahují do oken ani vrat", () => {
    expect(layoutSignLamps(configs[0]!).length).toBeGreaterThan(0);
    for (const c of configs) for (const daylight of ["roof", "facade", "both"] as const) {
      const config = { ...c, daylight };
      for (const lamp of layoutSignLamps(config)) {
        expect(lamp.u - 0.17).toBeGreaterThan(0);
        expect(lamp.u + 0.17).toBeLessThan(facadeLengthM(config.dimensions, lamp.facade));
        for (const o of placeOpenings(config).filter((o) => o.facade === lamp.facade)) {
          const overlaps = Math.abs(lamp.u - o.centerU) < o.widthM / 2 + 0.17 && lamp.y + 0.15 > o.sillM && lamp.y - 0.15 < o.sillM + o.heightM;
          expect(overlaps).toBe(false);
        }
      }
    }
  });

  it("zachová průhledy v písmenech, původní proporce a skutečnou tloušťku samostatných znaků", () => {
    const shapes = logoShapes(12);
    expect(shapes.length).toBeGreaterThanOrEqual(10);
    expect(shapes.reduce((n, s) => n + s.holes.length, 0)).toBeGreaterThanOrEqual(3);
    const g = buildHallSignGeometry(12);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(12 + SIGNAGE.bevelM * 2, 2);
    expect(box.max.y - box.min.y).toBeCloseTo(12 / SIGNAGE.aspect + SIGNAGE.bevelM * 2, 2);
    expect(box.max.z - box.min.z).toBeCloseTo(SIGNAGE.depthM + SIGNAGE.bevelM * 2, 4);
    expect(g.groups.some((group) => group.materialIndex === 0)).toBe(true);
    expect(g.groups.some((group) => group.materialIndex === 1)).toBe(true);
    const positions = g.getAttribute("position");
    for (const v of positions.array) expect(Number.isFinite(v)).toBe(true);
    // This is detailed lettering, not a giant wall mesh or per-frame triangulation.
    expect(positions.count).toBeLessThan(120000);
    g.dispose();
  });

  it.each(configs.map((c, i) => [i, c] as const))("#%i: logo je uvnitř fasády, mimo okna a vrata a pod podatikovým pásem", (_i, c) => {
    for (const daylight of ["roof", "facade", "both"] as const) {
      const config = { ...c, daylight };
      const signs = layoutHallSigns(config);
      expect(signs.length).toBeGreaterThan(0);
      for (const sign of signs) {
        const u0 = sign.centerU - sign.widthM / 2, u1 = sign.centerU + sign.widthM / 2;
        const y0 = sign.centerY - sign.heightM / 2, y1 = sign.centerY + sign.heightM / 2;
        expect(u0).toBeGreaterThan(1);
        expect(u1).toBeLessThan(facadeLengthM(config.dimensions, sign.facade) - 1);
        expect(y0).toBeGreaterThanOrEqual(3);
        expect(y1).toBeLessThan(config.dimensions.clearHeightM + 0.35);
        expect(sign.widthM / sign.heightM).toBeCloseTo(SIGNAGE.aspect, 5);
        for (const opening of placeOpenings(config).filter((o) => o.facade === sign.facade)) {
          const overlaps = u0 < opening.centerU + opening.widthM / 2 && u1 > opening.centerU - opening.widthM / 2
            && y0 < opening.sillM + opening.heightM && y1 > opening.sillM;
          expect(overlaps, `${sign.facade}/${opening.id}`).toBe(false);
        }
        const matrix = facadeMatrix(config.dimensions, sign.facade);
        for (const u of [u0, u1]) {
          // The mount lies on a real facade, with its back just outside the wall.
          const inward = new THREE.Vector3(u, sign.centerY, DEMO_GEOMETRY.wallThicknessM - 0.02).applyMatrix4(matrix);
          expect(pointInFootprint(config.dimensions, inward.x, inward.z)).toBe(true);
          const outside = new THREE.Vector3(u, sign.centerY, DEMO_GEOMETRY.wallThicknessM + SIGNAGE.standoffM).applyMatrix4(matrix);
          expect(pointInFootprint(config.dimensions, outside.x, outside.z)).toBe(false);
        }
      }
    }
  });
});
