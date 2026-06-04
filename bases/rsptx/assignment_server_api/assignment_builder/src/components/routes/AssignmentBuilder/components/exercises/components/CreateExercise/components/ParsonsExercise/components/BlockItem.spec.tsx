import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { BlockItem } from "./BlockItem";

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor",
  () => ({
    Editor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>
  })
);

vi.mock("./ParsonsCodeHighlighter", () => ({
  ParsonsCodeHighlighter: ({ code }: { code: string }) => <div data-testid="monaco">{code}</div>
}));

const block: ParsonsBlock = { id: "b1", content: "print(1)", indent: 0 };

const baseProps = {
  block,
  language: "",
  indentWidth: 20,
  maxIndent: 4,
  blockWidth: 100,
  onContentChange: vi.fn(),
  onRemove: vi.fn()
};

describe("BlockItem", () => {
  it("renders the block content in the fallback text input", () => {
    renderWithMantine(<BlockItem {...baseProps} />);

    expect(screen.getByDisplayValue("print(1)")).toBeInTheDocument();
  });

  it("removes an empty block immediately", async () => {
    const onRemove = vi.fn();

    renderWithMantine(
      <BlockItem {...baseProps} block={{ id: "b1", content: "", indent: 0 }} onRemove={onRemove} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove block" }));
    expect(onRemove).toHaveBeenCalledWith("b1");
  });

  it("asks for confirmation before removing a block with content", async () => {
    const onRemove = vi.fn();

    renderWithMantine(<BlockItem {...baseProps} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: "Remove block" }));
    expect(onRemove).not.toHaveBeenCalled();

    expect(
      await screen.findByText("Remove this block? Its content can't be restored.")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("b1");
  });

  it("names the correct-answer checkbox after its block number", async () => {
    const onCorrectChange = vi.fn();

    renderWithMantine(
      <BlockItem
        {...baseProps}
        blockIndex={1}
        showCorrectCheckbox
        onCorrectChange={onCorrectChange}
      />
    );

    const checkbox = screen.getByRole("checkbox", { name: "Block 2 is a correct answer" });

    await userEvent.click(checkbox);
    expect(onCorrectChange).toHaveBeenCalledWith("b1", true);
  });

  it("names the inline paired checkbox after its block number", async () => {
    const onPairedChange = vi.fn();

    renderWithMantine(
      <BlockItem
        {...baseProps}
        block={{ ...block, isDistractor: true }}
        blockIndex={2}
        mode="simple"
        onDistractorChange={vi.fn()}
        onPairedChange={onPairedChange}
      />
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "Pair block 3 with the block above"
    });

    await userEvent.click(checkbox);
    expect(onPairedChange).toHaveBeenCalledWith("b1", true);
  });
});
