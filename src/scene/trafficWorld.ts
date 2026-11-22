/** Shared, bounded traffic simulation for road cars, parking, dock trailers and gate vans.
 * Individual animation clocks advance only when the complete swept vehicle body is clear.
 * The controller runs in fixed substeps and never changes React state. */
import type { HallConfig } from "@/configurator/schema/config";
import { buildDockTrucks, dockTruckPose, type DockTruck } from "./dockTrucks";
import { buildServiceOperations, servicePose, type ServiceOperation } from "./service";
import { buildTraffic, vehiclePose, type Vehicle, type VehicleKind } from "./traffic";
import type { Rect, SurroundingsLayout } from "./layout";

export interface MotionPose { visible: boolean; x: number; z: number; rotY: number; moving: boolean; reversing?: boolean }
export const VEHICLE_BODY = {
  car: { halfLength: 2.32, halfWidth: 1.03 },
  van: { halfLength: 2.52, halfWidth: 1.04 },
  truck: { halfLength: 8.7, halfWidth: 1.55 },
} as const;
export interface TrafficBody extends MotionPose { kind: VehicleKind }

/** Separating-axis test includes bumpers, wheels, mirrors and a small physical clearance. */
export function bodiesOverlap(a: TrafficBody, b: TrafficBody, margin = 0.04): boolean {
  if (!a.visible || !b.visible) return false;
  const aa = VEHICLE_BODY[a.kind], bb = VEHICLE_BODY[b.kind];
  const dx = b.x - a.x, dz = b.z - a.z;
  const radius = Math.hypot(aa.halfLength + margin, aa.halfWidth + margin) + Math.hypot(bb.halfLength + margin, bb.halfWidth + margin);
  if (Math.abs(dx) > radius || Math.abs(dz) > radius) return false;
  const afx = Math.sin(a.rotY), afz = Math.cos(a.rotY), arx = afz, arz = -afx;
  const bfx = Math.sin(b.rotY), bfz = Math.cos(b.rotY), brx = bfz, brz = -bfx;
  for (const [x, z] of [[afx, afz], [arx, arz], [bfx, bfz], [brx, brz]]) {
    const ra = Math.abs(afx * x! + afz * z!) * (aa.halfLength + margin) + Math.abs(arx * x! + arz * z!) * (aa.halfWidth + margin);
    const rb = Math.abs(bfx * x! + bfz * z!) * (bb.halfLength + margin) + Math.abs(brx * x! + brz * z!) * (bb.halfWidth + margin);
    if (Math.abs(dx * x! + dz * z!) >= ra + rb) return false;
  }
  return true;
}
interface Agent {
  key: string; kind: VehicleKind; category: "through" | "parking" | "dock" | "gate";
  clock: number; rate: number; waiting: number; travelled: number; pose: MotionPose;
  sample: (time: number) => MotionPose;
}
interface Junction { rect: Rect; owner: string | null }
const hidden: MotionPose = { visible: false, x: 0, z: 0, rotY: 0, moving: false };
function touches(p: MotionPose, kind: VehicleKind, rect: Rect) {
  return p.visible && p.x + Math.abs(Math.sin(p.rotY)) * VEHICLE_BODY[kind].halfLength + Math.abs(Math.cos(p.rotY)) * VEHICLE_BODY[kind].halfWidth > rect.x0
    && p.x - Math.abs(Math.sin(p.rotY)) * VEHICLE_BODY[kind].halfLength - Math.abs(Math.cos(p.rotY)) * VEHICLE_BODY[kind].halfWidth < rect.x1
    && p.z + Math.abs(Math.cos(p.rotY)) * VEHICLE_BODY[kind].halfLength + Math.abs(Math.sin(p.rotY)) * VEHICLE_BODY[kind].halfWidth > rect.z0
    && p.z - Math.abs(Math.cos(p.rotY)) * VEHICLE_BODY[kind].halfLength - Math.abs(Math.sin(p.rotY)) * VEHICLE_BODY[kind].halfWidth < rect.z1;
}

export class TrafficWorld {
  readonly vehicles: Vehicle[];
  readonly trucks: DockTruck[];
  readonly operations: ServiceOperation[];
  readonly agents: Agent[];
  readonly stationary: TrafficBody[];
  readonly road: Rect;
  readonly junctions: Junction[];
  private byKey: Map<string, Agent>;
  private parkingOwner: string | null = null;
  private serviceOwner: string | null = null;
  private nextParking = 0;
  private nextService = 0;

  constructor(config: HallConfig, readonly layout: SurroundingsLayout, dockHouse: boolean, minimalist: boolean) {
    this.road = minimalist ? { ...layout.road, x0: layout.plot.x0 - 20, x1: layout.plot.x1 + 20 } : layout.road;
    this.vehicles = buildTraffic({ ...layout, road: this.road }).filter((v) => !minimalist || v.mode === "parker" || v.id % 3 === 0);
    this.trucks = buildDockTrucks(layout, config.dimensions.widthM, dockHouse);
    this.operations = buildServiceOperations(config, dockHouse);
    this.stationary = layout.cars.map((c) => ({ ...c, kind: "car", visible: true, moving: false }));
    const agent = (key: string, kind: VehicleKind, category: Agent["category"], sample: Agent["sample"]): Agent => ({ key, kind, category, sample, clock: 0, rate: 0, waiting: 0, travelled: 0, pose: { ...hidden } });
    this.agents = [
      ...this.trucks.map((v) => agent(v.id, "truck", "dock", (t) => dockTruckPose(v, t))),
      ...this.vehicles.map((v) => agent(`road-${v.id}`, v.kind, v.mode === "through" ? "through" : "parking", (t) => vehiclePose(v, t))),
      ...this.operations.map((v) => agent(`gate-${v.id}`, v.kind, "gate", (t) => ({ ...servicePose(v, t), visible: true, moving: true }))),
    ];
    this.byKey = new Map(this.agents.map((a) => [a.key, a]));
    this.junctions = [layout.driveway, layout.serviceRoad].map((r) => ({ rect: { x0: r.x0 - 9, x1: r.x1 + 9, z0: layout.road.z0 - 9, z1: layout.road.z1 + 3 }, owner: null }));
    this.agents.filter((a) => a.category === "parking").forEach((a, i) => { a.clock = -this.vehicles.filter((v) => v.mode === "parker")[i]!.offsetS; });
    this.agents.filter((a) => a.category === "gate").forEach((a, i) => { a.clock = -i * 5; });
    // Parked trailers seed the scene first; newly appearing vehicles must find a free physical footprint.
    for (const a of this.agents) {
      if (a.category === "parking" || a.category === "gate") continue;
      const p = a.sample(0);
      if (!this.occupied(a, p)) a.pose = p;
    }
  }
  pose(key: string): MotionPose { return this.byKey.get(key)?.pose ?? hidden; }
  time(key: string): number { return this.byKey.get(key)?.clock ?? 0; }

  reset() {
    this.parkingOwner = null; this.serviceOwner = null; this.nextParking = 0; this.nextService = 0;
    for (const j of this.junctions) j.owner = null;
    let gate = 0;
    for (const a of this.agents) {
      const v = this.vehicles.find((v) => `road-${v.id}` === a.key);
      a.clock = a.category === "parking" ? -v!.offsetS : a.category === "gate" ? -gate++ * 5 : 0;
      a.rate = 0; a.waiting = 0; a.travelled = 0; a.pose = { ...hidden };
    }
    for (const a of this.agents) {
      if (a.category === "parking" || a.category === "gate") continue;
      const p = a.sample(0);
      if (!this.occupied(a, p)) a.pose = p;
    }
  }

  private occupied(agent: Agent, pose: MotionPose): boolean {
    if (!pose.visible) return false;
    const body = { ...pose, kind: agent.kind };
    return this.stationary.some((b) => bodiesOverlap(body, b)) || this.agents.some((b) => b !== agent && bodiesOverlap(body, { ...b.pose, kind: b.kind }));
  }

  step(elapsed: number) {
    if (elapsed <= 0) return;
    // A low frame rate cannot make a vehicle tunnel through another body.
    let remaining = Math.min(elapsed, 0.1);
    while (remaining > 1e-8) {
      const dt = Math.min(remaining, 1 / 30);
      remaining -= dt;
      this.tick(dt);
    }
  }

  private junctionBlocked(a: Agent, candidate: MotionPose): boolean {
    let blocked = false;
    for (const junction of this.junctions) {
      if (!touches(candidate, a.kind, junction.rect)) continue;
      if (junction.owner && junction.owner !== a.key) { blocked = true; continue; }
      if (a.category === "through") continue;
      if (!junction.owner) {
        const conflict = this.agents.some((b) => {
          if (b === a || b.category !== "through") return false;
          // A following car queues behind the turning vehicle; it must not prevent its leader from turning.
          const following = a.pose.visible && b.pose.visible && Math.abs(a.pose.z - b.pose.z) < 1
            && Math.cos(a.pose.rotY - b.pose.rotY) > 0.9
            && (b.pose.x - a.pose.x) * Math.sin(a.pose.rotY) + (b.pose.z - a.pose.z) * Math.cos(a.pose.rotY) < 0;
          return !following && [0, 1, 2, 3].some((t) => touches(b.sample(b.clock + t), b.kind, junction.rect));
        });
        if (conflict) blocked = true;
        else junction.owner = a.key;
      }
    }
    return blocked;
  }

  private stepDocks(dt: number) {
    const docks = this.agents.filter((a) => a.category === "dock");
    if (!docks.length) return;
    const clock = docks[0]!.clock;
    const lead = docks.find((a) => a.sample(clock).moving) ?? docks.find((a) => a.sample(clock + 0.5).moving);
    const rate = lead ? Math.min(1, lead.rate + dt * 1.4) : 1;
    const advance = dt * rate;
    const blocked = lead && (this.junctionBlocked(lead, lead.sample(clock + advance))
      || [advance * 0.5, advance, advance + 0.45].some((t) => this.occupied(lead, lead.sample(clock + t))));
    if (blocked) {
      lead.waiting += dt; lead.rate = Math.max(0, lead.rate - dt * 3);
      lead.pose = { ...lead.pose, moving: false };
      return;
    }
    for (const a of docks) {
      const pose = a.sample(clock + advance);
      if (pose.visible && a.pose.visible) a.travelled += Math.hypot(pose.x - a.pose.x, pose.z - a.pose.z);
      a.clock = clock + advance; a.rate = rate; a.waiting = 0; a.pose = pose;
    }
  }

  private tick(dt: number) {
    for (const junction of this.junctions) {
      const owner = junction.owner && this.byKey.get(junction.owner);
      if (!owner || !touches(owner.pose, owner.kind, junction.rect)) junction.owner = null;
    }
    const parkers = this.agents.filter((a) => a.category === "parking");
    const gates = this.agents.filter((a) => a.category === "gate");
    if (!this.parkingOwner && parkers.length) this.parkingOwner = parkers[this.nextParking % parkers.length]!.key;
    if (!this.serviceOwner && gates.length) this.serviceOwner = gates[this.nextService % gates.length]!.key;
    // Road priority, then the oldest waiting manoeuvre. Existing junction owners finish first.
    const order = [...this.agents].sort((a, b) => Number(b.category === "through") - Number(a.category === "through") || b.waiting - a.waiting || a.key.localeCompare(b.key));
    let docksStepped = false;
    for (const a of order) {
      if (a.category === "dock") {
        if (!docksStepped) this.stepDocks(dt);
        docksStepped = true;
        continue;
      }
      if (a.category === "parking" && this.parkingOwner !== a.key || a.category === "gate" && this.serviceOwner !== a.key) continue;
      const nextRate = Math.min(1, a.rate + dt * 1.4);
      const advance = dt * nextRate;
      const candidate = a.sample(a.clock + advance);
      let blocked = this.junctionBlocked(a, candidate);
      // Check a swept step, plus a short look-ahead for braking distance and trailer swing.
      if (!blocked) blocked = [advance * 0.5, advance, advance + 0.45].some((t) => this.occupied(a, a.sample(a.clock + t)));
      if (blocked) {
        a.waiting += dt;
        a.rate = Math.max(0, a.rate - dt * 3);
        a.pose = { ...a.pose, moving: false };
      } else {
        if (a.pose.visible && candidate.visible) a.travelled += Math.hypot(candidate.x - a.pose.x, candidate.z - a.pose.z);
        const before = a.clock;
        a.clock += advance;
        if (a.category === "parking" && !candidate.visible && a.pose.visible) {
          this.parkingOwner = null; this.nextParking++;
          const v = this.vehicles.find((v) => `road-${v.id}` === a.key)!;
          a.clock = -v.offsetS;
          a.rate = 0;
        }
        if (a.category === "gate") {
          const offset = gates.findIndex((g) => g === a) * 5;
          if (Math.floor((a.clock + offset) / 28) > Math.floor((before + offset) / 28)) {
            this.serviceOwner = null; this.nextService++;
            a.clock = -offset; a.pose = { ...hidden }; a.rate = 0;
            continue;
          }
        }
        a.pose = candidate;
        a.rate = nextRate;
        a.waiting = 0;
      }
    }
  }
}
