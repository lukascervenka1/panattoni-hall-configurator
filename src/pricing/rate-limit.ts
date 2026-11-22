/**
 * Jednoduchý limit počtu požadavků v posuvném okně. Pamatuje si stav v paměti jedné instance.
 *
 * OMEZENÍ: na serverless platformě (Vercel) má každá instance vlastní paměť, takže tento limit je jen
 * první vrstva ochrany. Před produkcí je třeba sdílený limit (např. přes platformní WAF / Redis); viz docs/OPERATIONS.md.
 */
export interface RateLimiter {
  check(key: string, now?: number): { allowed: boolean; retryAfterSec: number };
}

export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  const maxKeys = opts.maxKeys ?? 10_000;
  return {
    check(key, now = Date.now()) {
      const windowStart = now - opts.windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
      if (recent.length >= opts.limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? now;
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        // Ochrana paměti: vyhoď nejstarší klíče.
        for (const k of hits.keys()) {
          hits.delete(k);
          if (hits.size <= maxKeys * 0.9) break;
        }
      }
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}
