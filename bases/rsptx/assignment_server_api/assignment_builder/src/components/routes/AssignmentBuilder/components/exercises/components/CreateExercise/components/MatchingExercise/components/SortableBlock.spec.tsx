import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { SortableBlock } from "./SortableBlock";

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor",
  () => ({
    Editor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>
  })
);

vi.mock("../MatchingExercise.module.css", () => ({ default: {} }));

const baseProps = {
  block: { id: "left-1", content: "Block one" },
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
  canRemove: true,
  isLeft: true,
  activeSource: null,
  connections: [],
  index: 0
};

describe("Matching SortableBlock", () => {
  it("renders the block content through the editor", () => {
    renderWithMantine(<SortableBlock {...baseProps} />);

    expect(screen.getByTestId("editor")).toHaveTextContent("Block one");
  });

  it("removes an empty block immediately", () => {
    const onRemove = vi.fn();

    renderWithMantine(
      <SortableBlock {...baseProps} block={{ id: "left-1", content: "" }} onRemove={onRemove} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove block" }));

    expect(onRemove).toHaveBeenCalledWith("left-1");
  });

  it("asks for confirmation before removing a block with content", async () => {
    const onRemove = vi.fn();

    renderWithMantine(<SortableBlock {...baseProps} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove block" }));
    expect(onRemove).not.toHaveBeenCalled();

    expect(
      await screen.findByText("Remove this block? Its content can't be restored.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("left-1");
  });

  it("disables the remove button when canRemove is false", () => {
    renderWithMantine(<SortableBlock {...baseProps} canRemove={false} />);

    expect(screen.getByRole("button", { name: "Remove block" })).toBeDisabled();
  });

  it("starts a connection on mouse down of the connect handle for a left block", () => {
    const onStartConnection = vi.fn();

    renderWithMantine(<SortableBlock {...baseProps} onStartConnection={onStartConnection} />);

    fireEvent.mouseDown(
      screen.getByRole("button", { name: "Connect source item 1 to a target match" })
    );

    expect(onStartConnection).toHaveBeenCalledWith("left-1");
  });

  it("renders a labeled connect handle for a right block", () => {
    const onStartConnection = vi.fn();

    renderWithMantine(
      <SortableBlock
        {...baseProps}
        block={{ id: "right-1", content: "Right one" }}
        isLeft={false}
        onStartConnection={onStartConnection}
      />
    );

    fireEvent.mouseDown(
      screen.getByRole("button", { name: "Connect target match 1 to a source item" })
    );

    expect(onStartConnection).toHaveBeenCalledWith("right-1");
  });

  it("renders a connect-target button on a left block when a right source is active", () => {
    const onCompleteConnection = vi.fn();

    renderWithMantine(
      <SortableBlock
        {...baseProps}
        activeSource="right-1"
        isConnectTarget={true}
        onCompleteConnection={onCompleteConnection}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect to source item 1" }));

    expect(onCompleteConnection).toHaveBeenCalledWith("left-1");
  });
});
