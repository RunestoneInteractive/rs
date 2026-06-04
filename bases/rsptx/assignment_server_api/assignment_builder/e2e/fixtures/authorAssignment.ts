import { Page, expect } from "@playwright/test";

import { createMchoiceViaEditor } from "./exercises";
import { createAssignmentViaWizard } from "./scratch";

const GRADER_QUESTIONS_API = (assignmentId: number) =>
  `/assignment/instructor/grader/assignments/${assignmentId}/questions`;

const DEFAULT_QUESTION_POINTS = 5;

export interface CycleAssignment {
  id: number;
  name: string;
}

export interface CycleQuestion {
  id: number;
  name: string;
}

interface GraderQuestionsBody {
  detail: { questions: Array<{ id: number; name: string }> };
}

export const createCycleAssignment = async (page: Page, name: string): Promise<number> =>
  createAssignmentViaWizard(page, name);

export interface CreateCycleMchoiceOptions {
  name?: string;
  points?: number;
}

export const createCycleMchoice = async (
  page: Page,
  assignment: CycleAssignment,
  options: CreateCycleMchoiceOptions = {}
): Promise<CycleQuestion> => {
  const { name, points = DEFAULT_QUESTION_POINTS } = options;
  const divId = await createMchoiceViaEditor(page, assignment.name, name, points);

  const response = await page.request.get(GRADER_QUESTIONS_API(assignment.id));

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as GraderQuestionsBody;
  const question = body.detail.questions.find((q) => q.name === divId);

  expect(question, `Created question ${divId} not found in the grader`).toBeTruthy();

  return { id: question!.id, name: divId };
};
