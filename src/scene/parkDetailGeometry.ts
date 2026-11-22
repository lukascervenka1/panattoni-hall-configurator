/** Low-poly, shared detail meshes. Dimensions are in metres and stay fixed when the hall grows. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function merge(parts: THREE.BufferGeometry[]) {
  const plain = parts.map((g) => g.index ? g.toNonIndexed() : g);
  const result = mergeGeometries(plain, false)!;
  for (const g of new Set([...parts, ...plain])) g.dispose();
  return result;
}
function rod(a: number[], b: number[], radius = 0.022) {
  const from = new THREE.Vector3(a[0], a[1], a[2]);
  const to = new THREE.Vector3(b[0], b[1], b[2]);
  const direction = to.clone().sub(from);
  return new THREE.CylinderGeometry(radius, radius, direction.length(), 6)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()))
    .translate(...from.add(to).multiplyScalar(0.5).toArray() as [number, number, number]);
}
export function buildParkCrown() {
  return merge([
    new THREE.IcosahedronGeometry(0.85, 1).translate(-0.08, 0.1, -0.04),
    new THREE.IcosahedronGeometry(0.62, 1).translate(0.35, -0.1, 0.12),
    new THREE.IcosahedronGeometry(0.58, 1).translate(-0.36, -0.25, -0.17),
  ]);
}
export function buildParkTrunk() {
  return merge([
    new THREE.CylinderGeometry(0.11, 0.18, 2.9, 7),
    rod([0, 0.6, 0], [0.5, 1.75, 0.12], 0.055),
    rod([0, 0.95, 0], [-0.42, 1.85, -0.15], 0.045),
  ]);
}
export function buildBicycle() {
  const rear = [0, 0.35, -0.62], front = [0, 0.35, 0.62];
  const pedal = [0, 0.34, -0.08], seat = [0, 0.77, -0.31], head = [0, 0.81, 0.35];
  const frame = merge([[rear, pedal], [pedal, seat], [seat, rear], [seat, head], [head, pedal], [head, front], [seat, [0, 0.91, -0.33]]].map(([a, b]) => rod(a!, b!)));
  const tyres = merge([-0.62, 0.62].map((z) => new THREE.TorusGeometry(0.3, 0.035, 6, 24).rotateY(Math.PI / 2).translate(0, 0.35, z)));
  const metal = merge([
    ...[-0.62, 0.62].flatMap((z) => [
      new THREE.TorusGeometry(0.265, 0.012, 4, 20).rotateY(Math.PI / 2).translate(0, 0.35, z),
      ...[0, 1, 2, 3].map((i) => {
        const angle = i * Math.PI / 4;
        return rod([0, 0.35 + Math.sin(angle) * 0.255, z + Math.cos(angle) * 0.255], [0, 0.35 - Math.sin(angle) * 0.255, z - Math.cos(angle) * 0.255], 0.006);
      }),
    ]),
    rod(head, [0, 0.98, 0.39], 0.018), rod([-0.23, 0.98, 0.39], [0.23, 0.98, 0.39], 0.016),
    rod([-0.14, 0.34, -0.08], [0.14, 0.34, -0.08], 0.016),
  ]);
  const saddle = new THREE.BoxGeometry(0.2, 0.055, 0.25).translate(0, 0.93, -0.35);
  const rack = merge([
    rod([0, 0.07, -0.47], [0, 0.72, -0.47], 0.026),
    rod([0, 0.72, -0.47], [0, 0.72, 0.47], 0.026),
    rod([0, 0.72, 0.47], [0, 0.07, 0.47], 0.026),
  ]);
  return { frame, tyres, metal, saddle, rack };
}
