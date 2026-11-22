/**
 * Hlídání výkonu (čistá logika bez Reactu a Three.js).
 *
 * Živé prostředí (doprava, vrata, ventilátory) vyžaduje pravidelné překreslení celé scény. Na pomalém zařízení
 * (softwarové vykreslování, slabá integrovaná grafika, přetížený počítač) snímek trvá déle než interval, smyčka
 * je pořád vytížená a každá změna v panelu se musí zařadit až za ni: rozhraní pak působí, jako by zamrzlo.
 * Hlídač proto při trvale pomalých snímcích sníží snímkovou frekvenci a rozlišení a nakonec živý provoz pozastaví.
 */

export type Quality = 0 | 1 | 2;

export interface QualityTier {
  /** Interval mezi snímky živého provozu v ms; 0 = živý provoz je pozastaven (vykresluje se jen na vyžádání). */
  liveMs: number;
  /** Horní hranice poměru pixelů (dpr). */
  dprMax: number;
}

export const QUALITY_TIERS: readonly [QualityTier, QualityTier, QualityTier] = [
  { liveMs: 1000 / 30, dprMax: 2 },
  { liveMs: 1000 / 12, dprMax: 1.25 },
  { liveMs: 0, dprMax: 1 },
];

/** Délka jednoho měřicího okna a počet po sobě jdoucích pomalých oken, které způsobí snížení kvality. */
export const WINDOW_MS = 2000;
export const SLOW_WINDOWS = 2;
/** Okno je pomalé, když je průměrný odstup snímků více než 1,8× delší než cílový interval. */
export const SLOW_FACTOR = 1.8;
/** Delší odstup než tento (skrytá karta, jednorázový zásek) se do měření nepočítá. */
export const IGNORE_GAP_MS = 1000;

export interface Governor {
  quality: Quality;
  sumMs: number;
  frames: number;
  slowWindows: number;
}

export function createGovernor(): Governor {
  return { quality: 0, sumMs: 0, frames: 0, slowWindows: 0 };
}

/** Znovu začne měřit (např. po vypnutí a zapnutí provozu), ale kvalitu ponechá. */
export function resetWindow(g: Governor): void {
  g.sumMs = 0;
  g.frames = 0;
  g.slowWindows = 0;
}

/**
 * Zapíše odstup dvou vykreslených snímků a vrátí aktuální kvalitu.
 * Kvalita se jen snižuje; obnoví ji až nové vytvoření hlídače.
 */
export function observeFrame(g: Governor, gapMs: number): Quality {
  const tier = QUALITY_TIERS[g.quality];
  if (tier.liveMs === 0 || gapMs > IGNORE_GAP_MS) return g.quality;
  g.sumMs += gapMs;
  g.frames += 1;
  if (g.sumMs < WINDOW_MS) return g.quality;
  const average = g.sumMs / g.frames;
  g.sumMs = 0;
  g.frames = 0;
  if (average > tier.liveMs * SLOW_FACTOR) {
    g.slowWindows += 1;
    if (g.slowWindows >= SLOW_WINDOWS && g.quality < 2) {
      g.quality = (g.quality + 1) as Quality;
      g.slowWindows = 0;
    }
  } else {
    g.slowWindows = 0;
  }
  return g.quality;
}

/** Poměr pixelů pro danou kvalitu: nikdy vyšší, než zvládne zařízení. */
export function dprFor(quality: Quality, devicePixelRatio: number): number {
  return Math.max(1, Math.min(devicePixelRatio, QUALITY_TIERS[quality].dprMax));
}
