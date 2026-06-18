import { Button, Center, Loader, Table } from "@mantine/core";
import React, { useMemo } from "react";

import { Icon } from "@/components/ui/Icon";
import {
  GRADEBOOK_CSV_URL,
  gradebookCsvFilename,
  useGetGradebookQuery
} from "@store/grader/grader.logic.api";

import { ManualTotalControl } from "../components/ManualTotalControl";
import styles from "../Grader.module.css";
import {
  assignmentAverage,
  buildCellLookup,
  formatScore,
  getCell,
  studentTotal
} from "../state/gradebookSelectors";

export const GraderGradebookPage: React.FC = () => {
  const { data, isLoading } = useGetGradebookQuery();

  const lookup = useMemo(() => buildCellLookup(data?.cells ?? []), [data?.cells]);
  const courseName = window.eBookConfig?.course ?? "course";
  const csvFilename = gradebookCsvFilename(courseName);

  if (!data && isLoading) {
    return (
      <Center className={styles.loadingWrap}>
        <Loader />
      </Center>
    );
  }

  const assignments = data?.assignments ?? [];
  const students = data?.students ?? [];

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

  if (assignments.length === 0 || students.length === 0) {
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

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.cellStrong}>Gradebook</span>
        <div className={styles.toolbarGroup}>{exportButton}</div>
      </div>
      <div className={styles.gradebookWrap}>
        <Table stickyHeader highlightOnHover verticalSpacing="xs" aria-label="Gradebook">
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={styles.gradebookStudentHead}>Student</Table.Th>
              {assignments.map((a) => (
                <Table.Th key={a.id} className={styles.gradebookNumHead}>
                  <span className={styles.gradebookColName}>{a.name}</span>
                  <span className={styles.cellSubtle}> / {a.points}</span>
                </Table.Th>
              ))}
              <Table.Th className={styles.gradebookNumHead}>Total</Table.Th>
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
                      <ManualTotalControl
                        assignmentId={a.id}
                        sid={student.sid}
                        studentName={student.name}
                        assignmentName={a.name}
                        score={cell?.score ?? null}
                        manual={!!cell?.manual_total}
                        maxPoints={a.points}
                      />
                    </Table.Td>
                  );
                })}
                <Table.Td className={`${styles.gradebookNumCell} ${styles.gradebookTotalCell}`}>
                  {formatScore(studentTotal(lookup, assignments, student.sid))}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr className={styles.gradebookAvgRow}>
              <Table.Th className={styles.gradebookStudentCell}>Class average</Table.Th>
              {assignments.map((a) => (
                <Table.Td key={a.id} className={styles.gradebookNumCell}>
                  {formatScore(assignmentAverage(data?.cells ?? [], a.id))}
                </Table.Td>
              ))}
              <Table.Td className={styles.gradebookNumCell}>—</Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </div>
    </>
  );
};

export default GraderGradebookPage;
