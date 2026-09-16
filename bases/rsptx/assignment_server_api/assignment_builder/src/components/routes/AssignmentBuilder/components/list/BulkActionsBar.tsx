import { Button, Group, Menu, Popover, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useState } from "react";

import { Icon } from "@components/ui/Icon";

import {
  adjustDatesForHiddenOnChange,
  adjustDatesForVisibleOnChange,
  applyModeDateDefaults
} from "../edit/visibilityDates";
import { getVisibilityValues, VisibilityMode, VisibilityValues } from "../edit/visibilityMode";

import { VisibilityModeFields } from "./VisibilityModeFields";

import styles from "./BulkActionsBar.module.css";

interface BulkActionsBarProps {
  selectedCount: number;
  onVisibilityApply: (values: VisibilityValues) => void;
  onEnforceDueApply: (enforceDue: boolean) => void;
  onDelete: () => void;
  onClear: () => void;
}

export const BulkActionsBar = ({
  selectedCount,
  onVisibilityApply,
  onEnforceDueApply,
  onDelete,
  onClear
}: BulkActionsBarProps) => {
  const [visibilityOpened, setVisibilityOpened] = useState(false);
  const [mode, setMode] = useState<VisibilityMode>("visible");
  const [visibleOn, setVisibleOn] = useState<string | null>(null);
  const [hiddenOn, setHiddenOn] = useState<string | null>(null);

  const handleModeChange = (newMode: VisibilityMode) => {
    const dates = applyModeDateDefaults(newMode, visibleOn, hiddenOn);

    setMode(newMode);
    setVisibleOn(dates.visibleOn);
    setHiddenOn(dates.hiddenOn);
  };

  const handleVisibleOnChange = (val: string) => {
    const dates = adjustDatesForVisibleOnChange(mode, val, hiddenOn);

    setVisibleOn(dates.visibleOn);
    setHiddenOn(dates.hiddenOn);
  };

  const handleHiddenOnChange = (val: string) => {
    const dates = adjustDatesForHiddenOnChange(mode, visibleOn, val);

    setVisibleOn(dates.visibleOn);
    setHiddenOn(dates.hiddenOn);
  };

  const handleVisibilityApply = () => {
    setVisibilityOpened(false);
    onVisibilityApply(getVisibilityValues(mode, visibleOn, hiddenOn));
  };

  const confirmDelete = () => {
    modals.openConfirmModal({
      title: "Delete assignments",
      children: (
        <Text size="sm">
          Delete {selectedCount} selected {selectedCount === 1 ? "assignment" : "assignments"}? This
          can&apos;t be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: onDelete
    });
  };

  return (
    <Group className={styles.bar} justify="space-between" role="toolbar" aria-label="Bulk actions">
      <Text size="sm" fw={600} className={styles.count}>
        {selectedCount} selected
      </Text>
      <Group gap="xs" wrap="wrap">
        <Popover
          width={300}
          position="bottom"
          withArrow
          trapFocus
          returnFocus
          opened={visibilityOpened}
          onChange={setVisibilityOpened}
        >
          <Popover.Target>
            <Button
              variant="default"
              size="xs"
              leftSection={<Icon name="eye" size={14} />}
              onClick={() => setVisibilityOpened((prev) => !prev)}
            >
              Visibility
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="sm">
              <Text fw={600} size="sm">
                Set visibility for {selectedCount} selected
              </Text>
              <VisibilityModeFields
                mode={mode}
                visibleOn={visibleOn}
                hiddenOn={hiddenOn}
                onModeChange={handleModeChange}
                onVisibleOnChange={handleVisibleOnChange}
                onHiddenOnChange={handleHiddenOnChange}
              />
              <Button size="xs" onClick={handleVisibilityApply}>
                Apply
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
        <Menu position="bottom" withArrow>
          <Menu.Target>
            <Button variant="default" size="xs" leftSection={<Icon name="clock" size={14} />}>
              Late submissions
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => onEnforceDueApply(false)}>Allow late submissions</Menu.Item>
            <Menu.Item onClick={() => onEnforceDueApply(true)}>
              Don&apos;t allow late submissions
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Button
          variant="default"
          size="xs"
          color="red"
          className={styles.deleteButton}
          leftSection={<Icon name="trash" size={14} />}
          onClick={confirmDelete}
        >
          Delete
        </Button>
        <Button variant="subtle" size="xs" color="gray" onClick={onClear}>
          Clear selection
        </Button>
      </Group>
    </Group>
  );
};
