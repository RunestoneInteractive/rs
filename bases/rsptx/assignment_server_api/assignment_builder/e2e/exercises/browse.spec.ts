import { Locator, Page, Response } from "@playwright/test";

import { expect, test } from "../fixtures/scratch";
import { openAssignmentTab } from "../fixtures/selectors";

const ASSIGNMENT_EXERCISES_API = "/assignment/instructor/assignment_exercises";
const ASSIGNMENT_QUESTIONS_API = "/assignment/instructor/assignment_questions";
const REFETCH_QUIET_MS = 700;

const exerciseNoun = (count: number): string => (count === 1 ? "exercise" : "exercises");

const browseTree = (page: Page): Locator => page.getByRole("table", { name: "Choose exercises" });

const exercisesTable = (page: Page): Locator =>
  page.getByRole("table", { name: "Assignment exercises" });

const openBrowse = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Add exercise" }).click();

  const mountRefetch = page.waitForResponse(
    (response) =>
      response.url().includes(ASSIGNMENT_QUESTIONS_API) && response.request().method() === "POST"
  );

  await page.getByRole("menuitem", { name: "Choose from book" }).click();
  await expect(page.getByRole("heading", { name: "Choose from book" })).toBeVisible();
  await mountRefetch;

  let lastRefetchAt = Date.now();
  const onResponse = (response: Response) => {
    if (response.url().includes(ASSIGNMENT_QUESTIONS_API)) {
      lastRefetchAt = Date.now();
    }
  };

  page.on("response", onResponse);
  await expect
    .poll(() => Date.now() - lastRefetchAt, { timeout: 15000 })
    .toBeGreaterThan(REFETCH_QUIET_MS);
  page.off("response", onResponse);
};

const trackExerciseWrites = (page: Page): (() => number) => {
  let writes = 0;

  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes(ASSIGNMENT_EXERCISES_API)) {
      writes += 1;
    }
  });

  return () => writes;
};

const firstChapterRow = (page: Page): Locator =>
  browseTree(page)
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: /^Expand/ }) })
    .first();

const stageFirstChapterAdds = async (page: Page): Promise<number> => {
  await firstChapterRow(page).getByRole("checkbox").click();

  const footer = page.getByText(/[1-9]\d* to add/);

  await expect(footer).toBeVisible();
  const footerText = (await footer.textContent()) ?? "";
  const staged = Number(footerText.match(/(\d+) to add/)?.[1]);

  expect(staged).toBeGreaterThan(0);

  return staged;
};

const applyChanges = async (page: Page, expectedBody: string): Promise<void> => {
  await expect(page.locator('[data-portal="true"] [role="alert"]')).toHaveCount(0, {
    timeout: 10000
  });
  await page.getByRole("button", { name: "Apply changes" }).click();

  const dialog = page.getByRole("dialog", { name: "Apply changes" });

  await expect(dialog).toContainText(expectedBody);

  const putResponse = page.waitForResponse(
    (response) =>
      response.url().includes(ASSIGNMENT_EXERCISES_API) && response.request().method() === "PUT"
  );

  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await putResponse).ok()).toBe(true);
};

test(
  "staging in browse fires no writes and Reset and Cancel discard the changes",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    const writeCount = trackExerciseWrites(page);

    await openBrowse(page);
    await stageFirstChapterAdds(page);

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText("No changes yet")).toBeVisible();

    await stageFirstChapterAdds(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();

    await openBrowse(page);
    await expect(page.getByText("No changes yet")).toBeVisible();

    expect(writeCount()).toBe(0);
  }
);

test(
  "applying staged additions confirms with named counts and fires exactly one PUT",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    const writeCount = trackExerciseWrites(page);

    await openBrowse(page);
    const staged = await stageFirstChapterAdds(page);

    await applyChanges(page, `Add ${staged} ${exerciseNoun(staged)} to this assignment?`);

    await expect(page.getByText(`Added ${staged} ${exerciseNoun(staged)}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();
    await expect(exercisesTable(page).getByRole("button", { name: /^Reorder / })).toHaveCount(
      staged
    );

    expect(writeCount()).toBe(1);
  }
);

test(
  "applying staged removals via the chapter tri-state empties the assignment with one PUT",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");

    await openBrowse(page);
    const staged = await stageFirstChapterAdds(page);

    await applyChanges(page, `Add ${staged} ${exerciseNoun(staged)} to this assignment?`);
    await expect(exercisesTable(page).getByRole("button", { name: /^Reorder / })).toHaveCount(
      staged
    );

    const writeCount = trackExerciseWrites(page);

    await openBrowse(page);

    const chapterCheckbox = firstChapterRow(page).getByRole("checkbox");

    await expect(chapterCheckbox).toBeChecked();
    await chapterCheckbox.click();
    await expect(page.getByText(`${staged} to remove`)).toBeVisible();
    expect(writeCount()).toBe(0);

    await applyChanges(page, `Remove ${staged} ${exerciseNoun(staged)} from this assignment?`);

    await expect(page.getByText(`Removed ${staged} ${exerciseNoun(staged)}`)).toBeVisible();
    await expect(exercisesTable(page).getByRole("button", { name: /^Reorder / })).toHaveCount(0);
    expect(writeCount()).toBe(1);
  }
);

test(
  "browse picker fits a 360px viewport without page horizontal scroll",
  { tag: ["@p2", "@exercises", "@responsive"] },
  async ({ page, scratchAssignment }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await openBrowse(page);

    await expect(browseTree(page)).toBeVisible();

    const hasPageHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    expect(hasPageHScroll).toBe(false);

    for (const control of ["Back to exercises", "Apply changes"]) {
      const box = await page.getByRole("button", { name: control }).boundingBox();

      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    }
  }
);
