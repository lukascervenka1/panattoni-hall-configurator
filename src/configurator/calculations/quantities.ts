/**
 * Odvozené plochy a účtovaná množství. Čistá funkce konfigurace; server ji volá znovu a klientovi nevěří.
 *
 * Definice ploch (docs/GEOMETRY.md):
 * - Zastavěná plocha = L × W (půdorys obálky haly).
 * - Administrativa je vestavba UVNITŘ haly: její přízemí je už součástí zastavěné plochy a nepočítá se podruhé.
 * - Podlahová plocha administrativy = součet přes její podlaží ("office_floor_area").
 * - Celková podlahová plocha = zastavěná + patra administrativy nad přízemím.
 * - Plocha střechy se uvádí bez světlíků (světlíky se účtují zvlášť).
 *
 * Zaokrouhlení: každé množství se zaokrouhlí na 0,01 (m² / m); počty jsou celá čísla.
 */
import { DEMO_GEOMETRY as G } from "./constants";
import { findOpeningProblems, footprintAreaM2, officeLayout, placeOpenings, totalHeightM } from "./layout";
import type { HallConfig } from "../schema/config";

export interface Quantities {
  lengthM: number;
  widthM: number;
  clearHeightM: number;
  totalHeightM: number;
  perimeterM: number;
  footprintAreaM2: number;
  officeFootprintM2: number;
  officeFloorAreaM2: number;
  hallGroundAreaM2: number;
  totalFloorAreaM2: number;
  grossFacadeAreaM2: number;
  openingsAreaM2: number;
  netFacadeAreaM2: number;
  dockCount: number;
  driveInCount: number;
  windowCount: number;
  windowAreaM2: number;
  officeWindowCount: number;
  officeWindowAreaM2: number;
  hallWindowCount: number;
  hallWindowAreaM2: number;
  openingCount: number;
  skylightAreaM2: number;
  roofAreaM2: number;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeQuantities(config: HallConfig): Quantities {
  const { dimensions: d, openings } = config;
  // U půdorysu L se výřez odečítá; obvod obálky je u L stejný jako u obdélníku (2 · (L + W)).
  const A = footprintAreaM2(d);
  const H = totalHeightM(d.clearHeightM);
  const perimeter = 2 * (d.lengthM + d.widthM);

  const placed = placeOpenings(config);
  const problems = findOpeningProblems(d, placed);
  if (problems.length > 0) {
    // Množství nad neplatným rozmístěním by bylo zavádějící. Validace (rules) má kolizi zachytit dřív.
    throw new Error(`Otvory nelze platně rozmístit: ${problems[0]!.reason}`);
  }
  const officeWindows = placed.filter((o) => o.kind === "window");
  const hallWindows = placed.filter((o) => o.kind === "hallWindow");
  const windows = [...officeWindows, ...hallWindows];
  const windowArea = windows.reduce((s, o) => s + o.widthM * o.heightM, 0);
  const dockArea = openings.dockCount * G.dock.widthM * G.dock.heightM;
  const driveInArea = openings.driveInCount * G.driveIn.widthM * G.driveIn.heightM;
  // Vstup do administrativy je ilustrativní prvek: do množství ani ceny nevstupuje (stejně jako zábradlí a čísla vrat).
  const openingsArea = dockArea + driveInArea + windowArea;
  const gross = perimeter * H;

  const office = officeLayout(config);
  const officeFootprint = office ? office.perFloorAreaM2 : 0;
  const officeFloorArea = office ? office.perFloorAreaM2 * office.floors : 0;

  // Zóna doků (5 % místo 2 % plochy světlíků) existuje jen tehdy, jsou-li v hale doky.
  const dockZone = openings.dockCount > 0 ? Math.min(A, d.lengthM * G.skylight.dockZoneDepthM) : 0;
  const skylight = config.daylight === "facade" ? 0 : G.skylight.baseShare * (A - dockZone) + G.skylight.dockZoneShare * dockZone;

  return {
    lengthM: d.lengthM,
    widthM: d.widthM,
    clearHeightM: d.clearHeightM,
    totalHeightM: H,
    perimeterM: round2(perimeter),
    footprintAreaM2: round2(A),
    officeFootprintM2: round2(officeFootprint),
    officeFloorAreaM2: round2(officeFloorArea),
    hallGroundAreaM2: round2(A - officeFootprint),
    totalFloorAreaM2: round2(A + (officeFloorArea - officeFootprint)),
    grossFacadeAreaM2: round2(gross),
    openingsAreaM2: round2(openingsArea),
    netFacadeAreaM2: round2(Math.max(0, gross - openingsArea)),
    dockCount: openings.dockCount,
    driveInCount: openings.driveInCount,
    windowCount: windows.length,
    windowAreaM2: round2(windowArea),
    officeWindowCount: officeWindows.length,
    officeWindowAreaM2: round2(officeWindows.reduce((s, o) => s + o.widthM * o.heightM, 0)),
    hallWindowCount: hallWindows.length,
    hallWindowAreaM2: round2(hallWindows.reduce((s, o) => s + o.widthM * o.heightM, 0)),
    openingCount: openings.dockCount + openings.driveInCount + windows.length,
    skylightAreaM2: round2(skylight),
    roofAreaM2: round2(A - skylight),
  };
}
