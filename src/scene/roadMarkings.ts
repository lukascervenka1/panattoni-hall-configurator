/** Lane markings use the same metre coordinates as the traffic routes, including open access mouths. */
import type { InstanceItem } from "./Instanced";
import type { Rect, SurroundingsLayout } from "./layout";
import { accessLanes, lanes } from "./traffic";

export function layoutRoadMarkings(site: SurroundingsLayout, road: Rect, serviceEnabled = true): InstanceItem[] {
  const items: InstanceItem[] = [];
  const y = 0.058;
  const line = (x: number, z: number, sx: number, sz: number, rotY = 0) => items.push({ x, y, z, sx, sy: 0.008, sz, rotY });
  const access = serviceEnabled ? [site.driveway, site.serviceRoad] : [site.driveway];
  const open = (x0: number, x1: number, extra = 0) => access.some((r) => x1 > r.x0 - extra && x0 < r.x1 + extra);
  const center = (road.z0 + road.z1) / 2;
  // Thin edge lines are broken at both access mouths; the middle dashes stop before turning areas.
  for (let x = road.x0 + 0.5; x < road.x1 - 0.5; x += 1) {
    line(x, road.z1 - 0.3, 1, 0.12);
    if (!open(x - 0.5, x + 0.5)) line(x, road.z0 + 0.3, 1, 0.12);
  }
  for (let x = road.x0 + 3; x < road.x1 - 3; x += 8) if (!open(x - 1.5, x + 1.5, 5)) line(x, center, 3, 0.14);
  const arrow = (x: number, z: number, heading: number) => {
    line(x, z, 0.13, 2.6, heading);
    for (const side of [-1, 1]) {
      const lx = side * 0.35, lz = 0.65;
      line(x + lx * Math.cos(heading) + lz * Math.sin(heading), z - lx * Math.sin(heading) + lz * Math.cos(heading), 0.12, 1.05, heading - side * Math.PI / 4);
    }
  };
  const roadLanes = lanes(road);
  for (const x of [site.plot.x0 + 10, site.plot.x1 - 10]) {
    if (!open(x - 4, x + 4, 8)) {
      arrow(x, roadLanes.east, Math.PI / 2);
      arrow(x, roadLanes.west, -Math.PI / 2);
    }
  }
  // Parking access: separate inbound/outbound lanes, a clear give-way line on exit.
  const drivewayCenter = (site.driveway.x0 + site.driveway.x1) / 2;
  for (let z = site.parking.z1 + 1; z < road.z0 - 2; z += 3.6) line(drivewayCenter, z, 0.12, 1.8);
  const drive = accessLanes(site.driveway);
  arrow(drive.inbound, site.parking.z1 + 4, Math.PI);
  arrow(drive.outbound, site.parking.z1 + 4, 0);
  for (let x = drive.outbound - 1.6; x < drive.outbound + 1.5; x += 0.8) line(x, road.z0 - 0.7, 0.5, 0.28);
  // Two-way service road, kept separate from the employee parking entrance.
  if (serviceEnabled) {
  const serviceCenter = (site.serviceRoad.x0 + site.serviceRoad.x1) / 2;
  for (let z = site.serviceRoad.z0 + 4; z < road.z0 - 3; z += 7) line(serviceCenter, z, 0.13, 3);
  const service = accessLanes(site.serviceRoad);
  arrow(service.inbound, road.z0 - 18, Math.PI);
  arrow(service.outbound, road.z0 - 18, 0);
  for (let x = service.outbound - 1.8; x < service.outbound + 1.8; x += 0.9) line(x, road.z0 - 0.7, 0.55, 0.28);
  }
  // Stall outlines come from actual stalls, so no lines suggest parking in an entrance or planted island.
  for (const stall of site.stalls) {
    for (const side of [-1, 1]) line(stall.x + side * 1.3, stall.z, 0.08, 5.1);
    line(stall.x, stall.z + (stall.z < stall.aisleZ ? -2.55 : 2.55), 2.6, 0.08);
  }
  return items;
}
