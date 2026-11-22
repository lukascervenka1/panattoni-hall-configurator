"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useFrame, useThree } from "@react-three/fiber";
import { ROBOT, robotPose, type Robot } from "./robots";

/** Shared original wordmark, loaded without blocking the scene. */
function useRobotLogo() {
  const [logo, setLogo] = useState<THREE.Texture | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  useEffect(() => {
    let alive = true;
    const texture = new THREE.TextureLoader().load("/brand/logo-white.png", (loaded) => {
      if (!alive) return;
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = Math.min(8, anisotropy);
      setLogo(loaded);
      invalidate();
    });
    return () => { alive = false; texture.dispose(); };
  }, [invalidate, anisotropy]);
  return logo;
}

/** All robots share six small geometries, including both side logos in one draw call. */
function robotGeometry() {
  const box = (x: number, y: number, z: number, cx: number, cy: number, cz: number, radius = 0.015) =>
    new RoundedBoxGeometry(x, y, z, 2, radius).translate(cx, cy, cz);
  const cylinder = (radius: number, height: number, x: number, y: number, z: number, wheel = false) => {
    const g = new THREE.CylinderGeometry(radius, radius, height, 12);
    if (wheel) g.rotateX(Math.PI / 2);
    return g.translate(x, y, z);
  };
  const merge = (parts: THREE.BufferGeometry[]) => {
    const plain = parts.map((g) => g.index ? g.toNonIndexed() : g);
    const result = mergeGeometries(plain, false)!;
    for (const g of new Set([...parts, ...plain])) g.dispose();
    return result;
  };
  const geometry = {
    body: box(ROBOT.lengthM / ROBOT.modelScale, ROBOT.heightM / ROBOT.modelScale - 0.04, ROBOT.widthM / ROBOT.modelScale, 0, 0.3, 0, 0.07),
    metal: merge([
      box(0.76, 0.045, 0.58, -0.06, 0.45, 0),
      ...[-1, 1].flatMap((x) => [-1, 1].map((z) => cylinder(0.055, 0.08, x * 0.31, 0.18, z * 0.315, true))),
    ]),
    dark: merge([
      box(0.9, 0.075, 0.62, 0, 0.17, 0, 0.03),
      ...[-1, 1].map((x) => box(0.055, 0.09, 0.58, x * 0.505, 0.28, 0, 0.025)),
      ...[-1, 1].flatMap((x) => [-1, 1].map((z) => cylinder(0.11, 0.07, x * 0.31, 0.18, z * 0.315, true))),
      cylinder(0.075, 0.08, 0.36, 0.48, 0),
      ...[-1, 1].map((z) => box(0.84, 0.18, 0.014, 0, 0.3, z * 0.359, 0.006)),
    ]),
    lights: merge([
      ...[-1, 1].map((x) => box(0.012, 0.025, 0.24, x * 0.535, 0.31, 0, 0.005)),
      ...[-1, 1].map((z) => box(0.1, 0.025, 0.014, 0.28, 0.31, z * 0.36, 0.005)),
    ]),
    cargo: merge([
      box(0.58, 0.34, 0.44, -0.06, 0.65, 0, 0.025),
      box(0.61, 0.045, 0.47, -0.06, 0.82, 0, 0.01),
      ...[-1, 1].flatMap((z) => [-0.24, -0.06, 0.12].map((x) => box(0.02, 0.24, 0.02, x, 0.65, z * 0.225, 0.005))),
    ]),
    branding: merge([-1, 1].map((side) => new THREE.PlaneGeometry(0.7, 0.7 / (900 / 145))
      .rotateY(side === -1 ? Math.PI : 0).translate(0, 0.3, side * 0.371))),
  };
  // Enlarge all details together, keeping wheel contact exactly on the floor at y = 0.07 m.
  for (const g of Object.values(geometry)) g.translate(0, -0.07, 0).scale(ROBOT.modelScale, ROBOT.modelScale, ROBOT.modelScale).translate(0, 0.07, 0);
  return geometry;
}

/** Live AMRs with a loading pause and smooth turns. Animation only writes instance matrices, without React state. */
export function Robots({ robots, live, gate }: { robots: Robot[]; live: boolean; gate: MutableRefObject<number> }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const metal = useRef<THREE.InstancedMesh>(null);
  const dark = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const cargo = useRef<THREE.InstancedMesh>(null);
  const branding = useRef<THREE.InstancedMesh>(null);
  const logo = useRobotLogo();
  const geometry = useMemo(robotGeometry, []);
  const scratch = useMemo(() => ({
    matrix: new THREE.Matrix4(), quaternion: new THREE.Quaternion(), axis: new THREE.Vector3(0, 1, 0),
    position: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1), hidden: new THREE.Vector3(1e-4, 1e-4, 1e-4),
  }), []);
  const clock = useRef(0);
  const lastGate = useRef(-1);
  const invalidate = useThree((s) => s.invalidate);
  const count = robots.length;
  useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);

  const write = () => {
    const meshes = [body.current, metal.current, dark.current, lights.current, branding.current, cargo.current];
    if (meshes.some((m) => !m)) return;
    const shown = gate.current >= 0.95;
    const { matrix, quaternion, axis, position, one, hidden } = scratch;
    robots.forEach((r, i) => {
      const p = robotPose(r, clock.current);
      quaternion.setFromAxisAngle(axis, -p.rotY);
      position.set(p.x, 0, p.z);
      matrix.compose(position, quaternion, shown ? one : hidden);
      for (let part = 0; part < meshes.length - 1; part++) meshes[part]!.setMatrixAt(i, matrix);
      if (!p.carrying) matrix.compose(position, quaternion, hidden);
      cargo.current!.setMatrixAt(i, matrix);
    });
    for (const mesh of meshes) mesh!.instanceMatrix.needsUpdate = true;
    lastGate.current = gate.current;
  };

  useLayoutEffect(() => {
    clock.current = 0;
    for (const mesh of [body.current, metal.current, dark.current, lights.current, branding.current, cargo.current]) {
      mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    write();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robots]);

  useFrame((_, delta) => {
    if (count === 0) return;
    const moving = live && gate.current >= 0.95;
    if (moving) clock.current += Math.min(delta, 0.1);
    if (moving || lastGate.current !== gate.current) write();
  });

  if (count === 0) return null;
  const args = [undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, count] as const;
  return (
    <group>
      <instancedMesh key={`b${count}`} ref={body} args={args} geometry={geometry.body} frustumCulled={false}>
        <meshStandardMaterial color="#e4e7e5" roughness={0.45} metalness={0.2} />
      </instancedMesh>
      <instancedMesh key={`m${count}`} ref={metal} args={args} geometry={geometry.metal} frustumCulled={false}>
        <meshStandardMaterial color="#9ca9ad" roughness={0.4} metalness={0.65} />
      </instancedMesh>
      <instancedMesh key={`d${count}`} ref={dark} args={args} geometry={geometry.dark} frustumCulled={false}>
        <meshStandardMaterial color="#001844" roughness={0.65} metalness={0.15} />
      </instancedMesh>
      <instancedMesh key={`l${count}`} ref={lights} args={args} geometry={geometry.lights} frustumCulled={false}>
        <meshStandardMaterial color="#93d50a" emissive="#93d50a" emissiveIntensity={0.7} roughness={0.4} />
      </instancedMesh>
      <instancedMesh key={`c${count}`} ref={cargo} args={args} geometry={geometry.cargo} frustumCulled={false}>
        <meshStandardMaterial color="#7e929b" roughness={0.75} />
      </instancedMesh>
      <instancedMesh key={`brand${count}`} ref={branding} args={args} geometry={geometry.branding} visible={logo !== null} frustumCulled={false}>
        <meshBasicMaterial map={logo} transparent alphaTest={0.05} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
