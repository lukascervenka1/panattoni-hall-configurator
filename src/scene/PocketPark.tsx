"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Instanced, type InstanceItem } from "./Instanced";
import type { Rect, SurroundingsLayout } from "./layout";
import { layoutPocketPark, pondOutline, type ParkBench } from "./park";
import type { BuildAnim } from "./useBuildAnimation";
import { useConstructionReveal } from "./useConstructionReveal";
import { buildParkCrown, buildParkTrunk } from "./parkDetailGeometry";
import { ParkAmenities } from "./ParkAmenitiesView";

function outline(points: Array<[number, number]>) {
  const path = new THREE.Shape();
  points.forEach(([x, z], i) => i === 0 ? path.moveTo(x, -z) : path.lineTo(x, -z));
  path.closePath();
  return path;
}

function flatShape(shape: THREE.Shape) {
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

function rectangles(rects: Rect[]) {
  const parts = rects.map((r) => flatShape(outline([[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]])));
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return geometry;
}

function atBench(bench: ParkBench, x: number, y: number, z: number, sx: number, sy: number, sz: number): InstanceItem {
  return { x: bench.x + x * Math.cos(bench.rotY) + z * Math.sin(bench.rotY), y, z: bench.z - x * Math.sin(bench.rotY) + z * Math.cos(bench.rotY), sx, sy, sz, rotY: bench.rotY };
}

/** Simple matte water, faceted trees and shared furniture meshes. No extra render loop or reflection pass. */
export function PocketPark({ layout, night, build, includePatio }: { layout: SurroundingsLayout; night: boolean; build: BuildAnim; includePatio: boolean }) {
  const group = useRef<THREE.Group>(null);
  const park = useMemo(() => layoutPocketPark(layout), [layout]);
  const treeGeometry = useMemo(() => ({ crown: buildParkCrown(), trunk: buildParkTrunk() }), []);
  useEffect(() => () => Object.values(treeGeometry).forEach((g) => g.dispose()), [treeGeometry]);
  useConstructionReveal(group, () => build.state.current.ground, park.bounds.z0 - 1, park.bounds.z1 + 1, "z");
  const geometry = useMemo(() => {
    const water = flatShape(outline(pondOutline(park.pond)));
    const bank = outline(pondOutline(park.pond, 0.7));
    bank.holes.push(new THREE.Path(outline(pondOutline(park.pond)).getPoints().reverse()));
    const loop = outline(pondOutline(park.pond, 1.6));
    loop.holes.push(new THREE.Path(outline(pondOutline(park.pond, 0.7)).getPoints().reverse()));
    const b = park.bounds;
    const lawn = new THREE.Shape();
    const r = 4;
    lawn.moveTo(b.x0 + r, -b.z0);
    lawn.lineTo(b.x1 - r, -b.z0); lawn.quadraticCurveTo(b.x1, -b.z0, b.x1, -b.z0 - r);
    lawn.lineTo(b.x1, -b.z1 + r); lawn.quadraticCurveTo(b.x1, -b.z1, b.x1 - r, -b.z1);
    lawn.lineTo(b.x0 + r, -b.z1); lawn.quadraticCurveTo(b.x0, -b.z1, b.x0, -b.z1 + r);
    lawn.lineTo(b.x0, -b.z0 - r); lawn.quadraticCurveTo(b.x0, -b.z0, b.x0 + r, -b.z0);
    const paths = [...park.paths, ...park.benchPads, ...(includePatio ? [layout.path, layout.patio] : [])];
    return { water, bank: flatShape(bank), loop: flatShape(loop), lawn: flatShape(lawn), paths: rectangles(paths) };
  }, [park, layout, includePatio]);
  useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);

  const furniture = useMemo(() => {
    const wood: InstanceItem[] = [], metal: InstanceItem[] = [];
    for (const b of park.benches) {
      for (const z of [-0.17, 0, 0.17]) wood.push(atBench(b, 0, 0.53, z, 2.4, 0.07, 0.14));
      for (const y of [0.78, 0.98]) wood.push(atBench(b, 0, y, -0.26, 2.4, 0.14, 0.055));
      for (const x of [-0.86, 0.86]) {
        for (const z of [-0.18, 0.18]) metal.push(atBench(b, x, 0.29, z, 0.065, 0.46, 0.065));
        metal.push(atBench(b, x, 0.76, -0.28, 0.055, 0.54, 0.055));
      }
    }
    if (includePatio) for (const p of layout.tables) {
      for (const z of [-0.3, -0.1, 0.1, 0.3]) wood.push({ x: p.x, z: p.z + z, y: 0.82, sx: 1.9, sy: 0.055, sz: 0.18 });
      for (const dz of [-0.85, 0.85]) wood.push({ x: p.x, z: p.z + dz, y: 0.53, sx: 1.9, sy: 0.055, sz: 0.32 });
      for (const dx of [-0.7, 0.7]) metal.push({ x: p.x + dx, z: p.z, y: 0.44, sx: 0.07, sy: 0.76, sz: 1.7 });
    }
    // One small timber-clad bin beside the patio, assembled with the existing furniture batches.
    const bx = layout.sidewalk.x0 - 20.65, bz = layout.sidewalk.z0 + 5.8;
    metal.push({ x: bx, z: bz, y: 0.44, sx: 0.43, sy: 0.72, sz: 0.43 }, { x: bx, z: bz, y: 0.82, sx: 0.51, sy: 0.055, sz: 0.51 });
    for (const side of [-1, 1]) for (const offset of [-0.15, 0, 0.15]) {
      wood.push({ x: bx + offset, z: bz + side * 0.225, y: 0.41, sx: 0.12, sy: 0.6, sz: 0.025 });
      wood.push({ x: bx + side * 0.225, z: bz + offset, y: 0.41, sx: 0.025, sy: 0.6, sz: 0.12 });
    }
    return { wood, metal };
  }, [park, layout, includePatio]);
  const trunks = useMemo<InstanceItem[]>(() => park.trees.map((t, i) => ({ x: t.x, z: t.z, y: 1.45 * t.scale - 0.018, sx: t.scale, sy: t.scale, sz: t.scale, rotY: i * 1.7 })), [park]);
  const crowns = useMemo<InstanceItem[]>(() => park.trees.map((t, i) => ({ x: t.x, z: t.z, y: 3.8 * t.scale, sx: 1.7 * t.scale, sy: (2.1 + i % 2 * 0.25) * t.scale, sz: 1.65 * t.scale, rotY: i * 1.7, color: [0x91a184, 0xa3ae94, 0x83977e][i % 3] })), [park]);
  const reeds = useMemo<InstanceItem[]>(() => [3, 17, 31].flatMap((n) => {
    const [x, z] = pondOutline(park.pond, 0.35)[n]!;
    return [-0.2, 0, 0.2].map((dx, i) => ({ x: x + dx, z, y: 0.27 + i * 0.04, sx: 0.16, sy: 0.3 + i * 0.04, sz: 0.2 }));
  }), [park]);

  return <group ref={group}>
    <mesh geometry={geometry.lawn} position-y={-0.018} receiveShadow><meshStandardMaterial color={night ? "#3c4e45" : "#d4ddc9"} roughness={1} /></mesh>
    <mesh geometry={geometry.bank} position-y={0.04} receiveShadow><meshStandardMaterial color={night ? "#64706a" : "#c8cabb"} roughness={1} /></mesh>
    <mesh geometry={geometry.water} position-y={0.045}><meshStandardMaterial color={night ? "#3d6268" : "#91b1ad"} roughness={0.3} metalness={0.12} /></mesh>
    <mesh geometry={geometry.loop} position-y={0.06} receiveShadow><meshStandardMaterial color={night ? "#707975" : "#e1e3d9"} roughness={0.95} /></mesh>
    <mesh geometry={geometry.paths} position-y={0.065} receiveShadow><meshStandardMaterial color={night ? "#707975" : "#e1e3d9"} roughness={0.95} /></mesh>
    <Instanced items={furniture.wood} color={night ? "#827f72" : "#ad9f84"} roughness={0.85} reveal={build.env} assembly><boxGeometry /></Instanced>
    <Instanced items={furniture.metal} color="#3b4c5b" metalness={0.35} roughness={0.6} reveal={build.env} assembly><boxGeometry /></Instanced>
    <Instanced items={trunks} color="#8e9181" roughness={1} reveal={build.env} assembly><primitive object={treeGeometry.trunk} attach="geometry" /></Instanced>
    <Instanced items={crowns} roughness={1} reveal={build.env} assembly castShadow><primitive object={treeGeometry.crown} attach="geometry" /></Instanced>
    <Instanced items={reeds} color={night ? "#506a58" : "#8b9e7e"} roughness={1} reveal={build.env} assembly><icosahedronGeometry args={[1, 0]} /></Instanced>
    <ParkAmenities layout={layout} night={night} build={build} />
  </group>;
}
