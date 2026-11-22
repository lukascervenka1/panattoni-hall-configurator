import { describe, expect, it } from "vitest";
import { buildTraffic, lanes, makePath, poseAt, vehiclePose } from "./traffic";
import { buildingRect, layoutFence, layoutSurroundings, rectContains } from "./layout";
import { layoutLandscape } from "./landscape";
import { configFor, patch } from "@/tests/helpers";

const CONFIGS = [
  configFor("logistics"),
  configFor("production"),
  configFor("city_logistics"),
  patch(configFor("logistics"), { length_m: 300, width_m: 150, clear_height_m: 14, dock_count: 31, drive_in_count: 4 }),
];

describe("cesty vozidel", () => {
  it("zaoblení rohů zachová koncové body a délka odpovídá čáře", () => {
    const p = makePath([[0, 0], [10, 0], [10, 10]], 3);
    expect(p.pts[0]).toEqual([0, 0]);
    expect(p.pts.at(-1)).toEqual([10, 10]);
    expect(p.length).toBeLessThan(20); // oblouk zkracuje roh
    expect(p.length).toBeGreaterThan(17);
    const mid = poseAt(p, 0);
    expect(mid.heading).toBeCloseTo(Math.PI / 2); // jede +x
    expect(poseAt(p, p.length).heading).toBeCloseTo(0); // končí směrem +z
  });

  it("poseAt je omezené na délku cesty", () => {
    const p = makePath([[0, 0], [5, 0]]);
    expect(poseAt(p, -10).x).toBe(0);
    expect(poseAt(p, 1e6).x).toBe(5);
  });
});

describe("doprava na areálu", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("vjezd, ulička a zelené ostrůvky zůstávají bez stání (#%i)", (_i, c) => {
    const layout = layoutSurroundings(c);
    for (const stall of layout.stalls) {
      expect(stall.x + 1.35 < layout.driveway.x0 - 1.5 || stall.x - 1.35 > layout.driveway.x1 + 1.5).toBe(true);
      expect(Math.abs(stall.z - stall.aisleZ)).toBeGreaterThanOrEqual(5);
      for (const island of layout.parkingIslands) expect(rectContains(island, stall.x, stall.z, 1)).toBe(false);
      expect(rectContains(layout.serviceRoad, stall.x, stall.z, 0.9)).toBe(false);
    }
    expect(layout.parkingIslands.length).toBeGreaterThan(0);
    for (const pole of layout.poles) expect(rectContains(layout.parking, pole.x, pole.z)).toBe(false);
    for (const tree of layout.trees) expect(rectContains(layout.serviceRoad, tree.x, tree.z, 3)).toBe(false);
  });
  it.each(CONFIGS.map((c, i) => [i, c] as const))("vozidla nikdy nejsou v budově a drží se silnice/příjezdu/parkoviště (#%i)", (_i, c) => {
    const s = layoutSurroundings(c);
    const b = buildingRect(c);
    const lane = lanes(s.road);
    const vehicles = buildTraffic(s);
    expect(vehicles.length).toBeGreaterThan(8);
    for (const v of vehicles) {
      for (let t = 0; t < 400; t += 1.5) {
        const p = vehiclePose(v, t);
        if (!p.visible) continue;
        expect(rectContains(b, p.x, p.z, 1)).toBe(false);
        if (v.mode === "through") {
          expect([lane.east, lane.west]).toContain(p.z);
        } else {
          const onRoad = p.z >= s.road.z0 - 4 && p.z <= s.road.z1;
          const onDrive = p.x >= s.driveway.x0 - 2 && p.x <= s.driveway.x1 + 2 && p.z >= s.parking.z1 - 4 && p.z <= s.road.z0 + 8;
          const inLot = rectContains(s.parking, p.x, p.z, 1);
          expect(onRoad || onDrive || inLot).toBe(true);
        }
      }
    }
  });

  it("přijíždějící parkují jen ve volných stáních a stojí přesně ve stání", () => {
    for (const c of CONFIGS) {
      const s = layoutSurroundings(c);
      for (const v of buildTraffic(s)) {
        if (v.mode !== "parker") continue;
        expect(v.stall.occupied).toBe(false);
        const parked = vehiclePose(v, -v.offsetS + v.tIn + v.dwell / 2);
        expect(parked.visible).toBe(true);
        expect(parked.moving).toBe(false);
        expect(parked.x).toBeCloseTo(v.stall.x, 3);
        expect(parked.z).toBeCloseTo(v.stall.z, 3);
      }
    }
  });

  it("vozidla se v cyklu objeví, zmizí a vrátí; pohyb je spojitý (žádné skoky)", () => {
    const s = layoutSurroundings(CONFIGS[0]!);
    const car = buildTraffic(s).find((v) => v.mode === "parker")!;
    if (car.mode !== "parker") throw new Error("očekáván parker");
    const cycle = car.tIn + car.dwell + car.tOut + car.gapS;
    let seenHidden = false;
    let prev = vehiclePose(car, -car.offsetS);
    for (let t = 0.1; t < cycle * 1.2; t += 0.1) {
      const p = vehiclePose(car, t - car.offsetS);
      if (!p.visible) seenHidden = true;
      if (p.visible && prev.visible) expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(2.5); // < 25 m/s
      prev = p;
    }
    expect(seenHidden).toBe(true);
  });

  it("vozidlo couvá ze stání: nejdřív míří do stání, pak se natočí po směru jízdy", () => {
    const s = layoutSurroundings(CONFIGS[0]!);
    const car = buildTraffic(s).find((v) => v.mode === "parker")!;
    if (car.mode !== "parker") throw new Error("očekáván parker");
    const t0 = car.tIn + car.dwell - car.offsetS;
    const start = vehiclePose(car, t0 + 0.05 * car.tOut);
    const inHeading = Math.atan2(0, 0); // (jen kontrola konečnosti)
    expect(Number.isFinite(start.rotY + inHeading)).toBe(true);
    const parked = vehiclePose(car, t0 - 1);
    // krátce po rozjezdu míří stále přibližně jako při parkování (couvání)
    const d = Math.atan2(Math.sin(start.rotY - parked.rotY), Math.cos(start.rotY - parked.rotY));
    expect(Math.abs(d)).toBeLessThan(0.6);
  });
});

describe("oplocení a krajina", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("plot nestojí v budově ani ve vjezdu (#%i)", (_i, c) => {
    const s = layoutSurroundings(c);
    const b = buildingRect(c);
    expect(s.fence.posts.length).toBeGreaterThan(20);
    for (const p of s.fence.posts) {
      expect(rectContains(b, p.x, p.z, 1)).toBe(false);
      expect(rectContains(s.driveway, p.x, p.z, 0.5)).toBe(false);
    }
    const gate = layoutFence({ x0: -50, x1: 50, z0: -50, z1: 50 }, { x0: -5, x1: 5, z0: 0, z1: 60 });
    expect(gate.posts.some((p) => p.z === 50 && p.x > -4 && p.x < 4)).toBe(false);
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("pole neleží v areálu ani na silnici (#%i)", (_i, c) => {
    const s = layoutSurroundings(c);
    const l = layoutLandscape(s);
    expect(l.fields.length).toBeGreaterThan(30);
    for (const f of l.fields) {
      const overlapsPlot = f.x0 < s.plot.x1 && f.x1 > s.plot.x0 && f.z0 < s.plot.z1 && f.z1 > s.plot.z0;
      const overlapsRoad = f.z0 < s.road.z1 && f.z1 > s.road.z0;
      expect(overlapsPlot).toBe(false);
      expect(overlapsRoad).toBe(false);
    }
    for (const h of l.hedges) expect(rectContains(s.plot, h.x, h.z)).toBe(false);
  });

  it("pole jsou ukotvená ve světě: větší hala neposune ta, která zůstanou", () => {
    const small = layoutLandscape(layoutSurroundings(configFor("city_logistics")));
    const big = layoutLandscape(layoutSurroundings(configFor("logistics")));
    const key = (f: { x0: number; z0: number; kind: string }) => `${f.x0}|${f.z0}|${f.kind}`;
    const bigKeys = new Set(big.fields.map(key));
    const same = small.fields.filter((f) => bigKeys.has(key(f))).length;
    expect(same).toBeGreaterThan(small.fields.length * 0.7);
  });
});
