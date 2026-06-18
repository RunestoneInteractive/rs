import { deleteAssignmentViaApi, expect, test } from "../fixtures/scratch";
import { assignmentRow } from "../fixtures/selectors";

const ASSIGNMENTS_API = "/assignment/instructor/assignments";

test(
  "sort cycle toggles asc and desc and persists across reload",
  { tag: ["@p1", "@assignments"] },
  async ({ page }) => {
    await page.goto("/builder");

    const nameHeader = page
      .getByRole("table", { name: "Assignments" })
      .getByRole("columnheader", { name: "Name" });

    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    await nameHeader.getByRole("button", { name: "Name" }).click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");

    await page.reload();
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");

    await nameHeader.getByRole("button", { name: "Name" }).click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  }
);

test(
  "search filters the list and shows the no-match state",
  { tag: ["@p1", "@assignments"] },
  async ({ page, scratchAssignment }) => {
    await page.goto("/builder");

    const search = page.getByRole("textbox", { name: "Search assignments" });

    await search.fill(scratchAssignment.name);

    const table = page.getByRole("table", { name: "Assignments" });

    await expect(assignmentRow(page, scratchAssignment.name)).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(2);

    await search.fill("zzz-no-such-assignment");
    await expect(page.getByText("No assignments match your search")).toBeVisible();

    await search.fill("");
    await expect(assignmentRow(page, scratchAssignment.name)).toBeVisible();
  }
);

test(
  "duplicate creates a copy, toasts, and shows the new row",
  { tag: ["@p1", "@assignments"] },
  async ({ page, scratchAssignment }) => {
    await page.goto("/builder");

    const duplicateResponse = page.waitForResponse(
      (response) => response.url().includes("/duplicate") && response.request().method() === "POST"
    );

    await assignmentRow(page, scratchAssignment.name)
      .getByRole("button", { name: "Duplicate", exact: true })
      .click();

    const response = await duplicateResponse;

    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { detail: { id: number; name: string } };

    try {
      await expect(page.getByText(`Assignment duplicated as "${body.detail.name}"`)).toBeVisible();
      await expect(
        page
          .getByRole("table", { name: "Assignments" })
          .getByRole("row")
          .filter({ hasText: body.detail.name })
      ).toBeVisible();
    } finally {
      await deleteAssignmentViaApi(page.request, body.detail.id);
    }
  }
);

test(
  "late-submissions toggle fires exactly one PUT and toasts",
  { tag: ["@p1", "@assignments"] },
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

    const putResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().includes(`${ASSIGNMENTS_API}/${scratchAssignment.id}`)
    );

    const lateSwitch = assignmentRow(page, scratchAssignment.name).getByRole("switch", {
      name: `Allow late submissions for ${scratchAssignment.name}`
    });

    await lateSwitch.focus();
    await page.keyboard.press("Space");

    expect((await putResponse).ok()).toBe(true);
    await expect(page.getByText("Late submissions not allowed")).toBeVisible();
    expect(putCount).toBe(1);
  }
);

test(
  "keyboard-only: sort with Enter, open row actions, delete with confirm",
  { tag: ["@p1", "@assignments", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    await page.goto("/builder");

    const nameHeader = page
      .getByRole("table", { name: "Assignments" })
      .getByRole("columnheader", { name: "Name" });

    await nameHeader.getByRole("button", { name: "Name" }).focus();
    await page.keyboard.press("Enter");
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");

    const row = assignmentRow(page, scratchAssignment.name);

    await row.getByRole("button", { name: "Delete", exact: true }).focus();
    await page.keyboard.press("Enter");

    const confirmDialog = page.getByRole("dialog", { name: "Delete assignment" });

    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(scratchAssignment.name);

    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).focus();
    await page.keyboard.press("Enter");

    await expect(row).not.toBeVisible();
  }
);
