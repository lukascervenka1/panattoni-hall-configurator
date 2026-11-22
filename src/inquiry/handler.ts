import "server-only";
/**
 * Obsluha POST /api/inquiry (spec kap. 13). Oddělená od route souboru kvůli testovatelnosti.
 *
 * Tok: omezení počtu požadavků → limit velikosti → validace (Zod) → past na boty → ověření verze katalogu →
 * SERVEROVÝ přepočet ceny (klient žádnou cenu neposílá) → záznam pro CRM → idempotence → adaptér.
 * Do logů se nezapisují osobní údaje, konfigurace ani cena; chyby nesou jen kód.
 */
import { getCatalogVersion } from "@/catalog/server";
import { computePrice } from "@/pricing/calculate";
import { createRateLimiter, type RateLimiter } from "@/pricing/rate-limit";
import { createInquiryAdapter, type InquiryAdapter, type SubmitResult } from "./adapters";
import { buildInquiryRecord } from "./record";
import { InquiryInputSchema } from "./schema";

const MAX_BODY_BYTES = 20 * 1024;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_MAX = 2000;

export interface InquiryDeps {
  adapter: () => InquiryAdapter;
  limiter: RateLimiter;
  now: () => Date;
  /** Výsledky podle identifikátoru odeslání. V paměti jedné instance: před produkcí nahradit sdíleným úložištěm. */
  results: Map<string, { at: number; promise: Promise<SubmitResult> }>;
}

let defaultAdapter: InquiryAdapter | null = null;
const defaults: InquiryDeps = {
  adapter: () => (defaultAdapter ??= createInquiryAdapter()),
  limiter: createRateLimiter({ limit: 5, windowMs: 60_000 }),
  now: () => new Date(),
  results: new Map(),
};

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

const UNAVAILABLE = new Set(["real_send_not_approved", "adapter_not_configured", "unknown_adapter"]);

export async function handleInquiryRequest(request: Request, deps: InquiryDeps = defaults): Promise<Response> {
  const rl = deps.limiter.check(clientKey(request));
  if (!rl.allowed) {
    return json({ error: "rate_limited", message_cs: "Příliš mnoho pokusů. Zkuste to za chvíli." }, 429, { "retry-after": String(rl.retryAfterSec) });
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

  // Past na boty: vyplněné skryté pole. Tváříme se, že vše proběhlo, a nic neodesíláme.
  const honeypot = (body as { website?: unknown } | null)?.website;
  if (typeof honeypot === "string" && honeypot.trim() !== "") return json({ status: "accepted", reference: "IGNORED", mock: true });

  const parsed = InquiryInputSchema.safeParse(body);
  if (!parsed.success) {
    // Vracíme jen názvy polí, ne zadané hodnoty.
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.slice(0, 2).join(".")))];
    return json({ error: "invalid_input", message_cs: "Zkontrolujte vyplněné údaje.", fields }, 400);
  }
  const input = parsed.data;

  const catalog = getCatalogVersion(input.config.catalogVersionId);
  if (!catalog) {
    return json({ error: "unknown_catalog_version", message_cs: "Konfigurace patří verzi katalogu, která už není dostupná. Znovu ji nastavte v aktuální verzi." }, 409);
  }
  let price;
  try {
    price = computePrice(input.config, catalog);
  } catch {
    return json({ error: "pricing_failed", message_cs: "Konfiguraci se nepodařilo ověřit." }, 500);
  }
  if (price.status === "invalid") return json({ error: "invalid_configuration", message_cs: "Konfigurace porušuje pravidla katalogu." }, 422);

  const adapter = deps.adapter();
  const now = deps.now();
  const nowMs = now.getTime();
  for (const [id, entry] of deps.results) if (nowMs - entry.at > IDEMPOTENCY_TTL_MS) deps.results.delete(id);
  if (deps.results.size > IDEMPOTENCY_MAX) deps.results.clear();

  const existing = deps.results.get(input.submissionId);
  const duplicate = Boolean(existing);
  const pending = existing?.promise ?? adapter.submit(buildInquiryRecord(input, catalog, price, now));
  if (!existing) deps.results.set(input.submissionId, { at: nowMs, promise: pending });

  let result: SubmitResult;
  try {
    result = await pending;
  } catch {
    result = { status: "failed", retryable: true, reason: "adapter_exception" };
  }
  if (result.status === "failed") {
    deps.results.delete(input.submissionId); // neúspěch se nepamatuje: opakování smí projít
    if (UNAVAILABLE.has(result.reason)) {
      return json({ error: "unavailable", message_cs: "Odesílání poptávek zatím není zprovozněno. Údaje nebyly odeslány.", reason: result.reason }, 503);
    }
    return json({ error: "upstream_failed", retryable: result.retryable, message_cs: "Poptávku se nepodařilo odeslat. Zkuste to prosím znovu za chvíli.", reason: result.reason }, 502);
  }
  return json({ status: "accepted", reference: result.reference, mock: result.mock, ...(duplicate ? { duplicate: true } : {}) });
}
