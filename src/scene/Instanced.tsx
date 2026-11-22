"use client";
import { useLayoutEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { easeOut } from "./build";

export interface InstanceItem {
  x: number;
  y: number;
  z: number;
  sx?: number;
  sy?: number;
  sz?: number;
  rotY?: number;
  color?: number;
}

/**
 * Jedna instancovaná síť pro mnoho stejných prvků (auta, sloupy, regály, stromy): jeden draw call a sdílená
 * geometrie i materiál. Geometrie se předává jako potomek a R3F ji při odmontování uvolní.
 *
 * `reveal` (0..1, mutovatelná reference) řídí postupné "vyrůstání" prvků ze země: každý má své zpoždění
 * (`stagger` = podíl časové osy, který zabírá rozložení) a roste od terénu (poloha y i měřítko se násobí).
 * Při reveal = 1 se nic nepočítá navíc. Při změně počtu se síť vytvoří znovu (klíč podle počtu).
 */
export function Instanced({
  items,
  children,
  color = "#ffffff",
  roughness = 0.85,
  metalness = 0,
  castShadow = false,
  receiveShadow = false,
  emissive,
  emissiveIntensity = 0,
  reveal,
  stagger = 0.65,
  assembly = false,
}: {
  items: InstanceItem[];
  children: ReactNode;
  color?: string;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  reveal?: MutableRefObject<number>;
  stagger?: number;
  /** Osazení konstrukčních dílů v prostorovém pořadí, bez deformace jejich měřítka. */
  assembly?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(-1);
  const invalidate = useThree((s) => s.invalidate);

  // Pořadí vyrůstání: deterministické promíchání (ne podle indexu, aby neroste "řada po řadě").
  const order = useMemo(() => {
    const n = items.length;
    if (assembly) {
      const xs = items.map((item) => item.x);
      const min = Math.min(...xs);
      const span = Math.max(1, Math.max(...xs) - min);
      return Float32Array.from(items, (item) => (item.x - min) / span);
    }
    return Float32Array.from({ length: n }, (_, i) => {
      let h = (i * 2654435761) >>> 0;
      h ^= h >>> 15;
      h = Math.imul(h, 2246822519) >>> 0;
      return (h >>> 0) / 4294967296;
    });
  }, [items, assembly]);

  const write = (r: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const c = new THREE.Color();
    const MIN = new THREE.Vector3(1e-4, 1e-4, 1e-4);
    items.forEach((it, i) => {
      const e = r >= 1 ? 1 : easeOut(r * (1 + stagger) - order[i]! * stagger);
      q.setFromAxisAngle(axis, it.rotY ?? 0);
      const size = assembly ? (e > 0.002 ? 1 : 0) : e;
      // Structural pieces retain their shape and settle into position in rows.
      m.compose(
        pos.set(it.x, assembly ? it.y + (1 - e) * 1.5 : it.y * e, it.z),
        q,
        scale.set((it.sx ?? 1) * size, (it.sy ?? 1) * size, (it.sz ?? 1) * size).max(MIN),
      );
      mesh.setMatrixAt(i, m);
      if (it.color !== undefined) mesh.setColorAt(i, c.setHex(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    applied.current = r;
    invalidate();
  };

  useLayoutEffect(() => {
    write(reveal?.current ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, order]);

  useFrame(() => {
    const r = reveal?.current ?? 1;
    if (r !== applied.current) write(r);
  });

  if (items.length === 0) return null;
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, items.length]}
      frustumCulled={false}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {children}
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
      />
    </instancedMesh>
  );
}
