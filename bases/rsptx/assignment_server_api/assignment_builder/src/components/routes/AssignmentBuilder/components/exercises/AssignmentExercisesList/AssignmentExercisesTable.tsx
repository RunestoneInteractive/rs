import { EditableCellFactory } from "@components/ui/EditableTable/EditableCellFactory";
import { TableSelectionOverlay } from "@components/ui/EditableTable/TableOverlay";
import { ExerciseTypeTag } from "@components/ui/ExerciseTypeTag";
import { useReorderAssignmentExercisesMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { Column } from "primereact/column";
import { DataTable, DataTableSelectionMultipleChangeEvent } from "primereact/datatable";
import { Tooltip } from "primereact/tooltip";
import { useRef } from "react";

import { useJwtUser } from "@/hooks/useJwtUser";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise, supportedExerciseTypesToEdit } from "@/types/exercises";

import { EditDropdownValueHeader } from "../components/EditAllExercises/EditDropdownValueHeader";
import { EditInputValueHeader } from "../components/EditAllExercises/EditInputValueHeader";
import { ExercisePreviewModal } from "../components/ExercisePreview/ExercisePreviewModal";

import { SetCurrentEditExercise, ViewModeSetter, MouseUpHandler } from "./types";

interface AssignmentExercisesTableProps {
  assignmentExercises: Exercise[];
  selectedExercises: Exercise[];
  setSelectedExercises: (exercises: Exercise[]) => void;
  globalFilter: string;
  setCurrentEditExercise: SetCurrentEditExercise;
  setViewMode: ViewModeSetter;
  startRowIndex: number | null;
  draggingFieldName: DraggingExerciseColumns | null;
  handleMouseDown: (rowIndex: number, fieldName: DraggingExerciseColumns) => void;
  handleMouseUp: MouseUpHandler;
  handleChange: (rowIndex: number, fieldName: DraggingExerciseColumns, value: any) => void;
}

export const AssignmentExercisesTable = ({
  assignmentExercises,
  selectedExercises,
  setSelectedExercises,
  globalFilter,
  setCurrentEditExercise,
  setViewMode,
  startRowIndex,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: AssignmentExercisesTableProps) => {
  const { username } = useJwtUser();
  const [reorderExercises] = useReorderAssignmentExercisesMutation();
  const dataTableRef = useRef<DataTable<Exercise[]>>(null);

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
  const getTooltipText = (data: Exercise) => {
    return Object.entries({
      Author: data.author,
      Difficulty: data.difficulty,
      Tags: data.tags,
      Chapter: data.chapter
    })
      .filter(([, value]) => value || value === 0)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  };

  return (
    <div style={{ position: "relative" }}>
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
        scrollHeight="calc(100vh - 315px)"
        size="small"
        rowClassName={() => "assignmentExercise_row"}
        stripedRows
        showGridlines
        globalFilter={globalFilter}
        globalFilterFields={["name", "title"]}
        emptyMessage={
          <div className="text-center p-5">
            <i className="pi pi-book text-4xl text-500 mb-3" style={{ display: "block" }} />
            <p className="text-700 mb-2">No exercises added</p>
            <p className="text-500 text-sm">Click "Add Exercise" to get started</p>
          </div>
        }
        reorderableRows
        onRowReorder={(e) => reorderExercises(e.value.map((exercise) => exercise.id))}
      >
        <Column selectionMode="multiple" style={{ width: "3rem" }} />
        <Column
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
          header="Exercise"
          bodyStyle={{
            width: "15rem"
          }}
          body={(data: Exercise) => (
            <div
              style={{
                width: "15rem",
                maxWidth: "100%"
              }}
            >
              <div
                style={{
                  display: "flex",
                  wordBreak: "break-word"
                }}
                className="font-medium"
              >
                {data.name || data.title}
              </div>
              <div className="text-500 text-sm">{data.qnumber}</div>
            </div>
          )}
          sortField="name"
          sortable
        />
        <Column
          field="question_type"
          header="Type"
          body={(data: Exercise) => getExerciseTypeTag(data.question_type)}
          sortable
          style={{ width: "12rem" }}
        />
        <Column
          style={{ width: "12rem" }}
          field="autograde"
          header={() => (
            <EditDropdownValueHeader field="autograde" label="Autograde" defaultValue="" />
          )}
          bodyStyle={{ padding: 0 }}
          body={(rowData: Exercise, { rowIndex }) => (
            <EditableCellFactory
              fieldName="autograde"
              rowIndex={rowIndex}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.autograde}
              questionType={rowData.question_type}
              isDragging={startRowIndex !== null}
            />
          )}
        />
        <Column
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
          body={(rowData: Exercise, { rowIndex }) => (
            <EditableCellFactory
              fieldName="which_to_grade"
              rowIndex={rowIndex}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={rowData.which_to_grade}
              questionType={rowData.question_type}
              isDragging={startRowIndex !== null}
            />
          )}
        />
        <Column
          field="points"
          bodyStyle={{ padding: 0 }}
          style={{ width: "8rem" }}
          header={() => <EditInputValueHeader field="points" label="Points" defaultValue={0} />}
          body={(data: Exercise, { rowIndex }) => (
            <EditableCellFactory
              fieldName="points"
              rowIndex={rowIndex}
              handleMouseDown={handleMouseDown}
              handleChange={handleChange}
              value={data.points}
              questionType={data.question_type}
              isDragging={startRowIndex !== null}
            />
          )}
        />
        <Column rowReorder style={{ width: "3rem" }} />
      </DataTable>
      <TableSelectionOverlay
        startRowIndex={startRowIndex}
        draggingFieldName={draggingFieldName}
        tableRef={dataTableRef.current!}
        handleMouseUp={handleMouseUp}
      />
    </div>
  );
};
