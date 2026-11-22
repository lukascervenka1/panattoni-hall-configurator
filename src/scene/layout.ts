/**
 * Čisté rozvržení ilustrativního okolí, světlíků a interiérového vybavení. Bez Three.js a Reactu, proto testovatelné.
 *
 * Okolí je ILUSTRATIVNÍ situace, nikoli skutečný pozemek ani ověřený dopravní návrh (spec kap. 3).
 * Auta, lidé, stromy a kamiony mají pevné rozměry: při změně rozměrů haly se přidávají nebo přemisťují, nikdy neroztahují.
 * Vše je rozmístěno vně obálky budovy a přepočítává se z jejích rozměrů.
 */
import { DEMO_GEOMETRY as G } from "@/configurator/calculations/constants";
import { computeQuantities } from "@/configurator/calculations/quantities";
import { columnFrame, facadeLengthM, footprintAreaM2, notchOf, officeLayout, placeOpenings, pointInFootprint, rectHitsNotch, totalHeightM } from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";
import { officeRoomEdges } from "./officeFurniture";

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export const OBJECT_SIZES = {
  car: { lengthM: 4.5, widthM: 1.8, heightM: 1.5 },
  person: { heightM: 1.75, radiusM: 0.22 },
  trailer: { lengthM: 13.6, widthM: 2.55, heightM: 2.9, bedM: 1.2 },
  cab: { lengthM: 2.4, widthM: 2.5, heightM: 2.9 },
  tree: { trunkM: 0.25, crownRadiusM: 2.6, heightM: 6 },
  skylight: { widthM: 6, depthM: 3 },
  rack: { depthM: 2.7, aisleM: 3.6, segmentM: 10.5, gapM: 1.5 },
} as const;

export const SITE = {
  plotMarginSideM: 35,
  apronDepthM: 38,
  parkingGapM: 4,
  parkingDepthM: 16,
  roadGapM: 8,
  roadWidthM: 8,
  plotFrontPadM: 4,
  exclusionMarginM: 1,
} as const;

export const rectContains = (r: Rect, x: number, z: number, pad = 0) =>
  x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

export function buildingRect(config: Pick<HallConfig, "dimensions">): Rect {
  const { lengthM: L, widthM: W } = config.dimensions;
  return { x0: -L / 2, x1: L / 2, z0: -W / 2, z1: W / 2 };
}

/** Reserved pocket park west of the hall: clear of parking, driveways and the loading apron. */
export function pocketParkBounds(sidewalk: Rect): Rect {
  return { x0: sidewalk.x0 - 30.5, x1: sidewalk.x0 - 4, z0: sidewalk.z0 - 23, z1: sidewalk.z0 + 23 };
}

/* ------------------------------------------------------------------ světlíky */

export interface SkylightPanel {
  x: number;
  z: number;
  widthM: number;
  depthM: number;
}

function gridPanels(zone: Rect, count: number): SkylightPanel[] {
  if (count <= 0) return [];
  const inset = 2;
  const x0 = zone.x0 + inset;
  const x1 = zone.x1 - inset;
  const z0 = zone.z0 + inset;
  const z1 = zone.z1 - inset;
  const lenX = x1 - x0;
  const lenZ = z1 - z0;
  if (lenX <= 0 || lenZ <= 0) return [];
  const rows = Math.max(1, Math.min(Math.round(Math.sqrt((count * lenZ) / Math.max(lenX, 1e-6))), Math.floor(lenZ / OBJECT_SIZES.skylight.depthM)));
  const cols = Math.ceil(count / rows);
  const out: SkylightPanel[] = [];
  for (let j = 0; j < rows && out.length < count; j++) {
    for (let i = 0; i < cols && out.length < count; i++) {
      out.push({
        x: x0 + ((i + 0.5) * lenX) / cols,
        z: z0 + ((j + 0.5) * lenZ) / rows,
        widthM: OBJECT_SIZES.skylight.widthM,
        depthM: OBJECT_SIZES.skylight.depthM,
      });
    }
  }
  return out;
}

/** Ilustrační rozmístění světlíků odpovídající účtované ploše (zóna doků 5 %, zbytek 2 %). */
export function layoutSkylights(config: HallConfig): SkylightPanel[] {
  if (config.daylight === "facade") return [];
  const { lengthM: L, widthM: W } = config.dimensions;
  const panelArea = OBJECT_SIZES.skylight.widthM * OBJECT_SIZES.skylight.depthM;
  const hasDocks = config.openings.dockCount > 0;
  const zoneDepth = hasDocks ? Math.min(W, G.skylight.dockZoneDepthM) : 0;
  const dockZone: Rect = { x0: -L / 2, x1: L / 2, z0: -W / 2, z1: -W / 2 + zoneDepth };
  const rest: Rect = { x0: -L / 2, x1: L / 2, z0: -W / 2 + zoneDepth, z1: W / 2 };
  const q = computeQuantities(config);
  const dockZoneArea = L * zoneDepth;
  const dockShare = hasDocks ? G.skylight.dockZoneShare * dockZoneArea : 0;
  const restShare = Math.max(0, q.skylightAreaM2 - dockShare);
  const nDock = hasDocks ? Math.max(1, Math.round(dockShare / panelArea)) : 0;
  const nRest = restShare > 0 ? Math.max(1, Math.round(restShare / panelArea)) : 0;

  // Půdorys L: mřížka se vygeneruje hustěji a panely ve výřezu se vyřadí; zbylé se rovnoměrně vyberou na požadovaný počet.
  const { nx, nz } = notchOf(config.dimensions);
  const fits = (list: SkylightPanel[], n: number, zoneArea: number) => {
    if (nx <= 0 || nz <= 0) return list;
    const kept = list.filter((p) => !rectHitsNotch(config.dimensions, { x0: p.x - p.widthM / 2, x1: p.x + p.widthM / 2, z0: p.z - p.depthM / 2, z1: p.z + p.depthM / 2 }, 2));
    if (kept.length <= n) return kept;
    return Array.from({ length: n }, (_, i) => kept[Math.floor(((i + 0.5) * kept.length) / n)]!);
  };
  const restRectArea = (rest.x1 - rest.x0) * (rest.z1 - rest.z0);
  const restFootprint = Math.max(1, restRectArea - nx * nz);
  const candRest = nx > 0 && nz > 0 ? Math.ceil((nRest * restRectArea) / restFootprint) + 2 : nRest;
  return [...gridPanels(dockZone, nDock), ...fits(gridPanels(rest, candRest), nRest, restFootprint)];
}

/* ------------------------------------------------------------------ okolí */

export interface PlacedThing {
  x: number;
  z: number;
}
export interface CarPlacement extends PlacedThing {
  rotY: number;
  color: number;
}
export interface TreePlacement extends PlacedThing {
  scale: number;
}

export interface Stall extends PlacedThing {
  occupied: boolean;
  /** Reserved arrival bay with empty neighbours for the parking manoeuvre. */
  dynamic?: boolean;
  /** Střed uličky, ze které se do stání zajíždí. */
  aisleZ: number;
}

export interface FenceLayout {
  rect: Rect;
  posts: PlacedThing[];
  /** Pole mezi sloupky: osa, délka a střed. */
  rails: Array<{ x: number; z: number; lengthM: number; axis: "x" | "z" }>;
}

export interface BushPlacement extends PlacedThing {
  scale: number;
}

export interface SurroundingsLayout {
  plot: Rect;
  /** Stožáry vlajek s logem u příjezdu do areálu. */
  flags: PlacedThing[];
  /** Dlážděný chodník od chodníku u haly k posezení (západně od parkoviště). */
  path: Rect;
  /** Dlážděné posezení s lavicemi pro zaměstnance. */
  patio: Rect;
  /** Stoly na posezení (každý má dvě lavice). */
  tables: PlacedThing[];
  /** Nízké keře: pás před chodníkem u haly a kolem posezení. */
  bushes: BushPlacement[];
  apron: Rect;
  parking: Rect;
  parkingIslands: Rect[];
  serviceRoad: Rect;
  road: Rect;
  cars: CarPlacement[];
  trucks: PlacedThing[];
  trees: TreePlacement[];
  people: PlacedThing[];
  /** Všechna parkovací stání; volná využívají přijíždějící auta (viz traffic.ts). */
  stalls: Stall[];
  sidewalk: Rect;
  /** Zpevněný dvorek ve výřezu půdorysu L (jinak null). */
  yard: Rect | null;
  driveway: Rect;
  fence: FenceLayout;
  guardhouse: PlacedThing;
  /** Stožáry osvětlení (parkoviště a manipulační plocha). */
  poles: PlacedThing[];
}

// Převážně neutrální, s několika barevnými auty (modrá, oranžová, červená) jako na vizuálu z katalogu.
const CAR_COLORS = [0xe8eaed, 0x2f3640, 0x8a939e, 0x1a4a7a, 0xb8bec6, 0x5a6470, 0xe8eaed, 0x2f5fa3, 0xd9822b, 0xa83232];

/** Deterministický hash z celočíselných souřadnic mřížky (stromy se při změně haly nepřelosují). */
function hash2(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function layoutSurroundings(config: HallConfig): SurroundingsLayout {
  const { lengthM: L, widthM: W } = config.dimensions;
  const b = buildingRect(config);

  const parking: Rect = {
    x0: -L / 2,
    x1: Math.min(L / 2, -L / 2 + 72),
    z0: W / 2 + SITE.parkingGapM,
    z1: W / 2 + SITE.parkingGapM + SITE.parkingDepthM,
  };
  const road: Rect = {
    x0: -L / 2 - 400,
    x1: L / 2 + 400,
    z0: parking.z1 + SITE.roadGapM,
    z1: parking.z1 + SITE.roadGapM + SITE.roadWidthM,
  };
  const plot: Rect = {
    x0: -L / 2 - SITE.plotMarginSideM,
    x1: L / 2 + SITE.plotMarginSideM,
    z0: -W / 2 - SITE.apronDepthM - 8,
    z1: road.z1 + SITE.plotFrontPadM,
  };
  const apron: Rect = { x0: -L / 2, x1: L / 2, z0: -W / 2 - SITE.apronDepthM, z1: -W / 2 };
  const sidewalk: Rect = { x0: -L / 2, x1: L / 2, z0: W / 2, z1: W / 2 + 2.6 };
  const notch = notchOf(config.dimensions);
  const yard: Rect | null = notch.nx > 0 && notch.nz > 0 ? { x0: L / 2 - notch.nx, x1: L / 2, z0: W / 2 - notch.nz, z1: W / 2 } : null;
  // Vlajky s logem u vjezdu: tři stožáry vlevo od příjezdu, uvnitř plotu.
  const flags: PlacedThing[] = [0, 1, 2].map((i) => ({ x: parking.x1 - 14 - 2 - i * 2.6, z: parking.z1 + 1.8 }));
  // Posezení a chodník k němu: západně od parkoviště, v zeleni před halou.
  const patio: Rect = { x0: -L / 2 - 20, x1: -L / 2 - 6, z0: W / 2 + 4, z1: W / 2 + 13 };
  const path: Rect = { x0: patio.x0, x1: -L / 2, z0: W / 2, z1: W / 2 + 2.6 };
  const tables: PlacedThing[] = [0, 1, 2].map((i) => ({ x: patio.x0 + 3.5 + i * 4.5, z: (patio.z0 + patio.z1) / 2 }));
  // Příjezd z komunikace na parkoviště a vrátnice vedle něj.
  const driveway: Rect = { x0: parking.x1 - 14, x1: parking.x1 - 4, z0: parking.z1, z1: road.z0 };
  const guardhouse: PlacedThing = { x: driveway.x1 + 4, z: parking.z1 + 2 };

  // Parkoviště: dvě řady kolmého stání, auta mají pevnou velikost, přibývá jejich počet.
  const parkingIslands: Rect[] = [];
  const serviceRoad: Rect = { x0: L / 2, x1: L / 2 + 12, z0: apron.z0, z1: road.z0 };
  const stalls: Stall[] = [];
  const cars: CarPlacement[] = [];
  const rowZ = [parking.z0 + 3, parking.z1 - 3];
  const aisleZ = parking.z0 + 8;
  for (const [r, z] of rowZ.entries()) {
    for (let x = parking.x0 + 1.35; x <= parking.x1 - 1.35; x += 2.7) {
      // Keep the complete entrance throat clear in both rows, including vehicle width.
      if (x + 1.35 >= driveway.x0 - 1.5 && x - 1.35 <= driveway.x1 + 1.5) continue;
      const column = Math.round((x - parking.x0 - 1.35) / 2.7);
      if (column % 8 === 0) {
        parkingIslands.push({ x0: x - 1.15, x1: x + 1.15, z0: z - 2.45, z1: z + 2.45 });
        continue;
      }
      const h = hash2(Math.round(x * 10), r * 7919 + 13);
      const manoeuvreBay = r === 1 && column % 9 >= 3 && column % 9 <= 5;
      const occupied = !manoeuvreBay && h >= 0.28;
      stalls.push({ x, z, occupied, aisleZ, dynamic: r === 1 && column % 9 === 4 && x < driveway.x0 - 5 });
      if (occupied) cars.push({ x, z, rotY: r === 0 ? Math.PI : 0, color: CAR_COLORS[Math.floor(h * 997) % CAR_COLORS.length]! });
    }
  }

  // Kamiony u doků: nejvýše 6, rovnoměrně po skupině doků a nejméně 12 m od sebe (aby se při couvání nepotkaly),
  // nikdy uvnitř budovy (návěs vyčnívá směrem od fasády).
  const docks = placeOpenings(config).filter((o) => o.kind === "dock");
  const trucks: PlacedThing[] = [];
  if (docks.length > 0) {
    const n = Math.min(6, docks.length);
    for (let i = 0; i < n; i++) {
      const dock = docks[Math.min(docks.length - 1, Math.round((i * (docks.length - 1)) / Math.max(1, n - 1)))]!;
      // u zadní fasády roste lokální u s -x: světová x = L/2 - u
      const x = L / 2 - dock.centerU;
      if (trucks.some((t) => Math.abs(t.x - x) < 12)) continue;
      trucks.push({ x, z: -W / 2 });
    }
  }

  // Lidé před vstupem do administrativy (nebo uprostřed fronty), pevná výška.
  const office = officeLayout(config);
  const px = office ? (office.x0 + office.x1) / 2 : 0;
  const people: PlacedThing[] = [
    { x: px - 1.2, z: W / 2 + 2.2 },
    { x: px + 0.4, z: W / 2 + 2.8 },
    { x: px + 1.5, z: W / 2 + 2.0 },
  ];

  // Stromy: mřížka 12 m ukotvená ve světových souřadnicích, bez zakázaných ploch.
  const blocked: Array<{ rect: Rect; pad: number }> = [
    { rect: pocketParkBounds(sidewalk), pad: 1 },
    { rect: { x0: flags.at(-1)!.x - 1, x1: flags[0]!.x + 1, z0: flags[0]!.z - 1, z1: flags[0]!.z + 1 }, pad: 3 },
    { rect: patio, pad: 3 },
    { rect: path, pad: 2 },
    { rect: b, pad: 8 },
    { rect: apron, pad: 3 },
    { rect: parking, pad: 3 },
    { rect: road, pad: 3 },
    { rect: driveway, pad: 3 },
    { rect: sidewalk, pad: 3 },
    { rect: serviceRoad, pad: 3 },
    { rect: { x0: guardhouse.x - 2, x1: guardhouse.x + 2, z0: guardhouse.z - 2, z1: guardhouse.z + 2 }, pad: 3 },
  ];
  const trees: TreePlacement[] = [];
  const STEP = 12;
  for (let gx = Math.ceil(plot.x0 / STEP); gx <= Math.floor(plot.x1 / STEP); gx++) {
    for (let gz = Math.ceil(plot.z0 / STEP); gz <= Math.floor(plot.z1 / STEP); gz++) {
      const jx = (hash2(gx, gz) - 0.5) * 6;
      const jz = (hash2(gz + 101, gx - 53) - 0.5) * 6;
      const x = gx * STEP + jx;
      const z = gz * STEP + jz;
      if (!rectContains(plot, x, z, -2)) continue;
      if (blocked.some((e) => rectContains(e.rect, x, z, e.pad))) continue;
      const edgeDist = Math.min(x - plot.x0, plot.x1 - x, z - plot.z0, plot.z1 - z);
      const keep = edgeDist < 16 ? hash2(gx + 7, gz + 3) > 0.15 : hash2(gx + 11, gz + 29) > 0.8;
      if (!keep) continue;
      trees.push({ x, z, scale: 0.8 + hash2(gx + 31, gz + 17) * 0.5 });
    }
  }

  // Keře: pás před chodníkem u haly (mimo výřez L) a kruh kolem posezení; deterministicky z mřížky.
  const bushes: BushPlacement[] = [];
  const bushZ = W / 2 + 3.35;
  for (let x = -L / 2 + 5; x <= L / 2 - 5 && bushes.length < 60; x += 9) {
    const jx = (hash2(Math.round(x), 41) - 0.5) * 3;
    const bx = x + jx;
    if (yard && rectContains(yard, bx, bushZ, 4)) continue;
    bushes.push({ x: bx, z: bushZ, scale: 0.8 + hash2(Math.round(x) + 5, 77) * 0.4 });
  }
  const cx = (patio.x0 + patio.x1) / 2;
  const cz = (patio.z0 + patio.z1) / 2;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    // elipsa kolem dlažby; mezera u chodníku (přivrácená strana k hale)
    const bx = cx + Math.cos(a) * ((patio.x1 - patio.x0) / 2 + 2.2);
    const bz = cz + Math.sin(a) * ((patio.z1 - patio.z0) / 2 + 2.2);
    if (bz < patio.z0 - 0.5) continue;
    bushes.push({ x: bx, z: bz, scale: 0.9 + hash2(i + 3, 19) * 0.5 });
  }

  // Stožáry: v ose parkoviště po 24 m a na manipulační ploše po 36 m (jen jsou-li doky).
  const poles: PlacedThing[] = [];
  for (let x = parking.x0 + 10; x <= parking.x1 - 6; x += 24) poles.push({ x, z: parking.z0 - 1 });
  if (config.openings.dockCount > 0) {
    for (let x = -L / 2 + 12; x <= L / 2 - 12; x += 36) poles.push({ x, z: apron.z0 + 5 });
  }

  // Oplocení areálu: plot po obvodu s mezerou pro příjezd (vjezd z komunikace).
  const fenceRect: Rect = { x0: plot.x0 + 4, x1: plot.x1 - 4, z0: plot.z0 + 4, z1: road.z0 - 4 };
  const fence = layoutFence(fenceRect, driveway);

  return { plot, flags, path, patio, tables, bushes, apron, parking, parkingIslands, serviceRoad, road, cars, stalls, trucks, trees: trees.slice(0, 400), people, sidewalk, yard, driveway, fence, guardhouse, poles: poles.slice(0, 40) };
}

/* ------------------------------------------------------------------ interiér */

export interface RackSegment {
  x: number;
  z: number;
  lengthM: number;
}

/** Ilustrační regály. Nezaručují skladovou kapacitu (spec kap. 6); zóny vynechávají doky, vrata a administrativu. */
export function layoutRacks(config: HallConfig, partitions: 0 | 1 | 2 = 0): { racks: RackSegment[]; heightM: number } {
  const { lengthM: L, widthM: W, clearHeightM: H } = config.dimensions;
  const office = officeLayout(config);
  const xMin = -L / 2 + 6;
  const xMax = L / 2 - 16;
  const zMin = -W / 2 + 16;
  const zMax = W / 2 - 6;
  const { depthM, aisleM, segmentM, gapM } = OBJECT_SIZES.rack;
  const pitch = depthM + aisleM;
  const racks: RackSegment[] = [];
  const keepOut: Rect | null = office ? { x0: office.x0 - 3, x1: office.x1 + 3, z0: office.z0 - 4, z1: office.z1 + 3 } : null;

  for (let z = zMin + depthM / 2; z + depthM / 2 <= zMax; z += pitch) {
    for (let x = xMin; x + segmentM <= xMax; x += segmentM + gapM) {
      const seg: Rect = { x0: x, x1: x + segmentM, z0: z - depthM / 2, z1: z + depthM / 2 };
      if (rectHitsNotch(config.dimensions, seg, 3)) continue;
      if (partitionXs(L, partitions).some((px) => seg.x1 > px - 2.5 && seg.x0 < px + 2.5)) continue;
      if (keepOut && seg.x1 > keepOut.x0 && seg.x0 < keepOut.x1 && seg.z1 > keepOut.z0 && seg.z0 < keepOut.z1) continue;
      racks.push({ x: x + segmentM / 2, z, lengthM: segmentM });
    }
  }
  return { racks, heightM: Math.max(2, Math.min(H - 1.5, 9)) };
}

export interface Partition {
  x: number;
  z: number;
  lengthM: number;
  axis: "x" | "z";
  y0: number;
  heightM: number;
}

/** Rooms share a rear corridor. Every room has a clear doorway; no wall crosses the corridor. */
export function layoutOfficePartitions(config: HallConfig): Partition[] {
  const office = officeLayout(config);
  if (!office) return [];
  const out: Partition[] = [];
  const h = G.office.floorHeightM - 0.4;
  for (let f = 0; f < office.floors; f++) {
    const y0 = f * G.office.floorHeightM + 0.2;
    const edges = officeRoomEdges(config);
    const roomDepth = office.depthM - 3.4 - 0.3;
    for (const x of edges.slice(1, -1)) {
      out.push({ x, z: office.z0 + 3.4 + roomDepth / 2, lengthM: roomDepth, axis: "z", y0, heightM: h });
    }
    for (let r = 0; r < edges.length - 1; r++) {
      const a = edges[r]! + 0.2, b = edges[r + 1]! - 0.2;
      const door0 = b - 1.65, door1 = b - 0.55;
      for (const [start, end] of [[a, door0], [door1, b]] as const) {
        if (end > start) out.push({ x: (start + end) / 2, z: office.z0 + 3.4, lengthM: end - start, axis: "x", y0, heightM: h });
      }
    }
  }
  return out;
}

/**
 * Minimální vybavení administrativy pro pohled v řezu: řada stolů v každé místnosti u fasády. Stoly stojí mezi příčkami
 * (stejné dělení jako `layoutOfficePartitions`), každý pár na jedné straně, ať zůstane průchod. Ilustrace, ne dispozice.
 */
export function layoutOfficeDesks(config: HallConfig): BoxItem[] {
  const office = officeLayout(config);
  if (!office) return [];
  const out: BoxItem[] = [];
  const n = Math.max(0, Math.floor(office.widthM / 8) - 1);
  const edges = [office.x0, ...Array.from({ length: n }, (_, k) => office.x0 + ((k + 1) * office.widthM) / (n + 1)), office.x1];
  const z = office.z1 - G.wallThicknessM - 1.8;
  for (let f = 0; f < office.floors; f++) {
    const y0 = f === 0 ? 0.12 : f * G.office.floorHeightM;
    for (let i = 0; i + 1 < edges.length; i++) {
      const a = edges[i]! + 0.9;
      const b = edges[i + 1]! - 0.9;
      const width = b - a;
      if (width < 2) continue;
      const count = width >= 5.2 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const x = count === 1 ? (a + b) / 2 : a + 0.9 + k * (width - 1.8);
        out.push({ x, y: y0 + 0.37, z, sx: 1.6, sy: 0.74, sz: 0.8 });
      }
    }
  }
  return out;
}

export function boundingRadius(config: Pick<HallConfig, "dimensions">): number {
  const { lengthM: L, widthM: W, clearHeightM: H } = config.dimensions;
  const h = totalHeightM(H);
  return 0.5 * Math.sqrt(L * L + W * W + h * h);
}


/* ------------------------------------------------------------------ střešní technologie */

export type RoofUnitKind = "ahu" | "condenser" | "extractor";

export interface RoofUnit {
  x: number;
  z: number;
  widthM: number;
  depthM: number;
  /** Výška tělesa nad střešní deskou. */
  heightM: number;
  kind: RoofUnitKind;
}

/** Rozměry střešních technologií (m): vzduchotechnická jednotka, kondenzátor/chiller a odtahový ventilátor. Ilustrativní. */
export const ROOF_UNIT_SIZES: Record<RoofUnitKind, { widthM: number; depthM: number; heightM: number }> = {
  ahu: { widthM: 8.0, depthM: 3.0, heightM: 2.4 },
  condenser: { widthM: 5.0, depthM: 2.4, heightM: 1.7 },
  extractor: { widthM: 1.6, depthM: 1.6, heightM: 0.9 },
};

const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Střešní vzduchotechnika: jednotky VZT, kondenzátory a odtahové ventilátory. Počty rostou s plochou, rozmístění je
 * rovnoměrné, vždy mimo světlíky, výřez a atiku. Ilustrace, ne návrh větrání ani chlazení.
 */
export function layoutRoofUnits(config: HallConfig, panels: SkylightPanel[]): RoofUnit[] {
  const dims = config.dimensions;
  const { lengthM: L, widthM: W } = dims;
  const area = footprintAreaM2(dims);
  const margin = 3;
  const want: Array<{ kind: RoofUnitKind; count: number; rows: number[] }> = [
    { kind: "ahu", count: clampN(Math.round(area / 3200), 1, 6), rows: [W / 2 - 9, -W / 2 + 9] },
    { kind: "condenser", count: area >= 3000 ? clampN(Math.round(area / 6000), 1, 3) : 0, rows: [0, W / 4] },
    { kind: "extractor", count: clampN(Math.round(area / 1100), 3, 20), rows: [W / 2 - 4.5, -W / 2 + 4.5] },
  ];
  const out: RoofUnit[] = [];
  const free = (x: number, z: number, size: { widthM: number; depthM: number }, gap: number) => {
    const hw = size.widthM / 2;
    const hd = size.depthM / 2;
    if (x - hw < -L / 2 + margin || x + hw > L / 2 - margin || z - hd < -W / 2 + margin || z + hd > W / 2 - margin) return false;
    if (rectHitsNotch(dims, { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd }, margin)) return false;
    if (panels.some((p) => Math.abs(x - p.x) < (p.widthM + size.widthM) / 2 + 1.5 && Math.abs(z - p.z) < (p.depthM + size.depthM) / 2 + 1.5)) return false;
    return !out.some((u) => Math.abs(x - u.x) < (u.widthM + size.widthM) / 2 + gap && Math.abs(z - u.z) < (u.depthM + size.depthM) / 2 + gap);
  };
  for (const { kind, count, rows } of want) {
    const size = ROOF_UNIT_SIZES[kind];
    for (let i = 0; i < count; i++) {
      const tx = -L / 2 + (L * (i + 0.5)) / count;
      const tz = rows[i % rows.length]!;
      // nejbližší volné místo kolem cílového bodu (kroky po 3 m), pořadí je deterministické
      let placed = false;
      for (let r = 0; r <= 24 && !placed; r += 3) {
        for (let dx = -r; dx <= r && !placed; dx += 3) {
          for (const dz of r === 0 ? [0] : [-r, r, 0]) {
            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
            if (free(tx + dx, tz + dz, size, kind === "extractor" ? 3 : 5)) {
              out.push({ x: tx + dx, z: tz + dz, ...size, kind });
              placed = true;
              break;
            }
          }
        }
      }
    }
  }
  return out;
}

export interface RoofFanPoint {
  x: number;
  z: number;
  /** Výška nad střešní deskou. */
  y: number;
  radiusM: number;
}

/** Ventilátory na střešních jednotkách: VZT jednotka jeden velký, kondenzátor dva, odtah jeden malý. */
export function roofFanPoints(units: RoofUnit[]): RoofFanPoint[] {
  return units.flatMap((u): RoofFanPoint[] => {
    if (u.kind === "ahu") return [{ x: u.x + u.widthM * 0.25, z: u.z, y: u.heightM + 0.12, radiusM: 1.1 }];
    if (u.kind === "condenser") return [-1, 1].map((s) => ({ x: u.x + s * u.widthM * 0.25, z: u.z, y: u.heightM + 0.1, radiusM: 0.95 }));
    return [{ x: u.x, z: u.z, y: u.heightM + 0.05, radiusM: 0.5 }];
  });
}

export interface RoofDuct {
  x: number;
  z: number;
  lengthM: number;
  /** Směr potrubí: podél délky (x) nebo šířky (z) haly. */
  axis: "x" | "z";
  /** Střed potrubí nad střešní deskou. */
  y: number;
}

/** Potrubí od jednotky VZT k nejbližšímu odtahovému ventilátoru v téže řadě (do 40 m); vede na podpěrách nad střechou. */
export function layoutRoofDucts(units: RoofUnit[]): RoofDuct[] {
  const extractors = units.filter((u) => u.kind === "extractor");
  const out: RoofDuct[] = [];
  for (const a of units.filter((u) => u.kind === "ahu")) {
    let best: { e: RoofUnit; gap: number } | null = null;
    for (const e of extractors) {
      if (Math.abs(e.z - a.z) > 6) continue;
      const gap = Math.abs(e.x - a.x) - a.widthM / 2 - e.widthM / 2;
      if (gap < 3 || gap > 40) continue;
      if (!best || gap < best.gap) best = { e, gap };
    }
    if (!best) continue;
    const dir = Math.sign(best.e.x - a.x);
    const x0 = a.x + (dir * a.widthM) / 2;
    const x1 = best.e.x;
    out.push({ x: (x0 + x1) / 2, z: a.z, lengthM: Math.abs(x1 - x0), axis: "x", y: 1.4 });
    const dz = best.e.z - a.z;
    if (Math.abs(dz) > 0.6) out.push({ x: best.e.x, z: a.z + dz / 2, lengthM: Math.abs(dz) - best.e.depthM / 2 + 0.5, axis: "z", y: 1.4 });
  }
  return out;
}

/* ------------------------------------------------------------------ regály do detailu */

export interface BoxItem {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color?: number;
}

export interface RackParts {
  uprights: BoxItem[];
  beams: BoxItem[];
  pallets: BoxItem[];
  goods: BoxItem[];
}

const GOODS = [0xb99a6b, 0xc8ad82, 0xa88a5c, 0xe8e6df, 0x9fb4c8];

function hashN(a: number, b: number): number {
  let h = (Math.round(a * 10) * 374761393 + Math.round(b * 10) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Regály: sloupky, nosníky, palety se zbožím. Při velkém počtu segmentů se detail zjednoduší
 * (jen sloupky, nosníky a jeden blok zboží), aby počet instancí zůstal omezený.
 */
export function layoutRackParts(racks: RackSegment[], heightM: number): RackParts {
  const out: RackParts = { uprights: [], beams: [], pallets: [], goods: [] };
  const full = racks.length <= 120;
  const levels = Math.max(1, Math.min(5, Math.floor((heightM - 0.3) / 1.7)));
  const bays = 4;
  const rowZ = [-0.65, 0.65];
  for (const r of racks) {
    const bay = r.lengthM / bays;
    for (const dz of rowZ) {
      const zc = r.z + dz;
      for (let k = 0; k <= bays; k++) {
        const x = r.x - r.lengthM / 2 + k * bay;
        for (const f of [-0.5, 0.5]) out.uprights.push({ x, y: heightM / 2 + 0.05, z: zc + f, sx: 0.1, sy: heightM, sz: 0.08, color: 0x424850 });
      }
      for (let i = 0; i < levels; i++) {
        const y = 0.35 + i * 1.7;
        for (const f of [-0.5, 0.5]) out.beams.push({ x: r.x, y, z: zc + f, sx: r.lengthM, sy: 0.12, sz: 0.07, color: 0xd9732f });
        if (full) {
          for (let b = 0; b < bays; b++) {
            if (hashN(r.x + b, zc + i) < 0.12) continue; // volná místa
            const x = r.x - r.lengthM / 2 + (b + 0.5) * bay;
            out.pallets.push({ x, y: y + 0.14, z: zc, sx: bay * 0.82, sy: 0.14, sz: 1.0, color: 0x8a6b45 });
            const h = 0.8 + hashN(x, zc + i) * 0.45;
            out.goods.push({ x, y: y + 0.21 + h / 2, z: zc, sx: bay * 0.78, sy: h, sz: 0.92, color: GOODS[Math.floor(hashN(zc, x + i) * GOODS.length)]! });
          }
        }
      }
      if (!full) out.goods.push({ x: r.x, y: (heightM * 0.7) / 2 + 0.3, z: zc, sx: r.lengthM * 0.96, sy: heightM * 0.7, sz: 0.95, color: 0xb99a6b });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ světlo a značení podlahy */

export interface LightShaft {
  x: number;
  z: number;
  widthM: number;
  depthM: number;
  /** Posun spodní hrany vůči horní (sluneční paprsky jdou šikmo). */
  dx: number;
  dz: number;
  topY: number;
  bottomY: number;
  /** true = paprsek dopadne na podlahu, false = končí na stěně, než ji dosáhne. */
  reachesFloor: boolean;
}

/**
 * Denní světlo ze světlíků: šikmý hranol ve směru slunce. Pokud by paprsek vyšel mimo půdorys, zkrátí se,
 * aby nikdy neprosvítal ven ze stěn.
 */
export function layoutLightShafts(config: HallConfig, sun: { x: number; y: number; z: number }): LightShaft[] {
  const C = config.dimensions.clearHeightM;
  const topY = C + 0.2;
  const full = topY - 0.1;
  const kx = -sun.x / sun.y;
  const kz = -sun.z / sun.y;
  const out: LightShaft[] = [];
  for (const p of layoutSkylights(config).slice(0, 160)) {
    let t = 1;
    while (t > 0.25 && !pointInFootprint(config.dimensions, p.x + kx * full * t, p.z + kz * full * t, 1.5)) t -= 0.1;
    if (t <= 0.25) continue;
    out.push({
      x: p.x,
      z: p.z,
      widthM: p.widthM - 0.4,
      depthM: p.depthM - 0.4,
      dx: kx * full * t,
      dz: kz * full * t,
      topY,
      bottomY: topY - full * t,
      reachesFloor: t >= 0.999,
    });
  }
  return out;
}

export interface FloorStrip {
  x: number;
  z: number;
  sx: number;
  sz: number;
}

export const FLOOR_MARK_W = 0.12;

/**
 * Značení podlahy: žlutý obrys každé řady regálů (zóna, do které se nesmí zajíždět) a hranice překladiště
 * u nakládacích doků. Ilustrativní, nejde o bezpečnostní dokumentaci.
 */
export function layoutFloorMarkings(config: HallConfig, racks: RackSegment[]): FloorStrip[] {
  const { lengthM: L, widthM: W } = config.dimensions;
  const out: FloorStrip[] = [];
  const w = FLOOR_MARK_W;
  const rows = new Map<number, RackSegment[]>();
  for (const r of racks) {
    const key = Math.round(r.z * 100);
    rows.set(key, [...(rows.get(key) ?? []), r]);
  }
  const pad = 0.4;
  const halfDepth = OBJECT_SIZES.rack.depthM / 2 + pad;
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    let run: RackSegment[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const first = run[0]!;
      const last = run[run.length - 1]!;
      const x0 = first.x - first.lengthM / 2 - pad;
      const x1 = last.x + last.lengthM / 2 + pad;
      const z = first.z;
      const cx = (x0 + x1) / 2;
      out.push({ x: cx, z: z - halfDepth, sx: x1 - x0, sz: w }, { x: cx, z: z + halfDepth, sx: x1 - x0, sz: w });
      out.push({ x: x0, z, sx: w, sz: halfDepth * 2 }, { x: x1, z, sx: w, sz: halfDepth * 2 });
      run = [];
    };
    for (const r of row) {
      const prev = run[run.length - 1];
      if (prev && r.x - r.lengthM / 2 - (prev.x + prev.lengthM / 2) > OBJECT_SIZES.rack.gapM + 0.01) flush();
      run.push(r);
    }
    flush();
  }
  if (config.openings.dockCount > 0 && W > 30) {
    out.push({ x: 0, z: -W / 2 + 14.5, sx: L - 10, sz: w * 1.6 });
  }
  return out.slice(0, 480);
}

/** Svítidla v hale: mřížka lineárních těles pod střechou (12 × 12 m). Ilustrativní. */
export function layoutCeilingLights(config: HallConfig): BoxItem[] {
  const { lengthM: L, widthM: W, clearHeightM: C } = config.dimensions;
  const out: BoxItem[] = [];
  const nx = Math.max(1, Math.floor(L / 12));
  const nz = Math.max(1, Math.floor(W / 12));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = -L / 2 + ((i + 0.5) * L) / nx;
      const z = -W / 2 + ((j + 0.5) * W) / nz;
      if (pointInFootprint(config.dimensions, x, z, 3)) out.push({ x, y: C - 0.7, z, sx: 4.5, sy: 0.12, sz: 0.3 });
    }
  }
  return out.slice(0, 600);
}


/* ------------------------------------------------------------------ oplocení */

/** Sloupky po 5 m po obvodu `rect`, bez úseku vjezdu (`gate`). Pole spojují sousední sloupky. */
export function layoutFence(rect: Rect, gate: Rect): FenceLayout {
  const posts: PlacedThing[] = [];
  const rails: FenceLayout["rails"] = [];
  const STEP = 5;
  const gateX0 = gate.x0 - 1;
  const gateX1 = gate.x1 + 1;
  const edge = (x0: number, z0: number, x1: number, z1: number, axis: "x" | "z") => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / STEP));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const z = z0 + ((z1 - z0) * i) / n;
      const inGate = axis === "x" && z >= rect.z1 - 0.01 && x > gateX0 && x < gateX1;
      if (!inGate) posts.push({ x, z });
      if (i < n) {
        const mx = x0 + ((x1 - x0) * (i + 0.5)) / n;
        const mz = z0 + ((z1 - z0) * (i + 0.5)) / n;
        const gap = axis === "x" && z >= rect.z1 - 0.01 && mx > gateX0 && mx < gateX1;
        if (!gap) rails.push({ x: mx, z: mz, lengthM: len / n, axis });
      }
    }
  };
  edge(rect.x0, rect.z0, rect.x1, rect.z0, "x");
  edge(rect.x0, rect.z1, rect.x1, rect.z1, "x");
  edge(rect.x0, rect.z0, rect.x0, rect.z1, "z");
  edge(rect.x1, rect.z0, rect.x1, rect.z1, "z");
  return { rect, posts, rails };
}


/* ------------------------------------------------------------------ příčky, nosníky, technologie (M2) */

/** Polohy příček podél délky haly: vždy za administrativou (ta zabírá nejvýše 40 % délky). */
export function partitionXs(lengthM: number, count: 0 | 1 | 2): number[] {
  if (count === 1) return [-lengthM / 2 + 0.58 * lengthM];
  if (count === 2) return [-lengthM / 2 + 0.46 * lengthM, -lengthM / 2 + 0.74 * lengthM];
  return [];
}

export interface WallSegment {
  x: number;
  zMin: number;
  zMax: number;
}

/** Největší z, do kterého sahá obálka v místě x (u půdorysu L zkrácená ve výřezu). */
export function zMaxAt(dims: HallConfig["dimensions"], x: number): number {
  const { nx, nz } = notchOf(dims);
  return nx > 0 && nz > 0 && x > dims.lengthM / 2 - nx ? dims.widthM / 2 - nz : dims.widthM / 2;
}

/** Příčky napříč halou s průchodem 4 m uprostřed. Orientační dispozice, ne projekt požárních úseků. */
export function layoutPartitions(config: HallConfig, count: 0 | 1 | 2): WallSegment[] {
  const out: WallSegment[] = [];
  for (const x of partitionXs(config.dimensions.lengthM, count)) {
    const z0 = -config.dimensions.widthM / 2 + 0.3;
    const z1 = zMaxAt(config.dimensions, x) - 0.3;
    const mid = (z0 + z1) / 2;
    out.push({ x, zMin: z0, zMax: mid - 2 }, { x, zMin: mid + 2, zMax: z1 });
  }
  return out;
}

/** Vazníky nad sloupovými řadami (rozpon napříč halou). Tvar a barva podle zvolené konstrukce. */
export function layoutGirders(config: HallConfig, girder: "precast" | "glulam" | "steel", color: string): BoxItem[] {
  const { clearHeightM: C } = config.dimensions;
  const { w, h } = girder === "precast" ? { w: 0.5, h: 1.2 } : girder === "glulam" ? { w: 0.2, h: 1.4 } : { w: 0.25, h: 2.0 };
  const hex = Number.parseInt(color.slice(1), 16);
  const { xs } = columnFrame(config.dimensions);
  const zmin = -config.dimensions.widthM / 2 + 0.3;
  return xs.flatMap((x) => {
    const zmax = zMaxAt(config.dimensions, x) - 0.3;
    if (zmax - zmin < 4) return [];
    return [{ x, y: C - h / 2, z: (zmin + zmax) / 2, sx: w, sy: h, sz: zmax - zmin, color: hex }];
  });
}

export interface PvCell {
  x: number;
  z: number;
}
export const PV_CELL = { widthM: 4.2, depthM: 2.2, pitchX: 4.6, pitchZ: 3.6, tiltRad: 0.18 } as const;

/**
 * Fotovoltaické panely na volné ploše střechy: řady mimo světlíky, střešní jednotky, atiku a výřez.
 * `share` je podíl VOLNÝCH buněk; vyplňují se souvisle od zadní strany. Ilustrace, ne návrh ani výpočet výroby.
 */
export function layoutPv(config: HallConfig, share: number, panels: SkylightPanel[], units: RoofUnit[]): PvCell[] {
  if (share <= 0) return [];
  const { lengthM: L, widthM: W } = config.dimensions;
  const free: PvCell[] = [];
  const inset = 3.5;
  for (let z = -W / 2 + inset + PV_CELL.depthM / 2; z <= W / 2 - inset - PV_CELL.depthM / 2; z += PV_CELL.pitchZ) {
    for (let x = -L / 2 + inset + PV_CELL.widthM / 2; x <= L / 2 - inset - PV_CELL.widthM / 2; x += PV_CELL.pitchX) {
      const r = { x0: x - PV_CELL.widthM / 2, x1: x + PV_CELL.widthM / 2, z0: z - PV_CELL.depthM / 2, z1: z + PV_CELL.depthM / 2 };
      if (rectHitsNotch(config.dimensions, r, 3)) continue;
      if (panels.some((p) => Math.abs(x - p.x) < (p.widthM + PV_CELL.widthM) / 2 + 1.2 && Math.abs(z - p.z) < (p.depthM + PV_CELL.depthM) / 2 + 1.2)) continue;
      if (units.some((u) => Math.abs(x - u.x) < (u.widthM + PV_CELL.widthM) / 2 + 2 && Math.abs(z - u.z) < (u.depthM + PV_CELL.depthM) / 2 + 2)) continue;
      free.push({ x, z });
    }
  }
  return free.slice(0, Math.min(1500, Math.round(free.length * share)));
}

/** Závěsné vytápění haly pod střechou: jednotky nebo sálavé panely po 24 m. Ilustrativní, bez výpočtu. */
export function layoutHallHeating(config: HallConfig, kind: "std" | "warm_air" | "radiant"): BoxItem[] {
  if (kind === "std") return [];
  const { lengthM: L, widthM: W, clearHeightM: C } = config.dimensions;
  const out: BoxItem[] = [];
  const nx = Math.max(1, Math.floor(L / 24));
  const nz = Math.max(1, Math.floor(W / 24));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = -L / 2 + ((i + 0.5) * L) / nx;
      const z = -W / 2 + ((j + 0.5) * W) / nz;
      if (!pointInFootprint(config.dimensions, x, z, 4)) continue;
      if (kind === "warm_air") out.push({ x, y: C - 1.6, z: z + 3, sx: 1.4, sy: 0.9, sz: 1.4, color: 0xd9dde2 });
      else out.push({ x, y: C - 2.2, z: z + 3, sx: 10, sy: 0.12, sz: 1.1, color: 0xcfd4da });
    }
  }
  return out.slice(0, 400);
}

/** Venkovní jednotka tepelného čerpadla u administrativy (u přední fasády). */
export function layoutOfficeHeatPump(config: HallConfig): PlacedThing[] {
  const o = officeLayout(config);
  if (!o) return [];
  return [
    { x: o.x0 + 4, z: config.dimensions.widthM / 2 + 1.4 },
    { x: o.x0 + 6, z: config.dimensions.widthM / 2 + 1.4 },
  ];
}

/* ------------------------------------------------------------------ zábradlí u doků */

/** Zábradlí chrání okraj nakládací zóny: odstup od fasády, délka jednoho úseku a rezerva od vrat a rohu. */
export const DOCK_RAILING = { offsetM: 1.8, runM: 6, gapFromDockM: 1.2, cornerM: 0.6, minRunM: 2 } as const;

export interface RailingRun {
  /** Úsek podél zadní fasády (lokální souřadnice u, viz facadeMatrix). */
  u0: number;
  u1: number;
}

/**
 * Úseky zábradlí po obou stranách řady nakládacích doků (podle fotografií z katalogu: zábradlí podél nakládací zóny
 * za posledním dokem, s návratem k fasádě). Zábradlí nestojí před vraty, aby nepřekáželo kamionům.
 */
export function layoutDockRailings(config: HallConfig): RailingRun[] {
  const docks = placeOpenings(config).filter((o) => o.kind === "dock");
  if (docks.length === 0) return [];
  const len = facadeLengthM(config.dimensions, "rear");
  const lo = Math.min(...docks.map((o) => o.centerU - o.widthM / 2));
  const hi = Math.max(...docks.map((o) => o.centerU + o.widthM / 2));
  const { runM, gapFromDockM, cornerM, minRunM } = DOCK_RAILING;
  const runs: RailingRun[] = [];
  const left: RailingRun = { u0: Math.max(cornerM, lo - gapFromDockM - runM), u1: lo - gapFromDockM };
  const right: RailingRun = { u0: hi + gapFromDockM, u1: Math.min(len - cornerM, hi + gapFromDockM + runM) };
  for (const r of [left, right]) if (r.u1 - r.u0 >= minRunM) runs.push(r);
  return runs;
}
