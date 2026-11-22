"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildCrownGeometry } from "./geometry";
import { Instanced, type InstanceItem } from "./Instanced";
import { FIELD_KINDS, type LandscapeLayout } from "./landscape";
import { flatRect, FIELD_TILE_M, type LandscapeTextures } from "./textures";

const CLOUD_COUNT = 14;

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Krajina za plotem: pole (pšenice, zelená plodina, orba, řepka, louka), meze se stromy, vzdálené kopce a mraky.
 * Ilustrativní, nejde o skutečné okolí. Pole jsou slité podle plodiny do jedné sítě (5 draw callů).
 */
export function Landscape({ land, hedges, forest, night, textures, live }: { land: LandscapeLayout; hedges: LandscapeLayout["hedges"]; forest: LandscapeLayout["forest"]; night: boolean; textures: LandscapeTextures; live: boolean }) {
  const crown = useMemo(() => buildCrownGeometry(), []);
  useEffect(() => () => crown.dispose(), [crown]);

  // Les: jednodušší koruna (jedna zploštělá ikosféra), ať stovky stromů nezatíží vykreslování.
  const forestCrown = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(3.1, 1);
    g.scale(1, 1.35, 1);
    g.translate(0, 6.6, 0);
    return g;
  }, []);
  useEffect(() => () => forestCrown.dispose(), [forestCrown]);
  const forestTrunks = useMemo<InstanceItem[]>(() => forest.map((p) => ({ x: p.x, z: p.z, y: 1.6 * p.scale, sx: p.scale, sy: p.scale * 1.3, sz: p.scale })), [forest]);
  const forestCrowns = useMemo<InstanceItem[]>(
    () => forest.map((p) => ({ x: p.x, z: p.z, y: 0, sx: p.scale, sy: p.scale, sz: p.scale, rotY: hash(p.x, p.z) * 6.28, color: [0x4f7a47, 0x5a8450, 0x466f40, 0x6a8f58, 0x557f4d][Math.floor(hash(p.z, p.x) * 5)]! })),
    [forest],
  );

  const fieldGeos = useMemo(() => {
    return FIELD_KINDS.map((kind) => {
      const parts = land.fields
        .filter((f) => f.kind === kind)
        .map((f) => flatRect(f.x0, f.x1, f.z0, f.z1, -0.08, FIELD_TILE_M, FIELD_TILE_M, f.rows === "z"));
      if (parts.length === 0) return [kind, null] as const;
      const merged = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      return [kind, merged] as const;
    });
  }, [land.fields]);
  useEffect(() => () => fieldGeos.forEach(([, g]) => g?.dispose()), [fieldGeos]);

  const trunks = useMemo<InstanceItem[]>(() => hedges.map((p) => ({ x: p.x, z: p.z, y: 1.1 * p.scale, sx: p.scale, sy: p.scale, sz: p.scale })), [hedges]);
  const crowns = useMemo<InstanceItem[]>(
    () =>
      hedges.map((p) => ({
        x: p.x,
        z: p.z,
        y: 0,
        sx: p.scale,
        sy: p.scale * 1.1,
        sz: p.scale,
        rotY: hash(p.x, p.z) * 6.28,
        color: [0x6f9a5b, 0x7da46a, 0x5f8a52, 0x88ad6f][Math.floor(hash(p.z, p.x) * 4)]!,
      })),
    [hedges],
  );

  return (
    <group>
      {fieldGeos.map(([kind, geo]) =>
        geo ? (
          <mesh key={kind} geometry={geo} receiveShadow>
            <meshStandardMaterial map={textures.fields[kind]} color={night ? "#5b6b66" : "#ffffff"} roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
          </mesh>
        ) : null,
      )}
      <Instanced items={forestTrunks} color="#5b4a3c">
        <cylinderGeometry args={[0.28, 0.36, 3.2, 6]} />
      </Instanced>
      <Instanced items={forestCrowns} roughness={0.95}>
        <primitive object={forestCrown} attach="geometry" />
      </Instanced>
      <Instanced items={trunks} color="#6b5646">
        <cylinderGeometry args={[0.25, 0.32, 2.4, 6]} />
      </Instanced>
      <Instanced items={crowns} roughness={0.95}>
        <primitive object={crown} attach="geometry" />
      </Instanced>

      {land.hills.map((h, i) => (
        <mesh key={i} position={[h.x, -h.ry * 0.3, h.z]} scale={[h.rx, h.ry, h.rz]}>
          <sphereGeometry args={[1, 28, 14]} />
          <meshStandardMaterial color={night ? "#1b2b2a" : new THREE.Color("#7f9a7c").lerp(new THREE.Color("#9ab097"), h.tone)} roughness={1} />
        </mesh>
      ))}
      {!night && <Clouds texture={textures.cloud} live={live} />}
    </group>
  );
}

/** Mraky: billboardy s procedurální texturou, pomalu plují. Bez pohybu při zapnuté úspoře pohybu. */
function Clouds({ texture, live }: { texture: THREE.Texture; live: boolean }) {
  const refs = useRef<Array<THREE.Sprite | null>>([]);
  const invalidate = useThree((s) => s.invalidate);
  const seeds = useMemo(
    () =>
      Array.from({ length: CLOUD_COUNT }, (_, i) => {
        const ang = hash(i, 1) * Math.PI * 2;
        const r = 600 + hash(i, 2) * 900;
        return { x: Math.cos(ang) * r, z: Math.sin(ang) * r, y: 260 + hash(i, 3) * 190, w: 420 + hash(i, 4) * 420, h: 140 + hash(i, 5) * 90, v: 2 + hash(i, 6) * 3, o: 0.78 + hash(i, 7) * 0.2 };
      }),
    [],
  );
  useFrame((_, delta) => {
    if (!live) return;
    const dt = Math.min(delta, 0.1);
    refs.current.forEach((s, i) => {
      if (!s) return;
      s.position.x += seeds[i]!.v * dt;
      if (s.position.x > 1700) s.position.x = -1700;
    });
  });
  useEffect(() => {
    invalidate();
  }, [invalidate]);
  return (
    <group>
      {seeds.map((c, i) => (
        <sprite key={i} ref={(el) => void (refs.current[i] = el)} position={[c.x, c.y, c.z]} scale={[c.w, c.h, 1]}>
          <spriteMaterial map={texture} transparent depthWrite={false} fog={false} opacity={c.o} />
        </sprite>
      ))}
    </group>
  );
}
