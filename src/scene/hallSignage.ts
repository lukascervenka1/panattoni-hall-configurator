/** Raised facade lettering from the original vector artwork, never a substitute font or a rectangular decal. */
import * as THREE from "three";
import type { HallConfig } from "@/configurator/schema/config";
import { facadeLengthM, placeOpenings } from "@/configurator/calculations/layout";
import artwork from "./panattoniLogo.paths.json";

export const SIGNAGE = { aspect: artwork.width / artwork.height, depthM: 0.10, standoffM: 0.035, bevelM: 0.006 } as const;
export interface HallSign {
  facade: "front" | "right";
  centerU: number;
  centerY: number;
  widthM: number;
  heightM: number;
}

/** Original PDF coordinates have y pointing up, matching local facade coordinates. */
export function logoShapes(widthM: number): THREE.Shape[] {
  const scale = widthM / artwork.width;
  const shapes: THREE.Shape[] = [];
  for (const commands of artwork.paths) {
    const path = new THREE.ShapePath();
    for (const command of commands) {
      const [op, ...args] = command;
      const values = args as number[];
      const x = (i: number) => (values[i]! - artwork.width / 2) * scale;
      const y = (i: number) => (values[i]! - artwork.height / 2) * scale;
      if (op === "M") path.moveTo(x(0), y(1));
      else if (op === "L") {
        for (let i = 0; i < values.length; i += 2) path.lineTo(x(i), y(i + 1));
      } else if (op === "C") path.bezierCurveTo(x(0), y(1), x(2), y(3), x(4), y(5));
      else if (op === "Z") path.currentPath?.closePath();
    }
    shapes.push(...path.toShapes());
  }
  return shapes;
}

export function buildHallSignGeometry(widthM: number): THREE.ExtrudeGeometry {
  return new THREE.ExtrudeGeometry(logoShapes(widthM), {
    depth: SIGNAGE.depthM, bevelEnabled: true, bevelThickness: SIGNAGE.bevelM,
    bevelSize: SIGNAGE.bevelM, bevelSegments: 1, steps: 1, curveSegments: 8,
  });
}

type Interval = [number, number];
function exclude(intervals: Interval[], lo: number, hi: number): Interval[] {
  return intervals.flatMap(([a, b]): Interval[] => hi <= a || lo >= b ? [[a, b]] : [
    ...(lo > a ? [[a, lo] as Interval] : []), ...(hi < b ? [[hi, b] as Interval] : []),
  ]);
}

/** Locate lettering on solid cladding, below the navy cornice and clear of windows, gates and downpipes.
 * L-shaped halls use the actual facade length, so signs never bridge the courtyard. */
export function layoutHallSigns(config: HallConfig): HallSign[] {
  const openings = placeOpenings(config);
  const C = config.dimensions.clearHeightM;
  const out: HallSign[] = [];
  for (const facade of ["front", "right"] as const) {
    const len = facadeLengthM(config.dimensions, facade);
    const margin = Math.min(3, len * 0.08);
    const desired = Math.min(18, config.dimensions.lengthM * 0.28, C * 0.22 * SIGNAGE.aspect) * (facade === "right" ? 0.78 : 1);
    const width = Math.min(desired, len - 2 * margin);
    const facadeOpenings = openings.filter((o) => o.facade === facade);
    const tops = [...new Set([C + 0.1, ...facadeOpenings.map((o) => o.sillM - 0.25)])].sort((a, b) => b - a);
    let placed = false;
    for (const factor of [1, 0.85, 0.7, 0.55]) {
      const w = width * factor, h = w / SIGNAGE.aspect;
      if (w < 4.5) continue;
      for (const top of tops) {
        const bottom = top - h;
        if (bottom < 3 || top > C + 0.1) continue;
        let free: Interval[] = [[margin, len - margin]];
        for (const o of facadeOpenings) {
          if (top > o.sillM - 0.2 && bottom < o.sillM + o.heightM + 0.2) free = exclude(free, o.centerU - o.widthM / 2 - 0.3, o.centerU + o.widthM / 2 + 0.3);
        }
        // Same downpipe positions and opening exclusions as buildShell.
        if (facade === "front") for (let u = 12; u < len - 6; u += 24) {
          if (!facadeOpenings.some((o) => Math.abs(o.centerU - u) < o.widthM / 2 + 0.6)) free = exclude(free, u - 0.3, u + 0.3);
        }
        const spans = free.filter(([a, b]) => b - a >= w);
        const span = facade === "front" ? spans.at(-1) : spans[0];
        if (!span) continue;
        const centerU = facade === "front" ? span[1] - w / 2 : span[0] + w / 2;
        out.push({ facade, centerU, centerY: top - h / 2, widthM: w, heightM: h });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  return out;
}
