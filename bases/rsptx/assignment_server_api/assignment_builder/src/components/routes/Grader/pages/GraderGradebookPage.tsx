import {
  Button,
  Center,
  Loader,
  MultiSelect,
  Table,
  Text,
  TextInput,
  UnstyledButton
} from "@mantine/core";
import React, { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { GradebookAssignment, GradebookStudent } from "@store/grader/grader.logic.api";
import {
  GRADEBOOK_CSV_URL,
  gradebookCsvFilename,
  useGetGradebookQuery
} from "@store/grader/grader.logic.api";

import { GradebookCellDialog } from "../components/GradebookCellDialog";
import { GradebookUnitsToggle } from "../components/GradebookUnitsToggle";
import styles from "../Grader.module.css";
import {
  assignmentAverage,
  buildCellLookup,
  columnUnitLabel,
  displayScore,
  filterAssignments,
  filterStudents,
  formatScore,
  getCell,
  studentTotalDisplay
} from "../state/gradebookSelectors";

interface OpenCell {
  assignment: GradebookAssignment;
  student: GradebookStudent;
}

export const GraderGradebookPage: React.FC = () => {
  const { data, isLoading } = useGetGradebookQuery();
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [openCell, setOpenCell] = useState<OpenCell | null>(null);

  const lookup = useMemo(() => buildCellLookup(data?.cells ?? []), [data?.cells]);
  // Scores read as a percent of each assignment unless the course opted into raw
  // points; until the data lands there is nothing to show either way.
  const showPoints = !!data?.show_points;
  const courseName = window.eBookConfig?.course ?? "course";
  const csvFilename = gradebookCsvFilename(courseName);

  const allAssignments = data?.assignments ?? [];
  const allStudents = data?.students ?? [];

  const assignments = useMemo(
    () => filterAssignments(allAssignments, selectedAssignmentIds.map(Number)),
    [allAssignments, selectedAssignmentIds]
  );
  const students = useMemo(
    () => filterStudents(allStudents, studentQuery),
    [allStudents, studentQuery]
  );

  const assignmentOptions = useMemo(
    () => allAssignments.map((a) => ({ value: String(a.id), label: a.name })),
    [allAssignments]
  );

  if (!data && isLoading) {
    return (
      <Center className={styles.loadingWrap}>
        <Loader />
      </Center>
    );
  }

  const exportButton = (
    <Button
      component="a"
      href={GRADEBOOK_CSV_URL}
      download={csvFilename}
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
        <span className={styles.cellStrong}>Gradebook</span>
        <div className={styles.toolbarGroup}>
          <TextInput
            size="xs"
            placeholder="Filter students"
            aria-label="Filter students by name"
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
                <Table.Th className={styles.gradebookStudentHead}>Student</Table.Th>
                {assignments.map((a) => (
                  <Table.Th key={a.id} className={styles.gradebookNumHead}>
                    <span className={styles.gradebookColName}>{a.name}</span>
                    <span className={styles.cellSubtle}>
                      {columnUnitLabel(a.points, showPoints)}
                    </span>
                  </Table.Th>
                ))}
                <Table.Th className={styles.gradebookNumHead}>
                  {columnsFiltered ? "Total (shown)" : "Total"}
                  {!showPoints && <span className={styles.cellSubtle}> %</span>}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {students.map((student) => (
                <Table.Tr key={student.sid}>
                  <Table.Td className={styles.gradebookStudentCell}>{student.name}</Table.Td>
                  {assignments.map((a) => {
                    const cell = getCell(lookup, student.sid, a.id);

                    return (
                      <Table.Td key={a.id} className={styles.gradebookNumCell}>
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
                          <span>
                            {formatScore(displayScore(cell?.score, a.points, showPoints))}
                          </span>
                          {cell?.manual_total && (
                            <span className={styles.gradebookManualDot} aria-hidden="true" />
                          )}
                        </UnstyledButton>
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
                <Table.Td className={styles.gradebookNumCell}>—</Table.Td>
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
    </>
  );
};

export default GraderGradebookPage;
