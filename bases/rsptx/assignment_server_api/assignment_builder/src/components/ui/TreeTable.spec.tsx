import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { SelectedKey, TreeNode } from "@/types/treeNode";

import { TreeTable, TreeTableColumn } from "./TreeTable";

const TREE: TreeNode[] = [
  {
    key: "chapter-1",
    data: { title: "Chapter 1" },
    children: [
      { key: "ex-1", data: { title: "Exercise 1" } },
      { key: "ex-2", data: { title: "Exercise 2" } }
    ]
  },
  { key: "ex-3", data: { title: "Exercise 3" } }
];

const COLUMNS: TreeTableColumn[] = [
  { header: "Title", render: (node) => <span>{(node.data as { title: string }).title}</span> }
];

const renderTree = (
  selectionKeys: Record<string, SelectedKey> = {},
  handlers: { onSelect?: (n: TreeNode) => void; onUnselect?: (n: TreeNode) => void } = {}
) =>
  renderWithMantine(
    <TreeTable
      value={TREE}
      columns={COLUMNS}
      selectionKeys={selectionKeys}
      onSelect={handlers.onSelect ?? (() => {})}
      onUnselect={handlers.onUnselect ?? (() => {})}
    />
  );

describe("TreeTable", () => {
  it("renders top-level nodes and hides collapsed children by default", () => {
    renderTree();
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Exercise 3")).toBeInTheDocument();
    expect(screen.queryByText("Exercise 1")).not.toBeInTheDocument();
  });

  it("expands a parent to reveal its children", async () => {
    renderTree();
    await userEvent.click(screen.getByRole("button", { name: "Expand chapter-1" }));
    expect(screen.getByText("Exercise 1")).toBeInTheDocument();
    expect(screen.getByText("Exercise 2")).toBeInTheDocument();
  });

  it("names the expand toggle and checkbox after the node via getNodeLabel", () => {
    renderWithMantine(
      <TreeTable
        value={TREE}
        columns={COLUMNS}
        selectionKeys={{}}
        onSelect={() => {}}
        onUnselect={() => {}}
        getNodeLabel={(node) => (node.data as { title: string }).title}
      />
    );

    expect(screen.getByRole("button", { name: "Expand Chapter 1" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Chapter 1" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Exercise 3" })).toBeInTheDocument();
  });

  it("exposes the expanded state through aria-expanded", async () => {
    renderTree();

    const toggle = screen.getByRole("button", { name: "Expand chapter-1" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Collapse chapter-1" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("reflects checked and indeterminate state from selectionKeys", () => {
    renderTree({
      "chapter-1": { checked: false, partialChecked: true },
      "ex-3": { checked: true, partialChecked: false }
    });
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    const chapter = checkboxes.find((c) => c.getAttribute("aria-label") === "Select chapter-1");
    const ex3 = checkboxes.find((c) => c.getAttribute("aria-label") === "Select ex-3");

    expect(chapter?.indeterminate).toBe(true);
    expect(ex3?.checked).toBe(true);
  });

  it("calls onSelect when toggling an unchecked node", async () => {
    const onSelect = vi.fn();

    renderTree({}, { onSelect });
    await userEvent.click(screen.getByRole("checkbox", { name: "Select ex-3" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: "ex-3" }));
  });

  it("calls onUnselect when toggling a checked node", async () => {
    const onUnselect = vi.fn();

    renderTree({ "ex-3": { checked: true, partialChecked: false } }, { onUnselect });
    await userEvent.click(screen.getByRole("checkbox", { name: "Select ex-3" }));
    expect(onUnselect).toHaveBeenCalledWith(expect.objectContaining({ key: "ex-3" }));
  });

  it("marks the expand toggle with its expanded state for the chevron rotation", async () => {
    renderTree();

    const toggle = screen.getByRole("button", { name: "Expand chapter-1" });

    expect(toggle).not.toHaveAttribute("data-expanded");

    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Collapse chapter-1" })).toHaveAttribute(
      "data-expanded"
    );
  });

  it("renders one indent guide per depth level for nested rows", async () => {
    const { container } = renderTree();

    expect(container.querySelectorAll("[data-indent-guide]")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Expand chapter-1" }));
    expect(container.querySelectorAll("[data-indent-guide]")).toHaveLength(2);
  });

  it("renders a scroll sentinel inside the scroll container when a ref is provided", () => {
    const sentinelRef = vi.fn();
    const { container } = renderWithMantine(
      <TreeTable
        value={TREE}
        columns={COLUMNS}
        selectionKeys={{}}
        onSelect={() => {}}
        onUnselect={() => {}}
        scrollSentinelRef={sentinelRef}
      />
    );

    expect(container.querySelector("[data-scroll-sentinel]")).not.toBeNull();
    expect(sentinelRef).toHaveBeenCalled();
  });

  it("does not render a scroll sentinel by default", () => {
    const { container } = renderTree();

    expect(container.querySelector("[data-scroll-sentinel]")).toBeNull();
  });

  it("emphasizes parent rows and not leaf rows", async () => {
    const { container } = renderTree();

    await userEvent.click(screen.getByRole("button", { name: "Expand chapter-1" }));

    const parents = container.querySelectorAll("[data-parent]");

    expect(parents).toHaveLength(1);
    expect(parents[0].textContent).toContain("Chapter 1");
  });
});
