import { expect, test as setup } from "@playwright/test";

import { APP_URL, AUTH_FILE, BACKEND_URL } from "./playwright.config";

const STACK_DOWN_MESSAGE = (url: string) =>
  `Dev stack is down: ${url} is unreachable. ` +
  `(docker compose up -d at the repo root for the backend on :80, npm start in ` +
  `assignment_builder for the Vite dev server on :5173).`;

const LOGIN_URL = `${BACKEND_URL}/runestone/default/user/login`;
const E2E_USER = "testuser1";
const E2E_PASSWORD = "xxx";

setup("authenticate", async ({ page, request }) => {
  for (const url of [BACKEND_URL, APP_URL]) {
    try {
      await request.get(url, { timeout: 5_000, maxRedirects: 5 });
    } catch {
      throw new Error(STACK_DOWN_MESSAGE(url));
    }
  }

  await page.goto(LOGIN_URL);
  await page.getByLabel("Username").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Login" }).first().click();
  await expect(page.locator("body")).not.toContainText("Invalid login");
  await page.waitForURL((url) => !url.pathname.includes("/user/login"));

  await page.context().storageState({ path: AUTH_FILE });
});
