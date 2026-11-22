"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { HallConfig } from "@/configurator/schema/config";
import type { BuildAnim } from "./useBuildAnimation";
import { buildParts, disposeParts } from "./TrafficView";
import { buildServiceOperations, servicePose } from "./service";
import { layoutSurroundings } from "./layout";
import { buildDockTrucks, dockTruckPose } from "./dockTrucks";
import { useTrafficWorld } from "./TrafficContext";

/** Bounded, shared geometry: service demonstrations use the existing lightweight render loop. */
export function ServiceTraffic({ config, dockHouse, build }: { config: HallConfig; dockHouse: boolean; build: BuildAnim }) {
  const world = useTrafficWorld();
  const operations = useMemo(() => buildServiceOperations(config, dockHouse), [config.dimensions, config.openings, dockHouse]);
  // Vozíky u prvních tří kamionů u doků jezdí mezi dokem a návěsem, jen když kamion stojí u doku.
  const dockTrucks = useMemo(() => buildDockTrucks(layoutSurroundings(config), config.dimensions.widthM, dockHouse).slice(0, 3), [config.dimensions, config.openings, dockHouse]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = useMemo(() => ({ truck: buildParts("truck"), van: buildParts("van") }), []);
  useEffect(() => () => Object.values(parts).forEach(disposeParts), [parts]);
  const vehicles = useRef<Array<THREE.Group | null>>([]);
  const loaders = useRef<Array<THREE.Group | null>>([]);
  useFrame(() => {
    const time = build.operationTime.current;
    operations.forEach((operation, index) => {
      const group = vehicles.current[index];
      if (!group) return;
      const pose = world?.pose(`gate-${operation.id}`) ?? { ...servicePose(operation, time), visible: true };
      group.visible = build.env.current >= 0.95 && pose.visible;
      group.position.set(pose.x, 0.06, pose.z);
      group.rotation.y = pose.rotY;
    });
    dockTrucks.forEach((truck, index) => {
      const loader = loaders.current[index];
      if (!loader) return;
      const pose = world?.pose(truck.id) ?? dockTruckPose(truck, time);
      loader.visible = build.env.current >= 0.95 && pose.visible && !pose.moving;
      loader.position.set(truck.dockX + 2.25, 0.06, -config.dimensions.widthM / 2 - (dockHouse ? 3.4 : 0.5) - 2.5 - (1 - Math.cos(time * 0.65 + index)) * 2);
    });
  });
  return <group>
    {operations.map((operation, i) => <group key={operation.id}>
      <group ref={(group) => { vehicles.current[i] = group; }} visible={false}>
        {Object.entries(parts[operation.kind]).map(([key, geometry]) => geometry && <mesh key={key} geometry={geometry}>
          <meshStandardMaterial color={key === "wheels" ? "#30383d" : key === "cabin" ? "#263b48" : key === "trim" ? "#45505a" : key === "metal" ? "#b6bec2" : key === "taillights" ? "#84504b" : key === "headlights" ? "#e7e9de" : "#dce2da"} roughness={key === "cabin" ? 0.18 : 0.65} metalness={0.15} />
        </mesh>)}
      </group>
    </group>)}
    {dockTrucks.map((truck, index) => (
      <group key={truck.id} ref={(group) => { loaders.current[index] = group; }} visible={false}>
        <mesh position={[0, 0.4, 0]}><boxGeometry args={[1.05, 0.7, 1.65]} /><meshStandardMaterial color="#89978d" /></mesh>
        <mesh position={[0, 1.25, 0.65]}><boxGeometry args={[0.12, 2.4, 0.18]} /><meshStandardMaterial color="#4d5a57" /></mesh>
        <mesh position={[0, 0.6, 1.05]}><boxGeometry args={[1.1, 0.12, 0.9]} /><meshStandardMaterial color="#6b7971" /></mesh>
        <mesh position={[0, 1.05, 1.05]}><boxGeometry args={[0.95, 0.75, 0.85]} /><meshStandardMaterial color="#c2b9a4" /></mesh>
        {[-0.52, 0.52].flatMap((x) => [-0.5, 0.5].map((z) => <mesh key={`${x},${z}`} position={[x, 0.23, z]}><boxGeometry args={[0.2, 0.42, 0.42]} /><meshStandardMaterial color="#41494b" /></mesh>))}
      </group>
    ))}
  </group>;
}
