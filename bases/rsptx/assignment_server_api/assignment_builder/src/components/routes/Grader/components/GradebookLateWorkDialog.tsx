import { Alert, Anchor, Center, List, Loader, Modal, Text } from "@mantine/core";
import type { GradebookAssignment } from "@store/grader/grader.logic.api";
import { useGetLateStudentsQuery } from "@store/grader/grader.logic.api";
import React from "react";

import styles from "../Grader.module.css";

interface GradebookLateWorkDialogProps {
  opened: boolean;
  onClose: () => void;
  assignment: GradebookAssignment | null;
}

export const GradebookLateWorkDialog: React.FC<GradebookLateWorkDialogProps> = ({
  opened,
  onClose,
  assignment
}) => {
  const { data, isFetching, isError } = useGetLateStudentsQuery(assignment?.id ?? 0, {
    skip: !opened || !assignment || assignment.kind === "practice"
  });

  if (!assignment || assignment.kind === "practice") return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Late work — ${assignment.name}`}
      size="md"
      centered
      classNames={{ content: styles.gradebookLateWorkModalContent }}
    >
      {isFetching && (
        <Center py="md">
          <Loader size="sm" />
        </Center>
      )}

      {!isFetching && isError && (
        <Alert color="red" variant="light">
          Could not load late work for this assignment.
        </Alert>
      )}

      {!isFetching && !isError && data && !data.enforce_due && (
        <Text size="sm">
          The due date is not enforced for this assignment, so no work is counted as late.
        </Text>
      )}

      {!isFetching && !isError && data?.enforce_due && data.students.length === 0 && (
        <Text size="sm">No students submitted work after the deadline.</Text>
      )}

      {!isFetching && !isError && data?.enforce_due && data.students.length > 0 && (
        <>
          <Text size="sm" mb="xs">
            {data.students.length} {data.students.length === 1 ? "student" : "students"} submitted
            work after the deadline:
          </Text>
          <List size="sm" pr="xs">
            {data.students.map((student) => (
              <List.Item key={student.username}>
                <Anchor
                  href={`/assignment/student/studentreport?id=${encodeURIComponent(student.username)}`}
                >
                  {student.name}
                </Anchor>
              </List.Item>
            ))}
          </List>
        </>
      )}
    </Modal>
  );
};

export default GradebookLateWorkDialog;
