import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  Text,
  TextInput
} from "@mantine/core";
import React, { FC, useCallback, useEffect, useMemo, useState } from "react";

import { ExerciseTypeTag } from "@/components/ui/ExerciseTypeTag";
import { Icon } from "@/components/ui/Icon";
import { useSmartExerciseSearch } from "@/hooks/useSmartExerciseSearch";
import { Exercise, QuestionWithLabel } from "@/types/exercises";

import styles from "./QuestionListEditor.module.css";

interface QuestionSuggestion {
  id: string;
  name: string;
  type: string;
  topic: string;
  author: string;
}

interface QuestionListEditorProps {
  questionList: QuestionWithLabel[];
  onChange: (questionList: QuestionWithLabel[]) => void;
  dataLimitBasecourse?: boolean;
  onLimitBasecourseChange?: (limit: boolean) => void;
}

export const QuestionListEditor: FC<QuestionListEditorProps> = ({
  questionList,
  onChange,
  dataLimitBasecourse = false,
  onLimitBasecourseChange
}) => {
  const [newQuestion, setNewQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<QuestionSuggestion[]>([]);

  const { exercises, onGlobalFilterChange, toggleBaseCourse } = useSmartExerciseSearch({
    use_base_course: dataLimitBasecourse,
    limit: 20,
    assignment_id: undefined
  });

  const existingQuestionIds = useMemo(() => questionList.map((q) => q.questionId), [questionList]);

  const createSuggestions = useCallback((filteredExercises: Exercise[]): QuestionSuggestion[] => {
    return filteredExercises.map((ex) => ({
      id: ex.name,
      name: ex.name,
      type: ex.question_type,
      topic: ex.topic,
      author: ex.author
    }));
  }, []);

  const updateSuggestions = useCallback(() => {
    const availableExercises = exercises.filter(
      (ex) => ex.name && !existingQuestionIds.includes(ex.name)
    );
    setSuggestions(createSuggestions(availableExercises));
  }, [exercises, existingQuestionIds, createSuggestions]);

  useEffect(() => {
    toggleBaseCourse(dataLimitBasecourse);
  }, [dataLimitBasecourse]);

  useEffect(() => {
    updateSuggestions();
  }, [updateSuggestions]);

  const suggestionByName = useMemo(() => {
    const map = new Map<string, QuestionSuggestion>();

    suggestions.forEach((s) => map.set(s.name, s));
    return map;
  }, [suggestions]);

  const addQuestion = useCallback(
    (questionId: string) => {
      const trimmed = questionId.trim();

      if (trimmed && !existingQuestionIds.includes(trimmed)) {
        onChange([...questionList, { questionId: trimmed }]);
        setNewQuestion("");
      }
    },
    [existingQuestionIds, onChange, questionList]
  );

  const handleRemoveQuestion = (questionId: string) => {
    onChange(questionList.filter((q) => q.questionId !== questionId));
  };

  const handleLabelChange = (questionId: string, label: string) => {
    onChange(
      questionList.map((q) =>
        q.questionId === questionId ? { ...q, label: label.trim() || undefined } : q
      )
    );
  };

  const handleInputChange = (value: string) => {
    setNewQuestion(value);
    onGlobalFilterChange(value.toLowerCase().trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addQuestion(newQuestion);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h4 className={styles.title}>Question list</h4>
        </div>
        <Group className={styles.headerStats} gap="xs">
          {questionList.length > 0 && (
            <Badge color="blue" variant="light">
              {`${questionList.length} question${questionList.length !== 1 ? "s" : ""}`}
            </Badge>
          )}
          {dataLimitBasecourse && (
            <Badge color="yellow" variant="light">
              Base course only
            </Badge>
          )}
        </Group>
      </div>

      <div className={styles.inputSection}>
        <Autocomplete
          className={styles.autocomplete}
          value={newQuestion}
          data={suggestions.map((s) => s.name)}
          filter={({ options }) => options}
          onChange={handleInputChange}
          onOptionSubmit={addQuestion}
          onKeyDown={handleKeyDown}
          placeholder={
            dataLimitBasecourse
              ? "Search questions in base course…"
              : "Search questions or enter question name…"
          }
          renderOption={({ option }) => {
            const suggestion = suggestionByName.get(option.value);

            if (!suggestion) {
              return <span>{option.value}</span>;
            }

            return (
              <div className={styles.suggestionItem}>
                <div className={styles.suggestionMain}>
                  <span className={styles.suggestionName}>{suggestion.name}</span>
                  <ExerciseTypeTag type={suggestion.type} className={styles.suggestionTag} />
                </div>
                <div className={styles.suggestionMeta}>
                  <span className={styles.suggestionTopic}>{suggestion.topic}</span>
                  <span className={styles.suggestionAuthor}>by {suggestion.author}</span>
                </div>
              </div>
            );
          }}
        />

        <Checkbox
          id="limitBasecourse"
          mt="xs"
          checked={dataLimitBasecourse}
          onChange={(e) => onLimitBasecourseChange?.(e.currentTarget.checked)}
          label="Limit to base course questions only"
        />
      </div>

      {questionList.length > 0 && (
        <div className={styles.questionsList}>
          <div className={styles.questionsHeader}>
            <Text size="sm" fw={500} c="dimmed">
              Questions &amp; Labels
            </Text>
            <Button
              size="xs"
              variant="outline"
              color="red"
              leftSection={<Icon name="trash" size={14} />}
              onClick={() => onChange([])}
              className={styles.clearButton}
            >
              Clear All
            </Button>
          </div>

          <Paper withBorder radius="md" p="md">
            <Stack gap="xs">
              {questionList.map((question, index) => (
                <Group key={index} gap="sm" wrap="nowrap" align="center">
                  <Text w={120} size="sm" fw={500} className={styles.questionRowId}>
                    {question.questionId}
                  </Text>
                  <TextInput
                    flex={1}
                    size="sm"
                    value={question.label || ""}
                    onChange={(e) => handleLabelChange(question.questionId, e.target.value)}
                    placeholder="Optional display label"
                  />
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => handleRemoveQuestion(question.questionId)}
                    aria-label={`Remove ${question.questionId}`}
                  >
                    <Icon name="times" size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </Paper>
        </div>
      )}

      {questionList.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Icon name="list" size={32} />
          </div>
          <h5 className={styles.emptyTitle}>No questions added yet</h5>
          <p className={styles.emptyDescription}>
            Start typing to search for existing questions or enter question names
          </p>
        </div>
      )}
    </div>
  );
};
