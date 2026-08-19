import { Alert, Badge, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { usePreviewSharedAssignmentQuery } from "@store/assignment/assignment.logic.api";

import { formatUTCDateForDisplay } from "@/utils/date";

import styles from "./ImportAssignmentModal.module.css";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric"
};

interface ImportPreviewPanelProps {
  /** Assignment to summarize, or null when nothing is being previewed. */
  assignmentId: number | null;
  onClose: () => void;
}

/**
 * Answer "is this the one" for a single assignment, without leaving the tree.
 *
 * Read-only on purpose. Importing is driven by the tree's checkboxes, so a
 * second import button here would give the same action two homes and let an
 * instructor import something that is not part of what they have selected.
 */
export const ImportPreviewPanel = ({ assignmentId, onClose }: ImportPreviewPanelProps) => {
  const { data: preview, isFetching } = usePreviewSharedAssignmentQuery(assignmentId ?? 0, {
    skip: assignmentId === null
  });

  return (
    <Modal
      opened={assignmentId !== null}
      onClose={onClose}
      title={preview ? preview.name : "Loading assignment…"}
      size="42rem"
    >
      {isFetching || !preview ? (
        <Text size="sm" c="dimmed">
          Loading assignment…
        </Text>
      ) : (
        <Stack gap="md">
          <Stack gap={4}>
            <Text size="sm">
              From <strong>{preview.course_name}</strong> · {preview.book_title}
            </Text>
            <Text size="sm" c="dimmed">
              {preview.question_count} question{preview.question_count === 1 ? "" : "s"} ·{" "}
              {preview.points} points · due{" "}
              {formatUTCDateForDisplay(preview.duedate, DATE_FORMAT)} in your term
            </Text>
          </Stack>

          {preview.already_imported ? (
            <Alert variant="light" color="yellow" title="You already imported this">
              {preview.imported_as
                ? `It is in this course as “${preview.imported_as}”. `
                : "It is already in this course. "}
              Importing the course again skips it.
            </Alert>
          ) : null}

          {preview.sharing_description ? (
            <Alert variant="light" color="gray" title="Note from this course">
              {preview.sharing_description}
            </Alert>
          ) : null}

          {preview.duedate_warning ? (
            <Alert variant="light" color="yellow" title="Due date not adjusted">
              {preview.duedate_warning}
            </Alert>
          ) : null}

          {preview.skipped_readings > 0 ? (
            <Alert
              variant="light"
              color="yellow"
              title={`${preview.skipped_readings} reading${
                preview.skipped_readings === 1 ? "" : "s"
              } won't come across`}
            >
              A reading points at a page of {preview.book_title}, which your students are not
              reading. The exercises import normally.
            </Alert>
          ) : null}

          <div className={styles.questionList}>
            {preview.questions.map((question) => (
              <div key={question.id} className={styles.questionRow}>
                <Text
                  size="sm"
                  c={question.will_import ? undefined : "dimmed"}
                  className={question.will_import ? undefined : styles.skippedName}
                >
                  {question.name}
                </Text>
                <Group gap="xs">
                  {question.will_import ? null : (
                    <Badge size="sm" variant="outline" color="gray">
                      not imported
                    </Badge>
                  )}
                  {question.question_type ? (
                    <Badge size="sm" variant="light">
                      {question.question_type}
                    </Badge>
                  ) : null}
                  <Text size="xs" c="dimmed">
                    {question.points} pt
                  </Text>
                </Group>
              </div>
            ))}
            {preview.questions.length === 0 ? (
              <Text size="sm" c="dimmed">
                This assignment has no questions yet.
              </Text>
            ) : null}
          </div>

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Close
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
};
