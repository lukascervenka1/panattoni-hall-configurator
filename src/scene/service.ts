/** Illustrative service operations, driven by a shared clock with the actual gate shutters. */
import type { HallConfig } from "@/configurator/schema/config";
import { notchOf, placeOpenings } from "@/configurator/calculations/layout";
import { layoutSurroundings } from "./layout";
import { accessLanes, makePath, poseAt, type Path } from "./traffic";

export interface ServiceOperation {
  id: string;
  kind: "truck" | "van";
  x: number;
  z: number;
  path?: Path;
  outPath?: Path;
  returnPath?: Path;
}

export function gateCycle(time: number, index: number) {
  const t = ((time + index * 5) % 28 + 28) % 28;
  // Waiting → shutter opening → approach and entry → inside → reverse exit → closing.
  const open = t < 1 ? 0 : t < 2.5 ? (t - 1) / 1.5 : t < 23 ? 1 : t < 24.5 ? 1 - (t - 23) / 1.5 : 0;
  const progress = t < 3 ? 0 : t < 11 ? (t - 3) / 8 : t < 15 ? 1 : t < 23 ? 1 - (t - 15) / 8 : 0;
  return { open, progress };
}

export function buildServiceOperations(config: HallConfig, dockHouse: boolean): ServiceOperation[] {
  const { lengthM: L, widthM: W } = config.dimensions;
  const { nz } = notchOf(config.dimensions);
  const layout = layoutSurroundings(config);
  const roadZ = layout.road.z0;
  const access = accessLanes(layout.serviceRoad);
  const openings = placeOpenings(config);
  const out: ServiceOperation[] = [];
  // Kamiony u doků jsou samostatné (dockTrucks.ts); zde zůstávají dodávky u vjezdových vrat.
  for (const o of openings.filter((o) => o.kind === "driveIn").slice(0, 3)) {
    const z = W / 2 - nz - o.centerU;
    out.push({ id: o.id, kind: "van", x: L / 2, z,
      path: makePath([[access.inbound, roadZ - 14], [access.inbound, z + 7], [access.inbound + 3, z + 7], [access.inbound + 3, z], [L / 2 - 7, z]], 2),
      outPath: makePath([[L / 2 - 7, z], [access.outbound, z], [access.outbound, roadZ - 14]], 2),
      returnPath: makePath([[access.outbound, roadZ - 14], [access.outbound, roadZ - 10], [access.inbound, roadZ - 10], [access.inbound, roadZ - 14]], 2),
    });
  }
  return out;
}

export function servicePose(operation: ServiceOperation, time: number) {
  if (operation.kind === "truck") return { x: operation.x, z: operation.z, rotY: Math.PI };
  const index = Number(operation.id.split("-").at(-1)) - 1;
  const { progress } = gateCycle(time, index);
  const phase = ((time + index * 5) % 28 + 28) % 28;
  if (phase >= 23 && operation.returnPath) {
    const pose = poseAt(operation.returnPath, operation.returnPath.length * (phase - 23) / 5);
    return { x: pose.x, z: pose.z, rotY: pose.heading };
  }
  if (phase >= 15 && phase < 23 && operation.outPath) {
    const s = operation.outPath.length * (1 - progress);
    const pose = poseAt(operation.outPath, s);
    // Reverse straight out of the gate, then turn into the separate outbound lane.
    const straight = operation.outPath.pts[1]![0] - operation.outPath.pts[0]![0];
    const blend = Math.max(0, Math.min(1, (s - straight) / 5));
    const reverse = pose.heading + Math.PI;
    const d = Math.atan2(Math.sin(pose.heading - reverse), Math.cos(pose.heading - reverse));
    return { x: pose.x, z: pose.z, rotY: reverse + d * blend };
  }
  const pose = poseAt(operation.path!, operation.path!.length * progress);
  // The delivery vehicle reverses along its entry route, retaining its orientation.
  return { x: pose.x, z: pose.z, rotY: pose.heading };
}
