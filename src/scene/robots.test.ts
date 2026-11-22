import { describe, expect, it } from "vitest";
import { OBJECT_SIZES, buildingRect, layoutPartitions, layoutRacks, partitionXs } from "./layout";
import { ROBOT, ROBOT_COLUMN_CLEARANCE_M, layoutRobotLanes, layoutRobots, layoutServiceRobot, robotPose } from "./robots";
import { presetPose } from "./camera";
import { PerspectiveCamera, Vector3 } from "three";
import { columnFrame, officeLayout, pointInFootprint } from "@/configurator/calculations/layout";
import { configFor, patch } from "@/tests/helpers";

const CONFIGS = [
  configFor("logistics"),
  configFor("production"),
  configFor("city_logistics"),
  patch(configFor("logistics"), { length_m: 300, width_m: 150, clear_height_m: 14 }),
  patch(configFor("logistics"), { shape: "L", notch_length_m: 48, notch_width_m: 30 }),
];

describe("skladoví roboti", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: roboti jezdí jen uvnitř uličky mezi regály, ve hale a mimo příčky", (_i, c) => {
    for (const parts of [0, 1, 2] as const) {
      const racks = layoutRacks(c, parts).racks;
      const lanes = layoutRobotLanes(racks);
      const colZs = columnFrame(c.dimensions).zs;
      const robots = layoutRobots(lanes, colZs);
      expect(robots.length).toBeLessThanOrEqual(ROBOT.maxRobots);
      const rect = buildingRect(c);
      const office = officeLayout(c);
      for (const r of robots) {
        for (const t of [0, 3.3, 11.1, 27, 59.9, 120]) {
          const p = robotPose(r, t);
          expect(pointInFootprint(c.dimensions, p.x, p.z, 1)).toBe(true);
          expect(p.x).toBeGreaterThan(rect.x0 + 3);
          expect(p.x).toBeLessThan(rect.x1 - 3);
          // v uličce: od osy nejvýše pruh + polovina robota, tedy uvnitř poloviny uličky
          const lane = lanes.find((l) => Math.abs(l.z - r.z) <= ROBOT.laneOffsetM + 1e-9 && l.x0 === r.x0)!;
          expect(lane).toBeDefined();
          expect(Math.abs(p.z - lane.z) + ROBOT.widthM / 2).toBeLessThan(OBJECT_SIZES.rack.aisleM / 2);
          for (const cz of colZs) expect(Math.abs(p.z - cz)).toBeGreaterThanOrEqual(ROBOT_COLUMN_CLEARANCE_M - 1e-9);
          for (const px of partitionXs(c.dimensions.lengthM, parts)) expect(Math.abs(p.x - px)).toBeGreaterThan(1);
          if (office) {
            const inside = p.x > office.x0 - 2 && p.x < office.x1 + 2 && p.z > office.z0 - 3 && p.z < office.z1 + 2;
            expect(inside).toBe(false);
          }
        }
      }
      // příčky jsou skutečně přítomné v rozložení (kontrola, že test pokrývá obě varianty)
      expect(layoutPartitions(c, parts).length).toBe(parts * 2);
    }
  });

  it("v jedné uličce se roboti v různých pruzích nepotkají", () => {
    const c = configFor("logistics");
    const robots = layoutRobots(layoutRobotLanes(layoutRacks(c, 0).racks), columnFrame(c.dimensions).zs);
    const byLane = new Map<string, typeof robots>();
    for (const r of robots) {
      const k = `${r.x0.toFixed(2)}|${(Math.round(r.z * 10) / 10 - 0).toFixed(0)}`;
      byLane.set(k, [...(byLane.get(k) ?? []), r]);
    }
    for (let i = 0; i < robots.length; i++) {
      for (let j = i + 1; j < robots.length; j++) {
        const a = robots[i]!;
        const b = robots[j]!;
        if (Math.abs(a.z - b.z) > 2) continue;
        // sdílená ulička: pruhy musí být odlišné o víc než šířka robota
        expect(Math.abs(a.z - b.z)).toBeGreaterThan(ROBOT.widthM + 0.2);
      }
    }
  });

  it("pohyb je spojitý, periodický a deterministický", () => {
    const robots = layoutRobots(layoutRobotLanes(layoutRacks(configFor("logistics"), 0).racks), columnFrame(configFor("logistics").dimensions).zs);
    expect(robots.length).toBeGreaterThan(0);
    const r = robots[0]!;
    const period = 2 * ((r.x1 - r.x0) / r.speed + ROBOT.pauseS);
    expect(robotPose(r, 5)).toEqual(robotPose(r, 5));
    expect(robotPose(r, 5).x).toBeCloseTo(robotPose(r, 5 + period).x, 6);
    let prev = robotPose(r, 0);
    for (let t = 0.05; t < period * 1.2; t += 0.05) {
      const p = robotPose(r, t);
      expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(r.speed * 0.05 + 1e-6);
      let dRot = Math.abs(p.rotY - prev.rotY);
      dRot = Math.min(dRot, 2 * Math.PI - dRot);
      expect(dRot).toBeLessThan(0.4);
      prev = p;
    }
  });

  it("bez regálů nejsou žádní roboti", () => {
    expect(layoutRobots(layoutRobotLanes([]))).toEqual([]);
    expect(layoutServiceRobot(configFor("logistics"), [], 0, [])).toEqual([]);
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: servisní robot míjí doky, regály, sloupy, příčky a administrativu i při otočce", (_i, c) => {
    const radius = Math.hypot(ROBOT.lengthM, ROBOT.widthM) / 2;
    const grid = columnFrame(c.dimensions);
    const office = officeLayout(c);
    for (const parts of [0, 1, 2] as const) {
      const racks = layoutRacks(c, parts).racks;
      const robots = layoutServiceRobot(c, racks, parts, grid.zs);
      expect(robots).toHaveLength(1);
      for (const robot of robots) {
        const period = 2 * ((robot.x1 - robot.x0) / robot.speed + ROBOT.pauseS);
        for (let t = 0; t < period; t += 0.5) {
          const p = robotPose(robot, t);
          for (const dx of [-radius, radius]) for (const dz of [-radius, radius]) expect(pointInFootprint(c.dimensions, p.x + dx, p.z + dz, 0.25)).toBe(true);
          expect(p.z - radius).toBeGreaterThan(-c.dimensions.widthM / 2 + 8);
          expect(p.x + radius).toBeLessThan(c.dimensions.lengthM / 2 - 16);
          for (const z of grid.zs) expect(Math.abs(p.z - z)).toBeGreaterThan(radius + 0.3);
          for (const x of partitionXs(c.dimensions.lengthM, parts)) expect(Math.abs(p.x - x)).toBeGreaterThan(radius + 0.25);
          for (const r of racks) expect(Math.abs(p.x - r.x) > r.lengthM / 2 + radius || Math.abs(p.z - r.z) > OBJECT_SIZES.rack.depthM / 2 + radius).toBe(true);
          if (office) expect(p.x + radius < office.x0 || p.x - radius > office.x1 || p.z + radius < office.z0 || p.z - radius > office.z1).toBe(true);
        }
      }
    }
  });

  it.each(["production", "logistics", "city_logistics"] as const)("robot je od začátku v záběru interiéru (%s)", (product) => {
    const c = configFor(product);
    const robot = layoutServiceRobot(c, layoutRacks(c, 0).racks, 0, columnFrame(c.dimensions).zs)[0]!;
    const pose = presetPose("interior", c, 1.6);
    const camera = new PerspectiveCamera(38, 1.6, 0.1, 1000);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
    const p = robotPose(robot, 0);
    const screen = new Vector3(p.x, 0.5, p.z).project(camera);
    expect(Math.abs(screen.x)).toBeLessThan(0.9);
    expect(Math.abs(screen.y)).toBeLessThan(0.8);
    expect(screen.z).toBeLessThan(1);
    expect(robotPose(robot, 5).x).not.toBeCloseTo(p.x);
  });
});
