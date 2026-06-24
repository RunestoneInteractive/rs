import {
  APIRequestContext,
  Browser,
  BrowserContext,
  Page,
  expect,
  request as playwrightRequest
} from "@playwright/test";

import { BACKEND_URL } from "../playwright.config";

export const CYCLE_STUDENTS = ["testuser2", "testuser3", "testuser4"] as const;

export type CycleStudent = (typeof CYCLE_STUDENTS)[number];

const STUDENT_PASSWORD = "xxx";
const LOGIN_PATH = "/runestone/default/user/login";
const DO_ASSIGNMENT_PATH = "/assignment/student/doAssignment";

const STUDENT_SETUP_HINT =
  "Create testuser2..testuser4 with password 'xxx' and enroll them in the 'overview' " +
  "course (see e2e/README.md, section 'Cycle students').";

const extractFormkey = (html: string): string => {
  const match = html.match(/name="_formkey"[^>]*value="([^"]+)"/);
  if (!match) {
    throw new Error(`Login form has no _formkey. ${STUDENT_SETUP_HINT}`);
  }
  return match[1];
};

export const loginAsStudent = async (username: CycleStudent): Promise<APIRequestContext> => {
  const context = await playwrightRequest.newContext({
    baseURL: BACKEND_URL,
    storageState: { cookies: [], origins: [] }
  });
  const formPage = await context.get(LOGIN_PATH);
  const formkey = extractFormkey(await formPage.text());
  const response = await context.post(LOGIN_PATH, {
    form: {
      username,
      password: STUDENT_PASSWORD,
      _formkey: formkey,
      _formname: "login"
    }
  });
  const body = await response.text();

  if (!response.ok() || /Invalid login/i.test(body)) {
    await context.dispose();
    throw new Error(`Could not log in as ${username}. ${STUDENT_SETUP_HINT}`);
  }
  return context;
};

export interface StudentBrowser {
  context: BrowserContext;
  page: Page;
}

export const openStudentBook = async (
  browser: Browser,
  username: CycleStudent
): Promise<StudentBrowser> => {
  const context = await browser.newContext({
    baseURL: BACKEND_URL,
    storageState: { cookies: [], origins: [] }
  });
  const page = await context.newPage();

  await page.goto(LOGIN_PATH);
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForLoadState("networkidle");

  if (/\/user\/login/.test(page.url())) {
    await context.close();
    throw new Error(`Could not log in as ${username}. ${STUDENT_SETUP_HINT}`);
  }
  return { context, page };
};

export interface AnswerMchoiceInput {
  assignmentId: number;
  divId: string;
  correct: boolean;
}

export const answerMchoiceInBook = async (page: Page, input: AnswerMchoiceInput): Promise<void> => {
  const { assignmentId, divId, correct } = input;

  await page.goto(`${DO_ASSIGNMENT_PATH}?assignment_id=${assignmentId}`);
  await page.waitForLoadState("networkidle");

  const question = page.locator(`#${divId}`);

  await expect(question, `mchoice ${divId} did not render in the book reader`).toBeVisible({
    timeout: 30_000
  });

  const choices = question.getByRole("radio");

  await choices.first().waitFor({ state: "visible", timeout: 30_000 });
  await choices.nth(correct ? 0 : 1).check();

  await question.getByRole("button", { name: "Check Me" }).click();

  const feedback = page.locator(`#${divId}_feedback`);

  await expect(feedback, `mchoice ${divId} did not report a result in the book reader`).toHaveClass(
    correct ? /alert-info/ : /alert-danger/,
    { timeout: 30_000 }
  );
};
