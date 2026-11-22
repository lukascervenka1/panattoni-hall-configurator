/**
 * DEMO geometrické předpoklady. Nejde o schválené standardy Panattoni (spec kap. 3).
 * Hodnoty vycházejí z konvencí zdrojového HTML katalogu (okna 1,5×1,5 m po 3 m, vrata 3×3 m a 4×5 m,
 * zóna doků 24 m, světlíky 2 % / 5 %) a jsou zdokumentované v docs/GEOMETRY.md.
 */
export const DEMO_GEOMETRY = {
  /** Zjednodušený převod: celková výška = světlá vnitřní výška + tato hodnota (střešní skladba a atika). */
  roofStructureAllowanceM: 2.0,
  wallThicknessM: 0.3,
  dock: {
    widthM: 3,
    heightM: 3,
    /** Výška prahu nakládacího vrat nad terénem (úroveň korby návěsu). */
    sillM: 1.2,
    /** Nejmenší osová vzdálenost sousedních doků (šířka vrat + 1,5 m). */
    minPitchM: 4.5,
    preferredPitchM: 6,
    /** Volný úsek fasády od rohu k prvnímu otvoru. */
    endMarginM: 6,
  },
  driveIn: {
    widthM: 4,
    heightM: 5,
    minPitchM: 6.5,
    preferredPitchM: 9,
    endMarginM: 6,
  },
  /** Vstup do administrativy: prosklené dvoukřídlé dveře s nadsvětlíkem vedle administrativy (podle fotografií z katalogu). */
  entrance: {
    widthM: 2.4,
    heightM: 2.5,
    /** Odstup středu vstupu od konce administrativy. */
    offsetM: 2.5,
  },
  window: {
    widthM: 1.5,
    heightM: 1.5,
    pitchM: 3,
    /** Výška parapetu nad podlahou daného podlaží administrativy. */
    sillM: 0.9,
  },
  office: {
    depthM: 12,
    floorHeightM: 3.5,
    minPerFloorWidthM: 6,
    /** Nejdelší délka administrativy podél fasády jako podíl délky haly. */
    maxShareOfLength: 0.4,
    /** Zbývající hloubka haly za administrativou. */
    minRemainingHallDepthM: 12,
    /** Rezerva mezi stropem administrativy a světlou výškou haly. */
    headroomM: 0.5,
  },
  skylight: {
    baseShare: 0.02,
    dockZoneShare: 0.05,
    dockZoneDepthM: 24,
  },
  /** Půdorys L: výřez v pravém předním rohu. Ramena haly musí zůstat dost široká. */
  notch: {
    minM: 12,
    minArmM: 24,
    defaultShareLength: 0.3,
    defaultShareWidth: 0.4,
  },
  /** Orientační rastr sloupů: rozpon vazníků max. 24 m napříč a osová vzdálenost 12 m podélně. */
  columnGrid: {
    maxSpanAcrossM: 24,
    pitchAlongM: 12,
  },
} as const;

/** Orientace fasád: délka L je podél osy x, šířka W podél osy z. "front" je fasáda s administrativou (+z), "rear" s doky (-z). U půdorysu L přibývají vnitřní stěny výřezu: "notchA" (směřuje +z) a "notchB" (směřuje +x). */
export const FACADE_IDS = ["front", "rear", "left", "right", "notchA", "notchB"] as const;
