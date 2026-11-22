/** Formátování čísel pro češtinu. Připraveno na pozdější angličtinu: locale se předává jedním místem. */
export const LOCALE = "cs-CZ";

export function fmtNum(n: number, maxFractionDigits = 0): string {
  return n.toLocaleString(LOCALE, { maximumFractionDigits: maxFractionDigits, minimumFractionDigits: 0 });
}

export function fmtM(n: number, digits = 1): string {
  return `${fmtNum(n, digits)} m`;
}

export function fmtM2(n: number): string {
  return `${fmtNum(n)} m²`;
}

export const UNIT_LABEL_CS: Record<string, string> = {
  m2: "m²",
  m: "m",
  piece: "ks",
  flat: "paušál",
};
