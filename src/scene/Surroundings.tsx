"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { OBJECT_SIZES, type Rect, type SurroundingsLayout } from "./layout";
import { Instanced, type InstanceItem } from "./Instanced";
import { flatRect, localFlatRect, TILE, type SceneTextures } from "./textures";
import { easeOut } from "./build";
import { Flags } from "./FlagsView";
import type { BuildAnim } from "./useBuildAnimation";
import { RoadMarkings } from "./RoadMarkingsView";
import { ParkedCars } from "./ParkedCarsView";

const TREE_COLORS = [0x6f9a5b, 0x7da46a, 0x5f8a52, 0x88ad6f];
const BUSH_COLORS = [0x5f8a52, 0x4f7a47, 0x6f9a5b, 0x557f4d];

function hash(a: number, b: number) {
  let h = (Math.round(a * 10) * 374761393 + Math.round(b * 10) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Plocha ze světových metrů; geometrie se uvolní při změně a odmontování. */
function Ground({
  rect,
  y,
  map,
  color,
  roughness = 0.95,
  local,
  tileW,
  tileD,
  receiveShadow = true,
}: {
  rect: Rect;
  y: number;
  map: THREE.Texture;
  color: string;
  roughness?: number;
  local?: boolean;
  tileW: number;
  tileD: number;
  receiveShadow?: boolean;
}) {
  const geo = useMemo(
    () => (local ? localFlatRect : flatRect)(rect.x0, rect.x1, rect.z0, rect.z1, y, tileW, tileD),
    [rect.x0, rect.x1, rect.z0, rect.z1, y, tileW, tileD, local],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} receiveShadow={receiveShadow}>
      <meshStandardMaterial map={map} color={color} roughness={roughness} />
    </mesh>
  );
}

function useGeometry(build: () => THREE.BufferGeometry) {
  const g = useMemo(build, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

/**
 * Ilustrativní okolí: komunikace, příjezd, manipulační plocha, parkování, chodník, zeleň, osvětlení, kamiony a lidé.
 * Vše má pevné rozměry a rozmístění vychází z čisté funkce layoutSurroundings (nikdy uvnitř budovy).
 */
export function Surroundings({
  layout,
  slabLayout,
  night,
  textures,
  build,
  serviceEnabled = true,
}: {
  /** Cílové okolí: z něj se rozmísťují auta, stromy, kamiony a stožáry (vyrůstají po doběhu růstu haly). */
  layout: SurroundingsLayout;
  /** Okolí odpovídající zobrazené (animované) hale: plochy a komunikace rostou spolu s ní. */
  slabLayout: SurroundingsLayout;
  night: boolean;
  textures: SceneTextures;
  build: BuildAnim;
  serviceEnabled?: boolean;
}) {
  const { cars, trees, people, poles, fence, guardhouse, bushes, tables, flags } = layout;
  const { plot, apron, parking, road, driveway, sidewalk, yard, patio, path } = slabLayout;
  const groundRef = useRef<THREE.Group>(null);
  const guardRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = Math.max(build.state.current.ground, 1e-3);
    if (groundRef.current) groundRef.current.scale.set(g, 1, g);
    if (guardRef.current) {
      const e = easeOut(build.env.current);
      guardRef.current.scale.setScalar(Math.max(e, 1e-3));
    }
  });
  const env = build.env;

  // Sdílená geometrie korun stromů (tři spojené koule).
  const crownGeo = useGeometry(() => {
    const parts = [
      { r: 2.5, p: [0, 4.3, 0] },
      { r: 1.9, p: [1.4, 3.6, 0.7] },
      { r: 1.8, p: [-1.2, 3.5, -0.9] },
    ].map(({ r, p }) => {
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.translate(p[0]!, p[1]!, p[2]!);
      return g.toNonIndexed();
    });
    return mergeGeometries(parts, false)!;
  });

  const trunks = useMemo<InstanceItem[]>(() => trees.map((p) => ({ x: p.x, z: p.z, y: 1.1 * p.scale, sx: p.scale, sy: p.scale, sz: p.scale })), [trees]);
  const crowns = useMemo<InstanceItem[]>(
    () => trees.map((p) => ({ x: p.x, z: p.z, y: 0, sx: p.scale, sy: p.scale * 1.1, sz: p.scale, rotY: hash(p.x, p.z) * 6.28, color: TREE_COLORS[Math.floor(hash(p.z, p.x) * TREE_COLORS.length)]! })),
    [trees],
  );
  const bushItems = useMemo<InstanceItem[]>(
    () => bushes.map((p) => ({ x: p.x, z: p.z, y: 0.55 * p.scale, sx: 1.15 * p.scale, sy: 0.75 * p.scale, sz: p.scale, rotY: hash(p.x, p.z) * 6.28, color: BUSH_COLORS[Math.floor(hash(p.z, p.x) * BUSH_COLORS.length)]! })),
    [bushes],
  );
  // Stoly na posezení: deska, dvě lavice a dvě podpěry.
  const tableTops = useMemo<InstanceItem[]>(() => tables.map((p) => ({ x: p.x, z: p.z, y: 0.76, sx: 1.9, sy: 0.05, sz: 0.8 })), [tables]);
  const tableSeats = useMemo<InstanceItem[]>(() => tables.flatMap((p) => [-0.85, 0.85].map((dz) => ({ x: p.x, z: p.z + dz, y: 0.46, sx: 1.9, sy: 0.05, sz: 0.3 }))), [tables]);
  const tableLegs = useMemo<InstanceItem[]>(() => tables.flatMap((p) => [-0.7, 0.7].map((dx) => ({ x: p.x + dx, z: p.z, y: 0.38, sx: 0.07, sy: 0.76, sz: 1.7 }))), [tables]);
  const peopleItems = useMemo<InstanceItem[]>(
    () => people.map((p, i) => ({ x: p.x, z: p.z, y: OBJECT_SIZES.person.heightM / 2 + 0.05, color: [0x001844, 0x565655, 0x1a9bd7][i % 3]! })),
    [people],
  );
  const poleItems = useMemo<InstanceItem[]>(() => poles.map((p) => ({ x: p.x, z: p.z, y: 4.5, sx: 1, sy: 1, sz: 1 })), [poles]);
  const poleHeads = useMemo<InstanceItem[]>(() => poles.map((p) => ({ x: p.x + 0.8, z: p.z, y: 9.0, sx: 1.6, sy: 0.14, sz: 0.4 })), [poles]);

  const postItems = useMemo<InstanceItem[]>(() => fence.posts.map((p) => ({ x: p.x, z: p.z, y: 0.9, sx: 0.1, sy: 1.8, sz: 0.1 })), [fence]);
  const railItems = useMemo<InstanceItem[]>(
    () => fence.rails.flatMap((r) => [0.55, 1.2, 1.7].map((y) => ({ x: r.x, z: r.z, y, sx: r.axis === "x" ? r.lengthM : 0.04, sy: 0.04, sz: r.axis === "x" ? 0.04 : r.lengthM }))),
    [fence],
  );

  return (
    <group>
      <group ref={groundRef}>
      <Ground rect={plot} y={-0.04} map={textures.grass} color="#ffffff" tileW={TILE.grass} tileD={TILE.grass} />
      <Ground rect={apron} y={0.05} map={textures.concrete} color="#9a9ea4" roughness={0.85} tileW={TILE.concrete} tileD={TILE.concrete} />
      <Ground rect={parking} y={0.05} map={textures.asphalt} color="#737e80" tileW={TILE.asphalt} tileD={TILE.asphalt} />
      <Ground rect={driveway} y={0.05} map={textures.asphalt} color="#565b62" tileW={TILE.asphalt} tileD={TILE.asphalt} />
      <Ground rect={road} y={0.05} map={textures.asphalt} color="#737e80" tileW={TILE.asphalt} tileD={TILE.asphalt} />
      {serviceEnabled && <Ground rect={slabLayout.serviceRoad} y={0.05} map={textures.asphalt} color="#858e8d" tileW={TILE.asphalt} tileD={TILE.asphalt} />}
      <RoadMarkings layout={slabLayout} road={road} night={night} serviceEnabled={serviceEnabled} />
      {yard && <Ground rect={yard} y={0.05} map={textures.concrete} color="#9a9ea4" roughness={0.85} tileW={TILE.concrete} tileD={TILE.concrete} />}
      <Ground rect={path} y={0.09} map={textures.concrete} color="#b4b8bd" roughness={0.8} tileW={3} tileD={3} />
      <Ground rect={patio} y={0.07} map={textures.concrete} color="#c3bfb6" roughness={0.85} tileW={3} tileD={3} />
      <Ground rect={sidewalk} y={0.09} map={textures.concrete} color="#b4b8bd" roughness={0.8} tileW={3} tileD={3} />
      </group>

      <ParkedCars cars={cars} reveal={env} night={night} />

      {/* zeleň */}
      <Instanced items={trunks} reveal={env} color="#6b5646">
        <cylinderGeometry args={[0.25, 0.32, 2.4, 6]} />
      </Instanced>
      <Instanced items={crowns} reveal={env} roughness={0.95}>
        <primitive object={crownGeo} attach="geometry" />
      </Instanced>

      <Flags flags={flags} env={env} />

      {/* keře a posezení */}
      <Instanced items={bushItems} reveal={env} roughness={0.95}>
        <sphereGeometry args={[0.8, 10, 8]} />
      </Instanced>
      <Instanced items={tableTops} reveal={env} color="#b08a5b" roughness={0.8}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={tableSeats} reveal={env} color="#a07b4e" roughness={0.8}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={tableLegs} reveal={env} color="#3a4048" roughness={0.6} metalness={0.4}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>

      {/* stožáry osvětlení */}
      <Instanced items={poleItems} reveal={env} color="#6f7782" metalness={0.7} roughness={0.5} castShadow>
        <cylinderGeometry args={[0.12, 0.17, 9, 8]} />
      </Instanced>
      <Instanced items={poleHeads} reveal={env} color="#d9dde2" emissive="#fff1cf" emissiveIntensity={night ? 4 : 0.15}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>

      <Instanced items={peopleItems} reveal={env} roughness={0.7}>
        <capsuleGeometry args={[OBJECT_SIZES.person.radiusM, OBJECT_SIZES.person.heightM - 2 * OBJECT_SIZES.person.radiusM, 4, 8]} />
      </Instanced>

      {/* plot areálu s vjezdem */}
      <Instanced items={postItems} reveal={env} color="#59606a" metalness={0.5} roughness={0.5}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={railItems} reveal={env} color="#8d949d" metalness={0.5} roughness={0.5}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>

      {/* vrátnice u příjezdu */}
      <group ref={guardRef} position={[guardhouse.x, 0, guardhouse.z]}>
        <mesh position={[0, 1.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 2.8, 3]} />
          <meshStandardMaterial color="#d9dde2" roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[0, 2.95, 0]} castShadow>
          <boxGeometry args={[3.5, 0.2, 3.5]} />
          <meshStandardMaterial color="#001844" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.7, 1.51]}>
          <boxGeometry args={[2.2, 1.1, 0.04]} />
          <meshStandardMaterial color={night ? "#e8c88c" : "#8fb0c6"} emissive={night ? "#ffb347" : "#000000"} emissiveIntensity={night ? 1.4 : 0} roughness={0.08} metalness={night ? 0.2 : 0.9} />
        </mesh>
      </group>
    </group>
  );
}
