import { AxeBuilder } from "@axe-core/playwright";

import { gotoApp } from "../fixtures/appNav";
import { findGradableQuestion, gotoSplitView } from "../fixtures/grader";
import { expect, test } from "../fixtures/scratch";

const scan = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

const assertNoViolations = async (
  testInfo: import("@playwright/test").TestInfo,
  results: Awaited<ReturnType<typeof scan>>
) => {
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary
    }))
  }));

  await testInfo.attach("axe-accessibility-results", {
    body: JSON.stringify(violations, null, 2),
    contentType: "application/json"
  });

  expect(violations, "Expected the page to have no WCAG A/AA axe violations").toEqual([]);
};

test(
  "assignment list has no axe violations",
  { tag: ["@p2", "@a11y", "@assignments"] },
  async ({ page }, testInfo) => {
    await gotoApp(page, "/builder");
    await expect(page.getByRole("heading", { level: 1, name: "Assignments" })).toBeVisible();

    const results = await scan(page);

    await assertNoViolations(testInfo, results);
  }
);

test(
  "grader assignment list has no axe violations",
  { tag: ["@p2", "@a11y", "@grader"] },
  async ({ page }, testInfo) => {
    await gotoApp(page, "/grader");
    await expect(page.getByRole("heading", { level: 1, name: "Assignment grader" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Assignments" })).toBeAttached();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Assignments");
    await expect(
      page
        .locator('[data-tour="grader-assignment-picker"]')
        .or(page.getByText("No assignments yet"))
    ).toBeVisible();

    const results = await scan(page);

    await assertNoViolations(testInfo, results);
  }
);

test(
  "grader question list has no axe violations",
  { tag: ["@p2", "@a11y", "@grader", "@seeded"] },
  async ({ page }, testInfo) => {
    const target = await findGradableQuestion(page.request);

    await gotoApp(page, `/grader/${target.assignmentId}`);
    await expect(page.getByRole("region", { name: "Questions" })).toBeVisible();

    const results = await scan(page);

    await assertNoViolations(testInfo, results);
  }
);

test(
  "grader split view has no axe violations",
  { tag: ["@p2", "@a11y", "@grader", "@seeded"] },
  async ({ page }, testInfo) => {
    const target = await findGradableQuestion(page.request);

    await gotoSplitView(page, target);
    await expect(page.getByRole("complementary", { name: "Students" })).toBeVisible();
    await expect(page.locator('[data-tour="grader-grade-panel"]')).toBeVisible();

    const results = await scan(page);

    await assertNoViolations(testInfo, results);
  }
);

test(
  "grader gradebook has no axe violations",
  { tag: ["@p2", "@a11y", "@grader", "@gradebook"] },
  async ({ page }, testInfo) => {
    await gotoApp(page, "/gradebook");
    await expect(
      page.getByRole("heading", { level: 2, name: "Gradebook", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nothing to grade yet" }).or(page.getByRole("table"))
    ).toBeVisible();

    const results = await scan(page);

    await assertNoViolations(testInfo, results);
  }
);
