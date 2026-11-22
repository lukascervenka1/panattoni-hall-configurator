import { describe, expect, it } from "vitest";
import { QUALITY_TIERS, WINDOW_MS, createGovernor, dprFor, observeFrame, resetWindow } from "./perf";

/** Přehraje `seconds` sekund snímků s pevným odstupem a vrátí výslednou kvalitu. */
function run(g: ReturnType<typeof createGovernor>, gapMs: number, seconds: number) {
  let q = g.quality;
  for (let t = 0; t < seconds * 1000; t += gapMs) q = observeFrame(g, gapMs);
  return q;
}

describe("hlídání výkonu", () => {
  it("při plynulém provozu kvalitu nemění", () => {
    const g = createGovernor();
    expect(run(g, QUALITY_TIERS[0].liveMs + 4, 30)).toBe(0);
  });

  it("jedno pomalé okno nestačí (zásek při načítání nebo skrytá karta)", () => {
    const g = createGovernor();
    run(g, 200, WINDOW_MS / 1000 + 0.3);
    expect(g.quality).toBe(0);
    run(g, 33, 6);
    expect(g.quality).toBe(0);
    expect(g.slowWindows).toBe(0);
  });

  it("trvale pomalé snímky snižují kvalitu po stupních až na pozastavení provozu", () => {
    const g = createGovernor();
    expect(run(g, 200, 6)).toBe(1);
    expect(run(g, 400, 8)).toBe(2);
    // pozastavený provoz už nic nepočítá
    expect(run(g, 400, 8)).toBe(2);
    expect(QUALITY_TIERS[2].liveMs).toBe(0);
  });

  it("dlouhé mezery se do měření nepočítají", () => {
    const g = createGovernor();
    for (let i = 0; i < 50; i++) observeFrame(g, 5000);
    expect(g.frames).toBe(0);
    expect(g.quality).toBe(0);
  });

  it("resetWindow smaže rozpracované okno, ale ne dosaženou kvalitu", () => {
    const g = createGovernor();
    run(g, 200, 6);
    expect(g.quality).toBe(1);
    run(g, 200, 1);
    resetWindow(g);
    expect(g).toMatchObject({ quality: 1, sumMs: 0, frames: 0, slowWindows: 0 });
  });

  it("rozlišení se omezí podle kvality a nikdy neklesne pod 1", () => {
    expect(dprFor(0, 3)).toBe(2);
    expect(dprFor(0, 1)).toBe(1);
    expect(dprFor(1, 2)).toBe(1.25);
    expect(dprFor(2, 2)).toBe(1);
    expect(dprFor(2, 0.5)).toBe(1);
  });
});
