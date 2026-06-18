import { APIRequestContext, expect, test } from "@playwright/test";

import { createCycleMchoice } from "../fixtures/authorAssignment";
import {
  CYCLE_STUDENTS,
  StudentBrowser,
  answerMchoiceInBook,
  openStudentBook
} from "../fixtures/students";

const SEED_ASSIGNMENT_ID = 3;
const SEED_ASSIGNMENT_NAME = "Smoke Test Assignment";
const SEED_DIV_ID = "grader_seed_readonly";
const MIN_STUDENTS = 2;

const GRADER_QUESTIONS_API = `/assignment/instructor/grader/assignments/${SEED_ASSIGNMENT_ID}/questions`;

interface QuestionStat {
  id: number;
  name: string;
  answered_count: number;
}

const fetchQuestions = async (request: APIRequestContext): Promise<QuestionStat[]> => {
  const response = await request.get(GRADER_QUESTIONS_API);

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: { questions: QuestionStat[] } };

  return body.detail.questions;
};

test(
  "seeds a read-only grader question answered by at least two students",
  { tag: ["@grader", "@seed"] },
  async ({ page, browser }) => {
    test.slow();

    const existing = await fetchQuestions(page.request);

    if (existing.some((question) => question.answered_count >= MIN_STUDENTS)) {
      return;
    }

    if (!existing.some((question) => question.name === SEED_DIV_ID)) {
      await createCycleMchoice(
        page,
        { id: SEED_ASSIGNMENT_ID, name: SEED_ASSIGNMENT_NAME },
        { name: SEED_DIV_ID }
      );
    }

    const students = CYCLE_STUDENTS.slice(0, MIN_STUDENTS);
    const books: StudentBrowser[] = [];

    try {
      for (const student of students) {
        books.push(await openStudentBook(browser, student));
      }

      for (const book of books) {
        await answerMchoiceInBook(book.page, {
          assignmentId: SEED_ASSIGNMENT_ID,
          divId: SEED_DIV_ID,
          correct: true
        });
      }
    } finally {
      await Promise.all(books.map((book) => book.context.close()));
    }

    const seeded = (await fetchQuestions(page.request)).find(
      (question) => question.name === SEED_DIV_ID
    );

    expect(seeded, `seed question ${SEED_DIV_ID} missing after answering`).toBeTruthy();
    expect(seeded!.answered_count).toBeGreaterThanOrEqual(MIN_STUDENTS);
  }
);
