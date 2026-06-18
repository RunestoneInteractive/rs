import { APIRequestContext, expect, test } from "@playwright/test";

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

const MANUAL_SCORE = 4;

interface GraderQuestionStat {
  name: string;
  answered_count: number;
  correct_count: number;
}

interface GraderAnswer {
  sid: string;
  score: number | null;
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

const fetchStudentScore = async (
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

  expect(answer, `Answer for ${sid} missing from grader read-back`).toBeTruthy();
  return answer!.score;
};

test(
  "a real author to answer to grade cycle reaches the grader and persists a manual grade",
  { tag: ["@p1", "@grader", "@cycle"] },
  async ({ page, browser }, testInfo) => {
    test.slow();

    const divId = `e2e_cycle_q_${testInfo.workerIndex}_${RUN_ID}`;
    const assignmentName = `e2e-${testInfo.workerIndex}-${RUN_ID}-cycle`;

    const answers = [
      { student: CYCLE_STUDENTS[0], correct: true },
      { student: CYCLE_STUDENTS[1], correct: true },
      { student: CYCLE_STUDENTS[2], correct: false }
    ];

    const books: StudentBrowser[] = [];

    try {
      for (const { student } of answers) {
        books.push(await openStudentBook(browser, student));
      }
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
        { name: divId }
      );

      await setAssignmentVisible(page, assignmentName);

      for (let i = 0; i < answers.length; i += 1) {
        await answerMchoiceInBook(books[i].page, {
          assignmentId,
          divId,
          correct: answers[i].correct
        });
      }

      const stat = await fetchQuestionStat(page.request, assignmentId, divId);

      expect(stat.answered_count).toBe(3);
      expect(stat.correct_count).toBe(2);

      await gotoApp(
        page,
        `/grader/${assignmentId}/questions/${question.id}/students/${CYCLE_STUDENTS[2]}`
      );
      await page.waitForURL(new RegExp(`/students/${CYCLE_STUDENTS[2]}$`));

      const scoreInput = page.locator('[data-tour="grader-points-input"] input');

      await expect(scoreInput).toBeVisible();
      await scoreInput.fill(String(MANUAL_SCORE));

      const pill = page.getByRole("status").filter({ hasText: /^(Unsaved|Saving…|Saved)$/ });

      await expect(pill).toHaveText(/Saved/, { timeout: 10_000 });

      const persistedScore = await fetchStudentScore(
        page.request,
        assignmentId,
        question,
        CYCLE_STUDENTS[2]
      );

      expect(persistedScore).toBe(MANUAL_SCORE);
    } finally {
      await Promise.all(books.map((book) => book.context.close()));
      if (assignmentId !== undefined) {
        await deleteAssignmentViaApi(page.request, assignmentId);
      }
    }
  }
);
