import { describe, expect, it } from "vitest";
import { handlePriceRequest } from "./handler";
import { createRateLimiter } from "./rate-limit";
import { computePrice } from "./calculate";
import { DEMO_CATALOG } from "@/catalog/demo/build";
import { configFor, patch } from "@/tests/helpers";

const limiter = () => createRateLimiter({ limit: 1000, windowMs: 60_000 });

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/price", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/price", () => {
  it("vrátí serverovou cenu a odpověď se necachuje", async () => {
    const res = await handlePriceRequest(post({ config: configFor() }), limiter());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = await res.json();
    const direct = computePrice(configFor(), DEMO_CATALOG);
    expect(direct.status).toBe("ok");
    expect(data.subtotalCents).toBe(direct.status === "ok" ? direct.subtotalCents : -1);
  });

  it("ignoruje podvrženou cenu a množství od klienta", async () => {
    const honest = await (await handlePriceRequest(post({ config: configFor() }), limiter())).json();
    const forged = await (
      await handlePriceRequest(
        post({
          config: { ...configFor(), price: 1, subtotalCents: 1, quantities: { netFacadeAreaM2: 1 } },
          price: 1,
          subtotalCents: 1,
          lines: [],
        }),
        limiter(),
      )
    ).json();
    expect(forged.subtotalCents).toBe(honest.subtotalCents);
    expect(forged.quantities.netFacadeAreaM2).toBe(honest.quantities.netFacadeAreaM2);
  });

  it("neplatný JSON a konfigurace → 400", async () => {
    expect((await handlePriceRequest(post("{nope"), limiter())).status).toBe(400);
    expect((await handlePriceRequest(post({ config: { a: 1 } }), limiter())).status).toBe(400);
    expect((await handlePriceRequest(post({ config: patch(configFor(), { length_m: 1e9 }) }), limiter())).status).toBe(400);
  });

  it("porušení pravidel katalogu → 422 s důvody", async () => {
    const res = await handlePriceRequest(post({ config: patch(configFor(), { length_m: 12 }) }), limiter());
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.issues.length).toBeGreaterThan(0);
    expect(data.subtotalCents).toBeUndefined();
  });

  it("neznámá verze katalogu → 409, nepřepočítá se potichu", async () => {
    const res = await handlePriceRequest(post({ config: { ...configFor(), catalogVersionId: "zmizela" } }), limiter());
    expect(res.status).toBe(409);
  });

  it("příliš velké tělo → 413", async () => {
    const res = await handlePriceRequest(post({ config: configFor(), pad: "x".repeat(20_000) }), limiter());
    expect(res.status).toBe(413);
  });

  it("limit počtu požadavků → 429 s Retry-After", async () => {
    const tight = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const hdr = { "x-forwarded-for": "203.0.113.9" };
    expect((await handlePriceRequest(post({ config: configFor() }, hdr), tight)).status).toBe(200);
    expect((await handlePriceRequest(post({ config: configFor() }, hdr), tight)).status).toBe(200);
    const blocked = await handlePriceRequest(post({ config: configFor() }, hdr), tight);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    // jiný klient není dotčen
    expect((await handlePriceRequest(post({ config: configFor() }, { "x-forwarded-for": "198.51.100.1" }), tight)).status).toBe(200);
  });
});

describe("rate limiter", () => {
  it("okno se po čase uvolní", () => {
    const l = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(l.check("a", 0).allowed).toBe(true);
    expect(l.check("a", 500).allowed).toBe(false);
    expect(l.check("a", 1001).allowed).toBe(true);
  });
});
