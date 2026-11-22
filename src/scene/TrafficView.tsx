"use client";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { TruckBranding } from "./TruckBranding";
import { vehiclePose, type Vehicle } from "./traffic";

import type { Rect } from "./layout";
import { useTrafficWorld } from "./TrafficContext";

export { buildParts, disposeParts } from "./vehicleGeometry";
import { buildParts, disposeParts } from "./vehicleGeometry";

/**
 * Doprava: auta jedou po silnici, odbočují na příjezd, zajíždějí do volných stání a vyjíždějí zpět.
 * Poloha každého vozidla je čistou funkcí času (traffic.ts); zde se jen přepisují transformace skupin
 * (žádné překreslování Reactu). Při `live = false` (úspora pohybu) stojí vozidla na pevných místech.
 */
export function Traffic({ vehicles, night, live, ready, minimalist = false, bounds }: { vehicles: Vehicle[]; night: boolean; live: boolean; ready: MutableRefObject<number>; minimalist?: boolean; bounds?: Rect }) {
  const world = useTrafficWorld();
  const clipPlanes = useMemo(() => bounds ? [new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), bounds.x1)] : [], [bounds]);
  const invalidate = useThree((s) => s.invalidate);
  const parts = useMemo(() => ({ car: buildParts("car"), van: buildParts("van"), truck: buildParts("truck") }), []);
  useEffect(() => () => Object.values(parts).forEach(disposeParts), [parts]);
  const groups = useRef<Array<THREE.Group | null>>([]);
  const clock = useRef(40);

  const apply = () => {
    vehicles.forEach((v, i) => {
      const g = groups.current[i];
      if (!g) return;
      const p = world?.pose(`road-${v.id}`) ?? vehiclePose(v, clock.current);
      g.visible = p.visible && ready.current >= 0.95;
      g.position.set(p.x, 0.05, p.z);
      g.rotation.y = p.rotY;
    });
  };

  useFrame((_, delta) => {
    if (live && ready.current >= 0.95) clock.current += Math.min(delta, 0.1);
    apply();
  });
  useEffect(() => {
    apply();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, live]);

  const headI = night ? 5 : 0.3;
  const tailI = night ? 2.5 : 0.2;
  return (
    <group>
      {vehicles.map((v, i) => {
        const p = parts[v.kind];
        return (
          <group key={v.id} ref={(el) => void (groups.current[i] = el)} visible={false}>
            <mesh geometry={p.body}>
              <meshStandardMaterial clippingPlanes={clipPlanes} color={minimalist ? (i % 3 === 0 ? "#657175" : "#e0e4dd") : v.kind === "truck" ? "#eef1f4" : v.color} roughness={minimalist ? 0.65 : 0.35} metalness={v.kind === "truck" ? 0.15 : 0.55} />
            </mesh>
            {p.cabPaint && <mesh geometry={p.cabPaint}><meshStandardMaterial clippingPlanes={clipPlanes} color="#001844" roughness={0.42} metalness={0.2} /></mesh>}
            {p.trim && <mesh geometry={p.trim}><meshStandardMaterial clippingPlanes={clipPlanes} color="#303b46" roughness={0.7} /></mesh>}
            {p.metal && <mesh geometry={p.metal}><meshStandardMaterial clippingPlanes={clipPlanes} color="#b6c0ca" roughness={0.4} metalness={0.55} /></mesh>}
            {v.kind === "truck" && <TruckBranding clippingPlanes={clipPlanes} />}
            {p.cabin && (
              <mesh geometry={p.cabin}>
                <meshStandardMaterial clippingPlanes={clipPlanes} color="#263b48" roughness={0.18} metalness={0.35} />
              </mesh>
            )}
            {p.stripe && (
              <mesh geometry={p.stripe}>
                <meshStandardMaterial clippingPlanes={clipPlanes} color="#001844" roughness={0.5} />
              </mesh>
            )}
            <mesh geometry={p.wheels}>
              <meshStandardMaterial clippingPlanes={clipPlanes} color="#14161a" roughness={0.9} />
            </mesh>
            <mesh geometry={p.headlights}>
              <meshStandardMaterial clippingPlanes={clipPlanes} color="#f4f6f8" emissive="#fff5d6" emissiveIntensity={headI} />
            </mesh>
            <mesh geometry={p.taillights}>
              <meshStandardMaterial clippingPlanes={clipPlanes} color="#7a1414" emissive="#ff2a2a" emissiveIntensity={tailI} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
