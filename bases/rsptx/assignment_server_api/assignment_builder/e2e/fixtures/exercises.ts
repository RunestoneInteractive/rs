import { Page, expect } from "@playwright/test";

import { openAssignmentTab, tipTapEditors, typeIntoTipTap } from "./selectors";

const ASSIGNMENT_QUESTIONS_API = "/assignment/instructor/assignment_questions";
const ASSIGNMENT_EXERCISES_API = "/assignment/instructor/assignment_exercises";
const QUESTION_API = "/assignment/instructor/question";
const SEED_ASSIGNMENT_ID = 1;

interface SeedExercise {
  id: number;
  question_id: number;
  name: string;
}

export const addBookExercisesToAssignment = async (
  page: Page,
  assignmentId: number,
  count: number
): Promise<string[]> => {
  const listResponse = await page.request.post(ASSIGNMENT_QUESTIONS_API, {
    data: { assignment: SEED_ASSIGNMENT_ID }
  });

  expect(listResponse.ok()).toBe(true);
  const body = (await listResponse.json()) as { detail: { exercises: SeedExercise[] } };
  const picked = [...body.detail.exercises].sort((a, b) => a.id - b.id).slice(0, count);

  expect(picked).toHaveLength(count);

  const addResponse = await page.request.put(ASSIGNMENT_EXERCISES_API, {
    data: {
      assignmentId,
      isReading: false,
      idsToAdd: picked.map((exercise) => exercise.question_id),
      idsToRemove: []
    }
  });

  expect(addResponse.ok()).toBe(true);

  return picked.map((exercise) => exercise.name);
};

export const createMchoiceViaEditor = async (
  page: Page,
  assignmentName: string,
  exerciseNameOverride?: string,
  points?: number
): Promise<string> => {
  await openAssignmentTab(page, assignmentName, "Exercises");
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

  if (points !== undefined) {
    await page.locator("#points").fill(String(points));
  }
  const nameInput = page.getByRole("textbox", { name: "Exercise name" });

  if (exerciseNameOverride) {
    await nameInput.fill(exerciseNameOverride);
  }
  const exerciseName = await nameInput.inputValue();

  await page.getByRole("button", { name: "Next" }).click();

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(QUESTION_API) && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "Save" }).first().click();
  const response = await responsePromise;

  expect(response.status()).toBe(201);

  await expect(page.getByRole("dialog", { name: "Exercise saved" })).toBeVisible();
  await page.getByRole("button", { name: "Back to exercises" }).click();
  await expect(page.getByText(exerciseName).first()).toBeVisible();

  return exerciseName;
};

export const shimUsernameIntoEBookConfig = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    let stored: { username?: string } = {};

    Object.defineProperty(window, "eBookConfig", {
      configurable: true,
      get: () => stored,
      set: (next: { username?: string }) => {
        stored = { ...next, username: next?.username ?? "testuser1" };
      }
    });
  });
};
