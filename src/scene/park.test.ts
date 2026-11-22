import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { configFor, patch } from "@/tests/helpers";
import { buildingRect, layoutSurroundings, rectContains, type Rect } from "./layout";
import { layoutPocketPark, pondOutline } from "./park";
import { presetPose } from "./camera";

const cases = [
  configFor("logistics"), configFor("production"), configFor("city_logistics"),
  patch(configFor("logistics"), { length_m: 300, width_m: 150, dock_count: 31, drive_in_count: 4 }),
  patch(configFor("city_logistics"), { length_m: 36, width_m: 24, dock_count: 2, drive_in_count: 1 }),
  patch(configFor("production"), { shape: "L", notch_length_m: 36, notch_width_m: 24 }),
  patch(configFor("production"), { office_enabled: false, dock_count: 0, drive_in_count: 0 }),
];
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const rectOf = (x: number, z: number, radius: number): Rect => ({ x0: x - radius, x1: x + radius, z0: z - radius, z1: z + radius });

function inPolygon(x: number, z: number, poly: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!, [xj, zj] = poly[j]!;
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

describe("minimalistický park", () => {
  it.each(cases.map((c, i) => [i, c] as const))("#%i: park je uvnitř areálu a mimo halu, dopravu i parkoviště", (_i, c) => {
    const site = layoutSurroundings(c), park = layoutPocketPark(site);
    const obstacles = [buildingRect(c), site.parking, site.apron, site.serviceRoad, site.road, site.driveway];
    for (const r of obstacles) expect(overlaps(park.bounds, r)).toBe(false);
    for (const [x, z] of pondOutline(park.pond, 1.6)) {
      expect(rectContains(park.bounds, x, z)).toBe(true);
      expect(rectContains(site.fence.rect, x, z, -0.15)).toBe(true);
    }
    for (const tree of park.trees) {
      const crown = rectOf(tree.x, tree.z, 1.8 * tree.scale);
      for (const r of obstacles) expect(overlaps(crown, r)).toBe(false);
      expect(inPolygon(tree.x, tree.z, pondOutline(park.pond, 1.6))).toBe(false);
    }
    for (const path of [...park.paths, ...park.benchPads]) {
      for (const r of obstacles) expect(overlaps(path, r)).toBe(false);
      // Walking links and bench pads never cut across the water.
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
        expect(inPolygon(path.x0 + (path.x1 - path.x0) * i / 8, path.z0 + (path.z1 - path.z0) * j / 8, pondOutline(park.pond))).toBe(false);
      }
    }
    for (const tree of site.trees) expect(rectContains(park.bounds, tree.x, tree.z)).toBe(false);
    expect(park.benches).toHaveLength(2);
    expect(park.trees).toHaveLength(7);
  });

  it("všechny lavičky jsou na plošce a navazují na propojenou síť pěších cest", () => {
    const site = layoutSurroundings(cases[0]!), park = layoutPocketPark(site);
    for (const [i, b] of park.benches.entries()) expect(rectContains(park.benchPads[i]!, b.x, b.z)).toBe(true);
    const walkway = [...park.paths, ...park.benchPads, site.path, site.patio];
    const connected = new Set([walkway.indexOf(site.path)]);
    let changed = true;
    while (changed) {
      changed = false;
      walkway.forEach((p, i) => {
        if (connected.has(i)) return;
        const touches = [...connected].some((j) => overlaps({ x0: p.x0 - 0.02, x1: p.x1 + 0.02, z0: p.z0 - 0.02, z1: p.z1 + 0.02 }, walkway[j]!));
        // Loop around the lake connects the otherwise separate waterfront pads.
        const onLoop = pondOutline(park.pond, 1.2).some(([x, z]) => rectContains(p, x, z));
        const loopReached = [...connected].some((j) => pondOutline(park.pond, 1.2).some(([x, z]) => rectContains(walkway[j]!, x, z)));
        if (touches || onLoop && loopReached) { connected.add(i); changed = true; }
      });
    }
    expect(connected.size).toBe(walkway.length);
  });

  it("změna velikosti haly park přesune, jeho rybník ani vybavení neroztáhne", () => {
    const a = layoutPocketPark(layoutSurroundings(cases[0]!));
    const b = layoutPocketPark(layoutSurroundings(cases[3]!));
    expect(a.pond.radiusX).toBe(b.pond.radiusX);
    expect(a.pond.radiusZ).toBe(b.pond.radiusZ);
    expect(a.trees.map((t) => t.scale)).toEqual(b.trees.map((t) => t.scale));
    expect(layoutPocketPark(layoutSurroundings(cases[0]!))).toEqual(a);
  });

  it.each(["production", "logistics", "city_logistics"] as const)("rybník je vidět z výchozího pohledu (%s)", (product) => {
    const c = configFor(product), park = layoutPocketPark(layoutSurroundings(c));
    const pose = presetPose("perspective", c, 1.6);
    const camera = new PerspectiveCamera(38, 1.6, 0.1, 5000);
    camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
    const p = new Vector3(park.pond.x, 0, park.pond.z).project(camera);
    expect(Math.abs(p.x)).toBeLessThan(0.95);
    expect(Math.abs(p.y)).toBeLessThan(0.95);
    expect(p.z).toBeLessThan(1);
  });
});
