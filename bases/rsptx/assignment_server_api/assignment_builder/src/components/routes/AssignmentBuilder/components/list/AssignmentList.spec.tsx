import { vi } from "vitest";

import { fireEvent, renderWithMantine, screen, within } from "@/test/renderWithMantine";
import { Assignment } from "@/types/assignment";

import { AssignmentList } from "./AssignmentList";

const makeAssignment = (overrides: Partial<Assignment>): Assignment =>
  ({
    id: 1,
    name: "Alpha",
    kind: "Regular",
    duedate: "2026-06-01T10:00:00",
    updated_date: "2026-06-01T10:00:00",
    points: 10,
    visible: true,
    visible_on: null,
    hidden_on: null,
    enforce_due: false,
    is_private: true,
    ...overrides
  }) as Assignment;

const ASSIGNMENTS = [
  makeAssignment({ id: 1, name: "Alpha" }),
  makeAssignment({ id: 2, name: "Bravo" }),
  makeAssignment({ id: 3, name: "Charlie" })
];

const baseProps = () => ({
  assignments: ASSIGNMENTS,
  globalFilter: "",
  setGlobalFilter: vi.fn(),
  onCreateNew: vi.fn(),
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onEnforceDueChange: vi.fn(),
  onImport: vi.fn(),
  onVisibilityChange: vi.fn(),
  onRemove: vi.fn(),
  onBulkVisibilityChange: vi.fn(),
  onBulkEnforceDueChange: vi.fn(),
  onBulkRemove: vi.fn()
});

describe("AssignmentList", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the page title with the assignment count", () => {
    renderWithMantine(<AssignmentList {...baseProps()} />);

    expect(screen.getByRole("heading", { name: "Assignments" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders skeleton rows instead of the table while loading", () => {
    renderWithMantine(<AssignmentList {...baseProps()} assignments={[]} loading />);

    expect(screen.getByTestId("assignment-list-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders an empty state with a create CTA when there are no assignments", () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} assignments={[]} />);

    expect(screen.getByText("Create your first assignment")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const ctas = screen.getAllByRole("button", { name: /new assignment/i });

    fireEvent.click(ctas[ctas.length - 1]);
    expect(props.onCreateNew).toHaveBeenCalledTimes(1);
  });

  it("filters rows by the global filter", () => {
    renderWithMantine(<AssignmentList {...baseProps()} globalFilter="brav" />);

    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("shows a no-match message when the filter excludes everything", () => {
    renderWithMantine(<AssignmentList {...baseProps()} globalFilter="zzz" />);

    expect(screen.getByText("No assignments match your search")).toBeInTheDocument();
  });

  it("invokes onEdit when an assignment name is clicked", () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Bravo" }));
    expect(props.onEdit).toHaveBeenCalledWith(ASSIGNMENTS[1]);
    expect(props.onEdit).toHaveBeenCalledTimes(1);
  });

  it("invokes onEdit when type, due date, or last updated cells are clicked", () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} />);

    const bravoRow = screen.getByRole("button", { name: "Bravo" }).closest("tr")!;
    const cells = bravoRow.querySelectorAll("td");

    fireEvent.click(cells[1]);
    fireEvent.click(cells[2]);
    fireEvent.click(cells[3]);
    fireEvent.click(cells[4]);

    expect(props.onEdit).toHaveBeenCalledTimes(3);
    expect(props.onEdit).toHaveBeenCalledWith(ASSIGNMENTS[1]);
  });

  it("does not invoke onEdit from the points or actions cells", () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} />);

    const bravoRow = screen.getByRole("button", { name: "Bravo" }).closest("tr")!;
    const cells = Array.from(bravoRow.querySelectorAll("td"));
    // Found by content rather than index: a column added or removed anywhere to
    // the left used to silently retarget this at a different cell.
    const pointsCell = cells.find(
      (cell) => cell.textContent?.trim() === String(ASSIGNMENTS[1].points)
    )!;

    fireEvent.click(pointsCell);
    fireEvent.click(cells[cells.length - 1]);

    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it("names the late-submissions switch after the assignment", () => {
    renderWithMantine(<AssignmentList {...baseProps()} />);

    expect(
      screen.getByRole("switch", { name: "Allow late submissions for Bravo" })
    ).toBeInTheDocument();
  });

  it("invokes onImport when the import button is clicked", () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(props.onImport).toHaveBeenCalledTimes(1);
  });

  it("confirms deletion with the assignment name before calling onRemove", async () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} />);

    const bravoRow = screen.getByRole("button", { name: "Bravo" }).closest("tr")!;

    fireEvent.click(within(bravoRow).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Delete assignment")).toBeInTheDocument();
    expect(screen.getByText('Delete "Bravo"? This can\'t be undone.')).toBeInTheDocument();
    expect(props.onRemove).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(props.onRemove).toHaveBeenCalledWith(ASSIGNMENTS[1]);
  });

  it("persists sorting changes to localStorage", () => {
    renderWithMantine(<AssignmentList {...baseProps()} />);

    fireEvent.click(screen.getByText("Name"));

    expect(localStorage.getItem("assignmentList_sortField")).toBe("name");
    expect(localStorage.getItem("assignmentList_sortOrder")).toBe("-1");
  });

  it("keeps toggling between ascending and descending on every header click", () => {
    renderWithMantine(<AssignmentList {...baseProps()} />);

    const header = screen.getByText("Name");

    fireEvent.click(header);
    expect(localStorage.getItem("assignmentList_sortOrder")).toBe("-1");

    fireEvent.click(header);
    expect(localStorage.getItem("assignmentList_sortOrder")).toBe("1");

    fireEvent.click(header);
    expect(localStorage.getItem("assignmentList_sortOrder")).toBe("-1");
  });

  it("restores the persisted sort order on mount", () => {
    localStorage.setItem("assignmentList_sortField", "name");
    localStorage.setItem("assignmentList_sortOrder", "-1");

    renderWithMantine(<AssignmentList {...baseProps()} />);

    const rows = screen.getAllByRole("button", { name: /Alpha|Bravo|Charlie/ });

    expect(rows[0]).toHaveTextContent("Charlie");
  });

  it("hides the bulk actions bar until a row is selected", () => {
    renderWithMantine(<AssignmentList {...baseProps()} />);

    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Bravo" }));

    expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("selects every row through the header checkbox", () => {
    renderWithMantine(<AssignmentList {...baseProps()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all assignments" }));

    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("clears the selection from the bulk actions bar", () => {
    renderWithMantine(<AssignmentList {...baseProps()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all assignments" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("applies a bulk visibility change to the selected assignments and clears the selection", () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Bravo" }));
    fireEvent.click(screen.getByRole("button", { name: "Visibility" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(props.onBulkVisibilityChange).toHaveBeenCalledWith([ASSIGNMENTS[0], ASSIGNMENTS[1]], {
      visible: true,
      visible_on: null,
      hidden_on: null
    });
    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("applies a bulk late-submissions change to the selected assignments", () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Charlie" }));
    fireEvent.click(screen.getByRole("button", { name: "Late submissions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Don't allow late submissions" }));

    expect(props.onBulkEnforceDueChange).toHaveBeenCalledWith([ASSIGNMENTS[2]], true);
  });

  it("confirms a bulk delete before calling onBulkRemove", async () => {
    const props = baseProps();

    renderWithMantine(<AssignmentList {...props} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all assignments" }));

    const toolbar = screen.getByRole("toolbar", { name: "Bulk actions" });

    fireEvent.click(within(toolbar).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Delete assignments")).toBeInTheDocument();
    expect(props.onBulkRemove).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(props.onBulkRemove).toHaveBeenCalledWith(ASSIGNMENTS);
  });
});
