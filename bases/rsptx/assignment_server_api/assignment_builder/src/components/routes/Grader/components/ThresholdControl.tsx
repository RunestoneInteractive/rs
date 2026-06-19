import { Badge, Button, Group, NumberInput, Popover, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import React, { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { notify } from "@/components/ui/notify";
import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";
import { useSetAssignmentThresholdMutation } from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";

interface ThresholdControlProps {
  assignmentId: number;
  disabled?: boolean;
}

const fractionToPercent = (fraction: number | null): number | null =>
  fraction === null || fraction === undefined ? null : Math.round(fraction * 1000) / 10;

export const ThresholdControl: React.FC<ThresholdControlProps> = ({
  assignmentId,
  disabled = false
}) => {
  const { data: assignments } = useGetAssignmentsQuery();
  const [setThreshold, { isLoading }] = useSetAssignmentThresholdMutation();
  const [opened, setOpened] = useState(false);

  const assignment = assignments?.find((a) => a.id === assignmentId);
  const currentPercent = fractionToPercent(assignment?.threshold_pct ?? null);
  const [value, setValue] = useState<number | "">(currentPercent ?? "");

  if (!assignment) return null;

  const hasThreshold = currentPercent !== null;
  const name = assignment.name;

  const apply = async (fraction: number | null) => {
    try {
      await setThreshold({ assignment_id: assignmentId, threshold_pct: fraction }).unwrap();
      notify.success(
        fraction === null
          ? "Threshold cleared. Recompute totals to apply."
          : "Threshold set. Recompute totals to apply."
      );
      setOpened(false);
    } catch {
      notify.error("Couldn't update the threshold. Try again.");
    }
  };

  const confirmSet = () => {
    const pct = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      notify.error("Enter a percentage between 0 and 100.");
      return;
    }
    modals.openConfirmModal({
      title: "Set threshold scoring",
      children: (
        <Text size="sm">
          Award full points to students above {pct}% on &quot;{name}&quot;? Totals update on the
          next recompute.
        </Text>
      ),
      labels: { confirm: "Set threshold", cancel: "Cancel" },
      onConfirm: () => apply(pct / 100)
    });
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      withArrow
      trapFocus
      shadow="md"
    >
      <Popover.Target>
        <Button
          size="xs"
          variant={hasThreshold ? "light" : "subtle"}
          leftSection={<Icon name="percentage" size={14} />}
          disabled={disabled}
          onClick={() => setOpened((o) => !o)}
          className={styles.thresholdControl}
        >
          {hasThreshold ? `Threshold ${currentPercent}%` : "Threshold"}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" className={styles.thresholdForm}>
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Threshold scoring
            </Text>
            <Badge color={hasThreshold ? "blue" : "gray"} variant="light">
              {hasThreshold ? `${currentPercent}%` : "Off"}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            Students scoring above this percentage receive full points on recompute.
          </Text>
          <NumberInput
            value={value}
            onChange={(v) => setValue(v === "" ? "" : Number(v) || 0)}
            min={0}
            suffix="%"
            aria-label="Threshold percentage"
            disabled={isLoading}
          />
          <Group justify="space-between">
            <Button
              size="xs"
              variant="default"
              disabled={!hasThreshold || isLoading}
              onClick={() => apply(null)}
            >
              Clear
            </Button>
            <Button size="xs" onClick={confirmSet} loading={isLoading}>
              Set threshold
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

export default ThresholdControl;
