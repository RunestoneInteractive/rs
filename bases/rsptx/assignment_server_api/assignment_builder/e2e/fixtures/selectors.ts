import { Locator, Page } from "@playwright/test";

import { appPath } from "./appNav";

export const assignmentRow = (page: Page, name: string): Locator =>
  page.getByRole("table", { name: "Assignments" }).getByRole("row").filter({ hasText: name });

export const openAssignmentTab = async (
  page: Page,
  assignmentName: string,
  tab: "Basic info" | "Readings" | "Exercises"
): Promise<void> => {
  await page.goto(appPath("/builder"));
  await assignmentRow(page, assignmentName)
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByRole("button", { name: tab }).click();
};

export const tipTapEditors = (page: Page): Locator => page.locator('[contenteditable="true"]');

export const typeIntoTipTap = async (editor: Locator, text: string): Promise<void> => {
  await editor.click();
  await editor.pressSequentially(text);
};
