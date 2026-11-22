"use client";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { type Rect, type SurroundingsLayout } from "./layout";
import { Instanced, type InstanceItem } from "./Instanced";
import type { BuildAnim } from "./useBuildAnimation";
import { useConstructionReveal } from "./useConstructionReveal";
import { buildTraffic } from "./traffic";
import type { HallConfig } from "@/configurator/schema/config";
import { Traffic } from "./TrafficView";
import { RoadMarkings } from "./RoadMarkingsView";
import { ParkedCars } from "./ParkedCarsView";

function Surface({ rect, color, y = 0.05 }: { rect: Rect; color: string; y?: number }) {
  return <mesh position={[(rect.x0 + rect.x1) / 2, y, (rect.z0 + rect.z1) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
    <planeGeometry args={[rect.x1 - rect.x0, rect.z1 - rect.z0]} /><meshStandardMaterial color={color} roughness={0.94} />
  </mesh>;
}

/** A restrained architectural site; all traffic uses the same parking layout and vacant stalls. */
export function MinimalSite({ config, dockHouse, layout, night, live, build }: { config: HallConfig; dockHouse: boolean; layout: SurroundingsLayout; night: boolean; live: boolean; build: BuildAnim }) {
  const surfaces = useRef<THREE.Group>(null);
  const road = useMemo(() => ({ ...layout.road, x0: layout.plot.x0 - 20, x1: layout.plot.x1 + 20 }), [layout]);
  useConstructionReveal(surfaces, () => build.state.current.ground, layout.plot.z0 - 1, road.z1 + 1, "z");
  const vehicles = useMemo(() => buildTraffic({ ...layout, road }).filter((v) => v.mode === "parker" || v.id % 3 === 0), [layout, road]);
  const parked = useMemo(() => layout.stalls.filter((s) => s.occupied), [layout]);
  const trunks = useMemo<InstanceItem[]>(() => layout.parkingIslands.map((island) => ({ x: (island.x0 + island.x1) / 2, z: (island.z0 + island.z1) / 2, y: 1.1, sx: 0.2, sy: 2.2, sz: 0.2 })), [layout]);
  const crowns = useMemo(() => trunks.map((t, i) => ({ x: t.x, z: t.z, y: 3.1, sx: 1.15, sy: 1.5 + (i % 2) * 0.2, sz: 1.35 })), [trunks]);
  const stops = useMemo(() => parked.map((p) => ({ x: p.x, z: p.z + (p.z < layout.parking.z0 + 8 ? -1.9 : 1.9), y: 0.08, sx: 1.65, sy: 0.16, sz: 0.18 })), [parked, layout]);
  return <>
    <Surface rect={layout.plot} color={night ? "#303b42" : "#e8ebe5"} y={-0.07} />
    <group ref={surfaces}>
      {config.openings.dockCount > 0 && <Surface rect={layout.apron} color={night ? "#454e51" : "#d8ddd7"} />}
      {(config.openings.dockCount > 0 || config.openings.driveInCount > 0) && <Surface rect={layout.serviceRoad} color={night ? "#454e51" : "#d8ddd7"} />}
      <Surface rect={layout.parking} color={night ? "#434e52" : "#cbd1cc"} />
      <Surface rect={road} color={night ? "#3b464b" : "#aab5b0"} />
      <Surface rect={layout.driveway} color={night ? "#434e52" : "#cbd1cc"} />
      <Surface rect={layout.sidewalk} color={night ? "#596165" : "#f0f2ec"} y={0.09} />
      {layout.yard && <Surface rect={layout.yard} color={night ? "#454e51" : "#d8ddd7"} />}
      {layout.parkingIslands.map((island, i) => <Surface key={i} rect={island} color={night ? "#445247" : "#b9c4ad"} y={0.068} />)}
      <RoadMarkings layout={layout} road={road} night={night} serviceEnabled={config.openings.dockCount + config.openings.driveInCount > 0} />
    </group>
    <ParkedCars cars={layout.cars} reveal={build.env} night={night} minimalist />
    <Instanced items={trunks} reveal={build.env} assembly color="#858b7d"><boxGeometry /></Instanced>
    <Instanced items={crowns} reveal={build.env} assembly color={night ? "#4b6152" : "#91a184"} roughness={1} castShadow><icosahedronGeometry args={[1, 1]} /></Instanced>
    <Instanced items={stops} reveal={build.env} assembly color="#e2e6dd"><boxGeometry /></Instanced>
    <Traffic vehicles={vehicles} night={night} live={live} ready={build.env} minimalist bounds={road} />
  </>;
}
