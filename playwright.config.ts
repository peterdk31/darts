import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — covers the four required breakpoints per Constitution
 * Principle III on Chromium only. Iteration 4 / Final scope: smoke test US1's
 * golden path (team setup → game select → 501 → tap → win).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "phone-narrow",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 } },
    },
    {
      name: "phone-wide",
      use: { ...devices["iPhone 13"], viewport: { width: 430, height: 932 } },
    },
    {
      name: "tablet-foldable",
      use: { ...devices["Desktop Chrome"], viewport: { width: 800, height: 720 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
