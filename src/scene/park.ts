/** A small, deterministic garden beside the hall. Fixed furniture and tree sizes, independent of hall scale. */
import { pocketParkBounds, type PlacedThing, type Rect, type SurroundingsLayout, type TreePlacement } from "./layout";

export interface ParkBench extends PlacedThing { rotY: number }
export interface ParkPond extends PlacedThing { radiusX: number; radiusZ: number }
export interface PocketParkLayout {
  bounds: Rect;
  pond: ParkPond;
  paths: Rect[];
  benches: ParkBench[];
  benchPads: Rect[];
  trees: TreePlacement[];
}

/** Shared shoreline for water, bank and walking loop. All contours retain the same quiet, organic silhouette. */
export function pondOutline(pond: ParkPond, padding = 0): Array<[number, number]> {
  return Array.from({ length: 48 }, (_, i) => {
    const a = i / 48 * Math.PI * 2;
    const wobble = 1 + 0.045 * Math.sin(a * 3) + 0.025 * Math.cos(a * 5);
    return [pond.x + Math.cos(a) * (pond.radiusX + padding) * wobble, pond.z + Math.sin(a) * (pond.radiusZ + padding) * wobble];
  });
}

export function layoutPocketPark(site: SurroundingsLayout): PocketParkLayout {
  const x = site.sidewalk.x0, z = site.sidewalk.z0;
  return {
    bounds: pocketParkBounds(site.sidewalk),
    pond: { x: x - 21, z: z - 9, radiusX: 7, radiusZ: 5.5 },
    paths: [
      // Link the lake loop and the existing sidewalk; the second link reaches the seating patio.
      { x0: x - 22.5, x1: x - 19.5, z0: z - 2.9, z1: z + 1.5 },
      { x0: x - 20, x1: x - 13.5, z0: z, z1: z + 2.6 },
      { x0: x - 15.5, x1: x - 13.5, z0: z + 2, z1: site.patio.z0 + 0.5 },
      { x0: x - 25.8, x1: x - 24.2, z0: z - 3.4, z1: z + 0.2 },
      { x0: x - 5.6, x1: x - 3, z0: z + 6.3, z1: z + 12.6 },
      { x0: x - 6.5, x1: x - 3, z0: z + 7.2, z1: z + 8.8 },
    ],
    benches: [
      { x: x - 11.4, z: z - 9, rotY: -Math.PI / 2 },
      { x: x - 25, z: z - 0.1, rotY: Math.PI },
    ],
    benchPads: [
      { x0: x - 12.8, x1: x - 10.4, z0: z - 10.6, z1: z - 7.4 },
      { x0: x - 26.6, x1: x - 23.4, z0: z - 1.1, z1: z + 0.9 },
    ],
    trees: [
      [-27, -19, 0.9], [-13, -19, 0.85], [-7, -7, 1.05],
      [-27, 4, 0.9], [-26, 18, 1], [-7, 20, 0.8], [-17, 19, 1.05],
    ].map(([dx, dz, scale]) => ({ x: x + dx!, z: z + dz!, scale: scale! })),
  };
}
