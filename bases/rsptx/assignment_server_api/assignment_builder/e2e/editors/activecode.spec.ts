import { Page } from "@playwright/test";

import { openCreateEditor, selectEditorLanguage } from "../fixtures/editors";
import { expect, test } from "../fixtures/scratch";

const DATAFILE_API = "/assignment/instructor/datafile";

const openDataFilesStep = async (page: Page, assignmentName: string): Promise<void> => {
  await openCreateEditor(page, assignmentName, /Active Code/i);
  await selectEditorLanguage(page, "Select programming language");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Data files" })).toBeVisible();
};

test(
  "data file create, edit, and delete round-trip with confirm",
  { tag: ["@p1", "@exercises", "@editor-activecode"] },
  async ({ page, scratchAssignment }, testInfo) => {
    await openDataFilesStep(page, scratchAssignment.name);

    const filename = `e2e-df-${testInfo.workerIndex}-${Date.now().toString(36)}.txt`;

    await page.getByRole("button", { name: "Create data file" }).click();
    await expect(page.getByRole("dialog", { name: "Create data file" })).toBeVisible();
    await page.getByRole("textbox", { name: /Filename/ }).fill(filename);
    await page.getByRole("textbox", { name: "File content" }).fill("alpha");

    const createResponse = page.waitForResponse(
      (response) => response.url().includes(DATAFILE_API) && response.request().method() === "POST"
    );

    await page.getByRole("button", { name: "Create", exact: true }).click();

    expect((await createResponse).ok()).toBe(true);
    await expect(page.getByText("Data file created")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Create data file" })).not.toBeVisible();
    await expect(page.getByText(filename).first()).toBeVisible();

    await page.getByRole("button", { name: "Edit data file" }).click();
    await expect(page.getByRole("dialog", { name: "Edit data file" })).toBeVisible();

    const contentInput = page.getByRole("textbox", { name: "File content" });

    await expect(contentInput).toHaveValue("alpha");
    await contentInput.fill("alpha beta");

    const updateResponse = page.waitForResponse(
      (response) => response.url().includes(DATAFILE_API) && response.request().method() === "PUT"
    );

    await page.getByRole("button", { name: "Save", exact: true }).click();

    expect((await updateResponse).ok()).toBe(true);
    await expect(page.getByText("Data file updated")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Edit data file" })).not.toBeVisible();

    await page.getByRole("button", { name: "Delete data file" }).click();

    const confirmDialog = page.getByRole("dialog", { name: "Delete data file" });

    await expect(confirmDialog).toBeVisible();
    await expect(
      confirmDialog.getByText(`Delete "${filename}"? This can't be undone.`)
    ).toBeVisible();

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes(DATAFILE_API) && response.request().method() === "DELETE"
    );

    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();

    expect((await deleteResponse).ok()).toBe(true);
    await expect(page.getByText("Data file deleted")).toBeVisible();
    await expect(page.getByText(filename)).toHaveCount(0);
  }
);

test.describe("editor stepper at 360", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test(
    "all nine ActiveCode steps stay reachable without horizontal scroll",
    { tag: ["@p2", "@responsive", "@editor-activecode"] },
    async ({ page, scratchAssignment }) => {
      await openCreateEditor(page, scratchAssignment.name, /Active Code/i);

      await expect(page.getByRole("button", { name: /Preview/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Standard input/ })).toBeVisible();

      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));

      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);

      const lastStep = page.getByRole("button", { name: /Preview/ });
      const box = await lastStep.boundingBox();

      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    }
  );
});
