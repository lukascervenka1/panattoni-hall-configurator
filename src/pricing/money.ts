/**
 * Peníze jako celá čísla v nejmenší jednotce (centy). Žádné floating-point sčítání cen.
 *
 * Zaokrouhlení (zdokumentováno v docs/PRICING.md):
 * - množství se převede na tisíciny (zaokrouhleno na 0,001),
 * - mezisoučet řádku = jednotková sazba v centech × množství, zaokrouhleno half-up na celý cent,
 * - celkový součet = součet již zaokrouhlených řádků (bez dalšího zaokrouhlování).
 */

const DECIMAL = /^\d{1,9}(\.\d{1,2})?$/;

/** "51.86" → 5186. Jiné zápisy (čárka, mezery, znaménko, více desetinných míst) jsou chyba: nehádáme. */
export function parseDecimalToCents(value: string): number {
  if (!DECIMAL.test(value)) throw new Error(`Neplatný peněžní zápis "${value}" (očekáváno např. 51.86).`);
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function quantityToMilli(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Množství musí být konečné nezáporné číslo.");
  return Math.round(quantity * 1000);
}

/** Half-up zaokrouhlení součinu (centy × tisíciny) / 1000 přes BigInt, aby nedocházelo k přetečení přesnosti. */
export function multiplyCents(unitCents: number, quantityMilli: number): number {
  const product = BigInt(unitCents) * BigInt(quantityMilli);
  const cents = (product + 500n) / 1000n;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Částka je mimo podporovaný rozsah.");
  return Number(cents);
}

export function formatMoney(cents: number, currency: string, opts: { fractionDigits?: number; locale?: string } = {}): string {
  const digits = opts.fractionDigits ?? 0;
  return new Intl.NumberFormat(opts.locale ?? "cs-CZ", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

export function formatCentsAsDecimal(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}
