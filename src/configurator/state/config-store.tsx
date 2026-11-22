"use client";
/**
 * Klientský stav produktové konfigurace (Zustand). Store se vytváří pro konkrétní veřejný katalog a po každé změně
 * konfiguraci normalizuje podle pravidel, takže uživatel nemůže vyrobit neplatný stav. Server validuje znovu.
 */
import { createContext, useContext, useRef, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { PublicCatalog } from "@/catalog/public";
import type { ParameterId } from "@/catalog/ids";
import { withParameter, type HallConfig } from "../schema/config";
import { createConfigFromProduct } from "../schema/defaults";
import { normalizeConfig } from "../rules/normalize";
import { configForOfficeFloors } from "../rules/office";

export interface ConfigState {
  catalog: PublicCatalog;
  config: HallConfig;
  setProduct: (productId: string) => void;
  setParameter: (id: ParameterId, value: number | boolean | string) => void;
  setOfficeFloors: (floors: HallConfig["office"]["floors"]) => void;
}

export function createConfigStore(catalog: PublicCatalog, productId?: string): StoreApi<ConfigState> {
  const first = productId ?? catalog.products[0]!.product_id;
  return createStore<ConfigState>((set) => ({
    catalog,
    config: normalizeConfig(createConfigFromProduct(catalog, first), catalog),
    setProduct: (id) => set((s) => ({ config: normalizeConfig(createConfigFromProduct(s.catalog, id), s.catalog) })),
    setParameter: (id, value) =>
      set((s) => ({ config: normalizeConfig(withParameter(s.config, id, value), s.catalog) })),
    setOfficeFloors: (floors) => set((s) => {
      const config = configForOfficeFloors(s.config, s.catalog, floors);
      return config ? { config } : s;
    }),
  }));
}

const Ctx = createContext<StoreApi<ConfigState> | null>(null);

export function ConfigProvider({ catalog, children }: { catalog: PublicCatalog; children: ReactNode }) {
  const ref = useRef<StoreApi<ConfigState> | null>(null);
  if (!ref.current) ref.current = createConfigStore(catalog);
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>;
}

export function useConfigStore<T>(selector: (s: ConfigState) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error("useConfigStore musí být uvnitř ConfigProvider.");
  return useStore(store, selector);
}
