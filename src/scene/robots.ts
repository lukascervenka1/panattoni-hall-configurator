/**
 * Skladoví roboti (AMR) v uličkách mezi regály a v zadní servisní uličce. Čistá logika bez Reactu a Three.js; poloha robota je funkcí času,
 * stejně jako u dopravy (traffic.ts). Ilustrace provozu, ne návrh automatizace ani výpočet propustnosti.
 *
 * Mezi regály je ulička omezena úsekem, který mají společný obě sousední
 * řady. Proto nikdy nezajedou do výřezu L, k administrativě, k příčkám ani k vratům. Dva roboti ve stejné uličce
 * jezdí v samostatných pruzích (jiné z), takže se nepotkají.
 */
import type { RackSegment } from "./layout";
import { OBJECT_SIZES, partitionXs } from "./layout";
import { notchOf, officeLayout } from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";

export interface RobotLane {
  x0: number;
  x1: number;
  /** Osa uličky. */
  z: number;
}

export interface Robot {
  id: string;
  x0: number;
  x1: number;
  /** Pruh robota (osa uličky ± posun). */
  z: number;
  speed: number;
  /** Podíl periody, o který je robot na začátku posunut. */
  phase: number;
}

export interface RobotPose {
  x: number;
  z: number;
  /** Natočení kolem svislé osy; 0 = jede ve směru +x. */
  rotY: number;
  /** Veze přepravku (tam ano, zpět prázdný). */
  carrying: boolean;
}

const MODEL_SCALE = 1.25;
export const ROBOT = { modelScale: MODEL_SCALE, lengthM: 1.05 * MODEL_SCALE, widthM: 0.72 * MODEL_SCALE, heightM: 0.3 * MODEL_SCALE, laneOffsetM: 0.85, pauseS: 2.4, turnS: 1.0, maxRobots: 36, endMarginM: 1.5, minLaneM: 14, twoRobotsLaneM: 40 } as const;

type Interval = [number, number];

/** Spojí úseky řady, mezi nimiž je mezera nejvýše `gap` (mezera mezi segmenty regálu je 1,5 m). */
function mergeIntervals(list: Interval[], gap: number): Interval[] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out.at(-1);
    if (last && a - last[1] <= gap) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [a0, a1] of a) for (const [b0, b1] of b) {
    const lo = Math.max(a0, b0);
    const hi = Math.min(a1, b1);
    if (hi - lo > 0) out.push([lo, hi]);
  }
  return out;
}

/** Úseky uliček mezi sousedními řadami regálů, zkrácené o rezervu na koncích. */
export function layoutRobotLanes(racks: RackSegment[]): RobotLane[] {
  if (racks.length === 0) return [];
  const rows = new Map<number, Interval[]>();
  for (const r of racks) {
    const key = Math.round(r.z * 100) / 100;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push([r.x - r.lengthM / 2, r.x + r.lengthM / 2]);
  }
  const zs = [...rows.keys()].sort((a, b) => a - b);
  const pitch = OBJECT_SIZES.rack.depthM + OBJECT_SIZES.rack.aisleM;
  const out: RobotLane[] = [];
  for (let i = 0; i + 1 < zs.length; i++) {
    const za = zs[i]!;
    const zb = zs[i + 1]!;
    if (Math.abs(zb - za - pitch) > 0.05) continue; // řady nesousedí (vynechaná řada)
    const common = intersect(mergeIntervals(rows.get(za)!, 3), mergeIntervals(rows.get(zb)!, 3));
    for (const [a, b] of common) {
      const x0 = a + ROBOT.endMarginM;
      const x1 = b - ROBOT.endMarginM;
      if (x1 - x0 >= ROBOT.minLaneM) out.push({ x0, x1, z: (za + zb) / 2 });
    }
  }
  return out;
}

/** Odstup od sloupu zahrnuje celý poloměr otočky zvětšeného podvozku a rezervu. */
export const ROBOT_COLUMN_CLEARANCE_M = 0.3 + Math.hypot(ROBOT.lengthM, ROBOT.widthM) / 2 + 0.2;

/**
 * Roboti na uličkách: v dlouhé uličce dva (každý ve svém pruhu), jinak jeden; celkem nejvýše `maxRobots`.
 * Sloupy stojí v řadě `columnZs` často přímo v uličce, proto se pruh volí tak, aby je robot míjel.
 */
export function layoutRobots(lanes: RobotLane[], columnZs: number[] = []): Robot[] {
  const clear = (z: number) => columnZs.every((c) => Math.abs(z - c) >= ROBOT_COLUMN_CLEARANCE_M);
  const robots: Robot[] = [];
  lanes.forEach((lane, i) => {
    const len = lane.x1 - lane.x0;
    const o = ROBOT.laneOffsetM;
    const wantTwo = len >= ROBOT.twoRobotsLaneM && clear(lane.z - o) && clear(lane.z + o);
    const offsets = wantTwo ? [-o, o] : [0, -o, o].filter((off) => clear(lane.z + off)).slice(0, 1);
    offsets.forEach((off, k) => {
      const h = ((i * 2654435761 + k * 40503) >>> 0) / 4294967296;
      robots.push({
        id: `amr-${i}-${k}`,
        x0: lane.x0,
        x1: lane.x1,
        z: lane.z + off,
        speed: 1.3 + 0.5 * ((h * 7) % 1),
        phase: (h + k * 0.5) % 1,
      });
    });
  });
  if (robots.length <= ROBOT.maxRobots) return robots;
  const stride = robots.length / ROBOT.maxRobots;
  return Array.from({ length: ROBOT.maxRobots }, (_, i) => robots[Math.floor(i * stride)]!);
}

/** One visible AMR in the rear service aisle used by the interior camera. The first ten metres
 * remain available for the docks and the right-hand end for drive-in traffic. Every obstacle
 * is expanded by the robot's turning radius, so the whole body clears it even during turns. */
export function layoutServiceRobot(config: HallConfig, racks: RackSegment[], partitions: 0 | 1 | 2, columnZs: number[]): Robot[] {
  if (racks.length === 0) return [];
  const { lengthM: L, widthM: W } = config.dimensions;
  const radius = Math.hypot(ROBOT.lengthM, ROBOT.widthM) / 2 + 0.35;
  const office = officeLayout(config);
  const notch = notchOf(config.dimensions);
  for (const offset of [12, 11, 13, 10, 14]) {
    const z = -W / 2 + offset;
    if (z + radius >= W / 2 - 1 || columnZs.some((c) => Math.abs(z - c) < radius + 0.3)) continue;
    let runs: Interval[] = [[-L / 2 + 7, L / 2 - 18]];
    const exclude = (a: number, b: number) => {
      runs = runs.flatMap(([lo, hi]): Interval[] => b <= lo || a >= hi ? [[lo, hi]] : [
        ...(a > lo ? [[lo, a] as Interval] : []),
        ...(b < hi ? [[b, hi] as Interval] : []),
      ]);
    };
    for (const x of partitionXs(L, partitions)) exclude(x - radius - 0.3, x + radius + 0.3);
    if (notch.nx > 0 && z + radius > W / 2 - notch.nz - 1) exclude(L / 2 - notch.nx - radius - 1, L / 2);
    if (office && z + radius > office.z0 - 1 && z - radius < office.z1 + 1) exclude(office.x0 - radius - 1, office.x1 + radius + 1);
    for (const rack of racks) {
      if (Math.abs(z - rack.z) < OBJECT_SIZES.rack.depthM / 2 + radius) exclude(rack.x - rack.lengthM / 2 - radius, rack.x + rack.lengthM / 2 + radius);
    }
    // The camera enters from +x: use the clear section nearest it, including with partitions.
    const run = runs.filter(([a, b]) => b - a >= ROBOT.minLaneM).at(-1);
    if (run) return [{ id: "amr-service", x0: run[0], x1: run[1], z, speed: 1.45, phase: 0.38 }];
  }
  return [];
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Poloha robota v čase `t` (s): jede tam s přepravkem, otočí se, vrací se prázdný, otočí se a opakuje. */
export function robotPose(r: Robot, t: number): RobotPose {
  const len = r.x1 - r.x0;
  const travel = len / r.speed;
  const period = 2 * (travel + ROBOT.pauseS);
  const u = (((t / 1 + r.phase * period) % period) + period) % period;
  if (u < travel) return { x: r.x0 + r.speed * u, z: r.z, rotY: 0, carrying: true };
  if (u < travel + ROBOT.pauseS) {
    const k = Math.min(1, (u - travel) / ROBOT.turnS);
    return { x: r.x1, z: r.z, rotY: Math.PI * ease(k), carrying: u - travel < ROBOT.turnS / 2 };
  }
  if (u < 2 * travel + ROBOT.pauseS) return { x: r.x1 - r.speed * (u - travel - ROBOT.pauseS), z: r.z, rotY: Math.PI, carrying: false };
  const k = Math.min(1, (u - 2 * travel - ROBOT.pauseS) / ROBOT.turnS);
  return { x: r.x0, z: r.z, rotY: Math.PI + Math.PI * ease(k), carrying: u - 2 * travel - ROBOT.pauseS > ROBOT.turnS / 2 };
}
