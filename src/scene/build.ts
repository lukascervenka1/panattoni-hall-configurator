/**
 * Logika "stavby před očima" (čisté funkce, bez Reactu a Three.js).
 *
 * Zobrazená hala se k cílové konfiguraci blíží plynule: rozměry hladkým doběhem, doky a vrata po jednom.
 * Zobrazená konfigurace musí být v každém okamžiku platná (doky se vejdou na fasádu, administrativa do haly),
 * jinak by se otvory překrývaly: `displayConfig` proto mezihodnoty omezí stejnými pravidly jako validace.
 */
import {
  maxDockCount,
  maxDriveInCount,
  maxOfficeFloors,
  notchLimits,
  officeAreaLimits,
} from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";

export interface BuildValues {
  lengthM: number;
  widthM: number;
  clearHeightM: number;
  /** Rozměry výřezu (půdorys L); u obdélníku 0. */
  notchL: number;
  notchW: number;
  dock: number;
  driveIn: number;
  officeArea: number;
}

export function valuesOf(c: HallConfig): BuildValues {
  return {
    lengthM: c.dimensions.lengthM,
    widthM: c.dimensions.widthM,
    clearHeightM: c.dimensions.clearHeightM,
    notchL: c.dimensions.notchLengthM,
    notchW: c.dimensions.notchWidthM,
    dock: c.openings.dockCount,
    driveIn: c.openings.driveInCount,
    officeArea: c.office.areaM2,
  };
}

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** Zpomalení na konci (cubic out): stavební prvek "dosedá". */
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export const BUILD_RATES = {
  /** Časová konstanta doběhu rozměrů (1/s): větší = rychlejší. */
  smooth: 6.5,
  /** Rychlost přibývání doků a vrat (kusů za sekundu). */
  countsPerSecond: 7,
} as const;

/** Posun zobrazených hodnot k cíli o dt sekund. */
export function stepValues(cur: BuildValues, tgt: BuildValues, dt: number): BuildValues {
  const a = 1 - Math.exp(-BUILD_RATES.smooth * dt);
  const toward = (c: number, t: number, snap: number) => (Math.abs(t - c) < snap ? t : c + (t - c) * a);
  const counts = (c: number, t: number) => {
    const step = BUILD_RATES.countsPerSecond * dt;
    return Math.abs(t - c) <= step ? t : c + Math.sign(t - c) * step;
  };
  return {
    lengthM: toward(cur.lengthM, tgt.lengthM, 0.05),
    widthM: toward(cur.widthM, tgt.widthM, 0.05),
    clearHeightM: toward(cur.clearHeightM, tgt.clearHeightM, 0.02),
    notchL: toward(cur.notchL, tgt.notchL, 0.05),
    notchW: toward(cur.notchW, tgt.notchW, 0.05),
    dock: counts(cur.dock, tgt.dock),
    driveIn: counts(cur.driveIn, tgt.driveIn),
    officeArea: toward(cur.officeArea, tgt.officeArea, 0.5),
  };
}

/** Commit dimensions once per scene update; animate only discrete opening counts.
 * Rebuilding roofs with skylight holes for every interpolation step blocks the UI thread.
 */
export function stepSceneValues(cur: BuildValues, tgt: BuildValues, dt: number): BuildValues {
  return stepValues({ ...tgt, dock: cur.dock, driveIn: cur.driveIn }, tgt, dt);
}

export function isSettled(cur: BuildValues, tgt: BuildValues): boolean {
  return (Object.keys(tgt) as Array<keyof BuildValues>).every((k) => Math.abs(cur[k] - tgt[k]) < 1e-6);
}

const q1 = (n: number) => Math.round(n * 10) / 10;

/** Platná konfigurace odpovídající zobrazeným mezihodnotám (rozměry na 0,1 m, počty celé). */
export function displayConfig(target: HallConfig, v: BuildValues): HallConfig {
  const base = { lengthM: q1(v.lengthM), widthM: q1(v.widthM), clearHeightM: q1(v.clearHeightM) };
  // Výřez roste z nuly (přepnutí na L) nebo se zmenšuje do nuly (zpět na obdélník); zobrazený tvar je L, dokud je výřez vidět.
  // Hodnoty se omezují tak, aby ramena zůstala široká a otvory se nikdy nepřekrývaly.
  const lim = notchLimits({ ...base, shape: "L" });
  const nl = lim.available ? Math.min(q1(v.notchL), lim.maxLengthM) : 0;
  const nw = lim.available ? Math.min(q1(v.notchW), lim.maxWidthM) : 0;
  const isL = nl >= 0.5 && nw >= 0.5;
  const dims = { ...base, shape: isL ? ("L" as const) : ("rect" as const), notchLengthM: isL ? nl : 0, notchWidthM: isL ? nw : 0 };
  const clampInt = (n: number, max: number) => Math.max(0, Math.min(Math.round(n), max));
  let office = { enabled: false, areaM2: 0, floors: target.office.floors };
  if (target.office.enabled) {
    const maxFloors = maxOfficeFloors(dims.clearHeightM);
    if (maxFloors > 0) {
      const floors = Math.min(target.office.floors, maxFloors) as 1 | 2 | 3;
      const lim = officeAreaLimits(dims, floors);
      if (lim.maxM2 >= lim.minM2) {
        office = { enabled: true, areaM2: Math.min(lim.maxM2, Math.max(lim.minM2, Math.round(v.officeArea))), floors };
      }
    }
  }
  return {
    ...target,
    dimensions: dims,
    openings: { dockCount: clampInt(v.dock, maxDockCount(dims)), driveInCount: clampInt(v.driveIn, maxDriveInCount(dims)) },
    office,
  };
}

/**
 * Časování počáteční stavby (sekundy od spuštění): základ → stěny rostou odspodu → střecha dosedne → vybavení se objeví.
 * Samotný průběh je klip pro `AnimationMixer` (constructionClip.ts); zde jsou jen společné konstanty.
 */
export const CONSTRUCTION = {
  floorStart: 0.0,
  floorDur: 0.6,
  columnsStart: 0.55,
  columnsDur: 1.0,
  beamsStart: 1.35,
  beamsDur: 0.8,
  wallsStart: 2.1,
  wallsDur: 1.25,
  roofStart: 3.3,
  roofDur: 0.9,
  furnishStart: 4.15,
  furnishDur: 0.9,
  roofDropM: 1.2,
} as const;
