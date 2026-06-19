import { Locator, Page } from "@playwright/test";

import { expect, test } from "../fixtures/scratch";
import { openAssignmentTab } from "../fixtures/selectors";

const ASSIGNMENT_EXERCISES_API = "/assignment/instructor/assignment_exercises";

const searchGrid = (page: Page): Locator => page.getByRole("table", { name: "Search exercises" });

const rowCheckboxes = (page: Page): Locator =>
  searchGrid(page).getByRole("checkbox", { name: /^Select (?!all)/ });

const openSearch = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("menuitem", { name: "Search exercises" }).click();
  await expect(page.getByRole("heading", { name: "Search exercises" })).toBeVisible();
  await expect(rowCheckboxes(page).first()).toBeVisible();
};

test(
  "type filter popover stays open across picks and shows the count badge",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await openSearch(page);

    const typeFilter = page.getByRole("button", { name: "Exercise types" });

    await typeFilter.click();

    const optionList = page.getByRole("group", { name: "Exercise types" });
    const options = optionList.getByRole("checkbox");

    await options.nth(0).click();
    await expect(optionList).toBeVisible();
    await expect(options.nth(0)).toBeChecked();

    await options.nth(1).click();
    await expect(optionList).toBeVisible();
    await expect(typeFilter.getByText("2")).toBeVisible();
    await expect(page.getByText("2 selected")).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(options.nth(0)).not.toBeChecked();
    await expect(typeFilter).not.toContainText("2");
  }
);

test(
  "add selected disables the button while saving and lands the rows in the list",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await openSearch(page);

    await rowCheckboxes(page).nth(0).click();
    await rowCheckboxes(page).nth(1).click();

    const addButton = page.getByRole("button", { name: "Add 2 selected" });

    await expect(addButton).toBeVisible();

    const PUT_DELAY_MS = 500;

    await page.route(`**${ASSIGNMENT_EXERCISES_API}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, PUT_DELAY_MS));
      await route.continue();
    });

    const putResponse = page.waitForResponse(
      (response) =>
        response.url().includes(ASSIGNMENT_EXERCISES_API) && response.request().method() === "PUT"
    );

    await addButton.click();
    await expect(addButton).toBeDisabled();

    expect((await putResponse).ok()).toBe(true);
    await expect(page.getByText("Added 2 exercises")).toBeVisible();
    await expect(page.getByText("Select exercises to add")).toBeVisible();

    await page.getByRole("button", { name: "Back to exercises" }).click();
    await expect(
      page
        .getByRole("table", { name: "Assignment exercises" })
        .getByRole("button", { name: /^Reorder / })
    ).toHaveCount(2);
  }
);

test(
  "name sort keeps cycling between ascending and descending",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await openSearch(page);

    const nameHeader = searchGrid(page).getByRole("columnheader", { name: "Name" });
    const sortButton = nameHeader.getByRole("button", { name: "Name" });

    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    await sortButton.click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");

    await sortButton.click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    await sortButton.click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  }
);

test(
  "pagination footer stays pinned while the grid scrolls and pages change",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await openSearch(page);

    const showing = page.getByText(/Showing \d+ of \d+ exercises/);

    await expect(showing).toBeVisible();
    const total = Number(((await showing.textContent()) ?? "").match(/of (\d+)/)?.[1]);

    test.skip(total <= 10, "needs more than 10 searchable exercises in the dev book");

    await page.getByRole("textbox", { name: "Rows per page" }).click();
    await page.getByRole("option", { name: "10", exact: true }).click();

    const nextPage = page.getByRole("button", { name: "Next page" });

    await expect(nextPage).toBeVisible();

    const firstRowBefore = (await rowCheckboxes(page).first().getAttribute("aria-label")) ?? "";

    await searchGrid(page).getByRole("row").nth(1).hover();
    await page.mouse.wheel(0, 600);

    const viewportHeight = page.viewportSize()!.height;
    const pinnedBox = await nextPage.boundingBox();

    expect(pinnedBox).not.toBeNull();
    expect(pinnedBox!.y + pinnedBox!.height).toBeLessThanOrEqual(viewportHeight);

    await nextPage.click();

    await expect
      .poll(async () => (await rowCheckboxes(page).first().getAttribute("aria-label")) ?? "")
      .not.toBe(firstRowBefore);

    const afterBox = await nextPage.boundingBox();

    expect(afterBox).not.toBeNull();
    expect(afterBox!.y + afterBox!.height).toBeLessThanOrEqual(viewportHeight);
  }
);

test(
  "back button discards the staged search selection",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await openSearch(page);

    await rowCheckboxes(page).nth(0).click();
    await expect(page.getByRole("button", { name: "Add 1 selected" })).toBeVisible();

    await page.getByRole("button", { name: "Back to exercises" }).click();
    await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();

    await openSearch(page);
    await expect(page.getByText("Select exercises to add")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add 1 selected" })).toHaveCount(0);
  }
);

test(
  "search picker fits a 360px viewport without page horizontal scroll",
  { tag: ["@p2", "@exercises", "@responsive"] },
  async ({ page, scratchAssignment }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await openSearch(page);

    const hasPageHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    expect(hasPageHScroll).toBe(false);

    for (const control of ["Back to exercises", "Exercise types"]) {
      const box = await page.getByRole("button", { name: control }).boundingBox();

      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    }
  }
);
