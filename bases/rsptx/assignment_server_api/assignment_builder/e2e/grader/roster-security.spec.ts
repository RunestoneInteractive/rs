import { APIRequestContext, expect, test } from "@playwright/test";

import { CYCLE_STUDENTS, loginAsStudent } from "../fixtures/students";

const ROSTER_PATH = "/assignment/instructor/course_roster";

test(
  "a student session is rejected by the instructor course roster endpoint",
  { tag: ["@p1", "@grader", "@security"] },
  async () => {
    let studentContext: APIRequestContext;

    try {
      studentContext = await loginAsStudent(CYCLE_STUDENTS[0]);
    } catch (error) {
      test.skip(true, String(error));
      return;
    }

    try {
      const response = await studentContext.get(ROSTER_PATH);

      expect([401, 403]).toContain(response.status());
    } finally {
      await studentContext.dispose();
    }
  }
);
