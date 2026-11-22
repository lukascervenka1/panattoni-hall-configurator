/**
 * Nominální trasy dopravy před halou (čistá logika). `vehiclePose(v, t)` vzorkuje trasu;
 * skutečné hodiny, odstupy a přednost všech vozidel řídí společný `TrafficWorld`.
 *
 * - Projíždějící vozidla jedou v pravém pruhu po silnici (východ: +z strana, západ: −z strana).
 * - Přijíždějící vozidla odbočí na příjezd, zajedou do uličky parkoviště a do VOLNÉHO stání, postojí a vycouvají,
 *   odjedou na silnici a po pauze přijedou znovu. Brzdění a rozjezd jsou plynulé (zpomalování po celé dráze).
 * Vše je ilustrativní a deterministické (žádná náhoda za běhu), takže je testovatelné.
 */
import type { Rect, Stall, SurroundingsLayout } from "./layout";

export type Vec2 = [number, number];

export interface Path {
  pts: Vec2[];
  cum: number[];
  length: number;
}

/** Zaoblí rohy lomené čáry kvadratickými oblouky a vzorkuje ji; opakované body se odstraní. */
export function makePath(points: Vec2[], radius = 4, samples = 7): Path {
  const pts0 = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1]) > 1e-6);
  const out: Vec2[] = [pts0[0]!];
  for (let i = 1; i < pts0.length - 1; i++) {
    const a = pts0[i - 1]!;
    const b = pts0[i]!;
    const c = pts0[i + 1]!;
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const p1: Vec2 = [b[0] - ((b[0] - a[0]) / l1) * r, b[1] - ((b[1] - a[1]) / l1) * r];
    const p2: Vec2 = [b[0] + ((c[0] - b[0]) / l2) * r, b[1] + ((c[1] - b[1]) / l2) * r];
    out.push(p1);
    for (let k = 1; k < samples; k++) {
      const t = k / samples;
      const u = 1 - t;
      out.push([u * u * p1[0] + 2 * u * t * b[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * b[1] + t * t * p2[1]]);
    }
    out.push(p2);
  }
  out.push(pts0[pts0.length - 1]!);
  const cum = [0];
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1]! + Math.hypot(out[i]![0] - out[i - 1]![0], out[i]![1] - out[i - 1]![1]));
  return { pts: out, cum, length: cum[cum.length - 1]! };
}

export function poseAt(path: Path, s: number): { x: number; z: number; heading: number } {
  const L = path.length;
  const d = Math.min(Math.max(s, 0), L);
  let lo = 0;
  let hi = path.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.cum[mid]! <= d) lo = mid;
    else hi = mid;
  }
  const a = path.pts[lo]!;
  const b = path.pts[Math.min(lo + 1, path.pts.length - 1)]!;
  const seg = Math.max(1e-9, path.cum[lo + 1]! - path.cum[lo]!);
  const t = Math.min(1, Math.max(0, (d - path.cum[lo]!) / seg));
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

export type VehicleKind = "car" | "van" | "truck";

export interface ThroughVehicle {
  mode: "through";
  path: Path;
  speed: number;
  gapS: number;
  offsetS: number;
}
export interface ParkerVehicle {
  mode: "parker";
  inPath: Path;
  outPath: Path;
  tIn: number;
  dwell: number;
  tOut: number;
  gapS: number;
  offsetS: number;
  stall: Stall;
  /** Délka první úsečky odjezdu (couvání ze stání). */
  backOutM: number;
}
export type Vehicle = { id: number; kind: VehicleKind; color: number } & (ThroughVehicle | ParkerVehicle);

export interface VehiclePose {
  visible: boolean;
  x: number;
  z: number;
  /** Natočení kolem osy y (lokální +z vozidla míří vpřed). */
  rotY: number;
  /** Jede (ne stojí na parkovišti): rozsvěcí brzdová/obrysová světla jen při pohybu. */
  moving: boolean;
}

const COLORS = [0xe8eaed, 0x2f3640, 0x8a939e, 0x1a4a7a, 0xb8bec6, 0x5a6470, 0x7a1f26, 0xd9d4c4];

function rnd(i: number, k: number): number {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const ROAD_REACH = 330;

export function lanes(road: Rect) {
  const width = road.z1 - road.z0;
  return { east: road.z0 + width * 0.75, west: road.z0 + width * 0.25 };
}

export function accessLanes(access: Rect) {
  const width = access.x1 - access.x0;
  return { inbound: access.x0 + width * 0.25, outbound: access.x0 + width * 0.75 };
}

export function buildTraffic(layout: SurroundingsLayout): Vehicle[] {
  const { road, driveway, parking } = layout;
  const lane = lanes(road);
  const xd = (driveway.x0 + driveway.x1) / 2;
  const out: Vehicle[] = [];
  let id = 0;

  // Projíždějící: 9 aut, dodávek a 2 kamiony.
  const throughN = 11;
  for (let i = 0; i < throughN; i++) {
    const eastbound = i % 2 === 0;
    const kind: VehicleKind = i % 5 === 4 ? "truck" : i % 4 === 3 ? "van" : "car";
    const z = eastbound ? lane.east : lane.west;
    const path = makePath(eastbound ? [[xd - ROAD_REACH, z], [xd + ROAD_REACH, z]] : [[xd + ROAD_REACH, z], [xd - ROAD_REACH, z]]);
    // One cruise speed and common period per lane: faster cars cannot catch and pass a trailer.
    const speed = 10;
    out.push({
      id: id++,
      kind,
      color: kind === "truck" ? 0xeef1f4 : COLORS[Math.floor(rnd(i, 2) * COLORS.length)]!,
      mode: "through",
      path,
      speed,
      gapS: 12,
      offsetS: Math.floor(i / 2) * 130 + (eastbound ? 25 : 80),
    });
  }

  // Přijíždějící na parkoviště: obsazují jen volná stání.
  const vacant = layout.stalls.filter((s) => !s.occupied && s.dynamic);
  const access = accessLanes(driveway);
  const parkers = Math.min(6, vacant.length);
  for (let i = 0; i < parkers; i++) {
    const stall = vacant[i]!;
    const fromWest = i % 2 === 0;
    const laneIn = fromWest ? lane.east : lane.west;
    const laneOut = fromWest ? lane.west : lane.east;
    const startX = fromWest ? xd - 170 : xd + 170;
    const endX = fromWest ? xd - 170 : xd + 170;
    const aisle = stall.aisleZ;
    const inPath = makePath(
      [
        [startX, laneIn],
        [access.inbound, laneIn],
        [access.inbound, road.z0 - 3],
        [access.inbound, parking.z1],
        [access.inbound, aisle],
        [stall.x, aisle],
        [stall.x, stall.z],
      ],
      3,
    );
    const outPath = makePath(
      [
        [stall.x, stall.z],
        [stall.x, aisle],
        [access.outbound, aisle],
        [access.outbound, parking.z1],
        [access.outbound, road.z0 - 3],
        [access.outbound, laneOut],
        [endX, laneOut],
      ],
      3,
    );
    const first = Math.abs(aisle - stall.z);
    out.push({
      id: id++,
      kind: i % 3 === 2 ? "van" : "car",
      color: COLORS[Math.floor(rnd(i, 12) * COLORS.length)]!,
      mode: "parker",
      inPath,
      outPath,
      tIn: (2 * inPath.length) / 11,
      dwell: 12 + rnd(i, 13) * 30,
      tOut: (2 * outPath.length) / 11,
      gapS: 8 + rnd(i, 14) * 40,
      offsetS: rnd(i, 15) * 160,
      stall,
      backOutM: first,
    });
  }
  return out;
}

const lerpAngle = (a: number, b: number, t: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
};

export function vehiclePose(v: Vehicle, t: number): VehiclePose {
  if (v.mode === "through") {
    const cycleS = v.path.length + v.gapS * v.speed;
    const s = (((t * v.speed + v.offsetS) % cycleS) + cycleS) % cycleS;
    if (s > v.path.length) return { visible: false, x: 0, z: 0, rotY: 0, moving: false };
    const p = poseAt(v.path, s);
    return { visible: true, x: p.x, z: p.z, rotY: p.heading, moving: true };
  }
  const cycle = v.tIn + v.dwell + v.tOut + v.gapS;
  const u = (((t + v.offsetS) % cycle) + cycle) % cycle;
  if (u < v.tIn) {
    const k = u / v.tIn;
    const s = v.inPath.length * (1 - (1 - k) * (1 - k)); // brzdí do stání
    const p = poseAt(v.inPath, s);
    return { visible: true, x: p.x, z: p.z, rotY: p.heading, moving: true };
  }
  if (u < v.tIn + v.dwell) {
    const p = poseAt(v.inPath, v.inPath.length);
    return { visible: true, x: p.x, z: p.z, rotY: p.heading, moving: false };
  }
  if (u < v.tIn + v.dwell + v.tOut) {
    const k = (u - v.tIn - v.dwell) / v.tOut;
    const s = v.outPath.length * k * k; // rozjíždí se
    const p = poseAt(v.outPath, s);
    // Nejdřív couvá ze stání (vozidlo míří do stání), pak se plynule natočí do směru jízdy.
    const blend = 7;
    let rot = p.heading;
    if (s < v.backOutM) rot = p.heading + Math.PI;
    else if (s < v.backOutM + blend) rot = lerpAngle(p.heading + Math.PI, p.heading, (s - v.backOutM) / blend);
    return { visible: true, x: p.x, z: p.z, rotY: rot, moving: true };
  }
  return { visible: false, x: 0, z: 0, rotY: 0, moving: false };
}
