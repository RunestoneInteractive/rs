import styles from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/shared/styles/CreateExerciseOptions.module.css";
import { PollOption } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/PollTypes";
import { isTipTapContentEmpty } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/utils/validation";
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
import { useCallback } from "react";

interface PollOptionItemProps {
  option: PollOption;
  onUpdate: (id: string, updates: Partial<PollOption>) => void;
  onRemove: (id: string) => void;
}

const SortableOption = ({
  option,
  onUpdate,
  onRemove,
  totalOptions
}: PollOptionItemProps & { totalOptions: number }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  // Handle content change with proper validation for TipTap
  const handleContentChange = useCallback(
    (html: string) => {
      onUpdate(option.id, { choice: html });
    },
    [option.id, onUpdate]
  );

  const isEmpty = isTipTapContentEmpty(option.choice);

  // Visual indicator for empty options
  const editorContainerClass = `${styles.editorContainer} ${isEmpty ? styles.emptyEditor : ""}`;

  return (
    <div ref={setNodeRef} style={style} className={styles.optionContainer}>
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <i className="fa-solid fa-grip-vertical" />
      </div>
      <div className={styles.optionContent}>
        <div className={editorContainerClass}>
          <Editor
            content={option.choice}
            onChange={handleContentChange}
            placeholder="Enter option text..."
          />
        </div>
      </div>
      <div className={styles.optionActions}>
        <Button
          icon="fa-solid fa-trash"
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
  );
};

export const PollOptions = ({
  options,
  onChange
}: {
  options: PollOption[];
  onChange: (options: PollOption[]) => void;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = options.findIndex((option) => option.id === active.id);
      const newIndex = options.findIndex((option) => option.id === over.id);

      onChange(arrayMove(options, oldIndex, newIndex));
    }
  };

  const handleUpdate = useCallback(
    (id: string, updates: Partial<PollOption>) => {
      onChange(options.map((option) => (option.id === id ? { ...option, ...updates } : option)));
    },
    [options, onChange]
  );

  const handleRemove = (id: string) => {
    if (options.length <= 2) return;
    onChange(options.filter((option) => option.id !== id));
  };

  const handleAdd = () => {
    const newOption: PollOption = {
      id: `option-${Date.now()}`,
      choice: ""
    };

    onChange([...options, newOption]);
  };

  return (
    <div className={styles.optionsContainer}>
      <div className={styles.optionsHeader}>
        <h3>Poll Options</h3>
        <Button
          label="Add Option"
          icon="fa-solid fa-plus"
          text
          onClick={handleAdd}
          className={styles.addButton}
          aria-label="Add new poll option"
        />
      </div>

      <div className={styles.optionsContent}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={options.map((option) => option.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.optionsList}>
              {options.map((option) => (
                <div key={option.id} data-option-id={option.id}>
                  <SortableOption
                    option={option}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                    totalOptions={options.length}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
