import { Page } from "@playwright/test";

import { openCreateEditor, selectEditorLanguage, typeIntoMonaco } from "../fixtures/editors";
import { expect, test } from "../fixtures/scratch";
import { tipTapEditors, typeIntoTipTap } from "../fixtures/selectors";

const DND_KIT_SETTLE_MS = 300;

const openParsonsBlocksStep = async (page: Page, assignmentName: string): Promise<void> => {
  await openCreateEditor(page, assignmentName, /Parsons/i);
  await selectEditorLanguage(page, "Select content type");
  await page.getByRole("button", { name: "Next" }).click();
  await typeIntoTipTap(tipTapEditors(page).first(), "Arrange the lines to print hello.");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Create content blocks" })).toBeVisible();
};

test(
  "blocks add via the dashed row, split on a line boundary, and group an alternative",
  { tag: ["@p1", "@exercises", "@editor-parsonsprob"] },
  async ({ page, scratchAssignment }) => {
    await openParsonsBlocksStep(page, scratchAssignment.name);

    await typeIntoMonaco(page, "Code for block 1", "print('a')");
    await expect(page.getByText("block", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add block" }).click();
    await expect(page.getByText("blocks", { exact: true })).toBeVisible();

    await typeIntoMonaco(page, "Code for block 2", "x = 1\ny = 2");

    const secondBlock = page.locator(".sortable-block").nth(1);
    const firstLine = secondBlock.locator(".view-line").first();
    const lineBox = await firstLine.boundingBox();

    expect(lineBox).not.toBeNull();
    await page.mouse.move(lineBox!.x + 40, lineBox!.y - 20, { steps: 3 });
    await page.mouse.move(lineBox!.x + 40, lineBox!.y + lineBox!.height, { steps: 5 });
    await page.getByRole("button", { name: "Split block" }).click();

    await expect(page.locator(".sortable-block")).toHaveCount(3);

    await page.getByRole("button", { name: "Add alternative" }).first().click();

    await expect(page.getByText("group", { exact: true })).toBeVisible();
    await expect(page.locator(".sortable-block")).toHaveCount(4);
  }
);

test(
  "blocks reorder with the keyboard through the drag handle",
  { tag: ["@p1", "@exercises", "@editor-parsonsprob", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    await openParsonsBlocksStep(page, scratchAssignment.name);

    await typeIntoMonaco(page, "Code for block 1", "alpha = 1");
    await page.getByRole("button", { name: "Add block" }).click();
    await typeIntoMonaco(page, "Code for block 2", "beta = 2");

    await expect(page.locator(".sortable-block").first()).toContainText("alpha");

    const firstHandle = page.getByRole("button", { name: "Drag to reorder" }).first();

    await firstHandle.focus();
    await page.keyboard.press("Space");
    await expect(firstHandle).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(DND_KIT_SETTLE_MS);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(DND_KIT_SETTLE_MS);
    await page.keyboard.press("Space");

    await expect(page.locator(".sortable-block").first()).toContainText("beta");
    await expect(page.locator(".sortable-block").nth(1)).toContainText("alpha");
  }
);

test(
  "switching back to simple mode asks for confirmation and resets enhanced options",
  { tag: ["@p1", "@exercises", "@editor-parsonsprob"] },
  async ({ page, scratchAssignment }) => {
    await openParsonsBlocksStep(page, scratchAssignment.name);

    const graderSwitch = page.getByText("Line-based", { exact: true });

    await expect(graderSwitch).not.toBeVisible();
    await page.getByText("Enhanced", { exact: true }).click();
    await expect(graderSwitch).toBeVisible();

    await page.getByText("Simple", { exact: true }).click();

    const confirmDialog = page.getByRole("dialog", { name: "Switch to simple mode" });

    await expect(confirmDialog).toBeVisible();
    await expect(
      confirmDialog.getByText(/Switching to simple mode resets grader, order, line numbers/)
    ).toBeVisible();

    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(graderSwitch).toBeVisible();

    await page.getByText("Simple", { exact: true }).click();
    await page
      .getByRole("dialog", { name: "Switch to simple mode" })
      .getByRole("button", { name: "Continue" })
      .click();

    await expect(graderSwitch).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Add alternative" }).first()).toBeVisible();
  }
);

test(
  "tour opens and walks to the add-block anchor",
  { tag: ["@p2", "@exercises", "@editor-parsonsprob"] },
  async ({ page, scratchAssignment }) => {
    await openParsonsBlocksStep(page, scratchAssignment.name);

    await page.getByRole("button", { name: "Tour" }).click();

    const popover = page.locator(".driver-popover");
    const popoverTitle = popover.locator(".driver-popover-title");

    await expect(popoverTitle).toHaveText("Simple mode");

    const titlesAfterNext = [
      "Enhanced mode",
      "Grader",
      "Block ordering",
      "Line numbers",
      "Toggles",
      "No indent",
      "Add block"
    ];

    for (const title of titlesAfterNext) {
      await popover.getByRole("button", { name: /next/i }).click();
      await expect(popoverTitle).toHaveText(title);
    }

    await expect(page.locator('[data-tour="add-block-btn"]')).toHaveClass(/driver-active-element/);

    await page.keyboard.press("Escape");
    await expect(popover).not.toBeVisible();
  }
);
