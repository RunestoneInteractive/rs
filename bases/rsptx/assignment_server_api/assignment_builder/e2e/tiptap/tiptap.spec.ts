import { Locator, Page } from "@playwright/test";

import { openCreateEditor, selectEditorWord } from "../fixtures/editors";
import { expect, test } from "../fixtures/scratch";
import { tipTapEditors, typeIntoTipTap } from "../fixtures/selectors";

const PALETTE_NAME = "Editor commands";

const openMchoiceQuestionEditor = async (page: Page, assignmentName: string): Promise<Locator> => {
  await openCreateEditor(page, assignmentName, /Multiple Choice/i);
  await expect(page.getByRole("heading", { name: "Create question" })).toBeVisible();
  return tipTapEditors(page).first();
};

const parkMouse = (page: Page): Promise<void> => page.mouse.move(0, 0);

const openSlashPalette = async (page: Page, editor: Locator): Promise<Locator> => {
  await typeIntoTipTap(editor, "/");
  await parkMouse(page);

  const palette = page.getByRole("listbox", { name: PALETTE_NAME });

  await expect(palette).toBeVisible();
  return palette;
};

const reopenSlashPalette = async (page: Page): Promise<Locator> => {
  await parkMouse(page);
  await page.keyboard.type("/");

  const palette = page.getByRole("listbox", { name: PALETTE_NAME });

  await expect(palette).toBeVisible();
  return palette;
};

const arrowToOption = async (page: Page, name: string | RegExp): Promise<void> => {
  const option = page.getByRole("option", { name });

  for (let move = 0; move < 10; move++) {
    if ((await option.getAttribute("aria-selected")) === "true") {
      break;
    }
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
  }
  await expect(option).toHaveAttribute("aria-selected", "true");
};

const visibleButton = (page: Page, name: string): Locator =>
  page.getByRole("button", { name, exact: true }).filter({ visible: true });

test(
  "slash palette exposes listbox semantics and inserts a heading and list by keyboard",
  { tag: ["@p1", "@tiptap", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    const editor = await openMchoiceQuestionEditor(page, scratchAssignment.name);

    await openSlashPalette(page, editor);

    await expect(page.getByRole("option", { name: /Text formatting/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await arrowToOption(page, /Headings/);
    await page.keyboard.press("Enter");

    const headingsSubmenu = page.getByRole("listbox", { name: "Headings" });

    await expect(headingsSubmenu).toBeVisible();
    await expect(page.getByRole("option", { name: /Heading 1/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Enter");

    await expect(editor.locator("h1")).toHaveCount(1);
    await page.keyboard.type("Intro");
    await expect(editor.locator("h1")).toHaveText("Intro");

    await page.keyboard.press("Enter");
    await reopenSlashPalette(page);
    await arrowToOption(page, /Lists & structure/);
    await page.keyboard.press("ArrowRight");

    await expect(page.getByRole("listbox", { name: "Lists & structure" })).toBeVisible();
    await expect(page.getByRole("option", { name: /Bullet list/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Enter");

    await page.keyboard.type("first point");
    await expect(editor.locator("ul li")).toHaveText("first point");
  }
);

test(
  "bubble menu toggles bold and italic with aria-pressed state",
  { tag: ["@p1", "@tiptap", "@a11y"] },
  async ({ page, scratchAssignment }) => {
    const editor = await openMchoiceQuestionEditor(page, scratchAssignment.name);

    await typeIntoTipTap(editor, "alpha beta");

    await selectEditorWord(editor, "alpha");

    const bold = page.getByRole("button", { name: "Bold", exact: true });

    await expect(bold).toBeVisible();
    await expect(bold).toHaveAttribute("aria-pressed", "false");
    await bold.click({ force: true });

    await expect(editor.locator("strong")).toHaveText("alpha");
    await expect(bold).toHaveAttribute("aria-pressed", "true");

    await selectEditorWord(editor, "beta");
    await expect(bold).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(150);

    const italic = page.getByRole("button", { name: "Italic", exact: true });

    await expect(italic).toBeVisible();
    await expect(italic).toHaveAttribute("aria-pressed", "false");
    await italic.click({ force: true });

    await expect(editor.locator("em")).toHaveText("beta");
    await expect(italic).toHaveAttribute("aria-pressed", "true");
  }
);

test(
  "code block command opens the language form instead of a native prompt",
  { tag: ["@p1", "@tiptap"] },
  async ({ page, scratchAssignment }) => {
    const editor = await openMchoiceQuestionEditor(page, scratchAssignment.name);

    await openSlashPalette(page, editor);
    await arrowToOption(page, /Code & math/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option", { name: /Code block/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Enter");

    const form = page.getByRole("form", { name: "Insert code block" });

    await expect(form).toBeVisible();
    await form.getByLabel("Language (optional)").fill("python");
    await form.getByRole("button", { name: "Insert" }).click();

    await expect(form).not.toBeVisible();
    await expect(editor.locator("pre")).toHaveCount(1);
    await page.keyboard.type("print(42)");
    await expect(editor.locator('[class*="language-python"]').first()).toContainText("print");
  }
);

test(
  "table menus add and delete rows and columns",
  { tag: ["@p1", "@tiptap"] },
  async ({ page, scratchAssignment }) => {
    const editor = await openMchoiceQuestionEditor(page, scratchAssignment.name);

    await openSlashPalette(page, editor);
    await arrowToOption(page, /Tables/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option", { name: /Insert table/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Enter");

    await expect(editor.locator("table")).toHaveCount(1);
    await expect(editor.locator("tr")).toHaveCount(3);
    await expect(editor.locator("tr").first().locator("th")).toHaveCount(3);

    await editor.locator("th").first().click();
    await expect(visibleButton(page, "Add column right")).toBeVisible();
    await visibleButton(page, "Add column right").click();
    await expect(editor.locator("tr").first().locator("th")).toHaveCount(4);

    const hoverRowHandle = async () => {
      const cell = editor.locator("td").first();
      const box = await cell.boundingBox();

      if (!box) {
        throw new Error("Table cell has no bounding box");
      }
      await page.mouse.move(box.x + 25, box.y + box.height / 2);
      await page.mouse.move(box.x + 10, box.y + box.height / 2);
    };

    await hoverRowHandle();
    await expect(visibleButton(page, "Add row below")).toBeVisible();
    await visibleButton(page, "Add row below").click();
    await expect(editor.locator("tr")).toHaveCount(4);

    await hoverRowHandle();
    await expect(visibleButton(page, "Delete row")).toBeVisible();
    await visibleButton(page, "Delete row").click();
    await expect(editor.locator("tr")).toHaveCount(3);
  }
);

test(
  "fill-in-the-blank editor inserts a blank from the palette and the bubble menu",
  { tag: ["@p1", "@tiptap", "@editor-fillintheblank"] },
  async ({ page, scratchAssignment }) => {
    await openCreateEditor(page, scratchAssignment.name, /Fill in the Blank/i);
    await expect(page.getByRole("heading", { name: "Create question" })).toBeVisible();

    const editor = tipTapEditors(page).first();

    await typeIntoTipTap(editor, "Paris is the capital of ");
    await page.keyboard.type("/blank");

    const palette = page.getByRole("listbox", { name: PALETTE_NAME });

    await expect(palette).toBeVisible();
    await expect(page.getByRole("option", { name: /Add blank/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await page.keyboard.press("Enter");

    await expect(editor).toContainText("{blank}");

    await selectEditorWord(editor, "Paris");
    await expect(page.getByRole("button", { name: "Add blank", exact: true })).toBeVisible();
  }
);

test(
  "math form validates input and renders a KaTeX preview",
  { tag: ["@p2", "@tiptap"] },
  async ({ page, scratchAssignment }) => {
    const editor = await openMchoiceQuestionEditor(page, scratchAssignment.name);

    await openSlashPalette(page, editor);
    await arrowToOption(page, /Code & math/);
    await page.keyboard.press("Enter");
    await arrowToOption(page, /Math expression/);
    await page.keyboard.press("Enter");

    const form = page.getByRole("form", { name: "Insert math" });

    await expect(form).toBeVisible();
    await form.getByRole("button", { name: "Insert" }).click();
    await expect(form.getByText("Enter a LaTeX formula")).toBeVisible();

    await form.getByLabel("LaTeX formula").fill("x^2 + y^2");
    await form.getByRole("button", { name: "Insert" }).click();

    await expect(form).not.toBeVisible();
    await expect(editor.locator(".katex").first()).toBeVisible();

    await reopenSlashPalette(page);
    await arrowToOption(page, /Code & math/);
    await page.keyboard.press("Enter");
    await arrowToOption(page, /Math expression/);
    await page.keyboard.press("Enter");
    await expect(form).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(form).not.toBeVisible();
  }
);

test(
  "editor help opens the guide modal",
  { tag: ["@p2", "@tiptap"] },
  async ({ page, scratchAssignment }) => {
    await openMchoiceQuestionEditor(page, scratchAssignment.name);

    await page.getByRole("button", { name: "Editor help" }).click();

    await expect(page.getByText("Editor guide")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Slash commands" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText("Editor guide")).not.toBeVisible();
  }
);
