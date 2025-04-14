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
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { useCallback } from "react";

import { Option } from "@/types/exercises";

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
    id: option.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
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
      className={`${styles.optionContainer} ${isDragging ? styles.dragging : ""}`}
    >
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <i className="pi pi-bars" />
      </div>

      <div className={styles.optionContent}>
        <div className={styles.horizontalLayout}>
          <div className={styles.editorSection}>
            <label className={styles.optionLabel}>Option text:</label>
            <Editor
              content={option.choice}
              onChange={handleContentChange}
              placeholder="Enter option content..."
            />
          </div>

          <div className={styles.feedbackSection}>
            <label className={styles.optionLabel}>Feedback (optional):</label>
            <Editor
              content={option.feedback || ""}
              onChange={handleFeedbackChange}
              placeholder="Enter feedback..."
            />
          </div>

          <div className={styles.controlsSection}>
            <div className={styles.checkboxContainer}>
              <Checkbox
                inputId={`correct-${option.id}`}
                checked={!!option.correct}
                onChange={(e) => handleCorrectChange(e.checked ?? false)}
              />
              <label className={styles.checkboxLabel}>Correct</label>
            </div>

            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              onClick={() => onRemove(option.id)}
              className={styles.removeButton}
              tooltip="Remove option"
              tooltipOptions={{ position: "left" }}
              disabled={totalOptions <= 2}
              aria-label="Remove option"
            />
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
        id: `option-${Date.now()}`,
        choice: "",
        feedback: "",
        correct: false
      }
    ]);
  };

  // Handle removing an option
  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) return;
    onChange(options.filter((opt) => opt.id !== id));
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
    <div className={styles.optionsContainer} style={{ margin: "-2rem" }}>
      <div className={styles.optionsHeader}>
        <div className="flex justify-content-end w-full">
          <Button
            label="Add Option"
            icon="pi pi-plus"
            className={styles.addButton}
            onClick={handleAddOption}
            aria-label="Add new answer option"
          />
        </div>
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
      </div>
    </div>
  );
};
