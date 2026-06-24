import {
  Center,
  Group,
  Loader,
  NumberInput,
  Pagination,
  Select,
  Table,
  Text,
  TextInput,
  UnstyledButton,
  VisuallyHidden
} from "@mantine/core";
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  PaginationState,
  RowData,
  RowSelectionState,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import React, { RefCallback, useMemo, useState } from "react";

import { Icon } from "./Icon";

import styles from "./DataGrid.module.css";

export type DataGridFilter<TData extends RowData, TValue> =
  | { variant: "text"; placeholder?: string }
  | { variant: "numeric"; placeholder?: string }
  | { variant: "select"; placeholder?: string; options: { label: string; value: string }[] }
  | { variant: "custom"; element: (column: Column<TData, TValue>) => React.ReactNode };

export type DataGridAlign = "left" | "center" | "right";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerStyle?: React.CSSProperties;
    filter?: DataGridFilter<TData, TValue>;
    align?: DataGridAlign;
    cellClassName?: string;
    hiddenHeaderLabel?: string;
    onCellClick?: (row: TData) => void;
  }
}

const HEADER_JUSTIFY: Record<DataGridAlign, string | undefined> = {
  left: undefined,
  center: "center",
  right: "flex-end"
};

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  enableGlobalFilter?: boolean;
  globalFilterPlaceholder?: string;
  enableColumnFilters?: boolean;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  pageCount?: number;
  manualSorting?: boolean;
  manualPagination?: boolean;
  manualFiltering?: boolean;
  enableSortingRemoval?: boolean;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  initialSorting?: SortingState;
  loading?: boolean;
  emptyMessage?: React.ReactNode;
  ariaLabel?: string;
  minWidth?: number;
  fillHeight?: boolean;
  scrollSentinelRef?: RefCallback<HTMLElement>;
  "data-tour"?: string;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

const PAGINATION_CONTROL_LABELS: Record<string, string> = {
  first: "First page",
  previous: "Previous page",
  next: "Next page",
  last: "Last page"
};

const ARIA_SORT: Record<string, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending"
};

function getColumnFilterLabel<T>(column: Column<T, unknown>): string {
  const header = column.columnDef.header;

  return typeof header === "string" && header ? `Filter by ${header}` : "Filter";
}

function ColumnFilterControl<T>({ column }: { column: Column<T, unknown> }) {
  const filter = column.columnDef.meta?.filter;
  if (!filter) return null;

  if (filter.variant === "custom") {
    return <>{filter.element(column)}</>;
  }

  const filterLabel = getColumnFilterLabel(column);

  if (filter.variant === "select") {
    return (
      <Select
        size="xs"
        value={(column.getFilterValue() as string | undefined) ?? null}
        onChange={(v) => column.setFilterValue(v ?? undefined)}
        data={filter.options}
        placeholder={filter.placeholder ?? "Any"}
        aria-label={filterLabel}
        clearable
        comboboxProps={{ withinPortal: true }}
      />
    );
  }

  if (filter.variant === "numeric") {
    return (
      <NumberInput
        size="xs"
        value={(column.getFilterValue() as number | undefined) ?? ""}
        onChange={(v) => column.setFilterValue(typeof v === "number" ? v : undefined)}
        placeholder={filter.placeholder ?? "="}
        aria-label={filterLabel}
      />
    );
  }

  return (
    <TextInput
      size="xs"
      value={(column.getFilterValue() as string | undefined) ?? ""}
      onChange={(e) => column.setFilterValue(e.currentTarget.value || undefined)}
      placeholder={filter.placeholder ?? "Search"}
      aria-label={filterLabel}
    />
  );
}

export function DataGrid<T>({
  data,
  columns,
  getRowId,
  onRowClick,
  enableGlobalFilter = false,
  globalFilterPlaceholder = "Search…",
  enableColumnFilters = false,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
  sorting: controlledSorting,
  onSortingChange,
  pagination: controlledPagination,
  onPaginationChange,
  pageCount,
  manualSorting = false,
  manualPagination = false,
  manualFiltering = false,
  enableSortingRemoval = true,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  initialPageSize = 25,
  initialSorting = [],
  loading = false,
  emptyMessage = "Nothing here yet",
  ariaLabel,
  minWidth = 0,
  fillHeight = false,
  scrollSentinelRef,
  ...rest
}: DataGridProps<T>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize
  });
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});

  const sorting = controlledSorting ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const setColumnFilters = onColumnFiltersChange ?? setInternalColumnFilters;
  const pagination = controlledPagination ?? internalPagination;
  const setPagination = onPaginationChange ?? setInternalPagination;
  const selection = rowSelection ?? internalSelection;
  const handleSelection = onRowSelectionChange ?? setInternalSelection;

  const table = useReactTable({
    data,
    columns,
    getRowId,
    pageCount: manualPagination ? pageCount : undefined,
    manualSorting,
    manualPagination,
    manualFiltering,
    state: {
      sorting,
      pagination,
      globalFilter: enableGlobalFilter ? globalFilter : undefined,
      columnFilters,
      rowSelection: selection
    },
    enableRowSelection,
    enableColumnFilters,
    enableSortingRemoval,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: handleSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel()
  });

  const resolvedPageCount = table.getPageCount();
  const rows = table.getRowModel().rows;

  const sizeData = useMemo(
    () => pageSizeOptions.map((n) => ({ value: String(n), label: String(n) })),
    [pageSizeOptions]
  );

  const tableElement = (
    <Table highlightOnHover stickyHeader aria-label={ariaLabel} verticalSpacing="xs">
      <Table.Thead>
        {table.getHeaderGroups().map((hg) => (
          <Table.Tr key={hg.id}>
            {hg.headers.map((header) => {
              const canSort = header.column.getCanSort();
              const sorted = header.column.getIsSorted();
              const meta = header.column.columnDef.meta;
              const headerContent = header.isPlaceholder ? null : (
                <>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {meta?.hiddenHeaderLabel && (
                    <VisuallyHidden>{meta.hiddenHeaderLabel}</VisuallyHidden>
                  )}
                </>
              );

              return (
                <Table.Th
                  key={header.id}
                  style={meta?.headerStyle}
                  aria-sort={canSort ? (sorted ? ARIA_SORT[sorted] : "none") : undefined}
                >
                  {canSort ? (
                    <UnstyledButton
                      type="button"
                      className={styles.sortButton}
                      data-align={meta?.align ?? "left"}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {headerContent}
                      <span className={styles.sortIcon} aria-hidden="true">
                        {sorted && (
                          <Icon name={sorted === "asc" ? "chevron-up" : "chevron-down"} size={13} />
                        )}
                      </span>
                    </UnstyledButton>
                  ) : (
                    <Group gap={4} wrap="nowrap" justify={HEADER_JUSTIFY[meta?.align ?? "left"]}>
                      {headerContent}
                    </Group>
                  )}
                </Table.Th>
              );
            })}
          </Table.Tr>
        ))}
        {enableColumnFilters &&
          table.getHeaderGroups().map((hg) => (
            <Table.Tr key={`filter-${hg.id}`}>
              {hg.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                return (
                  <Table.Th
                    key={header.id}
                    style={{ ...meta?.headerStyle, padding: "4px 8px", fontWeight: 400 }}
                  >
                    {meta?.filter ? <ColumnFilterControl column={header.column} /> : null}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          ))}
      </Table.Thead>
      <Table.Tbody>
        {loading ? (
          <Table.Tr>
            <Table.Td colSpan={columns.length}>
              <Center py="xl" role="status" aria-label="Loading">
                <Loader />
              </Center>
            </Table.Td>
          </Table.Tr>
        ) : rows.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={columns.length}>
              <Center py="xl" role="status">
                <Text className={styles.mutedText}>{emptyMessage}</Text>
              </Center>
            </Table.Td>
          </Table.Tr>
        ) : (
          rows.map((row) => (
            <Table.Tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
              data-selected={row.getIsSelected() || undefined}
            >
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta;
                const onCellClick = meta?.onCellClick;
                return (
                  <Table.Td
                    key={cell.id}
                    className={meta?.cellClassName}
                    style={meta?.align ? { textAlign: meta.align } : undefined}
                    onClick={onCellClick ? () => onCellClick(row.original) : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );

  return (
    <div
      data-tour={rest["data-tour"]}
      className={fillHeight ? styles.rootFill : undefined}
      aria-busy={loading || undefined}
    >
      {enableGlobalFilter && (
        <Group justify="flex-end" mb="sm">
          <TextInput
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.currentTarget.value)}
            placeholder={globalFilterPlaceholder}
            aria-label={globalFilterPlaceholder}
            leftSection={<Icon name="search" />}
            size="sm"
          />
        </Group>
      )}

      {fillHeight ? (
        <div className={styles.scrollFill}>
          {scrollSentinelRef && (
            <div
              ref={scrollSentinelRef}
              className={styles.scrollSentinel}
              data-scroll-sentinel=""
            />
          )}
          {tableElement}
        </div>
      ) : (
        <Table.ScrollContainer minWidth={minWidth}>{tableElement}</Table.ScrollContainer>
      )}

      <Group
        justify="space-between"
        mt={fillHeight ? 0 : "sm"}
        className={fillHeight ? `${styles.footer} ${styles.footerFill}` : styles.footer}
      >
        <Group gap="xs">
          <Text size="sm" className={styles.mutedText}>
            Rows per page
          </Text>
          <Select
            size="xs"
            w={84}
            data={sizeData}
            value={String(pagination.pageSize)}
            onChange={(v) =>
              v && setPagination((p) => ({ ...p, pageIndex: 0, pageSize: Number(v) }))
            }
            allowDeselect={false}
            aria-label="Rows per page"
          />
        </Group>
        {resolvedPageCount > 1 && (
          <Pagination
            size="sm"
            total={resolvedPageCount}
            value={pagination.pageIndex + 1}
            onChange={(page) => setPagination((p) => ({ ...p, pageIndex: page - 1 }))}
            getControlProps={(control) => ({
              "aria-label": PAGINATION_CONTROL_LABELS[control] ?? control
            })}
          />
        )}
      </Group>
    </div>
  );
}
