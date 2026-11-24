import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, LOOK_KEYS, effectOf, resolveLook } from "./options";
import {
  PV_CELL,
  layoutGirders,
  layoutHallHeating,
  layoutOfficeHeatPump,
  layoutPartitions,
  layoutPv,
  layoutRackParts,
  layoutRacks,
  layoutRoofUnits,
  layoutSkylights,
  partitionXs,
  rectContains,
  buildingRect,
} from "./layout";
import { footprintAreaM2, officeLayout, pointInFootprint, rectHitsNotch } from "@/configurator/calculations/layout";
import { validateConfig } from "@/configurator/rules/validate";
import { normalizeConfig } from "@/configurator/rules/normalize";
import { withParameter } from "@/configurator/schema/config";
import { computePrice } from "@/pricing/calculate";
import { DEMO_CATALOG } from "@/catalog/demo/build";
import { configFor, patch, publicCatalog } from "@/tests/helpers";

const standardLook = resolveLook(configFor().selections, publicCatalog);

describe("vzhled voleb", () => {
  it("každá volba katalogu má větu o dopadu na model; klíče vzhledu odpovídají existujícím volbám", () => {
    const keys = new Set(publicCatalog.options.map((o) => o.material_key));
    for (const k of LOOK_KEYS) expect(keys.has(k)).toBe(true);
    for (const o of publicCatalog.options) {
      const e = effectOf(o);
      expect(e.text_cs.length).toBeGreaterThan(10);
    }
  });

  it("volba označená jako viditelná skutečně změní vzhled oproti standardu (nebo je standardem sama)", () => {
    for (const o of publicCatalog.options) {
      const e = effectOf(o);
      if (!e.visible || o.details.is_standard) continue;
      const look = resolveLook({ ...configFor().selections, [o.category_id]: o.option_id }, publicCatalog);
      expect(JSON.stringify(look), `${o.option_id} má být viditelná`).not.toBe(JSON.stringify(standardLook));
    }
  });

  it("volba označená jako neviditelná nemění vzhled a vysvětluje proč", () => {
    for (const o of publicCatalog.options) {
      const e = effectOf(o);
      if (e.visible || o.category_id === "cladding") continue;
      const look = resolveLook({ ...configFor().selections, [o.category_id]: o.option_id }, publicCatalog);
      expect(JSON.stringify(look), `${o.option_id} nemá měnit vzhled`).toBe(JSON.stringify(standardLook));
    }
  });

  it("fasáda přebírá barvu z katalogu a výchozí vzhled odpovídá standardu", () => {
    expect(standardLook).toEqual(DEFAULT_LOOK);
    for (const product of ["logistics", "production", "city_logistics"]) {
      expect(resolveLook(configFor(product).selections, publicCatalog).claddingColor).toBe("#f5f5f5");
    }
    const eco = resolveLook({ ...configFor().selections, cladding: "cladding.eco" }, publicCatalog);
    expect(eco.claddingColor).toBe(publicCatalog.options.find((o) => o.option_id === "cladding.eco")!.color_hex);
  });

  it("kombinace voleb se skládají", () => {
    const look = resolveLook({ ...configFor().selections, structure: "structure.tim", roof: "roof.v4", photovoltaics: "photovoltaics.p30", partition: "partition.split3" }, publicCatalog);
    expect(look.structure.girder).toBe("glulam");
    expect(look.roof.timber).toBe(true);
    expect(look.pvShare).toBe(0.3);
    expect(look.partitions).toBe(2);
  });
});

describe("pravidla voleb (M2)", () => {
  it("městská logistika nemá 60 % fotovoltaiky; dřevěná střecha se nesmí s FV; PIR se nesmí se sálavými panely", () => {
    const city = configFor("city_logistics");
    expect(validateConfig(withParameter(city, "photovoltaics", "photovoltaics.p30"), publicCatalog).ok).toBe(true);
    expect(validateConfig(withParameter(city, "photovoltaics", "photovoltaics.p60"), publicCatalog).issues.map((i) => i.code)).toContain("option_unavailable");
    const logisticsPv = patch(configFor(), { roof: "roof.v4", photovoltaics: "photovoltaics.p60" });
    expect(validateConfig(logisticsPv, publicCatalog).issues.map((i) => i.code)).toContain("forbidden_combination");
    expect(validateConfig(patch(configFor(), { roof: "roof.v4", photovoltaics: "photovoltaics.p30" }), publicCatalog).ok).toBe(true);
    const rad = patch(configFor(), { roof: "roof.v2", heating_hall: "heating_hall.radiant" });
    expect(validateConfig(rad, publicCatalog).issues.map((i) => i.message_cs).join(" ")).toMatch(/PIR/);
  });

  it("normalizace nahradí nedostupnou volbu výchozí", () => {
    const n = normalizeConfig(patch(configFor("city_logistics"), { photovoltaics: "photovoltaics.p60" }), publicCatalog);
    expect(n.selections.photovoltaics).toBe("photovoltaics.none");
  });

  it("cena: standardní technologie je 0, alternativy vyžadují individuální kalkulaci", () => {
    const std = computePrice(configFor(), DEMO_CATALOG);
    if (std.status !== "ok") throw new Error("očekávána cena");
    for (const cat of ["heating_hall", "heating_office", "lighting", "photovoltaics", "partition"]) {
      expect(std.lines.find((l) => l.categoryId === cat)).toMatchObject({ status: "priced", amountCents: 0 });
    }
    const alt = computePrice(patch(configFor(), { photovoltaics: "photovoltaics.p30", partition: "partition.split2" }), DEMO_CATALOG);
    if (alt.status !== "ok") throw new Error("očekávána cena");
    expect(alt.lines.find((l) => l.categoryId === "photovoltaics")).toMatchObject({ status: "individual", amountCents: null });
    expect(alt.lines.find((l) => l.categoryId === "partition")?.status).toBe("individual");
    expect(alt.incompleteReasons.join(" ")).toMatch(/individuální kalkulaci/);
    expect(alt.subtotalCents).toBe(std.subtotalCents); // nepřiceněné se do součtu nepřičítá
  });
});

const CONFIGS = [
  configFor("logistics"),
  configFor("production"),
  configFor("city_logistics"),
  normalizeConfig(patch(configFor("logistics"), { shape: "L" }), publicCatalog),
  normalizeConfig(patch(configFor("production"), { shape: "L" }), publicCatalog),
];

describe("rozvržení příček, vazníků, FV a vytápění", () => {
  it.each(CONFIGS.map((c, i) => [i, c] as const))("příčky leží v hale, mají průchod a nekříží administrativu (#%i)", (_i, c) => {
    for (const count of [1, 2] as const) {
      const segs = layoutPartitions(c, count);
      expect(segs).toHaveLength(count * 2);
      const o = officeLayout(c);
      for (const s of segs) {
        expect(pointInFootprint(c.dimensions, s.x, (s.zMin + s.zMax) / 2)).toBe(true);
        expect(s.zMax).toBeGreaterThan(s.zMin);
        if (o) expect(s.x).toBeGreaterThan(o.x1);
      }
      for (const x of partitionXs(c.dimensions.lengthM, count)) {
        const pair = segs.filter((s) => s.x === x);
        expect(pair[1]!.zMin - pair[0]!.zMax).toBeCloseTo(4); // průchod
      }
    }
    expect(layoutPartitions(c, 0)).toEqual([]);
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("regály se nepřekrývají s příčkami (#%i)", (_i, c) => {
    const xs = partitionXs(c.dimensions.lengthM, 2);
    const { racks } = layoutRacks(c, 2);
    for (const r of racks) for (const x of xs) expect(r.x + r.lengthM / 2 <= x - 2.5 || r.x - r.lengthM / 2 >= x + 2.5).toBe(true);
    expect(layoutRacks(c, 2).racks.length).toBeLessThan(layoutRacks(c, 0).racks.length);
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("vazníky jsou pod střechou a v L nepřesahují výřez (#%i)", (_i, c) => {
    for (const kind of ["precast", "glulam", "steel"] as const) {
      const items = layoutGirders(c, kind, "#b98a55");
      expect(items.length).toBeGreaterThan(2);
      for (const g of items) {
        expect(g.y + g.sy / 2).toBeCloseTo(c.dimensions.clearHeightM);
        const zEnd = g.z + g.sz / 2;
        expect(pointInFootprint(c.dimensions, g.x, zEnd - 0.5)).toBe(true);
      }
    }
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("panely FV jsou na volné střeše: mimo světlíky, jednotky, atiku a výřez (#%i)", (_i, c) => {
    const sky = layoutSkylights(c);
    const units = layoutRoofUnits(c, sky);
    const p30 = layoutPv(c, 0.3, sky, units);
    const p60 = layoutPv(c, 0.6, sky, units);
    expect(p30.length).toBeGreaterThan(0);
    expect(p60.length).toBeGreaterThan(p30.length);
    expect(layoutPv(c, 0, sky, units)).toEqual([]);
    const b = buildingRect(c);
    for (const p of p60) {
      expect(rectContains(b, p.x, p.z, -3)).toBe(true);
      expect(rectHitsNotch(c.dimensions, { x0: p.x - PV_CELL.widthM / 2, x1: p.x + PV_CELL.widthM / 2, z0: p.z - PV_CELL.depthM / 2, z1: p.z + PV_CELL.depthM / 2 })).toBe(false);
      for (const s of sky) expect(Math.abs(p.x - s.x) < (s.widthM + PV_CELL.widthM) / 2 && Math.abs(p.z - s.z) < (s.depthM + PV_CELL.depthM) / 2).toBe(false);
      for (const u of units) expect(Math.abs(p.x - u.x) < (u.widthM + PV_CELL.widthM) / 2 && Math.abs(p.z - u.z) < (u.depthM + PV_CELL.depthM) / 2).toBe(false);
    }
    expect(p60.length).toBeLessThanOrEqual(1500);
    expect(footprintAreaM2(c.dimensions)).toBeGreaterThan(0);
  });

  it.each(CONFIGS.map((c, i) => [i, c] as const))("vytápění haly visí uvnitř půdorysu pod střechou; administrativa má venkovní jednotku (#%i)", (_i, c) => {
    expect(layoutHallHeating(c, "std")).toEqual([]);
    for (const kind of ["warm_air", "radiant"] as const) {
      const items = layoutHallHeating(c, kind);
      expect(items.length).toBeGreaterThan(0);
      for (const h of items) {
        expect(pointInFootprint(c.dimensions, h.x, h.z)).toBe(true);
        expect(h.y).toBeLessThan(c.dimensions.clearHeightM);
      }
    }
    for (const u of layoutOfficeHeatPump(c)) expect(u.z).toBeGreaterThan(c.dimensions.widthM / 2);
    expect(layoutRackParts(layoutRacks(c).racks, 8).uprights.length).toBeGreaterThan(0);
  });
});
