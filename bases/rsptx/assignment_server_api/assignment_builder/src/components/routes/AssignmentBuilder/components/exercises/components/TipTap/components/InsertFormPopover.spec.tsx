import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { renderWithMantine } from "@/test/renderWithMantine";

import { InsertFormRequest } from "../extensions/InsertFormBridge";

import {
  INSERT_FORM_COPY,
  INSERT_FORM_ERRORS,
  InsertFormPopover,
  applyInsertForm,
  useInsertForm,
  validateInsertFormValue
} from "./InsertFormPopover";

const makeChain = () => {
  const run = vi.fn();
  const chain: Record<string, ReturnType<typeof vi.fn>> = { run };

  for (const method of [
    "focus",
    "setCodeBlock",
    "insertContent",
    "setLink",
    "setImage",
    "setYoutubeVideo"
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  return chain;
};

const makeEditor = () => {
  const chain = makeChain();

  return {
    chain,
    editor: {
      chain: () => chain,
      commands: { focus: vi.fn() },
      storage: { insertFormBridge: { open: null } }
    } as unknown as Editor
  };
};

const request = (kind: InsertFormRequest["kind"]): InsertFormRequest => ({
  kind,
  position: { x: 40, y: 60 }
});

describe("validateInsertFormValue", () => {
  it("treats the code block language as optional", () => {
    expect(validateInsertFormValue("codeBlock", "")).toBeNull();
    expect(validateInsertFormValue("codeBlock", "python")).toBeNull();
  });

  it("requires a formula for math", () => {
    expect(validateInsertFormValue("math", "  ")).toBe(INSERT_FORM_ERRORS.math);
    expect(validateInsertFormValue("math", "x^2")).toBeNull();
  });

  it.each(["link", "imageUrl", "youtube"] as const)("requires an http(s) URL for %s", (kind) => {
    expect(validateInsertFormValue(kind, "not-a-url")).toBe(INSERT_FORM_ERRORS.url);
    expect(validateInsertFormValue(kind, "ftp://x")).toBe(INSERT_FORM_ERRORS.url);
    expect(validateInsertFormValue(kind, "https://example.com")).toBeNull();
  });
});

describe("applyInsertForm", () => {
  it("inserts a code block with the given language", () => {
    const { editor, chain } = makeEditor();

    applyInsertForm(editor, "codeBlock", " python ");
    expect(chain.setCodeBlock).toHaveBeenCalledWith({ language: "python" });
    expect(chain.run).toHaveBeenCalled();
  });

  it("inserts a default code block when the language is empty", () => {
    const { editor, chain } = makeEditor();

    applyInsertForm(editor, "codeBlock", "");
    expect(chain.setCodeBlock).toHaveBeenCalledWith();
  });

  it("inserts an inline math node", () => {
    const { editor, chain } = makeEditor();

    applyInsertForm(editor, "math", "x^2");
    expect(chain.insertContent).toHaveBeenCalledWith({
      type: "inlineMath",
      attrs: { latex: "x^2" }
    });
  });

  it("applies link, image, and YouTube inserts", () => {
    const { editor, chain } = makeEditor();

    applyInsertForm(editor, "link", "https://a.example");
    expect(chain.setLink).toHaveBeenCalledWith({ href: "https://a.example" });

    applyInsertForm(editor, "imageUrl", "https://img.example/x.png");
    expect(chain.setImage).toHaveBeenCalledWith({ src: "https://img.example/x.png" });

    applyInsertForm(editor, "youtube", "https://youtu.be/x");
    expect(chain.setYoutubeVideo).toHaveBeenCalledWith({ src: "https://youtu.be/x" });
  });
});

describe("useInsertForm", () => {
  it("registers an opener on the bridge storage and clears it on unmount", () => {
    const { editor } = makeEditor();
    const storage = (editor.storage as { insertFormBridge: { open: unknown } }).insertFormBridge;

    const { result, unmount } = renderHook(() => useInsertForm(editor));

    expect(storage.open).toBeTypeOf("function");

    act(() => {
      (storage.open as (value: InsertFormRequest) => void)(request("link"));
    });
    expect(result.current.insertFormRequest?.kind).toBe("link");

    act(() => result.current.closeInsertForm());
    expect(result.current.insertFormRequest).toBeNull();

    unmount();
    expect(storage.open).toBeNull();
  });
});

describe("InsertFormPopover", () => {
  it("renders nothing without a request", () => {
    const { editor } = makeEditor();

    renderWithMantine(<InsertFormPopover editor={editor} request={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it.each(Object.entries(INSERT_FORM_COPY))("labels the %s form", (kind, copy) => {
    const { editor } = makeEditor();

    renderWithMantine(
      <InsertFormPopover
        editor={editor}
        request={request(kind as InsertFormRequest["kind"])}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText(copy.label)).toBeInTheDocument();
  });

  it("shows a validation error and keeps the form open on invalid submit", () => {
    const { editor, chain } = makeEditor();
    const onClose = vi.fn();

    renderWithMantine(
      <InsertFormPopover editor={editor} request={request("link")} onClose={onClose} />
    );

    fireEvent.change(screen.getByLabelText("Link URL"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    expect(screen.getByText(INSERT_FORM_ERRORS.url)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(chain.setLink).not.toHaveBeenCalled();
  });

  it("applies the insert and closes on valid submit", () => {
    const { editor, chain } = makeEditor();
    const onClose = vi.fn();

    renderWithMantine(
      <InsertFormPopover editor={editor} request={request("link")} onClose={onClose} />
    );

    fireEvent.change(screen.getByLabelText("Link URL"), {
      target: { value: "https://example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(chain.setLink).toHaveBeenCalledWith({ href: "https://example.com" });
  });

  it("cancels back to the editor without inserting", () => {
    const { editor, chain } = makeEditor();
    const onClose = vi.fn();

    renderWithMantine(
      <InsertFormPopover editor={editor} request={request("math")} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(editor.commands.focus).toHaveBeenCalled();
    expect(chain.insertContent).not.toHaveBeenCalled();
  });

  it("closes on Escape pressed inside the form", () => {
    const { editor } = makeEditor();
    const onClose = vi.fn();

    renderWithMantine(
      <InsertFormPopover editor={editor} request={request("math")} onClose={onClose} />
    );

    fireEvent.keyDown(screen.getByLabelText("LaTeX formula"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(editor.commands.focus).toHaveBeenCalled();
  });
});
