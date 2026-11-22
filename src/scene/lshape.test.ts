import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildFloor, buildRoof, buildRoofDetails, buildShell, facadeMatrix } from "./geometry";
import { layoutCeilingLights, layoutRackParts, layoutRacks, layoutRoofUnits, layoutSkylights, layoutSurroundings, rectContains } from "./layout";
import { displayConfig, isSettled, stepValues, valuesOf } from "./build";
import { layoutLandscape } from "./landscape";
import { buildTraffic, vehiclePose } from "./traffic";
import { facadeLengthM, findOpeningProblems, footprintAreaM2, footprintPolygon, placeOpenings, pointInFootprint, rectHitsNotch } from "@/configurator/calculations/layout";
import { normalizeConfig } from "@/configurator/rules/normalize";
import { configFor, patch, publicCatalog } from "@/tests/helpers";

const L = (id = "logistics", c: Parameters<typeof patch>[1] = {}) => normalizeConfig(patch(configFor(id), { shape: "L", ...c }), publicCatalog);

const trianglesArea = (g: THREE.BufferGeometry) => {
  const pos = g.getAttribute("position");
  const index = g.index;
  const n = index ? index.count : pos.count;
  const p = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i);
  let a = 0;
  for (let i = 0; i < n; i += 3) a += new THREE.Triangle(p(i), p(i + 1), p(i + 2)).getArea();
  return a;
};

describe("L: 3D geometrie", () => {
  it("střešní plocha a podlaha mají přesně plochu polygonu (vnitřní okraj stěn)", () => {
    const c = L();
    const inner = footprintPolygon(c.dimensions, 0.3);
    const polyArea = Math.abs(inner.reduce((s, [x, z], i) => s + (x * inner[(i + 1) % inner.length]![1] - inner[(i + 1) % inner.length]![0] * z), 0)) / 2;
    expect(trianglesArea(buildRoof(c.dimensions).surface)).toBeCloseTo(polyArea, 1);
    expect(trianglesArea(buildFloor(c.dimensions, 6).surface)).toBeCloseTo(polyArea, 1);
  });

  it("střešní plocha leží v rovině střechy a pokrývá L, ne celý obdélník", () => {
    const c = L();
    const surf = buildRoof(c.dimensions).surface;
    const rectArea = (c.dimensions.lengthM - 0.6) * (c.dimensions.widthM - 0.6);
    expect(trianglesArea(surf)).toBeLessThan(rectArea - c.dimensions.notchLengthM * c.dimensions.notchWidthM * 0.9);
    surf.computeBoundingBox();
    expect(surf.boundingBox!.min.y).toBeCloseTo(c.dimensions.clearHeightM + 1.012, 3);
    expect(surf.boundingBox!.max.y).toBeCloseTo(c.dimensions.clearHeightM + 1.012, 3);
  });

  it("stěny L mají obálku L × W a vnitřní stěny výřezu stojí na správných místech", () => {
    const c = L();
    const d = c.dimensions;
    const shell = buildShell(c);
    shell.walls.computeBoundingBox();
    const bb = shell.walls.boundingBox!;
    expect(bb.min.x).toBeCloseTo(-d.lengthM / 2, 2);
    expect(bb.max.x).toBeCloseTo(d.lengthM / 2, 2);
    expect(bb.max.z).toBeCloseTo(d.widthM / 2, 2);
    // vnější líc vnitřní stěny A leží v z = W/2 − nz, B v x = L/2 − nx
    const A = new THREE.Vector3(0, 0, 1).transformDirection(facadeMatrix(d, "notchA"));
    const B = new THREE.Vector3(0, 0, 1).transformDirection(facadeMatrix(d, "notchB"));
    expect(A.z).toBeCloseTo(1);
    expect(B.x).toBeCloseTo(1);
    const originA = new THREE.Vector3().setFromMatrixPosition(facadeMatrix(d, "notchA"));
    const originB = new THREE.Vector3().setFromMatrixPosition(facadeMatrix(d, "notchB"));
    expect(originA.z + 0.3).toBeCloseTo(d.widthM / 2 - d.notchWidthM);
    expect(originB.x + 0.3).toBeCloseTo(d.lengthM / 2 - d.notchLengthM);
    expect(facadeLengthM(d, "notchA")).toBe(d.notchLengthM);
  });

  it("uvnitř výřezu není žádný světlík, rooftop jednotka, regál ani svítidlo", () => {
    for (const id of ["logistics", "production", "city_logistics"]) {
      const c = L(id);
      const d = c.dimensions;
      for (const p of layoutSkylights(c)) {
        expect(rectHitsNotch(d, { x0: p.x - p.widthM / 2, x1: p.x + p.widthM / 2, z0: p.z - p.depthM / 2, z1: p.z + p.depthM / 2 })).toBe(false);
      }
      for (const u of layoutRoofUnits(c, layoutSkylights(c))) expect(pointInFootprint(d, u.x, u.z)).toBe(true);
      const { racks, heightM } = layoutRacks(c);
      for (const r of racks) expect(rectHitsNotch(d, { x0: r.x - r.lengthM / 2, x1: r.x + r.lengthM / 2, z0: r.z - 1.35, z1: r.z + 1.35 })).toBe(false);
      layoutRackParts(racks, heightM);
      for (const l of layoutCeilingLights(c)) expect(pointInFootprint(d, l.x, l.z)).toBe(true);
    }
  });

  it("světlíky stále odpovídají účtované ploše (L)", () => {
    const c = L();
    const area = layoutSkylights(c).reduce((s, p) => s + p.widthM * p.depthM, 0);
    const target = (footprintAreaM2(c.dimensions) * 0.02);
    expect(area).toBeGreaterThan(target * 0.6);
    expect(area).toBeLessThan(target * 3);
    expect(buildRoofDetails(c).domes).not.toBeNull();
  });
});

describe("L: areál a doprava", () => {
  it("dvorek je přesně výřez; nic z okolí v něm nestojí", () => {
    const c = L();
    const s = layoutSurroundings(c);
    const d = c.dimensions;
    expect(s.yard).toEqual({ x0: d.lengthM / 2 - d.notchLengthM, x1: d.lengthM / 2, z0: d.widthM / 2 - d.notchWidthM, z1: d.widthM / 2 });
    expect(layoutSurroundings(configFor()).yard).toBeNull();
    for (const t of s.trees) expect(rectContains(s.yard!, t.x, t.z)).toBe(false);
    for (const car of s.cars) expect(rectContains(s.yard!, car.x, car.z)).toBe(false);
    for (const p of s.fence.posts) expect(rectContains(s.yard!, p.x, p.z)).toBe(false);
    for (const v of buildTraffic(s)) {
      for (let t = 0; t < 300; t += 2) {
        const p = vehiclePose(v, t);
        if (p.visible) expect(rectContains(s.yard!, p.x, p.z)).toBe(false);
      }
    }
    expect(layoutLandscape(s).fields.length).toBeGreaterThan(30);
  });
});

describe("L: růst a přepínání tvaru", () => {
  it("přechod obdélník → L i zpět je v každém kroku platný (žádné kolize, výřez nepřeroste ramena)", () => {
    for (const id of ["logistics", "production", "city_logistics"]) {
      for (const [from, to] of [[configFor(id), L(id)], [L(id), configFor(id)]] as const) {
        let cur = valuesOf(from);
        const tgt = valuesOf(to);
        let steps = 0;
        while (!isSettled(cur, tgt) && steps++ < 600) {
          cur = stepValues(cur, tgt, 1 / 60);
          const shown = displayConfig(to, cur);
          expect(findOpeningProblems(shown.dimensions, placeOpenings(shown))).toEqual([]);
          if (shown.dimensions.shape === "L") {
            expect(shown.dimensions.notchLengthM).toBeLessThanOrEqual(shown.dimensions.lengthM - 24 + 1e-6);
            expect(shown.dimensions.notchWidthM).toBeLessThanOrEqual(shown.dimensions.widthM - 24 + 1e-6);
          } else {
            expect(shown.dimensions.notchLengthM).toBe(0);
          }
        }
        const end = displayConfig(to, cur);
        expect(end.dimensions).toMatchObject(to.dimensions);
      }
    }
  });
});
