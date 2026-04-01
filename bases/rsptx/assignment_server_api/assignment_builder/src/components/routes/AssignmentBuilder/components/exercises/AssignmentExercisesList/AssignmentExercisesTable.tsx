import { EditableCellFactory } from "@components/ui/EditableTable/EditableCellFactory";
import { TableSelectionOverlay } from "@components/ui/EditableTable/TableOverlay";
import { ExerciseTypeTag } from "@components/ui/ExerciseTypeTag";
import { useToastContext } from "@components/ui/ToastContext";
import {
  useHasApiKeyQuery,
  useReorderAssignmentExercisesMutation,
  useUpdateAssignmentQuestionsMutation
} from "@store/assignmentExercise/assignmentExercise.logic.api";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable, DataTableSelectionMultipleChangeEvent } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tooltip } from "primereact/tooltip";
import { useRef, useState } from "react";

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

const AsyncModeHeader = ({ hasApiKey }: { hasApiKey: boolean }) => {
  const { showToast } = useToastContext();
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const { assignmentExercises = [] } = useExercisesSelector();
  const overlayRef = useRef<OverlayPanel>(null);
  const [value, setValue] = useState("Standard");

  const handleSubmit = async () => {
    const exercises = assignmentExercises.map((ex) => ({
      ...ex,
      question_json: JSON.stringify(ex.question_json),
      use_llm: value === "LLM"
    }));
    const { error } = await updateExercises(exercises);
    if (!error) {
      overlayRef.current?.hide();
      showToast({ severity: "success", summary: "Success", detail: "Exercises updated successfully" });
    } else {
      showToast({ severity: "error", summary: "Error", detail: "Failed to update exercises" });
    }
  };

  return (
    <div className="flex align-items-center gap-2">
      <span>Async Mode</span>
      <Button
        className="icon-button-sm"
        tooltip='Edit "Async Mode" for all exercises'
        rounded
        text
        severity="secondary"
        size="small"
        icon="pi pi-pencil"
        onClick={(e) => overlayRef.current?.toggle(e)}
      />
      <OverlayPanel closeIcon ref={overlayRef} style={{ width: "17rem" }}>
        <div className="p-1 flex gap-2 flex-column align-items-center justify-content-around">
          <div><span>Edit "Async Mode" for all exercises</span></div>
          <div style={{ width: "100%" }}>
            <Dropdown
              style={{ width: "100%" }}
              value={value}
              onChange={(e) => setValue(e.value)}
              options={[
                { label: "Standard", value: "Standard" },
                { label: "LLM", value: "LLM", disabled: !hasApiKey }
              ]}
              optionLabel="label"
              optionDisabled="disabled"
              scrollHeight="auto"
            />
          </div>
          <div className="flex flex-row justify-content-around align-items-center w-full">
            <Button size="small" severity="danger" onClick={() => overlayRef.current?.hide()}>Cancel</Button>
            <Button size="small" onClick={handleSubmit}>Submit</Button>
          </div>
        </div>
      </OverlayPanel>
    </div>
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
  handleChange: (itemId: number, fieldName: DraggingExerciseColumns, value: any) => void;
}

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
  handleChange
}: AssignmentExercisesTableProps) => {
  const { username } = useJwtUser();
  const [reorderExercises] = useReorderAssignmentExercisesMutation();
  const [updateAssignmentQuestions] = useUpdateAssignmentQuestionsMutation();
  const { selectedAssignment } = useSelectedAssignment();
  const { data: { hasApiKey = false, asyncLlmModesEnabled = false } = {} } = useHasApiKeyQuery();
  const isPeerAsync =
    selectedAssignment?.kind === "Peer" && selectedAssignment?.peer_async_visible === true;
  const dataTableRef = useRef<DataTable<Exercise[]>>(null);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedExerciseForCopy, setSelectedExerciseForCopy] = useState<Exercise | null>(null);

  const getExerciseTypeTag = (type: string) => {
    if (!type) return null;
    return <ExerciseTypeTag type={type} />;
  };

  const getIsEditable = (exercise: Exercise) => {
    return (
      exercise.owner === username &&
      supportedExerciseTypesToEdit.includes(exercise.question_type) &&
      !!exercise.question_json
    );
  };

  const getIsCopyable = (exercise: Exercise) => {
    return !!exercise.question_json;
  };

  const handleCopyClick = (exercise: Exercise) => {
    setSelectedExerciseForCopy(exercise);
    setCopyModalVisible(true);
  };

  const handleCopyModalHide = () => {
    setCopyModalVisible(false);
    setSelectedExerciseForCopy(null);
  };

  const getTooltipText = (data: Exercise) => {
    return Object.entries({
      Author: data.author,
      Difficulty: difficultyOptions[data.difficulty as keyof typeof difficultyOptions],
      Tags: data.tags,
      Chapter: data.chapter
    })
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  };

  return (
    <div style={{ position: "relative", overflow: "auto" }}>
      <DataTable<Exercise[]>
        style={{ minWidth: "100%", userSelect: "none" }}
        value={assignmentExercises}
        ref={dataTableRef}
        selection={selectedExercises}
        selectionMode="checkbox"
        onSelectionChange={(e: DataTableSelectionMultipleChangeEvent<Exercise[]>) =>
          setSelectedExercises(e.value)
        }
        dataKey="id"
        scrollable
        scrollHeight="calc(100vh - 280px)"
        size="small"
        rowClassName={() => "assignmentExercise_row"}
        stripedRows
        showGridlines
        globalFilter={globalFilter}
        globalFilterFields={["name", "title", "qnumber"]}
        emptyMessage={
          <div className="text-center p-5">
            <i className="pi pi-book text-4xl text-500 mb-3" style={{ display: "block" }} />
            <p className="text-700 mb-2">No exercises added</p>
            <p className="text-500 text-sm">Click "Add Exercise" to get started</p>
          </div>
        }
        reorderableRows
        onRowReorder={(e) => reorderExercises(e.value.map((exercise) => exercise.id))}
        resizableColumns
        columnResizeMode="fit"
      >
        <Column resizeable={false} selectionMode="multiple" style={{ width: "3rem" }} />
        <Column
          resizeable={false}
          style={{ width: "2rem" }}
          body={(data: Exercise) => (
            <div className="flex gap-2 justify-content-center">
              <Tooltip target={`#info-icon-${data.id}`} content={getTooltipText(data)} />
              <i
                className="pi pi-info-circle"
                id={`info-icon-${data.id}`}
                style={{ cursor: "pointer" }}
              />
            </div>
          )}
        />
        <Column
          resizeable={false}
          style={{ width: "3rem" }}
          body={(data: Exercise) => (
            <div className="flex gap-2 justify-content-center">
              {data.htmlsrc && (
                <ExercisePreviewModal
                  htmlsrc={data.htmlsrc}
                  triggerButton={<i className="pi pi-eye" style={{ cursor: "pointer" }} />}
                />
              )}
            </div>
          )}
        />
        <Column
          resizeable={false}
          style={{ width: "3rem" }}
          body={(data: Exercise) => (
            <div className="flex gap-2 justify-content-center">
              {getIsEditable(data) && (
                <i
                  className="pi pi-pencil"
                  style={{
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    setCurrentEditExercise(data);
                    setViewMode("edit");
                  }}
                />
              )}
            </div>
          )}
        />
        <Column
          resizeable={false}
          style={{ width: "3rem" }}
          body={(data: Exercise) => (
            <div className="flex gap-2 justify-content-center">
              {getIsCopyable(data) && (
                <i
                  className="pi pi-copy"
                  style={{
                    cursor: "pointer"
                  }}
                  onClick={() => handleCopyClick(data)}
                  title="Copy exercise"
                />
              )}
            </div>
          )}
        />
        <Column
          header="Exercise"
          bodyStyle={{
            maxWidth: "20rem"
          }}
          body={(data: Exercise) => (
            <div
              style={{
                maxWidth: "100%"
              }}
            >
              <div className="font-medium nowrap">{data.name || data.title}</div>
              <div className="text-500 text-sm nowrap">{data.qnumber}</div>
            </div>
          )}
          resizeable
        />
        <Column
          resizeable={false}
          field="question_type"
          header="Type"
          body={(data: Exercise) => getExerciseTypeTag(data.question_type)}
          style={{ width: "12rem" }}
        />
        <Column
          resizeable={false}
          style={{ width: "12rem" }}
          field="autograde"
          header={() => (
            <EditDropdownValueHeader field="autograde" label="Autograde" defaultValue="" />
          )}
          bodyStyle={{ padding: 0 }}
          body={(rowData: Exercise) => (
            <EditableCellFactory
              fieldName="autograde"
              itemId={rowData.id}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.autograde}
              questionType={rowData.question_type}
              isDragging={startItemId !== null}
            />
          )}
        />
        <Column
          resizeable={false}
          field="which_to_grade"
          header={() => (
            <EditDropdownValueHeader
              field="which_to_grade"
              label="Which To Grade"
              defaultValue=""
            />
          )}
          style={{ width: "12rem" }}
          bodyStyle={{ padding: 0 }}
          body={(rowData: Exercise) => (
            <EditableCellFactory
              fieldName="which_to_grade"
              itemId={rowData.id}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.which_to_grade}
              questionType={rowData.question_type}
              isDragging={startItemId !== null}
            />
          )}
        />
        <Column
          resizeable={false}
          field="points"
          bodyStyle={{ padding: 0 }}
          style={{ width: "8rem" }}
          header={() => <EditInputValueHeader field="points" label="Points" defaultValue={0} />}
          body={(data: Exercise) => (
            <EditableCellFactory
              fieldName="points"
              itemId={data.id}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={data.points}
              questionType={data.question_type}
              isDragging={startItemId !== null}
            />
          )}
        />
        {isPeerAsync && asyncLlmModesEnabled && (
          <Column
            resizeable={false}
            style={{ width: "12rem" }}
            header={() => <AsyncModeHeader hasApiKey={hasApiKey} />}
            bodyStyle={{ padding: 0 }}
            body={(data: Exercise) => (
              <div className="editable-table-cell" style={{ position: "relative" }}>
                <Dropdown
                  className="editable-table-dropdown"
                  value={data.use_llm && hasApiKey ? "LLM" : "Standard"}
                  onChange={(e) => updateAssignmentQuestions([{ ...data, use_llm: e.value === "LLM" }])}
                  options={[
                    { label: "Standard", value: "Standard" },
                    { label: "LLM", value: "LLM", disabled: !hasApiKey }
                  ]}
                  optionLabel="label"
                  optionDisabled="disabled"
                  scrollHeight="auto"
                  tooltip={!hasApiKey ? "Add an API key to enable LLM mode" : undefined}
                  tooltipOptions={{ showOnDisabled: true }}
                />
              </div>
            )}
          />
        )}
        <Column resizeable={false} rowReorder style={{ width: "3rem" }} />
      </DataTable>
      <TableSelectionOverlay
        startItemId={startItemId}
        draggingFieldName={draggingFieldName}
        tableRef={dataTableRef.current!}
        handleMouseUp={handleMouseUp}
        type="exercises"
        exercises={assignmentExercises}
      />

      <CopyExerciseModal
        visible={copyModalVisible}
        onHide={handleCopyModalHide}
        exercise={selectedExerciseForCopy}
        setCurrentEditExercise={setCurrentEditExercise}
        setViewMode={setViewMode}
      />
    </div>
  );
};
