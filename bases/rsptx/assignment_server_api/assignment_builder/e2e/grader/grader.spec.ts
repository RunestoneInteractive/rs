import { expect, test } from "@playwright/test";

import { gotoApp } from "../fixtures/appNav";
import {
  activeStudentSid,
  findGradableQuestion,
  gotoSplitView,
  trackInstructorWrites
} from "../fixtures/grader";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cardNamed = (name: string) => new RegExp(`^${escapeRegex(name)}\\b`);

test(
  "grader landing lists the course assignments read-only",
  { tag: ["@p1", "@grader"] },
  async ({ page }) => {
    const writes = trackInstructorWrites(page);

    await gotoApp(page, "/grader");

    await expect(page.getByText("Assignment grader", { exact: true })).toBeVisible();

    const picker = page.getByRole("region", { name: "Assignments" });

    await expect(picker).toBeVisible();
    await expect(picker.getByRole("button").first()).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" }).getByRole("link", {
        name: "Assignments"
      })
    ).toBeVisible();
    expect(writes).toEqual([]);
  }
);

test(
  "opening an assignment shows its question cards",
  { tag: ["@p1", "@grader"] },
  async ({ page }) => {
    const target = await findGradableQuestion(page.request);
    const writes = trackInstructorWrites(page);

    await gotoApp(page, "/grader");
    await page
      .getByRole("region", { name: "Assignments" })
      .getByRole("button", { name: cardNamed(target.assignmentName) })
      .first()
      .click();

    await page.waitForURL(new RegExp(`/grader/${target.assignmentId}$`));

    const grid = page.getByRole("region", { name: "Questions" });

    await expect(grid).toBeVisible();
    await expect(
      grid.getByRole("button", { name: cardNamed(target.questionName) }).first()
    ).toBeVisible();
    expect(writes).toEqual([]);
  }
);

test(
  "the split view renders a submission with sidebar, preview, and grade panel",
  { tag: ["@p1", "@grader"] },
  async ({ page }) => {
    const target = await findGradableQuestion(page.request);
    const writes = trackInstructorWrites(page);

    await gotoApp(page, `/grader/${target.assignmentId}`);
    await page
      .getByRole("region", { name: "Questions" })
      .getByRole("button", { name: cardNamed(target.questionName) })
      .first()
      .click();

    await page.waitForURL(
      new RegExp(`/grader/${target.assignmentId}/questions/${target.questionId}/students/`)
    );

    const sidebar = page.getByRole("complementary", { name: "Students" });

    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("option")).toHaveCount(target.answeredCount);
    await expect(sidebar.getByRole("option", { selected: true })).toHaveCount(1);
    await expect(page.locator('[data-tour="grader-preview-pane"]')).toBeVisible();
    await expect(page.getByText(/Points \(max /)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next student (J)" })).toBeVisible();
    expect(writes).toEqual([]);
  }
);

test(
  "J and K move through students without writing grades",
  { tag: ["@p1", "@grader", "@a11y"] },
  async ({ page }) => {
    const target = await findGradableQuestion(page.request);
    const writes = trackInstructorWrites(page);

    await gotoSplitView(page, target);

    const firstSid = activeStudentSid(page);

    await page.keyboard.press("j");
    await expect(page).not.toHaveURL(new RegExp(`/students/${escapeRegex(firstSid)}$`));

    const secondSid = activeStudentSid(page);

    expect(secondSid).not.toBe(firstSid);
    await expect(
      page.getByRole("complementary", { name: "Students" }).getByRole("option", { selected: true })
    ).toContainText(new RegExp(escapeRegex(secondSid)));

    await page.keyboard.press("k");
    await expect(page).toHaveURL(new RegExp(`/students/${escapeRegex(firstSid)}$`));
    expect(writes).toEqual([]);
  }
);

test(
  "a deep link to a question lands on a selected student",
  { tag: ["@p1", "@grader"] },
  async ({ page }) => {
    const target = await findGradableQuestion(page.request);
    const writes = trackInstructorWrites(page);

    await gotoSplitView(page, target);

    await expect(page.getByText(`Question #${target.questionId}`)).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Students" }).getByRole("option", { selected: true })
    ).toHaveCount(1);
    expect(writes).toEqual([]);
  }
);

test(
  "the shortcuts dialog opens with ? in the split view",
  { tag: ["@p2", "@grader", "@a11y"] },
  async ({ page }) => {
    const target = await findGradableQuestion(page.request);

    await gotoSplitView(page, target);

    await page.keyboard.press("?");

    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Next student (rolls over to next question)")).toBeVisible();
    await expect(dialog.locator("kbd", { hasText: "J" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  }
);

const TOUR_TITLES = [
  "Welcome to the assignment grader",
  "Keyboard shortcuts",
  "Tour button",
  "Breadcrumbs",
  "Pick an assignment",
  "Assignment card",
  "Questions overview",
  "Question card",
  "Answered",
  "Fully correct or fully scored",
  "Average score",
  "% correct or % credit",
  "Progress bar",
  "Unified grading view",
  "Student sidebar",
  "Answer preview",
  "Attempt history",
  "Grade panel",
  "Award points",
  "Leave feedback",
  "Previous and next",
  "Auto-advance after save"
];

test(
  "the demo-mode tour walks every step and exercises the save flow without writes",
  { tag: ["@p2", "@grader"] },
  async ({ page }) => {
    test.slow();
    const writes = trackInstructorWrites(page);

    await gotoApp(page, "/grader");
    await page.getByRole("button", { name: "Take tour" }).click();

    const popover = page.locator(".driver-popover");
    const popoverTitle = popover.locator(".driver-popover-title");

    await expect(popoverTitle).toHaveText(TOUR_TITLES[0]);

    for (const title of TOUR_TITLES.slice(1)) {
      await popover.getByRole("button", { name: /next/i }).click();
      await expect(popoverTitle).toHaveText(title);

      if (title === "Student sidebar") {
        const sidebar = page.getByRole("complementary", { name: "Students" });

        await expect(sidebar.getByLabel("Graded").first()).toBeVisible();
        await expect(sidebar.getByLabel("Auto-graded").first()).toBeVisible();
        await expect(sidebar.getByLabel("Pending").first()).toBeVisible();
      }

      if (title === "Award points") {
        const scoreInput = page.locator('[data-tour="grader-points-input"] input');

        await expect(page.locator('[data-tour="grader-points-input"]')).toHaveClass(
          /driver-active-element/
        );
        await scoreInput.fill("3");

        const pill = page.getByRole("status").filter({ hasText: /^(Unsaved|Saving…|Saved)$/ });

        await expect(pill).toBeVisible();
        await expect(pill).toHaveText(/Saved/, { timeout: 5_000 });
        await expect(page.getByTestId("save-pill-checkmark")).toBeVisible();
      }
    }

    await popover.getByRole("button", { name: /done/i }).click();
    await expect(popover).not.toBeVisible();
    await expect(page).toHaveURL(/\/grader$/);
    await expect(page.getByRole("region", { name: "Assignments" })).toBeVisible();
    expect(writes).toEqual([]);
  }
);
