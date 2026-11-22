/**
 * Pravidlová vrstva: oddělená od UI i od vykreslování. Čistá funkce (konfigurace, katalog) → problémy.
 *
 * Typy pravidel z tabulky Rules (jen předem implementované, žádné výrazy):
 *   min, max      číselná hodnota parametru
 *   step          hodnota musí ležet na mřížce kroku; počátek mřížky je pravidlo "min" téhož parametru, jinak 0
 *   required      parametr musí mít přesně danou hodnotu (např. office_enabled=true nebo dock=dock.pnt)
 *   forbidden_combination   "param=hodnota&param=hodnota": zakázáno, pokud platí všechny podmínky zároveň
 *   available_for_concept   parametr = kategorie, hodnota = option_id. Existuje-li alespoň jedno takové pravidlo
 *                           pro kategorii a produkt, jsou povoleny JEN uvedené volby
 *
 * Odvozená omezení, která Excel nenahrazuje a která drží kód (spec: "složitější pravidla v MVP drž v kódu"):
 * maximální počet vrat podle délky fasády, rozměry a výška administrativy, kolize otvorů.
 */
import { PARAMETER_IDS, type ParameterId } from "@/catalog/ids";
import type { ConfigCatalog } from "@/catalog/public";
import { getParameter, parseParameterValue, type HallConfig } from "../schema/config";
import {
  findOpeningProblems,
  maxDockCount,
  maxDriveInCount,
  maxOfficeFloors,
  notchLimits,
  notchOf,
  officeAreaLimits,
  placeOpenings,
} from "../calculations/layout";
import { DEMO_GEOMETRY as G } from "../calculations/constants";

export interface ValidationIssue {
  code:
    | "unknown_product"
    | "inactive_product"
    | "unknown_option"
    | "option_unavailable"
    | "min"
    | "max"
    | "step"
    | "required"
    | "forbidden_combination"
    | "dock_capacity"
    | "drive_in_capacity"
    | "office_height"
    | "office_area"
    | "office_floors"
    | "opening_collision"
    | "notch"
    | "rule_malformed";
  parameterId?: ParameterId;
  ruleId?: string;
  message_cs: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const EPS = 1e-9;
const isParameterId = (s: string): s is ParameterId => (PARAMETER_IDS as readonly string[]).includes(s);
const fmtNum = (n: number) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });

export function rulesForProduct(catalog: ConfigCatalog, productId: string) {
  return catalog.rules.filter((r) => r.product_id === productId);
}

/** Obchodní meze číselného parametru z pravidel min/max/step pro daný produkt. */
export function ruleRange(
  catalog: ConfigCatalog,
  productId: string,
  parameterId: ParameterId,
): { min?: number; max?: number; step?: number } {
  const out: { min?: number; max?: number; step?: number } = {};
  for (const r of rulesForProduct(catalog, productId)) {
    if (r.parameter_id !== parameterId) continue;
    const n = Number(r.value);
    if (!Number.isFinite(n)) continue;
    if (r.rule_type === "min") out.min = n;
    if (r.rule_type === "max") out.max = n;
    if (r.rule_type === "step") out.step = n;
  }
  return out;
}

/** ID voleb, které jsou pro produkt v dané kategorii dostupné. */
export function availableOptionIds(catalog: ConfigCatalog, productId: string, categoryId: ParameterId): string[] {
  const restricted = rulesForProduct(catalog, productId)
    .filter((r) => r.rule_type === "available_for_concept" && r.parameter_id === categoryId)
    .map((r) => r.value);
  const active = catalog.options.filter((o) => o.category_id === categoryId && o.active).map((o) => o.option_id);
  return restricted.length > 0 ? active.filter((id) => restricted.includes(id)) : active;
}

export function validateConfig(config: HallConfig, catalog: ConfigCatalog): ValidationResult {
  const issues: ValidationIssue[] = [];
  const push = (i: ValidationIssue) => issues.push(i);

  const product = catalog.products.find((p) => p.product_id === config.productId);
  if (!product) {
    return { ok: false, issues: [{ code: "unknown_product", message_cs: `Neznámý koncept "${config.productId}".` }] };
  }
  if (!product.active) push({ code: "inactive_product", message_cs: "Tento koncept není aktivní." });

  // Volby materiálů
  for (const [category, optionId] of Object.entries(config.selections)) {
    const option = catalog.options.find((o) => o.option_id === optionId);
    if (!option || option.category_id !== category || !option.active) {
      push({ code: "unknown_option", parameterId: category as ParameterId, message_cs: `Volba "${optionId}" není v kategorii "${category}" k dispozici.` });
      continue;
    }
    if (!availableOptionIds(catalog, config.productId, category as ParameterId).includes(optionId)) {
      push({ code: "option_unavailable", parameterId: category as ParameterId, message_cs: `Volba "${option.name_cs}" není pro koncept "${product.name_cs}" dostupná.` });
    }
  }

  // Pravidla z katalogu
  for (const r of rulesForProduct(catalog, config.productId)) {
    if (r.rule_type === "available_for_concept") continue; // řešeno výše
    if (r.rule_type === "forbidden_combination") {
      const parts = r.value.split("&").map((p) => p.split("="));
      let allMatch = parts.length > 0;
      for (const [pid, raw] of parts) {
        if (!pid || raw === undefined || !isParameterId(pid)) {
          push({ code: "rule_malformed", ruleId: r.rule_id, message_cs: `Pravidlo ${r.rule_id} má neplatný zápis kombinace.` });
          allMatch = false;
          break;
        }
        try {
          if (getParameter(config, pid) !== parseParameterValue(pid, raw)) allMatch = false;
        } catch {
          push({ code: "rule_malformed", ruleId: r.rule_id, message_cs: `Pravidlo ${r.rule_id} má neplatnou hodnotu "${raw}".` });
          allMatch = false;
        }
      }
      if (allMatch) push({ code: "forbidden_combination", ruleId: r.rule_id, message_cs: r.message_cs });
      continue;
    }

    const pid = r.parameter_id;
    // Rozměry výřezu mají smysl jen u půdorysu L (u obdélníku jsou 0).
    if ((pid === "notch_length_m" || pid === "notch_width_m") && config.dimensions.shape !== "L") continue;
    let expected: number | boolean | string;
    try {
      expected = parseParameterValue(pid, r.value);
    } catch {
      push({ code: "rule_malformed", ruleId: r.rule_id, parameterId: pid, message_cs: `Pravidlo ${r.rule_id} má neplatnou hodnotu "${r.value}".` });
      continue;
    }
    const actual = getParameter(config, pid);

    if (r.rule_type === "required") {
      if (actual !== expected) push({ code: "required", ruleId: r.rule_id, parameterId: pid, message_cs: r.message_cs });
      continue;
    }
    if (typeof actual !== "number" || typeof expected !== "number") {
      push({ code: "rule_malformed", ruleId: r.rule_id, parameterId: pid, message_cs: `Pravidlo ${r.rule_id} (${r.rule_type}) lze použít jen na číselný parametr.` });
      continue;
    }
    if (r.rule_type === "min" && actual < expected - EPS) push({ code: "min", ruleId: r.rule_id, parameterId: pid, message_cs: r.message_cs });
    if (r.rule_type === "max" && actual > expected + EPS) push({ code: "max", ruleId: r.rule_id, parameterId: pid, message_cs: r.message_cs });
    if (r.rule_type === "step") {
      const anchor = ruleRange(catalog, config.productId, pid).min ?? 0;
      const q = (actual - anchor) / expected;
      if (expected <= 0 || Math.abs(q - Math.round(q)) > 1e-6) push({ code: "step", ruleId: r.rule_id, parameterId: pid, message_cs: r.message_cs });
    }
  }

  // Odvozená omezení
  const dims = config.dimensions;
  // Půdorys L: výřez musí mít smysluplné rozměry a ramena haly zůstat dost široká.
  if (dims.shape === "L") {
    const lim = notchLimits(dims);
    const { nx, nz } = notchOf(dims);
    if (!lim.available) {
      push({ code: "notch", parameterId: "shape", message_cs: "Na takto malou halu se půdorys L nehodí: ramena by byla příliš úzká." });
    } else {
      if (nx < lim.minM - EPS || nx > lim.maxLengthM + EPS) {
        push({ code: "notch", parameterId: "notch_length_m", message_cs: `Délka výřezu musí být ${fmtNum(lim.minM)} až ${fmtNum(lim.maxLengthM)} m.` });
      }
      if (nz < lim.minM - EPS || nz > lim.maxWidthM + EPS) {
        push({ code: "notch", parameterId: "notch_width_m", message_cs: `Šířka výřezu musí být ${fmtNum(lim.minM)} až ${fmtNum(lim.maxWidthM)} m.` });
      }
    }
  } else if (dims.notchLengthM !== 0 || dims.notchWidthM !== 0) {
    push({ code: "notch", parameterId: "shape", message_cs: "Obdélníková hala nemá výřez." });
  }

  const maxDocks = maxDockCount(dims);
  if (config.openings.dockCount > maxDocks) {
    push({ code: "dock_capacity", parameterId: "dock_count", message_cs: `Na zadní fasádě se vejde nejvýše ${maxDocks} nakládacích doků.` });
  }
  const maxDriveIns = maxDriveInCount(dims);
  if (config.openings.driveInCount > maxDriveIns) {
    push({ code: "drive_in_capacity", parameterId: "drive_in_count", message_cs: `Na boční fasádě se vejde nejvýše ${maxDriveIns} vjezdových vrat.` });
  }

  if (config.office.enabled) {
    const maxFloors = maxOfficeFloors(dims.clearHeightM);
    if (maxFloors === 0) {
      push({ code: "office_height", parameterId: "office_enabled", message_cs: "Při této světlé výšce se administrativa do haly nevejde." });
    } else if (config.office.floors > maxFloors) {
      push({
        code: "office_floors",
        parameterId: "office_floors",
        message_cs: `${config.office.floors === 3 ? "Tři" : "Dvě"} podlaží administrativy vyžadují světlou výšku nejméně ${fmtNum(config.office.floors * G.office.floorHeightM + G.office.headroomM)} m.`,
      });
    }
    const lim = officeAreaLimits(dims, config.office.floors);
    if (lim.maxM2 < lim.minM2) {
      push({ code: "office_area", parameterId: "office_area_m2", message_cs: "Do haly o těchto rozměrech se administrativa nevejde." });
    } else if (config.office.areaM2 < lim.minM2 - EPS || config.office.areaM2 > lim.maxM2 + EPS) {
      push({
        code: "office_area",
        parameterId: "office_area_m2",
        message_cs: `Plocha administrativy musí být v rozmezí ${fmtNum(lim.minM2)} až ${fmtNum(lim.maxM2)} m² pro tuto halu.`,
      });
    }
  }

  // Poslední pojistka: otvory se nesmějí překrývat ani přesahovat fasádu (každý otvor se počítá právě jednou).
  if (issues.every((i) => i.code !== "dock_capacity" && i.code !== "drive_in_capacity" && i.code !== "office_area" && i.code !== "office_height" && i.code !== "office_floors")) {
    const problems = findOpeningProblems(dims, placeOpenings(config));
    if (problems.length > 0) {
      push({ code: "opening_collision", message_cs: "Otvory fasády se překrývají nebo se nevejdou na fasádu. Upravte počty nebo rozměry." });
    }
  }

  return { ok: issues.length === 0, issues };
}
