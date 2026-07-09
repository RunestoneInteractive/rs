import { getRangeUpdateToastCopy } from "@components/ui/EditableTable/TableOverlay";
import { Icon } from "@components/ui/Icon";
import { notify } from "@components/ui/notify";
import { ActionIcon, Button, Group, Popover, Stack, Text } from "@mantine/core";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { ComponentType, useState } from "react";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";

export interface WithEditAllExercisesProps<T> {
  field: DraggingExerciseColumns;
  label: string;
  defaultValue: T;
  headerAlign?: "left" | "right";
}

export function withEditAllExercises<T, P extends WithEditAllExercisesProps<T>>(
  Component: ComponentType<P>
) {
  return function WrappedComponent(props: P) {
    const [updateExercises, { isLoading }] = useUpdateAssignmentQuestionsMutation();
    const { assignmentExercises = [] } = useExercisesSelector();
    const [opened, setOpened] = useState(false);
    const [value, setValue] = useState<T>(props.defaultValue);

    const rowCount = assignmentExercises.length;

    const handleSubmit = async () => {
      const exercises = assignmentExercises.map((ex) => ({
        ...ex,
        question_json: JSON.stringify(ex.question_json),
        [props.field]: value
      }));
      const { error } = await updateExercises(exercises);
      const copy = getRangeUpdateToastCopy("exercises", rowCount);

      if (!error) {
        setOpened(false);
        notify.success(copy.success);
      } else {
        notify.error(copy.error);
      }
    };

    return (
      <Group
        gap="xs"
        align="center"
        wrap="nowrap"
        justify={props.headerAlign === "right" ? "flex-end" : undefined}
      >
        <span>{props.label}</span>
        <Popover
          width={272}
          position="bottom"
          opened={opened}
          onChange={setOpened}
          trapFocus
          returnFocus
        >
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => setOpened((current) => !current)}
              aria-label={`Edit ${props.label} for all exercises`}
            >
              <Icon name="pencil" />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="sm">
              <Text size="sm" fw={600}>
                Edit &quot;{props.label}&quot; for all exercises
              </Text>
              <Component {...props} handleSubmit={handleSubmit} onChange={setValue} value={value} />
              <Text size="xs" c="dimmed">
                {rowCount === 1 ? "Applies to 1 exercise" : `Applies to ${rowCount} exercises`}
              </Text>
              <Group justify="space-between">
                <Button size="xs" variant="default" onClick={() => setOpened(false)}>
                  Cancel
                </Button>
                <Button size="xs" loading={isLoading} onClick={handleSubmit}>
                  Apply
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
    );
  };
}
