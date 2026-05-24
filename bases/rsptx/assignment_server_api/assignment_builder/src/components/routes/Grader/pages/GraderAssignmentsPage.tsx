import { FilterMatchMode } from "primereact/api";
import { Column } from "primereact/column";
import { DataTable, DataTableFilterMeta } from "primereact/datatable";
import { ProgressSpinner } from "primereact/progressspinner";
import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";

import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";

import {
  GraderViewMode,
  ViewModeToggle
} from "../components/ViewModeToggle";
import styles from "../Grader.module.css";
import { useViewModeStorage } from "../hooks/useViewModeStorage";
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

const buildInitialFilters = (): DataTableFilterMeta => ({
  name: { value: null, matchMode: FilterMatchMode.CONTAINS },
  description: { value: null, matchMode: FilterMatchMode.CONTAINS },
  points: { value: null, matchMode: FilterMatchMode.EQUALS }
});

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

  const [filters, setFilters] = useState<DataTableFilterMeta>(buildInitialFilters);

  const [dateRange, setDateRange] = useState<[Date | null, Date | null] | null>(
    null
  );

  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [sortField, setSortField] = useState<string | undefined>("duedateDate");
  const [sortOrder, setSortOrder] = useState<1 | -1 | 0 | null | undefined>(1);

  if (!assignments && isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
        <ProgressSpinner />
      </div>
    );
  }

  if (!assignments?.length) {
    return (
      <div className={styles.emptyState}>
        <i className="pi pi-inbox" style={{ fontSize: 32 }} />
        <h3>No assignments yet</h3>
        <p>Create an assignment in the Assignment Builder to start grading.</p>
      </div>
    );
  }

  const allRows = assignments.map((a) => ({
    ...a,
    duedateDate: a.duedate ? new Date(a.duedate) : null,
    duedateDisplay: formatDate(a.duedate)
  }));

  const rows = dateRange
    ? allRows.filter((r) => matchesDateRange(r.duedateDate, dateRange))
    : allRows;

  const viewToggle = (
    <ViewModeToggle
      value={viewMode}
      onChange={setViewMode}
      ariaLabel="Toggle assignments view"
      tourId="grader-assignments-view-toggle"
    />
  );

  if (viewMode === "table") {
    return (
      <>
        {viewToggle}
        <div className={styles.tableWrap} data-tour="grader-assignment-picker">
          <DataTable
            value={rows}
            paginator
            first={first}
            rows={rowsPerPage}
            onPage={(e) => {
              setFirst(e.first);
              setRowsPerPage(e.rows);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={(e) => {
              setSortField(e.sortField);
              setSortOrder(e.sortOrder as 1 | -1 | 0 | null | undefined);
              setFirst(0);
            }}
            selectionMode="single"
            onRowClick={(e) => {
              const row = e.data as (typeof rows)[number];
              navigate(`/grader/${row.id}`);
            }}
            rowHover
            className={styles.row}
            emptyMessage="No assignments match the current filters."
            filters={filters}
            onFilter={(e) => {
              setFilters(e.filters);
              setFirst(0);
            }}
            filterDisplay="row"
          >
            <Column
              header="Name"
              field="name"
              sortable
              filter
              filterPlaceholder="Search name"
              showFilterMenu={false}
              body={(row) => (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 600,
                    color: "#0f172a"
                  }}
                >
                  <i className="pi pi-file-edit" style={{ color: "#6366f1" }} />
                  {row.name}
                </div>
              )}
            />
            <Column
              header="Description"
              field="description"
              sortable
              filter
              filterPlaceholder="Search description"
              showFilterMenu={false}
              body={(row) =>
                row.description ? (
                  <span
                    style={{
                      display: "inline-block",
                      maxWidth: 420,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "#475569",
                      fontSize: 13
                    }}
                    title={row.description}
                  >
                    {row.description}
                  </span>
                ) : (
                  <span style={{ color: "#cbd5e1" }}>—</span>
                )
              }
            />
            <Column
              header="Due date"
              field="duedateDate"
              sortable
              dataType="date"
              filter
              showFilterMenu={false}

              filterElement={() => {
                const [startDate, endDate] = dateRange ?? [null, null];
                return (
                  <DatePicker
                    selectsRange
                    startDate={startDate ?? undefined}
                    endDate={endDate ?? undefined}
                    onChange={(dates) => {
                      const [from, to] =
                        (dates as [Date | null, Date | null]) ?? [null, null];
                      setDateRange(!from && !to ? null : [from, to]);
                      setFirst(0);
                    }}
                    isClearable
                    dateFormat="MMM d, yyyy"
                    placeholderText="Pick range"
                    className={styles.dateFilterInput}
                    wrapperClassName={styles.dateFilterWrapper}
                    popperClassName={styles.dateFilterPopper}
                    portalId="root"
                  />
                );
              }}
              style={{ width: 240 }}
              body={(row) => (
                <span>
                  <i
                    className="pi pi-calendar"
                    style={{ marginRight: 6, color: "#6366f1" }}
                  />
                  {row.duedateDisplay}
                </span>
              )}
            />
            <Column
              header="Points"
              field="points"
              sortable
              dataType="numeric"
              filter
              filterPlaceholder="="
              showFilterMenu={false}
              style={{ width: 140 }}
              body={(row) => (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  <strong>{row.points ?? 0}</strong>
                  <span style={{ color: "#94a3b8" }}> pts</span>
                </span>
              )}
            />
            <Column
              header=""
              style={{ width: 60 }}
              body={() => (
                <i className="pi pi-angle-right" style={{ color: "#6366f1" }} />
              )}
            />
          </DataTable>
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
            style={{ textAlign: "left" }}
          >
            <div className={styles.cardTitle}>
              <i className="pi pi-file-edit" style={{ color: "#6366f1" }} />
              {a.name}
            </div>
            {a.description && (
              <div
                style={{
                  color: "#475569",
                  fontSize: 13,
                  lineHeight: 1.4,
                  minHeight: 36,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}
              >
                {a.description}
              </div>
            )}
            <div className={styles.metaRow}>
              <span>
                <i className="pi pi-calendar" /> <strong>{formatDate(a.duedate)}</strong>
              </span>
              <span>
                <i className="pi pi-star" /> <strong>{a.points ?? 0}</strong> pts
              </span>
            </div>
          </button>
        ))}
      </section>
    </>
  );
};

export default GraderAssignmentsPage;

