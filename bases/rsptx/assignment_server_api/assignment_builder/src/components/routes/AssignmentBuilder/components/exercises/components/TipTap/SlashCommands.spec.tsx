import { fireEvent, render, screen } from "@testing-library/react";
import { Editor, Range } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandList, items } from "./SlashCommands";

interface FlatItem {
  title: string;
  command?: ({ editor, range }: { editor: Editor; range: Range }) => void;
  submenu?: FlatItem[];
}

const flattenItems = (): FlatItem[] =>
  (items as FlatItem[]).flatMap((item) => [item, ...(item.submenu ?? [])]);

const findItem = (title: string): FlatItem => {
  const item = flattenItems().find((candidate) => candidate.title === title);

  if (!item) {
    throw new Error(`No slash command titled "${title}"`);
  }
  return item;
};

const makeBridgeEditor = () => {
  const open = vi.fn();
  const run = vi.fn();
  const deleteRange = vi.fn().mockReturnValue({ run });
  const focus = vi.fn().mockReturnValue({ deleteRange });

  return {
    open,
    editor: {
      chain: () => ({ focus }),
      storage: { insertFormBridge: { open } },
      state: { selection: { from: 1 } },
      view: { coordsAtPos: () => ({ left: 0, bottom: 0 }) }
    } as unknown as Editor
  };
};

const renderCommandList = (listItems = items) =>
  render(
    <CommandList
      items={listItems}
      command={vi.fn()}
      editor={{} as never}
      range={{ from: 0, to: 1 } as never}
    />
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("slash command copy", () => {
  it("uses sentence-cased category titles", () => {
    expect(items.map((item) => item.title)).toEqual([
      "Text formatting",
      "Headings",
      "Lists & structure",
      "Code & math",
      "Tables",
      "Media & links"
    ]);
  });

  it("uses the table menus' left/right/above/below vocabulary", () => {
    const tables = items.find((item) => item.title === "Tables");

    expect(tables?.submenu?.map((item) => item.title)).toEqual([
      "Insert table",
      "Add column left",
      "Add column right",
      "Delete column",
      "Add row above",
      "Add row below",
      "Delete row",
      "Toggle header row",
      "Merge cells",
      "Split cell",
      "Delete table"
    ]);
  });

  it("keeps every title sentence-cased", () => {
    for (const item of flattenItems()) {
      expect(item.title, item.title).not.toMatch(/^[A-Z][a-z]+ [A-Z][a-z]/);
    }
  });
});

describe("form-backed slash commands", () => {
  const formKinds: [string, string][] = [
    ["Code block", "codeBlock"],
    ["Math expression", "math"],
    ["Link", "link"],
    ["Image by URL", "imageUrl"],
    ["YouTube video", "youtube"]
  ];

  it.each(formKinds)("%s opens the insert form instead of window.prompt", (title, kind) => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("ignored");
    const { editor, open } = makeBridgeEditor();

    findItem(title).command?.({ editor, range: { from: 0, to: 2 } });

    expect(promptSpy).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ kind }));
  });
});

describe("CommandList", () => {
  it("exposes listbox semantics with a selected option", () => {
    renderCommandList();

    const listbox = screen.getByRole("listbox", { name: "Editor commands" });
    const options = screen.getAllByRole("option");

    expect(listbox).toBeInTheDocument();
    expect(options).toHaveLength(items.length);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  it("moves the selection with arrow keys", () => {
    renderCommandList();

    fireEvent.keyDown(screen.getByRole("listbox", { name: "Editor commands" }), {
      key: "ArrowDown"
    });

    const options = screen.getAllByRole("option");

    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("opens a submenu listbox with Enter", () => {
    renderCommandList();

    const listbox = screen.getByRole("listbox", { name: "Editor commands" });

    fireEvent.keyDown(listbox, { key: "Enter" });

    const submenu = screen.getByRole("listbox", { name: "Text formatting" });
    const submenuTitles = items[0].submenu?.map((item) => item.title) ?? [];

    expect(submenuTitles.length).toBeGreaterThan(0);
    for (const title of submenuTitles) {
      expect(submenu).toHaveTextContent(title);
    }
  });

  it("runs the command when a plain option is clicked", () => {
    const command = vi.fn();
    const solo = [{ title: "Solo", description: "Plain item", icon: "fa-bold", command: vi.fn() }];

    render(
      <CommandList
        items={solo}
        command={command}
        editor={{} as never}
        range={{ from: 0, to: 1 } as never}
      />
    );

    fireEvent.click(screen.getByRole("option", { name: /Solo/ }));

    expect(command).toHaveBeenCalledWith(solo[0]);
  });
});
