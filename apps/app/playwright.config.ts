import { defineConfig, devices } from "@playwright/test";

const TEST_APP_PORT = 42173;
const TEST_APP_ORIGIN = `http://127.0.0.1:${TEST_APP_PORT}`;

const chromeOptions = {
  ...devices["Desktop Chrome"],
  launchOptions: {
    executablePath:
      process.env.CI || process.env.PLAYWRIGHT_CHROME_PATH
        ? undefined
        : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  },
};

export default defineConfig({
  testDir: "tests",
  testMatch: /(.+\.)?(test|spec)\.[jt]s/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: TEST_APP_ORIGIN,
    trace: "on-first-retry",
  },
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: chromeOptions,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: chromeOptions,
    },
  ],
});
