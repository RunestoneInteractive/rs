import {
  Anchor,
  Button,
  Center,
  Loader,
  MultiSelect,
  Table,
  Text,
  TextInput,
  UnstyledButton
} from "@mantine/core";
import type { GradebookAssignment, GradebookStudent } from "@store/grader/grader.logic.api";
import { gradebookCsvFilename, useGetGradebookQuery } from "@store/grader/grader.logic.api";
import React, { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";

import { ErrorState } from "../../AssignmentBuilder/components/ErrorState/ErrorState";
import styles from "../Grader.module.css";
import { GradebookCellDialog } from "../components/GradebookCellDialog";
import { GradebookLateWorkDialog } from "../components/GradebookLateWorkDialog";
import { GradebookUnitsToggle } from "../components/GradebookUnitsToggle";
import {
  assignmentAverage,
  buildCellLookup,
  classTotalAverage,
  columnUnitLabel,
  displayScore,
  filterAssignments,
  filterStudents,
  formatScore,
  getCell,
  gradebookToCsv,
  studentTotalDisplay
} from "../state/gradebookSelectors";

interface OpenCell {
  assignment: GradebookAssignment;
  student: GradebookStudent;
}

type GradebookSort =
  | { column: "student"; direction: "asc" | "desc" }
  | { column: "assignment"; assignmentId: number; direction: "asc" | "desc" };

export const GraderGradebookPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useGetGradebookQuery();
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [openCell, setOpenCell] = useState<OpenCell | null>(null);
  const [lateAssignment, setLateAssignment] = useState<GradebookAssignment | null>(null);
  const [sort, setSort] = useState<GradebookSort>({ column: "student", direction: "asc" });

  const lookup = useMemo(() => buildCellLookup(data?.cells ?? []), [data?.cells]);
  // Scores read as a percent of each assignment unless the course opted into raw
  // points; until the data lands there is nothing to show either way.
  const showPoints = !!data?.show_points;
  const courseName = window.eBookConfig?.course ?? "course";
  const csvFilename = gradebookCsvFilename(courseName);

  // TODO(eslint): Stabilize fallback collections without changing loading behavior.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allAssignments = data?.assignments ?? [];
  // TODO(eslint): Stabilize fallback collections without changing loading behavior.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allStudents = data?.students ?? [];

  const assignments = useMemo(
    () => filterAssignments(allAssignments, selectedAssignmentIds.map(Number)),
    [allAssignments, selectedAssignmentIds]
  );
  const students = useMemo(
    () => filterStudents(allStudents, studentQuery),
    [allStudents, studentQuery]
  );
  const sortedStudents = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;

    return [...students].sort((left, right) => {
      if (sort.column === "student") {
        const leftName = left.sort_name ?? left.name ?? left.sid;
        const rightName = right.sort_name ?? right.name ?? right.sid;

        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" }) * direction;
      }
      const leftScore = getCell(lookup, left.sid, sort.assignmentId)?.score;
      const rightScore = getCell(lookup, right.sid, sort.assignmentId)?.score;

      // Missing work stays at the bottom in either direction
      if (leftScore == null && rightScore == null) return 0;
      if (leftScore == null) return 1;
      if (rightScore == null) return -1;
      if (leftScore === rightScore) {
        return (left.sort_name ?? left.name).localeCompare(right.sort_name ?? right.name);
      }
      return (leftScore - rightScore) * direction;
    });
  }, [lookup, sort, students]);

  const assignmentOptions = useMemo(
    () => allAssignments.map((a) => ({ value: String(a.id), label: a.name })),
    [allAssignments]
  );

  const toggleStudentSort = () =>
    setSort((current) => ({
      column: "student",
      direction: current.column === "student" && current.direction === "asc" ? "desc" : "asc"
    }));
  const toggleAssignmentSort = (assignmentId: number) =>
    setSort((current) => ({
      column: "assignment",
      assignmentId,
      direction:
        current.column === "assignment" &&
        current.assignmentId === assignmentId &&
        current.direction === "asc"
          ? "desc"
          : "asc"
    }));
  const sortIndicator = (column: "student" | "assignment", assignmentId?: number) => {
    const active =
      sort.column === column &&
      (column === "student" ||
        (sort.column === "assignment" && sort.assignmentId === assignmentId));

    return active ? (sort.direction === "asc" ? " ↑" : " ↓") : "";
  };

  if (!data && isLoading) {
    return (
      <Center className={styles.loadingWrap}>
        <Loader />
      </Center>
    );
  }

  if (!data && isError) {
    return (
      <ErrorState
        title="Could not load the gradebook"
        message="Something went wrong while fetching grades for this course."
        retryLabel="Try again"
        onRetry={refetch}
      />
    );
  }

  const exportCurrentView = () => {
    const csv = gradebookToCsv(sortedStudents, assignments, lookup, showPoints);
    const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = csvFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportButton = (
    <Button
      onClick={exportCurrentView}
      leftSection={<Icon name="download" size={14} />}
      variant="light"
      size="xs"
    >
      Export CSV
    </Button>
  );

  if (allAssignments.length === 0 || allStudents.length === 0) {
    return (
      <>
        <div className={styles.toolbar}>
          <span className={styles.cellStrong}>Gradebook</span>
          <div className={styles.toolbarGroup}>{exportButton}</div>
        </div>
        <div className={styles.emptyState}>
          <Icon name="inbox" size={30} className={styles.emptyStateIcon} />
          <h3>Nothing to grade yet</h3>
          <p>Once students submit work for an assignment, their scores appear here.</p>
        </div>
      </>
    );
  }

  // Only the columns on screen are added up, so a filtered gradebook totals what
  // it shows rather than something the reader cannot see.
  const columnsFiltered = assignments.length !== allAssignments.length;

  const openCellScore = openCell
    ? (getCell(lookup, openCell.student.sid, openCell.assignment.id) ?? null)
    : null;

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <TextInput
            size="xs"
            placeholder="Filter students"
            aria-label="Filter students by name, username, or email"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.currentTarget.value)}
            leftSection={<Icon name="search" size={14} />}
            className={styles.gradebookFilterInput}
          />
          <MultiSelect
            size="xs"
            placeholder={selectedAssignmentIds.length ? undefined : "All assignments"}
            aria-label="Filter assignment columns by name"
            data={assignmentOptions}
            value={selectedAssignmentIds}
            onChange={setSelectedAssignmentIds}
            searchable
            clearable
            className={styles.gradebookFilterSelect}
          />
          <GradebookUnitsToggle showPoints={showPoints} />
          {exportButton}
        </div>
      </div>

      <Text size="xs" c="dimmed" className={styles.gradebookFilterSummary}>
        Showing {students.length} of {allStudents.length}{" "}
        {allStudents.length === 1 ? "student" : "students"} and {assignments.length} of{" "}
        {allAssignments.length} {allAssignments.length === 1 ? "assignment" : "assignments"}. Click
        any grade to see that student&rsquo;s score on each question.
      </Text>

      {students.length === 0 || assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon name="filter" size={30} className={styles.emptyStateIcon} />
          <h3>Nothing matches these filters</h3>
          <p>Clear the student or assignment filter to see the rest of the gradebook.</p>
        </div>
      ) : (
        <div className={styles.gradebookWrap}>
          <Table stickyHeader highlightOnHover verticalSpacing="xs" aria-label="Gradebook">
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  className={styles.gradebookStudentHead}
                  aria-sort={
                    sort.column === "student"
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <UnstyledButton onClick={toggleStudentSort} aria-label="Sort by student">
                    Student{sortIndicator("student")}
                  </UnstyledButton>
                </Table.Th>
                {assignments.map((a) => (
                  <Table.Th
                    key={a.id}
                    className={styles.gradebookNumHead}
                    aria-sort={
                      sort.column === "assignment" && sort.assignmentId === a.id
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <div className={styles.gradebookHeaderActions}>
                      <UnstyledButton
                        onClick={() => toggleAssignmentSort(a.id)}
                        aria-label={`Sort by ${a.name} score`}
                      >
                        <span className={styles.gradebookColName}>
                          {a.name}
                          {sortIndicator("assignment", a.id)}
                        </span>
                        <span className={styles.cellSubtle}>
                          {columnUnitLabel(a.points, showPoints)}
                        </span>
                      </UnstyledButton>
                      {a.kind !== "practice" && (
                        <UnstyledButton
                          className={styles.gradebookLateButton}
                          onClick={() => setLateAssignment(a)}
                          aria-label={`Show students with late work for ${a.name}`}
                          title="Show students with late work"
                        >
                          <Icon name="clock" size={13} />
                        </UnstyledButton>
                      )}
                    </div>
                  </Table.Th>
                ))}
                <Table.Th className={styles.gradebookNumHead}>
                  {columnsFiltered ? "Total (shown)" : "Total"}
                  {!showPoints && <span className={styles.cellSubtle}> %</span>}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedStudents.map((student) => (
                <Table.Tr key={student.sid}>
                  <Table.Td className={styles.gradebookStudentCell}>
                    <div>{student.sort_name ?? student.name}</div>
                    {student.email && <div className={styles.cellSubtle}>{student.email}</div>}
                    <Anchor
                      className={styles.gradebookStudentUsername}
                      href={`/assignment/student/studentreport?id=${encodeURIComponent(student.sid)}`}
                      title={`Open student report for ${student.name}`}
                    >
                      {student.sid}
                    </Anchor>
                  </Table.Td>
                  {assignments.map((a) => {
                    const cell = getCell(lookup, student.sid, a.id);
                    const score = formatScore(displayScore(cell?.score, a.points, showPoints));

                    return (
                      <Table.Td key={a.id} className={styles.gradebookNumCell}>
                        {a.kind === "practice" ? (
                          <span title="Spaced practice score">{score}</span>
                        ) : (
                          <UnstyledButton
                            className={`${styles.gradebookCellButton} ${
                              cell?.manual_total ? styles.gradebookCellManual : ""
                            }`}
                            onClick={() => setOpenCell({ assignment: a, student })}
                            aria-label={`Show details for ${student.name} on ${a.name}`}
                            title={
                              cell?.manual_total
                                ? "Manual total — click for the question breakdown"
                                : "Click for the question breakdown"
                            }
                          >
                            <span>{score}</span>
                            {cell?.manual_total && (
                              <span className={styles.gradebookManualDot} aria-hidden="true" />
                            )}
                          </UnstyledButton>
                        )}
                      </Table.Td>
                    );
                  })}
                  <Table.Td className={`${styles.gradebookNumCell} ${styles.gradebookTotalCell}`}>
                    {formatScore(studentTotalDisplay(lookup, assignments, student.sid, showPoints))}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr className={styles.gradebookAvgRow}>
                <Table.Th className={styles.gradebookStudentCell}>Class average</Table.Th>
                {assignments.map((a) => (
                  <Table.Td key={a.id} className={styles.gradebookNumCell}>
                    {formatScore(
                      displayScore(assignmentAverage(data?.cells ?? [], a.id), a.points, showPoints)
                    )}
                  </Table.Td>
                ))}
                <Table.Td className={styles.gradebookNumCell}>
                  {formatScore(classTotalAverage(lookup, assignments, allStudents, showPoints))}
                </Table.Td>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </div>
      )}

      <GradebookCellDialog
        opened={!!openCell}
        onClose={() => setOpenCell(null)}
        assignment={openCell?.assignment ?? null}
        student={openCell?.student ?? null}
        score={openCellScore?.score ?? null}
        manual={!!openCellScore?.manual_total}
      />
      <GradebookLateWorkDialog
        opened={!!lateAssignment}
        onClose={() => setLateAssignment(null)}
        assignment={lateAssignment}
      />
    </>
  );
};

export default GraderGradebookPage;
