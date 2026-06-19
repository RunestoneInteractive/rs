import { PollOption } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/PollTypes";
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
import { ActionIcon, Tooltip, UnstyledButton } from "@mantine/core";
import { useCallback } from "react";

import { Icon } from "@/components/ui/Icon";

import { REMOVE_OPTION_CONFIRM, confirmRemoval } from "../../utils/removeConfirm";
import { isTipTapContentEmpty } from "../../utils/validation";

import styles from "./PollOptions.module.css";

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
    (html: string) => {
      onUpdate(option.id, { choice: html });
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
        <Editor content={option.choice} onChange={handleContentChange} />
      </div>
      <div className={styles.optionActions}>
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
    const option = options.find((opt) => opt.id === id);

    confirmRemoval({
      hasContent: !!option && !isTipTapContentEmpty(option.choice || ""),
      ...REMOVE_OPTION_CONFIRM,
      onConfirm: () => onChange(options.filter((opt) => opt.id !== id))
    });
  };

  const handleAdd = () => {
    const newOption: PollOption = {
      id: `option-${crypto.randomUUID()}`,
      choice: ""
    };

    onChange([...options, newOption]);
  };

  return (
    <div className={styles.optionsContainer}>
      <div className={styles.optionsHeader}>
        <h3>Poll options</h3>
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

        <UnstyledButton className={styles.addRow} onClick={handleAdd} aria-label="Add option">
          <Icon name="plus" size={14} />
          Add option
        </UnstyledButton>
      </div>
    </div>
  );
};
