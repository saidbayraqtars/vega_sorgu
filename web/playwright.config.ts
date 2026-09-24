import { defineConfig, devices } from "@playwright/test";

// Demo sunucuya karşı çalışır: cd ../cloud && npm run demo && npm start (arayüz: npm run build)
const BASE = process.env.VB_URL || "http://localhost:8080";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "kurulum", testMatch: /kurulum\.ts/ },
    {
      name: "masaustu",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "test-results/.oturum.json" },
      dependencies: ["kurulum"],
    },
  ],
});
