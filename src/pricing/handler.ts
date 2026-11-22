import "server-only";
/**
 * Obsluha POST /api/price. Oddělená od Next.js route souboru kvůli testovatelnosti.
 *
 * Kontrakt: tělo `{ config }`. Cokoli dalšího (např. podvržená `price`, `quantities`) se zahodí,
 * protože se parsuje jen schéma konfigurace a množství i cenu server vždy přepočítá.
 */
import { getCatalogVersion } from "@/catalog/server";
import { parseConfig } from "@/configurator/schema/config";
import { computePrice } from "./calculate";
import { createRateLimiter, type RateLimiter } from "./rate-limit";

const MAX_BODY_BYTES = 8 * 1024;
const defaultLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || request.headers.get("x-real-ip") || "local";
}

export async function handlePriceRequest(request: Request, limiter: RateLimiter = defaultLimiter): Promise<Response> {
  const rl = limiter.check(clientKey(request));
  if (!rl.allowed) {
    return json({ error: "rate_limited", message_cs: "Příliš mnoho požadavků. Zkuste to za chvíli." }, 429, {
      "retry-after": String(rl.retryAfterSec),
    });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "too_large", message_cs: "Požadavek je příliš velký." }, 413);

  let text: string;
  try {
    text = await request.text();
  } catch {
    return json({ error: "bad_request", message_cs: "Tělo požadavku nelze přečíst." }, 400);
  }
  if (text.length > MAX_BODY_BYTES) return json({ error: "too_large", message_cs: "Požadavek je příliš velký." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "bad_request", message_cs: "Tělo požadavku není platný JSON." }, 400);
  }

  const parsed = parseConfig((body as { config?: unknown } | null)?.config);
  if (!parsed.ok) return json({ error: "invalid_config", message_cs: `Neplatná konfigurace (${parsed.error}).` }, 400);

  const catalog = getCatalogVersion(parsed.config.catalogVersionId);
  if (!catalog) {
    return json(
      { error: "unknown_catalog_version", message_cs: "Konfigurace patří verzi katalogu, která už není dostupná. Znovu ji nastavte v aktuální verzi." },
      409,
    );
  }

  let result;
  try {
    result = computePrice(parsed.config, catalog);
  } catch {
    // Chybu nelogujeme s obsahem konfigurace; nevracíme poslední známou cenu.
    return json({ error: "pricing_failed", message_cs: "Cenu se nepodařilo spočítat." }, 500);
  }
  if (result.status === "invalid") {
    return json({ error: "invalid_configuration", message_cs: "Konfigurace porušuje pravidla katalogu.", issues: result.issues }, 422);
  }
  return json(result);
}
