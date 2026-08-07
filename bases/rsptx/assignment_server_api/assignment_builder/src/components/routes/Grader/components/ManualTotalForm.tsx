import { Badge, Button, Group, NumberInput, Stack, Text } from "@mantine/core";
import React, { useEffect, useState } from "react";

import { notify } from "@/components/ui/notify";
import { useSetManualTotalMutation } from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";
import { formatScore } from "../state/gradebookSelectors";

interface ManualTotalFormProps {
  assignmentId: number;
  sid: string;
  studentName: string;
  score: number | null;
  manual: boolean;
  maxPoints: number;
  onSaved?: () => void;
}

/**
 * Override (or revert) the recorded total for one student on one assignment.
 * Rendered inside the gradebook's cell dialog, next to the question-by-question
 * breakdown the total is supposed to roll up.
 */
export const ManualTotalForm: React.FC<ManualTotalFormProps> = ({
  assignmentId,
  sid,
  studentName,
  score,
  manual,
  maxPoints,
  onSaved
}) => {
  const [value, setValue] = useState<number>(score ?? 0);
  const [setManualTotal, { isLoading }] = useSetManualTotalMutation();

  // Follow the cell when a regrade (or another edit) moves the score underneath us.
  useEffect(() => {
    setValue(score ?? 0);
  }, [score]);

  const override = async () => {
    try {
      await setManualTotal({
        assignment_id: assignmentId,
        sid,
        score: value,
        manual: true
      }).unwrap();
      notify.success(`Manual total set for ${studentName}`);
      onSaved?.();
    } catch {
      notify.error("Couldn't set the manual total. Try again.");
    }
  };

  const revert = async () => {
    try {
      await setManualTotal({ assignment_id: assignmentId, sid, manual: false }).unwrap();
      notify.success(`Reverted to computed total for ${studentName}`);
      onSaved?.();
    } catch {
      notify.error("Couldn't revert the total. Try again.");
    }
  };

  return (
    <Stack gap="xs" className={styles.manualTotalForm}>
      <Group gap="xs">
        <Badge color={manual ? "yellow" : "gray"} variant="light">
          {manual ? "Manual" : "Computed"}
        </Badge>
        <Text size="sm">
          Current: {formatScore(score)} / {maxPoints}
        </Text>
      </Group>
      <NumberInput
        label="Manual total"
        value={value}
        onChange={(v) => setValue(typeof v === "number" ? v : Number(v) || 0)}
        min={0}
        size="xs"
      />
      <Group justify="space-between">
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          onClick={revert}
          disabled={!manual || isLoading}
        >
          Revert to computed
        </Button>
        <Button size="xs" onClick={override} loading={isLoading}>
          Set total
        </Button>
      </Group>
    </Stack>
  );
};

export default ManualTotalForm;
