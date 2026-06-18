import { Button, Center, Checkbox, Loader, Tooltip } from "@mantine/core";
import { ColumnDef, FilterFn } from "@tanstack/react-table";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { DataGrid } from "@/components/ui/DataGrid";
import { Icon } from "@/components/ui/Icon";
import { useGetGraderQuestionsQuery } from "@store/grader/grader.logic.api";

import { DeadlineExceptionDialog } from "../components/DeadlineExceptionDialog";
import { MultiGradeDialog } from "../components/MultiGradeDialog";
import { RegradeWizard } from "../components/RegradeWizard";
import { ReleaseGradesControl } from "../components/ReleaseGradesControl";
import { ThresholdControl } from "../components/ThresholdControl";
import { GraderViewMode, ViewModeToggle } from "../components/ViewModeToggle";
import styles from "../Grader.module.css";
import { effectiveViewMode, isAutogradeable } from "../state/graderSelectors";
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

type QuestionData = NonNullable<ReturnType<typeof getDemoQuestionsFor>>;
type QuestionRow = QuestionData["questions"][number];

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
  const usePartial = PARTIAL_CREDIT_TYPES.has(q.question_type) && q.avg_percent != null;

  const correctPct = usePartial
    ? (q.avg_percent ?? 0) * 100
    : q.answered_count > 0
      ? (q.correct_count / q.answered_count) * 100
      : 0;

  const pointsPct = q.points > 0 ? (q.average_score / q.points) * 100 : 0;
  const avgDenominator = q.graded_count ?? 0;

  const correctLabel = usePartial ? "avg. credit" : isManual ? "fully scored" : "fully correct";
  const correctTooltip = usePartial
    ? `Mean partial credit across all answers (${q.question_type})`
    : isManual
      ? "Students whose graded score equals the question's max points"
      : "Students who submitted a fully correct answer at least once";
  const avgTooltip = avgDenominator
    ? `Average across ${avgDenominator} graded student${avgDenominator === 1 ? "" : "s"}`
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

const numericEquals: FilterFn<QuestionRow> = (row, columnId, value) => {
  if (value == null || value === "") return true;
  return Number(row.getValue(columnId)) === Number(value);
};

export const GraderQuestionsPage: React.FC = () => {
  const { assignmentId } = useParams();
  const id = Number(assignmentId);
  const navigate = useNavigate();
  const { isDemo } = useGraderTourContext();
  const { data: realData, isLoading } = useGetGraderQuestionsQuery(id, {
    skip: !id || isDemo,
    refetchOnMountOrArgChange: true
  });
  const data = isDemo ? (getDemoQuestionsFor(id) ?? undefined) : realData;

  const [viewMode, setViewMode] = useViewModeStorage<GraderViewMode>(
    VIEW_MODE_STORAGE_KEY,
    VIEW_MODES,
    "cards"
  );
  const activeViewMode = effectiveViewMode<GraderViewMode>(isDemo, viewMode, "cards");

  const [showRegrade, setShowRegrade] = useState(false);
  const [showExtraTime, setShowExtraTime] = useState(false);
  const [showMultiGrade, setShowMultiGrade] = useState(false);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedQuestionIds([]);
  }, [id]);

  const selectedQuestions = useMemo(
    () => (data?.questions ?? []).filter((q) => selectedQuestionIds.includes(q.id)),
    [data, selectedQuestionIds]
  );
  const autogradeableCount = useMemo(
    () => selectedQuestions.filter(isAutogradeable).length,
    [selectedQuestions]
  );
  const hasSelection = selectedQuestionIds.length > 0;

  const toggleSelected = (qid: number) =>
    setSelectedQuestionIds((prev) =>
      prev.includes(qid) ? prev.filter((x) => x !== qid) : [...prev, qid]
    );

  const typeOptions = useMemo(() => {
    if (!data) return [] as { label: string; value: string }[];
    const unique = Array.from(new Set(data.questions.map((q) => q.question_type)));
    return unique
      .map((t) => ({ label: friendlyType(t), value: t }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const allQuestions = data?.questions ?? [];

  const columns = useMemo<ColumnDef<QuestionRow, unknown>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { headerStyle: { width: 48 } },
        header: () => (
          <Checkbox
            aria-label="Select all questions"
            checked={selectedQuestionIds.length === allQuestions.length && allQuestions.length > 0}
            onChange={(e) => {
              if (e.currentTarget.checked) {
                setSelectedQuestionIds(allQuestions.map((q) => q.id));
              } else {
                setSelectedQuestionIds([]);
              }
            }}
          />
        ),
        cell: ({ row }) => (
          <span
            data-tour="grader-question-select"
            onClick={(e) => e.stopPropagation()}
            style={{ display: "inline-flex" }}
          >
            <Checkbox
              aria-label={`Select ${row.original.name}`}
              checked={selectedQuestionIds.includes(row.original.id)}
              onChange={() => toggleSelected(row.original.id)}
            />
          </span>
        )
      },
      {
        accessorKey: "name",
        header: "Name",
        filterFn: "includesString",
        meta: { filter: { variant: "text", placeholder: "Search name" } },
        cell: ({ row }) => (
          <span className={styles.cellName} title={row.original.name}>
            {row.original.name}
          </span>
        )
      },
      {
        accessorKey: "question_type",
        header: "Type",
        filterFn: "equals",
        meta: {
          headerStyle: { width: 200 },
          filter: { variant: "select", placeholder: "Any", options: typeOptions }
        },
        cell: ({ row }) => (
          <span className={`${styles.qTypeChip} ${styles[row.original.question_type] || ""}`}>
            {friendlyType(row.original.question_type)}
          </span>
        )
      },
      {
        accessorKey: "answered_count",
        header: "Answered",
        filterFn: numericEquals,
        meta: {
          headerStyle: { width: 130 },
          align: "right",
          cellClassName: "numeric",
          filter: { variant: "numeric", placeholder: "=" }
        },
        cell: ({ row }) => (
          <span className={styles.iconText}>
            <Icon name="users" className={styles.metaIcon} />
            <strong>{row.original.answered_count}</strong>
          </span>
        )
      },
      {
        accessorKey: "correct_count",
        header: "Correct",
        filterFn: numericEquals,
        meta: {
          headerStyle: { width: 130 },
          align: "right",
          cellClassName: "numeric",
          filter: { variant: "numeric", placeholder: "=" }
        },
        cell: ({ row }) => {
          const stats = computeStats(row.original);
          return (
            <span title={stats.correctTooltip}>
              <strong>{row.original.correct_count}</strong>
              <span className={styles.cellSubtle}> {stats.correctLabel}</span>
            </span>
          );
        }
      },
      {
        accessorKey: "average_score",
        header: "Average",
        enableColumnFilter: false,
        meta: { headerStyle: { width: 140 }, align: "right", cellClassName: "numeric" },
        cell: ({ row }) => {
          const stats = computeStats(row.original);
          return (
            <span title={stats.avgTooltip}>
              <strong className={styles.cellStrong}>{row.original.average_score}</strong>
              <span className={styles.cellSubtle}> / {row.original.points}</span>
            </span>
          );
        }
      },
      {
        accessorKey: "points",
        header: "Points",
        filterFn: numericEquals,
        meta: {
          headerStyle: { width: 110 },
          align: "right",
          cellClassName: "numeric",
          filter: { variant: "numeric", placeholder: "=" }
        },
        cell: ({ row }) => <strong className={styles.cellStrong}>{row.original.points}</strong>
      },
      {
        id: "percent",
        header: "% correct",
        accessorFn: (row) => row.correct_count,
        sortingFn: "basic",
        enableColumnFilter: false,
        meta: { headerStyle: { width: 150 }, align: "right", cellClassName: "numeric" },
        cell: ({ row }) => {
          const stats = computeStats(row.original);
          return (
            <div className={styles.percentCell}>
              <span title={stats.correctTooltip}>
                {Math.round(stats.correctPct)}% {stats.usePartial ? "credit" : "correct"}
              </span>
              <div className={styles.progress} style={{ marginTop: 0 }}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${Math.min(100, Math.max(0, stats.pointsPct))}%` }}
                />
              </div>
            </div>
          );
        }
      },
      {
        id: "chevron",
        header: "",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { headerStyle: { width: 60 }, align: "center", hiddenHeaderLabel: "Open" },
        cell: () => <Icon name="angle-right" className={styles.cellLink} />
      }
    ],
    [selectedQuestionIds, allQuestions, typeOptions]
  );

  if (!data && isLoading) {
    return (
      <Center className={styles.loadingWrap}>
        <Loader />
      </Center>
    );
  }

  if (!data) {
    return (
      <div className={styles.emptyState}>
        <Icon name="exclamation-triangle" size={30} className={styles.emptyStateIconWarn} />
        <h3>Couldn't load questions. Refresh the page.</h3>
      </div>
    );
  }

  if (!data.questions.length) {
    return (
      <div className={styles.emptyState}>
        <h3>No gradable questions in this assignment</h3>
      </div>
    );
  }

  const viewToggle = (
    <ViewModeToggle
      value={activeViewMode}
      onChange={setViewMode}
      ariaLabel="Toggle questions view"
      tourId="grader-questions-view-toggle"
      disabled={isDemo}
    />
  );

  const toolbar = (
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <Tooltip label="Select at least one question" position="bottom" disabled={hasSelection}>
          <Button
            leftSection={<Icon name="refresh" size={14} />}
            variant="default"
            size="xs"
            disabled={!hasSelection}
            onClick={() => setShowRegrade(true)}
            data-tour="grader-regrade-button"
          >
            Regrade…
          </Button>
        </Tooltip>
        <Tooltip label="Select at least one question" position="bottom" disabled={hasSelection}>
          <Button
            leftSection={<Icon name="pencil" size={14} />}
            variant="default"
            size="xs"
            disabled={!hasSelection}
            onClick={() => setShowMultiGrade(true)}
            data-tour="grader-multigrade-button"
          >
            Multi-grade…
          </Button>
        </Tooltip>
        <Button
          leftSection={<Icon name="clock" size={14} />}
          variant="default"
          size="xs"
          onClick={() => setShowExtraTime(true)}
        >
          Extra time…
        </Button>
        {hasSelection && (
          <span className={styles.selectionChip}>
            {selectedQuestionIds.length} selected
            {selectedQuestionIds.length > autogradeableCount && (
              <span className={styles.selectionWarning}>
                {selectedQuestionIds.length - autogradeableCount} not auto-gradeable
              </span>
            )}
            <button onClick={() => setSelectedQuestionIds([])}>Clear</button>
          </span>
        )}
      </div>
      <div className={styles.toolbarGroup}>
        {!isDemo && <ThresholdControl assignmentId={id} />}
        {!isDemo && <ReleaseGradesControl assignmentId={id} />}
        {viewToggle}
      </div>
    </div>
  );

  const dialogs = (
    <>
      <RegradeWizard
        visible={showRegrade}
        onHide={() => setShowRegrade(false)}
        assignmentId={id}
        questions={data.questions}
        selectedQuestionIds={selectedQuestionIds}
      />
      <MultiGradeDialog
        visible={showMultiGrade}
        onHide={() => setShowMultiGrade(false)}
        assignmentId={id}
        questions={selectedQuestions}
      />
      <DeadlineExceptionDialog
        visible={showExtraTime}
        onHide={() => setShowExtraTime(false)}
        assignmentId={id}
      />
    </>
  );

  if (activeViewMode === "table") {
    return (
      <>
        {toolbar}
        {dialogs}
        <div className={styles.tableWrap} data-tour="grader-question-grid">
          <DataGrid<QuestionRow>
            data={data.questions}
            columns={columns}
            getRowId={(r) => String(r.id)}
            onRowClick={(row) => navigate(`/grader/${id}/questions/${row.id}`)}
            enableColumnFilters
            enableSortingRemoval={false}
            initialPageSize={25}
            ariaLabel="Questions"
            emptyMessage="No questions match the current filters."
          />
        </div>
      </>
    );
  }

  return (
    <>
      {toolbar}
      {dialogs}
      <section className={styles.grid} aria-label="Questions" data-tour="grader-question-grid">
        {data.questions.map((q) => {
          const stats = computeStats(q);
          const selected = selectedQuestionIds.includes(q.id);
          return (
            <div
              key={q.id}
              className={`${styles.cardSelectable} ${selected ? styles.cardSelected : ""}`}
            >
              <span
                className={styles.cardCheckbox}
                data-tour="grader-question-select"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  aria-label={`Select ${q.name}`}
                  checked={selected}
                  onChange={() => toggleSelected(q.id)}
                />
              </span>
              <button
                data-tour="grader-question-card"
                className={styles.card}
                onClick={() => navigate(`/grader/${id}/questions/${q.id}`)}
              >
                <div className={`${styles.cardTitle} ${styles.cardTitleSpread}`}>
                  <span className={styles.cardTitleText} title={q.name}>
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
                    <Icon name="users" size={14} /> <strong>{q.answered_count}</strong> answered
                  </span>
                  <span data-tour="grader-q-correct" title={stats.correctTooltip}>
                    <Icon name="check-circle" size={14} /> <strong>{q.correct_count}</strong>{" "}
                    {stats.correctLabel}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span data-tour="grader-q-average" title={stats.avgTooltip}>
                    <Icon name="star" size={14} /> <strong>{q.average_score}</strong> / {q.points}
                  </span>
                  <span data-tour="grader-q-percent" title={stats.correctTooltip}>
                    {Math.round(stats.correctPct)}% {stats.usePartial ? "credit" : "correct"}
                  </span>
                </div>
                <div className={styles.progress} data-tour="grader-q-progress">
                  <div
                    className={styles.progressBar}
                    style={{ width: `${Math.min(100, Math.max(0, stats.pointsPct))}%` }}
                  />
                </div>
              </button>
            </div>
          );
        })}
      </section>
    </>
  );
};

export default GraderQuestionsPage;
