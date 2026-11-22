"use client";
import { useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

type Mat = THREE.MeshBasicMaterial;

function useGlow(ref: MutableRefObject<Mat | null>, target: number, gate: MutableRefObject<number>, lambda = 3) {
  const value = useRef(target);
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, delta) => {
    const m = ref.current;
    if (!m) return;
    value.current = THREE.MathUtils.damp(value.current, target, lambda, Math.min(delta, 0.05));
    const next = value.current * gate.current;
    if (Math.abs(m.opacity - next) > 0.002) {
      m.opacity = next;
      m.visible = next > 0.004;
      invalidate();
    }
  });
}

const material = (ref: MutableRefObject<Mat | null>) => (
  <meshBasicMaterial ref={ref} vertexColors transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} />
);

/**
 * Denní světlo ze světlíků: sluneční paprsky v interiéru. Přes den plynule naběhnou (po dokončení stavby),
 * večer zhasnou. Přidává dojem prostoru, nijak nemění výpočty.
 */
export function LightShafts({ geometry, night, gate }: { geometry: THREE.BufferGeometry | null; night: boolean; gate: MutableRefObject<number> }) {
  const mat = useRef<Mat>(null);
  useGlow(mat, night ? 0 : 1, gate);
  if (!geometry) return null;
  return <mesh geometry={geometry} renderOrder={2}>{material(mat)}</mesh>;
}

/** Světelné skvrny pod svítidly: večer výrazné, přes den jen náznak; řízení podle denního světla je tlumí. */
export function LightPools({ geometry, night, sensors, gate }: { geometry: THREE.BufferGeometry | null; night: boolean; sensors: boolean; gate: MutableRefObject<number> }) {
  const mat = useRef<Mat>(null);
  useGlow(mat, (night ? 1 : 0.28) * (sensors ? 0.65 : 1), gate);
  if (!geometry) return null;
  return <mesh geometry={geometry} renderOrder={1}>{material(mat)}</mesh>;
}
