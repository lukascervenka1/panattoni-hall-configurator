"use client";
import { useLayoutEffect, useMemo, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { clamp01 } from "./build";

/** Reveal actual geometry at full scale; doors, panels and windows keep their proportions. */
export function useConstructionReveal(group: RefObject<THREE.Group | null>, progress: () => number, min: number, max: number, axis: "x" | "y" | "z" = "x", extra?: THREE.Plane) {
  const plane = useMemo(() => new THREE.Plane(axis === "x" ? new THREE.Vector3(-1, 0, 0) : (axis === "y" ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1)), min), [axis]);
  // Druhá rovina (např. řez halou) je v poli pořád, ať se počet ořezových rovin za běhu nemění (jinak by se přeložily shadery).
  const planes = useMemo(() => (extra ? [plane, extra] : [plane]), [plane, extra]);
  // New geometry or a material variant can be attached after any configuration render.
  useLayoutEffect(() => {
    group.current?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material.clippingPlanes !== planes) {
          material.clippingPlanes = planes;
          material.clipShadows = true;
          material.needsUpdate = true;
        }
      }
    });
  });
  useFrame(() => {
    const p = clamp01(progress());
    plane.constant = min + (max - min) * p;
    if (group.current) group.current.visible = p > 0.001;
  });
}
