import { APIRequestContext, Page } from "@playwright/test";

import { gotoApp } from "./appNav";

export interface GradableQuestion {
  assignmentId: number;
  assignmentName: string;
  questionId: number;
  questionName: string;
  answeredCount: number;
}

const SEEDED_ASSIGNMENT_IDS = [1, 2, 3, 4, 5, 7, 8];

const graderQuestionsApi = (assignmentId: number) =>
  `/assignment/instructor/grader/assignments/${assignmentId}/questions`;

interface GraderQuestionsDetail {
  assignment: { id: number; name: string };
  questions: Array<{ id: number; name: string; question_type: string; answered_count: number }>;
}

export const findGradableQuestion = async (
  request: APIRequestContext,
  minStudents = 2
): Promise<GradableQuestion> => {
  for (const assignmentId of SEEDED_ASSIGNMENT_IDS) {
    const res = await request.get(graderQuestionsApi(assignmentId));
    if (!res.ok()) continue;
    const body = (await res.json()) as { detail?: GraderQuestionsDetail };
    const detail = body.detail;
    if (!detail?.questions?.length) continue;
    const hit = detail.questions.find((q) => q.answered_count >= minStudents);
    if (hit) {
      return {
        assignmentId,
        assignmentName: detail.assignment.name,
        questionId: hit.id,
        questionName: hit.name,
        answeredCount: hit.answered_count
      };
    }
  }
  throw new Error(
    `No seeded question with >= ${minStudents} student submissions found in assignments ` +
      `${SEEDED_ASSIGNMENT_IDS.join(", ")} — the grader read-only suite needs restored seed data.`
  );
};

const READ_MODELED_POSTS = ["assignment_questions", "exercises/search"];

export const trackInstructorWrites = (page: Page): string[] => {
  const writes: string[] = [];

  page.on("request", (request) => {
    const method = request.method();
    if (method !== "POST" && method !== "PUT" && method !== "DELETE") return;
    const url = request.url();
    if (!url.includes("/assignment/instructor/")) return;
    if (method === "POST" && READ_MODELED_POSTS.some((fragment) => url.includes(fragment))) return;
    writes.push(`${method} ${url}`);
  });

  return writes;
};

export const gotoSplitView = async (
  page: Page,
  target: Pick<GradableQuestion, "assignmentId" | "questionId">
): Promise<void> => {
  await gotoApp(page, `/grader/${target.assignmentId}/questions/${target.questionId}`);
  await page.waitForURL(
    new RegExp(`/grader/${target.assignmentId}/questions/${target.questionId}/students/`)
  );
};

export const activeStudentSid = (page: Page): string => {
  const match = page.url().match(/\/students\/([^/?#]+)/);
  if (!match) throw new Error(`No student sid in URL: ${page.url()}`);
  return decodeURIComponent(match[1]);
};
