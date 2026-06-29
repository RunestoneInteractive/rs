import { useAssignmentRouting } from "@components/routes/AssignmentBuilder/hooks/useAssignmentRouting";
import { Button, Card, Group, Stack, Title } from "@mantine/core";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";

import { Icon } from "@/components/ui/Icon";
import { CreateExerciseFormType, ExerciseType, QuestionJSON } from "@/types/exercises";
import { buildQuestionJson, mergeQuestionJsonWithDefaults } from "@/utils/questionJson";

import { ExerciseFactory } from "./components/ExerciseFactory";
import { ExerciseTypeSelect } from "./components/ExerciseTypeSelect";
import { ImportQuestionJsonModal } from "./components/ImportQuestionJsonModal";

interface CreateExerciseProps {
  onCancel: () => void;
  onSave: (exercise: CreateExerciseFormType) => Promise<void>;
  resetForm?: boolean;
  onFormReset?: () => void;
  initialData?: Partial<CreateExerciseFormType>;
  isEdit?: boolean;
}

export const CreateExercise = ({
  onCancel,
  onSave,
  resetForm = false,
  onFormReset,
  initialData,
  isEdit = false
}: CreateExerciseProps) => {
  const { exerciseType, updateExerciseType, updateExerciseViewMode } = useAssignmentRouting();
  const languageOptions = useSelector(datasetSelectors.getLanguageOptions);

  // If editing and there's initial data with question_type, use that type
  const [selectedType, setSelectedType] = useState<ExerciseType | null>(
    isEdit && initialData && (initialData.question_type as ExerciseType)
      ? (initialData.question_type as ExerciseType)
      : (exerciseType as ExerciseType | null)
  );

  const [importedData, setImportedData] = useState<Partial<CreateExerciseFormType> | undefined>();
  const [factoryKey, setFactoryKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      if (exerciseType) {
        setSelectedType(exerciseType as ExerciseType);
      } else {
        setSelectedType(null);
      }
    }
  }, [exerciseType, isEdit]);

  // Reset the form when resetForm is true
  useEffect(() => {
    if (resetForm && onFormReset) {
      setSelectedType(null);
      setImportedData(undefined);
      onFormReset();
    }
  }, [resetForm, onFormReset]);

  const handleTypeSelect = (type: string) => {
    const nextType = type as ExerciseType;

    // Picking a type manually starts a fresh form: drop any previously imported
    // data (which carries its own question_type and field values) and remount the
    // factory so it re-seeds from defaults rather than the stale import.
    setImportedData(undefined);
    setFactoryKey((key) => key + 1);
    setSelectedType(nextType);
    if (!isEdit) {
      updateExerciseType(type);
    }
  };

  const handleCancel = () => {
    if (isEdit) {
      onCancel();
    } else {
      setSelectedType(null);
      updateExerciseViewMode("create");
    }
  };

  const effectiveInitialData = importedData ?? initialData;

  // JSON shown in the edit-mode "View / Replace JSON" modal. Derived from the
  // effective data so it reflects an in-session import/replace rather than the
  // stale original exercise.
  const currentJson = useMemo(() => {
    if (!isEdit || !effectiveInitialData) {
      return "";
    }
    try {
      return JSON.stringify(
        JSON.parse(buildQuestionJson(effectiveInitialData as CreateExerciseFormType)),
        null,
        2
      );
    } catch {
      return "";
    }
  }, [isEdit, effectiveInitialData]);

  const handleImportApply = (type: ExerciseType, data: QuestionJSON) => {
    const merged = mergeQuestionJsonWithDefaults(languageOptions, data);
    const next = {
      ...(initialData ?? {}),
      ...merged,
      question_type: type
    } as Partial<CreateExerciseFormType>;

    setImportedData(next);
    setSelectedType(type);
    setFactoryKey((key) => key + 1);
    if (!isEdit) {
      updateExerciseType(type);
    }
  };

  if (!selectedType) {
    return (
      <>
        <Card withBorder radius="md" padding="lg">
          <Group justify="space-between" align="center" mb="md">
            <Title order={4}>{isEdit ? "Edit exercise type" : "Select exercise type"}</Title>
            <Button
              variant="light"
              leftSection={<Icon name="code" size={16} />}
              onClick={() => setImportOpen(true)}
            >
              Paste JSON
            </Button>
          </Group>
          <ExerciseTypeSelect selectedType={selectedType} onSelect={handleTypeSelect} />
          <Group justify="flex-end" gap="sm" mt="md">
            <Button
              variant="subtle"
              leftSection={<Icon name="times" size={16} />}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </Group>
        </Card>
        <ImportQuestionJsonModal
          opened={importOpen}
          onClose={() => setImportOpen(false)}
          onApply={handleImportApply}
        />
      </>
    );
  }

  return (
    <Stack gap="sm">
      {isEdit && (
        <Group justify="flex-end">
          <Button
            variant="light"
            leftSection={<Icon name="code" size={16} />}
            onClick={() => setImportOpen(true)}
          >
            View / Replace JSON
          </Button>
        </Group>
      )}
      <ExerciseFactory
        key={factoryKey}
        type={selectedType}
        onCancel={handleCancel}
        onSave={onSave}
        resetForm={resetForm}
        onFormReset={onFormReset}
        initialData={effectiveInitialData}
        isEdit={isEdit}
      />
      <ImportQuestionJsonModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={handleImportApply}
        lockedType={isEdit ? selectedType : undefined}
        initialJson={isEdit ? currentJson : undefined}
      />
    </Stack>
  );
};
