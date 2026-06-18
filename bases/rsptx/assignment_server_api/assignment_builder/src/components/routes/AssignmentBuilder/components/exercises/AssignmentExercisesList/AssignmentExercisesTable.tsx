import { EditableCellFactory } from "@components/ui/EditableTable/EditableCellFactory";
import { EditableColumn, EditableDataTable } from "@components/ui/EditableTable/EditableDataTable";
import {
  TableSelectionOverlay,
  getRangeUpdateToastCopy
} from "@components/ui/EditableTable/TableOverlay";
import { ExerciseTypeTag } from "@components/ui/ExerciseTypeTag";
import { Icon } from "@components/ui/Icon";
import { notify } from "@components/ui/notify";
import { ActionIcon, Button, Group, Popover, Select, Stack, Text, Tooltip } from "@mantine/core";
import {
  useHasApiKeyQuery,
  useReorderAssignmentExercisesMutation,
  useUpdateAssignmentQuestionsMutation
} from "@store/assignmentExercise/assignmentExercise.logic.api";
import { RefCallback, useMemo, useState } from "react";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";

import { difficultyOptions } from "@/config/exerciseTypes";
import { useJwtUser } from "@/hooks/useJwtUser";
import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise, supportedExerciseTypesToEdit } from "@/types/exercises";

import { CopyExerciseModal } from "../components/CopyExercise/CopyExerciseModal";
import { EditDropdownValueHeader } from "../components/EditAllExercises/EditDropdownValueHeader";
import { EditInputValueHeader } from "../components/EditAllExercises/EditInputValueHeader";
import { ExercisePreviewModal } from "../components/ExercisePreview/ExercisePreviewModal";

import { SetCurrentEditExercise, ViewModeSetter, MouseUpHandler } from "./types";

import styles from "./AssignmentExercisesTable.module.css";

const ASYNC_MODE_OPTIONS = (hasApiKey: boolean) => [
  { value: "Standard", label: "Standard" },
  { value: "Generic LLM", label: "Generic LLM", disabled: !hasApiKey },
  { value: "Personalized LLM", label: "Personalized LLM", disabled: !hasApiKey }
];

const asyncModeToLabel = (asyncMode: string | undefined, hasApiKey: boolean): string => {
  if (!hasApiKey || !asyncMode || asyncMode === "standard") {
    return "Standard";
  }
  return asyncMode === "analogies" ? "Personalized LLM" : "Generic LLM";
};

const labelToAsyncMode = (label: string | null): string => {
  if (label === "Generic LLM") {
    return "llm";
  }
  if (label === "Personalized LLM") {
    return "analogies";
  }
  return "standard";
};

const AsyncModeHeader = ({ hasApiKey }: { hasApiKey: boolean }) => {
  const [updateExercises, { isLoading }] = useUpdateAssignmentQuestionsMutation();
  const { assignmentExercises = [] } = useExercisesSelector();
  const [opened, setOpened] = useState(false);
  const [value, setValue] = useState("Standard");

  const rowCount = assignmentExercises.length;

  const handleSubmit = async () => {
    const exercises = assignmentExercises.map((ex) => ({
      ...ex,
      question_json: JSON.stringify(ex.question_json),
      async_mode: labelToAsyncMode(value)
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
    <Group gap="xs" align="center" wrap="nowrap">
      <span>Async mode</span>
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
            aria-label="Edit Async mode for all exercises"
          >
            <Icon name="pencil" />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              Edit &quot;Async mode&quot; for all exercises
            </Text>
            <Select
              value={value}
              onChange={(next) => setValue(next ?? "Standard")}
              data={ASYNC_MODE_OPTIONS(hasApiKey)}
              allowDeselect={false}
              comboboxProps={{ withinPortal: false }}
            />
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

interface AssignmentExercisesTableProps {
  assignmentExercises: Exercise[];
  selectedExercises: Exercise[];
  setSelectedExercises: (exercises: Exercise[]) => void;
  globalFilter: string;
  setCurrentEditExercise: SetCurrentEditExercise;
  setViewMode: ViewModeSetter;
  startItemId: number | null;
  draggingFieldName: DraggingExerciseColumns | null;
  handleMouseDown: (itemId: number, fieldName: DraggingExerciseColumns) => void;
  handleMouseUp: MouseUpHandler;
  handleChange: (
    itemId: number,
    fieldName: DraggingExerciseColumns,
    value: string | number
  ) => void;
  scrollSentinelRef?: RefCallback<HTMLElement>;
}

const matchesFilter = (exercise: Exercise, filter: string): boolean => {
  const query = filter.trim().toLowerCase();

  if (!query) {
    return true;
  }
  return [exercise.name, exercise.title, exercise.qnumber]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(query));
};

export const AssignmentExercisesTable = ({
  assignmentExercises,
  selectedExercises,
  setSelectedExercises,
  globalFilter,
  setCurrentEditExercise,
  setViewMode,
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange,
  scrollSentinelRef
}: AssignmentExercisesTableProps) => {
  const { username } = useJwtUser();
  const [reorderExercises] = useReorderAssignmentExercisesMutation();
  const [updateAssignmentQuestions] = useUpdateAssignmentQuestionsMutation();
  const { selectedAssignment } = useSelectedAssignment();
  const { data: { hasApiKey = false, asyncLlmModesEnabled = false } = {} } = useHasApiKeyQuery();
  const isPeerAsync =
    selectedAssignment?.kind === "Peer" && selectedAssignment?.peer_async_visible === true;
  const showAsyncColumn = isPeerAsync && asyncLlmModesEnabled;
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedExerciseForCopy, setSelectedExerciseForCopy] = useState<Exercise | null>(null);

  const getIsEditable = (exercise: Exercise) =>
    exercise.owner === username &&
    supportedExerciseTypesToEdit.includes(exercise.question_type) &&
    !!exercise.question_json;

  const handleCopyClick = (exercise: Exercise) => {
    setSelectedExerciseForCopy(exercise);
    setCopyModalVisible(true);
  };

  const handleCopyModalHide = () => {
    setCopyModalVisible(false);
    setSelectedExerciseForCopy(null);
  };

  const getTooltipText = (data: Exercise) =>
    Object.entries({
      Author: data.author,
      Difficulty: difficultyOptions[data.difficulty as keyof typeof difficultyOptions],
      Tags: data.tags,
      Chapter: data.chapter
    })
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

  const filteredExercises = useMemo(
    () => assignmentExercises.filter((exercise) => matchesFilter(exercise, globalFilter)),
    [assignmentExercises, globalFilter]
  );

  const columns = useMemo<EditableColumn<Exercise>[]>(() => {
    const baseColumns: EditableColumn<Exercise>[] = [
      {
        key: "info",
        header: "",
        hiddenHeaderLabel: "Details",
        width: "3rem",
        align: "center",
        render: (row) => (
          <Tooltip
            label={<span className={styles.tooltipText}>{getTooltipText(row)}</span>}
            multiline
            w={220}
            position="top"
            events={{ hover: true, focus: true, touch: true }}
            disabled={!getTooltipText(row)}
          >
            <ActionIcon variant="subtle" color="gray" size={40} aria-label="Exercise details">
              <Icon name="info-circle" />
            </ActionIcon>
          </Tooltip>
        )
      },
      {
        key: "preview",
        header: "",
        hiddenHeaderLabel: "Preview",
        width: "3rem",
        align: "center",
        render: (row) =>
          row.htmlsrc ? (
            <ExercisePreviewModal
              htmlsrc={row.htmlsrc}
              questionName={row.name || row.title}
              triggerButton={
                <ActionIcon variant="subtle" color="gray" size={40} aria-label="Preview exercise">
                  <Icon name="eye" />
                </ActionIcon>
              }
            />
          ) : null
      },
      {
        key: "edit",
        header: "",
        hiddenHeaderLabel: "Edit",
        width: "3rem",
        align: "center",
        render: (row) =>
          getIsEditable(row) ? (
            <Tooltip label="Edit exercise" position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                aria-label="Edit exercise"
                onClick={() => {
                  setCurrentEditExercise(row);
                  setViewMode("edit");
                }}
              >
                <Icon name="pencil" />
              </ActionIcon>
            </Tooltip>
          ) : null
      },
      {
        key: "copy",
        header: "",
        hiddenHeaderLabel: "Copy",
        width: "3rem",
        align: "center",
        render: (row) =>
          row.question_json ? (
            <Tooltip label="Copy exercise" position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size={40}
                aria-label="Copy exercise"
                onClick={() => handleCopyClick(row)}
              >
                <Icon name="copy" />
              </ActionIcon>
            </Tooltip>
          ) : null
      },
      {
        key: "exercise",
        header: "Exercise",
        width: "20rem",
        render: (row) => (
          <div>
            <div className={styles.name} title={row.name || row.title}>
              {row.name || row.title}
            </div>
            <div className={styles.sub} title={row.qnumber || undefined}>
              {row.qnumber}
            </div>
          </div>
        )
      },
      {
        key: "question_type",
        header: "Type",
        width: "12rem",
        render: (row) => (row.question_type ? <ExerciseTypeTag type={row.question_type} /> : null)
      },
      {
        key: "autograde",
        field: "autograde",
        width: "12rem",
        header: <EditDropdownValueHeader field="autograde" label="Autograde" defaultValue="" />,
        render: (row) => (
          <EditableCellFactory
            fieldName="autograde"
            itemId={row.id}
            handleMouseDown={handleMouseDown}
            handleChange={handleChange}
            value={row.autograde}
            questionType={row.question_type}
            isDragging={startItemId !== null}
            rowLabel={row.name || row.title}
          />
        )
      },
      {
        key: "which_to_grade",
        field: "which_to_grade",
        width: "12rem",
        header: (
          <EditDropdownValueHeader field="which_to_grade" label="Which to grade" defaultValue="" />
        ),
        render: (row) => (
          <EditableCellFactory
            fieldName="which_to_grade"
            itemId={row.id}
            handleMouseDown={handleMouseDown}
            handleChange={handleChange}
            value={row.which_to_grade}
            questionType={row.question_type}
            isDragging={startItemId !== null}
            rowLabel={row.name || row.title}
          />
        )
      },
      {
        key: "points",
        field: "points",
        width: "8rem",
        align: "right",
        header: (
          <EditInputValueHeader
            field="points"
            label="Points"
            defaultValue={0}
            headerAlign="right"
          />
        ),
        render: (row) => (
          <EditableCellFactory
            fieldName="points"
            itemId={row.id}
            handleMouseDown={handleMouseDown}
            handleChange={handleChange}
            value={row.points}
            questionType={row.question_type}
            isDragging={startItemId !== null}
            rowLabel={row.name || row.title}
          />
        )
      }
    ];

    if (showAsyncColumn) {
      baseColumns.push({
        key: "async_mode",
        width: "12rem",
        header: <AsyncModeHeader hasApiKey={hasApiKey} />,
        render: (row) => (
          <Select
            aria-label={`Async mode for ${row.name || row.title}`}
            value={asyncModeToLabel(row.async_mode, hasApiKey)}
            onChange={(next) =>
              updateAssignmentQuestions([
                {
                  ...row,
                  question_json: JSON.stringify(row.question_json),
                  async_mode: labelToAsyncMode(next)
                }
              ])
            }
            data={ASYNC_MODE_OPTIONS(hasApiKey)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        )
      });
    }

    return baseColumns;
  }, [handleMouseDown, handleChange, startItemId, showAsyncColumn, hasApiKey, username]);

  return (
    <>
      <EditableDataTable
        data={filteredExercises}
        columns={columns}
        selection={selectedExercises}
        onSelectionChange={setSelectedExercises}
        onReorder={reorderExercises}
        ariaLabel="Assignment exercises"
        getRowLabel={(row) => row.name || row.title || `row ${row.id}`}
        containerRef={setContainerEl}
        scrollSentinelRef={scrollSentinelRef}
        flush
        emptyMessage={
          <div className={styles.emptyPanel}>
            <div className={styles.emptyIcon}>
              <Icon name="plus" size={22} />
            </div>
            <p className={styles.emptyTitle}>
              {globalFilter ? "No exercises match your search" : "No exercises yet"}
            </p>
            <p className={styles.emptyText}>
              {globalFilter
                ? "Try a different search term."
                : "Use “Add exercise” to choose, search, or create exercises."}
            </p>
          </div>
        }
      >
        <TableSelectionOverlay
          startItemId={startItemId}
          draggingFieldName={draggingFieldName}
          containerEl={containerEl}
          handleMouseUp={handleMouseUp}
          type="exercises"
          exercises={filteredExercises}
        />
      </EditableDataTable>

      <CopyExerciseModal
        visible={copyModalVisible}
        onHide={handleCopyModalHide}
        exercise={selectedExerciseForCopy}
        setCurrentEditExercise={setCurrentEditExercise}
        setViewMode={setViewMode}
      />
    </>
  );
};
