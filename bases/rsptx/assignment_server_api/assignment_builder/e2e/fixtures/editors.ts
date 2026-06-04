import { Locator, Page } from "@playwright/test";

import { expect } from "./scratch";
import { openAssignmentTab } from "./selectors";

export const uniqueExerciseName = (workerIndex: number, slug: string): string =>
  `e2e-q-${workerIndex}-${Date.now().toString(36)}-${slug}`;

export const openCreateEditor = async (
  page: Page,
  assignmentName: string,
  cardLabel: RegExp
): Promise<void> => {
  await openAssignmentTab(page, assignmentName, "Exercises");
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("menuitem", { name: "Create exercise", exact: true }).click();
  await page.getByRole("button", { name: cardLabel }).first().click();
};

export const fillSettings = async (page: Page, exerciseName: string): Promise<void> => {
  const sectionSelect = page.getByRole("textbox", { name: "Section" });

  await expect(sectionSelect).toBeEnabled();
  if (!(await sectionSelect.inputValue())) {
    await sectionSelect.click();
    await page.getByRole("option").first().click();
  }

  await page.getByRole("textbox", { name: "Exercise name" }).fill(exerciseName);

  const privateSwitch = page.getByRole("switch", { name: "Private exercise" });

  if (!(await privateSwitch.isChecked())) {
    await privateSwitch.focus();
    await page.keyboard.press("Space");
    await expect(privateSwitch).toBeChecked();
  }
};

export const selectEditorLanguage = async (page: Page, placeholder: string): Promise<void> => {
  await page.getByRole("textbox", { name: placeholder }).click();
  await page.getByRole("option", { name: /python/i }).click();
};

export const selectEditorWord = async (editor: Locator, word: string): Promise<void> => {
  await editor.click();
  await editor.evaluate((element, target) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();

    while (node) {
      const index = node.textContent?.indexOf(target) ?? -1;

      if (index >= 0) {
        const domRange = document.createRange();

        domRange.setStart(node, index);
        domRange.setEnd(node, index + target.length);

        const selection = window.getSelection();

        selection?.removeAllRanges();
        selection?.addRange(domRange);
        return;
      }
      node = walker.nextNode();
    }
    throw new Error(`Text "${target}" not found in the editor`);
  }, word);
};

export const connectFirstPairByKeyboard = async (page: Page): Promise<void> => {
  const handle = page.getByRole("button", { name: "Connect source item 1 to a target match" });

  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");

  const target = page.getByRole("button", { name: "Connect to target match 1" });

  await target.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Connections (1)")).toBeVisible();
};

export const monacoTextbox = (page: Page, ariaLabel: string): Locator =>
  page.getByRole("textbox", { name: ariaLabel });

export const typeIntoMonaco = async (
  page: Page,
  ariaLabel: string,
  text: string
): Promise<void> => {
  const textbox = monacoTextbox(page, ariaLabel);

  await textbox.focus();
  await page.keyboard.insertText(text);
};
