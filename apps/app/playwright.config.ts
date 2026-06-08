import { defineConfig, devices } from "@playwright/test";

const TEST_APP_PORT = 42173;
const TEST_APP_ORIGIN = `http://127.0.0.1:${TEST_APP_PORT}`;

export default defineConfig({
  testDir: "tests",
  testMatch: /(.+\.)?(test|spec)\.[jt]s/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: TEST_APP_ORIGIN,
    trace: "on-first-retry",
  },
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
