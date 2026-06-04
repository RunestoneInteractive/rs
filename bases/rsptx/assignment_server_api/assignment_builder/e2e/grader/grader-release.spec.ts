import { APIRequestContext, expect, test } from "@playwright/test";

import { gotoApp } from "../fixtures/appNav";
import { createCycleAssignment, createCycleMchoice } from "../fixtures/authorAssignment";
import { deleteAssignmentViaApi, setAssignmentVisible } from "../fixtures/scratch";
import {
  CYCLE_STUDENTS,
  StudentBrowser,
  answerMchoiceInBook,
  openStudentBook
} from "../fixtures/students";

const RUN_ID = Date.now().toString(36);

interface AssignmentRow {
  id: number;
  released: boolean;
}

const fetchReleased = async (
  request: APIRequestContext,
  assignmentId: number
): Promise<boolean> => {
  const response = await request.get("/assignment/instructor/assignments");

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: { assignments: AssignmentRow[] } };
  const row = body.detail.assignments.find((a) => a.id === assignmentId);

  expect(row, `Assignment ${assignmentId} missing from the instructor list`).toBeTruthy();
  return row!.released;
};

test(
  "releasing grades through the grader UI flips Assignment.released both ways",
  { tag: ["@p1", "@grader", "@release"] },
  async ({ page, browser }, testInfo) => {
    test.slow();

    const divId = `e2e_release_q_${testInfo.workerIndex}_${RUN_ID}`;
    const assignmentName = `e2e-${testInfo.workerIndex}-${RUN_ID}-release`;

    let book: StudentBrowser | undefined;

    try {
      book = await openStudentBook(browser, CYCLE_STUDENTS[0]);
    } catch (error) {
      test.skip(true, String(error));
      return;
    }

    let assignmentId: number | undefined;

    try {
      assignmentId = await createCycleAssignment(page, assignmentName);
      const question = await createCycleMchoice(
        page,
        { id: assignmentId, name: assignmentName },
        { name: divId }
      );
      expect(question.id).toBeGreaterThan(0);

      await setAssignmentVisible(page, assignmentName);
      await answerMchoiceInBook(book.page, { assignmentId, divId, correct: true });

      const initial = await fetchReleased(page.request, assignmentId);

      await gotoApp(page, "/grader");
      await page.getByText(assignmentName, { exact: true }).first().click();
      await page.waitForURL(new RegExp(`/grader/${assignmentId}$`));

      const toggle = page.getByRole("switch", { name: "Release grades to students" });
      const toggleControl = toggle.locator(
        "xpath=ancestor::*[contains(@class,'mantine-Switch-root')][1]"
      );

      await toggle.waitFor({ state: "attached", timeout: 30_000 });
      await expect(toggleControl).toBeVisible();
      await expect(toggle).toBeChecked({ checked: initial });

      const flip = async (target: boolean) => {
        await toggleControl.click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: target ? "Release" : "Hide" }).click();
        await expect(dialog).toBeHidden();
        await expect(toggle).toBeChecked({ checked: target });
        await expect.poll(() => fetchReleased(page.request, assignmentId!)).toBe(target);
      };

      await flip(!initial);
      await flip(initial);
    } finally {
      if (book) {
        await book.context.close();
      }
      if (assignmentId !== undefined) {
        await deleteAssignmentViaApi(page.request, assignmentId);
      }
    }
  }
);
