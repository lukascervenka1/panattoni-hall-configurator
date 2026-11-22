"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { MutableRefObject, RefObject } from "react";
import type { SurroundingsLayout } from "./layout";
import { buildDockTrucks, dockTruckPose } from "./dockTrucks";
import { buildParts, disposeParts } from "./TrafficView";
import { TruckBranding } from "./TruckBranding";
import { useTrafficWorld } from "./TrafficContext";
import { DynamicShadowRefresh } from "./dynamicShadows";

/**
 * Brandované kamiony u nakládacích doků: přijedou po silnici, couvají do doku, po vyložení odjedou (viz dockTrucks.ts).
 * Poloha je čistou funkcí času, zde se jen přepisují transformace skupin (bez překreslování Reactu). Při `live = false`
 * (úspora pohybu) stojí všechny u doků. Objeví se až po vysazení okolí (`ready`).
 */
export function DockTrucks({ layout, widthM, dockHouse, night, live, ready, clock, shadowLight }: { layout: SurroundingsLayout; widthM: number; dockHouse: boolean; night: boolean; live: boolean; ready: MutableRefObject<number>; /** Společné hodiny provozu (běží jen při zapnutém provozu). */ clock: MutableRefObject<number>; shadowLight: RefObject<THREE.DirectionalLight | null> }) {
  const world = useTrafficWorld();
  const renderClock = useThree((s) => s.clock);
  const invalidate = useThree((s) => s.invalidate);
  const shadowRefresh = useMemo(() => new DynamicShadowRefresh(), []);
  const trucks = useMemo(() => buildDockTrucks(layout, widthM, dockHouse), [layout, widthM, dockHouse]);
  const parts = useMemo(() => buildParts("truck"), []);
  useEffect(() => () => disposeParts(parts), [parts]);
  const groups = useRef<Array<THREE.Group | null>>([]);
  const lights = useRef<Array<{ tail: THREE.MeshStandardMaterial | null }>>([]);

  const apply = () => {
    trucks.forEach((v, i) => {
      const g = groups.current[i];
      if (!g) return;
      const p = world?.pose(v.id) ?? dockTruckPose(v, clock.current, live);
      g.visible = p.visible && ready.current >= 0.95;
      g.position.set(p.x, 0.06, p.z);
      g.rotation.y = p.rotY;
      const tail = lights.current[i]?.tail;
      if (tail) tail.emissiveIntensity = p.reversing ? 3 : p.moving ? (night ? 2.5 : 0.4) : 0.2;
    });
    // Run after applying the actual poses, so the same rendered frame clears the old truck silhouette.
    if (shadowRefresh.update(groups.current, renderClock.elapsedTime) && shadowLight.current) {
      shadowLight.current.shadow.needsUpdate = true;
      invalidate();
    }
  };
  useFrame(() => apply());
  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trucks, live]);

  return (
    <group>
      {trucks.map((v, i) => (
        <group key={v.id} ref={(el) => void (groups.current[i] = el)} visible={false}>
          <mesh geometry={parts.body} castShadow>
            <meshStandardMaterial color="#f1f3f3" roughness={0.65} metalness={0.1} />
          </mesh>
          {parts.cabPaint && <mesh geometry={parts.cabPaint} castShadow><meshStandardMaterial color="#001844" roughness={0.42} metalness={0.2} /></mesh>}
          {parts.trim && <mesh geometry={parts.trim}><meshStandardMaterial color="#303b46" roughness={0.7} /></mesh>}
          {parts.metal && <mesh geometry={parts.metal}><meshStandardMaterial color="#b6c0ca" roughness={0.4} metalness={0.55} /></mesh>}
          <TruckBranding />
          {parts.stripe && (
            <mesh geometry={parts.stripe}>
              <meshStandardMaterial color="#001844" roughness={0.5} />
            </mesh>
          )}
          {parts.cabin && (
            <mesh geometry={parts.cabin}>
              <meshStandardMaterial color="#16212c" roughness={0.1} metalness={0.85} />
            </mesh>
          )}
          <mesh geometry={parts.wheels}>
            <meshStandardMaterial color="#14161a" roughness={0.9} />
          </mesh>
          <mesh geometry={parts.headlights}>
            <meshStandardMaterial color="#f4f6f8" emissive="#fff5d6" emissiveIntensity={night ? 4 : 0.3} />
          </mesh>
          <mesh geometry={parts.taillights}>
            <meshStandardMaterial ref={(m) => void (lights.current[i] = { tail: m })} color="#7a1414" emissive="#ff2a2a" emissiveIntensity={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
