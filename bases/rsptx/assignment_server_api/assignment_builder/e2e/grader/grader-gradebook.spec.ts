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

interface GradebookPayload {
  assignments: { id: number; name: string }[];
  students: { sid: string; name: string }[];
  cells: { sid: string; assignment_id: number; score: number | null }[];
  averages: Record<string, number | null>;
}

const fetchGradebook = async (request: APIRequestContext): Promise<GradebookPayload> => {
  const response = await request.get("/assignment/instructor/grader/gradebook/data");

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: GradebookPayload };
  return body.detail;
};

test(
  "the gradebook renders the assignment matrix and exports CSV",
  { tag: ["@p1", "@grader", "@gradebook"] },
  async ({ page, browser }, testInfo) => {
    test.slow();

    const divId = `e2e_gb_q_${testInfo.workerIndex}_${RUN_ID}`;
    const assignmentName = `e2e-${testInfo.workerIndex}-${RUN_ID}-gradebook`;

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

      const gradebook = await fetchGradebook(page.request);
      expect(
        gradebook.assignments.some((a) => a.name === assignmentName),
        "scratch assignment missing from the gradebook matrix"
      ).toBe(true);
      expect(
        gradebook.assignments.length,
        "seeded assignments missing from the gradebook matrix"
      ).toBeGreaterThan(1);
      expect(
        gradebook.students.length,
        "enrolled students missing from the gradebook matrix"
      ).toBeGreaterThan(0);

      await gotoApp(page, "/grader/gradebook");

      await expect(page.getByRole("table", { name: "Gradebook" })).toBeVisible();
      await expect(page.getByText(assignmentName, { exact: false }).first()).toBeVisible();
      await expect(page.getByText("Class average")).toBeVisible();

      // Filtering rows by student name, and clearing it again.
      const studentFilter = page.getByLabel("Filter students by name");

      await studentFilter.fill("zzz-no-such-student");
      await expect(page.getByText("Nothing matches these filters")).toBeVisible();
      await studentFilter.fill("");
      await expect(page.getByRole("table", { name: "Gradebook" })).toBeVisible();

      // Clicking a cell drills down into that student's question-by-question
      // scores for that assignment.
      const student = gradebook.students.find((s) => s.sid === CYCLE_STUDENTS[0]);

      if (student) {
        const cell = page.getByRole("button", {
          name: `Show details for ${student.name} on ${assignmentName}`
        });

        await cell.scrollIntoViewIfNeeded();
        await cell.click();
        await expect(page.getByRole("table", { name: "Question scores" })).toBeVisible();
        await expect(page.getByText(/Assignment total/)).toBeVisible();
        await expect(page.getByLabel("Manual total")).toBeVisible();
        await page.keyboard.press("Escape");
      }

      const exportLink = page.getByRole("link", { name: /export csv/i });
      await expect(exportLink).toBeVisible();

      const downloadPromise = page.waitForEvent("download");
      await exportLink.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain(".csv");

      const csv = await page.request.get("/assignment/instructor/grader/gradebook.csv");
      expect(csv.ok()).toBe(true);
      expect(csv.headers()["content-type"]).toContain("text/csv");
      const firstLine = (await csv.text()).split("\n")[0];
      expect(firstLine).toContain("Student");
      expect(firstLine).toContain("Total");
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
