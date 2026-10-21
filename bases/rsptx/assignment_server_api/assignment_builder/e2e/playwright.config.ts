import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

const E2E_TARGET = process.env.E2E_TARGET ?? "vite";
const IS_DOCKER = E2E_TARGET === "docker";
const IS_CI_A11Y = process.env.CI_A11Y === "true";

export const AUTH_FILE = path.join(e2eDir, ".auth/user.json");
export const APP_URL = IS_DOCKER ? "http://localhost" : "http://localhost:5173";
export const BACKEND_URL = IS_CI_A11Y
  ? APP_URL
  : IS_DOCKER
    ? "http://localhost"
    : "http://localhost:80";
export const APP_BASE = IS_DOCKER ? "/assignment/instructor" : "";

export default defineConfig({
  testDir: e2eDir,
  outputDir: path.join(e2eDir, "test-results"),
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: path.join(e2eDir, "playwright-report") }]
  ],
  webServer: IS_CI_A11Y
    ? {
        command: "npm start -- --host 127.0.0.1",
        url: APP_URL,
        reuseExistingServer: false,
        timeout: 120_000
      }
    : undefined,
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /global\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE
      }
    }
  ]
});
