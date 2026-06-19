import { Locator, Page } from "@playwright/test";

import { openCreateEditor, selectEditorWord } from "../fixtures/editors";
import { expect, test } from "../fixtures/scratch";
import { tipTapEditors, typeIntoTipTap } from "../fixtures/selectors";

const openClickableAreaContentStep = async (
  page: Page,
  assignmentName: string
): Promise<Locator> => {
  await openCreateEditor(page, assignmentName, /Clickable/i);
  await expect(page.getByRole("heading", { name: "Create content" })).toBeVisible();
  await page.getByRole("textbox", { name: "Statement" }).fill("Click the variable assignments.");

  const editor = tipTapEditors(page).first();

  await typeIntoTipTap(editor, "alpha beta");
  return editor;
};

test(
  "marks areas through the bubble menu and removes one again",
  { tag: ["@p1", "@exercises", "@editor-clickablearea"] },
  async ({ page, scratchAssignment }) => {
    const editor = await openClickableAreaContentStep(page, scratchAssignment.name);

    await selectEditorWord(editor, "alpha");
    await page.getByRole("button", { name: "Correct", exact: true }).click();
    await expect(editor.locator("span[data-correct]")).toHaveCount(1);

    const removeMark = page.getByRole("button", { name: "Remove mark" });

    await expect(removeMark).toBeVisible();
    await removeMark.click({ force: true });
    await expect(editor.locator("span[data-correct]")).toHaveCount(0);

    await selectEditorWord(editor, "alpha");
    await page.getByRole("button", { name: "Correct", exact: true }).click();
    await expect(editor.locator("span[data-correct]")).toHaveCount(1);

    await selectEditorWord(editor, "beta");
    await page.getByRole("button", { name: "Incorrect", exact: true }).click();
    await expect(editor.locator("span[data-incorrect]")).toHaveCount(1);
    await expect(editor.locator("span[data-correct]")).toHaveCount(1);
  }
);
