"use client";
import { useEffect, useMemo } from "react";
import { Instanced, type InstanceItem } from "./Instanced";
import type { SurroundingsLayout } from "./layout";
import type { BuildAnim } from "./useBuildAnimation";
import { buildBicycle } from "./parkDetailGeometry";

export function ParkAmenities({ layout, night, build }: { layout: SurroundingsLayout; night: boolean; build: BuildAnim }) {
  const geometry = useMemo(buildBicycle, []);
  useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);
  const bicycles = useMemo<InstanceItem[]>(() => [0, 1].map((i) => ({ x: layout.sidewalk.x0 - 4.55, z: layout.sidewalk.z0 + 8 + i * 2.2, y: 0.05, color: i === 0 ? 0x001844 : 0x7d9180 })), [layout]);
  const bicycleParts = useMemo(() => bicycles.map(({ color: _color, ...position }) => position), [bicycles]);
  const racks = useMemo<InstanceItem[]>(() => [0, 1, 2].map((i) => ({ x: layout.sidewalk.x0 - 4.2, z: layout.sidewalk.z0 + 7.1 + i * 2.2, y: 0 })), [layout]);
  const lights = useMemo<InstanceItem[]>(() => [[-19, 3.1], [-22.85, -1.5], [-6.8, 13.8]].map(([x, z]) => ({ x: layout.sidewalk.x0 + x!, z: layout.sidewalk.z0 + z!, y: 0.37 })), [layout]);
  const caps = useMemo<InstanceItem[]>(() => lights.map((p) => ({ ...p, y: 0.66 })), [lights]);
  return <group>
    <Instanced items={bicycles} reveal={build.env} assembly roughness={0.6}><primitive object={geometry.frame} attach="geometry" /></Instanced>
    <Instanced items={bicycleParts} reveal={build.env} assembly color="#394448" roughness={0.9}><primitive object={geometry.tyres} attach="geometry" /></Instanced>
    <Instanced items={bicycleParts} reveal={build.env} assembly color="#96a1a2" metalness={0.5} roughness={0.5}><primitive object={geometry.metal} attach="geometry" /></Instanced>
    <Instanced items={bicycleParts} reveal={build.env} assembly color="#394448" roughness={0.85}><primitive object={geometry.saddle} attach="geometry" /></Instanced>
    <Instanced items={racks} reveal={build.env} assembly color="#849194" metalness={0.45} roughness={0.6}><primitive object={geometry.rack} attach="geometry" /></Instanced>
    <Instanced items={lights} reveal={build.env} assembly color="#667773" roughness={0.8}><cylinderGeometry args={[0.075, 0.075, 0.6, 8]} /></Instanced>
    <Instanced items={caps} reveal={build.env} assembly color="#e6e1d3" emissive="#ffe6b5" emissiveIntensity={night ? 1.1 : 0.02} roughness={0.6}><boxGeometry args={[0.16, 0.04, 0.16]} /></Instanced>
  </group>;
}
