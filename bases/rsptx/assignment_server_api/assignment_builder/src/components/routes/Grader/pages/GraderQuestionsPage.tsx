import { FilterMatchMode } from "primereact/api";
import { Column } from "primereact/column";
import { DataTable, DataTableFilterMeta } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { ProgressSpinner } from "primereact/progressspinner";
import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGetGraderQuestionsQuery } from "@store/grader/grader.logic.api";

import {
  GraderViewMode,
  ViewModeToggle
} from "../components/ViewModeToggle";
import styles from "../Grader.module.css";
import { useViewModeStorage } from "../hooks/useViewModeStorage";
import { getDemoQuestionsFor } from "../tour/graderDemoData";
import { useGraderTourContext } from "../tour/GraderTourContext";

const friendlyType = (t: string) => {
  const map: Record<string, string> = {
    mchoice: "Multiple choice",
    fillintheblank: "Fill in the blank",
    parsonsprob: "Parsons",
    activecode: "Active code",
    shortanswer: "Short answer",
    clickablearea: "Clickable",
    dragndrop: "Drag & drop",
    codelens: "Codelens",
    matching: "Matching",
    webwork: "WeBWorK"
  };
  return map[t] || t;
};

const MANUALLY_SCORED_TYPES = new Set(["shortanswer"]);

const PARTIAL_CREDIT_TYPES = new Set([
  "dragndrop",
  "clickablearea",
  "matching",
  "fillintheblank",
  "parsonsprob",
  "microparsons",
  "hparsons"
]);

const VIEW_MODES = ["cards", "table"] as const satisfies readonly GraderViewMode[];
const VIEW_MODE_STORAGE_KEY = "grader.questionsViewMode";

const buildInitialFilters = (): DataTableFilterMeta => ({
  name: { value: null, matchMode: FilterMatchMode.CONTAINS },
  question_type: { value: null, matchMode: FilterMatchMode.EQUALS },
  answered_count: { value: null, matchMode: FilterMatchMode.EQUALS },
  correct_count: { value: null, matchMode: FilterMatchMode.EQUALS },
  points: { value: null, matchMode: FilterMatchMode.EQUALS }
});

type QuestionRow = ReturnType<typeof getDemoQuestionsFor> extends infer T
  ? T extends { questions: (infer Q)[] | undefined }
    ? Q
    : never
  : never;

interface QuestionStats {
  correctPct: number;
  pointsPct: number;
  isManual: boolean;
  usePartial: boolean;
  correctLabel: string;
  correctTooltip: string;
  avgTooltip: string;
}

const computeStats = (q: QuestionRow): QuestionStats => {
  const isManual = MANUALLY_SCORED_TYPES.has(q.question_type);
  const usePartial =
    PARTIAL_CREDIT_TYPES.has(q.question_type) && q.avg_percent != null;

  const correctPct = usePartial
    ? (q.avg_percent ?? 0) * 100
    : q.answered_count > 0
      ? (q.correct_count / q.answered_count) * 100
      : 0;

  const pointsPct = q.points > 0 ? (q.average_score / q.points) * 100 : 0;
  const avgDenominator = q.graded_count ?? 0;

  const correctLabel = usePartial
    ? "avg. credit"
    : isManual
      ? "fully scored"
      : "fully correct";
  const correctTooltip = usePartial
    ? `Mean partial credit across all answers (${q.question_type})`
    : isManual
      ? "Students whose graded score equals the question's max points"
      : "Students who submitted a fully correct answer at least once";
  const avgTooltip = avgDenominator
    ? `Average across ${avgDenominator} graded student${
        avgDenominator === 1 ? "" : "s"
      }`
    : "No graded submissions yet";

  return {
    correctPct,
    pointsPct,
    isManual,
    usePartial,
    correctLabel,
    correctTooltip,
    avgTooltip
  };
};

export const GraderQuestionsPage: React.FC = () => {
  const { assignmentId } = useParams();
  const id = Number(assignmentId);
  const navigate = useNavigate();
  const { isDemo } = useGraderTourContext();
  const { data: realData, isLoading, isError } = useGetGraderQuestionsQuery(id, {
    skip: !id || isDemo,
    refetchOnMountOrArgChange: true
  });
  const data = isDemo ? getDemoQuestionsFor(id) ?? undefined : realData;

  const [viewMode, setViewMode] = useViewModeStorage<GraderViewMode>(
    VIEW_MODE_STORAGE_KEY,
    VIEW_MODES,
    "cards"
  );

  const [filters, setFilters] = useState<DataTableFilterMeta>(buildInitialFilters);

  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<1 | -1 | 0 | null | undefined>(null);

  const typeOptions = useMemo(() => {
    if (!data) return [] as { label: string; value: string }[];
    const unique = Array.from(new Set(data.questions.map((q) => q.question_type)));
    return unique
      .map((t) => ({ label: friendlyType(t), value: t }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  if (!data && isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
        <ProgressSpinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.emptyState}>
        <i className="pi pi-exclamation-triangle" style={{ fontSize: 32, color: "#f59e0b" }} />
        <h3>Could not load questions</h3>
        {isError && <p style={{ color: "#64748b" }}>The server returned an error.</p>}
      </div>
    );
  }

  if (!data.questions.length) {
    return (
      <div className={styles.emptyState}>
        <h3>No gradable questions in this assignment.</h3>
      </div>
    );
  }

  const viewToggle = (
    <ViewModeToggle
      value={viewMode}
      onChange={setViewMode}
      ariaLabel="Toggle questions view"
      tourId="grader-questions-view-toggle"
    />
  );

  if (viewMode === "table") {
    return (
      <>
        {viewToggle}
        <div className={styles.tableWrap} data-tour="grader-question-grid">
          <DataTable
            value={data.questions}
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
              const row = e.data as QuestionRow;
              navigate(`/grader/${id}/questions/${row.id}`);
            }}
            rowHover
            className={styles.row}
            emptyMessage="No questions match the current filters."
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
              showFilterMenu={false}
              filterPlaceholder="Search name"
              body={(row: QuestionRow) => (
                <span
                  style={{
                    fontWeight: 600,
                    color: "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "inline-block",
                    maxWidth: 360
                  }}
                  title={row.name}
                >
                  {row.name}
                </span>
              )}
            />
            <Column
              header="Type"
              field="question_type"
              sortable
              filter
              showFilterMenu={false}
              style={{ width: 200 }}
              filterElement={(options) => (
                <Dropdown
                  value={options.value}
                  options={typeOptions}
                  onChange={(e) => options.filterApplyCallback(e.value)}
                  placeholder="Any"
                  showClear
                  style={{ width: "100%", minWidth: 0 }}
                />
              )}
              body={(row: QuestionRow) => (
                <span className={`${styles.qTypeChip} ${styles[row.question_type] || ""}`}>
                  {friendlyType(row.question_type)}
                </span>
              )}
            />
            <Column
              header="Answered"
              field="answered_count"
              sortable
              dataType="numeric"
              filter
              showFilterMenu={false}
              filterPlaceholder="="
              style={{ width: 130 }}
              body={(row: QuestionRow) => (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  <i className="pi pi-users" style={{ marginRight: 6, color: "#6366f1" }} />
                  <strong>{row.answered_count}</strong>
                </span>
              )}
            />
            <Column
              header="Correct"
              field="correct_count"
              sortable
              dataType="numeric"
              filter
              showFilterMenu={false}
              filterPlaceholder="="
              style={{ width: 130 }}
              body={(row: QuestionRow) => {
                const stats = computeStats(row);
                return (
                  <span
                    style={{ fontVariantNumeric: "tabular-nums" }}
                    title={stats.correctTooltip}
                  >
                    <strong>{row.correct_count}</strong>
                    <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                      {" "}
                      {stats.correctLabel}
                    </span>
                  </span>
                );
              }}
            />
            <Column
              header="Average"
              field="average_score"
              sortable
              dataType="numeric"
              style={{ width: 140 }}
              body={(row: QuestionRow) => {
                const stats = computeStats(row);
                return (
                  <span title={stats.avgTooltip}>
                    <strong>{row.average_score}</strong>
                    <span style={{ color: "#94a3b8" }}> / {row.points}</span>
                  </span>
                );
              }}
            />
            <Column
              header="Points"
              field="points"
              sortable
              dataType="numeric"
              filter
              showFilterMenu={false}
              filterPlaceholder="="
              style={{ width: 110 }}
              body={(row: QuestionRow) => (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  <strong>{row.points}</strong>
                </span>
              )}
            />
            <Column
              header="% correct"

              sortable
              sortField="correct_count"
              style={{ width: 150 }}
              body={(row: QuestionRow) => {
                const stats = computeStats(row);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span title={stats.correctTooltip}>
                      {Math.round(stats.correctPct)}%{" "}
                      {stats.usePartial ? "credit" : "correct"}
                    </span>
                    <div className={styles.progress} style={{ marginTop: 0 }}>
                      <div
                        className={styles.progressBar}
                        style={{
                          width: `${Math.min(100, Math.max(0, stats.pointsPct))}%`
                        }}
                      />
                    </div>
                  </div>
                );
              }}
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
        aria-label="Questions"
        data-tour="grader-question-grid"
      >
        {data.questions.map((q) => {
          const stats = computeStats(q);
          return (
            <button
              key={q.id}
              data-tour="grader-question-card"
              className={styles.card}
              onClick={() => navigate(`/grader/${id}/questions/${q.id}`)}
              style={{ textAlign: "left" }}
            >
              <div
                className={styles.cardTitle}
                style={{ justifyContent: "space-between" }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={q.name}
                >
                  {q.name}
                </span>
                <span className={`${styles.qTypeChip} ${styles[q.question_type] || ""}`}>
                  {friendlyType(q.question_type)}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span
                  data-tour="grader-q-answered"
                  title="Distinct students who submitted at least one attempt"
                >
                  <i className="pi pi-users" /> <strong>{q.answered_count}</strong> answered
                </span>
                <span data-tour="grader-q-correct" title={stats.correctTooltip}>
                  <i className="pi pi-check-circle" />{" "}
                  <strong>{q.correct_count}</strong> {stats.correctLabel}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span data-tour="grader-q-average" title={stats.avgTooltip}>
                  <i className="pi pi-star" /> <strong>{q.average_score}</strong> / {q.points}
                </span>
                <span data-tour="grader-q-percent" title={stats.correctTooltip}>
                  {Math.round(stats.correctPct)}%{" "}
                  {stats.usePartial ? "credit" : "correct"}
                </span>
              </div>
              <div className={styles.progress} data-tour="grader-q-progress">
                <div
                  className={styles.progressBar}
                  style={{
                    width: `${Math.min(100, Math.max(0, stats.pointsPct))}%`
                  }}
                />
              </div>
            </button>
          );
        })}
      </section>
    </>
  );
};

export default GraderQuestionsPage;

