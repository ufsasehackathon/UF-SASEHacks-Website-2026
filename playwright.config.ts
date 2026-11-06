import { defineConfig, devices } from "@playwright/test";
import { loadTestEnv } from "./tests/setup/env";

// Browser tests against `next dev` + the local Supabase stack (`npx supabase start`).
// Two servers: flags on (port 3100) for almost everything, flags off (3101) for the pre-launch state.

const env = loadTestEnv();
// Shared with the test helpers (tests/helpers/db.ts) in every worker
process.env.TEST_ENV = JSON.stringify(env);

const ON = 3100;
const OFF = 3101;

/**
 * Explicit values for everything in .env/.env.local. Next only fills in keys that aren't already
 * set (an empty string counts as set), so this keeps the real project, Resend key and FAQ doc out.
 */
function serverEnv(flags: "true" | "false", distDir: string) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: env.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey,
    NEXT_PUBLIC_LOGIN_ENABLED: flags,
    NEXT_PUBLIC_REGISTRATIONS_ENABLED: flags,
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
    EMAIL_REPLY_TO: "",
    GOOGLE_FAQ_DOC_ID: "",
    NEXT_DIST_DIR: distDir,
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // next dev compiles each route on first visit
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "app",
      testIgnore: /flags-off\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${ON}` },
    },
    {
      name: "flags-off",
      testMatch: /flags-off\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${OFF}` },
    },
  ],
  webServer: [
    {
      command: `npx next dev --turbopack -p ${ON}`,
      url: `http://localhost:${ON}`,
      env: serverEnv("true", ".next-e2e"),
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npx next dev --turbopack -p ${OFF}`,
      url: `http://localhost:${OFF}`,
      env: serverEnv("false", ".next-e2e-off"),
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
