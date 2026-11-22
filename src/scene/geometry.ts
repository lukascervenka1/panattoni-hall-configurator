/**
 * Tvorba parametrické geometrie. Bez Reactu; používá jen Three.js, takže ji lze testovat v Node.
 *
 * Zásada (spec kap. 6): rozměry mění skutečnou geometrii, ne měřítko modelu. Fasády se vytvářejí z tvaru
 * se skutečnými otvory (Shape + díry), takže se okna a vrata při změně délky nikdy neroztahují.
 * Veškerá geometrie je sloučená podle materiálu, aby měl model jen několik draw callů.
 * Detaily (sokl, pás, svody, sekce vrat, nárazníky, kopule) se generují z týchž rozměrů, ne z assetů.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DEMO_GEOMETRY as G } from "@/configurator/calculations/constants";
import {
  facadeLengthM,
  facadesOf,
  footprintPolygon,
  notchOf,
  officeLayout,
  placeOpenings,
  totalHeightM,
  type Dimensions,
  type FacadeId,
  type PlacedOpening,
  type Vec2,
} from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";
import { DOCK_RAILING, layoutDockRailings, layoutOfficePartitions, layoutRoofDucts, layoutRoofUnits, layoutSkylights, roofFanPoints, type Partition, type SkylightPanel } from "./layout";

const T = G.wallThicknessM;
/** Spodek stěny zapuštěný pod terén, aby otvory u země (vjezdová vrata) neležely na hraně obrysu. */
const WALL_BELOW_GROUND = 0.3;

export interface ShellGeometry {
  walls: THREE.BufferGeometry;
  dockDoors: THREE.BufferGeometry | null;
  driveInDoors: THREE.BufferGeometry | null;
  doorGlass: THREE.BufferGeometry | null;
  shelters: THREE.BufferGeometry | null;
  bumpers: THREE.BufferGeometry | null;
  lamps: THREE.BufferGeometry | null;
  bollards: THREE.BufferGeometry | null;
  glass: THREE.BufferGeometry | null;
  frames: THREE.BufferGeometry | null;
  plinth: THREE.BufferGeometry | null;
  band: THREE.BufferGeometry | null;
  pipes: THREE.BufferGeometry | null;
  /** Čísla vrat na modrých tabulkách (UV do atlasu čísel, viz textures.ts). */
  plates: THREE.BufferGeometry | null;
}

/** Matice umísťující lokální souřadnice fasády (u zleva doprava zvenčí, y nahoru, z ven) do světa. */
export function facadeMatrix(dims: Dimensions, facade: FacadeId): THREE.Matrix4 {
  const { lengthM: L, widthM: W } = dims;
  const { nx, nz } = notchOf(dims);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  switch (facade) {
    case "front":
      return m.compose(new THREE.Vector3(-L / 2, 0, W / 2 - T), q.setFromAxisAngle(up, 0), one);
    case "rear":
      return m.compose(new THREE.Vector3(L / 2, 0, -W / 2 + T), q.setFromAxisAngle(up, Math.PI), one);
    case "left":
      return m.compose(new THREE.Vector3(-L / 2 + T, 0, -W / 2), q.setFromAxisAngle(up, -Math.PI / 2), one);
    case "right":
      return m.compose(new THREE.Vector3(L / 2 - T, 0, W / 2 - nz), q.setFromAxisAngle(up, Math.PI / 2), one);
    case "notchA":
      // vnitřní stěna výřezu směřující +z, od x = L/2 − nx do L/2
      return m.compose(new THREE.Vector3(L / 2 - nx, 0, W / 2 - nz - T), q.setFromAxisAngle(up, 0), one);
    case "notchB":
      // vnitřní stěna výřezu směřující +x, od z = W/2 dolů k W/2 − nz
      return m.compose(new THREE.Vector3(L / 2 - nx - T, 0, W / 2), q.setFromAxisAngle(up, Math.PI / 2), one);
  }
}

/* ------------------------------------------------------------------ půdorys jako polygon */

/** Tvar půdorysu pro Three.js: (x, z) → (x, −z), aby po otočení kolem osy x ležel v rovině x–z. */
export function polyShape(pts: Vec2[]): THREE.Shape {
  const shape = new THREE.Shape();
  pts.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  return shape;
}

/** Svislý hranol nad polygonem od výšky `y0` do `y0 + depth`. */
export function extrudePolygon(pts: Vec2[], y0: number, depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(polyShape(pts), { depth, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

/** Vodorovná plocha polygonu ve výšce `y` s UV ve světových metrech (dlaždice `tile` m). */
export function flatPolygon(pts: Vec2[], y: number, tile: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(polyShape(pts));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
  return g;
}

function box(w: number, h: number, d: number, cx: number, cy: number, cz: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(cx, cy, cz);
  return g;
}

function cyl(r: number, h: number, cx: number, cy: number, cz: number, seg = 8): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.translate(cx, cy, cz);
  return g;
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (list.length === 0) return null;
  // Všechny vstupy musí mít shodné atributy (position, normal, uv) a být neindexované.
  const normalized = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(normalized, false);
  list.forEach((g) => g.dispose());
  normalized.forEach((g) => g.dispose());
  return merged;
}


type Bucket = THREE.BufferGeometry[];
interface Buckets {
  dockDoors: Bucket;
  driveInDoors: Bucket;
  doorGlass: Bucket;
  shelters: Bucket;
  bumpers: Bucket;
  lamps: Bucket;
  bollards: Bucket;
  glass: Bucket;
  frames: Bucket;
  plinth: Bucket;
  band: Bucket;
  pipes: Bucket;
  plates: Bucket;
}

export function buildShell(config: HallConfig, opts: { dockHouse?: boolean; omitOpeningDetails?: boolean } = {}): ShellGeometry {
  const dims = config.dimensions;
  const C = dims.clearHeightM;
  const H = totalHeightM(C);
  const placed = placeOpenings(config);

  const walls: THREE.BufferGeometry[] = [];
  const b: Buckets = {
    dockDoors: [],
    driveInDoors: [],
    doorGlass: [],
    shelters: [],
    bumpers: [],
    lamps: [],
    bollards: [],
    glass: [],
    frames: [],
    plinth: [],
    band: [],
    pipes: [],
    plates: [],
  };

  for (const facade of facadesOf(dims)) {
    const len = facadeLengthM(dims, facade);
    const mat = facadeMatrix(dims, facade);
    const list = placed.filter((o) => o.facade === facade);
    const to = (g: THREE.BufferGeometry, bucket: Bucket) => {
      g.applyMatrix4(mat);
      bucket.push(g);
    };

    const shape = new THREE.Shape();
    shape.moveTo(0, -WALL_BELOW_GROUND);
    shape.lineTo(len, -WALL_BELOW_GROUND);
    shape.lineTo(len, H);
    shape.lineTo(0, H);
    shape.closePath();
    for (const o of list) {
      const x0 = o.centerU - o.widthM / 2;
      const x1 = o.centerU + o.widthM / 2;
      const hole = new THREE.Path();
      hole.moveTo(x0, o.sillM);
      hole.lineTo(x0, o.sillM + o.heightM);
      hole.lineTo(x1, o.sillM + o.heightM);
      hole.lineTo(x1, o.sillM);
      hole.closePath();
      shape.holes.push(hole);
    }
    const wall = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 1 });
    wall.applyMatrix4(mat);
    walls.push(wall);

    // Sokl: tmavý pás u terénu, přerušený jen otvory sahajícími k zemi (vjezdová vrata).
    const ground = list.filter((o) => o.sillM < 0.6).sort((p, q) => p.centerU - q.centerU);
    let cursor = 0;
    for (const o of [...ground, null]) {
      const end = o ? o.centerU - o.widthM / 2 : len;
      if (end - cursor > 0.3) to(box(end - cursor, 0.6, 0.06, (cursor + end) / 2, 0.3, T + 0.03), b.plinth);
      if (o) cursor = o.centerU + o.widthM / 2;
    }

    // Pás v barvě značky pod atikou (nad všemi otvory).
    to(box(len, 0.3, 0.07, len / 2, C + 0.5, T + 0.035), b.band);

    // Okapové svody po 24 m na dlouhých fasádách, jen mimo otvory.
    if (facade === "front" || facade === "rear") {
      for (let u = 12; u < len - 6; u += 24) {
        const hits = list.some((o) => Math.abs(o.centerU - u) < o.widthM / 2 + 0.6);
        if (hits) continue;
        to(cyl(0.075, C + 0.7, u, (C + 0.7) / 2 + 0.2, T + 0.11), b.pipes);
      }
    }

    if (facade === "rear") for (const run of layoutDockRailings(config)) addRailing(run, T, to, b);

    for (const o of list) if (!opts.omitOpeningDetails || o.kind === "window" || o.kind === "hallWindow" || o.kind === "entrance") addOpening(o, T, to, b, Boolean(opts.dockHouse));
  }

  return {
    walls: merge(walls)!,
    dockDoors: merge(b.dockDoors),
    driveInDoors: merge(b.driveInDoors),
    doorGlass: merge(b.doorGlass),
    shelters: merge(b.shelters),
    bumpers: merge(b.bumpers),
    lamps: merge(b.lamps),
    bollards: merge(b.bollards),
    glass: merge(b.glass),
    frames: merge(b.frames),
    plinth: merge(b.plinth),
    band: merge(b.band),
    pipes: merge(b.pipes),
    plates: merge(b.plates),
  };
}

/**
 * Ocelové zábradlí: sloupky po 2 m, horní a střední madlo a návrat k fasádě na obou koncích (fotografie z katalogu).
 * Stojí na vnější straně fasády ve vzdálenosti `DOCK_RAILING.offsetM`.
 */
function addRailing(run: { u0: number; u1: number }, wall: number, to: (g: THREE.BufferGeometry, bucket: Bucket) => void, b: Buckets) {
  const zf = wall + DOCK_RAILING.offsetM;
  const len = run.u1 - run.u0;
  const mid = (run.u0 + run.u1) / 2;
  const rail = 0.06;
  for (const y of [1.1, 0.55]) {
    to(box(len, rail, rail, mid, y, zf), b.pipes);
    for (const u of [run.u0, run.u1]) to(box(rail, rail, DOCK_RAILING.offsetM, u, y, wall + DOCK_RAILING.offsetM / 2), b.pipes);
  }
  const posts = Math.max(1, Math.round(len / 2));
  for (let i = 0; i <= posts; i++) to(cyl(0.045, 1.1, run.u0 + (len * i) / posts, 0.55, zf, 8), b.pipes);
  for (const u of [run.u0, run.u1]) to(cyl(0.045, 1.1, u, 0.55, wall + 0.05, 8), b.pipes);
}

/** Individual assemblies share the same geometry generator as the facade. */
export function buildOpeningDetails(dims: Dimensions, opening: PlacedOpening, dockHouse: boolean): Record<string, THREE.BufferGeometry | null> {
  const b: Buckets = { dockDoors: [], driveInDoors: [], doorGlass: [], shelters: [], bumpers: [], lamps: [], bollards: [], glass: [], frames: [], plinth: [], band: [], pipes: [], plates: [] };
  const matrix = facadeMatrix(dims, opening.facade);
  addOpening(opening, T, (g, bucket) => { g.applyMatrix4(matrix); bucket.push(g); }, b, dockHouse);
  return Object.fromEntries(Object.entries(b).map(([key, bucket]) => [key, merge(bucket)]));
}

/** Sekční vrata: vodorovné sekce s mezerami a pruh okének v druhé sekci shora. */
function sectionalDoor(o: PlacedOpening, sections: number, to: (g: THREE.BufferGeometry, bucket: Bucket) => void, b: Buckets, bucket: Bucket) {
  const w = o.widthM - 0.06;
  const total = o.heightM - 0.04;
  const gap = 0.025;
  const sh = (total - gap * (sections - 1)) / sections;
  for (let i = 0; i < sections; i++) {
    const y = o.sillM + 0.02 + i * (sh + gap) + sh / 2;
    to(box(w, sh, 0.08, o.centerU, y, T * 0.45), bucket);
    if (i === sections - 2) {
      // pás okének v úrovni očí / horní třetiny
      to(box(w - 0.5, Math.min(0.3, sh * 0.55), 0.02, o.centerU, y, T * 0.45 + 0.05), b.doorGlass);
    }
  }
}

/** Buňka v atlasu čísel (textures.ts): doky 1 až 40 v buňkách 0 až 39, vjezdová vrata S1 až S8 v buňkách 40 až 47. */
export const PLATE_ATLAS = { cols: 8, rows: 8, dockCells: 40, driveInCells: 8 } as const;
export function plateCell(o: { id: string; kind: string }): number {
  const n = Math.max(1, Number(o.id.split("-").at(-1)) || 1);
  return o.kind === "driveIn" ? PLATE_ATLAS.dockCells + ((n - 1) % PLATE_ATLAS.driveInCells) : (n - 1) % PLATE_ATLAS.dockCells;
}

/** Čtvercová tabulka s číslem vrat; UV míří na jednu buňku atlasu. */
function numberPlate(cx: number, cy: number, cz: number, cell: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.62, 0.62);
  const { cols, rows } = PLATE_ATLAS;
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  const pad = 0.004;
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (col + pad + uv.getX(i) * (1 - 2 * pad)) / cols, 1 - (row + 1) / rows + (pad + uv.getY(i) * (1 - 2 * pad)) / rows);
  }
  g.translate(cx, cy, cz);
  return g;
}

function addOpening(o: PlacedOpening, wall: number, to: (g: THREE.BufferGeometry, bucket: Bucket) => void, b: Buckets, dockHouse = false) {
  const cy = o.sillM + o.heightM / 2;
  if (o.kind === "window" || o.kind === "hallWindow") {
    // Okno podle fotografií z katalogu: tmavě modrý rám v hluboké špaletě, dvě svislé tabule (pevná a otevíravá), parapet.
    const w = o.widthM;
    const h = o.heightM;
    const f = 0.09;
    const d = 0.16;
    const z = wall * 0.4;
    const left = o.centerU - w / 2;
    to(box(w, h, 0.04, o.centerU, cy, z), b.glass);
    to(box(w + 0.02, f, d, o.centerU, o.sillM + f / 2, z), b.frames);
    to(box(w + 0.02, f, d, o.centerU, o.sillM + h - f / 2, z), b.frames);
    to(box(f, h, d, left + f / 2, cy, z), b.frames);
    to(box(f, h, d, left + w - f / 2, cy, z), b.frames);
    const split = left + w * 0.62;
    to(box(f * 0.9, h, d, split, cy, z), b.frames);
    // křídlo vpravo: vnitřní rámeček a ventilační proužek nahoře
    const sashW = left + w - f - (split + (f * 0.9) / 2);
    const sashX = split + (f * 0.9) / 2 + sashW / 2;
    to(box(sashW, 0.05, d * 0.7, sashX, o.sillM + f + 0.03, z + 0.02), b.frames);
    to(box(sashW, 0.05, d * 0.7, sashX, o.sillM + h - f - 0.03, z + 0.02), b.frames);
    to(box(0.05, h - 2 * f, d * 0.7, sashX + sashW / 2 - 0.03, cy, z + 0.02), b.frames);
    // vnější parapet
    to(box(w + 0.3, 0.06, 0.2, o.centerU, o.sillM - 0.03, wall + 0.08), b.frames);
    return;
  }
  if (o.kind === "entrance") {
    // Prosklené dvoukřídlé dveře s nadsvětlíkem, tmavě modrá stříška a zábradlí po stranách (fotografie z katalogu).
    const w = o.widthM;
    const h = o.heightM;
    const f = 0.09;
    const d = 0.16;
    const z = wall * 0.4;
    const u = o.centerU;
    const transomY = 2.05;
    to(box(w - 0.04, h - 0.04, 0.04, u, h / 2, z), b.glass);
    to(box(w, f, d, u, h - f / 2, z), b.frames);
    to(box(w, f * 0.8, d, u, transomY, z), b.frames);
    to(box(w, 0.04, d, u, 0.02, z), b.frames);
    for (const side of [-1, 1]) to(box(f, h, d, u + side * (w / 2 - f / 2), h / 2, z), b.frames);
    to(box(f, transomY, d, u, transomY / 2, z), b.frames);
    // svislá madla na obou křídlech
    for (const side of [-1, 1]) to(box(0.035, 1.1, 0.04, u + side * 0.2, 1.05, wall + 0.07), b.pipes);
    // stříška: tmavě modrá deska vysunutá před fasádu, na dvou štíhlých stojkách
    const cw = w + 2.0;
    const cd = 1.9;
    to(box(cw, 0.16, cd, u, h + 0.5, wall + cd / 2), b.band);
    for (const side of [-1, 1]) to(cyl(0.05, h + 0.45, u + side * (cw / 2 - 0.14), (h + 0.45) / 2, wall + cd - 0.14, 8), b.pipes);
    // zábradlí po stranách nástupu
    for (const side of [-1, 1]) {
      const x = u + side * (w / 2 + 0.85);
      to(box(0.05, 0.05, 1.6, x, 1.0, wall + 0.9), b.pipes);
      to(box(0.05, 0.05, 1.6, x, 0.55, wall + 0.9), b.pipes);
      for (const zz of [0.12, 1.6]) to(cyl(0.03, 1.0, x, 0.5, wall + zz, 6), b.pipes);
    }
    return;
  }
  if (o.kind === "dock") {
    sectionalDoor(o, 4, to, b, b.dockDoors);
    const s = 0.3;
    // Externí nakládací dům (Van Wijk): zárubeň se protáhne do hloubky 3,4 m před fasádu.
    const depth = dockHouse ? 3.4 : 0.5;
    to(box(s, o.heightM + s, depth, o.centerU - o.widthM / 2 - s / 2, cy + s / 2, wall + depth / 2), b.shelters);
    to(box(s, o.heightM + s, depth, o.centerU + o.widthM / 2 + s / 2, cy + s / 2, wall + depth / 2), b.shelters);
    to(box(o.widthM + 2 * s, s, depth, o.centerU, o.sillM + o.heightM + s / 2, wall + depth / 2), b.shelters);
    // nárazníky po stranách prahu a svítidlo nad vraty
    for (const side of [-1, 1]) to(box(0.28, 0.45, 0.16, o.centerU + side * (o.widthM / 2 + 0.05), o.sillM - 0.1, wall + 0.08), b.bumpers);
    to(box(0.55, 0.16, 0.32, o.centerU, o.sillM + o.heightM + s + 0.3, wall + (dockHouse ? depth + 0.1 : 0.16)), b.lamps);
    if (dockHouse) to(box(o.widthM + 2 * s + 0.2, 0.18, depth + 0.2, o.centerU, o.sillM + o.heightM + s + 0.09, wall + depth / 2), b.shelters);
    to(numberPlate(o.centerU, o.sillM + o.heightM + s + 0.85, wall + 0.02, plateCell(o)), b.plates);
    return;
  }
  // vjezdová vrata
  sectionalDoor(o, 5, to, b, b.driveInDoors);
  const f = 0.09;
  to(box(f, o.heightM + f, 0.14, o.centerU - o.widthM / 2 + f / 2, cy + f / 2, wall * 0.5), b.frames);
  to(box(f, o.heightM + f, 0.14, o.centerU + o.widthM / 2 - f / 2, cy + f / 2, wall * 0.5), b.frames);
  to(box(o.widthM, f, 0.14, o.centerU, o.sillM + o.heightM - f / 2, wall * 0.5), b.frames);
  to(numberPlate(o.centerU, o.sillM + o.heightM + 0.75, wall + 0.02, plateCell(o)), b.plates);
  // ochranné sloupky
  for (const side of [-1, 1]) to(cyl(0.12, 1.1, o.centerU + side * (o.widthM / 2 + 0.7), 0.55, wall + 0.9, 10), b.bollards);
}

export interface RoofGeometry {
  slab: THREE.BufferGeometry;
  coping: THREE.BufferGeometry;
  /** Plocha střešní fólie s UV v metrech (švy po 1,5 m). */
  surface: THREE.BufferGeometry;
}

/**
 * Střešní deska 1 m silná nad světlou výškou; zbylá 1 m do celkové výšky tvoří atika (součást stěn).
 * Navíc obrubník atiky (coping) v barvě značky a plocha fólie.
 */
export function buildRoof(dims: HallConfig["dimensions"], membraneTile = 1.5, apertures: SkylightPanel[] = []): RoofGeometry {
  const { clearHeightM: C } = dims;
  const H = totalHeightM(C);
  const inner = footprintPolygon(dims, T);
  const shape = polyShape(inner);
  for (const p of apertures) {
    const hole = polyShape([[p.x - p.widthM / 2, p.z - p.depthM / 2], [p.x + p.widthM / 2, p.z - p.depthM / 2], [p.x + p.widthM / 2, p.z + p.depthM / 2], [p.x - p.widthM / 2, p.z + p.depthM / 2]]);
    shape.holes.push(hole);
  }
  const slab = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  slab.rotateX(-Math.PI / 2); slab.translate(0, C, 0);

  // Obrubník atiky podél každé hrany obrysu (obdélník i L); vnitřní směr z orientace polygonu.
  const outer = footprintPolygon(dims, 0);
  let area2 = 0;
  outer.forEach(([x, z], i) => {
    const [x2, z2] = outer[(i + 1) % outer.length]!;
    area2 += x * z2 - x2 * z;
  });
  const sign = area2 > 0 ? 1 : -1;
  const c = 0.14;
  const o = T + 0.04;
  const parts: THREE.BufferGeometry[] = [];
  outer.forEach(([x, z], i) => {
    const [x2, z2] = outer[(i + 1) % outer.length]!;
    const dx = x2 - x;
    const dz = z2 - z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    const nxn = (-dz / len) * sign;
    const nzn = (dx / len) * sign;
    const cx = (x + x2) / 2 + nxn * (T / 2);
    const cz = (z + z2) / 2 + nzn * (T / 2);
    const horizontal = Math.abs(dz) < 1e-6;
    parts.push(horizontal ? box(len + 0.08, c, o, cx, H + c / 2 - 0.02, cz) : box(o, c, len + 0.08, cx, H + c / 2 - 0.02, cz));
  });
  const coping = merge(parts)!;

  const surface = new THREE.ShapeGeometry(shape);
  surface.rotateX(-Math.PI / 2); surface.translate(0, C + 1.012, 0);
  const pos = surface.getAttribute("position"); const uv = surface.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / membraneTile, pos.getZ(i) / membraneTile);
  return { slab, coping, surface };
}

export interface RoofDetails {
  curbs: THREE.BufferGeometry | null;
  domes: THREE.BufferGeometry | null;
  units: THREE.BufferGeometry | null;
  /** Žaluzie a mřížky vzduchotechniky (tmavé). */
  louvres: THREE.BufferGeometry | null;
  /** Potrubí mezi jednotkami na podpěrách. */
  ducts: THREE.BufferGeometry | null;
  fans: THREE.BufferGeometry | null;
}

/** Světlíky jako kopule na zárubních a rooftop jednotky s ventilátory. Rozmístění odpovídá účtované ploše. */
export function buildRoofDetails(config: HallConfig): RoofDetails {
  const C = config.dimensions.clearHeightM;
  const top = C + 1.0;
  const panels = layoutSkylights(config);
  const curbs = merge(panels.flatMap((p) => [box(0.2, 0.3, p.depthM + 0.4, p.x - p.widthM / 2 - 0.1, top + 0.15, p.z), box(0.2, 0.3, p.depthM + 0.4, p.x + p.widthM / 2 + 0.1, top + 0.15, p.z), box(p.widthM, 0.3, 0.2, p.x, top + 0.15, p.z - p.depthM / 2 - 0.1), box(p.widthM, 0.3, 0.2, p.x, top + 0.15, p.z + p.depthM / 2 + 0.1)]));
  const domes = merge(
    panels.map((p) => {
      const g = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(p.widthM / 2, 0.55, p.depthM / 2);
      g.translate(p.x, top + 0.3, p.z);
      return merge([g, box(p.widthM, 0.015, p.depthM, p.x, top + 0.305, p.z)])!;
    }),
  );
  const rooftop = layoutRoofUnits(config, panels);
  const body: THREE.BufferGeometry[] = [];
  const louvres: THREE.BufferGeometry[] = [];
  for (const u of rooftop) {
    if (u.kind === "extractor") {
      // odtahový ventilátor: nízký soklík a kruhová hlava
      body.push(box(u.widthM, 0.45, u.depthM, u.x, top + 0.225, u.z), cyl(0.65, 0.4, u.x, top + 0.65, u.z, 14));
      continue;
    }
    body.push(box(u.widthM, u.heightM, u.depthM, u.x, top + u.heightM / 2, u.z));
    body.push(box(u.widthM + 0.16, 0.1, u.depthM + 0.16, u.x, top + u.heightM + 0.05, u.z));
    // žaluzie nasávání na obou dlouhých stranách, u kondenzátoru mřížky výměníku
    const lw = u.kind === "ahu" ? u.widthM * 0.55 : u.widthM * 0.8;
    const lh = u.kind === "ahu" ? u.heightM * 0.55 : u.heightM * 0.7;
    for (const side of [-1, 1]) {
      louvres.push(box(lw, lh, 0.08, u.x - (u.kind === "ahu" ? u.widthM * 0.12 : 0), top + u.heightM * 0.5, u.z + side * (u.depthM / 2 + 0.03)));
    }
    if (u.kind === "ahu") louvres.push(box(0.08, u.heightM * 0.5, u.depthM * 0.6, u.x - u.widthM / 2 - 0.03, top + u.heightM * 0.5, u.z));
  }
  const units = merge(body);
  const ducts = merge(
    layoutRoofDucts(rooftop).flatMap((d) => {
      const alongX = d.axis === "x";
      const out = [alongX ? box(d.lengthM, 0.8, 1.0, d.x, top + d.y, d.z) : box(1.0, 0.8, d.lengthM, d.x, top + d.y, d.z)];
      // podpěry po 6 m
      for (let t = -d.lengthM / 2 + 1; t < d.lengthM / 2; t += 6) out.push(box(0.2, d.y - 0.4, 0.2, d.x + (alongX ? t : 0), top + (d.y - 0.4) / 2, d.z + (alongX ? 0 : t)));
      return out;
    }),
  );
  const fans = merge(roofFanPoints(rooftop).map((f) => cyl(f.radiusM, 0.16, f.x, top + f.y - 0.04, f.z, 20)));
  return { curbs, domes, units, louvres: merge(louvres), ducts, fans };
}

export interface OfficeGeometry {
  slabs: THREE.BufferGeometry;
  ceiling: THREE.BufferGeometry;
  walls: THREE.BufferGeometry | null;
  partitions: THREE.BufferGeometry | null;
}

export function buildOffice(config: HallConfig): OfficeGeometry | null {
  const o = officeLayout(config);
  if (!o) return null;
  // Desky a stěny stojí za vnitřním lícem obvodových stěn haly. Dřív končily přesně v rovině vnějšího líce, takže se
  // jejich hrany překrývaly s fasádou (z-fighting): nad okny problikával světlý pruh v úrovni každého stropu.
  const gap = T + 0.02;
  const x0 = o.x0 + gap;
  const z1 = o.z1 - gap;
  const width = o.x1 - x0;
  const depth = z1 - o.z0;
  const cx = (x0 + o.x1) / 2;
  const cz = (o.z0 + z1) / 2;
  const slabsList: THREE.BufferGeometry[] = [];
  for (let f = 1; f < o.floors; f++) {
    slabsList.push(box(width, 0.3, depth, cx, f * G.office.floorHeightM - 0.15, cz));
  }
  // Podlaha přízemí administrativy.
  slabsList.push(box(width, 0.12, depth, cx, 0.06, cz));
  const wallH = o.floors * G.office.floorHeightM;
  const walls = merge([
    box(0.12, wallH, depth, o.x1, wallH / 2, cz),
    box(width, wallH, 0.12, cx, wallH / 2, o.z0),
  ]);
  const partitions = merge(layoutOfficePartitions(config).map(partitionBox));
  const ceiling = box(width, 0.3, depth, cx, o.floors * G.office.floorHeightM - 0.15, cz);
  return { slabs: merge(slabsList)!, ceiling, walls, partitions };
}

function partitionBox(p: Partition): THREE.BufferGeometry {
  const t = 0.12;
  return p.axis === "z"
    ? box(t, p.heightM, p.lengthM, p.x, p.y0 + p.heightM / 2, p.z)
    : box(p.lengthM, p.heightM, t, p.x, p.y0 + p.heightM / 2, p.z);
}

/** Obrysy pro zvýraznění právě upravované části (kontury EdgesGeometry, žádný další materiálový průchod). */
export function buildOpeningOutlines(config: HallConfig, kind: PlacedOpening["kind"]): THREE.BufferGeometry | null {
  const dims = config.dimensions;
  const list = placeOpenings(config).filter((o) => o.kind === kind);
  const parts = list.map((o) => {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(o.widthM + 0.5, o.heightM + 0.5, 0.9));
    g.translate(o.centerU, o.sillM + o.heightM / 2, T / 2 + 0.2);
    g.applyMatrix4(facadeMatrix(dims, o.facade));
    return g;
  });
  return mergeLineSegments(parts);
}

export function buildOfficeOutline(config: HallConfig): THREE.BufferGeometry | null {
  const o = officeLayout(config);
  if (!o) return null;
  const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(o.widthM, o.heightM, o.depthM));
  g.translate((o.x0 + o.x1) / 2, o.heightM / 2, (o.z0 + o.z1) / 2);
  return g;
}

function mergeLineSegments(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  const positions: number[] = [];
  for (const p of parts) {
    const arr = p.getAttribute("position").array;
    for (let i = 0; i < arr.length; i++) positions.push(arr[i]!);
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return g;
}


/** Koruna stromu ze tří spojených koulí (jednotkový strom, měřítko se nastavuje instancí). */
export function buildCrownGeometry(): THREE.BufferGeometry {
  const parts = [
    { r: 2.5, p: [0, 4.3, 0] },
    { r: 1.9, p: [1.4, 3.6, 0.7] },
    { r: 1.8, p: [-1.2, 3.5, -0.9] },
  ].map(({ r, p }) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.translate(p[0]!, p[1]!, p[2]!);
    return g.toNonIndexed();
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}


export interface FloorGeometry {
  /** Tlustá deska podlahy (hranol nad polygonem). */
  slab: THREE.BufferGeometry;
  /** Povrch podlahy s UV ve světových metrech (pole 6 × 6 m). */
  surface: THREE.BufferGeometry;
}

export function buildFloor(dims: Dimensions, tile: number): FloorGeometry {
  const inner = footprintPolygon(dims, T);
  return { slab: extrudePolygon(inner, -0.25, 0.3), surface: flatPolygon(inner, 0.07, tile) };
}


/** Značení podlahy: tenké pásky těsně nad povrchem podlahy (sloučené do jedné sítě). */
export function buildFloorMarkings(strips: Array<{ x: number; z: number; sx: number; sz: number }>): THREE.BufferGeometry | null {
  return merge(strips.map((s) => box(s.sx, 0.012, s.sz, s.x, 0.076, s.z)));
}

function rgbaGeometry(positions: number[], colors: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4)); // RGBA: průhlednost se mění po výšce
  return g;
}

/** Sluneční paprsky ze světlíků: šikmé hranoly se sbíhající průhledností (nahoře nejjasnější). */
export function buildLightShafts(shafts: Array<{ x: number; z: number; widthM: number; depthM: number; dx: number; dz: number; topY: number; bottomY: number; reachesFloor: boolean }>): THREE.BufferGeometry | null {
  if (shafts.length === 0) return null;
  const pos: number[] = [];
  const col: number[] = [];
  for (const s of shafts) {
    const hx = s.widthM / 2;
    const hz = s.depthM / 2;
    const top = [
      [s.x - hx, s.topY, s.z - hz],
      [s.x + hx, s.topY, s.z - hz],
      [s.x + hx, s.topY, s.z + hz],
      [s.x - hx, s.topY, s.z + hz],
    ] as const;
    const bottom = top.map(([x, , z]) => [x + s.dx, s.bottomY, z + s.dz] as const);
    const aTop = 0.2;
    const aBottom = s.reachesFloor ? 0.07 : 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const quad: Array<[readonly number[], number]> = [
        [top[i]!, aTop],
        [bottom[i]!, aBottom],
        [bottom[j]!, aBottom],
        [top[i]!, aTop],
        [bottom[j]!, aBottom],
        [top[j]!, aTop],
      ];
      for (const [p, a] of quad) {
        pos.push(p[0]!, p[1]!, p[2]!);
        col.push(1, 0.93, 0.78, a);
      }
    }
  }
  return rgbaGeometry(pos, col);
}

/** Světelné skvrny na podlaze pod svítidly: měkké disky s průhledností klesající od středu. */
export function buildLightPools(lights: Array<{ x: number; z: number }>, radiusM: number): THREE.BufferGeometry | null {
  if (lights.length === 0) return null;
  const seg = 14;
  const pos: number[] = [];
  const col: number[] = [];
  const y = 0.09;
  for (const l of lights) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2;
      const a1 = ((k + 1) / seg) * Math.PI * 2;
      pos.push(l.x, y, l.z, l.x + Math.cos(a0) * radiusM, y, l.z + Math.sin(a0) * radiusM * 0.8, l.x + Math.cos(a1) * radiusM, y, l.z + Math.sin(a1) * radiusM * 0.8);
      col.push(1, 0.95, 0.82, 0.55, 1, 0.95, 0.82, 0, 1, 0.95, 0.82, 0);
    }
  }
  return rgbaGeometry(pos, col);
}

/** Vnitřní příčky napříč halou (svislé stěny od podlahy téměř ke stropu). */
export function buildPartitions(segs: Array<{ x: number; zMin: number; zMax: number }>, clearHeightM: number): THREE.BufferGeometry | null {
  return merge(segs.map((s) => box(0.25, clearHeightM - 0.3, s.zMax - s.zMin, s.x, (clearHeightM - 0.3) / 2, (s.zMin + s.zMax) / 2)));
}

/** Fotovoltaické panely: mírně nakloněné desky na nízkých podstavcích nad střešní plochou; slité do dvou sítí. */
export function buildPv(cells: Array<{ x: number; z: number }>, clearHeightM: number, cell: { widthM: number; depthM: number; tiltRad: number }): { panels: THREE.BufferGeometry | null; bases: THREE.BufferGeometry | null } {
  // Souřadnice y jsou relativní k střešní ploše (skupina v modelu se posune na výšku střechy a může se zvedat).
  void clearHeightM;
  const top = 0;
  const panels = merge(
    cells.map((c) => {
      const g = new THREE.BoxGeometry(cell.widthM, 0.06, cell.depthM);
      g.rotateX(-cell.tiltRad);
      g.translate(c.x, top + 0.42, c.z);
      return g;
    }),
  );
  const bases = merge(cells.map((c) => box(cell.widthM * 0.9, 0.3, 0.12, c.x, top + 0.15, c.z + cell.depthM * 0.35)));
  return { panels, bases };
}
