import { Page } from "@playwright/test";

import { openCreateEditor } from "../fixtures/editors";
import { expect, test } from "../fixtures/scratch";
import { tipTapEditors, typeIntoTipTap } from "../fixtures/selectors";

const openMatchingContentStep = async (page: Page, assignmentName: string): Promise<void> => {
  await openCreateEditor(page, assignmentName, /Matching/i);
  await typeIntoTipTap(tipTapEditors(page).first(), "Match each concept to its definition.");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Content matching" })).toBeVisible();
  await typeIntoTipTap(tipTapEditors(page).nth(0), "Loop");
  await typeIntoTipTap(tipTapEditors(page).nth(1), "Repeats statements");
};

test(
  "authors a connection from either side with the keyboard only",
  { tag: ["@p1", "@exercises", "@editor-matching", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    await openMatchingContentStep(page, scratchAssignment.name);

    const leftHandle = page.getByRole("button", {
      name: "Connect source item 1 to a target match"
    });

    await leftHandle.focus();
    await page.keyboard.press("Space");
    await expect(leftHandle).toHaveAttribute("aria-pressed", "true");

    const rightTarget = page.getByRole("button", { name: "Connect to target match 1" });

    await rightTarget.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Connections (1)")).toBeVisible();

    const remove = page.getByRole("button", {
      name: "Remove connection from Loop to Repeats statements"
    });

    await remove.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Connections (0)")).toBeVisible();

    const rightHandle = page.getByRole("button", {
      name: "Connect target match 1 to a source item"
    });

    await rightHandle.focus();
    await page.keyboard.press("Space");
    await expect(rightHandle).toHaveAttribute("aria-pressed", "true");

    const leftTarget = page.getByRole("button", { name: "Connect to source item 1" });

    await leftTarget.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Connections (1)")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Loop" })).toContainText(
      "Repeats statements"
    );
  }
);

test(
  "shows the already-connected toast for a duplicate mouse connection",
  { tag: ["@p1", "@exercises", "@editor-matching"] },
  async ({ page, scratchAssignment }) => {
    await openMatchingContentStep(page, scratchAssignment.name);

    const handle = page.getByRole("button", { name: "Connect source item 1 to a target match" });

    await handle.focus();
    await page.keyboard.press("Space");

    const target = page.getByRole("button", { name: "Connect to target match 1" });

    await target.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Connections (1)")).toBeVisible();

    const handleBox = await handle.boundingBox();
    const targetBlock = page.locator('[data-block-id^="right-"]').first();
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

    await expect(page.getByText("Already connected", { exact: true })).toBeVisible();
    await expect(page.getByText("These two items are already connected.")).toBeVisible();
    await expect(page.getByText("Connections (1)")).toBeVisible();
  }
);
