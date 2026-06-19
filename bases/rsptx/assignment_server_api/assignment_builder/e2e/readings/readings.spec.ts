import { Locator, Page } from "@playwright/test";

import { expect, test } from "../fixtures/scratch";
import { openAssignmentTab } from "../fixtures/selectors";

const BATCH_API = "/assignment/instructor/assignment_question/batch";
const ASSIGNMENT_EXERCISES_API = "/assignment/instructor/assignment_exercises";

const readingsTable = (page: Page): Locator =>
  page.getByRole("table", { name: "Assignment readings" });

const readingRowCheckboxes = (page: Page): Locator =>
  readingsTable(page).getByRole("checkbox", { name: /^Select (?!all rows)/ });

const addFirstChapterReadings = async (page: Page): Promise<number> => {
  await page.getByRole("button", { name: "Choose readings" }).click();

  const tree = page.getByRole("table", { name: "Choose readings" });
  const chapterRow = tree
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: /^Expand/ }) })
    .first();

  const addResponse = page.waitForResponse(
    (response) =>
      response.url().includes(ASSIGNMENT_EXERCISES_API) &&
      response.request().method() === "PUT" &&
      response.ok()
  );

  await chapterRow.getByRole("checkbox").click();
  await addResponse;

  const footer = page.getByText(/[1-9]\d* sections? selected/);

  await expect(footer).toBeVisible();
  const footerText = (await footer.textContent()) ?? "";
  const count = Number(footerText.match(/^(\d+)/)?.[1]);

  expect(count).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Done" }).click();

  return count;
};

test(
  "chapter-level tri-state add selects every leaf section in one update",
  { tag: ["@p1", "@readings"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Readings");

    const count = await addFirstChapterReadings(page);

    await expect(readingRowCheckboxes(page)).toHaveCount(count);
  }
);

test(
  "points bulk edit via the header popover applies to every reading",
  { tag: ["@p1", "@readings"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Readings");
    const count = await addFirstChapterReadings(page);

    const batchBodies: unknown[][] = [];

    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes(BATCH_API)) {
        batchBodies.push(request.postDataJSON() as unknown[]);
      }
    });

    await page.getByRole("button", { name: "Edit Points for all readings" }).click();
    await expect(page.getByText(`Applies to ${count} readings`)).toBeVisible();

    await page.getByRole("textbox", { name: "Points for all readings" }).fill("4");

    const putResponse = page.waitForResponse(
      (response) => response.url().includes(BATCH_API) && response.request().method() === "PUT"
    );

    await page.getByRole("button", { name: "Apply" }).click();

    expect((await putResponse).ok()).toBe(true);
    await expect(page.getByText(`Updated ${count} readings`)).toBeVisible();
    expect(batchBodies).toHaveLength(1);
    expect(batchBodies[0]).toHaveLength(count);
  }
);

test(
  "required cell rejects a value above the activity count with a toast and no write",
  { tag: ["@p1", "@readings"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Readings");
    await addFirstChapterReadings(page);

    let batchPuts = 0;

    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes(BATCH_API)) {
        batchPuts += 1;
      }
    });

    const requiredInput = readingsTable(page)
      .getByRole("textbox", { name: /^Required activities for / })
      .first();

    await requiredInput.fill("99");

    await expect(page.getByText("Too many required activities")).toBeVisible();
    await expect(
      page.getByText(/Required activities \(99\) can't exceed the activity count/)
    ).toBeVisible();
    expect(batchPuts).toBe(0);
  }
);

test(
  "remove selected readings asks for confirmation with pluralized copy",
  { tag: ["@p1", "@readings"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Readings");
    const count = await addFirstChapterReadings(page);

    await readingsTable(page).getByRole("checkbox", { name: "Select all rows" }).check();
    await page.getByRole("button", { name: `Remove (${count})` }).click();

    const confirmDialog = page.getByRole("dialog", { name: "Remove readings" });

    await expect(confirmDialog).toContainText(`Remove ${count} readings from this assignment?`);

    await confirmDialog.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText("No readings yet")).toBeVisible();
  }
);
