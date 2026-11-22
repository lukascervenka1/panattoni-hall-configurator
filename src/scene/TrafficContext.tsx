"use client";
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { HallConfig } from "@/configurator/schema/config";
import type { SurroundingsLayout } from "./layout";
import type { BuildAnim } from "./useBuildAnimation";
import { TrafficWorld } from "./trafficWorld";

const Context = createContext<TrafficWorld | null>(null);
export function useTrafficWorld() { return useContext(Context); }

/** One controller for all visible traffic, shared by gate animation and every vehicle renderer. */
export function TrafficProvider({ config, layout, dockHouse, minimalist, live, build, children }: { config: HallConfig; layout: SurroundingsLayout; dockHouse: boolean; minimalist: boolean; live: boolean; build: BuildAnim; children: ReactNode }) {
  const signature = JSON.stringify([config.dimensions, config.openings, config.office, dockHouse, minimalist]);
  // Material/UI updates preserve the traffic state. Routes rebuild only when the actual site changes.
  const world = useMemo(() => new TrafficWorld(config, layout, dockHouse, minimalist), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastClock = useRef(0);
  useFrame((_, delta) => {
    // A replay resets vehicle clocks with the rest of the scene, using the same already allocated routes.
    const clock = build.operationTime.current;
    if (clock < lastClock.current) world.reset();
    lastClock.current = clock;
    if (live && build.env.current >= 0.95) world.step(delta);
  }, -0.5);
  return <Context.Provider value={world}>{children}</Context.Provider>;
}
