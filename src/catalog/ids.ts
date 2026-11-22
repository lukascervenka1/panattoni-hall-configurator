/**
 * Sdílené identifikátory kategorií a parametrů. Záměrně bez Zod schématu katalogu, aby se do klientského bundlu
 * nedostávala struktura cenových tabulek (klient importuje jen tento malý modul).
 */
export const CATEGORY_IDS = [
  "cladding",
  "structure",
  "floor",
  "roof",
  "dock",
  "drive_in",
  "skylight",
  "window",
  // technologie a dispozice (M2): bez cen v demo seedu; standardní volba má nulovou cenu, ostatní vyžadují individuální kalkulaci
  "heating_hall",
  "heating_office",
  "lighting",
  "photovoltaics",
  "partition",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Parametry, na které se mohou odkazovat Presets a Rules. Číselné, booleovské a výběrové (= id kategorie). */
export const NUMERIC_PARAMETER_IDS = [
  "length_m",
  "width_m",
  "clear_height_m",
  "dock_count",
  "drive_in_count",
  "office_area_m2",
  "office_floors",
  "notch_length_m",
  "notch_width_m",
] as const;
export const BOOLEAN_PARAMETER_IDS = ["office_enabled"] as const;
/** Volba z pevného seznamu (tvar půdorysu): "rect" nebo "L". */
export const CHOICE_PARAMETER_IDS = ["shape", "daylight"] as const;
export const SHAPES = ["rect", "L"] as const;
export type Shape = (typeof SHAPES)[number];
export const PARAMETER_IDS = [...NUMERIC_PARAMETER_IDS, ...BOOLEAN_PARAMETER_IDS, ...CHOICE_PARAMETER_IDS, ...CATEGORY_IDS] as const;
export type NumericParameterId = (typeof NUMERIC_PARAMETER_IDS)[number];
export type BooleanParameterId = (typeof BOOLEAN_PARAMETER_IDS)[number];
export type ChoiceParameterId = (typeof CHOICE_PARAMETER_IDS)[number];
export type ParameterId = (typeof PARAMETER_IDS)[number];
