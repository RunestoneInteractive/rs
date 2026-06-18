import { describe, expect, it, vi } from "vitest";

import { TabIndentEditor, handleShiftTab, handleTab } from "./TabIndent";

const makeEditor = (activeNodes: string[]): TabIndentEditor => ({
  isActive: vi.fn((name: unknown) => activeNodes.includes(name as string)) as never,
  commands: {
    insertContent: vi.fn().mockReturnValue(true),
    sinkListItem: vi.fn().mockReturnValue(true),
    liftListItem: vi.fn().mockReturnValue(true)
  } as never
});

describe("handleTab", () => {
  it("inserts a tab character inside code blocks", () => {
    const editor = makeEditor(["codeBlock"]);

    expect(handleTab(editor)).toBe(true);
    expect(editor.commands.insertContent).toHaveBeenCalledWith("\t");
    expect(editor.commands.sinkListItem).not.toHaveBeenCalled();
  });

  it("indents the current list item inside lists", () => {
    const editor = makeEditor(["listItem"]);

    expect(handleTab(editor)).toBe(true);
    expect(editor.commands.sinkListItem).toHaveBeenCalledWith("listItem");
    expect(editor.commands.insertContent).not.toHaveBeenCalled();
  });

  it("prefers the code block branch when both contexts are active", () => {
    const editor = makeEditor(["codeBlock", "listItem"]);

    expect(handleTab(editor)).toBe(true);
    expect(editor.commands.insertContent).toHaveBeenCalledWith("\t");
    expect(editor.commands.sinkListItem).not.toHaveBeenCalled();
  });

  it("lets Tab move focus out of plain rich text", () => {
    const editor = makeEditor([]);

    expect(handleTab(editor)).toBe(false);
    expect(editor.commands.insertContent).not.toHaveBeenCalled();
    expect(editor.commands.sinkListItem).not.toHaveBeenCalled();
  });

  it("reports whether the list indent actually applied", () => {
    const editor = makeEditor(["listItem"]);

    (editor.commands.sinkListItem as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(handleTab(editor)).toBe(false);
  });
});

describe("handleShiftTab", () => {
  it("outdents the current list item inside lists", () => {
    const editor = makeEditor(["listItem"]);

    expect(handleShiftTab(editor)).toBe(true);
    expect(editor.commands.liftListItem).toHaveBeenCalledWith("listItem");
  });

  it("does nothing outside lists", () => {
    const editor = makeEditor(["codeBlock"]);

    expect(handleShiftTab(editor)).toBe(false);
    expect(editor.commands.liftListItem).not.toHaveBeenCalled();
  });
});
