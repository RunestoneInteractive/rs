import {
  Alert,
  Button,
  Divider,
  Grid,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput
} from "@mantine/core";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Exercise } from "@/types/exercises";

import { Editor } from "../../TipTap/Editor";

import { BaseExerciseProps, ExerciseValidation } from "../types/ExerciseTypes";

export const BaseExerciseForm = ({
  initialData,
  onSave,
  onCancel,
  children,
  validate,
  onDataChange
}: BaseExerciseProps & {
  children?: React.ReactNode;
  validate?: () => ExerciseValidation;
  onDataChange?: (data: Partial<Exercise>) => void;
}) => {
  const [data, setData] = useState<Partial<Exercise>>(initialData ?? {});

  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    onDataChange?.(data);
  }, [data, onDataChange]);

  const handleSave = () => {
    if (validate) {
      const validation = validate();

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }
    }

    if (!data.assignment_id) {
      setErrors(["Couldn't find the assignment. Reopen it from the assignments list."]);
      return;
    }

    onSave(data as Exercise);
  };

  const updateData = (updates: Partial<Exercise>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setErrors([]);
  };

  return (
    <Stack gap="md">
      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <TextInput
            id="title"
            label="Title"
            value={data.title ?? ""}
            onChange={(e) => updateData({ title: e.target.value })}
            placeholder="Enter exercise title"
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <NumberInput
            id="points"
            label="Points"
            value={data.points ?? 1}
            onChange={(value) => updateData({ points: value === "" ? 1 : Number(value) })}
            min={0}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <Text fw={500} mb={6}>
            Description
          </Text>
          <Editor
            content={data.description ?? ""}
            onChange={(html) => updateData({ description: html })}
          />
        </Grid.Col>

        <Grid.Col span={12}>{children}</Grid.Col>

        {errors.length > 0 && (
          <Grid.Col span={12}>
            <Stack gap="xs">
              {errors.map((error, index) => (
                <Alert key={index} color="red" variant="light">
                  {error}
                </Alert>
              ))}
            </Stack>
          </Grid.Col>
        )}
      </Grid>

      <Divider />

      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" leftSection={<Icon name="times" size={14} />} onClick={onCancel}>
          Cancel
        </Button>
        <Button leftSection={<Icon name="check" size={14} />} onClick={handleSave}>
          Save
        </Button>
      </Group>
    </Stack>
  );
};
