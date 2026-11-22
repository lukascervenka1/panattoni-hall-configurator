/**
 * Rozmístění otvorů a administrativy. Čistá logika bez Reactu a Three.js.
 *
 * Souřadnice: osa x je délka haly L, osa z šířka W, osa y výška. Střed půdorysu je v počátku.
 * Fasáda se měří lokální souřadnicí u: zleva doprava při pohledu zvenčí.
 *   front (+z): u roste s +x       left  (-x): u roste s +z
 *   rear  (-z): u roste s -x       right (+x): u roste s -z
 *
 * Doky jsou na zadní fasádě, vjezdová vrata na pravé (kratší) fasádě, administrativa v levém předním rohu.
 * Tím jsou skupiny otvorů na různých fasádách a nemohou kolidovat; kolizi uvnitř fasády hlídá findOpeningCollisions.
 */
import { DEMO_GEOMETRY as G, FACADE_IDS } from "./constants";
import type { HallConfig } from "../schema/config";

export type FacadeId = (typeof FACADE_IDS)[number];
export type OpeningKind = "dock" | "driveIn" | "window" | "hallWindow" | "entrance";

export interface Dimensions {
  lengthM: number;
  widthM: number;
  clearHeightM: number;
  shape?: "rect" | "L";
  notchLengthM?: number;
  notchWidthM?: number;
}

/** Rozměry výřezu; u obdélníku nuly. */
export function notchOf(d: Dimensions): { nx: number; nz: number } {
  return d.shape === "L" ? { nx: d.notchLengthM ?? 0, nz: d.notchWidthM ?? 0 } : { nx: 0, nz: 0 };
}

/** Fasády existující pro daný tvar: 4 u obdélníku, 6 u L (přibývají vnitřní stěny výřezu). */
export function facadesOf(d: Dimensions): FacadeId[] {
  return d.shape === "L" && notchOf(d).nx > 0 && notchOf(d).nz > 0 ? [...FACADE_IDS] : ["front", "rear", "left", "right"];
}

export type Vec2 = [number, number];

/**
 * Půdorys budovy jako polygon (x, z) proti směru hodinových ručiček v rovině (x, z), volitelně zmenšený o `inset` metrů
 * (vnitřní okraj stěn). Výřez L je v pravém předním rohu (+x, +z).
 */
export function footprintPolygon(d: Dimensions, inset = 0): Vec2[] {
  const { lengthM: L, widthM: W } = d;
  const { nx, nz } = notchOf(d);
  const i = inset;
  if (nx <= 0 || nz <= 0) {
    return [[-L / 2 + i, -W / 2 + i], [L / 2 - i, -W / 2 + i], [L / 2 - i, W / 2 - i], [-L / 2 + i, W / 2 - i]];
  }
  return [
    [-L / 2 + i, -W / 2 + i],
    [L / 2 - i, -W / 2 + i],
    [L / 2 - i, W / 2 - nz - i],
    [L / 2 - nx - i, W / 2 - nz - i],
    [L / 2 - nx - i, W / 2 - i],
    [-L / 2 + i, W / 2 - i],
  ];
}

export function footprintAreaM2(d: Dimensions): number {
  const { nx, nz } = notchOf(d);
  return d.lengthM * d.widthM - nx * nz;
}

/** Je bod (x, z) uvnitř obálky (mimo výřez)? `pad` rozšiřuje výřez (odstup od něj). */
export function pointInFootprint(d: Dimensions, x: number, z: number, pad = 0): boolean {
  const { lengthM: L, widthM: W } = d;
  if (x < -L / 2 || x > L / 2 || z < -W / 2 || z > W / 2) return false;
  const { nx, nz } = notchOf(d);
  if (nx > 0 && nz > 0 && x > L / 2 - nx - pad && z > W / 2 - nz - pad) return false;
  return true;
}

/** Protíná obdélník (x0..x1, z0..z1) výřez? `pad` je odstup. */
export function rectHitsNotch(d: Dimensions, r: { x0: number; x1: number; z0: number; z1: number }, pad = 0): boolean {
  const { lengthM: L, widthM: W } = d;
  const { nx, nz } = notchOf(d);
  if (nx <= 0 || nz <= 0) return false;
  return r.x1 > L / 2 - nx - pad && r.x0 < L / 2 + pad && r.z1 > W / 2 - nz - pad && r.z0 < W / 2 + pad;
}

/** Meze rozměrů výřezu pro daný obdélník haly: ramena musí zůstat nejméně `minArmM` široká. */
export function notchLimits(d: Dimensions): { available: boolean; minM: number; maxLengthM: number; maxWidthM: number } {
  const minM = G.notch.minM;
  const maxLengthM = d.lengthM - G.notch.minArmM;
  const maxWidthM = d.widthM - G.notch.minArmM;
  return { available: maxLengthM >= minM && maxWidthM >= minM, minM, maxLengthM, maxWidthM };
}

export interface PlacedOpening {
  id: string;
  facade: FacadeId;
  kind: OpeningKind;
  /** Střed otvoru podél fasády (m od levého kraje při pohledu zvenčí). */
  centerU: number;
  widthM: number;
  heightM: number;
  /** Výška spodní hrany nad terénem. */
  sillM: number;
  /** Podlaží administrativy (0 = přízemí); u vrat 0. */
  floor: number;
}

export interface OfficeLayout {
  widthM: number;
  depthM: number;
  perFloorAreaM2: number;
  floors: number;
  heightM: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export function totalHeightM(clearHeightM: number): number {
  return clearHeightM + G.roofStructureAllowanceM;
}

export function facadeLengthM(dims: Dimensions, facade: FacadeId): number {
  const { nx, nz } = notchOf(dims);
  switch (facade) {
    case "front":
      return dims.lengthM - nx;
    case "rear":
      return dims.lengthM;
    case "left":
      return dims.widthM;
    case "right":
      return dims.widthM - nz;
    case "notchA":
      return nx;
    case "notchB":
      return nz;
  }
}

/** Nejvyšší počet otvorů šířky `openingW` na úseku fasády délky `facadeLen` při dané minimální osové vzdálenosti. */
function capacity(facadeLen: number, openingW: number, minPitch: number, endMargin: number): number {
  const span = facadeLen - 2 * endMargin;
  if (span < openingW) return 0;
  return Math.floor((span - openingW) / minPitch) + 1;
}

export function maxDockCount(dims: Dimensions): number {
  return capacity(dims.lengthM, G.dock.widthM, G.dock.minPitchM, G.dock.endMarginM);
}

export function maxDriveInCount(dims: Dimensions): number {
  return capacity(facadeLengthM(dims, "right"), G.driveIn.widthM, G.driveIn.minPitchM, G.driveIn.endMarginM);
}

/** Meze celkové podlahové plochy administrativy pro daný rozměr haly a počet podlaží. */
export function officeAreaLimits(dims: Dimensions, floors: 1 | 2 | 3): { minM2: number; maxM2: number } {
  const depth = G.office.depthM;
  const maxDepthOk = dims.widthM - G.office.minRemainingHallDepthM >= depth;
  const maxWidth = Math.min(G.office.maxShareOfLength * dims.lengthM, facadeLengthM(dims, "front") - 6);
  const minPerFloor = G.office.minPerFloorWidthM * depth;
  const maxPerFloor = maxDepthOk ? maxWidth * depth : 0;
  return { minM2: Math.ceil(minPerFloor * floors), maxM2: Math.floor(maxPerFloor * floors) };
}

/** Největší počet podlaží administrativy, který se vejde pod světlou výšku haly. */
export function maxOfficeFloors(clearHeightM: number): 0 | 1 | 2 | 3 {
  const fits = (n: number) => n * G.office.floorHeightM + G.office.headroomM <= clearHeightM;
  if (fits(3)) return 3;
  if (fits(2)) return 2;
  if (fits(1)) return 1;
  return 0;
}

export function officeLayout(config: Pick<HallConfig, "dimensions" | "office">): OfficeLayout | null {
  const { dimensions: d, office } = config;
  if (!office.enabled || office.areaM2 <= 0) return null;
  const perFloor = office.areaM2 / office.floors;
  const depth = G.office.depthM;
  const width = perFloor / depth;
  return {
    widthM: width,
    depthM: depth,
    perFloorAreaM2: perFloor,
    floors: office.floors,
    heightM: office.floors * G.office.floorHeightM,
    x0: -d.lengthM / 2,
    x1: -d.lengthM / 2 + width,
    z0: d.widthM / 2 - depth,
    z1: d.widthM / 2,
  };
}

/** Rozmístí `count` otvorů souměrně kolem středu fasády, uvnitř úseku bez krajních rezerv. */
function distributeCentered(count: number, facadeLen: number, w: number, preferredPitch: number, endMargin: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [facadeLen / 2];
  const centerRange = facadeLen - 2 * endMargin - w; // rozsah, na kterém se mohou pohybovat středy
  const pitch = Math.min(preferredPitch, Math.max(0, centerRange) / (count - 1));
  return Array.from({ length: count }, (_, i) => facadeLen / 2 + (i - (count - 1) / 2) * pitch);
}

/** Pevné otvory: vrata, okna administrativy a vstup. Předcházejí umístění loga i horních fasádních oken. */
function placeArchitecturalOpenings(config: Pick<HallConfig, "dimensions" | "openings" | "office">): PlacedOpening[] {
  const { dimensions: d, openings } = config;
  const out: PlacedOpening[] = [];

  distributeCentered(openings.dockCount, d.lengthM, G.dock.widthM, G.dock.preferredPitchM, G.dock.endMarginM).forEach((u, i) =>
    out.push({
      id: `dock-${i + 1}`,
      facade: "rear",
      kind: "dock",
      centerU: u,
      widthM: G.dock.widthM,
      heightM: G.dock.heightM,
      sillM: G.dock.sillM,
      floor: 0,
    }),
  );

  distributeCentered(openings.driveInCount, facadeLengthM(d, "right"), G.driveIn.widthM, G.driveIn.preferredPitchM, G.driveIn.endMarginM).forEach((u, i) =>
    out.push({
      id: `drivein-${i + 1}`,
      facade: "right",
      kind: "driveIn",
      centerU: u,
      widthM: G.driveIn.widthM,
      heightM: G.driveIn.heightM,
      sillM: 0,
      floor: 0,
    }),
  );

  const office = officeLayout(config);
  if (office) {
    const nFront = Math.floor(office.widthM / G.window.pitchM);
    const nSide = Math.floor(office.depthM / G.window.pitchM);
    const frame = columnFrame(d);
    const frontU = clearOfColumns(
      Array.from({ length: nFront }, (_, i) => G.window.pitchM * (i + 0.5)),
      frame.xs.map((x) => x + d.lengthM / 2),
      G.window.widthM,
      { min: 0, max: office.widthM },
    );
    const sideU = clearOfColumns(
      Array.from({ length: nSide }, (_, i) => d.widthM - G.window.pitchM * (i + 0.5)),
      frame.zs.map((z) => z + d.widthM / 2),
      G.window.widthM,
      { min: d.widthM - office.depthM, max: d.widthM },
    );
    for (let f = 0; f < office.floors; f++) {
      const sill = f * G.office.floorHeightM + G.window.sillM;
      for (let i = 0; i < nFront; i++) {
        out.push({
          id: `win-front-${f}-${i}`,
          facade: "front",
          kind: "window",
          centerU: frontU[i]!,
          widthM: G.window.widthM,
          heightM: G.window.heightM,
          sillM: sill,
          floor: f,
        });
      }
      for (let i = 0; i < nSide; i++) {
        out.push({
          id: `win-left-${f}-${i}`,
          facade: "left",
          kind: "window",
          centerU: sideU[i]!,
          widthM: G.window.widthM,
          heightM: G.window.heightM,
          sillM: sill,
          floor: f,
        });
      }
    }
    // Vstup do administrativy: vedle jejího konce na čelní fasádě, mimo okna (počet a plocha oken se nemění).
    const frontLen = facadeLengthM(d, "front");
    const E = G.entrance;
    const [entranceU] = clearOfColumns([office.widthM + E.offsetM], frame.xs.map((x) => x + d.lengthM / 2), E.widthM, { min: office.widthM + 0.4, max: frontLen - 1.5 });
    if (entranceU !== undefined && entranceU + E.widthM / 2 <= frontLen - 1.5) {
      out.push({ id: "entrance-1", facade: "front", kind: "entrance", centerU: entranceU, widthM: E.widthM, heightM: E.heightM, sillM: 0, floor: 0 });
    }
  }
  return out;
}

export interface HallSign {
  facade: "front" | "right";
  centerU: number;
  centerY: number;
  widthM: number;
  heightM: number;
}

type SignInterval = [number, number];
function excludeSignInterval(intervals: SignInterval[], lo: number, hi: number): SignInterval[] {
  return intervals.flatMap(([a, b]): SignInterval[] => hi <= a || lo >= b ? [[a, b]] : [
    ...(lo > a ? [[a, lo] as SignInterval] : []), ...(hi < b ? [[hi, b] as SignInterval] : []),
  ]);
}

/** Logo má přednost před horními fasádními okny, ale respektuje pevné otvory a svody. Bez závislosti na Three.js. */
function placeFacadeSigns(dimensions: Dimensions, openings: PlacedOpening[]): HallSign[] {
  const C = dimensions.clearHeightM;
  const aspect = G.facadeSign.aspect;
  const out: HallSign[] = [];
  for (const facade of ["front", "right"] as const) {
    const len = facadeLengthM(dimensions, facade);
    const margin = Math.min(3, len * 0.08);
    const desired = Math.min(18, dimensions.lengthM * 0.28, C * 0.22 * aspect) * (facade === "right" ? 0.78 : 1);
    const width = Math.min(desired, len - 2 * margin);
    const facadeOpenings = openings.filter((o) => o.facade === facade);
    const tops = [...new Set([C + 0.1, ...facadeOpenings.map((o) => o.sillM - 0.25)])].sort((a, b) => b - a);
    let placed = false;
    for (const factor of [1, 0.85, 0.7, 0.55]) {
      const w = width * factor, h = w / aspect;
      if (w < 4.5) continue;
      for (const top of tops) {
        const bottom = top - h;
        if (bottom < 3 || top > C + 0.1) continue;
        let free: SignInterval[] = [[margin, len - margin]];
        for (const o of facadeOpenings) {
          if (top > o.sillM - 0.2 && bottom < o.sillM + o.heightM + 0.2) free = excludeSignInterval(free, o.centerU - o.widthM / 2 - 0.3, o.centerU + o.widthM / 2 + 0.3);
        }
        // Stejné pozice svodů a vyloučení u otvorů jako v buildShell.
        if (facade === "front") for (let u = 12; u < len - 6; u += 24) {
          if (!facadeOpenings.some((o) => Math.abs(o.centerU - u) < o.widthM / 2 + 0.6)) free = excludeSignInterval(free, u - 0.3, u + 0.3);
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

/** Stabilní kotvy loga: režim denního světla jejich polohu ani rozměr nemění. */
export function placeHallSigns(config: Pick<HallConfig, "dimensions" | "openings" | "office">): HallSign[] {
  return placeFacadeSigns(config.dimensions, placeArchitecturalOpenings(config));
}

export function placeOpenings(config: Pick<HallConfig, "dimensions" | "openings" | "office"> & Partial<Pick<HallConfig, "daylight">>): PlacedOpening[] {
  const out = placeArchitecturalOpenings(config);
  if (config.daylight === "facade" || config.daylight === "both") {
    const signs = placeFacadeSigns(config.dimensions, out);
    const pad = G.facadeSign.windowClearanceM;
    out.push(...placeHallWindows(config).filter((window) => !signs.some((sign) =>
      sign.facade === window.facade &&
      Math.abs(sign.centerU - window.centerU) < (sign.widthM + window.widthM) / 2 + pad &&
      sign.centerY + sign.heightM / 2 + pad > window.sillM &&
      sign.centerY - sign.heightM / 2 - pad < window.sillM + window.heightM,
    )));
  }
  return out;
}

/** Horní fasádní okna mezi sloupy. Pás končí pod světlou výškou a začíná nad vjezdovými vraty. */
function placeHallWindows(config: Pick<HallConfig, "dimensions" | "office">): PlacedOpening[] {
  const d = config.dimensions;
  const height = Math.min(1.5, d.clearHeightM - 5.5);
  if (height < 0.4) return [];
  const frame = columnFrame(d);
  const office = officeLayout(config);
  const { nx, nz } = notchOf(d);
  const result: PlacedOpening[] = [];
  for (const facade of facadesOf(d)) {
    const length = facadeLengthM(d, facade);
    const start = facade === "front" && office ? office.widthM + 1 : 1.4;
    const end = facade === "left" && office ? length - office.depthM - 1 : length - 1.4;
    const columns = facade === "front" ? frame.xs.map((x) => x + d.lengthM / 2)
      : facade === "rear" ? frame.xs.map((x) => d.lengthM / 2 - x)
      : facade === "left" ? frame.zs.map((z) => z + d.widthM / 2)
      : facade === "notchA" ? frame.xs.map((x) => x - (d.lengthM / 2 - nx))
      : frame.zs.map((z) => d.widthM / 2 - (facade === "right" ? nz : 0) - z);
    const cuts = [start, ...columns.filter((u) => u > start && u < end), end].sort((a, b) => a - b);
    if (end <= start) continue;
    for (let bay = 0; bay < cuts.length - 1; bay++) {
      const a = cuts[bay]! + 0.6;
      const b = cuts[bay + 1]! - 0.6;
      if (b - a < 2) continue;
      const count = Math.max(1, Math.floor((b - a) / 6));
      const pitch = (b - a) / count;
      for (let i = 0; i < count; i++) {
        result.push({ id: `hall-win-${facade}-${bay}-${i}`, facade, kind: "hallWindow",
          centerU: a + (i + 0.5) * pitch, widthM: Math.min(4, pitch - 0.6), heightM: height,
          sillM: d.clearHeightM - 0.2 - height, floor: -1 });
      }
    }
  }
  return result;
}

export interface OpeningProblem {
  a: string;
  b?: string;
  reason: "collision" | "outside_facade" | "above_facade";
}

/** Kolize (překryv obdélníků) a přesahy otvorů mimo fasádu. Prázdný výsledek = otvory jsou platně rozmístěny. */
export function findOpeningProblems(dims: Dimensions, openings: PlacedOpening[]): OpeningProblem[] {
  const problems: OpeningProblem[] = [];
  const H = totalHeightM(dims.clearHeightM);
  for (const o of openings) {
    const len = facadeLengthM(dims, o.facade);
    if (o.centerU - o.widthM / 2 < -1e-9 || o.centerU + o.widthM / 2 > len + 1e-9) problems.push({ a: o.id, reason: "outside_facade" });
    if (o.sillM + o.heightM > H + 1e-9) problems.push({ a: o.id, reason: "above_facade" });
  }
  for (const facade of facadesOf(dims)) {
    const list = openings.filter((o) => o.facade === facade);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const overlapU = Math.abs(a.centerU - b.centerU) < (a.widthM + b.widthM) / 2 - 1e-9;
        const overlapY = a.sillM < b.sillM + b.heightM - 1e-9 && b.sillM < a.sillM + a.heightM - 1e-9;
        if (overlapU && overlapY) problems.push({ a: a.id, b: b.id, reason: "collision" });
      }
    }
  }
  return problems;
}

/**
 * Rastr sloupů pro vizualizaci a interiér. Pozice sloupů jsou orientační, nepotvrzují statický návrh.
 * Vrací středy řad podél délky (x) a napříč šířkou (z).
 */
export function columnGrid(dims: Dimensions): { xs: number[]; zs: number[] } {
  const nx = Math.max(1, Math.round(dims.lengthM / G.columnGrid.pitchAlongM));
  const nz = Math.max(1, Math.ceil(dims.widthM / G.columnGrid.maxSpanAcrossM));
  const xs = Array.from({ length: nx + 1 }, (_, i) => -dims.lengthM / 2 + (i * dims.lengthM) / nx);
  const zs = Array.from({ length: nz + 1 }, (_, i) => -dims.widthM / 2 + (i * dims.widthM) / nz);
  return { xs, zs };
}

/** Odstup osy krajních sloupů od vnějšího líce fasády: tloušťka stěny + polovina konzoly (0,95 m) + malá vůle. */
export const COLUMN_EDGE_INSET_M = G.wallThicknessM + 0.5;

/**
 * Rastr sloupů tak, jak stojí v hale: krajní řady leží uvnitř obvodové stěny, ne v její rovině. Dříve seděly osou
 * přímo na líci fasády, takže vyčnívaly ven jako pilastry a procházely okny.
 */
export function columnFrame(dims: Dimensions): { xs: number[]; zs: number[] } {
  const { xs, zs } = columnGrid(dims);
  const inset = (v: number[]) => v.map((x, i) => (i === 0 ? x + COLUMN_EDGE_INSET_M : i === v.length - 1 ? x - COLUMN_EDGE_INSET_M : x));
  return { xs: inset(xs), zs: inset(zs) };
}

/** Poloviční šířka sloupu 0,6 m a vůle, aby okno nesousedilo se sloupem za sklem. */
const WINDOW_COLUMN_CLEARANCE_M = 0.3 + 0.25;

/**
 * Posune středy oken tak, aby žádné nebylo před sloupem. Počet oken se nemění (počet i plocha vstupují do ceny),
 * posouvá se jen o nejmenší nutnou vzdálenost, přednostně na stranu, kde je v administrativě místo.
 */
function clearOfColumns(centers: number[], columnsU: number[], windowW: number, range: { min: number; max: number }): number[] {
  const need = windowW / 2 + WINDOW_COLUMN_CLEARANCE_M;
  return centers.map((c0) => {
    let c = c0;
    for (const u of columnsU) {
      if (Math.abs(c - u) >= need - 1e-9) continue;
      const left = u - need;
      const right = u + need;
      const fits = (v: number) => v >= range.min + windowW / 2 && v <= range.max - windowW / 2;
      const options = [left, right].filter(fits);
      const pool = options.length ? options : [left, right];
      c = pool.reduce((best, v) => (Math.abs(v - c) < Math.abs(best - c) ? v : best));
    }
    return c;
  });
}
