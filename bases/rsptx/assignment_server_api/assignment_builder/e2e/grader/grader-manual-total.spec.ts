import { APIRequestContext, expect, test } from "@playwright/test";

import { gotoApp } from "../fixtures/appNav";
import { createCycleAssignment, createCycleMchoice } from "../fixtures/authorAssignment";
import { deleteAssignmentViaApi } from "../fixtures/scratch";
import { CYCLE_STUDENTS } from "../fixtures/students";

const RUN_ID = Date.now().toString(36);

interface GradebookPayload {
  assignments: { id: number; name: string }[];
  students: { sid: string; name: string }[];
  cells: { sid: string; assignment_id: number; score: number | null; manual_total?: boolean }[];
}

const fetchGradebook = async (request: APIRequestContext): Promise<GradebookPayload> => {
  const response = await request.get("/assignment/instructor/grader/gradebook/data");

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { detail: GradebookPayload };
  return body.detail;
};

const cellFor = (gb: GradebookPayload, sid: string, assignmentId: number) =>
  gb.cells.find((c) => c.sid === sid && c.assignment_id === assignmentId);

test(
  "a manual total survives recompute and revert recomputes it",
  { tag: ["@p1", "@grader", "@manual"] },
  async ({ page }, testInfo) => {
    test.slow();

    const divId = `e2e_mt_q_${testInfo.workerIndex}_${RUN_ID}`;
    const assignmentName = `e2e-${testInfo.workerIndex}-${RUN_ID}-manual`;
    const sid = CYCLE_STUDENTS[0];

    let assignmentId: number | undefined;

    try {
      assignmentId = await createCycleAssignment(page, assignmentName);
      const question = await createCycleMchoice(
        page,
        { id: assignmentId, name: assignmentName },
        { name: divId }
      );
      expect(question.id).toBeGreaterThan(0);

      const before = await fetchGradebook(page.request);
      const student = before.students.find((s) => s.sid === sid);
      if (!student) {
        test.skip(true, `cycle student ${sid} not enrolled; run the S2 seed`);
        return;
      }

      await gotoApp(page, "/grader/gradebook");
      await expect(page.getByRole("table", { name: "Gradebook" })).toBeVisible();

      const cellButton = page.getByRole("button", {
        name: `Edit total for ${student.name} on ${assignmentName}`
      });
      await cellButton.scrollIntoViewIfNeeded();
      await cellButton.click();

      await page.getByLabel("Manual total").fill("42");
      await page.getByRole("button", { name: "Set total" }).click();
      await expect(page.getByText(/Manual total set/i)).toBeVisible();

      const afterSet = await fetchGradebook(page.request);
      const setCell = cellFor(afterSet, sid, assignmentId);
      expect(setCell?.score).toBe(42);
      expect(setCell?.manual_total).toBe(true);

      const recompute = await page.request.post("/assignment/instructor/grader/recompute_totals", {
        data: { assignment_id: assignmentId, sids: [sid] }
      });
      expect(recompute.ok()).toBe(true);

      const afterRecompute = await fetchGradebook(page.request);
      const survivedCell = cellFor(afterRecompute, sid, assignmentId);
      expect(survivedCell?.score, "manual total should survive recompute").toBe(42);
      expect(survivedCell?.manual_total).toBe(true);

      await cellButton.scrollIntoViewIfNeeded();
      await cellButton.click();
      await page.getByRole("button", { name: "Revert to computed" }).click();
      await expect(page.getByText(/Reverted to computed/i)).toBeVisible();

      const afterRevert = await fetchGradebook(page.request);
      const revertedCell = cellFor(afterRevert, sid, assignmentId);
      expect(revertedCell?.score, "revert should recompute the total").toBe(0);
      expect(revertedCell?.manual_total).toBe(false);
    } finally {
      if (assignmentId !== undefined) {
        await deleteAssignmentViaApi(page.request, assignmentId);
      }
    }
  }
);
