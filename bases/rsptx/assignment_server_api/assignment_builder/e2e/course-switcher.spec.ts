import { APIRequestContext, expect, test } from "@playwright/test";

import { gotoApp } from "./fixtures/appNav";
import { findGradableQuestion, gotoSplitView } from "./fixtures/grader";

interface InstructorCourse {
  course_name: string;
  is_current: boolean;
}

const SWITCH_ENDPOINT = "/assignment/instructor/courses/switch";
const HISTORY_COURSE_KEY = "__runestoneCourse";
const ACTIVE_COURSE_KEY = "assignment-builder.active-course";
const COURSE_SWITCH_ENABLED = process.env.E2E_COURSE_SWITCH === "1";
const REQUESTED_NESTED_PATH = process.env.E2E_COURSE_SWITCH_PATH;
const RESTORE_COURSE = process.env.E2E_RESTORE_COURSE;

const switchCourseViaApi = async (request: APIRequestContext, course: string) => {
  const response = await request.post(SWITCH_ENDPOINT, { data: { course_name: course } });

  expect(response.ok()).toBe(true);
};

test(
  "course switching keeps Back and Forward on the new grader course",
  { tag: ["@p1", "@grader", "@course-switcher"] },
  async ({ page, request }) => {
    test.setTimeout(90_000);
    test.skip(
      !COURSE_SWITCH_ENABLED,
      "Set E2E_COURSE_SWITCH=1 and run this file alone with --workers=1; it changes shared user state."
    );

    const coursesResponse = await request.get("/assignment/instructor/courses/recent");

    expect(coursesResponse.ok()).toBe(true);
    const coursesBody = (await coursesResponse.json()) as {
      detail: { courses: InstructorCourse[] };
    };
    const original = coursesBody.detail.courses.find(({ is_current }) => is_current);

    test.skip(
      !original || coursesBody.detail.courses.length < 2,
      "The E2E instructor must teach at least two courses."
    );

    let source: InstructorCourse | undefined;
    let question: Awaited<ReturnType<typeof findGradableQuestion>> | undefined;

    try {
      for (const course of coursesBody.detail.courses) {
        await switchCourseViaApi(request, course.course_name);

        try {
          question = await findGradableQuestion(request, 1);
          source = course;
          break;
        } catch {
          // Try the next recent course; local E2E data may be course-specific.
        }
      }

      if (!source || !question) {
        throw new Error("At least one recent course must contain gradable test data.");
      }

      const target = coursesBody.detail.courses.find(
        ({ course_name }) => course_name !== source.course_name
      );

      if (!target) throw new Error("A second recent course is required for course switching.");

      const requestedNestedPath = REQUESTED_NESTED_PATH;

      await page.goto("/ns/course/index");
      await expect(page).toHaveURL(/\/ns\/course\/index\/?$/);
      await gotoApp(page, requestedNestedPath ?? `/grader/${question.assignmentId}`);
      await expect
        .poll(() => page.evaluate((key) => window.history.state?.[key], HISTORY_COURSE_KEY))
        .toBe(source.course_name);
      if (!requestedNestedPath) {
        await gotoSplitView(page, question);
        await expect
          .poll(() => page.evaluate((key) => window.history.state?.[key], HISTORY_COURSE_KEY))
          .toBe(source.course_name);
      }

      await page.getByRole("button", { name: `Course: ${source.course_name}` }).click();

      const switchResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(SWITCH_ENDPOINT) && response.request().method() === "POST"
      );

      await page.getByRole("menuitem", { name: target.course_name, exact: true }).click();
      expect((await switchResponse).ok()).toBe(true);

      await expect(page).toHaveURL(/\/assignment\/instructor\/grader\/?$/);
      await expect(
        page.getByRole("button", { name: `Course: ${target.course_name}` })
      ).toBeVisible();

      if (!requestedNestedPath) {
        await page.goBack({ waitUntil: "commit" });

        await expect
          .poll(() =>
            page
              .evaluate(
                ({ activeKey, historyKey }) => ({
                  configuredCourse: window.eBookConfig.course,
                  storedCourse: window.sessionStorage.getItem(activeKey),
                  historyCourse: window.history.state?.[historyKey]
                }),
                { activeKey: ACTIVE_COURSE_KEY, historyKey: HISTORY_COURSE_KEY }
              )
              .catch(() => null)
          )
          .toEqual({
            configuredCourse: target.course_name,
            storedCourse: target.course_name,
            historyCourse: target.course_name
          });
        await expect(page).toHaveURL(/\/assignment\/instructor\/grader\/?$/);
      }

      if (requestedNestedPath) {
        await page.goBack({ waitUntil: "domcontentloaded" });
      } else {
        for (let attempt = 0; attempt < 5 && !page.url().endsWith("/ns/course/index"); attempt++) {
          await page.goBack({ waitUntil: "domcontentloaded" });
        }
      }

      await expect(page).toHaveURL(/\/ns\/course\/index\/?$/);
      await page.goForward({ waitUntil: "commit" });
      await expect(page).toHaveURL(/\/assignment\/instructor\/grader\/?$/);
      await expect(
        page.getByRole("button", { name: `Course: ${target.course_name}` })
      ).toBeVisible();
      await expect
        .poll(() =>
          page
            .evaluate(
              ({ activeKey, historyKey }) => ({
                configuredCourse: window.eBookConfig.course,
                storedCourse: window.sessionStorage.getItem(activeKey),
                historyCourse: window.history.state?.[historyKey]
              }),
              { activeKey: ACTIVE_COURSE_KEY, historyKey: HISTORY_COURSE_KEY }
            )
            .catch(() => null)
        )
        .toEqual({
          configuredCourse: target.course_name,
          storedCourse: target.course_name,
          historyCourse: target.course_name
        });
      await expect
        .poll(async () => {
          const response = await request.get("/assignment/instructor/courses/recent");
          const body = (await response.json()) as {
            detail: { courses: InstructorCourse[] };
          };

          return body.detail.courses.find(({ is_current }) => is_current)?.course_name;
        })
        .toBe(target.course_name);

      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/ns\/course\/index\/?$/);
      await page.goForward({ waitUntil: "commit" });
      await expect(page).toHaveURL(/\/assignment\/instructor\/grader\/?$/);
      await expect(
        page.getByRole("button", { name: `Course: ${target.course_name}` })
      ).toBeVisible();
    } finally {
      const restoreCourse = RESTORE_COURSE ?? original?.course_name;

      if (restoreCourse) await switchCourseViaApi(request, restoreCourse);
    }
  }
);

for (const scenario of [
  {
    name: "nested builder",
    startPath: "/assignment/instructor/builder/22",
    destination: /\/assignment\/instructor\/builder\/?$/
  },
  {
    name: "gradebook",
    startPath: "/assignment/instructor/gradebook",
    destination: /\/assignment\/instructor\/grader\/?$/
  }
]) {
  test(
    `switching from ${scenario.name} uses the section landing page`,
    { tag: ["@p1", "@course-switcher"] },
    async ({ page, request }) => {
      test.skip(
        !COURSE_SWITCH_ENABLED,
        "Set E2E_COURSE_SWITCH=1 and run this file alone with --workers=1; it changes shared user state."
      );

      const coursesResponse = await request.get("/assignment/instructor/courses/recent");
      const coursesBody = (await coursesResponse.json()) as {
        detail: { courses: InstructorCourse[] };
      };
      const original = coursesBody.detail.courses.find(({ is_current }) => is_current);
      const target = coursesBody.detail.courses.find(({ is_current }) => !is_current);

      test.skip(!original || !target, "The E2E instructor must teach at least two courses.");

      try {
        await page.goto(scenario.startPath);
        await page.getByRole("button", { name: `Course: ${original!.course_name}` }).click();

        const switchResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith(SWITCH_ENDPOINT) && response.request().method() === "POST"
        );

        await page.getByRole("menuitem", { name: target!.course_name, exact: true }).click();
        expect((await switchResponse).ok()).toBe(true);
        await expect(page).toHaveURL(scenario.destination);
        await expect(
          page.getByRole("button", { name: `Course: ${target!.course_name}` })
        ).toBeVisible();
      } finally {
        const restoreCourse = RESTORE_COURSE ?? original?.course_name;

        if (restoreCourse) await switchCourseViaApi(request, restoreCourse);
      }
    }
  );
}
