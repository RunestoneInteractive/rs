import { expect, test } from "../fixtures/scratch";
import { openAssignmentTab, tipTapEditors } from "../fixtures/selectors";

const VIEWPORTS = [
  { label: "1280", width: 1280, height: 900 },
  { label: "768", width: 768, height: 900 },
  { label: "360", width: 360, height: 740 }
];

const expectNoHorizontalScroll = async (page: import("@playwright/test").Page, label: string) => {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement!;

    return el.scrollWidth - el.clientWidth;
  });

  expect(overflow, `horizontal overflow at ${label}px`).toBeLessThanOrEqual(0);
};

test(
  "assignment list renders without horizontal scroll at 1280, 768, and 360",
  { tag: ["@p2", "@responsive", "@assignments"] },
  async ({ page }) => {
    await page.goto("/builder");
    await expect(page.getByRole("heading", { level: 1, name: "Assignments" })).toBeVisible();

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("heading", { level: 1, name: "Assignments" })).toBeVisible();
      await expectNoHorizontalScroll(page, viewport.label);
    }
  }
);

test(
  "edit basic info renders without horizontal scroll at 1280, 768, and 360",
  { tag: ["@p2", "@responsive", "@assignments"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Basic info");

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("textbox", { name: /assignment name/i })).toBeVisible();
      await expectNoHorizontalScroll(page, viewport.label);
    }
  }
);

test(
  "exercises tab renders without horizontal scroll at 1280, 768, and 360",
  { tag: ["@p2", "@responsive", "@exercises"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await expect(page.getByRole("button", { name: "Add exercise" })).toBeVisible();

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("button", { name: "Add exercise" })).toBeVisible();
      await expectNoHorizontalScroll(page, viewport.label);
    }
  }
);

test(
  "multichoice editor renders without horizontal scroll at 1280, 768, and 360",
  { tag: ["@p2", "@responsive", "@editor-mchoice"] },
  async ({ page, scratchAssignment }) => {
    await openAssignmentTab(page, scratchAssignment.name, "Exercises");
    await page.getByRole("button", { name: "Add exercise" }).click();
    await page.getByRole("menuitem", { name: "Create exercise", exact: true }).click();
    await page.getByRole("button", { name: /Multiple Choice/i }).click();
    await expect(tipTapEditors(page).first()).toBeVisible();

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(tipTapEditors(page).first()).toBeVisible();
      await expectNoHorizontalScroll(page, viewport.label);
    }
  }
);
