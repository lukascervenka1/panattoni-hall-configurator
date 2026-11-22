import { describe, expect, it } from "vitest";
import { publicCatalog } from "@/tests/helpers";
import { validateConfig } from "../rules/validate";
import { configForOfficeFloors } from "../rules/office";
import { createConfigStore } from "./config-store";
import { displayConfig, stepSceneValues, valuesOf } from "@/scene/build";
import { placeOpenings } from "../calculations/layout";

describe("výběr podlaží administrativy", () => {
  it.each(["logistics", "production"])("%s: volba tří podlaží jedním krokem zvýší halu i vykreslený model", (product) => {
    const store = createConfigStore(publicCatalog, product);
    const before = store.getState().config;
    const observed: number[] = [];
    const unsubscribe = store.subscribe((s) => {
      expect(validateConfig(s.config, publicCatalog).ok).toBe(true);
      observed.push(s.config.office.floors);
    });
    store.getState().setOfficeFloors(3);
    unsubscribe();
    const target = store.getState().config;
    expect(observed).toEqual([3]);
    expect(target.office.floors).toBe(3);
    expect(target.dimensions.clearHeightM).toBe(11);
    expect(before.dimensions.clearHeightM).toBeLessThan(11);
    const shown = displayConfig(target, stepSceneValues(valuesOf(before), valuesOf(target), 1 / 60));
    expect(shown.office.floors).toBe(3);
    expect(new Set(placeOpenings(shown).filter((o) => o.kind === "window").map((o) => o.floor))).toEqual(new Set([0, 1, 2]));
  });

  it("městský koncept nepřekročí limit výšky a nepřepne se potichu na jiné podlaží", () => {
    const store = createConfigStore(publicCatalog, "city_logistics");
    const before = store.getState();
    expect(configForOfficeFloors(before.config, publicCatalog, 3)).toBeNull();
    store.getState().setOfficeFloors(3);
    expect(store.getState()).toBe(before);
  });

  it("nižší počet podlaží nesníží halu; ruční snížení výšky zachová platnou vestavbu", () => {
    const store = createConfigStore(publicCatalog);
    store.getState().setOfficeFloors(3);
    store.getState().setOfficeFloors(1);
    expect(store.getState().config.dimensions.clearHeightM).toBe(11);
    store.getState().setOfficeFloors(3);
    store.getState().setParameter("clear_height_m", 10);
    expect(store.getState().config.office.floors).toBe(2);
    expect(validateConfig(store.getState().config, publicCatalog).ok).toBe(true);
  });

  it("potřebnou výšku přichytí na vyšší povolený krok", () => {
    const catalog = structuredClone(publicCatalog);
    const step = catalog.rules.find((r) => r.product_id === "logistics" && r.parameter_id === "clear_height_m" && r.rule_type === "step")!;
    step.value = "2";
    const store = createConfigStore(catalog, "logistics");
    store.getState().setOfficeFloors(3);
    expect(store.getState().config.office.floors).toBe(3);
    expect(store.getState().config.dimensions.clearHeightM).toBe(12);
    expect(validateConfig(store.getState().config, catalog).ok).toBe(true);
  });
});
