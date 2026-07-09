import { Page } from "@playwright/test";

import { openCreateEditor } from "../fixtures/editors";
import { expect, test } from "../fixtures/scratch";
import { tipTapEditors, typeIntoTipTap } from "../fixtures/selectors";

const openDragAndDropContentStep = async (page: Page, assignmentName: string): Promise<void> => {
  await openCreateEditor(page, assignmentName, /Drag/i);
  await typeIntoTipTap(tipTapEditors(page).first(), "Match each fruit to its color.");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Content matching" })).toBeVisible();
  await typeIntoTipTap(tipTapEditors(page).nth(0), "Apple");
  await typeIntoTipTap(tipTapEditors(page).nth(1), "Red");
};

test(
  "authors and removes a connection with the keyboard only",
  { tag: ["@p1", "@exercises", "@editor-dragndrop", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    await openDragAndDropContentStep(page, scratchAssignment.name);

    const handle = page.getByRole("button", { name: "Connect source item 1 to a target match" });

    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Escape");
    await expect(handle).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");

    const target = page.getByRole("button", { name: "Connect to target match 1" });

    await target.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Connections (1)")).toBeVisible();
    await expect(handle).toHaveAttribute("aria-pressed", "false");

    const row = page.getByRole("listitem").filter({ hasText: "Apple" });

    await expect(row).toContainText("Red");

    const remove = page.getByRole("button", { name: "Remove connection from Apple to Red" });

    await remove.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Connections (0)")).toBeVisible();
    await expect(page.getByText(/No connections yet/)).toBeVisible();
  }
);

test(
  "draws a connection with the mouse and unlinks it from the connection list",
  { tag: ["@p1", "@exercises", "@editor-dragndrop"] },
  async ({ page, scratchAssignment }) => {
    await openDragAndDropContentStep(page, scratchAssignment.name);

    const handle = page.getByRole("button", { name: "Connect source item 1 to a target match" });
    const targetBlock = page.locator('[data-block-id^="right-"]').first();

    const handleBox = await handle.boundingBox();
    const targetBox = await targetBlock.boundingBox();

    expect(handleBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + targetBox!.height / 2,
      { steps: 10 }
    );
    await page.mouse.up();

    await expect(page.getByText("Connections (1)")).toBeVisible();

    await page.getByRole("button", { name: "Remove connection from Apple to Red" }).click();

    await expect(page.getByText("Connections (0)")).toBeVisible();
  }
);

test(
  "blocks the content step until at least one connection exists",
  { tag: ["@p1", "@exercises", "@editor-dragndrop"] },
  async ({ page, scratchAssignment }) => {
    await openDragAndDropContentStep(page, scratchAssignment.name);

    await page.getByRole("button", { name: "Next" }).click();

    const footer = page
      .getByRole("alert")
      .filter({ hasText: "Add at least one connection between a source item and a target match" });

    await expect(footer).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

    const handle = page.getByRole("button", { name: "Connect source item 1 to a target match" });

    await handle.focus();
    await page.keyboard.press("Space");

    const target = page.getByRole("button", { name: "Connect to target match 1" });

    await target.focus();
    await page.keyboard.press("Enter");

    await expect(footer).not.toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Exercise settings" })).toBeVisible();
  }
);

test.describe("drag and drop content step at 360", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test(
    "columns and connection list fit without horizontal scroll",
    { tag: ["@p2", "@responsive", "@editor-dragndrop"] },
    async ({ page, scratchAssignment }) => {
      await openDragAndDropContentStep(page, scratchAssignment.name);

      await expect(page.getByText("Connections (0)")).toBeVisible();

      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));

      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);

      const handle = page.getByRole("button", {
        name: "Connect source item 1 to a target match"
      });
      const handleBox = await handle.boundingBox();

      expect(handleBox).not.toBeNull();
      expect(handleBox!.x + handleBox!.width).toBeLessThanOrEqual(360);

      const sourceHeading = await page.getByRole("heading", { name: "Source items" }).boundingBox();
      const targetHeading = await page
        .getByRole("heading", { name: "Target matches" })
        .boundingBox();

      expect(targetHeading!.y).toBeGreaterThan(sourceHeading!.y);
    }
  );
});
