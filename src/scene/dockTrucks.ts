/**
 * Kamiony u nakládacích doků (čistá logika bez Reactu a Three.js). Poloha kamionu je funkcí času: `dockTruckPose(t, live)`.
 *
 * Cyklus jednoho kamionu: přijede po hlavní silnici, odbočí na účelovou komunikaci vedle haly, projede po vnějším pruhu
 * manipulační plochy, zastaví za svým dokem a couvá do doku. Po vyložení popojede dopředu, vyjede vnitřním pruhem
 * a odjede zpět na silnici. Příjezd a odjezd mají vlastní pruhy, takže se kamiony na ploše nepotkají.
 * Ilustrace provozu, ne dopravní návrh ani harmonogram nakládky. Vše je deterministické.
 */
import type { SurroundingsLayout } from "./layout";
import { accessLanes, lanes, makePath, poseAt, type Path } from "./traffic";

export const DOCK_TRUCK = {
  /** Poloviční délka a šířka tělesa soupravy (návěs + tahač). */
  halfLengthM: 8.6,
  halfWidthM: 1.3,
  /** Střed zaparkovaného kamionu je 8,7 m od fasády, ať zadek návěsu končí u doku (nebo u nakládacího domu). */
  centerFromWallM: 8.7,
  /** Vzdálenost vnitřního (odjezdového) a vnějšího (příjezdového) pruhu od středu zaparkovaného kamionu. */
  outLaneM: 11,
  inLaneM: 15,
  /** Nejmenší osová vzdálenost dvou kamionů u doků. */
  minSpacingM: 12,
  /** Cestovní rychlosti (m/s), délka brzdění před dokem a rozjezdu po odjezdu (m). */
  approachSpeed: 13,
  reverseSpeed: 1.7,
  exitSpeed: 13,
  brakeM: 25,
  accelM: 20,
  roadReachM: 45,
} as const;

export interface DockTruck {
  id: string;
  /** Střed zaparkovaného kamionu. */
  dockX: number;
  dockZ: number;
  inPath: Path;
  reversePath: Path;
  outPath: Path;
  tIn: number;
  tRev: number;
  tOut: number;
  /** Začátek příjezdu v rámci společného cyklu (s). */
  arriveAt: number;
  /** Doba od začátku příjezdu do začátku odjezdu (s): příjezd, couvání a stání u doku. */
  departAfter: number;
  /** Délka společného cyklu všech kamionů (s). */
  cycle: number;
  /** Posun společných hodin, ať na začátku už některé kamiony stojí u doků (s). */
  clockOffset: number;
}

export interface DockTruckPose {
  visible: boolean;
  x: number;
  z: number;
  /** Natočení kolem osy y (lokální +z kamionu míří dopředu, ke kabině). */
  rotY: number;
  moving: boolean;
  /** Couvá do doku (zadní světla). */
  reversing: boolean;
}

/**
 * Vytvoří kamiony pro kotvy z `layout.trucks`; bez doků žádné.
 *
 * Společný harmonogram: čas je rozdělen do úseků stejné délky a v každém úseku se hýbe nejvýše jeden kamion (příjezd
 * jednoho, o dva úseky později odjezd jiného), ostatní stojí u doků nebo nejsou na ploše. Kamiony se tak nikdy
 * nepotkají na komunikaci ani na ploše, i když jsou jejich dráhy dlouhé a těla soupravy 17 m.
 */
export function buildDockTrucks(layout: SurroundingsLayout, widthM: number, dockHouse: boolean): DockTruck[] {
  const { serviceRoad, road, apron } = layout;
  const lane = lanes(road);
  const dockZ = -widthM / 2 - (dockHouse ? 3.4 : 0.5) - DOCK_TRUCK.centerFromWallM;
  const zIn = Math.max(apron.z0 + 3, dockZ - DOCK_TRUCK.inLaneM);
  const zOut = Math.max(apron.z0 + 3, dockZ - DOCK_TRUCK.outLaneM);
  const { inbound: xIn, outbound: xOut } = accessLanes(serviceRoad);
  const reach = DOCK_TRUCK.roadReachM;
  const base = layout.trucks.map((anchor, i) => {
    // Začátek couvání: za dokem na západní straně (kamion projel kolem doku po vnějším pruhu).
    const startX = Math.max(apron.x0 + 4, anchor.x - 9);
    const inPath = makePath([[xIn + reach, lane.west], [xIn, lane.west], [xIn, zIn], [startX, zIn]], 6);
    const reversePath = makePath([[startX, zIn], [anchor.x, zIn], [anchor.x, dockZ]], 6);
    const outPath = makePath([[anchor.x, dockZ], [anchor.x, zOut], [xOut, zOut], [xOut, lane.east], [xOut + reach, lane.east]], 6);
    return { i, anchor, inPath, reversePath, outPath, tIn: (inPath.length + DOCK_TRUCK.brakeM) / DOCK_TRUCK.approachSpeed, tRev: reversePath.length / DOCK_TRUCK.reverseSpeed, tOut: (outPath.length + DOCK_TRUCK.accelM) / DOCK_TRUCK.exitSpeed };
  });
  const n = base.length;
  if (n === 0) return [];
  const slot = Math.max(...base.map((b) => Math.max(b.tIn + b.tRev, b.tOut))) + 2;
  const cycle = 2 * n * slot;
  const lag = Math.max(1, Math.min(n - 1, 2));
  return base.map((b) => {
    const arriveSlot = 2 * b.i;
    const departSlot = 2 * ((b.i + lag) % n) + 1;
    return {
      id: `dock-truck-${b.i}`,
      dockX: b.anchor.x,
      dockZ,
      inPath: b.inPath,
      reversePath: b.reversePath,
      outPath: b.outPath,
      tIn: b.tIn,
      tRev: b.tRev,
      tOut: b.tOut,
      arriveAt: arriveSlot * slot,
      departAfter: ((((departSlot - arriveSlot) % (2 * n)) + 2 * n) % (2 * n)) * slot,
      cycle,
      // na začátku (t = 0) začíná příjezd dalšího kamionu a ostatní už stojí u doků
      clockOffset: 2 * lag * slot,
    };
  });
}

/** Jízda stálou rychlostí `v`, na posledních `brake` metrech plynulé zastavení; vrací ujetou dráhu v čase `u`. */
function cruiseThenBrake(length: number, v: number, brake: number, u: number): number {
  const cruise = Math.max(0, length - brake);
  const tc = cruise / v;
  if (u <= tc) return v * u;
  const d = Math.min(u - tc, (2 * brake) / v);
  const a = (v * v) / (2 * brake);
  return Math.min(length, cruise + v * d - 0.5 * a * d * d);
}

/** Rozjezd na `v` během `accel` metrů a pak stálá rychlost; vrací ujetou dráhu v čase `u`. */
function accelThenCruise(v: number, accel: number, u: number): number {
  const ta = (2 * accel) / v;
  if (u <= ta) return 0.5 * (v / ta) * u * u;
  return accel + v * (u - ta);
}

export function dockTruckCycle(v: DockTruck): number {
  return v.cycle;
}

/** `live = false` (úspora pohybu): všechny kamiony stojí u svých doků. */
export function dockTruckPose(v: DockTruck, t: number, live = true): DockTruckPose {
  const docked: DockTruckPose = { visible: true, x: v.dockX, z: v.dockZ, rotY: Math.PI, moving: false, reversing: false };
  if (!live) return docked;
  const u = ((((t + v.clockOffset - v.arriveAt) % v.cycle) + v.cycle) % v.cycle);
  if (u < v.tIn) {
    const p = poseAt(v.inPath, cruiseThenBrake(v.inPath.length, DOCK_TRUCK.approachSpeed, DOCK_TRUCK.brakeM, u)); // brzdí před dokem
    return { visible: true, x: p.x, z: p.z, rotY: p.heading, moving: true, reversing: false };
  }
  if (u < v.tIn + v.tRev) {
    const k = (u - v.tIn) / v.tRev;
    const e = k * k * (3 - 2 * k);
    const p = poseAt(v.reversePath, v.reversePath.length * e);
    // Couvá: kabina míří opačně, než se souprava pohybuje.
    return { visible: true, x: p.x, z: p.z, rotY: p.heading + Math.PI, moving: true, reversing: true };
  }
  if (u < v.departAfter) return docked;
  if (u < v.departAfter + v.tOut) {
    const p = poseAt(v.outPath, accelThenCruise(DOCK_TRUCK.exitSpeed, DOCK_TRUCK.accelM, u - v.departAfter)); // rozjíždí se
    return { visible: true, x: p.x, z: p.z, rotY: p.heading, moving: true, reversing: false };
  }
  return { visible: false, x: 0, z: 0, rotY: 0, moving: false, reversing: false };
}
