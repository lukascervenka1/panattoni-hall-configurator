"use client";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { roofFanPoints, type RoofUnit } from "./layout";

/**
 * Lopatky ventilátorů na střešních jednotkách: procedurální pohyb (skill threejs-animation).
 * Úhel roste podle času, nezávisle na snímkové frekvenci. Při `live = false` (úspora pohybu) stojí.
 */
export function RoofFans({ units, topY, live }: { units: RoofUnit[]; topY: number; live: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const angle = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const points = useMemo(() => roofFanPoints(units), [units]);
  const count = points.length * 2;

  const write = () => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3();
    points.forEach((p, i) => {
      for (let b = 0; b < 2; b++) {
        q.setFromAxisAngle(axis, angle.current * (1 + (i % 3) * 0.12) + (b * Math.PI) / 2 + i * 0.7);
        m.compose(new THREE.Vector3(p.x, topY + p.y + 0.1, p.z), q, scale.set(p.radiusM * 1.7, 1, 1));
        mesh.setMatrixAt(i * 2 + b, m);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    write();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, topY]);

  useFrame((_, delta) => {
    if (!live || count === 0) return;
    angle.current += Math.min(delta, 0.1) * 9; // rad/s
    write();
    invalidate();
  });
  useEffect(() => () => void (angle.current = 0), []);

  if (count === 0) return null;
  return (
    <instancedMesh key={count} ref={ref} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, count]} frustumCulled={false}>
      <boxGeometry args={[1, 0.03, 0.16]} />
      <meshStandardMaterial color="#3a4048" roughness={0.5} metalness={0.7} />
    </instancedMesh>
  );
}
