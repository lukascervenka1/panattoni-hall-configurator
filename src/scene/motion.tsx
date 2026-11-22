"use client";
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import { easeOut } from "./build";

/**
 * Procedurální pohyb podle skillu threejs-animation: exponenciální přiblížení `MathUtils.damp` je nezávislé na
 * snímkové frekvenci. Používá se pro plynulé přechody při změně voleb z katalogu.
 */

/** Barva materiálu se plynule přelévá k cílové hodnotě (první nastavení je okamžité). */
export function useColorDamp(ref: MutableRefObject<THREE.MeshStandardMaterial | null>, hex: string, lambda = 7) {
  const target = useMemo(() => new THREE.Color(hex), [hex]);
  const invalidate = useThree((s) => s.invalidate);
  const first = useRef(true);

  useLayoutEffect(() => {
    const m = ref.current;
    if (m && first.current) {
      m.color.copy(target);
      first.current = false;
    }
    invalidate(); // spustí přechod i při režimu vykreslování na vyžádání
  }, [target, invalidate, ref]);

  useFrame((_, delta) => {
    const m = ref.current;
    if (!m) return;
    const c = m.color;
    const dist = Math.abs(c.r - target.r) + Math.abs(c.g - target.g) + Math.abs(c.b - target.b);
    if (dist < 1e-3) {
      if (dist > 0) c.copy(target);
      return;
    }
    const dt = Math.min(delta, 0.05);
    c.r = THREE.MathUtils.damp(c.r, target.r, lambda, dt);
    c.g = THREE.MathUtils.damp(c.g, target.g, lambda, dt);
    c.b = THREE.MathUtils.damp(c.b, target.b, lambda, dt);
    invalidate();
  });
}

type StdProps = Omit<ThreeElements["meshStandardMaterial"], "color" | "ref"> & { color: string; lambda?: number };

/** `meshStandardMaterial`, jehož barva se při změně plynule přelévá místo skoku. */
export function DampedStd({ color, lambda, ...rest }: StdProps) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useColorDamp(ref, color, lambda);
  return <meshStandardMaterial ref={ref} {...rest} />;
}

/**
 * Pokrok "objevení" prvku (0 → 1) po změně `key`. Při prvním vykreslení hned 1 (úvodní stavbu řídí režisér).
 * `gate` (např. pokrok vybavení) omezuje výsledek shora, takže se prvek neobjeví dřív, než se vysadí ostatní vybavení.
 */
export function useAppear(key: string, gate?: MutableRefObject<number>, durationS = 0.9): MutableRefObject<number> {
  const out = useRef(gate ? 0 : 1);
  const own = useRef(1);
  const lastKey = useRef<string | null>(null);
  const keyRef = useRef(key);
  keyRef.current = key;
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, delta) => {
    if (lastKey.current !== keyRef.current) {
      own.current = lastKey.current === null ? 1 : 0; // první klíč = bez animace
      lastKey.current = keyRef.current;
    }
    if (own.current < 1) {
      own.current = Math.min(1, own.current + Math.min(delta, 0.05) / durationS);
      invalidate();
    }
    out.current = Math.min(gate?.current ?? 1, own.current);
  });
  return out;
}

/** Zvedne objekt po výšce podle pokroku (`easeOut`); pivot je počátek skupiny. */
export function useGrowY(groupRef: MutableRefObject<THREE.Group | null>, progress: MutableRefObject<number>) {
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const e = easeOut(progress.current);
    g.scale.y = Math.max(e, 1e-3);
    g.visible = e > 0.002;
  });
}
