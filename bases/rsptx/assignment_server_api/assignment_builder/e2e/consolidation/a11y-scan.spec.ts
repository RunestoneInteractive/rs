import { AxeBuilder } from "@axe-core/playwright";

import { gotoApp } from "../fixtures/appNav";
import { findGradableQuestion, gotoSplitView } from "../fixtures/grader";
import { expect, test } from "../fixtures/scratch";

const scan = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

const reportViolations = async (
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

  if (violations.length > 0) {
    testInfo.annotations.push({
      type: "accessibility",
      description: `${violations.length} axe violation(s) reported; enforcement is not enabled yet`
    });
    console.warn(`axe reported ${violations.length} accessibility violation(s)`);
  }
};

test(
  "reports assignment list axe violations",
  { tag: ["@p2", "@a11y", "@assignments"] },
  async ({ page }, testInfo) => {
    await gotoApp(page, "/builder");
    await expect(page.getByRole("heading", { level: 1, name: "Assignments" })).toBeVisible();

    const results = await scan(page);

    await reportViolations(testInfo, results);
  }
);

test(
  "reports grader assignment list axe violations",
  { tag: ["@p2", "@a11y", "@grader"] },
  async ({ page }, testInfo) => {
    await gotoApp(page, "/grader");
    await expect(page.getByRole("heading", { level: 1, name: "Assignment grader" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Assignments" })).toBeAttached();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Assignments");
    await expect(page.locator('[data-tour="grader-assignment-picker"]')).toBeVisible();

    const results = await scan(page);

    await reportViolations(testInfo, results);
  }
);

test(
  "reports grader question list axe violations",
  { tag: ["@p2", "@a11y", "@grader"] },
  async ({ page }, testInfo) => {
    const target = await findGradableQuestion(page.request);

    await gotoApp(page, `/grader/${target.assignmentId}`);
    await expect(page.getByRole("region", { name: "Questions" })).toBeVisible();

    const results = await scan(page);

    await reportViolations(testInfo, results);
  }
);

test(
  "reports grader split view axe violations",
  { tag: ["@p2", "@a11y", "@grader"] },
  async ({ page }, testInfo) => {
    const target = await findGradableQuestion(page.request);

    await gotoSplitView(page, target);
    await expect(page.getByRole("complementary", { name: "Students" })).toBeVisible();
    await expect(page.locator('[data-tour="grader-grade-panel"]')).toBeVisible();

    const results = await scan(page);

    await reportViolations(testInfo, results);
  }
);

test(
  "reports grader gradebook axe violations",
  { tag: ["@p2", "@a11y", "@grader", "@gradebook"] },
  async ({ page }, testInfo) => {
    await gotoApp(page, "/gradebook");
    await expect(page.getByRole("heading", { level: 2, name: "Gradebook" })).toBeVisible();

    const results = await scan(page);

    await reportViolations(testInfo, results);
  }
);
