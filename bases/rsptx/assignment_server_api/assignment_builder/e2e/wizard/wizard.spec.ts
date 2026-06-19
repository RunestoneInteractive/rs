import { Page } from "@playwright/test";

import { assignmentKinds } from "../data/assignmentKinds";
import { visibilityModes } from "../data/visibilityModes";
import { deleteAssignmentViaApi, expect, scratchName, slugify, test } from "../fixtures/scratch";
import { assignmentRow } from "../fixtures/selectors";

const ASSIGNMENTS_API = "/assignment/instructor/assignments";

const fillBasicStep = async (page: Page, name: string): Promise<void> => {
  await page.goto("/builder/create");
  await page.getByLabel("Assignment name").fill(name);
  await page.getByRole("button", { name: "Next" }).click();
};

const completeWizard = async (page: Page): Promise<{ id: number; kind: string }> => {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(ASSIGNMENTS_API) && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "Create assignment" }).click();
  const response = await responsePromise;

  expect(response.ok()).toBe(true);
  const payload = response.request().postDataJSON() as { kind: string };
  const body = (await response.json()) as { detail: { id: number } };

  await page.waitForURL(new RegExp(`/builder/${body.detail.id}`));
  return { id: body.detail.id, kind: payload.kind };
};

for (const kind of assignmentKinds) {
  test(
    `wizard creates a ${kind.kind} assignment with kind-specific settings`,
    { tag: ["@p1", "@wizard"] },
    async ({ page }, testInfo) => {
      const name = scratchName(testInfo.workerIndex, slugify(`kind-${kind.kind}`));

      await fillBasicStep(page, name);
      await page.getByRole("button", { name: kind.cardLabel }).first().click();
      await expect(page.getByText(kind.settingsProbe).first()).toBeVisible();

      await page.getByRole("button", { name: "Next" }).click();

      const created = await completeWizard(page);

      try {
        expect(created.kind).toBe(kind.kind);

        if (kind.editSectionHeading) {
          await expect(page.getByRole("heading", { name: kind.editSectionHeading })).toBeVisible();
        } else {
          await expect(page.getByRole("heading", { name: "Behavior" })).not.toBeVisible();
          await expect(page.getByRole("heading", { name: "Peer settings" })).not.toBeVisible();
        }
      } finally {
        await deleteAssignmentViaApi(page.request, created.id);
      }
    }
  );
}

for (const mode of visibilityModes) {
  test(
    `wizard sets the ${mode.value} visibility mode and the list badge matches`,
    { tag: ["@p1", "@wizard"] },
    async ({ page }, testInfo) => {
      const name = scratchName(testInfo.workerIndex, slugify(`vis-${mode.value}`));

      await fillBasicStep(page, name);
      await page
        .getByRole("button", { name: /Regular/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Next" }).click();

      await page.getByRole("radio", { name: mode.wizardCardName }).click();

      const created = await completeWizard(page);

      try {
        await page.goto("/builder");

        const trigger = assignmentRow(page, name).getByRole("button", {
          name: "Change visibility"
        });

        await expect(trigger.locator("span").filter({ hasText: mode.expectedBadge })).toBeVisible();
      } finally {
        await deleteAssignmentViaApi(page.request, created.id);
      }
    }
  );
}

test(
  "changing visibility from the list dropdown fires exactly one PUT",
  { tag: ["@p1", "@wizard", "@assignments"] },
  async ({ page, scratchAssignment }) => {
    await page.goto("/builder");

    let putCount = 0;

    page.on("request", (request) => {
      if (
        request.method() === "PUT" &&
        request.url().includes(`${ASSIGNMENTS_API}/${scratchAssignment.id}`)
      ) {
        putCount += 1;
      }
    });

    const trigger = assignmentRow(page, scratchAssignment.name).getByRole("button", {
      name: "Change visibility"
    });

    await trigger.click();

    const putResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().includes(`${ASSIGNMENTS_API}/${scratchAssignment.id}`)
    );

    await page.getByRole("radio", { name: "Visible", exact: true }).click();

    expect((await putResponse).ok()).toBe(true);
    await expect(page.getByText("Assignment is now visible")).toBeVisible();
    await expect(trigger).toContainText("Visible");
    expect(putCount).toBe(1);
  }
);
