import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  layoutCeilingLights,
  layoutRackParts,
  layoutRoofUnits,
  boundingRadius,
  buildingRect,
  layoutOfficePartitions,
  layoutRacks,
  layoutSkylights,
  layoutSurroundings,
  rectContains,
  OBJECT_SIZES,
} from "./layout";
import { fitDistance, presetDistance, presetPose, refitDistance, sphereFitDistance, VIEW_PRESETS } from "./camera";
import { buildOffice, buildRoof, buildRoofDetails, buildShell } from "./geometry";
import { DOCK_RAILING, layoutDockRailings } from "./layout";
import { FOREST, layoutLandscape } from "./landscape";
import { officeLayout, placeOpenings, totalHeightM } from "@/configurator/calculations/layout";
import { computeQuantities } from "@/configurator/calculations/quantities";
import { configFor, patch } from "@/tests/helpers";

const CONFIGS = [
  configFor("logistics"),
  configFor("production"),
  configFor("city_logistics"),
  patch(configFor("logistics"), { length_m: 300, width_m: 150, clear_height_m: 14, dock_count: 31, drive_in_count: 4 }),
  patch(configFor("city_logistics"), { length_m: 36, width_m: 24, dock_count: 2, drive_in_count: 1, office_area_m2: 100 }),
  patch(configFor("logistics"), { office_enabled: false, dock_count: 0, drive_in_count: 0 }),
];

describe("okolí: nic uvnitř budovy, nic se nedeformuje", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i", (_i, c) => {
    const b = buildingRect(c);
    const s = layoutSurroundings(c);
    const inside = (p: { x: number; z: number }) => rectContains(b, p.x, p.z, 1);
    expect(s.cars.filter(inside)).toEqual([]);
    expect(s.trees.filter(inside)).toEqual([]);
    expect(s.people.filter(inside)).toEqual([]);
    // Kotva kamionu leží na linii zadní fasády; skutečné těleso návěsu začíná 0,35 m před ní a vyčnívá ven.
    for (const t of s.trucks) {
      const trailerNearEdge = t.z - 0.35;
      const trailerFarEdge = t.z - 0.35 - OBJECT_SIZES.trailer.lengthM;
      expect(trailerNearEdge).toBeLessThan(-c.dimensions.widthM / 2);
      expect(trailerFarEdge).toBeLessThan(trailerNearEdge);
      expect(rectContains(b, t.x, trailerNearEdge)).toBe(false);
    }
    // stromy nestojí na zpevněných plochách ani na silnici
    for (const t of s.trees) {
      expect(rectContains(s.apron, t.x, t.z)).toBe(false);
      expect(rectContains(s.parking, t.x, t.z)).toBe(false);
      expect(rectContains(s.road, t.x, t.z)).toBe(false);
    }
    // auta stojí na parkovišti
    for (const car of s.cars) expect(rectContains(s.parking, car.x, car.z)).toBe(true);
  });

  it("kamionů je nejvýše 6 a stojí u doků; bez doků žádný", () => {
    expect(layoutSurroundings(CONFIGS[3]!).trucks.length).toBeLessThanOrEqual(6);
    expect(layoutSurroundings(CONFIGS[5]!).trucks).toHaveLength(0);
  });

  it("je deterministické (stejná konfigurace = stejné okolí)", () => {
    expect(layoutSurroundings(CONFIGS[0]!)).toEqual(layoutSurroundings(structuredClone(CONFIGS[0]!)));
  });

  it("delší hala má víc aut, auta přitom mají stále stejnou velikost", () => {
    const short = layoutSurroundings(patch(configFor("city_logistics"), { length_m: 36 })).cars.length;
    const long = layoutSurroundings(patch(configFor("city_logistics"), { length_m: 120 })).cars.length;
    expect(long).toBeGreaterThan(short);
    expect(OBJECT_SIZES.car.lengthM).toBe(4.5);
  });
});

describe("světlíky, regály a příčky", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("světlíky leží na střeše a odpovídají účtované ploše (#%i)", (_i, c) => {
    const b = buildingRect(c);
    const panels = layoutSkylights(c);
    for (const p of panels) {
      expect(p.x - p.widthM / 2).toBeGreaterThanOrEqual(b.x0);
      expect(p.x + p.widthM / 2).toBeLessThanOrEqual(b.x1);
      expect(p.z - p.depthM / 2).toBeGreaterThanOrEqual(b.z0);
      expect(p.z + p.depthM / 2).toBeLessThanOrEqual(b.z1);
    }
    const area = panels.reduce((s, p) => s + p.widthM * p.depthM, 0);
    const target = computeQuantities(c).skylightAreaM2;
    expect(Math.abs(area - target)).toBeLessThanOrEqual(2 * 18 + 0.01 * target);
  });

  it("regály vynechávají administrativu a zůstávají v hale", () => {
    for (const c of CONFIGS) {
      const o = officeLayout(c);
      const b = buildingRect(c);
      for (const r of layoutRacks(c).racks) {
        const seg = { x0: r.x - r.lengthM / 2, x1: r.x + r.lengthM / 2, z0: r.z - 1.35, z1: r.z + 1.35 };
        expect(seg.x0).toBeGreaterThanOrEqual(b.x0);
        expect(seg.x1).toBeLessThanOrEqual(b.x1);
        expect(seg.z0).toBeGreaterThanOrEqual(b.z0);
        expect(seg.z1).toBeLessThanOrEqual(b.z1);
        if (o) {
          const overlap = seg.x1 > o.x0 && seg.x0 < o.x1 && seg.z1 > o.z0 && seg.z0 < o.z1;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it("příčky administrativy leží uvnitř jejího půdorysu a výšky podlaží", () => {
    const c = configFor("production");
    const o = officeLayout(c)!;
    const parts = layoutOfficePartitions(c);
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) {
      expect(p.x).toBeGreaterThanOrEqual(o.x0);
      expect(p.x).toBeLessThanOrEqual(o.x1);
      expect(p.z).toBeGreaterThanOrEqual(o.z0);
      expect(p.z).toBeLessThanOrEqual(o.z1);
      expect(p.y0 + p.heightM).toBeLessThanOrEqual(o.heightM);
    }
    expect(layoutOfficePartitions(patch(c, { office_enabled: false }))).toEqual([]);
  });
});

describe("kamera", () => {
  const cfg = configFor();
  const dist = (p: [number, number, number], t: [number, number, number]) => Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);

  it("vnější pohledy jsou vně budovy a míří na ni", () => {
    const b = buildingRect(cfg);
    for (const v of ["perspective", "front", "rear", "top"] as const) {
      const pose = presetPose(v, cfg, 1.6);
      const inside = rectContains(b, pose.position[0], pose.position[2]) && pose.position[1] < totalHeightM(cfg.dimensions.clearHeightM);
      expect(inside).toBe(false);
    }
    expect(presetPose("front", cfg, 1.6).position[2]).toBeGreaterThan(cfg.dimensions.widthM / 2);
    expect(presetPose("rear", cfg, 1.6).position[2]).toBeLessThan(-cfg.dimensions.widthM / 2);
    expect(presetPose("top", cfg, 1.6).position[1]).toBeGreaterThan(totalHeightM(cfg.dimensions.clearHeightM));
  });

  it("pohled na zázemí ukazuje okna, vstup a parkoviště z nízkého čelního úhlu", () => {
    for (const c of [cfg, configFor("production"), configFor("city_logistics"), patch(cfg, { office_area_m2: 900 }), patch(cfg, { length_m: 300, width_m: 150, office_area_m2: 1500 }), patch(cfg, { shape: "L", notch_length_m: 48, notch_width_m: 30 })]) {
      const o = officeLayout(c)!;
      const frontZ = c.dimensions.widthM / 2;
      for (const aspect of [0.7, 1, 1.6, 2.4]) {
        const pose = presetPose("office", c, aspect);
        expect(pose.position[2]).toBeGreaterThan(layoutSurroundings(c).road.z1);
        expect(pose.target[0]).toBeGreaterThan(o.x0);
        expect(pose.target[0]).toBeLessThan(o.x1 + 3);
        // Jen lehce nad atikou, aby byl vidět okraj střechy; žádný pohled z ptačí perspektivy.
        const height = totalHeightM(c.dimensions.clearHeightM);
        expect(pose.position[1]).toBeGreaterThan(height);
        expect(pose.position[1]).toBeLessThan(height + 4);
        const elevation = Math.atan2(pose.position[1] - pose.target[1], Math.hypot(pose.position[0] - pose.target[0], pose.position[2] - pose.target[2]));
        expect(elevation).toBeLessThan(15 * Math.PI / 180);

        const camera = new THREE.PerspectiveCamera(38, aspect, 0.8, 4200);
        camera.position.set(...pose.position);
        camera.lookAt(...pose.target);
        camera.updateMatrixWorld();
        const entrance = placeOpenings(c).find((opening) => opening.kind === "entrance");
        const points = [
          [o.x0, 0.2, frontZ], [o.x0, o.heightM, frontZ],
          [o.x1, 0.2, frontZ], [o.x1, o.heightM, frontZ],
          [pose.target[0], 0.2, frontZ + 19], // přední řada parkoviště
        ];
        if (entrance) points.push([-c.dimensions.lengthM / 2 + entrance.centerU + entrance.widthM / 2, entrance.heightM / 2, frontZ]);
        for (const point of points) {
          const projected = new THREE.Vector3(...point as [number, number, number]).project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(0.95);
          expect(Math.abs(projected.y)).toBeLessThan(0.8);
          expect(projected.z).toBeGreaterThan(-1);
          expect(projected.z).toBeLessThan(1);
        }
      }
    }
    // bez administrativy je pohled stále platný (před levou částí fasády)
    const none = presetPose("office", patch(cfg, { office_enabled: false }), 1.6);
    expect(none.position.every(Number.isFinite)).toBe(true);
  });

  it("interiér je uvnitř haly v lidské výšce", () => {
    const p = presetPose("interior", cfg, 1.6);
    expect(rectContains(buildingRect(cfg), p.position[0], p.position[2])).toBe(true);
    expect(p.position[1]).toBeLessThan(6);
  });

  it("všechny pohledy mají konečné hodnoty", () => {
    for (const v of VIEW_PRESETS) {
      const pose = presetPose(v, cfg, 1.2);
      expect([...pose.position, ...pose.target].every(Number.isFinite)).toBe(true);
    }
  });

  it("vzdálenost záběru roste s velikostí haly", () => {
    const small = sphereFitDistance(boundingRadius(configFor("city_logistics")), 38, 1.6);
    const big = sphereFitDistance(boundingRadius(CONFIGS[3]!), 38, 1.6);
    expect(big).toBeGreaterThan(small);
    expect(fitDistance(100, 10, 38, 1.6)).toBeGreaterThan(fitDistance(50, 10, 38, 1.6));
  });

  it("refit: kamera se hýbe jen když je to potřeba", () => {
    const ref = presetDistance("rear", cfg, 1.6);
    expect(refitDistance(ref * 1.2, ref)).toBeNull(); // pohodlně v záběru
    expect(refitDistance(ref * 0.5, ref)).toBeCloseTo(ref); // model by přetékal
    expect(refitDistance(ref * 6, ref)).toBeLessThan(ref * 6); // zbytečně malý
    // po změně rozměrů je referenční odstup větší; stará vzdálenost už nestačí
    const bigger = presetDistance("rear", patch(cfg, { length_m: 300, width_m: 150 }), 1.6);
    expect(bigger).toBeGreaterThan(ref);
    expect(refitDistance(ref, bigger)).toBeCloseTo(bigger);
  });
});

describe("parametrická geometrie (Three.js v Node)", () => {
  it("fasády mají přesný rozsah obálky a výšku; otvory jsou v nich skutečné díry", () => {
    const c = configFor();
    const shell = buildShell(c);
    shell.walls.computeBoundingBox();
    const bb = shell.walls.boundingBox!;
    const { lengthM: L, widthM: W, clearHeightM: C } = c.dimensions;
    expect(bb.min.x).toBeCloseTo(-L / 2, 3);
    expect(bb.max.x).toBeCloseTo(L / 2, 3);
    expect(bb.min.z).toBeCloseTo(-W / 2, 3);
    expect(bb.max.z).toBeCloseTo(W / 2, 3);
    expect(bb.max.y).toBeCloseTo(totalHeightM(C), 3);
    // díry zmenšují plochu stěn: bez otvorů je geometrie jednodušší
    const bare = buildShell(patch(c, { dock_count: 0, drive_in_count: 0, office_enabled: false }));
    expect(shell.walls.getAttribute("position").count).toBeGreaterThan(bare.walls.getAttribute("position").count);
    expect(bare.dockDoors).toBeNull();
    expect(bare.glass).toBeNull();
  });

  it("zvětšení délky nezvětší jednotlivá okna ani vrata (stejná velikost, jen víc segmentů fasády)", () => {
    const size = (g: THREE.BufferGeometry | null) => {
      g!.computeBoundingBox();
      const s = new THREE.Vector3();
      g!.boundingBox!.getSize(s);
      return s;
    };
    const small = buildShell(patch(configFor(), { dock_count: 1 }));
    const large = buildShell(patch(configFor(), { dock_count: 1, length_m: 300 }));
    const a = size(small.dockDoors);
    const b = size(large.dockDoors);
    expect(b.x).toBeCloseTo(a.x, 3);
    expect(b.y).toBeCloseTo(a.y, 3);
    expect(b.z).toBeCloseTo(a.z, 3);
  });

  it("administrativa a světlíky se postaví, žádné NaN", () => {
    const c = configFor("production");
    const office = buildOffice(c)!;
    const details = buildRoofDetails(c);
    for (const g of [office.slabs, office.walls, office.partitions, details.domes, details.curbs, details.units]) {
      g!.computeBoundingSphere();
      expect(Number.isFinite(g!.boundingSphere!.radius)).toBe(true);
    }
    expect(buildOffice(patch(c, { office_enabled: false }))).toBeNull();
  });
});

describe("detail: střecha, regály, areál", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("rooftop jednotky nekolidují se světlíky ani atikou (#%i)", (_i, c) => {
    const panels = layoutSkylights(c);
    const b = buildingRect(c);
    for (const u of layoutRoofUnits(c, panels)) {
      expect(u.x - u.widthM / 2).toBeGreaterThan(b.x0 + 1);
      expect(u.x + u.widthM / 2).toBeLessThan(b.x1 - 1);
      expect(u.z - u.depthM / 2).toBeGreaterThan(b.z0 + 1);
      expect(u.z + u.depthM / 2).toBeLessThan(b.z1 - 1);
      for (const p of panels) {
        const overlap = Math.abs(u.x - p.x) < (u.widthM + p.widthM) / 2 && Math.abs(u.z - p.z) < (u.depthM + p.depthM) / 2;
        expect(overlap).toBe(false);
      }
    }
  });

  it("počet instancí regálů je omezený i pro největší halu", () => {
    for (const c of CONFIGS) {
      const { racks, heightM } = layoutRacks(c);
      const parts = layoutRackParts(racks, heightM);
      const total = parts.uprights.length + parts.beams.length + parts.pallets.length + parts.goods.length;
      expect(total).toBeLessThan(60_000);
      for (const item of [...parts.uprights, ...parts.goods]) {
        expect(item.y + item.sy / 2).toBeLessThanOrEqual(c.dimensions.clearHeightM + 0.2);
      }
    }
  });

  it("svítidla v hale leží pod stropem a uvnitř půdorysu", () => {
    for (const c of CONFIGS) {
      const b = buildingRect(c);
      for (const l of layoutCeilingLights(c)) {
        expect(rectContains(b, l.x, l.z)).toBe(true);
        expect(l.y).toBeLessThan(c.dimensions.clearHeightM);
      }
    }
  });

  it("příjezd, vrátnice a stožáry nestojí v budově ani na manipulační ploše stromů", () => {
    for (const c of CONFIGS) {
      const b = buildingRect(c);
      const s = layoutSurroundings(c);
      expect(rectContains(b, s.guardhouse.x, s.guardhouse.z, 2)).toBe(false);
      for (const p of s.poles) expect(rectContains(b, p.x, p.z, 1)).toBe(false);
      expect(s.driveway.z1).toBeCloseTo(s.road.z0);
      for (const t of s.trees) {
        expect(rectContains(s.driveway, t.x, t.z)).toBe(false);
        expect(rectContains(s.sidewalk, t.x, t.z)).toBe(false);
      }
    }
  });

  it("střešní plocha má UV v metrech (švy se nedeformují)", () => {
    const c = configFor();
    const a = buildRoof(c.dimensions);
    const uv = a.surface.getAttribute("uv");
    let max = 0;
    for (let i = 0; i < uv.count; i++) max = Math.max(max, Math.abs(uv.getX(i)));
    expect(max).toBeCloseTo((c.dimensions.lengthM - 0.6) / 2 / 1.5, 3);
  });
});

describe("světlo a značení podlahy", () => {
  const sun = { x: 0.72, y: 0.62, z: 0.5 };

  it("sluneční paprsky nikdy nevycházejí mimo půdorys (ani u tvaru L)", async () => {
    const { layoutLightShafts } = await import("./layout");
    const { pointInFootprint } = await import("@/configurator/calculations/layout");
    for (const cfg of [configFor("logistics"), patch(configFor("logistics"), { shape: "L", notch_length_m: 48, notch_width_m: 30 })]) {
      const shafts = layoutLightShafts(cfg, sun);
      expect(shafts.length).toBeGreaterThan(0);
      for (const s of shafts) {
        expect(pointInFootprint(cfg.dimensions, s.x + s.dx, s.z + s.dz, 1)).toBe(true);
        expect(s.bottomY).toBeLessThan(s.topY);
      }
    }
  });

  it("značení podlahy obepíná řady regálů a nevychází mimo půdorys", async () => {
    const { layoutFloorMarkings, layoutRacks } = await import("./layout");
    const { pointInFootprint } = await import("@/configurator/calculations/layout");
    const cfg = configFor("logistics");
    const { racks } = layoutRacks(cfg);
    const strips = layoutFloorMarkings(cfg, racks);
    expect(strips.length).toBeGreaterThan(0);
    expect(strips.length).toBeLessThanOrEqual(480);
    for (const s of strips) expect(pointInFootprint(cfg.dimensions, s.x, s.z, 0)).toBe(true);
    expect(layoutFloorMarkings(cfg, [])).toHaveLength(cfg.openings.dockCount > 0 ? 1 : 0); // jen hranice překladiště
  });
});

describe("zábradlí u doků", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: úseky leží mimo vrata a uvnitř fasády", (_i, c) => {
    const runs = layoutDockRailings(c);
    const docks = placeOpenings(c).filter((o) => o.kind === "dock");
    const len = c.dimensions.lengthM;
    if (docks.length === 0) {
      expect(runs).toEqual([]);
      return;
    }
    for (const r of runs) {
      expect(r.u0).toBeGreaterThanOrEqual(DOCK_RAILING.cornerM - 1e-9);
      expect(r.u1).toBeLessThanOrEqual(len - DOCK_RAILING.cornerM + 1e-9);
      expect(r.u1 - r.u0).toBeGreaterThanOrEqual(DOCK_RAILING.minRunM);
      for (const d of docks) {
        const overlaps = r.u0 < d.centerU + d.widthM / 2 + DOCK_RAILING.gapFromDockM - 1e-9 && r.u1 > d.centerU - d.widthM / 2 - DOCK_RAILING.gapFromDockM + 1e-9;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("zábradlí přibývá do geometrie fasády a vyčnívá nejvýše o odstup před stěnou", () => {
    const withDocks = patch(configFor("logistics"), { dock_count: 6 });
    const noDocks = patch(configFor("logistics"), { dock_count: 0 });
    const a = buildShell(withDocks, { omitOpeningDetails: true }).pipes!;
    const b = buildShell(noDocks, { omitOpeningDetails: true }).pipes!;
    expect(a.getAttribute("position").count).toBeGreaterThan(b.getAttribute("position").count);
    a.computeBoundingBox();
    const W = withDocks.dimensions.widthM;
    expect(a.boundingBox!.min.z).toBeGreaterThanOrEqual(-W / 2 - DOCK_RAILING.offsetM - 0.5);
  });
});

describe("okolí: posezení a keře", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: posezení a keře leží v areálu, mimo budovu, komunikace a parkoviště", (_i, c) => {
    const s = layoutSurroundings(c);
    const b = buildingRect(c);
    const inside = (r: { x0: number; x1: number; z0: number; z1: number }, p: { x: number; z: number }) => rectContains(r, p.x, p.z);
    expect(rectContains(s.plot, s.patio.x0, s.patio.z0)).toBe(true);
    expect(rectContains(s.plot, s.patio.x1, s.patio.z1)).toBe(true);
    // posezení nezasahuje do budovy, parkoviště ani komunikace
    for (const other of [b, s.parking, s.road, s.apron, s.driveway]) {
      expect(s.patio.x1 <= other.x0 || s.patio.x0 >= other.x1 || s.patio.z1 <= other.z0 || s.patio.z0 >= other.z1).toBe(true);
    }
    for (const t of s.tables) expect(inside(s.patio, t)).toBe(true);
    expect(s.tables.length).toBeGreaterThan(0);
    for (const k of s.bushes) {
      expect(inside(b, k)).toBe(false);
      expect(inside(s.parking, k)).toBe(false);
      expect(inside(s.road, k)).toBe(false);
      expect(inside(s.plot, k)).toBe(true);
    }
    expect(s.bushes.length).toBeLessThanOrEqual(80);
    // stromy nerostou na posezení ani chodníku
    for (const tr of s.trees) {
      expect(inside(s.patio, tr)).toBe(false);
      expect(inside(s.path, tr)).toBe(false);
    }
  });
});

describe("les za areálem a vlajky", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("konfigurace #%i: les je mimo pozemek a komunikaci, vlajky stojí uvnitř pozemku u příjezdu", (_i, c) => {
    const s = layoutSurroundings(c);
    const land = layoutLandscape(s);
    expect(land.forest.length).toBeGreaterThan(50);
    expect(land.forest.length).toBeLessThanOrEqual(FOREST.max);
    for (const t of land.forest) {
      expect(rectContains(s.plot, t.x, t.z, FOREST.insetM - 6)).toBe(false);
      // přední strana u komunikace zůstává otevřená
      expect(t.z).toBeLessThan(s.road.z0 - 14);
    }
    expect(s.flags.length).toBe(3);
    for (const f of s.flags) {
      expect(rectContains(s.plot, f.x, f.z)).toBe(true);
      expect(rectContains(s.parking, f.x, f.z)).toBe(false);
      expect(rectContains(s.road, f.x, f.z)).toBe(false);
      expect(rectContains(s.driveway, f.x, f.z)).toBe(false);
    }
    for (const t of s.trees) for (const f of s.flags) expect(Math.hypot(t.x - f.x, t.z - f.z)).toBeGreaterThan(2);
  });
});
