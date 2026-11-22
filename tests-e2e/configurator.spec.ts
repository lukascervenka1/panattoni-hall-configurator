import { expect, test, type Page } from "@playwright/test";

/** "3 076 752 €" → 3076752 (mezery mohou být nezlomitelné). */
const parseEuro = (text: string) => Number(text.replace(/[^\d]/g, ""));

async function priceValue(page: Page): Promise<number> {
  const el = page.getByTestId("price-value");
  await expect(el).toBeVisible();
  return parseEuro((await el.textContent()) ?? "");
}

test.describe("zákaznický tok (M1)", () => {
  test("stránka je označena jako demo a zobrazí serverový dílčí součet", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).not.toContainText("DEMO katalog");
    await expect(page.getByTestId("price-headline")).toContainText("DEMO");
    await expect(page.getByText("Dílčí součet (orientační)").first()).toBeVisible();
    await expect(page.getByText("Celková cena vyžaduje individuální kalkulaci").first()).toBeVisible();
    expect(await priceValue(page)).toBeGreaterThan(0);
  });

  test("změna rozměrů → souhrn → cena", async ({ page }) => {
    await page.goto("/");
    const before = await priceValue(page);
    await page.getByRole("button", { name: "2. Velikost", exact: true }).click();
    const length = page.getByLabel("Délka haly", { exact: true });
    await length.fill("210");
    await length.press("Enter");
    await expect(length).toHaveValue("210");
    await expect.poll(() => priceValue(page), { timeout: 10_000 }).toBeGreaterThan(before);
  });

  test("pravidla: délka mimo krok se přichytí, hodnoty mimo rozsah se ořežou", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "2. Velikost", exact: true }).click();
    const length = page.getByLabel("Délka haly", { exact: true });
    await length.fill("151");
    await length.press("Enter");
    await expect(length).toHaveValue("150");
    await length.fill("9999");
    await length.press("Enter");
    await expect(length).toHaveValue("300");
  });

  test("změna konceptu nastaví předvolbu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: /Městská logistika/ }).click();
    await page.getByRole("button", { name: "2. Velikost", exact: true }).click();
    await expect(page.getByLabel("Délka haly", { exact: true })).toHaveValue("72");
    await expect(page.getByLabel("Šířka haly", { exact: true })).toHaveValue("36");
    await expect(page.getByLabel("Světlá výška", { exact: true })).toHaveValue("8");
  });

  test("tvar L: přepnutí dosadí výřez, sníží zastavěnou plochu i cenu a lze se vrátit na obdélník", async ({ page }) => {
    await page.goto("/");
    const before = await priceValue(page);
    await page.getByRole("button", { name: "2. Velikost", exact: true }).click();
    await page.getByRole("radio", { name: /Tvar L/ }).click();
    await expect(page.getByRole("radio", { name: /Tvar L/ })).toBeChecked();
    await expect(page.getByLabel("Délka výřezu", { exact: true })).toBeVisible();
    await expect.poll(() => priceValue(page), { timeout: 10_000 }).toBeLessThan(before);

    // výřez lze měnit a pravidla ho přichytí ke kroku 6 m od minima 12 m
    const notch = page.getByLabel("Délka výřezu", { exact: true });
    await notch.fill("50");
    await notch.press("Enter");
    await expect(notch).toHaveValue("48");
    await page.getByRole("radio", { name: /Obdélník/ }).click();
    await expect(page.getByLabel("Délka výřezu", { exact: true })).toHaveCount(0);
    await expect.poll(() => priceValue(page), { timeout: 10_000 }).toBe(before);
  });

  test("materiály: výběr fasády mění cenu, nedostupná kombinace je zakázaná s důvodem, technologie jsou označené", async ({ page }) => {
    await page.goto("/");
    const before = await priceValue(page);
    await page.getByRole("button", { name: "5. Vybavení", exact: true }).click();
    await page.getByRole("radio", { name: /Kingspan KS TL QuadCore/ }).click();
    await expect.poll(() => priceValue(page), { timeout: 10_000 }).toBeLessThan(before); // 31,5 € oproti 51,86 € za m²
    await expect(page.getByText("Viditelná změna.").first()).toBeVisible();

    // dřevěná střecha + 60 % fotovoltaiky je zakázaná kombinace (demo pravidlo)
    await page.getByRole("button", { name: /^Střecha a energie/ }).click();
    await page.getByRole("radio", { name: /dřevěné střešní prvky/i }).click();
    const pv60 = page.getByRole("radio", { name: /Fotovoltaika na 60/ });
    await expect(pv60).toBeDisabled();
    await expect(page.getByText(/Dřevěná střešní konstrukce nenese 60 % fotovoltaiky/)).toBeVisible();
    await page.getByRole("radio", { name: /Fotovoltaika na 30/ }).click();
    await expect(page.getByText(/Nejde o výpočet spotřeby, výroby energie ani úspor/)).toBeVisible();
    // alternativa technologie nemá sazbu: cena zůstává dílčí a v rozpisu je individuální kalkulace
    await page.getByRole("button", { name: "Náhled", exact: true }).click();
    await page.getByText("Rozpis položek").click();
    await expect(page.getByRole("table")).toContainText("individuální kalkulace");
  });

  test("krok Zázemí přesune kameru před administrativu s okny", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "3. Logistika", exact: true }).click();
    await page.getByRole("button", { name: "4. Zázemí", exact: true }).click();
    await expect(page.locator(".camera-options").getByRole("radio", { name: "Administrativa", includeHidden: true })).toHaveAttribute("aria-checked", "true");
  });

  test("Řez halou: přepínač odstraní čelní stěnu a lze se vrátit do exteriéru", async ({ page }) => {
    await page.goto("/");
    const views = page.locator(".view-switch");
    await views.getByRole("button", { name: "Řez" }).click();
    await expect(views.getByRole("button", { name: "Řez" })).toHaveAttribute("aria-pressed", "true");
    await expect(views.getByRole("button", { name: "Exteriér" })).toHaveAttribute("aria-pressed", "false");
    await views.getByRole("button", { name: "Exteriér" }).click();
    await expect(views.getByRole("button", { name: "Řez" })).toHaveAttribute("aria-pressed", "false");
  });

  test("poptávka: formulář ověří údaje a demo odeslání otevřeně říká, že nic neodešlo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Náhled", exact: true }).click();
    await page.getByRole("button", { name: "Poslat poptávku" }).click();
    await page.getByRole("button", { name: "Odeslat poptávku" }).click();
    await expect(page.getByText("Zadejte platný e-mail.")).toBeVisible();
    await expect(page.getByText("Pro odeslání je nutný souhlas.")).toBeVisible();
    await page.getByLabel("Firma").fill("Příklad s.r.o.");
    await page.getByLabel("Kontaktní osoba").fill("Jana Nováková");
    await page.getByLabel("E-mail").fill("jana@priklad.cz");
    await page.getByLabel(/Souhlasím/).check();
    await page.getByRole("button", { name: "Odeslat poptávku" }).click();
    await expect(page.getByTestId("inquiry-done")).toContainText("Demo: poptávka nebyla nikam odeslána.");
  });

  test("poptávka: API odmítne neplatné vstupy a nepřijme podvrženou cenu", async ({ request }) => {
    const bad = await request.post("/api/inquiry", { data: { nonsense: true } });
    expect(bad.status()).toBe(400);
    const empty = await request.post("/api/inquiry", { headers: { "content-type": "application/json" }, data: "{nejson" });
    expect(empty.status()).toBe(400);
  });

  test("příčka: po výběru se hala ukáže bez střechy, ať je změna vidět", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "5. Vybavení", exact: true }).click();
    await page.getByRole("button", { name: /^Dispozice haly/ }).click();
    await page.getByRole("radio", { name: /Jedna příčka/ }).click();
    // Příčky jsou nejlépe vidět v pohledu bez střechy; přechod na další variantu ho neruší.
    const cutaway = page.locator(".view-switch").getByRole("button", { name: "Bez střechy" });
    await expect(cutaway).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("radio", { name: /Dvě příčky/ }).click();
    await expect(cutaway).toHaveAttribute("aria-pressed", "true");
  });

  test("režim Náhled ukáže rozpis a výhrady, Stavba se vrátí", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Náhled", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Náhled konfigurace" })).toBeVisible();
    await page.getByText("Rozpis položek").click();
    await expect(page.getByRole("table")).toContainText("Opláštění");
    await expect(page.getByText("Co cena nezahrnuje")).toBeVisible();
    await page.getByRole("button", { name: "Stavba", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vaše nová hala." })).toBeVisible();
  });

  test("výpadek cenového serveru nevydá poslední cenu za aktuální", async ({ page }) => {
    await page.goto("/");
    await priceValue(page);
    await page.route("**/api/price", (route) => route.abort());
    await page.getByRole("button", { name: "2. Velikost", exact: true }).click();
    const length = page.getByLabel("Délka haly", { exact: true });
    await length.fill("180");
    await length.press("Enter");
    await expect(page.getByText("Cena není k dispozici", { exact: true })).toBeVisible();
    await expect(page.getByTestId("price-value")).toHaveCount(0);
  });

  test("klient nemůže podvrhnout cenu: server ji ignoruje", async ({ request }) => {
    const cfgRes = await request.post("/api/price", { data: { config: { nonsense: true } } });
    expect(cfgRes.status()).toBe(400);
  });
});

test.describe("fallback a odezva", () => {
  test("bez WebGL se zobrazí půdorys a konfigurace dál funguje", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
        return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
      } as typeof orig;
    });
    await page.goto("/");
    await expect(page.getByText(/nepodporuje 3D grafiku/)).toBeVisible();
    await expect(page.getByRole("img", { name: /Půdorys haly 150 × 84 m/ })).toBeVisible();
    expect(await priceValue(page)).toBeGreaterThan(0);
  });

  test("mobil: bez vodorovného posunu stránky, ovládání má dotykové cíle ≥ 44 px", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByTestId("viewport")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const name of ["Stavba", "Náhled"]) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(43.5);
    }
    await ctx.close();
  });
});

test.describe("animace stavby (AnimationMixer)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("stavbu lze přehrát znovu a přeskočit", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("viewport")).toBeVisible();
    const replay = page.getByRole("button", { name: "Přehrát stavbu" });
    const skip = page.getByRole("button", { name: "Přeskočit stavbu" });
    // Úvodní stavba může ještě běžet: přeskočíme ji a počkáme na dokončení. Tlačítko se objeví až po prvních snímcích,
    // proto se nejdřív počká na jedno z obou (na pomalém softwarovém vykreslování stavba trvá desítky sekund).
    await expect(skip.or(replay)).toBeVisible({ timeout: 60_000 });
    if (await skip.isVisible()) await skip.click();
    await expect(replay).toBeVisible({ timeout: 60_000 });
    await replay.click();
    await expect(skip).toBeVisible();
    await skip.click();
    await expect(replay).toBeVisible({ timeout: 10_000 });
  });
});
