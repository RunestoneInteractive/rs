import { Switch, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import React from "react";

import { Icon } from "@/components/ui/Icon";
import { notify } from "@/components/ui/notify";
import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";
import { useSetAssignmentReleasedMutation } from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";

interface ReleaseGradesControlProps {
  assignmentId: number;
  disabled?: boolean;
}

export const ReleaseGradesControl: React.FC<ReleaseGradesControlProps> = ({
  assignmentId,
  disabled = false
}) => {
  const { data: assignments } = useGetAssignmentsQuery();
  const [setReleased, { isLoading }] = useSetAssignmentReleasedMutation();

  const assignment = assignments?.find((a) => a.id === assignmentId);

  if (!assignment) return null;

  const released = assignment.released;
  const name = assignment.name;

  const apply = async (next: boolean) => {
    try {
      await setReleased({ assignment_id: assignmentId, released: next }).unwrap();
      notify.success(next ? "Grades released to students" : "Grades hidden from students");
    } catch {
      notify.error("Couldn't update grade visibility. Try again.");
    }
  };

  const confirm = (next: boolean) => {
    modals.openConfirmModal({
      title: next ? "Release grades" : "Hide grades",
      children: (
        <Text size="sm">
          {next ? (
            <>Release grades to students for &quot;{name}&quot;? Students will see their scores.</>
          ) : (
            <>
              Hide grades from students for &quot;{name}&quot;? They will no longer see their
              scores.
            </>
          )}
        </Text>
      ),
      labels: { confirm: next ? "Release" : "Hide", cancel: "Cancel" },
      confirmProps: next ? undefined : { color: "red" },
      onConfirm: () => apply(next)
    });
  };

  return (
    <Tooltip
      label={released ? "Students can see their scores" : "Scores are hidden from students"}
      position="bottom"
    >
      <div className={styles.releaseControl}>
        <Icon name={released ? "eye" : "eye-slash"} size={14} />
        <Switch
          size="sm"
          checked={released}
          disabled={disabled || isLoading}
          onChange={(e) => confirm(e.currentTarget.checked)}
          label={released ? "Grades released" : "Grades hidden"}
          aria-label="Release grades to students"
        />
      </div>
    </Tooltip>
  );
};

export default ReleaseGradesControl;
