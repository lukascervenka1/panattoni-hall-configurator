/**
 * Krajina kolem areálu (čistá rozvržení): pole různých plodin, meze se stromy a vzdálené kopce.
 * Je ilustrativní: nejde o skutečný pozemek ani okolí (spec kap. 3). Deterministické ukotvení ve světových
 * souřadnicích zajistí, že se pole při změně rozměrů haly nepřelosují, jen se uvolní místo pro areál.
 */
import type { Rect, SurroundingsLayout, TreePlacement } from "./layout";
import { rectContains } from "./layout";

export const FIELD_KINDS = ["wheat", "crop", "plowed", "rapeseed", "meadow"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export interface FieldPatch extends Rect {
  kind: FieldKind;
  /** Řádky plodin běží podél osy x, nebo z. */
  rows: "x" | "z";
}

export interface Hill {
  x: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  tone: number;
}

export interface LandscapeLayout {
  fields: FieldPatch[];
  hedges: TreePlacement[];
  /** Pás lesa za areálem (zadní a boční strana); přední strana u komunikace zůstává otevřená. */
  forest: TreePlacement[];
  hills: Hill[];
}

export const FIELD_CELL = { w: 150, d: 110, gap: 5 } as const;
const RADIUS = 900;

/** Pás lesa: odstup od pozemku, hloubka pásu, rozteč stromů a nejvyšší počet. */
export const FOREST = { insetM: 22, depthM: 80, stepM: 7, max: 900 } as const;

function hash3(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const intersects = (a: Rect, b: Rect, pad = 0) =>
  a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;

export function layoutLandscape(s: SurroundingsLayout): LandscapeLayout {
  const { w, d, gap } = FIELD_CELL;
  const fields: FieldPatch[] = [];
  const hedges: TreePlacement[] = [];
  // Areál (pozemek s plotem) a silnice s krajnicí zůstávají volné.
  const site: Rect = { x0: s.plot.x0 - 26, x1: s.plot.x1 + 26, z0: s.plot.z0 - 26, z1: s.road.z1 + 14 };
  const roadBand: Rect = { x0: -1e5, x1: 1e5, z0: s.road.z0 - 14, z1: s.road.z1 + 14 };

  const cx0 = Math.floor(-RADIUS / w);
  const cx1 = Math.ceil(RADIUS / w);
  const cz0 = Math.floor((s.plot.z0 - RADIUS) / d);
  const cz1 = Math.ceil((s.road.z1 + RADIUS) / d);
  for (let ix = cx0; ix <= cx1; ix++) {
    for (let iz = cz0; iz <= cz1; iz++) {
      const r: Rect = { x0: ix * w + gap / 2, x1: (ix + 1) * w - gap / 2, z0: iz * d + gap / 2, z1: (iz + 1) * d - gap / 2 };
      if (intersects(r, site) || intersects(r, roadBand)) continue;
      if (Math.hypot((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2) > RADIUS) continue;
      const kind = FIELD_KINDS[Math.floor(hash3(ix, iz, 1) * FIELD_KINDS.length)]!;
      fields.push({ ...r, kind, rows: hash3(ix, iz, 2) > 0.5 ? "x" : "z" });
      // Mez se stromy na části hranic polí.
      if (hash3(ix, iz, 3) > 0.55) {
        const along = hash3(ix, iz, 4) > 0.5;
        const n = along ? Math.floor(w / 9) : Math.floor(d / 9);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const x = along ? ix * w + t * w : ix * w;
          const z = along ? iz * d : iz * d + t * d;
          const hit = rectContains(site, x, z, 4) || rectContains(roadBand, x, z, 2);
          if (!hit && hash3(ix * 31 + k, iz * 17, 5) > 0.2) hedges.push({ x, z, scale: 0.7 + hash3(ix + k, iz, 6) * 0.6 });
        }
      }
    }
  }

  // Les: pás hustých stromů za zadní a po bočních stranách pozemku, řídnoucí směrem od areálu (jako na vizuálu z katalogu).
  const forest: TreePlacement[] = [];
  const core: Rect = { x0: s.plot.x0 - FOREST.insetM, x1: s.plot.x1 + FOREST.insetM, z0: s.plot.z0 - FOREST.insetM, z1: 1e5 };
  const outer: Rect = { x0: core.x0 - FOREST.depthM, x1: core.x1 + FOREST.depthM, z0: core.z0 - FOREST.depthM, z1: s.road.z0 - 20 };
  for (let gx = Math.ceil(outer.x0 / FOREST.stepM); gx <= Math.floor(outer.x1 / FOREST.stepM); gx++) {
    for (let gz = Math.ceil(outer.z0 / FOREST.stepM); gz <= Math.floor(outer.z1 / FOREST.stepM); gz++) {
      const x = gx * FOREST.stepM + (hash3(gx, gz, 21) - 0.5) * 4.5;
      const z = gz * FOREST.stepM + (hash3(gz, gx, 22) - 0.5) * 4.5;
      if (rectContains(core, x, z)) continue;
      if (!rectContains(outer, x, z) || rectContains(roadBand, x, z, 2)) continue;
      // hustota klesá se vzdáleností od pozemku
      const away = Math.max(core.x0 - x, x - core.x1, core.z0 - z) / FOREST.depthM;
      if (hash3(gx, gz, 23) > 0.95 - 0.5 * away) continue;
      forest.push({ x, z, scale: 1.5 + hash3(gx, gz, 24) * 0.9 });
    }
  }
  const stride = Math.max(1, Math.ceil(forest.length / FOREST.max));

  // Vzdálené kopce v pozadí (za areálem a po stranách), vykreslené jen jako mlžné siluety.
  const hills: Hill[] = [];
  for (let i = 0; i < 9; i++) {
    const ang = Math.PI * (0.05 + 0.9 * (i / 8)) + Math.PI; // oblouk za zadní fasádou (−z)
    const dist = 1250 + hash3(i, 7) * 350;
    hills.push({
      x: Math.cos(ang) * dist,
      z: Math.sin(ang) * dist,
      rx: 260 + hash3(i, 8) * 220,
      ry: 55 + hash3(i, 9) * 70,
      rz: 220 + hash3(i, 10) * 140,
      tone: hash3(i, 11),
    });
  }
  return { fields, hedges: hedges.slice(0, 900), forest: forest.filter((_, i) => i % stride === 0), hills };
}
