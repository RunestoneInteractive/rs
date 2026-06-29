import { Alert, Button, Group, Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { useExerciseTypes } from "@/hooks/useExerciseTypes";
import { ExerciseType, QuestionJSON, supportedExerciseTypes } from "@/types/exercises";
import { parseQuestionJsonInput, validateQuestionJsonForType } from "@/utils/importQuestionJson";

interface ImportQuestionJsonModalProps {
  opened: boolean;
  onClose: () => void;
  onApply: (type: ExerciseType, data: QuestionJSON) => void;
  lockedType?: ExerciseType;
  initialJson?: string;
}

export const ImportQuestionJsonModal = ({
  opened,
  onClose,
  onApply,
  lockedType,
  initialJson
}: ImportQuestionJsonModalProps) => {
  const exerciseTypes = useExerciseTypes();

  const typeOptions = useMemo(
    () =>
      exerciseTypes
        .filter((type) => supportedExerciseTypes.includes(type.value as ExerciseType))
        .map((type) => ({ value: type.value, label: type.label })),
    [exerciseTypes]
  );

  const [selectedType, setSelectedType] = useState<ExerciseType | null>(lockedType ?? null);
  const [jsonText, setJsonText] = useState(initialJson ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (opened) {
      setSelectedType(lockedType ?? null);
      setJsonText(initialJson ?? "");
      setErrors([]);
    }
  }, [opened, lockedType, initialJson]);

  const handleApply = () => {
    if (!selectedType) {
      setErrors(["Select a question type first."]);
      return;
    }

    const { data, error } = parseQuestionJsonInput(jsonText);

    if (error || !data) {
      setErrors([error ?? "The JSON could not be parsed."]);
      return;
    }

    const validationErrors = validateQuestionJsonForType(selectedType, data);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    onApply(selectedType, data);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={lockedType ? "View or replace question JSON" : "Paste question JSON"}
      size="lg"
      centered
    >
      <Stack gap="md">
        {!lockedType && (
          <Select
            label="Question type"
            placeholder="Select a question type"
            data={typeOptions}
            value={selectedType}
            onChange={(value) => setSelectedType(value as ExerciseType | null)}
            allowDeselect={false}
          />
        )}

        <div>
          <Text fw={500} mb={6}>
            Question JSON
          </Text>
          <Textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.currentTarget.value)}
            placeholder='{ "statement": "...", "optionList": [ ... ] }'
            autosize
            minRows={12}
            maxRows={24}
            styles={{ input: { fontFamily: "var(--rs-font-mono, monospace)" } }}
          />
        </div>

        {errors.length > 0 && (
          <Alert color="red" variant="light" title="The JSON could not be imported">
            <Stack gap={4}>
              {errors.map((error, index) => (
                <Text key={index} size="sm">
                  {error}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" leftSection={<Icon name="times" size={14} />} onClick={onClose}>
            Cancel
          </Button>
          <Button leftSection={<Icon name="check" size={14} />} onClick={handleApply}>
            Apply
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
