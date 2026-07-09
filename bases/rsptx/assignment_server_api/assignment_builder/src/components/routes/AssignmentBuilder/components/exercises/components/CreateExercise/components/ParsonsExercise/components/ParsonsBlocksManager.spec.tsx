import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { ParsonsBlocksManager } from "./ParsonsBlocksManager";

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor",
  () => ({
    Editor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>
  })
);

vi.mock("./ParsonsCodeHighlighter", () => ({
  ParsonsCodeHighlighter: ({ code }: { code: string }) => <div data-testid="monaco">{code}</div>
}));

const blocks: ParsonsBlock[] = [
  { id: "b1", content: "print(1)", indent: 0 },
  { id: "b2", content: "print(2)", indent: 0 }
];

const baseProps = {
  blocks,
  onChange: vi.fn(),
  language: ""
};

describe("ParsonsBlocksManager", () => {
  it("appends a new block when the dashed add row is clicked", async () => {
    const onChange = vi.fn();

    renderWithMantine(<ParsonsBlocksManager {...baseProps} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Add block" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0];

    expect(updated).toHaveLength(3);
    expect(updated.slice(0, 2)).toEqual(blocks);
    expect(updated[2]).toMatchObject({ content: "", indent: 0 });
  });

  it("calls onAddBlock instead of onChange when provided", async () => {
    const onAddBlock = vi.fn();
    const onChange = vi.fn();

    renderWithMantine(
      <ParsonsBlocksManager {...baseProps} onChange={onChange} onAddBlock={onAddBlock} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Add block" }));

    expect(onAddBlock).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("pluralizes the stats bar labels by count", () => {
    const single: ParsonsBlock[] = [{ id: "b1", content: "print(1)", indent: 0 }];
    const { unmount } = renderWithMantine(<ParsonsBlocksManager {...baseProps} blocks={single} />);

    expect(screen.getByText("block")).toBeInTheDocument();
    expect(screen.getByText("solution")).toBeInTheDocument();
    expect(screen.queryByText("blocks")).not.toBeInTheDocument();

    unmount();
    renderWithMantine(<ParsonsBlocksManager {...baseProps} />);

    expect(screen.getByText("blocks")).toBeInTheDocument();
    expect(screen.getByText("solutions")).toBeInTheDocument();
  });

  it("shows the empty state with its own add button and no add row when there are no blocks", () => {
    renderWithMantine(<ParsonsBlocksManager {...baseProps} blocks={[]} />);

    expect(screen.getByText("No code blocks yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add your first block/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add block" })).not.toBeInTheDocument();
  });
});
