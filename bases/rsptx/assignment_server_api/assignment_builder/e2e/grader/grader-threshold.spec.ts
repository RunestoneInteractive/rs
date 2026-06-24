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

const QUESTION_POINTS = 5;
const GRADED_SCORE = 4;
const THRESHOLD_PERCENT = 70;

interface GradebookCell {
  sid: string;
  assignment_id: number;
  score: number | null;
}

const fetchCellScore = async (
  request: APIRequestContext,
  assignmentId: number,
  sid: string
): Promise<number | null> => {
  const response = await request.get("/assignment/instructor/grader/gradebook/data");

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: { cells: GradebookCell[] } };
  const cell = body.detail.cells.find((c) => c.assignment_id === assignmentId && c.sid === sid);

  return cell ? cell.score : null;
};

const recompute = async (
  request: APIRequestContext,
  assignmentId: number,
  sid: string
): Promise<void> => {
  const response = await request.post("/assignment/instructor/grader/recompute_totals", {
    data: { assignment_id: assignmentId, sids: [sid] }
  });

  expect(response.ok()).toBe(true);
};

test(
  "threshold scoring bumps a student above the cutoff to full points on recompute",
  { tag: ["@p1", "@grader", "@threshold"] },
  async ({ page, browser }, testInfo) => {
    test.slow();

    const sid = CYCLE_STUDENTS[0];
    const divId = `e2e_thr_q_${testInfo.workerIndex}_${RUN_ID}`;
    const assignmentName = `e2e-${testInfo.workerIndex}-${RUN_ID}-threshold`;

    let book: StudentBrowser | undefined;

    try {
      book = await openStudentBook(browser, sid);
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
        { name: divId, points: QUESTION_POINTS }
      );
      expect(question.id).toBeGreaterThan(0);

      await setAssignmentVisible(page, assignmentName);
      await answerMchoiceInBook(book.page, { assignmentId, divId, correct: true });

      const gradeResponse = await page.request.post("/assignment/instructor/grader/grade", {
        data: { sid, div_id: divId, score: GRADED_SCORE, comment: "" }
      });
      expect(gradeResponse.ok()).toBe(true);

      await recompute(page.request, assignmentId, sid);
      expect(await fetchCellScore(page.request, assignmentId, sid)).toBe(GRADED_SCORE);

      await gotoApp(page, "/grader");
      await page.getByText(assignmentName, { exact: true }).first().click();
      await page.waitForURL(new RegExp(`/grader/${assignmentId}$`));

      const thresholdButton = page.getByRole("button", { name: "Threshold", exact: true });
      await thresholdButton.waitFor({ state: "visible", timeout: 30_000 });
      await thresholdButton.click();

      await page.getByLabel("Threshold percentage").fill(String(THRESHOLD_PERCENT));
      await page.getByRole("button", { name: "Set threshold" }).click();

      const modal = page.getByRole("dialog", { name: "Set threshold scoring" });
      const setThresholdResponse = page.waitForResponse(
        (r) => r.url().includes("/grader/threshold") && r.request().method() === "POST"
      );
      await modal.getByRole("button", { name: "Set threshold" }).click();
      await setThresholdResponse;
      await expect(modal).toBeHidden();

      await recompute(page.request, assignmentId, sid);
      expect(await fetchCellScore(page.request, assignmentId, sid)).toBe(QUESTION_POINTS);

      await page.getByRole("button", { name: /Threshold 70/ }).click();
      const clearThresholdResponse = page.waitForResponse(
        (r) => r.url().includes("/grader/threshold") && r.request().method() === "POST"
      );
      await page.getByRole("button", { name: "Clear" }).click();
      await clearThresholdResponse;

      await recompute(page.request, assignmentId, sid);
      expect(await fetchCellScore(page.request, assignmentId, sid)).toBe(GRADED_SCORE);
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
