import { Button, Center, Loader } from "@mantine/core";
import { ColumnDef, FilterFn } from "@tanstack/react-table";
import React, { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Link, useNavigate } from "react-router-dom";

import { DataGrid } from "@/components/ui/DataGrid";
import { Icon } from "@/components/ui/Icon";
import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";

import { ReleaseStatusBadge } from "../components/ReleaseStatusBadge";
import { GraderViewMode, ViewModeToggle } from "../components/ViewModeToggle";
import styles from "../Grader.module.css";
import { useViewModeStorage } from "../hooks/useViewModeStorage";
import { effectiveViewMode } from "../state/graderSelectors";
import { DEMO_ASSIGNMENTS } from "../tour/graderDemoData";
import { useGraderTourContext } from "../tour/GraderTourContext";

const VIEW_MODES = ["cards", "table"] as const satisfies readonly GraderViewMode[];
const VIEW_MODE_STORAGE_KEY = "grader.assignmentsViewMode";

const formatDate = (iso?: string | null) => {
  if (!iso) return "No due date";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return iso;
  }
};

const matchesDateRange = (
  dueDate: Date | null,
  range: [Date | null, Date | null] | null
): boolean => {
  if (!range) return true;
  const [from, to] = range;
  if (!from && !to) return true;
  if (!dueDate) return false;
  const t = dueDate.getTime();
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (t < start.getTime()) return false;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
};

type Assignment = NonNullable<ReturnType<typeof useGetAssignmentsQuery>["data"]>[number];
type AssignmentRow = Assignment & { duedateDate: Date | null; duedateDisplay: string };

const numericEquals: FilterFn<AssignmentRow> = (row, columnId, value) => {
  if (value == null || value === "") return true;
  return Number(row.getValue(columnId)) === Number(value);
};

export const GraderAssignmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: realAssignments, isLoading } = useGetAssignmentsQuery();
  const { isDemo } = useGraderTourContext();
  const assignments = isDemo ? DEMO_ASSIGNMENTS : realAssignments;

  const [viewMode, setViewMode] = useViewModeStorage<GraderViewMode>(
    VIEW_MODE_STORAGE_KEY,
    VIEW_MODES,
    "cards"
  );
  const activeViewMode = effectiveViewMode<GraderViewMode>(isDemo, viewMode, "cards");

  const [dateRange, setDateRange] = useState<[Date | null, Date | null] | null>(null);

  const columns = useMemo<ColumnDef<AssignmentRow, unknown>[]>(() => {
    const [startDate, endDate] = dateRange ?? [null, null];
    return [
      {
        accessorKey: "name",
        header: "Name",
        filterFn: "includesString",
        meta: { filter: { variant: "text", placeholder: "Search name" } },
        cell: ({ row }) => (
          <div className={styles.iconText}>
            <Icon name="file-edit" className={styles.metaIcon} />
            {row.original.name}
          </div>
        )
      },
      {
        accessorKey: "description",
        header: "Description",
        filterFn: "includesString",
        meta: { filter: { variant: "text", placeholder: "Search description" } },
        cell: ({ row }) =>
          row.original.description ? (
            <span className={styles.cellMuted} title={row.original.description}>
              {row.original.description}
            </span>
          ) : (
            <span className={styles.cellDash}>—</span>
          )
      },
      {
        id: "duedate",
        header: "Due date",
        accessorFn: (row) => (row.duedateDate ? row.duedateDate.getTime() : 0),
        sortingFn: "basic",
        enableColumnFilter: false,
        meta: {
          headerStyle: { width: 240 },
          cellClassName: "numeric",
          filter: {
            variant: "custom",
            element: () => (
              <DatePicker
                selectsRange
                startDate={startDate ?? undefined}
                endDate={endDate ?? undefined}
                onChange={(dates) => {
                  const [from, to] = (dates as [Date | null, Date | null]) ?? [null, null];
                  setDateRange(!from && !to ? null : [from, to]);
                }}
                isClearable
                dateFormat="MMM d, yyyy"
                placeholderText="Pick range"
                className={styles.dateFilterInput}
                wrapperClassName={styles.dateFilterWrapper}
                popperClassName={styles.dateFilterPopper}
                portalId="root"
              />
            )
          }
        },
        cell: ({ row }) => (
          <span className={styles.iconText}>
            <Icon name="calendar" className={styles.metaIcon} />
            {row.original.duedateDisplay}
          </span>
        )
      },
      {
        accessorKey: "points",
        header: "Points",
        filterFn: numericEquals,
        meta: {
          headerStyle: { width: 140 },
          align: "right",
          cellClassName: "numeric",
          filter: { variant: "numeric", placeholder: "=" }
        },
        cell: ({ row }) => (
          <span>
            <strong className={styles.cellStrong}>{row.original.points ?? 0}</strong>
            <span className={styles.cellSubtle}> pts</span>
          </span>
        )
      },
      {
        id: "released",
        header: "Visibility",
        accessorFn: (row) => (row.released ? 1 : 0),
        sortingFn: "basic",
        enableColumnFilter: false,
        meta: { headerStyle: { width: 130 } },
        cell: ({ row }) => <ReleaseStatusBadge released={row.original.released} />
      },
      {
        id: "chevron",
        header: "",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { headerStyle: { width: 60 }, align: "center", hiddenHeaderLabel: "Open" },
        cell: () => <Icon name="angle-right" className={styles.cellLink} />
      }
    ];
  }, [dateRange]);

  if (!assignments && isLoading) {
    return (
      <Center className={styles.loadingWrap}>
        <Loader />
      </Center>
    );
  }

  if (!assignments?.length) {
    return (
      <div className={styles.emptyState}>
        <Icon name="inbox" size={30} className={styles.emptyStateIcon} />
        <h3>No assignments yet</h3>
        <p>Create an assignment in the Assignment Builder to start grading.</p>
      </div>
    );
  }

  const allRows: AssignmentRow[] = assignments.map((a) => ({
    ...a,
    duedateDate: a.duedate ? new Date(a.duedate) : null,
    duedateDisplay: formatDate(a.duedate)
  })) as AssignmentRow[];

  const rows = dateRange
    ? allRows.filter((r) => matchesDateRange(r.duedateDate, dateRange))
    : allRows;

  const viewToggle = (
    <div className={styles.toolbar}>
      <Button
        component={Link}
        to="/grader/gradebook"
        leftSection={<Icon name="table" size={14} />}
        variant="light"
        size="xs"
        disabled={isDemo}
      >
        Gradebook
      </Button>
      <ViewModeToggle
        value={activeViewMode}
        onChange={setViewMode}
        ariaLabel="Toggle assignments view"
        tourId="grader-assignments-view-toggle"
        disabled={isDemo}
      />
    </div>
  );

  if (activeViewMode === "table") {
    return (
      <>
        {viewToggle}
        <div className={styles.tableWrap} data-tour="grader-assignment-picker">
          <DataGrid<AssignmentRow>
            data={rows}
            columns={columns}
            getRowId={(r) => String(r.id)}
            onRowClick={(row) => navigate(`/grader/${row.id}`)}
            enableColumnFilters
            enableSortingRemoval={false}
            initialSorting={[{ id: "duedate", desc: false }]}
            initialPageSize={25}
            ariaLabel="Assignments"
            emptyMessage="No assignments match the current filters."
          />
        </div>
      </>
    );
  }

  return (
    <>
      {viewToggle}
      <section
        className={styles.grid}
        data-tour="grader-assignment-picker"
        aria-label="Assignments"
      >
        {assignments.map((a, idx) => (
          <button
            key={a.id}
            data-tour={idx === 0 ? "grader-assignment-card" : undefined}
            className={styles.card}
            onClick={() => navigate(`/grader/${a.id}`)}
          >
            <div className={styles.cardTitle}>
              <Icon name="file-edit" className={styles.metaIcon} />
              {a.name}
            </div>
            {a.description && <div className={styles.cardDescription}>{a.description}</div>}
            <div className={styles.metaRow}>
              <span>
                <Icon name="calendar" size={14} /> <strong>{formatDate(a.duedate)}</strong>
              </span>
              <span>
                <Icon name="star" size={14} /> <strong>{a.points ?? 0}</strong> pts
              </span>
            </div>
            <div className={styles.cardBadgeRow}>
              <ReleaseStatusBadge released={a.released} />
            </div>
          </button>
        ))}
      </section>
    </>
  );
};

export default GraderAssignmentsPage;
