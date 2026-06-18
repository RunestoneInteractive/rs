import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { InsertFormOpener, openInsertForm } from "./InsertFormBridge";

const makeEditor = (open: InsertFormOpener | null) => {
  const run = vi.fn();
  const deleteRange = vi.fn().mockReturnValue({ run });
  const focus = vi.fn().mockReturnValue({ deleteRange });
  const chain = vi.fn().mockReturnValue({ focus });

  return {
    editor: {
      storage: { insertFormBridge: { open } },
      chain,
      state: { selection: { from: 7 } },
      view: { coordsAtPos: vi.fn().mockReturnValue({ left: 120, bottom: 240 }) }
    } as unknown as Editor,
    chain,
    deleteRange,
    run
  };
};

describe("openInsertForm", () => {
  it("returns false when no host registered an opener", () => {
    const { editor, chain } = makeEditor(null);

    expect(openInsertForm(editor, "codeBlock", { from: 1, to: 3 })).toBe(false);
    expect(chain).not.toHaveBeenCalled();
  });

  it("deletes the slash range and opens the form at the caret", () => {
    const open = vi.fn();
    const { editor, deleteRange, run } = makeEditor(open);

    expect(openInsertForm(editor, "youtube", { from: 1, to: 3 })).toBe(true);
    expect(deleteRange).toHaveBeenCalledWith({ from: 1, to: 3 });
    expect(run).toHaveBeenCalled();
    expect(editor.view.coordsAtPos).toHaveBeenCalledWith(7);
    expect(open).toHaveBeenCalledWith({ kind: "youtube", position: { x: 120, y: 244 } });
  });
});
