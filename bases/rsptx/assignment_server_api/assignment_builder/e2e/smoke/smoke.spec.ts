import { Request } from "@playwright/test";

import {
  createAssignmentViaWizard,
  deleteAssignmentViaApi,
  expect,
  scratchName,
  slugify,
  test
} from "../fixtures/scratch";
import {
  assignmentRow,
  openAssignmentTab,
  tipTapEditors,
  typeIntoTipTap
} from "../fixtures/selectors";

const QUESTION_API = "/assignment/instructor/question";
const QUESTION_CREATED_STATUS = 201;

test("login lands on the assignment list", { tag: ["@p0", "@assignments"] }, async ({ page }) => {
  await page.goto("/builder");

  await expect(page.getByRole("heading", { level: 1, name: "Assignments" })).toBeVisible();

  const rows = page.getByRole("table", { name: "Assignments" }).getByRole("row");

  await expect(rows.nth(1)).toBeVisible();
});

test(
  "wizard creates a scratch assignment that appears in the list",
  { tag: ["@p0", "@wizard"] },
  async ({ page }, testInfo) => {
    const name = scratchName(testInfo.workerIndex, slugify(testInfo.title));
    const id = await createAssignmentViaWizard(page, name);

    try {
      await page.goto("/builder");
      await expect(assignmentRow(page, name)).toBeVisible();
    } finally {
      await deleteAssignmentViaApi(page.request, id);
    }
  }
);

test(
  "create and save one multichoice exercise with exactly one question POST",
  { tag: ["@p0", "@exercises", "@editor-mchoice"] },
  async ({ page, scratchAssignment }) => {
    const questionPosts: Request[] = [];

    page.on("request", (request) => {
      if (request.url().includes(QUESTION_API) && request.method() === "POST") {
        questionPosts.push(request);
      }
    });

    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await page.getByRole("button", { name: "Add exercise" }).click();
    await page.getByRole("menuitem", { name: "Create exercise", exact: true }).click();
    await page.getByRole("button", { name: /Multiple Choice/i }).click();

    await typeIntoTipTap(tipTapEditors(page).first(), "What is 2 + 2?");
    await page.getByRole("button", { name: "Next" }).click();

    await typeIntoTipTap(tipTapEditors(page).nth(0), "4");
    await typeIntoTipTap(tipTapEditors(page).nth(2), "3");
    await page.getByRole("checkbox", { name: "Correct" }).first().check();
    await page.getByRole("button", { name: "Next" }).click();

    const sectionSelect = page.getByRole("textbox", { name: "Section" });

    await expect(sectionSelect).toBeEnabled();
    if (!(await sectionSelect.inputValue())) {
      await sectionSelect.click();
      await page.getByRole("option").first().click();
    }
    const exerciseName = await page.getByRole("textbox", { name: "Exercise name" }).inputValue();

    await page.getByRole("button", { name: "Next" }).click();

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(QUESTION_API) && response.request().method() === "POST"
    );

    await page.getByRole("button", { name: "Save" }).first().click();
    const response = await responsePromise;

    expect(response.status()).toBe(QUESTION_CREATED_STATUS);

    await expect(page.getByRole("dialog", { name: "Exercise saved" })).toBeVisible();
    await page.getByRole("button", { name: "Back to exercises" }).click();

    await expect(page.getByText(exerciseName).first()).toBeVisible();
    expect(questionPosts).toHaveLength(1);
  }
);

test(
  "add then remove one reading via the tree picker",
  { tag: ["@p0", "@readings"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Readings");
    await page.getByRole("button", { name: "Choose readings" }).click();

    const tree = page.getByRole("table", { name: "Choose readings" });

    await tree.getByRole("button", { name: "Expand" }).first().click();

    const leafRow = tree
      .getByRole("row")
      .filter({ has: page.getByRole("checkbox") })
      .filter({ hasNot: page.getByRole("button", { name: /Expand|Collapse/ }) })
      .first();

    const addResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/assignment/instructor/") &&
        ["POST", "PUT"].includes(response.request().method()) &&
        response.ok()
    );

    await leafRow.getByRole("checkbox").click();
    await addResponse;
    await expect(page.getByText("1 section selected")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    const readingRowCheckbox = page
      .getByRole("table", { name: "Assignment readings" })
      .getByRole("checkbox", { name: /^Select (?!all rows)/ })
      .first();

    await expect(readingRowCheckbox).toBeVisible();

    await readingRowCheckbox.check();
    await page.getByRole("button", { name: /^Remove/ }).click();

    const confirmDialog = page.getByRole("dialog", { name: "Remove readings" });

    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText("No readings yet")).toBeVisible();
  }
);

test(
  "delete the scratch assignment from the list with confirm",
  { tag: ["@p0", "@assignments"] },
  async ({ page, scratchAssignment }) => {
    await page.goto("/builder");

    const row = assignmentRow(page, scratchAssignment.name);

    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Delete", exact: true }).click();

    const confirmDialog = page.getByRole("dialog", { name: "Delete assignment" });

    await expect(confirmDialog).toContainText(
      `Delete "${scratchAssignment.name}"? This can't be undone.`
    );
    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(row).not.toBeVisible();
  }
);
