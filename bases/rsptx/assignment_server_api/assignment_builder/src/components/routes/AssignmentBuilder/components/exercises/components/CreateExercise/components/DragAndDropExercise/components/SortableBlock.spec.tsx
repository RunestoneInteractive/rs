import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { SortableBlock } from "./SortableBlock";

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor",
  () => ({
    Editor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>
  })
);

vi.mock("../DragAndDropExercise.module.css", () => ({ default: {} }));

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

describe("DragAndDrop SortableBlock", () => {
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

  it("arms connect mode from the keyboard and reflects it through aria-pressed", () => {
    const onStartConnection = vi.fn();

    renderWithMantine(
      <SortableBlock {...baseProps} onStartConnection={onStartConnection} activeSource="left-1" />
    );

    const handle = screen.getByRole("button", {
      name: "Connect source item 1 to a target match"
    });

    expect(handle).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a labeled connect-target button only while the block is a valid target", () => {
    const onCompleteConnection = vi.fn();

    const { rerender } = renderWithMantine(
      <SortableBlock
        {...baseProps}
        isLeft={false}
        block={{ id: "right-1", content: "Right one" }}
        activeSource="left-1"
        isConnectTarget={true}
        onCompleteConnection={onCompleteConnection}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect to target match 1" }));
    expect(onCompleteConnection).toHaveBeenCalledWith("right-1");

    rerender(
      <SortableBlock
        {...baseProps}
        isLeft={false}
        block={{ id: "right-1", content: "Right one" }}
        activeSource={null}
        isConnectTarget={false}
        onCompleteConnection={onCompleteConnection}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Connect to target match 1" })
    ).not.toBeInTheDocument();
  });
});
