import { describe, expect, it } from "vitest";
import { Group } from "three";
import { configFor } from "@/tests/helpers";
import { buildDockTrucks, dockTruckPose } from "./dockTrucks";
import { DynamicShadowRefresh } from "./dynamicShadows";
import { layoutSurroundings } from "./layout";

describe("stíny pohybujících se kamionů", () => {
  it("po celý příjezd, nakládku a odjezd neuchovává stín neviditelného kamionu", () => {
    const config = configFor("logistics");
    const trucks = buildDockTrucks(layoutSurroundings(config), config.dimensions.widthM, false);
    const groups = trucks.map(() => new Group());
    const refresh = new DynamicShadowRefresh();
    let cached: Array<{ visible: boolean; x: number; z: number }> = [];
    let updates = 0;
    let disappearances = 0;
    const duration = trucks[0]!.cycle + 1;
    for (let frame = 0; frame <= duration * 60; frame++) {
      const time = frame / 60;
      const poses = trucks.map((truck) => dockTruckPose(truck, time));
      groups.forEach((group, i) => {
        const pose = poses[i]!;
        if (group.visible && !pose.visible) disappearances++;
        group.visible = pose.visible;
        group.position.set(pose.x, 0.06, pose.z);
        group.rotation.y = pose.rotY;
      });
      if (refresh.update(groups, time)) {
        updates++;
        cached = groups.map((group) => ({ visible: group.visible, x: group.position.x, z: group.position.z }));
      }
      groups.forEach((group, i) => {
        expect(cached[i]!.visible).toBe(group.visible);
        if (group.visible) {
          // Even on the fastest approach, the cached silhouette stays close to its actual truck.
          expect(Math.hypot(cached[i]!.x - group.position.x, cached[i]!.z - group.position.z)).toBeLessThan(1.4);
        }
      });
    }
    expect(disappearances).toBeGreaterThan(0);
    // A 60-fps scene must not trigger a full shadow pass on every frame.
    expect(updates).toBeLessThan(duration * 13);
  });

  it("hned odstraní stín po skrytí i po odebrání kamionu z konfigurace", () => {
    const a = new Group();
    const b = new Group();
    const refresh = new DynamicShadowRefresh();
    expect(refresh.update([a, b], 0)).toBe(true);
    a.visible = false;
    expect(refresh.update([a, b], 0.001)).toBe(true);
    expect(refresh.update([a], 0.002)).toBe(true);
    expect(refresh.update([], 0.003)).toBe(false);
  });

  it("po zastavení nebo pozastavení provozu doplní poslední polohu i uvnitř časového limitu", () => {
    const truck = new Group();
    const refresh = new DynamicShadowRefresh();
    expect(refresh.update([truck], 0)).toBe(true);
    truck.position.x = 0.5;
    expect(refresh.update([truck], 0.01)).toBe(false);
    // No subsequent live traffic tick is required after the final position is rendered.
    expect(refresh.update([truck], 0.02)).toBe(true);
    expect(refresh.update([truck], 0.03)).toBe(false);
  });

  it("u stojících a skrytých vozidel zůstává stínová mapa bez dalších přepočtů", () => {
    const parked = new Group();
    const hidden = new Group();
    hidden.visible = false;
    const refresh = new DynamicShadowRefresh();
    expect(refresh.update([parked, hidden], 0)).toBe(true);
    for (let frame = 1; frame <= 300; frame++) {
      hidden.position.x += 1;
      expect(refresh.update([parked, hidden], frame / 30)).toBe(false);
    }
    hidden.visible = true;
    expect(refresh.update([parked, hidden], 10.001)).toBe(true);
  });

  it("sleduje i natočení a změnu velikosti tělesa", () => {
    const truck = new Group();
    const refresh = new DynamicShadowRefresh();
    expect(refresh.update([truck], 0)).toBe(true);
    truck.rotation.y = Math.PI / 2;
    expect(refresh.update([truck], 1)).toBe(true);
    truck.scale.setScalar(0.5);
    expect(refresh.update([truck], 2)).toBe(true);
  });
});
