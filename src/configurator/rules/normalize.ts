/**
 * Úprava konfigurace tak, aby splňovala pravidla: ořezání na meze, přichycení ke kroku a zachování
 * závislostí (počet vrat vs. délka fasády, administrativa vs. výška a půdorys).
 * UI ji volá po každé změně, takže uživatel nemůže vyrobit neplatný stav; server validuje znovu.
 */
import type { ConfigCatalog } from "@/catalog/public";
import { CATEGORY_IDS, type ParameterId } from "@/catalog/ids";
import { HARD_LIMITS, type HallConfig } from "../schema/config";
import { defaultOptionId } from "../schema/defaults";
import { maxDockCount, maxDriveInCount, maxOfficeFloors, notchLimits, officeAreaLimits } from "../calculations/layout";
import { DEMO_GEOMETRY as G } from "../calculations/constants";
import { availableOptionIds, ruleRange } from "./validate";

const roundTo = (n: number, digits = 6) => Number(n.toFixed(digits));

/** Ořízne hodnotu na [min, max] a přichytí ke kroku (mřížka začíná v min nebo 0). */
export function snapToRange(value: number, range: { min?: number; max?: number; step?: number }): number {
  let v = Number.isFinite(value) ? value : (range.min ?? 0);
  const anchor = range.min ?? 0;
  if (range.step && range.step > 0) v = anchor + Math.round((v - anchor) / range.step) * range.step;
  if (range.min !== undefined) v = Math.max(range.min, v);
  if (range.max !== undefined) v = Math.min(range.max, v);
  return roundTo(v);
}

/** Největší hodnota na mřížce kroku (od `min`), která není větší než `max`. */
function snapNotch(value: number, min: number, max: number, step?: number): number | null {
  let v = snapToRange(value, { min, max, step });
  while (step && v > max + 1e-9) v -= step;
  return v < min - 1e-9 ? null : v;
}

export function normalizeConfig(config: HallConfig, catalog: ConfigCatalog): HallConfig {
  const next = structuredClone(config);
  const pid = next.productId;
  const dim = (id: ParameterId, value: number, hard: { min: number; max: number }) => {
    const r = ruleRange(catalog, pid, id);
    return snapToRange(value, { min: r.min ?? hard.min, max: r.max ?? hard.max, step: r.step });
  };

  next.dimensions.lengthM = dim("length_m", next.dimensions.lengthM, HARD_LIMITS.lengthM);
  next.dimensions.widthM = dim("width_m", next.dimensions.widthM, HARD_LIMITS.widthM);
  next.dimensions.clearHeightM = dim("clear_height_m", next.dimensions.clearHeightM, HARD_LIMITS.clearHeightM);

  // Tvar: L jen tehdy, vejde-li se výřez; jinak obdélník. Při prvním přepnutí na L se dosadí rozumný výřez.
  const dm = next.dimensions;
  if (dm.shape === "L") {
    const lim = notchLimits(dm);
    const rl = ruleRange(catalog, pid, "notch_length_m");
    const rw = ruleRange(catalog, pid, "notch_width_m");
    const stepL = rl.step ?? 6;
    const stepW = rw.step ?? 6;
    const wantL = dm.notchLengthM > 0 ? dm.notchLengthM : dm.lengthM * G.notch.defaultShareLength;
    const wantW = dm.notchWidthM > 0 ? dm.notchWidthM : dm.widthM * G.notch.defaultShareWidth;
    const nl = lim.available ? snapNotch(wantL, Math.max(rl.min ?? lim.minM, lim.minM), Math.min(rl.max ?? lim.maxLengthM, lim.maxLengthM), stepL) : null;
    const nw = lim.available ? snapNotch(wantW, Math.max(rw.min ?? lim.minM, lim.minM), Math.min(rw.max ?? lim.maxWidthM, lim.maxWidthM), stepW) : null;
    if (nl === null || nw === null) {
      dm.shape = "rect";
      dm.notchLengthM = 0;
      dm.notchWidthM = 0;
    } else {
      dm.notchLengthM = nl;
      dm.notchWidthM = nw;
    }
  } else {
    dm.notchLengthM = 0;
    dm.notchWidthM = 0;
  }

  next.openings.dockCount = Math.max(0, Math.min(maxDockCount(next.dimensions), Math.round(next.openings.dockCount)));
  next.openings.driveInCount = Math.max(0, Math.min(maxDriveInCount(next.dimensions), Math.round(next.openings.driveInCount)));

  if (next.office.enabled) {
    const maxFloors = maxOfficeFloors(next.dimensions.clearHeightM);
    if (maxFloors === 0) {
      next.office.enabled = false;
    } else {
      next.office.floors = Math.min(next.office.floors, maxFloors) as 1 | 2 | 3;
      const lim = officeAreaLimits(next.dimensions, next.office.floors);
      if (lim.maxM2 < lim.minM2) {
        next.office.enabled = false;
      } else {
        next.office.areaM2 = Math.max(lim.minM2, Math.min(lim.maxM2, Math.round(next.office.areaM2)));
      }
    }
  }

  for (const cat of CATEGORY_IDS) {
    if (!availableOptionIds(catalog, pid, cat).includes(next.selections[cat])) {
      next.selections[cat] = defaultOptionId(catalog, pid, cat);
    }
  }
  return next;
}
