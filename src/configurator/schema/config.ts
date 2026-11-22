/**
 * Jeden serializovatelný objekt produktové konfigurace (spec kap. 8).
 * Neobsahuje kontaktní údaje, stav kamery ani otevřené panely (ty patří do prezentačního stavu).
 * Obsahuje pouze volby a rozměry; cenu ani množství klient nikdy neposílá jako důvěryhodné.
 */
import { z } from "zod";
import {
  CATEGORY_IDS,
  SHAPES,
  type BooleanParameterId,
  type CategoryId,
  type NumericParameterId,
  type ParameterId,
} from "@/catalog/ids";

export const CONFIG_SCHEMA_VERSION = 1 as const;

/** Tvrdé technické meze proti zneužití (obchodní limity určují pravidla katalogu, viz rules/validate.ts). */
export const HARD_LIMITS = {
  lengthM: { min: 1, max: 1000 },
  widthM: { min: 1, max: 1000 },
  clearHeightM: { min: 1, max: 60 },
  notchM: { min: 0, max: 1000 },
  count: { min: 0, max: 500 },
  officeAreaM2: { min: 0, max: 100_000 },
} as const;

const SelectionsSchema = z.object(
  Object.fromEntries(CATEGORY_IDS.map((c) => [c, z.string().min(1).max(64)])) as Record<CategoryId, z.ZodString>,
);

export const ConfigSchema = z.object({
  schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
  productId: z.string().min(1).max(64),
  /** Konfigurace zůstává připnutá k verzi katalogu, ve které vznikla (spec kap. 10). */
  catalogVersionId: z.string().min(1).max(64),
  /** Prosvětlení haly; nezávislé na oknech administrativy. Starší exporty používají světlíky. */
  daylight: z.enum(["roof", "facade", "both"]).default("roof"),
  dimensions: z.object({
    lengthM: z.number().finite().min(HARD_LIMITS.lengthM.min).max(HARD_LIMITS.lengthM.max),
    widthM: z.number().finite().min(HARD_LIMITS.widthM.min).max(HARD_LIMITS.widthM.max),
    clearHeightM: z.number().finite().min(HARD_LIMITS.clearHeightM.min).max(HARD_LIMITS.clearHeightM.max),
    /** Tvar půdorysu: obdélník, nebo L (obdélník s výřezem v pravém předním rohu). */
    shape: z.enum(SHAPES),
    /** Rozměr výřezu podél délky (x) a šířky (z). U obdélníku 0. */
    notchLengthM: z.number().finite().min(HARD_LIMITS.notchM.min).max(HARD_LIMITS.notchM.max),
    notchWidthM: z.number().finite().min(HARD_LIMITS.notchM.min).max(HARD_LIMITS.notchM.max),
  }),
  openings: z.object({
    dockCount: z.number().int().min(HARD_LIMITS.count.min).max(HARD_LIMITS.count.max),
    driveInCount: z.number().int().min(HARD_LIMITS.count.min).max(HARD_LIMITS.count.max),
  }),
  office: z.object({
    enabled: z.boolean(),
    /** Celková podlahová plocha administrativy přes všechna její podlaží. */
    areaM2: z.number().finite().min(HARD_LIMITS.officeAreaM2.min).max(HARD_LIMITS.officeAreaM2.max),
    floors: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  selections: SelectionsSchema,
});

export type HallConfig = z.infer<typeof ConfigSchema>;

/** Přečte hodnotu parametru podle jeho ID (jednotné místo pro presety a pravidla). */
export function getParameter(config: HallConfig, id: ParameterId): number | boolean | string {
  switch (id) {
    case "length_m":
      return config.dimensions.lengthM;
    case "width_m":
      return config.dimensions.widthM;
    case "clear_height_m":
      return config.dimensions.clearHeightM;
    case "dock_count":
      return config.openings.dockCount;
    case "drive_in_count":
      return config.openings.driveInCount;
    case "office_area_m2":
      return config.office.areaM2;
    case "office_floors":
      return config.office.floors;
    case "office_enabled":
      return config.office.enabled;
    case "notch_length_m":
      return config.dimensions.notchLengthM;
    case "notch_width_m":
      return config.dimensions.notchWidthM;
    case "shape":
      return config.dimensions.shape;
    case "daylight":
      return config.daylight;
    default:
      return config.selections[id];
  }
}

export function isNumericParameter(id: ParameterId): id is NumericParameterId {
  return (
    id === "length_m" ||
    id === "width_m" ||
    id === "clear_height_m" ||
    id === "dock_count" ||
    id === "drive_in_count" ||
    id === "office_area_m2" ||
    id === "office_floors" ||
    id === "notch_length_m" ||
    id === "notch_width_m"
  );
}

export function isBooleanParameter(id: ParameterId): id is BooleanParameterId {
  return id === "office_enabled";
}

/** Vrátí novou konfiguraci s nastaveným parametrem (neměnný update). Hodnotu typu nekontroluje, to dělá validace. */
export function withParameter(config: HallConfig, id: ParameterId, value: number | boolean | string): HallConfig {
  const next = structuredClone(config);
  switch (id) {
    case "length_m":
      next.dimensions.lengthM = Number(value);
      break;
    case "width_m":
      next.dimensions.widthM = Number(value);
      break;
    case "clear_height_m":
      next.dimensions.clearHeightM = Number(value);
      break;
    case "dock_count":
      next.openings.dockCount = Number(value);
      break;
    case "drive_in_count":
      next.openings.driveInCount = Number(value);
      break;
    case "office_area_m2":
      next.office.areaM2 = Number(value);
      break;
    case "office_floors":
      next.office.floors = Number(value) === 3 ? 3 : Number(value) === 2 ? 2 : 1;
      break;
    case "office_enabled":
      next.office.enabled = value === true || value === "true";
      break;
    case "notch_length_m":
      next.dimensions.notchLengthM = Number(value);
      break;
    case "notch_width_m":
      next.dimensions.notchWidthM = Number(value);
      break;
    case "shape":
      next.dimensions.shape = value === "L" ? "L" : "rect";
      break;
    case "daylight":
      next.daylight = value === "both" ? "both" : value === "facade" ? "facade" : "roof";
      break;
    default:
      next.selections[id] = String(value);
  }
  return next;
}

/** Parsuje textovou hodnotu z tabulek katalogu (Presets/Rules) podle typu parametru. Nejednoznačné zápisy odmítá. */
export function parseParameterValue(id: ParameterId, raw: string): number | boolean | string {
  if (isNumericParameter(id)) {
    if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Hodnota "${raw}" parametru ${id} není číslo (použij desetinnou tečku).`);
    return Number(raw);
  }
  if (id === "shape") {
    if (raw !== "rect" && raw !== "L") throw new Error(`Hodnota "${raw}" parametru shape musí být rect nebo L.`);
    return raw;
  }
  if (id === "daylight") {
    if (raw !== "roof" && raw !== "facade" && raw !== "both") throw new Error(`Hodnota "${raw}" parametru daylight musí být roof, facade nebo both.`);
    return raw;
  }
  if (isBooleanParameter(id)) {
    if (raw !== "true" && raw !== "false") throw new Error(`Hodnota "${raw}" parametru ${id} musí být true nebo false.`);
    return raw === "true";
  }
  return raw;
}

/** Bezpečný převod neznámého vstupu (JSON import, tělo požadavku) na konfiguraci. */
export function parseConfig(input: unknown): { ok: true; config: HallConfig } | { ok: false; error: string } {
  const r = ConfigSchema.safeParse(input);
  if (r.success) return { ok: true, config: r.data };
  const first = r.error.issues[0];
  return { ok: false, error: `${first?.path.join(".") || "konfigurace"}: ${first?.message ?? "neplatná hodnota"}` };
}

export function serializeConfig(config: HallConfig): string {
  return JSON.stringify(config);
}
