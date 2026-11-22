import { describe, expect, it } from "vitest";
import { configFor } from "@/tests/helpers";
import { createRateLimiter } from "@/pricing/rate-limit";
import { createInquiryAdapter } from "./adapters";
import { toDataverseLead, LEAD_DESCRIPTION_MAX } from "./adapters/crm-mapping";
import { createDynamics365Adapter } from "./adapters/dynamics365";
import { createMockAdapter } from "./adapters/mock";
import type { InquiryAdapter, SubmitResult } from "./adapters/types";
import { handleInquiryRequest, type InquiryDeps } from "./handler";
import { buildInquiryRecord, describeInquiry } from "./record";
import { CONSENT_TEXT_VERSION, InquiryInputSchema } from "./schema";
import { getCatalogVersion } from "@/catalog/server";
import { computePrice } from "@/pricing/calculate";

const ID = "3f2b8c1e-5a6d-4f0e-9c1a-7b2d4e6f8a10";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    submissionId: ID,
    intent: "order",
    contact: { company: "Příklad s.r.o.", name: "Jana Nováková", email: "jana@priklad.cz", phone: "+420 777 123 456" },
    note: "Potřebujeme halu do konce roku.",
    consent: { accepted: true, textVersion: CONSENT_TEXT_VERSION },
    config: configFor("logistics"),
    ...overrides,
  };
}

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/inquiry", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

function deps(adapter: InquiryAdapter, limit = 100): InquiryDeps & { calls: () => number } {
  let calls = 0;
  const counted: InquiryAdapter = { ...adapter, submit: async (r) => { calls++; return adapter.submit(r); } };
  return { adapter: () => counted, limiter: createRateLimiter({ limit, windowMs: 60_000 }), now: () => new Date("2026-11-21T10:00:00Z"), results: new Map(), calls: () => calls };
}

describe("poptávka: validace", () => {
  it("přijme platný vstup a odmítne chybný e-mail, chybějící souhlas a příliš krátké jméno", () => {
    expect(InquiryInputSchema.safeParse(payload()).success).toBe(true);
    expect(InquiryInputSchema.safeParse(payload({ contact: { company: "A", name: "Jana Nováková", email: "ne-email" } })).success).toBe(false);
    expect(InquiryInputSchema.safeParse(payload({ consent: { accepted: false, textVersion: "x" } })).success).toBe(false);
    expect(InquiryInputSchema.safeParse(payload({ contact: { company: "A", name: "J", email: "a@b.cz" } })).success).toBe(false);
    expect(InquiryInputSchema.safeParse(payload({ submissionId: "neni-uuid" })).success).toBe(false);
  });
  it("očistí řídicí znaky a ořízne mezery; prázdný telefon se vynechá", () => {
    const p = InquiryInputSchema.parse(payload({ contact: { company: " Firma\u0007 ", name: "  Jan Novák ", email: "j@n.cz", phone: "" } }));
    expect(p.contact.company).toBe("Firma");
    expect(p.contact.name).toBe("Jan Novák");
    expect(p.contact.phone).toBeUndefined();
  });
});

describe("poptávka: obsluha /api/inquiry", () => {
  it("platná poptávka projde mock adaptérem a odpověď říká, že jde o demo", async () => {
    const d = deps(createMockAdapter());
    const res = await handleInquiryRequest(req(payload()), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "accepted", mock: true, reference: "DEMO-3F2B8C1E" });
    expect(d.calls()).toBe(1);
  });

  it("cenu a množství si server přepočítá; podvržená pole z klienta se neberou", async () => {
    const seen: string[] = [];
    const spy: InquiryAdapter = { name: "spy", mock: true, submit: async (r) => { seen.push(JSON.stringify(r)); return { status: "accepted", reference: "X", mock: true }; } };
    const res = await handleInquiryRequest(req(payload({ price: { subtotalCents: 1 }, quantities: { footprintAreaM2: 1 } })), deps(spy));
    expect(res.status).toBe(200);
    const record = JSON.parse(seen[0]!);
    const catalog = getCatalogVersion(configFor().catalogVersionId)!;
    const real = computePrice(configFor("logistics"), catalog);
    expect(real.status).toBe("ok");
    expect(record.price.subtotalCents).toBe((real as { subtotalCents: number }).subtotalCents);
    expect(record.price.subtotalCents).not.toBe(1);
  });

  it("opakované odeslání téhož formuláře nevytvoří duplicitu", async () => {
    const d = deps(createMockAdapter());
    const a = await handleInquiryRequest(req(payload()), d);
    const b = await handleInquiryRequest(req(payload()), d);
    expect(a.status).toBe(200);
    expect(await b.json()).toMatchObject({ status: "accepted", duplicate: true });
    expect(d.calls()).toBe(1);
  });

  it("past na boty: vyplněné skryté pole nic neodešle", async () => {
    const d = deps(createMockAdapter());
    const res = await handleInquiryRequest(req(payload({ website: "http://spam.example" })), d);
    expect(res.status).toBe(200);
    expect(d.calls()).toBe(0);
  });

  it("neplatné vstupy: 400 jen s názvy polí, nikdy s hodnotami; neplatná konfigurace 400/422; neznámý katalog 409", async () => {
    const d = deps(createMockAdapter());
    const bad = await handleInquiryRequest(req(payload({ contact: { company: "A", name: "Jana Nováková", email: "tajny@neni" } })), d);
    expect(bad.status).toBe(400);
    const text = JSON.stringify(await bad.json());
    expect(text).toContain("contact");
    expect(text).not.toContain("tajny@neni");
    expect((await handleInquiryRequest(req("{nejson"), d)).status).toBe(400);
    expect((await handleInquiryRequest(req(payload({ config: { nonsense: true } })), d)).status).toBe(400);
    expect((await handleInquiryRequest(req(payload({ config: { ...configFor(), catalogVersionId: "neexistuje" } })), d)).status).toBe(409);
    const tooLong = payload({ note: "x".repeat(2000) });
    expect((await handleInquiryRequest(req(tooLong), d)).status).toBe(400);
    expect((await handleInquiryRequest(req("x".repeat(30_000)), d)).status).toBe(413);
    expect(d.calls()).toBe(0);
  });

  it("limit počtu požadavků", async () => {
    const d = deps(createMockAdapter(), 2);
    await handleInquiryRequest(req(payload({ submissionId: "11111111-1111-4111-8111-111111111111" })), d);
    await handleInquiryRequest(req(payload({ submissionId: "22222222-2222-4222-8222-222222222222" })), d);
    const res = await handleInquiryRequest(req(payload({ submissionId: "33333333-3333-4333-8333-333333333333" })), d);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("chyba adaptéru: 502 s kódem, bez osobních údajů, a opakování smí projít", async () => {
    let attempts = 0;
    const flaky: InquiryAdapter = { name: "flaky", mock: false, submit: async (): Promise<SubmitResult> => (++attempts === 1 ? { status: "failed", retryable: true, reason: "crm_http_503" } : { status: "accepted", reference: "OK-1", mock: false }) };
    const d = deps(flaky);
    const first = await handleInquiryRequest(req(payload()), d);
    expect(first.status).toBe(502);
    const body = JSON.stringify(await first.json());
    expect(body).toContain("crm_http_503");
    expect(body).not.toContain("jana@priklad.cz");
    const second = await handleInquiryRequest(req(payload()), d);
    expect(await second.json()).toMatchObject({ status: "accepted", reference: "OK-1", mock: false });
  });

  it("nezprovozněné odesílání: 503 a nic se neodešle", async () => {
    const res = await handleInquiryRequest(req(payload()), deps(createInquiryAdapter({ INQUIRY_ADAPTER: "dynamics365" })));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "unavailable", reason: "real_send_not_approved" });
  });
});

describe("záznam a mapování na lead", () => {
  const catalog = getCatalogVersion(configFor().catalogVersionId)!;
  const input = InquiryInputSchema.parse(payload());
  const price = computePrice(input.config, catalog);
  if (price.status !== "ok") throw new Error("test");
  const record = buildInquiryRecord(input, catalog, price, new Date("2026-11-21T10:00:00Z"));

  it("popis obsahuje zájem, souhrn, cenu s výhradami a upozornění demo katalogu, ale ne jednotkové sazby", () => {
    const text = describeInquiry(record);
    expect(text).toContain("Zájem:");
    expect(text).toContain("Rozměry obálky");
    expect(text).toContain("bez DPH");
    expect(text).toContain("POZOR");
    expect(text).toContain(ID);
    expect(text).not.toMatch(/unitRate|sazba/i);
  });

  it("lead používá standardní pole, rozdělí jméno a respektuje limit popisu", () => {
    const lead = toDataverseLead(record);
    expect(lead).toMatchObject({ firstname: "Jana", lastname: "Nováková", companyname: "Příklad s.r.o.", emailaddress1: "jana@priklad.cz", telephone1: "+420 777 123 456" });
    expect(Object.keys(lead).sort()).toEqual(["companyname", "description", "emailaddress1", "firstname", "lastname", "subject", "telephone1"]);
    expect(lead.description!.length).toBeLessThanOrEqual(LEAD_DESCRIPTION_MAX);
    const long = toDataverseLead({ ...record, note: "x".repeat(1500), summaryLines: Array.from({ length: 80 }, (_, i) => `řádek ${i} ${"y".repeat(60)}`) });
    expect(long.description!.length).toBeLessThanOrEqual(LEAD_DESCRIPTION_MAX);
    expect(toDataverseLead({ ...record, contact: { ...record.contact, name: "Cher", phone: undefined } })).not.toHaveProperty("firstname");
  });

  it("vlastní pole se přidají jen když jsou jejich názvy zadané", () => {
    const lead = toDataverseLead(record, { configJson: "new_configjson", submissionId: "new_submissionid" });
    expect(lead.new_submissionid).toBe(ID);
    expect(JSON.parse(lead.new_configjson!)).toMatchObject({ productId: record.config.productId });
    expect(lead).not.toHaveProperty("new_intent");
  });
});

describe("adaptér Dynamics 365 (zkouška s falešným fetch)", () => {
  const catalog = getCatalogVersion(configFor().catalogVersionId)!;
  const input = InquiryInputSchema.parse(payload());
  const price = computePrice(input.config, catalog);
  if (price.status !== "ok") throw new Error("test");
  const record = buildInquiryRecord(input, catalog, price, new Date("2026-11-21T10:00:00Z"));
  const options = { orgUrl: "https://org.crm4.dynamics.com/", tenantId: "tenant-1", clientId: "client-1", clientSecret: "secret-1" };

  function fakeFetch(handlers: Array<(url: string, init: RequestInit) => Response>) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const f = (async (url: string | URL | Request, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      const h = handlers.shift();
      if (!h) throw new Error("neočekávané volání");
      return h(String(url), init);
    }) as typeof fetch;
    return { f, calls };
  }
  const tokenOk = () => new Response(JSON.stringify({ access_token: "tok-1", expires_in: 3600 }), { status: 200 });
  const created = () => new Response(null, { status: 204, headers: { "odata-entityid": "https://org.crm4.dynamics.com/api/data/v9.2/leads(a1b2c3d4-0000-4000-8000-000000000001)" } });

  it("získá token, vytvoří lead se standardními poli a vrátí GUID záznamu; token se znovu použije", async () => {
    const { f, calls } = fakeFetch([tokenOk, created, created]);
    const adapter = createDynamics365Adapter({ ...options, fetch: f });
    const a = await adapter.submit(record);
    expect(a).toEqual({ status: "accepted", reference: "a1b2c3d4-0000-4000-8000-000000000001", mock: false });
    expect(calls[0]!.url).toBe("https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token");
    expect(String(calls[0]!.init.body)).toContain("scope=https%3A%2F%2Forg.crm4.dynamics.com%2F.default");
    expect(calls[1]!.url).toBe("https://org.crm4.dynamics.com/api/data/v9.2/leads");
    expect((calls[1]!.init.headers as Record<string, string>).authorization).toBe("Bearer tok-1");
    expect(JSON.parse(String(calls[1]!.init.body))).toMatchObject({ emailaddress1: "jana@priklad.cz", companyname: "Příklad s.r.o." });
    await adapter.submit(record);
    expect(calls).toHaveLength(3); // druhé odeslání nežádá nový token
  });

  it("chyby nesou jen kód a žádné údaje z poptávky; 401 zahodí token, 5xx je opakovatelné, 400 ne", async () => {
    const { f } = fakeFetch([tokenOk, () => new Response("Neplatný e-mail jana@priklad.cz", { status: 400 }), () => new Response("", { status: 503 }), () => new Response("", { status: 401 }), tokenOk, created]);
    const adapter = createDynamics365Adapter({ ...options, fetch: f });
    const bad = await adapter.submit(record);
    expect(bad).toEqual({ status: "failed", retryable: false, reason: "crm_http_400" });
    expect(JSON.stringify(bad)).not.toContain("jana@");
    expect(await adapter.submit(record)).toEqual({ status: "failed", retryable: true, reason: "crm_http_503" });
    expect(await adapter.submit(record)).toEqual({ status: "failed", retryable: true, reason: "crm_http_401" });
    expect(await adapter.submit(record)).toMatchObject({ status: "accepted" }); // po 401 si vyžádal nový token
  });

  it("selhání tokenu a sítě", async () => {
    const t = createDynamics365Adapter({ ...options, fetch: fakeFetch([() => new Response("", { status: 401 })]).f });
    expect(await t.submit(record)).toEqual({ status: "failed", retryable: false, reason: "token_http_401" });
    const n = createDynamics365Adapter({ ...options, fetch: (async () => { throw new Error("síť"); }) as typeof fetch });
    expect(await n.submit(record)).toEqual({ status: "failed", retryable: true, reason: "token_network" });
  });
});

describe("výběr adaptéru z prostředí", () => {
  it("výchozí je mock", () => {
    expect(createInquiryAdapter({})).toMatchObject({ name: "mock", mock: true });
  });
  it("ostrý adaptér bez výslovného schválení nebo nastavení nic neodešle a netváří se jako mock", async () => {
    const record = buildInquiryRecord(InquiryInputSchema.parse(payload()), getCatalogVersion(configFor().catalogVersionId)!, computePrice(configFor("logistics"), getCatalogVersion(configFor().catalogVersionId)!) as never, new Date());
    const unapproved = createInquiryAdapter({ INQUIRY_ADAPTER: "dynamics365", DYNAMICS_ORG_URL: "https://o", DYNAMICS_TENANT_ID: "t", DYNAMICS_CLIENT_ID: "c", DYNAMICS_CLIENT_SECRET: "s" });
    expect(unapproved.mock).toBe(false);
    expect(await unapproved.submit(record)).toMatchObject({ reason: "real_send_not_approved" });
    const unconfigured = createInquiryAdapter({ INQUIRY_ADAPTER: "dynamics365", INQUIRY_REAL_SEND_APPROVED: "yes" });
    expect(await unconfigured.submit(record)).toMatchObject({ reason: "adapter_not_configured" });
    expect(await createInquiryAdapter({ INQUIRY_ADAPTER: "bluehub" }).submit(record)).toMatchObject({ reason: "unknown_adapter" });
    const approved = createInquiryAdapter({ INQUIRY_ADAPTER: "dynamics365", INQUIRY_REAL_SEND_APPROVED: "yes", DYNAMICS_ORG_URL: "https://o", DYNAMICS_TENANT_ID: "t", DYNAMICS_CLIENT_ID: "c", DYNAMICS_CLIENT_SECRET: "s" });
    expect(approved).toMatchObject({ name: "dynamics365", mock: false });
  });
});
