import type { HallConfig } from "@/configurator/schema/config";
import { officeLayout } from "@/configurator/calculations/layout";
import { DEMO_GEOMETRY as G } from "@/configurator/calculations/constants";
import type { InstanceItem } from "./Instanced";

export function officeRoomEdges(config: HallConfig): number[] {
  const o = officeLayout(config);
  if (!o) return [];
  const rooms = Math.max(1, Math.floor(o.widthM / 8));
  return Array.from({ length: rooms + 1 }, (_, i) => o.x0 + i * o.widthM / rooms);
}

export type FurnitureFinish = "wood" | "frame" | "upholstery" | "screen" | "storage" | "paper" | "pots" | "leaves" | "carpet";
export type OfficeFurniture = Record<FurnitureFinish, InstanceItem[]>;

/** Illustrative rooms with an unobstructed rear corridor; shared batches for every floor. */
export function layoutOfficeFurniture(config: HallConfig): OfficeFurniture {
  const out: OfficeFurniture = { wood: [], frame: [], upholstery: [], screen: [], storage: [], paper: [], pots: [], leaves: [], carpet: [] };
  const o = officeLayout(config);
  if (!o) return out;
  const edges = officeRoomEdges(config);
  const add = (finish: FurnitureFinish, x: number, y: number, z: number, sx: number, sy: number, sz: number) => out[finish].push({ x, y, z, sx, sy, sz });
  const chair = (x: number, floor: number, z: number, facing = 1) => {
    add("upholstery", x, floor + 0.48, z, 0.56, 0.12, 0.55);
    add("upholstery", x, floor + 0.82, z - facing * 0.25, 0.54, 0.64, 0.09);
    add("frame", x, floor + 0.24, z, 0.07, 0.42, 0.07);
    add("frame", x, floor + 0.07, z, 0.6, 0.06, 0.12);
    add("frame", x, floor + 0.07, z, 0.12, 0.06, 0.6);
  };
  const table = (x: number, floor: number, z: number, width: number, depth: number) => {
    add("wood", x, floor + 0.76, z, width, 0.06, depth);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) add("frame", x + dx * (width / 2 - 0.12), floor + 0.36, z + dz * (depth / 2 - 0.1), 0.06, 0.72, 0.06);
  };
  for (let f = 0; f < o.floors; f++) {
    const floor = f === 0 ? 0.12 : f * G.office.floorHeightM;
    for (let r = 0; r < edges.length - 1; r++) {
      const left = edges[r]!, right = edges[r + 1]!, width = right - left, cx = (left + right) / 2;
      if (width < 3.8) continue;
      const meeting = edges.length > 2 && r === edges.length - 2;
      add("carpet", cx, floor + 0.012, o.z0 + 7.5, width - 0.9, 0.02, 6.8);
      if (!meeting) {
        const count = Math.max(1, Math.min(3, Math.floor((width - 1.2) / 2.2)));
        for (let d = 0; d < count; d++) {
          const x = left + width * (d + 0.5) / count, z = o.z1 - 1.65;
          table(x, floor, z, 1.6, 0.8);
          chair(x, floor, z - 1.0);
          add("frame", x, floor + 0.96, z + 0.08, 0.06, 0.35, 0.06);
          add("frame", x, floor + 0.81, z + 0.08, 0.33, 0.035, 0.2);
          add("frame", x, floor + 1.24, z + 0.12, 0.68, 0.43, 0.07);
          add("screen", x, floor + 1.24, z + 0.079, 0.61, 0.36, 0.01);
          add("frame", x, floor + 0.8, z - 0.22, 0.45, 0.025, 0.14);
          add("paper", x + 0.55, floor + 0.805, z - 0.05, 0.21, 0.02, 0.29);
        }
      }
      // Meeting room, or a collaboration table behind the desks in a single office.
      if (meeting || edges.length === 2) {
        const z = o.z0 + (meeting ? 7.6 : 5.65);
        table(cx, floor, z, 2.6, 1.15);
        for (const dx of [-0.7, 0.7]) for (const side of [-1, 1]) chair(cx + dx, floor, z + side * 1.0, -side);
        add("frame", cx, floor + 0.82, z, 0.48, 0.05, 0.32);
      }
      // Storage stays clear of the doorway near the right edge of each room.
      add("storage", left + 1.05, floor + 0.55, o.z0 + 3.9, 1.3, 1.1, 0.48);
      for (const dx of [-0.3, 0.3]) add("frame", left + 1.05 + dx, floor + 0.65, o.z0 + 4.15, 0.03, 0.16, 0.025);
      add("pots", left + 1.25, floor + 0.23, o.z1 - 0.75, 0.38, 0.46, 0.38);
      add("leaves", left + 1.25, floor + 0.9, o.z1 - 0.75, 0.65, 0.95, 0.65);
    }
  }
  return out;
}
