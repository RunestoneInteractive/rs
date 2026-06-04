import { APIRequestContext, Page, expect, test as base } from "@playwright/test";

import { appPath } from "./appNav";
import { assignmentRow } from "./selectors";

const RUN_ID = Date.now().toString(36);

const ASSIGNMENTS_API = "/assignment/instructor/assignments";

export interface ScratchAssignment {
  id: number;
  name: string;
}

export const scratchName = (workerIndex: number, slug: string): string =>
  `e2e-${workerIndex}-${RUN_ID}-${slug}`;

export const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

export const createAssignmentViaWizard = async (page: Page, name: string): Promise<number> => {
  await page.goto(appPath("/builder/create"));
  await page.getByRole("textbox", { name: /assignment name/i }).fill(name);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /Regular/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(ASSIGNMENTS_API) && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "Create assignment" }).click();
  const response = await responsePromise;

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: { id: number } };

  await page.waitForURL(new RegExp(`/builder/${body.detail.id}`));
  return body.detail.id;
};

export const setAssignmentVisible = async (page: Page, name: string): Promise<void> => {
  await page.goto(appPath("/builder"));
  await assignmentRow(page, name)
    .getByRole("button", { name: /Change visibility/ })
    .click();
  await page.getByRole("radio", { name: "Visible", exact: true }).click();
  await expect(page.getByText("Assignment is now visible")).toBeVisible({ timeout: 30_000 });
};

export const deleteAssignmentViaApi = async (
  request: APIRequestContext,
  id: number
): Promise<void> => {
  try {
    await request.delete(`${ASSIGNMENTS_API}/${id}`);
  } catch {
    // teardown best effort: the test may have already deleted the assignment
  }
};

export const test = base.extend<{ scratchAssignment: ScratchAssignment }>({
  scratchAssignment: async ({ page }, use, testInfo) => {
    const name = scratchName(testInfo.workerIndex, slugify(testInfo.title));
    const id = await createAssignmentViaWizard(page, name);

    try {
      await use({ id, name });
    } finally {
      await deleteAssignmentViaApi(page.request, id);
    }
  }
});

export { expect } from "@playwright/test";
