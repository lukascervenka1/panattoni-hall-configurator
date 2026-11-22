/** Raised facade lettering from the original vector artwork, never a substitute font or a rectangular decal. */
import * as THREE from "three";
import { DEMO_GEOMETRY as G } from "@/configurator/calculations/constants";
import artwork from "./panattoniLogo.paths.json";

export { placeHallSigns as layoutHallSigns, type HallSign } from "@/configurator/calculations/layout";
export const SIGNAGE = { aspect: G.facadeSign.aspect, depthM: 0.10, standoffM: 0.035, bevelM: 0.006 } as const;

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

