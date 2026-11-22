import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;

export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 60_000,
  fullyParallel: true,
  // Scéna je těžší a v headless Chromiu se vykresluje softwarově: méně souběžných workerů a delší limit očekávání.
  workers: 2,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    // Úspora pohybu: stavba a doprava se nepřehrávají, snímky jsou deterministické a rychlé (testuje se i tato cesta).
    reducedMotion: "reduce",
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Produkční build: testy odpovídají tomu, co poběží na Vercelu, a nezkreslují je dev kompilace.
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
