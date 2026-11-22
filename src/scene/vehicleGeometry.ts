/** Shared fixed-size vehicle geometry for moving and parked vehicles. Local +z points forwards. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { VehicleKind } from "./traffic";

export interface Parts {
  body: THREE.BufferGeometry;
  cabin: THREE.BufferGeometry | null;
  wheels: THREE.BufferGeometry;
  headlights: THREE.BufferGeometry;
  taillights: THREE.BufferGeometry;
  stripe: THREE.BufferGeometry | null;
  cabPaint?: THREE.BufferGeometry;
  trim?: THREE.BufferGeometry;
  metal?: THREE.BufferGeometry;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}
function wheelGeo(r: number, w: number, x: number, y: number, z: number) {
  const g = new THREE.CylinderGeometry(r, r, w, 14);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
const merge = (list: THREE.BufferGeometry[]) => {
  const ng = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(ng, false)!;
  list.forEach((g) => g.dispose());
  ng.forEach((g) => g.dispose());
  return m;
};

/** Sdílené tvary vozidel (lokální +z míří vpřed). Rozměry odpovídají statickým autům a kamionům v okolí. */
export function buildParts(kind: VehicleKind): Parts {
  if (kind === "truck") {
    const cab = new RoundedBoxGeometry(2.5, 2.9, 2.4, 2, 0.14);
    cab.translate(0, 1.9, 7.2);
    return {
      body: box(2.55, 2.9, 13.6, 0, 2.05, -1.8),
      cabPaint: cab,
      cabin: merge([box(2.15, 0.82, 0.025, 0, 2.58, 8.405), ...[-1, 1].map((s) => box(0.026, 0.8, 1.3, s * 1.253, 2.6, 7.55))]),
      wheels: merge([-6.6, -5.3, -4.0, 4.6, 7.4].flatMap((z) => [-1.13, 1.13].map((x) => wheelGeo(0.5, 0.3, x, 0.5, z)))),
      headlights: merge([-0.8, 0.8].map((x) => box(0.4, 0.2, 0.06, x, 0.95, 8.42))),
      taillights: merge([-0.9, 0.9].map((x) => box(0.3, 0.2, 0.06, x, 0.9, -8.6))),
      stripe: box(2.58, 0.18, 13.5, 0, 1.0, -1.8),
      trim: merge([
        box(1.7, 0.32, 0.04, 0, 1.46, 8.405), box(2.1, 0.22, 0.08, 0, 0.64, 8.4),
        box(1.6, 0.24, 15.6, 0, 0.52, -0.3),
        ...[-1, 1].flatMap((s) => [box(0.22, 0.4, 0.32, s * 1.43, 2.5, 8.05), box(0.24, 0.08, 0.08, s * 1.32, 2.5, 7.92)]),
      ]),
      metal: merge([
        ...[-6.6, -5.3, -4, 4.6, 7.4].flatMap((z) => [-1.29, 1.29].map((x) => wheelGeo(0.25, 0.025, x, 0.5, z))),
        ...[-1, 1].flatMap((s) => [box(0.07, 0.08, 13.5, s * 1.28, 3.49, -1.8), box(0.07, 0.09, 13.5, s * 1.28, 0.64, -1.8), box(0.04, 2.65, 0.035, s * 0.65, 2.06, -8.62)]),
        box(0.025, 2.75, 0.03, 0, 2.06, -8.62),
      ]),
    };
  }
  return buildLightVehicle(kind === "van");
}

interface CabinStation { z: number; y: number; w: number }
function panel(points: number[][], normal?: number[]): THREE.BufferGeometry {
  const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  if (normal) {
    const n = pts[1]!.clone().sub(pts[0]!).cross(pts[2]!.clone().sub(pts[0]!));
    if (n.dot(new THREE.Vector3(...normal as [number, number, number])) < 0) pts.reverse();
  }
  const positions: number[] = [], uv: number[] = [];
  for (let i = 1; i + 1 < pts.length; i++) for (const j of [0, i, i + 1]) { positions.push(...pts[j]!.toArray()); uv.push(j % 2, j < 2 ? 0 : 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Passenger-cell cross sections taper towards the roof instead of stacking boxes. */
function cabinLoft(stations: CabinStation[], baseWidth: number): THREE.BufferGeometry {
  const section = (s: CabinStation) => [[-baseWidth, 0.92, s.z], [baseWidth, 0.92, s.z], [s.w, s.y, s.z], [-s.w, s.y, s.z]];
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i + 1 < stations.length; i++) {
    const a = section(stations[i]!), b = section(stations[i + 1]!);
    for (let k = 0; k < 4; k++) parts.push(panel([a[k]!, a[(k + 1) % 4]!, b[(k + 1) % 4]!, b[k]!]));
  }
  parts.push(panel(section(stations[0]!), [0, 0, -1]), panel(section(stations.at(-1)!), [0, 0, 1]));
  return merge(parts);
}

function buildLightVehicle(van: boolean): Parts {
  const length = van ? 4.9 : 4.5, width = van ? 1.9 : 1.8;
  const half = length / 2 - 0.05, axle = van ? 1.55 : 1.4;
  const base = new THREE.Shape();
  base.moveTo(half, 0.35);
  base.quadraticCurveTo(half + 0.015, 0.62, half - 0.09, 0.77);
  base.lineTo(van ? 1.42 : 1.15, 0.94);
  base.lineTo(-half + 0.28, 0.96);
  base.quadraticCurveTo(-half, 0.94, -half, 0.72);
  base.lineTo(-half, 0.35);
  base.lineTo(-axle - 0.4, 0.35);
  base.absarc(-axle, 0.35, 0.4, Math.PI, 0, true);
  base.lineTo(axle - 0.4, 0.35);
  base.absarc(axle, 0.35, 0.4, Math.PI, 0, true);
  base.closePath();
  const lower = new THREE.ExtrudeGeometry(base, { depth: width - 0.06, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 2, steps: 1, curveSegments: 10 })
    .rotateY(-Math.PI / 2).translate((width - 0.06) / 2, 0, 0);
  const stations: CabinStation[] = van
    ? [{ z: -2.23, y: 1.84, w: 0.84 }, { z: -1.98, y: 1.95, w: 0.85 }, { z: 0.65, y: 1.95, w: 0.78 }, { z: 1.48, y: 1.13, w: 0.84 }]
    : [{ z: -1.22, y: 1.0, w: 0.77 }, { z: -0.7, y: 1.47, w: 0.65 }, { z: 0.45, y: 1.47, w: 0.65 }, { z: 1.15, y: 1.0, w: 0.77 }];
  const baseWidth = van ? 0.9 : 0.82;
  const at = (z: number) => {
    const i = Math.max(0, stations.findIndex((s) => s.z >= z) - 1);
    const a = stations[i]!, b = stations[Math.min(i + 1, stations.length - 1)]!;
    const t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
    return { y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t };
  };
  const roof = new RoundedBoxGeometry(van ? 1.7 : 1.32, 0.045, van ? 2.62 : 1.1, 2, 0.02).translate(0, van ? 1.96 : 1.475, van ? -0.67 : -0.12);
  const glass: THREE.BufferGeometry[] = [];
  const screen = (z0: number, z1: number, forward: number) => {
    const a = at(z0), b = at(z1);
    glass.push(panel([[-a.w + 0.05, a.y + 0.007, z0], [a.w - 0.05, a.y + 0.007, z0], [b.w - 0.05, b.y + 0.007, z1], [-b.w + 0.05, b.y + 0.007, z1]], [0, 1, forward]));
  };
  screen(van ? 0.73 : 0.52, van ? 1.4 : 1.07, 1);
  if (!van) screen(-1.13, -0.77, -1);
  const sideWindow = (side: number, outline: Array<[number, number]>) => {
    glass.push(panel(outline.map(([z, y]) => {
      const station = at(z);
      const t = Math.max(0, Math.min(1, (y - 0.92) / (station.y - 0.92)));
      return [side * (baseWidth + (station.w - baseWidth) * t + 0.008), y, z];
    }), [side, 0, 0]));
  };
  for (const side of [-1, 1]) {
    if (van) sideWindow(side, [[0.06, 1.11], [1.34, 1.11], [0.61, 1.88], [0.06, 1.88]]);
    else {
      sideWindow(side, [[-1.1, 1.01], [-0.08, 1.01], [-0.08, 1.41], [-0.72, 1.41]]);
      sideWindow(side, [[0.01, 1.01], [1.03, 1.01], [0.43, 1.41], [0.01, 1.41]]);
    }
  }
  const wheelX = van ? 0.915 : 0.87;
  const trim = [
    box(width * 0.88, 0.095, 0.055, 0, 0.43, half + 0.025), box(width * 0.88, 0.09, 0.055, 0, 0.42, -half - 0.025),
    box(van ? 0.95 : 0.75, 0.14, 0.025, 0, 0.63, half + 0.045),
    ...[-1, 1].flatMap((side) => [
      box(0.045, 0.065, van ? 2.12 : 1.85, side * (width / 2 - 0.025), 0.31, 0),
      new RoundedBoxGeometry(van ? 0.08 : 0.1, 0.075, 0.15, 1, 0.025).translate(side * (van ? 1 : 0.98), van ? 1.28 : 1.09, van ? 1 : 0.72),
      box(van ? 0.17 : 0.22, 0.025, 0.035, side * (van ? 0.915 : 0.865), van ? 1.28 : 1.09, van ? 1 : 0.72),
    ]),
  ];
  return {
    body: merge([lower, cabinLoft(stations, baseWidth), roof]),
    cabin: merge(glass),
    wheels: merge([-axle, axle].flatMap((z) => [-wheelX, wheelX].map((x) => wheelGeo(0.335, 0.22, x, 0.34, z)))),
    trim: merge(trim),
    metal: merge([
      ...[-axle, axle].flatMap((z) => [-1, 1].map((side) => wheelGeo(0.19, 0.016, side * (van ? 1.027 : 0.989), 0.34, z))),
      ...[-1, 1].flatMap((side) => (van ? [0.8, -0.3] : [0.4, -0.65]).map((z) => box(0.018, 0.032, 0.17, side * (van ? baseWidth + (at(z).w - baseWidth) * (0.2 / (at(z).y - 0.92)) + 0.012 : width / 2 + 0.014), van ? 1.12 : 0.88, z))),
      box(0.34, 0.105, 0.016, 0, 0.48, half + 0.06), box(0.34, 0.105, 0.016, 0, 0.49, -half - 0.06),
    ]),
    headlights: merge([-1, 1].map((side) => new RoundedBoxGeometry(0.38, van ? 0.16 : 0.11, 0.035, 1, 0.015).translate(side * (van ? 0.64 : 0.59), 0.78, half + 0.035))),
    taillights: merge([-1, 1].map((side) => new RoundedBoxGeometry(van ? 0.14 : 0.34, van ? 0.58 : 0.12, 0.035, 1, 0.015).translate(side * (van ? 0.79 : 0.63), van ? 1.05 : 0.8, -half - 0.035))),
    stripe: null,
  };
}

export function disposeParts(p: Parts) {
  Object.values(p).forEach((g) => g?.dispose());
}

