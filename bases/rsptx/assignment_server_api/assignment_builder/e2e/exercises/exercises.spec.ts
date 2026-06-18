import { Locator, Page } from "@playwright/test";

import {
  addBookExercisesToAssignment,
  createMchoiceViaEditor,
  shimUsernameIntoEBookConfig
} from "../fixtures/exercises";
import { expect, test } from "../fixtures/scratch";
import { openAssignmentTab } from "../fixtures/selectors";

const BATCH_API = "/assignment/instructor/assignment_question/batch";
const REORDER_API = "/assignment/instructor/reorder_assignment_questions";
const COPY_API = "/assignment/instructor/copy_question";

const exercisesTable = (page: Page): Locator =>
  page.getByRole("table", { name: "Assignment exercises" });

const renderedRowNames = async (page: Page, expectedCount: number): Promise<string[]> => {
  const handles = exercisesTable(page).getByRole("button", { name: /^Reorder / });

  await expect(handles).toHaveCount(expectedCount);

  const labels = await handles.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label") ?? "")
  );

  return labels.map((label) => label.replace(/^Reorder /, ""));
};

const pointsCell = (page: Page, name: string): Locator =>
  page.getByRole("textbox", { name: `Points for ${name}`, exact: true });

test(
  "keyboard reorder with Space and ArrowDown persists across reload",
  { tag: ["@p1", "@exercises", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    await addBookExercisesToAssignment(page, scratchAssignment.id, 3);
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");

    const before = await renderedRowNames(page, 3);

    const reorderResponse = page.waitForResponse(
      (response) => response.url().includes(REORDER_API) && response.request().method() === "POST"
    );

    const DND_SETTLE_MS = 250;
    const handle = exercisesTable(page).getByRole("button", { name: `Reorder ${before[0]}` });

    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(DND_SETTLE_MS);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(DND_SETTLE_MS);
    await page.keyboard.press("Space");

    expect((await reorderResponse).ok()).toBe(true);

    const expectedOrder = [before[1], before[0], before[2]];

    await expect
      .poll(async () => (await renderedRowNames(page, 3)).join("|"))
      .toBe(expectedOrder.join("|"));

    await page.reload();
    expect(await renderedRowNames(page, 3)).toEqual(expectedOrder);
  }
);

test(
  "points cell edit commits on Enter with exactly one PUT",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await addBookExercisesToAssignment(page, scratchAssignment.id, 2);
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");

    const [firstName] = await renderedRowNames(page, 2);
    const cell = pointsCell(page, firstName);
    const currentValue = await cell.inputValue();
    const nextValue = String(Number(currentValue || "0") + 3);

    let batchPuts = 0;

    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes(BATCH_API)) {
        batchPuts += 1;
      }
    });

    const putResponse = page.waitForResponse(
      (response) => response.url().includes(BATCH_API) && response.request().method() === "PUT"
    );

    await cell.fill(nextValue);
    await cell.press("Enter");

    expect((await putResponse).ok()).toBe(true);
    await expect(page.getByText("Exercise updated")).toBeVisible();
    expect(batchPuts).toBe(1);
    await expect(cell).toHaveValue(nextValue);
  }
);

test(
  "bulk edit from the points header applies to all rows",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await addBookExercisesToAssignment(page, scratchAssignment.id, 3);
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");

    const names = await renderedRowNames(page, 3);
    const batchBodies: unknown[][] = [];

    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes(BATCH_API)) {
        batchBodies.push(request.postDataJSON() as unknown[]);
      }
    });

    await page.getByRole("button", { name: "Edit Points for all exercises" }).click();
    await expect(page.getByText("Applies to 3 exercises")).toBeVisible();
    await page.getByRole("textbox", { name: "Points for all exercises" }).fill("6");

    const putResponse = page.waitForResponse(
      (response) => response.url().includes(BATCH_API) && response.request().method() === "PUT"
    );

    await page.getByRole("button", { name: "Apply" }).click();

    expect((await putResponse).ok()).toBe(true);
    await expect(page.getByText("Updated 3 exercises")).toBeVisible();
    expect(batchBodies).toHaveLength(1);
    expect(batchBodies[0]).toHaveLength(3);

    for (const name of names) {
      await expect(pointsCell(page, name)).toHaveValue("6");
    }
  }
);

test(
  "drag-fill across rows commits only the changed rows",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await addBookExercisesToAssignment(page, scratchAssignment.id, 3);
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");

    const names = await renderedRowNames(page, 3);
    const sourceCell = pointsCell(page, names[0]);
    const targetCell = pointsCell(page, names[1]);
    const thirdCell = pointsCell(page, names[2]);

    const targetValue = await targetCell.inputValue();
    const thirdValueBefore = await thirdCell.inputValue();
    const sourceValue = String(Number(targetValue || "0") + 5);

    const cellEditResponse = page.waitForResponse(
      (response) => response.url().includes(BATCH_API) && response.request().method() === "PUT"
    );

    await sourceCell.fill(sourceValue);
    await sourceCell.press("Enter");
    await cellEditResponse;

    const batchBodies: unknown[][] = [];

    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes(BATCH_API)) {
        batchBodies.push(request.postDataJSON() as unknown[]);
      }
    });

    await sourceCell.hover();

    const handle = page.locator("[data-drag-fill-handle]").first();
    const handleBox = await handle.boundingBox();
    const targetBox = await targetCell.boundingBox();

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
      { steps: 8 }
    );

    const fillResponse = page.waitForResponse(
      (response) => response.url().includes(BATCH_API) && response.request().method() === "PUT"
    );

    await page.mouse.up();

    expect((await fillResponse).ok()).toBe(true);
    await expect(page.getByText("Updated 1 exercise", { exact: true })).toBeVisible();
    expect(batchBodies).toHaveLength(1);
    expect(batchBodies[0]).toHaveLength(1);

    await expect(targetCell).toHaveValue(sourceValue);
    await expect(thirdCell).toHaveValue(thirdValueBefore);
  }
);

test(
  "remove selected exercises asks for confirmation with pluralized copy",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await addBookExercisesToAssignment(page, scratchAssignment.id, 3);
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");

    const names = await renderedRowNames(page, 3);

    await exercisesTable(page)
      .getByRole("checkbox", { name: `Select ${names[0]}`, exact: true })
      .check();
    await exercisesTable(page)
      .getByRole("checkbox", { name: `Select ${names[1]}`, exact: true })
      .check();

    await page.getByRole("button", { name: "Remove (2)" }).click();

    const confirmDialog = page.getByRole("dialog", { name: "Remove exercises" });

    await expect(confirmDialog).toContainText("Remove 2 exercises from this assignment?");
    await confirmDialog.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText("Removed 2 exercises")).toBeVisible();
    await expect(exercisesTable(page).getByRole("button", { name: /^Reorder / })).toHaveCount(1);
    await expect(
      exercisesTable(page).getByRole("button", { name: `Reorder ${names[2]}` })
    ).toBeVisible();
  }
);

test(
  "copy exercise modal validates the name and opens the editor for editable types",
  { tag: ["@p1", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    const exerciseName = await createMchoiceViaEditor(page, scratchAssignment.name);

    await page.getByRole("button", { name: "Copy exercise" }).click();

    const modal = page.getByRole("dialog", { name: "Copy exercise" });

    await expect(modal).toBeVisible();

    const nameInput = modal.getByLabel("Name for the copy");

    await expect(nameInput).toHaveValue(exerciseName);

    const copyButton = modal.getByRole("button", { name: "Copy, add, and edit" });

    await expect(copyButton).toBeDisabled();

    await nameInput.fill(`${exerciseName}-copy`);
    await expect(copyButton).toBeEnabled();

    const copyResponse = page.waitForResponse(
      (response) => response.url().includes(COPY_API) && response.request().method() === "POST"
    );

    await copyButton.click();

    expect((await copyResponse).ok()).toBe(true);
    await expect(page.getByText("Copy added to this assignment. Opening editor…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  }
);

test(
  "row actions are reachable and operable with the keyboard",
  { tag: ["@p1", "@exercises", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    await shimUsernameIntoEBookConfig(page);
    const exerciseName = await createMchoiceViaEditor(page, scratchAssignment.name);

    const row = exercisesTable(page).getByRole("row").filter({ hasText: exerciseName });

    await row.getByRole("checkbox", { name: `Select ${exerciseName}`, exact: true }).focus();

    const focusedLabels: string[] = [];

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(
        () => document.activeElement?.getAttribute("aria-label") ?? ""
      );

      focusedLabels.push(label);
      if (label === "Edit exercise") {
        break;
      }
    }

    expect(focusedLabels).toContain("Exercise details");
    expect(focusedLabels[focusedLabels.length - 1]).toBe("Edit exercise");

    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  }
);

test(
  "info button shows the details tooltip on keyboard focus",
  { tag: ["@p1", "@exercises", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    await addBookExercisesToAssignment(page, scratchAssignment.id, 1);
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");

    const [name] = await renderedRowNames(page, 1);
    const row = exercisesTable(page).getByRole("row").filter({ hasText: name });

    await row.getByRole("checkbox", { name: `Select ${name}`, exact: true }).focus();
    await page.keyboard.press("Tab");

    const focusedLabel = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? ""
    );

    expect(focusedLabel).toBe("Exercise details");
    await expect(page.getByRole("tooltip")).toBeVisible();
  }
);
