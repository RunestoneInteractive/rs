import { APIRequestContext, Page, expect, test } from "@playwright/test";

import { gotoApp } from "../fixtures/appNav";
import {
  CycleQuestion,
  createCycleAssignment,
  createCycleMchoice
} from "../fixtures/authorAssignment";
import { deleteAssignmentViaApi, setAssignmentVisible } from "../fixtures/scratch";
import {
  CYCLE_STUDENTS,
  StudentBrowser,
  answerMchoiceInBook,
  openStudentBook
} from "../fixtures/students";

const RUN_ID = Date.now().toString(36);

const QUESTION_POINTS = 5;
const CORRECT_GRADE = 3;
const PARTIAL_GRADE = 4;
const MANUAL_OVERRIDE = 99;
const THRESHOLD_PERCENT = 70;

interface GraderQuestionStat {
  name: string;
  answered_count: number;
  correct_count: number;
}

interface GraderAnswer {
  sid: string;
  score: number | null;
}

interface AssignmentRow {
  id: number;
  released: boolean;
}

interface GradebookCell {
  sid: string;
  assignment_id: number;
  score: number | null;
  manual_total?: boolean;
}

interface GradebookStudent {
  sid: string;
  name: string;
}

interface GradebookPayload {
  students: GradebookStudent[];
  cells: GradebookCell[];
}

const fetchQuestionStat = async (
  request: APIRequestContext,
  assignmentId: number,
  divId: string
): Promise<GraderQuestionStat> => {
  const response = await request.get(
    `/assignment/instructor/grader/assignments/${assignmentId}/questions`
  );

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: { questions: GraderQuestionStat[] } };
  const stat = body.detail.questions.find((q) => q.name === divId);

  expect(stat, `Question ${divId} missing from grader stats`).toBeTruthy();
  return stat!;
};

const fetchAnswerScore = async (
  request: APIRequestContext,
  assignmentId: number,
  question: CycleQuestion,
  sid: string
): Promise<number | null> => {
  const response = await request.get(
    `/assignment/instructor/grader/questions/answers?assignment_id=${assignmentId}&question_id=${question.id}`
  );

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: { answers: GraderAnswer[] } };
  const answer = body.detail.answers.find((a) => a.sid === sid);

  return answer ? answer.score : null;
};

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

const fetchGradebook = async (request: APIRequestContext): Promise<GradebookPayload> => {
  const response = await request.get("/assignment/instructor/grader/gradebook/data");

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: GradebookPayload };
  return body.detail;
};

const cellScore = (gb: GradebookPayload, sid: string, assignmentId: number): number | null => {
  const cell = gb.cells.find((c) => c.sid === sid && c.assignment_id === assignmentId);
  return cell ? cell.score : null;
};

const recompute = async (
  request: APIRequestContext,
  assignmentId: number,
  sids: string[]
): Promise<void> => {
  const response = await request.post("/assignment/instructor/grader/recompute_totals", {
    data: { assignment_id: assignmentId, sids }
  });

  expect(response.ok()).toBe(true);
};

const gradeInSplitView = async (
  page: Page,
  assignmentId: number,
  question: CycleQuestion,
  sid: string,
  score: number
): Promise<void> => {
  await gotoApp(page, `/grader/${assignmentId}/questions/${question.id}/students/${sid}`);
  await page.waitForURL(new RegExp(`/students/${sid}$`));

  const scoreInput = page.locator('[data-tour="grader-points-input"] input');

  await expect(scoreInput).toBeVisible();
  await scoreInput.fill(String(score));

  const pill = page.getByRole("status").filter({ hasText: /^(Unsaved|Saving…|Saved)$/ });

  await expect(pill).toHaveText(/Saved/, { timeout: 10_000 });
};

test(
  "the full author to answer to grade to release to gradebook loop persists end to end",
  { tag: ["@p1", "@grader", "@cycle", "@full"] },
  async ({ page, browser }, testInfo) => {
    test.slow();

    const correctSid = CYCLE_STUDENTS[0];
    const wrongSid = CYCLE_STUDENTS[1];
    const divId = `e2e_full_q_${testInfo.workerIndex}_${RUN_ID}`;
    const assignmentName = `e2e-${testInfo.workerIndex}-${RUN_ID}-fullcycle`;

    const books: StudentBrowser[] = [];

    try {
      books.push(await openStudentBook(browser, correctSid));
      books.push(await openStudentBook(browser, wrongSid));
    } catch (error) {
      await Promise.all(books.map((book) => book.context.close()));
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

      await answerMchoiceInBook(books[0].page, { assignmentId, divId, correct: true });
      await answerMchoiceInBook(books[1].page, { assignmentId, divId, correct: false });

      const stat = await fetchQuestionStat(page.request, assignmentId, divId);

      expect(stat.answered_count, "both students submitted").toBe(2);
      expect(stat.correct_count, "only the correct submission counts").toBe(1);

      await gradeInSplitView(page, assignmentId, question, correctSid, CORRECT_GRADE);
      await expect
        .poll(() => fetchAnswerScore(page.request, assignmentId!, question, correctSid))
        .toBe(CORRECT_GRADE);

      await gradeInSplitView(page, assignmentId, question, wrongSid, PARTIAL_GRADE);
      await expect
        .poll(() => fetchAnswerScore(page.request, assignmentId!, question, wrongSid))
        .toBe(PARTIAL_GRADE);

      await recompute(page.request, assignmentId, [correctSid, wrongSid]);
      const afterGrade = await fetchGradebook(page.request);
      expect(cellScore(afterGrade, correctSid, assignmentId)).toBe(CORRECT_GRADE);
      expect(cellScore(afterGrade, wrongSid, assignmentId)).toBe(PARTIAL_GRADE);

      await gotoApp(page, "/grader");
      await page.getByText(assignmentName, { exact: true }).first().click();
      await page.waitForURL(new RegExp(`/grader/${assignmentId}$`));

      const releaseInitial = await fetchReleased(page.request, assignmentId);
      const toggle = page.getByRole("switch", { name: "Release grades to students" });
      const toggleControl = toggle.locator(
        "xpath=ancestor::*[contains(@class,'mantine-Switch-root')][1]"
      );

      await toggle.waitFor({ state: "attached", timeout: 30_000 });
      await expect(toggleControl).toBeVisible();
      await expect(toggle).toBeChecked({ checked: releaseInitial });

      await toggleControl.click();
      const releaseDialog = page.getByRole("dialog");
      await releaseDialog
        .getByRole("button", { name: releaseInitial ? "Hide" : "Release" })
        .click();
      await expect(releaseDialog).toBeHidden();
      await expect(toggle).toBeChecked({ checked: !releaseInitial });
      await expect.poll(() => fetchReleased(page.request, assignmentId!)).toBe(!releaseInitial);

      const thresholdButton = page.getByRole("button", { name: "Threshold", exact: true });
      await thresholdButton.waitFor({ state: "visible", timeout: 30_000 });
      await thresholdButton.click();
      await page.getByLabel("Threshold percentage").fill(String(THRESHOLD_PERCENT));
      await page.getByRole("button", { name: "Set threshold" }).click();
      const thresholdModal = page.getByRole("dialog", { name: "Set threshold scoring" });
      const setThresholdResponse = page.waitForResponse(
        (r) => r.url().includes("/grader/threshold") && r.request().method() === "POST"
      );
      await thresholdModal.getByRole("button", { name: "Set threshold" }).click();
      await setThresholdResponse;
      await expect(thresholdModal).toBeHidden();

      await recompute(page.request, assignmentId, [correctSid, wrongSid]);
      const afterThreshold = await fetchGradebook(page.request);
      expect(
        cellScore(afterThreshold, wrongSid, assignmentId),
        "0.8 of points clears the 70% threshold and is bumped to full"
      ).toBe(QUESTION_POINTS);
      expect(cellScore(afterThreshold, correctSid, assignmentId)).toBe(CORRECT_GRADE);

      await page
        .getByRole("button", { name: new RegExp(`Threshold ${THRESHOLD_PERCENT}`) })
        .click();
      const clearThresholdResponse = page.waitForResponse(
        (r) => r.url().includes("/grader/threshold") && r.request().method() === "POST"
      );
      await page.getByRole("button", { name: "Clear" }).click();
      await clearThresholdResponse;
      await recompute(page.request, assignmentId, [correctSid, wrongSid]);
      expect(cellScore(await fetchGradebook(page.request), wrongSid, assignmentId)).toBe(
        PARTIAL_GRADE
      );

      const gradebook = await fetchGradebook(page.request);
      const wrongStudent = gradebook.students.find((s) => s.sid === wrongSid);
      expect(wrongStudent, `cycle student ${wrongSid} not enrolled; run the S2 seed`).toBeTruthy();

      await gotoApp(page, "/grader/gradebook");
      await expect(page.getByRole("table", { name: "Gradebook" })).toBeVisible();

      const cellButton = page.getByRole("button", {
        name: `Edit total for ${wrongStudent!.name} on ${assignmentName}`
      });
      await cellButton.scrollIntoViewIfNeeded();
      await cellButton.click();
      await page.getByLabel("Manual total").fill(String(MANUAL_OVERRIDE));
      await page.getByRole("button", { name: "Set total" }).click();
      await expect(page.getByText(/Manual total set/i)).toBeVisible();

      const afterOverride = await fetchGradebook(page.request);
      const overrideCell = afterOverride.cells.find(
        (c) => c.sid === wrongSid && c.assignment_id === assignmentId
      );
      expect(overrideCell?.score).toBe(MANUAL_OVERRIDE);
      expect(overrideCell?.manual_total).toBe(true);

      await recompute(page.request, assignmentId, [wrongSid]);
      const afterManualRecompute = await fetchGradebook(page.request);
      expect(
        cellScore(afterManualRecompute, wrongSid, assignmentId),
        "manual total survives recompute"
      ).toBe(MANUAL_OVERRIDE);

      await cellButton.scrollIntoViewIfNeeded();
      await cellButton.click();
      await page.getByRole("button", { name: "Revert to computed" }).click();
      await expect(page.getByText(/Reverted to computed/i)).toBeVisible();
      expect(cellScore(await fetchGradebook(page.request), wrongSid, assignmentId)).toBe(
        PARTIAL_GRADE
      );

      const csvResponse = await page.request.get("/assignment/instructor/grader/gradebook.csv");
      expect(csvResponse.ok()).toBe(true);
      expect(csvResponse.headers()["content-type"]).toContain("text/csv");
      const csv = await csvResponse.text();
      expect(csv.split("\n")[0]).toMatch(/^Student,.*Total/);
    } finally {
      await Promise.all(books.map((book) => book.context.close()));
      if (assignmentId !== undefined) {
        await deleteAssignmentViaApi(page.request, assignmentId);
      }
    }
  }
);
