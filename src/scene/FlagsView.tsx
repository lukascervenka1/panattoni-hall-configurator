"use client";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { PlacedThing } from "./layout";
import { easeOut } from "./build";

const POLE_H = 8.6;
const BANNER = { w: 1.1, h: 4.3 };
/** Logo se na vlajce čte zdola nahoru (proporce 900 : 145 se nemění, jen se otočí). */
const LOGO_ASPECT = 900 / 145;

/** Bílé logo z brand manuálu jako textura; načítá se bez Suspense, ať scéna nečeká na obrázek. */
function useLogoTexture(): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let alive = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load("/brand/logo-white.png", (t) => {
      if (!alive) {
        t.dispose();
        return;
      }
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      loaded = t;
      setTexture(t);
      invalidate();
    });
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, [invalidate]);
  return texture;
}

/**
 * Vlajky u vjezdu do areálu: štíhlý stožár s příčkou a tmavě modrý prapor s bílým logem (fotografie z katalogu).
 * Ilustrace; vyrostou spolu s okolím (`env`).
 */
export function Flags({ flags, env }: { flags: PlacedThing[]; env: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const logo = useLogoTexture();
  useFrame(() => {
    if (group.current) group.current.scale.setScalar(Math.max(easeOut(env.current), 1e-3));
  });
  const logoW = BANNER.h * 0.78;
  const logoH = logoW / LOGO_ASPECT;
  return (
    <group ref={group}>
      {flags.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <mesh position={[0, POLE_H / 2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, POLE_H, 8]} />
            <meshStandardMaterial color="#8d949d" metalness={0.6} roughness={0.45} />
          </mesh>
          <mesh position={[BANNER.w / 2 - 0.05, POLE_H - 0.15, 0]}>
            <boxGeometry args={[BANNER.w + 0.1, 0.05, 0.05]} />
            <meshStandardMaterial color="#8d949d" metalness={0.6} roughness={0.45} />
          </mesh>
          <group position={[BANNER.w / 2 + 0.02, POLE_H - 0.2 - BANNER.h / 2, 0.04]}>
            <mesh>
              <planeGeometry args={[BANNER.w, BANNER.h]} />
              <meshStandardMaterial color="#001844" roughness={0.7} side={THREE.DoubleSide} />
            </mesh>
            {logo && (
              <mesh position={[0, 0, 0.012]} rotation={[0, 0, Math.PI / 2]}>
                <planeGeometry args={[logoW, logoH]} />
                <meshBasicMaterial map={logo} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} toneMapped={false} />
              </mesh>
            )}
          </group>
        </group>
      ))}
    </group>
  );
}
