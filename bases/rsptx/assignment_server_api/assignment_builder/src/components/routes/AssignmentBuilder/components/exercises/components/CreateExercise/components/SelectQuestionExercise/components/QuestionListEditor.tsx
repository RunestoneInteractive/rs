import { AutoComplete } from "primereact/autocomplete";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";
import React, { FC, useCallback, useEffect, useMemo, useState } from "react";

import { ExerciseTypeTag } from "@/components/ui/ExerciseTypeTag";
import { useSmartExerciseSearch } from "@/hooks/useSmartExerciseSearch";
import { QuestionWithLabel } from "@/types/exercises";

import styles from "./QuestionListEditor.module.css";

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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);

  const { exercises, onGlobalFilterChange, toggleBaseCourse } = useSmartExerciseSearch({
    use_base_course: dataLimitBasecourse,
    limit: 20,
    assignment_id: undefined
  });

  const existingQuestionIds = useMemo(() => questionList.map((q) => q.questionId), [questionList]);

  const createSuggestions = useCallback((filteredExercises: any[]) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLimitBasecourse]);

  useEffect(() => {
    updateSuggestions();
  }, [updateSuggestions]);

  const handleAddQuestion = () => {
    const trimmed = newQuestion.trim();

    if (trimmed && !existingQuestionIds.includes(trimmed)) {
      onChange([...questionList, { questionId: trimmed }]);
      setNewQuestion("");
    }
  };

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isAutocompleteOpen) {
      e.preventDefault();
      handleAddQuestion();
    }
  };

  const handleAutocompleteSearch = (event: { query: string }) => {
    const query = event.query.toLowerCase().trim();
    onGlobalFilterChange(query);
    updateSuggestions();
  };

  const handleAutocompleteSelect = (event: { value: any }) => {
    if (event.value?.name && !existingQuestionIds.includes(event.value.name)) {
      onChange([...questionList, { questionId: event.value.name }]);
      setNewQuestion("");
    }
  };

  const handleAutocompleteChange = (e: any) => {
    setNewQuestion(e.target.value || "");
  };

  const handleAutocompleteShow = () => {
    setIsAutocompleteOpen(true);
    if (!newQuestion.trim()) {
      updateSuggestions();
    }
  };

  const handleAutocompleteHide = () => {
    setIsAutocompleteOpen(false);
  };

  const suggestionTemplate = (suggestion: any) => {
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
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h4 className={styles.title}>Question List</h4>
        </div>
        <div className={styles.headerStats}>
          {questionList.length > 0 && (
            <Tag
              value={`${questionList.length} question${questionList.length !== 1 ? "s" : ""}`}
              severity="info"
            />
          )}
          {dataLimitBasecourse && (
            <Tag value="Base course only" severity="warning" className="ml-2" />
          )}
        </div>
      </div>

      <div className={styles.inputSection}>
        <div className={styles.inputGroup}>
          <AutoComplete
            value={newQuestion}
            suggestions={suggestions}
            completeMethod={handleAutocompleteSearch}
            onSelect={handleAutocompleteSelect}
            onChange={handleAutocompleteChange}
            onShow={handleAutocompleteShow}
            onHide={handleAutocompleteHide}
            onFocus={() => {
              if (!newQuestion.trim()) {
                updateSuggestions();
              }
            }}
            placeholder={
              dataLimitBasecourse
                ? "Search questions in base course..."
                : "Search questions or enter question name..."
            }
            className={styles.autocomplete}
            onKeyDown={handleKeyPress}
            dropdown
            dropdownMode="current"
            delay={100}
            forceSelection={false}
            itemTemplate={suggestionTemplate}
          />
        </div>

        <div className="field-checkbox flex align-items-center gap-1 mt-1">
          <Checkbox
            inputId="limitBasecourse"
            checked={dataLimitBasecourse}
            onChange={(e) => onLimitBasecourseChange?.(e.checked || false)}
          />
          <label htmlFor="limitBasecourse" className="ml-1 text-sm">
            <span className="font-medium">Limit to base course questions only</span>
          </label>
        </div>
      </div>

      {questionList.length > 0 && (
        <div className={styles.questionsList}>
          <div className={styles.questionsHeader}>
            <span className="text-sm font-medium text-700">Questions & Labels</span>
            <Button
              label="Clear All"
              icon="pi pi-trash"
              size="small"
              severity="danger"
              outlined
              onClick={() => onChange([])}
              className={styles.clearButton}
            />
          </div>

          <div className="surface-card border-round p-3">
            <div className="flex flex-column gap-2">
              {questionList.map((question, index) => (
                <div
                  key={index}
                  className="flex align-items-center gap-2 p-2 border-round hover:surface-100"
                >
                  <div className="flex-shrink-0" style={{ minWidth: "120px" }}>
                    <span className="font-medium text-900 text-sm">{question.questionId}</span>
                  </div>
                  <div className="flex-grow-1">
                    <InputText
                      value={question.label || ""}
                      onChange={(e) => handleLabelChange(question.questionId, e.target.value)}
                      placeholder="Optional display label"
                      className="w-full text-sm"
                      style={{ height: "2rem" }}
                    />
                  </div>
                  <Button
                    icon="pi pi-times"
                    size="small"
                    severity="danger"
                    text
                    onClick={() => handleRemoveQuestion(question.questionId)}
                    style={{ width: "2rem", height: "2rem" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {questionList.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <i className="pi pi-list" />
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
