"use client";
import { useEffect, useMemo, type MutableRefObject } from "react";
import { Instanced, type InstanceItem } from "./Instanced";
import type { CarPlacement } from "./layout";
import { buildParts, disposeParts } from "./vehicleGeometry";

/** Parking uses the same real-size car as moving traffic, in shared material batches. */
export function ParkedCars({ cars, reveal, night, minimalist = false }: { cars: CarPlacement[]; reveal: MutableRefObject<number>; night: boolean; minimalist?: boolean }) {
  const geometry = useMemo(() => buildParts("car"), []);
  useEffect(() => () => disposeParts(geometry), [geometry]);
  const positions = useMemo<InstanceItem[]>(() => cars.map((car) => ({ x: car.x, z: car.z, y: 0.05, rotY: car.rotY })), [cars]);
  const paint = useMemo<InstanceItem[]>(() => positions.map((position, i) => ({ ...position, color: minimalist ? [0xd9dfdc, 0x77868a, 0xf0efea, 0x2c4360, 0xb2beb6][i % 5] : cars[i]!.color })), [positions, cars, minimalist]);
  return <group>
    <Instanced items={paint} reveal={reveal} assembly roughness={0.42} metalness={0.25} castShadow><primitive object={geometry.body} attach="geometry" /></Instanced>
    <Instanced items={positions} reveal={reveal} assembly color="#263b48" roughness={0.18} metalness={0.35}><primitive object={geometry.cabin!} attach="geometry" /></Instanced>
    <Instanced items={positions} reveal={reveal} assembly color="#30383d" roughness={0.85}><primitive object={geometry.wheels} attach="geometry" /></Instanced>
    <Instanced items={positions} reveal={reveal} assembly color="#45505a" roughness={0.65}><primitive object={geometry.trim!} attach="geometry" /></Instanced>
    <Instanced items={positions} reveal={reveal} assembly color="#b6bec2" roughness={0.38} metalness={0.55}><primitive object={geometry.metal!} attach="geometry" /></Instanced>
    <Instanced items={positions} reveal={reveal} assembly color="#e7e9de" roughness={0.35}><primitive object={geometry.headlights} attach="geometry" /></Instanced>
    <Instanced items={positions} reveal={reveal} assembly color={night ? "#71433e" : "#84504b"} roughness={0.4}><primitive object={geometry.taillights} attach="geometry" /></Instanced>
  </group>;
}
