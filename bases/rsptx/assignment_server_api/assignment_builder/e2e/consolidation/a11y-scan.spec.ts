import { AxeBuilder } from "@axe-core/playwright";

import { expect, test } from "../fixtures/scratch";

const scan = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

const seriousViolations = (results: Awaited<ReturnType<typeof scan>>) =>
  results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" "))
    }));

test(
  "assignment list has no serious or critical axe violations",
  { tag: ["@p2", "@a11y", "@assignments"] },
  async ({ page }) => {
    await page.goto("/builder");
    await expect(page.getByRole("heading", { level: 1, name: "Assignments" })).toBeVisible();

    const results = await scan(page);

    expect(seriousViolations(results)).toEqual([]);
  }
);

test(
  "grader assignment list has no serious or critical axe violations",
  { tag: ["@p2", "@a11y", "@grader"] },
  async ({ page }) => {
    await page.goto("/grader");
    await expect(page.getByRole("region", { name: "Assignments" })).toBeVisible();

    const results = await scan(page);

    expect(seriousViolations(results)).toEqual([]);
  }
);
