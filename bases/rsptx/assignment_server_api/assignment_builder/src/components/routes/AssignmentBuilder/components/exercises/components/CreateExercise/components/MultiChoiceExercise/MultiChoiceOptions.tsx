import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ActionIcon, Checkbox, Tooltip, UnstyledButton } from "@mantine/core";
import { useCallback } from "react";

import { Icon } from "@/components/ui/Icon";
import { Option } from "@/types/exercises";

import { REMOVE_OPTION_CONFIRM, confirmRemoval } from "../../utils/removeConfirm";
import { isTipTapContentEmpty } from "../../utils/validation";

import styles from "./MultiChoiceOptions.module.css";

// Define OptionWithId interface locally
export interface OptionWithId extends Option {
  id: string;
}

interface SortableOptionProps {
  option: OptionWithId;
  index: number;
  onUpdate: (id: string, updates: Partial<OptionWithId>) => void;
  onRemove: (id: string) => void;
  totalOptions: number;
}

const SortableOption = ({ option, onUpdate, onRemove, totalOptions }: SortableOptionProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
    transition: { duration: 250, easing: "var(--rs-spring-snappy)" }
  });

  const baseTransform = CSS.Transform.toString(transform);
  const style = {
    transform: isDragging && baseTransform ? `${baseTransform} scale(0.98)` : baseTransform,
    transition,
    zIndex: isDragging ? 1 : undefined
  };

  const handleContentChange = useCallback(
    (content: string) => {
      onUpdate(option.id, { choice: content });
    },
    [option.id, onUpdate]
  );

  const handleFeedbackChange = useCallback(
    (content: string) => {
      onUpdate(option.id, { feedback: content });
    },
    [option.id, onUpdate]
  );

  const handleCorrectChange = useCallback(
    (isCorrect: boolean) => {
      onUpdate(option.id, { correct: isCorrect });
    },
    [option.id, onUpdate]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.optionContainer}
      data-dragging={isDragging || undefined}
    >
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <Icon name="bars" />
      </div>

      <div className={styles.optionContent}>
        <div className={styles.horizontalLayout}>
          <div className={styles.editorSection}>
            <label className={styles.optionLabel}>Option text:</label>
            <Editor content={option.choice} onChange={handleContentChange} />
          </div>

          <div className={styles.feedbackSection}>
            <label className={styles.optionLabel}>Feedback (optional):</label>
            <Editor content={option.feedback || ""} onChange={handleFeedbackChange} />
          </div>

          <div className={styles.controlsSection}>
            <Checkbox
              id={`correct-${option.id}`}
              checked={!!option.correct}
              onChange={(e) => handleCorrectChange(e.currentTarget.checked)}
              label="Correct"
            />

            <Tooltip label="Remove option" position="left">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => onRemove(option.id)}
                disabled={totalOptions <= 2}
                aria-label="Remove option"
              >
                <Icon name="trash" size={16} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MultiChoiceOptionsProps {
  options: OptionWithId[];
  onChange: (options: OptionWithId[]) => void;
}

export const MultiChoiceOptions = ({ options, onChange }: MultiChoiceOptionsProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Handle adding a new option
  const handleAddOption = () => {
    onChange([
      ...options,
      {
        id: `option-${crypto.randomUUID()}`,
        choice: "",
        feedback: "",
        correct: false
      }
    ]);
  };

  // Handle removing an option
  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) return;
    const option = options.find((opt) => opt.id === id);
    const hasContent =
      !!option &&
      (!isTipTapContentEmpty(option.choice || "") || !isTipTapContentEmpty(option.feedback || ""));

    confirmRemoval({
      hasContent,
      ...REMOVE_OPTION_CONFIRM,
      onConfirm: () => onChange(options.filter((opt) => opt.id !== id))
    });
  };

  // Handle updating an option
  const handleUpdateOption = (id: string, updates: Partial<OptionWithId>) => {
    onChange(options.map((opt) => (opt.id === id ? { ...opt, ...updates } : opt)));
  };

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = options.findIndex((option) => option.id === active.id);
      const newIndex = options.findIndex((option) => option.id === over.id);

      onChange(arrayMove(options, oldIndex, newIndex));
    }
  };

  return (
    <div className={styles.optionsContainer}>
      <div className={styles.optionsHeader}>
        <h3>Answer options</h3>
      </div>

      <div className={styles.optionsContent}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={options.map((option) => option.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.optionsList}>
              {options.map((option, index) => (
                <SortableOption
                  key={option.id}
                  option={option}
                  index={index}
                  onUpdate={handleUpdateOption}
                  onRemove={handleRemoveOption}
                  totalOptions={options.length}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <UnstyledButton className={styles.addRow} onClick={handleAddOption} aria-label="Add option">
          <Icon name="plus" size={14} />
          Add option
        </UnstyledButton>
      </div>
    </div>
  );
};
