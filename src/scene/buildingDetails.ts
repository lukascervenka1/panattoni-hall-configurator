/** Small architectural finishes, anchored to the existing facade and actual entrance. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { HallConfig } from "@/configurator/schema/config";
import { facadeLengthM, placeOpenings } from "@/configurator/calculations/layout";
import { DEMO_GEOMETRY as G } from "@/configurator/calculations/constants";
import { facadeMatrix } from "./geometry";
import { layoutHallSigns } from "./hallSignage";

export function layoutSignLamps(config: HallConfig) {
  const openings = placeOpenings(config);
  return layoutHallSigns(config).flatMap((sign) => [-1, 1].flatMap((side) => {
    const u = sign.centerU + side * sign.widthM * 0.34;
    const y = sign.centerY - sign.heightM / 2 - 0.36;
    if (y < 3 || openings.some((o) => o.facade === sign.facade && Math.abs(o.centerU - u) < o.widthM / 2 + 0.28 && y > o.sillM - 0.2 && y < o.sillM + o.heightM + 0.2)) return [];
    return [{ facade: sign.facade, u, y }];
  }));
}

export function buildBuildingDetails(config: HallConfig) {
  const buckets: Record<"metal" | "lens" | "pots" | "soil" | "green" | "mat", THREE.BufferGeometry[]> = { metal: [], lens: [], pots: [], soil: [], green: [], mat: [] };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  for (const lamp of layoutSignLamps(config)) {
    const matrix = facadeMatrix(config.dimensions, lamp.facade).multiply(new THREE.Matrix4().makeTranslation(lamp.u, lamp.y, G.wallThicknessM));
    buckets.metal.push(box(0.12, 0.24, 0.04, 0, 0, 0.035).applyMatrix4(matrix), box(0.045, 0.045, 0.38, 0, -0.015, 0.22).applyMatrix4(matrix));
    buckets.metal.push(new RoundedBoxGeometry(0.34, 0.12, 0.25, 1, 0.02).rotateX(-0.45).translate(0, 0.015, 0.42).applyMatrix4(matrix));
    buckets.lens.push(new THREE.BoxGeometry(0.28, 0.014, 0.2).translate(0, 0.066, 0).rotateX(-0.45).translate(0, 0.015, 0.42).applyMatrix4(matrix));
  }
  const entrance = placeOpenings(config).find((o) => o.kind === "entrance");
  if (entrance) {
    const len = facadeLengthM(config.dimensions, "front");
    const matrix = facadeMatrix(config.dimensions, "front");
    for (const side of [-1, 1]) {
      const u = entrance.centerU + side * (entrance.widthM / 2 + 2.1);
      if (u < 0.6 || u > len - 0.6) continue;
      const z = G.wallThicknessM + 1.25;
      buckets.pots.push(new RoundedBoxGeometry(0.76, 0.64, 0.76, 1, 0.035).translate(u, 0.42, z).applyMatrix4(matrix));
      buckets.soil.push(box(0.64, 0.025, 0.64, u, 0.75, z).applyMatrix4(matrix));
      buckets.metal.push(box(0.58, 0.045, 0.58, u, 0.09, z).applyMatrix4(matrix));
      for (const [dx, dz, radius] of [[-0.16, 0.02, 0.26], [0.12, 0.11, 0.27], [0.03, -0.15, 0.3]]) {
        buckets.green.push(new THREE.IcosahedronGeometry(radius!, 1).scale(1, 1.18, 1).translate(u + dx!, 0.94, z + dz!).applyMatrix4(matrix));
      }
    }
    buckets.mat.push(box(entrance.widthM + 0.12, 0.016, 0.85, entrance.centerU, 0.105, G.wallThicknessM + 0.55).applyMatrix4(matrix));
  }
  const merge = (parts: THREE.BufferGeometry[]) => {
    if (!parts.length) return null;
    const plain = parts.map((g) => g.index ? g.toNonIndexed() : g);
    const geometry = mergeGeometries(plain, false)!;
    for (const g of new Set([...parts, ...plain])) g.dispose();
    return geometry;
  };
  return Object.fromEntries(Object.entries(buckets).map(([key, parts]) => [key, merge(parts)])) as Record<keyof typeof buckets, THREE.BufferGeometry | null>;
}
