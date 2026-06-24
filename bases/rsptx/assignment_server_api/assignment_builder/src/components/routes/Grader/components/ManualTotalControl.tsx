import {
  Badge,
  Button,
  Group,
  NumberInput,
  Popover,
  Stack,
  Text,
  UnstyledButton
} from "@mantine/core";
import React, { useState } from "react";

import { notify } from "@/components/ui/notify";
import { useSetManualTotalMutation } from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";
import { formatScore } from "../state/gradebookSelectors";

interface ManualTotalControlProps {
  assignmentId: number;
  sid: string;
  studentName: string;
  assignmentName: string;
  score: number | null;
  manual: boolean;
  maxPoints: number;
}

export const ManualTotalControl: React.FC<ManualTotalControlProps> = ({
  assignmentId,
  sid,
  studentName,
  assignmentName,
  score,
  manual,
  maxPoints
}) => {
  const [opened, setOpened] = useState(false);
  const [value, setValue] = useState<number>(score ?? 0);
  const [setManualTotal, { isLoading }] = useSetManualTotalMutation();

  const open = () => {
    setValue(score ?? 0);
    setOpened(true);
  };

  const override = async () => {
    try {
      await setManualTotal({
        assignment_id: assignmentId,
        sid,
        score: value,
        manual: true
      }).unwrap();
      notify.success(`Manual total set for ${studentName}`);
      setOpened(false);
    } catch {
      notify.error("Couldn't set the manual total. Try again.");
    }
  };

  const revert = async () => {
    try {
      await setManualTotal({ assignment_id: assignmentId, sid, manual: false }).unwrap();
      notify.success(`Reverted to computed total for ${studentName}`);
      setOpened(false);
    } catch {
      notify.error("Couldn't revert the total. Try again.");
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      withArrow
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <UnstyledButton
          className={`${styles.gradebookCellButton} ${manual ? styles.gradebookCellManual : ""}`}
          onClick={open}
          aria-label={`Edit total for ${studentName} on ${assignmentName}`}
          title={manual ? "Manual total — click to edit" : "Click to override total"}
        >
          <span>{formatScore(score)}</span>
          {manual && <span className={styles.gradebookManualDot} aria-hidden="true" />}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" className={styles.manualTotalForm}>
          <div>
            <Text size="sm" fw={600}>
              {studentName}
            </Text>
            <Text size="xs" c="dimmed">
              {assignmentName}
            </Text>
          </div>
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
      </Popover.Dropdown>
    </Popover>
  );
};

export default ManualTotalControl;
