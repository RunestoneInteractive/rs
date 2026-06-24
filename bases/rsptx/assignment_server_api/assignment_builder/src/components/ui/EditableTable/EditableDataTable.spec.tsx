import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { EditableColumn, EditableDataTable } from "./EditableDataTable";

interface Row {
  id: number;
  name: string;
  points: number;
}

const ROWS: Row[] = [
  { id: 1, name: "Alpha", points: 1 },
  { id: 2, name: "Bravo", points: 2 }
];

const COLUMNS: EditableColumn<Row>[] = [
  { key: "name", header: "Name", render: (row) => <span>{row.name}</span> },
  { key: "points", header: "Points", field: "points", render: (row) => <span>{row.points}</span> }
];

const renderTable = (
  overrides: Partial<React.ComponentProps<typeof EditableDataTable<Row>>> = {}
) =>
  renderWithMantine(
    <EditableDataTable
      data={ROWS}
      columns={COLUMNS}
      selection={[]}
      onSelectionChange={() => {}}
      onReorder={() => {}}
      emptyMessage="No rows"
      {...overrides}
    />
  );

describe("EditableDataTable", () => {
  it("renders a row per data item tagged with its id", () => {
    const { container } = renderTable();

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr[data-item-id]")).toHaveLength(2);
  });

  it("marks editable columns with a data-field attribute for the overlay", () => {
    const { container } = renderTable();

    expect(container.querySelectorAll('td[data-field="points"]')).toHaveLength(2);
  });

  it("adds a row to the selection when its checkbox is toggled on", async () => {
    const onSelectionChange = vi.fn();

    renderTable({ onSelectionChange });
    await userEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));

    expect(onSelectionChange).toHaveBeenCalledWith([ROWS[0]]);
  });

  it("removes a row from the selection when its checkbox is toggled off", async () => {
    const onSelectionChange = vi.fn();

    renderTable({ selection: [ROWS[0]], onSelectionChange });
    await userEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("selects every row through the header select-all checkbox", async () => {
    const onSelectionChange = vi.fn();

    renderTable({ onSelectionChange });
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all rows" }));

    expect(onSelectionChange).toHaveBeenCalledWith(ROWS);
  });

  it("renders the empty message when there is no data", () => {
    renderTable({ data: [] });
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });

  it("announces the empty state through a status role", () => {
    renderTable({ data: [] });

    const emptyCell = screen.getByText("No rows").closest("td");

    expect(emptyCell).toHaveAttribute("role", "status");
  });

  it("names row checkboxes and drag handles from getRowLabel when provided", () => {
    renderTable({ getRowLabel: (row: Row) => row.name });

    expect(screen.getByRole("checkbox", { name: "Select Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Bravo" })).toBeInTheDocument();
  });

  it("falls back to id-based row labels without getRowLabel", () => {
    renderTable();

    expect(screen.getByRole("checkbox", { name: "Select row 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder row 1" })).toBeInTheDocument();
  });

  it("renders hiddenHeaderLabel as screen-reader-only header text and names the reorder column", () => {
    renderTable({
      columns: [
        ...COLUMNS,
        {
          key: "preview",
          header: "",
          hiddenHeaderLabel: "Preview",
          render: () => null
        }
      ]
    });

    expect(screen.getByRole("columnheader", { name: "Preview" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Reorder" })).toBeInTheDocument();
  });

  it("applies right alignment to header and body cells of right-aligned columns", () => {
    const { container } = renderTable({
      columns: [
        ...COLUMNS,
        {
          key: "score",
          header: "Score",
          align: "right",
          render: (row: Row) => <span>{row.points}</span>
        }
      ]
    });

    const headers = container.querySelectorAll("thead th");
    const lastHeader = headers[headers.length - 2];

    expect(lastHeader).toHaveStyle({ textAlign: "right" });

    const firstRowCells = container.querySelectorAll("tbody tr:first-child td");
    const scoreCell = firstRowCells[firstRowCells.length - 2];

    expect(scoreCell).toHaveStyle({ textAlign: "right" });
  });

  it("marks the container as flush in flush mode only", () => {
    const { container, unmount } = renderTable({ flush: true });

    expect(container.querySelector("table")?.closest("div")).toHaveAttribute("data-flush");
    unmount();

    const { container: plain } = renderTable();

    expect(plain.querySelector("table")?.closest("div")).not.toHaveAttribute("data-flush");
  });

  it("marks selected rows for the selected-row styling", () => {
    const { container } = renderTable({ selection: [ROWS[0]] });

    expect(container.querySelector('tr[data-item-id="1"]')).toHaveAttribute("data-selected");
    expect(container.querySelector('tr[data-item-id="2"]')).not.toHaveAttribute("data-selected");
  });

  it("marks flush columns so cell controls can fill the cell", () => {
    const { container } = renderTable({
      columns: [
        ...COLUMNS,
        { key: "req", header: "Req", flushCell: true, render: (row: Row) => <span>{row.id}</span> }
      ]
    });

    expect(container.querySelectorAll("td[data-flush-cell]")).toHaveLength(ROWS.length);
  });

  it("renders a scroll sentinel only when a sentinel ref is provided", () => {
    const sentinelRef = vi.fn();
    const { container, unmount } = renderTable({ scrollSentinelRef: sentinelRef });

    expect(container.querySelector("[data-scroll-sentinel]")).not.toBeNull();
    expect(sentinelRef).toHaveBeenCalled();
    unmount();

    const { container: plain } = renderTable();

    expect(plain.querySelector("[data-scroll-sentinel]")).toBeNull();
  });
});
