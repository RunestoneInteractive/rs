import { Page, Request } from "@playwright/test";

import { enabledExerciseTypes } from "../data/exerciseMatrix";
import {
  connectFirstPairByKeyboard,
  fillSettings,
  openCreateEditor,
  selectEditorLanguage,
  selectEditorWord,
  typeIntoMonaco,
  uniqueExerciseName
} from "../fixtures/editors";
import { createMchoiceViaEditor, shimUsernameIntoEBookConfig } from "../fixtures/exercises";
import { expect, test } from "../fixtures/scratch";
import { tipTapEditors, typeIntoTipTap } from "../fixtures/selectors";

const QUESTION_API = "/assignment/instructor/question";
const BATCH_UPDATE_API = "/assignment/instructor/assignment_question/batch";
const INSTRUCTOR_API = "/assignment/instructor/";
const QUESTION_CREATED_STATUS = 201;

const isWrite = (request: Request): boolean => {
  const url = request.url();
  const method = request.method();

  if (url.includes(QUESTION_API) && method === "POST") return true;
  return url.includes(INSTRUCTOR_API) && ["PUT", "DELETE"].includes(method);
};

const trackWrites = (page: Page): Request[] => {
  const writes: Request[] = [];

  page.on("request", (request) => {
    if (isWrite(request)) writes.push(request);
  });
  return writes;
};

interface AuthoredContext {
  exerciseName: string;
}

type StepAction = (page: Page, context: AuthoredContext) => Promise<void>;

const settingsStep: StepAction = async (page, context) => {
  await fillSettings(page, context.exerciseName);
};

const noAction: StepAction = async () => undefined;

const stepActionsByType: Record<string, StepAction[]> = {
  mchoice: [
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).first(), "What is 2 + 2?");
    },
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).nth(0), "4");
      await typeIntoTipTap(tipTapEditors(page).nth(2), "3");
      await page.getByRole("checkbox", { name: "Correct" }).first().check();
    },
    settingsStep
  ],
  poll: [
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).first(), "How was the pace this week?");
    },
    noAction,
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).nth(0), "Too fast");
      await typeIntoTipTap(tipTapEditors(page).nth(1), "Just right");
    },
    settingsStep
  ],
  fillintheblank: [
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).first(), "The capital of France is {blank}");
    },
    async (page) => {
      await page.getByRole("button", { name: /Answer field 1/ }).click();
      await page.getByRole("textbox", { name: "Exact match" }).fill("Paris");
    },
    settingsStep
  ],
  shortanswer: [
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).first(), "Explain recursion in one sentence.");
    },
    settingsStep
  ],
  selectquestion: [
    async (page) => {
      const search = page.getByPlaceholder(/Search questions/);

      await search.fill("question_one");
      await search.press("Enter");
      await expect(page.getByText("1 question")).toBeVisible();
    },
    noAction,
    settingsStep
  ],
  iframe: [
    async (page) => {
      await page.getByRole("textbox", { name: "Iframe URL" }).fill("https://example.com/embed");
    },
    settingsStep
  ],
  activecode: [
    async (page) => {
      await selectEditorLanguage(page, "Select programming language");
    },
    noAction,
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).first(), "Print a greeting.");
    },
    async (page) => {
      await typeIntoMonaco(page, "Hidden prefix code", "setup = True");
    },
    async (page) => {
      await typeIntoMonaco(page, "Starter code", "print('hi')");
    },
    async (page) => {
      await typeIntoMonaco(page, "Hidden suffix code", "done = True");
    },
    async (page) => {
      await page.getByPlaceholder(/Enter input data/).fill("42");
    },
    settingsStep
  ],
  parsonsprob: [
    async (page) => {
      await selectEditorLanguage(page, "Select content type");
    },
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).first(), "Arrange the lines to print hello.");
    },
    async (page) => {
      await typeIntoMonaco(page, "Code for block 1", "print('hello')");
    },
    settingsStep
  ],
  dragndrop: [
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).first(), "Match each fruit to its color.");
    },
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).nth(0), "Apple");
      await typeIntoTipTap(tipTapEditors(page).nth(1), "Red");
      await connectFirstPairByKeyboard(page);
    },
    settingsStep
  ],
  matching: [
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).first(), "Match each concept to its definition.");
    },
    async (page) => {
      await typeIntoTipTap(tipTapEditors(page).nth(0), "Loop");
      await typeIntoTipTap(tipTapEditors(page).nth(1), "Repeats statements");
      await connectFirstPairByKeyboard(page);
    },
    settingsStep
  ],
  clickablearea: [
    async (page) => {
      await page
        .getByRole("textbox", { name: "Statement" })
        .fill("Click the variable assignments.");

      const editor = tipTapEditors(page).first();

      await typeIntoTipTap(editor, "alpha beta");
      await selectEditorWord(editor, "alpha");
      await page.getByRole("button", { name: "Correct", exact: true }).click();
      await expect(editor.locator("span[data-correct]")).toHaveCount(1);

      await selectEditorWord(editor, "beta");
      await page.getByRole("button", { name: "Incorrect", exact: true }).click();
      await expect(editor.locator("span[data-incorrect]")).toHaveCount(1);
    },
    settingsStep
  ]
};

const validationFixByType: Record<string, StepAction> = {
  mchoice: stepActionsByType.mchoice[0],
  poll: stepActionsByType.poll[0],
  fillintheblank: stepActionsByType.fillintheblank[0],
  shortanswer: stepActionsByType.shortanswer[0],
  selectquestion: stepActionsByType.selectquestion[0],
  iframe: stepActionsByType.iframe[0],
  activecode: stepActionsByType.activecode[0],
  parsonsprob: stepActionsByType.parsonsprob[0],
  dragndrop: stepActionsByType.dragndrop[0],
  matching: stepActionsByType.matching[0],
  clickablearea: stepActionsByType.clickablearea[0]
};

const previewChecksByType: Record<string, (page: Page) => Promise<void>> = {
  activecode: async (page) => {
    await expect(page.getByRole("button", { name: /Run/ }).first()).toBeVisible();
  }
};

for (const entry of enabledExerciseTypes) {
  test.describe(`${entry.type} editor`, () => {
    test(
      `creates a ${entry.type} exercise with no writes until Save`,
      { tag: ["@p1", "@exercises", `@editor-${entry.type}`] },
      async ({ page, scratchAssignment }, testInfo) => {
        await openCreateEditor(page, scratchAssignment.name, entry.cardLabel);

        const writes = trackWrites(page);
        const context: AuthoredContext = {
          exerciseName: uniqueExerciseName(testInfo.workerIndex, entry.type)
        };
        const actions = stepActionsByType[entry.type];

        for (const action of actions) {
          await action(page, context);
          await page.getByRole("button", { name: "Next" }).click();
        }

        expect(writes).toHaveLength(0);

        await previewChecksByType[entry.type]?.(page);

        const responsePromise = page.waitForResponse(
          (response) =>
            response.url().includes(QUESTION_API) && response.request().method() === "POST"
        );

        await page.getByRole("button", { name: "Save" }).first().click();
        const response = await responsePromise;

        expect(response.status()).toBe(QUESTION_CREATED_STATUS);

        await expect(page.getByRole("dialog", { name: "Exercise saved" })).toBeVisible();
        await page.getByRole("button", { name: "Back to exercises" }).click();

        await expect(page.getByText(context.exerciseName).first()).toBeVisible();
        expect(writes).toHaveLength(1);
      }
    );

    if (entry.validation) {
      const validation = entry.validation;

      test(
        `blocks the empty ${entry.type} first step and lists the missing field`,
        { tag: ["@p1", "@exercises", `@editor-${entry.type}`] },
        async ({ page, scratchAssignment }) => {
          await openCreateEditor(page, scratchAssignment.name, entry.cardLabel);

          const writes = trackWrites(page);

          await expect(
            page.getByRole("heading", { name: validation.blockedStepHeading })
          ).toBeVisible();

          await page.getByRole("button", { name: "Next" }).click();

          const footer = page.getByRole("alert").filter({ hasText: validation.errorText });

          await expect(footer).toBeVisible();
          await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
          await expect(
            page.getByRole("heading", { name: validation.blockedStepHeading })
          ).toBeVisible();

          await validationFixByType[entry.type](page, { exerciseName: "" });

          await expect(footer).not.toBeVisible();
          await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
          await page.getByRole("button", { name: "Next" }).click();

          await expect(
            page.getByRole("heading", { name: validation.unblockedStepHeading }).first()
          ).toBeVisible();
          expect(writes).toHaveLength(0);
        }
      );
    }
  });
}

test(
  "mchoice edit round-trip persists an option change",
  { tag: ["@p1", "@exercises", "@editor-mchoice"] },
  async ({ page, scratchAssignment }, testInfo) => {
    await shimUsernameIntoEBookConfig(page);
    const exerciseName = await createMchoiceViaEditor(
      page,
      scratchAssignment.name,
      uniqueExerciseName(testInfo.workerIndex, "roundtrip")
    );

    const row = page.getByRole("row").filter({ hasText: exerciseName }).first();

    await row.getByRole("button", { name: "Edit exercise" }).click();

    await page.getByRole("button", { name: /Options$/ }).click();
    await typeIntoTipTap(tipTapEditors(page).first(), " extra");

    await page.getByRole("button", { name: /Preview$/ }).click();

    const updatePromise = page.waitForResponse(
      (response) =>
        response.url().includes(BATCH_UPDATE_API) && response.request().method() === "PUT"
    );

    await page.getByRole("button", { name: "Save" }).first().click();
    const updateResponse = await updatePromise;

    expect(updateResponse.ok()).toBe(true);
    expect(updateResponse.request().postData()).toContain("extra");

    await expect(page.getByText("Exercise updated")).toBeVisible();

    await row.getByRole("button", { name: "Edit exercise" }).click();
    await page.getByRole("button", { name: /Options$/ }).click();
    await expect(tipTapEditors(page).first()).toContainText("extra");
  }
);
