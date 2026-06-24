import { ColumnDef } from "@tanstack/react-table";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMantine, screen, fireEvent } from "@/test/renderWithMantine";

import { DataGrid } from "./DataGrid";

interface Row {
  id: string;
  name: string;
  score: number;
}

const ROWS: Row[] = [
  { id: "a", name: "Alpha", score: 3 },
  { id: "b", name: "Bravo", score: 1 },
  { id: "c", name: "Charlie", score: 2 }
];

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "score", header: "Score" }
];

const renderGrid = (props: Partial<React.ComponentProps<typeof DataGrid<Row>>> = {}) =>
  renderWithMantine(
    <DataGrid<Row> data={ROWS} columns={COLUMNS} getRowId={(r) => r.id} {...props} />
  );

describe("DataGrid", () => {
  it("renders a row per data item", () => {
    renderGrid();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("shows the empty message when there is no data", () => {
    renderGrid({ data: [], emptyMessage: "Nothing here" });
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders a loader while loading", () => {
    const { container } = renderGrid({ loading: true });
    expect(container.querySelector(".mantine-Loader-root")).toBeTruthy();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("paginates when data exceeds the page size", () => {
    renderGrid({ initialPageSize: 2 });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("invokes onRowClick with the clicked row", () => {
    const onRowClick = vi.fn();
    renderGrid({ onRowClick });
    fireEvent.click(screen.getByText("Bravo"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  it("orders rows by initialSorting before user interaction", () => {
    renderGrid({ initialSorting: [{ id: "score", desc: false }], initialPageSize: 1 });
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("renders meta.hiddenHeaderLabel as screen-reader-only header text", () => {
    const columns: ColumnDef<Row, unknown>[] = [
      { accessorKey: "name", header: "Name" },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { hiddenHeaderLabel: "Actions" },
        cell: () => null
      }
    ];

    renderGrid({ columns });

    const actionsHeader = screen.getByRole("columnheader", { name: "Actions" });

    expect(actionsHeader).toBeInTheDocument();
  });

  it("applies meta.align to body cells and meta.cellClassName to the cell element", () => {
    const columns: ColumnDef<Row, unknown>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "score", header: "Score", meta: { align: "right", cellClassName: "numeric" } }
    ];

    renderWithMantine(<DataGrid<Row> data={ROWS} columns={columns} getRowId={(r) => r.id} />);

    const cell = screen.getByText("3").closest("td");

    expect(cell).toHaveStyle({ textAlign: "right" });
    expect(cell).toHaveClass("numeric");
  });

  it("keeps cycling asc/desc on repeated header clicks when sorting removal is disabled", () => {
    renderGrid({
      initialSorting: [{ id: "score", desc: false }],
      initialPageSize: 1,
      enableSortingRemoval: false
    });

    const header = screen.getByText("Score");

    fireEvent.click(header);
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByText("Bravo")).toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("invokes meta.onCellClick with the row when a cell is clicked", () => {
    const onCellClick = vi.fn();
    const columns: ColumnDef<Row, unknown>[] = [
      { accessorKey: "name", header: "Name", meta: { onCellClick } },
      { accessorKey: "score", header: "Score" }
    ];

    renderWithMantine(<DataGrid<Row> data={ROWS} columns={columns} getRowId={(r) => r.id} />);

    fireEvent.click(screen.getByText("Bravo"));
    expect(onCellClick).toHaveBeenCalledWith(ROWS[1]);

    fireEvent.click(screen.getByText("3"));
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it("passes minWidth to the table scroll container", () => {
    const { container } = renderGrid({ minWidth: 880 });
    const scrollContainer = container.querySelector(
      ".mantine-TableScrollContainer-scrollContainer"
    );

    expect(scrollContainer?.getAttribute("style")).toContain("--table-min-width: calc(55rem");
  });

  it("renders sortable headers as real buttons that sort on activation", () => {
    renderGrid({
      initialSorting: [{ id: "score", desc: false }],
      initialPageSize: 1,
      enableSortingRemoval: false
    });

    expect(screen.getByText("Bravo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("exposes the sort state through aria-sort on the header cell", () => {
    renderGrid();

    const scoreHeader = screen.getByRole("button", { name: "Score" }).closest("th");

    expect(scoreHeader).toHaveAttribute("aria-sort", "none");

    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    expect(scoreHeader).toHaveAttribute("aria-sort", "descending");

    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    expect(scoreHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("does not render a button for non-sortable headers", () => {
    const columns: ColumnDef<Row, unknown>[] = [
      { accessorKey: "name", header: "Name", enableSorting: false },
      { accessorKey: "score", header: "Score" }
    ];

    renderWithMantine(<DataGrid<Row> data={ROWS} columns={columns} getRowId={(r) => r.id} />);

    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument();
    expect(screen.getByText("Name").closest("th")).not.toHaveAttribute("aria-sort");
    expect(screen.getByRole("button", { name: "Score" })).toBeInTheDocument();
  });

  it("labels the rows-per-page select", () => {
    renderGrid();
    expect(screen.getByRole("textbox", { name: "Rows per page" })).toBeInTheDocument();
  });

  it("announces the empty state through a status role with the default copy", () => {
    renderGrid({ data: [] });

    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("Nothing here yet");
  });

  it("announces loading through a status role and marks the container busy", () => {
    const { container } = renderGrid({ loading: true });

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("labels the global filter input from its placeholder", () => {
    renderGrid({ enableGlobalFilter: true, globalFilterPlaceholder: "Search assignments" });

    expect(screen.getByRole("textbox", { name: "Search assignments" })).toBeInTheDocument();
  });

  it("renders its own scroll area with a sentinel in fillHeight mode", () => {
    const sentinelRef = vi.fn();
    const { container } = renderGrid({ fillHeight: true, scrollSentinelRef: sentinelRef });

    expect(container.querySelector(".mantine-TableScrollContainer-scrollContainer")).toBeNull();
    expect(container.querySelector("[data-scroll-sentinel]")).not.toBeNull();
    expect(sentinelRef).toHaveBeenCalled();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("does not render a scroll sentinel by default", () => {
    const { container } = renderGrid();

    expect(container.querySelector("[data-scroll-sentinel]")).toBeNull();
  });
});

describe("DataGrid column filters", () => {
  const FILTER_COLUMNS: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      filterFn: "includesString",
      meta: { filter: { variant: "text", placeholder: "filter-name" } }
    },
    {
      accessorKey: "score",
      header: "Score",
      meta: { filter: { variant: "numeric", placeholder: "filter-score" } }
    }
  ];

  it("renders filter controls only when enableColumnFilters is set", () => {
    const { rerender } = renderWithMantine(
      <DataGrid<Row> data={ROWS} columns={FILTER_COLUMNS} getRowId={(r) => r.id} />
    );
    expect(screen.queryByPlaceholderText("filter-name")).not.toBeInTheDocument();

    rerender(
      <DataGrid<Row>
        data={ROWS}
        columns={FILTER_COLUMNS}
        getRowId={(r) => r.id}
        enableColumnFilters
      />
    );
    expect(screen.getByPlaceholderText("filter-name")).toBeInTheDocument();
  });

  it("narrows rows with the text column filter", () => {
    renderWithMantine(
      <DataGrid<Row>
        data={ROWS}
        columns={FILTER_COLUMNS}
        getRowId={(r) => r.id}
        enableColumnFilters
      />
    );
    fireEvent.change(screen.getByPlaceholderText("filter-name"), { target: { value: "Alp" } });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("labels filter controls after their column header", () => {
    renderWithMantine(
      <DataGrid<Row>
        data={ROWS}
        columns={FILTER_COLUMNS}
        getRowId={(r) => r.id}
        enableColumnFilters
      />
    );

    expect(screen.getByRole("textbox", { name: "Filter by Name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Filter by Score" })).toBeInTheDocument();
  });

  it("renders a custom filter element", () => {
    const columns: ColumnDef<Row, unknown>[] = [
      {
        accessorKey: "name",
        header: "Name",
        enableColumnFilter: false,
        meta: { filter: { variant: "custom", element: () => <div>custom-filter-slot</div> } }
      },
      { accessorKey: "score", header: "Score" }
    ];
    renderWithMantine(
      <DataGrid<Row> data={ROWS} columns={columns} getRowId={(r) => r.id} enableColumnFilters />
    );
    expect(screen.getByText("custom-filter-slot")).toBeInTheDocument();
  });

  it("uses controlled sorting and reports changes via onSortingChange", () => {
    const onSortingChange = vi.fn();

    renderGrid({ sorting: [{ id: "name", desc: false }], onSortingChange });
    fireEvent.click(screen.getByText("Name"));
    expect(onSortingChange).toHaveBeenCalledTimes(1);
  });

  it("orders rows according to controlled descending sorting", () => {
    renderGrid({ sorting: [{ id: "score", desc: true }] });
    const cells = screen.getAllByText(/Alpha|Bravo|Charlie/).map((el) => el.textContent);
    expect(cells[0]).toBe("Alpha");
    expect(cells[2]).toBe("Bravo");
  });

  it("does not re-render endlessly when data/columns identities change with filters disabled", () => {
    const Harness = () => {
      const [tick, setTick] = React.useState(0);
      const data = ROWS.map((r) => ({ ...r }));
      const columns: ColumnDef<Row, unknown>[] = [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "score", header: "Score" }
      ];

      return (
        <>
          <button onClick={() => setTick((t) => t + 1)}>bump {tick}</button>
          <DataGrid<Row> data={data} columns={columns} getRowId={(r) => r.id} />
        </>
      );
    };

    renderWithMantine(<Harness />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/bump/));
    fireEvent.click(screen.getByText(/bump/));

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });
});
